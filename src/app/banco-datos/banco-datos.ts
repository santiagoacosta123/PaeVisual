import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { BancoDatosService } from '../services/banco-datos.service';
import { SweetAlertService } from '../sweet-alert.service';
import { CustomSelectComponent } from '../shared/custom-select/custom-select';


// ============================================================
// TIPOS DE CONFIGURACIÓN
// ============================================================

type TipoCampo = 'text' | 'textarea' | 'number' | 'time' | 'select';

/** Tablas que alimentan listas desplegables de otras tablas. */
type FuenteRelacion = 'jornadas' | 'unidades_medida' | 'ingredientes' | 'categorias_inventario' | 'grados' | 'instituciones' | 'secciones_menu';

export interface IngredienteComponenteReceta {
  id_ingrediente: number;
  nombre_ingrediente: string;
  unidad?: string;
  observacion?: string;
}

export interface PasoPreparacionReceta {
  numero_paso: number;
  descripcion_paso: string;
}

export interface ComponentePlatoReceta {
  id_temporal: string;
  tipo_componente: string;
  nombre_componente: string;
  ingredientes: IngredienteComponenteReceta[];
  pasos: PasoPreparacionReceta[];
  ingredienteTempId?: any;
  observacionTemp?: string;
}

export interface RecetaMenuExtendida {
  id_plato?: number;
  nombre_plato: string;
  semana: string;
  numero_menu?: number | null;
  secciones: string[]; // ['Desayuno', 'Almuerzo', 'Merienda']
  imagen_url: string;
  informacion_nutricional: string;
  estado: string;
  componentes: ComponentePlatoReceta[];
}

