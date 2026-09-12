import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService } from '../services/usuario.service';
import { UsuarioModel } from '../models/usuario.model';
import { RolService } from '../services/rol.service';
import { RolModel } from '../models/rol.model';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.css']
})
export class UsuariosComponent implements OnInit {

  usuarios: UsuarioModel[] = [];
  roles: RolModel[] = [];

  modoEdicion = false;
  usuarioSeleccionadoId?: number;

  usuarioForm: UsuarioModel = {
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
    private rolService: RolService
  ) {}

  ngOnInit(): void {
    this.cargarUsuarios();
    this.cargarRoles();
  }

  cargarUsuarios(): void {
    this.usuarioService.getUsuarios().subscribe({
      next: (datos) => {
        this.usuarios = datos;
        alert('Usuarios cargados: ' + datos.length);
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
        alert('ERROR: No se pudieron cargar los usuarios.');
      }
    });
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (datos) => {
        this.roles = datos;
        console.log('Roles cargados:', datos);
      },
      error: (error) => {
        console.error('Error al cargar roles:', error);
        alert('ERROR: No se pudieron cargar los roles.');
      }
    });
  }

  abrirFormulario(usuario?: UsuarioModel): void {

    if (usuario) {
      this.modoEdicion = true;
      this.usuarioSeleccionadoId = usuario.id_usuario;

      this.usuarioForm = {
        ...usuario,
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
      rol: this.roles.length > 0 ? this.roles[0].id_rol! : 1,
      password: '',
      is_active: true,
      is_staff: false
    };
  }

  guardarUsuario(): void {

    if (
      !this.usuarioForm.nombre.trim() ||
      !this.usuarioForm.apellido.trim() ||
      !this.usuarioForm.correo.trim() ||
      !this.usuarioForm.numero_documento.trim()
    ) {
      alert('ERROR: Completa los datos obligatorios del usuario.');
      return;
    }

    if (this.modoEdicion && this.usuarioSeleccionadoId) {

      this.usuarioService
        .actualizarUsuario(
          this.usuarioSeleccionadoId,
          this.usuarioForm
        )
        .subscribe({
          next: (usuarioActualizado) => {
            alert(
              'USUARIO ACTUALIZADO: ' +
              usuarioActualizado.nombre
            );

            this.abrirFormulario();
            this.cargarUsuarios();
          },
          error: (error) => {
            console.error('Error al actualizar:', error);
            alert('ERROR: No se pudo actualizar el usuario.');
          }
        });

    } else {

      if (!this.usuarioForm.password?.trim()) {
        alert(
          'ERROR: La contraseña es obligatoria para crear un usuario.'
        );
        return;
      }

      this.usuarioService
        .crearUsuario(this.usuarioForm)
        .subscribe({
          next: (nuevoUsuario) => {
            alert(
              'USUARIO CREADO: ' +
              nuevoUsuario.nombre
            );

            this.abrirFormulario();
            this.cargarUsuarios();
          },
          error: (error) => {
            console.error('Error al crear:', error);
            alert('ERROR: No se pudo crear el usuario.');
          }
        });
    }
  }

  editarUsuario(usuario: UsuarioModel): void {
    this.abrirFormulario(usuario);
  }

  eliminarUsuario(usuario: UsuarioModel): void {

    if (!usuario.id_usuario) {
      alert('ERROR: El usuario no tiene ID.');
      return;
    }

    const confirmar = confirm(
      '¿Desea eliminar el usuario ' +
      usuario.nombre +
      '?'
    );

    if (!confirmar) {
      return;
    }

    this.usuarioService
      .eliminarUsuario(usuario.id_usuario)
      .subscribe({
        next: () => {
          alert(
            'USUARIO ELIMINADO: ' +
            usuario.nombre
          );

          this.cargarUsuarios();
        },
        error: (error) => {
          console.error('Error al eliminar:', error);
          alert('ERROR: No se pudo eliminar el usuario.');
        }
      });
  }
}
