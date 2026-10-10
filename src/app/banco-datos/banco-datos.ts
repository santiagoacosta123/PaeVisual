import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { BancoDatosService } from '../services/banco-datos.service';
import { SweetAlertService } from '../sweet-alert.service';


// ============================================================
// TIPOS DE CONFIGURACIÓN
// ============================================================

type TipoCampo = 'text' | 'textarea' | 'number' | 'time' | 'select';

/** Tablas que alimentan listas desplegables de otras tablas. */
type FuenteRelacion = 'jornadas' | 'unidades_medida' | 'ingredientes' | 'categorias_inventario' | 'grados';

interface CampoConfig {
  name: string;
  label: string;
  type: TipoCampo;
  required?: boolean;
  placeholder?: string;
  /** Solo para type = 'select': de qué tabla salen las opciones. */
  source?: FuenteRelacion;
}

interface TabConfig {
  /** Se usa también como nombre del recurso en BancoDatosService. */
  id: string;
  nombre: string;
  /** Para el botón: "Añadir unidad de medida". */
  singular: string;
  icon: string;
  /** Nombre de la clave primaria que devuelve el backend. */
  idField: string;
  campos: CampoConfig[];
}

interface OpcionRelacion {
  id: any;
  label: string;
}


// ============================================================
// CÓMO LEER CADA TABLA RELACIONADA
// ============================================================

const FUENTES: Record<
  FuenteRelacion,
  { id: string; etiqueta: (r: any) => string }
> = {
  jornadas: {
    id: 'id_jornada',
    etiqueta: r => r.nombre_jornada ?? r.nombre ?? ''
  },
  unidades_medida: {
    id: 'id_unidad_medida',
    etiqueta: r => {
      const nombre = r.nombre ?? r.nombre_unidad ?? '';
      return r.abreviatura ? `${nombre} (${r.abreviatura})` : nombre;
    }
  },
  ingredientes: {
    id: 'id_ingrediente',
    etiqueta: r => r.nombre_ingrediente ?? r.nombre ?? ''
  },
  categorias_inventario: {
    id: 'id_categoria_inventario',
    etiqueta: r => r.nombre_categoria ?? r.nombre ?? ''
  },
  grados: {
    id: 'id_grado',
    etiqueta: r => r.nombre_grado ?? r.nombre ?? ''
  }
};


@Component({
  selector: 'app-banco-datos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './banco-datos.html',
  styleUrls: ['./banco-datos.css']
})
export class BancoDatosComponent implements OnInit, OnDestroy {

  // ============================================================
  // CONFIGURACIÓN DE TABS (una sola fuente de verdad)
  //
  // Si el backend usa otro nombre de clave primaria en alguna
  // tabla, cámbialo solo en `idField`.
  // ============================================================

