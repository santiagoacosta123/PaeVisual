import { Component, OnInit, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SiraeService } from '../services/contratos_pae.service';
import { UsuarioService } from '../services/usuario.service';
import { RolService } from '../services/rol.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  selector: 'app-contrato-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contrato-detalle.html',
  styleUrls: ['./contrato-detalle.css']
})
export class ContratoDetalleComponent implements OnInit {
  @Input() contratoId: string | null = null;
  @Input() modo: 'consulta' | 'nuevo' | 'edicion' = 'consulta';
  @Input() pestanaInicial: string = 'resumen';
  @Output() cerrar = new EventEmitter<any>();
  
  cargandoDetalle = false;
  errorCargaDetalle = '';
  
  pestanaActiva = 'resumen'; // 'resumen', 'distribucion', 'jornadas', 'historial', 'prorrogas'

  formatearFecha(fechaStr?: string): string {
    if (!fechaStr) return 'No registrada';
    try {
      const partes = fechaStr.split('-');
      if (partes.length === 3) {
        const anio = partes[0];
        const mesNum = parseInt(partes[1], 10);
        const dia = parseInt(partes[2], 10);
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const mesNombre = meses[mesNum - 1] || partes[1];
        const diaStr = dia < 10 ? `0${dia}` : `${dia}`;
        return `${diaStr} de ${mesNombre} de ${anio}`;
      }
      const d = new Date(fechaStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return fechaStr;
    } catch {
      return fechaStr;
    }
  }

  formatearFechaDiaMes(fechaStr?: string): string {
    if (!fechaStr) return 'No reg.';
    try {
      const partes = fechaStr.split('-');
      if (partes.length === 3) {
        const mesNum = parseInt(partes[1], 10);
        const dia = parseInt(partes[2], 10);
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const mesNombre = meses[mesNum - 1] || partes[1];
        const diaStr = dia < 10 ? `0${dia}` : `${dia}`;
        return `${diaStr} de ${mesNombre}`;
      }
      return fechaStr;
    } catch {
      return fechaStr;
    }
  }

  formatearFechaAnio(fechaStr?: string): string {
    if (!fechaStr) return '';
    try {
      const partes = fechaStr.split('-');
      if (partes.length === 3) {
        return `de ${partes[0]}`;
      }
      return '';
    } catch {
      return '';
    }
  }

  jornadas: any[] = [];
  seccionesMenu: any[] = [];
  contratosSeccionMenu: any[] = [];
  supervisores: any[] = [];
  cargandoSupervisores = false;
  rolesCatalogo: any[] = [];
  contrato: any = { 
    codigo: '', 
    institucion: '', 
    zona: '', 
    fecha_inicio: '', 
    fecha_fin: '', 
    estado: 'Activo',
    cupos: 0,
    id_usuario_supervisor: null 
  };
  jornadaSeleccionada: any = null;

  get nombreSupervisorAsignado(): string {
    if (!this.contrato?.id_usuario_supervisor) return 'Sin asignar';
    const sup = this.supervisores.find(s => Number(s.id_usuario) === Number(this.contrato.id_usuario_supervisor));
    return sup ? sup.nombre_completo : `Supervisor #${this.contrato.id_usuario_supervisor}`;
  }

  get opcionesSupervisores(): any[] {
    const lista = (this.supervisores || []).map(s => ({
      id_usuario: Number(s.id_usuario),
      nombre_completo: s.nombre_completo
    }));
    return [
      { id_usuario: null, nombre_completo: 'Sin supervisor asignado...' },
      ...lista
    ];
  }

  // ========================================================
  // CONTROL DE VIGENCIA Y REGLAS CONTRACTUALES
  // ========================================================
  esContratoProximoAVencer = false;
  diasRestantesVigencia = 0;
  mensajeVigenciaContrato = '';

  // ========================================================
  // GESTIÓN DE PRÓRROGAS Y RENOVACIONES CONTRACTUALES
  // ========================================================
  modalProrrogaAbierto = false;
  guardandoProrroga = false;
  tipoOperacionVigencia: 'PRORROGA' | 'RENOVACION' = 'PRORROGA';

  datosProrroga = {
    nuevaFechaInicio: '',
    nuevaFechaFin: '',
    nuevosCupos: 0,
    numeroAutorizacion: '',
    motivo: '',
    errorValidacion: ''
  };

  historialModificaciones: any[] = [];

  get nombreUsuarioResponsableActual(): string {
    const u = this.authService.obtenerUsuario();
    if (!u) return 'Superadministrador';
    const nom = `${u.nombre || ''} ${u.apellido || ''}`.trim();
    return nom ? `${nom} (${u.rol || 'Superadministrador'})` : (u.correo || 'Superadministrador');
  }

  cargarHistorialLocal() {
    if (!this.contratoId) return;
    try {
      const data = localStorage.getItem(`sirae_historial_modificaciones_${this.contratoId}`);
      if (data) {
        this.historialModificaciones = JSON.parse(data);
      } else {
        this.historialModificaciones = [];
      }
    } catch {
      this.historialModificaciones = [];
    }
  }

  guardarHistorialLocal() {
    if (!this.contratoId) return;
    try {
      localStorage.setItem(`sirae_historial_modificaciones_${this.contratoId}`, JSON.stringify(this.historialModificaciones));
    } catch (e) {
      console.warn('Error guardando historial local de prórrogas:', e);
    }
  }

  abrirModalProrroga(tipo: 'PRORROGA' | 'RENOVACION' = 'PRORROGA') {
    this.tipoOperacionVigencia = tipo;
    const fechaFinActual = this.contrato?.fecha_fin || new Date().toISOString().split('T')[0];
    
    // Sugerencia de fechas coherentes
    let sugInicio = this.contrato?.fecha_inicio || '';
    let sugFin = '';

    try {
      const fFin = new Date(fechaFinActual + 'T00:00:00');
      if (tipo === 'PRORROGA') {
        // En prórroga se sugiere extender 6 meses desde la fecha fin actual
        const fFinSugerida = new Date(fFin);
        fFinSugerida.setMonth(fFinSugerida.getMonth() + 6);
        sugFin = fFinSugerida.toISOString().split('T')[0];
        sugInicio = this.contrato?.fecha_inicio || '';
      } else {
        // En renovación se sugiere iniciar al día siguiente de la fecha fin actual
        const fIniSugerida = new Date(fFin);
        fIniSugerida.setDate(fIniSugerida.getDate() + 1);
        sugInicio = fIniSugerida.toISOString().split('T')[0];

        const fFinRenovada = new Date(fIniSugerida);
        fFinRenovada.setFullYear(fFinRenovada.getFullYear() + 1);
        sugFin = fFinRenovada.toISOString().split('T')[0];
      }
    } catch {
      sugFin = '';
    }

    this.datosProrroga = {
      nuevaFechaInicio: sugInicio,
      nuevaFechaFin: sugFin,
      nuevosCupos: Number(this.contrato?.cupos) || 0,
      numeroAutorizacion: '',
      motivo: '',
      errorValidacion: ''
    };
    this.modalProrrogaAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalProrroga() {
    this.modalProrrogaAbierto = false;
    this.datosProrroga.errorValidacion = '';
    this.cdr.detectChanges();
  }

  cambiarTipoOperacion(tipo: 'PRORROGA' | 'RENOVACION') {
    this.tipoOperacionVigencia = tipo;
    this.abrirModalProrroga(tipo);
  }

  validarFechasProrroga(): boolean {
    this.datosProrroga.errorValidacion = '';

    if (!this.datosProrroga.numeroAutorizacion || !this.datosProrroga.numeroAutorizacion.trim()) {
      this.datosProrroga.errorValidacion = 'Debes ingresar el número de autorización, resolución o acto administrativo.';
      return false;
    }

    if (!this.datosProrroga.motivo || !this.datosProrroga.motivo.trim()) {
      this.datosProrroga.errorValidacion = 'Debes registrar el motivo o justificación técnica/jurídica de la operación.';
      return false;
    }

    const fechaFinActual = this.contrato?.fecha_fin || '';

    if (this.tipoOperacionVigencia === 'PRORROGA') {
      if (!this.datosProrroga.nuevaFechaFin) {
        this.datosProrroga.errorValidacion = 'Debes especificar la nueva fecha de finalización de la prórroga.';
        return false;
      }
      // Validación de coherencia con el contrato original:
      if (fechaFinActual && this.datosProrroga.nuevaFechaFin <= fechaFinActual) {
        this.datosProrroga.errorValidacion = `La nueva fecha de finalización (${this.datosProrroga.nuevaFechaFin}) debe ser estrictamente posterior a la fecha de finalización actual del contrato (${fechaFinActual}).`;
        return false;
      }
    } else {
      // Renovación
      if (!this.datosProrroga.nuevaFechaInicio) {
        this.datosProrroga.errorValidacion = 'Debes ingresar la fecha de inicio del nuevo periodo contractual.';
        return false;
      }
      if (!this.datosProrroga.nuevaFechaFin) {
        this.datosProrroga.errorValidacion = 'Debes ingresar la fecha de finalización del nuevo periodo contractual.';
        return false;
      }
      if (this.datosProrroga.nuevaFechaFin <= this.datosProrroga.nuevaFechaInicio) {
        this.datosProrroga.errorValidacion = 'La fecha de finalización debe ser posterior a la fecha de inicio de la renovación.';
        return false;
      }
      if (fechaFinActual && this.datosProrroga.nuevaFechaInicio < fechaFinActual) {
        this.datosProrroga.errorValidacion = `La fecha de inicio de la renovación (${this.datosProrroga.nuevaFechaInicio}) debe ser igual o posterior a la fecha de término del contrato anterior (${fechaFinActual}).`;
        return false;
      }
    }

    return true;
  }

  guardarProrrogaORenovacion() {
    if (!this.validarFechasProrroga()) {
      return;
    }

    this.guardandoProrroga = true;
    const ahora = new Date();
    const fechaRegistroFormateada = ahora.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const fInicioAnterior = this.contrato.fecha_inicio;
    const fFinAnterior = this.contrato.fecha_fin;
    const cuposAnteriores = Number(this.contrato.cupos) || 0;
    const nuevosCupos = Number(this.datosProrroga.nuevosCupos) > 0 ? Number(this.datosProrroga.nuevosCupos) : cuposAnteriores;

    const nuevaFInicio = this.tipoOperacionVigencia === 'RENOVACION' ? this.datosProrroga.nuevaFechaInicio : this.contrato.fecha_inicio;
    const nuevaFFin = this.datosProrroga.nuevaFechaFin;

    // Crear registro de auditoría
    const registroModificacion = {
      id_modificacion: Date.now(),
      tipo: this.tipoOperacionVigencia,
      fecha_inicio_anterior: fInicioAnterior,
      fecha_fin_anterior: fFinAnterior,
      nueva_fecha_inicio: nuevaFInicio,
      nueva_fecha_fin: nuevaFFin,
      cupos_anteriores: cuposAnteriores,
      nuevos_cupos: nuevosCupos,
      numero_autorizacion: this.datosProrroga.numeroAutorizacion.trim(),
      motivo: this.datosProrroga.motivo.trim(),
      usuario_responsable: this.nombreUsuarioResponsableActual,
      fecha_registro: fechaRegistroFormateada
    };

    // Actualizar datos del contrato
    this.contrato.fecha_inicio = nuevaFInicio;
    this.contrato.fecha_fin = nuevaFFin;
    this.contrato.cupos = nuevosCupos;

    // Actualizar vigencia según la nueva fecha
    const nuevaVigencia = this.evaluarVigencia(nuevaFFin, 'Activo');
    this.contrato.estado = nuevaVigencia.estado;
    this.esContratoProximoAVencer = nuevaVigencia.esProximoAVencer;
    this.diasRestantesVigencia = nuevaVigencia.diasRestantes;
    this.mensajeVigenciaContrato = nuevaVigencia.mensajeVigencia;

    // Conservar historial
    this.historialModificaciones.unshift(registroModificacion);
    this.guardarHistorialLocal();

    // Sincronizar en base de datos
    if (this.contratoId && this.contratoId !== 'nuevo' && this.contratoId !== '0') {
      const payloadActualizado = {
        ...this.contrato,
        fecha_inicio: nuevaFInicio,
        fecha_fin: nuevaFFin,
        estado: this.contrato.estado,
        cupos: nuevosCupos
      };
      this.siraeService.actualizarContrato(Number(this.contratoId), payloadActualizado).subscribe({
        next: () => {},
        error: (err) => console.warn('Error sincronizando contrato prorrogado en backend:', err)
      });
    }

    this.guardandoProrroga = false;
    this.modalProrrogaAbierto = false;

    const labelOp = this.tipoOperacionVigencia === 'PRORROGA' ? 'Prórroga' : 'Renovación';
    void this.sweetAlert.success(
      `¡${labelOp} registrada exitosamente!`,
      `El contrato ${this.contrato.codigo} ha sido actualizado con nueva vigencia hasta el ${nuevaFFin}. Estado: ${this.contrato.estado}.`
    );

    this.cdr.detectChanges();
  }

  // ========================================================
  // EDICIÓN DE INFORMACIÓN AUTORIZADA Y GESTIÓN DE ESTADOS
  // ========================================================
  modalEdicionAbierto = false;
  guardandoEdicion = false;

  datosEdicion: {
    estado: 'Activo' | 'Inactivo' | 'Finalizado';
    id_usuario_supervisor: number | null;
    cupos: number;
    zona: string;
    fecha_inicio: string;
    fecha_fin: string;
    errorValidacion: string;
  } = {
    estado: 'Activo',
    id_usuario_supervisor: null,
    cupos: 0,
    zona: '',
    fecha_inicio: '',
    fecha_fin: '',
    errorValidacion: ''
  };

  abrirModalEdicion() {
    this.modo = 'edicion';
    this.datosEdicion = {
      estado: (this.contrato?.estado as any) || 'Activo',
      id_usuario_supervisor: this.contrato?.id_usuario_supervisor ? Number(this.contrato.id_usuario_supervisor) : null,
      cupos: Number(this.contrato?.cupos) || 0,
      zona: this.contrato?.zona || '',
      fecha_inicio: this.contrato?.fecha_inicio || '',
      fecha_fin: this.contrato?.fecha_fin || '',
      errorValidacion: ''
    };
    this.modalEdicionAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalEdicion() {
    this.modalEdicionAbierto = false;
    this.datosEdicion.errorValidacion = '';
    if (this.contratoId && this.contratoId !== 'nuevo' && this.contratoId !== '0') {
      this.modo = 'consulta';
    } else {
      this.volver();
    }
    this.cdr.detectChanges();
  }

  seleccionarEstadoEdicion(nuevoEstado: 'Activo' | 'Inactivo' | 'Finalizado') {
    this.datosEdicion.estado = nuevoEstado;
    this.cdr.detectChanges();
  }

  validarEdicionContrato(): boolean {
    this.datosEdicion.errorValidacion = '';

    const nuevosCupos = Number(this.datosEdicion.cupos);
    if (nuevosCupos <= 0) {
      this.datosEdicion.errorValidacion = 'La cantidad de cupos autorizados debe ser un número entero mayor a 0.';
      return false;
    }

    // Criterio 5: Si se modifica el total de cupos autorizados, el sistema debe validar que no sea inferior
    // a los cupos que ya se encuentran distribuidos entre las sedes.
    if (nuevosCupos < this.totalCuposAsignadosSedes) {
      this.datosEdicion.errorValidacion = `Los cupos autorizados (${nuevosCupos}) no pueden ser inferiores al total de cupos ya distribuidos entre las sedes (${this.totalCuposAsignadosSedes} cupos). Ajusta primero la distribución por sede antes de reducir los cupos globales.`;
      return false;
    }

    // Criterio 4: Las fechas de vigencia deben mantener coherencia: fecha_fin no anterior a fecha_inicio.
    if (this.datosEdicion.fecha_inicio && this.datosEdicion.fecha_fin) {
      if (this.datosEdicion.fecha_fin < this.datosEdicion.fecha_inicio) {
        this.datosEdicion.errorValidacion = 'La fecha de finalización no puede ser anterior a la fecha de inicio del contrato.';
        return false;
      }
    }

    return true;
  }

  async guardarEdicionContrato() {
    if (!this.validarEdicionContrato()) {
      return;
    }

    const estadoAnterior = this.contrato?.estado || 'Activo';
    const nuevoEstado = this.datosEdicion.estado;

    // Criterios 7 y 8: Antes de inactivar un contrato o aplicar cambios importantes, solicitar confirmación
    if (nuevoEstado === 'Inactivo' && estadoAnterior !== 'Inactivo') {
      const confirmacion = await this.sweetAlert.confirm(
        '¿Confirmas inactivar este contrato PAE?',
        'Al inactivar el contrato, se suspenderán los procesos operativos de suministro del PAE y no se permitirán nuevas operaciones que requieran un contrato vigente. Se conservará la distribución de cupos y el historial. ¿Deseas continuar?'
      );
      if (!confirmacion || !confirmacion.isConfirmed) {
        return;
      }
    } else if (nuevoEstado === 'Finalizado' && estadoAnterior !== 'Finalizado') {
      const confirmacion = await this.sweetAlert.confirm(
        '¿Confirmas finalizar este contrato PAE?',
        'El contrato concluirá formalmente su periodo de vigencia. Se conservarán íntegros todos los registros y distribuciones de cupos, pero no se permitirán nuevas operaciones vigentes. ¿Deseas continuar?'
      );
      if (!confirmacion || !confirmacion.isConfirmed) {
        return;
      }
    }

    this.guardandoEdicion = true;

    // Registro detallado de campos modificados (Criterio 11 e Historia 5)
    const cambiosDetectados: { campo: string; anterior: string; nuevo: string }[] = [];

    // 1. Estado
    if (estadoAnterior !== nuevoEstado) {
      cambiosDetectados.push({
        campo: 'Estado del contrato',
        anterior: estadoAnterior,
        nuevo: nuevoEstado
      });
    }

    // 2. Cupos autorizados
    const cuposAnt = Number(this.contrato?.cupos) || 0;
    const cuposNuevos = Number(this.datosEdicion.cupos);
    if (cuposAnt !== cuposNuevos) {
      cambiosDetectados.push({
        campo: 'Cupos autorizados',
        anterior: `${cuposAnt} cupos`,
        nuevo: `${cuposNuevos} cupos`
      });
    }

    // 3. Supervisor encargado
    const supAntId = this.contrato?.id_usuario_supervisor ? Number(this.contrato.id_usuario_supervisor) : null;
    const supNuevoId = this.datosEdicion.id_usuario_supervisor ? Number(this.datosEdicion.id_usuario_supervisor) : null;
    if (supAntId !== supNuevoId) {
      const supAntNombre = this.nombreSupervisorAsignado;
      let supNuevoNombre = 'Sin asignar';
      if (supNuevoId) {
        const supObj = this.supervisores.find(s => Number(s.id_usuario) === supNuevoId);
        supNuevoNombre = supObj ? supObj.nombre_completo : `Supervisor #${supNuevoId}`;
      }
      cambiosDetectados.push({
        campo: 'Supervisor encargado',
        anterior: supAntNombre,
        nuevo: supNuevoNombre
      });
    }

    // 4. Fechas de vigencia
    const fIniAnt = this.contrato?.fecha_inicio || '';
    const fFinAnt = this.contrato?.fecha_fin || '';
    if (fIniAnt !== this.datosEdicion.fecha_inicio || fFinAnt !== this.datosEdicion.fecha_fin) {
      cambiosDetectados.push({
        campo: 'Fechas de vigencia',
        anterior: `${fIniAnt} al ${fFinAnt}`,
        nuevo: `${this.datosEdicion.fecha_inicio} al ${this.datosEdicion.fecha_fin}`
      });
    }

    // 5. Zona
    const zonaAnt = this.contrato?.zona || '';
    if (zonaAnt !== this.datosEdicion.zona) {
      cambiosDetectados.push({
        campo: 'Zona geográfica',
        anterior: zonaAnt || 'Sin zona',
        nuevo: this.datosEdicion.zona
      });
    }

    // Registrar en auditoría solo si hubo cambios reales
    const ahora = new Date();
    const fechaRegistroFormateada = ahora.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    if (cambiosDetectados.length > 0) {
      const registroAudit = {
        id_modificacion: Date.now(),
        tipo: 'MODIFICACION',
        usuario_responsable: this.nombreUsuarioResponsableActual,
        fecha_registro: fechaRegistroFormateada,
        cambios: cambiosDetectados,
        estado_resultante: nuevoEstado
      };
      this.historialModificaciones.unshift(registroAudit);
      this.guardarHistorialLocal();
    }

    // Actualizar contrato localmente
    this.contrato.cupos = cuposNuevos;
    this.contrato.id_usuario_supervisor = supNuevoId;
    this.contrato.zona = this.datosEdicion.zona;
    this.contrato.fecha_inicio = this.datosEdicion.fecha_inicio;
    this.contrato.fecha_fin = this.datosEdicion.fecha_fin;

    // Actualizar supervisor nombre si existe
    if (supNuevoId) {
      const supObj = this.supervisores.find(s => Number(s.id_usuario) === supNuevoId);
      if (supObj) this.contrato.supervisor_nombre = supObj.nombre_completo;
    } else {
      this.contrato.supervisor_nombre = 'Sin asignar';
    }

    // Reevaluar vigencia según el nuevo estado y fecha fin
    if (nuevoEstado === 'Inactivo') {
      this.contrato.estado = 'Inactivo';
      this.esContratoProximoAVencer = false;
      this.mensajeVigenciaContrato = 'Inactivo';
    } else if (nuevoEstado === 'Finalizado') {
      this.contrato.estado = 'Finalizado';
      this.esContratoProximoAVencer = false;
      this.mensajeVigenciaContrato = 'Finalizado';
    } else {
      const vigenciaCalculada = this.evaluarVigencia(this.datosEdicion.fecha_fin, 'Activo');
      this.contrato.estado = vigenciaCalculada.estado;
      this.esContratoProximoAVencer = vigenciaCalculada.esProximoAVencer;
      this.diasRestantesVigencia = vigenciaCalculada.diasRestantes;
      this.mensajeVigenciaContrato = vigenciaCalculada.mensajeVigencia;
    }

    const payload = {
      ...this.contrato,
      cupos: cuposNuevos,
      id_usuario_supervisor: supNuevoId,
      estado: this.contrato.estado,
      zona: this.contrato.zona,
      fecha_inicio: this.contrato.fecha_inicio,
      fecha_fin: this.contrato.fecha_fin
    };

    if (this.contratoId && this.contratoId !== 'nuevo' && this.contratoId !== '0') {
      this.siraeService.actualizarContrato(Number(this.contratoId), payload).subscribe({
        next: async () => {
          this.guardandoEdicion = false;
          this.modalEdicionAbierto = false;
          await this.sweetAlert.success(
            '¡Contrato actualizado!',
            `Los cambios del contrato ${this.contrato.codigo} han sido guardados exitosamente.`
          );
          this.cdr.detectChanges();
        },
        error: async (err) => {
          this.guardandoEdicion = false;
          console.error('Error al actualizar contrato:', err);
          await this.sweetAlert.error(
            'Error al actualizar',
            'Hubo un problema al actualizar el contrato en el servidor. La información anterior se ha conservado.'
          );
          this.cdr.detectChanges();
        }
      });
    } else {
      this.guardandoEdicion = false;
      this.modalEdicionAbierto = false;
      await this.sweetAlert.success(
        '¡Contrato actualizado!',
        `Los cambios del contrato ${this.contrato.codigo} han sido guardados exitosamente.`
      );
      this.cdr.detectChanges();
    }
  }

  get esContratoNoVigente(): boolean {
    const est = (this.contrato?.estado || '').toLowerCase();
    return est.includes('finalizado') || est.includes('terminado') || est.includes('inactivo');
  }

  get esContratoFinalizado(): boolean {
    const est = (this.contrato?.estado || '').toLowerCase();
    return est.includes('finalizado') || est.includes('terminado');
  }

  /**
   * Evalúa la vigencia del contrato según las fechas y el día de hoy:
   * - Si fecha_fin < hoy: el estado pasa a 'Finalizado'.
   * - Si faltan entre 0 y 30 días: 'Próximo a vencer' (Alerta).
   * - Si faltan > 30 días: 'Activo' (Vigente).
   */
  evaluarVigencia(fechaFinStr: string, estadoOriginal: string): {
    estado: 'Activo' | 'Inactivo' | 'Finalizado';
    esProximoAVencer: boolean;
    diasRestantes: number;
    mensajeVigencia: string;
    alertaNivel: 'normal' | 'advertencia' | 'vencido' | 'inactivo';
  } {
    const estadoNorm = (estadoOriginal || 'Activo').trim();
    if (estadoNorm.toLowerCase() === 'inactivo') {
      return {
        estado: 'Inactivo',
        esProximoAVencer: false,
        diasRestantes: 0,
        mensajeVigencia: 'Inactivo',
        alertaNivel: 'inactivo'
      };
    }

    if (!fechaFinStr) {
      return {
        estado: estadoNorm.toLowerCase() === 'finalizado' ? 'Finalizado' : 'Activo',
        esProximoAVencer: false,
        diasRestantes: 9999,
        mensajeVigencia: 'Sin fecha límite',
        alertaNivel: 'normal'
      };
    }

    const hoy = new Date();
    const hoyMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);

    const partes = fechaFinStr.split('-');
    let fechaFinMedianoche: Date;
    if (partes.length === 3) {
      fechaFinMedianoche = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]), 0, 0, 0, 0);
    } else {
      fechaFinMedianoche = new Date(fechaFinStr);
      fechaFinMedianoche.setHours(0, 0, 0, 0);
    }

