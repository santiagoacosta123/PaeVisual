import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class BancoDatosService {
  private apiUrl = environment.apiUrl;

  // Caché en memoria por nombre de tabla
  private cacheTablas: { [tabla: string]: any } = {};

  constructor(private http: HttpClient) {}

  obtenerDatos(tabla: string, forzarRecarga = false): Observable<any> {
    if (!forzarRecarga && this.cacheTablas[tabla]) {
      return of(this.cacheTablas[tabla]);
    }

    const endpoint = this.getEndpoint(tabla);
    if (!endpoint) return throwError(() => new Error('Endpoint no configurado'));

    return this.http.get(`${this.apiUrl}/${endpoint}`).pipe(
      tap(res => {
        this.cacheTablas[tabla] = res;
      })
    );
  }

  crearDato(tabla: string, data: any): Observable<any> {
    delete this.cacheTablas[tabla];
    const endpoint = this.getEndpoint(tabla);
    return this.http.post(`${this.apiUrl}/${endpoint}`, data);
  }

  actualizarDato(tabla: string, id: number, data: any): Observable<any> {
    delete this.cacheTablas[tabla];
    const endpoint = this.getEndpoint(tabla);
    return this.http.put(`${this.apiUrl}/${endpoint}${id}/`, data);
  }

  eliminarDato(tabla: string, id: number): Observable<any> {
    delete this.cacheTablas[tabla];
    const endpoint = this.getEndpoint(tabla);
    return this.http.delete(`${this.apiUrl}/${endpoint}${id}/`);
  }

  limpiarCache(tabla?: string): void {
    if (tabla) {
      delete this.cacheTablas[tabla];
    } else {
      this.cacheTablas = {};
    }
  }

  private getEndpoint(tabla: string): string {
    const endpoints: any = {
      'unidades_medida': 'unidades_medida/',
      'equivalencias_unidad': 'equivalencias-unidad/',
      'roles': 'roles/',
      'grados': 'grados/',
      'grupos_gramaje': 'grupos-gramaje/',
      'jornadas': 'jornadas/',
      'secciones_menu': 'secciones_menu/',
      'tipos_mercado': 'tipos-mercado/',
      'categorias_inventario': 'categorias_inventario/',
      'turnos': 'turnos/',
      'gramajes': 'gramage/',
      'ingredientes': 'ingredientes/',
      'recetas': 'recetas/',
      'instituciones': 'instituciones/',
      'sedes': 'sedes/',
      'sede_jornadas': 'sede-jornadas/',
      'usuario_turno': 'usuario-turno/',
      'proveedores': 'proveedores/'
    };
    return endpoints[tabla] || '';
  }

  obtenerInstituciones(forzarRecarga = false): Observable<any> {
    return this.obtenerDatos('instituciones', forzarRecarga);
  }

  obtenerSedes(idInstitucion?: number): Observable<any> {
    const url = idInstitucion
      ? `${this.apiUrl}/sedes/?id_institucion=${idInstitucion}`
      : `${this.apiUrl}/sedes/`;
    return this.http.get(url);
  }

  cambiarEstadoGramaje(id: number, estado?: string, observaciones?: string): Observable<any> {
    delete this.cacheTablas['gramajes'];
    return this.http.post(`${this.apiUrl}/gramage/${id}/cambiar-estado/`, {
      ...(estado ? { estado } : {}),
      ...(observaciones ? { observaciones } : {})
    });
  }

  obtenerHistorialGramaje(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/gramage/${id}/historial/`);
  }

  calcularPorcionesGramaje(params: {
    id_grado?: any;
    id_grupo_gramaje?: any;
    estudiantes: number;
    dias: number;
    contexto_aplicacion?: string;
  }): Observable<any> {
    const query = new URLSearchParams();
    if (params.id_grado) query.set('id_grado', String(params.id_grado));
    if (params.id_grupo_gramaje) query.set('id_grupo_gramaje', String(params.id_grupo_gramaje));
    if (params.contexto_aplicacion) query.set('contexto_aplicacion', params.contexto_aplicacion);
    query.set('estudiantes', String(params.estudiantes));
    query.set('dias', String(params.dias));
    return this.http.get(`${this.apiUrl}/gramage/calcular-porciones/?${query.toString()}`);
  }

  cambiarEstadoGrado(id: number, estado?: string): Observable<any> {
    delete this.cacheTablas['grados'];
    delete this.cacheTablas['grupos_gramaje'];
    return this.http.post(`${this.apiUrl}/grados/${id}/cambiar-estado/`, estado ? { estado } : {});
  }

  obtenerHistorialGrado(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/grados/${id}/historial-clasificacion/`);
  }

  cambiarEstadoGrupoGramaje(id: number, estado?: string): Observable<any> {
    delete this.cacheTablas['grupos_gramaje'];
    return this.http.post(`${this.apiUrl}/grupos-gramaje/${id}/cambiar-estado/`, estado ? { estado } : {});
  }

  cambiarEstadoUnidadMedida(id: number, estado?: string): Observable<any> {
    delete this.cacheTablas['unidades_medida'];
    return this.http.post(`${this.apiUrl}/unidades_medida/${id}/cambiar-estado/`, estado ? { estado } : {});
  }

  obtenerUnidadesCompatibles(idIngrediente: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/unidades_medida/compatibles/?id_ingrediente=${idIngrediente}`);
  }

  convertirUnidad(payload: {
    cantidad: number;
    id_unidad_origen: number;
    id_unidad_destino: number;
    id_ingrediente?: number | null;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/unidades_medida/convertir/`, payload);
  }

  consultarGramajesPorAlcance(filtros?: {
    id_institucion?: number | null;
    id_sede?: number | null;
    id_jornada?: number | null;
    id_grado?: number | null;
    id_ingrediente?: number | null;
    fecha?: string;
  }): Observable<any> {
    const query = new URLSearchParams();
    if (filtros?.id_institucion) query.set('id_institucion', String(filtros.id_institucion));
    if (filtros?.id_sede) query.set('id_sede', String(filtros.id_sede));
    if (filtros?.id_jornada) query.set('id_jornada', String(filtros.id_jornada));
    if (filtros?.id_grado) query.set('id_grado', String(filtros.id_grado));
    if (filtros?.id_ingrediente) query.set('id_ingrediente', String(filtros.id_ingrediente));
    if (filtros?.fecha) query.set('fecha', filtros.fecha);
    const qs = query.toString();
    return this.http.get(`${this.apiUrl}/gramage/consultar-por-alcance/${qs ? `?${qs}` : ''}`);
  }

  asignarGradosSedeJornada(idSedeJornada: number, gradosIds: number[]): Observable<any> {
    delete this.cacheTablas['sede_jornadas'];
    return this.http.post(`${this.apiUrl}/sede-jornadas/${idSedeJornada}/asignar-grados/`, {
      grados_ids: gradosIds
    });
  }
}
