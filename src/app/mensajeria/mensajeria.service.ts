import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { ContactoChat, ConversacionResponse, Mensaje } from './mensajeria.model';
import { AuthService } from '../core/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class MensajeriaService {
  private apiUrl = `${environment.apiUrl}/mensajes`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Garantiza la presencia de cabeceras de autorización JWT en cada petición (CA-12).
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.obtenerToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /**
   * Obtiene la lista de contactos permitidos según la matriz de roles (CA-10).
   */
  obtenerContactos(): Observable<ContactoChat[]> {
    return this.http.get<ContactoChat[]>(`${this.apiUrl}/contactos/`, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Obtiene la conversación con un contacto, marcando mensajes como leídos (CA-08, CA-09).
   */
  obtenerConversacion(contactoId: number): Observable<ConversacionResponse> {
    return this.http.get<ConversacionResponse>(`${this.apiUrl}/conversacion/${contactoId}/`, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Envía un mensaje con texto opcional y/o imagen (.jpg, .jpeg, .png <= 5MB) (CA-06, CA-07).
   */
  enviarMensaje(
    destinatarioId: number,
    contenidoTexto?: string,
    imagen?: File | null
  ): Observable<Mensaje> {
    const formData = new FormData();
    formData.append('destinatario', String(destinatarioId));

    if (contenidoTexto && contenidoTexto.trim()) {
      formData.append('contenido_texto', contenidoTexto.trim());
    }

    if (imagen) {
      formData.append('imagen', imagen, imagen.name);
    }

    return this.http.post<Mensaje>(`${this.apiUrl}/enviar/`, formData, {
      headers: this.getAuthHeaders()
    });
  }

  /**
   * Obtiene el conteo total de mensajes entrantes no leídos (CA-11).
   */
  obtenerTotalNoLeidos(): Observable<{ total_no_leidos: number }> {
    return this.http.get<{ total_no_leidos: number }>(`${this.apiUrl}/no-leidos/`, {
      headers: this.getAuthHeaders()
    });
  }
}
