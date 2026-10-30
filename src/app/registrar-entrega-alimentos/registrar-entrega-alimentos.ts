import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SweetAlertService } from '../sweet-alert.service';
import { EntregasService } from '../services/entregas.service';
import { AuthService, InstitucionAsignada } from '../core/auth/auth.service';

// ===================== TIPOS =====================
interface IngredienteOpcion { id: number; nombre: string; }
interface TipoMercadoOpcion { id: number; nombre: string; }


interface FilaEntrega {
  id?: number;
  idIngrediente: number | null;
  idTipoMercado: number | null;
  ingrediente: string;
  tipoMercado: string;
  categoria: 'Granos' | 'Perecederos';
  frecuencia: string;
  cantidad: number;
  unidad: string;
  fechaRecepcion: string;      // YYYY-MM-DD
  fechaVencimiento: string;    // YYYY-MM-DD

  codigo?: string;
  lote?: string;
  destino?: string;
  hora?: string;
  responsable?: string;
  estadoEntrega?: string;
}

interface ProductoCatalogo {
  id: number;
  nombre: string;
  categoria: string;
  unidad: string;
  idTipoMercado: number | null;
}

interface SubgrupoMenu {
  nombre: string;                 // '' si la categoría no tiene subgrupos
  productos: ProductoCatalogo[];
}

interface GrupoPagina {
  nombre: string;
  emoji: string;
  total: number;                  // productos de la categoría con los filtros actuales
  subgrupos: SubgrupoMenu[];
}

interface DiaCalendario {
  iso: string;
  numero: number;
  enMes: boolean;
  esHoy: boolean;
  seleccionado: boolean;
  entregas: number;
  estado: 'Vigente' | 'Próximo a vencer' | 'Vencido' | null;
  vencen: number;
}

interface RegistroDia {
  codigo: string;
  descripcion: string;
  estado: string;
  destino: string;
  hora: string;
  responsable: string;
  items: FilaEntrega[];
}

interface EntradaFila {
  idIngrediente: number | null;
  cantidad: number | null;
  unidad: string;
  perecedero: boolean;
}

interface EnvioDestino {
  idInstitucion: number;
  idSede?: number;
  institucion: string;
  cantidad: number | null;
}

interface EnvioRegistro {
  id: number;
  idInstitucion: number | null;
  ingrediente: string;
  cantidad: number;
  unidad: string;
  destino: string;
  fechaSalida: string;
  fechaEntrega: string;
  enviadoEl: string;
}

interface ReferenciaInstitucion {
  id?: number | string;
  id_institucion?: number | string;
  id_sede?: number | string;
  nombre?: string;
  nombre_institucion?: string;
  nombre_ingrediente?: string;
}

interface RegistroEntregaEnvio {
  id_entrega?: number | string;
  id?: number | string;
  id_institucion?: number | string | ReferenciaInstitucion | null;
  id_sede?: number | string | ReferenciaInstitucion | null;
  institucion?: string | ReferenciaInstitucion | null;
  sede?: string | ReferenciaInstitucion | null;
  institucion_nombre?: string | null;
  sede_nombre?: string | null;
  destino_nombre?: string | null;
  destino?: string | null;
  ingrediente_nombre?: string | null;
  ingrediente?: string | ReferenciaInstitucion | null;
  cantidad?: number | string | null;
  unidad?: string | null;
  fecha_salida?: string | null;
  fecha_entrega?: string | null;
  created_at?: string | null;
  fecha_creacion?: string | null;
}

interface CategoriaOpcion {
  nombre: string;
  emoji: string;
  total: number;
}

// Lo que se muestra en cada tarjeta deslizable del menú
interface ResumenProducto {
  cantidad: number;           // cantidad de la última entrada
  unidad: string;
  fechaIngreso: string;
  fechaVencimiento: string;
  estado: string;             // Vigente | Próximo a vencer | Vencido
  textoVence: string;         // "Vence en 5 días"
  totalRecibido: number;      // suma de las entradas con la misma unidad
  entradas: number;
}

type FiltroMercado = 'Todos' | 'Granos' | 'Perecederos';

@Component({
  selector: 'app-registrar-entrega-alimentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registrar-entrega-alimentos.html',
  styleUrls: ['./registrar-entrega-alimentos.css'],
})
export class RegistrarEntregaAlimentosComponent implements OnInit, OnDestroy {

  // ===================== CATÁLOGOS =====================
  ingredientes: IngredienteOpcion[] = [];
  tiposMercado: TipoMercadoOpcion[] = [];
  cargandoCatalogos = true;
  errorMensaje = '';
  errorCatalogos = '';

  // Productos base: se usan si el servidor no devuelve ingredientes.
  // IMPORTANTE: para poder GUARDAR, estos ids deben existir en la tabla de ingredientes del backend.
  private readonly productosBase: IngredienteOpcion[] = [
    { id: 1,  nombre: 'Arroz' },
    { id: 2,  nombre: 'Frijol' },
    { id: 3,  nombre: 'Lentejas' },
    { id: 4,  nombre: 'Pasta' },
    { id: 5,  nombre: 'Harina de maíz' },
    { id: 6,  nombre: 'Azúcar' },
    { id: 7,  nombre: 'Sal' },
    { id: 8,  nombre: 'Aceite' },
    { id: 9,  nombre: 'Panela' },
    { id: 10, nombre: 'Avena' },
    { id: 11, nombre: 'Leche' },
    { id: 12, nombre: 'Huevos' },
    { id: 13, nombre: 'Pollo' },
    { id: 14, nombre: 'Carne de res' },
    { id: 15, nombre: 'Papa' },
    { id: 16, nombre: 'Yuca' },
    { id: 17, nombre: 'Plátano' },
    { id: 18, nombre: 'Zanahoria' },
    { id: 19, nombre: 'Tomate' },
    { id: 20, nombre: 'Cebolla' },
  ];

  private readonly tiposBase: TipoMercadoOpcion[] = [
    { id: 1, nombre: 'Perecedero' },
    { id: 2, nombre: 'No perecedero' },
  ];

  private readonly unidadPorDefecto: Record<string, string> = {
    'Aceite': 'Litros', 'Leche': 'Litros', 'Huevos': 'Unidades',
  };

  private readonly claveCacheIngredientes = 'sirae_cache_ingredientes';
  private readonly claveCacheTipos = 'sirae_cache_tipos_mercado';

  // ===================== HISTORIAL (entradas y envíos) =====================
  // Si te da error 404 al cargar, usa la misma ruta que registrar() en entregas.service.ts
  private readonly urlEntregas = `${environment.apiUrl}/entregas/`;

  cargandoHistorial = false;
  errorHistorial = false;

  private entregasRaw: any[] = [];     // solo ENTRADAS de inventario (sin fecha_salida)
  historial: FilaEntrega[] = [];       // entradas ya convertidas en filas
  historialEnvios: EnvioRegistro[] = [];
  readonly destinosEnvioSeleccionados = new Set<string>();

  // ===================== INSTITUCIÓN ACTIVA =====================
  institucionActiva: InstitucionAsignada | null = null;
  idInstitucion: number | null = null;
  idSede: number | null = null;          // viene de "Entregas" en Mis sedes (?sede=ID)
  ahoraTexto = '';
  private subInstitucion?: Subscription;
  private subRuta?: Subscription;
  private reloj?: ReturnType<typeof setInterval>;

  // ===================== FILTROS Y MENÚ =====================
  textoFiltro = '';
  filtroMercado: FiltroMercado = 'Todos';
  categoriaMenu = 'Todos';

  // ===================== PAGINACIÓN DEL MENÚ =====================
  paginaActual = 1;
  readonly porPagina = 4;

  constructor(
    private entregasService: EntregasService,
    private alertas: SweetAlertService,
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Pinta al instante con la caché (o con los productos base) y se actualiza cuando llega el servidor
    this.ingredientes = this.leerCache<IngredienteOpcion[]>(this.claveCacheIngredientes) ?? this.productosBase;
    this.tiposMercado = this.leerCache<TipoMercadoOpcion[]>(this.claveCacheTipos) ?? this.tiposBase;

    this.institucionActiva = this.authService.obtenerInstitucionActiva();
    const usuario = this.authService.obtenerUsuario();
    this.idInstitucion = this.institucionActiva?.id_institucion ?? usuario?.id_institucion ?? null;

    this.subInstitucion = this.authService.institucionActiva$.subscribe(institucion => {
      const idAnterior = this.idInstitucion;
      this.institucionActiva = institucion;
      this.idInstitucion = institucion?.id_institucion ?? this.authService.obtenerUsuario()?.id_institucion ?? null;
      if (idAnterior !== this.idInstitucion) this.cargarHistorial();
      this.cdr.markForCheck();
    });

    this.subRuta = this.route.queryParamMap.subscribe(params => {
      const sede = Number(params.get('sede'));
      const idSede = Number.isInteger(sede) && sede > 0 ? sede : null;
      if (idSede !== this.idSede) {
        this.idSede = idSede;
        this.cargarHistorial();
      }
      this.cdr.markForCheck();
    });

    this.actualizarReloj();
    this.reloj = setInterval(() => {
      this.actualizarReloj();
      this.cdr.markForCheck();
    }, 60_000);

    this.cargarHistorial();
    this.cargarCatalogos();
  }

