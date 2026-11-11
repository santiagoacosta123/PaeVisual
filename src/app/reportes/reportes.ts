import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, take, timeout } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, InstitucionAsignada, SedeActiva } from '@core/auth';
import { SweetAlertService } from '../sweet-alert.service';
import { Entrega, EntregasService } from '../features/entregas/services/entregas.service';
import { SiraeService } from '../features/contratos/services/contratos_pae.service';
import {
  AlcanceReportes,
  MetadatosPlantillas,
  PlanillaGeneradaItem,
  PlanillasPaeService,
  PlantillaOficial,
  ReporteConsolidadoResponse,
  TipoReporteConsolidadoItem,
} from '../services/planillas-pae.service';
import {
  PlantillaFormulario,
  clonarEsquemaParaEdicion,
  crearPlantillaFormularioVacio,
  etiquetaColumnaLegible,
  guardarBlobArchivo,
} from './reportes-helpers';

/** Una sede de la institución con los cupos de sus contratos vigentes */
interface SedeBase {
  id: number;
  nombre: string;
  cupos: number;
}

/**
 * Una entrega de alimentos ya asignada a una sede.
 */
interface EntregaSede {
  id: number;
  fecha: string;            // YYYY-MM-DD
  sedeId: number;
  sede: string;
  ingrediente: string;
  tipoMercado: string;
  cantidad: number;
  unidad: string;
  estado: string;           // EN_TRANSITO | RECIBIDA | CON_NOVEDAD | RECHAZADA
  kilos: number;            // kg efectivamente recibidos
  cantidadRecibida?: number | null;
  cantidadRechazada?: number | null;
  receptor?: string;
}

interface ResumenSede {
  id: number;
  nombre: string;
  cupos: number;
  entregas: number;
  kilos: number;
  novedades: number;        // entregas con novedad o rechazadas
  dias: number;             // días distintos con entregas
  ingredienteTop: string;   // ingrediente más entregado
  ultimaEntrega: string;
}

interface TotalesReporte {
  sedes: number;
  cupos: number;
  entregas: number;
  kilos: number;
  novedades: number;
  dias: number;
  ingredientes: number;
}

type ColumnaSede = 'nombre' | 'cupos' | 'entregas' | 'kilos' | 'novedades' | 'dias';

/** Si el servidor no responde en este tiempo, se muestra un error en vez de quedarse cargando */
const TIEMPO_MAXIMO_MS = 20000;

/** Convierte cualquier valor en texto */
const texto = (valor: unknown): string => (valor === null || valor === undefined ? '' : String(valor));

/** El backend puede responder con una lista o con { results: [...] } */
const listaDe = (datos: unknown): any[] => {
  if (Array.isArray(datos)) return datos;
  const resultados = (datos as { results?: unknown } | null)?.results;
  return Array.isArray(resultados) ? resultados : [];
};

const ETIQUETAS_ESTADO: Record<string, string> = {
  EN_TRANSITO: 'En tránsito',
  RECIBIDA: 'Recibida',
  CON_NOVEDAD: 'Con novedad',
  RECHAZADA: 'Rechazada',
};