  readonly tabs: TabConfig[] = [
    {
      id: 'unidades_medida',
      nombre: 'Unidades de Medida',
      singular: 'unidad de medida',
      icon: 'straighten',
      idField: 'id_unidad_medida',
      campos: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Kilogramo' },
        { name: 'abreviatura', label: 'Abreviatura', type: 'text', required: true, placeholder: 'Ej: kg' }
      ]
    },
    {
      id: 'grados',
      nombre: 'Grados',
      singular: 'grado',
      icon: 'school',
      idField: 'id_grado',
      campos: [
        { name: 'nombre_grado', label: 'Nombre del grado', type: 'text', required: true, placeholder: 'Ej: Primero' }
      ]
    },
    {
      id: 'jornadas',
      nombre: 'Jornadas',
      singular: 'jornada',
      icon: 'schedule',
      idField: 'id_jornada',
      campos: [
        { name: 'nombre_jornada', label: 'Nombre de la jornada', type: 'text', required: true, placeholder: 'Ej: Mañana' }
      ]
    },
    {
      id: 'secciones_menu',
      nombre: 'Secciones',
      singular: 'sección',
      icon: 'restaurant_menu',
      idField: 'id_seccion',
      campos: [
        { name: 'nombre_seccion', label: 'Nombre de la sección', type: 'text', required: true, placeholder: 'Ej: Desayuno' },
        { name: 'id_jornada', label: 'Jornada', type: 'select', required: true, source: 'jornadas' }
      ]
    },
    {
      id: 'tipos_mercado',
      nombre: 'Tipos Mercado',
      singular: 'tipo de mercado',
      icon: 'storefront',
      idField: 'id_tipo_mercado',
      campos: [
        { name: 'nombre_tipo', label: 'Tipo de mercado', type: 'text', required: true, placeholder: 'Ej: Perecederos' }
      ]
    },
    {
      id: 'categorias_inventario',
      nombre: 'Categorías Inv.',
      singular: 'categoría',
      icon: 'category',
      idField: 'id_categoria_inventario',
      campos: [
        { name: 'nombre_categoria', label: 'Nombre categoría', type: 'text', required: true, placeholder: 'Ej: Lácteos' }
      ]
    },
    {
      id: 'turnos',
      nombre: 'Turnos',
      singular: 'turno',
      icon: 'access_time',
      idField: 'id_turno',
      campos: [
        { name: 'nombre_turno', label: 'Nombre del turno', type: 'text', required: true },
        { name: 'hora_inicio', label: 'Hora de inicio', type: 'time', required: true },
        { name: 'hora_fin', label: 'Hora de finalización', type: 'time', required: true }
      ]
    },
    {
      id: 'roles',
      nombre: 'Roles',
      singular: 'rol',
      icon: 'shield_person',
      idField: 'id_rol',
      campos: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea' }
      ]
    },
    {
      id: 'ingredientes',
      nombre: 'Ingredientes',
      singular: 'ingrediente',
      icon: 'kitchen',
      idField: 'id_ingrediente',
      campos: [
        { name: 'nombre_ingrediente', label: 'Nombre del ingrediente', type: 'text', required: true },
        { name: 'id_categoria_inventario', label: 'Categoría', type: 'select', required: true, source: 'categorias_inventario' },
        { name: 'id_unidad_medida', label: 'Unidad de medida', type: 'select', required: true, source: 'unidades_medida' },
        { name: 'marca_ingrediente', label: 'Marca', type: 'text', required: false },
        { name: 'descripcion', label: 'Descripción', type: 'textarea', required: false }
      ]
    },
    {
      id: 'gramajes',
      nombre: 'Gramajes',
      singular: 'gramaje',
      icon: 'scale',
      idField: 'id_gramage',
      campos: [
        { name: 'id_ingrediente', label: 'Ingrediente', type: 'select', required: true, source: 'ingredientes' },
        { name: 'id_grado', label: 'Grado', type: 'select', required: true, source: 'grados' },
        { name: 'cantidad_gramage', label: 'Cantidad por porción', type: 'number', required: true },
        { name: 'id_unidad_medida', label: 'Unidad de medida', type: 'select', required: true, source: 'unidades_medida' },
        { name: 'descripcion', label: 'Descripción', type: 'textarea' }
      ]
    }
  ];


  // ============================================================
  // ESTADO
  // ============================================================

  tabActual: string = 'unidades_medida';

  datos: any[] = [];
  cargando = false;
  /** Mensaje cuando la carga FALLA (distinto de "no hay registros"). */
  errorCarga: string | null = null;

  opciones: Record<string, OpcionRelacion[]> = {
    jornadas: [],
    unidades_medida: [],
    ingredientes: [],
    categorias_inventario: [],
    grados: []
  };

  mostrarModal = false;
  modoEdicion = false;
  guardando = false;
  itemForm: any = {};
  itemSeleccionadoId: number | null = null;

  private cargaSub?: Subscription;


  constructor(
    private bancoDatosService: BancoDatosService,
    private sweetAlert: SweetAlertService,
    private cdr: ChangeDetectorRef
  ) { }


  // ============================================================
  // CICLO DE VIDA
  // ============================================================

  ngOnInit(): void {
    this.cargarDatos();
    this.cargarFuente('jornadas');
    this.cargarFuente('unidades_medida');
    this.cargarFuente('ingredientes');
    this.cargarFuente('categorias_inventario');
    this.cargarFuente('grados');
  }

  ngOnDestroy(): void {
    this.cargaSub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mostrarModal) {
      this.cerrarModal();
    }
  }


  // ============================================================
  // TAB ACTUAL
  // ============================================================

  get tab(): TabConfig {
    return this.tabs.find(t => t.id === this.tabActual) ?? this.tabs[0];
  }

  cambiarTab(tabId: string): void {
    if (this.tabActual === tabId) {
      return;
    }
    this.tabActual = tabId;
    this.cargarDatos();
  }


  // ============================================================
  // CARGA DE DATOS
  // ============================================================

  cargarDatos(): void {
    // Cancela la petición anterior: si cambias de tab rápido,
    // una respuesta lenta no pisa los datos del tab nuevo.
    this.cargaSub?.unsubscribe();

    this.cargando = true;
    this.errorCarga = null;
    this.datos = [];

    this.cargaSub = this.bancoDatosService
      .obtenerDatos(this.tabActual)
      .subscribe({
        next: (res: any) => {
          this.datos = this.normalizarRespuesta(res);
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al cargar datos:', err);
          this.datos = [];
          this.cargando = false;
          this.errorCarga = this.mensajeError(
            err,
            `No se pudo cargar ${this.tab.nombre}.`
          );
          this.cdr.detectChanges();
        }
      });
  }

  private cargarFuente(fuente: FuenteRelacion): void {
    const cfg = FUENTES[fuente];

    this.bancoDatosService.obtenerDatos(fuente).subscribe({
      next: (res: any) => {
        this.opciones[fuente] = this.normalizarRespuesta(res).map(r => ({
          id: r[cfg.id] ?? r.id,
          label: cfg.etiqueta(r)
        }));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(`Error al cargar ${fuente}:`, err);
      }
    });
  }

  /** Si cambió una tabla que alimenta selects, refresca sus opciones. */
  private refrescarFuenteSiAplica(): void {
    if (this.tabActual === 'jornadas' || this.tabActual === 'unidades_medida' || this.tabActual === 'ingredientes' || this.tabActual === 'categorias_inventario') {
      this.cargarFuente(this.tabActual as FuenteRelacion);
    }
  }

  private normalizarRespuesta(res: any): any[] {
    if (Array.isArray(res)) { return res; }
    if (Array.isArray(res?.results)) { return res.results; }
    if (Array.isArray(res?.data)) { return res.data; }
    return [];
  }


  // ============================================================
  // LECTURA DE CELDAS
  // ============================================================

  obtenerIdItem(item: any): number {
    return item?.[this.tab.idField] ?? item?.id;
  }

  opcionesDe(campo: CampoConfig): OpcionRelacion[] {
    return campo.source ? this.opciones[campo.source] : [];
  }

  valorCelda(item: any, campo: CampoConfig): string {
    const valor = item?.[campo.name];

    if (campo.type === 'select' && campo.source) {
      const opcion = this.opciones[campo.source].find(
        o => String(o.id) === String(valor)
      );
      return opcion?.label || '—';
    }

    if (valor === undefined || valor === null || valor === '') {
      return '—';
    }

    // El backend devuelve "07:30:00"; mostramos "07:30".
    if (campo.type === 'time') {
      return String(valor).slice(0, 5);
    }

    return String(valor);
  }

  trackPorId = (indice: number, item: any) =>
    this.obtenerIdItem(item) ?? indice;


  // ============================================================
  // MODAL
  // ============================================================

  abrirModal(item?: any): void {
    this.modoEdicion = !!item;
    this.itemSeleccionadoId = item ? this.obtenerIdItem(item) : null;

    const form: any = {};
    for (const campo of this.tab.campos) {
      let valor = item ? item[campo.name] : null;

      if (campo.type === 'time' && valor) {
        valor = String(valor).slice(0, 5);
      }
      form[campo.name] = valor ?? (campo.type === 'select' ? null : '');
    }

    this.itemForm = form;
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.modoEdicion = false;
    this.guardando = false;
    this.itemForm = {};
    this.itemSeleccionadoId = null;
  }


  // ============================================================
  // VALIDACIÓN Y ARMADO DEL CUERPO
  // ============================================================

  private validarFormulario(): boolean {
    for (const campo of this.tab.campos) {
      const valor = this.itemForm[campo.name];
      const vacio =
        valor === undefined ||
        valor === null ||
        String(valor).trim() === '';

      if (campo.required && vacio) {
        this.sweetAlert.warning(
          'Campos incompletos',
          `El campo "${campo.label}" es obligatorio.`
        );
        return false;
      }

      if (campo.type === 'number' && !vacio && !(Number(valor) > 0)) {
        this.sweetAlert.warning(
          'Valor no válido',
          `"${campo.label}" debe ser un número mayor que 0.`
        );
        return false;
      }
    }
    return true;
  }

  /** Envía solo los campos de la tabla, con el tipo correcto. */
  private construirCuerpo(): any {
    const cuerpo: any = {};

    for (const campo of this.tab.campos) {
      const valor = this.itemForm[campo.name];

      if (campo.type === 'number') {
        cuerpo[campo.name] = Number(valor);
      } else if (campo.type === 'select') {
        cuerpo[campo.name] = valor === null || valor === '' ? null : valor;
      } else {
        cuerpo[campo.name] = String(valor ?? '').trim();
      }
    }
    return cuerpo;
  }


  // ============================================================
  // GUARDAR
  // ============================================================

  guardar(): void {
    if (this.guardando || !this.validarFormulario()) {
      return;
    }

    const cuerpo = this.construirCuerpo();
    const editando = this.modoEdicion && this.itemSeleccionadoId !== null;

    this.guardando = true;

    const peticion$ = editando
      ? this.bancoDatosService.actualizarDato(
        this.tabActual,
        this.itemSeleccionadoId as number,
        cuerpo
      )
      : this.bancoDatosService.crearDato(this.tabActual, cuerpo);

    peticion$.subscribe({
      next: () => {
        this.sweetAlert.success(
          editando ? 'Cambios guardados' : 'Registro creado',
          editando
            ? 'El registro se actualizó correctamente.'
            : 'El registro se creó correctamente.'
        );
        this.cerrarModal();
        this.cargarDatos();
        this.refrescarFuenteSiAplica();
      },
      error: (err: any) => {
        console.error(editando ? 'Error al actualizar:' : 'Error al crear:', err);
        this.guardando = false;
        this.sweetAlert.error(
          editando ? 'No se pudo guardar' : 'No se pudo crear',
          this.mensajeError(err, 'Hubo un problema al guardar el registro.')
        );
        this.cdr.detectChanges();
      }
    });
  }


  // ============================================================
  // ELIMINAR
  // ============================================================

  eliminar(item: any): void {
    const id = this.obtenerIdItem(item);

    if (id === undefined || id === null) {
      this.sweetAlert.error('Error', 'No se pudo identificar el registro.');
      return;
    }

    this.sweetAlert
      .confirm(
        '¿Eliminar registro?',
        'Esta acción no se puede deshacer. El registro será eliminado permanentemente.',
        'Sí, eliminar'
      )
      .then((res: any) => {
        if (!res?.isConfirmed) {
          return;
        }

        this.bancoDatosService.eliminarDato(this.tabActual, id).subscribe({
          next: () => {
            this.sweetAlert.success(
              'Registro eliminado',
              'El registro se eliminó correctamente.'
            );
            this.cargarDatos();
            this.refrescarFuenteSiAplica();
          },
          error: (err: any) => {
            console.error('Error al eliminar:', err);
            const enUso = err?.status === 409 || err?.status === 500;
            this.sweetAlert.error(
              'No se pudo eliminar',
              enUso
                ? 'Es probable que este registro esté en uso en contratos, menús o inventario.'
                : this.mensajeError(err, 'No se pudo eliminar el registro.')
            );
          }
        });
      });
  }


  // ============================================================
  // MENSAJES DE ERROR LEGIBLES (incluye lo que responde Django)
  // ============================================================

  private mensajeError(err: any, porDefecto: string): string {
    if (err?.status === 0) {
      return 'No hay conexión con el servidor. Si el backend está en Render, puede estar despertando: espera unos segundos e inténtalo de nuevo.';
    }
    if (err?.status === 401) {
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    }
    if (err?.status === 403) {
      return 'Tu usuario no tiene permiso para esta acción.';
    }
    if (err?.status === 404) {
      return `El servidor no encontró el recurso "${this.tabActual}". Revisa la URL en BancoDatosService.`;
    }

    const cuerpo = err?.error;

    // Errores de validación de DRF: { campo: ["mensaje"] }
    if (cuerpo && typeof cuerpo === 'object') {
      const lineas = Object.entries(cuerpo).map(([campo, msg]) => {
        const texto = Array.isArray(msg) ? msg.join(' ') : String(msg);
        return campo === 'detail' || campo === 'non_field_errors'
          ? texto
          : `${campo}: ${texto}`;
      });
      if (lineas.length) {
        return lineas.join('\n');
      }
    }

    return porDefecto;
  }
}
