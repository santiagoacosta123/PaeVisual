import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { PlanillasPaeService } from '../../services/planillas-pae.service';

type EstadoInventario = 'Ok' | 'Bajo' | 'CrÃ­tico';
type FiltroEstado = 'Todos' | EstadoInventario;
type Pestana = 'resumen' | 'inventario' | 'consumo' | 'menus' | 'entregas' | 'reportes';

// InstituciÃ³n asignada al supervisor
interface Institucion {
  id: number | string;
  nombre: string;
  administrador: string;
  matriculados: number;
  asistenciaPromedio: number;   // %
  diasInventario: number;       // dÃ­as que alcanza el saldo actual
  sedePrincipal: string;
  municipio: string;
  modalidad: string;
  ultimaActualizacion: string;  // texto o fecha
  estado: EstadoInventario;
}

// Tarjeta de ingrediente (datos de ejemplo hasta conectar el inventario de cada instituciÃ³n)
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
  fechaRegistro: string;        // la mÃ¡s reciente de ese producto
}

// Consumo de un dÃ­a (datos de ejemplo)
interface ConsumoDia {
  fecha: string;                // YYYY-MM-DD
  dia: string;
  raciones: number;
  kg: number;
  porcentaje: number;           // 0 - 100, relativo al dÃ­a de mayor consumo
}

// MenÃº publicado (datos de ejemplo)
interface MenuDia {
  fecha: string;
  dia: string;
  jornada: string;
  ninos: number;
  platos: string[];
}

interface ReporteItem {
  tipoReporte: string;
  nombre: string;
  detalle: string;
  fecha: string;
  icono: string;
}

// Mismos emojis que usa la pantalla registrar-entrega-alimentos
const EMOJI_PRODUCTO: Record<string, string> = {
  'arroz': 'ðŸŒ¾', 'frijol': 'ðŸ«˜', 'lentejas': 'ðŸ«˜', 'lenteja': 'ðŸ«˜', 'pasta': 'ðŸ', 'harina de maiz': 'ðŸŒ½',
  'azucar': 'ðŸ¬', 'sal': 'ðŸ§‚', 'aceite': 'ðŸ«’', 'panela': 'ðŸ¯',
  'carne de res': 'ðŸ¥©', 'carne molida': 'ðŸ¥©', 'pollo': 'ðŸ—', 'huevos': 'ðŸ¥š', 'pescado': 'ðŸŸ',
  'leche': 'ðŸ¥›', 'queso': 'ðŸ§€', 'yogur': 'ðŸ¥£', 'mantequilla': 'ðŸ§ˆ',
  'zanahoria': 'ðŸ¥•', 'tomate': 'ðŸ…', 'cebolla': 'ðŸ§…', 'papa': 'ðŸ¥”',
  'platano': 'ðŸŒ', 'naranja': 'ðŸŠ', 'manzana': 'ðŸŽ',
};

/* ============================================================
   IMÃGENES DE INGREDIENTES
   Los archivos estÃ¡n en la carpeta public/ de Angular, que se
   sirve desde la raÃ­z del sitio ("/arroz.png", "/aceite.png"...).
   ============================================================ */
const RUTA_IMAGENES = '/';
const EXTENSION_IMAGEN = 'png';

