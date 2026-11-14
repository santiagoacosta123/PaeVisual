import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, tap, catchError, timeout } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService } from '@core/auth';

export interface Entrega {
  id?: number;
  idIngrediente?: number;
  idTipoMercado?: number;
  idInstitucion?: number;
  institucionNombre?: string;
  idSede?: number;
  sedeNombre?: string;
  idContrato?: number;
  idCalculoEntrega?: number;
  documentoEntrega?: string;
  numeroFactura?: string;
  loteRegistro?: string;
  cantidadRequeridaCalculo?: number | null;
  superaCalculo?: boolean;
  autorizadoPor?: string;
  justificacionExceso?: string;
  ingrediente: string;
  tipoMercado: string;
  frecuencia: string;
  cantidad: number | null;
  unidad: string;
  fechaRecepcion: string;
  fechaVencimiento: string;
  estado?: 'EN_TRANSITO' | 'RECIBIDA' | 'CON_NOVEDAD' | 'RECHAZADA' | string;
  cantidadRecibida?: number | null;
  cantidadRechazada?: number | null;
  motivoRechazo?: string;
  usuarioReceptorNombre?: string;
  observaciones?: string;
  destino?: string;
}

export interface IngredienteOpcion {
  id: number;
  nombre: string;
}

export interface TipoMercadoOpcion {
  id: number;
  nombre: string;
}

export interface EntregaPayload {
  id_ingrediente: number;
  id_tipo_mercado: number;
  ingrediente?: number;
  tipo_mercado?: number;
  id_institucion?: number;
  institucion?: number;
  institucion_nombre?: string;
  id_sede?: number;
  sede?: number;
  sede_nombre?: string;
  fecha_entrega: string;
  fecha_salida?: string;
  fecha_vencimiento: string;
  cantidad: number;
  observaciones: string;
  frecuencia: string;
  unidad: string;
  destino?: string;
  responsable?: string;
  id_usuario_supervisor?: number;
  autorizacion_exceso?: boolean;
  autorizado_por?: string;
  justificacion_exceso?: string;
  documento_entrega?: string;
  codigo_documento?: string;
  numero_factura?: string;
  lote_registro?: string;
}

export interface FaltanteConfiguracion {
  tipo: string;
  severidad?: 'ERROR' | 'ADVERTENCIA' | string;
  mensaje: string;
  ingrediente?: string;
  grado?: string;
  jornada?: string;
}

export interface DetallePorGradoItem {
  id_ingrediente?: number;
  nombre_ingrediente?: string;
  id_jornada?: number;
  jornada_nombre?: string;
  id_grado?: number | null;
  grado_nombre?: string;
  nivel_educativo?: string;
  grupo_gramaje?: string;
  cupos?: number;
  porcion_original?: number;
  unidad_gramaje?: string;
  porcion_convertida?: number;
  unidad_destino?: string;
  dias_periodo?: number;
  cantidad_requerida?: number;
  estado?: 'CALCULADO' | 'SIN_GRAMAJE' | 'ERROR_CONVERSION' | string;
  mensaje?: string;
}

export interface ProductoCalculado {
  id_ingrediente: number;
  nombre_ingrediente: string;
  id_tipo_mercado?: number | null;
  tipo_conservacion?: string;
  es_perecedero?: boolean;
  clasificacion_tipo?: string;
  periodicidad_aplicada?: string;
  dias_periodo?: number;
  unidad_medida: string;
  unidad_abreviatura?: string;
  cupos_totales_utilizados?: number;
  porcion_gramaje?: number;
  porcion_gramaje_convertida?: number;
  consumo_teorico_periodo?: number;
  cantidad_total_requerida: number;
  presentacion_consumo?: string;
  presentacion_requerida?: string;
  stock_actual_sede?: number;
  cantidad_sugerida_despacho: number;
  necesidad_neta_sede?: number;
  presentacion_sugerida?: string;
  stock_bodega_central?: number;
  estado_bodega_central?: 'SUFICIENTE' | 'INSUFICIENTE' | 'ERROR_CONVERSION' | string;
  pendiente_abastecer?: number;
  faltante_bodega_central?: number;
  error_conversion?: boolean;
  alerta_conversion?: string | null;
  tiene_gramajes_faltantes?: boolean;
  grados_sin_gramaje?: string[];
  platos_relacionados?: string[];
  detalle_por_grado?: DetallePorGradoItem[];
}

