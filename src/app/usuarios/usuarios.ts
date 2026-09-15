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
  roles: any[] = [];

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
    is_active: true,
    is_staff: false
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
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
      }
    });
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (datos: any[]) => {
        this.roles = datos;
      },
      error: (error) => {
        console.error('Error al cargar roles:', error);
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
    return this.usuarios.filter(u => u.is_staff || this.obtenerNombreRol(u.rol).toLowerCase().includes('admin')).length;
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
      is_active: true,
      is_staff: false
    };
  }

  cerrarFormulario(): void {
    this.mostrarModal = false;
  }

  guardarUsuario(): void {
    if (!this.usuarioForm.nombre || !this.usuarioForm.apellido || !this.usuarioForm.correo || !this.usuarioForm.numero_documento) {
      this.sweetAlert.warning('Campos incompletos', 'Por favor llena todos los campos obligatorios.');
      return;
    }

    // Aseguramos que el rol viaje estrictamente como número para Django
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
          console.error('Error al actualizar:', err);
          this.sweetAlert.error('Error', 'No se pudo actualizar el usuario.');
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
          console.error('Error al crear:', err);
          this.sweetAlert.error('Error', 'No se pudo registrar el usuario.');
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
      this.sweetAlert.error('Error', 'Este usuario no tiene un ID válido.');
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
              console.error('Error al eliminar:', err);
              this.sweetAlert.error('Error', 'No se pudo eliminar el usuario.');
            }
          });
        }
      });
  }
}