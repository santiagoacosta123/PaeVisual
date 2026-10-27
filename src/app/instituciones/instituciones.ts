import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { map, timeout, catchError } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService, InstitucionAsignada } from '../core/auth/auth.service';

type EstadoInventario = 'Ok' | 'Bajo' | 'Crítico';
type FiltroEstado = 'Todos' | 'ACTIVO' | 'INACTIVO';
type Pestana = 'inventario' | 'entregas';

// Tarjeta de Sede individual
export interface SedeCard {
  id_sede: number;
  nombre_sede: string;
  codigo_dane?: string;
  direccion?: string;
  telefono?: string;
  estado?: string;
  id_institucion?: number;
  nombre_institucion?: string;
  matriculados?: number;
  asistenciaPromedio?: number;
  diasInventario?: number;
}

// Tarjeta de ingrediente para la sede
export interface ProductoInventario {
  nombre: string;
  emoji: string;
  categoria: string;
  unidad: string;
  saldo: number;
  vence: string;
  nivel: number;
  estado: 'Ok' | 'Bajo' | 'Por vencer' | 'Agotado';
}

// Entrega tal como llega del servidor
export interface EntregaCruda {
  ingrediente: string;
  unidad: string;
  cantidad: number;
  fechaRegistro: string;
}

// Entrega unificada por producto
export interface EntregaUnida {
  clave: string;
  ingrediente: string;
  emoji: string;
  unidad: string;
  cantidad: number;
  fechaRegistro: string;
}

const EMOJI_PRODUCTO: Record<string, string> = {
  'arroz': '🌾', 'frijol': '🫘', 'frijoles': '🫘', 'lentejas': '🫘', 'lenteja': '🫘', 'pasta': '🍝', 'harina de maiz': '🌽',
  'azucar': '🍬', 'sal': '🧂', 'aceite': '🫒', 'panela': '🍯',
  'carne de res': '🥩', 'carne molida': '🥩', 'pollo': '🍗', 'huevos': '🥚', 'pescado': '🐟',
  'leche': '🥛', 'queso': '🧀', 'yogur': '🥣', 'mantequilla': '🧈',
  'zanahoria': '🥕', 'tomate': '🍅', 'cebolla': '🧅', 'papa': '🥔',
  'platano': '🍌', 'naranja': '🍊', 'manzana': '🍎',
};

const RUTA_IMAGENES = '/';
const EXTENSION_IMAGEN = 'png';

const ARCHIVOS_IMAGEN: Record<string, string> = {
  'arroz': 'arroz.png',
  'frijol': 'frijoles.png',
  'frijoles': 'frijoles.png',
  'lenteja': 'lentejas.png',
  'lentejas': 'lentejas.png',
  'granos': 'granos.png',
  'harina': 'harina.png',
  'harina de maiz': 'harina.png',
  'pasta': 'harina.png',
  'aceite': 'aceite.png',
  'sal': 'sal.png',
  'pollo': 'pollo.png',
  'carne': 'carne.png',
  'carne de res': 'carne.png',
  'carne molida': 'molida.png',
  'molida': 'molida.png',
  'tocino': 'tocino.png',
  'huevo': 'huevos.png',
  'huevos': 'huevos.png',
  'leche': 'leche.png',
  'leche deslactosada': 'deslatosada.png',
  'deslactosada': 'deslatosada.png',
  'queso': 'queso.png',
  'lacteos': 'lacteos.png',
  'yogur': 'lacteos.png',
  'papa': 'papa.png',
  'zanahoria': 'verduras.png',
  'tomate': 'verduras.png',
  'cebolla': 'verduras.png',
  'verduras': 'verduras.png',
  'platano': 'platano.png',
  'naranja': 'frutas.png',
  'manzana': 'frutas.png',
  'frutas': 'frutas.png',
  'otros': 'otros.png',
  'plato': 'plato.png',
};

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

