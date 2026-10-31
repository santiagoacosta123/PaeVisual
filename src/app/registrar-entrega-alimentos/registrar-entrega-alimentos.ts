import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription, concat, forkJoin, of } from 'rxjs';
import { catchError, map, toArray } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SweetAlertService } from '../sweet-alert.service';
import { EntregasService } from '../services/entregas.service';
import { AuthService, InstitucionAsignada } from '../core/auth/auth.service';

// ===================== TIPOS =====================
interface Opcion { id: number; nombre: string; }

interface FilaEntrega {
  id?: number; idIngrediente: number | null; idTipoMercado: number | null;
  ingrediente: string; tipoMercado: string; categoria: 'Granos' | 'Perecederos';
  frecuencia: string; cantidad: number; unidad: string;
  fechaRecepcion: string; fechaVencimiento: string;          // YYYY-MM-DD
  codigo?: string; lote?: string; destino?: string; hora?: string; responsable?: string; estadoEntrega?: string;
  fechaRegistro?: string;     // día en que se hizo el registro
  loteRegistro?: string;      // igual para los productos guardados juntos
}

interface ProductoCatalogo { id: number; nombre: string; categoria: string; unidad: string; idTipoMercado: number | null; }
interface GrupoPagina { nombre: string; emoji: string; total: number; productos: ProductoCatalogo[]; }
interface CategoriaOpcion { nombre: string; emoji: string; total: number; }
interface DiaCalendario {
  iso: string; numero: number; enMes: boolean; esHoy: boolean; seleccionado: boolean;
  entregas: number; estado: 'Vigente' | 'Próximo a vencer' | 'Vencido' | null; vencen: number;
}
interface RegistroDia {
  codigo: string; descripcion: string; estado: string; destino: string; hora: string;
  responsable: string; fechaRegistro: string; items: FilaEntrega[];
}
interface EntradaFila { idIngrediente: number | null; cantidad: number | null; unidad: string; perecedero: boolean; }
interface EnvioRegistro {
  id: number; idInstitucion: number | null; ingrediente: string; cantidad: number; unidad: string;
  destino: string; fechaSalida: string; fechaEntrega: string; enviadoEl: string;
}
interface ItemInventario {
  producto: ProductoCatalogo; cantidad: number; unidad: string;
  estado: string | null; motivo: '' | 'Agotado' | 'Sin entradas';
}
interface ExtraEntrada { destino: string; responsable: string; hora: string; fechaRegistro?: string; loteRegistro?: string; }
interface ResumenEntradaProducto { clave: string; ingrediente: string; unidad: string; cantidad: number; veces: number; }
interface GrupoEntrada {
  clave: string; destino: string; fechaRegistro: string; fechaRecepcion: string; hora: string;
  responsable: string; items: FilaEntrega[]; productos: ResumenEntradaProducto[];
}
interface GrupoEnvio { clave: string; destino: string; fechaSalida: string; fechaEntrega: string; items: EnvioRegistro[]; }

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
  ingredientes: Opcion[] = [];
  tiposMercado: Opcion[] = [];
  cargandoCatalogos = true;

  // Se usan si el servidor no devuelve datos. Para GUARDAR, estos ids deben existir en el backend.
  private readonly productosBase: Opcion[] = [
    'Arroz', 'Frijol', 'Lentejas', 'Pasta', 'Harina de maíz', 'Azúcar', 'Sal', 'Aceite', 'Panela', 'Avena',
    'Leche', 'Huevos', 'Pollo', 'Carne de res', 'Papa', 'Yuca', 'Plátano', 'Zanahoria', 'Tomate', 'Cebolla',
  ].map((nombre, i) => ({ id: i + 1, nombre }));
  private readonly tiposBase: Opcion[] = [{ id: 1, nombre: 'Perecedero' }, { id: 2, nombre: 'No perecedero' }];
  private readonly unidadPorDefecto: Record<string, string> = { Aceite: 'Litros', Leche: 'Litros', Huevos: 'Unidades' };
  private readonly claveCacheIngredientes = 'sirae_cache_ingredientes';
  private readonly claveCacheTipos = 'sirae_cache_tipos_mercado';

  // ===================== HISTORIAL =====================
  private readonly urlEntregas = `${environment.apiUrl}/entregas/`;
  cargandoHistorial = false;
  errorHistorial = false;
  private entregasRaw: any[] = [];          // solo ENTRADAS (sin fecha_salida)
  historial: FilaEntrega[] = [];
  historialEnvios: EnvioRegistro[] = [];
  private totalesDisponibles = new Map<string, number>();   // entradas − envíos por producto
  private productosConEntradas = new Set<string>();

  // ===================== INSTITUCIÓN ACTIVA =====================
  institucionActiva: InstitucionAsignada | null = null;
  idInstitucion: number | null = null;
  idSede: number | null = null;             // viene de ?sede=ID
  ahoraTexto = '';
  private subInstitucion?: Subscription;
  private subRuta?: Subscription;
  private reloj?: ReturnType<typeof setInterval>;

  // ===================== FILTROS Y PAGINACIÓN =====================
  textoFiltro = '';
  filtroMercado: FiltroMercado = 'Todos';
  categoriaMenu = 'Todos';
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
    this.ingredientes = this.leerCache<Opcion[]>(this.claveCacheIngredientes) ?? this.productosBase;
    this.tiposMercado = this.leerCache<Opcion[]>(this.claveCacheTipos) ?? this.tiposBase;

    this.institucionActiva = this.authService.obtenerInstitucionActiva();
    this.idInstitucion = this.institucionActiva?.id_institucion ?? this.authService.obtenerUsuario()?.id_institucion ?? null;

    this.subInstitucion = this.authService.institucionActiva$.subscribe(institucion => {
      const anterior = this.idInstitucion;
      this.institucionActiva = institucion;
      this.idInstitucion = institucion?.id_institucion ?? this.authService.obtenerUsuario()?.id_institucion ?? null;
      if (anterior !== this.idInstitucion) this.cargarHistorial();
      this.cdr.markForCheck();
    });

    this.subRuta = this.route.queryParamMap.subscribe(params => {
      const sede = Number(params.get('sede'));
      const idSede = Number.isInteger(sede) && sede > 0 ? sede : null;
      if (idSede !== this.idSede) { this.idSede = idSede; this.cargarHistorial(); }
      this.cdr.markForCheck();
    });

    this.actualizarReloj();
    this.reloj = setInterval(() => { this.actualizarReloj(); this.cdr.markForCheck(); }, 60_000);
    this.cargarHistorial();
    this.cargarCatalogos();
  }

  ngOnDestroy(): void {
    this.subInstitucion?.unsubscribe();
    this.subRuta?.unsubscribe();
    if (this.reloj !== undefined) clearInterval(this.reloj);
  }

  @HostListener('document:keydown.escape')
  alPresionarEsc(): void {
    if (this.mostrarModalInventario) this.mostrarModalInventario = false;
    else if (this.mostrarModalEntrada && !this.guardandoEntrada) this.mostrarModalEntrada = false;
    else this.modalDiaAbierto = false;
  }

  // Una sola función de seguimiento para todas las listas de la plantilla
  trackPor(_: number, x: any): any {
    return x.clave ?? x.iso ?? x.codigo ?? x.producto?.id ?? x.id ?? x.nombre
      ?? `${x.ingrediente}-${x.fechaRecepcion}-${x.cantidad}`;
  }

  // ===================== DATOS DE LA INSTITUCIÓN =====================
  get nombreInstitucion(): string {
    const u = this.authService.obtenerUsuario();
    return this.institucionActiva?.nombre_institucion ?? u?.institucion_nombre ?? u?.institucion ?? 'Institución';
  }

  get nombreSede(): string {
    return this.institucionActiva?.sedes?.find(s => Number(s.id_sede ?? s.id) === this.idSede)?.nombre_sede ?? '';
  }

  get destinosDisponibles(): string[] {
    if (this.idInstitucion === null) return [];
    const inst = this.nombreInstitucion;
    const sedes = this.institucionActiva?.sedes ?? [];
    if (this.idSede !== null) {
      const sede = sedes.find(s => Number(s.id_sede ?? s.id) === this.idSede);
      return [sede?.nombre_sede ? `${inst} - ${sede.nombre_sede}` : inst];
    }
    return [inst, ...sedes.filter(s => s.nombre_sede).map(s => `${inst} - ${s.nombre_sede}`)];
  }

  private actualizarReloj(): void {
    this.ahoraTexto = new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  // ===================== CACHÉ LOCAL =====================
  private guardarCache(clave: string, datos: unknown): void {
    try { localStorage.setItem(clave, JSON.stringify(datos)); } catch { /* sin espacio o bloqueado */ }
  }

  private leerCache<T>(clave: string): T | null {
    try {
      const v = JSON.parse(localStorage.getItem(clave) || 'null');
      return Array.isArray(v) && v.length > 0 ? (v as T) : null;
    } catch { return null; }
  }

  // ===================== UTILIDADES =====================
  private datosInstitucion(destino?: string): { id_institucion?: number; id_sede?: number } {
    const inst = this.institucionActiva?.id_institucion ?? this.idInstitucion ?? undefined;
    const elegido = destino ?? this.entradaDestino;
    const sede = this.institucionActiva?.sedes?.find(s => elegido.endsWith(` - ${s.nombre_sede}`));
    const idSede = sede ? Number(sede.id_sede ?? sede.id) : this.idSede ?? undefined;
    return { ...(inst !== undefined ? { id_institucion: inst } : {}), ...(idSede !== undefined ? { id_sede: idSede } : {}) };
  }

  private soloDeInstitucion(lista: any[]): any[] {
    return lista.filter(item => {
      const refInst = item.id_institucion ?? (typeof item.institucion === 'object' && item.institucion
        ? item.institucion.id_institucion ?? item.institucion.id : item.institucion);
      if (this.idInstitucion !== null && refInst != null && Number(refInst) !== this.idInstitucion) return false;
      if (this.idSede === null) return true;

      const refSede = item.id_sede ?? (typeof item.sede === 'object' && item.sede ? item.sede.id_sede ?? item.sede.id : item.sede);
      if (refSede != null) return Number(refSede) === this.idSede;
      const destino = typeof item.destino === 'string' ? item.destino : '';
      return destino.includes(' - ') && this.norm(destino).endsWith(this.norm(` - ${this.nombreSede}`));
    });
  }

  private norm(v: string): string {
    return (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  // Acepta texto o un objeto { nombre }. Un número (id) no es un nombre.
  private texto(v: any): string {
    if (v == null || typeof v === 'number') return '';
    return typeof v === 'object' ? String(v.nombre ?? v.name ?? '') : String(v);
  }

  private soloFecha(v: any): string { return String(v ?? '').substring(0, 10); }

  // Fecha local de un valor del servidor (si trae hora UTC la pasa a hora local)
  private fechaLocalDe(v: any): string {
    const s = String(v ?? '');
    if (!s.includes('T')) return s.substring(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? s.substring(0, 10) : this.aISO(d);
  }

  // "7:50 a. m." a partir de "07:50:00" o de una fecha ISO
  private horaDe(v: any): string {
    const s = String(v ?? '');
    if (!s) return '';
    const d = s.includes('T') ? new Date(s) : new Date(`1970-01-01T${s}`);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  private normalizarUnidad(v: string): string {
    const u = (v || '').toLowerCase();
    if (u.includes('kg') || u.includes('kilo')) return 'Kg';
    if (u.includes('lit') || u === 'l') return 'Litros';
    if (u.includes('unid') || u === 'ud') return 'Unidades';
    return v || '';
  }

  private aISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private sumarDiasISO(iso: string, dias: number): string {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return this.aISO(d);
  }

  private diasEntre(desde: string, hasta: string): number {
    return Math.round((new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()) / 86400000);
  }

  // "Cada 8 días" -> 8 | "Semanal" -> 7 | "Quincenal" -> 15 | "Mensual" -> 30
  private diasDeFrecuencia(texto: string): number | null {
    const t = (texto || '').toLowerCase();
    const num = t.match(/\d+/);
    if (num) return Number(num[0]);
    if (t.includes('seman')) return 7;
    if (t.includes('quinc')) return 15;
    if (t.includes('mens')) return 30;
    return t.includes('dia') ? 1 : null;
  }

  private describirError(error: any): string {
    const cuerpo = typeof error?.error === 'string' ? error.error : JSON.stringify(error?.error ?? '');
    const limpiar = (v: string) => v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    switch (error?.status) {
      case 0: return 'no hay conexión con el servidor (¿está encendido el backend?)';
      case 401: return 'la sesión expiró; inicia sesión de nuevo';
      case 403: return 'no tienes permiso para esta acción (403)';
      case 404: return 'la ruta no existe en el servidor (404); revisa la URL de la API';
      case 400: return `el servidor rechazó los datos (400): ${cuerpo.slice(0, 160)}`;
      case 500: {
        const titulo = limpiar(cuerpo.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
        const excepcion = limpiar(cuerpo.match(/<pre class="exception_value">([\s\S]*?)<\/pre>/i)?.[1] ?? '');
        const d = [titulo, excepcion].filter(Boolean).join(': ') || (cuerpo.startsWith('<') ? '' : limpiar(cuerpo));
        return d ? `error 500 del servidor: ${d.slice(0, 220)}` : 'error 500 del servidor';
      }
      default: return error?.status ? `error ${error.status} del servidor` : 'error desconocido';
    }
  }

  fechaHoy(): string { return this.aISO(new Date()); }

  fechaCorta(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  fechaDiaModal(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ===================== CARGA DE CATÁLOGOS =====================
  cargarCatalogos(): void {
    forkJoin({
      ingredientes: this.entregasService.cargarIngredientes() as unknown as Observable<Opcion[]>,
      tiposMercado: this.entregasService.cargarTiposMercado() as unknown as Observable<Opcion[]>,
    }).subscribe({
      next: ({ ingredientes, tiposMercado }) => {
        this.ingredientes = ingredientes.length ? ingredientes : this.productosBase;
        this.tiposMercado = tiposMercado.length ? tiposMercado : this.tiposBase;
        // Solo se guarda en caché lo que sí llegó del servidor
        if (ingredientes.length) this.guardarCache(this.claveCacheIngredientes, ingredientes);
        if (tiposMercado.length) this.guardarCache(this.claveCacheTipos, tiposMercado);
        this.terminarCatalogos();
      },
      error: error => {
        console.error('Error al cargar catálogos de entregas:', error);
        void this.alertas.error('No se pudo cargar el catálogo',
          `No se pudieron cargar los catálogos del servidor: ${this.describirError(error)}. Se muestran productos de ejemplo; para guardar debe funcionar la conexión.`);
        this.terminarCatalogos();
      },
    });
  }

  private terminarCatalogos(): void {
    this.cargandoCatalogos = false;
    this.reconstruirHistorial();
    this.cdr.markForCheck();
  }

  // ===================== CARGA DEL HISTORIAL (entradas y envíos) =====================
  cargarHistorial(): void {
    this.cargandoHistorial = this.entregasRaw.length === 0 && this.historialEnvios.length === 0;
    this.errorHistorial = false;

    const idPedido = this.idInstitucion, sedePedida = this.idSede;
    let params = new HttpParams();
    if (idPedido != null) params = params.set('id_institucion', idPedido);
    if (sedePedida != null) params = params.set('id_sede', sedePedida);

    this.http.get<any>(this.urlEntregas, { params }).pipe(
      map(d => this.soloDeInstitucion(Array.isArray(d) ? d : (d?.results ?? []))),
    ).subscribe({
      next: lista => {
        if (idPedido !== this.idInstitucion || sedePedida !== this.idSede) return;   // llegó tarde
        // Los envíos se separan de las entradas por "fecha_salida"
        this.historialEnvios = this.registrosEnvioDe(lista.filter(i => !!i?.fecha_salida));
        this.entregasRaw = lista.filter(i => !i?.fecha_salida);
        this.reconstruirHistorial();
        this.cargandoHistorial = false;
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Error al consultar entregas:', error);
        this.cargandoHistorial = false;
        this.errorHistorial = this.entregasRaw.length === 0;
        this.cdr.markForCheck();
      },
    });
  }

  private reconstruirHistorial(): void {
    this.historial = this.entregasRaw.map(i => this.aFila(i));
    this.seleccionados = this.seleccionados
      .map(s => this.ultimaEntradaDe(s.idIngrediente))
      .filter((e): e is FilaEntrega => !!e);
    this.recalcularTotales();
  }

  private ultimaEntradaDe(idIngrediente: number | null): FilaEntrega | undefined {
    return this.historial
      .filter(e => e.idIngrediente === idIngrediente)
      .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion) || ((b.id ?? 0) - (a.id ?? 0)))[0];
  }

  private aFila(item: any): FilaEntrega {
    const idIngrediente = item.id_ingrediente ?? (typeof item.ingrediente === 'number' ? item.ingrediente : item.ingrediente?.id);
    const idTipo = item.id_tipo_mercado ?? (typeof item.tipo_mercado === 'number' ? item.tipo_mercado : item.tipo_mercado?.id);

    const ingrediente = this.texto(item.ingrediente_nombre) || this.texto(item.nombre_ingrediente) || this.texto(item.ingrediente)
      || this.ingredientes.find(i => i.id === idIngrediente)?.nombre || '';
    const tipoMercado = this.texto(item.tipo_mercado_nombre) || this.texto(item.nombre_tipo_mercado) || this.texto(item.tipo_mercado)
      || this.tiposMercado.find(t => t.id === idTipo)?.nombre || '';

    const nm = tipoMercado.toLowerCase();
    const perecedero = nm.includes('perecedero') && !nm.includes('no perecedero');
    const idIng = idIngrediente != null ? Number(idIngrediente) : (this.ingredientes.find(i => i.nombre === ingrediente)?.id ?? null);
    const idTip = idTipo != null ? Number(idTipo) : (this.tiposMercado.find(t => t.nombre === tipoMercado)?.id ?? null);

    const fechaRecepcion = this.soloFecha(item.fecha_entrega ?? item.fecha_recepcion ?? item.fechaRecepcion);
    const extra = this.extraDe(item.id, idIng, fechaRecepcion, Number(item.cantidad) || 0);

    return {
      id: item.id, idIngrediente: idIng, idTipoMercado: idTip, ingrediente, tipoMercado,
      categoria: perecedero ? 'Perecederos' : 'Granos',
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
      fechaRegistro: this.fechaLocalDe(item.created_at ?? item.fecha_creacion) || extra?.fechaRegistro || '',
      loteRegistro: item.lote_registro ?? extra?.loteRegistro ?? '',
    };
  }

  private registrosEnvioDe(lista: any[]): EnvioRegistro[] {
    const nombreRef = (v: any): string =>
      typeof v === 'string' ? v : (v && typeof v === 'object' ? v.nombre_institucion ?? v.nombre ?? v.nombre_ingrediente ?? '' : '');

    return lista.flatMap((item, index) => {
      const ref = item.id_institucion ?? item.institucion;
      const idInst = typeof ref === 'object' && ref ? ref.id_institucion ?? ref.id : ref;
      const sede = item.sede_nombre || nombreRef(item.id_sede ?? item.sede);
      const nombre = item.institucion_nombre || nombreRef(ref) || item.destino_nombre || item.destino || '';
      if ((idInst == null || idInst === '') && !nombre) return [];

      return [{
        id: Number(item.id_entrega ?? item.id ?? index),
        idInstitucion: idInst == null ? null : Number(idInst),
        ingrediente: item.ingrediente_nombre || nombreRef(item.ingrediente)
          || this.ingredientes.find(i => i.id === Number(item.ingrediente))?.nombre || '',
        cantidad: item.cantidad == null || item.cantidad === '' ? 0 : Number(item.cantidad),
        unidad: item.unidad ?? '',
        destino: item.destino || (sede ? `${nombre} - ${sede}` : nombre),
        fechaSalida: this.soloFecha(item.fecha_salida ?? item.fecha_entrega),
        fechaEntrega: this.soloFecha(item.fecha_entrega),
        enviadoEl: this.soloFecha(item.created_at ?? item.fecha_creacion ?? item.fecha_entrega),
      }];
    });
  }

  // ===================== HISTORIAL AGRUPADO =====================
  // Entradas de la más reciente a la más antigua (las de un mismo registro quedan juntas)
  get entradasHistorial(): FilaEntrega[] {
    return [...this.historial].sort((a, b) =>
      (b.fechaRegistro || b.fechaRecepcion).localeCompare(a.fechaRegistro || a.fechaRecepcion) || ((b.id ?? 0) - (a.id ?? 0)));
  }

  // Lo que se registró junto aparece junto, en una sola tarjeta
  get gruposEntradas(): GrupoEntrada[] {
    const mapa = new Map<string, GrupoEntrada>();
    for (const e of this.entradasHistorial) {
      const fechaRegistro = e.fechaRegistro || e.fechaRecepcion;
      const clave = e.loteRegistro || `${fechaRegistro}|${e.fechaRecepcion}|${e.hora}|${e.destino}`;
      let g = mapa.get(clave);
      if (!g) {
        g = { clave, destino: e.destino || this.nombreInstitucion, fechaRegistro, fechaRecepcion: e.fechaRecepcion,
              hora: e.hora || '', responsable: '', items: [], productos: [] };
        mapa.set(clave, g);
      }
      g.responsable ||= e.responsable || '';
      g.hora ||= e.hora || '';
      g.items.push(e);
    }

    const grupos = Array.from(mapa.values());
    for (const g of grupos) {
      g.items.sort((a, b) => a.ingrediente.localeCompare(b.ingrediente, 'es'));
      const totales = new Map<string, ResumenEntradaProducto>();
      for (const e of g.items) {
        const unidad = this.normalizarUnidad(e.unidad) || e.unidad;
        const k = `${this.claveProducto(e.idIngrediente, e.ingrediente)}|${unidad}`;
        const r = totales.get(k) ?? { clave: k, ingrediente: e.ingrediente, unidad, cantidad: 0, veces: 0 };
        r.cantidad = Math.round((r.cantidad + e.cantidad) * 100) / 100;
        r.veces++;
        totales.set(k, r);
      }
      g.productos = Array.from(totales.values());
    }
    return grupos;
  }

  // Envíos agrupados por destino y fechas
  get gruposEnvios(): GrupoEnvio[] {
    const mapa = new Map<string, GrupoEnvio>();
    for (const v of this.historialEnvios) {
      const clave = `${v.fechaSalida}|${v.fechaEntrega}|${v.destino}`;
      const g = mapa.get(clave) ?? { clave, destino: v.destino, fechaSalida: v.fechaSalida, fechaEntrega: v.fechaEntrega, items: [] };
      g.items.push(v);
      mapa.set(clave, g);
    }
    const grupos = Array.from(mapa.values());
    grupos.forEach(g => g.items.sort((a, b) => a.ingrediente.localeCompare(b.ingrediente, 'es')));
    return grupos;
  }

  fueEnviado(nombre: string): boolean {
    return this.historialEnvios.some(e => e.ingrediente === nombre);
  }

  // ===================== TOTAL DISPONIBLE (entradas − envíos) =====================
  // Clave = id del producto (si no se encuentra, el nombre sin tildes)
  private claveProducto(id: number | null | undefined, nombre: string): string {
    const n = this.norm(nombre);
    const idFinal = id ?? this.ingredientes.find(i => this.norm(i.nombre) === n)?.id ?? null;
    return idFinal != null ? `id:${idFinal}` : `n:${n}`;
  }

  private recalcularTotales(): void {
    const mapa = new Map<string, number>();
    const conEntradas = new Set<string>();
    for (const e of this.historial) {
      const k = this.claveProducto(e.idIngrediente, e.ingrediente);
      mapa.set(k, (mapa.get(k) ?? 0) + e.cantidad);
      conEntradas.add(k);
    }
    for (const v of this.historialEnvios) {
      const k = this.claveProducto(null, v.ingrediente);
      mapa.set(k, (mapa.get(k) ?? 0) - v.cantidad);
    }
    mapa.forEach((valor, k) => mapa.set(k, Math.max(0, Math.round(valor * 100) / 100)));
    this.totalesDisponibles = mapa;
    this.productosConEntradas = conEntradas;
  }

  tieneEntradas(p: ProductoCatalogo): boolean {
    return this.productosConEntradas.has(this.claveProducto(p.id, p.nombre));
  }

  totalDisponible(p: ProductoCatalogo): number {
    return this.totalesDisponibles.get(this.claveProducto(p.id, p.nombre)) ?? 0;
  }

  // ===================== INVENTARIO (ventana emergente) =====================
  mostrarModalInventario = false;

  private get itemsInventario(): ItemInventario[] {
    return this.catalogoMenu.map(p => {
      const cantidad = this.totalDisponible(p);
      const ultima = this.ultimaEntradaDe(p.id);
      const motivo: ItemInventario['motivo'] = !this.tieneEntradas(p) ? 'Sin entradas' : cantidad <= 0 ? 'Agotado' : '';
      return { producto: p, cantidad, unidad: p.unidad, estado: ultima ? this.estadoDe(ultima) : null, motivo };
    }).sort((a, b) => a.producto.categoria.localeCompare(b.producto.categoria, 'es')
      || this.nombreMostrado(a.producto.nombre).localeCompare(this.nombreMostrado(b.producto.nombre), 'es'));
  }

  get inventarioDisponible(): ItemInventario[] { return this.itemsInventario.filter(i => i.motivo === ''); }
  get inventarioNoDisponible(): ItemInventario[] { return this.itemsInventario.filter(i => i.motivo !== ''); }

  // ===================== MENÚ: emojis, imágenes y categorías =====================
  emojiDe(nombre: string): string {
    const n = (nombre || '').toLowerCase();
    const mapa: [string[], string][] = [
      [['arroz', 'avena'], '🌾'], [['frijol', 'lenteja', 'garbanzo', 'arveja'], '🫘'], [['pasta', 'espagueti', 'fideo'], '🍝'],
      [['harina', 'maíz', 'maiz'], '🌽'], [['azúcar', 'azucar'], '🍬'], [['sal'], '🧂'], [['aceite'], '🫒'], [['panela'], '🍯'],
      [['leche'], '🥛'], [['queso'], '🧀'], [['huevo'], '🥚'], [['pollo', 'pechuga'], '🍗'], [['carne', 'res', 'cerdo'], '🥩'],
      [['pescado', 'atún', 'atun'], '🐟'], [['papa', 'yuca'], '🥔'], [['plátano', 'platano', 'banano'], '🍌'],
      [['zanahoria'], '🥕'], [['tomate'], '🍅'], [['cebolla'], '🧅'], [['manzana'], '🍎'], [['naranja'], '🍊'], [['lechuga', 'verdura'], '🥬'],
    ];
    return mapa.find(([claves]) => claves.some(k => n.includes(k)))?.[1] ?? '🍽️';
  }

  // Lo más específico primero ("molida" antes que "carne", "deslactosad" antes que "leche")
  private readonly imagenesProducto: [string, string][] = [
    ['molida', 'molida.png'], ['carne', 'carne.png'], ['tocino', 'tocino.png'], ['huevo', 'huevos.png'], ['aceite', 'aceite.png'],
    ['platano', 'platano.png'], ['arroz', 'arroz.png'], ['frijol', 'frijoles.png'], ['harina', 'harina.png'],
    ['deslactosad', 'deslatosada.png'], ['leche', 'leche.png'], ['queso', 'queso.png'],
  ];

  // Imagen desde public/ (null = se usa el emoji). Busca por el nombre ORIGINAL del catálogo.
  imagenDe(nombre: string): string | null {
    const n = this.norm(nombre);
    const hallada = this.imagenesProducto.find(([clave]) => n.includes(clave));
    return hallada ? '/' + hallada[1] : null;
  }

  private readonly imagenesCategoria: Record<string, string> = {
    Todos: 'plato.png', 'Granos y cereales': 'granos.png', Despensa: 'sal.png', Lácteos: 'lacteos.png',
    Carnes: 'carne.png', Huevos: 'huevos.png', Verduras: 'verduras.png', Frutas: 'frutas.png', Otros: 'otros.png',
  };

  imagenCategoria(nombre: string): string | null {
    const a = this.imagenesCategoria[nombre];
    return a ? '/' + a : null;
  }

  categoriaDe(nombre: string): string {
    const n = (nombre || '').toLowerCase();
    const mapa: [string[], string][] = [
      [['arroz', 'frijol', 'lenteja', 'garbanzo', 'arveja', 'pasta', 'harina', 'avena', 'maíz', 'maiz'], 'Granos y cereales'],
      [['azúcar', 'azucar', 'sal', 'aceite', 'panela'], 'Despensa'],
      [['leche', 'queso', 'yogur'], 'Lácteos'],
      [['huevo'], 'Huevos'],
      [['pollo', 'pechuga', 'carne', 'res', 'cerdo', 'tocino', 'pescado', 'atún', 'atun', 'jamón', 'jamon', 'chorizo'], 'Carnes'],
      [['papa', 'yuca', 'zanahoria', 'tomate', 'cebolla', 'lechuga', 'verdura'], 'Verduras'],
      [['plátano', 'platano', 'banano', 'manzana', 'naranja', 'mango'], 'Frutas'],
    ];
    return mapa.find(([claves]) => claves.some(k => n.includes(k)))?.[1] ?? 'Otros';
  }

  private emojiDeCategoria(c: string): string {
    const e: Record<string, string> = {
      Todos: '🍽️', 'Granos y cereales': '🌾', Despensa: '🧂', Lácteos: '🥛', Carnes: '🥩', Huevos: '🥚', Verduras: '🥕', Frutas: '🍎',
    };
    return e[c] ?? '📦';
  }

  get categoriasMenu(): CategoriaOpcion[] {
    const conteo = new Map<string, number>();
    this.ingredientes.forEach(i => { const c = this.categoriaDe(i.nombre); conteo.set(c, (conteo.get(c) ?? 0) + 1); });
    const lista = Array.from(conteo.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([nombre, total]) => ({ nombre, emoji: this.emojiDeCategoria(nombre), total }));
    return [{ nombre: 'Todos', emoji: this.emojiDeCategoria('Todos'), total: this.ingredientes.length }, ...lista];
  }

  // Todos los productos del catálogo, con su unidad y tipo (de su última entrada si existe)
  private get catalogoMenu(): ProductoCatalogo[] {
    return this.ingredientes.map(ing => {
      const ultima = this.ultimaEntradaDe(ing.id);
      return {
        id: ing.id, nombre: ing.nombre, categoria: this.categoriaDe(ing.nombre),
        unidad: ultima ? this.normalizarUnidad(ultima.unidad) : (this.unidadPorDefecto[ing.nombre] ?? 'Kg'),
        idTipoMercado: ultima?.idTipoMercado ?? null,
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  // Productos que se ven en las tarjetas (buscador, tipo y categoría)
  get productosMenu(): ProductoCatalogo[] {
    const q = this.textoFiltro.trim().toLowerCase();
    return this.catalogoMenu.filter(p =>
      (this.filtroMercado === 'Todos' || (this.filtroMercado === 'Perecederos') === this.esPerecedero(p))
      && (this.categoriaMenu === 'Todos' || p.categoria === this.categoriaMenu)
      && (!q || [p.nombre, this.nombreMostrado(p.nombre), p.categoria, this.nombreTipo(p)].some(t => t.toLowerCase().includes(q))));
  }

  // Si el producto ya tuvo entradas se usa su tipo de mercado; si no, se deduce por el nombre
  private readonly perecederosPorNombre = [
    'pollo', 'carne', 'res', 'cerdo', 'pescado', 'huevo', 'leche', 'queso', 'yogur', 'papa', 'yuca', 'plátano', 'platano',
    'zanahoria', 'tomate', 'cebolla', 'lechuga', 'banano', 'manzana', 'naranja',
  ];

  esPerecedero(p: ProductoCatalogo): boolean {
    const tipo = this.tiposMercado.find(t => t.id === p.idTipoMercado)?.nombre.toLowerCase();
    if (tipo) return tipo.includes('perecedero') && !tipo.includes('no perecedero');
    return p.nombre.toLowerCase().split(/\s+/).some(w =>
      this.perecederosPorNombre.some(k => w === k || (k.length >= 4 && w.startsWith(k))));
  }

  nombreTipo(p: ProductoCatalogo): string {
    return this.tiposMercado.find(t => t.id === p.idTipoMercado)?.nombre || (this.esPerecedero(p) ? 'Perecedero' : 'No perecedero');
  }

  // Solo cambia lo que se ve en las tarjetas; imágenes, categorías y envíos usan el nombre original
  private readonly nombresTarjeta: Record<string, string> = { 'Carne molida de res': 'Res molida', 'Tocino de cerdo': 'Tocino' };

  nombreMostrado(nombre: string): string { return this.nombresTarjeta[nombre] ?? nombre; }

  // ===================== PAGINACIÓN (por producto, agrupado por categoría) =====================
  private get productosPagina(): ProductoCatalogo[] {
    const ordenados = [...this.productosMenu].sort((a, b) =>
      a.categoria.localeCompare(b.categoria, 'es') || this.nombreMostrado(a.nombre).localeCompare(this.nombreMostrado(b.nombre), 'es'));
    const inicio = (this.paginaEfectiva - 1) * this.porPagina;
    return ordenados.slice(inicio, inicio + this.porPagina);
  }

  get totalProductosMenu(): number { return this.productosMenu.length; }
  get totalPaginas(): number { return Math.max(1, Math.ceil(this.totalProductosMenu / this.porPagina)); }
  get paginaEfectiva(): number { return Math.min(Math.max(1, this.paginaActual), this.totalPaginas); }
  get desdeMostrado(): number { return this.totalProductosMenu === 0 ? 0 : (this.paginaEfectiva - 1) * this.porPagina + 1; }
  get hastaMostrado(): number { return Math.min(this.paginaEfectiva * this.porPagina, this.totalProductosMenu); }

  get gruposPagina(): GrupoPagina[] {
    const totales = new Map<string, number>();
    this.productosMenu.forEach(p => totales.set(p.categoria, (totales.get(p.categoria) ?? 0) + 1));
    const grupos = new Map<string, GrupoPagina>();
    for (const p of this.productosPagina) {
      const g = grupos.get(p.categoria)
        ?? { nombre: p.categoria, emoji: this.emojiDeCategoria(p.categoria), total: totales.get(p.categoria) ?? 0, productos: [] };
      g.productos.push(p);
      grupos.set(p.categoria, g);
    }
    return Array.from(grupos.values());
  }

  // 1 … 4 5 6 … 12
  get numerosPagina(): (number | '…')[] {
    const total = this.totalPaginas, actual = this.paginaEfectiva;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const orden = Array.from(new Set([1, total, actual - 1, actual, actual + 1])).filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
    const salida: (number | '…')[] = [];
    orden.forEach((n, i) => { if (i > 0 && n - orden[i - 1] > 1) salida.push('…'); salida.push(n); });
    return salida;
  }

  irAPagina(p: number | string): void {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > this.totalPaginas) return;
    this.paginaActual = n;
    document.getElementById('catalogo-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setMercado(m: FiltroMercado): void { this.filtroMercado = m; this.paginaActual = 1; }

  // Lo que se exporta a Excel: respeta el buscador y el tipo, del más reciente al más antiguo
  get historialFiltrado(): FilaEntrega[] {
    const q = this.textoFiltro.trim().toLowerCase();
    return this.historial
      .filter(e => (this.filtroMercado === 'Todos' || e.categoria === this.filtroMercado)
        && (!q || [e.ingrediente, e.tipoMercado, e.frecuencia, this.estadoDe(e)].some(t => t.toLowerCase().includes(q))))
      .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion) || ((b.id ?? 0) - (a.id ?? 0)));
  }

  // ===================== PRODUCTOS SELECCIONADOS (panel) Y DESLIZAR =====================
  seleccionados: FilaEntrega[] = [];
  mostrarHistorialEnvios = false;
  readonly umbralSwipe = 70;
  swipeId: number | null = null;
  swipeDx = 0;
  private swipeInicio: { id: number; x: number; y: number; activo: boolean } | null = null;

  private agregarSeleccionado(p: ProductoCatalogo): void {
    if (this.tarjetaActiva(p)) return;
    const ultima = this.ultimaEntradaDe(p.id);
    if (!ultima) { void this.alertas.warning('Sin inventario', `${p.nombre} todavía no tiene entradas en el inventario.`); return; }
    this.seleccionados.push(ultima);
  }

  private quitarPorProducto(p: ProductoCatalogo): void {
    this.seleccionados = this.seleccionados.filter(s => s.idIngrediente !== p.id);
  }

  quitarSeleccionado(item: FilaEntrega): void {
    this.seleccionados = this.seleccionados.filter(s => s.idIngrediente !== item.idIngrediente);
  }

  tarjetaActiva(p: ProductoCatalogo): boolean { return this.seleccionados.some(s => s.idIngrediente === p.id); }

  // Deslizar a la derecha agrega el producto al panel; a la izquierda lo quita
  alIniciarDeslizar(ev: PointerEvent, p: ProductoCatalogo): void {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    this.swipeInicio = { id: p.id, x: ev.clientX, y: ev.clientY, activo: false };
  }

  alMoverDeslizar(ev: PointerEvent): void {
    const s = this.swipeInicio;
    if (!s) return;
    const dx = ev.clientX - s.x, dy = ev.clientY - s.y;
    if (!s.activo) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;   // gesto vertical = scroll normal
      s.activo = true;
      this.swipeId = s.id;
      (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    }
    this.swipeDx = Math.max(-120, Math.min(120, dx));
  }

  alTerminarDeslizar(p: ProductoCatalogo): void {
    const s = this.swipeInicio;
    const dx = this.swipeDx;
    this.cancelarDeslizar();
    if (!s?.activo) return;
    if (dx >= this.umbralSwipe) { this.mostrarHistorialEnvios = false; this.agregarSeleccionado(p); }
    else if (dx <= -this.umbralSwipe) this.quitarPorProducto(p);
  }

  cancelarDeslizar(): void { this.swipeInicio = null; this.swipeId = null; this.swipeDx = 0; }

  // ===================== ENVÍO DESDE EL PANEL (un botón para uno o varios productos) =====================
  private cantidadesEnviar: Record<number, number | null> = {};
  errorEnvioPanel = '';
  guardandoEnvio = false;

  disponibleDe(sel: FilaEntrega): number {
    return this.totalesDisponibles.get(this.claveProducto(sel.idIngrediente, sel.ingrediente)) ?? 0;
  }

  cantidadEnviarDe(sel: FilaEntrega): number {
    return sel.idIngrediente == null ? 0 : (this.cantidadesEnviar[sel.idIngrediente] ?? 0);
  }

  fijarCantidadEnviar(sel: FilaEntrega, valor: any): void {
    if (sel.idIngrediente == null) return;
    const n = Number(valor);
    this.cantidadesEnviar[sel.idIngrediente] = Number.isFinite(n) && n > 0 ? n : null;
    this.errorEnvioPanel = '';
  }

  ajustarCantidadEnviar(sel: FilaEntrega, paso: number): void {
    const nueva = Math.max(0, Math.round((this.cantidadEnviarDe(sel) + paso) * 100) / 100);
    this.fijarCantidadEnviar(sel, Math.min(nueva, this.disponibleDe(sel)));
  }

  get productosParaEnviar(): FilaEntrega[] { return this.seleccionados.filter(s => this.cantidadEnviarDe(s) > 0); }

  enviarSeleccionados(): void {
    if (this.guardandoEnvio) return;
    const items = this.productosParaEnviar;
    const fallo = (m: string) => { this.errorEnvioPanel = m; };
    this.errorEnvioPanel = '';

    if (!items.length) return fallo('Escribe la cantidad a enviar de al menos un producto.');
    const excedidos = items.filter(s => this.cantidadEnviarDe(s) > this.disponibleDe(s));
    if (excedidos.length) return fallo(`No puedes enviar más de lo disponible: ${excedidos.map(s => s.ingrediente).join(', ')}.`);
    const incompletos = items.filter(s => !s.idIngrediente || !s.idTipoMercado || !s.fechaVencimiento);
    if (incompletos.length) return fallo(`Faltan datos requeridos para registrar el envío de: ${incompletos.map(s => s.ingrediente).join(', ')}.`);

    const destino = this.destinosDisponibles[0] || this.nombreInstitucion;
    const datos = this.datosInstitucion(destino);
    if (datos.id_institucion === undefined) return fallo('No se encontró el identificador de la institución.');

    const hoy = this.fechaHoy();
    this.guardandoEnvio = true;

    const peticiones = items.map(sel => {
      const cantidad = this.cantidadEnviarDe(sel);
      const unidad = this.normalizarUnidad(sel.unidad) || 'Kg';
      return this.entregasService.registrar({
        id_ingrediente: sel.idIngrediente!, id_tipo_mercado: sel.idTipoMercado!, ...datos,
        fecha_entrega: hoy, fecha_salida: hoy, fecha_vencimiento: sel.fechaVencimiento,
        cantidad, observaciones: '', frecuencia: sel.frecuencia, unidad, destino,
      } as any).pipe(
        map(() => ({ ok: true, sel, cantidad, unidad, motivo: '' })),
        catchError(error => {
          console.error(`Error al enviar ${sel.ingrediente}:`, error?.error ?? error);   // respuesta completa en la consola (F12)
          return of({ ok: false, sel, cantidad, unidad, motivo: this.describirError(error) });
        }),
      );
    });

    // Uno tras otro, por si el servidor falla al recibir varios envíos a la vez
    concat(...peticiones).pipe(toArray()).subscribe(resultados => {
      this.guardandoEnvio = false;
      const exitosos = resultados.filter(r => r.ok);
      const fallidos = resultados.filter(r => !r.ok);

      // Se muestran al instante; al recargar se reemplazan por los del servidor
      const registros: EnvioRegistro[] = exitosos.map((r, i) => ({
        id: Date.now() + i, idInstitucion: datos.id_institucion ?? null, ingrediente: r.sel.ingrediente,
        cantidad: r.cantidad, unidad: r.unidad, destino, fechaSalida: hoy, fechaEntrega: hoy, enviadoEl: hoy,
      }));
      this.historialEnvios = [...registros, ...this.historialEnvios];
      exitosos.forEach(r => this.fijarCantidadEnviar(r.sel, null));
      this.recalcularTotales();
      if (exitosos.length) { this.mostrarHistorialEnvios = true; this.cargarHistorial(); }

      if (fallidos.length) {
        this.errorEnvioPanel = `Se enviaron ${exitosos.length} producto(s). No se pudo enviar: ${fallidos.map(r => `${r.sel.ingrediente} (${r.motivo})`).join('; ')}.`;
        void this.alertas.error('Envío incompleto', this.errorEnvioPanel);
      } else {
        void this.alertas.success('Envío registrado', `${exitosos.length} producto(s) enviados a ${destino}, con entrega el ${this.fechaCorta(hoy)}.`);
      }
      this.cdr.markForCheck();
    });
  }

  // ===================== CALENDARIO =====================
  mostrarCalendario = false;
  mesCalendario = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  diaSeleccionado = this.aISO(new Date());
  modalDiaAbierto = false;
  readonly nombresDias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  private readonly nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  irACalendario(): void { this.mostrarCalendario = true; }
  get tituloMes(): string { return `${this.nombresMeses[this.mesCalendario.getMonth()]} ${this.mesCalendario.getFullYear()}`; }
  mesAnterior(): void { this.mesCalendario = new Date(this.mesCalendario.getFullYear(), this.mesCalendario.getMonth() - 1, 1); }
  mesSiguiente(): void { this.mesCalendario = new Date(this.mesCalendario.getFullYear(), this.mesCalendario.getMonth() + 1, 1); }

  irAHoy(): void {
    const hoy = new Date();
    this.mesCalendario = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.diaSeleccionado = this.aISO(hoy);
  }

  // Un día gris (otro mes) cambia el calendario a ese mes; además abre "Registro del día"
  seleccionarDia(iso: string): void {
    this.diaSeleccionado = iso;
    const [anio, mes] = iso.split('-').map(Number);
    if (anio !== this.mesCalendario.getFullYear() || mes - 1 !== this.mesCalendario.getMonth()) this.mesCalendario = new Date(anio, mes - 1, 1);
    this.modalDiaAbierto = true;
  }

  // El buscador también filtra el calendario por producto
  private get historialCalendario(): FilaEntrega[] {
    const q = this.textoFiltro.trim().toLowerCase();
    return q ? this.historial.filter(e => e.ingrediente.toLowerCase().includes(q)) : this.historial;
  }

  // Semanas completas (lunes a domingo) del mes que se ve
  get diasCalendario(): DiaCalendario[] {
    const lista = this.historialCalendario, hoy = this.aISO(new Date()), primero = this.mesCalendario;
    const desplazamiento = (primero.getDay() + 6) % 7;
    const dias: DiaCalendario[] = [];
    for (let i = 0; i < 42; i++) {
      const fecha = new Date(primero.getFullYear(), primero.getMonth(), 1 - desplazamiento + i);
      const iso = this.aISO(fecha);
      const recibidos = lista.filter(e => e.fechaRecepcion === iso);
      const estados = recibidos.map(e => this.estadoDe(e));
      dias.push({
        iso, numero: fecha.getDate(), enMes: fecha.getMonth() === primero.getMonth(), esHoy: iso === hoy,
        seleccionado: iso === this.diaSeleccionado, entregas: recibidos.length,
        estado: !recibidos.length ? null : estados.includes('Vencido') ? 'Vencido' : estados.includes('Próximo a vencer') ? 'Próximo a vencer' : 'Vigente',
        vencen: lista.filter(e => e.fechaVencimiento === iso).length,
      });
    }
    return dias[35].enMes ? dias : dias.slice(0, 35);
  }

  private delDia(campo: 'fechaRecepcion' | 'fechaVencimiento'): FilaEntrega[] {
    return this.historialCalendario.filter(e => e[campo] === this.diaSeleccionado)
      .sort((a, b) => a.ingrediente.localeCompare(b.ingrediente, 'es'));
  }

  get vencenDelDia(): FilaEntrega[] { return this.delDia('fechaVencimiento'); }

  claseChipEstado(estado: string | null): string {
    return estado === 'Vencido' ? 'est-bad' : estado === 'Próximo a vencer' ? 'est-warn' : 'est-ok';
  }

  // Entregas del día agrupadas por código (si no hay, usa el folio CI-AAAAMMDD)
  get registrosDelDia(): RegistroDia[] {
    const mapa = new Map<string, RegistroDia>();
    for (const e of this.delDia('fechaRecepcion')) {
      const codigo = e.codigo || 'CI-' + e.fechaRecepcion.replace(/-/g, '');
      const reg = mapa.get(codigo) ?? { codigo, descripcion: 'Lote de entrega SIRAE', estado: e.estadoEntrega || 'Recibida',
        destino: '—', hora: '—', responsable: '—', fechaRegistro: '', items: [] };
      reg.items.push(e);
      mapa.set(codigo, reg);
    }
    for (const reg of mapa.values()) {
      reg.destino = reg.items.find(i => i.destino)?.destino || this.nombreInstitucion || '—';
      reg.hora = reg.items.find(i => i.hora)?.hora || '—';
      reg.responsable = reg.items.find(i => i.responsable)?.responsable || '—';
      reg.fechaRegistro = reg.items.find(i => i.fechaRegistro)?.fechaRegistro || '';
    }
    return Array.from(mapa.values());
  }

  // ===================== REGISTRAR ENTRADA =====================
  // Pide fecha, destino, responsable y productos (cantidad y perecedero o no).
  // El vencimiento y la frecuencia se calculan con la última entrada de cada producto.
  mostrarModalEntrada = false;
  entradaFecha = this.fechaHoy();
  entradaDestino = '';
  entradaResponsable = '';
  entradaFilas: EntradaFila[] = [];
  guardandoEntrada = false;
  errorEntrada = '';
  busquedaEntrada = '';
  readonly unidadesEntrada = ['Kg', 'Litros', 'Unidades'];

  abrirModalEntrada(): void {
    this.entradaFecha = this.fechaHoy();
    const sedeActual = this.nombreSede ? this.destinosDisponibles.find(d => d.endsWith(` - ${this.nombreSede}`)) : undefined;
    this.entradaDestino = sedeActual ?? this.destinosDisponibles[0] ?? '';
    this.entradaResponsable = this.busquedaEntrada = this.errorEntrada = '';
    this.entradaFilas = [];
    this.mostrarModalEntrada = true;
  }

  get productosRapidos(): Opcion[] {
    const q = this.busquedaEntrada.trim().toLowerCase();
    return this.ingredientes.filter(i => !q || i.nombre.toLowerCase().includes(q)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  estaEnEntrada(id: number): boolean { return this.entradaFilas.some(f => f.idIngrediente === id); }
  nombreIngrediente(id: number | null): string { return this.ingredientes.find(i => i.id === id)?.nombre ?? ''; }

  // Un toque agrega el producto; otro lo quita. Se sugiere su unidad y si es perecedero.
  alternarProductoEntrada(id: number): void {
    const i = this.entradaFilas.findIndex(f => f.idIngrediente === id);
    if (i >= 0) { this.entradaFilas.splice(i, 1); return; }
    const producto = this.catalogoMenu.find(p => p.id === id);
    this.entradaFilas.push({
      idIngrediente: id, cantidad: null,
      unidad: producto?.unidad ?? 'Kg', perecedero: producto ? this.esPerecedero(producto) : false,
    });
  }

  quitarFilaEntrada(i: number): void { this.entradaFilas.splice(i, 1); }

  ajustarCantidadEntrada(fila: EntradaFila, paso: number): void {
    const nueva = Math.max(0, Math.round(((fila.cantidad ?? 0) + paso) * 100) / 100);
    fila.cantidad = nueva > 0 ? nueva : null;
  }

  private idTipoMercadoDe(perecedero: boolean): number | null {
    return this.tiposMercado.find(t => {
      const n = t.nombre.toLowerCase();
      return (n.includes('perecedero') && !n.includes('no perecedero')) === perecedero;
    })?.id ?? null;
  }

  // Vencimiento y frecuencia: se repiten los de la última entrada; si no hay, valores por defecto
  private datosAutomaticos(fila: EntradaFila): { vencimiento: string; frecuencia: string } {
    const ultima = this.ultimaEntradaDe(fila.idIngrediente);
    const dias = ultima?.fechaRecepcion && ultima.fechaVencimiento ? this.diasEntre(ultima.fechaRecepcion, ultima.fechaVencimiento) : 0;
    const vigencia = dias > 0 ? dias : (fila.perecedero ? 7 : 90);
    const cada = (ultima ? this.diasDeFrecuencia(ultima.frecuencia) : null) ?? 8;
    return { vencimiento: this.sumarDiasISO(this.entradaFecha, vigencia), frecuencia: cada === 1 ? 'Cada día' : `Cada ${cada} días` };
  }

  // ---- Respaldo en este navegador (si el backend no guarda destino / responsable / hora / fecha de registro) ----
  private readonly claveExtras = 'sirae_entradas_extra';
  private extras: Record<string, ExtraEntrada> = this.leerExtras();

  private leerExtras(): Record<string, ExtraEntrada> {
    try { return JSON.parse(localStorage.getItem(this.claveExtras) || '{}'); } catch { return {}; }
  }

  private claveCompuesta(idIng: number | null, fecha: string, cantidad: number): string { return `${idIng}|${fecha}|${cantidad}`; }

  private guardarExtra(id: number | undefined, fila: EntradaFila, datos: ExtraEntrada): void {
    if (id != null) this.extras[`id:${id}`] = datos;
    this.extras[this.claveCompuesta(fila.idIngrediente, this.entradaFecha, fila.cantidad ?? 0)] = datos;
    this.guardarCache(this.claveExtras, this.extras);
  }

  private extraDe(id: number | undefined, idIng: number | null, fecha: string, cantidad: number): ExtraEntrada | undefined {
    return (id != null ? this.extras[`id:${id}`] : undefined) ?? this.extras[this.claveCompuesta(idIng, fecha, cantidad)];
  }

  guardarEntrada(): void {
    if (this.guardandoEntrada) return;
    const filas = this.entradaFilas;
    const error = (m: string) => { this.errorEntrada = m; };
    const sinCantidad = filas.filter(f => !f.cantidad || f.cantidad <= 0);

    if (!this.entradaFecha) return error('Selecciona la fecha de entrega.');
    if (!this.entradaDestino.trim()) return error('Elige el destino.');
    if (!this.entradaResponsable.trim()) return error('Escribe el nombre del responsable.');
    if (!filas.length) return error('Toca los productos que entran para agregarlos.');
    if (sinCantidad.length) return error(`Escribe la cantidad de: ${sinCantidad.map(f => this.nombreIngrediente(f.idIngrediente)).join(', ')}.`);
    if (filas.some(f => this.idTipoMercadoDe(f.perecedero) == null)) return error('No se encontró el tipo de mercado (Perecedero / No perecedero) en el catálogo del servidor.');

    this.errorEntrada = '';
    this.guardandoEntrada = true;
    let motivoFallo = '';

    const peticiones = filas.map(f => this.entregasService.registrar({
      id_ingrediente: f.idIngrediente!, id_tipo_mercado: this.idTipoMercadoDe(f.perecedero)!,
      frecuencia: this.datosAutomaticos(f).frecuencia, cantidad: f.cantidad!, unidad: f.unidad,
      fecha_entrega: this.entradaFecha, fecha_vencimiento: this.datosAutomaticos(f).vencimiento,
      ...this.datosInstitucion(this.entradaDestino),
      destino: this.entradaDestino.trim(), responsable: this.entradaResponsable.trim(), observaciones: '',
    } as any).pipe(
      map((resp: any) => ({ ok: true, fila: f, id: resp?.id as number | undefined })),
      catchError(err => {
        console.error('Error al registrar entrada', err);
        motivoFallo = this.describirError(err);
        return of({ ok: false, fila: f, id: undefined as number | undefined });
      }),
    ));

    forkJoin(peticiones).subscribe(resultados => {
      this.guardandoEntrada = false;
      const exitosas = resultados.filter(r => r.ok);
      const fallidas = resultados.filter(r => !r.ok).map(r => r.fila);

      const ahoraISO = new Date().toISOString();
      const hora = this.horaDe(ahoraISO), lote = String(Date.now());   // el lote identifica lo guardado junto
      const destino = this.entradaDestino.trim(), responsable = this.entradaResponsable.trim();
      exitosas.forEach(r => this.guardarExtra(r.id, r.fila, { destino, responsable, hora, fechaRegistro: this.fechaHoy(), loteRegistro: lote }));

      if (exitosas.length) {
        this.mostrarHistorialEnvios = true;
        // Aparece en el Historial al instante; al responder el servidor se reemplaza por los datos reales
        this.entregasRaw = [...exitosas.map((r, i) => ({
          id: r.id ?? Date.now() + i, id_ingrediente: r.fila.idIngrediente, id_tipo_mercado: this.idTipoMercadoDe(r.fila.perecedero),
          cantidad: r.fila.cantidad, unidad: r.fila.unidad, fecha_entrega: this.entradaFecha,
          fecha_vencimiento: this.datosAutomaticos(r.fila).vencimiento, frecuencia: this.datosAutomaticos(r.fila).frecuencia,
          destino, responsable, created_at: ahoraISO, lote_registro: lote,
        })), ...this.entregasRaw];
        this.reconstruirHistorial();

        const [anio, mes] = this.entradaFecha.split('-').map(Number);   // el calendario salta al día registrado
        this.mesCalendario = new Date(anio, mes - 1, 1);
        this.diaSeleccionado = this.entradaFecha;
        this.cargarHistorial();
      }

      if (!fallidas.length) {
        this.mostrarModalEntrada = false;
        void this.alertas.success('Entrada registrada', `Se registraron ${exitosas.length} producto(s) con destino a ${destino}.`);
      } else {
        this.entradaFilas = fallidas;   // quedan solo las fallidas para reintentar
        this.errorEntrada = `Se guardaron ${exitosas.length} y fallaron ${fallidas.length}. ` + (motivoFallo ? `Motivo: ${motivoFallo}.` : '');
      }
      this.cdr.markForCheck();
    });
  }

  // ===================== ESTADO Y ALERTAS =====================
  diasDe(e: FilaEntrega): number {
    if (!e.fechaVencimiento) return 99999;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((new Date(e.fechaVencimiento + 'T00:00:00').getTime() - hoy.getTime()) / 86400000);
  }

  // Perecederos avisan con 7 días; no perecederos con 30
  estadoDe(e: FilaEntrega): string {
    const dias = this.diasDe(e);
    return dias < 0 ? 'Vencido' : dias <= (e.categoria === 'Perecederos' ? 7 : 30) ? 'Próximo a vencer' : 'Vigente';
  }

  // ===================== EXPORTAR A EXCEL =====================
  exportarExcelHistorial(): void {
    const lista = this.historialFiltrado;
    if (!lista.length) { void this.alertas.warning('Sin registros', 'No hay registros para exportar.'); return; }

    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const th = 'style="background:#FF8A00;color:#FFFFFF;font-weight:bold;text-align:center"';
    const tabla = (titulo: string, cabeceras: string[], filas: string[][]) => `
      <table><tr><td colspan="8" style="font-size:14pt;font-weight:bold;border:none">${titulo}</td></tr></table>
      <table border="1"><thead><tr>${cabeceras.map(c => `<th ${th}>${c}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr>${f.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

    // Resumen: un renglón por producto y unidad (no mezcla unidades distintas)
    const resumen = new Map<string, { e: FilaEntrega; unidad: string; total: number; n: number; ultima: string; estado: string; vence: string }>();
    for (const e of lista) {
      const unidad = this.normalizarUnidad(e.unidad) || 'Sin unidad';
      const k = `${e.ingrediente.toLowerCase()}|${unidad}`;
      const r = resumen.get(k) ?? { e, unidad, total: 0, n: 0, ultima: '', estado: '', vence: '' };
      r.total += e.cantidad; r.n++;
      if (e.fechaRecepcion >= r.ultima) { r.ultima = e.fechaRecepcion; r.e = e; r.estado = this.estadoDe(e); }
      if (e.fechaVencimiento && this.diasDe(e) >= 0 && (!r.vence || e.fechaVencimiento < r.vence)) r.vence = e.fechaVencimiento;
      resumen.set(k, r);
    }
    const filasResumen = Array.from(resumen.values())
      .sort((a, b) => a.e.ingrediente.localeCompare(b.e.ingrediente, 'es') || a.unidad.localeCompare(b.unidad, 'es'))
      .map(r => [`<b>${esc(r.e.ingrediente)}</b>`, esc(r.e.tipoMercado), esc(r.unidad), `<b>${Math.round(r.total * 100) / 100}</b>`,
                 String(r.n), this.fechaCorta(r.ultima), r.vence ? this.fechaCorta(r.vence) : '—', esc(r.estado)]);

    const filasDetalle = lista.map(e => [this.fechaCorta(e.fechaRecepcion), esc(e.ingrediente), esc(e.tipoMercado), esc(e.frecuencia),
      esc(e.cantidad), esc(e.unidad), this.fechaCorta(e.fechaVencimiento), esc(this.estadoDe(e))]);

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head><body>
      ${tabla(`Resumen por producto (total recibido) - ${esc(this.nombreInstitucion)}`,
        ['Producto', 'Tipo de mercado', 'Unidad', 'Total recibido', 'N.º de entregas', 'Última entrega', 'Próximo vencimiento', 'Estado última entrega'], filasResumen)}
      <br><br>
      ${tabla('Detalle de entregas', ['Fecha', 'Ingrediente', 'Tipo de mercado', 'Frecuencia', 'Cantidad', 'Unidad', 'Vencimiento', 'Estado'], filasDetalle)}
      </body></html>`;

    const url = URL.createObjectURL(new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_entregas_${this.fechaHoy()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}