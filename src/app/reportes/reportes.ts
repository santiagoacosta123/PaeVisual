import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, TimeoutError, forkJoin, of } from 'rxjs';
import { catchError, take, timeout } from 'rxjs/operators';
import { AuthService, InstitucionAsignada } from '@core/auth';
import { SweetAlertService } from '../sweet-alert.service';
import { Entrega, EntregasService } from '../features/entregas/services/entregas.service';
import { SiraeService } from '../features/contratos/services/contratos_pae.service';
import {
  IngredienteInventario,
  InventarioOperativoService,
  SalidaInventarioRegistro,
  UnidadInventario,
} from '../services/inventario-operativo.service';

interface SalidaPresentacion extends SalidaInventarioRegistro {
  ingrediente: string;
  unidad: string;
}

/** Una sede de la institución con los cupos de sus contratos vigentes */
interface SedeBase {
  id: number;
  nombre: string;
  cupos: number;
}

/**
 * Una entrega de alimentos ya asignada a una sede. Es la única forma de dato del reporte de sedes:
 * totales, tabla por sede, detalle y CSV se calculan a partir de estas filas.
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
  kilos: number;            // kg efectivamente recibidos (0 si no es peso, está en tránsito o fue rechazada)
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

/** Convierte cualquier valor (incluso null o undefined) en texto, sin fallar */
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
})
export class Reportes implements OnInit, OnDestroy {
  // ===================== SALIDAS DE INVENTARIO (datos reales) =====================
  salidas: SalidaPresentacion[] = [];
  cargando = true;
  errorMensaje = '';
  fechaDesde = '';
  fechaHasta = '';

  // ===================== REPORTE DE SEDES (sedes + cupos + entregas) =====================
  institucionActiva: InstitucionAsignada | null = null;
  sedesBase: SedeBase[] = [];
  entregas: EntregaSede[] = [];
  avisoDatos = '';
  sedeFiltro: 'Todas' | number = 'Todas';
  ordenColumna: ColumnaSede = 'kilos';
  ordenDireccion: 'asc' | 'desc' = 'desc';
  sedeDetalle: ResumenSede | null = null;

  private versionDatos = 0;
  private suscripcion?: Subscription;
  private cache: { clave: string; resumen: ResumenSede[]; totales: TotalesReporte } | null = null;

