import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SweetAlertService } from '../sweet-alert.service';
import { EntregasService } from '../services/entregas.service';
import { AuthService, InstitucionAsignada } from '../core/auth/auth.service';

// Opciones de los catálogos (se definen aquí para no depender de la forma exacta de los tipos del servicio)
interface IngredienteOpcion { id: number; nombre: string; }
interface TipoMercadoOpcion { id: number; nombre: string; }

// Fila que se muestra en la tabla del historial
interface FilaEntrega {
  id?: number;
  idIngrediente: number | null;
  idTipoMercado: number | null;
  ingrediente: string;
  tipoMercado: string;                   // nombre del catálogo
  categoria: 'Granos' | 'Perecederos';   // para colores y alertas
  frecuencia: string;
  cantidad: number;
  unidad: string;
  fechaRecepcion: string;                // YYYY-MM-DD
  fechaVencimiento: string;              // YYYY-MM-DD

  // Opcionales: alimentan el modal "Registro del día" y el panel de detalle (si el backend no los envía, se muestra "—")
  codigo?: string;
  lote?: string;
  destino?: string;
  hora?: string;
  responsable?: string;
  estadoEntrega?: string;
}

// Fila de la carga por lote (una por ingrediente del inventario)
interface FilaLote {
  idIngrediente: number;
  nombre: string;
  cantidad: number | null;
  unidad: string;
  idTipoMercado: number | null;  // Perecedero / No perecedero (catálogo de tipos de mercado)
  frecuenciaDias: number | null; // cada cuántos días llega (8, 20, ...)
  diasVigencia: number | null;   // duración que tuvo la última entrega (recepción -> vencimiento)
  fechaVencimiento: string;
  tieneHistorial: boolean;
}

// Inventario: todas las entregas recibidas en una misma fecha
interface Factura {
  fecha: string;                 // YYYY-MM-DD
  folio: string;                 // CI-AAAAMMDD
  items: FilaEntrega[];
  alertas: number;               // productos vencidos o por vencer
}

// Producto del catálogo que se ve como tarjeta en la vista Menú
interface ProductoCatalogo {
  id: number;
  nombre: string;
  categoria: string;
  unidad: string;
  idTipoMercado: number | null;
}

// Grupo de productos de una misma categoría
interface GrupoMenu {
  nombre: string;
  emoji: string;
  productos: ProductoCatalogo[];
}

// Un día del calendario mensual
interface DiaCalendario {
  iso: string;            // YYYY-MM-DD
  numero: number;         // número del día
  enMes: boolean;         // false = día del mes anterior o siguiente
  esHoy: boolean;
  seleccionado: boolean;
  entregas: number;       // productos recibidos ese día
  estado: 'Vigente' | 'Próximo a vencer' | 'Vencido' | null;   // el peor estado entre los productos del día
  vencen: number;         // productos que vencen ese día
}

// Un registro (entrega) dentro del modal "Registro del día"
interface RegistroDia {
  codigo: string;
  descripcion: string;
  estado: string;
  destino: string;
  hora: string;
  responsable: string;
  items: FilaEntrega[];
}

// Fila del formulario "Entradas" (un producto que entra)
interface EntradaFila {
  idIngrediente: number | null;
  cantidad: number | null;
  unidad: string;
  perecedero: boolean;
}

// Una institución (o sede) a la que va el producto, con la cantidad que se le envía
interface EnvioDestino {
  institucion: string;
  cantidad: number | null;
}

// Un envío ya hecho (se muestra en el historial)
interface EnvioRegistro {
  id: number;
  idInstitucion: number | null;   // institución activa cuando se hizo el envío (para no mezclar instituciones)
  ingrediente: string;
  cantidad: number;
  unidad: string;
  destino: string;
  fechaSalida: string;
  fechaEntrega: string;
  enviadoEl: string;       // fecha en que se registró el envío
}

interface CategoriaOpcion {
  nombre: string;
  emoji: string;
  total: number;
}

type Columna = 'fechaRecepcion' | 'ingrediente' | 'tipoMercado' | 'cantidad' | 'fechaVencimiento' | 'estado';
type FiltroMercado = 'Todos' | 'Granos' | 'Perecederos';
type FiltroEstado = 'Todos' | 'Vigente' | 'Próximo a vencer' | 'Vencido';

@Component({
  selector: 'app-registrar-entrega-alimentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registrar-entrega-alimentos.html',
  styleUrls: ['./registrar-entrega-alimentos.css'],
})
export class RegistrarEntregaAlimentosComponent implements OnInit, OnDestroy {

  // ===================== PRODUCTOS BASE =====================
  // Se usan cuando el servidor no devuelve ingredientes, para que el inventario nunca salga vacío.
  // IMPORTANTE: para poder GUARDAR, estos ids (1, 2, 3...) deben existir en la tabla de ingredientes del backend.
  // (Van PRIMERO en la clase porque los campos de abajo los usan para pintar al instante.)
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

  // Tipos de mercado de respaldo (solo si el servidor no los entrega)
  private readonly tiposBase: TipoMercadoOpcion[] = [
    { id: 1, nombre: 'Perecedero' },
    { id: 2, nombre: 'No perecedero' },
  ];

  // Unidad sugerida para los productos que aún no tienen historial
  private readonly unidadPorDefecto: Record<string, string> = {
    'Aceite': 'Litros', 'Leche': 'Litros', 'Huevos': 'Unidades',
  };

  // ===================== CACHÉ EN EL NAVEGADOR (carga instantánea) =====================
  // Se muestra lo último que se sabía y se refresca en segundo plano.
  private readonly claveCacheIngredientes = 'sirae_cat_ingredientes';
  private readonly claveCacheTipos = 'sirae_cat_tipos_mercado';
  // La caché del historial es POR institución: así nunca se ve lo de otra institución
  private get claveCacheEntregas(): string { return `sirae_cache_entregas_${this.idInstitucion ?? 'todas'}`; }

  private leerCache<T>(clave: string): T | null {
    try {
      const valor = JSON.parse(localStorage.getItem(clave) || 'null');
      return valor ?? null;
    } catch { return null; }
  }

