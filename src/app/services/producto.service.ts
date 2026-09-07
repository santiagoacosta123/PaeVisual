import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Producto } from '../models/producto.model';

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private productos: Producto[] = [
    { id: 1, nombre: 'Arroz', categoria: 'Grano', stock: 50 },
    { id: 2, nombre: 'Leche', categoria: 'Lacteo', stock: 20 },
    { id: 3, nombre: 'Queso', categoria: 'Lacteo', stock: 12 },
    { id: 4, nombre: 'Frijoles', categoria: 'Grano', stock: 35 }
  ];

  getProductos(): Observable<Producto[]> {
    return of(this.productos);
  }

  crearProducto(producto: Producto): Observable<Producto> {
    const nuevo = { ...producto, id: Date.now() };
    this.productos.push(nuevo);
    return of(nuevo);
  }

  actualizarProducto(id: number, producto: Producto): Observable<Producto> {
    const index = this.productos.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.productos[index] = { ...producto, id };
      return of(this.productos[index]);
    }
    return of(producto);
  }

  eliminarProducto(id: number): Observable<boolean> {
    this.productos = this.productos.filter((p) => p.id !== id);
    return of(true);
  }
}
