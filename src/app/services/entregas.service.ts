import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Entrega {
  id?: number;
  idIngrediente?: number;
  idTipoMercado?: number;
  ingrediente: string;
  tipoMercado: string;
  frecuencia: string;
  cantidad: number | null;
  unidad: string;
  fechaRecepcion: string;
  fechaVencimiento: string;
  observaciones?: string;
}

export interface IngredienteOpcion {
  id: number;
  nombre: string;
}

export interface TipoMercadoOpcion {
  id: number;
  nombre: string;
}

export interface EntregaPayload {
  id_ingrediente: number;
  id_tipo_mercado: number;
  fecha_entrega: string;
  fecha_vencimiento: string;
  cantidad: number;
  observaciones: string;
  frecuencia: string;
  unidad: string;
}

/**
 * Servicio compartido: carga las entregas desde el backend y las deja en
 * `entregas` para que las usen "Historial/Registrar" y "Filtrar por tipo de mercado".
 * Va en la carpeta registrar-entrega-alimentos.
 */
@Injectable({ providedIn: 'root' })
export class EntregasService {

  public readonly apiUrl = `${environment.apiUrl}/entregas/`;
  private readonly ingredientesUrl = `${environment.apiUrl}/ingredientes/`;
  private readonly tiposMercadoUrl = `${environment.apiUrl}/tipos-mercado/`;
  entregas: Entrega[] = [];

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // ---------- Cabeceras con token ----------
  getHeaders(): { headers: HttpHeaders } {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return { headers };
  }

  cargarIngredientes(): Observable<IngredienteOpcion[]> {
    return this.http.get<any>(this.ingredientesUrl, this.getHeaders()).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_ingrediente),
        nombre: String(item.nombre_ingrediente ?? ''),
      })))
    );
  }

  cargarTiposMercado(): Observable<TipoMercadoOpcion[]> {
    return this.http.get<any>(this.tiposMercadoUrl, this.getHeaders()).pipe(
      map(data => this.listaDe(data).map(item => ({
        id: Number(item.id_tipo_mercado),
        nombre: String(item.nombre_tipo ?? ''),
      })))
    );
  }

  // ---------- Cargar desde el backend ----------
  cargar(): Observable<Entrega[]> {
    return this.http.get<any>(this.apiUrl, this.getHeaders()).pipe(
      map(data => this.listaDe(data).map(item => this.normalizar(item))),
      tap(lista => (this.entregas = lista))
    );
  }

  registrar(payload: EntregaPayload): Observable<unknown> {
    return this.http.post(this.apiUrl, payload, this.getHeaders());
  }

  actualizar(id: number, payload: EntregaPayload): Observable<unknown> {
    return this.http.put(`${this.apiUrl}${id}/`, payload, this.getHeaders());
  }

  eliminar(id: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}${id}/`, this.getHeaders());
  }

  // ---------- Métodos agregados para completar Historias de Usuario Jira ----------
  
  // SP-246: Obtener detalle individual de una entrega
  getEntregaPorId(id: number): Observable<Entrega> {
    return this.http.get<any>(`${this.apiUrl}${id}/`, this.getHeaders()).pipe(
      map(item => this.normalizar(item))
    );
  }

  // SP-249: Exportar el historial de entregas a Excel
  exportarExcel(): Observable<Blob> {
    const headersConfig = this.getHeaders();
    return this.http.get(`${this.apiUrl}exportar-excel/`, {
      headers: headersConfig.headers,
      responseType: 'blob'
    });
  }
  // ------------------------------------------------------------------------------

  private listaDe(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    throw new Error('El backend devolvió una respuesta de lista no válida.');
  }

  private normalizar(item: any): Entrega {
    return {
      id: Number(item.id_entrega ?? item.id),
      idIngrediente: Number(item.id_ingrediente ?? item.idIngrediente),
      idTipoMercado: Number(item.id_tipo_mercado ?? item.idTipoMercado),
      ingrediente: String(item.ingrediente_nombre ?? item.ingrediente ?? ''),
      tipoMercado: this.normalizarMercado(
        item.tipo_mercado_nombre ?? item.tipoMercado ?? item.tipo_mercado
      ),
      frecuencia: String(item.frecuencia ?? ''),
      cantidad: item.cantidad == null ? null : Number(item.cantidad),
      unidad: this.normalizarUnidad(item.unidad),
      fechaRecepcion: this.soloFecha(item.fecha_entrega ?? item.fechaRecepcion ?? item.fecha_recepcion),
      fechaVencimiento: this.soloFecha(item.fecha_vencimiento ?? item.fechaVencimiento),
      observaciones: String(item.observaciones ?? ''),
    };
  }

  // "Granos / No perecederos", "granos", etc. -> 'Granos'   |   "Perecederos" -> 'Perecederos'
  normalizarMercado(valor: any): string {
    const v = String(valor ?? '').toLowerCase().trim();
    if (v.startsWith('perecedero')) return 'Perecederos';
    if (v.startsWith('grano') || v.startsWith('no perecedero')) return 'Granos';
    return String(valor ?? '');
  }

  normalizarUnidad(valor: any): string {
    const original = String(valor ?? '');
    const u = original.toLowerCase();
    if (u.includes('kg') || u.includes('kilo')) return 'Kg';
    if (u.includes('lit') || u === 'l') return 'Litros';
    if (u.includes('unid') || u === 'ud') return 'Unidades';
    return original;
  }

  // Por si el backend manda fecha con hora (2026-10-12T00:00:00Z)
  soloFecha(valor: any): string {
    return String(valor ?? '').substring(0, 10);
  }

  // ---------- Estado y alertas ----------
  umbralAlerta(e: any): number {
    return e.tipoMercado === 'Perecederos' ? 7 : 30;
  }

  diasRestantes(e: any): number {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vence = new Date(e.fechaVencimiento + 'T00:00:00');
    return Math.round((vence.getTime() - hoy.getTime()) / 86400000);
  }

  obtenerEstado(e: any): string {
    if (!e.fechaVencimiento) return 'Vigente';
    const dias = this.diasRestantes(e);
    if (dias < 0) return 'Vencido';
    if (dias <= this.umbralAlerta(e)) return 'Próximo a vencer';
    return 'Vigente';
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'Vigente':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Vencido':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  }
}