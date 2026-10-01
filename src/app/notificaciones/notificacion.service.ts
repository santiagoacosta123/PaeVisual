import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Notificacion } from './notificacion.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NotificacionService {
  private apiUrl = `${environment.apiUrl}/notificaciones/`;

  constructor(private http: HttpClient) {}

  // Listar todas
  obtenerNotificaciones(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(`${this.apiUrl}/`);
  }

  // Crear nueva
  crearNotificacion(notificacion: Notificacion): Observable<Notificacion> {
    return this.http.post<Notificacion>(`${this.apiUrl}/`, notificacion);
  }

  // Actualizar
  actualizarNotificacion(id: number, notificacion: Notificacion): Observable<Notificacion> {
    return this.http.put<Notificacion>(`${this.apiUrl}/${id}/`, notificacion);
  }

  // Marcar individual como leída (Alineado con tu URL: notificaciones/<pk>/marcar-leida/)
  marcarComoLeida(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/marcar-leida/`, {});
  }

  // Marcar todas como leídas (Alineado con tu URL: notificaciones/marcar-todas-leidas/)
  marcarTodasComoLeidas(): Observable<any> {
    return this.http.post(`${this.apiUrl}/marcar-todas-leidas/`, {});
  }

  // Eliminar
  eliminarNotificacion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}/`);
  }
}