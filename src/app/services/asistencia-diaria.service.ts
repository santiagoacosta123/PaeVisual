import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AsistenciaDiaria {
  id_asistencia: number;
  id_grado: number;
  fecha: string;
  ninos_presentes: number;
  id_usuario_manipuladora: number | null;
}

export interface GradoAsistencia {
  id_grado: number;
  nombre_grado: string;
}

export interface AsistenciaDiariaPayload {
  id_grado: number;
  fecha: string;
  ninos_presentes: number;
  id_usuario_manipuladora: number;
}

@Injectable({ providedIn: 'root' })
export class AsistenciaDiariaService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAsistencias(): Observable<AsistenciaDiaria[]> {
    return this.http.get<unknown>(`${this.baseUrl}/asistencia-diaria/`).pipe(
      map(data => this.listaDe(data).map(item => ({
        id_asistencia: Number(item['id_asistencia']),
        id_grado: Number(item['id_grado']),
        fecha: String(item['fecha'] ?? ''),
        ninos_presentes: Number(item['ninos_presentes'] ?? 0),
        id_usuario_manipuladora: item['id_usuario_manipuladora'] == null
          ? null
          : Number(item['id_usuario_manipuladora']),
      })))
    );
  }

  getGrados(): Observable<GradoAsistencia[]> {
    return this.http.get<unknown>(`${this.baseUrl}/grados/`).pipe(
      map(data => this.listaDe(data).map(item => ({
        id_grado: Number(item['id_grado']),
        nombre_grado: String(item['nombre_grado'] ?? ''),
      })))
    );
  }

  registrar(payload: AsistenciaDiariaPayload): Observable<AsistenciaDiaria> {
    return this.http.post<AsistenciaDiaria>(`${this.baseUrl}/asistencia-diaria/`, payload);
  }

  actualizar(id: number, payload: AsistenciaDiariaPayload): Observable<AsistenciaDiaria> {
    return this.http.put<AsistenciaDiaria>(`${this.baseUrl}/asistencia-diaria/${id}/`, payload);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/asistencia-diaria/${id}/`);
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
    throw new Error('El backend devolvió una respuesta de asistencia no válida.');
  }
}