  private guardarCache(clave: string, valor: unknown): void {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin espacio o bloqueado */ }
  }

  // Llama a este método al cerrar sesión (junto con la limpieza de la institución activa en AuthService)
  limpiarCacheLocal(): void {
    try {
      localStorage.removeItem(this.claveCacheIngredientes);
      localStorage.removeItem(this.claveCacheTipos);
      localStorage.removeItem(this.claveCacheEntregas);
    } catch { /* nada */ }
  }

  // Arrancan con la caché (o con los productos base) para que la pantalla NUNCA salga vacía
  ingredientes: IngredienteOpcion[] = this.leerCache<IngredienteOpcion[]>(this.claveCacheIngredientes) ?? this.productosBase;
  tiposMercado: TipoMercadoOpcion[] = this.leerCache<TipoMercadoOpcion[]>(this.claveCacheTipos) ?? this.tiposBase;
  cargandoCatalogos = false;   // ya hay algo que mostrar; el servidor solo actualiza en segundo plano
  errorMensaje = '';
  errorCatalogos = '';   // aviso fijo en el modal cuando los catálogos no llegaron del servidor

  // ===================== INSTITUCIÓN (nombre de la activa, para textos por defecto) =====================
  institucionLote = '';

  // ===================== MENÚ / CATEGORÍAS =====================
  categoriaMenu = 'Todos';   // categoría elegida en la vista Menú
  categoriaLote = 'Todos';   // categoría elegida en el modal

  // ===================== CARGA POR LOTE =====================
  fechaRecepcionLote = this.fechaHoy();
  filasLote: FilaLote[] = [];
  guardandoLote = false;
  busquedaLote = '';

  // ===================== HISTORIAL DE ENTREGAS =====================
  // Si te da error 404 al cargar la tabla, pon aquí la misma ruta que usa registrar() en entregas.service.ts
  private readonly urlEntregas = `${environment.apiUrl}/entregas/`;

  mostrarModalEntrega = false;
  cargandoHistorial = false;
  errorHistorial = false;

  // ===================== INSTITUCIÓN SELECCIONADA =====================
  institucionActiva: InstitucionAsignada | null = null;
  idInstitucion: number | null = null;   // institución cuyas entregas se muestran
  idSede: number | null = null;          // opcional: viene de "Entregas" en Mis sedes (?sede=ID)
  ahoraTexto = '';
  private subInstitucion?: Subscription;
  private reloj?: ReturnType<typeof setInterval>;

  // Se llena en ngOnInit con la caché de la institución activa
  private entregasRaw: any[] = [];
  historial: FilaEntrega[] = [];

  // Filtros: se aplican al instante, sin botón
  textoFiltro = '';
  fechaDesde = '';
  fechaHasta = '';
  ingredienteFiltro = 'Todos';
  filtroMercado: FiltroMercado = 'Todos';
  filtroEstado: FiltroEstado = 'Todos';

  // Orden de la tabla (clic en el título de cada columna)
  ordenColumna: Columna = 'fechaRecepcion';
  ordenDireccion: 'asc' | 'desc' = 'desc';

  // Paginación
  paginaActual = 1;
  porPagina = 10;
  opcionesPorPagina = [10, 25, 50];
  filasEsqueleto = [1, 2, 3, 4, 5];
  columnasEsqueleto = [1, 2, 3, 4, 5, 6];

  constructor(
    private entregasService: EntregasService,
    private alertas: SweetAlertService,
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const sede = Number(this.route.snapshot.queryParamMap.get('sede'));
    this.idSede = sede > 0 ? sede : null;

    this.aplicarInstitucion(this.authService.obtenerInstitucionActiva(), false);

    // Sin institución elegida no se puede trabajar en Inventario: se vuelve a la pantalla de selección
    if (!this.institucionActiva) {
      this.router.navigate(['/dashboard-supervisor'], { queryParams: { cambiar: 'true' } });
      return;
    }

    this.reconstruirHistorial();   // pinta YA con la caché / productos base, sin esperar al servidor
    this.cargarCatalogos();
    this.cargarHistorial();

    // Si el supervisor cambia de institución, se recarga todo con la nueva
    this.subInstitucion = this.authService.institucionActiva$.subscribe(inst => {
      if ((inst?.id_institucion ?? null) !== this.idInstitucion) {
        if (!inst) {
          this.router.navigate(['/dashboard-supervisor'], { queryParams: { cambiar: 'true' } });
          return;
        }
        // Al cambiar de institución, la sede elegida antes ya no aplica
        this.idSede = null;
        this.aplicarInstitucion(inst, true);
      }
    });

    this.actualizarReloj();
    this.reloj = setInterval(() => { this.actualizarReloj(); this.cdr.markForCheck(); }, 30000);
  }

  ngOnDestroy(): void {
    this.subInstitucion?.unsubscribe();
    if (this.reloj) clearInterval(this.reloj);
  }

  // Nombre que se muestra en el encabezado
  get nombreInstitucion(): string {
    return this.institucionActiva?.nombre_institucion ?? 'Sin institución seleccionada';
  }

  // Sede activa (cuando se llega desde "Entregas" en Mis sedes)
  get nombreSede(): string {
    const s = (this.institucionActiva?.sedes ?? []).find((x: any) => Number(x.id_sede) === this.idSede);
    return (s as any)?.nombre_sede ?? '';
  }

  private actualizarReloj(): void {
    this.ahoraTexto = new Date().toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  // Cambia la institución activa: usa su caché y (si recargar) vuelve a pedir sus entregas
  private aplicarInstitucion(inst: InstitucionAsignada | null, recargar: boolean): void {
    this.institucionActiva = inst;
    this.idInstitucion = inst?.id_institucion ?? null;
    this.institucionLote = inst?.nombre_institucion ?? '';

    this.entregasRaw = this.leerCache<any[]>(this.claveCacheEntregas) ?? [];
    this.seleccionados = [];
    this.productoDetalle = null;

    if (recargar) {
      this.reconstruirHistorial();
      this.cargarHistorial();
      this.cdr.markForCheck();
    }
  }

  // Datos de institución / sede que se envían al guardar una entrega
  private datosInstitucion(): Record<string, number> {
    const datos: Record<string, number> = {};
    if (this.idInstitucion != null) datos['id_institucion'] = this.idInstitucion;
    if (this.idSede != null) datos['id_sede'] = this.idSede;
    return datos;
  }

  // Seguro extra: si el backend devuelve entregas de varias instituciones, se descartan las que no son de la activa.
  // (Las que no traen institución se dejan pasar: no hay forma de saber de cuál son.)
  private soloDeInstitucion(lista: any[]): any[] {
    if (this.idInstitucion == null) return lista;
    return lista.filter(item => {
      const raw = item.id_institucion
        ?? (typeof item.institucion === 'number' ? item.institucion : (item.institucion?.id_institucion ?? item.institucion?.id));
      return raw == null || Number(raw) === this.idInstitucion;
    });
  }

  // Esc cierra la ventana abierta (primero los modales, al final el detalle del panel)
  @HostListener('document:keydown.escape')
  alPresionarEsc(): void {
    if (this.envioProducto) { this.cerrarModalEnvio(); return; }
    if (this.mostrarModalEntrada && !this.guardandoEntrada) { this.cerrarModalEntrada(); return; }
    if (this.modalDiaAbierto) { this.cerrarModalDia(); return; }
    if (this.mostrarModalEntrega) { this.cerrarModalEntrega(); return; }
    if (this.productoDetalle) this.cerrarDetalleProducto();
  }

  cargarCatalogos(): void {
    // No se activa "cargando": la pantalla ya tiene productos (caché o base) y se actualiza sola al llegar el servidor
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
        this.reconstruirHistorial(); // ya hay nombres de catálogo para la tabla (y arma la lista del lote)
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al cargar catálogos de entregas:', error);
        const motivo = this.describirError(error);
        this.errorCatalogos = `No se pudieron cargar los catálogos del servidor: ${motivo}. Se muestran productos de ejemplo; para guardar debe funcionar la conexión.`;
        void this.alertas.error('No se pudo cargar el formulario', this.errorCatalogos);
        // El formulario sigue usable con los productos y tipos de respaldo
        if (this.ingredientes.length === 0) this.ingredientes = this.productosBase;
        if (this.tiposMercado.length === 0) this.tiposMercado = this.tiposBase;
        this.cargandoCatalogos = false;
        this.reconstruirHistorial();
        this.cdr.markForCheck();
      },
    });
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

  // Fecha de hoy en hora local (YYYY-MM-DD). Pública: la usa el botón "Hoy" del formulario
  fechaHoy(): string {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  }

  // "viernes, 16 de octubre de 2026"
  fechaLarga(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  // =====================================================
  //  CARGA POR LOTE: escribir solo la cantidad de cada producto
  // =====================================================
  // Arma una fila por ingrediente, autocompletada con su última entrega.
  // conservar = true mantiene las cantidades ya escritas (por si el historial termina de cargar con el modal abierto)
  private prepararLote(conservar = true): void {
    const previas = new Map<number, number | null>();
    if (conservar) this.filasLote.forEach(f => previas.set(f.idIngrediente, f.cantidad));

    this.filasLote = this.ingredientes.map(ing => {
      const ultima = this.historial
        .filter(e => e.idIngrediente === ing.id)
        .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion))[0];

      const dias = ultima && ultima.fechaRecepcion && ultima.fechaVencimiento
        ? this.diasEntre(ultima.fechaRecepcion, ultima.fechaVencimiento)
        : 0;

      const fila: FilaLote = {
        idIngrediente: ing.id,
        nombre: ing.nombre,
        cantidad: previas.get(ing.id) ?? null,
        unidad: ultima ? this.normalizarUnidad(ultima.unidad) : (this.unidadPorDefecto[ing.nombre] ?? 'Kg'),
        idTipoMercado: ultima?.idTipoMercado ?? null,
        frecuenciaDias: ultima ? this.diasDeFrecuencia(ultima.frecuencia) : null,
        diasVigencia: dias > 0 ? dias : null,
        fechaVencimiento: '',
        tieneHistorial: !!ultima,
      };
      this.recalcularVencimiento(fila);
      return fila;
    });
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

  private recalcularVencimiento(f: FilaLote): void {
    if (f.diasVigencia == null || !this.fechaRecepcionLote) return;
    f.fechaVencimiento = this.sumarDiasISO(this.fechaRecepcionLote, f.diasVigencia);
  }

  alCambiarFechaLote(fecha: string): void {
    this.fechaRecepcionLote = fecha;
    this.filasLote.forEach(f => this.recalcularVencimiento(f));
  }

  get filasLoteVisibles(): FilaLote[] {
    const q = this.busquedaLote.trim().toLowerCase();
    return this.filasLote.filter(f =>
      (this.categoriaLote === 'Todos' || this.categoriaDe(f.nombre) === this.categoriaLote) &&
      (!q || f.nombre.toLowerCase().includes(q))
    );
  }

  get filasConCantidad(): FilaLote[] {
    return this.filasLote.filter(f => f.cantidad != null && f.cantidad > 0);
  }

  filaIncompleta(f: FilaLote): boolean {
    return !f.unidad || !f.idTipoMercado || !f.frecuenciaDias || f.frecuenciaDias < 1 || !f.fechaVencimiento;
  }

  trackLote = (_: number, f: FilaLote) => f.idIngrediente;

  guardarLote(): void {
    const filas = this.filasConCantidad;

    if (this.tiposMercado.length === 0 || this.ingredientes.length === 0) {
      return this.mostrarError('No hay catálogos cargados. Actualiza el catálogo e intenta de nuevo.');
    }
    if (filas.length === 0) {
      return this.mostrarError('Escribe la cantidad de al menos un producto.');
    }
    if (!this.fechaRecepcionLote) {
      return this.mostrarError('Selecciona la fecha de recepción.');
    }
    const incompletas = filas.filter(f => this.filaIncompleta(f));
    if (incompletas.length > 0) {
      return this.mostrarError(`Completa los datos marcados en rojo: ${incompletas.map(f => f.nombre).join(', ')}.`);
    }
    const fechasMalas = filas.filter(f => f.fechaVencimiento < this.fechaRecepcionLote);
    if (fechasMalas.length > 0) {
      return this.mostrarError(`El vencimiento es anterior a la recepción en: ${fechasMalas.map(f => f.nombre).join(', ')}.`);
    }

    this.errorMensaje = '';
    this.guardandoLote = true;

    // Una petición por producto; si una falla, las demás se siguen guardando
    let motivoFallo = '';
    const peticiones = filas.map(f =>
      this.entregasService.registrar({
        id_ingrediente: f.idIngrediente,
        id_tipo_mercado: f.idTipoMercado!,
        frecuencia: this.textoFrecuencia(f.frecuenciaDias!),
        cantidad: f.cantidad!,
        unidad: f.unidad,
        fecha_entrega: this.fechaRecepcionLote,
        fecha_vencimiento: f.fechaVencimiento,
        ...this.datosInstitucion(),
        observaciones: '',
      } as any).pipe(
        map(() => ({ ok: true, fila: f })),
        catchError(error => {
          console.error('Error al registrar', f.nombre, error);
          motivoFallo = this.describirError(error);
          return of({ ok: false, fila: f });
        }),
      )
    );

    forkJoin(peticiones).subscribe(resultados => {
      this.guardandoLote = false;
      const fallidas = resultados.filter(r => !r.ok).map(r => r.fila);
      const guardadas = resultados.length - fallidas.length;

      // Quita la cantidad de las que sí se guardaron; las fallidas se quedan para reintentar
      resultados.filter(r => r.ok).forEach(r => (r.fila.cantidad = null));

      if (guardadas > 0) {
        this.mostrarHistorialEnvios = true;   // NUEVO: el panel de la izquierda queda en Historial para ver lo registrado
        // El inventario recién guardado queda visible: sin filtros, ordenado por fecha (el más reciente primero) y abierto
        this.limpiarFiltros();
        this.ordenColumna = 'fechaRecepcion';
        this.ordenDireccion = 'desc';
        this.facturasAbiertas.add(this.fechaRecepcionLote);
      }

      if (fallidas.length === 0) {
        void this.alertas.success('Inventario guardado', `Se registraron ${guardadas} producto(s) con fecha ${this.fechaCorta(this.fechaRecepcionLote)}.`);
        this.vista = 'facturas';
        this.mostrarModalEntrega = false;
      } else {
        this.errorMensaje =
          `Se guardaron ${guardadas} y fallaron ${fallidas.length}: ${fallidas.map(f => f.nombre).join(', ')}. ` +
          (motivoFallo ? `Motivo: ${motivoFallo}. ` : '') +
          'Sus cantidades siguen en la lista para que intentes de nuevo.';
        void this.alertas.error('El inventario quedó incompleto', this.errorMensaje);
      }
      this.cargarHistorial();
      this.cdr.markForCheck();
    });
  }

  // =====================================================
  //  HISTORIAL: carga de la tabla
  // =====================================================
  cargarHistorial(): void {
    // Solo se muestra "Cargando entregas…" si no hay nada guardado de antes; si hay caché, se refresca en silencio
    this.cargandoHistorial = this.entregasRaw.length === 0;
    this.errorHistorial = false;

    const idPedido = this.idInstitucion;
    let params = new HttpParams();
    if (this.idInstitucion != null) params = params.set('id_institucion', this.idInstitucion);
    if (this.idSede != null) params = params.set('id_sede', this.idSede);

    this.http.get<any>(this.urlEntregas, { params }).pipe(
      map(d => (Array.isArray(d) ? d : (d?.results ?? [])) as any[]),
      map(lista => this.soloDeInstitucion(lista))
    ).subscribe({
      next: (lista) => {
        if (idPedido !== this.idInstitucion) return;   // llegó tarde: ya se cambió de institución
        this.entregasRaw = lista;
        this.guardarCache(this.claveCacheEntregas, lista);
        this.reconstruirHistorial();
        this.cargandoHistorial = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al consultar entregas:', error);
        this.cargandoHistorial = false;
        // Si hay datos de caché en pantalla no se muestra el error: se sigue viendo lo último conocido
        this.errorHistorial = this.entregasRaw.length === 0;
        this.cdr.markForCheck();
      },
    });
  }

  // Convierte lo que devuelve el backend en filas con nombres (usa los catálogos por id)
  private reconstruirHistorial(): void {
    this.historial = this.entregasRaw.map(item => this.aFila(item));
    this.prepararLote(true); // la lista del lote usa el historial para autocompletar

    // Si hay un producto abierto en el panel de detalle, se actualiza con los datos nuevos
    if (this.productoDetalle) {
      const abierto = this.productoDetalle;
      this.productoDetalle = this.historial.find(e => this.esMismoProducto(e, abierto)) ?? null;
    }

    // Lo mismo con los productos elegidos en el menú: se actualizan con su última entrada
    this.seleccionados = this.seleccionados
      .map(sel => this.historial
        .filter(e => e.idIngrediente === sel.idIngrediente)
        .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion) || ((b.id ?? 0) - (a.id ?? 0)))[0])
      .filter((e): e is FilaEntrega => !!e);
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

    const idIng = idIngrediente != null ? Number(idIngrediente) : (this.ingredientes.find(i => i.nombre === ingrediente)?.id ?? null);
    const idTip = idTipo != null ? Number(idTipo) : (this.tiposMercado.find(t => t.nombre === tipoMercado)?.id ?? null);

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

      // Opcionales para el panel de detalle y el modal "Registro del día":
      // se aceptan varios nombres de campo; si el backend no envía ninguno quedan vacíos y se muestra "—"
      codigo: item.codigo ?? item.codigo_entrega ?? '',
      lote: item.lote ?? item.numero_lote ?? '',
      destino: this.texto(item.destino) || this.texto(item.destino_nombre) || this.texto(item.institucion) || extra?.destino || '',
      hora: this.horaDe(item.hora_salida ?? item.hora ?? item.hora_registro ?? item.created_at ?? item.fecha_creacion) || extra?.hora || '',
      responsable: this.texto(item.responsable) || this.texto(item.responsable_nombre) || this.texto(item.usuario) || extra?.responsable || '',
      estadoEntrega: item.estado ?? '',
    };
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

  // Si viene el nombre de un producto (botón + de su tarjeta), el modal abre filtrado en ese producto.
  // Las cantidades ya escritas se conservan (también alimentan el panel "Tu selección").
  abrirModalEntrega(producto?: string): void {
    this.fechaRecepcionLote = this.fechaHoy();       // siempre abre con la fecha de hoy
    this.busquedaLote = producto ?? '';
    this.categoriaLote = 'Todos';
    this.errorMensaje = '';
    this.prepararLote(true);
    this.mostrarModalEntrega = true;
  }

  // Muestra un error de validación; abre el modal si se guardó desde el panel lateral
  private mostrarError(mensaje: string): void {
    this.errorMensaje = mensaje;
    this.mostrarModalEntrega = true;
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

  cerrarModalEntrega(): void {
    this.mostrarModalEntrega = false;
  }

  // =====================================================
  //  MENÚ: tarjetas de producto, categorías y lo registrado
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

  // Imagen del producto desde la carpeta public/ (devuelve null si no hay foto: ahí se usa el emoji)
  // El orden importa: lo más específico primero ("molida" antes que "carne", "deslactosad" antes que "leche").
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
    { clave: 'leche',       archivo: 'leche.png' },          // renombra "leche .png" -> "leche.png"
    { clave: 'queso',       archivo: 'queso.png' },
  ];

  imagenDe(nombre: string): string | null {
    const n = (nombre ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // quita tildes: "Plátano" -> "platano"
      .toLowerCase();
    const hallada = this.imagenesProducto.find(i => n.includes(i.clave));
    return hallada ? '/' + hallada.archivo : null;   // si usas src/assets: '/assets/' + hallada.archivo
  }

  // Imagen de cada categoría (chips deslizables y encabezados de grupo).
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

  private armarCategorias(nombres: string[]): CategoriaOpcion[] {
    const conteo = new Map<string, number>();
    nombres.forEach(n => {
      const cat = this.categoriaDe(n);
      conteo.set(cat, (conteo.get(cat) ?? 0) + 1);
    });
    const lista = Array.from(conteo.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([nombre, total]) => ({ nombre, emoji: this.emojiDeCategoria(nombre), total }));
    return [{ nombre: 'Todos', emoji: this.emojiDeCategoria('Todos'), total: nombres.length }, ...lista];
  }

  // Categorías de la vista Menú (según el catálogo de productos)
  get categoriasMenu(): CategoriaOpcion[] {
    return this.armarCategorias(this.ingredientes.map(i => i.nombre));
  }

  // Categorías del modal (según los ingredientes disponibles para registrar)
  get categoriasLote(): CategoriaOpcion[] {
    return this.armarCategorias(this.filasLote.map(f => f.nombre));
  }

  // Todos los productos del catálogo, con su unidad y tipo (se toman de su última entrega si existe)
  private get catalogoMenu(): ProductoCatalogo[] {
    return this.ingredientes.map(ing => {
      const ultima = this.historial
        .filter(e => e.idIngrediente === ing.id)
        .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion))[0];
      return {
        id: ing.id,
        nombre: ing.nombre,
        categoria: this.categoriaDe(ing.nombre),
        unidad: ultima ? this.normalizarUnidad(ultima.unidad) : (this.unidadPorDefecto[ing.nombre] ?? 'Kg'),
        idTipoMercado: ultima?.idTipoMercado ?? null,
      };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  // Productos que se ven en las tarjetas (aplica buscador, mercado y categoría)
  get productosMenu(): ProductoCatalogo[] {
    const q = this.textoFiltro.trim().toLowerCase();
    return this.catalogoMenu.filter(p =>
      (this.filtroMercado === 'Todos' || (this.filtroMercado === 'Perecederos') === this.esPerecedero(p)) &&
      (this.categoriaMenu === 'Todos' || p.categoria === this.categoriaMenu) &&
      (!q || p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || this.nombreTipo(p).toLowerCase().includes(q))
    );
  }

  // Los mismos productos, organizados por categoría
  get gruposMenu(): GrupoMenu[] {
    const mapa = new Map<string, ProductoCatalogo[]>();
    for (const p of this.productosMenu) {
      const lista = mapa.get(p.categoria) ?? [];
      lista.push(p);
      mapa.set(p.categoria, lista);
    }
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([nombre, productos]) => ({ nombre, emoji: this.emojiDeCategoria(nombre), productos }));
  }

  // Si el producto ya tuvo entregas se usa su tipo de mercado; si no, se deduce por el nombre
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

  trackGrupo(_: number, g: GrupoMenu): string {
    return g.nombre;
  }

  trackProducto(_: number, p: ProductoCatalogo): number {
    return p.id;
  }

  // Lo que se registró de un producto: última entrada y total recibido
  registroDe(nombre: string): {
    fechaIngreso: string; cantidadIngresada: number; unidad: string; totalRecibido: number; entradas: number;
  } | null {
    const entradas = this.historial
      .filter(e => e.ingrediente === nombre)
      .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion) || ((b.id ?? 0) - (a.id ?? 0)));
    if (entradas.length === 0) return null;

    const ultima = entradas[0];
    const total = entradas
      .filter(e => this.normalizarUnidad(e.unidad) === this.normalizarUnidad(ultima.unidad))   // solo suma entradas con la misma unidad
      .reduce((suma, e) => suma + e.cantidad, 0);

    return {
      fechaIngreso: ultima.fechaRecepcion,
      cantidadIngresada: ultima.cantidad,
      unidad: ultima.unidad,
      totalRecibido: Math.round(total * 100) / 100,
      entradas: entradas.length,
    };
  }

  // Último registro: todo lo que entró en la fecha de recepción más reciente
  get ultimoRegistro(): { fecha: string; items: FilaEntrega[]; totales: string } | null {
    const fechas = this.historial.map(e => e.fechaRecepcion).filter(f => !!f);
    if (fechas.length === 0) return null;

    const fecha = fechas.reduce((a, b) => (a > b ? a : b));
    const items = this.historial
      .filter(e => e.fechaRecepcion === fecha)
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0) || a.ingrediente.localeCompare(b.ingrediente, 'es'));

    // Se normaliza la unidad para que "Kg" y "kg" se sumen juntas (72 Kg y no "6 Kg · 66 kg")
    const porUnidad = new Map<string, number>();
    for (const e of items) {
      const u = this.normalizarUnidad(e.unidad) || 'Sin unidad';
      porUnidad.set(u, (porUnidad.get(u) ?? 0) + e.cantidad);
    }
    const totales = Array.from(porUnidad.entries())
      .map(([unidad, total]) => `${Math.round(total * 100) / 100} ${unidad}`)
      .join(' · ');

    return { fecha, items, totales };
  }

  // =====================================================
  //  DETALLE DEL PRODUCTO
  // =====================================================
  productoDetalle: FilaEntrega | null = null;

  // Clic en un producto registrado: muestra su detalle. Segundo clic sobre el mismo = lo cierra.
  abrirDetalleProducto(item: FilaEntrega): void {
    this.productoDetalle = this.esMismoProducto(this.productoDetalle, item) ? null : item;
  }

  cerrarDetalleProducto(): void {
    this.productoDetalle = null;
  }

  // Productos elegidos en el menú: se muestran en el panel de Inventario con los datos de su entrada
  seleccionados: FilaEntrega[] = [];

  // Clic en una tarjeta del menú: la agrega al inventario (su última entrada). Otro clic la quita.
  abrirDetalleDesdeCatalogo(producto: ProductoCatalogo): void {
    const existente = this.seleccionados.findIndex(s => s.idIngrediente === producto.id);
    if (existente >= 0) {
      this.seleccionados.splice(existente, 1);
      return;
    }

    const ultima = this.historial
      .filter(e => e.idIngrediente === producto.id)
      .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion) || ((b.id ?? 0) - (a.id ?? 0)))[0];

    if (!ultima) {
      void this.alertas.warning('Sin inventario', `${producto.nombre} todavía no tiene entradas en el inventario.`);
      return;
    }
    this.seleccionados.push(ultima);
  }

  quitarSeleccionado(item: FilaEntrega): void {
    this.seleccionados = this.seleccionados.filter(s => s.idIngrediente !== item.idIngrediente);
  }

  // Para resaltar la fila elegida (usa el id si existe)
  esMismoProducto(a: FilaEntrega | null, b: FilaEntrega | null): boolean {
    if (!a || !b) return false;
    return a.id != null && b.id != null
      ? a.id === b.id
      : a.ingrediente === b.ingrediente && a.fechaRecepcion === b.fechaRecepcion;
  }

  // ¿La tarjeta del menú está seleccionada?
  tarjetaActiva(producto: ProductoCatalogo): boolean {
    return this.seleccionados.some(s => s.idIngrediente === producto.id);
  }

  // ===================== DESTINOS: SOLO LA INSTITUCIÓN ACTIVA Y SUS SEDES =====================
  // Si la institución tiene sedes, los destinos son "Institución - Sede".
  // Si no tiene sedes, el único destino es la institución misma.
  get destinosDisponibles(): string[] {
    const inst = this.institucionActiva;
    if (!inst) return [];
    const sedes = (inst.sedes ?? [])
      .map((s: any) => s.nombre_sede as string)
      .filter((n: string) => !!n);
    return sedes.length > 0
      ? sedes.map((n: string) => `${inst.nombre_institucion} - ${n}`)
      : [inst.nombre_institucion];
  }

  // ===================== ENVIAR A LA INSTITUCIÓN / SEDES =====================
  // Flujo: icono de la escuela en un producto seleccionado -> ventana emergente -> se ELIGE la institución o sede
  // (puede ser más de una), la cantidad de cada una, la fecha de salida y la de entrega -> Enviar ->
  // queda en la pestaña Historial (un registro por destino).
  envioProducto: FilaEntrega | null = null;   // producto de la ventana emergente (null = cerrada)
  envioUnidad = 'Kg';
  envioFechaSalida = '';
  envioFechaEntrega = '';
  envioDestinos: EnvioDestino[] = [];
  errorEnvio = '';
  hoyEnvio = this.fechaHoy();
  mostrarHistorialEnvios = false;

  // Cuando tengas la ruta del backend para envíos, cambia el guardado en enviarAInstituciones() por una llamada http.post
  // (enviando id_institucion e id_sede)
  private readonly claveEnvios = 'sirae_envios_institucion';
  private enviosGuardados: EnvioRegistro[] = this.leerEnvios();

  // Solo se ven los envíos de la institución activa (no se mezclan con los de otras)
  get historialEnvios(): EnvioRegistro[] {
    return this.enviosGuardados.filter(e => e.idInstitucion === this.idInstitucion);
  }

  // NUEVO: entradas de inventario registradas (lo más reciente primero) para mostrarlas en el panel Historial
  get entradasHistorial(): FilaEntrega[] {
    return [...this.historial]
      .sort((a, b) =>
        b.fechaRecepcion.localeCompare(a.fechaRecepcion) || ((b.id ?? 0) - (a.id ?? 0)))
      .slice(0, 50);
  }

  private leerEnvios(): EnvioRegistro[] {
    try {
      const datos = JSON.parse(localStorage.getItem(this.claveEnvios) || '[]');
      return Array.isArray(datos) ? datos : [];
    } catch { return []; }
  }

  trackEnvioHist = (_: number, r: EnvioRegistro) => r.id;

  // ¿Este producto ya aparece en el historial de envíos? (marca "✓ Enviado" en la tarjeta)
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

  // Clic en el icono de la escuela de un producto
  abrirModalEnvio(item: FilaEntrega): void {
    this.hoyEnvio = this.fechaHoy();
    this.envioProducto = item;
    this.envioUnidad = this.normalizarUnidad(item.unidad) || 'Kg';
    this.envioFechaSalida = this.hoyEnvio;
    this.envioFechaEntrega = this.hoyEnvio;
    // Si solo hay un destino posible (institución sin sedes), ya queda elegido
    this.envioDestinos = this.destinosDisponibles.length === 1
      ? [{ institucion: this.destinosDisponibles[0], cantidad: null }]
      : [];
    this.errorEnvio = '';
  }

  cerrarModalEnvio(): void {
    this.envioProducto = null;
  }

  estaDestino(nombre: string): boolean {
    return this.envioDestinos.some(d => d.institucion === nombre);
  }

  // Un clic agrega el destino; otro clic lo quita
  alternarDestino(nombre: string): void {
    const i = this.envioDestinos.findIndex(d => d.institucion === nombre);
    if (i >= 0) this.envioDestinos.splice(i, 1);
    else this.envioDestinos.push({ institucion: nombre, cantidad: null });
    this.errorEnvio = '';
  }

  quitarDestinoEnvio(indice: number): void {
    this.envioDestinos.splice(indice, 1);
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
    if (!prod) return;

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

    const registros: EnvioRegistro[] = destinos.map((d, i) => ({
      id: Date.now() + i,
      idInstitucion: this.idInstitucion,
      ingrediente: prod.ingrediente,
      cantidad: d.cantidad!,
      unidad: this.envioUnidad,
      destino: d.institucion,
      fechaSalida: this.envioFechaSalida,
      fechaEntrega: this.envioFechaEntrega,
      enviadoEl: hoy,
    }));

    const actualizado = [...registros, ...this.enviosGuardados];   // lo más reciente primero
    try {
      localStorage.setItem(this.claveEnvios, JSON.stringify(actualizado));
    } catch {
      this.errorEnvio = 'No se pudo guardar el envío en este navegador.';
      return;
    }

    this.enviosGuardados = actualizado;
    this.envioProducto = null;
    this.errorEnvio = '';
    this.mostrarHistorialEnvios = true;   // se abre el Historial para ver que quedó registrado
    void this.alertas.success(
      'Envío registrado',
      `${prod.ingrediente} se envió a ${registros.length} destino(s), con salida el ${this.fechaCorta(registros[0].fechaSalida)}.`
    );
  }

  // ===================== CALENDARIO DE ENTREGAS =====================
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

  // ===================== REGISTRAR ENTRADA (botón "Entradas" del calendario) =====================
  // El formulario pide solo: fecha, destino y los productos (con cantidad y si son perecederos o no).
  // El vencimiento y la frecuencia se calculan solos con la última entrega de cada producto.
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
    // Si el usuario llegó desde una sede concreta, esa sede queda como destino; si no, el primer destino disponible
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

  // Botones - y + de la cantidad
  ajustarCantidadEntrada(fila: EntradaFila, paso: number): void {
    const nueva = Math.max(0, Math.round(((fila.cantidad ?? 0) + paso) * 100) / 100);
    fila.cantidad = nueva > 0 ? nueva : null;
  }

  // Al elegir el producto se sugiere su unidad y si es perecedero (por su última entrega o por su nombre)
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

  // Vencimiento y frecuencia: se repiten los de la última entrega del producto; si no hay, valores por defecto
  private datosAutomaticos(fila: EntradaFila): { vencimiento: string; frecuencia: string } {
    const ultima = this.historial
      .filter(e => e.idIngrediente === fila.idIngrediente)
      .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion))[0];

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
  // Si el backend no guarda destino / responsable / hora, se recuerdan aquí para lo registrado desde "Entradas"
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
        ...this.datosInstitucion(),
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
        this.mostrarHistorialEnvios = true;   // NUEVO: el panel de la izquierda queda en Historial
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

  // Si se toca un día gris (de otro mes), el calendario cambia a ese mes. Además abre el modal "Registro del día"
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

  // Detalle del día elegido
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

  // "18 de septiembre de 2025" (fechaLarga ya existe y lleva el día de la semana)
  fechaDiaModal(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
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
          destino: e.destino || this.institucionLote || '—',
          hora: e.hora || '—',
          responsable: e.responsable || '—',
          items: [],
        };
        mapa.set(codigo, reg);
      }
      reg.items.push(e);
    }
    // Destino, hora y responsable: el primero que tenga algún producto del lote
    for (const reg of mapa.values()) {
      reg.destino = reg.items.find(i => i.destino)?.destino || this.institucionLote || '—';
      reg.hora = reg.items.find(i => i.hora)?.hora || '—';
      reg.responsable = reg.items.find(i => i.responsable)?.responsable || '—';
    }
    return Array.from(mapa.values());
  }

  trackRegistro(_: number, r: RegistroDia): string {
    return r.codigo;
  }

  private primerDiaDelMes(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private isoDeFecha(d: Date): string {
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  // Botones - y + de la tarjeta del modal
  ajustarCantidad(fila: FilaLote, paso: number): void {
    const nueva = Math.max(0, Math.round(((fila.cantidad ?? 0) + paso) * 100) / 100);
    fila.cantidad = nueva > 0 ? nueva : null;
  }

  // Quita un producto del panel "Tu selección"
  quitarDeLote(fila: FilaLote): void {
    fila.cantidad = null;
  }

  get totalCantidadLote(): number {
    const total = this.filasConCantidad.reduce((suma, f) => suma + (f.cantidad ?? 0), 0);
    return Math.round(total * 100) / 100;
  }

  // =====================================================
  //  INVENTARIOS (entregas agrupadas por fecha de recepción)
  // =====================================================
  vista: 'menu' | 'facturas' | 'detalle' = 'menu';
  private facturasAbiertas = new Set<string>();

  get facturas(): Factura[] {
    const mapa = new Map<string, FilaEntrega[]>();
    for (const e of this.historialFiltrado) {
      const lista = mapa.get(e.fechaRecepcion) ?? [];
      lista.push(e);
      mapa.set(e.fechaRecepcion, lista);
    }
    return Array.from(mapa.entries())
      .map(([fecha, items]) => ({
        fecha,
        folio: 'CI-' + fecha.replace(/-/g, ''),
        items: [...items].sort((a, b) => a.ingrediente.localeCompare(b.ingrediente, 'es')),
        alertas: items.filter(e => this.estadoDe(e) !== 'Vigente').length,
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  trackFactura(_: number, f: Factura): string {
    return f.fecha;
  }

  toggleFactura(fecha: string): void {
    if (this.facturasAbiertas.has(fecha)) this.facturasAbiertas.delete(fecha);
    else this.facturasAbiertas.add(fecha);
  }

  estaAbierta(fecha: string): boolean {
    return this.facturasAbiertas.has(fecha);
  }

  // =====================================================
  //  FILTROS (al instante)
  // =====================================================
  get ingredientesHistorial(): string[] {
    return Array.from(new Set(this.historial.map(e => e.ingrediente))).filter(n => !!n).sort((a, b) => a.localeCompare(b, 'es'));
  }

  get hayFiltros(): boolean {
    return !!this.textoFiltro.trim() || !!this.fechaDesde || !!this.fechaHasta
      || this.ingredienteFiltro !== 'Todos' || this.filtroMercado !== 'Todos' || this.filtroEstado !== 'Todos';
  }

  setMercado(m: FiltroMercado): void {
    this.filtroMercado = m;
    this.paginaActual = 1;
  }

  // Clic en una tarjeta: filtra por ese estado; otro clic lo quita
  setEstado(est: FiltroEstado): void {
    this.filtroEstado = (est !== 'Todos' && this.filtroEstado === est) ? 'Todos' : est;
    this.paginaActual = 1;
  }

  limpiarFiltros(): void {
    this.textoFiltro = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.ingredienteFiltro = 'Todos';
    this.filtroMercado = 'Todos';
    this.filtroEstado = 'Todos';
    this.paginaActual = 1;
  }

  get historialFiltrado(): FilaEntrega[] {
    const texto = this.textoFiltro.trim().toLowerCase();

    const lista = this.historial.filter(e => {
      if (this.ingredienteFiltro !== 'Todos' && e.ingrediente !== this.ingredienteFiltro) return false;
      if (this.filtroMercado !== 'Todos' && e.categoria !== this.filtroMercado) return false;
      if (this.filtroEstado !== 'Todos' && this.estadoDe(e) !== this.filtroEstado) return false;
      if (this.fechaDesde && e.fechaRecepcion < this.fechaDesde) return false;
      if (this.fechaHasta && e.fechaRecepcion > this.fechaHasta) return false;
      if (texto) {
        const coincide =
          e.ingrediente.toLowerCase().includes(texto) ||
          e.tipoMercado.toLowerCase().includes(texto) ||
          e.frecuencia.toLowerCase().includes(texto) ||
          this.estadoDe(e).toLowerCase().includes(texto);
        if (!coincide) return false;
      }
      return true;
    });

    const dir = this.ordenDireccion === 'asc' ? 1 : -1;
    return lista.sort((a, b) => {
      let r = 0;
      switch (this.ordenColumna) {
        case 'ingrediente':       r = a.ingrediente.localeCompare(b.ingrediente, 'es'); break;
        case 'tipoMercado':       r = a.tipoMercado.localeCompare(b.tipoMercado, 'es'); break;
        case 'cantidad':          r = a.cantidad - b.cantidad; break;
        case 'fechaVencimiento':  r = a.fechaVencimiento.localeCompare(b.fechaVencimiento); break;
        case 'estado':            r = this.diasDe(a) - this.diasDe(b); break;
        default:                  r = a.fechaRecepcion.localeCompare(b.fechaRecepcion) || ((a.id ?? 0) - (b.id ?? 0));
      }
      return r * dir;
    });
  }

  // Resalta lo que escribes en el buscador (ej. "frijol") dentro de la tabla
  resaltarHtml(valor: any): string {
    const s = String(valor ?? '');
    const q = this.textoFiltro.trim();
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!q) return esc(s);

    const lower = s.toLowerCase();
    const ql = q.toLowerCase();
    let salida = '';
    let i = 0;
    while (i < s.length) {
      const k = lower.indexOf(ql, i);
      if (k === -1) { salida += esc(s.slice(i)); break; }
      salida += esc(s.slice(i, k)) + '<mark>' + esc(s.slice(k, k + q.length)) + '</mark>';
      i = k + q.length;
    }
    return salida;
  }

  // =====================================================
  //  ORDEN
  // =====================================================
  ordenar(col: Columna): void {
    if (this.ordenColumna === col) {
      this.ordenDireccion = this.ordenDireccion === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenColumna = col;
      this.ordenDireccion = col === 'fechaRecepcion' ? 'desc' : 'asc';
    }
    this.paginaActual = 1;
  }

  iconoOrden(col: Columna): string {
    if (this.ordenColumna !== col) return 'unfold_more';
    return this.ordenDireccion === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  trackFila(_: number, e: FilaEntrega): any {
    return e.id ?? `${e.ingrediente}-${e.fechaRecepcion}-${e.cantidad}`;
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

  claseEstado(estado: string): string {
    switch (estado) {
      case 'Vigente':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Vencido':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  }

  textoDias(d: number): string {
    if (d >= 99999) return '';
    if (d < -1) return `Vencido hace ${Math.abs(d)} días`;
    if (d === -1) return 'Venció ayer';
    if (d === 0) return 'Vence hoy';
    if (d === 1) return 'Vence mañana';
    return `Vence en ${d} días`;
  }

  // dd/mm/aaaa
  fechaCorta(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  get resumen(): { total: number; vigentes: number; porVencer: number; vencidos: number } {
    let vigentes = 0, porVencer = 0, vencidos = 0;
    for (const e of this.historial) {
      const estado = this.estadoDe(e);
      if (estado === 'Vigente') vigentes++;
      else if (estado === 'Vencido') vencidos++;
      else porVencer++;
    }
    return { total: this.historial.length, vigentes, porVencer, vencidos };
  }

  // Productos vencidos o por vencer (alimenta la barra de alerta)
  get alertasVencimiento(): any[] {
    return this.historial
      .filter(e => e.fechaVencimiento)
      .map(e => ({ ...e, dias: this.diasDe(e) }))
      .filter(e => e.dias <= this.umbralAlerta(e))
      .sort((x, y) => x.dias - y.dias);
  }

  // =====================================================
  //  PAGINACIÓN
  // =====================================================
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.historialFiltrado.length / this.porPagina));
  }

  // Muestra máximo 5 números de página alrededor de la actual
  get paginasVisibles(): number[] {
    const total = this.totalPaginas;
    let fin = Math.min(total, Math.max(1, this.paginaActual - 2) + 4);
    const ini = Math.max(1, fin - 4);
    fin = Math.min(total, ini + 4);
    return Array.from({ length: fin - ini + 1 }, (_, i) => ini + i);
  }

  get historialPaginado(): FilaEntrega[] {
    if (this.paginaActual > this.totalPaginas) this.paginaActual = this.totalPaginas;
    const inicio = (this.paginaActual - 1) * this.porPagina;
    return this.historialFiltrado.slice(inicio, inicio + this.porPagina);
  }

  get desdeRegistro(): number {
    return this.historialFiltrado.length === 0 ? 0 : (this.paginaActual - 1) * this.porPagina + 1;
  }

  get hastaRegistro(): number {
    return Math.min(this.paginaActual * this.porPagina, this.historialFiltrado.length);
  }

  irAPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas) this.paginaActual = p;
  }

  cambiarPorPagina(n: number): void {
    this.porPagina = Number(n) || 10;
    this.paginaActual = 1;
  }

  // =====================================================
  //  EXPORTAR A EXCEL (respeta los filtros y el orden)
  // =====================================================
  // Resumen: un renglón por producto y unidad con el total recibido (así el producto no se repite).
  // No mezcla unidades distintas: "Leche en Litros" y "Leche en Kg" salen en renglones separados.
  private resumenPorProducto(lista: FilaEntrega[]) {
    interface Resumen {
      ingrediente: string;
      unidad: string;
      tipoMercado: string;
      total: number;
      entregas: number;
      ultimaFecha: string;    // fecha de la entrega más reciente
      estadoUltima: string;   // estado de esa entrega más reciente
      proxVence: string;      // vencimiento más cercano que todavía no ha pasado
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

    // ---------- Tabla 1: resumen por producto ----------
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

    // ---------- Tabla 2: detalle de cada entrega ----------
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
    a.download = `historial_entregas_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}