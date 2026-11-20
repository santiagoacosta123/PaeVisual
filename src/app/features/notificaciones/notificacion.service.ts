import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, of } from 'rxjs';
import {
  EnviarNotificacionResponse,
  Notificacion,
  NotificacionDestinatario
} from './notificacion.model';
import { environment } from '@env/environment';

export interface OpcionesNotificacion {
  prioridad?: string;
  categoria?: string;
  rol_destino?: string;
  ruta_accion?: string;
  id_institucion?: number | null;
  id_sede?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class NotificacionService {
  private apiUrl = `${environment.apiUrl}/notificaciones`;

  private notificacionesSubject = new BehaviorSubject<Notificacion[]>([]);
  public notificaciones$ = this.notificacionesSubject.asObservable();

  private noLeidasSubject = new BehaviorSubject<number>(0);
  public noLeidas$ = this.noLeidasSubject.asObservable();

  // Toast flotante en tiempo real (esquina inferior derecha)
  private toastSubject = new BehaviorSubject<Notificacion | null>(null);
  public toastActivo$ = this.toastSubject.asObservable();
  private toastTimer: any = null;

  constructor(private http: HttpClient) {}

  mostrarToast(notif: Notificacion, duracionMs = 6000): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastSubject.next(notif);
    this.toastTimer = setTimeout(() => {
      this.cerrarToast();
    }, duracionMs);
  }

  cerrarToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastSubject.next(null);
  }

  tiempoRelativo(fechaIso?: string): string {
    if (!fechaIso) return 'Reciente';
    try {
      const fecha = new Date(fechaIso);
      const ahora = new Date();
      const diffSeg = Math.floor((ahora.getTime() - fecha.getTime()) / 1000);
      if (diffSeg < 60) return 'Hace un momento';
      const diffMin = Math.floor(diffSeg / 60);
      if (diffMin < 60) return `Hace ${diffMin} min`;
      const diffHoras = Math.floor(diffMin / 60);
      if (diffHoras < 24) return `Hace ${diffHoras} ${diffHoras === 1 ? 'hora' : 'horas'}`;
      const diffDias = Math.floor(diffHoras / 24);
      if (diffDias === 1) return 'Ayer';
      if (diffDias < 7) return `Hace ${diffDias} días`;
      return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    } catch {
      return 'Reciente';
    }
  }

  // Listar todas con sincronización reactiva
  obtenerNotificaciones(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(`${this.apiUrl}/`).pipe(
      tap((lista) => {
        const notificaciones = Array.isArray(lista) ? lista : [];
        this.notificacionesSubject.next(notificaciones);
        const conteo = notificaciones.filter(n => !n.leida).length;
        this.noLeidasSubject.next(conteo);
      })
    );
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
    idDestinatario?: number | null,
    opciones?: OpcionesNotificacion
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

    if (opciones) {
      if (opciones.prioridad) formulario.append('prioridad', opciones.prioridad);
      if (opciones.categoria) formulario.append('categoria', opciones.categoria);
      if (opciones.rol_destino) formulario.append('rol_destino', opciones.rol_destino);
      if (opciones.ruta_accion) formulario.append('ruta_accion', opciones.ruta_accion);
      if (opciones.id_institucion) formulario.append('id_institucion', String(opciones.id_institucion));
      if (opciones.id_sede) formulario.append('id_sede', String(opciones.id_sede));
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
    return this.http.post(`${this.apiUrl}/${id}/marcar-leida/`, {}).pipe(
      tap(() => {
        const actualizadas = this.notificacionesSubject.value.map((n) =>
          (n.id === id || n.id_notificacion === id) ? { ...n, leida: true } : n
        );
        this.notificacionesSubject.next(actualizadas);
        this.noLeidasSubject.next(actualizadas.filter(n => !n.leida).length);
      })
    );
  }

  // Marcar todas como leídas (Alineado con tu URL: notificaciones/marcar-todas-leidas/)
  marcarTodasComoLeidas(): Observable<any> {
    return this.http.post(`${this.apiUrl}/marcar-todas-leidas/`, {}).pipe(
      tap(() => {
        const actualizadas = this.notificacionesSubject.value.map(n => ({ ...n, leida: true }));
        this.notificacionesSubject.next(actualizadas);
        this.noLeidasSubject.next(0);
      })
    );
  }

  // Eliminar
  eliminarNotificacion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}/`).pipe(
      tap(() => {
        const filtradas = this.notificacionesSubject.value.filter(
          n => n.id !== id && n.id_notificacion !== id
        );
        this.notificacionesSubject.next(filtradas);
        this.noLeidasSubject.next(filtradas.filter(n => !n.leida).length);
      })
    );
  }
}
