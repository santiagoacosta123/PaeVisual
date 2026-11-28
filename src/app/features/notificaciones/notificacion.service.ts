import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map, tap, catchError, of } from 'rxjs';
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

  // Conexión WebSocket en tiempo real (con fallback automático a polling HTTP)
  private socket: WebSocket | null = null;
  private wsConectadoSubject = new BehaviorSubject<boolean>(false);
  public wsConectado$ = this.wsConectadoSubject.asObservable();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private cierreIntencional = false;
  private tokenActual: string | null = null;

  constructor(private http: HttpClient) {}

  estaWebSocketConectado(): boolean {
    return this.wsConectadoSubject.value;
  }

  conectarWebSocket(token: string | null | undefined): void {
    if (typeof WebSocket === 'undefined') return;
    const tokenLimpio = (token ?? '').replace(/^(Bearer|Token)\s+/i, '').trim();
    if (!tokenLimpio) return;

    this.tokenActual = tokenLimpio;
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.cierreIntencional = false;
    const url = this.construirUrlWebSocket(tokenLimpio);

    try {
      const ws = new WebSocket(url);
      this.socket = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.wsConectadoSubject.next(true);
        this.iniciarHeartbeat();
      };

      ws.onmessage = (event: MessageEvent) => {
        this.procesarMensajeWebSocket(event.data);
      };

      ws.onerror = () => {
        this.wsConectadoSubject.next(false);
      };

      ws.onclose = () => {
        this.detenerHeartbeat();
        this.wsConectadoSubject.next(false);
        this.socket = null;

        if (!this.cierreIntencional && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delayMs = Math.min(3000 * Math.pow(2, this.reconnectAttempts), 30_000);
          this.reconnectAttempts++;
          this.reconnectTimer = setTimeout(() => {
            if (!this.cierreIntencional && this.tokenActual) {
              this.conectarWebSocket(this.tokenActual);
            }
          }, delayMs);
        }
      };
    } catch {
      this.wsConectadoSubject.next(false);
    }
  }

  desconectarWebSocket(): void {
    this.cierreIntencional = true;
    this.tokenActual = null;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.detenerHeartbeat();
    if (this.socket) {
      try {
        this.socket.close(1000, 'Cierre de sesión');
      } catch {
        // Ignorar errores al cerrar un socket ya cerrado
      }
      this.socket = null;
    }
    this.wsConectadoSubject.next(false);
  }

  private construirUrlWebSocket(token: string): string {
    const env = environment as { apiUrl: string; wsUrl?: string };
    if (env.wsUrl) {
      const sep = env.wsUrl.includes('?') ? '&' : '?';
      return `${env.wsUrl}${sep}token=${encodeURIComponent(token)}`;
    }
    const base = env.apiUrl
      .replace(/\/api\/?$/, '')
      .replace(/^https:\/\//i, 'wss://')
      .replace(/^http:\/\//i, 'ws://');
    return `${base}/ws/notificaciones/?token=${encodeURIComponent(token)}`;
  }

  private iniciarHeartbeat(): void {
    this.detenerHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // Si falla el envío, onclose gestionará la reconexión
        }
      }
    }, 30_000);
  }

  private detenerHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private procesarMensajeWebSocket(rawData: unknown): void {
    if (typeof rawData !== 'string') return;
    let payload: any;
    try {
      payload = JSON.parse(rawData);
    } catch {
      return;
    }
    if (!payload || typeof payload !== 'object') return;

    const tipo = String(payload.type ?? payload.evento ?? '').toLowerCase();
    if (tipo === 'pong') return;

    if (tipo === 'notificacion_leida') {
      const id = Number(payload.id ?? payload.id_notificacion);
      if (Number.isFinite(id)) {
        const actualizadas = this.notificacionesSubject.value.map((n) =>
          (n.id === id || n.id_notificacion === id) ? { ...n, leida: true } : n
        );
        this.notificacionesSubject.next(actualizadas);
        this.noLeidasSubject.next(actualizadas.filter(n => !n.leida).length);
      }
      return;
    }

    if (tipo === 'todas_leidas') {
      const actualizadas = this.notificacionesSubject.value.map(n => ({ ...n, leida: true }));
      this.notificacionesSubject.next(actualizadas);
      this.noLeidasSubject.next(0);
      return;
    }

    const notif: Notificacion | null =
      payload.notificacion ?? payload.data ?? (payload.titulo && payload.mensaje ? payload : null);

    if (notif && notif.titulo) {
      const idNueva = notif.id ?? notif.id_notificacion;
      const actuales = this.notificacionesSubject.value;
      const yaExiste = idNueva !== undefined && actuales.some(
        n => (n.id ?? n.id_notificacion) === idNueva
      );
      const nuevaLista = yaExiste ? actuales : [notif, ...actuales];
      this.notificacionesSubject.next(nuevaLista);
      this.noLeidasSubject.next(nuevaLista.filter(n => !n.leida).length);
      if (!notif.leida && !yaExiste) {
        this.mostrarToast(notif);
      }
    }
  }

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

  private ordenarMasRecientesPrimero(lista: Notificacion[]): Notificacion[] {
    return [...lista].sort((a, b) => {
      const fA = a.fecha_hora || a.fecha_creacion || '';
      const fB = b.fecha_hora || b.fecha_creacion || '';
      const tsA = fA ? new Date(fA).getTime() : 0;
      const tsB = fB ? new Date(fB).getTime() : 0;
      if (!Number.isNaN(tsA) && !Number.isNaN(tsB) && tsB !== tsA) {
        return tsB - tsA;
      }
      const idA = Number(a.id_notificacion ?? a.id ?? 0);
      const idB = Number(b.id_notificacion ?? b.id ?? 0);
      return idB - idA;
    });
  }

  // Listar todas con sincronización reactiva
  obtenerNotificaciones(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(`${this.apiUrl}/`).pipe(
      map((lista) => this.ordenarMasRecientesPrimero(Array.isArray(lista) ? lista : [])),
      tap((notificaciones) => {
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

  // Marcar individual como no leída (notificaciones/<pk>/marcar-no-leida/)
  marcarComoNoLeida(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/marcar-no-leida/`, {}).pipe(
      tap(() => {
        const actualizadas = this.notificacionesSubject.value.map((n) =>
          (n.id === id || n.id_notificacion === id) ? { ...n, leida: false } : n
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
