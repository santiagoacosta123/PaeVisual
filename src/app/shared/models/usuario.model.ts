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
  password?: string;
  is_active?: boolean;
  is_staff?: boolean;
  debe_cambiar_password?: boolean;
}