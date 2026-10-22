import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService } from '../services/auth.service';

/* ============================================================
   AJUSTA ESTAS RUTAS A TU BACKEND
   ============================================================ */
export const API = environment.apiUrl;
export const URL_INGREDIENTES = `${API}/ingredientes/`;     // GET  -> catálogo completo de productos
export const URL_TIPOS_MERCADO = `${API}/tipos-mercado/`;   // GET  -> perecedero / no perecedero
export const URL_ENTREGAS = `${API}/entregas/`;             // GET historial · POST guardar entrega

/* ============================================================
   MODELOS
   ============================================================ */
export interface TipoMercado { id: number; nombre: string; }

export interface Producto {
  nombre: string;
  categoria: string;
  unidad: string;
  idTipoMercado: number | null;
  frecuenciaDias: number | null;
}

export interface Entrega {
  ingrediente: string;
  cantidad: number;
  unidad: string;
  tipoMercado: string;
  fechaRecepcion: string;
  fechaVencimiento: string;
  frecuencia: string;
}

export interface CategoriaMenu { nombre: string; emoji: string; total: number; }
export interface GrupoProductos { nombre: string; emoji: string; productos: Producto[]; }

/* ============================================================
   EMOJIS
   ============================================================ */
const EMOJI_CATEGORIA: Record<string, string> = {
  'Granos y cereales': '🌾',
  'Despensa': '🫙',
  'Carnes y huevos': '🥩',
  'Lácteos': '🥛',
  'Verduras': '🥕',
  'Frutas': '🍎',
  'Panadería': '🍞',
  'Otros': '🍽️'
};

const EMOJI_PRODUCTO: Record<string, string> = {
  'arroz': '🌾', 'frijol': '🫘', 'lentejas': '🫘', 'pasta': '🍝', 'harina de maíz': '🌽',
  'azúcar': '🍬', 'sal': '🧂', 'aceite': '🫒', 'panela': '🍯',
  'carne de res': '🥩', 'carne molida': '🥩', 'pollo': '🍗', 'huevos': '🥚', 'pescado': '🐟',
  'leche': '🥛', 'queso': '🧀', 'yogur': '🥣', 'mantequilla': '🧈',
  'zanahoria': '🥕', 'tomate': '🍅', 'cebolla': '🧅', 'papa': '🥔',
  'plátano': '🍌', 'naranja': '🍊', 'manzana': '🍎'
};

/* ============================================================
   CATÁLOGO DE RESPALDO (si el servidor falla con 500)
   ============================================================ */
const TIPOS_RESPALDO: TipoMercado[] = [
  { id: 1, nombre: 'Perecedero' },
  { id: 2, nombre: 'No perecedero' }
];

const p = (nombre: string, categoria: string, unidad: string, idTipoMercado: number): Producto =>
  ({ nombre, categoria, unidad, idTipoMercado, frecuenciaDias: idTipoMercado === 1 ? 7 : 15 });

const CATALOGO_RESPALDO: Producto[] = [
  p('Arroz', 'Granos y cereales', 'Kg', 2),
  p('Frijol', 'Granos y cereales', 'Kg', 2),
  p('Lentejas', 'Granos y cereales', 'Kg', 2),
  p('Pasta', 'Granos y cereales', 'Kg', 2),
  p('Harina de maíz', 'Granos y cereales', 'Kg', 2),
  p('Azúcar', 'Despensa', 'Kg', 2),
  p('Sal', 'Despensa', 'Kg', 2),
  p('Aceite', 'Despensa', 'L', 2),
  p('Panela', 'Despensa', 'Kg', 2),
  p('Carne de res', 'Carnes y huevos', 'Kg', 1),
  p('Carne molida', 'Carnes y huevos', 'Kg', 1),
  p('Pollo', 'Carnes y huevos', 'Kg', 1),
  p('Pescado', 'Carnes y huevos', 'Kg', 1),
  p('Huevos', 'Carnes y huevos', 'Und', 1),
  p('Leche', 'Lácteos', 'L', 1),
  p('Queso', 'Lácteos', 'Kg', 1),
  p('Zanahoria', 'Verduras', 'Kg', 1),
  p('Tomate', 'Verduras', 'Kg', 1),
  p('Cebolla', 'Verduras', 'Kg', 1),
  p('Papa', 'Verduras', 'Kg', 1)
];

@Component({
  selector: 'app-registrar-entrega-alimentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registrar-entrega-alimentos.html'
})
export class RegistrarEntregaAlimentosComponent implements OnInit {

  /* ---------- Vista y filtros ---------- */
  vista: 'menu' = 'menu';
  textoFiltro = '';
  paginaActual = 1;
  filtroMercado: 'Todos' | 'Perecederos' | 'Granos' = 'Todos';
  categoriaMenu = 'Todos';

