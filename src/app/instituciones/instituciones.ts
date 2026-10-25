import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';

type EstadoInventario = 'Ok' | 'Bajo' | 'Crítico';
type FiltroEstado = 'Todos' | EstadoInventario;
type Pestana = 'inventario' | 'entregas';

// Institución asignada al supervisor
interface Institucion {
  id: number | string;
  nombre: string;
  administrador: string;
  matriculados: number;
  asistenciaPromedio: number;   // %
  diasInventario: number;       // días que alcanza el saldo actual
  sedePrincipal: string;
  municipio: string;
  modalidad: string;
  ultimaActualizacion: string;  // texto o fecha
  estado: EstadoInventario;
}

// Tarjeta de ingrediente (datos de ejemplo hasta conectar el inventario de cada institución)
interface ProductoInventario {
  nombre: string;
  emoji: string;
  categoria: string;
  unidad: string;
  saldo: number;
  vence: string;                // YYYY-MM-DD
  nivel: number;                // 0 - 100
  estado: 'Ok' | 'Bajo' | 'Por vencer' | 'Agotado';
}

// Una entrega tal como llega del servidor (puede haber varias del mismo producto)
interface EntregaCruda {
  ingrediente: string;
  unidad: string;
  cantidad: number;
  fechaRegistro: string;        // fecha o fecha y hora
}

// Entrega ya unificada: cada producto una sola vez, con su cantidad total
interface EntregaUnida {
  clave: string;
  ingrediente: string;
  emoji: string;
  unidad: string;
  cantidad: number;
  fechaRegistro: string;        // la más reciente de ese producto
}

// Mismos emojis que usa la pantalla registrar-entrega-alimentos
const EMOJI_PRODUCTO: Record<string, string> = {
  'arroz': '🌾', 'frijol': '🫘', 'lentejas': '🫘', 'lenteja': '🫘', 'pasta': '🍝', 'harina de maiz': '🌽',
  'azucar': '🍬', 'sal': '🧂', 'aceite': '🫒', 'panela': '🍯',
  'carne de res': '🥩', 'carne molida': '🥩', 'pollo': '🍗', 'huevos': '🥚', 'pescado': '🐟',
  'leche': '🥛', 'queso': '🧀', 'yogur': '🥣', 'mantequilla': '🧈',
  'zanahoria': '🥕', 'tomate': '🍅', 'cebolla': '🧅', 'papa': '🥔',
  'platano': '🍌', 'naranja': '🍊', 'manzana': '🍎',
};

/* ============================================================
   IMÁGENES DE INGREDIENTES
   Los archivos están en la carpeta public/ de Angular, que se
   sirve desde la raíz del sitio ("/arroz.png", "/aceite.png"...).
   ============================================================ */
const RUTA_IMAGENES = '/';
const EXTENSION_IMAGEN = 'png';

// clave: nombre del producto sin tildes y en minúscula  ->  archivo real en public/
const ARCHIVOS_IMAGEN: Record<string, string> = {
  // Granos y cereales
  'arroz': 'arroz.png',
  'frijol': 'frijoles.png',
  'frijoles': 'frijoles.png',
  'lenteja': 'lentejas.png',
  'lentejas': 'lentejas.png',
  'granos': 'granos.png',
  'harina': 'harina.png',
  'harina de maiz': 'harina.png',
  'pasta': 'harina.png',

  // Despensa
  'aceite': 'aceite.png',
  'sal': 'sal.png',

  // Carnes y huevos
  'pollo': 'pollo.png',
  'carne': 'carne.png',
  'carne de res': 'carne.png',
  'carne molida': 'molida.png',
  'molida': 'molida.png',
  'tocino': 'tocino.png',
  'huevo': 'huevos.png',
  'huevos': 'huevos.png',

  // Lácteos
  'leche': 'leche.png',
  'leche deslactosada': 'deslatosada.png',
  'deslactosada': 'deslatosada.png',
  'queso': 'queso.png',
  'lacteos': 'lacteos.png',
  'yogur': 'lacteos.png',

  // Verduras y frutas
  'papa': 'papa.png',
  'zanahoria': 'verduras.png',
  'tomate': 'verduras.png',
  'cebolla': 'verduras.png',
  'verduras': 'verduras.png',
  'platano': 'platano.png',
  'naranja': 'frutas.png',
  'manzana': 'frutas.png',
  'frutas': 'frutas.png',

  // Otros
  'otros': 'otros.png',
  'plato': 'plato.png',
};

