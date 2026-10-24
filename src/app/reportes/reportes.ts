import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TimeoutError, forkJoin, of } from 'rxjs';
import { catchError, take, timeout } from 'rxjs/operators';
import { SweetAlertService } from '../sweet-alert.service';
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

/**
 * Un registro = lo que pasó en UNA sede en UN día.
 * Es la única forma de dato que necesita el reporte global: todo lo demás
 * (totales, asistencia, platos, detalle por sede) se calcula aquí a partir de estos registros.
 */
interface RegistroDiario {
  fecha: string;          // YYYY-MM-DD
  sedeId: number;
  sede: string;           // nombre de la sede
  matriculados: number;   // estudiantes matriculados ese día
  asistieron: number;     // estudiantes que asistieron / comieron
  raciones: number;       // raciones servidas
  kilos: number;          // kg de alimento utilizados
  plato: string;          // comida servida
}

interface ResumenSede {
  id: number;
  nombre: string;
  matriculados: number;
  asistenciaPromedio: number;   // 0-100
  raciones: number;
  kilos: number;
  dias: number;                 // días con servicio en el periodo
  platoTop: string;             // plato más servido
}

interface ComidaReporte {
  plato: string;
  veces: number;
  raciones: number;
  sedes: string[];
}

interface TotalesReporte {
  sedes: number;
  matriculados: number;
  asistencia: number;
  raciones: number;
  kilos: number;
  dias: number;
  platos: number;
}

type ColumnaSede = 'nombre' | 'matriculados' | 'asistenciaPromedio' | 'raciones' | 'kilos' | 'dias';

/** Si el servidor no responde en este tiempo, se muestra un error en vez de quedarse cargando */
const TIEMPO_MAXIMO_MS = 20000;

/** Convierte cualquier valor (incluso null o undefined) en texto, sin fallar */
const texto = (valor: unknown): string => (valor === null || valor === undefined ? '' : String(valor));

@Component({
  selector: 'app-reportes-consumo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html',
})
export class Reportes implements OnInit {
  // ===================== SALIDAS DE INVENTARIO (datos reales) =====================
  salidas: SalidaPresentacion[] = [];
  cargando = true;
  errorMensaje = '';
  fechaDesde = '';
  fechaHasta = '';

  // ===================== REPORTE GLOBAL DE SEDES =====================
  registros: RegistroDiario[] = [];
  avisoEjemplo = '';
  sedeFiltro = 'Todas';
  ordenColumna: ColumnaSede = 'raciones';
  ordenDireccion: 'asc' | 'desc' = 'desc';
  sedeDetalle: ResumenSede | null = null;

  private versionDatos = 0;
  private cache: { clave: string; resumen: ResumenSede[]; comidas: ComidaReporte[]; totales: TotalesReporte } | null = null;

