import { CampoPlantilla, ColumnaTablaPlantilla, ConversionUnidadTabla, EsquemaPlantilla, SeccionPlantilla, TablaPlantilla } from '../services/planillas-pae.service';

export interface PlantillaFormulario {
  id_plantilla?: number | null;
  id_version?: number | null;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria_proceso: string;
  finalidad: string;
  roles_autorizados: string[];
  activa: boolean;
  notas_version: string;
  es_inmutable: boolean;
  estado_version: string;
  numero_version: number;
  esquema: EsquemaPlantilla;
}

export function crearPlantillaFormularioVacio(categoria = 'REMISION'): PlantillaFormulario {
  return {
    id_plantilla: null,
    id_version: null,
    codigo: '',
    nombre: '',
    descripcion: '',
    categoria_proceso: categoria,
    finalidad: '',
    roles_autorizados: ['SuperAdministrador', 'supervisor', 'Administrador'],
    activa: true,
    notas_version: 'Borrador inicial',
    es_inmutable: false,
    estado_version: 'BORRADOR',
    numero_version: 1,
    esquema: {
      encabezado: {
        titulo: '',
        subtitulo: 'PROGRAMA DE ALIMENTACIÓN ESCOLAR - SIRAE',
        codigo_formato: '',
      },
      secciones: [
        { codigo: 'SEC_1', titulo: 'Información General y Ámbito', orden: 1, origen: 'AUTOMATICO', fuente_sirae: 'CONTRATO', visible_en_impresion: true },
      ],
      campos: [
        {
          codigo: 'institucion_nombre',
          etiqueta: 'Institución Educativa',
          seccion: 'SEC_1',
          tipo: 'TEXTO',
          origen: 'AUTOMATICO',
          fuente_sirae: 'INSTITUCION',
          campo_fuente: 'nombre_institucion',
          requerido: true,
        },
      ],
      tablas: [
        {
          codigo: 'TABLA_1',
          titulo: 'Detalle de Productos y Cantidades',
          seccion: 'SEC_1',
          fuente_sirae: 'CONSUMO',
          columnas: [
            { codigo: 'nombre_ingrediente', etiqueta: 'Producto', tipo: 'TEXTO', origen: 'AUTOMATICO', fuente_sirae: 'CONSUMO', campo_fuente: 'nombre_ingrediente' },
            { codigo: 'unidad', etiqueta: 'Unidad', tipo: 'TEXTO', origen: 'AUTOMATICO', fuente_sirae: 'CONSUMO', campo_fuente: 'unidad' },
            { codigo: 'cantidad_programada', etiqueta: 'Programado', tipo: 'NUMERO', origen: 'AUTOMATICO', fuente_sirae: 'CONSUMO', campo_fuente: 'cantidad_programada', calcular_total: true },
            { codigo: 'cantidad_recibida', etiqueta: 'Recibido', tipo: 'NUMERO', origen: 'AUTOMATICO', fuente_sirae: 'CONSUMO', campo_fuente: 'cantidad_recibida', calcular_total: true },
          ],
          formulas: [],
          conversiones_unidad: [],
        },
      ],
    },
  };
}

export function clonarEsquemaParaEdicion(esquema: any): EsquemaPlantilla {
  const copia = JSON.parse(JSON.stringify(esquema || {}));
  const secciones: SeccionPlantilla[] = Array.isArray(copia.secciones) ? copia.secciones : [];
  const campos: CampoPlantilla[] = Array.isArray(copia.campos) ? copia.campos : [];
  const tablas: TablaPlantilla[] = (Array.isArray(copia.tablas) ? copia.tablas : []).map((t: any) => ({
    codigo: String(t.codigo || ''),
    titulo: String(t.titulo || ''),
    seccion: String(t.seccion || ''),
    fuente_sirae: String(t.fuente_sirae || 'CONSUMO'),
    columnas: (Array.isArray(t.columnas) ? t.columnas : []) as ColumnaTablaPlantilla[],
    formulas: Array.isArray(t.formulas) ? t.formulas : [],
    conversiones_unidad: (Array.isArray(t.conversiones_unidad) ? t.conversiones_unidad : []) as ConversionUnidadTabla[],
  }));

  return {
    encabezado: {
      titulo: String(copia.encabezado?.titulo || ''),
      subtitulo: String(copia.encabezado?.subtitulo || 'PROGRAMA DE ALIMENTACIÓN ESCOLAR - SIRAE'),
      codigo_formato: String(copia.encabezado?.codigo_formato || ''),
    },
    secciones,
    campos,
    tablas,
  };
}

export function guardarBlobArchivo(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function etiquetaColumnaLegible(clave: string): string {
  const mapa: Record<string, string> = {
    nombre_sede: 'Sede',
    nombre_jornada: 'Jornada',
    nombre_grado: 'Grado',
    nivel_educativo: 'Nivel Educativo',
    nombre_grupo_gramaje: 'Grupo Gramaje',
    cupos: 'Cupos',
    cupos_grado: 'Cupos',
    ninos_presentes: 'Niños Presentes',
    diferencia_ausentismo: 'No Asistidos',
    porcentaje_asistencia: '% Cobertura',
    contrato: 'Contrato',
    operador: 'Operador',
    estado_contrato: 'Estado Contrato',
    nombre_ingrediente: 'Producto / Ingrediente',
    categoria: 'Categoría',
    tipo_conservacion: 'Clasificación',
    unidad: 'Unidad',
    unidad_medida: 'Unidad',
    cantidad_gramaje: 'Gramaje',
    gramaje_por_racion: 'Gramaje/Ración',
    cantidad_programada: 'Programado',
    cantidad_despachada: 'Despachado',
    cantidad_recibida: 'Recibido',
    cantidad_rechazada: 'Rechazado',
    cantidad_consumida: 'Consumido',
    diferencia_despacho: 'Dif. Despacho',
    diferencia_recepcion: 'Dif. Recepción',
    saldo_remanente: 'Saldo Remanente',
    cantidad_actual: 'Saldo Actual',
    stock_minimo: 'Stock Mínimo',
    total_entradas: 'Entradas',
    total_salidas: 'Salidas Cocina',
    estado_stock: 'Estado Stock',
    estado_fila: 'Estado Balance',
    estado: 'Estado',
    fecha: 'Fecha',
    fecha_entrega: 'Fecha Entrega',
    fecha_recepcion: 'Fecha Recepción',
    documento_entrega: 'Doc. Entrega',
    motivo_rechazo: 'Motivo / Novedad',
    tipo_movimiento: 'Movimiento',
    cantidad: 'Cantidad',
    usuario_responsable: 'Responsable',
    nombre_plato: 'Plato',
    nombre_turno: 'Turno',
    responsable_cocina: 'Responsable Cocina',
    estado_preparacion: 'Estado Preparación',
    origen: 'Módulo Origen',
    sede: 'Sede',
    referencia: 'Referencia',
    producto: 'Producto',
    detalle: 'Detalle',
    severidad: 'Severidad',
    dias_cobertura: 'Días Cobertura',
    periodicidad: 'Periodicidad',
    observaciones: 'Observaciones',
  };
  if (mapa[clave]) return mapa[clave];
  return clave.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

