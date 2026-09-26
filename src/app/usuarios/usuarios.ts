import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  roles: any[] = []; // Se llena dinámicamente desde la BD

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
    rol: '',
    password: '',
    is_active: true
  };

  constructor(
    private usuarioService: UsuarioService,
    private rolService: RolService,
    private sweetAlert: SweetAlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarRoles();
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.usuarioService.getUsuarios().subscribe({
      next: (datos: any[]) => {
        this.usuarios = Array.isArray(datos) ? datos : (datos as any).results || [];
        this.cdr.detectChanges();
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
        // Normalizamos las propiedades para soportar id_rol / id y nombre_rol / nombre
        this.roles = rolesApi.map((r: any) => ({
          id_rol: r.id_rol || r.id || r.pk,
          nombre_rol: r.nombre_rol || r.nombre || r.name
        }));
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar los roles:', error);
        this.sweetAlert.error('Atención', 'No se pudieron sincronizar los roles desde la base de datos.');
      }
    });
  }

  obtenerNombreRol(idRol: any): string {
    if (!idRol) return 'Sin Rol';
    const idBuscado = typeof idRol === 'object' ? (idRol.id_rol || idRol.id || idRol.pk) : idRol;
    const rolEncontrado = this.roles.find(r => r.id_rol == idBuscado);
    if (!rolEncontrado) return typeof idRol === 'object' ? (idRol.nombre_rol || idRol.nombre || 'Rol') : `Rol ID: ${idRol}`;
    
    return rolEncontrado.nombre_rol;
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

  abrirFormulario(usuario?: any): void {
    this.mostrarModal = true;
    
    if (usuario) {
      this.modoEdicion = true;
      this.usuarioSeleccionadoId = usuario.id_usuario || usuario.id || usuario.pk || usuario.user_id;
      const rolValor = typeof usuario.rol === 'object' ? (usuario.rol?.id_rol || usuario.rol?.id || usuario.rol?.pk) : usuario.rol;

      this.usuarioForm = { 
        ...usuario, 
        rol: Number(rolValor) || '',
        password: '' 
      };
      return;
    }
    
    this.modoEdicion = false;
    this.usuarioSeleccionadoId = undefined;
    
    this.usuarioForm = {
      nombre: '',
      apellido: '',
      correo: '',
      tipo_documento: 'CC',
      numero_documento: '',
      rol: this.roles.length > 0 ? this.roles[0].id_rol : '',
      password: '',
      is_active: true
    };
  }

  cerrarFormulario(): void {
    this.mostrarModal = false;
  }

  private formatearMensajeError(err: any): string {
    if (err.error) {
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