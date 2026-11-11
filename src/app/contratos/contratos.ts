import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SiraeService } from '../services/contratos_pae.service';
import { ContratoDetalleComponent } from '../contrato-detalle/contrato-detalle';
import { CustomSelectComponent } from '../shared/custom-select/custom-select';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  selector: 'app-gestion-contratos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ContratoDetalleComponent, CustomSelectComponent],
  templateUrl: './contratos.html',
  styleUrls: ['./contratos.css']
})
export class ContratosComponent implements OnInit {

  constructor(
    private router: Router,
    private siraeService: SiraeService,
    private cdr: ChangeDetectorRef, // <--- Inyectado para forzar renderizado inmediato
    private sweetAlert: SweetAlertService
  ) { }

  ngOnInit() {
    this.cargarContratos();
    this.cargarDatosMaestros();
    this.cargarInstitucionesYSedes();
  }

  cargarInstitucionesYSedes() {
    this.siraeService.getInstituciones().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.instituciones = res;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar instituciones en contratos:', err)
    });

    this.siraeService.getSedes().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.sedes = res;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar sedes en contratos:', err)
    });
  }

  cargandoContratos = false;
  errorCargaContratos = '';
  modoModalDetalle: 'nuevo' | 'consulta' | 'edicion' = 'consulta';
  filtroEstadoVigencia: 'TODOS' | 'ACTIVO' | 'PROXIMO_VENCER' | 'FINALIZADO' | 'INACTIVO' = 'TODOS';

  /**
   * Evalúa la vigencia de un contrato según su fecha de finalización y el día actual.
   * Reglas de vigencia:
   * - Si fecha_fin < hoy: el estado pasa automáticamente a 'Finalizado'.
   * - Si fecha_fin >= hoy y faltan <= 30 días: genera alerta de 'Próximo a vencer'.
   * - Si fecha_fin >= hoy y faltan > 30 días: contrato 'Activo' (Vigente).
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
      mensajeVigencia: `Vigente (${diasRestantes} días)`,
      alertaNivel: 'normal'
    };
  }

  cargarContratos() {
    this.cargandoContratos = true;
    this.errorCargaContratos = '';
    this.siraeService.getContratos().subscribe({
      next: (data: any) => {
        // Soporta array directo o respuesta paginada con .results
        const lista = Array.isArray(data) ? data : (data.results || data.data || []);

        this.contratos = lista.map((c: any) => {
          const fechaFinStr = c.fecha_fin || c.fin || '';
          const vigencia = this.evaluarVigencia(fechaFinStr, c.estado);

          // Si el contrato en BD figuraba como Activo pero ya se cumplió su fecha fin, actualizar estado a Finalizado
          if (c.estado !== 'Finalizado' && vigencia.estado === 'Finalizado' && (c.id_contrato || c.id)) {
            const idContratoNum = Number(c.id_contrato || c.id);
            this.siraeService.actualizarContrato(idContratoNum, { ...c, estado: 'Finalizado' }).subscribe({
              next: () => {},
              error: () => {}
            });
          }

          return {
            id: c.id_contrato || c.id,
            codigo: c.numero_cor || c.codigo,
            institucion: c.institucion || c.institucion_nombre || 'Sin institución',
            fechaInicio: c.fecha_inicio || c.inicio,
            fechaFin: fechaFinStr,
            estado: vigencia.estado,
            estadoOriginal: c.estado || 'Activo',
            esProximoAVencer: vigencia.esProximoAVencer,
            diasRestantes: vigencia.diasRestantes,
            mensajeVigencia: vigencia.mensajeVigencia,
            alertaNivel: vigencia.alertaNivel,
            zona: c.zona,
            cupos: c.cupos || 0,
            supervisor: c.supervisor_nombre || (c.id_usuario_supervisor ? `Supervisor #${c.id_usuario_supervisor}` : 'Sin asignar'),
            expandido: false
          };
        });

        this.cargandoContratos = false;
        this.cdr.detectChanges(); // <--- Fuerza a Angular a pintar la tabla al instante
      },
      error: (error) => {
        console.error('Error al cargar contratos desde la API', error);
        this.cargandoContratos = false;
        this.errorCargaContratos = 'No se pudo cargar la información de los contratos. Verifica tu conexión e intenta nuevamente.';
        this.cdr.detectChanges();
      }
    });
  }

  cargarDatosMaestros() {
    this.siraeService.getJornadas().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.jornadas = res.map((j: any) => ({
          id: j.id_jornada || j.id,
          nombre: j.nombre_jornada || j.nombre,
          estado: 'Activa'
        }));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Usando jornadas de prueba temporalmente', err);
        this.cdr.detectChanges();
      }
    });

    this.siraeService.getSeccionesMenu().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.secciones = res.map((s: any) => ({
          id: s.id_seccion || s.id,
          nombre: s.nombre_seccion || s.nombre,
          jornada: s.jornada,
          estado: 'Activa'
        }));
        this.cdr.detectChanges();
      },
      error: (err) => console.warn('Usando secciones de prueba temporalmente', err)
    });
  }

  pestanaActiva = 'contratos';

  filtroBusquedaContratos = '';
  filtroBusquedaJornadas = '';
  filtroBusquedaSecciones = '';
  filtroBusquedaTurnos = '';

  modalContratoAbierto = false;
  modoEdicionContrato = false;

  modalJornadaAbierto = false;
  modoEdicionJornada = false;

  modalSeccionAbierto = false;
  modoEdicionSeccion = false;

  modalTurnoAbierto = false;
  modoEdicionTurno = false;

  modalGrandeAbierto = false;
  contratoIdSeleccionado: string | null = null;
  pestanaModalInicial: string = 'resumen';

  get primerContratoProximo(): any {
    return this.contratos.find(c => c.esProximoAVencer) || null;
  }

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

  contratoActual: any = {
    id: null,
    codigo: '',
    institucion: '',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    estado: 'Activo',
    zona: ''
  };

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
    const actual = this.contratoActual?.zona;
    if (actual && !this.zonasDisponibles.includes(actual)) {
      return [actual, ...this.zonasDisponibles];
    }
    return this.zonasDisponibles;
  }

  jornadaActual: any = {
    id: null,
    nombre: '',
    estado: 'Activa'
  };

  seccionActual: any = {
    id: null,
    nombre: '',
    jornada: '',
    estado: 'Activa'
  };

  turnoActual: any = {
    id: null,
    nombre: '',
    horaInicio: '',
    horaFin: ''
  };

  contratos: any[] = [];
  jornadas: any[] = [];
  secciones: any[] = [];
  turnos: any[] = [];
  instituciones: any[] = [];
  sedes: any[] = [];

  // ===== PAGINACIÓN =====
  paginaActual = 1;
  itemsPorPagina = 10;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.contratosFiltrados.length / this.itemsPorPagina));
  }

  get contratosPaginados(): any[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.contratosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  get inicioRango(): number {
    if (this.contratosFiltrados.length === 0) return 0;
    return (this.paginaActual - 1) * this.itemsPorPagina + 1;
  }

  get finRango(): number {
    const fin = this.paginaActual * this.itemsPorPagina;
    return Math.min(fin, this.contratosFiltrados.length);
  }

  paginaAnterior() {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.cdr.detectChanges();
    }
  }

  paginaSiguiente() {
    if (this.paginaActual < this.totalPaginas) {
      this.paginaActual++;
      this.cdr.detectChanges();
    }
  }

  irAPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
      this.cdr.detectChanges();
    }
  }

  get paginasVisibles(): number[] {
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    const paginas: number[] = [];
    const rango = 2; // mostrar 2 páginas a cada lado de la actual
    let inicio = Math.max(1, actual - rango);
    let fin = Math.min(total, actual + rango);
    // Asegurar al menos 5 páginas si hay suficientes
    if (fin - inicio < 4 && total >= 5) {
      if (inicio === 1) fin = Math.min(total, 5);
      else if (fin === total) inicio = Math.max(1, total - 4);
    }
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    return paginas;
  }
  sedesDeInstitucionSeleccionada: any[] = [];

  onInstitucionContratoChange() {
    if (!this.contratoActual.institucion) {
      this.sedesDeInstitucionSeleccionada = [];
      return;
    }
    const inst = this.instituciones.find(i =>
      i.nombre_institucion === this.contratoActual.institucion ||
      String(i.id_institucion) === String(this.contratoActual.institucion)
    );
    if (inst) {
      this.contratoActual.institucion = inst.nombre_institucion;
      const instId = inst.id_institucion || inst.id;
      this.sedesDeInstitucionSeleccionada = this.sedes.filter(s => {
        const sInstId = typeof s.id_institucion === 'object' && s.id_institucion !== null
          ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
          : s.id_institucion;
        return Number(sInstId) === Number(instId);
      });
    } else {
      this.sedesDeInstitucionSeleccionada = [];
    }
    this.cdr.detectChanges();
  }

  modalSeleccionarInstitucionAbierto = false;
  busquedaInstitucionModal = '';
  mostrarSedesEnModalContrato = false;
  institucionTemporalSeleccionada: any = null;

  abrirModalSeleccionarInstitucion() {
    this.busquedaInstitucionModal = '';
    this.institucionTemporalSeleccionada = this.instituciones.find(i =>
      i.nombre_institucion?.toLowerCase() === this.contratoActual.institucion?.toLowerCase()
    ) || null;
    this.modalSeleccionarInstitucionAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalSeleccionarInstitucion() {
    this.modalSeleccionarInstitucionAbierto = false;
    this.cdr.detectChanges();
  }

  marcarInstitucion(inst: any) {
    this.institucionTemporalSeleccionada = inst;
    this.cdr.detectChanges();
  }

  seleccionarInstitucionDesdeModal(inst: any) {
    this.institucionTemporalSeleccionada = inst;
    this.contratoActual.institucion = inst.nombre_institucion;
    this.onInstitucionContratoChange();
    this.cerrarModalSeleccionarInstitucion();
  }

  confirmarSeleccionInstitucion() {
    if (this.institucionTemporalSeleccionada) {
      this.contratoActual.institucion = this.institucionTemporalSeleccionada.nombre_institucion;
      this.onInstitucionContratoChange();
    }
    this.cerrarModalSeleccionarInstitucion();
  }

  deseleccionarInstitucion(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.contratoActual.institucion = '';
    this.institucionTemporalSeleccionada = null;
    this.onInstitucionContratoChange();
    this.cdr.detectChanges();
  }

  get institucionesFiltradasModal(): any[] {
    const q = this.busquedaInstitucionModal.trim().toLowerCase();
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

  toggleMostrarSedesModal() {
    this.mostrarSedesEnModalContrato = !this.mostrarSedesEnModalContrato;
    this.cdr.detectChanges();
  }

  obtenerSedesDeInstitucion(nombreInstitucion: string): any[] {
    if (!nombreInstitucion) return [];
    const inst = this.instituciones.find(i =>
      i.nombre_institucion?.toLowerCase() === nombreInstitucion.toLowerCase()
    );
    if (!inst) return [];
    const instId = inst.id_institucion || inst.id;
    return this.sedes.filter(s => {
      const sInstId = typeof s.id_institucion === 'object' && s.id_institucion !== null
        ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
        : s.id_institucion;
      return Number(sInstId) === Number(instId);
    });
  }

  get totalContratosActivos(): number {
    return this.contratos.filter(c => c.estado === 'Activo' && !c.esProximoAVencer).length;
  }

  get totalContratosProximosVencer(): number {
    return this.contratos.filter(c => c.esProximoAVencer).length;
  }

  get contratosProximosAVencer(): any[] {
    return this.contratos.filter(c => c.esProximoAVencer);
  }

  get totalContratosFinalizados(): number {
    return this.contratos.filter(c => c.estado === 'Finalizado').length;
  }

  get totalContratosInactivos(): number {
    return this.contratos.filter(c => c.estado === 'Inactivo').length;
  }

  cambiarFiltroVigencia(filtro: 'TODOS' | 'ACTIVO' | 'PROXIMO_VENCER' | 'FINALIZADO' | 'INACTIVO') {
    this.filtroEstadoVigencia = filtro;
    this.paginaActual = 1; // Resetear paginación al cambiar filtro
    this.cdr.detectChanges();
  }

  get contratosFiltrados() {
    const filtro = (this.filtroBusquedaContratos || "").trim().toLowerCase();

    return this.contratos.filter(c => {
      // 1. Filtro por vigencia y estado
      if (this.filtroEstadoVigencia === 'ACTIVO' && (c.estado !== 'Activo' || c.esProximoAVencer)) {
        return false;
      }
      if (this.filtroEstadoVigencia === 'PROXIMO_VENCER' && !c.esProximoAVencer) {
        return false;
      }
      if (this.filtroEstadoVigencia === 'FINALIZADO' && c.estado !== 'Finalizado') {
        return false;
      }
      if (this.filtroEstadoVigencia === 'INACTIVO' && c.estado !== 'Inactivo') {
        return false;
      }

      // 2. Filtro por búsqueda de texto
      if (!filtro) return true;
      return (c.codigo && c.codigo.toLowerCase().includes(filtro)) ||
             (c.institucion && c.institucion.toLowerCase().includes(filtro)) ||
             (c.supervisor && c.supervisor.toLowerCase().includes(filtro));
    });
  }

  limpiarBusquedaContratos() {
    this.filtroBusquedaContratos = '';
    this.filtroEstadoVigencia = 'TODOS';
    this.paginaActual = 1; // Resetear paginación al limpiar búsqueda
    this.cdr.detectChanges();
  }

  private _lastJornadasFiltro = "";
  private _lastJornadasLen = -1;
  private _jornadasCache: any[] = [];

  get jornadasFiltradas() {
    const filtro = (this.filtroBusquedaJornadas || "").toLowerCase();
    if (filtro === this._lastJornadasFiltro && this.jornadas.length === this._lastJornadasLen) {
      return this._jornadasCache;
    }
    this._lastJornadasFiltro = filtro;
    this._lastJornadasLen = this.jornadas.length;
    this._jornadasCache = !filtro ? this.jornadas : this.jornadas.filter(j => j.nombre && j.nombre.toLowerCase().includes(filtro));
    return this._jornadasCache;
  }

  private _lastSeccionesFiltro = "";
  private _lastSeccionesLen = -1;
  private _seccionesCache: any[] = [];

  get seccionesFiltradas() {
    const filtro = (this.filtroBusquedaSecciones || "").toLowerCase();
    if (filtro === this._lastSeccionesFiltro && this.secciones.length === this._lastSeccionesLen) {
      return this._seccionesCache;
    }
    this._lastSeccionesFiltro = filtro;
    this._lastSeccionesLen = this.secciones.length;
    this._seccionesCache = !filtro ? this.secciones : this.secciones.filter(s =>
      (s.nombre && s.nombre.toLowerCase().includes(filtro)) ||
      (s.jornada && String(s.jornada).toLowerCase().includes(filtro))
    );
    return this._seccionesCache;
  }

  private _lastTurnosFiltro = "";
  private _lastTurnosLen = -1;
  private _turnosCache: any[] = [];

  get turnosFiltrados() {
    const filtro = (this.filtroBusquedaTurnos || "").toLowerCase();
    if (filtro === this._lastTurnosFiltro && this.turnos.length === this._lastTurnosLen) {
      return this._turnosCache;
    }
    this._lastTurnosFiltro = filtro;
    this._lastTurnosLen = this.turnos.length;
    this._turnosCache = !filtro ? this.turnos : this.turnos.filter(t =>
      (t.nombre && t.nombre.toLowerCase().includes(filtro)) ||
      (t.horaInicio && t.horaInicio.includes(filtro)) ||
      (t.horaFin && t.horaFin.includes(filtro))
    );
    return this._turnosCache;
  }

  trackPorId(index: number, item: any): any {
    return item?.id || item?.codigo || index;
  }

  seleccionarPestana(pestana: string) {
    this.pestanaActiva = pestana;
    this.cdr.detectChanges();
  }

  toggleExpandir(contrato: any) {
    contrato.expandido = !contrato.expandido;
  }

  // CONTRATOS

  abrirModalGrandeContrato(id: string | number, modo: 'nuevo' | 'consulta' | 'edicion' = 'consulta', pestanaInicial: string = 'resumen') {
    this.contratoIdSeleccionado = String(id);
    this.modoModalDetalle = id === 'nuevo' ? 'nuevo' : modo;
    this.pestanaModalInicial = pestanaInicial;
    this.modalGrandeAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalGrandeContrato(nuevoContrato?: any) {
    this.modalGrandeAbierto = false;
    this.contratoIdSeleccionado = null;
    if (nuevoContrato && nuevoContrato.id) {
      const index = this.contratos.findIndex(c => c.id === nuevoContrato.id);
      if (index === -1) {
        this.contratos.unshift(nuevoContrato);
      }
    }
    this.cargarContratos();
    this.cdr.detectChanges();
  }

  configurarContrato(contratoId: number) {
    this.router.navigate(['/contratos', contratoId, 'detalle']);
  }

  abrirModalContrato(contrato?: any) {
    if (contrato) {
      this.modoEdicionContrato = true;
      this.contratoActual = { ...contrato };
    } else {
      this.modoEdicionContrato = false;
      this.contratoActual = {
        id: null,
        codigo: 'COR-2026-00' + (this.contratos.length + 1),
        institucion: '',
        zona: '',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        estado: 'Activo',
        expandido: false
      };
    }
    this.onInstitucionContratoChange();
    this.modalContratoAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalContrato() {
    this.modalContratoAbierto = false;
    this.cdr.detectChanges();
  }

  guardarContrato() {
    if (!this.contratoActual.institucion) {
      void this.sweetAlert.warning(
        'Institución requerida',
        'Por favor, ingresa el nombre de la institución.'
      );
      return;
    }

    const payload = {
      numero_cor: this.contratoActual.codigo,
      institucion: this.contratoActual.institucion,
      zona: this.contratoActual.zona,
      fecha_inicio: this.contratoActual.fechaInicio,
      fecha_fin: this.contratoActual.fechaFin,
      estado: this.contratoActual.estado
    };

    if (this.modoEdicionContrato) {
      this.siraeService.actualizarContrato(this.contratoActual.id, payload).subscribe({
        next: () => {
          void this.sweetAlert.success('¡Contrato actualizado!', 'Los cambios han sido guardados.');
          this.cargarContratos();
          this.cerrarModalContrato();
        },
        error: (err) => {
          console.error('Error al actualizar contrato', err);
          void this.sweetAlert.error('Error', 'No se pudo actualizar el contrato.');
        }
      });
    } else {
      this.siraeService.crearContrato(payload).subscribe({
        next: () => {
          void this.sweetAlert.success('¡Contrato registrado!', 'El contrato ha sido guardado exitosamente.');
          this.cargarContratos();
          this.cerrarModalContrato();
        },
        error: (err) => {
          console.error('Error al crear contrato', err);
          void this.sweetAlert.error('Error', 'No se pudo crear el contrato.');
        }
      });
    }
  }

  toggleEstadoContrato(c: any) {
    const nuevoEstado = c.estado === 'Activo' ? 'Inactivo' : 'Activo';
    const payload = {
      numero_cor: c.codigo,
      institucion: c.institucion,
      zona: c.zona,
      fecha_inicio: c.fechaInicio,
      fecha_fin: c.fechaFin,
      estado: nuevoEstado
    };

    this.siraeService.actualizarContrato(c.id, payload).subscribe({
      next: () => {
        c.estado = nuevoEstado;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cambiar estado del contrato', err);
        void this.sweetAlert.error('Error al actualizar', 'No se pudo actualizar el estado del contrato.');
      }
    });
  }

  async eliminarContrato(id: number) {
    const confirmacion = await this.sweetAlert.confirm(
      '¿Eliminar contrato?',
      'Esta acción eliminará el contrato de forma permanente.',
      'Sí, eliminar'
    );
    if (confirmacion.isConfirmed) {
      this.siraeService.eliminarContrato(id).subscribe({
        next: () => {
          void this.sweetAlert.success('Contrato eliminado', 'El contrato fue eliminado correctamente.');
          this.cargarContratos();
        },
        error: (err) => {
          console.error('Error al eliminar contrato', err);
          void this.sweetAlert.error('Error al eliminar', 'No se pudo eliminar el contrato.');
        }
      });
    }
  }

  // JORNADAS

  abrirModalJornada(jornada?: any) {
    if (jornada) {
      this.modoEdicionJornada = true;
      this.jornadaActual = { ...jornada };
    } else {
      this.modoEdicionJornada = false;
      this.jornadaActual = {
        id: Date.now(),
        nombre: '',
        estado: 'Activa'
      };
    }
    this.modalJornadaAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalJornada() {
    this.modalJornadaAbierto = false;
    this.cdr.detectChanges();
  }

  guardarJornada() {
    if (!this.jornadaActual.nombre) {
      void this.sweetAlert.warning('Nombre requerido', 'Por favor, ingresa el nombre de la jornada.');
      return;
    }

    const payload = { nombre_jornada: this.jornadaActual.nombre };

    if (this.modoEdicionJornada) {
      this.siraeService.actualizarJornada(this.jornadaActual.id, payload).subscribe({
        next: () => {
          void this.sweetAlert.success('¡Jornada actualizada!', 'Los cambios han sido guardados.');
          this.cargarDatosMaestros();
          this.cerrarModalJornada();
        },
        error: (err) => {
          console.error('Error al actualizar jornada', err);
          void this.sweetAlert.error('Error', 'No se pudo actualizar la jornada.');
        }
      });
    } else {
      this.siraeService.crearJornada(payload).subscribe({
        next: () => {
          void this.sweetAlert.success('¡Jornada creada!', 'La jornada ha sido guardada exitosamente.');
          this.cargarDatosMaestros();
          this.cerrarModalJornada();
        },
        error: (err) => {
          console.error('Error al crear jornada', err);
          void this.sweetAlert.error('Error', 'No se pudo crear la jornada.');
        }
      });
    }
  }

  async eliminarJornada(id: number) {
    const confirmacion = await this.sweetAlert.confirm('¿Eliminar jornada?', 'Esta acción no se puede deshacer.', 'Sí, eliminar');
    if (confirmacion.isConfirmed) {
      this.siraeService.eliminarJornada(id).subscribe({
        next: () => {
          void this.sweetAlert.success('Jornada eliminada', 'El registro fue eliminado.');
          this.cargarDatosMaestros();
        },
        error: (err) => {
          console.error('Error al eliminar jornada', err);
          void this.sweetAlert.error('Error', 'No se pudo eliminar la jornada.');
        }
      });
    }
  }

  // SECCIONES

  abrirModalSeccion(seccion?: any) {
    if (seccion) {
      this.modoEdicionSeccion = true;
      this.seccionActual = { ...seccion };
    } else {
      this.modoEdicionSeccion = false;
      this.seccionActual = {
        id: Date.now(),
        nombre: '',
        jornada: this.jornadas.length ? this.jornadas[0].nombre : '',
        estado: 'Activa'
      };
    }
    this.modalSeccionAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalSeccion() {
    this.modalSeccionAbierto = false;
    this.cdr.detectChanges();
  }

  guardarSeccion() {
    if (!this.seccionActual.nombre || !this.seccionActual.jornada) {
      void this.sweetAlert.warning('Campos incompletos', 'Por favor, ingresa el nombre de la sección y selecciona la jornada.');
      return;
    }

    const payload = {
      nombre_seccion: this.seccionActual.nombre,
      jornada: this.seccionActual.jornada
    };

    if (this.modoEdicionSeccion) {
      this.siraeService.actualizarSeccionMenu(this.seccionActual.id, payload).subscribe({
        next: () => {
          void this.sweetAlert.success('¡Sección actualizada!', 'Los cambios han sido guardados.');
          this.cargarDatosMaestros();
          this.cerrarModalSeccion();
        },
        error: (err) => {
          console.error('Error al actualizar sección', err);
          void this.sweetAlert.error('Error', 'No se pudo actualizar la sección.');
        }
      });
    } else {
      this.siraeService.crearSeccionMenu(payload).subscribe({
        next: () => {
          void this.sweetAlert.success('¡Sección creada!', 'La sección ha sido guardada exitosamente.');
          this.cargarDatosMaestros();
          this.cerrarModalSeccion();
        },
        error: (err) => {
          console.error('Error al crear sección', err);
          void this.sweetAlert.error('Error', 'No se pudo crear la sección.');
        }
      });
    }
  }

  async eliminarSeccion(id: number) {
    const confirmacion = await this.sweetAlert.confirm('¿Eliminar sección?', 'Esta acción no se puede deshacer.', 'Sí, eliminar');
    if (confirmacion.isConfirmed) {
      this.siraeService.eliminarSeccionMenu(id).subscribe({
        next: () => {
          void this.sweetAlert.success('Sección eliminada', 'El registro fue eliminado.');
          this.cargarDatosMaestros();
        },
        error: (err) => {
          console.error('Error al eliminar sección', err);
          void this.sweetAlert.error('Error', 'No se pudo eliminar la sección.');
        }
      });
    }
  }
}