@Component({
  selector: 'app-reportes-consumo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html',
  styleUrls: ['./reportes.css']
})
export class Reportes implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute, { optional: true });

  // ===================== PESTAÑAS Y ROL =====================
  modoModulo: 'auto' | 'plantillas' | 'reportes' = 'auto';
  pestanaActiva: 'consolidados' | 'planillas' | 'plantillas' | 'historial' = 'consolidados';
  esSuperAdmin = false;
  esSupervisor = false;
  esAdministrador = false;
  esJefa = false;
  rolActual = '';

  // ===================== ALCANCE Y CONSOLIDADO REAL (SIR-173) =====================
  alcance: AlcanceReportes | null = null;
  consolidado: ReporteConsolidadoResponse | null = null;
  cargandoConsolidado = false;
  errorConsolidado = '';
  tipoReporteFiltro = 'RESUMEN_GENERAL';
  filtroInstId: number | null = null;
  filtroSedeId: number | null = null;
  filtroJornadaId: number | null = null;
  filtroContratoId: number | null = null;
  fechaDesde = '';
  fechaHasta = '';

  // ===================== PLANILLAS GENERADAS Y VISOR (SIR-171 & SIR-172) =====================
  cargando = true;
  cargandoPlanillas = false;
  generandoPlanilla = false;
  guardandoPlanilla = false;
  imprimiendoPdf = false;
  planillas: PlanillaGeneradaItem[] = [];
  planillaActiva: PlanillaGeneradaItem | null = null;
  busquedaPlanilla = '';
  filtroProcesoPlanilla = '';
  filtroEstadoPlanilla = '';
  filtroPeriodoPlanilla = '';

  genPlantillaId: number | null = null;
  genProceso = 'REMISION';
  genInstId: number | null = null;
  genSedeId: number | null = null;
  genContratoId: number | null = null;
  genJornadaId: number | null = null;
  genPeriodo = '';
  genFechaInicio = '';
  genFechaFin = '';
  genObservaciones = '';

  manualesEdit: Record<string, any> = {};
  observacionEdit = '';

  // ===================== PLANTILLAS OFICIALES Y VERSIONADO (SIR-170) =====================
  metadatosPlantillas: MetadatosPlantillas | null = null;
  plantillas: PlantillaOficial[] = [];
  cargandoPlantillas = false;
  guardandoPlantilla = false;
  previsualizando = false;
  mostrarEditorAvanzadoPlantilla = false;
  plantillaForm: PlantillaFormulario = crearPlantillaFormularioVacio();
  previewPlantilla: any = null;
  previewSedeId: number | null = null;

  // ===================== REPORTE DE SEDES Y ENTREGAS =====================
  institucionActiva: InstitucionAsignada | null = null;
  sedeActiva: SedeActiva | null = null;
  sedesBase: SedeBase[] = [];
  entregas: EntregaSede[] = [];
  avisoDatos = '';
  sedeFiltro: 'Todas' | number = 'Todas';
  ordenColumna: ColumnaSede = 'kilos';
  ordenDireccion: 'asc' | 'desc' = 'desc';
  sedeDetalle: ResumenSede | null = null;
  entregaDetalle: EntregaSede | null = null;
  estadoFiltro = 'TODAS';
  textoBusqueda = '';

  // ===================== PAGINACIÓN =====================
  paginaActual = 1;
  filasPorPagina = 10;
  readonly opcionesFilasPorPagina = [10, 20, 50];

  // ===================== EXPORTACIÓN EXCEL =====================
  exportandoExcel = false;

  private versionDatos = 0;
  private suscripcion?: Subscription;
  private solicitudReporte?: Subscription;
  private cache: { clave: string; resumen: ResumenSede[]; totales: TotalesReporte } | null = null;
  private actualizacionAutomatica?: ReturnType<typeof setInterval>;

  constructor(
    private readonly entregasService: EntregasService,
    private readonly sirae: SiraeService,
    private readonly auth: AuthService,
    private readonly alertas: SweetAlertService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly planillasPaeService: PlanillasPaeService
  ) {}

  ngOnInit(): void {
    const modoRuta = this.route?.snapshot?.data?.['modoModulo'];
    this.modoModulo = (modoRuta === 'plantillas' || modoRuta === 'reportes') ? modoRuta : 'auto';
    this.detectarRolUsuario();
    this.leerParametrosIniciales();

    // Coordinar institución activa y sede activa (flujo Supervisor / reportes.spec)
    this.suscripcion = combineLatest([
      this.auth.institucionActiva$,
      this.auth.sedeActiva$
    ]).pipe(
      debounceTime(25)
    ).subscribe(([institucion, sede]) => {
      const teniaInstitucion = Boolean(this.institucionActiva?.id_institucion);
      const cambioInstitucion = institucion?.id_institucion !== this.institucionActiva?.id_institucion;
      const cambioSede = sede?.id_sede !== this.sedeActiva?.id_sede;
      this.institucionActiva = institucion;
      this.sedeActiva = sede;
      if (cambioInstitucion) {
        this.sedeFiltro = sede?.id_sede ?? 'Todas';
        this.sedeDetalle = null;
        this.paginaActual = 1;
        if (institucion?.id_institucion && (teniaInstitucion || !this.filtroInstId)) {
          this.filtroInstId = institucion.id_institucion;
          this.genInstId = institucion.id_institucion;
          this.filtroSedeId = sede?.id_sede ?? null;
          this.genSedeId = sede?.id_sede ?? null;
          if (teniaInstitucion && this.modoModulo !== 'plantillas') {
            this.cargarPlanillasGeneradas();
            if (this.puedeVerTabConsolidados) {
              this.cargarConsolidado();
            }
          }
        }
      } else if (sede && this.sedeFiltro === 'Todas') {
        this.sedeFiltro = sede.id_sede;
        this.paginaActual = 1;
      }
      if (cambioSede && sede?.id_sede && (!this.filtroSedeId || teniaInstitucion)) {
        this.filtroSedeId = sede.id_sede;
        this.genSedeId = sede.id_sede;
      }
      this.cargar();
    });

    this.cargarModuloReportesInicial();
  }

  private detectarRolUsuario(): void {
    const authAny: any = this.auth;
    const usuario = typeof authAny?.obtenerUsuario === 'function' ? authAny.obtenerUsuario() : null;
    const rol = usuario?.rol ?? null;
    this.rolActual = String(rol || '');
    this.esSuperAdmin = typeof authAny?.esSuperAdministrador === 'function' ? authAny.esSuperAdministrador(rol) : false;
    this.esSupervisor = typeof authAny?.esSupervisor === 'function' ? authAny.esSupervisor(rol) : false;
    this.esAdministrador = typeof authAny?.esAdministrador === 'function' ? authAny.esAdministrador(rol) : false;
    this.esJefa = typeof authAny?.esJefa === 'function' ? authAny.esJefa(rol) : false;

    if (this.esSuperAdmin && this.modoModulo === 'reportes') {
      this.pestanaActiva = 'consolidados';
    } else if (this.esSuperAdmin) {
      this.pestanaActiva = 'plantillas';
    } else {
      this.pestanaActiva = 'planillas';
    }
    if (this.esJefa) {
      this.genProceso = 'INVENTARIO';
    }
  }

  private leerParametrosIniciales(): void {
    const qp = this.route?.snapshot?.queryParams;
    if (!qp) return;
    if (qp['tipo']) this.tipoReporteFiltro = String(qp['tipo']);
    if (qp['institucion']) {
      const id = Number(qp['institucion']);
      if (Number.isFinite(id) && id > 0) {
        this.filtroInstId = id;
        this.genInstId = id;
      }
    }
    const tabParam = String(qp['tab'] || '');
    if (
      (tabParam === 'consolidados' || tabParam === 'planillas' || tabParam === 'plantillas' || tabParam === 'historial') &&
      this.puedeVerPestana(tabParam)
    ) {
      this.pestanaActiva = tabParam;
    }
  }

  private cargarModuloReportesInicial(): void {
    const authAny: any = this.auth;
    if (typeof authAny?.obtenerUsuario !== 'function') {
      return;
    }
    this.cargarAlcance();
    this.cargarMetadatosYPlantillas();
    if (this.puedeVerTabConsolidados) {
      this.cargarConsolidado();
    }
    if (this.puedeVerTabPlanillas) {
      this.cargarPlanillasGeneradas();
    }
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
    this.solicitudReporte?.unsubscribe();
    if (this.actualizacionAutomatica) clearInterval(this.actualizacionAutomatica);
  }

  // Esc cierra el detalle de la sede
  @HostListener('document:keydown.escape')
  alPresionarEsc(): void {
    if (this.sedeDetalle) this.cerrarSede();
    if (this.entregaDetalle) this.cerrarEntrega();
    if (this.planillaActiva) this.cerrarPlanillaDetalle();
  }

  cargar(): void {
    this.cargando = true;
    const idInstitucion = this.institucionActiva?.id_institucion;
    const fallos: string[] = [];

    if (!idInstitucion) {
      this.cargando = false;
      this.sedesBase = [];
      this.entregas = [];
      this.versionDatos++;
      this.cdr.markForCheck();
      return;
    }

    const opcional = <T>(nombre: string) => catchError<T, Observable<null>>((error: unknown) => {
      console.warn(`No se pudo cargar ${nombre} para el reporte:`, error);
      fallos.push(nombre);
      return of(null);
    });

    forkJoin({
      sedes: this.sirae.getSedes(idInstitucion).pipe(take(1), timeout(TIEMPO_MAXIMO_MS), opcional<any[]>('las sedes')),
      contratos: this.sirae.getContratos().pipe(take(1), timeout(TIEMPO_MAXIMO_MS), opcional<any[]>('los contratos')),
      entregas: this.entregasService.cargar().pipe(take(1), timeout(TIEMPO_MAXIMO_MS), opcional<Entrega[]>('las entregas')),
    }).subscribe(({ sedes, contratos, entregas }) => {
      this.armarReporteSedes(sedes, contratos, entregas, fallos);
      this.cargando = false;
      this.cdr.markForCheck();
    });
  }

  get puedeVerTabPlantillas(): boolean {
    return this.esSuperAdmin && this.modoModulo !== 'reportes';
  }

  get puedeVerTabPlanillas(): boolean {
    return this.modoModulo !== 'plantillas' && !(this.esSuperAdmin && this.modoModulo === 'reportes');
  }

  get puedeVerTabConsolidados(): boolean {
    return this.modoModulo !== 'plantillas' && (this.esSuperAdmin || this.esSupervisor || this.esAdministrador);
  }

  get puedeVerTabHistorial(): boolean {
    return this.modoModulo !== 'plantillas' && this.esSupervisor;
  }

  get mostrarBarraPestanas(): boolean {
    return [
      this.puedeVerTabPlantillas,
      this.puedeVerTabPlanillas,
      this.puedeVerTabConsolidados,
      this.puedeVerTabHistorial,
    ].filter(Boolean).length > 1;
  }

  puedeVerPestana(tab: 'consolidados' | 'planillas' | 'plantillas' | 'historial'): boolean {
    if (tab === 'planillas') return this.puedeVerTabPlanillas;
    if (tab === 'plantillas') return this.puedeVerTabPlantillas;
    if (tab === 'consolidados') return this.puedeVerTabConsolidados;
    if (tab === 'historial') return this.puedeVerTabHistorial;
    return false;
  }

  get tituloModuloPorRol(): string {
    if (this.esSuperAdmin && this.modoModulo === 'plantillas') return 'Plantillas Maestras Oficiales PAE';
    if (this.esSuperAdmin) return 'Reportes PAE';
    if (this.esSupervisor) return 'Mis Planillas y Reportes de Supervisor PAE';
    if (this.esAdministrador) return 'Planillas y Reportes de mi Institución';
    if (this.esJefa) return 'Mis Planillas de Comedor Escolar';
    return 'Planillas y Reportes PAE';
  }

  get subtituloModuloPorRol(): string {
    if (this.esSuperAdmin && this.modoModulo === 'plantillas') {
      return 'Administra únicamente los formatos maestros oficiales (Remisión de Víveres y Control de Entrada y Salida) sin mezclarlos con reportes.';
    }
    if (this.esSuperAdmin) {
      return 'Consulta los reportes consolidados reales de todo el sistema por institución, sede, contrato y periodo.';
    }
    if (this.esSupervisor) {
      return 'Genera tu Remisión de Víveres y Control de Inventario para la institución y sede a tu cargo, y consulta sus reportes.';
    }
    if (this.esAdministrador) {
      return 'Consulta y genera las planillas y reportes autorizados para tu institución.';
    }
    if (this.esJefa) {
      return 'Aquí ves únicamente tu planilla oficial de comedor escolar: Control de Entrada y Salida de Alimentos.';
    }
    return 'Consulta y diligencia las planillas y reportes autorizados para tu rol.';
  }

  get etiquetaTabPlanillas(): string {
    if (this.esSuperAdmin) return 'Planillas Generadas';
    if (this.esSupervisor) return 'Mis Planillas de Supervisor';
    if (this.esAdministrador) return 'Planillas de mi Institución';
    if (this.esJefa) return 'Mis Planillas de Comedor';
    return 'Planillas';
  }

  get etiquetaTabConsolidados(): string {
    if (this.esSuperAdmin) return 'Reportes Maestros';
    if (this.esSupervisor) return 'Reportes de mis Instituciones';
    if (this.esAdministrador) return 'Reportes de mi Institución';
    return 'Reportes';
  }

  get plantillasDisponiblesParaUsuario(): PlantillaOficial[] {
    return (this.plantillas || []).filter(t => t.activa && Boolean(t.version_publicada));
  }

  get plantillaSeleccionadaGenerar(): PlantillaOficial | null {
    return this.plantillasDisponiblesParaUsuario.find(t => t.id_plantilla === this.genPlantillaId) || null;
  }

  get procesosFiltradosParaUsuario(): { codigo: string; nombre: string; descripcion: string }[] {
    const todos = this.metadatosPlantillas?.procesos_pae || [];
    if (this.esSuperAdmin || this.plantillasDisponiblesParaUsuario.length === 0) {
      return todos;
    }
    const permitidos = new Set(this.plantillasDisponiblesParaUsuario.map(t => t.categoria_proceso));
    return todos.filter(p => permitidos.has(p.codigo));
  }

  get reporteSeleccionadoInfo(): TipoReporteConsolidadoItem | null {
    const tipos = this.consolidado?.tipos_disponibles || [];
    return tipos.find(t => t.codigo === this.tipoReporteFiltro) || null;
  }

  seleccionarPlantillaParaGenerar(tpl: PlantillaOficial): void {
    this.genPlantillaId = tpl.id_plantilla;
    this.genProceso = tpl.categoria_proceso;
  }

  seleccionarTipoReporte(codigo: string): void {
    this.tipoReporteFiltro = codigo;
    this.cargarConsolidado();
  }

  etiquetaRolCorto(codigoRol: string): string {
    const mapa: Record<string, string> = {
      SuperAdministrador: 'SuperAdmin',
      supervisor: 'Supervisor',
      Administrador: 'Administrador',
      JefaManipuladoras: 'Jefa de Manipuladoras',
      Manipuladora: 'Manipuladora',
    };
    return mapa[codigoRol] || codigoRol;
  }

  etiquetaDuenoPlantilla(tpl: PlantillaOficial): string {
    const roles = (tpl.roles_autorizados || []).filter(r => r !== 'SuperAdministrador');
    if (roles.length === 0) return 'Solo SuperAdmin';
    if (roles.length === 1) return `Uso: ${this.etiquetaRolCorto(roles[0])}`;
    return roles.map(r => this.etiquetaRolCorto(r)).join(' · ');
  }

  cambiarPestanaPrincipal(tab: 'consolidados' | 'planillas' | 'plantillas' | 'historial'): void {
    if (!this.puedeVerPestana(tab)) {
      this.pestanaActiva = this.puedeVerTabPlantillas
        ? 'plantillas'
        : (this.esSuperAdmin && this.puedeVerTabConsolidados ? 'consolidados' : 'planillas');
      return;
    }
    this.pestanaActiva = tab;
    if (tab === 'consolidados' && !this.consolidado && this.puedeVerTabConsolidados) this.cargarConsolidado();
    if (tab === 'planillas' && this.planillas.length === 0) this.cargarPlanillasGeneradas();
    if (tab === 'plantillas' && this.plantillas.length === 0) this.cargarMetadatosYPlantillas();
  }

  // =====================================================
  //  SIR-173: REPORTES OPERATIVOS CONSOLIDADOS REALES
  // =====================================================

  cargarAlcance(): void {
    this.planillasPaeService.obtenerAlcance().subscribe({
      next: (alc) => {
        this.alcance = alc;
        if (alc.instituciones.length === 1 && !this.filtroInstId) {
          this.filtroInstId = alc.instituciones[0].id_institucion;
          this.genInstId = alc.instituciones[0].id_institucion;
        }
        if (alc.sedes.length === 1 && !this.filtroSedeId) {
          this.filtroSedeId = alc.sedes[0].id_sede;
          this.genSedeId = alc.sedes[0].id_sede;
        }
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  sedesPorInstitucion(idInst: number | null) {
    const todas = this.alcance?.sedes || [];
    if (!idInst) return todas;
    return todas.filter(s => Number(s.id_institucion) === Number(idInst));
  }

  contratosPorAlcance(idInst: number | null, idSede: number | null) {
    const todos = this.alcance?.contratos || [];
    return todos.filter(c => {
      if (idSede && c.id_sede && Number(c.id_sede) !== Number(idSede)) return false;
      if (idInst && c.id_institucion && Number(c.id_institucion) !== Number(idInst)) return false;
      return true;
    });
  }

  cargarConsolidado(): void {
    if (!this.puedeVerTabConsolidados) {
      this.cargandoConsolidado = false;
      this.consolidado = null;
      return;
    }
    this.cargandoConsolidado = true;
    this.errorConsolidado = '';
    this.planillasPaeService.consultarReporteConsolidado({
      tipo_reporte: this.tipoReporteFiltro,
      id_institucion: this.filtroInstId,
      id_sede: this.filtroSedeId,
      id_jornada: this.filtroJornadaId,
      id_contrato: this.filtroContratoId,
      fecha_desde: this.fechaDesde,
      fecha_hasta: this.fechaHasta,
    }).subscribe({
      next: (resp) => {
        this.consolidado = resp;
        if (resp?.tipo_reporte) {
          this.tipoReporteFiltro = resp.tipo_reporte;
        }
        this.cargandoConsolidado = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.cargandoConsolidado = false;
        this.errorConsolidado = err?.error?.detail || 'No se pudo consultar el reporte consolidado desde el servidor.';
        this.cdr.markForCheck();
      }
    });
  }

  descargarConsolidadoCsv(): void {
    this.planillasPaeService.descargarReporteConsolidadoCsv({
      tipo_reporte: this.tipoReporteFiltro,
      id_institucion: this.filtroInstId,
      id_sede: this.filtroSedeId,
      id_jornada: this.filtroJornadaId,
      id_contrato: this.filtroContratoId,
      fecha_desde: this.fechaDesde,
      fecha_hasta: this.fechaHasta,
    }).subscribe({
      next: (blob) => {
        guardarBlobArchivo(blob, `reporte_pae_${this.tipoReporteFiltro.toLowerCase()}_${this.hoyISO()}.csv`);
        void this.alertas.success('Reporte descargado', 'El archivo CSV consolidado se generó con los datos reales vigentes.');
      },
      error: (err) => {
        void this.alertas.error('Error al exportar', err?.error?.detail || 'No se pudo generar el CSV consolidado.');
      }
    });
  }

  get columnasDetalleConsolidado(): string[] {
    const rows = this.consolidado?.detalle || [];
    if (rows.length === 0) return [];
    const ocultar = new Set(['id_sede', 'id_ingrediente', 'id_entrega', 'id_contrato', 'id_inventario', 'id_movimiento', 'id_gramaje', 'id_grado', 'id_asistencia', 'id_preparacion_asignada']);
    return Object.keys(rows[0]).filter(k => !ocultar.has(k));
  }

  etiquetaCol(clave: string): string {
    return etiquetaColumnaLegible(clave);
  }

  // =====================================================
  //  SIR-171 & SIR-172: PLANILLAS AUTO-DILIGENCIADAS
  // =====================================================

  cargarPlanillasGeneradas(): void {
    this.cargandoPlanillas = true;
    this.planillasPaeService.listarPlanillas({
      id_institucion: this.filtroInstId,
      id_sede: this.filtroSedeId,
      id_jornada: this.filtroJornadaId,
      id_contrato: this.filtroContratoId,
      categoria_proceso: this.filtroProcesoPlanilla,
      estado: this.filtroEstadoPlanilla,
      periodo: this.filtroPeriodoPlanilla,
      fecha_desde: this.fechaDesde,
      fecha_hasta: this.fechaHasta,
      search: this.busquedaPlanilla,
    }).subscribe({
      next: (lista) => {
        this.planillas = lista;
        this.cargandoPlanillas = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargandoPlanillas = false;
        this.cdr.markForCheck();
      }
    });
  }

  generarNuevaPlanilla(regenerar = false): void {
    this.generandoPlanilla = true;
    this.planillasPaeService.generarPlanilla({
      ...(this.genPlantillaId ? { id_plantilla: this.genPlantillaId } : { categoria_proceso: this.genProceso }),
      id_institucion: this.genInstId || this.filtroInstId,
      id_sede: this.genSedeId || this.filtroSedeId,
      id_contrato: this.genContratoId || this.filtroContratoId,
      id_jornada: this.genJornadaId || this.filtroJornadaId,
      periodo: this.genPeriodo.trim(),
      fecha_inicio: this.genFechaInicio,
      fecha_fin: this.genFechaFin,
      observaciones: this.genObservaciones.trim(),
      regenerar,
    }).subscribe({
      next: (resp) => {
        this.generandoPlanilla = false;
        this.cargarPlanillasGeneradas();
        this.abrirPlanillaDesdeObjeto(resp.planilla);
        void this.alertas.success('Planilla generada', resp.mensaje);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.generandoPlanilla = false;
        void this.alertas.warning('No se pudo generar', err?.error?.detail || 'Verifica que la plantilla esté publicada y los filtros sean válidos.');
        this.cdr.markForCheck();
      }
    });
  }

  abrirPlanillaDetalle(idPlanilla: number): void {
    this.cargandoPlanillas = true;
    this.planillasPaeService.obtenerPlanilla(idPlanilla).subscribe({
      next: (det) => {
        this.cargandoPlanillas = false;
        this.abrirPlanillaDesdeObjeto(det);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.cargandoPlanillas = false;
        void this.alertas.error('Error al abrir planilla', err?.error?.detail || 'No tienes autorización o la planilla no existe.');
        this.cdr.markForCheck();
      }
    });
  }

  private abrirPlanillaDesdeObjeto(det: PlanillaGeneradaItem): void {
    this.planillaActiva = det;
    this.manualesEdit = JSON.parse(JSON.stringify(det.valores_manuales || {}));
    this.observacionEdit = det.observaciones || '';
  }

  valorManualTabla(codTabla: string, rowIdx: number, codCol: string, valorActual: unknown): string {
    const valGuardado = this.manualesEdit?.['__tablas__']?.[codTabla]?.[String(rowIdx)]?.[codCol];
    if (valGuardado !== undefined && valGuardado !== null && valGuardado !== '') {
      return String(valGuardado);
    }
    return valorActual === 'PENDIENTE' || valorActual === null || valorActual === undefined ? '' : String(valorActual);
  }

  actualizarManualTabla(codTabla: string, rowIdx: number, codCol: string, valor: unknown): void {
    const tablas = { ...(this.manualesEdit['__tablas__'] || {}) };
    const tablaActual = { ...(tablas[codTabla] || {}) };
    const filaActual = { ...(tablaActual[String(rowIdx)] || {}) };
    filaActual[codCol] = valor;
    tablaActual[String(rowIdx)] = filaActual;
    tablas[codTabla] = tablaActual;
    this.manualesEdit['__tablas__'] = tablas;
  }

  clavesDe(obj: Record<string, unknown> | null | undefined): string[] {
    return obj && typeof obj === 'object' ? Object.keys(obj) : [];
  }

  cerrarPlanillaDetalle(): void {
    this.planillaActiva = null;
  }

  guardarManualesPlanilla(estadoNuevo?: string): void {
    if (!this.planillaActiva) return;
    this.guardandoPlanilla = true;
    this.planillasPaeService.actualizarPlanilla(this.planillaActiva.id_planilla, {
      valores_manuales: this.manualesEdit,
      observaciones: this.observacionEdit,
      ...(estadoNuevo ? { estado: estadoNuevo } : {}),
    }).subscribe({
      next: (actualizada) => {
        this.guardandoPlanilla = false;
        this.abrirPlanillaDesdeObjeto(actualizada);
        this.cargarPlanillasGeneradas();
        void this.alertas.success('Planilla actualizada', 'Los cambios y cálculos de la planilla se guardaron correctamente.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.guardandoPlanilla = false;
        void this.alertas.error('No se pudo actualizar', err?.error?.detail || 'Verifica el estado del documento.');
        this.cdr.markForCheck();
      }
    });
  }

  regenerarPlanillaActiva(): void {
    if (!this.planillaActiva) return;
    this.generandoPlanilla = true;
    this.planillasPaeService.generarPlanilla({
      id_plantilla: this.planillaActiva.plantilla_id,
      id_institucion: this.planillaActiva.id_institucion,
      id_sede: this.planillaActiva.id_sede ?? null,
      id_contrato: this.planillaActiva.id_contrato ?? null,
      id_jornada: this.planillaActiva.id_jornada ?? null,
      periodo: this.planillaActiva.periodo,
      fecha_inicio: this.planillaActiva.fecha_inicio || '',
      fecha_fin: this.planillaActiva.fecha_fin || '',
      observaciones: this.observacionEdit,
      valores_manuales: this.manualesEdit,
      regenerar: true,
    }).subscribe({
      next: (resp) => {
        this.generandoPlanilla = false;
        this.abrirPlanillaDesdeObjeto(resp.planilla);
        this.cargarPlanillasGeneradas();
        void this.alertas.success('Planilla sincronizada', 'La planilla fue recalculada con los datos más recientes de SIRAE.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.generandoPlanilla = false;
        void this.alertas.warning('No se pudo regenerar', err?.error?.detail || 'No se pudo regenerar el documento.');
        this.cdr.markForCheck();
      }
    });
  }

  descargarPlanillaCsv(idPlanilla: number, codigoDoc = 'planilla'): void {
    this.planillasPaeService.descargarPlanillaCsv(idPlanilla).subscribe({
      next: (blob) => {
        guardarBlobArchivo(blob, `${codigoDoc}.csv`);
        void this.alertas.success('Documento descargado', `Se descargó ${codigoDoc}.csv`);
      },
      error: () => {
        void this.alertas.error('Error al descargar', 'No se pudo descargar la planilla.');
      }
    });
  }

  imprimirDocumentoOficial(): void {
    this.imprimiendoPdf = true;
    setTimeout(() => {
      window.print();
      this.imprimiendoPdf = false;
      this.cdr.markForCheck();
    }, 150);
  }

  etiquetaEstadoPlanilla(estado: string): string {
    const m: Record<string, string> = {
      BORRADOR: 'Borrador',
      PENDIENTE: 'Pendiente',
      OBSERVADO: 'Observado',
      VALIDADO: 'Validado',
      CERRADO: 'Cerrado',
    };
    return m[estado] || estado;
  }

  claseEstadoPlanilla(estado: string): string {
    switch (estado) {
      case 'VALIDADO': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CERRADO': return 'bg-slate-200 text-slate-800 border-slate-300';
      case 'OBSERVADO': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'PENDIENTE': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  }

  get clavesCuposNivel(): string[] {
    const obj = this.planillaActiva?.contenido_snapshot?.cupos?.por_nivel;
    return obj && typeof obj === 'object' ? Object.keys(obj) : [];
  }

  // =====================================================
  //  SIR-170: PLANTILLAS OFICIALES Y VERSIONADO
  // =====================================================

  cargarMetadatosYPlantillas(): void {
    this.cargandoPlantillas = true;
    forkJoin({
      meta: this.planillasPaeService.obtenerMetadatosPlantillas().pipe(catchError(() => of(null))),
      lista: this.planillasPaeService.listarPlantillas().pipe(catchError(() => of([]))),
    }).subscribe(({ meta, lista }) => {
      if (meta) this.metadatosPlantillas = meta;
      this.plantillas = lista;
      const disponibles = lista.filter(t => t.activa && Boolean(t.version_publicada));
      if (disponibles.length > 0) {
        const sigueValida = disponibles.some(t => t.id_plantilla === this.genPlantillaId);
        if (!this.genPlantillaId || !sigueValida) {
          this.seleccionarPlantillaParaGenerar(disponibles[0]);
        }
      } else {
        this.genPlantillaId = null;
        if (this.esJefa) {
          this.genProceso = 'INVENTARIO';
        }
      }
      if (!this.plantillaForm.id_plantilla && lista.length > 0 && this.esSuperAdmin) {
        this.seleccionarPlantilla(lista[0]);
      }
      this.cargandoPlantillas = false;
      this.cdr.markForCheck();
    });
  }

  iniciarNuevaPlantilla(): void {
    this.previewPlantilla = null;
    this.mostrarEditorAvanzadoPlantilla = true;
    this.plantillaForm = crearPlantillaFormularioVacio();
  }

  seleccionarPlantilla(tpl: PlantillaOficial): void {
    this.previewPlantilla = null;
    this.mostrarEditorAvanzadoPlantilla = false;
    const versionEditable = tpl.version_borrador || tpl.version_publicada || tpl.versiones?.[0];
    this.plantillaForm = {
      id_plantilla: tpl.id_plantilla,
      id_version: versionEditable?.id_version ?? null,
      codigo: tpl.codigo,
      nombre: tpl.nombre,
      descripcion: tpl.descripcion || '',
      categoria_proceso: tpl.categoria_proceso,
      finalidad: tpl.finalidad || '',
      roles_autorizados: [...(tpl.roles_autorizados || [])],
      activa: tpl.activa,
      notas_version: versionEditable?.notas_version || '',
      es_inmutable: Boolean(versionEditable?.es_inmutable),
      estado_version: versionEditable?.estado || 'BORRADOR',
      numero_version: versionEditable?.numero_version || 1,
      esquema: clonarEsquemaParaEdicion(versionEditable?.esquema),
    };
  }

  tieneRolAutorizado(codRol: string): boolean {
    return this.plantillaForm.roles_autorizados.includes(codRol);
  }

  toggleRolAutorizado(codRol: string): void {
    if (this.tieneRolAutorizado(codRol)) {
      this.plantillaForm.roles_autorizados = this.plantillaForm.roles_autorizados.filter(r => r !== codRol);
    } else {
      this.plantillaForm.roles_autorizados = [...this.plantillaForm.roles_autorizados, codRol];
    }
  }

  camposDeFuente(fuenteCod: string): string[] {
    const f = (this.metadatosPlantillas?.fuentes_sirae || []).find(item => item.codigo === fuenteCod);
    return f?.campos || [];
  }

  agregarSeccion(): void {
    const idx = this.plantillaForm.esquema.secciones.length + 1;
    this.plantillaForm.esquema.secciones.push({
      codigo: `SEC_${idx}`,
      titulo: `Nueva Sección ${idx}`,
      orden: idx,
      origen: 'AUTOMATICO',
      fuente_sirae: 'CONTRATO',
      visible_en_impresion: true,
    });
  }

  eliminarSeccion(idx: number): void {
    this.plantillaForm.esquema.secciones.splice(idx, 1);
  }

  agregarCampo(): void {
    const secCod = this.plantillaForm.esquema.secciones[0]?.codigo || 'SEC_1';
    const idx = this.plantillaForm.esquema.campos.length + 1;
    this.plantillaForm.esquema.campos.push({
      codigo: `campo_${idx}`,
      etiqueta: `Nuevo Campo ${idx}`,
      seccion: secCod,
      tipo: 'TEXTO',
      origen: 'MANUAL',
      fuente_sirae: '',
      campo_fuente: '',
      requerido: false,
    });
  }

  eliminarCampo(idx: number): void {
    this.plantillaForm.esquema.campos.splice(idx, 1);
  }

  agregarTabla(): void {
    const secCod = this.plantillaForm.esquema.secciones[0]?.codigo || 'SEC_1';
    const idx = this.plantillaForm.esquema.tablas.length + 1;
    this.plantillaForm.esquema.tablas.push({
      codigo: `TABLA_${idx}`,
      titulo: `Tabla Operativa ${idx}`,
      seccion: secCod,
      fuente_sirae: 'CONSUMO',
      columnas: [
        { codigo: 'nombre_ingrediente', etiqueta: 'Producto', tipo: 'TEXTO', origen: 'AUTOMATICO' },
        { codigo: 'unidad', etiqueta: 'Unidad', tipo: 'TEXTO', origen: 'AUTOMATICO' },
        { codigo: 'cantidad_programada', etiqueta: 'Programado', tipo: 'NUMERO', origen: 'AUTOMATICO', calcular_total: true },
      ],
      formulas: [],
      conversiones_unidad: [],
    });
  }

  eliminarTabla(idx: number): void {
    this.plantillaForm.esquema.tablas.splice(idx, 1);
  }

  agregarColumna(tblIdx: number): void {
    const tbl = this.plantillaForm.esquema.tablas[tblIdx];
    if (!tbl) return;
    const idx = tbl.columnas.length + 1;
    tbl.columnas.push({
      codigo: `col_${idx}`,
      etiqueta: `Columna ${idx}`,
      tipo: 'NUMERO',
      origen: 'AUTOMATICO',
      formula: '',
      unidad_destino: '',
      calcular_total: false,
    });
  }

  eliminarColumna(tblIdx: number, colIdx: number): void {
    this.plantillaForm.esquema.tablas[tblIdx]?.columnas.splice(colIdx, 1);
  }

  agregarConversion(tblIdx: number): void {
    const tbl = this.plantillaForm.esquema.tablas[tblIdx];
    if (!tbl) return;
    if (!tbl.conversiones_unidad) tbl.conversiones_unidad = [];
    tbl.conversiones_unidad.push({
      codigo: `CONV_${tbl.conversiones_unidad.length + 1}`,
      nombre: 'Conversión de unidad',
      columna_origen: tbl.columnas[0]?.codigo || 'cantidad_programada',
      columna_destino: tbl.columnas[0]?.codigo || 'cantidad_programada',
      unidad_origen_abrev: 'g',
      unidad_destino_abrev: 'kg',
      aplicar_automaticamente: true,
    });
  }

  eliminarConversion(tblIdx: number, convIdx: number): void {
    this.plantillaForm.esquema.tablas[tblIdx]?.conversiones_unidad?.splice(convIdx, 1);
  }

  guardarPlantilla(): void {
    if (!this.esSuperAdmin) return;
    this.guardandoPlantilla = true;
    const f = this.plantillaForm;
    f.esquema.encabezado.titulo = f.esquema.encabezado.titulo || f.nombre.toUpperCase();
    f.esquema.encabezado.codigo_formato = f.codigo.trim().toUpperCase();

    const obs$ = f.id_plantilla
      ? this.planillasPaeService.actualizarPlantilla(f.id_plantilla, {
          id_version: f.id_version,
          nombre: f.nombre,
          descripcion: f.descripcion,
          categoria_proceso: f.categoria_proceso,
          finalidad: f.finalidad,
          roles_autorizados: f.roles_autorizados,
          activa: f.activa,
          notas_version: f.notas_version,
          esquema: f.esquema,
        })
      : this.planillasPaeService.crearPlantilla({
          codigo: f.codigo,
          nombre: f.nombre,
          descripcion: f.descripcion,
          categoria_proceso: f.categoria_proceso,
          finalidad: f.finalidad,
          roles_autorizados: f.roles_autorizados,
          activa: f.activa,
          notas_version: f.notas_version,
          esquema: f.esquema,
        });

    obs$.subscribe({
      next: (guardada) => {
        this.guardandoPlantilla = false;
        this.cargarMetadatosYPlantillas();
        this.seleccionarPlantilla(guardada);
        void this.alertas.success('Plantilla guardada', `La plantilla ${guardada.codigo} se guardó correctamente.`);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.guardandoPlantilla = false;
        void this.alertas.warning('No se pudo guardar', err?.error?.detail || 'Revisa los campos o crea una nueva versión en borrador.');
        this.cdr.markForCheck();
      }
    });
  }

  previsualizarPlantilla(): void {
    const idP = this.plantillaForm.id_plantilla;
    if (!idP) {
      void this.alertas.warning('Guarda primero', 'Guarda el borrador de la plantilla para previsualizarla.');
      return;
    }
    this.previsualizando = true;
    this.planillasPaeService.previsualizarPlantilla(idP, {
      ...(this.plantillaForm.id_version ? { id_version: this.plantillaForm.id_version } : {}),
      ...(this.previewSedeId ? { id_sede: this.previewSedeId } : {}),
    }).subscribe({
      next: (prev) => {
        this.previewPlantilla = prev;
        this.previsualizando = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.previsualizando = false;
        void this.alertas.error('Error al previsualizar', err?.error?.detail || 'No se pudo generar la previsualización.');
        this.cdr.markForCheck();
      }
    });
  }

  publicarPlantilla(): void {
    const idP = this.plantillaForm.id_plantilla;
    if (!idP) return;
    this.guardandoPlantilla = true;
    this.planillasPaeService.publicarPlantilla(idP, this.plantillaForm.id_version || undefined, this.plantillaForm.notas_version).subscribe({
      next: (resp) => {
        this.guardandoPlantilla = false;
        this.cargarMetadatosYPlantillas();
        if (resp?.plantilla) this.seleccionarPlantilla(resp.plantilla);
        void this.alertas.success('Plantilla publicada', resp?.mensaje || 'La versión quedó publicada para uso oficial.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.guardandoPlantilla = false;
        void this.alertas.warning('No se pudo publicar', err?.error?.detail || 'Verifica el esquema de la versión.');
        this.cdr.markForCheck();
      }
    });
  }

  crearNuevaVersion(): void {
    const idP = this.plantillaForm.id_plantilla;
    if (!idP) return;
    this.guardandoPlantilla = true;
    this.planillasPaeService.crearNuevaVersionPlantilla(idP, this.plantillaForm.id_version || undefined).subscribe({
      next: (resp) => {
        this.guardandoPlantilla = false;
        this.cargarMetadatosYPlantillas();
        if (resp?.plantilla) this.seleccionarPlantilla(resp.plantilla);
        this.mostrarEditorAvanzadoPlantilla = true;
        void this.alertas.success('Nueva versión en borrador', resp?.mensaje || 'Ya puedes editar la nueva versión sin alterar las anteriores.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.guardandoPlantilla = false;
        void this.alertas.error('Error al versionar', err?.error?.detail || 'No se pudo crear una nueva versión.');
        this.cdr.markForCheck();
      }
    });
  }

  // =====================================================
  //  REPORTE DE SEDES (Lógica histórica conservada)
  // =====================================================

  private armarReporteSedes(sedes: any[] | null, contratos: any[] | null, entregas: Entrega[] | null, fallos: string[]): void {
    const idInstitucion = this.institucionActiva?.id_institucion;

    let origen = listaDe(sedes);
    if (origen.length === 0) origen = listaDe(this.institucionActiva?.sedes);
    const mapaSedes = new Map<number, SedeBase>();
    for (const item of origen) {
      const id = Number(item.id_sede ?? item.id);
      if (!id) continue;
      mapaSedes.set(id, { id, nombre: texto(item.nombre_sede ?? item.nombre) || `Sede ${id}`, cupos: 0 });
    }
    const institucionSinSedes = mapaSedes.size === 0 &&
      listaDe(this.institucionActiva?.sedes).length === 0;

    for (const contrato of listaDe(contratos)) {
      const idSede = Number(contrato.id_sede);
      if (!idSede || !this.contratoVigente(contrato)) continue;
      if (idInstitucion && Number(contrato.id_institucion) !== idInstitucion && !mapaSedes.has(idSede)) continue;
      const sede = mapaSedes.get(idSede);
      if (sede) sede.cupos += Number(contrato.cupos) || 0;
    }

    const delaInstitucion = (entregas ?? []).filter(e =>
      idInstitucion ? (e.idInstitucion === idInstitucion || (e.idSede !== undefined && mapaSedes.has(e.idSede))) : false);
    const sinSede = delaInstitucion.filter(e => !e.idSede && !institucionSinSedes).length;
    const conSede = delaInstitucion.filter(e => !!e.idSede || institucionSinSedes);

    for (const e of conSede) {
      if (!mapaSedes.has(e.idSede!)) {
        mapaSedes.set(e.idSede!, { id: e.idSede!, nombre: e.sedeNombre || `Sede ${e.idSede}`, cupos: 0 });
      }
    }

    this.sedesBase = Array.from(mapaSedes.values());
    this.entregas = conSede.map(e => this.aEntregaSede(e, mapaSedes.get(e.idSede!)!.nombre));
    this.versionDatos++;

    const avisos: string[] = [];
    if (fallos.length > 0) avisos.push(`No se pudieron cargar ${fallos.join(', ')}. Los datos de esas partes pueden estar incompletos; usa "Actualizar datos" para reintentar.`);
    if (sinSede > 0) avisos.push(`${sinSede} ${sinSede === 1 ? 'entrega no tiene' : 'entregas no tienen'} sede asignada y no se cuentan por sede.`);
    this.avisoDatos = avisos.join(' ');
  }

  private contratoVigente(contrato: any): boolean {
    const estado = texto(contrato.estado).toLowerCase();
    return !['finaliz', 'vencid', 'cancel', 'inactiv', 'terminad'].some(palabra => estado.includes(palabra));
  }

  private aEntregaSede(e: Entrega, nombreSede: string): EntregaSede {
    const estado = texto(e.estado).toUpperCase() || 'EN_TRANSITO';
    const recibida = estado === 'RECIBIDA' || estado === 'CON_NOVEDAD';
    const cantidad = e.cantidadRecibida ?? e.cantidad ?? 0;
    return {
      id: Number(e.id) || 0,
      fecha: texto(e.fechaRecepcion).slice(0, 10),
      sedeId: Number(e.idSede),
      sede: nombreSede,
      ingrediente: e.ingrediente || 'Sin nombre',
      tipoMercado: e.tipoMercado,
      cantidad: Number(e.cantidad) || 0,
      unidad: e.unidad,
      estado,
      kilos: recibida && e.unidad === 'Kg' ? Number(cantidad) || 0 : 0,
    };
  }

  // ---------- Filtros Historial ----------
  rango(dias: number | null): void {
    this.paginaActual = 1;
    if (dias === null) {
      this.fechaDesde = '';
      this.fechaHasta = '';
      return;
    }
    const hoy = new Date();
    const desde = new Date();
    desde.setDate(hoy.getDate() - dias + 1);
    this.fechaDesde = this.isoDe(desde);
    this.fechaHasta = this.isoDe(hoy);
  }

  get sedesDisponibles(): SedeBase[] {
    return [...this.sedesBase].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  private get idSedeSeleccionada(): number {
    return typeof this.sedeFiltro === 'number' ? this.sedeFiltro : 0;
  }

  private get entregasEnFechas(): EntregaSede[] {
    return this.entregas.filter(e =>
      (!this.fechaDesde || e.fecha >= this.fechaDesde) &&
      (!this.fechaHasta || e.fecha <= this.fechaHasta));
  }

  ordenarPor(columna: ColumnaSede): void {
    if (this.ordenColumna === columna) {
      this.ordenDireccion = this.ordenDireccion === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenColumna = columna;
      this.ordenDireccion = columna === 'nombre' ? 'asc' : 'desc';
    }
  }

  iconoOrden(columna: ColumnaSede): string {
    if (this.ordenColumna !== columna) return 'unfold_more';
    return this.ordenDireccion === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  private get calculo() {
    const clave = [this.fechaDesde, this.fechaHasta, this.sedeFiltro, this.ordenColumna, this.ordenDireccion, this.versionDatos].join('|');
    if (!this.cache || this.cache.clave !== clave) this.cache = this.calcular(clave);
    return this.cache;
  }

  get resumenSedes(): ResumenSede[] { return this.calculo.resumen; }
  get totales(): TotalesReporte { return this.calculo.totales; }

  private calcular(clave: string) {
    const entregas = this.entregasEnFechas;
    const sedes = this.sedesBase.filter(s => this.sedeFiltro === 'Todas' || s.id === this.sedeFiltro);

    const dir = this.ordenDireccion === 'asc' ? 1 : -1;
    const resumen = sedes
      .map(sede => this.resumirSede(sede, entregas.filter(e => e.sedeId === sede.id)))
      .sort((a, b) => {
        const x = a[this.ordenColumna];
        const y = b[this.ordenColumna];
        return (typeof x === 'string' ? x.localeCompare(String(y), 'es') : (x as number) - (y as number)) * dir
          || a.nombre.localeCompare(b.nombre, 'es');
      });

    const delPeriodo = entregas.filter(e => sedes.some(s => s.id === e.sedeId));
    const totales: TotalesReporte = {
      sedes: resumen.length,
      cupos: resumen.reduce((suma, s) => suma + s.cupos, 0),
      entregas: resumen.reduce((suma, s) => suma + s.entregas, 0),
      kilos: this.redondear(resumen.reduce((suma, s) => suma + s.kilos, 0)),
      novedades: resumen.reduce((suma, s) => suma + s.novedades, 0),
      dias: new Set(delPeriodo.map(e => e.fecha)).size,
      ingredientes: new Set(delPeriodo.map(e => e.ingrediente)).size,
    };

    return { clave, resumen, totales };
  }

  private resumirSede(sede: SedeBase, lista: EntregaSede[]): ResumenSede {
    const conteo = new Map<string, number>();
    lista.forEach(e => conteo.set(e.ingrediente, (conteo.get(e.ingrediente) ?? 0) + 1));
    const ingredienteTop = Array.from(conteo.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return {
      id: sede.id,
      nombre: sede.nombre,
      cupos: sede.cupos,
      entregas: lista.length,
      kilos: this.redondear(lista.reduce((suma, e) => suma + e.kilos, 0)),
      novedades: lista.filter(e => e.estado === 'CON_NOVEDAD' || e.estado === 'RECHAZADA').length,
      dias: new Set(lista.map(e => e.fecha)).size,
      ingredienteTop,
      ultimaEntrega: lista.reduce((ultima, e) => (e.fecha > ultima ? e.fecha : ultima), ''),
    };
  }

  trackSede = (_: number, s: ResumenSede) => s.id;
  trackEntrega = (_: number, e: EntregaSede) => e.id;

  etiquetaEstado(estado: string): string {
    return ETIQUETAS_ESTADO[estado] ?? estado;
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'RECIBIDA': return 'bg-emerald-50 text-emerald-700';
      case 'CON_NOVEDAD': return 'bg-amber-50 text-amber-700';
      case 'RECHAZADA': return 'bg-red-50 text-red-700';
      default: return 'bg-sky-50 text-sky-700';
    }
  }

  abrirSede(sede: ResumenSede): void {
    this.sedeDetalle = sede;
  }

  cerrarSede(): void {
    this.sedeDetalle = null;
  }

  abrirEntrega(entrega: EntregaSede): void {
    this.entregaDetalle = entrega;
  }

  cerrarEntrega(): void {
    this.entregaDetalle = null;
  }

  get entregasHistorial(): EntregaSede[] {
    const busqueda = this.textoBusqueda.trim().toLowerCase();
    return this.entregasEnFechas.filter(entrega =>
      (this.sedeFiltro === 'Todas' || entrega.sedeId === this.sedeFiltro) &&
      (this.estadoFiltro === 'TODAS' || entrega.estado === this.estadoFiltro) &&
      (!busqueda || `${entrega.ingrediente} ${entrega.sede} ${entrega.receptor ?? ''} ${entrega.tipoMercado}`
        .toLowerCase().includes(busqueda))
    );
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.entregasHistorial.length / this.filasPorPagina));
  }

  get entregasPaginadas(): EntregaSede[] {
    const inicio = (this.paginaActual - 1) * this.filasPorPagina;
    return this.entregasHistorial.slice(inicio, inicio + this.filasPorPagina);
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas) {
      this.paginaActual = nuevaPagina;
    }
  }

  cambiarEstadoFiltro(estado: string): void {
    this.estadoFiltro = estado;
    this.paginaActual = 1;
  }

  alCambiarBusqueda(): void {
    this.paginaActual = 1;
  }

  contarEstado(estado: string): number {
    const entregas = estado === 'TODAS'
      ? this.entregasHistorial
      : this.entregasHistorial.filter(entrega => entrega.estado === estado);
    return entregas.length;
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  irAInicioSupervisor(): void {
    void this.router.navigate(['/dashboard-supervisor']);
  }

  reponerEntrega(entrega: EntregaSede): void {
    this.cerrarEntrega();
    void this.router.navigate(['/registrar-entrega-alimentos'], {
      queryParams: {
        sede: entrega.sedeId,
        reponer: entrega.ingrediente,
        cantidad: entrega.cantidadRechazada || entrega.cantidad
      }
    });
  }

  exportarExcelOficial(): void {
    if (!this.institucionActiva) return;
    this.exportandoExcel = true;
    this.entregasService.exportarExcel().subscribe({
      next: (blob) => {
        this.exportandoExcel = false;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const nombreInst = (this.institucionActiva?.nombre_institucion || 'Institucion')
          .replace(/[^a-zA-Z0-9_-]/g, '_');
        link.download = `Historial_Entregas_${nombreInst}_${this.hoyISO()}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        void this.alertas.success('Reporte descargado', 'El historial oficial en formato Excel (.xlsx) se generó exitosamente.');
      },
      error: (err) => {
        this.exportandoExcel = false;
        console.error('Error al exportar Excel:', err);
        void this.alertas.error('Error al exportar', 'No se pudo generar el archivo Excel oficial. Puedes usar el botón de exportar CSV.');
      }
    });
  }

  get entregasSede(): EntregaSede[] {
    if (!this.sedeDetalle) return [];
    const id = this.sedeDetalle.id;
    return this.entregasEnFechas
      .filter(e => e.sedeId === id)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }

  get ingredientesSede(): { ingrediente: string; veces: number }[] {
    const mapa = new Map<string, number>();
    for (const e of this.entregasSede) mapa.set(e.ingrediente, (mapa.get(e.ingrediente) ?? 0) + 1);
    return Array.from(mapa.entries())
      .map(([ingrediente, veces]) => ({ ingrediente, veces }))
      .sort((a, b) => b.veces - a.veces);
  }

  exportarCsvSedes(): void {
    const sedes = this.resumenSedes;
    if (sedes.length === 0) {
      void this.alertas.warning('Sin registros', 'No hay sedes para exportar con los filtros seleccionados.');
      return;
    }
    const t = this.totales;
    this.descargarCsv(`reporte-global-sedes-${this.hoyISO()}.csv`, [
      ['Sede', 'Cupos', 'Entregas', 'Kg recibidos', 'Entregas con novedad o rechazadas', 'Días con entregas', 'Ingrediente más entregado', 'Última entrega'],
      ...sedes.map(s => [s.nombre, s.cupos, s.entregas, s.kilos, s.novedades, s.dias, s.ingredienteTop, s.ultimaEntrega].map(texto)),
      ['TOTAL', t.cupos, t.entregas, t.kilos, t.novedades, t.dias, '', ''].map(texto),
    ]);
    void this.alertas.success('Reporte exportado', 'Se descargó el resumen por sede.');
  }

  exportarCsvSede(): void {
    const sede = this.sedeDetalle;
    const filas = this.entregasSede;
    if (!sede || filas.length === 0) {
      void this.alertas.warning('Sin registros', 'Esta sede no tiene entregas en el rango seleccionado.');
      return;
    }
    this.descargarCsv(`sede-${sede.id}-${this.hoyISO()}.csv`, [
      ['Fecha', 'Sede', 'Ingrediente', 'Tipo de mercado', 'Cantidad', 'Unidad', 'Estado', 'Kg recibidos'],
      ...filas.map(e => [e.fecha, e.sede, e.ingrediente, e.tipoMercado, e.cantidad, e.unidad, this.etiquetaEstado(e.estado), e.kilos].map(texto)),
    ]);
  }

  fechaCorta(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  diaSemana(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const nombre = new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short' });
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }

  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  private isoDe(d: Date): string {
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  hoyISO(): string {
    return this.isoDe(new Date());
  }

  private descargarCsv(nombreArchivo: string, filas: string[][]): void {
    const seguro = (valor: string) => (/^[=+@\t\r]|^-(?![\d.,])/.test(valor) ? `'${valor}` : valor);
    const contenido = filas
      .map(fila => fila.map(valor => `"${seguro(valor).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const url = URL.createObjectURL(new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