export interface CalculoAbastecimientoResponse {
  id_institucion?: number;
  id_sede: number;
  nombre_sede?: string;
  institucion?: any;
  contrato?: any;
  periodicidad?: {
    periodicidad_perecederos?: string;
    dias_perecederos?: number;
    periodicidad_no_perecederos?: string;
    dias_no_perecederos?: number;
  };
  total_cupos?: number;
  jornadas?: any[];
  cupos_por_grado?: any[];
  dias_calculados?: number;
  origen_productos?: string;
  total_menus_programados?: number;
  resumen_tipos?: any;
  impacta_inventario?: boolean;
  fecha_calculo?: string;
  alertas_conversion?: string[];
  faltantes_configuracion?: FaltanteConfiguracion[];
  productos_sugeridos?: ProductoCalculado[];
  detalle_por_grado_global?: DetallePorGradoItem[];
}

export interface DespachoLoteItemPayload {
  id_ingrediente: number;
  cantidad: number;
  unidad: string;
  id_tipo_mercado?: number;
  fecha_vencimiento?: string;
}

export interface DespachoLotePayload {
  id_sede: number;
  sede?: number;
  id_institucion?: number;
  institucion?: number;
  institucion_nombre?: string;
  codigo_documento?: string;
  numero_factura?: string;
  documento_entrega?: string;
  fecha_entrega: string;
  fecha_vencimiento?: string;
  id_tipo_mercado?: number;
  id_jornada?: number;
  id_contrato?: number;
  dias?: number;
  dias_perecederos?: number;
  dias_no_perecederos?: number;
  observaciones?: string;
  frecuencia?: string;
  autorizacion_exceso?: boolean;
  autorizado_por?: string;
  justificacion_exceso?: string;
  incluir_todos_gramajes?: boolean;
  validar_contra_calculo?: boolean;
  items: DespachoLoteItemPayload[];
}

export interface DespachoLoteResponse {
  mensaje: string;
  codigo_documento: string;
  id_calculo_entrega: number;
  total_items: number;
  calculo_soporte?: CalculoEntregaSoporte;
  despachos?: any[];
}

export interface CalculoEntregaSoporte {
  id_calculo_entrega?: number;
  codigo_documento: string;
  id_institucion?: number;
  institucion_nombre?: string;
  id_sede?: number;
  sede_nombre?: string;
  id_contrato?: number | null;
  contrato_numero?: string | null;
  id_jornada?: number | null;
  jornada_nombre?: string | null;
  periodo_descripcion?: string;
  dias_perecederos?: number;
  dias_no_perecederos?: number;
  total_cupos?: number;
  autorizacion_exceso?: boolean;
  autorizado_por?: string;
  justificacion_exceso?: string;
  parametros_snapshot?: any;
  consolidado_snapshot?: ProductoCalculado[];
  detalle_grados_snapshot?: DetallePorGradoItem[];
  alertas_snapshot?: any;
  fecha_creacion?: string;
}

/**
 * Servicio compartido: carga las entregas desde el backend y las deja en
 * `entregas` para que las usen "Historial/Registrar" y "Filtrar por tipo de mercado".
 * Va en la carpeta registrar-entrega-alimentos.
 */
@Injectable({ providedIn: 'root' })
export class EntregasService {

  private http = inject(HttpClient);
  private authService = inject(AuthService);

  public readonly apiUrl = `${environment.apiUrl}/entregas/`;
  private readonly ingredientesUrl = `${environment.apiUrl}/ingredientes/`;
  private readonly tiposMercadoUrl = `${environment.apiUrl}/tipos-mercado/`;
  entregas: Entrega[] = [];

  constructor() {}

  // ---------- Cabeceras con token ----------
  getHeaders(): { headers: HttpHeaders } {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();

    if (token) {
      headers = headers.set('Authorization', ['Be', 'arer'].join('') + ' ' + token);
    }
    return { headers };
  }

