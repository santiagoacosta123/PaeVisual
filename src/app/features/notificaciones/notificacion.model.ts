export interface Notificacion {
  id?: number;
  id_notificacion?: number;
  id_usuario?: number;
  id_remitente?: number | null;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_creacion?: string;
  fecha_hora?: string;
  imagen_url?: string | null;
}

export interface NotificacionDestinatario {
  id_usuario: number;
  nombre: string;
  rol: string;
}

export interface EnviarNotificacionResponse {
  mensaje: string;
  cantidad_destinatarios: number;
  resultados: Notificacion[];
}