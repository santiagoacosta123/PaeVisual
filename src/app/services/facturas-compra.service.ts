import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService } from '../services/auth.service';

export interface DetalleFacturaPayload {
  id_ingrediente: number;
  cantidad: number;
  precio_unitario: number;
  subtotal?: number;
  numero_lote?: string;
  fecha_vencimiento?: string;
}

export interface DetalleFactura {
  id_detalle: number;
  id_factura: number;
  id_ingrediente: number;
  ingrediente_nombre: string;
  categoria_nombre: string;
  unidad_medida_nombre: string;
  tipo_conservacion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  numero_lote?: string;
  fecha_vencimiento?: string;
}

export interface FacturaCompraPayload {
  numero_factura: string;
  proveedor: string;
  fecha_compra: string;
  soporte_digital?: string;
  valor_total?: number;
  detalles: DetalleFacturaPayload[];
}

export interface FacturaCompra {
  id_factura: number;
  numero_factura: string;
  proveedor: string;
  fecha_compra: string;
  soporte_digital?: string;
  valor_total: number;
  estado: 'REGISTRADA' | 'ANULADA';
  motivo_anulacion?: string;
  id_usuario_anulacion?: number;
  usuario_anulacion_nombre?: string;
  fecha_anulacion?: string;
  id_usuario_registro?: number;
  usuario_registro_nombre?: string;
  fecha_creacion: string;
  detalles?: DetalleFactura[];
}

export interface InventarioCentralItem {
  id_inventario_central: number;
  id_ingrediente: number;
  ingrediente_nombre: string;
  categoria_nombre: string;
  tipo_conservacion: string;
  cantidad_disponible: number;
  stock_minimo: number;
  id_unidad_medida?: number;
  unidad_medida_nombre?: string;
  unidad_medida_abreviatura?: string;
  fecha_ultima_actualizacion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FacturasCompraService {
  private readonly baseUrl = `${environment.apiUrl}/facturas-compra/`;
  private readonly inventarioCentralUrl = `${environment.apiUrl}/inventario-central/`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): { headers: HttpHeaders } {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return { headers };
  }

  getFacturas(filtros?: { estado?: string; proveedor?: string }): Observable<FacturaCompra[]> {
    let params = new HttpParams();
    if (filtros?.estado && filtros.estado !== 'TODAS') {
      params = params.set('estado', filtros.estado);
    }
    if (filtros?.proveedor && filtros.proveedor.trim()) {
      params = params.set('proveedor', filtros.proveedor.trim());
    }

    return this.http.get<any>(this.baseUrl, { ...this.getHeaders(), params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.results || []))
    );
  }

  getFacturaPorId(id: number): Observable<FacturaCompra> {
    return this.http.get<FacturaCompra>(`${this.baseUrl}${id}/`, this.getHeaders());
  }

  crearFactura(payload: FacturaCompraPayload): Observable<FacturaCompra> {
    return this.http.post<FacturaCompra>(this.baseUrl, payload, this.getHeaders());
  }

  anularFactura(id: number, motivo: string): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}${id}/anular/`,
      { motivo_anulacion: motivo },
      this.getHeaders()
    );
  }

  getInventarioCentral(): Observable<InventarioCentralItem[]> {
    return this.http.get<any>(this.inventarioCentralUrl, this.getHeaders()).pipe(
      map(res => Array.isArray(res) ? res : (res?.results || []))
    );
  }
}