function leerNumero(item: any, ...claves: string[]): number {
  for (const k of claves) {
    if (item?.[k] == null || item[k] === '') continue;
    const v = Number(item[k]);
    if (!Number.isNaN(v)) return v;
  }
  return 0;
}

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
  private authService = inject(AuthService);
  private router = inject(Router);

  private readonly urlInstituciones = `${environment.apiUrl}/instituciones/`;
  private readonly urlIngredientes = `${environment.apiUrl}/ingredientes/`;
  private readonly origenServidor = /^https?:/i.test(environment.apiUrl)
    ? environment.apiUrl.replace(/\/api\/?$/, '')
    : 'http://127.0.0.1:8000';

  private imagenesIngredientes = new Map<string, string>();
  private imagenesFallidas = new Set<string>();
  private subInstitucion?: Subscription;
  private subEntregas?: Subscription;

  // Institución y Sedes
  institucionActiva: InstitucionAsignada | null = null;
  institucionesSupervisor: InstitucionAsignada[] = [];
  sedes: SedeCard[] = [];

  cargando = false;
  avisoRespaldo = '';

  // Filtros
  textoBusqueda = '';
  filtroEstado: FiltroEstado = 'Todos';
  opcionesEstado: FiltroEstado[] = ['Todos', 'ACTIVO', 'INACTIVO'];

  // Detalle de sede (solo lectura)
  seleccionada: SedeCard | null = null;
  pestana: Pestana = 'inventario';
  pestanas: { id: Pestana; nombre: string; icono: string }[] = [
    { id: 'inventario', nombre: 'Inventario de la Sede', icono: 'inventory_2' },
    { id: 'entregas',   nombre: 'Historial de Entregas',   icono: 'local_shipping' },
  ];

  inventario: ProductoInventario[] = [];
  entregasUnidas: EntregaUnida[] = [];
  cargandoEntregas = false;
  errorEntregas = '';

  ngOnInit(): void {
    // 1. Carga inmediata desde el almacenamiento local / AuthService (0 ms de bloqueo)
    this.institucionActiva = this.authService.obtenerInstitucionActiva();
    this.institucionesSupervisor = this.authService.obtenerInstitucionesSupervisor();

    this.construirListaSedes();

    // 2. Suscripción a cambios de institución activa
    this.subInstitucion = this.authService.institucionActiva$.subscribe(inst => {
      this.institucionActiva = inst;
      this.construirListaSedes();
    });

    // 3. Revalidación en segundo plano (con timeout para no congelar la pantalla)
    this.sincronizarServidor();
    this.cargarImagenes();
  }

  ngOnDestroy(): void {
    this.subInstitucion?.unsubscribe();
    this.subEntregas?.unsubscribe();
  }

  // =====================================================
  //  CONSTRUCCIÓN DE LISTA DE SEDES
  // =====================================================
  construirListaSedes(): void {
    let sedesEncontradas: SedeCard[] = [];

    if (this.institucionActiva) {
      const sedesInst = this.institucionActiva.sedes || [];
      sedesEncontradas = sedesInst.map((s: any, idx: number) => ({
        id_sede: Number(s.id_sede ?? (idx + 1)),
        nombre_sede: s.nombre_sede || `Sede ${idx + 1}`,
        codigo_dane: s.codigo_dane || '',
        direccion: s.direccion || '',
        telefono: s.telefono || '',
        estado: s.estado || 'ACTIVO',
        id_institucion: this.institucionActiva?.id_institucion,
        nombre_institucion: this.institucionActiva?.nombre_institucion,
        matriculados: s.matriculados ?? 120,
        asistenciaPromedio: s.asistencia_promedio ?? 95,
        diasInventario: s.dias_inventario ?? 14,
      }));
    } else if (this.institucionesSupervisor.length > 0) {
      for (const inst of this.institucionesSupervisor) {
        const sedesInst = inst.sedes || [];
        for (const s of sedesInst) {
          sedesEncontradas.push({
            id_sede: Number(s.id_sede),
            nombre_sede: s.nombre_sede,
            codigo_dane: s.codigo_dane || '',
            direccion: s.direccion || '',
            telefono: s.telefono || '',
            estado: s.estado || 'ACTIVO',
            id_institucion: inst.id_institucion,
            nombre_institucion: inst.nombre_institucion,
            matriculados: s.matriculados ?? 120,
            asistenciaPromedio: s.asistencia_promedio ?? 95,
            diasInventario: s.dias_inventario ?? 14,
          });
        }
      }
    }

    this.sedes = sedesEncontradas;
    this.cargando = false;
  }

  // Sincroniza las instituciones y sus sedes en segundo plano
  sincronizarServidor(): void {
    if (this.sedes.length === 0) {
      this.cargando = true;
    }

    this.http.get<any>(this.urlInstituciones).pipe(
      timeout(6000),
      map(d => (Array.isArray(d) ? d : (d?.results ?? [])) as any[]),
      catchError(err => {
        console.warn('Sincronización en segundo plano de instituciones:', err);
        return of([]);
      })
    ).subscribe((lista) => {
      this.cargando = false;
      if (lista.length > 0) {
        this.institucionesSupervisor = lista.map((item: any) => ({
          id_institucion: item.id_institucion ?? item.id,
          nombre_institucion: item.nombre_institucion ?? item.nombre,
          nit: item.nit ?? '',
          sedes: Array.isArray(item.sedes) ? item.sedes : [],
          representante_legal: item.representante_legal,
          telefono: item.telefono,
          correo_contacto: item.correo_contacto,
          estado: item.estado ?? 'ACTIVO',
          administrador_asignado: item.administrador_asignado,
        }));

        if (this.institucionActiva) {
          const encontrada = this.institucionesSupervisor.find(
            i => i.id_institucion === this.institucionActiva?.id_institucion
          );
          if (encontrada) {
            this.institucionActiva = encontrada;
            this.authService.establecerInstitucionActiva(encontrada);
          }
        }
        this.construirListaSedes();
      }
    });
  }

  // =====================================================
  //  FILTRADO
  // =====================================================
  get filtradas(): SedeCard[] {
    const q = this.textoBusqueda.trim().toLowerCase();
    return this.sedes.filter(s => {
      const coincideEstado = this.filtroEstado === 'Todos' ||
        (s.estado || '').toUpperCase() === this.filtroEstado;
      const coincideTexto = !q ||
        s.nombre_sede.toLowerCase().includes(q) ||
        (s.codigo_dane && s.codigo_dane.toLowerCase().includes(q)) ||
        (s.direccion && s.direccion.toLowerCase().includes(q)) ||
        (s.nombre_institucion && s.nombre_institucion.toLowerCase().includes(q));
      return coincideEstado && coincideTexto;
    });
  }

  get hayFiltros(): boolean {
    return !!this.textoBusqueda.trim() || this.filtroEstado !== 'Todos';
  }

  limpiarFiltros(): void {
    this.textoBusqueda = '';
    this.filtroEstado = 'Todos';
  }

  trackSede(_: number, s: SedeCard): number {
    return s.id_sede;
  }

  // =====================================================
  //  ACCIONES
  // =====================================================
  irACambiarInstitucion(): void {
    this.router.navigate(['/dashboard-supervisor'], { queryParams: { cambiar: 'true' } });
  }

  irAEntregas(sede: SedeCard): void {
    this.router.navigate(['/registrar-entrega-alimentos'], {
      queryParams: { sede: sede.id_sede }
    });
  }

  abrir(sede: SedeCard): void {
    this.seleccionada = sede;
    this.pestana = 'inventario';
    this.inventario = this.inventarioDe(sede);
    this.cargarEntregas(sede);
  }

  volver(): void {
    this.subEntregas?.unsubscribe();
    this.cargandoEntregas = false;
    this.seleccionada = null;
  }

  cambiarPestana(p: Pestana): void {
    this.pestana = p;
  }

  claseEstado(estado?: string): string {
    const est = (estado || '').toUpperCase();
    if (est === 'ACTIVO' || est === 'OK' || est === 'RECIBIDA') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }
    if (est === 'BAJO' || est === 'DESPACHADA' || est === 'POR VENCER') {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }
    return 'border-slate-200 bg-slate-50 text-slate-600';
  }

  claseBarra(estado: string): string {
    return estado === 'Ok' ? 'bg-emerald-500' : estado === 'Bajo' ? 'bg-amber-500' : 'bg-red-500';
  }

  barraProducto(p: ProductoInventario): string {
    if (p.estado === 'Ok') return this.claseBarra('Ok');
    if (p.estado === 'Bajo' || p.estado === 'Por vencer') return this.claseBarra('Bajo');
    return this.claseBarra('Crítico');
  }

  // =====================================================
  //  ENTREGAS
  // =====================================================
  cargarEntregas(sede: SedeCard): void {
    this.subEntregas?.unsubscribe();
    this.errorEntregas = '';
    this.entregasUnidas = [];
    this.cargandoEntregas = true;

    const idInst = sede.id_institucion || this.institucionActiva?.id_institucion;
    const url = `${this.urlInstituciones}${idInst}/entregas/`;

    this.subEntregas = this.http.get<any>(url).pipe(
      timeout(5000),
      map(d => (Array.isArray(d) ? d : (d?.results ?? [])) as any[]),
      catchError(() => {
        // En caso de que no haya entregas en el backend, usamos datos de muestra para visualización
        return of(this.entregasMuestra());
      })
    ).subscribe({
      next: (lista) => {
        const crudas = (lista || []).map(item => this.aEntregaCruda(item));
        this.entregasUnidas = this.unirEntregas(crudas);
        this.cargandoEntregas = false;
      },
      error: (err) => {
        console.error('Error al cargar entregas:', err);
        this.entregasUnidas = this.unirEntregas(this.entregasMuestra());
        this.cargandoEntregas = false;
      }
    });
  }

  private aEntregaCruda(item: any): EntregaCruda {
    return {
      ingrediente: leerTexto(item, 'ingrediente', 'producto', 'nombre_producto', 'nombre_ingrediente', 'nombre') || 'Producto',
      unidad: leerTexto(item, 'unidad', 'unidad_medida', 'unidad_de_medida') || 'Kg',
      cantidad: leerNumero(item, 'cantidad', 'cantidad_entregada', 'total') || 10,
      fechaRegistro: leerTexto(item, 'fecha_registro', 'fechaRegistro', 'fecha', 'created_at') || this.hoy(),
    };
  }

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

  private entregasMuestra(): EntregaCruda[] {
    const hoy = this.hoy();
    const f = (dias: number, hora: string) => `${this.sumarDias(hoy, dias)}T${hora}`;
    return [
      { ingrediente: 'Arroz',   unidad: 'Kg',       cantidad: 50,  fechaRegistro: f(-4, '08:30:00') },
      { ingrediente: 'Fríjol',  unidad: 'Kg',       cantidad: 25,  fechaRegistro: f(-4, '08:30:00') },
      { ingrediente: 'Pollo',   unidad: 'Kg',       cantidad: 30,  fechaRegistro: f(-1, '09:15:00') },
      { ingrediente: 'Huevos',  unidad: 'Unidades', cantidad: 360, fechaRegistro: f(-1, '09:15:00') },
      { ingrediente: 'Leche',   unidad: 'Litros',   cantidad: 150, fechaRegistro: f(-1, '10:00:00') },
      { ingrediente: 'Papa',    unidad: 'Kg',       cantidad: 40,  fechaRegistro: f(-1, '10:00:00') },
    ];
  }

  // =====================================================
  //  INVENTARIO DE SEDE
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

  private inventarioDe(s: SedeCard): ProductoInventario[] {
    const matriculados = s.matriculados ?? 120;
    const asistencia = s.asistenciaPromedio ?? 95;
    const diasInventario = s.diasInventario ?? 12;
    const asistentes = matriculados * (asistencia / 100);

    return this.catalogoMuestra.map((p, indice) => {
      const cobertura = p.perecedero ? Math.min(diasInventario, 7) : diasInventario;
      const saldo = Math.round(asistentes * p.porNino * cobertura * 10) / 10;
      const diasVence = p.perecedero ? 4 + (indice % 4) : 90 + indice * 10;

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
  private cargarImagenes(): void {
    this.http.get<any>(this.urlIngredientes).pipe(
      timeout(4000),
      map(d => (Array.isArray(d) ? d : (d?.results ?? [])) as any[]),
      catchError(() => of([]))
    ).subscribe((lista) => {
      const mapa = new Map<string, string>();
      for (const item of lista) {
        const nombre = leerTexto(item, 'nombre', 'nombre_ingrediente', 'ingrediente');
        const url = this.resolverImagen(leerTexto(item, 'imagen', 'imagen_url', 'foto', 'image', 'icono'));
        if (nombre && url) mapa.set(normalizar(nombre), url);
      }
      this.imagenesIngredientes = mapa;
    });
  }

  private resolverImagen(valor: string): string {
    const v = valor.trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    if (v.startsWith('/')) return `${this.origenServidor}${v}`;
    return v.includes('/')
      ? `${this.origenServidor}/media/${v}`
      : `${this.origenServidor}/media/ingredientes/${v}`;
  }

  urlImagen(nombre: string): string {
    const n = normalizar(nombre);
    const local = ARCHIVOS_IMAGEN[n];
    if (local) return `${RUTA_IMAGENES}${local}`;
    return this.imagenesIngredientes.get(n)
      ?? `${RUTA_IMAGENES}${n.replace(/\s+/g, '_')}.${EXTENSION_IMAGEN}`;
  }

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

  fechaCorta(valor: string | null | undefined): string {
    const iso = String(valor ?? '').substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  fechaHora(valor: string | null | undefined): string {
    const v = String(valor ?? '').trim();
    if (!v) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return this.fechaCorta(v);
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return this.fechaCorta(v);
    return d.toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}