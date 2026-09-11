import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Menu } from '../models/menu';

@Injectable({
  providedIn: 'root'
})
export class MenusService {

  private apiUrl = 'http://127.0.0.1:8000/api/menus/';
  private storageKey = 'sirae_menus';

  private defaultMenus: Menu[] = [
    {
      id_menu: 1,
      id_jornada: 1,
      fecha: '2026-09-11',
      ninos_presentes: 45,
      estado: 'Activo',
      informacion_nutricional: 'Arroz con pollo, ensalada fresca de verduras y jugo de guayaba.',
      id_contrato: 101
    },
    {
      id_menu: 2,
      id_jornada: 2,
      fecha: '2026-09-11',
      ninos_presentes: 38,
      estado: 'Activo',
      informacion_nutricional: 'Sopa de lentejas con carne magra, puré de papa y fruta fresca.',
      id_contrato: 101
    }
  ];

  constructor(private http: HttpClient) {}

  private getLocal(): Menu[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        return JSON.parse(data);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(this.defaultMenus));
      return this.defaultMenus;
    } catch {
      return this.defaultMenus;
    }
  }

  private saveLocal(items: Menu[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage', e);
    }
  }

  // LISTAR
  obtenerMenus(): Observable<Menu[]> {
    return this.http.get<Menu[]>(this.apiUrl).pipe(
      tap((data) => this.saveLocal(data)),
      catchError((error) => {
        console.warn('Backend no disponible para menús, usando almacenamiento local:', error);
        return of(this.getLocal());
      })
    );
  }

  // CREAR
  crearMenu(menu: Menu): Observable<Menu> {
    return this.http.post<Menu>(this.apiUrl, menu).pipe(
      tap((creado) => {
        const list = this.getLocal();
        list.push(creado);
        this.saveLocal(list);
      }),
      catchError(() => {
        const list = this.getLocal();
        const nextId = list.length > 0 ? Math.max(...list.map(m => m.id_menu || 0)) + 1 : 1;
        const nuevo: Menu = {
          ...menu,
          id_menu: nextId
        };
        list.push(nuevo);
        this.saveLocal(list);
        return of(nuevo);
      })
    );
  }

  // EDITAR
  editarMenu(id: number, menu: Menu): Observable<Menu> {
    return this.http.put<Menu>(`${this.apiUrl}${id}/`, menu).pipe(
      tap((actualizado) => {
        const list = this.getLocal().map(m => m.id_menu === id ? actualizado : m);
        this.saveLocal(list);
      }),
      catchError(() => {
        const list = this.getLocal().map(m => {
          if (m.id_menu === id) {
            return { ...menu, id_menu: id };
          }
          return m;
        });
        this.saveLocal(list);
        return of({ ...menu, id_menu: id });
      })
    );
  }

  // ELIMINAR
  eliminarMenu(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`).pipe(
      tap(() => {
        const list = this.getLocal().filter(m => m.id_menu !== id);
        this.saveLocal(list);
      }),
      catchError(() => {
        const list = this.getLocal().filter(m => m.id_menu !== id);
        this.saveLocal(list);
        return of(undefined as unknown as void);
      })
    );
  }
}

