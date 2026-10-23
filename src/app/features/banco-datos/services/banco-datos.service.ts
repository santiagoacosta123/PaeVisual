import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '@env/environment'; // Asumimos que existe

@Injectable({
  providedIn: 'root'
})
export class BancoDatosService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  obtenerDatos(tabla: string): Observable<any> {
    // Aquí puedes mapear 'tabla' a los endpoints reales de Django
    // Ej: roles -> /api/roles/
    // unidades_medida -> /api/unidades-medida/
    const endpoint = this.getEndpoint(tabla);
    if (!endpoint) return throwError(() => new Error('Endpoint no configurado'));
    return this.http.get(`${this.apiUrl}/${endpoint}`);
  }

  crearDato(tabla: string, data: any): Observable<any> {
    const endpoint = this.getEndpoint(tabla);
    return this.http.post(`${this.apiUrl}/${endpoint}`, data);
  }

  actualizarDato(tabla: string, id: number, data: any): Observable<any> {
    const endpoint = this.getEndpoint(tabla);
    return this.http.put(`${this.apiUrl}/${endpoint}${id}/`, data);
  }

  eliminarDato(tabla: string, id: number): Observable<any> {
    const endpoint = this.getEndpoint(tabla);
    return this.http.delete(`${this.apiUrl}/${endpoint}${id}/`);
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

  obtenerInstituciones(): Observable<any> {
    return this.http.get(`${this.apiUrl}/instituciones/`);
  }

  obtenerSedes(idInstitucion?: number): Observable<any> {
    const url = idInstitucion
      ? `${this.apiUrl}/sedes/?id_institucion=${idInstitucion}`
      : `${this.apiUrl}/sedes/`;
    return this.http.get(url);
  }
}
