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

type TipoCampo = 'text' | 'textarea' | 'number' | 'time' | 'select' | 'multiselect';

/** Tablas que alimentan listas desplegables de otras tablas. */
type FuenteRelacion = 'jornadas' | 'unidades_medida' | 'ingredientes' | 'categorias_inventario' | 'grados' | 'grupos_gramaje' | 'instituciones' | 'tipos_mercado' | 'sedes' | 'turnos';

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
  /** Solo se muestra como columna en la tabla (campo calculado / solo lectura). */
  soloTabla?: boolean;
  /** Solo se diligencia dentro del modal (oculta columna redundante en tabla). */
  soloModal?: boolean;
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
  sedes: {
    id: 'id_sede',
    etiqueta: r => r.nombre_sede ?? r.nombre ?? ''
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
  tipos_mercado: {
    id: 'id_tipo_mercado',
    etiqueta: r => r.nombre_tipo ?? r.nombre ?? ''
  },
  grados: {
    id: 'id_grado',
    etiqueta: r => r.nombre_grado ?? r.nombre ?? ''
  },
  grupos_gramaje: {
    id: 'id_grupo_gramaje',
    etiqueta: r => {
      const nivel = r.nivel_educativo_display || r.nivel_educativo || '';
      return r.nombre ? (nivel ? `${r.nombre} (${nivel})` : r.nombre) : '';
    }
  },
  turnos: {
    id: 'id_turno',
    etiqueta: r => r.nombre_turno ? `${r.nombre_turno} (${(r.hora_inicio || '').slice(0, 5)} - ${(r.hora_fin || '').slice(0, 5)})` : ''
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
        { name: 'id_tipo_mercado', label: 'Tipo de mercado', type: 'select', required: false, source: 'tipos_mercado' },
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
        { name: 'abreviatura', label: 'Abreviatura', type: 'text', required: true, placeholder: 'Ej: kg' },
        {
          name: 'tipo_magnitud',
          label: 'Magnitud',
          type: 'select',
          required: true,
          defaultValue: 'MASA',
          options: [
            { id: 'MASA', label: 'Masa (g, kg, lb)' },
            { id: 'VOLUMEN', label: 'Volumen (ml, L)' },
            { id: 'UNIDAD', label: 'Unidad individual (und, pza)' }
          ]
        },
        {
          name: 'factor_conversion_base',
          label: 'Factor base (g / ml / und)',
          type: 'number',
          required: true,
          defaultValue: 1,
          placeholder: 'Ej: 1000 para kg o L, 1 para g/ml/und'
        },
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
      id: 'equivalencias_unidad',
      nombre: 'Equivalencias técnicas',
      singular: 'equivalencia de unidad',
      icon: 'sync_alt',
      idField: 'id_equivalencia',
      categoria: 'inventario',
      campos: [
        { name: 'id_ingrediente', label: 'Producto / ingrediente', type: 'select', required: true, source: 'ingredientes' },
        { name: 'id_unidad_origen', label: 'Unidad origen', type: 'select', required: true, source: 'unidades_medida' },
        { name: 'id_unidad_destino', label: 'Unidad destino', type: 'select', required: true, source: 'unidades_medida' },
        { name: 'factor_conversion', label: 'Equivalencia (1 origen = X destino)', type: 'number', required: true, placeholder: 'Ej: 55 (1 und = 55 g)' },
        { name: 'observaciones', label: 'Especificación técnica', type: 'textarea', soloModal: true, placeholder: 'Justificación técnica de densidad o peso unitario' },
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
      id: 'grupos_gramaje',
      nombre: 'Grupos de gramajes',
      singular: 'grupo de gramaje',
      icon: 'groups',
      idField: 'id_grupo_gramaje',
      categoria: 'operacion',
      campos: [
        { name: 'nombre', label: 'Grupo de aplicación', type: 'text', required: true, placeholder: 'Ej: Grupo A - Preescolar' },
        {
          name: 'nivel_educativo',
          label: 'Nivel educativo',
          type: 'select',
          required: true,
          defaultValue: 'PRIMARIA',
          options: [
            { id: 'PREESCOLAR', label: 'Preescolar' },
            { id: 'PRIMARIA', label: 'Primaria' },
            { id: 'SECUNDARIA', label: 'Secundaria' },
            { id: 'MEDIA', label: 'Media' },
            { id: 'OTRO', label: 'Otro' }
          ]
        },
        { name: 'grados_asociados_resumen', label: 'Grados asociados', type: 'text', soloTabla: true },
        { name: 'descripcion', label: 'Descripción técnica', type: 'textarea', soloModal: true, placeholder: 'Criterios nutricionales o edades aplicables' },
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
      id: 'grados',
      nombre: 'Grados',
      singular: 'grado',
      icon: 'school',
      idField: 'id_grado',
      categoria: 'operacion',
      campos: [
        { name: 'nombre_grado', label: 'Grado escolar', type: 'text', required: true, placeholder: 'Ej: Primero' },
        { name: 'id_grupo_gramaje', label: 'Grupo de gramaje', type: 'select', required: true, source: 'grupos_gramaje' },
        {
          name: 'nivel_educativo',
          label: 'Nivel educativo',
          type: 'select',
          required: true,
          defaultValue: 'PRIMARIA',
          options: [
            { id: 'PREESCOLAR', label: 'Preescolar' },
            { id: 'PRIMARIA', label: 'Primaria' },
            { id: 'SECUNDARIA', label: 'Secundaria' },
            { id: 'MEDIA', label: 'Media' },
            { id: 'OTRO', label: 'Otro' }
          ]
        },
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
        },
        {
          name: 'motivo_cambio',
          label: 'Motivo de reclasificación',
          type: 'text',
          soloModal: true,
          placeholder: 'Ej: Ajuste de grupo para nuevo periodo (opcional)'
        }
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
      id: 'sede_jornadas',
      nombre: 'Jornadas por Sede',
      singular: 'jornada por sede',
      icon: 'hub',
      idField: 'id_sede_jornada',
      categoria: 'operacion',
      campos: [
        { name: 'id_sede', label: 'Sede educativa', type: 'select', required: true, source: 'sedes' },
        { name: 'id_jornada', label: 'Jornada', type: 'select', required: true, source: 'jornadas' },
        { name: 'cupos', label: 'Cupos asignados', type: 'number', required: true, placeholder: 'Ej: 150' },
        { name: 'grados_resumen', label: 'Grados atendidos', type: 'text', soloTabla: true },
        { name: 'grados_ids', label: 'Grados atendidos en esta sede y jornada', type: 'multiselect', source: 'grados', soloModal: true }
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
        { name: 'id_ingrediente', label: 'Producto o ingrediente', type: 'select', required: true, source: 'ingredientes' },
        { name: 'id_grado', label: 'Grado escolar', type: 'select', required: true, source: 'grados' },
        { name: 'cantidad_gramaje', label: 'Cantidad de gramaje', type: 'number', required: true, placeholder: 'Ej: 120' },
        { name: 'id_unidad_medida', label: 'Unidad de medida', type: 'select', required: true, source: 'unidades_medida' },
        { name: 'tipo_alimento_display', label: 'Tipo de alimento', type: 'text', soloTabla: true },
        {
          name: 'contexto_aplicacion',
          label: 'Contexto de aplicación',
          type: 'select',
          required: true,
          defaultValue: 'GENERAL',
          soloModal: true,
          options: [
            { id: 'GENERAL', label: 'General' },
            { id: 'DESAYUNO', label: 'Desayuno' },
            { id: 'ALMUERZO', label: 'Almuerzo' },
            { id: 'REFRIGERIO', label: 'Refrigerio / Complemento' },
            { id: 'RACION_PREPARADA', label: 'Ración preparada en sitio' },
            { id: 'RACION_INDUSTRIALIZADA', label: 'Ración industrializada' }
          ]
        },
        {
          name: 'descripcion',
          label: 'Observaciones / especificaciones técnicas',
          type: 'textarea',
          soloModal: true,
          placeholder: 'Especificaciones nutricionales o notas técnicas por estudiante'
        },
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
  private _datosFiltradosCache: any[] = [];
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
    this.actualizarFiltros();
  }

  limpiarFiltroInstitucionSede(event?: Event): void {
    if (event) event.stopPropagation();
    this.filtroInstitucionSede = 'TODAS';
    this.actualizarFiltros();
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
    sedes: [],
    jornadas: [],
    unidades_medida: [],
    ingredientes: [],
    categorias_inventario: [],
    tipos_mercado: [],
    grados: [],
    grupos_gramaje: [],
    turnos: []
  };

  gruposGramajeCompletos: any[] = [];

  // Filtros específicos de Gramajes y Grados (HU 1 & HU 2)
  filtroGradoGramaje: any = null;
  filtroCategoriaGramaje: any = null;
  filtroGrupoGrado: any = null;
  filtroNivelGrado: string = '';

  readonly opcionesNivelEducativo: any[] = [
    { id: 'PREESCOLAR', label: 'Preescolar' },
    { id: 'PRIMARIA', label: 'Primaria' },
    { id: 'SECUNDARIA', label: 'Secundaria' },
    { id: 'MEDIA', label: 'Media' },
    { id: 'OTRO', label: 'Otro' }
  ];

  // Compatibilidad en tiempo real dentro de modal (HU 2 & HU 3)
  compatibilidadUnidadesMap: Record<number, {
    nombre?: string;
    abreviatura?: string;
    tipo_magnitud?: string;
    es_compatible: boolean;
    metodo_compatibilidad: string;
    requiere_equivalencia: boolean;
  }> = {};
  unidadBaseProductoInfo: any = null;
  alertaCompatibilidadModal: string = '';
  alertaNivelGradoModal: string = '';

  // Modal de historial (HU 1 & HU 2)
  mostrarHistorialModal = false;
  historialTipo: 'gramajes' | 'grados' = 'gramajes';
  historialTitulo = '';
  historialRegistros: any[] = [];
  cargandoHistorial = false;

  // Modal convertidor rápido de unidades (HU 3)
  mostrarConvertidorModal = false;
  convForm: {
    cantidad: number;
    id_unidad_origen: any;
    id_unidad_destino: any;
    id_ingrediente: any;
  } = { cantidad: 1000, id_unidad_origen: null, id_unidad_destino: null, id_ingrediente: null };
  convResultado: any = null;
  convError = '';
  convirtiendo = false;

  // Modal simulador de porciones por grupo / grado (HU 2 & HU 3)
  mostrarSimuladorModal = false;
  simForm: {
    id_grupo_gramaje: any;
    id_grado: any;
    estudiantes: number;
    dias: number;
    contexto_aplicacion: string;
  } = { id_grupo_gramaje: null, id_grado: null, estudiantes: 100, dias: 5, contexto_aplicacion: '' };
  simResultado: any = null;
  simCargando = false;

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
    // 1. Cargar primero la tabla visible con máxima prioridad
    this.cargarDatos();

    // 2. Cargar las tablas maestras de apoyo tras pintar la tabla
    setTimeout(() => {
      this.cargarTodasLasFuentes();
    }, 150);
  }

  private cargarTodasLasFuentes(): void {
    const fuentes: FuenteRelacion[] = [
      'instituciones',
      'sedes',
      'jornadas',
      'unidades_medida',
      'ingredientes',
      'categorias_inventario',
      'tipos_mercado',
      'grupos_gramaje',
      'grados',
      'turnos'
    ];
    fuentes.forEach(f => this.cargarFuente(f));
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
    if (this.mostrarHistorialModal) {
      this.cerrarHistorialModal();
    }
    if (this.mostrarConvertidorModal) {
      this.cerrarConvertidorModal();
    }
    if (this.mostrarSimuladorModal) {
      this.cerrarSimuladorModal();
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
    if (this.tabActual === 'gramajes') {
      return 'Buscar por producto, grado o especificación técnica...';
    }
    if (this.tabActual === 'grados') {
      return 'Buscar por grado escolar o grupo de aplicación...';
    }
    return `Buscar en ${this.tab.nombre.toLowerCase()}...`;
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
    this.actualizarFiltros();
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
    return item.nombre_institucion ||
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

  get camposTabla(): CampoConfig[] {
    return this.tab.campos.filter(c => !c.soloModal);
  }

  get camposModal(): CampoConfig[] {
    return this.tab.campos.filter(c => !c.soloTabla);
  }

  get datosFiltrados(): any[] {
    return this._datosFiltradosCache;
  }

  actualizarFiltros(): void {
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

    // Filtros específicos de Gramajes: por grado y por categoría
    if (this.tabActual === 'gramajes') {
      if (this.filtroGradoGramaje !== null && this.filtroGradoGramaje !== '' && this.filtroGradoGramaje !== undefined) {
        resultado = resultado.filter(item => String(item.id_grado) === String(this.filtroGradoGramaje));
      }
      if (this.filtroCategoriaGramaje !== null && this.filtroCategoriaGramaje !== '' && this.filtroCategoriaGramaje !== undefined) {
        resultado = resultado.filter(item => String(item.id_categoria_inventario) === String(this.filtroCategoriaGramaje));
      }
    }

    // Filtros específicos de Grados: por grupo y por nivel educativo
    if (this.tabActual === 'grados') {
      if (this.filtroGrupoGrado !== null && this.filtroGrupoGrado !== '' && this.filtroGrupoGrado !== undefined) {
        resultado = resultado.filter(item => String(item.id_grupo_gramaje) === String(this.filtroGrupoGrado));
      }
      if (this.filtroNivelGrado) {
        resultado = resultado.filter(item => String(item.nivel_educativo || '').toUpperCase() === this.filtroNivelGrado);
      }
    }

    // Filtro por texto de búsqueda
    if (this.busquedaTexto && this.busquedaTexto.trim()) {
      const q = this.busquedaTexto.trim().toLowerCase();
      resultado = resultado.filter(item => {
        if (this.tabActual === 'gramajes') {
          const producto = String(item.nombre_ingrediente || '').toLowerCase();
          const grado = String(item.nombre_grado || '').toLowerCase();
          const desc = String(item.descripcion || '').toLowerCase();
          return producto.includes(q) || grado.includes(q) || desc.includes(q);
        }
        return Object.values(item).some(val => {
          if (val === null || val === undefined) return false;
          if (typeof val === 'object') {
            return Object.values(val).some(sub => sub && String(sub).toLowerCase().includes(q));
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
    } else {
      resultado.sort((a, b) => {
        const idA = this.obtenerIdItem(a) || 0;
        const idB = this.obtenerIdItem(b) || 0;
        return idB - idA;
      });
    }

    this._datosFiltradosCache = resultado;
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
    this.filtroGradoGramaje = null;
    this.filtroCategoriaGramaje = null;
    this.filtroGrupoGrado = null;
    this.filtroNivelGrado = '';
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
          this.datos = this.normalizarRespuesta(res);
          this.actualizarFiltros();
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
        if (fuente === 'grupos_gramaje') {
          this.gruposGramajeCompletos = items;
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
      this.tabActual === 'sedes' ||
      this.tabActual === 'jornadas' ||
      this.tabActual === 'unidades_medida' ||
      this.tabActual === 'ingredientes' ||
      this.tabActual === 'categorias_inventario' ||
      this.tabActual === 'tipos_mercado' ||
      this.tabActual === 'grupos_gramaje' ||
      this.tabActual === 'grados' ||
      this.tabActual === 'turnos'
    ) {
      this.cargarFuente(this.tabActual as FuenteRelacion);
    }
    if (['grupos_gramaje', 'grados', 'unidades_medida', 'ingredientes', 'equivalencias_unidad'].includes(this.tabActual)) {
      this.bancoDatosService.limpiarCache('gramajes');
      this.bancoDatosService.limpiarCache('grados');
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
    const base = campo.source ? (this.opciones[campo.source] || []) : [];

    if (
      this.tabActual === 'gramajes' &&
      campo.name === 'id_unidad_medida' &&
      this.itemForm?.id_ingrediente &&
      Object.keys(this.compatibilidadUnidadesMap).length > 0
    ) {
      return base.map(op => {
        const info = this.compatibilidadUnidadesMap[Number(op.id)];
        if (!info) return op;
        return {
          ...op,
          label: info.es_compatible
            ? `${op.label} ✓ Compatible`
            : `${op.label} ⚠ Incompatible`
        };
      });
    }

    return base;
  }

  valorCelda(item: any, campo: CampoConfig): string {
    if (campo.name === 'grados_asociados_resumen') {
      const lista = Array.isArray(item?.grados_asociados) ? item.grados_asociados : [];
      if (lista.length === 0) return 'Sin grados asociados';
      return lista.map((g: any) => g.nombre_grado).join(', ');
    }
    if (campo.name === 'grados_resumen') {
      const lista = Array.isArray(item?.grados_atendidos) ? item.grados_atendidos : [];
      if (lista.length === 0) return 'Sin grados asignados';
      return lista.map((g: any) => g.nombre_grado).join(', ');
    }

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
        // Fallbacks para nombres serializados por Django
        if (!opcion && campo.name === 'id_institucion' && item?.institucion_nombre) {
          return item.institucion_nombre;
        }
        if (!opcion && campo.name === 'id_sede' && (item?.nombre_sede || item?.sede_nombre)) {
          return item.nombre_sede || item.sede_nombre;
        }
        if (!opcion && campo.name === 'id_jornada' && (item?.nombre_jornada || item?.jornada_nombre)) {
          return item.nombre_jornada || item.jornada_nombre;
        }
        if (!opcion && campo.name === 'id_tipo_mercado' && (item?.nombre_tipo || item?.tipo_mercado_nombre)) {
          return item.nombre_tipo || item.tipo_mercado_nombre;
        }
        if (!opcion && campo.name === 'id_turno' && (item?.nombre_turno || item?.turno_nombre)) {
          return item.nombre_turno || item.turno_nombre;
        }
        if (!opcion && campo.name === 'id_ingrediente' && (item?.nombre_ingrediente || item?.ingrediente_nombre)) {
          return item.nombre_ingrediente || item.ingrediente_nombre;
        }
        if (!opcion && campo.name === 'id_grado' && item?.nombre_grado) {
          return item.nombre_grado;
        }
        if (!opcion && campo.name === 'id_grupo_gramaje' && item?.nombre_grupo_gramaje) {
          return item.nombre_grupo_gramaje;
        }
        if (!opcion && campo.name === 'id_unidad_medida' && item?.nombre_unidad_medida) {
          return item.abreviatura_unidad_medida
            ? `${item.nombre_unidad_medida} (${item.abreviatura_unidad_medida})`
            : item.nombre_unidad_medida;
        }
        if (!opcion && campo.name === 'id_unidad_origen' && item?.unidad_origen_nombre) {
          return item.unidad_origen_abreviatura
            ? `${item.unidad_origen_nombre} (${item.unidad_origen_abreviatura})`
            : item.unidad_origen_nombre;
        }
        if (!opcion && campo.name === 'id_unidad_destino' && item?.unidad_destino_nombre) {
          return item.unidad_destino_abreviatura
            ? `${item.unidad_destino_nombre} (${item.unidad_destino_abreviatura})`
            : item.unidad_destino_nombre;
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
    this.alertaCompatibilidadModal = '';
    this.alertaNivelGradoModal = '';
    this.compatibilidadUnidadesMap = {};
    this.unidadBaseProductoInfo = null;

    const form: any = {};
    for (const campo of this.camposModal) {
      let valor = item ? item[campo.name] : null;
      if (item && campo.name === 'cantidad_gramaje' && (valor === undefined || valor === null)) {
        valor = item['cantidad_gramage'];
      }

      if (campo.type === 'time' && valor) {
        valor = String(valor).slice(0, 5);
      }

      if (campo.type === 'multiselect') {
        form[campo.name] = Array.isArray(valor) ? valor.map((v: any) => Number(v)) : [];
        continue;
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

    if (this.tabActual === 'gramajes' && this.itemForm.id_ingrediente) {
      this.verificarCompatibilidadModal();
    }
    if (this.tabActual === 'grados') {
      this.validarCompatibilidadNivelGrado();
    }

    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.modoEdicion = false;
    this.guardando = false;
    this.itemForm = {};
    this.itemSeleccionadoId = null;
    this.itemOriginal = null;
    this.alertaCompatibilidadModal = '';
    this.alertaNivelGradoModal = '';
    this.compatibilidadUnidadesMap = {};
    this.unidadBaseProductoInfo = null;
  }

  onModalCampoCambio(campoName: string, _valor: any): void {
    if (this.tabActual === 'gramajes' && (campoName === 'id_ingrediente' || campoName === 'id_unidad_medida')) {
      this.verificarCompatibilidadModal();
    }
    if (this.tabActual === 'grados') {
      if (campoName === 'id_grupo_gramaje') {
        const grupo = this.gruposGramajeCompletos.find(
          (g: any) => String(g.id_grupo_gramaje) === String(this.itemForm.id_grupo_gramaje)
        );
        if (grupo?.nivel_educativo) {
          this.itemForm.nivel_educativo = grupo.nivel_educativo;
        }
      }
      if (campoName === 'id_grupo_gramaje' || campoName === 'nivel_educativo') {
        this.validarCompatibilidadNivelGrado();
      }
    }
  }

  estaSeleccionadoMultiselect(campoName: string, id: any): boolean {
    const lista = this.itemForm?.[campoName];
    return Array.isArray(lista) && lista.some((v: any) => String(v) === String(id));
  }

  toggleMultiselect(campoName: string, id: any): void {
    if (!Array.isArray(this.itemForm[campoName])) {
      this.itemForm[campoName] = [];
    }
    const lista: any[] = this.itemForm[campoName];
    const idx = lista.findIndex((v: any) => String(v) === String(id));
    if (idx >= 0) {
      lista.splice(idx, 1);
    } else {
      lista.push(Number(id));
    }
  }

  private verificarCompatibilidadModal(): void {
    const idIng = Number(this.itemForm?.id_ingrediente);
    if (!idIng) {
      this.compatibilidadUnidadesMap = {};
      this.unidadBaseProductoInfo = null;
      this.alertaCompatibilidadModal = '';
      return;
    }

    this.bancoDatosService.obtenerUnidadesCompatibles(idIng).subscribe({
      next: (res: any) => {
        this.unidadBaseProductoInfo = res?.unidad_base || null;
        const mapa: Record<number, any> = {};
        for (const u of (res?.unidades || [])) {
          mapa[Number(u.id_unidad_medida)] = u;
        }
        this.compatibilidadUnidadesMap = mapa;
        this.evaluarUnidadSeleccionadaModal();
        this.cdr.detectChanges();
      },
      error: () => {
        this.compatibilidadUnidadesMap = {};
        this.alertaCompatibilidadModal = '';
      }
    });
  }

  private evaluarUnidadSeleccionadaModal(): void {
    const idUnidad = Number(this.itemForm?.id_unidad_medida);
    if (!idUnidad || !this.compatibilidadUnidadesMap[idUnidad]) {
      this.alertaCompatibilidadModal = '';
      return;
    }
    const info = this.compatibilidadUnidadesMap[idUnidad];
    if (!info.es_compatible && this.unidadBaseProductoInfo) {
      this.alertaCompatibilidadModal =
        `Conversión incompatible: el producto opera en ${this.unidadBaseProductoInfo.nombre} ` +
        `(${this.unidadBaseProductoInfo.abreviatura} — ${this.unidadBaseProductoInfo.tipo_magnitud}) y ` +
        `seleccionaste ${info.nombre} (${info.tipo_magnitud}). Configura primero una equivalencia técnica ` +
        `en "Equivalencias técnicas" antes de usar esta unidad.`;
    } else {
      this.alertaCompatibilidadModal = '';
    }
  }

  private validarCompatibilidadNivelGrado(): void {
    const grupo = this.gruposGramajeCompletos.find(
      (g: any) => String(g.id_grupo_gramaje) === String(this.itemForm?.id_grupo_gramaje)
    );
    const nivel = this.itemForm?.nivel_educativo;
    if (
      grupo &&
      nivel &&
      grupo.nivel_educativo !== 'OTRO' &&
      nivel !== 'OTRO' &&
      grupo.nivel_educativo !== nivel
    ) {
      this.alertaNivelGradoModal =
        `Conflicto de clasificación: el nivel "${nivel}" no coincide con el nivel del grupo ` +
        `"${grupo.nombre}" (${grupo.nivel_educativo}). No se puede asociar a un grupo incompatible.`;
    } else {
      this.alertaNivelGradoModal = '';
    }
  }


  // ============================================================
  // VALIDACIÓN Y ARMADO DEL CUERPO
  // ============================================================

  private validarFormulario(): boolean {
    if (this.tabActual === 'gramajes' && this.alertaCompatibilidadModal) {
      this.sweetAlert.warning('Unidad incompatible', this.alertaCompatibilidadModal);
      return false;
    }

    if (this.tabActual === 'grados' && this.alertaNivelGradoModal) {
      this.sweetAlert.warning('Clasificación incompatible', this.alertaNivelGradoModal);
      return false;
    }

    for (const campo of this.camposModal) {
      const valor = this.itemForm[campo.name];
      if (campo.type === 'multiselect') {
        if (campo.required && (!Array.isArray(valor) || valor.length === 0)) {
          this.sweetAlert.warning(
            'Campos incompletos',
            `Debes seleccionar al menos un elemento en "${campo.label}".`
          );
          return false;
        }
        continue;
      }

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

  /** Envía solo los campos del formulario modal, con el tipo correcto. */
  private construirCuerpo(): any {
    const cuerpo: any = {};

    for (const campo of this.camposModal) {
      const valor = this.itemForm[campo.name];

      if (campo.type === 'multiselect') {
        cuerpo[campo.name] = Array.isArray(valor) ? valor.map((v: any) => Number(v)) : [];
      } else if (campo.type === 'number') {
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


  limpiarFiltrosEspecificos(): void {
    this.filtroGradoGramaje = null;
    this.filtroCategoriaGramaje = null;
    this.filtroGrupoGrado = null;
    this.filtroNivelGrado = '';
    this.onFiltroCambio();
  }

  cambiarEstadoRegistro(item: any): void {
    const id = this.obtenerIdItem(item);
    if (!id) return;

    const esActivo = this.isEstadoActivo(item);
    const accion = esActivo ? 'inactivar' : 'activar';
    const titulo = esActivo ? '¿Inactivar configuración?' : '¿Activar configuración?';
    const detalle = this.tabActual === 'gramajes'
      ? `El registro pasará a estado ${esActivo ? 'INACTIVO' : 'ACTIVO'} conservando todo su historial.`
      : `El registro cambiará a estado ${esActivo ? 'INACTIVO' : 'ACTIVO'}.`;

    this.sweetAlert.confirm(titulo, detalle, `Sí, ${accion}`).then((res: any) => {
      if (!res?.isConfirmed) return;

      let req$;
      if (this.tabActual === 'gramajes') {
        req$ = this.bancoDatosService.cambiarEstadoGramaje(id);
      } else if (this.tabActual === 'grados') {
        req$ = this.bancoDatosService.cambiarEstadoGrado(id);
      } else if (this.tabActual === 'grupos_gramaje') {
        req$ = this.bancoDatosService.cambiarEstadoGrupoGramaje(id);
      } else if (this.tabActual === 'unidades_medida') {
        req$ = this.bancoDatosService.cambiarEstadoUnidadMedida(id);
      } else {
        return;
      }

      req$.subscribe({
        next: () => {
          this.sweetAlert.success(
            esActivo ? 'Registro inactivado' : 'Registro activado',
            `La configuración se actualizó a estado ${esActivo ? 'Inactivo' : 'Activo'} sin perder su historial.`
          );
          this.cargarDatos();
          this.refrescarFuenteSiAplica();
        },
        error: (err: any) => {
          this.sweetAlert.error('No se pudo cambiar el estado', this.mensajeError(err, 'Error al actualizar estado.'));
        }
      });
    });
  }

  abrirModalHistorial(item: any): void {
    const id = this.obtenerIdItem(item);
    if (!id) return;

    this.mostrarHistorialModal = true;
    this.cargandoHistorial = true;
    this.historialRegistros = [];

    if (this.tabActual === 'gramajes') {
      this.historialTipo = 'gramajes';
      this.historialTitulo = `Historial de gramaje: ${item.nombre_ingrediente || ''} (${item.nombre_grado || ''})`;
      this.bancoDatosService.obtenerHistorialGramaje(id).subscribe({
        next: (rows: any[]) => {
          this.historialRegistros = Array.isArray(rows) ? rows : [];
          this.cargandoHistorial = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.cargandoHistorial = false;
          this.cdr.detectChanges();
        }
      });
    } else if (this.tabActual === 'grados') {
      this.historialTipo = 'grados';
      this.historialTitulo = `Trazabilidad de clasificación: ${item.nombre_grado || ''}`;
      this.bancoDatosService.obtenerHistorialGrado(id).subscribe({
        next: (rows: any[]) => {
          this.historialRegistros = Array.isArray(rows) ? rows : [];
          this.cargandoHistorial = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.cargandoHistorial = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  cerrarHistorialModal(): void {
    this.mostrarHistorialModal = false;
    this.historialRegistros = [];
  }

  abrirConvertidorModal(): void {
    this.convResultado = null;
    this.convError = '';
    this.mostrarConvertidorModal = true;
    this.cdr.detectChanges();
  }

  cerrarConvertidorModal(): void {
    this.mostrarConvertidorModal = false;
  }

  ejecutarConversionPrueba(): void {
    if (!this.convForm.cantidad || this.convForm.cantidad <= 0 || !this.convForm.id_unidad_origen || !this.convForm.id_unidad_destino) {
      this.convError = 'Ingresa una cantidad mayor a 0 y selecciona unidad origen y destino.';
      this.convResultado = null;
      return;
    }
    this.convirtiendo = true;
    this.convError = '';
    this.convResultado = null;
    this.bancoDatosService.convertirUnidad({
      cantidad: Number(this.convForm.cantidad),
      id_unidad_origen: Number(this.convForm.id_unidad_origen),
      id_unidad_destino: Number(this.convForm.id_unidad_destino),
      id_ingrediente: this.convForm.id_ingrediente ? Number(this.convForm.id_ingrediente) : null
    }).subscribe({
      next: (res: any) => {
        this.convResultado = res;
        this.convirtiendo = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.convError = err?.error?.error || this.mensajeError(err, 'No existe una conversión válida entre estas unidades.');
        this.convirtiendo = false;
        this.cdr.detectChanges();
      }
    });
  }

  abrirSimuladorModal(): void {
    this.simResultado = null;
    this.mostrarSimuladorModal = true;
    this.cdr.detectChanges();
  }

  cerrarSimuladorModal(): void {
    this.mostrarSimuladorModal = false;
  }

  ejecutarSimulacionPorciones(): void {
    if (!this.simForm.estudiantes || this.simForm.estudiantes <= 0 || !this.simForm.dias || this.simForm.dias <= 0) {
      this.sweetAlert.warning('Parámetros inválidos', 'El número de estudiantes y días deben ser mayores a 0.');
      return;
    }
    this.simCargando = true;
    this.simResultado = null;
    this.bancoDatosService.calcularPorcionesGramaje({
      id_grupo_gramaje: this.simForm.id_grupo_gramaje || undefined,
      id_grado: this.simForm.id_grado || undefined,
      estudiantes: Number(this.simForm.estudiantes),
      dias: Number(this.simForm.dias),
      contexto_aplicacion: this.simForm.contexto_aplicacion || undefined
    }).subscribe({
      next: (res: any) => {
        this.simResultado = res;
        this.simCargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.simCargando = false;
        this.sweetAlert.error('Error al calcular', this.mensajeError(err, 'No se pudo ejecutar el cálculo de porciones.'));
        this.cdr.detectChanges();
      }
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