  ngOnDestroy(): void {
    this.subInstitucion?.unsubscribe();
    this.subRuta?.unsubscribe();
    if (this.reloj !== undefined) clearInterval(this.reloj);
  }

  // Esc cierra la ventana abierta
  @HostListener('document:keydown.escape')
  alPresionarEsc(): void {
    if (this.envioProducto) { this.cerrarModalEnvio(); return; }
    if (this.mostrarModalEntrada && !this.guardandoEntrada) { this.cerrarModalEntrada(); return; }
    if (this.modalDiaAbierto) this.cerrarModalDia();
  }

  // ===================== DATOS DE LA INSTITUCIÓN =====================
  get nombreInstitucion(): string {
    const usuario = this.authService.obtenerUsuario();
    return this.institucionActiva?.nombre_institucion
      ?? usuario?.institucion_nombre
      ?? usuario?.institucion
      ?? 'Institución';
  }

  get nombreSede(): string {
    const sede = this.institucionActiva?.sedes?.find(item =>
      Number(item.id_sede ?? item.id) === this.idSede,
    );
    return sede?.nombre_sede ?? '';
  }

  get destinosDisponibles(): string[] {
    if (this.idInstitucion === null) return [];
    const institucion = this.nombreInstitucion;
    const sedes = this.institucionActiva?.sedes ?? [];
    if (this.idSede !== null) {
      const sedeActiva = sedes.find(item => Number(item.id_sede ?? item.id) === this.idSede);
      return sedeActiva?.nombre_sede ? [`${institucion} - ${sedeActiva.nombre_sede}`] : [institucion];
    }
    return [
      institucion,
      ...sedes
        .filter(item => item.nombre_sede)
        .map(item => `${institucion} - ${item.nombre_sede}`),
    ];
  }

  // Entradas registradas desde "Entradas" (tienen destino o responsable)
  get entradasHistorial(): FilaEntrega[] {
    return this.historial.filter(entrega => !!entrega.destino || !!entrega.responsable);
  }