// Lee el primer campo con texto entre los nombres que pueda traer el backend
function leerTexto(item: any, ...claves: string[]): string {
  for (const k of claves) {
    const v = item?.[k];
    if (v == null) continue;
    if (typeof v === 'object') {
      const nombre = String(v.nombre ?? v.name ?? '');
      if (nombre.trim() !== '') return nombre;
      continue;
    }
    if (String(v).trim() !== '') return String(v);
  }
  return '';
}

// Lee el primer campo numérico válido
function leerNumero(item: any, ...claves: string[]): number {
  for (const k of claves) {
    if (item?.[k] == null || item[k] === '') continue;
    const v = Number(item[k]);
    if (!Number.isNaN(v)) return v;
  }
  return 0;
}

// Sin tildes y en minúscula, para comparar nombres de productos
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

@Component({
  selector: 'app-instituciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './instituciones.html',
})
export class InstitucionesComponent implements OnInit, OnDestroy {

  private http = inject(HttpClient);

  // Ruta de las instituciones asignadas al supervisor que inició sesión (el backend filtra por el usuario)
  private readonly urlInstituciones = `${environment.apiUrl}/instituciones/`;

  // Catálogo de ingredientes del servidor: solo se usa como respaldo para productos que no estén en ARCHIVOS_IMAGEN
  private readonly urlIngredientes = `${environment.apiUrl}/ingredientes`;
  // Raíz del servidor (apiUrl sin el "/api" final), p. ej. http://127.0.0.1:8000
  private readonly origenServidor = /^https?:/i.test(environment.apiUrl)
    ? environment.apiUrl.replace(/\/api\/?$/, '')
    : 'http://127.0.0.1:8000';
  private imagenesIngredientes = new Map<string, string>();   // nombre normalizado -> URL
  private imagenesFallidas = new Set<string>();

  instituciones: Institucion[] = [];
  cargando = false;
  avisoRespaldo = '';           // se llena cuando se muestran instituciones de ejemplo
  private usandoRespaldo = false;

  // Lista
  textoBusqueda = '';
  filtroEstado: FiltroEstado = 'Todos';
  opcionesEstado: FiltroEstado[] = ['Todos', 'Ok', 'Bajo', 'Crítico'];

  // Detalle (solo lectura): solo Inventario y Entregas
  seleccionada: Institucion | null = null;
  pestana: Pestana = 'inventario';
  pestanas: { id: Pestana; nombre: string; icono: string }[] = [
    { id: 'inventario', nombre: 'Inventario', icono: 'inventory_2' },
    { id: 'entregas',   nombre: 'Entregas',   icono: 'local_shipping' },
  ];

  // Datos del detalle: se calculan una sola vez al abrir una institución
  inventario: ProductoInventario[] = [];

  // Entregas (vienen del servidor; cada producto aparece una sola vez)
  entregasUnidas: EntregaUnida[] = [];
  cargandoEntregas = false;
  errorEntregas = '';
  private subEntregas?: Subscription;

  // Instituciones de ejemplo: solo se usan si el servidor no responde o no devuelve nada
  private readonly institucionesBase: Institucion[] = [
    this.crear(1, 'I.E. Técnica Agropecuaria', 'Claudia Martínez', 386, 91, 18, 'Vereda El Carmen', 'Santa Rosa de Cabal', 'Almuerzo preparado en sitio', 'Hoy, 8:42 a. m.'),
    this.crear(2, 'I.E. Santa Rosa', 'Julián Torres', 248, 88, 7, 'Barrio Centro', 'Santa Rosa de Cabal', 'Almuerzo preparado en sitio', 'Hoy, 8:42 a. m.'),
    this.crear(3, 'I.E. San José', 'Marcela Rojas', 172, 93, 22, 'Calle Principal', 'Dosquebradas', 'Almuerzo preparado en sitio', 'Hoy, 8:42 a. m.'),
    this.crear(4, 'I.E. La Esperanza', 'Andrés Gómez', 310, 85, 3, 'Vereda La Esperanza', 'Pereira', 'Almuerzo transportado', 'Hoy, 8:42 a. m.'),
    this.crear(5, 'I.E. El Rosal', 'Luz Dary Pineda', 126, 90, 12, 'Vereda El Rosal', 'Dosquebradas', 'Almuerzo preparado en sitio', 'Hoy, 8:42 a. m.'),
    this.crear(6, 'I.E. Nuestra Señora del Carmen', 'Hernán Castro', 355, 87, 9, 'Barrio El Carmen', 'Pereira', 'Almuerzo preparado en sitio', 'Hoy, 8:42 a. m.'),
  ];