  constructor(
    private readonly inventarioService: InventarioOperativoService,
    private readonly alertas: SweetAlertService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  // Esc cierra el detalle de la sede
  @HostListener('document:keydown.escape')
  alPresionarEsc(): void {
    if (this.sedeDetalle) this.cerrarSede();
  }

  cargar(): void {
    this.cargando = true;
    this.errorMensaje = '';

    // Reporte global de sedes (estudiantes y comidas)
    this.cargarRegistros();

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
    }).subscribe({
      next: ({ salidas, ingredientes, unidades }) => {
        this.salidas = salidas
          .map(salida => this.presentar(salida, ingredientes, unidades))
          // Lo más reciente primero
          .sort((a, b) => texto(b.fecha).localeCompare(texto(a.fecha)));
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
  //  REPORTE GLOBAL DE SEDES
  // =====================================================

  /**
   * Carga los registros diarios por sede (asistencia + comida servida).
   *
   * ► PARA USAR DATOS REALES: reemplaza el cuerpo de este método por la llamada a tu backend.
   *   Cada elemento debe tener la forma de RegistroDiario (fecha, sedeId, sede, matriculados,
   *   asistieron, raciones, kilos, plato). Ejemplo (inyecta HttpClient y environment):
   *
   *     this.http.get<RegistroDiario[]>(`${environment.apiUrl}/reportes/sedes/`).subscribe(datos => {
   *       this.registros = datos;
   *       this.avisoEjemplo = '';
   *       this.versionDatos++;
   *       this.cdr.markForCheck();
   *     });
   *
   *   Todo lo demás (totales, asistencia, platos, detalle por sede, filtros, orden y CSV) ya funciona
   *   sobre esos registros y no hay que tocarlo.
   */
  private cargarRegistros(): void {
    this.registros = this.generarRegistrosEjemplo();
    this.avisoEjemplo = 'Estás viendo datos de ejemplo. Conecta cargarRegistros() al servidor (en reportes.ts) para ver los datos reales de tus sedes.';
    this.versionDatos++;
  }

  /** Datos de ejemplo: 30 días hábiles para 2 sedes (estables, no cambian al recargar) */
  private generarRegistrosEjemplo(): RegistroDiario[] {
    const sedes = [
      { id: 1, nombre: 'Institucion educativa la Milagrosa', matriculados: 420, base: 90 },
      { id: 2, nombre: 'Liceo de Occidente',                  matriculados: 310, base: 80 },
    ];
    const platos = ['Arroz con pollo', 'Frijoles con arroz', 'Pasta con carne molida', 'Lentejas con plátano', 'Sancocho de res'];

    const lista: RegistroDiario[] = [];
    const hoy = new Date();
    let indice = 0;
    for (let atras = 0; atras < 42; atras++) {
      const dia = new Date(hoy);
      dia.setDate(hoy.getDate() - atras);
      if (dia.getDay() === 0 || dia.getDay() === 6) continue;   // sin fines de semana
      indice++;

      for (const sede of sedes) {
        const variacion = ((indice * 7 + sede.id * 13) % 11) - 5;                 // -5 a +5 puntos
        const porcentaje = Math.min(100, Math.max(60, sede.base + variacion));
        const asistieron = Math.round(sede.matriculados * porcentaje / 100);
        lista.push({
          fecha: this.isoDe(dia),
          sedeId: sede.id,
          sede: sede.nombre,
          matriculados: sede.matriculados,
          asistieron,
          raciones: asistieron,
          kilos: Math.round(asistieron * 0.165 * 100) / 100,
          plato: platos[(indice + sede.id) % platos.length],
        });
      }
    }
    return lista;
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

  get sedesDisponibles(): string[] {
    return Array.from(new Set(this.registros.map(r => r.sede))).sort((a, b) => a.localeCompare(b, 'es'));
  }

  private get registrosFiltrados(): RegistroDiario[] {
    return this.registros.filter(r =>
      (!this.fechaDesde || r.fecha >= this.fechaDesde) &&
      (!this.fechaHasta || r.fecha <= this.fechaHasta) &&
      (this.sedeFiltro === 'Todas' || r.sede === this.sedeFiltro)
    );
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
  get comidasFiltradas(): ComidaReporte[] { return this.calculo.comidas; }
  get totales(): TotalesReporte { return this.calculo.totales; }

  private calcular(clave: string) {
    const registros = this.registrosFiltrados;

    // Resumen por sede
    const porSede = new Map<number, RegistroDiario[]>();
    for (const r of registros) {
      const lista = porSede.get(r.sedeId) ?? [];
      lista.push(r);
      porSede.set(r.sedeId, lista);
    }
    const dir = this.ordenDireccion === 'asc' ? 1 : -1;
    const resumen = Array.from(porSede.values())
      .map(lista => this.resumirSede(lista))
      .sort((a, b) => {
        const x = a[this.ordenColumna];
        const y = b[this.ordenColumna];
        return (typeof x === 'string' ? x.localeCompare(String(y), 'es') : (x as number) - (y as number)) * dir;
      });

    // Comidas servidas
    const porPlato = new Map<string, { veces: number; raciones: number; sedes: Set<string> }>();
    for (const r of registros) {
      const p = porPlato.get(r.plato) ?? { veces: 0, raciones: 0, sedes: new Set<string>() };
      p.veces++;
      p.raciones += r.raciones;
      p.sedes.add(r.sede);
      porPlato.set(r.plato, p);
    }
    const comidas: ComidaReporte[] = Array.from(porPlato.entries())
      .map(([plato, p]) => ({ plato, veces: p.veces, raciones: p.raciones, sedes: Array.from(p.sedes) }))
      .sort((a, b) => b.veces - a.veces || b.raciones - a.raciones);

    // Totales
    const matriculadosDia = registros.reduce((suma, r) => suma + r.matriculados, 0);
    const asistieron = registros.reduce((suma, r) => suma + r.asistieron, 0);
    const totales: TotalesReporte = {
      sedes: resumen.length,
      matriculados: resumen.reduce((suma, s) => suma + s.matriculados, 0),
      asistencia: matriculadosDia > 0 ? Math.round(asistieron / matriculadosDia * 100) : 0,
      raciones: registros.reduce((suma, r) => suma + r.raciones, 0),
      kilos: this.redondear(registros.reduce((suma, r) => suma + r.kilos, 0)),
      dias: new Set(registros.map(r => r.fecha)).size,
      platos: comidas.length,
    };

    return { clave, resumen, comidas, totales };
  }

  private resumirSede(lista: RegistroDiario[]): ResumenSede {
    const ultimo = lista.reduce((a, b) => (b.fecha > a.fecha ? b : a));
    const matriculadosDia = lista.reduce((suma, r) => suma + r.matriculados, 0);
    const asistieron = lista.reduce((suma, r) => suma + r.asistieron, 0);

    const conteo = new Map<string, number>();
    lista.forEach(r => conteo.set(r.plato, (conteo.get(r.plato) ?? 0) + 1));
    const platoTop = Array.from(conteo.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return {
      id: ultimo.sedeId,
      nombre: ultimo.sede,
      matriculados: ultimo.matriculados,
      asistenciaPromedio: matriculadosDia > 0 ? Math.round(asistieron / matriculadosDia * 100) : 0,
      raciones: lista.reduce((suma, r) => suma + r.raciones, 0),
      kilos: this.redondear(lista.reduce((suma, r) => suma + r.kilos, 0)),
      dias: new Set(lista.map(r => r.fecha)).size,
      platoTop,
    };
  }

  // Ancho de la barra de cada plato (el más servido = 100%)
  porcentajeVeces(veces: number): number {
    const max = Math.max(1, ...this.comidasFiltradas.map(c => c.veces));
    return Math.round(veces / max * 100);
  }

  claseAsistencia(porcentaje: number): string {
    return porcentaje >= 85 ? 'bg-emerald-500' : porcentaje >= 70 ? 'bg-amber-500' : 'bg-red-500';
  }

  trackSede = (_: number, s: ResumenSede) => s.id;
  trackComida = (_: number, c: ComidaReporte) => c.plato;
  trackRegistro = (_: number, r: RegistroDiario) => `${r.fecha}-${r.sedeId}-${r.plato}`;

  // ---------- Detalle de una sede (ventana emergente) ----------

  abrirSede(sede: ResumenSede): void {
    this.sedeDetalle = sede;
  }

  cerrarSede(): void {
    this.sedeDetalle = null;
  }

  // Días de la sede elegida dentro de las fechas del filtro (lo más reciente primero)
  get registrosSede(): RegistroDiario[] {
    if (!this.sedeDetalle) return [];
    const id = this.sedeDetalle.id;
    return this.registros
      .filter(r => r.sedeId === id &&
        (!this.fechaDesde || r.fecha >= this.fechaDesde) &&
        (!this.fechaHasta || r.fecha <= this.fechaHasta))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  // Platos de la sede elegida, del más servido al menos servido
  get comidasSede(): { plato: string; veces: number; raciones: number }[] {
    const mapa = new Map<string, { veces: number; raciones: number }>();
    for (const r of this.registrosSede) {
      const p = mapa.get(r.plato) ?? { veces: 0, raciones: 0 };
      p.veces++;
      p.raciones += r.raciones;
      mapa.set(r.plato, p);
    }
    return Array.from(mapa.entries())
      .map(([plato, p]) => ({ plato, ...p }))
      .sort((a, b) => b.veces - a.veces);
  }

  porcentajeAsistencia(r: RegistroDiario): number {
    return r.matriculados > 0 ? Math.round(r.asistieron / r.matriculados * 100) : 0;
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
      ['Sede', 'Matriculados', 'Asistencia promedio (%)', 'Raciones servidas', 'Kg utilizados', 'Días de servicio', 'Plato más servido'],
      ...sedes.map(s => [s.nombre, s.matriculados, s.asistenciaPromedio, s.raciones, s.kilos, s.dias, s.platoTop].map(texto)),
      ['TOTAL', t.matriculados, t.asistencia, t.raciones, t.kilos, t.dias, ''].map(texto),
    ]);
    void this.alertas.success('Reporte exportado', 'Se descargó el resumen por sede.');
  }

  // Día a día de la sede abierta
  exportarCsvSede(): void {
    const sede = this.sedeDetalle;
    const filas = this.registrosSede;
    if (!sede || filas.length === 0) {
      void this.alertas.warning('Sin registros', 'Esta sede no tiene días en el rango seleccionado.');
      return;
    }
    this.descargarCsv(`sede-${sede.id}-${this.hoyISO()}.csv`, [
      ['Fecha', 'Sede', 'Plato', 'Matriculados', 'Asistieron', 'Asistencia (%)', 'Raciones', 'Kg utilizados'],
      ...filas.map(r => [r.fecha, r.sede, r.plato, r.matriculados, r.asistieron, this.porcentajeAsistencia(r), r.raciones, r.kilos].map(texto)),
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

  // Con ";" Excel en español separa bien las columnas
  private descargarCsv(nombreArchivo: string, filas: string[][]): void {
    const contenido = filas
      .map(fila => fila.map(valor => `"${valor.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const url = URL.createObjectURL(new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}