import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService } from '../services/usuario.service';
import { RolService } from '../services/rol.service';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.css']
})
export class UsuariosComponent implements OnInit {

  usuarios: any[] = [];
  
  // Roles iniciales por defecto para garantizar que el selector NUNCA quede vacío
  roles: any[] = [
    { id_rol: 1, nombre_rol: 'Administrador' },
    { id_rol: 2, nombre_rol: 'Coordinador' },
    { id_rol: 3, nombre_rol: 'Operador' }
  ];

  modoEdicion: boolean = false;
  usuarioSeleccionadoId?: number;
  mostrarModal: boolean = false;

  filtroTexto: string = '';
  filtroRol: string = '';

  usuarioForm: any = {
    nombre: '',
    apellido: '',
    correo: '',
    tipo_documento: 'CC',
    numero_documento: '',
    rol: 1,
    password: '',
    is_active: true
  };

  constructor(
    private usuarioService: UsuarioService,
    private rolService: RolService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.cargarUsuarios();
    this.cargarRoles();
  }

  cargarUsuarios(): void {
    this.usuarioService.getUsuarios().subscribe({
      next: (datos: any[]) => {
        this.usuarios = datos;
        console.log("Usuarios cargados correctamente:", datos);
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
        this.sweetAlert.error('Error', 'No se pudieron cargar los usuarios del sistema.');
      }
    });
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (datos: any) => {
        const rolesApi = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        if (rolesApi && rolesApi.length > 0) {
          this.roles = rolesApi; // Si el backend responde, los sobrescribimos con los de la base de datos
        }
        console.log("Roles listos en el sistema:", this.roles);
      },
      error: (error) => {
        console.warn('No se pudo conectar con la API de roles, usando roles por defecto:', error);
      }
    });
  }

  obtenerNombreRol(idRol: any): string {
    if (!idRol) return 'Sin Rol';
    const idBuscado = typeof idRol === 'object' ? (idRol.id_rol || idRol.id || idRol.pk) : idRol;
    const rolEncontrado = this.roles.find(r => (r.id_rol === idBuscado || r.id === idBuscado || r.pk === idBuscado));
    if (!rolEncontrado) return typeof idRol === 'object' ? (idRol.nombre_rol || idRol.nombre || 'Rol') : `Rol ID: ${idRol}`;
    
    return rolEncontrado.nombre_rol || rolEncontrado.nombre || rolEncontrado.name || 'Rol';
  }

  get usuariosFiltrados(): any[] {
    return this.usuarios.filter(u => {
      const textoMatch = 
        (u.nombre?.toLowerCase() || '').includes(this.filtroTexto.toLowerCase()) ||
        (u.apellido?.toLowerCase() || '').includes(this.filtroTexto.toLowerCase()) ||
        (u.numero_documento || '').includes(this.filtroTexto) ||
        (u.correo?.toLowerCase() || '').includes(this.filtroTexto.toLowerCase());
      
      const uRolId = typeof u.rol === 'object' ? (u.rol?.id_rol || u.rol?.id || u.rol?.pk) : u.rol;
      const rolMatch = this.filtroRol ? uRolId?.toString() === this.filtroRol.toString() : true;

      return textoMatch && rolMatch;
    });
  }

  get totalAdministradores(): number {
    return this.usuarios.filter(u => this.obtenerNombreRol(u.rol).toLowerCase().includes('admin')).length;
  }

  get totalActivos(): number {
    return this.usuarios.filter(u => u.is_active).length;
  }

  get totalInactivos(): number {
    return this.usuarios.filter(u => !u.is_active).length;
  }

  abrirFormulario(usuario?: any): void {
    this.mostrarModal = true;
    if (usuario) {
      this.modoEdicion = true;
      this.usuarioSeleccionadoId = usuario.id_usuario || usuario.id || usuario.pk || usuario.user_id;

      const rolValor = typeof usuario.rol === 'object' ? (usuario.rol?.id_rol || usuario.rol?.id || usuario.rol?.pk) : usuario.rol;

      this.usuarioForm = { 
        ...usuario, 
        rol: Number(rolValor) || 1,
        password: '' 
      };
      return;
    }
    
    this.modoEdicion = false;
    this.usuarioSeleccionadoId = undefined;
    
    const primerRol = this.roles.length > 0 ? (this.roles[0].id_rol || this.roles[0].id || this.roles[0].pk || 1) : 1;
    
    this.usuarioForm = {
      nombre: '',
      apellido: '',
      correo: '',
      tipo_documento: 'CC',
      numero_documento: '',
      rol: Number(primerRol),
      password: '',
      is_active: true
    };
  }

  cerrarFormulario(): void {
    this.mostrarModal = false;
  }

  private formatearMensajeError(err: any): string {
    console.error("Objeto de error recibido de la API:", err);
    if (err.error) {
      if (typeof err.error === 'string' && err.error.includes('<!doctype html>')) {
        return 'Error 500: Django falló internamente. Revisa la terminal negra donde corre tu backend.';
      }
      if (typeof err.error === 'object') {
        const primerCampo = Object.keys(err.error)[0];
        const detalle = err.error[primerCampo];
        if (Array.isArray(detalle)) {
          return `${primerCampo.replace(/_/g, ' ')}: ${detalle[0]}`;
        } else if (typeof detalle === 'string') {
          return detalle;
        }
      } else if (typeof err.error === 'string') {
        return err.error;
      }
    }
    return 'Ocurrió un error inesperado en el servidor.';
  }

  guardarUsuario(): void {
    if (!this.usuarioForm.nombre || !this.usuarioForm.apellido || !this.usuarioForm.correo || !this.usuarioForm.numero_documento || !this.usuarioForm.rol) {
      this.sweetAlert.warning('Campos incompletos', 'Por favor llena todos los campos obligatorios incluyendo el rol.');
      return;
    }

    const datosEnviar = {
      ...this.usuarioForm,
      rol: Number(this.usuarioForm.rol)
    };

    if (this.modoEdicion && this.usuarioSeleccionadoId) {
      if (!datosEnviar.password || datosEnviar.password.trim() === '') {
        delete datosEnviar.password;
      }

      this.usuarioService.actualizarUsuario(this.usuarioSeleccionadoId, datosEnviar).subscribe({
        next: () => {
          this.sweetAlert.success('¡Actualizado!', 'El usuario se actualizó correctamente.');
          this.cerrarFormulario();
          this.cargarUsuarios();
        },
        error: (err) => {
          const mensajeError = this.formatearMensajeError(err);
          this.sweetAlert.error('Error de Servidor', mensajeError);
        }
      });
    } else {
      if (!datosEnviar.password) {
        this.sweetAlert.warning('Contraseña requerida', 'Debes ingresar una contraseña para registrar el usuario.');
        return;
      }

      this.usuarioService.crearUsuario(datosEnviar).subscribe({
        next: () => {
          this.sweetAlert.success('¡Creado!', 'El usuario se registró correctamente.');
          this.cerrarFormulario();
          this.cargarUsuarios();
        },
        error: (err) => {
          const mensajeError = this.formatearMensajeError(err);
          this.sweetAlert.error('Error de Servidor', mensajeError);
        }
      });
    }
  }

  editarUsuario(usuario: any): void {
    this.abrirFormulario(usuario);
  }

  eliminarUsuario(usuario: any): void {
    const id = usuario.id_usuario || usuario.id || usuario.pk || usuario.user_id;
    if (!id) {
      this.sweetAlert.error('Error', 'Este usuario no tiene un ID válido para eliminar.');
      return;
    }

    this.sweetAlert.confirm('¿Eliminar usuario?', `¿Deseas eliminar a ${usuario.nombre}?`, 'Sí, eliminar')
      .then((result: any) => {
        if (result.isConfirmed) {
          this.usuarioService.eliminarUsuario(id).subscribe({
            next: () => {
              this.sweetAlert.success('Eliminado', 'El usuario fue eliminado con éxito.');
              this.cargarUsuarios();
            },
            error: (err) => {
              const mensajeError = this.formatearMensajeError(err);
              this.sweetAlert.error('Error de Servidor', mensajeError);
            }
          });
        }
      });
  }
}