  ngOnInit(): void {
    this.cargar();
    this.cargarImagenes();
  }

  ngOnDestroy(): void {
    this.subEntregas?.unsubscribe();
  }

  // =====================================================
  //  CARGA: las instituciones asignadas aparecen solas
  // =====================================================
  cargar(): void {
    this.cargando = true;
    this.avisoRespaldo = '';

    this.http.get<any>(this.urlInstituciones).pipe(
      map(d => (Array.isArray(d) ? d : (d?.results ?? [])) as any[])
    ).subscribe({
      next: (lista) => {
        this.instituciones = lista.map((item, i) => this.aInstitucion(item, i));
        this.usandoRespaldo = false;
        if (this.instituciones.length === 0) {
          this.instituciones = this.institucionesBase;
          this.usandoRespaldo = true;
          this.avisoRespaldo = 'El servidor no devolvió instituciones asignadas. Se muestran instituciones de ejemplo.';
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar instituciones:', error);
        this.instituciones = this.institucionesBase;
        this.usandoRespaldo = true;
        this.avisoRespaldo = `No se pudieron cargar tus instituciones: ${this.describirError(error)}. Se muestran instituciones de ejemplo.`;
        this.cargando = false;
      },
    });
  }

  private describirError(error: any): string {
    const estado = error?.status;
    if (estado === 0) return 'no hay conexión con el servidor';
    if (estado === 401) return 'la sesión expiró; inicia sesión de nuevo';
    if (estado === 403) return 'no tienes permiso (403)';
    if (estado === 404) return 'la ruta no existe en el servidor (404)';
    return estado ? `error ${estado} del servidor` : 'error desconocido';
  }

  // Acepta los distintos nombres de campo que pueda traer el backend
  private aInstitucion(item: any, indice: number): Institucion {
    return this.crear(
      item?.id ?? item?.id_institucion ?? indice + 1,
      leerTexto(item, 'nombre', 'nombre_institucion', 'institucion') || `Institución ${indice + 1}`,
      leerTexto(item, 'administrador', 'nombre_administrador', 'administrador_nombre'),
      leerNumero(item, 'matriculados', 'estudiantes', 'estudiantes_matriculados', 'ninos_matriculados', 'cupos'),
      leerNumero(item, 'asistencia_promedio', 'asistenciaPromedio', 'asistencia'),
      leerNumero(item, 'dias_inventario', 'diasInventario', 'cobertura_dias'),
      leerTexto(item, 'sede_principal', 'sedePrincipal', 'direccion'),
      leerTexto(item, 'municipio', 'ciudad'),
      leerTexto(item, 'modalidad', 'modalidad_pae'),
      leerTexto(item, 'ultima_actualizacion', 'updated_at', 'fecha_actualizacion'),
    );
  }

  private crear(
    id: number | string, nombre: string, administrador: string, matriculados: number,
    asistencia: number, dias: number, sede: string, municipio: string, modalidad: string,
    actualizacion = '',
  ): Institucion {
    return {
      id, nombre, administrador, matriculados,
      asistenciaPromedio: asistencia,
      diasInventario: dias,
      sedePrincipal: sede,
      municipio,
      modalidad,
      ultimaActualizacion: actualizacion,
      estado: this.estadoPorDias(dias),
    };
  }

  // 10 días o más: Ok · de 4 a 9: Bajo · menos de 4: Crítico
  estadoPorDias(dias: number): EstadoInventario {
    if (dias >= 10) return 'Ok';
    if (dias >= 4) return 'Bajo';
    return 'Crítico';
  }

  // =====================================================
  //  LISTA Y FILTROS
  // =====================================================
  get filtradas(): Institucion[] {
    const q = this.textoBusqueda.trim().toLowerCase();
    return this.instituciones.filter(i =>
      (this.filtroEstado === 'Todos' || i.estado === this.filtroEstado) &&
      (!q || i.nombre.toLowerCase().includes(q) || i.administrador.toLowerCase().includes(q))
    );
  }

  get hayFiltros(): boolean {
    return !!this.textoBusqueda.trim() || this.filtroEstado !== 'Todos';
  }

  limpiarFiltros(): void {
    this.textoBusqueda = '';
    this.filtroEstado = 'Todos';
  }

  trackInstitucion(_: number, i: Institucion): number | string {
    return i.id;
  }

  // =====================================================
  //  DETALLE (SOLO LECTURA)
  // =====================================================
  abrir(institucion: Institucion): void {
    this.seleccionada = institucion;
    this.pestana = 'inventario';

    // Se calcula una sola vez para que la pantalla no se redibuje en cada cambio
    this.inventario = this.inventarioDe(institucion);

    this.cargarEntregas(institucion);
  }

  volver(): void {
    this.subEntregas?.unsubscribe();   // evita que una respuesta tardía pise otra institución
    this.cargandoEntregas = false;
    this.seleccionada = null;
  }

  cambiarPestana(p: Pestana): void {
    this.pestana = p;
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'Ok':
      case 'Recibida':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'Bajo':
      case 'Despachada':
      case 'Por vencer':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'Crítico':
      case 'Con novedad':
      case 'Agotado':
        return 'border-red-200 bg-red-50 text-red-700';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-600';   // Programada
    }
  }

