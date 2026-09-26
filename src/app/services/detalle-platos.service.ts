import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DetallePlatosService {
  private readonly apiUrl = 'https://backend-sirae-pyim.onrender.com/api/detalle_platos/';

  constructor(private http: HttpClient) {}

  getDetalles(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getDetalle(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}${id}/`);
  }

  createDetalle(detalle: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, detalle);
  }

  updateDetalle(id: number, detalle: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}${id}/`, detalle);
  }

  deleteDetalle(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}${id}/`);
  }
}
