import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Plato {
  id_plato: number;
  id_seccion: number | null;
  nombre_plato: string | null;
  componente: string | null;
}

export type PlatoPayload = Omit<Plato, 'id_plato'>;

@Injectable({
  providedIn: 'root'
})
export class PlatosService {
  private readonly apiUrl = `${environment.apiUrl}/platos/`;

  constructor(private http: HttpClient) {}

  getPlatos(): Observable<Plato[]> {
    return this.http.get<Plato[]>(this.apiUrl);
  }

  getPlato(id: number): Observable<Plato> {
    return this.http.get<Plato>(`${this.apiUrl}${id}/`);
  }

  createPlato(plato: PlatoPayload): Observable<Plato> {
    return this.http.post<Plato>(this.apiUrl, plato);
  }

  updatePlato(id: number, plato: PlatoPayload): Observable<Plato> {
    return this.http.put<Plato>(`${this.apiUrl}${id}/`, plato);
  }

  deletePlato(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}
