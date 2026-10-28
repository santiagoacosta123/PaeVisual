import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { map, timeout, catchError } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService, InstitucionAsignada } from '../core/auth/auth.service';

type EstadoInventario = 'Ok' | 'Bajo' | 'Crítico';
type FiltroEstado = 'Todos' | 'ACTIVO' | 'INACTIVO';
type Pestana = 'inventario' | 'entregas';

// NUEVO: filtros y vista del inventario
type FiltroInv = 'Todos' | 'Ok' | 'Bajo' | 'Por vencer' | 'Agotado';
type OrdenInv = 'urgencia' | 'nombre' | 'vence';
type VistaInv = 'tarjetas' | 'tabla';

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
  // true cuando la "sede" es en realidad la institución completa (la institución no maneja sedes)
  esInstitucion?: boolean;
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
  cobertura: number; // NUEVO: días de cobertura
  estado: 'Ok' | 'Bajo' | 'Por vencer' | 'Agotado';
}

// NUEVO: productos agrupados por categoría
export interface GrupoInventario {
  categoria: string;
  productos: ProductoInventario[];
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

// Envío hecho desde "Registrar entrega de alimentos" (panel "Enviado a la institución")
export interface EnvioRegistro {
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

// Saca la lista de una respuesta que puede venir como arreglo o como { results: [...] }
function listaDe(d: any): any[] {
  return (Array.isArray(d) ? d : (d?.results ?? [])) as any[];
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
  // La misma ruta que usa la pantalla de registrar entregas
  private readonly urlEntregas = `${environment.apiUrl}/entregas/`;
  // Misma clave que usa la pantalla de registrar para guardar los envíos
  private readonly claveEnvios = 'sirae_envios_institucion';
  private readonly origenServidor = /^https?:/i.test(environment.apiUrl)
    ? environment.apiUrl.replace(/\/api\/?$/, '')
    : 'http://127.0.0.1:8000';

  private imagenesIngredientes = new Map<string, string>();
  private imagenesFallidas = new Set<string>();
  // id -> nombre de ingrediente (por si el backend solo manda el id)
  private nombresIngredientes = new Map<number, string>();
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

  // NUEVO: filtros y vista del inventario
  textoInv = '';
  categoriaInv = 'Todas';
  filtroInv: FiltroInv = 'Todos';
  ordenInv: OrdenInv = 'urgencia';
  vistaInv: VistaInv = 'tarjetas';
  estadosInv: FiltroInv[] = ['Todos', 'Ok', 'Bajo', 'Por vencer', 'Agotado'];

  entregasUnidas: EntregaUnida[] = [];
  enviosSede: EnvioRegistro[] = [];   // envíos que llegan a esta sede
  cargandoEntregas = false;
  errorEntregas = '';

  // true cuando la institución elegida NO maneja sedes: no se muestra la lista de sedes,
  // se abre directamente la institución (inventario y entregas)
  get sinSedes(): boolean {
    return !!this.institucionActiva && (this.institucionActiva.sedes?.length ?? 0) === 0;
  }

  ngOnInit(): void {
    // 1. Carga inmediata desde el almacenamiento local / AuthService (0 ms de bloqueo)
    this.institucionActiva = this.authService.obtenerInstitucionActiva();
    this.institucionesSupervisor = this.authService.obtenerInstitucionesSupervisor();

    this.construirListaSedes();

    // 2. Suscripción a cambios de institución activa
    //    (si cambia en cualquier pantalla, esta pantalla se actualiza sola)
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
  //  Solo se muestra la institución ELEGIDA y sus sedes.
  //  Si no hay ninguna elegida, se vuelve a la pantalla de selección.
  // =====================================================
  construirListaSedes(): void {
    if (!this.institucionActiva) {
      this.sedes = [];
      this.seleccionada = null;
      this.cargando = false;
      this.irACambiarInstitucion();
      return;
    }

    const inst = this.institucionActiva;
    const sedesInst = inst.sedes || [];

    this.sedes = sedesInst.map((s: any, idx: number) => ({
      id_sede: Number(s.id_sede ?? (idx + 1)),
      nombre_sede: s.nombre_sede || `Sede ${idx + 1}`,
      codigo_dane: s.codigo_dane || '',
      direccion: s.direccion || '',
      telefono: s.telefono || '',
      estado: s.estado || 'ACTIVO',
      id_institucion: inst.id_institucion,
      nombre_institucion: inst.nombre_institucion,
      matriculados: s.matriculados ?? 120,
      asistenciaPromedio: s.asistencia_promedio ?? 95,
      diasInventario: s.dias_inventario ?? 14,
    }));

    this.cargando = false;

    if (this.sinSedes) {
      // Institución sin sedes: se abre la institución directamente
      this.abrirInstitucionSinSedes();
    } else if (
      this.seleccionada &&
      (this.seleccionada.esInstitucion ||
        this.seleccionada.id_institucion !== inst.id_institucion)
    ) {
      // Se cambió a una institución con sedes (o a otra): se vuelve a la lista de sedes
      this.subEntregas?.unsubscribe();
      this.cargandoEntregas = false;
      this.seleccionada = null;
    }
  }

  // La institución que no maneja sedes se muestra como una sola unidad (sin lista de sedes)
  private abrirInstitucionSinSedes(): void {
    const inst = this.institucionActiva!;
    if (this.seleccionada?.esInstitucion && this.seleccionada.id_institucion === inst.id_institucion) return;

    this.abrir({
      id_sede: 0,
      nombre_sede: inst.nombre_institucion,
      codigo_dane: '',
      direccion: '',
      telefono: (inst as any).telefono ?? '',
      estado: (inst as any).estado ?? 'ACTIVO',
      id_institucion: inst.id_institucion,
      nombre_institucion: inst.nombre_institucion,
      esInstitucion: true,
    });
  }

  // Sincroniza las instituciones y sus sedes en segundo plano
  sincronizarServidor(): void {
    if (this.sedes.length === 0) {
      this.cargando = true;
    }

    this.http.get<any>(this.urlInstituciones).pipe(
      timeout(6000),
      map(d => listaDe(d)),
      catchError(err => {
        console.warn('Sincronización en segundo plano de instituciones:', err);
        return of([] as any[]);
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
          // Solo se actualiza si algo cambió; la suscripción a institucionActiva$
          // se encarga de reconstruir la lista (evita reconstruir dos veces).
          if (
            encontrada &&
            JSON.stringify(encontrada) !== JSON.stringify(this.institucionActiva)
          ) {
            this.authService.establecerInstitucionActiva(encontrada);
          }
        }
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
      queryParams: sede.esInstitucion ? {} : { sede: sede.id_sede }
    });
  }

  abrir(sede: SedeCard): void {
    this.seleccionada = sede;
    this.pestana = 'inventario';
    this.limpiarFiltrosInv();
    this.inventario = this.inventarioDe(sede);
    this.cargarEntregas(sede);
  }

  volver(): void {
    // Si la institución no maneja sedes no hay lista a la cual volver
    if (this.sinSedes) return;
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
  //  ENTREGAS (lo registrado en "Registrar entrega de alimentos")
  // =====================================================
  cargarEntregas(sede: SedeCard): void {
    this.subEntregas?.unsubscribe();
    this.errorEntregas = '';
    this.entregasUnidas = [];
    this.enviosSede = this.leerEnviosDeSede(sede);
    this.cargandoEntregas = true;

    const idInst = sede.id_institucion ?? this.institucionActiva?.id_institucion;
    const idSede = !sede.esInstitucion && sede.id_sede > 0 ? sede.id_sede : null;

    let params = new HttpParams();
    if (idInst != null) params = params.set('id_institucion', idInst);
    if (idSede != null) params = params.set('id_sede', idSede);

    const entregas$ = this.http.get<any>(this.urlEntregas, { params }).pipe(
      timeout(8000),
      map(d => listaDe(d)),
      catchError(err => {
        console.error('Error al cargar entregas:', err);
        this.errorEntregas = 'No se pudieron cargar las entregas. Revisa la conexión con el servidor.';
        return of([] as any[]);
      })
    );

    // Se piden también los ingredientes para poder poner el nombre cuando el backend solo manda el id
    const ingredientes$ = this.http.get<any>(this.urlIngredientes).pipe(
      timeout(4000),
      map(d => listaDe(d)),
      catchError(() => of([] as any[]))
    );

    this.subEntregas = forkJoin({ entregas: entregas$, ingredientes: ingredientes$ }).subscribe({
      next: ({ entregas, ingredientes }) => {
        for (const ing of ingredientes) {
          const id = Number(ing?.id ?? ing?.id_ingrediente);
          const nombre = leerTexto(ing, 'nombre', 'nombre_ingrediente', 'ingrediente');
          if (!Number.isNaN(id) && nombre) this.nombresIngredientes.set(id, nombre);
        }

        const propias = this.soloDeEstaSede(entregas, idInst, sede);
        this.entregasUnidas = this.unirEntregas(propias.map(item => this.aEntregaCruda(item)));
        this.cargandoEntregas = false;
      },
      error: (err) => {
        console.error('Error al cargar entregas:', err);
        this.errorEntregas = 'No se pudieron cargar las entregas.';
        this.cargandoEntregas = false;
      }
    });
  }

  // Envíos guardados en el navegador que van a esta institución / sede
  private leerEnviosDeSede(sede: SedeCard): EnvioRegistro[] {
    let todos: EnvioRegistro[] = [];
    try {
      const datos = JSON.parse(localStorage.getItem(this.claveEnvios) || '[]');
      todos = Array.isArray(datos) ? datos : [];
    } catch { return []; }

    const idInst = sede.id_institucion ?? this.institucionActiva?.id_institucion ?? null;
    const nombreInst = normalizar(sede.nombre_institucion ?? '');

    return todos.filter(e => {
      if (idInst != null && e.idInstitucion != null && Number(e.idInstitucion) !== Number(idInst)) return false;
      const destino = normalizar(e.destino ?? '');
      if (sede.esInstitucion) return destino === nombreInst || destino.startsWith(`${nombreInst} - `) || !destino.includes(' - ');
      return destino.endsWith(normalizar(` - ${sede.nombre_sede}`));
    });
  }

  trackEnvio(_: number, e: EnvioRegistro): number {
    return e.id;
  }

  // Seguro extra: deja solo lo de la institución (y la sede, si se eligió una)
  private soloDeEstaSede(lista: any[], idInst: number | null | undefined, sede: SedeCard): any[] {
    const filtraSede = !sede.esInstitucion && sede.id_sede > 0;

    return lista.filter(item => {
      const rawInst = item.id_institucion
        ?? (typeof item.institucion === 'number' ? item.institucion : (item.institucion?.id_institucion ?? item.institucion?.id));
      if (idInst != null && rawInst != null && Number(rawInst) !== Number(idInst)) return false;

      if (filtraSede) {
        const rawSede = item.id_sede
          ?? (typeof item.sede === 'number' ? item.sede : (item.sede?.id_sede ?? item.sede?.id));
        if (rawSede != null) return Number(rawSede) === sede.id_sede;

        // Sin id de sede: si el destino viene como "Institución - Sede", debe terminar en esta sede
        const destino = typeof item.destino === 'string' ? item.destino : '';
        if (destino.includes(' - ')) return normalizar(destino).endsWith(normalizar(` - ${sede.nombre_sede}`));
      }
      return true;
    });
  }

  private aEntregaCruda(item: any): EntregaCruda {
    // 1) nombre directo; 2) objeto { nombre }; 3) id -> nombre del catálogo
    let ingrediente = leerTexto(item, 'ingrediente_nombre', 'nombre_ingrediente', 'producto', 'nombre_producto');
    if (!ingrediente) {
      const ing = item?.ingrediente;
      if (ing && typeof ing === 'object') {
        ingrediente = String(ing.nombre ?? ing.name ?? '');
      } else if (typeof ing === 'string' && Number.isNaN(Number(ing))) {
        ingrediente = ing;
      }
    }
    if (!ingrediente) {
      const id = item?.id_ingrediente ?? (typeof item?.ingrediente === 'number' ? item.ingrediente : null);
      if (id != null) ingrediente = this.nombresIngredientes.get(Number(id)) ?? '';
    }

    return {
      ingrediente: ingrediente || 'Producto',
      unidad: leerTexto(item, 'unidad', 'unidad_medida', 'unidad_de_medida') || 'Kg',
      cantidad: leerNumero(item, 'cantidad', 'cantidad_entregada', 'total'),
      // Primero la fecha/hora en que se registró; si no existe, la fecha de entrega
      fechaRegistro: leerTexto(item, 'created_at', 'fecha_creacion', 'fecha_registro', 'fechaRegistro',
        'fecha_entrega', 'fecha_recepcion', 'fecha') || this.hoy(),
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

  // Datos de ejemplo (ya no se usan para el historial; se dejan por si los necesitas para pruebas)
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
        cobertura,
        estado,
      };
    });
  }

  // =====================================================
  //  INVENTARIO: RESUMEN, FILTROS Y AGRUPACIÓN (NUEVO)
  // =====================================================
  get resumenInv(): Record<FiltroInv, number> {
    const c = (e: string) => this.inventario.filter(p => p.estado === e).length;
    return {
      Todos: this.inventario.length,
      Ok: c('Ok'),
      Bajo: c('Bajo'),
      'Por vencer': c('Por vencer'),
      Agotado: c('Agotado'),
    };
  }

  get requierenAccion(): number {
    const r = this.resumenInv;
    return r.Bajo + r['Por vencer'] + r.Agotado;
  }

  get categoriasInv(): string[] {
    return ['Todas', ...Array.from(new Set(this.inventario.map(p => p.categoria))).sort()];
  }

  private pesoEstado(p: ProductoInventario): number {
    return { Agotado: 0, Bajo: 1, 'Por vencer': 2, Ok: 3 }[p.estado];
  }

  get inventarioFiltrado(): ProductoInventario[] {
    const q = this.textoInv.trim().toLowerCase();
    return this.inventario
      .filter(p =>
        (this.filtroInv === 'Todos' || p.estado === this.filtroInv) &&
        (this.categoriaInv === 'Todas' || p.categoria === this.categoriaInv) &&
        (!q || p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (this.ordenInv === 'nombre') return a.nombre.localeCompare(b.nombre);
        if (this.ordenInv === 'vence') return (a.vence || '9999').localeCompare(b.vence || '9999');
        return this.pesoEstado(a) - this.pesoEstado(b) || a.nombre.localeCompare(b.nombre);
      });
  }

  get gruposInv(): GrupoInventario[] {
    const mapa = new Map<string, ProductoInventario[]>();
    for (const p of this.inventarioFiltrado) {
      mapa.set(p.categoria, [...(mapa.get(p.categoria) ?? []), p]);
    }
    return Array.from(mapa, ([categoria, productos]) => ({ categoria, productos }));
  }

  get hayFiltrosInv(): boolean {
    return !!this.textoInv.trim() || this.categoriaInv !== 'Todas' || this.filtroInv !== 'Todos';
  }

  limpiarFiltrosInv(): void {
    this.textoInv = '';
    this.categoriaInv = 'Todas';
    this.filtroInv = 'Todos';
  }

  necesitaEnvio(p: ProductoInventario): boolean {
    return p.estado !== 'Ok';
  }

  // Lleva a Registrar entrega con el producto (y la sede) ya elegidos
  enviarProducto(p: ProductoInventario): void {
    const queryParams: Record<string, string | number> = { producto: p.nombre };
    if (this.seleccionada && !this.seleccionada.esInstitucion) {
      queryParams['sede'] = this.seleccionada.id_sede;
    }
    this.router.navigate(['/registrar-entrega-alimentos'], { queryParams });
  }

  textoCobertura(p: ProductoInventario): string {
    return p.cobertura > 0 ? `${p.cobertura} ${p.cobertura === 1 ? 'día' : 'días'}` : '—';
  }

  claseKpi(e: FiltroInv): string {
    return { Todos: 'text-slate-900', Ok: 'text-emerald-600', Bajo: 'text-amber-600', 'Por vencer': 'text-orange-600', Agotado: 'text-red-600' }[e];
  }

  // Texto de color según el estado (para las tarjetas compactas)
  claseTextoEstado(estado: string): string {
    return { Ok: 'text-emerald-600', Bajo: 'text-amber-600', 'Por vencer': 'text-orange-600', Agotado: 'text-red-600' }[estado] ?? 'text-slate-500';
  }

  // Imagen de la categoría (archivos de la carpeta public; si falta, se usa el emoji)
  imagenCategoria(categoria: string): string {
    const c = normalizar(categoria);
    let archivo = 'otros.png';
    if (c.includes('carne') || c.includes('huevo')) archivo = 'carne.png';
    else if (c.includes('lacteo')) archivo = 'lacteos.png';
    else if (c.includes('grano') || c.includes('cereal')) archivo = 'granos.png';
    else if (c.includes('fruta')) archivo = 'frutas.png';
    else if (c.includes('verdura')) archivo = 'verduras.png';
    else if (c.includes('despensa')) archivo = 'sal.png';
    return `${RUTA_IMAGENES}${archivo}`;
  }

  // Icono de la categoría
  iconoCategoria(categoria: string): string {
    const c = normalizar(categoria);
    if (c.includes('carne') || c.includes('huevo')) return '🥩';
    if (c.includes('lacteo')) return '🥛';
    if (c.includes('grano') || c.includes('cereal')) return '🌾';
    if (c.includes('fruta')) return '🍎';
    if (c.includes('verdura')) return '🥕';
    if (c.includes('despensa')) return '🫒';
    return '🍽️';
  }

  // Avance (%) de la barra de deslizamiento de una fila
  progresoFila(el: HTMLElement | null | undefined): number {
    if (!el || !el.scrollWidth) return 100;
    return Math.min(100, Math.max(10, ((el.scrollLeft + el.clientWidth) / el.scrollWidth) * 100));
  }

  trackGrupo(_: number, g: GrupoInventario): string {
    return g.categoria;
  }

  // =====================================================
  //  IMÁGENES
  // =====================================================
  private cargarImagenes(): void {
    this.http.get<any>(this.urlIngredientes).pipe(
      timeout(4000),
      map(d => listaDe(d)),
      catchError(() => of([] as any[]))
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