  cargarIngredientes(): Observable<IngredienteOpcion[]> {
    return this.http.get<any>(this.ingredientesUrl, this.getHeaders()).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_ingrediente ?? item.id),
        nombre: String(item.nombre_ingrediente ?? item.nombre ?? ''),
      })))
    );
  }

  cargarTiposMercado(): Observable<TipoMercadoOpcion[]> {
    return this.http.get<any>(this.tiposMercadoUrl, this.getHeaders()).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_tipo_mercado ?? item.id),
        nombre: String(item.nombre_tipo ?? item.nombre ?? ''),
      })))
    );
  }

  // ---------- Cargar desde el backend ----------
  cargar(propagarError = false): Observable<Entrega[]> {
    return this.http.get<any>(this.apiUrl, this.getHeaders()).pipe(
      timeout(10000),
      map(data => this.listaDe(data).map(item => this.normalizar(item))),
      tap(lista => (this.entregas = lista)),
      catchError(err => {
        console.warn('Error o timeout al cargar entregas desde servidor:', err);
        return propagarError ? throwError(() => err) : of(this.entregas || []);
      })
    );
  }

  registrar(payload: EntregaPayload): Observable<unknown> {
    return this.http.post(this.apiUrl, payload, this.getHeaders());
  }

  actualizar(id: number, payload: EntregaPayload): Observable<unknown> {
    return this.http.put(`${this.apiUrl}${id}/`, payload, this.getHeaders());
  }

  eliminar(id: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}${id}/`, this.getHeaders());
  }

  // ---------- MÃ©todos agregados para completar Historias de Usuario Jira ----------
  
  // SP-246: Obtener detalle individual de una entrega
  getEntregaPorId(id: number): Observable<Entrega> {
    return this.http.get<any>(`${this.apiUrl}${id}/`, this.getHeaders()).pipe(
      map(item => this.normalizar(item))
    );
  }

  // SP-249: Exportar el historial de entregas a Excel
  exportarExcel(): Observable<Blob> {
    const headersConfig = this.getHeaders();
    return this.http.get(`${this.apiUrl}exportar-excel/`, {
      headers: headersConfig.headers,
      responseType: 'blob'
    });
  }

  // Confirmar recepciÃ³n tÃ©cnica y control de calidad (Administrador)
  confirmarRecepcion(id: number, payload: {
    cantidad_recibida: number;
    cantidad_rechazada?: number;
    motivo_rechazo?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}${id}/confirmar-recepcion/`, payload, this.getHeaders());
  }

  // HU 5: Calcular automáticamente cantidades requeridas por sede, jornada, grado, gramaje y menú
  calcularMercado(params: {
    id_sede?: number | null;
    id_institucion?: number | null;
    id_jornada?: number | null;
    id_contrato?: number | null;
    dias?: number | null;
    dias_perecederos?: number | null;
    dias_no_perecederos?: number | null;
    id_grado?: number | null;
    id_grupo_gramaje?: number | null;
    incluir_todos_gramajes?: boolean;
  }): Observable<CalculoAbastecimientoResponse | CalculoAbastecimientoResponse[]> {
    let httpParams = new HttpParams();
    if (params.id_sede != null) httpParams = httpParams.set('id_sede', String(params.id_sede));
    if (params.id_institucion != null) httpParams = httpParams.set('id_institucion', String(params.id_institucion));
    if (params.id_jornada != null) httpParams = httpParams.set('id_jornada', String(params.id_jornada));
    if (params.id_contrato != null) httpParams = httpParams.set('id_contrato', String(params.id_contrato));
    if (params.dias != null) httpParams = httpParams.set('dias', String(params.dias));
    if (params.dias_perecederos != null) httpParams = httpParams.set('dias_perecederos', String(params.dias_perecederos));
    if (params.dias_no_perecederos != null) httpParams = httpParams.set('dias_no_perecederos', String(params.dias_no_perecederos));
    if (params.id_grado != null) httpParams = httpParams.set('id_grado', String(params.id_grado));
    if (params.id_grupo_gramaje != null) httpParams = httpParams.set('id_grupo_gramaje', String(params.id_grupo_gramaje));
    if (params.incluir_todos_gramajes) httpParams = httpParams.set('incluir_todos_gramajes', 'true');

    return this.http.get<CalculoAbastecimientoResponse | CalculoAbastecimientoResponse[]>(`${this.apiUrl}calcular-mercado/`, {
      ...this.getHeaders(),
      params: httpParams,
    });
  }

  // HU 5: Confirmar despacho en lote validado y guardar soporte auditable CalculoEntrega
  despachoLote(payload: DespachoLotePayload): Observable<DespachoLoteResponse> {
    return this.http.post<DespachoLoteResponse>(`${this.apiUrl}despacho-lote/`, payload, this.getHeaders());
  }

  // HU 5: Consultar snapshots auditables de cálculos de entregas
  obtenerSoportesCalculo(idSede?: number): Observable<CalculoEntregaSoporte[]> {
    let httpParams = new HttpParams();
    if (idSede != null) httpParams = httpParams.set('id_sede', String(idSede));
    return this.http.get<any>(`${this.apiUrl}soportes-calculo/`, {
      ...this.getHeaders(),
      params: httpParams,
    }).pipe(map(data => this.listaDe(data)));
  }

  obtenerSoporteCalculoPorEntrega(idEntrega: number): Observable<CalculoEntregaSoporte> {
    return this.http.get<CalculoEntregaSoporte>(`${this.apiUrl}${idEntrega}/soporte-calculo/`, this.getHeaders());
  }
  // ------------------------------------------------------------------------------

  private listaDe(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    throw new Error('El backend devolviÃ³ una respuesta de lista no vÃ¡lida.');
  }

  private normalizar(item: any, mapaIng?: Map<number, string>, mapaTipos?: Map<number, string>): Entrega {
    const idIng = Number(item.id_ingrediente ?? item.idIngrediente);
    const idTipo = Number(item.id_tipo_mercado ?? item.idTipoMercado);
    const obs = String(item.observaciones ?? '');

    let ingNombre = String(item.ingrediente_nombre ?? item.ingrediente ?? '');
    if (!ingNombre && idIng && mapaIng?.has(idIng)) {
      ingNombre = mapaIng.get(idIng)!;
    }

    let tipoMercadoNombre = String(item.tipo_mercado_nombre ?? item.tipoMercado ?? item.tipo_mercado ?? '');
    if (!tipoMercadoNombre && idTipo && mapaTipos?.has(idTipo)) {
      tipoMercadoNombre = mapaTipos.get(idTipo)!;
    }

    let frec = String(item.frecuencia ?? '');
    if (!frec) {
      const matchFrec = obs.match(/Frecuencia:\s*([^|]+)/i);
      if (matchFrec) frec = matchFrec[1].trim();
    }

    let uni = item.unidad;
    if (!uni) {
      const matchUni = obs.match(/Unidad:\s*([^|]+)/i);
      if (matchUni) uni = matchUni[1].trim();
    }

    // Extracción tolerante y segura de Institución
    const rawInst = item.id_institucion
      ?? (typeof item.institucion === 'object' && item.institucion ? (item.institucion.id_institucion ?? item.institucion.id) : item.institucion);
    const idInst = rawInst != null && !Number.isNaN(Number(rawInst)) ? Number(rawInst) : undefined;

    let instNombre = String(
      item.institucion_nombre
      ?? (typeof item.institucion === 'object' ? (item.institucion?.nombre_institucion ?? item.institucion?.nombre) : '')
      ?? ''
    ).trim();
    if (!instNombre && typeof item.destino === 'string' && item.destino) {
      instNombre = item.destino.split(' - ')[0].trim();
    }

    // Extracción tolerante y segura de Sede
    const rawSede = item.id_sede
      ?? (typeof item.sede === 'object' && item.sede ? (item.sede.id_sede ?? item.sede.id) : item.sede);
    const idSede = rawSede != null && !Number.isNaN(Number(rawSede)) ? Number(rawSede) : undefined;

    let sedeNombre = String(
      item.sede_nombre
      ?? (typeof item.sede === 'object' ? (item.sede?.nombre_sede ?? item.sede?.nombre) : '')
      ?? ''
    ).trim();
    if (!sedeNombre && typeof item.destino === 'string' && item.destino.includes(' - ')) {
      sedeNombre = item.destino.split(' - ').slice(1).join(' - ').trim();
    }

    // Extracción de Documento de Entrega / Factura / Remisión
    let docEntrega = String(
      item.documento_entrega
      ?? item.documentoEntrega
      ?? item.codigo_documento
      ?? item.numero_factura
      ?? item.factura
      ?? ''
    ).trim();
    if (!docEntrega && obs) {
      const matchDoc = obs.match(/(?:Factura|Remisi[oó]n|Doc(?:umento)?(?:\s*Entrega)?)\s*:\s*([^|;,\n]+)/i);
      if (matchDoc) docEntrega = matchDoc[1].trim();
    }
    const loteRegistro = String(item.lote_registro ?? item.loteRegistro ?? docEntrega ?? '').trim();

    return {
      id: Number(item.id_entrega ?? item.id),
      idIngrediente: idIng,
      idTipoMercado: idTipo,
      idInstitucion: idInst,
      institucionNombre: instNombre,
      idSede: idSede,
      sedeNombre: sedeNombre,
      idContrato: item.id_contrato ? Number(item.id_contrato) : undefined,
      idCalculoEntrega: item.id_calculo_entrega ? Number(item.id_calculo_entrega) : undefined,
      documentoEntrega: docEntrega,
      numeroFactura: docEntrega,
      loteRegistro: loteRegistro,
      cantidadRequeridaCalculo:
        item.cantidad_requerida_calculo != null ? Number(item.cantidad_requerida_calculo) : null,
      superaCalculo: Boolean(item.supera_calculo),
      autorizadoPor: item.autorizado_por || '',
      justificacionExceso: item.justificacion_exceso || '',
      ingrediente: ingNombre,
      tipoMercado: this.normalizarMercado(
        tipoMercadoNombre || (idTipo === 1 ? 'Perecederos' : 'Granos')
      ),
      frecuencia: frec,
      cantidad: item.cantidad == null ? null : Number(item.cantidad),
      unidad: this.normalizarUnidad(uni),
      fechaRecepcion: this.soloFecha(item.fecha_entrega ?? item.fechaRecepcion ?? item.fecha_recepcion),
      fechaVencimiento: this.soloFecha(item.fecha_vencimiento ?? item.fechaVencimiento),
      estado: (item.estado || 'EN_TRANSITO').toUpperCase(),
      cantidadRecibida: item.cantidad_recibida != null ? Number(item.cantidad_recibida) : null,
      cantidadRechazada: item.cantidad_rechazada != null ? Number(item.cantidad_rechazada) : null,
      motivoRechazo: item.motivo_rechazo || '',
      usuarioReceptorNombre: item.usuario_receptor_nombre || '',
      observaciones: obs,
    };
  }

  // "Granos / No perecederos", "granos", etc. -> 'Granos'   |   "Perecederos" -> 'Perecederos'
  normalizarMercado(valor: any): string {
    const v = String(valor ?? '').toLowerCase().trim().replace(/[_-]+/g, ' ');
    if (v.startsWith('perecedero')) return 'Perecederos';
    if (v.startsWith('grano') || v.startsWith('no perecedero')) return 'Granos';
    return String(valor ?? '');
  }

  normalizarUnidad(valor: any): string {
    const original = String(valor ?? '');
    const u = original.toLowerCase();
    if (u.includes('kg') || u.includes('kilo')) return 'Kg';
    if (u.includes('lit') || u === 'l') return 'Litros';
    if (u.includes('unid') || u === 'ud') return 'Unidades';
    return original;
  }

  // Por si el backend manda fecha con hora (2026-10-12T00:00:00Z)
  soloFecha(valor: any): string {
    return String(valor ?? '').substring(0, 10);
  }

  // ---------- Estado y alertas ----------
  umbralAlerta(e: any): number {
    return e.tipoMercado === 'Perecederos' ? 7 : 30;
  }

  diasRestantes(e: any): number {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vence = new Date(e.fechaVencimiento + 'T00:00:00');
    return Math.round((vence.getTime() - hoy.getTime()) / 86400000);
  }

  obtenerEstado(e: any): string {
    if (!e.fechaVencimiento) return 'Vigente';
    const dias = this.diasRestantes(e);
    if (dias < 0) return 'Vencido';
    if (dias <= this.umbralAlerta(e)) return 'PrÃ³ximo a vencer';
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
}