  /* ---------- Catálogo ---------- */
  catalogo: Producto[] = [];
  tiposMercado: TipoMercado[] = [];
  cargandoCatalogos = false;
  errorCatalogos = '';

  /* ---------- Historial de entregas ---------- */
  historial: Entrega[] = [];
  cargandoHistorial = false;
  errorHistorial = false;
  ultimoRegistro: { fecha: string; totales: number; items: Entrega[] } | null = null;
  resumen = { total: 0, vigentes: 0, porVencer: 0, vencidos: 0 };

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): { headers: HttpHeaders } {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return { headers };
  }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarHistorial();
  }

  /* ============================================================
     CARGA DE DATOS
     ============================================================ */
  cargarCatalogos(): void {
    this.cargandoCatalogos = true;
    this.errorCatalogos = '';

    forkJoin({
      productos: this.http.get<any>(URL_INGREDIENTES, this.getHeaders()).pipe(catchError(() => of(null))),
      tipos: this.http.get<any>(URL_TIPOS_MERCADO, this.getHeaders()).pipe(catchError(() => of(null)))
    }).subscribe(({ productos, tipos }) => {
      this.cargandoCatalogos = false;

      const listaTipos = this.comoLista(tipos)
        .map((t: any): TipoMercado => ({ id: Number(t.id), nombre: String(t.nombre ?? t.name ?? '') }))
        .filter(t => t.nombre);

      const listaProductos = this.comoLista(productos)
        .map((x: any): Producto => ({
          nombre: String(x.nombre ?? x.name ?? '').trim(),
          categoria: String(x.categoria?.nombre ?? x.categoria ?? 'Otros'),
          unidad: String(x.unidad ?? 'Kg'),
          idTipoMercado: x.idTipoMercado ?? x.tipoMercado?.id ?? null,
          frecuenciaDias: x.frecuenciaDias ?? x.frecuencia ?? null
        }))
        .filter(x => x.nombre);

      if (listaTipos.length === 0 || listaProductos.length === 0) {
        this.errorCatalogos =
          'No se pudieron cargar los catálogos del servidor. Se muestran productos de ejemplo; para guardar debe funcionar la conexión.';
        this.tiposMercado = TIPOS_RESPALDO;
        this.catalogo = CATALOGO_RESPALDO;
      } else {
        this.tiposMercado = listaTipos;
        this.catalogo = listaProductos;
      }
    });
  }

  cargarHistorial(): void {
    this.cargandoHistorial = true;
    this.errorHistorial = false;

    this.http.get<any>(URL_ENTREGAS, this.getHeaders()).subscribe({
      next: r => {
        this.historial = this.comoLista(r).map((x: any): Entrega => ({
          ingrediente: String(x.ingrediente ?? x.nombre ?? ''),
          cantidad: Number(x.cantidad ?? 0),
          unidad: String(x.unidad ?? ''),
          tipoMercado: String(x.tipoMercado?.nombre ?? x.tipoMercado ?? ''),
          fechaRecepcion: String(x.fechaRecepcion ?? x.fecha ?? ''),
          fechaVencimiento: String(x.fechaVencimiento ?? ''),
          frecuencia: String(x.frecuencia ?? '')
        }));
        this.cargandoHistorial = false;
        this.actualizarDerivados();
      },
      error: () => {
        this.cargandoHistorial = false;
        this.errorHistorial = true;
      }
    });
  }

  private comoLista(r: any): any[] {
    if (Array.isArray(r)) return r;
    if (r && Array.isArray(r.data)) return r.data;
    return [];
  }

  /* ============================================================
     CATÁLOGO ORGANIZADO POR CATEGORÍAS DE ABASTECIMIENTO
     ============================================================ */
  get categoriasMenu(): CategoriaMenu[] {
    const conteo = new Map<string, number>();
    this.catalogo.forEach(x => conteo.set(x.categoria, (conteo.get(x.categoria) ?? 0) + 1));

    const categorias = [...conteo.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([nombre, total]) => ({ nombre, emoji: this.emojiCategoria(nombre), total }));

    return [{ nombre: 'Todos', emoji: '🍽️', total: this.catalogo.length }, ...categorias];
  }

  /** Lista plana de productos con los filtros de la pantalla principal */
  get productosMenu(): Producto[] {
    const texto = this.normalizar(this.textoFiltro);
    return this.catalogo.filter(prod => {
      const okCategoria = this.categoriaMenu === 'Todos' || prod.categoria === this.categoriaMenu;
      const okTexto = !texto || this.normalizar(prod.nombre).includes(texto);
      const okMercado =
        this.filtroMercado === 'Todos' ||
        (this.filtroMercado === 'Perecederos' ? this.esPerecedero(prod) : !this.esPerecedero(prod));
      return okCategoria && okTexto && okMercado;
    });
  }

  /** Productos agrupados por categoría, para pintar un bloque por categoría */
  get gruposMenu(): GrupoProductos[] {
    const mapa = new Map<string, Producto[]>();
    this.productosMenu.forEach(prod => {
      if (!mapa.has(prod.categoria)) mapa.set(prod.categoria, []);
      mapa.get(prod.categoria)!.push(prod);
    });
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([nombre, productos]) => ({ nombre, emoji: this.emojiCategoria(nombre), productos }));
  }

  /* ============================================================
     ACCIONES
     ============================================================ */
  setMercado(valor: 'Todos' | 'Perecederos' | 'Granos'): void {
    this.filtroMercado = valor;
    this.paginaActual = 1;
  }

  exportarExcelHistorial(): void {
    const encabezado = ['Producto', 'Categoría', 'Tipo de mercado', 'Cantidad', 'Unidad', 'Fecha de entrega', 'Vencimiento'];
    const filas = this.historial.map(h => [
      h.ingrediente, this.categoriaDe(h.ingrediente), h.tipoMercado,
      h.cantidad, h.unidad, this.fechaCorta(h.fechaRecepcion), this.fechaCorta(h.fechaVencimiento)
    ]);
    const csv = [encabezado, ...filas]
      .map(fila => fila.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `entregas-sirae-${this.hoyISO()}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  /* ============================================================
     AUXILIARES DE LA PLANTILLA
     ============================================================ */
  esPerecedero(prod: Producto): boolean {
    const tipo = this.tiposMercado.find(t => t.id === prod.idTipoMercado);
    return !!tipo && !tipo.nombre.toLowerCase().startsWith('no');
  }

  nombreTipo(prod: Producto): string {
    return this.tiposMercado.find(t => t.id === prod.idTipoMercado)?.nombre ?? 'Sin definir';
  }

  categoriaDe(nombre: string): string {
    return this.catalogo.find(x => x.nombre === nombre)?.categoria ?? 'Otros';
  }

  emojiCategoria(categoria: string): string {
    return EMOJI_CATEGORIA[categoria] ?? '🍽️';
  }

  emojiDe(nombre: string): string {
    const clave = (nombre ?? '').toLowerCase().trim();
    return EMOJI_PRODUCTO[clave] ?? this.emojiCategoria(this.categoriaDe(nombre));
  }

  fechaCorta(valor?: string | null): string {
    if (!valor) return '—';
    const [a, m, d] = valor.substring(0, 10).split('-');
    return a && m && d ? `${d}/${m}/${a}` : '—';
  }

  trackProducto = (_: number, prod: Producto) => prod.nombre;
  trackFila = (_: number, item: Entrega) => item.ingrediente + item.fechaRecepcion;
  trackGrupo = (_: number, g: { nombre: string }) => g.nombre;

  /* ============================================================
     CÁLCULOS INTERNOS
     ============================================================ */
  private actualizarDerivados(): void {
    // Última entrega: todos los ítems de la fecha de recepción más reciente
    const fechas = this.historial.map(h => h.fechaRecepcion.substring(0, 10)).filter(Boolean).sort();
    const ultima = fechas[fechas.length - 1];
    if (ultima) {
      const items = this.historial.filter(h => h.fechaRecepcion.substring(0, 10) === ultima);
      this.ultimoRegistro = { fecha: ultima, totales: items.reduce((s, i) => s + i.cantidad, 0), items };
    } else {
      this.ultimoRegistro = null;
    }

    // Resumen de tarjetas superiores
    let vigentes = 0, porVencer = 0, vencidos = 0;
    this.historial.forEach(h => {
      const dias = this.diasHastaVencer(h.fechaVencimiento);
      if (dias === null) vigentes++;
      else if (dias < 0) vencidos++;
      else if (dias <= 7) porVencer++;
      else vigentes++;
    });
    this.resumen = { total: this.historial.length, vigentes, porVencer, vencidos };
  }

  private diasHastaVencer(fecha: string): number | null {
    if (!fecha) return null;
    const [a, m, d] = fecha.substring(0, 10).split('-').map(Number);
    if (!a || !m || !d) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((new Date(a, m - 1, d).getTime() - hoy.getTime()) / 86400000);
  }

  private hoyISO(): string {
    const f = new Date();
    const mm = String(f.getMonth() + 1).padStart(2, '0');
    const dd = String(f.getDate()).padStart(2, '0');
    return `${f.getFullYear()}-${mm}-${dd}`;
  }

  private normalizar(texto: string): string {
    return (texto ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
}