import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';

type EstadoInventario = 'Ok' | 'Bajo' | 'Crítico';
type FiltroEstado = 'Todos' | EstadoInventario;
type Pestana = 'resumen' | 'inventario' | 'consumo' | 'menus' | 'entregas' | 'reportes';

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

// Consumo de un día (datos de ejemplo)
interface ConsumoDia {
  fecha: string;                // YYYY-MM-DD
  dia: string;
  raciones: number;
  kg: number;
  porcentaje: number;           // 0 - 100, relativo al día de mayor consumo
}

// Menú publicado (datos de ejemplo)
interface MenuDia {
  fecha: string;
  dia: string;
  jornada: string;
  ninos: number;
  platos: string[];
}

// Reporte disponible (datos de ejemplo)
interface ReporteItem {
  nombre: string;
  detalle: string;
  fecha: string;
  icono: string;
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
   IMÁGENES DE INGREDIENTES  (AJUSTA ESTO)
   Carpeta donde están los archivos. Dos opciones:
   - Servidor Django:  'http://127.0.0.1:8000/media/ingredientes/'
   - Copiadas dentro de Angular (carpeta public/ingredientes):  '/ingredientes/'
   ============================================================ */
const RUTA_IMAGENES = 'http://127.0.0.1:8000/media/ingredientes/';
const EXTENSION_IMAGEN = 'png';

// Solo para los productos cuyo archivo NO se llama igual que el producto
// (clave: nombre sin tildes y en minúscula; valor: nombre real del archivo)
const ARCHIVOS_IMAGEN: Record<string, string> = {
  // 'carne de res': 'carne_res.png',
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

  // Catálogo de ingredientes: de aquí salen las imágenes (la misma fuente de la pantalla de ingredientes)
  private readonly urlIngredientes = `${environment.apiUrl}/ingredientes`;
  // Raíz del servidor (apiUrl sin el "/api" final), p. ej. http://127.0.0.1:8000
  // Si apiUrl es relativa (p. ej. '/api'), las imágenes se piden al servidor de Django: ajusta este valor
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

  // Detalle (solo lectura)
  seleccionada: Institucion | null = null;
  pestana: Pestana = 'resumen';
  pestanas: { id: Pestana; nombre: string; icono: string }[] = [
    { id: 'resumen',    nombre: 'Resumen',        icono: 'dashboard' },
    { id: 'inventario', nombre: 'Inventario',     icono: 'inventory_2' },
    { id: 'consumo',    nombre: 'Consumo diario', icono: 'monitoring' },
    { id: 'menus',      nombre: 'Menús',          icono: 'restaurant_menu' },
    { id: 'entregas',   nombre: 'Entregas',       icono: 'local_shipping' },
    { id: 'reportes',   nombre: 'Reportes',       icono: 'description' },
  ];

  // Datos del detalle: se calculan una sola vez al abrir una institución
  inventario: ProductoInventario[] = [];
  consumo: ConsumoDia[] = [];
  menus: MenuDia[] = [];
  reportes: ReporteItem[] = [];

  // Entregas (vienen del servidor; cada producto aparece una sola vez)
  entregasUnidas: EntregaUnida[] = [];
  ultimasEntregas: EntregaUnida[] = [];      // las 4 más recientes, para el resumen
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
    this.pestana = 'resumen';

    // Se calculan una sola vez para que la pantalla no se redibuje en cada cambio
    this.inventario = this.inventarioDe(institucion);
    this.consumo = this.consumoDe(institucion);
    this.menus = this.menusDe(institucion);
    this.reportes = this.reportesDe();

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

  // Porcentaje de la barra de cobertura (30 días = barra llena)
  porcentajeCobertura(i: Institucion): number {
    return Math.max(0, Math.min(100, Math.round((i.diasInventario / 30) * 100)));
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
    this.ultimasEntregas = [];

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
    this.ultimasEntregas = this.entregasUnidas.slice(0, 4);
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
  //  DATOS DE EJEMPLO DEL DETALLE
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

  private readonly menusMuestra: string[][] = [
    ['Arroz con pollo', 'Ensalada de zanahoria', 'Jugo de naranja'],
    ['Fríjoles con arroz', 'Carne molida', 'Plátano maduro'],
    ['Pasta con pollo', 'Ensalada fresca', 'Agua de panela'],
    ['Lentejas con arroz', 'Huevo revuelto', 'Jugo de mora'],
    ['Sancocho de papa', 'Arroz blanco', 'Fruta de temporada'],
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

  // Últimos 5 días hábiles: raciones según matriculados y asistencia
  private consumoDe(i: Institucion): ConsumoDia[] {
    const base = i.matriculados * (i.asistenciaPromedio / 100);
    const variacion = [0.98, 1.02, 0.95, 1.04, 1.0];

    const dias = this.diasHabiles(5, true).map((fecha, n) => {
      const raciones = Math.round(base * variacion[n]);
      return {
        fecha,
        dia: this.nombreDia(fecha),
        raciones,
        kg: Math.round(raciones * 0.29 * 10) / 10,
        porcentaje: 0,
      };
    });

    const maximo = Math.max(1, ...dias.map(d => d.raciones));
    return dias.map(d => ({ ...d, porcentaje: Math.round((d.raciones / maximo) * 100) }));
  }

  // Menús de los próximos 3 días hábiles
  private menusDe(i: Institucion): MenuDia[] {
    const ninos = Math.round(i.matriculados * (i.asistenciaPromedio / 100));
    return this.diasHabiles(3, false).map((fecha, n) => ({
      fecha,
      dia: this.nombreDia(fecha),
      jornada: 'Almuerzo',
      ninos,
      platos: this.menusMuestra[n % this.menusMuestra.length],
    }));
  }

  private reportesDe(): ReporteItem[] {
    const hoy = this.hoy();
    return [
      { nombre: 'Inventario mensual', detalle: 'Existencias y vencimientos del mes',   fecha: hoy,                     icono: 'inventory_2' },
      { nombre: 'Consumo semanal',    detalle: 'Raciones servidas y kilos consumidos', fecha: this.sumarDias(hoy, -4), icono: 'monitoring' },
      { nombre: 'Entregas del mes',   detalle: 'Productos recibidos por proveedor',    fecha: this.sumarDias(hoy, -1), icono: 'local_shipping' },
      { nombre: 'Asistencia diaria',  detalle: 'Niños atendidos por jornada',          fecha: hoy,                     icono: 'fact_check' },
    ];
  }

  descargar(r: ReporteItem): void {
    alert(`Ejemplo: aquí se abriría el reporte "${r.nombre}".`);
  }

  // Carga el catálogo de ingredientes y guarda la imagen de cada uno
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
      // Sin catálogo no pasa nada grave: se muestran los emojis
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

  // URL de la imagen: la del catálogo si la trae; si no, <RUTA_IMAGENES>/<nombre>.png
  urlImagen(nombre: string): string {
    const n = normalizar(nombre);
    const archivo = ARCHIVOS_IMAGEN[n] ?? `${n.replace(/\s+/g, '_')}.${EXTENSION_IMAGEN}`;
    return this.imagenesIngredientes.get(n) ?? `${RUTA_IMAGENES}${archivo}`;
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

  // n días hábiles (lunes a viernes): hacia atrás desde hoy, o hacia adelante desde mañana
  private diasHabiles(n: number, haciaAtras: boolean): string[] {
    const resultado: string[] = [];
    const d = new Date(this.hoy() + 'T00:00:00');
    if (!haciaAtras) d.setDate(d.getDate() + 1);

    while (resultado.length < n) {
      const dia = d.getDay();
      if (dia !== 0 && dia !== 6) resultado.push(this.aISO(d));
      d.setDate(d.getDate() + (haciaAtras ? -1 : 1));
    }
    return haciaAtras ? resultado.reverse() : resultado;
  }

  private nombreDia(iso: string): string {
    const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return nombres[new Date(iso + 'T00:00:00').getDay()];
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

  // La última actualización puede venir como fecha o como texto ("Hoy, 8:42 a. m.")
  textoActualizacion(i: Institucion): string {
    const v = i.ultimaActualizacion;
    if (!v) return '—';
    return /^\d{4}-\d{2}-\d{2}/.test(v) ? this.fechaCorta(v) : v;
  }
}