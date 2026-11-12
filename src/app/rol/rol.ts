import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolService } from '../services/rol.service';
import {
  RolModel,
  PermisoRolModel,
  ModuloPermisosModel,
  AuditoriaPermisoRolModel
} from '../models/rol.model';
import { SweetAlertService } from '../sweet-alert.service';
import { AuthService } from '../services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-rol',
  styleUrls: ['./rol.css'],
  templateUrl: './rol.html',
})
export class Rol implements OnInit {
  private rolService = inject(RolService);
  private sweetAlert = inject(SweetAlertService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  roles: RolModel[] = [];
  matrizModulos: ModuloPermisosModel[] = [];
  cargando = false;
  soloAsignables = false;
  vistaActiva: 'roles' | 'matriz' = 'roles';

  // Modal de creación / edición de rol básico
  modoEdicion = false;
  mostrarModal = false;
  rolForm: RolModel = { nombre: '', descripcion: '' };

  // Modal para visualización rápida de permisos
  mostrarModalPermisos = false;
  rolSeleccionadoPermisos: RolModel | null = null;

  // Modal para configuración avanzada de permisos (Superadmin)
  mostrarModalConfigurarPermisos = false;
  rolConfigurando: RolModel | null = null;
  codigosPermisosSeleccionados: Set<string> = new Set<string>();
  guardandoPermisos = false;

  // Modal de auditoría de permisos
  mostrarModalAuditoria = false;
  rolAuditoria: RolModel | null = null;
  auditoriasRol: AuditoriaPermisoRolModel[] = [];
  cargandoAuditoria = false;

  // Códigos de permisos críticos reservados para SuperAdministrador
  readonly PERMISOS_CRITICOS_SUPERADMIN: readonly string[] = [
    'usuarios_roles_total',
    'instituciones_sedes_global',
    'contratos_gestion_total',
    'catalogo_global_control',
    'auditoria_operativa_lectura'
  ];

  ngOnInit(): void {
    this.cargarRoles();
    this.cargarMatrizModulos();
  }

  get esSuperAdmin(): boolean {
    const usuario = this.authService.obtenerUsuario();
    return this.authService.esSuperAdministrador(usuario?.rol);
  }

  cargarRoles(soloAsignables = this.soloAsignables): void {
    this.cargando = true;
    this.rolService.getRoles(true, soloAsignables).subscribe({
      next: (datos) => {
        const rolesApi = Array.isArray(datos) ? datos : (datos as any).results || [];
        this.roles = rolesApi.map((r: any) => ({
          ...r,
          nombre: r.nombre || r.nombre_rol || r.name,
          nombre_display: r.nombre_display || r.nombre || r.nombre_rol,
          es_protegido: r.es_protegido !== undefined ? r.es_protegido : true,
          permisos: r.permisos || [],
          total_usuarios_activos: r.total_usuarios_activos || 0,
          puede_editar_permisos: r.puede_editar_permisos !== undefined ? r.puede_editar_permisos : this.esSuperAdmin
        }));
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargando = false;
        console.error('Error al cargar roles:', err);
        const mensajeError = err?.status === 403
          ? 'No tiene permisos suficientes para consultar la configuración de roles del sistema.'
          : 'No se pudieron cargar los roles del sistema.';
        this.sweetAlert.error('Acceso Restringido', mensajeError);
        this.cdr.detectChanges();
      }
    });
  }

  cargarMatrizModulos(): void {
    this.rolService.getMatrizModulos().subscribe({
      next: (matriz) => {
        this.matrizModulos = matriz || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar matriz de módulos:', err);
      }
    });
  }

  cambiarVista(vista: 'roles' | 'matriz'): void {
    this.vistaActiva = vista;
    if (vista === 'matriz' && this.matrizModulos.length === 0) {
      this.cargarMatrizModulos();
    }
  }

  toggleFiltroAsignables(): void {
    this.soloAsignables = !this.soloAsignables;
    this.cargarRoles(this.soloAsignables);
  }

  verPermisos(rol: RolModel): void {
    this.rolSeleccionadoPermisos = rol;
    this.mostrarModalPermisos = true;
  }

  cerrarModalPermisos(): void {
    this.mostrarModalPermisos = false;
    this.rolSeleccionadoPermisos = null;
  }

  // --- CONFIGURACIÓN Y ASIGNACIÓN DE PERMISOS (Superadmin) ---

  abrirConfigurarPermisos(rol: RolModel): void {
    if (!this.esSuperAdmin) {
      this.sweetAlert.warning(
        'Operación no autorizada',
        'Solo el Superadministrador cuenta con autorización para configurar la matriz de permisos de roles.'
      );
      return;
    }

    this.rolConfigurando = rol;
    const codigosActuales = (rol.permisos || []).map((p: any) => p.codigo || p);
    this.codigosPermisosSeleccionados = new Set<string>(codigosActuales);

    // Asegurar que si es SuperAdmin, tenga siempre los permisos críticos seleccionados
    if (rol.nombre === 'SuperAdministrador') {
      this.PERMISOS_CRITICOS_SUPERADMIN.forEach(c => this.codigosPermisosSeleccionados.add(c));
    }

    this.mostrarModalConfigurarPermisos = true;
  }

  cerrarModalConfigurarPermisos(): void {
    this.mostrarModalConfigurarPermisos = false;
    this.rolConfigurando = null;
    this.codigosPermisosSeleccionados.clear();
  }

  esPermisoBloqueado(codigo: string): boolean {
    if (!this.rolConfigurando) return false;

    // Criterio 6: Blindaje de permisos críticos para el Superadministrador
    if (this.rolConfigurando.nombre === 'SuperAdministrador') {
      return this.PERMISOS_CRITICOS_SUPERADMIN.includes(codigo);
    }

    // Criterio 5: Prevención de escalada de privilegios (roles subordinados no pueden adquirir permisos reservados de Superadmin)
    return this.PERMISOS_CRITICOS_SUPERADMIN.includes(codigo);
  }

  togglePermiso(codigo: string): void {
    if (this.esPermisoBloqueado(codigo)) {
      return;
    }

    if (this.codigosPermisosSeleccionados.has(codigo)) {
      this.codigosPermisosSeleccionados.delete(codigo);
    } else {
      this.codigosPermisosSeleccionados.add(codigo);
    }
  }

  guardarPermisosRol(): void {
    if (!this.rolConfigurando || !this.rolConfigurando.id_rol) return;

    const idRol = this.rolConfigurando.id_rol;
    const permisosEnviar = Array.from(this.codigosPermisosSeleccionados);

    if (permisosEnviar.length === 0) {
      this.sweetAlert.warning('Permisos requeridos', 'Debe asignar al menos un permiso funcional al rol.');
      return;
    }

    // Criterio 9: Confirmación explícita advirtiendo revocación inmediata de sesiones activas
    this.sweetAlert.confirm(
      '¿Confirmar actualización de permisos?',
      `Esta operación actualizará inmediatamente los permisos del rol "${this.rolConfigurando.nombre_display || this.rolConfigurando.nombre}" y revocará las sesiones activas de todos los usuarios vinculados para forzar la actualización de sus credenciales.`,
      'Sí, actualizar y revocar sesiones'
    ).then((res: any) => {
      if (res.isConfirmed) {
        this.guardandoPermisos = true;
        this.rolService.asignarPermisosRol(idRol, permisosEnviar).subscribe({
          next: (resp) => {
            this.guardandoPermisos = false;
            this.sweetAlert.success(
              'Permisos actualizados',
              resp.mensaje || 'La configuración de permisos se aplicó de forma inmediata y las sesiones han sido revocadas.'
            );
            this.cerrarModalConfigurarPermisos();
            this.cargarRoles(this.soloAsignables);
          },
          error: (err) => {
            this.guardandoPermisos = false;
            console.error('Error al actualizar permisos:', err);
            const msg = err?.error?.detail || err?.error?.error || (typeof err?.error === 'string' ? err.error : 'No se pudo actualizar la configuración de permisos.');
            this.sweetAlert.error('Error de Seguridad', msg);
          }
        });
      }
    });
  }

  // --- AUDITORÍA DE PERMISOS (Criterio 10) ---

  verAuditoriaPermisos(rol: RolModel): void {
    if (!rol.id_rol) return;
    this.rolAuditoria = rol;
    this.cargandoAuditoria = true;
    this.mostrarModalAuditoria = true;

    this.rolService.getAuditoriaPermisosRol(rol.id_rol).subscribe({
      next: (datos) => {
        this.auditoriasRol = datos || [];
        this.cargandoAuditoria = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoAuditoria = false;
        console.error('Error al consultar auditoría:', err);
        this.sweetAlert.error('Error', 'No se pudo consultar la bitácora de auditoría del rol.');
      }
    });
  }

  cerrarModalAuditoria(): void {
    this.mostrarModalAuditoria = false;
    this.rolAuditoria = null;
    this.auditoriasRol = [];
  }

  // --- CRUD BÁSICO DE ROLES ---

  abrirFormulario(rol?: RolModel): void {
    this.mostrarModal = true;
    if (rol) {
      this.modoEdicion = true;
      this.rolForm = {
        ...rol,
        nombre: rol.nombre || (rol as any).nombre_rol
      };
      return;
    }
    this.modoEdicion = false;
    this.rolForm = { nombre: '', descripcion: '' };
  }

  cerrarFormulario(): void {
    this.mostrarModal = false;
    this.rolForm = { nombre: '', descripcion: '' };
  }

  guardarRol(): void {
    if (!this.rolForm.nombre || !this.rolForm.nombre.trim() || !this.rolForm.descripcion || !this.rolForm.descripcion.trim()) {
      this.sweetAlert.warning('Campos incompletos', 'Completa el nombre y la descripción del rol.');
      return;
    }

    const datosEnviar = {
      ...this.rolForm,
      nombre: this.rolForm.nombre.trim(),
      nombre_rol: this.rolForm.nombre.trim()
    };

    if (this.modoEdicion && this.rolForm.id_rol) {
      this.rolService.actualizarRol(this.rolForm.id_rol, datosEnviar).subscribe({
        next: () => {
          this.sweetAlert.success('Rol actualizado', 'El rol se actualizó correctamente.');
          this.cerrarFormulario();
          this.cargarRoles(this.soloAsignables);
        },
        error: (err) => {
          console.error('Error al actualizar rol:', err);
          const errorMsg = err?.error?.detail || err?.error?.error || 'No se pudo actualizar el rol.';
          this.sweetAlert.error('Error', errorMsg);
        }
      });
    } else {
      this.rolService.crearRol(datosEnviar).subscribe({
        next: () => {
          this.cargarRoles(this.soloAsignables);
          this.cerrarFormulario();
          this.sweetAlert.success('¡Guardado!', 'Rol registrado con éxito.');
        },
        error: (err) => {
          console.error('Error al crear rol:', err);
          const errorMsg = err?.error?.detail || err?.error?.error || 'No se pudo crear el rol.';
          this.sweetAlert.error('Error', errorMsg);
        }
      });
    }
  }

  editarRol(rol: RolModel): void {
    this.abrirFormulario(rol);
  }

  eliminarRol(rol: RolModel): void {
    const idRol = rol.id_rol || (rol as any).id;
    if (!idRol) return;

    // Criterio 11: Protección de roles con usuarios asociados activos
    if (rol.total_usuarios_activos && rol.total_usuarios_activos > 0) {
      this.sweetAlert.warning(
        'Usuarios Activos Vinculados',
        `No es posible eliminar el rol "${rol.nombre_display || rol.nombre}" porque cuenta con ${rol.total_usuarios_activos} usuario(s) activo(s) asociado(s). Debe reasignar el personal previamente.`
      );
      return;
    }

    // Criterio 6: Mantener los roles estructurales del sistema como perfiles protegidos
    if (rol.es_protegido) {
      this.sweetAlert.warning(
        'Perfil Protegido',
        `El rol "${rol.nombre_display || rol.nombre}" es un perfil protegido del sistema SIRAE y no puede ser eliminado.`
      );
      return;
    }

    this.sweetAlert.confirm('¿Eliminar rol?', `¿Desea eliminar el rol ${rol.nombre}?`, 'Sí, eliminar')
      .then((res: any) => {
        if (res.isConfirmed) {
          this.rolService.eliminarRol(idRol).subscribe({
            next: () => {
              this.sweetAlert.success('Rol eliminado', 'El rol se eliminó correctamente.');
              this.cargarRoles(this.soloAsignables);
            },
            error: (err) => {
              console.error('Error al eliminar rol:', err);
              const errorMsg = err?.error?.detail || err?.error?.error || 'No se pudo eliminar el rol.';
              this.sweetAlert.error('Error', errorMsg);
            }
          });
        }
      });
  }
}
