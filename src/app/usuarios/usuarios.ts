import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SweetAlertService } from '../sweet-alert.service';
import { UsuarioService } from '../services/usuario.service';
import { Usuario } from '../models/usuario.model';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.css']
})
export class UsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  modoEdicion = false;
  usuarioForm: Usuario = { nombre: '', rol: 'Admin', estado: 'Activo' };
  usuarioSeleccionadoId?: number;

  constructor(
    private sweetAlert: SweetAlertService,
    private usuarioService: UsuarioService
  ) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.usuarioService.getUsuarios().subscribe((data) => {
      this.usuarios = data;
    });
  }

  abrirFormulario(usuario?: Usuario) {
    if (usuario) {
      this.modoEdicion = true;
      this.usuarioSeleccionadoId = usuario.id;
      this.usuarioForm = { ...usuario };
      return;
    }

    this.modoEdicion = false;
    this.usuarioSeleccionadoId = undefined;
    this.usuarioForm = { nombre: '', rol: 'Admin', estado: 'Activo' };
  }

  guardarUsuario() {
    if (!this.usuarioForm.nombre.trim()) {
      this.sweetAlert.warning('Nombre requerido', 'Escribe el nombre del usuario antes de guardar.');
      return;
    }

    if (this.modoEdicion && this.usuarioSeleccionadoId) {
      this.usuarioService.actualizarUsuario(this.usuarioSeleccionadoId, this.usuarioForm).subscribe(() => {
        this.sweetAlert.success('Usuario actualizado', `${this.usuarioForm.nombre} se actualizó correctamente.`);
        this.cargarUsuarios();
      });
    } else {
      this.usuarioService.crearUsuario(this.usuarioForm).subscribe(() => {
        this.sweetAlert.success('Usuario creado', `${this.usuarioForm.nombre} fue agregado al sistema.`);
        this.cargarUsuarios();
      });
    }

    this.abrirFormulario();
  }

  editarUsuario(usuario: Usuario) {
    this.abrirFormulario(usuario);
  }

  eliminarUsuario(usuario: Usuario) {
    this.sweetAlert
      .confirm('¿Eliminar usuario?', `¿Desea continuar con la eliminación de ${usuario.nombre}?`)
      .then((result) => {
        if (result.isConfirmed && usuario.id) {
          this.usuarioService.eliminarUsuario(usuario.id).subscribe(() => {
            this.sweetAlert.success('Usuario eliminado', `${usuario.nombre} fue removido del sistema.`);
            this.cargarUsuarios();
          });
        }
      });
  }
}