// clave: nombre del producto sin tildes y en minÃºscula  ->  archivo real en public/
const ARCHIVOS_IMAGEN: Record<string, string> = {
  // Granos y cereales
  'arroz': 'arroz.png',
  'frijol': 'frijoles.png',
  'frijoles': 'frijoles.png',
  'lenteja': 'granos.png',          // no hay lentejas.png: se usa la de granos
  'lentejas': 'granos.png',
  'granos': 'granos.png',
  'harina': 'harina.png',
  'harina de maiz': 'harina.png',
  'pasta': 'harina.png',

  // Despensa
  'aceite': 'aceite.png',
  'sal': 'sal.png',

  // Carnes y huevos
  'pollo': 'carne.png',             // no hay pollo.png: se usa la de carne
  'carne': 'carne.png',
  'carne de res': 'carne.png',
  'carne molida': 'molida.png',
  'molida': 'molida.png',
  'tocino': 'tocino.png',
  'huevo': 'huevos.png',
  'huevos': 'huevos.png',

  // LÃ¡cteos
  'leche': 'leche.png',
  'leche deslactosada': 'deslatosada.png',
  'deslactosada': 'deslatosada.png',
  'queso': 'queso.png',
  'lacteos': 'lacteos.png',
  'yogur': 'lacteos.png',

  // Verduras y frutas
  'papa': 'verduras.png',
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

// Lee el primer campo numÃ©rico vÃ¡lido
function leerNumero(item: any, ...claves: string[]): number {
  for (const k of claves) {
    if (item?.[k] == null || item[k] === '') continue;
    const v = Number(item[k]);
    if (!Number.isNaN(v)) return v;
  }
  return 0;
}

// Sin tildes y en minÃºscula, para comparar nombres de productos
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
  private router = inject(Router, { optional: true });
  private planillasPae = inject(PlanillasPaeService, { optional: true });

  // Ruta de las instituciones asignadas al supervisor que iniciÃ³ sesiÃ³n (el backend filtra por el usuario)
  private readonly urlInstituciones = `${environment.apiUrl}/instituciones/`;

  // CatÃ¡logo de ingredientes del servidor: solo se usa como respaldo para productos que no estÃ©n en ARCHIVOS_IMAGEN
  private readonly urlIngredientes = `${environment.apiUrl}/ingredientes/`;
  // RaÃ­z del servidor (apiUrl sin el "/api" final), p. ej. https://backend-sirae-pyim.onrender.com
  private readonly origenServidor = /^https?:/i.test(environment.apiUrl)
    ? environment.apiUrl.replace(/\/api\/?$/, '')
    : 'https://backend-sirae-pyim.onrender.com';
  private imagenesIngredientes = new Map<string, string>();   // nombre normalizado -> URL
  private imagenesFallidas = new Set<string>();

  instituciones: Institucion[] = [];
  cargando = false;
  avisoRespaldo = '';           // se llena cuando se muestran instituciones de ejemplo
  private usandoRespaldo = false;

  // Lista
  textoBusqueda = '';
  filtroEstado: FiltroEstado = 'Todos';
  opcionesEstado: FiltroEstado[] = ['Todos', 'Ok', 'Bajo', 'CrÃ­tico'];

  // Detalle (solo lectura)
  seleccionada: Institucion | null = null;
  pestana: Pestana = 'resumen';
  pestanas: { id: Pestana; nombre: string; icono: string }[] = [
    { id: 'resumen',    nombre: 'Resumen',        icono: 'dashboard' },
    { id: 'inventario', nombre: 'Inventario',     icono: 'inventory_2' },
    { id: 'consumo',    nombre: 'Consumo diario', icono: 'monitoring' },
    { id: 'menus',      nombre: 'MenÃºs',          icono: 'restaurant_menu' },
    { id: 'entregas',   nombre: 'Entregas',       icono: 'local_shipping' },
    { id: 'reportes',   nombre: 'Reportes',       icono: 'description' },
  ];

  // Datos del detalle: se calculan una sola vez al abrir una instituciÃ³n
  inventario: ProductoInventario[] = [];
  consumo: ConsumoDia[] = [];
  menus: MenuDia[] = [];
  reportes: ReporteItem[] = [];

  // Entregas (vienen del servidor; cada producto aparece una sola vez)
  entregasUnidas: EntregaUnida[] = [];
  ultimasEntregas: EntregaUnida[] = [];      // las 4 mÃ¡s recientes, para el resumen
  cargandoEntregas = false;
  errorEntregas = '';
  private subEntregas?: Subscription;

  // Instituciones de ejemplo: solo se usan si el servidor no responde o no devuelve nada
  private readonly institucionesBase: Institucion[] = [
    this.crear(1, 'I.E. TÃ©cnica Agropecuaria', 'Claudia MartÃ­nez', 386, 91, 18, 'Vereda El Carmen', 'Santa Rosa de Cabal', 'Almuerzo preparado en sitio', 'Hoy, 8:42 a. m.'),
    this.crear(2, 'I.E. Santa Rosa', 'JuliÃ¡n Torres', 248, 88, 7, 'Barrio Centro', 'Santa Rosa de Cabal', 'Almuerzo preparado en sitio', 'Hoy, 8:42 a. m.'),
    this.crear(3, 'I.E. San JosÃ©', 'Marcela Rojas', 172, 93, 22, 'Calle Principal', 'Dosquebradas', 'Almuerzo preparado en sitio', 'Hoy, 8:42 a. m.'),
    this.crear(4, 'I.E. La Esperanza', 'AndrÃ©s GÃ³mez', 310, 85, 3, 'Vereda La Esperanza', 'Pereira', 'Almuerzo transportado', 'Hoy, 8:42 a. m.'),
    this.crear(5, 'I.E. El Rosal', 'Luz Dary Pineda', 126, 90, 12, 'Vereda El Rosal', 'Dosquebradas', 'Almuerzo preparado en sitio', 'Hoy, 8:42 a. m.'),
    this.crear(6, 'I.E. Nuestra SeÃ±ora del Carmen', 'HernÃ¡n Castro', 355, 87, 9, 'Barrio El Carmen', 'Pereira', 'Almuerzo preparado en sitio', 'Hoy, 8:42 a. m.'),
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
          this.avisoRespaldo = 'El servidor no devolviÃ³ instituciones asignadas. Se muestran instituciones de ejemplo.';
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
    if (estado === 0) return 'no hay conexiÃ³n con el servidor';
    if (estado === 401) return 'la sesiÃ³n expirÃ³; inicia sesiÃ³n de nuevo';
    if (estado === 403) return 'no tienes permiso (403)';
    if (estado === 404) return 'la ruta no existe en el servidor (404)';
    return estado ? `error ${estado} del servidor` : 'error desconocido';
  }

  // Acepta los distintos nombres de campo que pueda traer el backend
  private aInstitucion(item: any, indice: number): Institucion {
    return this.crear(
      item?.id ?? item?.id_institucion ?? indice + 1,
      leerTexto(item, 'nombre', 'nombre_institucion', 'institucion') || `InstituciÃ³n ${indice + 1}`,
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

  // 10 dÃ­as o mÃ¡s: Ok Â· de 4 a 9: Bajo Â· menos de 4: CrÃ­tico
  estadoPorDias(dias: number): EstadoInventario {
    if (dias >= 10) return 'Ok';
    if (dias >= 4) return 'Bajo';
    return 'CrÃ­tico';
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
    this.reportes = [];

    this.cargarEntregas(institucion);
  }

  volver(): void {
    this.subEntregas?.unsubscribe();   // evita que una respuesta tardÃ­a pise otra instituciÃ³n
    this.cargandoEntregas = false;
    this.seleccionada = null;
  }

  cambiarPestana(p: Pestana): void {
    this.pestana = p;
    if (p === 'reportes' && this.seleccionada) {
      this.cargarReportesReales(this.seleccionada);
    }
  }

  // Porcentaje de la barra de cobertura (30 dÃ­as = barra llena)
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
      case 'CrÃ­tico':
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

  // Color de la barra de cada producto segÃºn su estado
  barraProducto(p: ProductoInventario): string {
    if (p.estado === 'Ok') return this.claseBarra('Ok');
    if (p.estado === 'Bajo' || p.estado === 'Por vencer') return this.claseBarra('Bajo');
    return this.claseBarra('CrÃ­tico');
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

  // Une las entregas del mismo producto: suma cantidades y conserva la fecha mÃ¡s reciente
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
    return EMOJI_PRODUCTO[n] ?? this.catalogoMuestra.find(p => normalizar(p.nombre) === n)?.emoji ?? 'ðŸ“¦';
  }

  private marcaTiempo(valor: string): number {
    const t = Date.parse(valor);
    return Number.isNaN(t) ? 0 : t;
  }

  // Entregas de ejemplo (con productos repetidos a propÃ³sito para mostrar la unificaciÃ³n)
  private entregasMuestra(): EntregaCruda[] {
    const hoy = this.hoy();
    const f = (dias: number, hora: string) => `${this.sumarDias(hoy, dias)}T${hora}`;
    return [
      { ingrediente: 'Arroz',   unidad: 'Kg',       cantidad: 50,  fechaRegistro: f(-18, '08:30:00') },
      { ingrediente: 'Arroz',   unidad: 'Kg',       cantidad: 30,  fechaRegistro: f(-3, '09:10:00') },
      { ingrediente: 'FrÃ­jol',  unidad: 'Kg',       cantidad: 20,  fechaRegistro: f(-18, '08:30:00') },
      { ingrediente: 'Pollo',   unidad: 'Kg',       cantidad: 25,  fechaRegistro: f(-3, '09:10:00') },
      { ingrediente: 'Huevos',  unidad: 'Unidades', cantidad: 300, fechaRegistro: f(-3, '09:10:00') },
      { ingrediente: 'Leche',   unidad: 'Litros',   cantidad: 120, fechaRegistro: f(-3, '09:10:00') },
      { ingrediente: 'Leche',   unidad: 'Litros',   cantidad: 80,  fechaRegistro: f(-1, '10:05:00') },
    ];
  }

  // =====================================================
  //  DATOS DE EJEMPLO DEL DETALLE
  //  Cuando existan los servicios por instituciÃ³n, se reemplazan aquÃ­.
  // =====================================================
  private readonly catalogoMuestra = [
    { nombre: 'Arroz',    emoji: 'ðŸŒ¾', categoria: 'Granos y cereales', unidad: 'Kg',       porNino: 0.08, perecedero: false },
    { nombre: 'FrÃ­jol',   emoji: 'ðŸ«˜', categoria: 'Granos y cereales', unidad: 'Kg',       porNino: 0.04, perecedero: false },
    { nombre: 'Lenteja',  emoji: 'ðŸ«˜', categoria: 'Granos y cereales', unidad: 'Kg',       porNino: 0.03, perecedero: false },
    { nombre: 'Aceite',   emoji: 'ðŸ«’', categoria: 'Despensa',          unidad: 'Litros',   porNino: 0.01, perecedero: false },
    { nombre: 'Pollo',    emoji: 'ðŸ—', categoria: 'Carnes y huevos',   unidad: 'Kg',       porNino: 0.07, perecedero: true },
    { nombre: 'Huevos',   emoji: 'ðŸ¥š', categoria: 'Carnes y huevos',   unidad: 'Unidades', porNino: 0.5,  perecedero: true },
    { nombre: 'Leche',    emoji: 'ðŸ¥›', categoria: 'LÃ¡cteos',           unidad: 'Litros',   porNino: 0.2,  perecedero: true },
    { nombre: 'Papa',     emoji: 'ðŸ¥”', categoria: 'Verduras',          unidad: 'Kg',       porNino: 0.1,  perecedero: true },
    { nombre: 'PlÃ¡tano',  emoji: 'ðŸŒ', categoria: 'Frutas',            unidad: 'Kg',       porNino: 0.08, perecedero: true },
  ];

  private readonly menusMuestra: string[][] = [
    ['Arroz con pollo', 'Ensalada de zanahoria', 'Jugo de naranja'],
    ['FrÃ­joles con arroz', 'Carne molida', 'PlÃ¡tano maduro'],
    ['Pasta con pollo', 'Ensalada fresca', 'Agua de panela'],
    ['Lentejas con arroz', 'Huevo revuelto', 'Jugo de mora'],
    ['Sancocho de papa', 'Arroz blanco', 'Fruta de temporada'],
  ];

  private inventarioDe(i: Institucion): ProductoInventario[] {
    const asistentes = i.matriculados * (i.asistenciaPromedio / 100);

    return this.catalogoMuestra.map((p, indice) => {
      // Los perecederos no duran mÃ¡s de una semana
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

  // Ãšltimos 5 dÃ­as hÃ¡biles: raciones segÃºn matriculados y asistencia
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

  // MenÃºs de los prÃ³ximos 3 dÃ­as hÃ¡biles
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

  private cargarReportesReales(institucion: Institucion): void {
    if (!this.planillasPae || typeof institucion.id === 'string' && institucion.id.startsWith('ej-')) {
      this.reportes = [];
      return;
    }
    this.planillasPae.consultarReporteConsolidado({
      tipo_reporte: 'RESUMEN_GENERAL',
      id_institucion: institucion.id,
    }).subscribe({
      next: (resp) => {
        const res = resp.resumen_ejecutivo || {};
        const fechaAct = (resp.fecha_actualizacion || this.hoy()).slice(0, 10);
        this.reportes = [
          {
            tipoReporte: 'INVENTARIO_CONSOLIDADO',
            nombre: 'Inventario consolidado por sede',
            detalle: `${res['sedes_autorizadas'] ?? 0} sede(s) Â· ${res['productos_bajo_minimo'] ?? 0} alerta(s) bajo stock mÃ­nimo`,
            fecha: fechaAct,
            icono: 'inventory_2',
          },
          {
            tipoReporte: 'CONSUMO_ALIMENTOS',
            nombre: 'Balance de consumo y ejecuciÃ³n',
            detalle: `Programado: ${res['productos_programados'] ?? 0} Â· Recibido: ${res['productos_recibidos'] ?? 0} Â· Consumido: ${res['productos_consumidos'] ?? 0}`,
            fecha: fechaAct,
            icono: 'monitoring',
          },
          {
            tipoReporte: 'RECEPCIONES_DIFERENCIAS',
            nombre: 'Entregas, recepciones y diferencias',
            detalle: `${res['total_entregas'] ?? 0} entrega(s) (${res['entregas_recibidas'] ?? 0} recibidas, ${res['entregas_con_novedad'] ?? 0} novedades)`,
            fecha: fechaAct,
            icono: 'local_shipping',
          },
          {
            tipoReporte: 'ASISTENCIA_GRADOS',
            nombre: 'Asistencia diaria por grados',
            detalle: `${res['asistencia_acumulada'] ?? 0} asistencia(s) registradas Â· Cobertura promedio ${res['cobertura_asistencia_promedio'] ?? 0}%`,
            fecha: fechaAct,
            icono: 'fact_check',
          },
        ];
      },
      error: () => {
        this.reportes = [];
      },
    });
  }

  descargar(r: ReporteItem): void {
    if (!this.seleccionada) return;
    if (this.planillasPae && !(typeof this.seleccionada.id === 'string' && this.seleccionada.id.startsWith('ej-'))) {
      this.planillasPae.descargarReporteConsolidadoCsv({
        tipo_reporte: r.tipoReporte,
        id_institucion: this.seleccionada.id,
      }).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `reporte_${r.tipoReporte.toLowerCase()}_${this.seleccionada?.id}.csv`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 0);
        },
        error: () => {
          if (this.router) {
            void this.router.navigate(['/reportes-consumo'], {
              queryParams: { tipo: r.tipoReporte, institucion: this.seleccionada?.id },
            });
          }
        },
      });
      return;
    }
    if (this.router) {
      void this.router.navigate(['/reportes-consumo']);
    }
  }

  // =====================================================
  //  IMÃGENES
  // =====================================================

  // Carga el catÃ¡logo del servidor (solo respaldo para productos que no estÃ©n en ARCHIVOS_IMAGEN)
  private cargarImagenes(): void {
    this.http.get<any>(this.urlIngredientes).pipe(
      map(d => (Array.isArray(d) ? d : (d?.results ?? [])) as any[])
    ).subscribe({
      next: (lista) => {
        const mapa = new Map<string, string>();
        for (const item of lista) {
          const nombre = leerTexto(item, 'nombre', 'nombre_ingrediente', 'ingrediente');
          const url = this.resolverImagen(leerTexto(item, 'imagen_ingrediente', 'imagen', 'imagen_url', 'foto', 'image', 'icono'));
          if (nombre && url) mapa.set(normalizar(nombre), url);
        }
        this.imagenesIngredientes = mapa;
      },
      // Sin catÃ¡logo no pasa nada grave: se usan las imÃ¡genes locales o los emojis
      error: (error) => console.error('Error al cargar imÃ¡genes de ingredientes:', error),
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
  //   1) imagen del catálogo del servidor (Cloudinary u otra URL)
  //   2) archivo local de public/ (mapa ARCHIVOS_IMAGEN)
  //   3) public/<nombre_del_producto>.png
  urlImagen(nombre: string): string {
    const n = normalizar(nombre);

    // Prioridad 1: imagen real del servidor (Cloudinary)
    const urlServidor = this.imagenesIngredientes.get(n);
    if (urlServidor) return urlServidor;

    // Prioridad 2: imagen estática local como respaldo
    const local = ARCHIVOS_IMAGEN[n];
    if (local) return `${RUTA_IMAGENES}${local}`;

    return `${RUTA_IMAGENES}${n.replace(/\s+/g, '_')}.${EXTENSION_IMAGEN}`;
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

  // n dÃ­as hÃ¡biles (lunes a viernes): hacia atrÃ¡s desde hoy, o hacia adelante desde maÃ±ana
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
    const nombres = ['Domingo', 'Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado'];
    return nombres[new Date(iso + 'T00:00:00').getDay()];
  }

  // dd/mm/aaaa; si no hay fecha vÃ¡lida muestra "â€”"
  fechaCorta(valor: string | null | undefined): string {
    const iso = String(valor ?? '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'â€”';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // dd/mm/aaaa hh:mm; si solo viene la fecha (sin hora) muestra Ãºnicamente la fecha
  fechaHora(valor: string | null | undefined): string {
    const v = String(valor ?? '').trim();
    if (!v) return 'â€”';
    // Una fecha sin hora se interpretarÃ­a como UTC y podrÃ­a mostrar el dÃ­a anterior
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return this.fechaCorta(v);
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return this.fechaCorta(v);
    return d.toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // La Ãºltima actualizaciÃ³n puede venir como fecha o como texto ("Hoy, 8:42 a. m.")
  textoActualizacion(i: Institucion): string {
    const v = i.ultimaActualizacion;
    if (!v) return 'â€”';
    return /^\d{4}-\d{2}-\d{2}/.test(v) ? this.fechaCorta(v) : v;
  }
}