  claseBarra(estado: string): string {
    return estado === 'Ok' ? 'bg-emerald-500' : estado === 'Bajo' ? 'bg-amber-500' : 'bg-red-500';
  }

  // Color de la barra de cada producto según su estado
  barraProducto(p: ProductoInventario): string {
    if (p.estado === 'Ok') return this.claseBarra('Ok');
    if (p.estado === 'Bajo' || p.estado === 'Por vencer') return this.claseBarra('Bajo');
    return this.claseBarra('Crítico');
  }

  // =====================================================
  //  ENTREGAS (cada producto una sola vez, con cantidad total)
  // =====================================================
  cargarEntregas(inst: Institucion): void {
    this.subEntregas?.unsubscribe();
    this.errorEntregas = '';
    this.entregasUnidas = [];

    // Las instituciones de ejemplo no existen en el servidor: se usan entregas de ejemplo
    if (this.usandoRespaldo) {
      this.aplicarEntregas(this.entregasMuestra());
      this.cargandoEntregas = false;
      return;
    }

    this.cargandoEntregas = true;
    // Ajusta esta ruta si tu backend expone las entregas con otro nombre
    const url = `${this.urlInstituciones}${inst.id}/entregas/`;

    this.subEntregas = this.http.get<any>(url).pipe(
      map(d => (Array.isArray(d) ? d : (d?.results ?? [])) as any[])
    ).subscribe({
      next: (lista) => {
        this.aplicarEntregas(lista.map(item => this.aEntregaCruda(item)));
        this.cargandoEntregas = false;
      },
      error: (error) => {
        console.error('Error al cargar entregas:', error);
        this.errorEntregas = `No se pudieron cargar las entregas: ${this.describirError(error)}.`;
        this.cargandoEntregas = false;
      },
    });
  }

  private aplicarEntregas(crudas: EntregaCruda[]): void {
    this.entregasUnidas = this.unirEntregas(crudas);
  }

  private aEntregaCruda(item: any): EntregaCruda {
    return {
      ingrediente: leerTexto(item, 'ingrediente', 'producto', 'nombre_producto', 'nombre_ingrediente', 'nombre') || 'Producto',
      unidad: leerTexto(item, 'unidad', 'unidad_medida', 'unidad_de_medida'),
      cantidad: leerNumero(item, 'cantidad', 'cantidad_entregada', 'total'),
      fechaRegistro: leerTexto(item, 'fecha_registro', 'fechaRegistro', 'fecha', 'created_at'),
    };
  }

