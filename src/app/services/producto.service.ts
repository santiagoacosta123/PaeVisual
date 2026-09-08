import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {

  private apiInventario = 'http://127.0.0.1:8000/api/inventario/';
  private apiIngredientes = 'http://127.0.0.1:8000/api/ingredientes/';
  private apiUnidades = 'http://127.0.0.1:8000/api/unidades/';
  private apiCategorias = 'http://127.0.0.1:8000/api/categorias/';

  constructor(private http: HttpClient) {}

  // INVENTARIO
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
    return this.http.put<any>(
      `${this.apiInventario}${id}/`,
      producto
    );
  }

  eliminarProducto(id: number): Observable<any> {
    console.log('➡️ DELETE:', `${this.apiInventario}${id}/`);
    return this.http.delete<any>(
      `${this.apiInventario}${id}/`
    );
  }

  // INGREDIENTES
  getIngredientes(): Observable<any> {
    console.log('➡️ GET:', this.apiIngredientes);
    return this.http.get<any>(this.apiIngredientes);
  }

  // UNIDADES
  getUnidades(): Observable<any> {
    console.log('➡️ GET:', this.apiUnidades);
    return this.http.get<any>(this.apiUnidades);
  }

  // CATEGORÍAS
  getCategorias(): Observable<any> {
    console.log('➡️ GET:', this.apiCategorias);
    return this.http.get<any>(this.apiCategorias);
  }
}