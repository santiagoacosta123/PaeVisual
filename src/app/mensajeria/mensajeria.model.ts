export interface Mensaje {
  id_mensaje: number;
  remitente: number;
  remitente_nombre: string;
  remitente_rol: string;
  destinatario: number;
  destinatario_nombre: string;
  destinatario_rol: string;
  contenido_texto: string | null;
  imagen_url: string | null;
  fecha_envio: string;
  leido: boolean;
  es_emisor: boolean;
}

export interface ContactoChat {
  id_usuario: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  correo: string;
  rol: string;
  ultimo_mensaje: string;
  ultima_fecha: string | null;
  mensajes_no_leidos: number;
}

export interface ConversacionResponse {
  contacto: ContactoChat;
  mensajes: Mensaje[];
  cantidad: number;
}