  // Une las entregas del mismo producto: suma cantidades y conserva la fecha más reciente
  private unirEntregas(crudas: EntregaCruda[]): EntregaUnida[] {
    const grupos = new Map<string, EntregaUnida>();

    for (const e of crudas) {
      const clave = `${normalizar(e.ingrediente)}|${normalizar(e.unidad)}`;
      const actual = grupos.get(clave);

      if (!actual) {
        grupos.set(clave, {
          clave,
          ingrediente: e.ingrediente,
          emoji: this.emojiDe(e.ingrediente),
          unidad: e.unidad,
          cantidad: e.cantidad,
          fechaRegistro: e.fechaRegistro,
        });
      } else {
        actual.cantidad += e.cantidad;
        if (this.marcaTiempo(e.fechaRegistro) > this.marcaTiempo(actual.fechaRegistro)) {
          actual.fechaRegistro = e.fechaRegistro;
        }
      }
    }

    return Array.from(grupos.values())
      .map(e => ({ ...e, cantidad: Math.round(e.cantidad * 100) / 100 }))
      .sort((a, b) => this.marcaTiempo(b.fechaRegistro) - this.marcaTiempo(a.fechaRegistro));
  }

  emojiDe(nombre: string): string {
    const n = normalizar(nombre);
    return EMOJI_PRODUCTO[n] ?? this.catalogoMuestra.find(p => normalizar(p.nombre) === n)?.emoji ?? '📦';
  }

  private marcaTiempo(valor: string): number {
    const t = Date.parse(valor);
    return Number.isNaN(t) ? 0 : t;
  }

  // Entregas de ejemplo (con productos repetidos a propósito para mostrar la unificación)
  private entregasMuestra(): EntregaCruda[] {
    const hoy = this.hoy();
    const f = (dias: number, hora: string) => `${this.sumarDias(hoy, dias)}T${hora}`;
    return [
      { ingrediente: 'Arroz',   unidad: 'Kg',       cantidad: 50,  fechaRegistro: f(-18, '08:30:00') },
      { ingrediente: 'Arroz',   unidad: 'Kg',       cantidad: 30,  fechaRegistro: f(-3, '09:10:00') },
      { ingrediente: 'Fríjol',  unidad: 'Kg',       cantidad: 20,  fechaRegistro: f(-18, '08:30:00') },
      { ingrediente: 'Pollo',   unidad: 'Kg',       cantidad: 25,  fechaRegistro: f(-3, '09:10:00') },
      { ingrediente: 'Huevos',  unidad: 'Unidades', cantidad: 300, fechaRegistro: f(-3, '09:10:00') },
      { ingrediente: 'Leche',   unidad: 'Litros',   cantidad: 120, fechaRegistro: f(-3, '09:10:00') },
      { ingrediente: 'Leche',   unidad: 'Litros',   cantidad: 80,  fechaRegistro: f(-1, '10:05:00') },
    ];
  }

  // =====================================================
  //  DATOS DE EJEMPLO DEL INVENTARIO
  //  Cuando existan los servicios por institución, se reemplazan aquí.
  // =====================================================
  private readonly catalogoMuestra = [
    { nombre: 'Arroz',    emoji: '🌾', categoria: 'Granos y cereales', unidad: 'Kg',       porNino: 0.08, perecedero: false },
    { nombre: 'Fríjol',   emoji: '🫘', categoria: 'Granos y cereales', unidad: 'Kg',       porNino: 0.04, perecedero: false },
    { nombre: 'Lenteja',  emoji: '🫘', categoria: 'Granos y cereales', unidad: 'Kg',       porNino: 0.03, perecedero: false },
    { nombre: 'Aceite',   emoji: '🫒', categoria: 'Despensa',          unidad: 'Litros',   porNino: 0.01, perecedero: false },
    { nombre: 'Pollo',    emoji: '🍗', categoria: 'Carnes y huevos',   unidad: 'Kg',       porNino: 0.07, perecedero: true },
    { nombre: 'Huevos',   emoji: '🥚', categoria: 'Carnes y huevos',   unidad: 'Unidades', porNino: 0.5,  perecedero: true },
    { nombre: 'Leche',    emoji: '🥛', categoria: 'Lácteos',           unidad: 'Litros',   porNino: 0.2,  perecedero: true },
    { nombre: 'Papa',     emoji: '🥔', categoria: 'Verduras',          unidad: 'Kg',       porNino: 0.1,  perecedero: true },
    { nombre: 'Plátano',  emoji: '🍌', categoria: 'Frutas',            unidad: 'Kg',       porNino: 0.08, perecedero: true },
  ];

