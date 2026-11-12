import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, take, timeout } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService, InstitucionAsignada, SedeActiva } from '@core/auth';
import { SweetAlertService } from '../sweet-alert.service';
import { Entrega, EntregasService } from '../features/entregas/services/entregas.service';
import { SiraeService } from '../features/contratos/services/contratos_pae.service';
import {
  PlanillasOperativasService,
  PlanillaRemisionData,
  PlanillaKardexData,
  ItemMinutaPatron,
  FilaNoPerecedero,
  FilaPerecedero,
  FilaAseo,
  FilaKardex
} from '../services/planillas-operativas.service';

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
  selector: 'app-plantillas-operativas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plantillas-operativas.html',
  styleUrls: ['./plantillas-operativas.css']
})
export class PlanillasOperativasComponent implements OnInit, OnDestroy {
  // ===================== PESTAÑAS Y MODOS =====================
  pestanaActiva: 'remision' | 'kardex' | 'minuta' | 'historial' = 'remision';
  subFiltroRemision: 'todas' | 'no-perecederos' | 'perecederos' | 'aseo' = 'todas';
  modoEdicion = false;
  imprimiendoPdf = false;
  formatoImpresion: 'remision' | 'kardex' | 'minuta' = 'remision';

  // ===================== FILTROS Y ESTADO DE FECHAS =====================
  cargando = true;
  cargandoPlanillas = false;
  fechaDesde = '';
  fechaHasta = '';

  // Selector de Periodos y Fechas de las Planillas
  periodoSeleccionado = 'PRIMERA';
  periodosDisponibles: string[] = ['PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA', 'SEXTA'];
  fechaInicioPlanilla = '2025-01-27';
  fechaFinPlanilla = '2025-02-21';
  diasAtenderPlanilla = 20;

