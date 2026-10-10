import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MenuRegistro {
  id_menu: number;
  id_jornada: number;
  fecha: string;
  ninos_presentes: number;
  estado: string;
  informacion_nutricional: string;
  id_contrato: number;
  nombre_jornada?: string;
  institucion?: string;
}

export type MenuPayload = Omit<MenuRegistro, 'id_menu' | 'nombre_jornada' | 'institucion'>;

@Injectable({ providedIn: 'root' })
export class MenusService {
  private readonly url = `${environment.apiUrl}/menus/`;

  constructor(private http: HttpClient) {}

  listar(): Observable<MenuRegistro[]> {
    return this.http.get<unknown>(this.url).pipe(
      map(data => this.listaDe(data).map(item => ({
        id_menu: Number(item['id_menu']),
        id_jornada: Number(item['id_jornada']),
        fecha: String(item['fecha'] ?? ''),
        ninos_presentes: Number(item['ninos_presentes'] ?? 0),
        estado: String(item['estado'] ?? ''),
        informacion_nutricional: String(item['informacion_nutricional'] ?? ''),
        id_contrato: Number(item['id_contrato']),
      })))
    );
  }

  crear(payload: MenuPayload): Observable<MenuRegistro> {
    return this.http.post<MenuRegistro>(this.url, payload);
  }

  actualizar(id: number, payload: MenuPayload): Observable<MenuRegistro> {
    return this.http.put<MenuRegistro>(`${this.url}${id}/`, payload);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}${id}/`);
  }

  private listaDe(data: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
    if (
      data
      && typeof data === 'object'
      && 'results' in data
      && Array.isArray(data['results'])
    ) {
      return data['results'] as Array<Record<string, unknown>>;
    }
    throw new Error('El backend devolvió una respuesta de menús no válida.');
  }
}
