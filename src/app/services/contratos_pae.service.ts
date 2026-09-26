import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SiraeService {
  private http = inject(HttpClient);

  // URL exacta apuntando a tu backend en Render con el prefijo /api/
  private apiUrl = 'https://backend-sirae-pyim.onrender.com/api/contratos/';

  // Obtener todos los contratos (GET)
  getContratos(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // Crear un nuevo contrato (POST)
  crearContrato(contrato: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, contrato);
  }

  // Actualizar un contrato existente (PUT)
  actualizarContrato(id: number, contrato: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}${id}/`, contrato);
  }

  // Eliminar un contrato (DELETE)
  eliminarContrato(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}${id}/`);
  }
}