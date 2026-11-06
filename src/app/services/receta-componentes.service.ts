import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface RecetaComponente {
  id_receta_componente: number;
  id_plato: number;
  id_ingrediente: number;
  cantidad: number;
  base_cantidad: 'POR_NINO' | 'TOTAL_PREPARACION' | null;
  porciones_base: number | null;
}

export type RecetaComponentePayload = Omit<RecetaComponente, 'id_receta_componente'>;

@Injectable({ providedIn: 'root' })
export class RecetaComponentesService {
  private readonly apiUrl = `${environment.apiUrl}/receta-componentes/`;

  constructor(private http: HttpClient) {}

  listar(): Observable<RecetaComponente[]> {
    return this.http.get<RecetaComponente[]>(this.apiUrl);
  }

  crear(payload: RecetaComponentePayload): Observable<RecetaComponente> {
    return this.http.post<RecetaComponente>(this.apiUrl, payload);
  }

  actualizar(id: number, payload: RecetaComponentePayload): Observable<RecetaComponente> {
    return this.http.put<RecetaComponente>(`${this.apiUrl}${id}/`, payload);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}