    const diffMs = fechaFinMedianoche.getTime() - hoyMedianoche.getTime();
    const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // Regla de vigencia: Al cumplirse la fecha de finalización (diasRestantes < 0) pasa a Finalizado
    if (diasRestantes < 0 || estadoNorm.toLowerCase() === 'finalizado') {
      const diasPasados = Math.abs(diasRestantes);
      return {
        estado: 'Finalizado',
        esProximoAVencer: false,
        diasRestantes,
        mensajeVigencia: diasRestantes < 0 ? `Venció hace ${diasPasados} ${diasPasados === 1 ? 'día' : 'días'}` : 'Finalizado',
        alertaNivel: 'vencido'
      };
    }

    // Si le quedan entre 0 y 30 días, es Próximo a vencer (Alerta)
    if (diasRestantes <= 30) {
      const msg = diasRestantes === 0 ? 'Vence hoy' : (diasRestantes === 1 ? 'Vence mañana' : `Vence en ${diasRestantes} días`);
      return {
        estado: 'Activo',
        esProximoAVencer: true,
        diasRestantes,
        mensajeVigencia: msg,
        alertaNivel: 'advertencia'
      };
    }

    // Vigente normal (> 30 días)
    return {
      estado: 'Activo',
      esProximoAVencer: false,
      diasRestantes,
      mensajeVigencia: `Vigente (${diasRestantes} días restantes)`,
      alertaNivel: 'normal'
    };
  }

  readonly zonasDisponibles: string[] = [
    'Norte',
    'Sur',
    'Este',
    'Oeste',
    'Centro',
    'Oriente',
    'Occidente',
    'Nororiente',
    'Noroccidente',
    'Suroriente',
    'Suroccidente',
    'Urbana',
    'Rural'
  ];

  get opcionesZona(): string[] {
    const actual = this.contrato?.zona;
    if (actual && !this.zonasDisponibles.includes(actual)) {
      return [actual, ...this.zonasDisponibles];
    }
    return this.zonasDisponibles;
  }

  instituciones: any[] = [];
  sedes: any[] = [];
  sedesInstitucion: any[] = [];

  get jornadasHabilitadas() {
    return this.jornadas.filter(j => j.habilitada);
  }

  get resumenServiciosPorJornada() {
    const resumen: any = {};
    this.jornadasHabilitadas.forEach(j => {
      const nombre = j.nombre_jornada || j.nombre;
      const secciones = this.seccionesDeJornada(j);
      let count = 0;
      secciones.forEach(s => {
        if (this.estaSeccionAsignada(s.id_seccion || s.id)) {
          count++;
        }
      });
      resumen[nombre] = count;
    });
    return Object.keys(resumen).map(k => ({ jornada: k, total: resumen[k] }));
  }

  get seccionesAsignadas(): any[] {
    const vistas = new Set<number>();
    const lista: any[] = [];
    (this.contratosSeccionMenu || []).forEach(rel => {
      const secId = Number(typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion);
      if (!secId || vistas.has(secId)) return;
      vistas.add(secId);
      const catalogoSec = this.seccionesMenu.find(s => Number(s.id_seccion || s.id) === secId);
      if (catalogoSec) {
        lista.push(catalogoSec);
      } else if (typeof rel.id_seccion === 'object' && rel.id_seccion !== null) {
        lista.push(rel.id_seccion);
      } else {
        lista.push({ id_seccion: secId, nombre_seccion: `Sección #${secId}` });
      }
    });
    return lista;
  }

  get totalAsignados(): number {
    return this.seccionesAsignadas.length;
  }

  get seccionesDeshabilitadasPorFiltro() {
    if (!this.jornadaSeleccionada) return [];
    const idJornadaFiltro = this.jornadaSeleccionada.id_jornada || this.jornadaSeleccionada.id;

    return this.seccionesMenu.filter(s => {
      const sJornadaId = (typeof s.id_jornada === 'object' && s.id_jornada !== null) ? (s.id_jornada.id_jornada || s.id_jornada.id) : (s.id_jornada || s.jornada);
      return sJornadaId !== idJornadaFiltro;
    });
  }

  get institucionSeleccionadaInfo(): any {
    if (!this.contrato?.institucion) return null;
    return this.instituciones.find(i =>
      i.nombre_institucion?.toLowerCase() === this.contrato.institucion?.toLowerCase()
    );
  }

  mensajeAviso = '';
  tituloAviso = '';
  institucionRequeridaAviso = false;

  mostrarSedesDetalle = false;
  modalSeleccionarInstitucionAbierto = false;
  busquedaInstitucion = '';
  institucionTemporalSeleccionada: any = null;

  toggleMostrarSedes(): void {
    this.mostrarSedesDetalle = !this.mostrarSedesDetalle;
    this.cdr.detectChanges();
  }

  abrirModalSeleccionarInstitucion(): void {
    this.busquedaInstitucion = '';
    this.institucionTemporalSeleccionada = this.instituciones.find(i =>
      i.nombre_institucion?.toLowerCase() === this.contrato.institucion?.toLowerCase()
    ) || null;
    this.modalSeleccionarInstitucionAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalSeleccionarInstitucion(): void {
    this.modalSeleccionarInstitucionAbierto = false;
    this.cdr.detectChanges();
  }

  marcarInstitucion(inst: any): void {
    this.institucionTemporalSeleccionada = inst;
    this.cdr.detectChanges();
  }

  seleccionarInstitucionDesdeModal(inst: any): void {
    this.institucionTemporalSeleccionada = inst;
    this.contrato.institucion = inst.nombre_institucion;
    this.mensajeAviso = '';
    this.institucionRequeridaAviso = false;
    this.onInstitucionChange();
    this.cerrarModalSeleccionarInstitucion();
  }

  confirmarSeleccionInstitucion(): void {
    if (this.institucionTemporalSeleccionada) {
      this.contrato.institucion = this.institucionTemporalSeleccionada.nombre_institucion;
      this.mensajeAviso = '';
      this.institucionRequeridaAviso = false;
      this.onInstitucionChange();
    }
    this.cerrarModalSeleccionarInstitucion();
  }

  deseleccionarInstitucion(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.contrato.institucion = '';
    this.institucionTemporalSeleccionada = null;
    this.onInstitucionChange();
    this.cdr.detectChanges();
  }

  get institucionesFiltradasModal(): any[] {
    const q = this.busquedaInstitucion.trim().toLowerCase();
    if (!q) return this.instituciones;
    return this.instituciones.filter(i =>
      (i.nombre_institucion && i.nombre_institucion.toLowerCase().includes(q)) ||
      (i.nit && i.nit.toLowerCase().includes(q)) ||
      (i.representante_legal && i.representante_legal.toLowerCase().includes(q))
    );
  }

  obtenerSedesDeInst(inst: any): any[] {
    const instId = inst?.id_institucion || inst?.id;
    return this.sedes.filter(s => {
      const sInstId = typeof s.id_institucion === 'object' && s.id_institucion !== null
        ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
        : s.id_institucion;
      return Number(sInstId) === Number(instId);
    });
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private siraeService: SiraeService,
    private usuarioService: UsuarioService,
    private rolService: RolService,
    private authService: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private sweetAlert: SweetAlertService
  ) { }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      if (!this.contratoId) {
        this.contratoId = params.get('id');
      }
      if (this.contratoId === 'nuevo' || this.contratoId === '0') {
        this.modo = 'nuevo';
      }
      if (this.pestanaInicial) {
        this.pestanaActiva = this.pestanaInicial;
      }
      this.iniciarContrato();
      this.cargarDatosMaestros();
      if (this.contratoId && this.contratoId !== 'nuevo' && this.contratoId !== '0') {
        this.cargarDetalleContrato();
      }
    });
  }

  private iniciarContrato(): void {
    if (this.contratoId === 'nuevo' || !this.contratoId || this.contratoId === '0') {
      const hoy = new Date().toISOString().split('T')[0];
      const anio = new Date().getFullYear();
      this.contrato = {
        codigo: 'PAE-' + anio + '-' + String(Math.floor(Math.random() * 900) + 100),
        institucion: '',
        zona: 'Norte',
        fecha_inicio: hoy,
        fecha_fin: anio + '-12-31',
        estado: 'Activo',
        cupos: 0,
        id_usuario_supervisor: null
      };
      this.sedesInstitucion = [];
      this.contratosSeccionMenu = [];
    }
  }

  seleccionarPestana(pestana: string) {
    this.pestanaActiva = pestana;
    this.cdr.detectChanges();
  }

  private cargarJornadasPorDefecto(): void {
    this.jornadas = [
      { id_jornada: 1, id: 1, nombre_jornada: 'Jornada Mañana', nombre: 'Mañana', habilitada: false },
      { id_jornada: 2, id: 2, nombre_jornada: 'Jornada Tarde', nombre: 'Tarde', habilitada: false }
    ];
  }

  private cargarSeccionesPorDefecto(): void {
    if (this.seccionesMenu.length === 0) {
      this.seccionesMenu = [
        { id_seccion: 1, id: 1, nombre_seccion: 'Complemento AM', nombre: 'Complemento AM', jornada: 'Mañana', id_jornada: 1 },
        { id_seccion: 2, id: 2, nombre_seccion: 'Desayuno preparado', nombre: 'Desayuno preparado', jornada: 'Mañana', id_jornada: 1 },
        { id_seccion: 3, id: 3, nombre_seccion: 'Almuerzo preparado', nombre: 'Almuerzo preparado', jornada: 'Tarde', id_jornada: 2 },
        { id_seccion: 4, id: 4, nombre_seccion: 'Complemento PM', nombre: 'Complemento PM', jornada: 'Tarde', id_jornada: 2 }
      ];
    }
  }

  get jornadaManana(): any {
    return this.jornadas.find(j => (j.nombre_jornada || j.nombre || '').toLowerCase().includes('mañana')) || null;
  }

  get jornadaTarde(): any {
    return this.jornadas.find(j => (j.nombre_jornada || j.nombre || '').toLowerCase().includes('tarde')) || null;
  }

  toggleJornadaPorNombre(tipo: 'Mañana' | 'Tarde') {
    let j = tipo === 'Mañana' ? this.jornadaManana : this.jornadaTarde;
    if (!j && this.jornadas.length === 0) {
      this.cargarJornadasPorDefecto();
      j = tipo === 'Mañana' ? this.jornadaManana : this.jornadaTarde;
    }
    if (j) {
      this.toggleJornada(j, { target: { checked: !j.habilitada } });
    }
  }

  seccionesPorNombreJornada(tipo: 'Mañana' | 'Tarde'): any[] {
    const norm = tipo.toLowerCase();
    if (this.seccionesMenu.length === 0) {
      this.cargarSeccionesPorDefecto();
    }
    return this.seccionesMenu.filter(s => {
      const jNom = (s.jornada || s.nombre_jornada || s.jornada_nombre || '').toLowerCase();
      const jId = typeof s.id_jornada === 'object' ? s.id_jornada?.id_jornada : s.id_jornada;
      if (norm.includes('mañana')) {
        return jNom.includes('mañana') || jNom.includes('am') || Number(jId) === 1 || (s.nombre_seccion || '').toLowerCase().includes('am') || (s.nombre_seccion || '').toLowerCase().includes('desayuno');
      }
      if (norm.includes('tarde')) {
        return jNom.includes('tarde') || jNom.includes('pm') || Number(jId) === 2 || (s.nombre_seccion || '').toLowerCase().includes('pm') || (s.nombre_seccion || '').toLowerCase().includes('almuerzo');
      }
      return false;
    });
  }

  toggleSeccionItem(seccion: any) {
    const sId = Number(seccion.id_seccion || seccion.id);
    const estaAsignada = this.estaSeccionAsignada(sId);
    this.toggleSeccionMenu(sId, { target: { checked: !estaAsignada } });
  }

  cambiarEstadoContrato(nuevoEstado: 'Activo' | 'Inactivo') {
    this.contrato.estado = nuevoEstado;
    this.cdr.detectChanges();
  }

  cargarDatosMaestros() {
    // 1. Cargar Jornadas con normalización
    this.siraeService.getJornadas().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        if (res.length > 0) {
          this.jornadas = res.map((j: any) => ({ ...j, habilitada: false }));
        } else {
          this.cargarJornadasPorDefecto();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('API de jornadas no encontrada o con error, usando jornadas base...', err);
        this.cargarJornadasPorDefecto();
        this.cdr.detectChanges();
      }
    });

    // 2. Cargar Secciones de Menú con normalización
    this.siraeService.getSeccionesMenu().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        if (res.length > 0) {
          this.seccionesMenu = res;
        } else {
          this.cargarSeccionesPorDefecto();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Error cargando secciones de menú, usando secciones base:', err);
        this.cargarSeccionesPorDefecto();
        this.cdr.detectChanges();
      }
    });

    // 3. Cargar Instituciones reales
    this.siraeService.getInstituciones().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.instituciones = res;
        this.actualizarSedesDeInstitucion();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando instituciones en detalle:', err);
        this.cdr.detectChanges();
      }
    });

    // 4. Cargar Sedes reales
    this.siraeService.getSedes().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.sedes = res;
        this.actualizarSedesDeInstitucion();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando sedes en detalle:', err);
        this.cdr.detectChanges();
      }
    });

    // 5. Cargar Supervisores disponibles
    this.cargarSupervisores();
  }

  cargarSupervisores(): void {
    this.cargandoSupervisores = true;
    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);

    // 1. Cargar catálogo de roles para resolver IDs de supervisor
    this.rolService.getRoles().subscribe({
      next: (datosRoles: any) => {
        const rolesArr = Array.isArray(datosRoles) ? datosRoles : (datosRoles.results || datosRoles.data || []);
        this.rolesCatalogo = rolesArr.map((r: any) => ({
          id_rol: Number(r.id_rol || r.id || r.pk),
          nombre: (r.nombre_rol || r.nombre || '').toLowerCase()
        }));
        this.obtenerUsuariosSupervisores(headers);
      },
      error: () => {
        this.obtenerUsuariosSupervisores(headers);
      }
    });
  }

  private obtenerUsuariosSupervisores(headers: HttpHeaders): void {
    this.http.get<any[]>(`${environment.apiUrl}/usuarios/`, { headers }).subscribe({
      next: (datos: any) => {
        this.procesarUsuariosSupervisores(datos);
      },
      error: (errHttp) => {
        console.warn('Fallo petición directa a /usuarios/, intentando usuarioService:', errHttp);
        this.usuarioService.getUsuarios().subscribe({
          next: (datosFallback: any) => {
            this.procesarUsuariosSupervisores(datosFallback);
          },
          error: (err) => {
            console.error('Error al cargar supervisores:', err);
            this.cargandoSupervisores = false;
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  private procesarUsuariosSupervisores(datos: any): void {
    const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);

    // IDs de roles que corresponden a supervisor o coordinador
    const supervisorRolIds = this.rolesCatalogo
      .filter(r => r.nombre.includes('supervisor') || r.nombre.includes('coordinador'))
      .map(r => r.id_rol);

    const filtrados = res.filter((u: any) => {
      // 1. Chequeo por rol_detalle
      const nomDetalle = (u.rol_detalle?.nombre_rol || u.rol_detalle?.nombre || u.rol_nombre || '').toLowerCase();
      if (nomDetalle && (nomDetalle.includes('supervisor') || nomDetalle.includes('coordinador'))) return true;

      // 2. Chequeo por rol string
      if (typeof u.rol === 'string') {
        const r = u.rol.toLowerCase();
        if (r.includes('supervisor') || r.includes('coordinador')) return true;
      }

      // 3. Chequeo por rol objeto
      if (typeof u.rol === 'object' && u.rol !== null) {
        const r = (u.rol.nombre_rol || u.rol.nombre || '').toLowerCase();
        if (r.includes('supervisor') || r.includes('coordinador')) return true;
      }

      // 4. Chequeo por ID en roles cargados o ID 27 por defecto
      const idRol = typeof u.rol === 'object' ? (u.rol?.id_rol || u.rol?.id) : Number(u.rol);
      if (idRol && (supervisorRolIds.includes(idRol) || idRol === 27)) return true;

      // 5. Si tiene instituciones_supervisor asignadas
      if (Array.isArray(u.instituciones_supervisor) && u.instituciones_supervisor.length > 0) return true;

      // 6. Si el correo contiene 'supervisor'
      if (u.correo && typeof u.correo === 'string' && u.correo.toLowerCase().includes('supervisor')) return true;

      return false;
    });

    this.supervisores = filtrados.map((u: any) => ({
      id_usuario: Number(u.id_usuario || u.id),
      nombre_completo: `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.correo || `Supervisor #${u.id_usuario || u.id}`
    }));

    // Si el contrato ya tiene un supervisor asignado que no esté en la lista filtrada, preservarlo
    if (this.contrato?.id_usuario_supervisor) {
      const supIdNum = Number(this.contrato.id_usuario_supervisor);
      const existe = this.supervisores.some(s => Number(s.id_usuario) === supIdNum);
      if (!existe) {
        this.supervisores.unshift({
          id_usuario: supIdNum,
          nombre_completo: this.contrato.supervisor_nombre || `Supervisor #${supIdNum}`
        });
      }
    }

    this.cargandoSupervisores = false;
    this.cdr.detectChanges();
  }

  actualizarSedesDeInstitucion() {
    if (!this.contrato?.institucion) {
      this.sedesInstitucion = [];
      return;
    }
    const inst = this.instituciones.find(i =>
      i.nombre_institucion?.toLowerCase() === this.contrato.institucion?.toLowerCase() ||
      String(i.id_institucion) === String(this.contrato.institucion)
    );
    if (inst) {
      const instId = inst.id_institucion || inst.id;
      this.sedesInstitucion = this.sedes.filter(s => {
        const sInstId = typeof s.id_institucion === 'object' && s.id_institucion !== null
          ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
          : (s.id_institucion || s.institucion_id || s.institucion);
        return Number(sInstId) === Number(instId) ||
          String(s.nombre_institucion || '').toLowerCase() === String(inst.nombre_institucion || '').toLowerCase();
      });

      if (instId && this.sedesInstitucion.length === 0) {
        this.siraeService.getSedes(Number(instId)).subscribe({
          next: (datos: any) => {
            const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
            if (res.length > 0) {
              this.sedesInstitucion = res;
              this.cdr.detectChanges();
            }
          }
        });
      }
    } else {
      this.sedesInstitucion = [];
    }
    this.cdr.detectChanges();
  }

  onInstitucionChange() {
    this.actualizarSedesDeInstitucion();
  }

  cargarDetalleContrato() {
    if (!this.contratoId || this.contratoId === 'nuevo' || this.contratoId === '0') return;

    this.cargandoDetalle = true;
    this.errorCargaDetalle = '';

    // Cargar información básica del contrato desde la lista general
    this.siraeService.getContratos().subscribe({
      next: (datos: any) => {
        const listaContratos = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        const contratoEncontrado = listaContratos.find((c: any) =>
          String(c.id_contrato || c.id || c.pk) === String(this.contratoId)
        );

        if (contratoEncontrado) {
          const instId = contratoEncontrado.id_institucion ? (contratoEncontrado.id_institucion?.id_institucion || contratoEncontrado.id_institucion) : null;
          const supId = contratoEncontrado.id_usuario_supervisor ? (contratoEncontrado.id_usuario_supervisor?.id_usuario || contratoEncontrado.id_usuario_supervisor) : null;
          const fechaFinStr = contratoEncontrado.fecha_fin || contratoEncontrado.fin || '';

          // Evaluar vigencia según fecha fin y hoy
          const vigencia = this.evaluarVigencia(fechaFinStr, contratoEncontrado.estado);

          // Si en base de datos figuraba como Activo pero ya se cumplió su fecha fin, sincronizar con backend
          if (contratoEncontrado.estado !== 'Finalizado' && vigencia.estado === 'Finalizado' && this.contratoId) {
            const idNum = Number(this.contratoId);
            this.siraeService.actualizarContrato(idNum, { ...contratoEncontrado, estado: 'Finalizado' }).subscribe({
              next: () => {},
              error: () => {}
            });
          }

          this.contrato = {
            ...contratoEncontrado,
            institucion: contratoEncontrado.institucion || contratoEncontrado.nombre_institucion || 'No especificada',
            id_institucion: instId,
            zona: contratoEncontrado.zona || contratoEncontrado.nombre_zona || 'No especificada',
            fecha_inicio: contratoEncontrado.fecha_inicio || contratoEncontrado.inicio,
            fecha_fin: fechaFinStr,
            estado: vigencia.estado,
            condiciones: contratoEncontrado.condiciones || contratoEncontrado.descripcion || '',
            cupos: Number(contratoEncontrado.cupos) || 0,
            id_usuario_supervisor: supId ? Number(supId) : null
          };
          this.esContratoProximoAVencer = vigencia.esProximoAVencer;
          this.diasRestantesVigencia = vigencia.diasRestantes;
          this.mensajeVigenciaContrato = vigencia.mensajeVigencia;

          this.actualizarSedesDeInstitucion();
          this.cargarHistorialLocal();

          if (this.modo === 'edicion') {
            this.abrirModalEdicion();
          }
        } else {
          // Fallback por si acaso entra directo por URL y el backend requiere detalle por ID específico
          this.contrato = { codigo: `COR-${this.contratoId}`, estado: 'Activo', cupos: 0 };
        }
        this.cargandoDetalle = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar el contrato:', err);
        this.cargandoDetalle = false;
        this.errorCargaDetalle = 'No se pudo cargar la información detallada del contrato.';
        this.cdr.detectChanges();
      }
    });

    // Cargar las relaciones de secciones asignadas a este contrato
    this.siraeService.getContratosSeccionMenu(Number(this.contratoId)).subscribe({
      next: (datos: any) => {
        this.contratosSeccionMenu = Array.isArray(datos) ? datos : (datos.results || datos.data || []);

        // Auto-habilitar las jornadas basándose en las secciones que ya tiene asignadas
        setTimeout(() => {
          const jornadasConSecciones = new Set<any>();
          this.contratosSeccionMenu.forEach(rel => {
            const seccionIdBuscado = rel.id_seccion?.id_seccion || rel.id_seccion;
            const seccion = this.seccionesMenu.find(s => (s.id_seccion || s.id) === seccionIdBuscado);
            if (seccion) {
              jornadasConSecciones.add(seccion.jornada);
            }
          });

          this.jornadas.forEach(j => {
            const jornadaIdEvaluar = j.nombre_jornada || j.nombre || j.id_jornada || j.id;
            if (jornadasConSecciones.has(jornadaIdEvaluar)) {
              j.habilitada = true;
            }
          });
          this.cdr.detectChanges();
        }, 300);

        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando relaciones del contrato:', err)
    });
  }

  // Getters para Distribución de Cupos
  get cuposAutorizados(): number {
    return Number(this.contrato?.cupos) || 0;
  }

  obtenerCuposDeSede(s: any): number {
    if (!s) return 0;
    const val = s.cupos ?? s.cupos_asignados ?? s.cupos_distribuidos ?? s.cupos_sede ?? s.cupo ?? s.cupos_autorizados ?? 0;
    return Number(val) || 0;
  }

  get totalCuposAsignadosSedes(): number {
    return (this.sedesInstitucion || []).reduce((acc, s) => acc + this.obtenerCuposDeSede(s), 0);
  }

  get cuposPendientesDistribucion(): number {
    return Math.max(0, this.cuposAutorizados - this.totalCuposAsignadosSedes);
  }

  get tieneDistribucionRealizada(): boolean {
    return this.totalCuposAsignadosSedes > 0;
  }

  get porcentajeDistribuido(): number {
    if (!this.cuposAutorizados || this.cuposAutorizados <= 0) return 0;
    return Math.min(100, Math.round((this.totalCuposAsignadosSedes / this.cuposAutorizados) * 100));
  }

  porcentajeCuposSede(s: any): number {
    if (!this.cuposAutorizados || this.cuposAutorizados <= 0) return 0;
    const c = this.obtenerCuposDeSede(s);
    return Math.round((c / this.cuposAutorizados) * 100);
  }

  obtenerEstiloEstado(estado?: string): { bg: string; color: string; border: string; dot: string } {
    const est = (estado || this.contrato?.estado || 'Activo').toLowerCase();
    if (est.includes('activo')) {
      return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0', dot: '#10b981' };
    }
    if (est.includes('finalizado') || est.includes('terminado')) {
      return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', dot: '#94a3b8' };
    }
    return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca', dot: '#ef4444' };
  }

  get estiloEstadoContrato(): { bg: string; color: string; border: string; dot: string } {
    return this.obtenerEstiloEstado(this.contrato?.estado);
  }

  toggleJornada(jornada: any, evento: any) {
    jornada.habilitada = evento.target.checked;

    // Si se deshabilita la jornada, quitamos las secciones correspondientes
    if (!jornada.habilitada) {
      const jId = jornada.id_jornada || jornada.id;
      const jNom = (jornada.nombre_jornada || jornada.nombre || '').toString().toLowerCase();

      const seccionesDeEstaJornada = this.seccionesMenu.filter(s => {
        const sJornadaId = (typeof s.id_jornada === 'object' && s.id_jornada !== null)
          ? (s.id_jornada.id_jornada || s.id_jornada.id)
          : (s.id_jornada ?? s.jornada);
        const sJornadaNom = (s.nombre_jornada || s.jornada_nombre || s.jornada || '').toString().toLowerCase();

        return (sJornadaId && jId && Number(sJornadaId) === Number(jId)) ||
               (sJornadaNom && jNom && (sJornadaNom.includes(jNom) || jNom.includes(sJornadaNom))) ||
               (String(sJornadaId).toLowerCase() === jNom);
      });

      seccionesDeEstaJornada.forEach(seccion => {
        const secId = Number(seccion.id_seccion || seccion.id);
        this.seccionesSeleccionadasIds.delete(secId);
        if (this.estaSeccionAsignada(secId) && !this.editandoSecciones) {
          this.toggleSeccionMenu(secId, { target: { checked: false } });
        }
      });
    }
    this.cdr.detectChanges();
  }

  seccionesFiltradasPorJornadasHabilitadas(): any[] {
    const jornadasHabilitadas = this.jornadas.filter(j => j.habilitada);

    return this.seccionesMenu.filter(s => {
      const sJornadaId = (typeof s.id_jornada === 'object' && s.id_jornada !== null)
        ? (s.id_jornada.id_jornada || s.id_jornada.id)
        : (s.id_jornada ?? s.jornada);
      const sJornadaNom = (s.nombre_jornada || s.jornada_nombre || s.jornada || '').toString().toLowerCase();

      return jornadasHabilitadas.some(j => {
        const jId = j.id_jornada || j.id;
        const jNom = (j.nombre_jornada || j.nombre || '').toString().toLowerCase();

        if (sJornadaId && jId && Number(sJornadaId) === Number(jId)) return true;
        if (sJornadaNom && jNom && (sJornadaNom.includes(jNom) || jNom.includes(sJornadaNom))) return true;
        if (String(sJornadaId).toLowerCase() === jNom) return true;

        return false;
      });
    });
  }

  seleccionarJornadaParaVer(jornada: any) {
    this.jornadaSeleccionada = jornada;
    this.cdr.detectChanges();
  }

  seccionesDeJornada(jornada: any): any[] {
    if (!jornada) return [];
    const jId = jornada.id_jornada || jornada.id;
    const jNom = (jornada.nombre_jornada || jornada.nombre || '').toString().toLowerCase();

    return this.seccionesMenu.filter(s => {
      const sJornadaId = (typeof s.id_jornada === 'object' && s.id_jornada !== null)
        ? (s.id_jornada.id_jornada || s.id_jornada.id)
        : (s.id_jornada ?? s.jornada);
      const sJornadaNom = (s.nombre_jornada || s.jornada_nombre || s.jornada || '').toString().toLowerCase();

      if (sJornadaId && jId && Number(sJornadaId) === Number(jId)) return true;
      if (sJornadaNom && jNom && (sJornadaNom.includes(jNom) || jNom.includes(sJornadaNom))) return true;
      if (String(sJornadaId).toLowerCase() === jNom) return true;

      return false;
    });
  }

  estaSeccionAsignada(seccionId: number): boolean {
    return this.contratosSeccionMenu.some(rel => {
      const relSecId = typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion;
      return Number(relSecId) === Number(seccionId);
    });
  }

  // ========================================================
  // GESTIÓN INTERACTIVA DE SECCIONES DE MENÚ DEL CONTRATO
  // ========================================================
  editandoSecciones = false;
  guardandoSecciones = false;
  seccionesSeleccionadasIds: Set<number> = new Set<number>();
  mensajeValidacionDuplicado = '';

  iniciarEdicionSecciones() {
    // Criterio 5: No deben permitirse nuevas operaciones que requieran un contrato vigente
    if (this.esContratoNoVigente) {
      void this.sweetAlert.warning(
        'Operación no permitida',
        `El contrato se encuentra en estado «${this.contrato?.estado}». No es posible asociar ni modificar componentes de menú en contratos no vigentes o finalizados.`
      );
      return;
    }

    this.editandoSecciones = true;
    this.mensajeValidacionDuplicado = '';

    const ids = new Set<number>();
    this.contratosSeccionMenu.forEach(rel => {
      const secId = typeof rel.id_seccion === 'object' 
        ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) 
        : rel.id_seccion;
      if (secId != null) {
        ids.add(Number(secId));
      }
    });
    this.seccionesSeleccionadasIds = ids;

    // Asegurar que las jornadas con secciones activas estén habilitadas
    this.jornadas.forEach(j => {
      const jId = j.id_jornada || j.id;
      const jNom = (j.nombre_jornada || j.nombre || '').toLowerCase();
      const tieneSeccion = this.seccionesMenu.some(s => {
        const sId = s.id_seccion || s.id;
        const sJornada = (s.jornada || s.nombre_jornada || '').toLowerCase();
        const sJornadaId = typeof s.id_jornada === 'object' ? (s.id_jornada?.id_jornada || s.id_jornada?.id) : s.id_jornada;
        return ids.has(Number(sId)) && (sJornada.includes(jNom) || Number(sJornadaId) === Number(jId));
      });
      if (tieneSeccion) {
        j.habilitada = true;
      }
    });

    this.cdr.detectChanges();
  }

  cancelarEdicionSecciones() {
    this.editandoSecciones = false;
    this.mensajeValidacionDuplicado = '';
    this.cdr.detectChanges();
  }

  estaSeccionSeleccionada(seccionId: number): boolean {
    return this.seccionesSeleccionadasIds.has(Number(seccionId));
  }

  validarDuplicado(seccion: any): { esDuplicado: boolean; mensaje: string } {
    // Valida en tiempo real que no existan relaciones o asociaciones duplicadas entre la sección de menú, la jornada y el contrato
    const secId = Number(typeof seccion === 'object' ? (seccion.id_seccion || seccion.id) : seccion);
    
    // 1. Chequeo por ID directo ya asociado en la selección
    if (this.seccionesSeleccionadasIds.has(secId)) {
      const nombre = (typeof seccion === 'object' ? (seccion.nombre_seccion || seccion.nombre) : `Sección #${secId}`);
      return {
        esDuplicado: true,
        mensaje: `La sección «${nombre}» ya se encuentra asociada a este contrato.`
      };
    }

    if (typeof seccion === 'object') {
      const secNombre = (seccion.nombre_seccion || seccion.nombre || '').trim().toLowerCase();
      const secJornada = (seccion.jornada || seccion.nombre_jornada || '').trim().toLowerCase();
      const secJornadaId = typeof seccion.id_jornada === 'object'
        ? Number(seccion.id_jornada?.id_jornada || seccion.id_jornada?.id)
        : Number(seccion.id_jornada);

      // 2. Chequeo por componente duplicado en la misma jornada
      for (const idSeleccionado of this.seccionesSeleccionadasIds) {
        if (idSeleccionado === secId) continue;
        const otraSec = this.seccionesMenu.find(s => Number(s.id_seccion || s.id) === idSeleccionado);
        if (!otraSec) continue;

        const otraNombre = (otraSec.nombre_seccion || otraSec.nombre || '').trim().toLowerCase();
        const otraJornada = (otraSec.jornada || otraSec.nombre_jornada || '').trim().toLowerCase();
        const otraJornadaId = typeof otraSec.id_jornada === 'object'
          ? Number(otraSec.id_jornada?.id_jornada || otraSec.id_jornada?.id)
          : Number(otraSec.id_jornada);

        const mismaJornada = (secJornadaId && otraJornadaId && secJornadaId === otraJornadaId) ||
                             (secJornada && otraJornada && (secJornada.includes(otraJornada) || otraJornada.includes(secJornada)));

        if (mismaJornada && secNombre && secNombre === otraNombre) {
          return {
            esDuplicado: true,
            mensaje: `El componente «${otraSec.nombre_seccion || otraSec.nombre}» ya está contemplado para la misma jornada en este contrato.`
          };
        }
      }
    }

    return { esDuplicado: false, mensaje: '' };
  }

  toggleSeleccionSeccion(seccion: any, jornada?: any) {
    const secId = Number(seccion.id_seccion || seccion.id);
    this.mensajeValidacionDuplicado = '';

    if (this.seccionesSeleccionadasIds.has(secId)) {
      // Desasociar sección
      this.seccionesSeleccionadasIds.delete(secId);
    } else {
      // Validar en tiempo real que no existan asociaciones duplicadas
      const validacion = this.validarDuplicado(seccion);
      if (validacion.esDuplicado) {
        this.mensajeValidacionDuplicado = validacion.mensaje;
        void this.sweetAlert.warning(
          'Asociación duplicada',
          validacion.mensaje
        );
        return;
      }
      // Asociar sección
      this.seccionesSeleccionadasIds.add(secId);
    }
    this.cdr.detectChanges();
  }

  get totalSeccionesSeleccionadas(): number {
    return this.seccionesSeleccionadasIds.size;
  }

  async guardarSeccionesContrato() {
    if (!this.contratoId || this.contratoId === 'nuevo' || this.contratoId === '0') {
      this.editandoSecciones = false;
      return;
    }

    // Criterio 5: Bloquear persistencia en contratos no vigentes
    if (this.esContratoNoVigente) {
      void this.sweetAlert.error(
        'Operación bloqueada',
        'No es posible registrar modificaciones en un contrato finalizado o no vigente.'
      );
      this.guardandoSecciones = false;
      this.editandoSecciones = false;
      return;
    }

    this.guardandoSecciones = true;
    this.mensajeValidacionDuplicado = '';
    const contratoIdNum = Number(this.contratoId);

    // Mapear relaciones existentes en base de datos
    const relacionesExistentes = new Map<number, number>(); // seccionId -> relacionId
    this.contratosSeccionMenu.forEach(rel => {
      const secId = Number(typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion);
      const relId = Number(rel.id_contrato_seccion || rel.id);
      if (secId && relId) {
        relacionesExistentes.set(secId, relId);
      }
    });

    const promesas: Promise<any>[] = [];

    // 1. Nuevas secciones a asociar (seleccionadas que no estaban en BD)
    this.seccionesSeleccionadasIds.forEach(secId => {
      if (!relacionesExistentes.has(secId)) {
        const payload = {
          id_contrato: contratoIdNum,
          id_seccion: secId,
          estado: 'Activo',
          valor: 0
        };
        promesas.push(
          new Promise((resolve) => {
            this.siraeService.crearContratoSeccionMenu(payload).subscribe({
              next: (res) => resolve({ ok: true, tipo: 'crear', res }),
              error: (err) => {
                console.error('Error al asociar sección:', err);
                resolve({ ok: false, tipo: 'crear', err });
              }
            });
          })
        );
      }
    });

    // 2. Secciones a desasociar (estaban en BD pero fueron desmarcadas)
    relacionesExistentes.forEach((relId, secId) => {
      if (!this.seccionesSeleccionadasIds.has(secId)) {
        promesas.push(
          new Promise((resolve) => {
            this.siraeService.eliminarContratoSeccionMenu(relId).subscribe({
              next: () => resolve({ ok: true, tipo: 'eliminar', relId }),
              error: (err) => {
                console.error('Error al desasociar sección:', err);
                resolve({ ok: false, tipo: 'eliminar', err });
              }
            });
          })
        );
      }
    });

    try {
      await Promise.all(promesas);

      // Recargar relaciones desde el backend para actualizar la vista de detalle
      this.siraeService.getContratosSeccionMenu(contratoIdNum).subscribe({
        next: (datos: any) => {
          this.contratosSeccionMenu = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
          this.editandoSecciones = false;
          this.guardandoSecciones = false;
          
          void this.sweetAlert.success(
            '¡Secciones de menú actualizadas!',
            'Los componentes del servicio de alimentación han sido asociados y guardados exitosamente en el contrato.'
          );
          this.cdr.detectChanges();
        },
        error: () => {
          this.editandoSecciones = false;
          this.guardandoSecciones = false;
          this.cdr.detectChanges();
        }
      });
    } catch (error) {
      this.guardandoSecciones = false;
      void this.sweetAlert.error('Error al guardar', 'Ocurrió un problema al guardar las secciones asociadas.');
      this.cdr.detectChanges();
    }
  }

  toggleSeccionMenu(seccionId: number, evento: any) {
    const asignada = evento.target.checked;

    if (this.contratoId === 'nuevo') {
      if (asignada) {
        this.contratosSeccionMenu.push({ id_seccion: seccionId });
      } else {
        this.contratosSeccionMenu = this.contratosSeccionMenu.filter(rel => {
          const relSecId = typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion;
          return Number(relSecId) !== Number(seccionId);
        });
      }
      this.cdr.detectChanges();
      return;
    }

    if (asignada) {
      const payload = {
        id_contrato: Number(this.contratoId),
        id_seccion: Number(seccionId),
        estado: 'Activo',
        valor: 0
      };
      this.siraeService.crearContratoSeccionMenu(payload).subscribe({
        next: (res) => {
          this.contratosSeccionMenu.push(res);
          this.cdr.detectChanges();
        },
        error: (err) => console.error('Error asignando sección', err)
      });
    } else {
      const relacion = this.contratosSeccionMenu.find(rel => {
        const relSecId = typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion;
        return Number(relSecId) === Number(seccionId);
      });

      if (relacion) {
        const relacionId = relacion.id_contrato_seccion || relacion.id;
        this.siraeService.eliminarContratoSeccionMenu(relacionId).subscribe({
          next: () => {
            this.contratosSeccionMenu = this.contratosSeccionMenu.filter(r => (r.id_contrato_seccion || r.id) !== relacionId);
            this.cdr.detectChanges();
          },
          error: (err) => console.error('Error quitando sección', err)
        });
      }
    }
  }

  async guardarTodo() {
    // Criterio: "Si no se elige una institución, aparece un aviso que lo pide y no se guarda."
    if (!this.contrato?.institucion || !this.contrato.institucion.trim()) {
      this.tituloAviso = 'Institución educativa requerida';
      this.mensajeAviso = 'Por favor, selecciona una institución educativa antes de guardar el contrato.';
      this.institucionRequeridaAviso = true;
      this.cdr.detectChanges();

      void this.sweetAlert.warning(
        'Institución requerida',
        'Por favor, selecciona o ingresa la institución educativa.'
      );
      return;
    }

    this.mensajeAviso = '';
    this.institucionRequeridaAviso = false;

    // Validación de coherencia de vigencia
    if (this.contrato.fecha_fin && this.contrato.fecha_inicio && this.contrato.fecha_fin < this.contrato.fecha_inicio) {
      void this.sweetAlert.warning(
        'Vigencia inválida',
        'La fecha de finalización no puede ser anterior a la fecha de inicio del contrato.'
      );
      return;
    }

    // Asegurar identificador si viene vacío
    if (!this.contrato.codigo || !this.contrato.codigo.trim()) {
      this.contrato.codigo = 'COR-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900) + 100);
    }

    // Asegurar fecha de inicio si viene vacía
    if (!this.contrato.fecha_inicio) {
      this.contrato.fecha_inicio = new Date().toISOString().split('T')[0];
    }

    const instEncontrada = this.institucionSeleccionadaInfo;
    const idInst = instEncontrada?.id_institucion || instEncontrada?.id || this.contrato.id_institucion || null;

    const payload: any = {
      numero_cor: this.contrato.codigo.trim(),
      institucion: this.contrato.institucion,
      zona: this.contrato.zona || 'Norte',
      fecha_inicio: this.contrato.fecha_inicio,
      fecha_fin: this.contrato.fecha_fin || '2026-12-31',
      estado: this.contrato.estado || 'Activo',
      cupos: Number(this.contrato.cupos) || 0
    };

    if (idInst) {
      payload.id_institucion = Number(idInst);
    }

    if (this.contrato.id_usuario_supervisor) {
      payload.id_usuario_supervisor = Number(this.contrato.id_usuario_supervisor);
    }

    const esNuevo = !this.contratoId || this.contratoId === 'nuevo' || this.contratoId === '0';

    if (esNuevo) {
      this.siraeService.crearContrato(payload).subscribe({
        next: async (res: any) => {
          const newId = res?.id_contrato || res?.id || res?.pk;

          if (this.contratosSeccionMenu.length > 0 && newId) {
            // Asignar las secciones guardadas en memoria
            const promesas = this.contratosSeccionMenu.map(rel => {
              const secId = typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion;
              return new Promise((resolve) => {
                this.siraeService.crearContratoSeccionMenu({
                  id_contrato: Number(newId),
                  id_seccion: Number(secId),
                  estado: 'Activo',
                  valor: 0
                }).subscribe({
                  next: () => resolve(true),
                  error: () => resolve(false)
                });
              });
            });
            await Promise.all(promesas);
          }

          const nuevoContratoFormateado = {
            id: newId,
            codigo: payload.numero_cor,
            institucion: payload.institucion,
            fechaInicio: payload.fecha_inicio,
            fechaFin: payload.fecha_fin,
            estado: payload.estado,
            zona: payload.zona,
            cupos: payload.cupos,
            supervisor: this.nombreSupervisorAsignado,
            expandido: false
          };

          await this.sweetAlert.success(
            '¡Contrato guardado!',
            'El contrato de alimentación ha sido registrado exitosamente.'
          );
          this.cerrar.emit(nuevoContratoFormateado);
          this.router.navigate(['/contratos']);
        },
        error: (err) => {
          console.error('Error al crear contrato', err);
          let mensaje = 'Hubo un problema al crear el contrato.';
          if (err?.error) {
            if (typeof err.error === 'string') {
              mensaje = err.error;
            } else if (err.error.detail) {
              mensaje = err.error.detail;
            } else if (err.error.numero_cor) {
              mensaje = `N° Contrato: ${Array.isArray(err.error.numero_cor) ? err.error.numero_cor.join(', ') : err.error.numero_cor}`;
            } else if (err.error.institucion) {
              mensaje = `Institución: ${Array.isArray(err.error.institucion) ? err.error.institucion.join(', ') : err.error.institucion}`;
            }
          }
          void this.sweetAlert.error('Error al guardar', mensaje);
        }
      });
    } else {
      this.siraeService.actualizarContrato(Number(this.contratoId), payload).subscribe({
        next: async () => {
          await this.sweetAlert.success(
            '¡Contrato actualizado!',
            'Los cambios del contrato han sido guardados exitosamente.'
          );
          this.cerrar.emit();
          this.router.navigate(['/contratos']);
        },
        error: (err) => {
          console.error('Error al actualizar contrato', err);
          void this.sweetAlert.error(
            'Error al actualizar',
            'Hubo un problema al actualizar el contrato.'
          );
        }
      });
    }
  }

  volver() {
    this.cerrar.emit();
    this.router.navigate(['/contratos']);
  }
}