  // ===================== PLANILLAS OFICIALES PAE =====================
  planillaRemision: PlanillaRemisionData | null = null;
  planillaKardex: PlanillaKardexData | null = null;
  minutaPatron: ItemMinutaPatron[] = [];

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
    private readonly planillasPaeService: PlanillasOperativasService
  ) {}

  ngOnInit(): void {
    // Coordinar institución activa y sede activa
    this.suscripcion = combineLatest([
      this.auth.institucionActiva$,
      this.auth.sedeActiva$
    ]).pipe(
      debounceTime(25)
    ).subscribe(([institucion, sede]) => {
      const cambioInstitucion = institucion?.id_institucion !== this.institucionActiva?.id_institucion;
      this.institucionActiva = institucion;
      this.sedeActiva = sede;
      if (cambioInstitucion) {
        this.sedeFiltro = sede?.id_sede ?? 'Todas';
        this.sedeDetalle = null;
        this.paginaActual = 1;
      } else if (sede && this.sedeFiltro === 'Todas') {
        this.sedeFiltro = sede.id_sede;
        this.paginaActual = 1;
      }
      this.cargar();
      this.cargarPlanillas();
    });

    this.actualizacionAutomatica = setInterval(() => {
      if (this.institucionActiva) {
        this.cargar();
        this.cargarPlanillas(false);
      }
    }, 60000);
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

  // =====================================================
  //  CARGA Y GESTIÓN DE PLANILLAS OFICIALES PAE
  // =====================================================

  cargarPlanillas(mostrarCargando = true): void {
    if (!this.institucionActiva) {
      this.planillaRemision = null;
      this.planillaKardex = null;
      this.minutaPatron = [];
      return;
    }

    if (mostrarCargando) this.cargandoPlanillas = true;

    const idInstitucion = this.institucionActiva.id_institucion;
    const nombreInstitucion = this.institucionActiva.nombre_institucion;
    const idSede = this.sedeActiva?.id_sede ?? (typeof this.sedeFiltro === 'number' ? this.sedeFiltro : 0);
    const nombreSede = this.sedeActiva?.nombre_sede ?? (this.sedesBase.find(s => s.id === idSede)?.nombre || 'Sede Principal');
    const cuposSede = this.sedesBase.find(s => s.id === idSede)?.cupos || 227;

    forkJoin({
      remision: this.planillasPaeService.obtenerPlanillaRemision({
        institucionId: idInstitucion,
        institucionNombre: nombreInstitucion,
        sedeId: idSede,
        sedeNombre: nombreSede,
        periodo: this.periodoSeleccionado,
        fechaInicio: this.fechaInicioPlanilla,
        fechaFin: this.fechaFinPlanilla,
        cuposBase: cuposSede
      }),
      kardex: this.planillasPaeService.obtenerPlanillaKardex({
        institucionId: idInstitucion,
        institucionNombre: nombreInstitucion,
        sedeId: idSede,
        sedeNombre: nombreSede,
        periodo: this.periodoSeleccionado,
        fechaInicio: this.fechaInicioPlanilla,
        fechaFin: this.fechaFinPlanilla
      })
    }).subscribe({
      next: ({ remision, kardex }) => {
        this.planillaRemision = remision;
        this.planillaKardex = kardex;
        this.minutaPatron = this.planillasPaeService.obtenerMinutaPatron(remision.cupos, remision.diasAtender);
        this.cargandoPlanillas = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al cargar planillas PAE:', err);
        this.cargandoPlanillas = false;
        this.cdr.markForCheck();
      }
    });
  }

  alCambiarPeriodoOFecha(): void {
    this.cargarPlanillas(true);
  }

  sincronizarConManipuladoras(): void {
    // Limpiar claves temporales para regenerar con los datos más recientes del backend
    if (!this.institucionActiva) return;
    const idInst = this.institucionActiva.id_institucion;
    const idSede = this.sedeActiva?.id_sede ?? 0;
    localStorage.removeItem(`pae_remision_${idInst}_${idSede}_${this.periodoSeleccionado}_${this.fechaInicioPlanilla}`);
    localStorage.removeItem(`pae_kardex_${idInst}_${idSede}_${this.periodoSeleccionado}_${this.fechaInicioPlanilla}`);

    this.cargarPlanillas(true);
    void this.alertas.success(
      'Datos Sincronizados',
      'Las planillas se han autocompletado con las entregas y las asistencias registradas por las jefas de manipuladoras.'
    );
  }

  guardarPlanillas(): void {
    if (!this.institucionActiva || !this.planillaRemision || !this.planillaKardex) return;
    const idInst = this.institucionActiva.id_institucion;
    const idSede = this.sedeActiva?.id_sede ?? 0;
    const claveRemision = `pae_remision_${idInst}_${idSede}_${this.periodoSeleccionado}_${this.fechaInicioPlanilla}`;
    const claveKardex = `pae_kardex_${idInst}_${idSede}_${this.periodoSeleccionado}_${this.fechaInicioPlanilla}`;

    this.planillasPaeService.guardarPlanillaRemision(claveRemision, this.planillaRemision);
    this.planillasPaeService.guardarPlanillaKardex(claveKardex, this.planillaKardex);
    this.modoEdicion = false;

    void this.alertas.success('Planillas Guardadas', 'Los cambios en las planillas se han guardado satisfactoriamente.');
  }

  recalcularPerecedero(p: FilaPerecedero): void {
    const e = p.entregas;
    p.totalEntregado = Math.round((Number(e[0].aEntregar || 0) + Number(e[1].aEntregar || 0) + Number(e[2].aEntregar || 0) + Number(e[3].aEntregar || 0)) * 100) / 100;
    p.totalRecibido = Math.round((Number(e[0].recibida || 0) + Number(e[1].recibida || 0) + Number(e[2].recibida || 0) + Number(e[3].recibida || 0)) * 100) / 100;
  }

  recalcularKardexFila(fila: FilaKardex): void {
    let suma = 0;
    for (const sem of fila.semanas) {
      for (const d of sem.dias) {
        suma += Number(d.cantidad) || 0;
      }
    }
    fila.totalSalidas = Math.round(suma * 10) / 10;
    fila.saldoMes = Math.max(0, Math.round(((Number(fila.cantidadEntrada) || 0) - fila.totalSalidas) * 10) / 10);
  }

  exportarPdf(formato: 'remision' | 'kardex' | 'minuta'): void {
    this.formatoImpresion = formato;
    this.imprimiendoPdf = true;

    // Disparar ventana de impresión del navegador formateada con @media print optimizado
    setTimeout(() => {
      window.print();
      this.imprimiendoPdf = false;
      this.cdr.markForCheck();
    }, 200);
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
