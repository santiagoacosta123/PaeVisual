import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {

  
  private apiInventario = `${environment.apiUrl}/inventario/`;
  private apiIngredientes = `${environment.apiUrl}/ingredientes/`;
  private apiUnidades = `${environment.apiUrl}/unidades_medida/`;
  private apiCategorias = `${environment.apiUrl}/categorias_inventario/`;
  
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
    return this.http.put<any>(`${this.apiInventario}${id}/`, producto);
  }

  eliminarProducto(id: number): Observable<any> {
    console.log('➡️ DELETE:', `${this.apiInventario}${id}/`);
    return this.http.delete<any>(`${this.apiInventario}${id}/`);
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
