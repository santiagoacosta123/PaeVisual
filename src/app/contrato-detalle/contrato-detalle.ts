import { Component, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
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
export class ContratoDetalleComponent implements OnInit, OnChanges {
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
  // DISTRIBUCIÓN DE CUPOS POR SEDE Y GRADOS (HU MODAL EDITAR)
  // ========================================================
  modalEditarDistribucionAbierto = false;
  guardandoDistribucion = false;
  mensajeErrorDistribucion = '';
  gradosCatalogoDistribucion: { id_grado: number; nombre_grado: string }[] = [];
  sedesEdicionDistribucion: Array<{
    id_sede: number;
    nombre_sede: string;
    codigo_dane?: string;
    cuposAsignados: number;
    desplegada: boolean;
    grados: Array<{ id_grado: number; nombre_grado: string; cupos: number }>;
  }> = [];

  get puedeEditarDistribucion(): boolean {
    const u = this.authService.obtenerUsuario();
    if (!u) return false;
    if (u.is_superuser || this.authService.esSuperAdministrador(u.rol)) return true;
    const rol = this.authService.normalizarRol(u.rol);
    return rol.includes('admin') || rol.includes('coordinador') || rol.includes('gestor');
  }

  get rolUsuarioActualNombre(): string {
    const u = this.authService.obtenerUsuario();
    if (!u) return 'Administrador';
    if (u.is_superuser) return 'Superadministrador';
    const rol = (u.rol || '').trim();
    if (this.authService.esSupervisor(rol)) return 'Supervisor';
    if (this.authService.esSuperAdministrador(rol)) return 'Superadministrador';
    if (rol.toLowerCase().includes('admin')) return 'Administrador';
    if (rol.toLowerCase().includes('coordinador')) return 'Coordinador';
    return rol || 'Administrador';
  }

  get totalCuposSedesEdicion(): number {
    return (this.sedesEdicionDistribucion || []).reduce((acc, s) => acc + (Number(s.cuposAsignados) || 0), 0);
  }

  get cuposPendientesSedesEdicion(): number {
    return this.cuposAutorizados - this.totalCuposSedesEdicion;
  }

  totalGradosDeSede(sede: any): number {
    if (!sede || !sede.grados) return 0;
    return sede.grados.reduce((acc: number, g: any) => acc + (Number(g.cupos) || 0), 0);
  }

  esCoherenteGradosSede(sede: any): boolean {
    const totalGrados = this.totalGradosDeSede(sede);
    const asignado = Number(sede.cuposAsignados) || 0;
    return totalGrados <= asignado;
  }

  toggleDesplegarSede(sede: any): void {
    sede.desplegada = !sede.desplegada;
    this.cdr.detectChanges();
  }

  onCambioCuposSede(sede: any): void {
    if (sede.cuposAsignados < 0) {
      sede.cuposAsignados = 0;
    }
    this.validarDistribucionEdicion();
    this.cdr.detectChanges();
  }

  onCambioCuposGrado(sede: any): void {
    if (sede.grados && Array.isArray(sede.grados)) {
      sede.grados.forEach((g: any) => {
        if (g.cupos < 0) {
          g.cupos = 0;
        }
      });
    }
    this.validarDistribucionEdicion();
    this.cdr.detectChanges();
  }

  validarDistribucionEdicion(): string | null {
    this.mensajeErrorDistribucion = '';

    // 1. Validar números negativos o inválidos en sedes
    for (const s of this.sedesEdicionDistribucion) {
      if (isNaN(s.cuposAsignados) || s.cuposAsignados < 0) {
        this.mensajeErrorDistribucion = `La sede ${s.nombre_sede} tiene un valor de cupos inválido o negativo.`;
        return this.mensajeErrorDistribucion;
      }
    }

    // 2. La suma de cupos asignados a todas las sedes no puede superar el total autorizado
    if (this.totalCuposSedesEdicion > this.cuposAutorizados) {
      this.mensajeErrorDistribucion = `La suma de los cupos asignados a las sedes (${this.totalCuposSedesEdicion}) no puede superar el total de cupos autorizados en el contrato (${this.cuposAutorizados}).`;
      return this.mensajeErrorDistribucion;
    }

    // 3. La suma de cupos por grados no puede superar el total asignado a su respectiva sede
    for (const s of this.sedesEdicionDistribucion) {
      for (const g of s.grados) {
        if (isNaN(g.cupos) || g.cupos < 0) {
          this.mensajeErrorDistribucion = `El grado ${g.nombre_grado} en ${s.nombre_sede} tiene un valor inválido o negativo.`;
          return this.mensajeErrorDistribucion;
        }
      }
      const totalGrados = this.totalGradosDeSede(s);
      if (totalGrados > s.cuposAsignados) {
        this.mensajeErrorDistribucion = `En la ${s.nombre_sede}, la suma de cupos asignados a los grados (${totalGrados}) supera el total asignado a la sede (${s.cuposAsignados}).`;
        return this.mensajeErrorDistribucion;
      }
    }

    return null;
  }

  cargarGradosParaDistribucion(callback?: () => void): void {
    if (this.gradosCatalogoDistribucion && this.gradosCatalogoDistribucion.length > 0) {
      if (callback) callback();
      return;
    }

    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);

    this.http.get<any[]>(`${environment.apiUrl}/grados/`, { headers }).subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        if (res && res.length > 0) {
          this.gradosCatalogoDistribucion = res.map((g: any) => ({
            id_grado: Number(g.id_grado || g.id),
            nombre_grado: g.nombre_grado || g.nombre || `Grado ${g.id_grado || g.id}`
          }));
        } else {
          this.asignarGradosPorDefecto();
        }
        if (callback) callback();
        this.cdr.detectChanges();
      },
      error: () => {
        this.asignarGradosPorDefecto();
        if (callback) callback();
        this.cdr.detectChanges();
      }
    });
  }

  private asignarGradosPorDefecto(): void {
    this.gradosCatalogoDistribucion = [
      { id_grado: 1, nombre_grado: 'Transición' },
      { id_grado: 2, nombre_grado: 'Primero' },
      { id_grado: 3, nombre_grado: 'Segundo' },
      { id_grado: 4, nombre_grado: 'Tercero' },
      { id_grado: 5, nombre_grado: 'Cuarto' },
      { id_grado: 6, nombre_grado: 'Quinto' }
    ];
  }

  abrirEditarDistribucion(): void {
    if (!this.puedeEditarDistribucion) {
      this.sweetAlert.warning('Acceso denegado', 'No tienes autorización para editar la distribución de cupos.');
      return;
    }

    this.mensajeErrorDistribucion = '';
    this.cargarGradosParaDistribucion(() => {
      if (this.sedesInstitucion.length === 0) {
        this.actualizarSedesDeInstitucion();
      }
      if (this.sedesInstitucion.length > 0) {
        this.inicializarSedesParaEdicion();
        this.modalEditarDistribucionAbierto = true;
        this.cdr.detectChanges();
        return;
      }

      // Si aún no hay sedes en memoria, consultarlas directamente en tiempo real para esta institución
      const instId = this.contrato?.id_institucion || this.institucionSeleccionadaInfo?.id_institucion || this.institucionSeleccionadaInfo?.id;
      this.siraeService.getInstituciones(true).subscribe({
        next: (datosInst: any) => {
          const resInst = Array.isArray(datosInst) ? datosInst : (datosInst?.results || datosInst?.data || []);
          if (resInst.length > 0) {
            this.instituciones = resInst;
          }
          const targetInst = this.buscarInstitucionDelContrato();
          const finalInstId = instId || targetInst?.id_institucion || targetInst?.id;

          this.siraeService.getSedes(finalInstId ? Number(finalInstId) : undefined, true).subscribe({
            next: (datosSedes: any) => {
              const resSedes = Array.isArray(datosSedes) ? datosSedes : (datosSedes?.results || datosSedes?.data || []);
              if (finalInstId && resSedes.length > 0) {
                this.sedesInstitucion = resSedes;
              } else if (resSedes.length > 0) {
                this.sedes = resSedes;
                this.actualizarSedesDeInstitucion();
              } else if (targetInst) {
                this.sedesInstitucion = this.obtenerSedesDeInst(targetInst);
              }
              this.inicializarSedesParaDistribucion();
              this.inicializarSedesParaEdicion();
              this.modalEditarDistribucionAbierto = true;
              this.cdr.detectChanges();
            },
            error: () => {
              this.actualizarSedesDeInstitucion();
              this.inicializarSedesParaEdicion();
              this.modalEditarDistribucionAbierto = true;
              this.cdr.detectChanges();
            }
          });
        },
        error: () => {
          this.inicializarSedesParaEdicion();
          this.modalEditarDistribucionAbierto = true;
          this.cdr.detectChanges();
        }
      });
    });
  }

  cerrarEditarDistribucion(): void {
    this.modalEditarDistribucionAbierto = false;
    this.mensajeErrorDistribucion = '';
    this.cdr.detectChanges();
  }

  private inicializarSedesParaEdicion(): void {
    if (this.sedesInstitucion.length === 0) {
      this.actualizarSedesDeInstitucion();
    }

    let distribucionGuardada: any = this.obtenerDistribucionLocal();
    if (!distribucionGuardada) {
      try {
        const dataRaw = localStorage.getItem(`sirae_distribucion_contrato_${this.contratoId}`);
        if (dataRaw) {
          distribucionGuardada = JSON.parse(dataRaw);
        }
      } catch {
        distribucionGuardada = null;
      }
    }

    if (this.sedesInstitucion.length === 0 && Array.isArray(distribucionGuardada?.sedes) && distribucionGuardada.sedes.length > 0) {
      this.sedesInstitucion = distribucionGuardada.sedes.map((sg: any) => ({
        ...sg,
        id_sede: Number(sg.id_sede || sg.id),
        nombre_sede: sg.nombre_sede || sg.nombre || `Sede #${sg.id_sede || sg.id}`
      }));
    }

    this.sedesEdicionDistribucion = (this.sedesInstitucion || []).map((s, index) => {
      const sId = Number(s.id_sede || s.id);
      const sedeGuardada = distribucionGuardada?.sedes?.find((sg: any) => Number(sg.id_sede) === sId);
      const cuposSedeActuales = sedeGuardada?.cupos_asignados ?? this.obtenerCuposDeSede(s);

      const gradosSede = this.gradosCatalogoDistribucion.map(g => {
        let cupoGrado = 0;
        if (sedeGuardada?.grados) {
          const gGuardado = sedeGuardada.grados.find((gg: any) => Number(gg.id_grado) === g.id_grado);
          if (gGuardado) cupoGrado = Number(gGuardado.cupos) || 0;
        } else if (Array.isArray(s.grados)) {
          const gExistente = s.grados.find((gg: any) => Number(gg.id_grado) === g.id_grado);
          if (gExistente) cupoGrado = Number(gExistente.cupos) || 0;
        }
        return {
          id_grado: g.id_grado,
          nombre_grado: g.nombre_grado,
          cupos: cupoGrado
        };
      });

      return {
        id_sede: sId,
        nombre_sede: s.nombre_sede || s.nombre || `Sede #${sId}`,
        codigo_dane: s.codigo_dane,
        cuposAsignados: cuposSedeActuales,
        desplegada: index === 0,
        grados: gradosSede
      };
    });
  }

  obtenerClavesContrato(prefijo: string): string[] {
    const claves = new Set<string>();
    if (this.contratoId && this.contratoId !== 'nuevo' && this.contratoId !== '0') {
      claves.add(`${prefijo}${this.contratoId}`);
    }
    const c = this.contrato;
    if (c) {
      const id = c.id_contrato || c.id;
      if (id) claves.add(`${prefijo}${id}`);
      const cod = c.numero_cor || c.codigo;
      if (cod) {
        claves.add(`${prefijo}${cod.trim()}`);
        claves.add(`${prefijo}${cod.trim().toLowerCase()}`);
      }
      const instId = c.id_institucion;
      if (instId) claves.add(`${prefijo}inst_${instId}`);
      const instNom = c.institucion || c.nombre_institucion;
      if (instNom && typeof instNom === 'string' && instNom.trim()) {
        claves.add(`${prefijo}${instNom.trim().toLowerCase()}`);
        claves.add(`${prefijo}${instNom.trim()}`);
      }
    }
    return Array.from(claves);
  }

  cargarDistribucionPersistida(): void {
    // 1. Cargar inmediatamente desde almacenamiento local (es síncrono y preserva jornadas/menús)
    this.cargarDistribucionDesdeLocalStorage();

    if (!this.contratoId || this.contratoId === 'nuevo' || this.contratoId === '0') {
      return;
    }

    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);

    this.http.get<any>(`${environment.apiUrl}/contratos/${this.contratoId}/distribucion/`, { headers }).subscribe({
      next: (data: any) => {
        if (data && Array.isArray(data.sedes) && data.sedes.length > 0) {
          this.aplicarDatosDistribucion(data);
        }
      },
      error: () => {
        // En caso de error ya se precargó desde localStorage
      }
    });
  }

  obtenerDistribucionLocal(): any {
    const keys = this.obtenerClavesContrato('sirae_distribucion_contrato_');
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.sedes) && data.sedes.length > 0) {
          return data;
        }
      } catch {}
    }

    try {
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith('sirae_distribucion_contrato_'));
      const instNom = (this.contrato?.institucion || '').trim().toLowerCase();
      const instId = Number(this.contrato?.id_institucion);
      const cId = Number(this.contratoId || this.contrato?.id_contrato || this.contrato?.id);

      for (const k of allKeys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.sedes) && d.sedes.length > 0) {
          if (cId && (Number(d.id_contrato) === cId || Number(d.contrato_id) === cId)) return d;
          if (instId && Number(d.id_institucion) === instId) return d;
          if (instNom && d.institucion && String(d.institucion).trim().toLowerCase() === instNom) return d;
          const sedeMatches = (this.sedesInstitucion || []).some(s =>
            d.sedes.some((ds: any) =>
              Number(ds.id_sede || ds.id) === Number(s.id_sede || s.id) ||
              (ds.nombre_sede && s.nombre_sede && ds.nombre_sede.trim().toLowerCase() === s.nombre_sede.trim().toLowerCase())
            )
          );
          if (sedeMatches) return d;
        }
      }
    } catch {}

    return null;
  }

  private cargarDistribucionDesdeLocalStorage(): void {
    const data = this.obtenerDistribucionLocal();
    if (data) {
      this.aplicarDatosDistribucion(data);
    }
  }

  aplicarDatosDistribucion(data: any): void {
    if (!data || !Array.isArray(data.sedes)) return;

    const datosLocales = this.obtenerDistribucionLocal();

    if (this.sedesInstitucion.length === 0 && data.sedes.length > 0) {
      const dataInstId = data.id_institucion ? Number(data.id_institucion) : null;
      const cInstId = this.contrato?.id_institucion ? Number(this.contrato.id_institucion) : null;
      const dataInstNom = this.normalizarTextoInstitucion(data.institucion || data.institucion_nombre);
      const cInstNom = this.normalizarTextoInstitucion(this.contrato?.institucion || this.contrato?.institucion_nombre);

      const mismaInst = (!cInstId && !cInstNom) ||
        (cInstId && dataInstId && cInstId === dataInstId) ||
        (cInstNom && dataInstNom && cInstNom === dataInstNom);

      if (mismaInst) {
        this.sedesInstitucion = data.sedes.map((sg: any) => ({
          ...sg,
          id_sede: Number(sg.id_sede || sg.id || sg.sede),
          nombre_sede: sg.nombre_sede || sg.nombre || `Sede #${sg.id_sede || sg.id}`
        }));
      }
    }

    let sumaCuposSedes = 0;
    this.sedesInstitucion.forEach(s => {
      const sId = Number(s.id_sede || s.id);
      const sedeG = data.sedes.find((sg: any) =>
        Number(sg.id_sede || sg.id || sg.sede) === sId ||
        (sg.nombre_sede && s.nombre_sede && sg.nombre_sede.trim().toLowerCase() === s.nombre_sede.trim().toLowerCase())
      );
      const sedeLocal = datosLocales?.sedes?.find((sl: any) =>
        Number(sl.id_sede || sl.id || sl.sede) === sId ||
        (sl.nombre_sede && s.nombre_sede && sl.nombre_sede.trim().toLowerCase() === s.nombre_sede.trim().toLowerCase())
      );

      if (sedeG || sedeLocal) {
        // Cupos
        const cuposBackend = Number(sedeG?.cupos_asignados ?? sedeG?.cuposAsignados ?? sedeG?.cupos) || 0;
        const cuposLocal = Number(sedeLocal?.cupos_asignados ?? sedeLocal?.cuposAsignados ?? sedeLocal?.cupos) || 0;
        const cupos = cuposBackend > 0 ? cuposBackend : (cuposLocal > 0 ? cuposLocal : (Number(s.cupos_asignados ?? s.cupos) || 0));

        s.cupos = cupos;
        s.cupos_asignados = cupos;
        sumaCuposSedes += cupos;

        // Jornadas: combinar backend y local
        if (sedeG?.jornada_manana !== undefined) {
          s.jornada_manana = !!sedeG.jornada_manana;
        } else if (sedeLocal?.jornada_manana !== undefined) {
          s.jornada_manana = !!sedeLocal.jornada_manana;
        }

        if (sedeG?.jornada_tarde !== undefined) {
          s.jornada_tarde = !!sedeG.jornada_tarde;
        } else if (sedeLocal?.jornada_tarde !== undefined) {
          s.jornada_tarde = !!sedeLocal.jornada_tarde;
        }

        const jList = Array.isArray(sedeG?.jornadas) && sedeG.jornadas.length > 0
          ? sedeG.jornadas
          : (Array.isArray(sedeLocal?.jornadas) ? sedeLocal.jornadas : []);

        if (jList.length > 0) {
          if (jList.some((j: string) => String(j).toLowerCase().includes('mañan'))) s.jornada_manana = true;
          if (jList.some((j: string) => String(j).toLowerCase().includes('tard'))) s.jornada_tarde = true;
        }

        // Secciones / Menús
        if (Array.isArray(sedeG?.secciones_ids) && sedeG.secciones_ids.length > 0) {
          s.secciones_ids = [...sedeG.secciones_ids];
        } else if (Array.isArray(sedeLocal?.secciones_ids) && sedeLocal.secciones_ids.length > 0) {
          s.secciones_ids = [...sedeLocal.secciones_ids];
        }

        // Grados
        const gradosFuente = (Array.isArray(sedeG?.grados) && sedeG.grados.length > 0)
          ? sedeG.grados
          : (Array.isArray(sedeLocal?.grados) ? sedeLocal.grados : []);

        if (gradosFuente.length > 0) {
          s.grados = gradosFuente.map((g: any) => ({
            id_grado: Number(g.id_grado || g.id),
            nombre_grado: g.nombre || g.nombre_grado || `Grado ${g.id_grado}`,
            cupos: Number(g.cuposAsignados ?? g.cupos_asignados ?? g.cupos) || 0
          }));
        }
      }
    });

    const totalAutorizado = Number(data.total_autorizado ?? data.total_distribuido ?? datosLocales?.total_autorizado) || sumaCuposSedes;
    if (totalAutorizado > 0 && this.contrato) {
      this.contrato.cupos = totalAutorizado;
    }

    // Actualizar jornadas globales y menús del contrato
    this.sincronizarJornadasYMenusDesdeSedes();

    this.cargarHistorialLocal();
    this.cdr.detectChanges();
  }

  async guardarDistribucion(): Promise<void> {
    const error = this.validarDistribucionEdicion();
    if (error) {
      await this.sweetAlert.warning('Inconsistencia en la distribución', error);
      return;
    }

    this.guardandoDistribucion = true;

    const instId = this.contrato?.id_institucion || null;
    const ahora = new Date().toISOString();
    const cuposAnteriores = this.cuposAutorizados;

    const payload = {
      id_contrato: Number(this.contratoId) || this.contrato?.id_contrato,
      codigo_contrato: this.contrato?.codigo,
      id_institucion: instId,
      institucion_nombre: this.contrato?.institucion,
      total_autorizado: this.cuposAutorizados || this.totalCuposSedesEdicion,
      total_distribuido: this.totalCuposSedesEdicion,
      pendientes: this.cuposPendientesSedesEdicion,
      fecha_actualizacion: ahora,
      usuario_responsable: this.nombreUsuarioResponsableActual,
      sedes: this.sedesEdicionDistribucion.map(s => ({
        id_sede: s.id_sede,
        nombre_sede: s.nombre_sede,
        cuposAsignados: Number(s.cuposAsignados) || 0,
        cupos_asignados: Number(s.cuposAsignados) || 0,
        cupos: Number(s.cuposAsignados) || 0,
        grados: s.grados.map(g => ({
          id_grado: g.id_grado,
          nombre_grado: g.nombre_grado,
          cuposAsignados: Number(g.cupos) || 0,
          cupos_asignados: Number(g.cupos) || 0,
          cupos: Number(g.cupos) || 0
        }))
      }))
    };

    // 1. Persistencia en localStorage en todas las claves
    try {
      const keys = this.obtenerClavesContrato('sirae_distribucion_contrato_');
      keys.forEach(k => localStorage.setItem(k, JSON.stringify(payload)));
      this.sedesEdicionDistribucion.forEach(s => {
        localStorage.setItem(`sirae_distribucion_grados_${this.contratoId}_sede_${s.id_sede}`, JSON.stringify(s.grados));
      });
    } catch (e) {
      console.warn('No se pudo guardar distribución en localStorage:', e);
    }

    // 2. Persistencia en Backend
    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);

    this.http.put(`${environment.apiUrl}/contratos/${this.contratoId}/distribucion/`, payload, { headers }).subscribe({
      next: () => {},
      error: () => {
        this.http.post(`${environment.apiUrl}/distribucion-cupos/`, payload, { headers }).subscribe({
          next: () => {},
          error: () => {}
        });
      }
    });

    // 3. Actualizar automáticamente la información de la ventana principal
    this.sedesInstitucion.forEach(s => {
      const match = this.sedesEdicionDistribucion.find(e => Number(e.id_sede) === Number(s.id_sede || s.id));
      if (match) {
        s.cupos = match.cuposAsignados;
        s.cupos_asignados = match.cuposAsignados;
        s.grados = match.grados;
      }
    });

    if (this.totalCuposSedesEdicion > 0 && this.contrato) {
      if (!this.contrato.cupos || this.totalCuposSedesEdicion > Number(this.contrato.cupos)) {
        this.contrato.cupos = this.totalCuposSedesEdicion;
      }
    }

    // Registrar en auditoría
    const ahoraFmt = new Date().toLocaleString('es-CO');
    const registroAudit = {
      id_modificacion: Date.now(),
      tipo: 'DISTRIBUCION',
      usuario_responsable: this.nombreUsuarioResponsableActual,
      fecha_registro: ahoraFmt,
      cambios: [
        {
          campo: 'Distribución de cupos entre sedes',
          anterior: `${cuposAnteriores} cupos`,
          nuevo: `${this.totalCuposSedesEdicion} cupos distribuidos`
        }
      ],
      estado_resultante: this.contrato?.estado || 'Activo'
    };
    this.historialModificaciones.unshift(registroAudit);
    this.guardarHistorialLocal();

    this.guardandoDistribucion = false;
    this.modalEditarDistribucionAbierto = false;
    this.cdr.detectChanges();

    await this.sweetAlert.success(
      '¡Distribución guardada!',
      'La distribución de cupos por sedes y grados ha sido guardada exitosamente y asociada al contrato.'
    );
  }

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
    this.historialModificaciones = [];
    const keys = this.obtenerClavesContrato('sirae_historial_modificaciones_');

    for (const key of keys) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.historialModificaciones = parsed;
            return;
          }
        }
      } catch {}
    }

    // Si aún no hay historial grabado pero el contrato existe, generar el registro inicial de auditoría
    if (this.contrato && (this.contrato.codigo || this.contrato.institucion)) {
      const fechaBase = this.contrato.fecha_inicio
        ? `${this.contrato.fecha_inicio} 08:00:00`
        : new Date().toLocaleString('es-CO');
      const cuposContrato = this.cuposAutorizados;
      this.historialModificaciones = [
        {
          id_modificacion: Date.now(),
          tipo: 'MODIFICACION',
          usuario_responsable: this.nombreSupervisorAsignado || this.nombreUsuarioResponsableActual,
          fecha_registro: fechaBase,
          cambios: [
            {
              campo: 'Registro inicial del contrato y cupos autorizados',
              anterior: 'No registrado',
              nuevo: `${this.contrato.institucion || 'Institución'} (${cuposContrato} cupos)`
            },
            {
              campo: 'Vigencia contractual',
              anterior: 'Sin vigencia',
              nuevo: `${this.contrato.fecha_inicio || 'Inicio'} al ${this.contrato.fecha_fin || 'Fin'}`
            }
          ],
          estado_resultante: this.contrato.estado || 'Activo'
        }
      ];
      this.guardarHistorialLocal();
    }
  }

  guardarHistorialLocal() {
    const keys = this.obtenerClavesContrato('sirae_historial_modificaciones_');
    keys.forEach(k => {
      try {
        localStorage.setItem(k, JSON.stringify(this.historialModificaciones));
      } catch (e) {
        console.warn('Error guardando historial en localStorage:', e);
      }
    });
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

  readonly periodicidadOpciones = [
    { value: 'DIARIA', label: 'Diaria (1 día)', diasDefault: 1 },
    { value: 'SEMANAL', label: 'Semanal (5 días)', diasDefault: 5 },
    { value: 'QUINCENAL', label: 'Quincenal (10 días)', diasDefault: 10 },
    { value: 'MENSUAL', label: 'Mensual (20 días)', diasDefault: 20 },
    { value: 'PERSONALIZADA', label: 'Personalizada', diasDefault: null },
  ];

  datosEdicion: {
    estado: 'Activo' | 'Inactivo' | 'Finalizado';
    id_usuario_supervisor: number | null;
    cupos: number;
    zona: string;
    fecha_inicio: string;
    fecha_fin: string;
    periodicidad_perecederos: string;
    dias_cobertura_perecederos: number;
    periodicidad_no_perecederos: string;
    dias_cobertura_no_perecederos: number;
    errorValidacion: string;
  } = {
    estado: 'Activo',
    id_usuario_supervisor: null,
    cupos: 0,
    zona: '',
    fecha_inicio: '',
    fecha_fin: '',
    periodicidad_perecederos: 'SEMANAL',
    dias_cobertura_perecederos: 5,
    periodicidad_no_perecederos: 'MENSUAL',
    dias_cobertura_no_perecederos: 20,
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
      periodicidad_perecederos: this.contrato?.periodicidad_perecederos || 'SEMANAL',
      dias_cobertura_perecederos: Number(this.contrato?.dias_cobertura_perecederos) || 5,
      periodicidad_no_perecederos: this.contrato?.periodicidad_no_perecederos || 'MENSUAL',
      dias_cobertura_no_perecederos: Number(this.contrato?.dias_cobertura_no_perecederos) || 20,
      errorValidacion: ''
    };
    this.modalEdicionAbierto = true;
    this.cdr.detectChanges();
  }

  alCambiarPeriodicidad(tipo: 'perecederos' | 'no_perecederos') {
    const clave = tipo === 'perecederos'
      ? this.datosEdicion.periodicidad_perecederos
      : this.datosEdicion.periodicidad_no_perecederos;
    const opcion = this.periodicidadOpciones.find(o => o.value === clave);
    if (opcion?.diasDefault != null) {
      if (tipo === 'perecederos') {
        this.datosEdicion.dias_cobertura_perecederos = opcion.diasDefault;
      } else {
        this.datosEdicion.dias_cobertura_no_perecederos = opcion.diasDefault;
      }
    }
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

    const diasPer = Number(this.datosEdicion.dias_cobertura_perecederos);
    const diasNoPer = Number(this.datosEdicion.dias_cobertura_no_perecederos);
    if (!Number.isFinite(diasPer) || diasPer < 1 || !Number.isFinite(diasNoPer) || diasNoPer < 1) {
      this.datosEdicion.errorValidacion = 'Los días de cobertura para perecederos y no perecederos deben ser mayores o iguales a 1.';
      return false;
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

    // 6. Periodicidad de abastecimiento (HU 5)
    const perPerAnt = this.contrato?.periodicidad_perecederos || 'SEMANAL';
    const diasPerAnt = Number(this.contrato?.dias_cobertura_perecederos) || 5;
    const perNoPerAnt = this.contrato?.periodicidad_no_perecederos || 'MENSUAL';
    const diasNoPerAnt = Number(this.contrato?.dias_cobertura_no_perecederos) || 20;
    const diasPerNuevo = Number(this.datosEdicion.dias_cobertura_perecederos);
    const diasNoPerNuevo = Number(this.datosEdicion.dias_cobertura_no_perecederos);
    if (perPerAnt !== this.datosEdicion.periodicidad_perecederos || diasPerAnt !== diasPerNuevo) {
      cambiosDetectados.push({
        campo: 'Periodicidad perecederos',
        anterior: `${perPerAnt} (${diasPerAnt} días)`,
        nuevo: `${this.datosEdicion.periodicidad_perecederos} (${diasPerNuevo} días)`
      });
    }
    if (perNoPerAnt !== this.datosEdicion.periodicidad_no_perecederos || diasNoPerAnt !== diasNoPerNuevo) {
      cambiosDetectados.push({
        campo: 'Periodicidad no perecederos',
        anterior: `${perNoPerAnt} (${diasNoPerAnt} días)`,
        nuevo: `${this.datosEdicion.periodicidad_no_perecederos} (${diasNoPerNuevo} días)`
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
    this.contrato.periodicidad_perecederos = this.datosEdicion.periodicidad_perecederos;
    this.contrato.dias_cobertura_perecederos = diasPerNuevo;
    this.contrato.periodicidad_no_perecederos = this.datosEdicion.periodicidad_no_perecederos;
    this.contrato.dias_cobertura_no_perecederos = diasNoPerNuevo;

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
      fecha_fin: this.contrato.fecha_fin,
      periodicidad_perecederos: this.contrato.periodicidad_perecederos,
      dias_cobertura_perecederos: this.contrato.dias_cobertura_perecederos,
      periodicidad_no_perecederos: this.contrato.periodicidad_no_perecederos,
      dias_cobertura_no_perecederos: this.contrato.dias_cobertura_no_perecederos
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
    if (!this.contrato?.institucion && !this.contrato?.id_institucion) return null;
    return this.buscarInstitucionDelContrato();
  }

  mensajeAviso = '';
  tituloAviso = '';
  institucionRequeridaAviso = false;

  mostrarSedesDetalle = false;
  modalSeleccionarInstitucionAbierto = false;
  busquedaInstitucion = '';
  institucionTemporalSeleccionada: any = null;
  listaContratosExistentes: any[] = [];

  institucionTieneContrato(inst: any): { tieneContrato: boolean; contratoExistente?: any } {
    if (!inst) return { tieneContrato: false };
    const instId = inst?.id_institucion || inst?.id;
    const instNom = (inst?.nombre_institucion || '').trim().toLowerCase();

    const c = (this.listaContratosExistentes || []).find((con: any) => {
      // Si estamos editando este contrato, no es conflicto consigo mismo
      if (this.contratoId && String(con.id_contrato || con.id || con.pk) === String(this.contratoId)) {
        return false;
      }
      const cInstId = typeof con.id_institucion === 'object' && con.id_institucion !== null
        ? (con.id_institucion.id_institucion || con.id_institucion.id)
        : con.id_institucion;
      const cInstNom = (con.institucion || con.id_institucion?.nombre_institucion || '').trim().toLowerCase();

      const coincideId = instId != null && cInstId != null && Number(instId) === Number(cInstId);
      const coincideNom = !!(instNom && cInstNom && instNom === cInstNom);
      return coincideId || coincideNom;
    });

    return { tieneContrato: !!c, contratoExistente: c };
  }

  trackBySede(index: number, sede: any): any {
    return sede.id_sede || sede.id || index;
  }

  trackByGrado(index: number, grado: any): any {
    return grado.id_grado || grado.id || index;
  }

  toggleMostrarSedes(): void {
    this.mostrarSedesDetalle = !this.mostrarSedesDetalle;
    this.cdr.detectChanges();
  }

  abrirModalSeleccionarInstitucion(): void {
    this.busquedaInstitucion = '';
    this.institucionTemporalSeleccionada = this.buscarInstitucionDelContrato();
    this.modalSeleccionarInstitucionAbierto = true;
    this.cdr.detectChanges();

    // Refrescar catálogo de instituciones y sedes al abrir el selector para incluir cualquier registro recién creado
    this.siraeService.getInstituciones(true).subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos?.results || datos?.data || []);
        if (res.length > 0) {
          this.instituciones = res;
          this.institucionTemporalSeleccionada = this.buscarInstitucionDelContrato();
          this.cdr.detectChanges();
        }
      }
    });
    this.siraeService.getSedes(undefined, true).subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos?.results || datos?.data || []);
        if (res.length > 0) {
          this.sedes = res;
          this.cdr.detectChanges();
        }
      }
    });
  }

  esInstitucionSeleccionadaEnModal(inst: any): boolean {
    if (!inst) return false;
    const instId = inst.id_institucion ?? inst.id;
    const temp = this.institucionTemporalSeleccionada;
    if (temp) {
      const tempId = temp.id_institucion ?? temp.id;
      if (instId != null && tempId != null) {
        return Number(instId) === Number(tempId);
      }
      return (temp.nombre_institucion || '').trim().toLowerCase() === (inst.nombre_institucion || '').trim().toLowerCase();
    }
    const cInstId = typeof this.contrato?.id_institucion === 'object'
      ? (this.contrato?.id_institucion?.id_institucion ?? this.contrato?.id_institucion?.id)
      : this.contrato?.id_institucion;
    if (instId != null && cInstId != null) {
      return Number(instId) === Number(cInstId);
    }
    return !!this.contrato?.institucion && (this.contrato.institucion || '').trim().toLowerCase() === (inst.nombre_institucion || '').trim().toLowerCase();
  }

  cerrarModalSeleccionarInstitucion(): void {
    this.modalSeleccionarInstitucionAbierto = false;
    this.cdr.detectChanges();
  }

  marcarInstitucion(inst: any): void {
    if (this.modo === 'nuevo') {
      const info = this.institucionTieneContrato(inst);
      if (info.tieneContrato) {
        return;
      }
    }
    this.institucionTemporalSeleccionada = inst;
    this.cdr.detectChanges();
  }

  irAEditarContratoExistente(info: any): void {
    const idExistente = info?.contratoExistente?.id_contrato || info?.contratoExistente?.id;
    if (!idExistente) return;

    this.cerrarModalSeleccionarInstitucion();
    this.contratoId = String(idExistente);
    this.modo = 'edicion';
    this.modalEdicionAbierto = false;
    this.pestanaActiva = 'resumen';
    this.cargarDetalleContrato();
    this.cdr.detectChanges();
  }

  seleccionarInstitucionDesdeModal(inst: any): void {
    if (this.modo === 'nuevo') {
      const info = this.institucionTieneContrato(inst);
      if (info.tieneContrato) {
        this.irAEditarContratoExistente(info);
        return;
      }
    }
    this.institucionTemporalSeleccionada = inst;
    this.contrato.institucion = inst.nombre_institucion;
    this.contrato.id_institucion = inst.id_institucion || inst.id || null;
    this.sedesInstitucion = this.obtenerSedesDeInst(inst).map(s => ({ ...s }));
    this.mensajeAviso = '';
    this.institucionRequeridaAviso = false;
    this.onInstitucionChange();
    this.cerrarModalSeleccionarInstitucion();
  }

  confirmarSeleccionInstitucion(): void {
    if (this.institucionTemporalSeleccionada) {
      if (this.modo === 'nuevo') {
        const info = this.institucionTieneContrato(this.institucionTemporalSeleccionada);
        if (info.tieneContrato) {
          this.irAEditarContratoExistente(info);
          return;
        }
      }
      this.contrato.institucion = this.institucionTemporalSeleccionada.nombre_institucion;
      this.contrato.id_institucion = this.institucionTemporalSeleccionada.id_institucion || this.institucionTemporalSeleccionada.id || null;
      this.sedesInstitucion = this.obtenerSedesDeInst(this.institucionTemporalSeleccionada).map(s => ({ ...s }));
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
    this.contrato.id_institucion = null;
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
    if (!inst) return [];
    const instId = inst?.id_institucion || inst?.id;
    const instNomNorm = this.normalizarTextoInstitucion(inst?.nombre_institucion || inst?.nombre);
    const sedesEnCatalogo = (this.sedes || []).filter(s => {
      const sInstId = typeof s.id_institucion === 'object' && s.id_institucion !== null
        ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
        : (s.id_institucion ?? s.institucion_id ?? s.institucion);
      if (instId != null && sInstId != null && Number(sInstId) === Number(instId)) {
        return true;
      }
      const sNomNorm = this.normalizarTextoInstitucion(s.institucion_nombre || s.nombre_institucion);
      return !!(instNomNorm && sNomNorm && sNomNorm === instNomNorm);
    });
    const sedesEmbebidas: any[] = Array.isArray(inst?.sedes)
      ? inst.sedes.map((s: any) => ({ ...s, id_institucion: s.id_institucion ?? instId }))
      : [];
    if (sedesEmbebidas.length === 0 && (this.instituciones || []).length > 0) {
      for (const otra of this.instituciones) {
        const otraId = otra?.id_institucion ?? otra?.id;
        const otraNom = this.normalizarTextoInstitucion(otra?.nombre_institucion || otra?.nombre);
        const coincide = (instId != null && otraId != null && Number(instId) === Number(otraId)) ||
          (instNomNorm && otraNom && instNomNorm === otraNom);
        if (coincide && Array.isArray(otra?.sedes) && otra.sedes.length > 0) {
          for (const s of otra.sedes) {
            sedesEmbebidas.push({ ...s, id_institucion: s.id_institucion ?? otraId ?? instId });
          }
        }
      }
    }
    if (sedesEnCatalogo.length === 0) return sedesEmbebidas;
    if (sedesEmbebidas.length === 0) return sedesEnCatalogo;
    const mapa = new Map<number, any>();
    for (const s of [...sedesEmbebidas, ...sedesEnCatalogo]) {
      const id = Number(s.id_sede ?? s.id);
      if (id) mapa.set(id, { ...(mapa.get(id) || {}), ...s });
    }
    return Array.from(mapa.values());
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['contratoId'] && !changes['contratoId'].firstChange) {
      const nuevoId = changes['contratoId'].currentValue;
      if (nuevoId === 'nuevo' || nuevoId === '0') {
        this.modo = 'nuevo';
        this.iniciarContrato();
      } else if (nuevoId) {
        this.cargarDetalleContrato();
      }
    }
    if (changes['modo'] && !changes['modo'].firstChange) {
      this.actualizarSedesDeInstitucion();
      this.cdr.detectChanges();
    }
  }

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
        { id_seccion: 1, id: 1, nombre_seccion: 'Desayuno', nombre: 'Desayuno', jornada: 'Mañana', id_jornada: 3 },
        { id_seccion: 2, id: 2, nombre_seccion: 'Almuerzo', nombre: 'Almuerzo', jornada: 'Tarde', id_jornada: 5 },
        { id_seccion: 3, id: 3, nombre_seccion: 'Merienda', nombre: 'Merienda', jornada: 'Tarde', id_jornada: 5 }
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
      const nom = (s.nombre_seccion || s.nombre || '').toLowerCase();
      const jNom = (s.jornada || s.nombre_jornada || s.jornada_nombre || '').toLowerCase();
      const jId = Number(typeof s.id_jornada === 'object' ? s.id_jornada?.id_jornada : s.id_jornada);
      if (norm.includes('mañana')) {
        return nom.includes('desayuno') || nom.includes('am') || jNom.includes('mañana') || jId === 1 || jId === 3;
      }
      if (norm.includes('tarde')) {
        return nom.includes('almuerzo') || nom.includes('merienda') || nom.includes('pm') || jNom.includes('tarde') || jId === 2 || jId === 5;
      }
      return false;
    });
  }

  get todasSeccionesDisponibles(): any[] {
    if (!this.seccionesMenu || this.seccionesMenu.length === 0) {
      this.cargarSeccionesPorDefecto();
    }
    return this.seccionesMenu || [];
  }

  obtenerNombreJornadaDeSeccion(seccion: any): string {
    const nom = (seccion.nombre_seccion || seccion.nombre || '').toLowerCase();
    const jNom = (seccion.jornada || seccion.nombre_jornada || seccion.jornada_nombre || '').toLowerCase();
    const jId = Number(typeof seccion.id_jornada === 'object' ? seccion.id_jornada?.id_jornada : seccion.id_jornada);

    if (nom.includes('desayuno') || jNom.includes('mañana') || jId === 1 || jId === 3) return 'Mañana';
    if (nom.includes('merienda') || jNom.includes('tarde') || jId === 2 || jId === 5) return 'Tarde';
    return 'correspondiente';
  }

  esSeccionDeJornada(seccion: any, jornada: 'Mañana' | 'Tarde'): boolean {
    const nom = (seccion.nombre_seccion || seccion.nombre || '').toLowerCase();
    const jNom = (seccion.jornada || seccion.nombre_jornada || seccion.jornada_nombre || '').toLowerCase();
    const jId = Number(typeof seccion.id_jornada === 'object' ? seccion.id_jornada?.id_jornada : seccion.id_jornada);

    if (jornada === 'Mañana') {
      return nom.includes('desayuno') || jNom.includes('mañana') || jId === 1 || jId === 3;
    }
    if (jornada === 'Tarde') {
      return nom.includes('merienda') || jNom.includes('tarde') || jId === 2 || jId === 5;
    }
    return false;
  }

  esJornadaDeSeccionHabilitada(seccion: any): boolean {
    const jReq = this.obtenerNombreJornadaDeSeccion(seccion);
    if (jReq === 'Mañana') {
      return !!this.jornadaManana?.habilitada;
    }
    if (jReq === 'Tarde') {
      return !!this.jornadaTarde?.habilitada;
    }
    return !!this.jornadaManana?.habilitada || !!this.jornadaTarde?.habilitada;
  }

  toggleSeccionItem(seccion: any) {
    if (!this.esJornadaDeSeccionHabilitada(seccion)) {
      const nom = seccion.nombre_seccion || seccion.nombre || 'esta sección';
      const jReq = this.obtenerNombreJornadaDeSeccion(seccion);
      void this.sweetAlert.warning(
        'Jornada no amparada',
        `No puedes seleccionar "${nom}" porque la jornada ${jReq} no está activa en el contrato. Actívala primero en el Paso 2.`
      );
      return;
    }
    const sId = Number(seccion.id_seccion || seccion.id);
    const estaAsignada = this.estaSeccionAsignada(sId);
    this.toggleSeccionMenu(sId, { target: { checked: !estaAsignada } });
  }

  esSeccionPermitidaParaSede(sede: any, sec: any): boolean {
    if (!sede) return false;
    const nom = (sec.nombre_seccion || sec.nombre || '').toLowerCase();
    const jNom = (sec.jornada || sec.nombre_jornada || sec.jornada_nombre || '').toLowerCase();
    const jId = Number(typeof sec.id_jornada === 'object' ? sec.id_jornada?.id_jornada : sec.id_jornada);

    const esManana = nom.includes('desayuno') || jNom.includes('mañana') || jId === 1 || jId === 3;
    const esMerienda = nom.includes('merienda') || jNom.includes('tarde') || jId === 2 || jId === 5;

    if (esManana) {
      return !!sede.jornada_manana;
    }
    if (esMerienda) {
      return !!sede.jornada_tarde;
    }
    // Almuerzo u otra sección general: requiere que la sede tenga al menos una jornada activa
    return !!sede.jornada_manana || !!sede.jornada_tarde;
  }

  obtenerMotivoBloqueoSeccionSede(sede: any, sec: any): string {
    const jReq = this.obtenerNombreJornadaDeSeccion(sec);
    if (jReq === 'Mañana' && !sede.jornada_manana) {
      return 'Para asignar Desayuno, primero activa la jornada Mañana en esta sede.';
    }
    if (jReq === 'Tarde' && !sede.jornada_tarde) {
      return 'Para asignar Merienda, primero activa la jornada Tarde en esta sede.';
    }
    if (!sede.jornada_manana && !sede.jornada_tarde) {
      return 'Debes asignarle al menos una jornada a esta sede para habilitar sus menús.';
    }
    return 'Sección no disponible para la jornada de esta sede.';
  }

  estaSeccionEnSede(sede: any, seccionId: number): boolean {
    if (!sede.secciones_ids || !Array.isArray(sede.secciones_ids)) return false;
    return sede.secciones_ids.includes(Number(seccionId));
  }

  sincronizarJornadasYMenusDesdeSedes(): void {
    const algunManana = (this.sedesInstitucion || []).some(s => !!s.jornada_manana);
    const algunTarde = (this.sedesInstitucion || []).some(s => !!s.jornada_tarde);
    if (this.jornadaManana) this.jornadaManana.habilitada = algunManana;
    if (this.jornadaTarde) this.jornadaTarde.habilitada = algunTarde;

    const idsUnicos = new Set<number>();
    (this.sedesInstitucion || []).forEach(s => {
      (s.secciones_ids || []).forEach((id: number) => idsUnicos.add(Number(id)));
    });

    this.contratosSeccionMenu = Array.from(idsUnicos).map(id => ({ id_seccion: id }));
  }

  get tieneJornadaMananaEnAlgunaSede(): boolean {
    return (this.sedesInstitucion || []).some(s => !!s.jornada_manana);
  }

  get tieneJornadaTardeEnAlgunaSede(): boolean {
    return (this.sedesInstitucion || []).some(s => !!s.jornada_tarde);
  }

  get nombresMenusConsolidados(): string[] {
    const ids = new Set<number>();
    (this.sedesInstitucion || []).forEach(s => {
      (s.secciones_ids || []).forEach((id: number) => ids.add(Number(id)));
    });
    return Array.from(ids).map(id => {
      const sec = (this.seccionesMenu || []).find(m => Number(m.id_seccion || m.id) === id);
      return sec ? (sec.nombre_seccion || sec.nombre) : `Menú #${id}`;
    });
  }

  toggleJornadaSede(sede: any, tipo: 'Mañana' | 'Tarde') {
    if (tipo === 'Mañana') {
      sede.jornada_manana = !sede.jornada_manana;
      if (!sede.jornada_manana && Array.isArray(sede.secciones_ids)) {
        sede.secciones_ids = sede.secciones_ids.filter((id: number) => {
          const sec = this.seccionesMenu.find(m => Number(m.id_seccion || m.id) === id);
          return sec ? !this.esSeccionDeJornada(sec, 'Mañana') : true;
        });
      } else if (sede.jornada_manana) {
        if (!Array.isArray(sede.secciones_ids)) sede.secciones_ids = [];
        const secManana = this.seccionesPorNombreJornada('Mañana');
        if (secManana.length > 0) {
          const sId = Number(secManana[0].id_seccion || secManana[0].id);
          if (!sede.secciones_ids.includes(sId)) sede.secciones_ids.push(sId);
        }
      }
    } else {
      sede.jornada_tarde = !sede.jornada_tarde;
      if (!sede.jornada_tarde && Array.isArray(sede.secciones_ids)) {
        sede.secciones_ids = sede.secciones_ids.filter((id: number) => {
          const sec = this.seccionesMenu.find(m => Number(m.id_seccion || m.id) === id);
          return sec ? !this.esSeccionDeJornada(sec, 'Tarde') : true;
        });
      } else if (sede.jornada_tarde) {
        if (!Array.isArray(sede.secciones_ids)) sede.secciones_ids = [];
        const secTarde = this.seccionesPorNombreJornada('Tarde');
        if (secTarde.length > 0) {
          const sId = Number(secTarde[0].id_seccion || secTarde[0].id);
          if (!sede.secciones_ids.includes(sId)) sede.secciones_ids.push(sId);
        }
      }
    }
    this.sincronizarJornadasYMenusDesdeSedes();
    this.cdr.detectChanges();
  }

  toggleSeccionSede(sede: any, seccion: any) {
    if (!this.esSeccionPermitidaParaSede(sede, seccion)) {
      const motivo = this.obtenerMotivoBloqueoSeccionSede(sede, seccion);
      void this.sweetAlert.warning('Acción no permitida', motivo);
      return;
    }

    if (!Array.isArray(sede.secciones_ids)) {
      sede.secciones_ids = [];
    }

    const sId = Number(seccion.id_seccion || seccion.id);
    const idx = sede.secciones_ids.indexOf(sId);
    if (idx >= 0) {
      sede.secciones_ids.splice(idx, 1);
    } else {
      sede.secciones_ids.push(sId);
    }
    this.sincronizarJornadasYMenusDesdeSedes();
    this.cdr.detectChanges();
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
    this.siraeService.getInstituciones(true).subscribe({
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
    this.siraeService.getSedes(undefined, true).subscribe({
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

    // 5. Cargar lista de contratos existentes (para evitar duplicidad de contratos por IE)
    this.siraeService.getContratos().subscribe({
      next: (datos: any) => {
        this.listaContratosExistentes = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Error al precargar contratos existentes:', err);
      }
    });

    // 6. Cargar Supervisores disponibles
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

  private normalizarTextoInstitucion(str: any): string {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buscarInstitucionDelContrato(): any {
    const instNombre = this.normalizarTextoInstitucion(this.contrato?.institucion || this.contrato?.institucion_nombre);
    const cInstId = typeof this.contrato?.id_institucion === 'object'
      ? (this.contrato?.id_institucion?.id_institucion ?? this.contrato?.id_institucion?.id)
      : this.contrato?.id_institucion;

    // 1. Si hay selección temporal y coincide con el contrato actual
    if (this.institucionTemporalSeleccionada) {
      const tempNom = this.normalizarTextoInstitucion(this.institucionTemporalSeleccionada.nombre_institucion || this.institucionTemporalSeleccionada.nombre);
      const tempId = this.institucionTemporalSeleccionada.id_institucion || this.institucionTemporalSeleccionada.id;
      if ((instNombre && tempNom === instNombre) || (cInstId && tempId && Number(tempId) === Number(cInstId))) {
        return this.institucionTemporalSeleccionada;
      }
    }

    // 2. Si coincide tanto por ID como por nombre y tiene sedes, usar esa coincidencia exacta
    if (cInstId && instNombre) {
      const porIdYNombre = (this.instituciones || []).find(i =>
        Number(i.id_institucion ?? i.id) === Number(cInstId) &&
        this.normalizarTextoInstitucion(i.nombre_institucion || i.nombre) === instNombre
      );
      if (porIdYNombre && this.obtenerSedesDeInst(porIdYNombre).length > 0) {
        return porIdYNombre;
      }
    }

    // 3. Priorizar búsqueda por nombre exacto de la institución (para evitar que un id_institucion desfasado apunte a otra institución con 0 sedes)
    if (instNombre) {
      const candidatasExactas = (this.instituciones || []).filter(i => {
        const nom = this.normalizarTextoInstitucion(i.nombre_institucion || i.nombre);
        return nom === instNombre;
      });
      if (candidatasExactas.length === 1) return candidatasExactas[0];
      if (candidatasExactas.length > 1) {
        const conSedes = candidatasExactas.find(i => this.obtenerSedesDeInst(i).length > 0);
        return conSedes || candidatasExactas[0];
      }
    }

    // 4. Buscar por ID si no coincidió por nombre exacto
    if (cInstId) {
      const porId = (this.instituciones || []).find(i => Number(i.id_institucion ?? i.id) === Number(cInstId));
      if (porId) return porId;
    }

    // 5. Búsqueda parcial por nombre priorizando aquella que tenga sedes
    if (instNombre) {
      const candidatasParciales = (this.instituciones || []).filter(i => {
        const nom = this.normalizarTextoInstitucion(i.nombre_institucion || i.nombre);
        return nom && (nom.includes(instNombre) || instNombre.includes(nom));
      });
      if (candidatasParciales.length > 0) {
        const conSedes = candidatasParciales.find(i => this.obtenerSedesDeInst(i).length > 0);
        return conSedes || candidatasParciales[0];
      }
    }

    return null;
  }

  private fusionarEstadoSedesPrevias(nuevasSedes: any[], previas: any[]): any[] {
    if (!Array.isArray(nuevasSedes) || nuevasSedes.length === 0) return [];
    if (!Array.isArray(previas) || previas.length === 0) return nuevasSedes.map(s => ({ ...s }));
    return nuevasSedes.map(s => {
      const sId = Number(s.id_sede ?? s.id);
      const previa = previas.find(p =>
        (sId && Number(p.id_sede ?? p.id) === sId) ||
        (p.nombre_sede && s.nombre_sede && p.nombre_sede.trim().toLowerCase() === s.nombre_sede.trim().toLowerCase())
      );
      if (!previa) return { ...s };
      return {
        ...s,
        cupos: s.cupos ?? previa.cupos,
        cupos_asignados: s.cupos_asignados ?? previa.cupos_asignados,
        jornada_manana: s.jornada_manana ?? previa.jornada_manana,
        jornada_tarde: s.jornada_tarde ?? previa.jornada_tarde,
        secciones_ids: Array.isArray(s.secciones_ids) && s.secciones_ids.length > 0
          ? s.secciones_ids
          : previa.secciones_ids,
        grados: Array.isArray(s.grados) && s.grados.length > 0
          ? s.grados
          : previa.grados,
        expandidoGrados: s.expandidoGrados ?? previa.expandidoGrados
      };
    });
  }

  actualizarSedesDeInstitucion() {
    if (!this.contrato?.institucion && !this.contrato?.id_institucion) {
      this.sedesInstitucion = [];
      return;
    }
    const previas = Array.isArray(this.sedesInstitucion) ? [...this.sedesInstitucion] : [];
    const inst = this.buscarInstitucionDelContrato();
    const cInstId = typeof this.contrato?.id_institucion === 'object'
      ? (this.contrato?.id_institucion?.id_institucion ?? this.contrato?.id_institucion?.id)
      : this.contrato?.id_institucion;
    const instId = inst?.id_institucion || inst?.id || cInstId;

    let encontradas: any[] = [];
    if (inst) {
      if (instId) {
        this.contrato.id_institucion = Number(instId);
      }
      encontradas = this.obtenerSedesDeInst(inst);
    } else if (instId) {
      encontradas = (this.sedes || []).filter(s => {
        const sInstId = typeof s.id_institucion === 'object' && s.id_institucion !== null
          ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
          : (s.id_institucion || s.institucion_id || s.institucion);
        return Number(sInstId) === Number(instId);
      });
    } else {
      const instNorm = this.normalizarTextoInstitucion(this.contrato?.institucion);
      encontradas = (this.sedes || []).filter(s => {
        const sNom = this.normalizarTextoInstitucion(s.institucion_nombre || s.nombre_institucion);
        return instNorm && sNom && (sNom === instNorm || sNom.includes(instNorm) || instNorm.includes(sNom));
      });
    }

    if (encontradas.length > 0 || previas.length === 0) {
      this.sedesInstitucion = this.fusionarEstadoSedesPrevias(encontradas, previas);
    }

    this.cargarDistribucionPersistida();

    if (instId && this.sedesInstitucion.length === 0) {
      this.siraeService.getSedes(Number(instId), true).subscribe({
        next: (datos: any) => {
          const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
          if (res.length > 0) {
            this.sedesInstitucion = res;
            this.cargarDistribucionPersistida();
            this.inicializarSedesParaDistribucion();
            if (this.modalEditarDistribucionAbierto) {
              this.inicializarSedesParaEdicion();
            }
            this.cargarHistorialLocal();
            this.cdr.detectChanges();
          }
        }
      });
    } else {
      this.inicializarSedesParaDistribucion();
      if (this.modalEditarDistribucionAbierto) {
        this.inicializarSedesParaEdicion();
      }
      this.cargarHistorialLocal();
    }
    this.cdr.detectChanges();
  }

  inicializarSedesParaDistribucion() {
    if (!this.gradosCatalogoDistribucion || this.gradosCatalogoDistribucion.length === 0) {
      this.cargarGradosParaDistribucion();
    }
    const datosLocales = this.obtenerDistribucionLocal();

    (this.sedesInstitucion || []).forEach(s => {
      const sId = Number(s.id_sede || s.id);
      const sedeLocal = datosLocales?.sedes?.find((sl: any) =>
        Number(sl.id_sede || sl.id || sl.sede) === sId ||
        (sl.nombre_sede && s.nombre_sede && sl.nombre_sede.trim().toLowerCase() === s.nombre_sede.trim().toLowerCase())
      );

      if (s.cupos_asignados === undefined || s.cupos_asignados === null) {
        s.cupos_asignados = Number(sedeLocal?.cupos_asignados ?? sedeLocal?.cupos ?? s.cupos) || 0;
      }
      if (!Array.isArray(s.grados) || s.grados.length === 0) {
        if (Array.isArray(sedeLocal?.grados) && sedeLocal.grados.length > 0) {
          s.grados = sedeLocal.grados.map((g: any) => ({
            id_grado: Number(g.id_grado || g.id),
            nombre_grado: g.nombre || g.nombre_grado || `Grado ${g.id_grado}`,
            cupos: Number(g.cuposAsignados ?? g.cupos_asignados ?? g.cupos) || 0
          }));
        } else {
          s.grados = (this.gradosCatalogoDistribucion || []).map(g => ({
            id_grado: g.id_grado,
            nombre_grado: g.nombre_grado,
            cupos: 0
          }));
        }
      }
      if (s.expandidoGrados === undefined) {
        s.expandidoGrados = false;
      }
      if (s.jornada_manana === undefined || s.jornada_manana === null) {
        if (sedeLocal?.jornada_manana !== undefined) {
          s.jornada_manana = !!sedeLocal.jornada_manana;
        } else {
          s.jornada_manana = this.jornadaManana ? !!this.jornadaManana.habilitada : false;
        }
      }
      if (s.jornada_tarde === undefined || s.jornada_tarde === null) {
        if (sedeLocal?.jornada_tarde !== undefined) {
          s.jornada_tarde = !!sedeLocal.jornada_tarde;
        } else {
          s.jornada_tarde = this.jornadaTarde ? !!this.jornadaTarde.habilitada : false;
        }
      }
      if (!Array.isArray(s.secciones_ids) || s.secciones_ids.length === 0) {
        if (Array.isArray(sedeLocal?.secciones_ids) && sedeLocal.secciones_ids.length > 0) {
          s.secciones_ids = [...sedeLocal.secciones_ids];
        } else if (!Array.isArray(s.secciones_ids)) {
          s.secciones_ids = [];
          if (s.jornada_manana) {
            const secM = this.seccionesPorNombreJornada('Mañana');
            secM.forEach(m => {
              const mId = Number(m.id_seccion || m.id);
              if (!s.secciones_ids.includes(mId)) s.secciones_ids.push(mId);
            });
          }
          if (s.jornada_tarde) {
            const secT = this.seccionesPorNombreJornada('Tarde');
            secT.forEach(m => {
              const mId = Number(m.id_seccion || m.id);
              if (!s.secciones_ids.includes(mId)) s.secciones_ids.push(mId);
            });
          }
        }
      }
    });

    this.sincronizarJornadasYMenusDesdeSedes();
  }

  get totalCuposAsignadosFormulario(): number {
    return (this.sedesInstitucion || []).reduce((acc, s) => acc + (Number(s.cupos_asignados ?? s.cupos) || 0), 0);
  }

  onCambioCuposSedeFormulario(s: any) {
    s.cupos_asignados = Math.max(0, Number(s.cupos_asignados) || 0);
    s.cupos = s.cupos_asignados;
    const totalSedes = this.totalCuposAsignadosFormulario;
    if (totalSedes > 0 && this.contrato && (!this.contrato.cupos || totalSedes > Number(this.contrato.cupos))) {
      this.contrato.cupos = totalSedes;
    }
    this.cdr.detectChanges();
  }

  toggleDesgloseGradosSede(s: any) {
    s.expandidoGrados = !s.expandidoGrados;
    if (!Array.isArray(s.grados) || s.grados.length === 0) {
      if (!this.gradosCatalogoDistribucion || this.gradosCatalogoDistribucion.length === 0) {
        this.asignarGradosPorDefecto();
      }
      s.grados = (this.gradosCatalogoDistribucion || []).map(g => ({
        id_grado: g.id_grado,
        nombre_grado: g.nombre_grado,
        cupos: 0
      }));
    }
    this.cdr.detectChanges();
  }

  onCambioCupoGradoFormulario(s: any) {
    if (Array.isArray(s.grados)) {
      const suma = s.grados.reduce((acc: number, g: any) => acc + (Number(g.cupos) || 0), 0);
      if (suma > 0) {
        s.cupos_asignados = suma;
        s.cupos = suma;
        const totalSedes = this.totalCuposAsignadosFormulario;
        if (totalSedes > 0 && this.contrato && (!this.contrato.cupos || totalSedes > Number(this.contrato.cupos))) {
          this.contrato.cupos = totalSedes;
        }
      }
    }
    this.cdr.detectChanges();
  }

  recargarSedesDeInstitucionActual(): void {
    this.siraeService.getInstituciones(true).subscribe({
      next: (datosInst: any) => {
        const resInst = Array.isArray(datosInst) ? datosInst : (datosInst?.results || datosInst?.data || []);
        if (resInst.length > 0) {
          this.instituciones = resInst;
        }
        const inst = this.buscarInstitucionDelContrato();
        const instId = inst?.id_institucion || inst?.id || this.contrato?.id_institucion;
        this.siraeService.getSedes(undefined, true).subscribe({
          next: (datosSedes: any) => {
            const resSedes = Array.isArray(datosSedes) ? datosSedes : (datosSedes?.results || datosSedes?.data || []);
            if (resSedes.length > 0) {
              this.sedes = resSedes;
            }
            this.actualizarSedesDeInstitucion();
            if (instId && this.sedesInstitucion.length === 0) {
              this.siraeService.getSedes(Number(instId), true).subscribe({
                next: (sedesPorId: any) => {
                  const resPorId = Array.isArray(sedesPorId) ? sedesPorId : (sedesPorId?.results || sedesPorId?.data || []);
                  if (resPorId.length > 0) {
                    this.sedesInstitucion = resPorId;
                    this.inicializarSedesParaDistribucion();
                    this.cdr.detectChanges();
                  }
                }
              });
            }
          }
        });
      }
    });
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
        let contratoEncontrado = listaContratos.find((c: any) =>
          String(c.id_contrato || c.id || c.pk) === String(this.contratoId)
        );

        if (!contratoEncontrado && this.contratoId) {
          const cid = String(this.contratoId).trim().toLowerCase();
          contratoEncontrado = listaContratos.find((c: any) => {
            const numCor = String(c.numero_cor || c.codigo || '').trim().toLowerCase();
            const instNom = String(c.institucion || c.nombre_institucion || c.id_institucion?.nombre_institucion || '').trim().toLowerCase();
            return numCor === cid || instNom === cid || instNom.includes(cid);
          });
        }

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
            codigo: contratoEncontrado.numero_cor || contratoEncontrado.codigo || contratoEncontrado.numero_contrato || `COR-${this.contratoId}`,
            institucion: contratoEncontrado.institucion || contratoEncontrado.institucion_nombre || contratoEncontrado.nombre_institucion || contratoEncontrado.id_institucion?.nombre_institucion || 'No especificada',
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
          this.cargarDistribucionPersistida();
          this.cargarHistorialLocal();

          if (this.modo === 'edicion') {
            this.modalEdicionAbierto = false;
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
    const cCupos = Number(this.contrato?.cupos);
    if (cCupos && cCupos > 0) return cCupos;
    const sedesCupos = this.totalCuposAsignadosSedes;
    if (sedesCupos && sedesCupos > 0) return sedesCupos;
    const formCupos = this.totalCuposAsignadosFormulario;
    if (formCupos && formCupos > 0) return formCupos;
    return 0;
  }

  get contratoTieneJornadaManana(): boolean {
    if (this.jornadaManana?.habilitada) return true;
    if ((this.sedesInstitucion || []).some(s => !!s.jornada_manana)) return true;
    if ((this.sedesInstitucion || []).some(s => Array.isArray(s.jornadas) && s.jornadas.some((j: any) => String(j).toLowerCase().includes('mañan') || String(j).toLowerCase().includes('manan')))) return true;
    const local = this.obtenerDistribucionLocal();
    if (local && Array.isArray(local.sedes) && local.sedes.some((s: any) => !!s.jornada_manana || (Array.isArray(s.jornadas) && s.jornadas.some((j: any) => String(j).toLowerCase().includes('mañan') || String(j).toLowerCase().includes('manan'))))) return true;
    return false;
  }

  get contratoTieneJornadaTarde(): boolean {
    if (this.jornadaTarde?.habilitada) return true;
    if ((this.sedesInstitucion || []).some(s => !!s.jornada_tarde)) return true;
    if ((this.sedesInstitucion || []).some(s => Array.isArray(s.jornadas) && s.jornadas.some((j: any) => String(j).toLowerCase().includes('tard')))) return true;
    const local = this.obtenerDistribucionLocal();
    if (local && Array.isArray(local.sedes) && local.sedes.some((s: any) => !!s.jornada_tarde || (Array.isArray(s.jornadas) && s.jornadas.some((j: any) => String(j).toLowerCase().includes('tard'))))) return true;
    return false;
  }

  get totalJornadasContrato(): number {
    let count = 0;
    if (this.contratoTieneJornadaManana) count++;
    if (this.contratoTieneJornadaTarde) count++;
    if (count > 0) return count;
    const hab = (this.jornadas || []).filter(j => j.habilitada).length;
    if (hab > 0) return hab;
    if (this.seccionesAsignadas.length > 0) return 1;
    return 0;
  }

  obtenerNombresSeccionesDeSede(s: any): { id: number; nombre: string; jornada?: string }[] {
    if (!s) return [];
    const catalogo = (this.todasSeccionesDisponibles && this.todasSeccionesDisponibles.length > 0)
      ? this.todasSeccionesDisponibles
      : (this.seccionesMenu || []);
    const secIds = Array.isArray(s.secciones_ids) ? s.secciones_ids : [];

    if (secIds.length > 0) {
      return secIds.map((idSec: any) => {
        const match = catalogo.find(
          (sec: any) => Number(sec.id_seccion || sec.id) === Number(idSec)
        );
        return {
          id: Number(idSec),
          nombre: match ? (match.nombre_seccion || match.nombre) : `Menú #${idSec}`,
          jornada: match ? (match.nombre_jornada || match.jornada_nombre || match.jornada || '') : ''
        };
      });
    }

    const res: { id: number; nombre: string; jornada?: string }[] = [];
    if (this.contratosSeccionMenu && this.contratosSeccionMenu.length > 0) {
      this.contratosSeccionMenu.forEach(csm => {
        const secId = csm.id_seccion?.id_seccion || csm.id_seccion;
        const sec = catalogo.find(
          (x: any) => Number(x.id_seccion || x.id) === Number(secId)
        );
        if (sec) {
          const jNom = (sec.nombre_jornada || sec.jornada_nombre || sec.jornada || '').toString().toLowerCase();
          const matchesManana = s.jornada_manana && jNom.includes('mañan');
          const matchesTarde = s.jornada_tarde && jNom.includes('tard');
          if (matchesManana || matchesTarde || (!s.jornada_manana && !s.jornada_tarde)) {
            if (!res.some(r => r.id === Number(secId))) {
              res.push({
                id: Number(secId),
                nombre: sec.nombre_seccion || sec.nombre,
                jornada: sec.nombre_jornada || sec.jornada_nombre || sec.jornada || ''
              });
            }
          }
        }
      });
    }
    return res;
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
    const jNom = (jornada.nombre_jornada || jornada.nombre || '').toString().toLowerCase();
    const esManana = jNom.includes('mañana');
    const esTarde = jNom.includes('tarde');

    // Si se deshabilita la jornada, quitamos las secciones correspondientes del contrato y de las sedes
    if (!jornada.habilitada) {
      const tipo = esManana ? 'Mañana' : 'Tarde';
      const seccionesAfectadas = this.seccionesPorNombreJornada(tipo);

      seccionesAfectadas.forEach(seccion => {
        const secId = Number(seccion.id_seccion || seccion.id);
        this.seccionesSeleccionadasIds.delete(secId);
        this.contratosSeccionMenu = this.contratosSeccionMenu.filter(rel => {
          const relSecId = typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion;
          return Number(relSecId) !== Number(secId);
        });
      });

      // Desactivar en cada sede esa jornada y limpiar sus secciones asociadas
      (this.sedesInstitucion || []).forEach(sede => {
        if (esManana) {
          sede.jornada_manana = false;
        }
        if (esTarde) {
          sede.jornada_tarde = false;
        }
        if (Array.isArray(sede.secciones_ids)) {
          const idsAfectados = seccionesAfectadas.map(s => Number(s.id_seccion || s.id));
          sede.secciones_ids = sede.secciones_ids.filter((id: number) => !idsAfectados.includes(id));
        }
      });
    } else {
      // Si se habilita la jornada en el contrato, activarla en las sedes por defecto si no tenían ninguna
      (this.sedesInstitucion || []).forEach(sede => {
        if (esManana && (sede.jornada_manana === undefined || sede.jornada_manana === null)) {
          sede.jornada_manana = true;
        }
        if (esTarde && (sede.jornada_tarde === undefined || sede.jornada_tarde === null)) {
          sede.jornada_tarde = true;
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

    const infoDuplicado = this.institucionTieneContrato({
      id_institucion: idInst,
      nombre_institucion: this.contrato.institucion
    });
    if (infoDuplicado.tieneContrato) {
      const codExistente = infoDuplicado.contratoExistente?.numero_cor || infoDuplicado.contratoExistente?.codigo || '';
      void this.sweetAlert.warning(
        'Institución con contrato existente',
        `Esta institución ya tiene el contrato ${codExistente} registrado. Solo se permite un contrato por institución; las sedes se gestionan dentro de ese contrato.`
      );
      return;
    }

    const cuposAnteriores = Number(this.contrato.cupos) || 0;
    const cuposCalculados = Number(this.contrato.cupos) > 0
      ? Math.max(Number(this.contrato.cupos), this.totalCuposAsignadosFormulario)
      : (this.totalCuposAsignadosFormulario > 0 ? this.totalCuposAsignadosFormulario : (this.totalCuposAsignadosSedes || 0));

    this.contrato.cupos = cuposCalculados;

    const payload: any = {
      numero_cor: this.contrato.codigo.trim(),
      institucion: this.contrato.institucion,
      zona: this.contrato.zona || 'Norte',
      fecha_inicio: this.contrato.fecha_inicio,
      fecha_fin: this.contrato.fecha_fin || '2026-12-31',
      estado: this.contrato.estado || 'Activo',
      cupos: cuposCalculados
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

          // Persistir distribución de cupos asignados a sedes y grados si se ingresaron
          if (newId && this.sedesInstitucion && this.sedesInstitucion.length > 0) {
            const distribucionPayload = {
              id_contrato: Number(newId),
              codigo_contrato: payload.numero_cor,
              id_institucion: payload.id_institucion,
              total_autorizado: payload.cupos,
              total_distribuido: this.totalCuposAsignadosFormulario,
              pendientes: Math.max(0, payload.cupos - this.totalCuposAsignadosFormulario),
              fecha_actualizacion: new Date().toISOString(),
              sedes: this.sedesInstitucion.map((s: any) => ({
                id_sede: Number(s.id_sede || s.id),
                nombre_sede: s.nombre_sede,
                cuposAsignados: Number(s.cupos_asignados ?? s.cupos) || 0,
                cupos_asignados: Number(s.cupos_asignados ?? s.cupos) || 0,
                cupos: Number(s.cupos_asignados ?? s.cupos) || 0,
                jornada_manana: !!s.jornada_manana,
                jornada_tarde: !!s.jornada_tarde,
                jornadas: [
                  ...(s.jornada_manana ? ['Mañana'] : []),
                  ...(s.jornada_tarde ? ['Tarde'] : [])
                ],
                secciones_ids: Array.isArray(s.secciones_ids) ? s.secciones_ids : [],
                grados: Array.isArray(s.grados) ? s.grados.map((g: any) => ({
                  id_grado: Number(g.id_grado || g.id),
                  nombre_grado: g.nombre_grado,
                  cuposAsignados: Number(g.cupos) || 0,
                  cupos_asignados: Number(g.cupos) || 0,
                  cupos: Number(g.cupos) || 0
                })) : []
              }))
            };

            try {
              localStorage.setItem(`sirae_distribucion_contrato_${newId}`, JSON.stringify(distribucionPayload));
              const keys = this.obtenerClavesContrato('sirae_distribucion_contrato_');
              keys.forEach(k => localStorage.setItem(k, JSON.stringify(distribucionPayload)));
            } catch (_) {}

            const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
            let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
            if (token) headers = headers.set('Authorization', `Bearer ${token}`);

            this.http.put(`${environment.apiUrl}/contratos/${newId}/distribucion/`, distribucionPayload, { headers }).subscribe({
              next: () => {},
              error: () => {
                this.http.post(`${environment.apiUrl}/distribucion-cupos/`, distribucionPayload, { headers }).subscribe({
                  next: () => {},
                  error: () => {}
                });
              }
            });
          }

          // Historial de creación
          const ahoraFmt = new Date().toLocaleString('es-CO');
          this.historialModificaciones = [
            {
              id_modificacion: Date.now(),
              tipo: 'MODIFICACION',
              usuario_responsable: this.nombreUsuarioResponsableActual,
              fecha_registro: ahoraFmt,
              cambios: [
                {
                  campo: 'Creación de contrato',
                  anterior: 'Sin registro',
                  nuevo: `${payload.institucion} (${cuposCalculados} cupos autorizados)`
                }
              ],
              estado_resultante: payload.estado
            }
          ];
          this.guardarHistorialLocal();

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
            } else if (err.error.id_institucion) {
              mensaje = Array.isArray(err.error.id_institucion) ? err.error.id_institucion.join(', ') : String(err.error.id_institucion);
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
          // Asignar las secciones/menús en backend si están seleccionadas
          if (this.contratosSeccionMenu.length > 0 && this.contratoId) {
            const promesas = this.contratosSeccionMenu.map(rel => {
              const secId = typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion;
              return new Promise((resolve) => {
                this.siraeService.crearContratoSeccionMenu({
                  id_contrato: Number(this.contratoId),
                  id_seccion: Number(secId),
                  estado: 'Activo',
                  valor: 0
                }).subscribe({
                  next: () => resolve(true),
                  error: () => resolve(false)
                });
              });
            });
            try {
              await Promise.all(promesas);
            } catch (_) {}
          }

          // Persistir distribución de sedes y grados en edición si están presentes
          if (this.contratoId && this.sedesInstitucion && this.sedesInstitucion.length > 0) {
            const distribucionPayload = {
              id_contrato: Number(this.contratoId),
              codigo_contrato: payload.numero_cor || this.contrato?.codigo,
              id_institucion: payload.id_institucion,
              total_autorizado: payload.cupos,
              total_distribuido: this.totalCuposAsignadosFormulario,
              pendientes: Math.max(0, payload.cupos - this.totalCuposAsignadosFormulario),
              fecha_actualizacion: new Date().toISOString(),
              sedes: this.sedesInstitucion.map((s: any) => ({
                id_sede: Number(s.id_sede || s.id),
                nombre_sede: s.nombre_sede,
                cuposAsignados: Number(s.cupos_asignados ?? s.cupos) || 0,
                cupos_asignados: Number(s.cupos_asignados ?? s.cupos) || 0,
                cupos: Number(s.cupos_asignados ?? s.cupos) || 0,
                jornada_manana: !!s.jornada_manana,
                jornada_tarde: !!s.jornada_tarde,
                jornadas: [
                  ...(s.jornada_manana ? ['Mañana'] : []),
                  ...(s.jornada_tarde ? ['Tarde'] : [])
                ],
                secciones_ids: Array.isArray(s.secciones_ids) ? s.secciones_ids : [],
                grados: Array.isArray(s.grados) ? s.grados.map((g: any) => ({
                  id_grado: Number(g.id_grado || g.id),
                  nombre_grado: g.nombre_grado,
                  cuposAsignados: Number(g.cupos) || 0,
                  cupos_asignados: Number(g.cupos) || 0,
                  cupos: Number(g.cupos) || 0
                })) : []
              }))
            };

            try {
              localStorage.setItem(`sirae_distribucion_contrato_${this.contratoId}`, JSON.stringify(distribucionPayload));
              const keys = this.obtenerClavesContrato('sirae_distribucion_contrato_');
              keys.forEach(k => localStorage.setItem(k, JSON.stringify(distribucionPayload)));
            } catch (_) {}

            this.sincronizarJornadasYMenusDesdeSedes();

            const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
            let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
            if (token) headers = headers.set('Authorization', `Bearer ${token}`);

            this.http.put(`${environment.apiUrl}/contratos/${this.contratoId}/distribucion/`, distribucionPayload, { headers }).subscribe({
              next: () => {},
              error: () => {
                this.http.post(`${environment.apiUrl}/distribucion-cupos/`, distribucionPayload, { headers }).subscribe({
                  next: () => {},
                  error: () => {}
                });
              }
            });
          }

          // Historial de modificación
          const ahoraFmt = new Date().toLocaleString('es-CO');
          const registroAudit = {
            id_modificacion: Date.now(),
            tipo: 'MODIFICACION',
            usuario_responsable: this.nombreUsuarioResponsableActual,
            fecha_registro: ahoraFmt,
            cambios: [
              {
                campo: 'Cupos autorizados y configuración de sedes',
                anterior: `${cuposAnteriores} cupos`,
                nuevo: `${cuposCalculados} cupos`
              }
            ],
            estado_resultante: payload.estado
          };
          this.historialModificaciones.unshift(registroAudit);
          this.guardarHistorialLocal();

          const contratoActualizado = {
            id: Number(this.contratoId),
            codigo: payload.numero_cor || this.contrato?.codigo,
            institucion: payload.institucion,
            cupos: payload.cupos,
            zona: payload.zona,
            fechaInicio: payload.fecha_inicio,
            fechaFin: payload.fecha_fin,
            estado: payload.estado,
            supervisor: this.nombreSupervisorAsignado
          };

          await this.sweetAlert.success(
            '¡Contrato actualizado!',
            'Los cambios del contrato y su distribución han sido guardados exitosamente.'
          );
          this.cerrar.emit(contratoActualizado);
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