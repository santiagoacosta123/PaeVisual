import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface DetallePlato {
  id_detalle_plato: number;
  id_menu: number | null;
  id_plato: number;
  porcion_por_nino: number | null;
  total_a_preparar: number | null;
  unidad_total: string | null;
  estado_preparacion: string | null;
}

export type DetallePlatoPayload = Omit<DetallePlato, 'id_detalle_plato'>;

@Injectable({
  providedIn: 'root'
})
export class DetallePlatosService {
  private readonly apiUrl = `${environment.apiUrl}/detalle_plato/`;

  constructor(private http: HttpClient) {}

  getDetalles(): Observable<DetallePlato[]> {
    return this.http.get<DetallePlato[]>(this.apiUrl);
  }

  getDetalle(id: number): Observable<DetallePlato> {
    return this.http.get<DetallePlato>(`${this.apiUrl}${id}/`);
  }

  createDetalle(detalle: DetallePlatoPayload): Observable<DetallePlato> {
    return this.http.post<DetallePlato>(this.apiUrl, detalle);
  }

  updateDetalle(id: number, detalle: DetallePlatoPayload): Observable<DetallePlato> {
    return this.http.put<DetallePlato>(`${this.apiUrl}${id}/`, detalle);
  }

  deleteDetalle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}
