import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';

export interface SeccionPlantilla {
  codigo: string;
  titulo: string;
  orden: number;
  descripcion?: string;
  origen: 'AUTOMATICO' | 'MANUAL';
  fuente_sirae: string;
  visible_en_impresion?: boolean;
}

export interface CampoPlantilla {
  codigo: string;
  etiqueta: string;
  seccion: string;
  tipo: 'TEXTO' | 'NUMERO' | 'FECHA' | 'PORCENTAJE' | 'LISTA';
  origen: 'AUTOMATICO' | 'MANUAL';
  fuente_sirae: string;
  campo_fuente: string;
  requerido?: boolean;
  formula?: string;
  unidad_destino?: string;
}

export interface ColumnaTablaPlantilla {
  codigo: string;
  etiqueta: string;
  tipo: string;
  origen: 'AUTOMATICO' | 'MANUAL';
  fuente_sirae?: string;
  campo_fuente?: string;
  formula?: string;
  unidad_destino?: string;
  calcular_total?: boolean;
}

export interface ConversionUnidadTabla {
  codigo?: string;
  nombre?: string;
  columna_origen: string;
  columna_destino: string;
  unidad_origen_abrev: string;
  unidad_destino_abrev: string;
  aplicar_automaticamente?: boolean;
}

export interface TablaPlantilla {
  codigo: string;
  titulo: string;
  seccion: string;
  fuente_sirae: string;
  columnas: ColumnaTablaPlantilla[];
  formulas?: any[];
  conversiones_unidad?: ConversionUnidadTabla[];
}

export interface EsquemaPlantilla {
  encabezado: {
    titulo: string;
    subtitulo?: string;
    codigo_formato?: string;
  };
  secciones: SeccionPlantilla[];
  campos: CampoPlantilla[];
  tablas: TablaPlantilla[];
}

export interface PlantillaVersion {
  id_version: number;
  id_plantilla: number;
  numero_version: number;
  estado: 'BORRADOR' | 'PUBLICADA' | 'ARCHIVADA';
  esquema: EsquemaPlantilla;
  notas_version: string;
  creado_por_nombre?: string;
  publicado_por_nombre?: string;
  fecha_creacion: string;
  fecha_publicacion?: string | null;
  es_inmutable: boolean;
  total_planillas_generadas?: number;
}

export interface PlantillaOficial {
  id_plantilla: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria_proceso: string;
  categoria_proceso_display?: string;
  finalidad: string;
  roles_autorizados: string[];
  activa: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
  version_publicada: PlantillaVersion | null;
  version_borrador: PlantillaVersion | null;
  versiones: PlantillaVersion[];
}

export interface PlanillaGeneradaItem {
  id_planilla: number;
  codigo_documento: string;
  nombre_documento: string;
  categoria_proceso: string;
  estado: 'BORRADOR' | 'PENDIENTE' | 'OBSERVADO' | 'VALIDADO' | 'CERRADO';
  periodo: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  id_institucion: number;
  institucion_nombre: string;
  id_sede?: number | null;
  sede_nombre: string;
  id_contrato?: number | null;
  contrato_numero: string;
  id_jornada?: number | null;
  jornada_nombre: string;
  id_plantilla_version: number;
  plantilla_id: number;
  plantilla_codigo: string;
  plantilla_nombre: string;
  version_numero: number;
  evento_origen: string;
  responsable_nombre: string;
  fecha_generacion: string;
  fecha_actualizacion?: string;
  fecha_revision?: string | null;
  total_pendientes: number;
  observaciones: string;
  contenido_snapshot?: any;
  valores_manuales?: Record<string, any>;
  campos_pendientes?: any[];
  registros_origen?: Record<string, any>;
  revisado_por_nombre?: string;
}

export interface AlcanceReportes {
  rol: string;
  alcance: any;
  instituciones: { id_institucion: number; nombre_institucion: string; nit: string; estado: string }[];
  sedes: { id_sede: number; nombre_sede: string; codigo_dane: string; id_institucion: number; nombre_institucion: string; estado: string }[];
  contratos: { id_contrato: number; numero_cor: string; operador: string; id_institucion: number; id_sede: number | null; id_jornada: number | null; estado: string }[];
  jornadas: { id_jornada: number; nombre_jornada: string }[];
}

export interface ReporteConsolidadoResponse {
  tipo_reporte: string;
  tipos_disponibles: { codigo: string; nombre: string }[];
  filtros_aplicados: Record<string, any>;
  permisos_usuario: { rol: string; alcance: any };
  fecha_actualizacion: string;
  resumen_ejecutivo: Record<string, number>;
  comparativo_productos: any[];
  consolidado_sedes: any[];
  desagregado_grados: any[];
  detalle: any[];
  responsables: any;
  registros_origen: Record<string, any>;
}

export interface MetadatosPlantillas {
  procesos_pae: { codigo: string; nombre: string; descripcion: string }[];
  roles_disponibles: { codigo: string; nombre: string }[];
  fuentes_sirae: { codigo: string; nombre: string; campos: string[] }[];
  unidades_medida: { id_unidad_medida: number; nombre: string; abreviatura: string; tipo_magnitud: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class PlanillasPaeService {
  private http = inject(HttpClient, { optional: true });
  private readonly baseUrl = `${environment.apiUrl}/reportes`;

  private extraerLista<T>(resp: any): T[] {
    if (Array.isArray(resp)) return resp;
    if (resp && Array.isArray(resp.results)) return resp.results;
    return [];
  }

  private paramsDe(filtros: Record<string, any> = {}): HttpParams {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        params = params.set(k, String(v).trim());
      }
    }
    return params;
  }

  // ==================== SIR-170: PLANTILLAS OFICIALES ====================