  constructor(
    private readonly inventarioService: InventarioOperativoService,
    private readonly entregasService: EntregasService,
    private readonly sirae: SiraeService,
    private readonly auth: AuthService,
    private readonly alertas: SweetAlertService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Emite al abrir la pantalla y cada vez que el supervisor cambia de institución
    this.suscripcion = this.auth.institucionActiva$.subscribe(institucion => {
      const cambio = institucion?.id_institucion !== this.institucionActiva?.id_institucion;
      this.institucionActiva = institucion;
      if (cambio) {
        this.sedeFiltro = 'Todas';
        this.sedeDetalle = null;
      }
      this.cargar();
    });
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  // Esc cierra el detalle de la sede
  @HostListener('document:keydown.escape')
  alPresionarEsc(): void {
    if (this.sedeDetalle) this.cerrarSede();
  }

  cargar(): void {
    this.cargando = true;
    this.errorMensaje = '';
    const idInstitucion = this.institucionActiva?.id_institucion;
    const fallos: string[] = [];

    // Lo que no sea indispensable no rompe el reporte: si falla, se avisa y se sigue con lo demás
    const opcional = <T>(nombre: string) => catchError<T, Observable<null>>((error: unknown) => {
      console.warn(`No se pudo cargar ${nombre} para el reporte:`, error);
      fallos.push(nombre);
      return of(null);
    });

    forkJoin({
      // Las salidas son lo único indispensable: si fallan, se muestra el error
      salidas: this.inventarioService.cargarSalidas().pipe(take(1), timeout(TIEMPO_MAXIMO_MS)),
      // Si fallan los nombres de ingredientes o unidades, el reporte igual se muestra
      ingredientes: this.inventarioService.cargarIngredientes().pipe(
        take(1),
        timeout(TIEMPO_MAXIMO_MS),
        catchError((error: unknown) => {
          console.warn('No se pudieron cargar los ingredientes del reporte:', error);
          return of<IngredienteInventario[]>([]);
        }),
      ),
      unidades: this.inventarioService.cargarUnidades().pipe(
        take(1),
        timeout(TIEMPO_MAXIMO_MS),
        catchError((error: unknown) => {
          console.warn('No se pudieron cargar las unidades del reporte:', error);
          return of<UnidadInventario[]>([]);
        }),
      ),
      // Reporte de sedes: sedes de la institución, cupos de los contratos y entregas de alimentos
      sedes: this.sirae.getSedes(idInstitucion).pipe(take(1), timeout(TIEMPO_MAXIMO_MS), opcional<any[]>('las sedes')),
      contratos: this.sirae.getContratos().pipe(take(1), timeout(TIEMPO_MAXIMO_MS), opcional<any[]>('los contratos')),
      entregas: this.entregasService.cargar().pipe(take(1), timeout(TIEMPO_MAXIMO_MS), opcional<Entrega[]>('las entregas')),
    }).subscribe({
      next: ({ salidas, ingredientes, unidades, sedes, contratos, entregas }) => {
        this.salidas = salidas
          .map(salida => this.presentar(salida, ingredientes, unidades))
          // Lo más reciente primero
          .sort((a, b) => texto(b.fecha).localeCompare(texto(a.fecha)));

        this.armarReporteSedes(sedes, contratos, entregas, fallos);
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error al consultar salidas de inventario:', error);
        this.cargando = false;
        this.salidas = [];

        const estado = error instanceof HttpErrorResponse ? error.status : 0;
        this.errorMensaje = error instanceof TimeoutError
          ? 'El servidor tardó demasiado en responder. Intenta nuevamente.'
          : estado === 401
            ? 'La sesión expiró. Inicia sesión nuevamente para consultar el reporte.'
            : estado === 403
              ? 'Tu usuario no tiene permiso para consultar las salidas de inventario.'
              : 'No se pudieron cargar las salidas. Verifica la conexión e intenta nuevamente.';
        this.cdr.markForCheck();
        void this.alertas.error('No se pudo cargar el reporte', this.errorMensaje);
      },
    });
  }

  get salidasFiltradas(): SalidaPresentacion[] {
    return this.salidas.filter(salida => {
      const fecha = texto(salida.fecha).slice(0, 10);
      return (!this.fechaDesde || fecha >= this.fechaDesde)
        && (!this.fechaHasta || fecha <= this.fechaHasta);
    });
  }

  get totalMovimientos(): number {
    return this.salidasFiltradas.length;
  }

  exportarCsv(): void {
    if (this.salidasFiltradas.length === 0) {
      void this.alertas.warning('Sin registros', 'No hay salidas para exportar en el rango seleccionado.');
      return;
    }

    this.descargarCsv('reporte-salidas-inventario.csv', [
      ['Fecha', 'Ingrediente', 'Cantidad', 'Unidad', 'Observaciones'],
      ...this.salidasFiltradas.map(salida => [
        texto(salida.fecha),
        salida.ingrediente,
        texto(salida.cantidad),
        salida.unidad,
        texto(salida.observaciones),
      ]),
    ]);
    void this.alertas.success('Reporte exportado', 'Se descargaron las salidas registradas del rango seleccionado.');
  }

  private presentar(
    salida: SalidaInventarioRegistro,
    ingredientes: IngredienteInventario[],
    unidades: UnidadInventario[],
  ): SalidaPresentacion {
    // Se comparan como texto por si un lado trae el id como número y el otro como texto
    const ingrediente = ingredientes.find(item => texto(item.id) === texto(salida.ingredienteId));
    const unidad = unidades.find(item => texto(item.id) === texto(salida.unidadId));

    return {
      ...salida,
      ingrediente: ingrediente?.nombre || `Ingrediente ${texto(salida.ingredienteId)}`,
      unidad: unidad ? `${unidad.nombre} (${unidad.abreviatura})` : `Unidad ${texto(salida.unidadId)}`,
    };
  }

  // =====================================================
  //  REPORTE DE SEDES
  // =====================================================

  /**
   * Une las tres fuentes (sedes, contratos y entregas) en las dos listas que usa el reporte.
   * Cualquiera puede venir en null si su consulta falló: en ese caso se avisa y se usa lo que haya.
   */
  private armarReporteSedes(sedes: any[] | null, contratos: any[] | null, entregas: Entrega[] | null, fallos: string[]): void {
    const idInstitucion = this.institucionActiva?.id_institucion;

    // 1) Sedes de la institución (si la consulta falló, las que ya trae la institución activa)
    let origen = listaDe(sedes);
    if (origen.length === 0) origen = listaDe(this.institucionActiva?.sedes);
    const mapaSedes = new Map<number, SedeBase>();
    for (const item of origen) {
      const id = Number(item.id_sede ?? item.id);
      if (!id) continue;
      mapaSedes.set(id, { id, nombre: texto(item.nombre_sede ?? item.nombre) || `Sede ${id}`, cupos: 0 });
    }

    // 2) Cupos: suma de los contratos vigentes de cada sede
    for (const contrato of listaDe(contratos)) {
      const idSede = Number(contrato.id_sede);
      if (!idSede || !this.contratoVigente(contrato)) continue;
      if (idInstitucion && Number(contrato.id_institucion) !== idInstitucion && !mapaSedes.has(idSede)) continue;
      const sede = mapaSedes.get(idSede);
      if (sede) sede.cupos += Number(contrato.cupos) || 0;
    }

    // 3) Entregas de la institución que sí tienen sede
    const delaInstitucion = (entregas ?? []).filter(e =>
      !idInstitucion || e.idInstitucion === idInstitucion || (e.idSede !== undefined && mapaSedes.has(e.idSede)));
    const sinSede = delaInstitucion.filter(e => !e.idSede).length;
    const conSede = delaInstitucion.filter(e => !!e.idSede);

    // Si una entrega es de una sede que no llegó en la lista, la sede se agrega para no perder datos
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
    // Solo cuenta lo que ya se recibió, y solo si se mide en kilos
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

  // ---------- Filtros ----------

  // Botones rápidos: últimos N días, o null para ver todo
  rango(dias: number | null): void {
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

  /** Entregas dentro de las fechas del filtro (todas las sedes) */
  private get entregasEnFechas(): EntregaSede[] {
    return this.entregas.filter(e =>
      (!this.fechaDesde || e.fecha >= this.fechaDesde) &&
      (!this.fechaHasta || e.fecha <= this.fechaHasta));
  }

  // ---------- Orden de la tabla ----------

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

  // ---------- Cálculos (se guardan hasta que cambie un filtro, el orden o los datos) ----------

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

  // ---------- Estado de una entrega ----------

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

  // ---------- Detalle de una sede (ventana emergente) ----------

  abrirSede(sede: ResumenSede): void {
    this.sedeDetalle = sede;
  }

  cerrarSede(): void {
    this.sedeDetalle = null;
  }

  // Entregas de la sede elegida dentro de las fechas del filtro (lo más reciente primero)
  get entregasSede(): EntregaSede[] {
    if (!this.sedeDetalle) return [];
    const id = this.sedeDetalle.id;
    return this.entregasEnFechas
      .filter(e => e.sedeId === id)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }

  // Ingredientes de la sede elegida, del más entregado al menos entregado
  get ingredientesSede(): { ingrediente: string; veces: number }[] {
    const mapa = new Map<string, number>();
    for (const e of this.entregasSede) mapa.set(e.ingrediente, (mapa.get(e.ingrediente) ?? 0) + 1);
    return Array.from(mapa.entries())
      .map(([ingrediente, veces]) => ({ ingrediente, veces }))
      .sort((a, b) => b.veces - a.veces);
  }

  // ---------- Exportar ----------

  // Resumen por sede (respeta fechas y filtro de sede)
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

  // Entregas de la sede abierta
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

  // ---------- Utilidades ----------

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

  private hoyISO(): string {
    return this.isoDe(new Date());
  }

  // Con ";" Excel en español separa bien las columnas.
  // Si un texto empieza con = + @ (o - seguido de letra) Excel lo tomaría como fórmula: se le antepone un apóstrofo.
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