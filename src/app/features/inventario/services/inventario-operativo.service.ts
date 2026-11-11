import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '@env/environment';

export interface IngredienteInventario {
  id: number;
  nombre: string;
  unidadId: number | null;
  categoriaId: number | null;
}

export interface UnidadInventario {
  id: number;
  nombre: string;
  abreviatura: string;
}

export interface CategoriaInventarioCatalogo {
  id: number;
  nombre: string;
}

export interface SaldoInventario {
  id: number;
  ingredienteId: number;
  cantidad: number;
  stockMinimo: number;
  unidadId: number;
}

export interface EntradaInventarioPayload {
  id_ingrediente: number;
  cantidad: number;
  id_unidad_medida: number;
  observaciones: string;
}

export interface EntradaInventarioRegistro {
  id: number;
  ingredienteId: number;
  fecha: string;
  cantidad: number;
  unidadId: number;
  observaciones: string;
}

export interface SalidaInventarioRegistro {
  id: number;
  ingredienteId: number;
  usuarioId: number | null;
  fecha: string;
  cantidad: number;
  unidadId: number;
  observaciones: string;
}

interface ApiRecord {
  [key: string]: unknown;
  id?: unknown;
  id_categoria_inventario?: unknown;
  id_entrada?: unknown;
  id_salida?: unknown;
  id_ingrediente?: unknown;
  id_inventario?: unknown;
  id_unidad_medida?: unknown;
  nombre?: unknown;
  nombre_ingrediente?: unknown;
  nombre_unidad?: unknown;
  abreviatura?: unknown;
  simbolo?: unknown;
  cantidad?: unknown;
  cantidad_actual?: unknown;
  stock_minimo?: unknown;
  fecha?: unknown;
  observaciones?: unknown;
}

@Injectable({ providedIn: 'root' })
export class InventarioOperativoService {
  private readonly baseUrl = environment.apiUrl;

  private cacheIngredientes: IngredienteInventario[] | null = null;
  private cacheUnidades: UnidadInventario[] | null = null;
  private cacheCategorias: CategoriaInventarioCatalogo[] | null = null;

  constructor(private http: HttpClient) {}

  cargarIngredientes(forzarRecarga = false): Observable<IngredienteInventario[]> {
    if (!forzarRecarga && this.cacheIngredientes) {
      return of(this.cacheIngredientes);
    }
    return this.http.get<unknown>(`${this.baseUrl}/ingredientes/`).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_ingrediente ?? item.id),
        nombre: String(item.nombre_ingrediente ?? item.nombre ?? ''),
        unidadId: this.numeroOpcional(item.id_unidad_medida),
        categoriaId: this.numeroOpcional(item.id_categoria_inventario),
      }))),
      tap(lista => this.cacheIngredientes = lista)
    );
  }

  cargarUnidades(forzarRecarga = false): Observable<UnidadInventario[]> {
    if (!forzarRecarga && this.cacheUnidades) {
      return of(this.cacheUnidades);
    }
    return this.http.get<unknown>(`${this.baseUrl}/unidades_medida/`).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_unidad_medida ?? item.id),
        nombre: String(item.nombre ?? item.nombre_unidad ?? ''),
        abreviatura: String(item.abreviatura ?? item.simbolo ?? ''),
      }))),
      tap(lista => this.cacheUnidades = lista)
    );
  }

  cargarCategorias(forzarRecarga = false): Observable<CategoriaInventarioCatalogo[]> {
    if (!forzarRecarga && this.cacheCategorias) {
      return of(this.cacheCategorias);
    }
    return this.http.get<unknown>(`${this.baseUrl}/categorias_inventario/`).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item['id_categoria_inventario'] ?? item.id),
        nombre: String(item['nombre_categoria'] ?? item.nombre ?? '').trim() || 'Sin categoría',
      }))),
      tap(lista => this.cacheCategorias = lista)
    );
  }

  cargarSaldos(): Observable<SaldoInventario[]> {
    return this.http.get<unknown>(`${this.baseUrl}/inventario/`).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_inventario ?? item.id),
        ingredienteId: Number(item.id_ingrediente),
        cantidad: Number(item.cantidad_actual ?? 0),
        stockMinimo: Number(item.stock_minimo ?? 0),
        unidadId: Number(item.id_unidad_medida),
      })))
    );
  }

  cargarEntradas(): Observable<EntradaInventarioRegistro[]> {
    return this.http.get<unknown>(`${this.baseUrl}/entradas-inventario/`).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_entrada ?? item.id),
        ingredienteId: Number(item.id_ingrediente),
        fecha: String(item.fecha ?? ''),
        cantidad: Number(item.cantidad ?? 0),
        unidadId: Number(item.id_unidad_medida),
        observaciones: String(item.observaciones ?? ''),
      })))
    );
  }

  cargarSalidas(): Observable<SalidaInventarioRegistro[]> {
    return this.http.get<unknown>(`${this.baseUrl}/salidas-inventario/`).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_salida ?? item.id),
        ingredienteId: Number(item.id_ingrediente),
        usuarioId: this.numeroOpcional(item['id_usuario']),
        fecha: String(item.fecha ?? ''),
        cantidad: Number(item.cantidad ?? 0),
        unidadId: Number(item.id_unidad_medida),
        observaciones: String(item.observaciones ?? ''),
      })))
    );
  }

  registrarEntrada(payload: EntradaInventarioPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/entradas-inventario/`, payload);
  }

  // ---------- Métodos agregados para soporte de Excel (SP-249 y SP-258) ----------
  
  exportarInventarioExcel(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/inventario/exportar-excel/`, {
      responseType: 'blob'
    });
  }

  exportarEntradasExcel(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/entradas-inventario/exportar-excel/`, {
      responseType: 'blob'
    });
  }

  private listaDe(data: unknown): ApiRecord[] {
    if (Array.isArray(data)) return data as ApiRecord[];
    if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
      return (data as { results: ApiRecord[] }).results;
    }
    throw new Error('El backend devolvió una respuesta de inventario no válida.');
  }

  private numeroOpcional(value: unknown): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