  obtenerMetadatosPlantillas(): Observable<MetadatosPlantillas> {
    if (!this.http) {
      return of({ procesos_pae: [], roles_disponibles: [], fuentes_sirae: [], unidades_medida: [] });
    }
    return this.http.get<MetadatosPlantillas>(`${this.baseUrl}/plantillas/metadatos/`);
  }

  listarPlantillas(filtros: { categoria_proceso?: string; activa?: string; search?: string } = {}): Observable<PlantillaOficial[]> {
    if (!this.http) return of([]);
    return this.http
      .get<any>(`${this.baseUrl}/plantillas/`, { params: this.paramsDe(filtros) })
      .pipe(map(resp => this.extraerLista<PlantillaOficial>(resp)));
  }

  crearPlantilla(payload: Partial<PlantillaOficial> & { esquema: EsquemaPlantilla; notas_version?: string }): Observable<PlantillaOficial> {
    return this.http!.post<PlantillaOficial>(`${this.baseUrl}/plantillas/`, payload);
  }

  actualizarPlantilla(idPlantilla: number, payload: any): Observable<PlantillaOficial> {
    return this.http!.patch<PlantillaOficial>(`${this.baseUrl}/plantillas/${idPlantilla}/`, payload);
  }

  previsualizarPlantilla(idPlantilla: number, payload: Record<string, any> = {}): Observable<any> {
    return this.http!.post<any>(`${this.baseUrl}/plantillas/${idPlantilla}/previsualizar/`, payload);
  }

  publicarPlantilla(idPlantilla: number, idVersion?: number, notasVersion = ''): Observable<any> {
    return this.http!.post<any>(`${this.baseUrl}/plantillas/${idPlantilla}/publicar/`, {
      ...(idVersion ? { id_version: idVersion } : {}),
      ...(notasVersion ? { notas_version: notasVersion } : {}),
    });
  }

  crearNuevaVersionPlantilla(idPlantilla: number, idVersionBase?: number, notasVersion = ''): Observable<any> {
    return this.http!.post<any>(`${this.baseUrl}/plantillas/${idPlantilla}/nueva-version/`, {
      ...(idVersionBase ? { id_version_base: idVersionBase } : {}),
      ...(notasVersion ? { notas_version: notasVersion } : {}),
    });
  }

  // ==================== SIR-171 & SIR-172: PLANILLAS GENERADAS ====================

  obtenerAlcance(): Observable<AlcanceReportes> {
    if (!this.http) {
      return of({ rol: '', alcance: null, instituciones: [], sedes: [], contratos: [], jornadas: [] });
    }
    return this.http.get<AlcanceReportes>(`${this.baseUrl}/planillas/alcance/`);
  }

  listarPlanillas(filtros: Record<string, any> = {}): Observable<PlanillaGeneradaItem[]> {
    if (!this.http) return of([]);
    return this.http
      .get<any>(`${this.baseUrl}/planillas/`, { params: this.paramsDe(filtros) })
      .pipe(map(resp => this.extraerLista<PlanillaGeneradaItem>(resp)));
  }

  obtenerPlanilla(idPlanilla: number): Observable<PlanillaGeneradaItem> {
    return this.http!.get<PlanillaGeneradaItem>(`${this.baseUrl}/planillas/${idPlanilla}/`);
  }

  generarPlanilla(payload: {
    id_plantilla?: number | null;
    categoria_proceso?: string;
    id_institucion?: number | null;
    id_sede?: number | null;
    id_contrato?: number | null;
    id_jornada?: number | null;
    periodo?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    observaciones?: string;
    regenerar?: boolean;
    reutilizar_existente?: boolean;
    valores_manuales?: Record<string, any>;
  }): Observable<{ mensaje: string; creada: boolean; planilla: PlanillaGeneradaItem }> {
    return this.http!.post<{ mensaje: string; creada: boolean; planilla: PlanillaGeneradaItem }>(
      `${this.baseUrl}/planillas/generar/`,
      payload
    );
  }

  actualizarPlanilla(
    idPlanilla: number,
    payload: { valores_manuales?: Record<string, any>; observaciones?: string; estado?: string }
  ): Observable<PlanillaGeneradaItem> {
    return this.http!.post<PlanillaGeneradaItem>(`${this.baseUrl}/planillas/${idPlanilla}/actualizar/`, payload);
  }

  descargarPlanillaCsv(idPlanilla: number): Observable<Blob> {
    return this.http!.get(`${this.baseUrl}/planillas/${idPlanilla}/descargar/`, {
      params: new HttpParams().set('formato', 'csv'),
      responseType: 'blob',
    });
  }

  // ==================== SIR-173: REPORTES CONSOLIDADOS ====================

  consultarReporteConsolidado(filtros: Record<string, any> = {}): Observable<ReporteConsolidadoResponse> {
    if (!this.http) {
      return of({
        tipo_reporte: 'RESUMEN_GENERAL',
        tipos_disponibles: [],
        filtros_aplicados: {},
        permisos_usuario: { rol: '', alcance: null },
        fecha_actualizacion: '',
        resumen_ejecutivo: {},
        comparativo_productos: [],
        consolidado_sedes: [],
        desagregado_grados: [],
        detalle: [],
        responsables: {},
        registros_origen: {},
      });
    }
    return this.http.get<ReporteConsolidadoResponse>(`${this.baseUrl}/consolidados/`, {
      params: this.paramsDe(filtros),
    });
  }

  descargarReporteConsolidadoCsv(filtros: Record<string, any> = {}): Observable<Blob> {
    return this.http!.get(`${this.baseUrl}/consolidados/`, {
      params: this.paramsDe({ ...filtros, formato: 'csv' }),
      responseType: 'blob',
    });
  }
}