  private actualizarReloj(): void {
    this.ahoraTexto = new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  // ===================== CACHÉ LOCAL =====================
  private guardarCache<T>(clave: string, datos: T): void {
    try {
      localStorage.setItem(clave, JSON.stringify(datos));
    } catch (error) {
      console.warn(`No se pudo guardar la caché "${clave}".`, error);
    }
  }

  private leerCache<T>(clave: string): T | null {
    try {
      const valor = JSON.parse(localStorage.getItem(clave) || 'null');
      return Array.isArray(valor) && valor.length > 0 ? (valor as T) : null;
    } catch {
      return null;
    }
  }

  // ===================== UTILIDADES =====================
  private datosInstitucion(destino?: string): { id_institucion?: number; id_sede?: number } {
    const institucionActiva = this.institucionActiva?.id_institucion ?? this.idInstitucion ?? undefined;
    const destinoSeleccionado = destino ?? this.entradaDestino;
    const sede = this.institucionActiva?.sedes?.find(item =>
      destinoSeleccionado.endsWith(` - ${item.nombre_sede}`),
    );
    const idSede = sede ? Number(sede.id_sede ?? sede.id) : this.idSede ?? undefined;
    return {
      ...(institucionActiva !== undefined ? { id_institucion: institucionActiva } : {}),
      ...(idSede !== undefined ? { id_sede: idSede } : {}),
    };
  }

  private soloDeInstitucion(lista: any[]): any[] {
    return lista.filter(item => {
      const referenciaInstitucion = item.id_institucion
        ?? (typeof item.institucion === 'object' && item.institucion !== null
          ? item.institucion.id_institucion ?? item.institucion.id
          : item.institucion);
      if (this.idInstitucion !== null && referenciaInstitucion != null
        && Number(referenciaInstitucion) !== this.idInstitucion) return false;

      if (this.idSede !== null) {
        const referenciaSede = item.id_sede
          ?? (typeof item.sede === 'object' && item.sede !== null
            ? item.sede.id_sede ?? item.sede.id
            : item.sede);
        if (referenciaSede != null) return Number(referenciaSede) === this.idSede;
        const destino = typeof item.destino === 'string' ? item.destino : '';
        if (destino.includes(' - ')) {
          return this.normalizarNombre(destino).endsWith(this.normalizarNombre(` - ${this.nombreSede}`));
        }
        return false;
      }
      return true;
    });
  }

  private normalizarNombre(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  // Un envío es una entrega con fecha de salida; el resto son entradas de inventario.
  // El backend debe guardar y devolver "fecha_salida".
  private esEnvio(item: any): boolean {
    return !!item?.fecha_salida;
  }

  // Acepta texto o un objeto { nombre }. Un número (id) no es un nombre.
  private texto(valor: any): string {
    if (valor == null) return '';
    if (typeof valor === 'object') return String(valor.nombre ?? valor.name ?? '');
    if (typeof valor === 'number') return '';
    return String(valor);
  }

  private soloFecha(valor: any): string {
    return String(valor ?? '').substring(0, 10);
  }

  // "7:50 a. m." a partir de "07:50:00" o de una fecha ISO con hora
  private horaDe(valor: any): string {
    const s = String(valor ?? '');
    if (!s) return '';
    const d = s.includes('T') ? new Date(s) : new Date(`1970-01-01T${s}`);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  private nombreReferencia(valor: string | number | ReferenciaInstitucion | null | undefined): string {
    if (typeof valor === 'string') return valor;
    if (typeof valor !== 'object' || valor === null) return '';
    return valor.nombre_institucion ?? valor.nombre ?? valor.nombre_ingrediente ?? '';
  }

  private normalizarUnidad(valor: string): string {
    const u = (valor || '').toLowerCase();
    if (u.includes('kg') || u.includes('kilo')) return 'Kg';
    if (u.includes('lit') || u === 'l') return 'Litros';
    if (u.includes('unid') || u === 'ud') return 'Unidades';
    return valor || '';
  }

  private aISO(d: Date): string {
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private isoDeFecha(d: Date): string {
    return this.aISO(d);
  }

  private primerDiaDelMes(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private sumarDiasISO(iso: string, dias: number): string {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return this.aISO(d);
  }

  private diasEntre(desde: string, hasta: string): number {
    const a = new Date(desde + 'T00:00:00').getTime();
    const b = new Date(hasta + 'T00:00:00').getTime();
    return Math.round((b - a) / 86400000);
  }

  // "Cada 8 días" -> 8 | "Semanal" -> 7 | "Quincenal" -> 15 | "Mensual" -> 30
  private diasDeFrecuencia(texto: string): number | null {
    const t = (texto || '').toLowerCase();
    const num = t.match(/\d+/);
    if (num) return Number(num[0]);
    if (t.includes('seman')) return 7;
    if (t.includes('quinc')) return 15;
    if (t.includes('mens')) return 30;
    if (t.includes('dia')) return 1;
    return null;
  }

  private textoFrecuencia(dias: number): string {
    return dias === 1 ? 'Cada día' : `Cada ${dias} días`;
  }

  // Traduce el error HTTP a un motivo que se entienda
  private describirError(error: any): string {
    const estado = error?.status;
    if (estado === 0) return 'no hay conexión con el servidor (¿está encendido el backend?)';
    if (estado === 401) return 'la sesión expiró; inicia sesión de nuevo';
    if (estado === 403) return 'no tienes permiso para esta acción (403)';
    if (estado === 404) return 'la ruta no existe en el servidor (404); revisa la URL de la API';
    if (estado === 400) {
      const detalle = typeof error.error === 'string' ? error.error : JSON.stringify(error.error ?? '');
      return `el servidor rechazó los datos (400): ${detalle.slice(0, 160)}`;
    }
    return estado ? `error ${estado} del servidor` : 'error desconocido';
  }

  // Fecha de hoy en hora local (YYYY-MM-DD)
  fechaHoy(): string {
    return this.aISO(new Date());
  }

  // dd/mm/aaaa
  fechaCorta(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // "18 de septiembre de 2026"
  fechaDiaModal(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  // =====================================================
  //  CARGA DE CATÁLOGOS
  // =====================================================
  cargarCatalogos(): void {
    this.errorMensaje = '';
    this.errorCatalogos = '';
    forkJoin({
      ingredientes: this.entregasService.cargarIngredientes() as unknown as Observable<IngredienteOpcion[]>,
      tiposMercado: this.entregasService.cargarTiposMercado() as unknown as Observable<TipoMercadoOpcion[]>,
    }).subscribe({
      next: ({ ingredientes, tiposMercado }) => {
        this.ingredientes = ingredientes.length > 0 ? ingredientes : this.productosBase;
        this.tiposMercado = tiposMercado.length > 0 ? tiposMercado : this.tiposBase;

        // Solo se guarda en caché lo que sí llegó del servidor (nunca los productos base)
        if (ingredientes.length > 0) this.guardarCache(this.claveCacheIngredientes, ingredientes);
        if (tiposMercado.length > 0) this.guardarCache(this.claveCacheTipos, tiposMercado);

        this.cargandoCatalogos = false;
        if (tiposMercado.length === 0) {
          this.errorCatalogos = 'El servidor no devolvió tipos de mercado; se usan Perecedero y No perecedero locales. Para guardar deben existir en el backend.';
        }
        this.reconstruirHistorial();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al cargar catálogos de entregas:', error);
        const motivo = this.describirError(error);
        this.errorCatalogos = `No se pudieron cargar los catálogos del servidor: ${motivo}. Se muestran productos de ejemplo; para guardar debe funcionar la conexión.`;
        void this.alertas.error('No se pudo cargar el catálogo', this.errorCatalogos);
        if (this.ingredientes.length === 0) this.ingredientes = this.productosBase;
        if (this.tiposMercado.length === 0) this.tiposMercado = this.tiposBase;
        this.cargandoCatalogos = false;
        this.reconstruirHistorial();
        this.cdr.markForCheck();
      },
    });
  }

  // =====================================================
  //  CARGA DEL HISTORIAL (entradas y envíos)
  // =====================================================
  cargarHistorial(): void {
    // Solo se muestra "Cargando entregas…" si no hay nada de antes; si hay datos, se refresca en silencio
    this.cargandoHistorial = this.entregasRaw.length === 0 && this.historialEnvios.length === 0;
    this.errorHistorial = false;

    const idPedido = this.idInstitucion;
    const sedePedida = this.idSede;
    let params = new HttpParams();
    if (this.idInstitucion != null) params = params.set('id_institucion', this.idInstitucion);
    if (this.idSede != null) params = params.set('id_sede', this.idSede);

    this.http.get<any>(this.urlEntregas, { params }).pipe(
      map(d => (Array.isArray(d) ? d : (d?.results ?? [])) as any[]),
      map(lista => this.soloDeInstitucion(lista)),
    ).subscribe({
      next: (lista) => {
        // Llegó tarde: ya se cambió de institución o de sede
        if (idPedido !== this.idInstitucion || sedePedida !== this.idSede) return;

        // Las entradas de inventario y los envíos se separan por "fecha_salida"
        const envios = lista.filter(item => this.esEnvio(item));
        this.entregasRaw = lista.filter(item => !this.esEnvio(item));
        this.historialEnvios = this.registrosEnvioDe(envios);

        this.reconstruirHistorial();
        this.cargandoHistorial = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al consultar entregas:', error);
        this.cargandoHistorial = false;
        this.errorHistorial = this.entregasRaw.length === 0;
        this.cdr.markForCheck();
      },
    });
  }

  // Convierte lo que devuelve el backend en filas con nombres (usa los catálogos por id)
  private reconstruirHistorial(): void {
    this.historial = this.entregasRaw.map(item => this.aFila(item));

    // Los productos elegidos en el menú se actualizan con su última entrada
    this.seleccionados = this.seleccionados
      .map(sel => this.ultimaEntradaDe(sel.idIngrediente))
      .filter((e): e is FilaEntrega => !!e);
  }

  private ultimaEntradaDe(idIngrediente: number | null): FilaEntrega | undefined {
    return this.historial
      .filter(e => e.idIngrediente === idIngrediente)
      .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion) || ((b.id ?? 0) - (a.id ?? 0)))[0];
  }

  private aFila(item: any): FilaEntrega {
    const idIngrediente = item.id_ingrediente ??
      (typeof item.ingrediente === 'number' ? item.ingrediente : item.ingrediente?.id);
    const idTipo = item.id_tipo_mercado ??
      (typeof item.tipo_mercado === 'number' ? item.tipo_mercado : item.tipo_mercado?.id);

    const ingrediente =
      this.texto(item.ingrediente_nombre) ||
      this.texto(item.nombre_ingrediente) ||
      this.texto(item.ingrediente) ||
      this.ingredientes.find(i => i.id === idIngrediente)?.nombre || '';

    const tipoMercado =
      this.texto(item.tipo_mercado_nombre) ||
      this.texto(item.nombre_tipo_mercado) ||
      this.texto(item.tipo_mercado) ||
      this.tiposMercado.find(t => t.id === idTipo)?.nombre || '';

    const nombreMercado = tipoMercado.toLowerCase();
    const esPerecedero = nombreMercado.includes('perecedero') && !nombreMercado.includes('no perecedero');

    const idIng = idIngrediente != null
      ? Number(idIngrediente)
      : (this.ingredientes.find(i => i.nombre === ingrediente)?.id ?? null);
    const idTip = idTipo != null
      ? Number(idTipo)
      : (this.tiposMercado.find(t => t.nombre === tipoMercado)?.id ?? null);

    const fechaRecepcion = this.soloFecha(item.fecha_entrega ?? item.fecha_recepcion ?? item.fechaRecepcion);
    const extra = this.extraDe(item.id, idIng, fechaRecepcion, Number(item.cantidad) || 0);

    return {
      id: item.id,
      idIngrediente: idIng,
      idTipoMercado: idTip,
      ingrediente,
      tipoMercado,
      categoria: esPerecedero ? 'Perecederos' : 'Granos',
      frecuencia: item.frecuencia || '',
      cantidad: Number(item.cantidad) || 0,
      unidad: item.unidad || '',
      fechaRecepcion,
      fechaVencimiento: this.soloFecha(item.fecha_vencimiento ?? item.fechaVencimiento),

      codigo: item.codigo ?? item.codigo_entrega ?? '',
      lote: item.lote ?? item.numero_lote ?? '',
      destino: this.texto(item.destino) || this.texto(item.destino_nombre) || this.texto(item.institucion) || extra?.destino || '',
      hora: this.horaDe(item.hora_salida ?? item.hora ?? item.hora_registro ?? item.created_at ?? item.fecha_creacion) || extra?.hora || '',
      responsable: this.texto(item.responsable) || this.texto(item.responsable_nombre) || this.texto(item.usuario) || extra?.responsable || '',
      estadoEntrega: item.estado ?? '',
    };
  }

  private registrosEnvioDe(lista: readonly RegistroEntregaEnvio[]): EnvioRegistro[] {
    return lista.flatMap((item, index) => {
      const referencia = item.id_institucion ?? item.institucion;
      const referenciaSede = item.id_sede ?? item.sede;
      const idInstitucion = typeof referencia === 'object' && referencia !== null
        ? referencia.id_institucion ?? referencia.id
        : referencia;
      const nombreSede = item.sede_nombre || this.nombreReferencia(referenciaSede);
      const nombre = item.institucion_nombre
        || this.nombreReferencia(referencia)
        || item.destino_nombre
        || item.destino
        || '';
      const destino = item.destino || (nombreSede ? `${nombre} - ${nombreSede}` : nombre);

      if ((idInstitucion == null || idInstitucion === '') && !nombre) return [];

      return [{
        id: Number(item.id_entrega ?? item.id ?? index),
        idInstitucion: idInstitucion == null ? null : Number(idInstitucion),
        ingrediente: item.ingrediente_nombre || this.nombreReferencia(item.ingrediente)
          || this.ingredientes.find(i => i.id === Number(item.ingrediente))?.nombre || '',
        cantidad: item.cantidad == null || item.cantidad === '' ? 0 : Number(item.cantidad),
        unidad: item.unidad ?? '',
        destino,
        fechaSalida: this.soloFecha(item.fecha_salida ?? item.fecha_entrega),
        fechaEntrega: this.soloFecha(item.fecha_entrega),
        enviadoEl: this.soloFecha(item.created_at ?? item.fecha_creacion ?? item.fecha_entrega),
      }];
    });
  }

  // =====================================================
  //  MENÚ: emojis, imágenes y categorías
  // =====================================================
  emojiDe(nombre: string): string {
    const n = (nombre || '').toLowerCase();
    const mapa: [string[], string][] = [
      [['arroz', 'avena'], '🌾'], [['frijol', 'lenteja', 'garbanzo', 'arveja'], '🫘'],
      [['pasta', 'espagueti', 'fideo'], '🍝'], [['harina', 'maíz', 'maiz'], '🌽'],
      [['azúcar', 'azucar'], '🍬'], [['sal'], '🧂'], [['aceite'], '🫒'], [['panela'], '🍯'],
      [['leche'], '🥛'], [['queso'], '🧀'], [['huevo'], '🥚'], [['pollo', 'pechuga'], '🍗'],
      [['carne', 'res', 'cerdo'], '🥩'], [['pescado', 'atún', 'atun'], '🐟'],
      [['papa'], '🥔'], [['yuca'], '🥔'], [['plátano', 'platano', 'banano'], '🍌'],
      [['zanahoria'], '🥕'], [['tomate'], '🍅'], [['cebolla'], '🧅'],
      [['manzana'], '🍎'], [['naranja'], '🍊'], [['lechuga', 'verdura'], '🥬'],
    ];
    return mapa.find(([claves]) => claves.some(k => n.includes(k)))?.[1] ?? '🍽️';
  }

  // El orden importa: lo más específico primero ("molida" antes que "carne", "deslactosad" antes que "leche")
  private readonly imagenesProducto: { clave: string; archivo: string }[] = [
    { clave: 'molida',      archivo: 'molida.png' },
    { clave: 'carne',       archivo: 'carne.png' },
    { clave: 'tocino',      archivo: 'tocino.png' },
    { clave: 'huevo',       archivo: 'huevos.png' },
    { clave: 'aceite',      archivo: 'aceite.png' },
    { clave: 'platano',     archivo: 'platano.png' },
    { clave: 'arroz',       archivo: 'arroz.png' },
    { clave: 'frijol',      archivo: 'frijoles.png' },
    { clave: 'harina',      archivo: 'harina.png' },
    { clave: 'deslactosad', archivo: 'deslatosada.png' },   // el archivo se llama "deslatosada.png"
    { clave: 'leche',       archivo: 'leche.png' },
    { clave: 'queso',       archivo: 'queso.png' },
  ];

  // Imagen del producto desde public/ (null = se usa el emoji)
  imagenDe(nombre: string): string | null {
    const n = this.normalizarNombre(nombre ?? '');
    const hallada = this.imagenesProducto.find(i => n.includes(i.clave));
    return hallada ? '/' + hallada.archivo : null;
  }

  private readonly imagenesCategoria: Record<string, string> = {
    'Todos':             'plato.png',
    'Granos y cereales': 'granos.png',
    'Despensa':          'sal.png',
    'Lácteos':           'lacteos.png',
    'Carnes y huevos':   'carne.png',
    'Verduras':          'verduras.png',
    'Frutas':            'frutas.png',
    'Otros':             'otros.png',
  };

  imagenCategoria(nombre: string): string | null {
    const archivo = this.imagenesCategoria[nombre];
    return archivo ? '/' + archivo : null;
  }

  categoriaDe(nombre: string): string {
    const n = (nombre || '').toLowerCase();
    const mapa: [string[], string][] = [
      [['arroz', 'frijol', 'lenteja', 'garbanzo', 'arveja', 'pasta', 'harina', 'avena', 'maíz', 'maiz'], 'Granos y cereales'],
      [['azúcar', 'azucar', 'sal', 'aceite', 'panela'], 'Despensa'],
      [['leche', 'queso', 'yogur'], 'Lácteos'],
      [['pollo', 'pechuga', 'carne', 'res', 'cerdo', 'pescado', 'atún', 'atun', 'huevo'], 'Carnes y huevos'],
      [['papa', 'yuca', 'zanahoria', 'tomate', 'cebolla', 'lechuga', 'verdura'], 'Verduras'],
      [['plátano', 'platano', 'banano', 'manzana', 'naranja', 'mango'], 'Frutas'],
    ];
    return mapa.find(([claves]) => claves.some(k => n.includes(k)))?.[1] ?? 'Otros';
  }

  private emojiDeCategoria(categoria: string): string {
    const e: Record<string, string> = {
      'Todos': '🍽️', 'Granos y cereales': '🌾', 'Despensa': '🧂', 'Lácteos': '🥛',
      'Carnes y huevos': '🥩', 'Verduras': '🥕', 'Frutas': '🍎',
    };
    return e[categoria] ?? '📦';
  }

  get categoriasMenu(): CategoriaOpcion[] {
    const conteo = new Map<string, number>();
    this.ingredientes.forEach(i => {
      const cat = this.categoriaDe(i.nombre);
      conteo.set(cat, (conteo.get(cat) ?? 0) + 1);
    });
    const lista = Array.from(conteo.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([nombre, total]) => ({ nombre, emoji: this.emojiDeCategoria(nombre), total }));
    return [{ nombre: 'Todos', emoji: this.emojiDeCategoria('Todos'), total: this.ingredientes.length }, ...lista];
  }

  // Todos los productos del catálogo, con su unidad y tipo (se toman de su última entrada si existe)
  private get catalogoMenu(): ProductoCatalogo[] {
    return this.ingredientes.map(ing => {
      const ultima = this.ultimaEntradaDe(ing.id);
      return {
        id: ing.id,
        nombre: ing.nombre,
        categoria: this.categoriaDe(ing.nombre),
        unidad: ultima ? this.normalizarUnidad(ultima.unidad) : (this.unidadPorDefecto[ing.nombre] ?? 'Kg'),
        idTipoMercado: ultima?.idTipoMercado ?? null,
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  // Productos que se ven en las tarjetas (aplica buscador, tipo y categoría)
  get productosMenu(): ProductoCatalogo[] {
    const q = this.textoFiltro.trim().toLowerCase();
    return this.catalogoMenu.filter(p =>
      (this.filtroMercado === 'Todos' || (this.filtroMercado === 'Perecederos') === this.esPerecedero(p)) &&
      (this.categoriaMenu === 'Todos' || p.categoria === this.categoriaMenu) &&
      (!q || p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || this.nombreTipo(p).toLowerCase().includes(q)),
    );
  }

  // Si el producto ya tuvo entradas se usa su tipo de mercado; si no, se deduce por el nombre
  private readonly perecederosPorNombre = [
    'pollo', 'carne', 'res', 'cerdo', 'pescado', 'huevo', 'leche', 'queso', 'yogur', 'papa', 'yuca',
    'plátano', 'platano', 'zanahoria', 'tomate', 'cebolla', 'lechuga', 'banano', 'manzana', 'naranja',
  ];

  esPerecedero(p: ProductoCatalogo): boolean {
    const tipo = this.tiposMercado.find(t => t.id === p.idTipoMercado)?.nombre.toLowerCase();
    if (tipo) return tipo.includes('perecedero') && !tipo.includes('no perecedero');
    return p.nombre.toLowerCase().split(/\s+/).some(palabra =>
      this.perecederosPorNombre.some(k => palabra === k || (k.length >= 4 && palabra.startsWith(k))));
  }

  nombreTipo(p: ProductoCatalogo): string {
    const tipo = this.tiposMercado.find(t => t.id === p.idTipoMercado)?.nombre;
    return tipo || (this.esPerecedero(p) ? 'Perecedero' : 'No perecedero');
  }

  trackProducto(_: number, p: ProductoCatalogo): number {
    return p.id;
  }

  // Datos de la última entrada del producto y total recibido (null si aún no tiene entradas)
  registroDe(idIngrediente: number | null): ResumenProducto | null {
    const entradas = this.historial
      .filter(e => e.idIngrediente === idIngrediente)
      .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion) || ((b.id ?? 0) - (a.id ?? 0)));
    if (entradas.length === 0) return null;

    const ultima = entradas[0];
    const total = entradas
      .filter(e => this.normalizarUnidad(e.unidad) === this.normalizarUnidad(ultima.unidad))
      .reduce((suma, e) => suma + e.cantidad, 0);

    return {
      cantidad: ultima.cantidad,
      unidad: this.normalizarUnidad(ultima.unidad) || ultima.unidad,
      fechaIngreso: ultima.fechaRecepcion,
      fechaVencimiento: ultima.fechaVencimiento,
      estado: this.estadoDe(ultima),
      textoVence: this.textoDias(this.diasDe(ultima)),
      totalRecibido: Math.round(total * 100) / 100,
      entradas: entradas.length,
    };
  }

  textoDias(d: number): string {
    if (d >= 99999) return '';
    if (d < -1) return `Vencido hace ${Math.abs(d)} días`;
    if (d === -1) return 'Venció ayer';
    if (d === 0) return 'Vence hoy';
    if (d === 1) return 'Vence mañana';
    return `Vence en ${d} días`;
  }

  // =====================================================
  //  PAGINACIÓN DEL MENÚ (por producto, agrupado por categoría)
  // =====================================================
  private readonly ordenSubgrupo: Record<string, number> = { Carnes: 0, Huevos: 1 };

  // En "Carnes y huevos" se separan Carnes y Huevos; en las demás categorías no hay subgrupos
  private subgrupoDe(p: ProductoCatalogo): string {
    if (p.categoria !== 'Carnes y huevos') return '';
    return this.normalizarNombre(p.nombre).includes('huevo') ? 'Huevos' : 'Carnes';
  }

  private get productosMenuOrdenados(): ProductoCatalogo[] {
    return [...this.productosMenu].sort((a, b) =>
      a.categoria.localeCompare(b.categoria, 'es')
      || (this.ordenSubgrupo[this.subgrupoDe(a)] ?? 0) - (this.ordenSubgrupo[this.subgrupoDe(b)] ?? 0)
      || a.nombre.localeCompare(b.nombre, 'es'));
  }

  get totalProductosMenu(): number {
    return this.productosMenu.length;
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalProductosMenu / this.porPagina));
  }

  // Página real (nunca se sale de rango) sin modificar el estado dentro de un getter
  get paginaEfectiva(): number {
    return Math.min(Math.max(1, this.paginaActual), this.totalPaginas);
  }

  get desdeMostrado(): number {
    return this.totalProductosMenu === 0 ? 0 : (this.paginaEfectiva - 1) * this.porPagina + 1;
  }

  get hastaMostrado(): number {
    return Math.min(this.paginaEfectiva * this.porPagina, this.totalProductosMenu);
  }

  private get productosPagina(): ProductoCatalogo[] {
    const inicio = (this.paginaEfectiva - 1) * this.porPagina;
    return this.productosMenuOrdenados.slice(inicio, inicio + this.porPagina);
  }

  get gruposPagina(): GrupoPagina[] {
    const totales = new Map<string, number>();
    this.productosMenu.forEach(p => totales.set(p.categoria, (totales.get(p.categoria) ?? 0) + 1));

    const grupos = new Map<string, GrupoPagina>();
    for (const p of this.productosPagina) {
      let grupo = grupos.get(p.categoria);
      if (!grupo) {
        grupo = {
          nombre: p.categoria,
          emoji: this.emojiDeCategoria(p.categoria),
          total: totales.get(p.categoria) ?? 0,
          subgrupos: [],
        };
        grupos.set(p.categoria, grupo);
      }
      const nombreSub = this.subgrupoDe(p);
      let sub = grupo.subgrupos.find(s => s.nombre === nombreSub);
      if (!sub) {
        sub = { nombre: nombreSub, productos: [] };
        grupo.subgrupos.push(sub);
      }
      sub.productos.push(p);
    }
    return Array.from(grupos.values());
  }

  // 1 … 4 5 6 … 12
  get numerosPagina(): (number | '…')[] {
    const total = this.totalPaginas;
    const actual = this.paginaEfectiva;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const orden = Array.from(new Set([1, total, actual - 1, actual, actual + 1]))
      .filter(n => n >= 1 && n <= total)
      .sort((a, b) => a - b);

    const salida: (number | '…')[] = [];
    orden.forEach((n, i) => {
      if (i > 0 && n - orden[i - 1] > 1) salida.push('…');
      salida.push(n);
    });
    return salida;
  }

  // Acepta number | string para que compile con el *ngIf de la plantilla
  irAPagina(p: number | string): void {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > this.totalPaginas) return;
    this.paginaActual = n;
    document.getElementById('catalogo-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  trackGrupo(_: number, g: { nombre: string }): string {
    return g.nombre;
  }

  trackSubgrupo(_: number, s: SubgrupoMenu): string {
    return s.nombre;
  }

  // =====================================================
  //  FILTROS
  // =====================================================
  setMercado(m: FiltroMercado): void {
    this.filtroMercado = m;
    this.paginaActual = 1;
  }

  // Lo que se exporta a Excel: respeta el buscador y el tipo de producto, del más reciente al más antiguo
  get historialFiltrado(): FilaEntrega[] {
    const texto = this.textoFiltro.trim().toLowerCase();
    return this.historial
      .filter(e => {
        if (this.filtroMercado !== 'Todos' && e.categoria !== this.filtroMercado) return false;
        if (!texto) return true;
        return e.ingrediente.toLowerCase().includes(texto)
          || e.tipoMercado.toLowerCase().includes(texto)
          || e.frecuencia.toLowerCase().includes(texto)
          || this.estadoDe(e).toLowerCase().includes(texto);
      })
      .sort((a, b) =>
        b.fechaRecepcion.localeCompare(a.fechaRecepcion) || ((b.id ?? 0) - (a.id ?? 0)));
  }

  // =====================================================
  //  PRODUCTOS SELECCIONADOS (panel de Inventario)
  // =====================================================
  seleccionados: FilaEntrega[] = [];

  // Clic o toque en la tarjeta: la agrega al panel; otro clic la quita.
  abrirDetalleDesdeCatalogo(producto: ProductoCatalogo): void {
    if (this.swipeReciente) return;   // el clic que sigue a un deslizamiento se ignora
    if (this.tarjetaActiva(producto)) this.quitarPorProducto(producto);
    else this.agregarSeleccionado(producto);
  }

  private agregarSeleccionado(producto: ProductoCatalogo): void {
    if (this.tarjetaActiva(producto)) return;
    const ultima = this.ultimaEntradaDe(producto.id);
    if (!ultima) {
      void this.alertas.warning('Sin inventario', `${producto.nombre} todavía no tiene entradas en el inventario.`);
      return;
    }
    this.seleccionados.push(ultima);
  }

  private quitarPorProducto(producto: ProductoCatalogo): void {
    this.seleccionados = this.seleccionados.filter(s => s.idIngrediente !== producto.id);
  }

  // ===================== DESLIZAR EL PRODUCTO =====================
  // Deslizar la tarjeta a la derecha  -> el producto aparece en el panel con sus detalles.
  // Deslizar la tarjeta a la izquierda -> se quita del panel.
  readonly umbralSwipe = 70;            // píxeles que hay que arrastrar
  swipeId: number | null = null;        // tarjeta que se está arrastrando
  swipeDx = 0;                          // cuánto se ha movido
  private swipeInicio: { id: number; x: number; y: number; activo: boolean } | null = null;
  private swipeReciente = false;

  alIniciarDeslizar(ev: PointerEvent, p: ProductoCatalogo): void {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    this.swipeInicio = { id: p.id, x: ev.clientX, y: ev.clientY, activo: false };
  }

  alMoverDeslizar(ev: PointerEvent): void {
    const s = this.swipeInicio;
    if (!s) return;
    const dx = ev.clientX - s.x;
    const dy = ev.clientY - s.y;
    if (!s.activo) {
      // Solo cuenta si el gesto es más horizontal que vertical (así el scroll normal sigue funcionando)
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      s.activo = true;
      this.swipeId = s.id;
      (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    }
    this.swipeDx = Math.max(-120, Math.min(120, dx));
  }

  alTerminarDeslizar(p: ProductoCatalogo): void {
    const s = this.swipeInicio;
    this.swipeInicio = null;
    if (!s?.activo) return;

    const dx = this.swipeDx;
    this.swipeId = null;
    this.swipeDx = 0;
    this.swipeReciente = true;
    setTimeout(() => (this.swipeReciente = false), 80);

    if (dx >= this.umbralSwipe) {
      this.mostrarHistorialEnvios = false;   // el panel muestra la pestaña Inventario
      this.agregarSeleccionado(p);
    } else if (dx <= -this.umbralSwipe) {
      this.quitarPorProducto(p);
    }
  }

  cancelarDeslizar(): void {
    this.swipeInicio = null;
    this.swipeId = null;
    this.swipeDx = 0;
  }

  quitarSeleccionado(item: FilaEntrega): void {
    this.seleccionados = this.seleccionados.filter(s => s.idIngrediente !== item.idIngrediente);
  }

  tarjetaActiva(producto: ProductoCatalogo): boolean {
    return this.seleccionados.some(s => s.idIngrediente === producto.id);
  }

  trackFila(_: number, e: FilaEntrega): any {
    return e.id ?? `${e.ingrediente}-${e.fechaRecepcion}-${e.cantidad}`;
  }

  // =====================================================
  //  ENVIAR A LAS INSTITUCIONES
  // =====================================================
  // Flujo: icono de la escuela en un producto seleccionado -> se elige la institución o sede
  // (puede ser más de una), la cantidad de cada una, la fecha de salida y la de entrega -> Enviar ->
  // queda en la pestaña Historial (un registro por destino).
  envioProducto: FilaEntrega | null = null;
  envioUnidad = 'Kg';
  envioFechaSalida = '';
  envioFechaEntrega = '';
  envioDestinos: EnvioDestino[] = [];
  errorEnvio = '';
  hoyEnvio = this.fechaHoy();
  mostrarHistorialEnvios = false;
  guardandoEnvio = false;

  trackEnvioHist = (_: number, r: EnvioRegistro) => r.id;

  // ¿Este producto ya aparece en el historial de envíos?
  fueEnviado(nombre: string): boolean {
    return this.historialEnvios.some(e => e.ingrediente === nombre);
  }

  // Destinos a los que ya se envió este producto; '' si aún no se ha enviado
  destinosEnviados(nombre: string): string {
    const lista = this.historialEnvios
      .filter(e => e.ingrediente === nombre)
      .map(e => e.destino);
    return Array.from(new Set(lista)).join(', ');
  }

  abrirModalEnvio(item: FilaEntrega): void {
    this.hoyEnvio = this.fechaHoy();
    this.envioProducto = item;
    this.envioUnidad = this.normalizarUnidad(item.unidad) || 'Kg';
    this.envioFechaSalida = this.hoyEnvio;
    this.envioFechaEntrega = this.hoyEnvio;
    this.envioDestinos = [];
    this.destinosEnvioSeleccionados.clear();
    this.errorEnvio = '';
  }

  cerrarModalEnvio(): void {
    this.envioProducto = null;
  }

  alternarDestino(destino: string): void {
    const existente = this.envioDestinos.find(item => item.institucion === destino);
    if (existente) {
      this.envioDestinos = this.envioDestinos.filter(item => item !== existente);
      this.destinosEnvioSeleccionados.delete(destino);
      return;
    }

    const sede = this.institucionActiva?.sedes?.find(item =>
      destino.endsWith(` - ${item.nombre_sede}`),
    );
    const idInstitucion = this.institucionActiva?.id_institucion ?? this.idInstitucion;
    if (idInstitucion === null || idInstitucion === undefined) {
      this.errorEnvio = 'No se encontró el identificador de la institución seleccionada.';
      return;
    }

    this.errorEnvio = '';
    this.destinosEnvioSeleccionados.add(destino);
    this.envioDestinos.push({
      idInstitucion,
      ...(sede ? { idSede: Number(sede.id_sede ?? sede.id) } : {}),
      institucion: destino,
      cantidad: null,
    });
  }

  estaDestino(destino: string): boolean {
    return this.destinosEnvioSeleccionados.has(destino);
  }

  quitarDestinoEnvio(indice: number): void {
    const [quitado] = this.envioDestinos.splice(indice, 1);
    if (quitado) this.destinosEnvioSeleccionados.delete(quitado.institucion);
  }

  // Botones - y + de la cantidad
  ajustarCantidadDestino(destino: EnvioDestino, paso: number): void {
    const nueva = Math.max(0, Math.round(((destino.cantidad ?? 0) + paso) * 100) / 100);
    destino.cantidad = nueva > 0 ? nueva : null;
  }

  // Si cambia la salida y la entrega queda antes, la entrega se acomoda a la misma fecha
  alCambiarSalidaEnvio(): void {
    if (this.envioFechaEntrega && this.envioFechaSalida && this.envioFechaEntrega < this.envioFechaSalida) {
      this.envioFechaEntrega = this.envioFechaSalida;
    }
  }

  get totalEnvio(): number {
    const total = this.envioDestinos.reduce((suma, d) => suma + (d.cantidad ?? 0), 0);
    return Math.round(total * 100) / 100;
  }

  enviarAInstituciones(): void {
    const prod = this.envioProducto;
    if (!prod || this.guardandoEnvio) return;

    const hoy = this.fechaHoy();
    const destinos = this.envioDestinos;

    if (destinos.length === 0) { this.errorEnvio = 'Elige al menos una institución o sede.'; return; }

    const sinCantidad = destinos.filter(d => !d.cantidad || d.cantidad <= 0);
    if (sinCantidad.length > 0) {
      this.errorEnvio = `Escribe la cantidad de: ${sinCantidad.map(d => d.institucion).join(', ')}.`;
      return;
    }
    if (this.totalEnvio > prod.cantidad) {
      this.errorEnvio = `La suma (${this.totalEnvio} ${this.envioUnidad}) es mayor a la disponible (${prod.cantidad} ${this.envioUnidad}).`;
      return;
    }
    if (!this.envioFechaSalida || !this.envioFechaEntrega) { this.errorEnvio = 'Selecciona la fecha de salida y la de entrega.'; return; }
    if (this.envioFechaSalida < hoy) { this.errorEnvio = 'La fecha de salida no puede ser anterior a hoy.'; return; }
    if (this.envioFechaEntrega < this.envioFechaSalida) { this.errorEnvio = 'La fecha de entrega no puede ser anterior a la de salida.'; return; }

    if (!prod.idIngrediente || !prod.idTipoMercado || !prod.fechaVencimiento) {
      this.errorEnvio = 'Al producto le faltan datos requeridos para registrar el envío.';
      return;
    }

    this.errorEnvio = '';
    this.guardandoEnvio = true;

    const peticiones = destinos.map(destino =>
      this.entregasService.registrar({
        id_ingrediente: prod.idIngrediente!,
        id_tipo_mercado: prod.idTipoMercado!,
        id_institucion: destino.idInstitucion,
        ...(destino.idSede ? { id_sede: destino.idSede } : {}),
        fecha_entrega: this.envioFechaEntrega,
        fecha_salida: this.envioFechaSalida,
        fecha_vencimiento: prod.fechaVencimiento,
        cantidad: destino.cantidad!,
        observaciones: '',
        frecuencia: prod.frecuencia,
        unidad: this.envioUnidad,
        destino: destino.institucion,
      } as any).pipe(
        map(() => ({ ok: true, destino })),
        catchError(error => {
          console.error(`Error al enviar ${prod.ingrediente} a ${destino.institucion}:`, error);
          return of({ ok: false, destino });
        }),
      ),
    );

    forkJoin(peticiones).subscribe(resultados => {
      this.guardandoEnvio = false;
      const exitosos = resultados.filter(r => r.ok);
      const fallidos = resultados.filter(r => !r.ok);

      // Se muestran al instante; al recargar el historial se reemplazan por los del servidor
      const registros: EnvioRegistro[] = exitosos.map(({ destino }, index) => ({
        id: Date.now() + index,
        idInstitucion: destino.idInstitucion,
        ingrediente: prod.ingrediente,
        cantidad: destino.cantidad!,
        unidad: this.envioUnidad,
        destino: destino.institucion,
        fechaSalida: this.envioFechaSalida,
        fechaEntrega: this.envioFechaEntrega,
        enviadoEl: hoy,
      }));

      this.historialEnvios = [...registros, ...this.historialEnvios];
      this.envioDestinos = fallidos.map(({ destino }) => destino);
      this.destinosEnvioSeleccionados.clear();
      this.envioDestinos.forEach(destino => this.destinosEnvioSeleccionados.add(destino.institucion));
      if (exitosos.length > 0) this.cargarHistorial();

      if (fallidos.length > 0) {
        this.errorEnvio = `Se registraron ${exitosos.length} envío(s); no se pudieron registrar ${fallidos.length}. Corrige el problema e inténtalo de nuevo.`;
        void this.alertas.error('Envío incompleto', this.errorEnvio);
        this.cdr.markForCheck();
        return;
      }

      this.envioProducto = null;
      this.errorEnvio = '';
      this.mostrarHistorialEnvios = true;
      void this.alertas.success(
        'Envío registrado',
        `${prod.ingrediente} se envió a ${registros.length} destino(s), con entrega el ${this.fechaCorta(this.envioFechaEntrega)}.`,
      );
      this.cdr.markForCheck();
    });
  }

  // =====================================================
  //  CALENDARIO DE ENTREGAS
  // =====================================================
  mostrarCalendario = false;
  mesCalendario = this.primerDiaDelMes(new Date());
  diaSeleccionado = this.isoDeFecha(new Date());
  readonly nombresDias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  private readonly nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  irACalendario(): void {
    this.mostrarCalendario = true;
  }

  get tituloMes(): string {
    return `${this.nombresMeses[this.mesCalendario.getMonth()]} ${this.mesCalendario.getFullYear()}`;
  }

  mesAnterior(): void {
    this.mesCalendario = new Date(this.mesCalendario.getFullYear(), this.mesCalendario.getMonth() - 1, 1);
  }

  mesSiguiente(): void {
    this.mesCalendario = new Date(this.mesCalendario.getFullYear(), this.mesCalendario.getMonth() + 1, 1);
  }

  irAHoy(): void {
    const hoy = new Date();
    this.mesCalendario = this.primerDiaDelMes(hoy);
    this.diaSeleccionado = this.isoDeFecha(hoy);
  }

  // Si se toca un día gris (de otro mes), el calendario cambia a ese mes. Además abre "Registro del día"
  seleccionarDia(iso: string): void {
    this.diaSeleccionado = iso;
    const [anio, mes] = iso.split('-').map(Number);
    if (anio !== this.mesCalendario.getFullYear() || mes - 1 !== this.mesCalendario.getMonth()) {
      this.mesCalendario = new Date(anio, mes - 1, 1);
    }
    this.modalDiaAbierto = true;
  }

  // El buscador de arriba también filtra el calendario por producto
  private get historialCalendario(): FilaEntrega[] {
    const q = this.textoFiltro.trim().toLowerCase();
    return q ? this.historial.filter(e => e.ingrediente.toLowerCase().includes(q)) : this.historial;
  }

  // Semanas completas (de lunes a domingo) del mes que se está viendo
  get diasCalendario(): DiaCalendario[] {
    const lista = this.historialCalendario;
    const hoy = this.isoDeFecha(new Date());
    const primero = this.mesCalendario;
    const desplazamiento = (primero.getDay() + 6) % 7;   // la semana empieza en lunes

    const dias: DiaCalendario[] = [];
    for (let i = 0; i < 42; i++) {
      const fecha = new Date(primero.getFullYear(), primero.getMonth(), 1 - desplazamiento + i);
      const iso = this.isoDeFecha(fecha);
      const recibidos = lista.filter(e => e.fechaRecepcion === iso);
      dias.push({
        iso,
        numero: fecha.getDate(),
        enMes: fecha.getMonth() === primero.getMonth(),
        esHoy: iso === hoy,
        seleccionado: iso === this.diaSeleccionado,
        entregas: recibidos.length,
        estado: this.peorEstado(recibidos),
        vencen: lista.filter(e => e.fechaVencimiento === iso).length,
      });
    }
    return dias[35].enMes ? dias : dias.slice(0, 35);   // si la sexta semana está vacía, no se muestra
  }

  private peorEstado(items: FilaEntrega[]): DiaCalendario['estado'] {
    if (items.length === 0) return null;
    const estados = items.map(e => this.estadoDe(e));
    if (estados.includes('Vencido')) return 'Vencido';
    if (estados.includes('Próximo a vencer')) return 'Próximo a vencer';
    return 'Vigente';
  }

  get entregasDelDia(): FilaEntrega[] {
    return this.historialCalendario
      .filter(e => e.fechaRecepcion === this.diaSeleccionado)
      .sort((a, b) => a.ingrediente.localeCompare(b.ingrediente, 'es'));
  }

  get vencenDelDia(): FilaEntrega[] {
    return this.historialCalendario
      .filter(e => e.fechaVencimiento === this.diaSeleccionado)
      .sort((a, b) => a.ingrediente.localeCompare(b.ingrediente, 'es'));
  }

  claseChipEstado(estado: string | null): string {
    if (estado === 'Vencido') return 'est-bad';
    if (estado === 'Próximo a vencer') return 'est-warn';
    return 'est-ok';
  }

  trackDia(_: number, d: DiaCalendario): string {
    return d.iso;
  }

  // ===================== MODAL "REGISTRO DEL DÍA" =====================
  modalDiaAbierto = false;

  cerrarModalDia(): void {
    this.modalDiaAbierto = false;
  }

  // Entregas del día elegido agrupadas por código (si no hay código, usa el folio CI-AAAAMMDD)
  get registrosDelDia(): RegistroDia[] {
    const mapa = new Map<string, RegistroDia>();
    for (const e of this.entregasDelDia) {
      const codigo = e.codigo || 'CI-' + e.fechaRecepcion.replace(/-/g, '');
      let reg = mapa.get(codigo);
      if (!reg) {
        reg = {
          codigo,
          descripcion: 'Lote de entrega SIRAE',
          estado: e.estadoEntrega || 'Recibida',
          destino: '—',
          hora: '—',
          responsable: '—',
          items: [],
        };
        mapa.set(codigo, reg);
      }
      reg.items.push(e);
    }
    // Destino, hora y responsable: el primero que tenga algún producto del lote
    for (const reg of mapa.values()) {
      reg.destino = reg.items.find(i => i.destino)?.destino || this.nombreInstitucion || '—';
      reg.hora = reg.items.find(i => i.hora)?.hora || '—';
      reg.responsable = reg.items.find(i => i.responsable)?.responsable || '—';
    }
    return Array.from(mapa.values());
  }

  trackRegistro(_: number, r: RegistroDia): string {
    return r.codigo;
  }

  // =====================================================
  //  REGISTRAR ENTRADA (botón "Entradas" del calendario)
  // =====================================================
  // El formulario pide: fecha, destino, responsable y los productos (con cantidad y si son perecederos o no).
  // El vencimiento y la frecuencia se calculan solos con la última entrada de cada producto.
  mostrarModalEntrada = false;
  entradaFecha = this.fechaHoy();
  entradaDestino = '';
  entradaFilas: EntradaFila[] = [];
  guardandoEntrada = false;
  errorEntrada = '';
  entradaResponsable = '';
  busquedaEntrada = '';
  readonly unidadesEntrada = ['Kg', 'Litros', 'Unidades'];

  abrirModalEntrada(): void {
    this.entradaFecha = this.fechaHoy();
    const sedeActual = this.nombreSede
      ? this.destinosDisponibles.find(d => d.endsWith(` - ${this.nombreSede}`))
      : undefined;
    this.entradaDestino = sedeActual ?? this.destinosDisponibles[0] ?? '';
    this.entradaResponsable = '';
    this.busquedaEntrada = '';
    this.entradaFilas = [];
    this.errorEntrada = '';
    this.mostrarModalEntrada = true;
  }

  cerrarModalEntrada(): void {
    this.mostrarModalEntrada = false;
  }

  private nuevaFilaEntrada(): EntradaFila {
    return { idIngrediente: null, cantidad: null, unidad: 'Kg', perecedero: false };
  }

  // Productos que se ven como botones rápidos (el buscador los filtra)
  get productosRapidos(): IngredienteOpcion[] {
    const q = this.busquedaEntrada.trim().toLowerCase();
    return this.ingredientes
      .filter(i => !q || i.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  estaEnEntrada(id: number): boolean {
    return this.entradaFilas.some(f => f.idIngrediente === id);
  }

  nombreIngrediente(id: number | null): string {
    return this.ingredientes.find(i => i.id === id)?.nombre ?? '';
  }

  // Un toque agrega el producto a la entrada; otro toque lo quita
  alternarProductoEntrada(id: number): void {
    const existente = this.entradaFilas.findIndex(f => f.idIngrediente === id);
    if (existente >= 0) {
      this.entradaFilas.splice(existente, 1);
      return;
    }
    const fila = this.nuevaFilaEntrada();
    fila.idIngrediente = id;
    this.alElegirProductoEntrada(fila);
    this.entradaFilas.push(fila);
  }

  quitarFilaEntrada(indice: number): void {
    this.entradaFilas.splice(indice, 1);
  }

  ajustarCantidadEntrada(fila: EntradaFila, paso: number): void {
    const nueva = Math.max(0, Math.round(((fila.cantidad ?? 0) + paso) * 100) / 100);
    fila.cantidad = nueva > 0 ? nueva : null;
  }

  // Al elegir el producto se sugiere su unidad y si es perecedero (por su última entrada o por su nombre)
  alElegirProductoEntrada(fila: EntradaFila): void {
    const producto = this.catalogoMenu.find(p => p.id === fila.idIngrediente);
    if (!producto) return;
    fila.unidad = producto.unidad;
    fila.perecedero = this.esPerecedero(producto);
  }

  // Id del tipo de mercado del catálogo que corresponde a Perecedero / No perecedero
  private idTipoMercadoDe(perecedero: boolean): number | null {
    const tipo = this.tiposMercado.find(t => {
      const n = t.nombre.toLowerCase();
      return (n.includes('perecedero') && !n.includes('no perecedero')) === perecedero;
    });
    return tipo?.id ?? null;
  }

  // Vencimiento y frecuencia: se repiten los de la última entrada; si no hay, valores por defecto
  private datosAutomaticos(fila: EntradaFila): { vencimiento: string; frecuencia: string } {
    const ultima = this.ultimaEntradaDe(fila.idIngrediente);

    const diasUltima = ultima && ultima.fechaRecepcion && ultima.fechaVencimiento
      ? this.diasEntre(ultima.fechaRecepcion, ultima.fechaVencimiento)
      : 0;
    const vigencia = diasUltima > 0 ? diasUltima : (fila.perecedero ? 7 : 90);
    const cada = (ultima ? this.diasDeFrecuencia(ultima.frecuencia) : null) ?? 8;

    return {
      vencimiento: this.sumarDiasISO(this.entradaFecha, vigencia),
      frecuencia: this.textoFrecuencia(cada),
    };
  }

  // ---- Respaldo en este navegador ----
  // Si el backend no guarda destino / responsable / hora, se recuerdan aquí
  private readonly claveExtras = 'sirae_entradas_extra';
  private extras: Record<string, { destino: string; responsable: string; hora: string }> = this.leerExtras();

  private leerExtras(): Record<string, { destino: string; responsable: string; hora: string }> {
    try { return JSON.parse(localStorage.getItem(this.claveExtras) || '{}'); } catch { return {}; }
  }

  private claveCompuesta(idIngrediente: number | null, fecha: string, cantidad: number): string {
    return `${idIngrediente}|${fecha}|${cantidad}`;
  }

  private guardarExtra(id: number | undefined, fila: EntradaFila,
                       datos: { destino: string; responsable: string; hora: string }): void {
    if (id != null) this.extras[`id:${id}`] = datos;
    this.extras[this.claveCompuesta(fila.idIngrediente, this.entradaFecha, fila.cantidad ?? 0)] = datos;
    try { localStorage.setItem(this.claveExtras, JSON.stringify(this.extras)); } catch { /* sin espacio o bloqueado */ }
  }

  private extraDe(id: number | undefined, idIngrediente: number | null, fecha: string, cantidad: number) {
    return (id != null ? this.extras[`id:${id}`] : undefined)
      ?? this.extras[this.claveCompuesta(idIngrediente, fecha, cantidad)];
  }

  guardarEntrada(): void {
    if (this.guardandoEntrada) return;
    const filas = this.entradaFilas;

    if (!this.entradaFecha) { this.errorEntrada = 'Selecciona la fecha de entrega.'; return; }
    if (!this.entradaDestino.trim()) { this.errorEntrada = 'Elige el destino.'; return; }
    if (!this.entradaResponsable.trim()) { this.errorEntrada = 'Escribe el nombre del responsable.'; return; }
    if (filas.length === 0) { this.errorEntrada = 'Toca los productos que entran para agregarlos.'; return; }
    const sinCantidad = filas.filter(f => !f.cantidad || f.cantidad <= 0);
    if (sinCantidad.length > 0) {
      this.errorEntrada = `Escribe la cantidad de: ${sinCantidad.map(f => this.nombreIngrediente(f.idIngrediente)).join(', ')}.`;
      return;
    }
    if (filas.some(f => this.idTipoMercadoDe(f.perecedero) == null)) {
      this.errorEntrada = 'No se encontró el tipo de mercado (Perecedero / No perecedero) en el catálogo del servidor.';
      return;
    }

    this.errorEntrada = '';
    this.guardandoEntrada = true;

    let motivoFallo = '';
    const peticiones = filas.map(f => {
      const auto = this.datosAutomaticos(f);
      return this.entregasService.registrar({
        id_ingrediente: f.idIngrediente!,
        id_tipo_mercado: this.idTipoMercadoDe(f.perecedero)!,
        frecuencia: auto.frecuencia,
        cantidad: f.cantidad!,
        unidad: f.unidad,
        fecha_entrega: this.entradaFecha,
        fecha_vencimiento: auto.vencimiento,
        ...this.datosInstitucion(this.entradaDestino),
        destino: this.entradaDestino.trim(),
        responsable: this.entradaResponsable.trim(),
        observaciones: '',
      } as any).pipe(
        map((resp: any) => ({ ok: true, fila: f, id: resp?.id as number | undefined })),
        catchError(error => {
          console.error('Error al registrar entrada', error);
          motivoFallo = this.describirError(error);
          return of({ ok: false, fila: f, id: undefined as number | undefined });
        }),
      );
    });

    forkJoin(peticiones).subscribe(resultados => {
      this.guardandoEntrada = false;
      const fallidas = resultados.filter(r => !r.ok).map(r => r.fila);
      const guardadas = resultados.length - fallidas.length;

      // Se recuerdan destino, responsable y hora para mostrarlos en "Registro del día"
      const hora = this.horaDe(new Date().toISOString());
      resultados.filter(r => r.ok).forEach(r => this.guardarExtra(r.id, r.fila, {
        destino: this.entradaDestino.trim(),
        responsable: this.entradaResponsable.trim(),
        hora,
      }));

      if (guardadas > 0) {
        this.mostrarHistorialEnvios = true;   // el panel lateral queda en Historial para ver lo registrado
        // El calendario salta al día registrado para que se vea la entrada
        const [anio, mes] = this.entradaFecha.split('-').map(Number);
        this.mesCalendario = new Date(anio, mes - 1, 1);
        this.diaSeleccionado = this.entradaFecha;
        this.cargarHistorial();
      }

      if (fallidas.length === 0) {
        this.mostrarModalEntrada = false;
        void this.alertas.success('Entrada registrada', `Se registraron ${guardadas} producto(s) con destino a ${this.entradaDestino.trim()}.`);
      } else {
        // Se quitan las que sí se guardaron; las fallidas quedan para reintentar
        this.entradaFilas = fallidas;
        this.errorEntrada = `Se guardaron ${guardadas} y fallaron ${fallidas.length}. ` + (motivoFallo ? `Motivo: ${motivoFallo}.` : '');
      }
      this.cdr.markForCheck();
    });
  }

  // =====================================================
  //  ESTADO, DÍAS Y ALERTAS
  // =====================================================
  // Perecederos avisan con 7 días; granos / no perecederos con 30 días
  private umbralAlerta(e: FilaEntrega): number {
    return e.categoria === 'Perecederos' ? 7 : 30;
  }

  diasDe(e: FilaEntrega): number {
    if (!e.fechaVencimiento) return 99999;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vence = new Date(e.fechaVencimiento + 'T00:00:00');
    return Math.round((vence.getTime() - hoy.getTime()) / 86400000);
  }

  estadoDe(e: FilaEntrega): string {
    const dias = this.diasDe(e);
    if (dias < 0) return 'Vencido';
    if (dias <= this.umbralAlerta(e)) return 'Próximo a vencer';
    return 'Vigente';
  }

  // =====================================================
  //  EXPORTAR A EXCEL (respeta el buscador y el tipo de producto)
  // =====================================================
  // Resumen: un renglón por producto y unidad con el total recibido.
  // No mezcla unidades distintas: "Leche en Litros" y "Leche en Kg" salen en renglones separados.
  private resumenPorProducto(lista: FilaEntrega[]) {
    interface Resumen {
      ingrediente: string;
      unidad: string;
      tipoMercado: string;
      total: number;
      entregas: number;
      ultimaFecha: string;
      estadoUltima: string;
      proxVence: string;
    }

    const mapa = new Map<string, Resumen>();
    for (const e of lista) {
      const unidad = this.normalizarUnidad(e.unidad) || 'Sin unidad';
      const clave = `${e.ingrediente.toLowerCase()}|${unidad}`;
      let r = mapa.get(clave);
      if (!r) {
        r = { ingrediente: e.ingrediente, unidad, tipoMercado: e.tipoMercado, total: 0, entregas: 0, ultimaFecha: '', estadoUltima: '', proxVence: '' };
        mapa.set(clave, r);
      }
      r.total += e.cantidad;
      r.entregas++;
      if (e.fechaRecepcion >= r.ultimaFecha) {
        r.ultimaFecha = e.fechaRecepcion;
        r.tipoMercado = e.tipoMercado;
        r.estadoUltima = this.estadoDe(e);
      }
      if (e.fechaVencimiento && this.diasDe(e) >= 0 && (!r.proxVence || e.fechaVencimiento < r.proxVence)) {
        r.proxVence = e.fechaVencimiento;
      }
    }

    return Array.from(mapa.values())
      .map(r => ({ ...r, total: Math.round(r.total * 100) / 100 }))
      .sort((a, b) => a.ingrediente.localeCompare(b.ingrediente, 'es') || a.unidad.localeCompare(b.unidad, 'es'));
  }

  exportarExcelHistorial(): void {
    const lista = this.historialFiltrado;
    if (lista.length === 0) {
      void this.alertas.warning('Sin registros', 'No hay registros para exportar.');
      return;
    }

    const esc = (v: any) => String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const th = 'style="background:#FF8A00;color:#FFFFFF;font-weight:bold;text-align:center"';
    const titulo = 'style="font-size:14pt;font-weight:bold;border:none"';

    const filasResumen = this.resumenPorProducto(lista).map(r => `
      <tr>
        <td><b>${esc(r.ingrediente)}</b></td>
        <td>${esc(r.tipoMercado)}</td>
        <td>${esc(r.unidad)}</td>
        <td style="text-align:right"><b>${r.total}</b></td>
        <td style="text-align:center">${r.entregas}</td>
        <td>${this.fechaCorta(r.ultimaFecha)}</td>
        <td>${r.proxVence ? this.fechaCorta(r.proxVence) : '—'}</td>
        <td>${esc(r.estadoUltima)}</td>
      </tr>`).join('');

    const filasDetalle = lista.map(e => `
      <tr>
        <td>${this.fechaCorta(e.fechaRecepcion)}</td>
        <td>${esc(e.ingrediente)}</td>
        <td>${esc(e.tipoMercado)}</td>
        <td>${esc(e.frecuencia)}</td>
        <td style="text-align:right">${esc(e.cantidad)}</td>
        <td>${esc(e.unidad)}</td>
        <td>${this.fechaCorta(e.fechaVencimiento)}</td>
        <td>${esc(this.estadoDe(e))}</td>
      </tr>`).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>
        <table>
          <tr><td colspan="8" ${titulo}>Resumen por producto (total recibido) - ${esc(this.nombreInstitucion)}</td></tr>
        </table>
        <table border="1">
          <thead><tr>
            <th ${th}>Producto</th><th ${th}>Tipo de mercado</th><th ${th}>Unidad</th>
            <th ${th}>Total recibido</th><th ${th}>N.º de entregas</th><th ${th}>Última entrega</th>
            <th ${th}>Próximo vencimiento</th><th ${th}>Estado última entrega</th>
          </tr></thead>
          <tbody>${filasResumen}</tbody>
        </table>

        <br><br>

        <table>
          <tr><td colspan="8" ${titulo}>Detalle de entregas</td></tr>
        </table>
        <table border="1">
          <thead><tr>
            <th ${th}>Fecha</th><th ${th}>Ingrediente</th><th ${th}>Tipo de mercado</th><th ${th}>Frecuencia</th>
            <th ${th}>Cantidad</th><th ${th}>Unidad</th><th ${th}>Vencimiento</th><th ${th}>Estado</th>
          </tr></thead>
          <tbody>${filasDetalle}</tbody>
        </table>
      </body></html>`;

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_entregas_${this.fechaHoy()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}