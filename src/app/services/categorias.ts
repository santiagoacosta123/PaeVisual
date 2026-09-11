import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface Categoria {
  id_categoria_inventario?: number;
  nombre_categoria: string;
}

@Injectable({
  providedIn: 'root'
})
export class Categorias {

  private apiUrl = 'http://127.0.0.1:8000/api/categorias-inventario/';
  private storageKey = 'sirae_categorias_inventario';

  private defaultCategorias: Categoria[] = [
    { id_categoria_inventario: 1, nombre_categoria: 'Lácteos y Derivados' },
    { id_categoria_inventario: 2, nombre_categoria: 'Frutas y Verduras' },
    { id_categoria_inventario: 3, nombre_categoria: 'Carnes y Proteínas' },
    { id_categoria_inventario: 4, nombre_categoria: 'Granos y Cereales' }
  ];

  constructor(private http: HttpClient) {}

  private getLocal(): Categoria[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        return JSON.parse(data);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(this.defaultCategorias));
      return this.defaultCategorias;
    } catch {
      return this.defaultCategorias;
    }
  }

  private saveLocal(items: Categoria[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage', e);
    }
  }

  // LISTAR
  obtenerCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.apiUrl).pipe(
      tap((data) => this.saveLocal(data)),
      catchError((error) => {
        console.warn('Backend no disponible para categorías, usando almacenamiento local:', error);
        return of(this.getLocal());
      })
    );
  }

  // CREAR
  crearCategoria(categoria: Categoria): Observable<Categoria> {
    return this.http.post<Categoria>(this.apiUrl, categoria).pipe(
      tap((creada) => {
        const list = this.getLocal();
        list.push(creada);
        this.saveLocal(list);
      }),
      catchError(() => {
        const list = this.getLocal();
        const nextId = list.length > 0 ? Math.max(...list.map(c => c.id_categoria_inventario || 0)) + 1 : 1;
        const nueva: Categoria = {
          id_categoria_inventario: nextId,
          nombre_categoria: categoria.nombre_categoria
        };
        list.push(nueva);
        this.saveLocal(list);
        return of(nueva);
      })
    );
  }

  // EDITAR
  editarCategoria(
    id: number,
    categoria: Categoria
  ): Observable<Categoria> {
    return this.http.put<Categoria>(
      `${this.apiUrl}${id}/`,
      categoria
    ).pipe(
      tap((actualizada) => {
        const list = this.getLocal().map(c => c.id_categoria_inventario === id ? actualizada : c);
        this.saveLocal(list);
      }),
      catchError(() => {
        const list = this.getLocal().map(c => {
          if (c.id_categoria_inventario === id) {
            return { ...c, nombre_categoria: categoria.nombre_categoria };
          }
          return c;
        });
        this.saveLocal(list);
        return of({ id_categoria_inventario: id, nombre_categoria: categoria.nombre_categoria });
      })
    );
  }

  // ELIMINAR
  eliminarCategoria(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}${id}/`
    ).pipe(
      tap(() => {
        const list = this.getLocal().filter(c => c.id_categoria_inventario !== id);
        this.saveLocal(list);
      }),
      catchError(() => {
        const list = this.getLocal().filter(c => c.id_categoria_inventario !== id);
        this.saveLocal(list);
        return of(undefined as unknown as void);
      })
    );
  }
}