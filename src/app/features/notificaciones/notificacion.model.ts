export type PrioridadNotificacion = 'baja' | 'media' | 'alta' | 'critica';
export type CategoriaNotificacion = 'inventario' | 'entrega' | 'menu' | 'asistencia' | 'contrato' | 'sistema';

export interface AccionNotificacion {
  ruta: string;
  textoBoton?: string;
  parametros?: Record<string, string | number>;
}

export interface PlantillaAviso {
  id: string;
  etiqueta: string;
  titulo: string;
  mensaje: string;
  prioridad: PrioridadNotificacion;
  categoria: CategoriaNotificacion;
  icono: string;
  rutaSugerida?: string;
}

export interface Notificacion {
  id?: number;
  id_notificacion?: number;
  id_usuario?: number;
  id_remitente?: number | null;
  nombre_remitente?: string;
  rol_remitente?: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  prioridad?: PrioridadNotificacion | string;
  categoria?: CategoriaNotificacion | string;
  fecha_creacion?: string;
  fecha_hora?: string;
  imagen_url?: string | null;
  id_institucion?: number | null;
  nombre_institucion?: string;
  id_sede?: number | null;
  nombre_sede?: string;
  accion?: AccionNotificacion;
  ruta_accion?: string;
}

export interface NotificacionDestinatario {
  id_usuario: number;
  nombre: string;
  rol: string;
  institucion_nombre?: string;
  sede_nombre?: string;
}

export interface EnviarNotificacionResponse {
  mensaje: string;
  cantidad_destinatarios: number;
  resultados: Notificacion[];
}
