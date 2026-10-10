import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

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

  constructor(private http: HttpClient) {}

  cargarIngredientes(): Observable<IngredienteInventario[]> {
    return this.http.get<unknown>(`${this.baseUrl}/ingredientes/`).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_ingrediente ?? item.id),
        nombre: String(item.nombre_ingrediente ?? item.nombre ?? ''),
        unidadId: this.numeroOpcional(item.id_unidad_medida),
        categoriaId: this.numeroOpcional(item.id_categoria_inventario),
      })))
    );
  }

  cargarUnidades(): Observable<UnidadInventario[]> {
    return this.http.get<unknown>(`${this.baseUrl}/unidades_medida/`).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_unidad_medida ?? item.id),
        nombre: String(item.nombre ?? item.nombre_unidad ?? ''),
        abreviatura: String(item.abreviatura ?? item.simbolo ?? ''),
      })))
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
