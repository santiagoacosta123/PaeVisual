import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  EnviarNotificacionResponse,
  Notificacion,
  NotificacionDestinatario
} from './notificacion.model';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class NotificacionService {
  private apiUrl = `${environment.apiUrl}/notificaciones`;

  constructor(private http: HttpClient) {}

  // Listar todas
  obtenerNotificaciones(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(`${this.apiUrl}/`);
  }

  obtenerDestinatarios(): Observable<NotificacionDestinatario[]> {
    return this.http.get<NotificacionDestinatario[]>(
      `${this.apiUrl}/destinatarios/`
    );
  }

  enviarNotificacion(
    titulo: string,
    mensaje: string,
    imagen?: File | null,
    idDestinatario?: number | null
  ): Observable<EnviarNotificacionResponse> {
    const formulario = new FormData();

    formulario.append('titulo', titulo.trim());
    formulario.append('mensaje', mensaje.trim());

    if (idDestinatario !== undefined && idDestinatario !== null) {
      formulario.append('id_destinatario', String(idDestinatario));
    }

    if (imagen) {
      formulario.append('imagen', imagen, imagen.name);
    }

    return this.http.post<EnviarNotificacionResponse>(
      `${this.apiUrl}/enviar/`,
      formulario
    );
  }
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
