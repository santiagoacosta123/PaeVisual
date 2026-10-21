export interface UsuarioModel {
  id_usuario?: number;
  nombre: string;
  apellido: string;
  correo: string;
  tipo_documento: string;
  numero_documento: string;
  rol: number;
  password?: string;
  is_active?: boolean;
  is_staff?: boolean;
}