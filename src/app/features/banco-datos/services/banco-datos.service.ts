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
      'roles': 'roles/',
      'grados': 'grados/',
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
}
