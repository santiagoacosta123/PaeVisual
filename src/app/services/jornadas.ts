import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Jornada } from '../models/jornada';

@Injectable({
  providedIn: 'root'
})
export class JornadasService {

  private apiUrl = 'http://127.0.0.1:8000/api/jornadas/';
  private storageKey = 'sirae_jornadas';

  private defaultJornadas: Jornada[] = [
    { id_jornada: 1, nombre_jornada: 'Jornada Mañana' },
    { id_jornada: 2, nombre_jornada: 'Jornada Tarde' },
    { id_jornada: 3, nombre_jornada: 'Jornada Única' }
  ];

  constructor(private http: HttpClient) {}

  private getLocal(): Jornada[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        return JSON.parse(data);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(this.defaultJornadas));
      return this.defaultJornadas;
    } catch {
      return this.defaultJornadas;
    }
  }

  private saveLocal(items: Jornada[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage', e);
    }
  }

  // LISTAR
  obtenerJornadas(): Observable<Jornada[]> {
    return this.http.get<Jornada[]>(this.apiUrl).pipe(
      tap((data) => this.saveLocal(data)),
      catchError((error) => {
        console.warn('Backend no disponible para jornadas, usando almacenamiento local:', error);
        return of(this.getLocal());
      })
    );
  }

  // CREAR
  crearJornada(jornada: Jornada): Observable<Jornada> {
    return this.http.post<Jornada>(this.apiUrl, jornada).pipe(
      tap((creada) => {
        const list = this.getLocal();
        list.push(creada);
        this.saveLocal(list);
      }),
      catchError(() => {
        const list = this.getLocal();
        const nextId = list.length > 0 ? Math.max(...list.map(j => j.id_jornada || 0)) + 1 : 1;
        const nueva: Jornada = {
          id_jornada: nextId,
          nombre_jornada: jornada.nombre_jornada
        };
        list.push(nueva);
        this.saveLocal(list);
        return of(nueva);
      })
    );
  }

  // EDITAR
  editarJornada(id: number, jornada: Jornada): Observable<Jornada> {
    return this.http.put<Jornada>(`${this.apiUrl}${id}/`, jornada).pipe(
      tap((actualizada) => {
        const list = this.getLocal().map(j => j.id_jornada === id ? actualizada : j);
        this.saveLocal(list);
      }),
      catchError(() => {
        const list = this.getLocal().map(j => {
          if (j.id_jornada === id) {
            return { ...j, nombre_jornada: jornada.nombre_jornada };
          }
          return j;
        });
        this.saveLocal(list);
        return of({ id_jornada: id, nombre_jornada: jornada.nombre_jornada });
      })
    );
  }

  // ELIMINAR
  eliminarJornada(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`).pipe(
      tap(() => {
        const list = this.getLocal().filter(j => j.id_jornada !== id);
        this.saveLocal(list);
      }),
      catchError(() => {
        const list = this.getLocal().filter(j => j.id_jornada !== id);
        this.saveLocal(list);
        return of(undefined as unknown as void);
      })
    );
  }
}

