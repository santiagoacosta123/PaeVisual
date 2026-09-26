import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SiraeService {
  private http = inject(HttpClient);

  private apiUrl = 'https://backend-sirae-pyim.onrender.com/api/contratos/';

  getContratos(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  crearContrato(contrato: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, contrato);
  }

  actualizarContrato(id: number, contrato: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}${id}/`, contrato);
  }

  eliminarContrato(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}${id}/`);
  }
}