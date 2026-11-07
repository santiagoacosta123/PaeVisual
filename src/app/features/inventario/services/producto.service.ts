import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {

  private apiInventario = `${environment.apiUrl}/inventario/`;
  private apiIngredientes = `${environment.apiUrl}/ingredientes/`;
  private apiUnidades = `${environment.apiUrl}/unidades_medida/`;
  private apiCategorias = `${environment.apiUrl}/categorias_inventario/`;

  // Caché en memoria para catálogos que cambian poco
  private cacheCategorias: any = null;
  private cacheUnidades: any = null;
  private cacheIngredientes: any = null;

  constructor(private http: HttpClient) {}

  // INVENTARIO (Siempre fresco)
  getProductos(): Observable<any> {
    console.log('➡️ GET:', this.apiInventario);
    return this.http.get<any>(this.apiInventario);
  }

  crearProducto(producto: any): Observable<any> {
    console.log('➡️ POST:', this.apiInventario, producto);
    return this.http.post<any>(this.apiInventario, producto);
  }

  actualizarProducto(id: number, producto: any): Observable<any> {
    console.log('➡️ PUT:', `${this.apiInventario}${id}/`, producto);
    return this.http.put<any>(`${this.apiInventario}${id}/`, producto);
  }

  eliminarProducto(id: number): Observable<any> {
    console.log('➡️ DELETE:', `${this.apiInventario}${id}/`);
    return this.http.delete<any>(`${this.apiInventario}${id}/`);
  }

  // INGREDIENTES (Con caché en memoria)
  getIngredientes(forzarRecarga = false): Observable<any> {
    if (!forzarRecarga && this.cacheIngredientes) {
      return of(this.cacheIngredientes);
    }
    console.log('➡️ GET:', this.apiIngredientes);
    return this.http.get<any>(this.apiIngredientes).pipe(
      tap(data => this.cacheIngredientes = data)
    );
  }

  limpiarCacheIngredientes(): void {
    this.cacheIngredientes = null;
  }

  // UNIDADES (Con caché en memoria)
  getUnidades(forzarRecarga = false): Observable<any> {
    if (!forzarRecarga && this.cacheUnidades) {
      return of(this.cacheUnidades);
    }
    console.log('➡️ GET:', this.apiUnidades);
    return this.http.get<any>(this.apiUnidades).pipe(
      tap(data => this.cacheUnidades = data)
    );
  }

  limpiarCacheUnidades(): void {
    this.cacheUnidades = null;
  }

  // CATEGORÍAS (Con caché en memoria)
  getCategorias(forzarRecarga = false): Observable<any> {
    if (!forzarRecarga && this.cacheCategorias) {
      return of(this.cacheCategorias);
    }
    console.log('➡️ GET:', this.apiCategorias);
    return this.http.get<any>(this.apiCategorias).pipe(
      tap(data => this.cacheCategorias = data)
    );
  }

  limpiarCacheCategorias(): void {
    this.cacheCategorias = null;
  }

  // ENTRADAS
  private apiEntradas = `${environment.apiUrl}/entradas-inventario/`;

  getEntradas(): Observable<any> {
    return this.http.get<any>(this.apiEntradas);
  }

  crearEntrada(entrada: any): Observable<any> {
    return this.http.post<any>(this.apiEntradas, entrada);
  }

  // SALIDAS
  private apiSalidas = `${environment.apiUrl}/salidas-inventario/`;

  getSalidas(): Observable<any> {
    return this.http.get<any>(this.apiSalidas);
  }

  crearSalida(salida: any): Observable<any> {
    return this.http.post<any>(this.apiSalidas, salida);
  }
}
