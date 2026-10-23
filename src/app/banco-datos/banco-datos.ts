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
import { CustomSelectComponent } from '../shared/custom-select/custom-select';


// ============================================================
// TIPOS DE CONFIGURACIÓN
// ============================================================

type TipoCampo = 'text' | 'textarea' | 'number' | 'time' | 'select';

/** Tablas que alimentan listas desplegables de otras tablas. */
type FuenteRelacion = 'jornadas' | 'unidades_medida' | 'ingredientes' | 'categorias_inventario' | 'grados' | 'instituciones';

interface CampoConfig {
  name: string;
  label: string;
  type: TipoCampo;
  required?: boolean;
  placeholder?: string;
  /** Solo para type = 'select': de qué tabla salen las opciones. */
  source?: FuenteRelacion;
  options?: OpcionRelacion[];
  defaultValue?: any;
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
  instituciones: {
    id: 'id_institucion',
    etiqueta: r => r.nombre_institucion ?? r.nombre ?? ''
  },
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
  imports: [CommonModule, FormsModule, CustomSelectComponent],
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
      id: 'instituciones',
      nombre: 'Instituciones',
      singular: 'institución',
      icon: 'apartment',
      idField: 'id_institucion',
      campos: [
        { name: 'nombre_institucion', label: 'Nombre Institución', type: 'text', required: true, placeholder: 'Ej: I.E. San Agustín' },
        { name: 'nit', label: 'NIT / Código', type: 'text', required: true, placeholder: 'Ej: 900.123.456-7' },
        { name: 'representante_legal', label: 'Representante Legal', type: 'text', placeholder: 'Ej: Carlos Gómez' },
        { name: 'telefono', label: 'Teléfono', type: 'text', placeholder: 'Ej: 300 123 4567' },
        { name: 'correo_contacto', label: 'Correo de contacto', type: 'text', placeholder: 'Ej: rectoria@iesanagustin.edu.co' },
        {
          name: 'estado',
          label: 'Estado',
          type: 'select',
          required: true,
          defaultValue: 'ACTIVO',
          options: [
            { id: 'ACTIVO', label: 'Activo' },
            { id: 'INACTIVO', label: 'Inactivo' }
          ]
        }
      ]
    },
    {
      id: 'sedes',
      nombre: 'Sedes',
      singular: 'sede',
      icon: 'domain',
      idField: 'id_sede',
      campos: [
        { name: 'nombre_sede', label: 'Nombre de la Sede', type: 'text', required: true, placeholder: 'Ej: Sede Principal' },
        { name: 'id_institucion', label: 'Institución Educativa', type: 'select', required: true, source: 'instituciones' },
        { name: 'codigo_dane', label: 'Código DANE', type: 'text', placeholder: 'Ej: 105001000123' },
        { name: 'direccion', label: 'Dirección', type: 'text', placeholder: 'Ej: Carrera 45 # 12-34' },
        { name: 'telefono', label: 'Teléfono', type: 'text', placeholder: 'Ej: 604 123 4567' },
        {
          name: 'estado',
          label: 'Estado',
          type: 'select',
          required: true,
          defaultValue: 'ACTIVO',
          options: [
            { id: 'ACTIVO', label: 'Activo' },
            { id: 'INACTIVO', label: 'Inactivo' }
          ]
        }
      ]
    },
    {
      id: 'ingredientes',
      nombre: 'Ingredientes',
      singular: 'ingrediente',
      icon: 'kitchen',
      idField: 'id_ingrediente',
      campos: [
        { name: 'nombre_ingrediente', label: 'Nombre del ingrediente', type: 'text', required: true, placeholder: 'Ej: Tomate Chonto' },
        { name: 'id_categoria_inventario', label: 'Categoría', type: 'select', required: true, source: 'categorias_inventario' },
        { name: 'id_unidad_medida', label: 'Unidad de medida', type: 'select', required: true, source: 'unidades_medida' },
        { name: 'marca_ingrediente', label: 'Marca', type: 'text', required: false, placeholder: 'Ej: San Jorge' },
        {
          name: 'tipo_conservacion',
          label: 'Tipo de conservación',
          type: 'select',
          required: true,
          defaultValue: 'perecedero',
          options: [
            { id: 'perecedero', label: 'Perecedero' },
            { id: 'no_perecedero', label: 'No perecedero' }
          ]
        },
        { name: 'descripcion', label: 'Descripción', type: 'textarea', required: false, placeholder: 'Notas o especificaciones de calidad' }
      ]
    },
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
      id: 'categorias_inventario',
      nombre: 'Categorías',
      singular: 'categoría',
      icon: 'category',
      idField: 'id_categoria_inventario',
      campos: [
        { name: 'nombre_categoria', label: 'Nombre categoría', type: 'text', required: true, placeholder: 'Ej: Lácteos' }
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

  tabActual: string = 'instituciones';

  datos: any[] = [];
  cargando = false;
  /** Mensaje cuando la carga FALLA (distinto de "no hay registros"). */
  errorCarga: string | null = null;

  /** Filtro opcional por institución cuando se visualiza la pestaña de sedes */
  filtroInstitucionSede: any = 'TODAS';

  modalSeleccionarInstitucionAbierto = false;
  busquedaInstitucionModal = '';
  institucionTemporalId: any = 'TODAS';
  institucionesCompletas: any[] = [];

  extraerIdInstitucion(item: any): any {
    if (item === null || item === undefined || item === 'TODAS') return 'TODAS';
    if (typeof item === 'object') {
      return item.id_institucion ?? item.id;
    }
    return item;
  }

  get nombreInstitucionSedeSeleccionada(): string {
    if (this.filtroInstitucionSede === 'TODAS' || !this.filtroInstitucionSede) {
      return `Todas las instituciones (${this.datos?.length || 0} sedes)`;
    }
    const instCompleta = this.institucionesCompletas.find(i => {
      const id = i.id_institucion ?? i.id;
      return String(id) === String(this.filtroInstitucionSede);
    });
    if (instCompleta) {
      return instCompleta.nombre_institucion || instCompleta.nombre || instCompleta.label;
    }
    const instOpcion = this.opciones['instituciones']?.find(i => String(i.id) === String(this.filtroInstitucionSede));
    return instOpcion ? instOpcion.label : 'Institución seleccionada';
  }

  abrirModalInstitucionSede(): void {
    this.busquedaInstitucionModal = '';
    this.institucionTemporalId = this.filtroInstitucionSede;
    this.modalSeleccionarInstitucionAbierto = true;
  }

  cerrarModalInstitucionSede(): void {
    this.modalSeleccionarInstitucionAbierto = false;
  }

  marcarInstitucionSede(item: any): void {
    this.institucionTemporalId = this.extraerIdInstitucion(item);
  }

  seleccionarInstitucionSede(item: any): void {
    this.filtroInstitucionSede = this.extraerIdInstitucion(item);
    this.modalSeleccionarInstitucionAbierto = false;
  }

  confirmarSeleccionInstitucionSede(): void {
    this.filtroInstitucionSede = this.institucionTemporalId;
    this.modalSeleccionarInstitucionAbierto = false;
  }

  limpiarFiltroInstitucionSede(event?: Event): void {
    if (event) event.stopPropagation();
    this.filtroInstitucionSede = 'TODAS';
  }

  esInstitucionMarcada(item: any): boolean {
    const id = this.extraerIdInstitucion(item);
    return String(this.institucionTemporalId) === String(id) ||
           String(this.filtroInstitucionSede) === String(id);
  }

  get institucionesFiltradasModal(): any[] {
    const q = this.busquedaInstitucionModal.trim().toLowerCase();
    const insts = this.institucionesCompletas.length > 0
      ? this.institucionesCompletas
      : (this.opciones['instituciones'] || []);

    if (!q) return insts;
    return insts.filter((i: any) => {
      const nombre = (i.nombre_institucion || i.nombre || i.label || '').toLowerCase();
      const nit = (i.nit || '').toLowerCase();
      return nombre.includes(q) || nit.includes(q);
    });
  }

  obtenerSedesDeInstEnBanco(inst: any): number {
    const instId = inst?.id_institucion || inst?.id;
    if (!this.datos || this.tabActual !== 'sedes') return 0;
    return this.datos.filter(s => {
      const sId = typeof s.id_institucion === 'object' && s.id_institucion !== null
        ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
        : s.id_institucion;
      return String(sId) === String(instId);
    }).length;
  }

  get opcionesFiltroInstitucion(): OpcionRelacion[] {
    const list: OpcionRelacion[] = [
      { id: 'TODAS', label: `Todas las instituciones (${this.datos?.length || 0})` }
    ];
    if (this.opciones['instituciones']) {
      list.push(...this.opciones['instituciones']);
    }
    return list;
  }

  opciones: Record<string, OpcionRelacion[]> = {
    instituciones: [],
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
    this.cargarFuente('instituciones');
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

  get datosFiltrados(): any[] {
    if (this.tabActual === 'sedes' && this.filtroInstitucionSede && this.filtroInstitucionSede !== 'TODAS') {
      return this.datos.filter(item => {
        const instId = typeof item.id_institucion === 'object' && item.id_institucion !== null
          ? (item.id_institucion.id_institucion ?? item.id_institucion.id)
          : item.id_institucion;
        return String(instId) === String(this.filtroInstitucionSede);
      });
    }
    return this.datos;
  }

  cambiarTab(tabId: string): void {
    if (this.tabActual === tabId) {
      return;
    }
    this.tabActual = tabId;
    this.cargarDatos();
  }

  navegarASedesDeInstitucion(idInstitucion: number): void {
    this.filtroInstitucionSede = idInstitucion;
    this.tabActual = 'sedes';
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
          if (this.tabActual === 'instituciones') {
            this.institucionesCompletas = this.datos;
          }
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
        const items = this.normalizarRespuesta(res);
        if (fuente === 'instituciones') {
          this.institucionesCompletas = items;
        }
        this.opciones[fuente] = items.map(r => ({
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
    if (
      this.tabActual === 'instituciones' ||
      this.tabActual === 'jornadas' ||
      this.tabActual === 'unidades_medida' ||
      this.tabActual === 'ingredientes' ||
      this.tabActual === 'categorias_inventario' ||
      this.tabActual === 'grados'
    ) {
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
    if (campo.options && campo.options.length > 0) {
      return campo.options;
    }
    return campo.source ? this.opciones[campo.source] : [];
  }

  valorCelda(item: any, campo: CampoConfig): string {
    const valor = item?.[campo.name];

    if (campo.type === 'select') {
      if (campo.options && campo.options.length > 0) {
        const opcion = campo.options.find(o => String(o.id) === String(valor));
        return opcion?.label || (valor ? String(valor) : '—');
      }

      if (campo.source) {
        const opcion = this.opciones[campo.source]?.find(
          o => String(o.id) === String(valor)
        );
        // Fallback para sedes: si Django serializó institucion_nombre directamente
        if (!opcion && campo.name === 'id_institucion' && item?.institucion_nombre) {
          return item.institucion_nombre;
        }
        return opcion?.label || (valor ? String(valor) : '—');
      }
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

      // Si el backend envió un objeto ForeignKey:
      if (typeof valor === 'object' && valor !== null) {
        valor = valor[campo.name] ?? valor.id ?? valor;
      }

      if (!item && campo.defaultValue !== undefined) {
        valor = campo.defaultValue;
      }

      // Si estamos en sedes y hay un filtro de institución activo, preseleccionar esa institución
      if (!item && campo.name === 'id_institucion' && this.filtroInstitucionSede && this.filtroInstitucionSede !== 'TODAS') {
        valor = Number(this.filtroInstitucionSede);
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
        cuerpo[campo.name] = (valor === '' || valor === null) ? null : Number(valor);
      } else if (campo.type === 'select') {
        if (valor === null || valor === '') {
          cuerpo[campo.name] = null;
        } else if (campo.source) {
          const num = Number(valor);
          cuerpo[campo.name] = isNaN(num) ? valor : num;
        } else {
          cuerpo[campo.name] = valor;
        }
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