export interface PlantillaMenuPAE {
  numero_menu: number;
  semana: string;
  nombre_plato: string;
  secciones: string[];
  componentes: { tipo_componente: string; nombre_componente: string }[];
}

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
  categoria?: 'institucional' | 'inventario' | 'operacion';
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
  },
  secciones_menu: {
    id: 'id_seccion',
    etiqueta: r => r.nombre_seccion ?? r.nombre ?? ''
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
      icon: 'account_balance',
      idField: 'id_institucion',
      categoria: 'institucional',
      campos: [
        { name: 'nombre_institucion', label: 'Nombre de la institución', type: 'text', required: true, placeholder: 'Ej: I.E. San Agustín' },
        { name: 'nit', label: 'NIT / Código', type: 'text', required: true, placeholder: 'Ej: 900.123.456-7' },
        { name: 'representante_legal', label: 'Representante legal', type: 'text', placeholder: 'Ej: Carlos Gómez' },
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
      icon: 'location_on',
      idField: 'id_sede',
      categoria: 'institucional',
      campos: [
        { name: 'nombre_sede', label: 'Nombre de la sede', type: 'text', required: true, placeholder: 'Ej: Sede Principal' },
        { name: 'id_institucion', label: 'Institución educativa', type: 'select', required: true, source: 'instituciones' },
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
      icon: 'eco',
      idField: 'id_ingrediente',
      categoria: 'inventario',
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
      id: 'proveedores',
      nombre: 'Proveedores',
      singular: 'proveedor',
      icon: 'local_shipping',
      idField: 'id_proveedor',
      categoria: 'inventario',
      campos: [
        { name: 'nombre', label: 'Razón social / Proveedor', type: 'text', required: true, placeholder: 'Ej: Distribuidora Mayorista S.A.S' },
        { name: 'nit', label: 'NIT / Cédula', type: 'text', placeholder: 'Ej: 900.123.456-7' },
        { name: 'telefono', label: 'Teléfono', type: 'text', placeholder: 'Ej: 310 123 4567' },
        { name: 'correo', label: 'Correo electrónico', type: 'text', placeholder: 'ventas@proveedor.com' },
        { name: 'direccion', label: 'Dirección', type: 'text', placeholder: 'Ej: Calle 15 # 45-20' },
        { name: 'contacto', label: 'Persona de contacto', type: 'text', placeholder: 'Ej: Andrés Gómez' },
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
      id: 'unidades_medida',
      nombre: 'Unidades de medida',
      singular: 'unidad de medida',
      icon: 'balance',
      idField: 'id_unidad_medida',
      categoria: 'inventario',
      campos: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Kilogramo' },
        { name: 'abreviatura', label: 'Abreviatura', type: 'text', required: true, placeholder: 'Ej: kg' }
      ]
    },
    {
      id: 'categorias_inventario',
      nombre: 'Categorías',
      singular: 'categoría',
      icon: 'grid_view',
      idField: 'id_categoria_inventario',
      categoria: 'inventario',
      campos: [
        { name: 'nombre_categoria', label: 'Nombre categoría', type: 'text', required: true, placeholder: 'Ej: Lácteos' }
      ]
    },
    {
      id: 'tipos_mercado',
      nombre: 'Tipos de mercado',
      singular: 'tipo de mercado',
      icon: 'shopping_basket',
      idField: 'id_tipo_mercado',
      categoria: 'inventario',
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
      categoria: 'operacion',
      campos: [
        { name: 'nombre_grado', label: 'Nombre del grado', type: 'text', required: true, placeholder: 'Ej: Primero' }
      ]
    },
    {
      id: 'jornadas',
      nombre: 'Jornadas',
      singular: 'jornada',
      icon: 'calendar_month',
      idField: 'id_jornada',
      categoria: 'operacion',
      campos: [
        { name: 'nombre_jornada', label: 'Nombre de la jornada', type: 'text', required: true, placeholder: 'Ej: Mañana' }
      ]
    },
    {
      id: 'secciones_menu',
      nombre: 'Secciones',
      singular: 'sección',
      icon: 'lunch_dining',
      idField: 'id_seccion',
      categoria: 'operacion',
      campos: [
        { name: 'nombre_seccion', label: 'Nombre de la sección', type: 'text', required: true, placeholder: 'Ej: Desayuno' },
        { name: 'id_jornada', label: 'Jornada', type: 'select', required: true, source: 'jornadas' }
      ]
    },
    {
      id: 'menus',
      nombre: 'Platos y Recetas',
      singular: 'plato',
      icon: 'restaurant_menu',
      idField: 'id_plato',
      categoria: 'operacion',
      campos: [
        { name: 'nombre_plato', label: 'Nombre del Plato', type: 'text', required: true, placeholder: 'Ej: Menú 1: Pericos con arroz' },
        { name: 'componente', label: 'Componentes del plato', type: 'text', required: true },
        { name: 'resumen_receta', label: 'Ingredientes y preparación', type: 'text' }
      ]
    },
    {
      id: 'turnos',
      nombre: 'Turnos',
      singular: 'turno',
      icon: 'schedule',
      idField: 'id_turno',
      categoria: 'operacion',
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
      icon: 'shield',
      idField: 'id_rol',
      categoria: 'operacion',
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
      idField: 'id_gramaje',
      categoria: 'inventario',
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
  tabActual: string = 'instituciones';

  // ============================================================
  // ORGANIZACIÓN Y DESPLEGABLE DE TABLAS PRINCIPALES
  // ============================================================
  tablasDesplegadas: boolean = false;
  filtroBusquedaTablas: string = '';
  filtroCategoriaTablas: 'TODAS' | 'institucional' | 'inventario' | 'operacion' = 'TODAS';

  toggleDesplegableTablas(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.tablasDesplegadas = !this.tablasDesplegadas;
  }

  seleccionarTab(tabId: string): void {
    this.cambiarTab(tabId);
    this.tablasDesplegadas = false;
  }

  get tabsFiltradas(): TabConfig[] {
    const q = this.filtroBusquedaTablas.trim().toLowerCase();
    if (!q) return this.tabs;
    return this.tabs.filter(t =>
      t.nombre.toLowerCase().includes(q) || t.singular.toLowerCase().includes(q)
    );
  }

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
    grados: [],
    secciones_menu: []
  };

  ingredientesCompletos: any[] = [];
  unidadesMedidaCompletas: any[] = [];

  // ============================================================
  // ESTADO Y CATÁLOGO DE MENÚS / PLATOS (CICLO PAE 4 SEMANAS)
  // ============================================================
  private readonly STORAGE_RECETARIO_KEY = 'sirae_recetario_menus_v1';
  private readonly STORAGE_COMP_CATALOGO_KEY = 'sirae_catalogo_componentes_pae_v1';

  filtroSemanaMenu: string = 'TODAS';
  filtroSeccionMenu: string = 'TODAS';
  plantillaMenuSeleccionada: any = '';
  sincronizandoMinuta = false;

  modalVerRecetaAbierto = false;
  recetaDetalleSeleccionada: any = null;
  archivoImagenPlatoSeleccionado: File | null = null;

  readonly seccionesDisponiblesMenu: { id: string; label: string; icon: string }[] = [
    { id: 'Desayuno', label: 'Desayuno', icon: 'wb_twilight' },
    { id: 'Almuerzo', label: 'Almuerzo', icon: 'lunch_dining' },
    { id: 'Merienda', label: 'Merienda', icon: 'bakery_dining' }
  ];

  readonly semanasCicloOpciones: { id: string; label: string }[] = [
    { id: 'Semana 1', label: 'Semana 1 (Menús 1 - 5)' },
    { id: 'Semana 2', label: 'Semana 2 (Menús 6 - 10)' },
    { id: 'Semana 3', label: 'Semana 3 (Menús 11 - 15)' },
    { id: 'Semana 4', label: 'Semana 4 (Menús 16 - 20)' },
    { id: 'General', label: 'General / Todas las semanas' }
  ];

  readonly tiposComponentePAE: { id: string; label: string }[] = [
    { id: 'Bebida con leche', label: 'Bebida con leche' },
    { id: 'Alimento proteico', label: 'Alimento proteico' },
    { id: 'Cereal acompañante', label: 'Cereal acompañante' },
    { id: 'Sopa / Principio', label: 'Sopa / Principio' },
    { id: 'Fruta', label: 'Fruta' },
    { id: 'Agua', label: 'Agua' }
  ];

  readonly MINUTA_PAE_OFICIAL: PlantillaMenuPAE[] = [
    // SEMANA 1
    {
      numero_menu: 1,
      semana: 'Semana 1',
      nombre_plato: 'Menú 1: Pericos con arroz',
      secciones: ['Desayuno', 'Almuerzo', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Refresco de avena' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Huevos pericos' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz blanco' },
        { tipo_componente: 'Agua', nombre_componente: 'Agua potable' }
      ]
    },
    {
      numero_menu: 2,
      semana: 'Semana 1',
      nombre_plato: 'Menú 2: Pollo en salsa blanca con pasta',
      secciones: ['Desayuno', 'Almuerzo', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Jugo de fruta en leche' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Pollo en salsa blanca' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Pasta' }
      ]
    },
    {
      numero_menu: 3,
      semana: 'Semana 1',
      nombre_plato: 'Menú 3: Arepa con chocolate',
      secciones: ['Desayuno', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Chocolate en leche' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arepa de maíz' },
        { tipo_componente: 'Fruta', nombre_componente: 'Banano' }
      ]
    },
    {
      numero_menu: 4,
      semana: 'Semana 1',
      nombre_plato: 'Menú 4: Lentejas con arroz',
      secciones: ['Almuerzo', 'Desayuno'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Jugo de fruta en leche' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Lentejas con papa guisada' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz blanco' }
      ]
    },
    {
      numero_menu: 5,
      semana: 'Semana 1',
      nombre_plato: 'Menú 5: Torta de huevo con arroz',
      secciones: ['Desayuno', 'Almuerzo', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Agua de panela en leche' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Torta de huevo' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz blanco' }
      ]
    },
    // SEMANA 2
    {
      numero_menu: 6,
      semana: 'Semana 2',
      nombre_plato: 'Menú 6: Carne guisada con arroz',
      secciones: ['Almuerzo', 'Desayuno'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Refresco de avena' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Carne de res guisada' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz blanco' }
      ]
    },
    {
      numero_menu: 7,
      semana: 'Semana 2',
      nombre_plato: 'Menú 7: Hojaldras con chocolate',
      secciones: ['Desayuno', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Chocolate en leche' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Hojaldras' },
        { tipo_componente: 'Fruta', nombre_componente: 'Papaya' },
        { tipo_componente: 'Agua', nombre_componente: 'Agua potable' }
      ]
    },
    {
      numero_menu: 8,
      semana: 'Semana 2',
      nombre_plato: 'Menú 8: Frijoles guisados con arroz',
      secciones: ['Almuerzo', 'Desayuno'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Agua de panela en leche' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Frijoles guisados con papa' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz con fideos' }
      ]
    },
    {
      numero_menu: 9,
      semana: 'Semana 2',
      nombre_plato: 'Menú 9: Galleta cuca con leche',
      secciones: ['Desayuno', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Leche' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Galleta / cuca' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Maní salado' },
        { tipo_componente: 'Fruta', nombre_componente: 'Mango' }
      ]
    },
    {
      numero_menu: 10,
      semana: 'Semana 2',
      nombre_plato: 'Menú 10: Huevos revueltos con arroz',
      secciones: ['Desayuno', 'Almuerzo', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Jugo de fruta en leche' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Huevos revueltos' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz blanco' }
      ]
    },
    // SEMANA 3
    {
      numero_menu: 11,
      semana: 'Semana 3',
      nombre_plato: 'Menú 11: Pollo guisado con arroz',
      secciones: ['Almuerzo', 'Desayuno'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Refresco de avena' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Pollo guisado' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz blanco' }
      ]
    },
    {
      numero_menu: 12,
      semana: 'Semana 3',
      nombre_plato: 'Menú 12: Lentejas guisadas con arroz',
      secciones: ['Almuerzo', 'Desayuno'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Agua de panela en leche' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Lentejas guisadas con papa' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz blanco' },
        { tipo_componente: 'Fruta', nombre_componente: 'Mango' }
      ]
    },
    {
      numero_menu: 13,
      semana: 'Semana 3',
      nombre_plato: 'Menú 13: Torta de huevo con quinua',
      secciones: ['Desayuno', 'Almuerzo', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Colada de quinua' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Torta de huevo' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz blanco' }
      ]
    },
    {
      numero_menu: 14,
      semana: 'Semana 3',
      nombre_plato: 'Menú 14: Torta pastel con yogurt',
      secciones: ['Desayuno', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Yogurt' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Torta pastel' },
        { tipo_componente: 'Fruta', nombre_componente: 'Manzana' }
      ]
    },
    {
      numero_menu: 15,
      semana: 'Semana 3',
      nombre_plato: 'Menú 15: Arroz con cerdo y verduras',
      secciones: ['Almuerzo', 'Desayuno'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Jugo de fruta en leche' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Arroz con carne de cerdo y verduras' }
      ]
    },
    // SEMANA 4
    {
      numero_menu: 16,
      semana: 'Semana 4',
      nombre_plato: 'Menú 16: Lentejas con colada de quinua',
      secciones: ['Almuerzo', 'Desayuno'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Colada de quinua' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Lentejas guisadas con papa' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz blanco' }
      ]
    },
    {
      numero_menu: 17,
      semana: 'Semana 4',
      nombre_plato: 'Menú 17: Pericos con chocolate',
      secciones: ['Desayuno', 'Almuerzo', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Chocolate en leche' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Huevos pericos' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz blanco' }
      ]
    },
    {
      numero_menu: 18,
      semana: 'Semana 4',
      nombre_plato: 'Menú 18: Arroz con leche y galletas',
      secciones: ['Desayuno', 'Merienda'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Arroz con leche y canela' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Galleta tipo crackers' },
        { tipo_componente: 'Fruta', nombre_componente: 'Mango, papaya, melón' }
      ]
    },
    {
      numero_menu: 19,
      semana: 'Semana 4',
      nombre_plato: 'Menú 19: Pollo con verduras y papas',
      secciones: ['Almuerzo', 'Desayuno'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Refresco de avena' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Pollo en julianas con verduras' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Papas en casco' }
      ]
    },
    {
      numero_menu: 20,
      semana: 'Semana 4',
      nombre_plato: 'Menú 20: Frijoles con arroz y fideos',
      secciones: ['Almuerzo', 'Desayuno'],
      componentes: [
        { tipo_componente: 'Bebida con leche', nombre_componente: 'Agua de panela en leche' },
        { tipo_componente: 'Alimento proteico', nombre_componente: 'Frijoles guisados con papa' },
        { tipo_componente: 'Cereal acompañante', nombre_componente: 'Arroz con fideos' }
      ]
    }
  ];

  get plantillasMinutaOpciones(): OpcionRelacion[] {
    return this.MINUTA_PAE_OFICIAL.map(m => ({
      id: m.numero_menu,
      label: `${m.semana} • ${m.nombre_plato}`
    }));
  }

  menuRecetaForm: RecetaMenuExtendida = this.crearMenuRecetaVacio();

  mostrarModal = false;
  modoEdicion = false;
  guardando = false;
  itemForm: any = {};
  itemSeleccionadoId: number | null = null;
  itemOriginal: any = null;

  campoBloqueado(campo: CampoConfig): boolean {
    if (this.tabActual === 'ingredientes' && this.modoEdicion && campo.name === 'id_unidad_medida') {
      return !!this.itemOriginal?.tiene_movimientos;
    }
    return false;
  }

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
    this.cargarFuente('secciones_menu');
  }

  ngOnDestroy(): void {
    this.cargaSub?.unsubscribe();
  }

  // ============================================================
  // BUSCADOR, FILTROS Y ORDENAMIENTO
  // ============================================================
  busquedaTexto: string = '';
  filtroEstado: string = '';
  readonly opcionesFiltroEstado: any[] = [
    { value: 'ACTIVO', label: 'Activo' },
    { value: 'INACTIVO', label: 'Inactivo' }
  ];
  ordenPor: string = 'recientes';
  mostrarFiltrosAvanzados: boolean = false;

  // Paginación
  elementosPorPagina: number = 8;
  paginaActual: number = 1;
  readonly opcionesElementosPorPagina: number[] = [8, 10, 20, 50];

  // Menú flotante de acciones por fila
  menuAccionAbiertoId: any = null;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalVerRecetaAbierto) {
      this.cerrarModalVerReceta();
      return;
    }
    if (this.mostrarModal) {
      this.cerrarModal();
    }
    this.cerrarMenuAccion();
    this.tablasDesplegadas = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.row-actions-container')) {
      this.cerrarMenuAccion();
    }
    if (!target.closest('.bd-top-selector-wrapper')) {
      this.tablasDesplegadas = false;
    }
  }

  get placeholderBusqueda(): string {
    if (this.tabActual === 'instituciones') {
      return 'Buscar por nombre, NIT o código...';
    }
    if (this.tabActual === 'menus') {
      return 'Ingresa el nombre del plato...';
    }
    return `Buscar en ${this.tab.nombre.toLowerCase()}...`;
  }

  obtenerTextoComponentesRestantes(componentes: any[]): string {
    if (!Array.isArray(componentes) || componentes.length <= 3) return '';
    return componentes
      .slice(3)
      .map(c => `${c.tipo_componente ? c.tipo_componente + ': ' : ''}${c.nombre_componente || ''}`.trim())
      .filter(Boolean)
      .join(', ');
  }

  toggleMenuAccion(id: any, event: Event): void {
    event.stopPropagation();
    this.menuAccionAbiertoId = this.menuAccionAbiertoId === id ? null : id;
  }

  cerrarMenuAccion(): void {
    this.menuAccionAbiertoId = null;
  }

  toggleFiltrosAvanzados(): void {
    this.mostrarFiltrosAvanzados = !this.mostrarFiltrosAvanzados;
  }

  onFiltroCambio(): void {
    this.paginaActual = 1;
    this.menuAccionAbiertoId = null;
  }

  cambiarElementosPorPagina(nuevoLimite: any): void {
    this.elementosPorPagina = Number(nuevoLimite) || 8;
    this.paginaActual = 1;
    this.menuAccionAbiertoId = null;
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
      this.menuAccionAbiertoId = null;
    }
  }

  obtenerNombrePrincipal(item: any): string {
    if (!item) return '';
    return item.nombre_plato ||
           item.nombre_institucion ||
           item.nombre_sede ||
           item.nombre_ingrediente ||
           item.nombre_categoria ||
           item.nombre_tipo ||
           item.nombre_grado ||
           item.nombre_jornada ||
           item.nombre_seccion ||
           item.nombre_turno ||
           item.nombre ||
           item.descripcion ||
           '';
  }

  // ============================================================
  // TAB ACTUAL Y FILTROS
  // ============================================================

  get tab(): TabConfig {
    return this.tabs.find(t => t.id === this.tabActual) ?? this.tabs[0];
  }

  get datosFiltrados(): any[] {
    let resultado = [...this.datos];

    // Filtro de sedes por institución
    if (this.tabActual === 'sedes' && this.filtroInstitucionSede && this.filtroInstitucionSede !== 'TODAS') {
      resultado = resultado.filter(item => {
        const instId = typeof item.id_institucion === 'object' && item.id_institucion !== null
          ? (item.id_institucion.id_institucion ?? item.id_institucion.id)
          : item.id_institucion;
        return String(instId) === String(this.filtroInstitucionSede);
      });
    }

    // Filtros específicos de Menús (Semana y Sección: Desayuno / Almuerzo / Merienda)
    if (this.tabActual === 'menus') {
      if (this.filtroSemanaMenu && this.filtroSemanaMenu !== 'TODAS') {
        resultado = resultado.filter(item => (item?.semana || 'General') === this.filtroSemanaMenu);
      }
      if (this.filtroSeccionMenu && this.filtroSeccionMenu !== 'TODAS') {
        resultado = resultado.filter(item => {
          const secs: string[] = Array.isArray(item?.secciones) ? item.secciones : [];
          return secs.some(s => s.toLowerCase() === this.filtroSeccionMenu.toLowerCase());
        });
      }
    }

    // Filtro por texto de búsqueda
    if (this.busquedaTexto && this.busquedaTexto.trim()) {
      const q = this.busquedaTexto.trim().toLowerCase();
      resultado = resultado.filter(item => {
        return Object.values(item).some(val => {
          if (val === null || val === undefined) return false;
          if (typeof val === 'object') {
            return JSON.stringify(val).toLowerCase().includes(q);
          }
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    // Filtro por Estado
    if (this.filtroEstado && this.filtroEstado !== 'TODOS') {
      resultado = resultado.filter(item => {
        if (this.filtroEstado === 'ACTIVO') {
          return this.isEstadoActivo(item);
        } else if (this.filtroEstado === 'INACTIVO') {
          return this.isEstadoInactivo(item);
        }
        return true;
      });
    }

    // Ordenamiento
    if (this.ordenPor === 'az') {
      resultado.sort((a, b) => {
        const valA = String(this.obtenerNombrePrincipal(a)).toLowerCase();
        const valB = String(this.obtenerNombrePrincipal(b)).toLowerCase();
        return valA.localeCompare(valB, 'es');
      });
    } else if (this.ordenPor === 'za') {
      resultado.sort((a, b) => {
        const valA = String(this.obtenerNombrePrincipal(a)).toLowerCase();
        const valB = String(this.obtenerNombrePrincipal(b)).toLowerCase();
        return valB.localeCompare(valA, 'es');
      });
    } else if (this.tabActual === 'menus') {
      resultado.sort((a, b) => {
        const numA = a?.numero_menu ?? 999;
        const numB = b?.numero_menu ?? 999;
        if (numA !== numB) return numA - numB;
        const idA = this.obtenerIdItem(a) || 0;
        const idB = this.obtenerIdItem(b) || 0;
        return idA - idB;
      });
    } else {
      // Más recientes: ordenar por ID descendente si existe
      resultado.sort((a, b) => {
        const idA = this.obtenerIdItem(a) || 0;
        const idB = this.obtenerIdItem(b) || 0;
        return idB - idA;
      });
    }

    return resultado;
  }

  get totalRegistros(): number {
    return this.datosFiltrados.length;
  }

  get totalPaginas(): number {
    return Math.ceil(this.totalRegistros / this.elementosPorPagina) || 1;
  }

  get datosPaginados(): any[] {
    const inicio = (this.paginaActual - 1) * this.elementosPorPagina;
    return this.datosFiltrados.slice(inicio, inicio + this.elementosPorPagina);
  }

  get registroInicio(): number {
    if (this.totalRegistros === 0) return 0;
    return (this.paginaActual - 1) * this.elementosPorPagina + 1;
  }

  get registroFin(): number {
    return Math.min(this.paginaActual * this.elementosPorPagina, this.totalRegistros);
  }

  get listaPaginas(): number[] {
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    const paginas: number[] = [];

    if (total <= 5) {
      for (let i = 1; i <= total; i++) paginas.push(i);
    } else {
      let inicio = Math.max(1, actual - 2);
      let fin = Math.min(total, inicio + 4);
      if (fin - inicio < 4) {
        inicio = Math.max(1, fin - 4);
      }
      for (let i = inicio; i <= fin; i++) paginas.push(i);
    }
    return paginas;
  }

  esCampoEstado(campo: CampoConfig): boolean {
    return campo.name.toLowerCase().includes('estado');
  }

  isEstadoActivo(item: any, campo?: CampoConfig): boolean {
    const val = campo ? item?.[campo.name] : (item?.estado ?? item?.activo);
    if (val === true || val === 1) return true;
    const str = String(val ?? '').trim().toUpperCase();
    return str === 'ACTIVO' || str === 'TRUE' || str === '1' || str === 'SI';
  }

  isEstadoInactivo(item: any, campo?: CampoConfig): boolean {
    const val = campo ? item?.[campo.name] : (item?.estado ?? item?.activo);
    if (val === false || val === 0) return true;
    const str = String(val ?? '').trim().toUpperCase();
    return str === 'INACTIVO' || str === 'FALSE' || str === '0' || str === 'NO';
  }

  cambiarTab(tabId: string): void {
    if (this.tabActual === tabId) {
      return;
    }
    this.tabActual = tabId;
    this.busquedaTexto = '';
    this.filtroEstado = '';
    this.ordenPor = 'recientes';
    this.paginaActual = 1;
    this.menuAccionAbiertoId = null;
    this.cargarDatos();
  }

  navegarASedesDeInstitucion(idInstitucion: number): void {
    this.filtroInstitucionSede = idInstitucion;
    this.tabActual = 'sedes';
    this.busquedaTexto = '';
    this.filtroEstado = '';
    this.paginaActual = 1;
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
          const crudos = this.normalizarRespuesta(res);
          if (this.tabActual === 'instituciones') {
            this.institucionesCompletas = crudos;
          }
          if (this.tabActual === 'menus') {
            const requiereLimpiezaEjemplos = this.detectarPlatosEjemploAntiguos(crudos);
            if (requiereLimpiezaEjemplos && !this.sincronizandoMinuta) {
              this.reemplazarPlatosEjemploEnBackend(crudos);
              return;
            }
            this.datos = this.ordenarPlatosPAE(
              crudos.map(plato => this.enriquecerPlatoConReceta(plato))
            );
          } else {
            this.datos = crudos;
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
        if (fuente === 'ingredientes') {
          this.ingredientesCompletos = items;
        }
        if (fuente === 'unidades_medida') {
          this.unidadesMedidaCompletas = items;
        }
        this.opciones[fuente] = items.map(r => ({
          id: r[cfg.id] ?? r.id,
          label: cfg.etiqueta(r)
        }));
        if (this.tabActual === 'menus' && this.datos.length > 0 && fuente === 'secciones_menu') {
          this.datos = this.datos.map(plato => this.enriquecerPlatoConReceta(plato));
        }
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
      this.tabActual === 'grados' ||
      this.tabActual === 'secciones_menu'
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
    this.itemOriginal = item ? { ...item } : null;

    if (this.tabActual === 'menus') {
      this.plantillaMenuSeleccionada = '';
      if (item) {
        const enriquecido = this.enriquecerPlatoConReceta(item);
        this.menuRecetaForm = {
          id_plato: enriquecido.id_plato,
          nombre_plato: enriquecido.nombre_plato || '',
          semana: enriquecido.semana || 'Semana 1',
          numero_menu: enriquecido.numero_menu ?? null,
          secciones: Array.isArray(enriquecido.secciones) && enriquecido.secciones.length > 0
            ? [...enriquecido.secciones]
            : ['Desayuno', 'Almuerzo'],
          imagen_url: enriquecido.imagen_url || '',
          informacion_nutricional: enriquecido.informacion_nutricional || '',
          estado: enriquecido.estado || 'ACTIVO',
          componentes: Array.isArray(enriquecido.componentes) && enriquecido.componentes.length > 0
            ? enriquecido.componentes.map((c: ComponentePlatoReceta) => ({
                id_temporal: c.id_temporal || this.generarIdTemp(),
                tipo_componente: c.tipo_componente || 'Alimento proteico',
                nombre_componente: c.nombre_componente || '',
                ingredientes: Array.isArray(c.ingredientes) ? c.ingredientes.map(i => ({ ...i })) : [],
                pasos: Array.isArray(c.pasos) ? c.pasos.map((p, idx) => ({ numero_paso: idx + 1, descripcion_paso: p.descripcion_paso })) : [],
                ingredienteTempId: null,
                observacionTemp: ''
              }))
            : [this.crearComponenteVacio('Bebida con leche')]
        };
      } else {
        this.menuRecetaForm = this.crearMenuRecetaVacio();
      }
      this.mostrarModal = true;
      this.cdr.detectChanges();
      return;
    }

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
    this.itemOriginal = null;
    this.plantillaMenuSeleccionada = '';
    this.archivoImagenPlatoSeleccionado = null;
  }


  // ============================================================
  // LÓGICA DE MENÚS, COMPONENTES, INGREDIENTES Y PREPARACIÓN
  // ============================================================

  private generarIdTemp(): string {
    return 'comp_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
  }

  crearComponenteVacio(tipo: string = 'Alimento proteico', nombre: string = ''): ComponentePlatoReceta {
    const guardado = nombre ? this.buscarComponenteEnCatalogo(nombre) : null;
    return {
      id_temporal: this.generarIdTemp(),
      tipo_componente: guardado?.tipo_componente || tipo,
      nombre_componente: nombre,
      ingredientes: guardado?.ingredientes ? guardado.ingredientes.map(i => ({ ...i })) : [],
      pasos: guardado?.pasos && guardado.pasos.length > 0
        ? guardado.pasos.map((p, idx) => ({ numero_paso: idx + 1, descripcion_paso: p.descripcion_paso }))
        : [{ numero_paso: 1, descripcion_paso: '' }],
      ingredienteTempId: null,
      observacionTemp: ''
    };
  }

  crearMenuRecetaVacio(): RecetaMenuExtendida {
    return {
      nombre_plato: '',
      semana: this.filtroSemanaMenu !== 'TODAS' ? this.filtroSemanaMenu : 'Semana 1',
      numero_menu: null,
      secciones: ['Desayuno', 'Almuerzo', 'Merienda'],
      imagen_url: '',
      informacion_nutricional: '',
      estado: 'ACTIVO',
      componentes: [
        this.crearComponenteVacio('Bebida con leche'),
        this.crearComponenteVacio('Alimento proteico'),
        this.crearComponenteVacio('Cereal acompañante')
      ]
    };
  }

  aplicarPlantillaMenuPAE(numeroMenu: any): void {
    const num = Number(numeroMenu);
    const plantilla = this.MINUTA_PAE_OFICIAL.find(m => m.numero_menu === num);
    if (!plantilla) return;

    this.menuRecetaForm.nombre_plato = plantilla.nombre_plato;
    this.menuRecetaForm.semana = plantilla.semana;
    this.menuRecetaForm.numero_menu = plantilla.numero_menu;
    this.menuRecetaForm.secciones = [...plantilla.secciones];
    this.menuRecetaForm.componentes = plantilla.componentes.map(c =>
      this.crearComponenteVacio(c.tipo_componente, c.nombre_componente)
    );
    this.cdr.detectChanges();
  }

  toggleSeccionMenu(seccionId: string): void {
    const idx = this.menuRecetaForm.secciones.indexOf(seccionId);
    if (idx >= 0) {
      if (this.menuRecetaForm.secciones.length > 1) {
        this.menuRecetaForm.secciones.splice(idx, 1);
      } else {
        this.sweetAlert.warning('Sección requerida', 'El menú/plato debe aplicar al menos a una sección (Desayuno, Almuerzo o Merienda).');
      }
    } else {
      this.menuRecetaForm.secciones.push(seccionId);
    }
  }

  esSeccionSeleccionada(seccionId: string): boolean {
    return this.menuRecetaForm.secciones.includes(seccionId);
  }

  seleccionarTodasLasSecciones(): void {
    this.menuRecetaForm.secciones = ['Desayuno', 'Almuerzo', 'Merienda'];
  }

  agregarComponenteAlPlato(): void {
    this.menuRecetaForm.componentes.push(this.crearComponenteVacio('Alimento proteico'));
  }

  eliminarComponenteDelPlato(index: number): void {
    if (this.menuRecetaForm.componentes.length <= 1) {
      this.sweetAlert.warning('Mínimo un componente', 'El plato debe tener al menos un componente registrado.');
      return;
    }
    this.menuRecetaForm.componentes.splice(index, 1);
  }

  onNombreComponenteChange(comp: ComponentePlatoReceta): void {
    if (!comp.nombre_componente || comp.ingredientes.length > 0) return;
    const guardado = this.buscarComponenteEnCatalogo(comp.nombre_componente);
    if (guardado && (guardado.ingredientes.length > 0 || guardado.pasos.length > 0)) {
      comp.ingredientes = guardado.ingredientes.map(i => ({ ...i }));
      comp.pasos = guardado.pasos.map((p, idx) => ({
        numero_paso: idx + 1,
        descripcion_paso: p.descripcion_paso
      }));
      this.cdr.detectChanges();
    }
  }

  reutilizarComponenteGuardado(comp: ComponentePlatoReceta, nombreCatalogo: string): void {
    if (!nombreCatalogo) return;
    const guardado = this.buscarComponenteEnCatalogo(nombreCatalogo);
    if (!guardado) return;
    comp.nombre_componente = guardado.nombre_componente;
    comp.tipo_componente = guardado.tipo_componente || comp.tipo_componente;
    comp.ingredientes = guardado.ingredientes.map(i => ({ ...i }));
    comp.pasos = guardado.pasos.length > 0
      ? guardado.pasos.map((p, idx) => ({ numero_paso: idx + 1, descripcion_paso: p.descripcion_paso }))
      : [{ numero_paso: 1, descripcion_paso: '' }];
    this.cdr.detectChanges();
  }

  get opcionesComponentesReutilizables(): OpcionRelacion[] {
    const catalogo = this.obtenerCatalogoComponentesLocal();
    return Object.values(catalogo).map(c => ({
      id: c.nombre_componente,
      label: `${c.nombre_componente} (${c.tipo_componente} • ${c.ingredientes.length} ingr.)`
    }));
  }

  agregarIngredienteAComponente(comp: ComponentePlatoReceta): void {
    const idIng = Number(comp.ingredienteTempId);
    if (!idIng) {
      this.sweetAlert.warning('Selecciona un ingrediente', 'Elige un ingrediente del inventario para agregarlo a este componente.');
      return;
    }
    if (comp.ingredientes.some(i => Number(i.id_ingrediente) === idIng)) {
      this.sweetAlert.warning('Ingrediente duplicado', 'Este ingrediente ya está incluido en este componente.');
      return;
    }

    const ingOp = this.opciones['ingredientes']?.find(o => Number(o.id) === idIng);
    const ingCompleto = this.ingredientesCompletos.find(i => Number(i.id_ingrediente ?? i.id) === idIng);
    let unidad = '';
    if (ingCompleto?.id_unidad_medida) {
      const um = this.unidadesMedidaCompletas.find(
        u => Number(u.id_unidad_medida ?? u.id) === Number(ingCompleto.id_unidad_medida)
      );
      unidad = um?.abreviatura || um?.nombre || '';
    }

    comp.ingredientes.push({
      id_ingrediente: idIng,
      nombre_ingrediente: ingOp?.label || ingCompleto?.nombre_ingrediente || `Ingrediente #${idIng}`,
      unidad,
      observacion: (comp.observacionTemp || '').trim()
    });

    comp.ingredienteTempId = null;
    comp.observacionTemp = '';
    this.cdr.detectChanges();
  }

  quitarIngredienteDeComponente(comp: ComponentePlatoReceta, index: number): void {
    comp.ingredientes.splice(index, 1);
  }

  agregarPasoAComponente(comp: ComponentePlatoReceta): void {
    comp.pasos.push({
      numero_paso: comp.pasos.length + 1,
      descripcion_paso: ''
    });
  }

  quitarPasoDeComponente(comp: ComponentePlatoReceta, index: number): void {
    if (comp.pasos.length <= 1) {
      comp.pasos[0].descripcion_paso = '';
      return;
    }
    comp.pasos.splice(index, 1);
    comp.pasos.forEach((p, idx) => (p.numero_paso = idx + 1));
  }

  moverPasoComponente(comp: ComponentePlatoReceta, index: number, direccion: -1 | 1): void {
    const destino = index + direccion;
    if (destino < 0 || destino >= comp.pasos.length) return;
    const temp = comp.pasos[index];
    comp.pasos[index] = comp.pasos[destino];
    comp.pasos[destino] = temp;
    comp.pasos.forEach((p, idx) => (p.numero_paso = idx + 1));
  }

  onImagenPlatoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      this.sweetAlert.warning('Imagen muy pesada', 'Selecciona una imagen menor a 2.5 MB.');
      return;
    }
    this.archivoImagenPlatoSeleccionado = file;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.menuRecetaForm.imagen_url = reader.result;
        this.cdr.detectChanges();
      }
    };
    reader.readAsDataURL(file);
  }

  abrirModalVerReceta(item: any): void {
    this.recetaDetalleSeleccionada = this.enriquecerPlatoConReceta(item);
    this.modalVerRecetaAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalVerReceta(): void {
    this.modalVerRecetaAbierto = false;
    this.recetaDetalleSeleccionada = null;
  }

  editarDesdeVistaReceta(): void {
    const item = this.recetaDetalleSeleccionada;
    this.cerrarModalVerReceta();
    if (item) {
      this.abrirModal(item);
    }
  }

  private esPlatoOficialPAE(nombrePlato: string): boolean {
    const limpio = String(nombrePlato || '').trim().toLowerCase();
    if (!limpio) return false;
    return this.MINUTA_PAE_OFICIAL.some(
      m => m.nombre_plato.trim().toLowerCase() === limpio
    );
  }

  private detectarPlatosEjemploAntiguos(crudos: any[]): boolean {
    if (!Array.isArray(crudos) || crudos.length === 0) return true;
    const tieneEjemplos = crudos.some(p => !this.esPlatoOficialPAE(p.nombre_plato));
    const cantidadOficiales = crudos.filter(p => this.esPlatoOficialPAE(p.nombre_plato)).length;
    return tieneEjemplos || cantidadOficiales < 20;
  }

  private ordenarPlatosPAE(lista: any[]): any[] {
    return [...lista].sort((a, b) => {
      const numA = a.numero_menu ?? this.extraerNumeroMenuDeNombre(a.nombre_plato) ?? 999;
      const numB = b.numero_menu ?? this.extraerNumeroMenuDeNombre(b.nombre_plato) ?? 999;
      if (numA !== numB) return numA - numB;
      return String(a.nombre_plato || '').localeCompare(String(b.nombre_plato || ''));
    });
  }

  private extraerNumeroMenuDeNombre(nombre: string): number | null {
    const m = String(nombre || '').match(/men[uú]\s*(\d+)/i);
    return m ? Number(m[1]) : null;
  }

  /**
   * Elimina/reemplaza automáticamente los platos de ejemplo antiguos que estaban en la BD
   * y deja únicamente los 20 platos oficiales del PAE (tanto para Banco de Datos como para la app móvil).
   */
  private reemplazarPlatosEjemploEnBackend(crudosActuales: any[], mostrarAlerta = false): void {
    if (this.sincronizandoMinuta) return;
    this.sincronizandoMinuta = true;

    const oficialesMap = new Map<number, any>();
    const ejemplosParaReemplazarOEliminar: any[] = [];

    type OperacionSync =
      | { tipo: 'update'; id: number; plantilla: PlantillaMenuPAE }
      | { tipo: 'create'; plantilla: PlantillaMenuPAE }
      | { tipo: 'delete'; id: number };

    const operaciones: OperacionSync[] = [];

    for (const item of crudosActuales) {
      const num = this.extraerNumeroMenuDeNombre(item.nombre_plato);
      const plantilla = num ? this.MINUTA_PAE_OFICIAL.find(m => m.numero_menu === num) : null;
      if (plantilla && !oficialesMap.has(plantilla.numero_menu)) {
        oficialesMap.set(plantilla.numero_menu, item);
        // Si tiene el número de menú pero tenía el nombre largo anterior, actualizarlo al nombre corto:
        if (String(item.nombre_plato || '').trim().toLowerCase() !== plantilla.nombre_plato.trim().toLowerCase()) {
          const idItem = Number(item.id_plato ?? item.id);
          if (idItem) {
            operaciones.push({ tipo: 'update', id: idItem, plantilla });
          }
        }
      } else {
        ejemplosParaReemplazarOEliminar.push(item);
      }
    }

    const faltantes = this.MINUTA_PAE_OFICIAL.filter(m => !oficialesMap.has(m.numero_menu));
    let idxEjemplo = 0;

    // 1. Reutilizar registros de ejemplo antiguos actualizándolos con los platos PAE faltantes (evita errores de FK en móvil/detalle_plato)
    for (const plantilla of faltantes) {
      if (idxEjemplo < ejemplosParaReemplazarOEliminar.length) {
        const ej = ejemplosParaReemplazarOEliminar[idxEjemplo++];
        const idEj = Number(ej.id_plato ?? ej.id);
        if (idEj) {
          operaciones.push({ tipo: 'update', id: idEj, plantilla });
          continue;
        }
      }
      operaciones.push({ tipo: 'create', plantilla });
    }

    // 2. Si sobraron platos de ejemplo antiguos, eliminarlos de la base de datos
    while (idxEjemplo < ejemplosParaReemplazarOEliminar.length) {
      const sobrante = ejemplosParaReemplazarOEliminar[idxEjemplo++];
      const idSob = Number(sobrante.id_plato ?? sobrante.id);
      if (idSob) {
        operaciones.push({ tipo: 'delete', id: idSob });
      }
    }

    if (operaciones.length === 0) {
      this.sincronizandoMinuta = false;
      this.datos = this.ordenarPlatosPAE(
        crudosActuales.map(plato => this.enriquecerPlatoConReceta(plato))
      );
      this.cargando = false;
      this.cdr.detectChanges();
      return;
    }

    const idSeccionDefault = this.obtenerIdSeccionPrincipal(['Desayuno', 'Almuerzo']);

    const ejecutarPaso = (idx: number) => {
      if (idx >= operaciones.length) {
        this.sincronizandoMinuta = false;
        this.bancoDatosService.obtenerDatos('menus').subscribe({
          next: (resFinal: any) => {
            const listaFinal = this.normalizarRespuesta(resFinal);
            // Filtrar cualquier plato ejemplo que no haya podido borrarse por FK
            const soloOficiales = listaFinal.filter(p => this.esPlatoOficialPAE(p.nombre_plato));
            this.datos = this.ordenarPlatosPAE(
              (soloOficiales.length > 0 ? soloOficiales : listaFinal).map(plato =>
                this.enriquecerPlatoConReceta(plato)
              )
            );
            this.cargando = false;
            this.cdr.detectChanges();
            if (mostrarAlerta) {
              this.sweetAlert.success(
                '20 Platos Oficiales PAE listos',
                'Se eliminaron los platos de ejemplo y quedaron registrados los 20 platos oficiales del PAE.'
              );
            }
          },
          error: () => {
            this.cargando = false;
            this.cdr.detectChanges();
          }
        });
        return;
      }

      const op = operaciones[idx];
      if (op.tipo === 'delete') {
        this.bancoDatosService.eliminarDato('menus', op.id).subscribe({
          next: () => ejecutarPaso(idx + 1),
          error: () => ejecutarPaso(idx + 1)
        });
        return;
      }

      const plantilla = op.plantilla;
      const resumenComponentes = plantilla.componentes.map(c => c.nombre_componente).join(', ');
      const payloadBackend: any = {
        nombre_plato: plantilla.nombre_plato.slice(0, 100),
        id_seccion: idSeccionDefault,
        componente: resumenComponentes.slice(0, 50)
      };

      const req$ = op.tipo === 'update'
        ? this.bancoDatosService.actualizarDato('menus', op.id, payloadBackend)
        : this.bancoDatosService.crearDato('menus', payloadBackend);

      req$.subscribe({
        next: (resp: any) => {
          const idGuardado = op.tipo === 'update' ? op.id : (resp?.id_plato ?? resp?.id);
          const recetaInicial: RecetaMenuExtendida = {
            id_plato: idGuardado,
            nombre_plato: plantilla.nombre_plato,
            semana: plantilla.semana,
            numero_menu: plantilla.numero_menu,
            secciones: [...plantilla.secciones],
            imagen_url: '',
            informacion_nutricional: '',
            estado: 'ACTIVO',
            componentes: plantilla.componentes.map(c =>
              this.crearComponenteVacio(c.tipo_componente, c.nombre_componente)
            )
          };
          this.guardarRecetaExtendidaLocal(idGuardado, plantilla.nombre_plato, recetaInicial);
          ejecutarPaso(idx + 1);
        },
        error: () => ejecutarPaso(idx + 1)
      });
    };

    ejecutarPaso(0);
  }

  /** Sincroniza en la BD los 20 platos oficiales del PAE y elimina platos de ejemplo antiguos. */
  sincronizarMinutaPAE(): void {
    if (this.sincronizandoMinuta) return;
    this.bancoDatosService.obtenerDatos('menus').subscribe({
      next: (res: any) => {
        const crudos = this.normalizarRespuesta(res);
        this.reemplazarPlatosEjemploEnBackend(crudos, true);
      },
      error: () => {
        this.reemplazarPlatosEjemploEnBackend(this.datos || [], true);
      }
    });
  }

  private obtenerIdSeccionPrincipal(seccionesNombres: string[]): number | null {
    const secsOpciones = this.opciones['secciones_menu'] || [];
    for (const nombre of seccionesNombres) {
      const encontrada = secsOpciones.find(
        s => s.label.trim().toLowerCase() === nombre.trim().toLowerCase()
      );
      if (encontrada) return Number(encontrada.id);
    }
    return secsOpciones[0] ? Number(secsOpciones[0].id) : 1;
  }

  private obtenerRecetarioLocal(): Record<string, RecetaMenuExtendida> {
    try {
      const raw = localStorage.getItem(this.STORAGE_RECETARIO_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private guardarRecetaExtendidaLocal(idPlato: any, nombrePlato: string, receta: RecetaMenuExtendida): void {
    try {
      const mapa = this.obtenerRecetarioLocal();
      if (idPlato !== undefined && idPlato !== null) {
        mapa[`id_${idPlato}`] = receta;
      }
      if (nombrePlato) {
        mapa[`nombre_${nombrePlato.trim().toLowerCase()}`] = receta;
      }
      localStorage.setItem(this.STORAGE_RECETARIO_KEY, JSON.stringify(mapa));

      // También actualizar el catálogo de componentes reutilizables
      const catComp = this.obtenerCatalogoComponentesLocal();
      for (const comp of receta.componentes || []) {
        const claveComp = (comp.nombre_componente || '').trim().toLowerCase();
        if (claveComp && (comp.ingredientes.length > 0 || comp.pasos.some(p => p.descripcion_paso.trim()))) {
          catComp[claveComp] = {
            id_temporal: comp.id_temporal,
            tipo_componente: comp.tipo_componente,
            nombre_componente: comp.nombre_componente.trim(),
            ingredientes: comp.ingredientes.map(i => ({ ...i })),
            pasos: comp.pasos.filter(p => p.descripcion_paso.trim()).map((p, idx) => ({
              numero_paso: idx + 1,
              descripcion_paso: p.descripcion_paso.trim()
            }))
          };
        }
      }
      localStorage.setItem(this.STORAGE_COMP_CATALOGO_KEY, JSON.stringify(catComp));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage:', e);
    }
  }

  private obtenerCatalogoComponentesLocal(): Record<string, ComponentePlatoReceta> {
    try {
      const raw = localStorage.getItem(this.STORAGE_COMP_CATALOGO_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private buscarComponenteEnCatalogo(nombreComponente: string): ComponentePlatoReceta | null {
    const clave = (nombreComponente || '').trim().toLowerCase();
    if (!clave) return null;
    const cat = this.obtenerCatalogoComponentesLocal();
    return cat[clave] || null;
  }

  private enriquecerPlatoConReceta(plato: any): any {
    const id = plato?.id_plato ?? plato?.id;
    const nombre = String(plato?.nombre_plato ?? '').trim();
    const mapa = this.obtenerRecetarioLocal();
    const guardado = (id ? mapa[`id_${id}`] : null) || (nombre ? mapa[`nombre_${nombre.toLowerCase()}`] : null);

    // Detectar si coincide con alguno de los 20 menús de la minuta oficial PAE
    const plantillaCoincidente = this.MINUTA_PAE_OFICIAL.find(
      m => m.nombre_plato.toLowerCase() === nombre.toLowerCase() ||
           nombre.toLowerCase().startsWith(`menú ${m.numero_menu}:`) ||
           nombre.toLowerCase().startsWith(`menu ${m.numero_menu}:`)
    );

    // Resolver nombre de sección desde id_seccion de la BD si no hay guardado
    let secciones: string[] = [];
    if (guardado?.secciones && guardado.secciones.length > 0) {
      secciones = [...guardado.secciones];
    } else if (plantillaCoincidente) {
      secciones = [...plantillaCoincidente.secciones];
    } else if (plato?.id_seccion) {
      const secOp = this.opciones['secciones_menu']?.find(s => Number(s.id) === Number(plato.id_seccion));
      const secNombre = secOp?.label || 'Almuerzo';
      if (['Desayuno', 'Almuerzo', 'Merienda'].includes(secNombre)) {
        secciones = [secNombre];
      } else {
        secciones = ['Desayuno', 'Almuerzo'];
      }
    } else {
      secciones = ['Desayuno', 'Almuerzo'];
    }

    // Construir componentes
    let componentes: ComponentePlatoReceta[] = [];
    if (guardado?.componentes && guardado.componentes.length > 0) {
      componentes = guardado.componentes.map(c => {
        const delCatalogo = c.ingredientes.length === 0 ? this.buscarComponenteEnCatalogo(c.nombre_componente) : null;
        return {
          ...c,
          ingredientes: c.ingredientes.length > 0 ? c.ingredientes : (delCatalogo?.ingredientes || []),
          pasos: c.pasos && c.pasos.some(p => p.descripcion_paso?.trim())
            ? c.pasos
            : (delCatalogo?.pasos || c.pasos || [])
        };
      });
    } else if (plantillaCoincidente) {
      componentes = plantillaCoincidente.componentes.map(c =>
        this.crearComponenteVacio(c.tipo_componente, c.nombre_componente)
      );
    } else if (plato?.componente) {
      const partes = String(plato.componente).split(/\||,/).map(s => s.trim()).filter(Boolean);
      componentes = partes.map(parte => {
        const [posibleTipo, ...resto] = parte.split(':');
        if (resto.length > 0) {
          return this.crearComponenteVacio(posibleTipo.trim(), resto.join(':').trim());
        }
        return this.crearComponenteVacio('Alimento proteico', parte);
      });
    }

    if (componentes.length === 0) {
      componentes = [this.crearComponenteVacio('Alimento proteico', nombre || 'Componente principal')];
    }

    // Si el backend envió receta_componentes o pasos_preparacion anidados desde PostgreSQL
    // y el componente aún no tiene ingredientes/pasos locales, los hidratamos desde el backend:
    const tieneIngLocales = componentes.some(c => (c.ingredientes?.length || 0) > 0);
    if (!tieneIngLocales && Array.isArray(plato?.receta_componentes) && plato.receta_componentes.length > 0) {
      componentes[0].ingredientes = plato.receta_componentes.map((rc: any) => ({
        id_ingrediente: Number(rc.id_ingrediente),
        nombre_ingrediente: rc.nombre_ingrediente || `Ingrediente #${rc.id_ingrediente}`,
        unidad: '',
        observacion: ''
      }));
    }

    const tienePasosLocales = componentes.some(
      c => (c.pasos || []).some(p => p.descripcion_paso && p.descripcion_paso.trim() !== '')
    );
    if (!tienePasosLocales && Array.isArray(plato?.pasos_preparacion) && plato.pasos_preparacion.length > 0) {
      for (const pasoBd of plato.pasos_preparacion) {
        const descRaw = String(pasoBd.descripcion_paso || '').trim();
        if (!descRaw) continue;
        // Detectar si viene con prefijo "[NombreComponente] Descripción"
        const matchComp = descRaw.match(/^\[([^\]]+)\]\s*(.+)$/);
        if (matchComp) {
          const nomComp = matchComp[1].trim().toLowerCase();
          const textoPaso = matchComp[2].trim();
          const compDestino = componentes.find(c => c.nombre_componente.trim().toLowerCase() === nomComp) || componentes[0];
          compDestino.pasos = compDestino.pasos.filter(p => p.descripcion_paso.trim() !== '');
          compDestino.pasos.push({
            numero_paso: compDestino.pasos.length + 1,
            descripcion_paso: textoPaso
          });
        } else {
          componentes[0].pasos = componentes[0].pasos.filter(p => p.descripcion_paso.trim() !== '');
          componentes[0].pasos.push({
            numero_paso: Number(pasoBd.numero_paso) || (componentes[0].pasos.length + 1),
            descripcion_paso: descRaw
          });
        }
      }
    }

    const totalIngredientes = componentes.reduce((acc, c) => acc + (c.ingredientes?.length || 0), 0);
    const totalPasos = componentes.reduce(
      (acc, c) => acc + (c.pasos?.filter(p => p.descripcion_paso && p.descripcion_paso.trim()).length || 0),
      0
    );

    const semana = guardado?.semana || plantillaCoincidente?.semana || 'Semana 1';
    const numero_menu = guardado?.numero_menu ?? plantillaCoincidente?.numero_menu ?? null;
    const estado = guardado?.estado || plato?.estado || 'ACTIVO';
    const imagen_url = plato?.imagen_url || guardado?.imagen_url || '';
    const informacion_nutricional = guardado?.informacion_nutricional || '';

    return {
      ...plato,
      id_plato: id,
      nombre_plato: nombre,
      semana,
      numero_menu,
      secciones,
      secciones_texto: secciones.join(', '),
      componentes,
      componente: componentes.map(c => `${c.tipo_componente}: ${c.nombre_componente}`).join(' | '),
      totalIngredientes,
      totalPasos,
      resumen_receta: `${totalIngredientes} ingr. • ${totalPasos} pasos`,
      imagen_url,
      informacion_nutricional,
      estado
    };
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
    if (this.tabActual === 'menus') {
      this.guardarMenuReceta();
      return;
    }

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

  guardarMenuReceta(): void {
    if (this.guardando) return;

    const nombre = (this.menuRecetaForm.nombre_plato || '').trim();
    if (!nombre) {
      this.sweetAlert.warning('Nombre requerido', 'Ingresa el nombre del plato.');
      return;
    }

    const componentesValidos = (this.menuRecetaForm.componentes || []).filter(
      c => (c.nombre_componente || '').trim() !== ''
    );

    if (componentesValidos.length === 0) {
      this.sweetAlert.warning('Componentes requeridos', 'Agrega al menos un componente con su nombre de preparación (ej. Huevos pericos, Arroz blanco).');
      return;
    }

    const resumenComponentes = componentesValidos
      .map(c => c.nombre_componente.trim())
      .join(', ');

    const payloadBackend: any = {
      nombre_plato: nombre.slice(0, 100),
      componente: resumenComponentes.slice(0, 50)
    };

    const editando = this.modoEdicion && this.itemSeleccionadoId !== null;
    const archivoSubir = this.archivoImagenPlatoSeleccionado;
    this.guardando = true;

    const peticion$ = editando
      ? this.bancoDatosService.actualizarDato('menus', this.itemSeleccionadoId as number, payloadBackend)
      : this.bancoDatosService.crearDato('menus', payloadBackend);

    peticion$.subscribe({
      next: (resp: any) => {
        const idFinal = Number(resp?.id_plato ?? resp?.id ?? this.itemSeleccionadoId);
        const recetaAGuardar: RecetaMenuExtendida = {
          ...this.menuRecetaForm,
          id_plato: idFinal,
          nombre_plato: nombre,
          componentes: componentesValidos.map(c => ({
            ...c,
            nombre_componente: c.nombre_componente.trim(),
            pasos: (c.pasos || [])
              .filter(p => (p.descripcion_paso || '').trim() !== '')
              .map((p, idx) => ({ numero_paso: idx + 1, descripcion_paso: p.descripcion_paso.trim() }))
          }))
        };

        // Sincronizar ingredientes (receta_componente) y pasos (pasos_preparacion) en PostgreSQL
        if (idFinal) {
          this.sincronizarRecetaYPasosEnBackend(idFinal, recetaAGuardar);
        }

        const finalizarGuardado = (urlFinal?: string) => {
          if (urlFinal) {
            recetaAGuardar.imagen_url = urlFinal;
          }
          this.guardarRecetaExtendidaLocal(idFinal, nombre, recetaAGuardar);

          this.sweetAlert.success(
            editando ? 'Menú y receta actualizados' : 'Menú y receta registrados',
            editando
              ? 'Los componentes, ingredientes, pasos de preparación e imagen quedaron guardados.'
              : 'El menú con sus componentes, ingredientes y pasos quedó registrado en el sistema.'
          );
          this.cerrarModal();
          this.cargarDatos();
        };

        // Si seleccionó un archivo desde su computador, subirlo a Cloudinary vía /api/platos/<id>/subir-imagen/
        if (idFinal && archivoSubir) {
          this.bancoDatosService.subirImagenPlato(idFinal, archivoSubir).subscribe({
            next: (imgResp: any) => {
              finalizarGuardado(imgResp?.imagen_url);
            },
            error: () => {
              finalizarGuardado();
            }
          });
        } else {
          finalizarGuardado(resp?.imagen_url);
        }
      },
      error: (err: any) => {
        console.error('Error al guardar menú/plato:', err);
        this.guardando = false;
        this.sweetAlert.error(
          'No se pudo guardar el menú',
          this.mensajeError(err, 'Verifica los datos e inténtalo nuevamente.')
        );
        this.cdr.detectChanges();
      }
    });
  }

  /** Guarda los ingredientes y pasos del plato en las tablas receta_componente y pasos_preparacion de PostgreSQL. */
  private sincronizarRecetaYPasosEnBackend(idPlato: number, receta: RecetaMenuExtendida): void {
    // 1. Ingredientes únicos del plato hacia /api/receta_componente/
    const idsIngredientesUnicos = new Set<number>();
    for (const comp of receta.componentes || []) {
      for (const ing of comp.ingredientes || []) {
        if (ing.id_ingrediente) {
          idsIngredientesUnicos.add(Number(ing.id_ingrediente));
        }
      }
    }

    // Registrar ingredientes en receta_componente sin duplicados
    this.bancoDatosService.obtenerDatos('receta_componente').subscribe({
      next: (resRc: any) => {
        const todosRc = this.normalizarRespuesta(resRc);
        const yaRegistrados = new Set<number>(
          todosRc
            .filter((rc: any) => {
              const rcPlatoId = typeof rc.id_plato === 'object' ? (rc.id_plato?.id_plato || rc.id_plato?.id) : rc.id_plato;
              return Number(rcPlatoId) === Number(idPlato);
            })
            .map((rc: any) => {
              const ingId = typeof rc.id_ingrediente === 'object' ? (rc.id_ingrediente?.id_ingrediente || rc.id_ingrediente?.id) : rc.id_ingrediente;
              return Number(ingId);
            })
        );

        idsIngredientesUnicos.forEach(idIngrediente => {
          if (!yaRegistrados.has(Number(idIngrediente))) {
            this.bancoDatosService
              .crearDato('receta_componente', {
                id_plato: idPlato,
                id_ingrediente: idIngrediente,
                id_gramaje: null
              })
              .subscribe({ error: () => {} });
          }
        });
      },
      error: () => {
        idsIngredientesUnicos.forEach(idIngrediente => {
          this.bancoDatosService
            .crearDato('receta_componente', {
              id_plato: idPlato,
              id_ingrediente: idIngrediente,
              id_gramaje: null
            })
            .subscribe({ error: () => {} });
        });
      }
    });

    // 2. Limpiar pasos anteriores de este plato si existen para evitar duplicados en la móvil
    this.bancoDatosService.obtenerDatos('pasos_preparacion').subscribe({
      next: (resPasos: any) => {
        const todosPasos = this.normalizarRespuesta(resPasos);
        const viejos = todosPasos.filter((p: any) => {
          const pPlatoId = typeof p.id_plato === 'object' ? (p.id_plato?.id_plato || p.id_plato?.id) : p.id_plato;
          return Number(pPlatoId) === Number(idPlato);
        });

        const registrarNuevosPasos = () => {
          let contadorGlobal = 1;
          for (const comp of receta.componentes || []) {
            for (const paso of comp.pasos || []) {
              const texto = (paso.descripcion_paso || '').trim();
              if (!texto) continue;
              this.bancoDatosService
                .crearDato('pasos_preparacion', {
                  id_plato: idPlato,
                  numero_paso: contadorGlobal++,
                  descripcion_paso: `[${comp.nombre_componente}] ${texto}`
                })
                .subscribe({ error: () => {} });
            }
          }
        };

        if (viejos.length > 0) {
          const borrarObservables = viejos.map((v: any) => {
            const idPaso = v.id_paso_preparacion || v.id;
            return this.bancoDatosService.eliminarDato('pasos_preparacion', idPaso).pipe(
              catchError(() => of(null))
            );
          });
          forkJoin(borrarObservables).subscribe({
            next: () => registrarNuevosPasos(),
            error: () => registrarNuevosPasos()
          });
        } else {
          registrarNuevosPasos();
        }
      },
      error: () => {
        let contadorGlobal = 1;
        for (const comp of receta.componentes || []) {
          for (const paso of comp.pasos || []) {
            const texto = (paso.descripcion_paso || '').trim();
            if (!texto) continue;
            this.bancoDatosService
              .crearDato('pasos_preparacion', {
                id_plato: idPlato,
                numero_paso: contadorGlobal++,
                descripcion_paso: `[${comp.nombre_componente}] ${texto}`
              })
              .subscribe({ error: () => {} });
          }
        }
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
