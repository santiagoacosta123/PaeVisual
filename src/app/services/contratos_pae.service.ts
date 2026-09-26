import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SiraeService {
  private http = inject(HttpClient);

  private apiUrl = 'https://backend-sirae-pyim.onrender.com/api/contratos/';
  private turnosUrl = 'https://backend-sirae-pyim.onrender.com/api/turnos/';

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

  getTurnos(): Observable<any[]> {
    return this.http.get<any[]>(this.turnosUrl);
  }

  crearTurno(turno: any): Observable<any> {
    return this.http.post<any>(this.turnosUrl, turno);
  }

  actualizarTurno(id: number, turno: any): Observable<any> {
    return this.http.put<any>(`${this.turnosUrl}${id}/`, turno);
  }

  eliminarTurno(id: number): Observable<any> {
    return this.http.delete<any>(`${this.turnosUrl}${id}/`);
  }

  // JORNADAS
  private jornadasUrl = 'https://backend-sirae-pyim.onrender.com/api/jornadas/';

  getJornadas(): Observable<any[]> {
    return this.http.get<any[]>(this.jornadasUrl);
  }

  crearJornada(jornada: any): Observable<any> {
    return this.http.post<any>(this.jornadasUrl, jornada);
  }

  actualizarJornada(id: number, jornada: any): Observable<any> {
    return this.http.put<any>(`${this.jornadasUrl}${id}/`, jornada);
  }

  eliminarJornada(id: number): Observable<any> {
    return this.http.delete<any>(`${this.jornadasUrl}${id}/`);
  }

  // SECCIONES DE MENÚ
  private seccionesMenuUrl = 'https://backend-sirae-pyim.onrender.com/api/secciones_menu/'; // Asegúrate de que esta URL sea la correcta según tu backend

  getSeccionesMenu(): Observable<any[]> {
    return this.http.get<any[]>(this.seccionesMenuUrl);
  }

  crearSeccionMenu(seccion: any): Observable<any> {
    return this.http.post<any>(this.seccionesMenuUrl, seccion);
  }

  actualizarSeccionMenu(id: number, seccion: any): Observable<any> {
    return this.http.put<any>(`${this.seccionesMenuUrl}${id}/`, seccion);
  }

  eliminarSeccionMenu(id: number): Observable<any> {
    return this.http.delete<any>(`${this.seccionesMenuUrl}${id}/`);
  }

  // CONTRATOS - SECCION MENÚ (Relación)
  private contratosSeccionMenuUrl = 'https://backend-sirae-pyim.onrender.com/api/contrato_seccion_menu/'; // Intentando con singular

  getContratosSeccionMenu(contratoId?: number): Observable<any[]> {
    const url = contratoId ? `${this.contratosSeccionMenuUrl}?contrato=${contratoId}` : this.contratosSeccionMenuUrl;
    return this.http.get<any[]>(url);
  }

  crearContratoSeccionMenu(data: any): Observable<any> {
    return this.http.post<any>(this.contratosSeccionMenuUrl, data);
  }

  eliminarContratoSeccionMenu(id: number): Observable<any> {
    return this.http.delete<any>(`${this.contratosSeccionMenuUrl}${id}/`);
  }
}