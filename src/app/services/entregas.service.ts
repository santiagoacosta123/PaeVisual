import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface Entrega {
  id?: number;
  ingrediente: string;
  tipoMercado: string;      // siempre 'Granos' o 'Perecederos'
  frecuencia: string;
  cantidad: number | null;
  unidad: string;
  fechaRecepcion: string;   // YYYY-MM-DD
  fechaVencimiento: string; // YYYY-MM-DD
}

/**
 * Servicio compartido: carga las entregas desde el backend y las deja en
 * `entregas` para que las usen "Historial/Registrar" y "Filtrar por tipo de mercado".
 * Va en la carpeta registrar-entrega-alimentos.
 */
@Injectable({ providedIn: 'root' })
export class EntregasService {

  readonly apiUrl = 'https://backend-sirae-pyim.onrender.com/api/entregas/';

  // Lista compartida (viene del backend, sin datos de ejemplo)
  entregas: Entrega[] = [];

  constructor(private http: HttpClient) {}

  // ---------- Cabeceras con token ----------
  getHeaders(): { headers: HttpHeaders } {
    const rawToken = localStorage.getItem('token') ||
                     localStorage.getItem('access') ||
                     localStorage.getItem('access_token') ||
                     localStorage.getItem('auth_token') ||
                     localStorage.getItem('user_token') || '';

    const cleanToken = rawToken.replace(/^(Bearer|Token)\s+/i, '').trim();

    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    if (cleanToken) {
      const prefix = rawToken.startsWith('Bearer ') ? 'Bearer' : 'Token';
      headers = headers.set('Authorization', `${prefix} ${cleanToken}`);
    }
    return { headers };
  }

  // ---------- Cargar desde el backend ----------
  cargar(): Observable<Entrega[]> {
    return this.http.get<any>(this.apiUrl, this.getHeaders()).pipe(
      map(data => {
        const lista: any[] = Array.isArray(data) ? data : (data?.results ?? []);
        return lista.map(item => this.normalizar(item));
      }),
      tap(lista => (this.entregas = lista))
    );
  }

  private normalizar(item: any): Entrega {
    return {
      id: item.id,
      ingrediente: item.ingrediente || item.ingrediente_nombre || '',
      tipoMercado: this.normalizarMercado(item.tipoMercado || item.tipo_mercado),
      frecuencia: item.frecuencia || 'Mensual',
      cantidad: item.cantidad ? Number(item.cantidad) : 0,
      unidad: this.normalizarUnidad(item.unidad) || 'Kg',
      fechaRecepcion: this.soloFecha(item.fechaRecepcion || item.fecha_recepcion),
      fechaVencimiento: this.soloFecha(item.fechaVencimiento || item.fecha_vencimiento)
    };
  }

  // "Granos / No perecederos", "granos", etc. -> 'Granos'   |   "Perecederos" -> 'Perecederos'
  normalizarMercado(valor: any): string {
    const v = String(valor ?? '').toLowerCase().trim();
    return v.startsWith('perecedero') ? 'Perecederos' : 'Granos';
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