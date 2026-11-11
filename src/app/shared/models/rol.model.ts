export interface PermisoRolModel {
  modulo: string;
  codigo: string;
  descripcion: string;
}

export interface PermisoDefinicionModel {
  codigo: string;
  nombre: string;
  descripcion: string;
  nivel_requerido: string;
}

export interface ModuloPermisosModel {
  modulo: string;
  nombre_modulo: string;
  descripcion: string;
  permisos: PermisoDefinicionModel[];
}

export interface AuditoriaPermisoRolModel {
  id_auditoria: number;
  rol: number;
  nombre_rol?: string;
  actor_correo: string;
  accion: string;
  permisos_anteriores: string[];
  permisos_nuevos: string[];
  detalle: string;
  ip_address?: string;
  creado_en: string;
}

export interface RolModel {
  id_rol?: number;
  nombre: string;
  nombre_display?: string;
  descripcion: string;
  es_protegido?: boolean;
  permisos?: PermisoRolModel[];
  total_usuarios_activos?: number;
  puede_editar_permisos?: boolean;
}
