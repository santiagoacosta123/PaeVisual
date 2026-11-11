export interface UsuarioModel {
  id_usuario?: number;
  nombre: string;
  apellido: string;
  correo: string;
  tipo_documento: string;
  numero_documento: string;
  rol: number;
  rol_detalle?: any;
  id_institucion?: number | null;
  institucion_nombre?: string;
  id_sede?: number | null;
  sede_nombre?: string;
  instituciones_supervisor?: any[];
  instituciones_ids?: number[];
  password?: string;
  is_active?: boolean;
  estado?: string;
  estado_display?: string;
  esta_bloqueado?: boolean;
  is_staff?: boolean;
  debe_cambiar_password?: boolean;
  creado_por?: number | null;
  creado_por_nombre?: string | null;
  fecha_creacion?: string;
  creado_en?: string;
}
