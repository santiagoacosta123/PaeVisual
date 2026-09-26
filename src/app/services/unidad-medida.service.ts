import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UnidadMedida {
  id_unidad_medida?: number;
  nombre: string;
  abreviatura?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UnidadMedidaService {

  private readonly apiUrl = 'https://backend-sirae-pyim.onrender.com/api/unidades_medida/';

  constructor(private http: HttpClient) {}

  // Cambiado a <any> para prevenir conflictos si Django devuelve paginación
  getUnidades(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  getUnidad(id: number): Observable<UnidadMedida> {
    return this.http.get<UnidadMedida>(`${this.apiUrl}${id}/`);
  }

  crearUnidad(unidad: UnidadMedida): Observable<UnidadMedida> {
    return this.http.post<UnidadMedida>(this.apiUrl, unidad);
  }

  actualizarUnidad(id: number, unidad: UnidadMedida): Observable<UnidadMedida> {
    return this.http.put<UnidadMedida>(`${this.apiUrl}${id}/`, unidad);
  }

  eliminarUnidad(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}${id}/`);
  }
}