  private inventarioDe(i: Institucion): ProductoInventario[] {
    const asistentes = i.matriculados * (i.asistenciaPromedio / 100);

    return this.catalogoMuestra.map((p, indice) => {
      // Los perecederos no duran más de una semana
      const cobertura = p.perecedero ? Math.min(i.diasInventario, 7) : i.diasInventario;
      const saldo = Math.round(asistentes * p.porNino * cobertura * 10) / 10;
      const diasVence = p.perecedero ? 3 + (indice % 5) : 90 + indice * 10;

      let estado: ProductoInventario['estado'] = 'Ok';
      if (saldo <= 0) estado = 'Agotado';
      else if (cobertura < 4) estado = 'Bajo';
      else if (p.perecedero && diasVence <= 4) estado = 'Por vencer';

      return {
        nombre: p.nombre,
        emoji: p.emoji,
        categoria: p.categoria,
        unidad: p.unidad,
        saldo,
        vence: this.sumarDias(this.hoy(), diasVence),
        nivel: Math.max(0, Math.min(100, Math.round((cobertura / (p.perecedero ? 7 : 30)) * 100))),
        estado,
      };
    });
  }

  // =====================================================
  //  IMÁGENES
  // =====================================================

  // Carga el catálogo del servidor (solo respaldo para productos que no estén en ARCHIVOS_IMAGEN)
  private cargarImagenes(): void {
    this.http.get<any>(this.urlIngredientes).pipe(
      map(d => (Array.isArray(d) ? d : (d?.results ?? [])) as any[])
    ).subscribe({
      next: (lista) => {
        const mapa = new Map<string, string>();
        for (const item of lista) {
          const nombre = leerTexto(item, 'nombre', 'nombre_ingrediente', 'ingrediente');
          const url = this.resolverImagen(leerTexto(item, 'imagen', 'imagen_url', 'foto', 'image', 'icono'));
          if (nombre && url) mapa.set(normalizar(nombre), url);
        }
        this.imagenesIngredientes = mapa;
      },
      // Sin catálogo no pasa nada grave: se usan las imágenes locales o los emojis
      error: (error) => console.error('Error al cargar imágenes de ingredientes:', error),
    });
  }

  // Acepta URL completa, ruta que empieza por "/" o solo el nombre del archivo
  private resolverImagen(valor: string): string {
    const v = valor.trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    if (v.startsWith('/')) return `${this.origenServidor}${v}`;
    return v.includes('/')
      ? `${this.origenServidor}/media/${v}`
      : `${this.origenServidor}/media/ingredientes/${v}`;
  }

  // Orden de búsqueda:
  //   1) archivo local de public/ (mapa ARCHIVOS_IMAGEN)
  //   2) imagen del catálogo del servidor
  //   3) public/<nombre_del_producto>.png
  urlImagen(nombre: string): string {
    const n = normalizar(nombre);

    const local = ARCHIVOS_IMAGEN[n];
    if (local) return `${RUTA_IMAGENES}${local}`;

    return this.imagenesIngredientes.get(n)
      ?? `${RUTA_IMAGENES}${n.replace(/\s+/g, '_')}.${EXTENSION_IMAGEN}`;
  }

  // Se muestra la imagen mientras no falle al cargar; si falla, queda el emoji
  mostrarImagen(nombre: string): boolean {
    return !this.imagenesFallidas.has(normalizar(nombre));
  }

  marcarFallo(nombre: string): void {
    this.imagenesFallidas.add(normalizar(nombre));
  }

  trackProducto(_: number, p: ProductoInventario): string {
    return p.nombre;
  }

  trackEntrega(_: number, e: EntregaUnida): string {
    return e.clave;
  }

  // =====================================================
  //  FECHAS
  // =====================================================
  hoy(): string {
    return this.aISO(new Date());
  }

  private aISO(d: Date): string {
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private sumarDias(iso: string, dias: number): string {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return this.aISO(d);
  }

  // dd/mm/aaaa; si no hay fecha válida muestra "—"
  fechaCorta(valor: string | null | undefined): string {
    const iso = String(valor ?? '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // dd/mm/aaaa hh:mm; si solo viene la fecha (sin hora) muestra únicamente la fecha
  fechaHora(valor: string | null | undefined): string {
    const v = String(valor ?? '').trim();
    if (!v) return '—';
    // Una fecha sin hora se interpretaría como UTC y podría mostrar el día anterior
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return this.fechaCorta(v);
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return this.fechaCorta(v);
    return d.toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}