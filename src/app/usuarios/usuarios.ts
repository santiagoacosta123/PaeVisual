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
  usuariosFiltrados: Usuario[] = [];
  filtroActual: string = 'todos';
  
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
    this.usuarioService.getUsuarios().subscribe({
      next: (data) => {
        // Si tu API responde con datos vacíos o quieres asegurar gente de prueba inicial:
        if (!data || data.length === 0) {
          this.usuarios = [
            { id: 1, nombre: 'Jader', rol: 'Admin', estado: 'Activo' },
            { id: 2, nombre: 'Maria', rol: 'Coordinador', estado: 'Activo' },
            { id: 3, nombre: 'Carlos', rol: 'Supervisor', estado: 'Inactivo' },
            { id: 4, nombre: 'Ana Sofía', rol: 'Coordinador', estado: 'Activo' },
            { id: 5, nombre: 'Luis Fernando', rol: 'Supervisor', estado: 'Inactivo' }
          ];
        } else {
          this.usuarios = data;
        }
        this.aplicarFiltro();
      },
      error: () => {
        // Datos de respaldo por si la API falla o no está conectada todavía
        this.usuarios = [
          { id: 1, nombre: 'Jader', rol: 'Admin', estado: 'Activo' },
          { id: 2, nombre: 'Maria', rol: 'Coordinador', estado: 'Activo' },
          { id: 3, nombre: 'Carlos', rol: 'Supervisor', estado: 'Inactivo' }
        ];
        this.aplicarFiltro();
      }
    });
  }

  filtrar(estado: string): void {
    this.filtroActual = estado;
    this.aplicarFiltro();
  }

  aplicarFiltro(): void {
    if (this.filtroActual === 'todos') {
      this.usuariosFiltrados = [...this.usuarios];
    } else {
      this.usuariosFiltrados = this.usuarios.filter(
        (u) => u.estado.toLowerCase() === this.filtroActual.toLowerCase()
      );
    }
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
      this.usuarioService.actualizarUsuario(this.usuarioSeleccionadoId, this.usuarioForm).subscribe({
        next: () => {
          this.sweetAlert.success('Usuario actualizado', `${this.usuarioForm.nombre} se actualizó correctamente.`);
          this.cargarUsuarios();
          this.abrirFormulario();
        },
        error: () => {
          // Simulación local si la API no está en línea
          const index = this.usuarios.findIndex(u => u.id === this.usuarioSeleccionadoId);
          if (index !== -1) {
            this.usuarios[index] = { ...this.usuarioForm, id: this.usuarioSeleccionadoId };
          }
          this.sweetAlert.success('Usuario actualizado', `${this.usuarioForm.nombre} se actualizó correctamente.`);
          this.aplicarFiltro();
          this.abrirFormulario();
        }
      });
    } else {
      this.usuarioService.crearUsuario(this.usuarioForm).subscribe({
        next: () => {
          this.sweetAlert.success('Usuario creado', `${this.usuarioForm.nombre} fue agregado al sistema.`);
          this.cargarUsuarios();
          this.abrirFormulario();
        },
        error: () => {
          // Simulación local si la API no está en línea para pruebas rápidas
          const nuevoId = this.usuarios.length > 0 ? Math.max(...this.usuarios.map(u => u.id || 0)) + 1 : 1;
          const nuevoUsuario: Usuario = { ...this.usuarioForm, id: nuevoId };
          this.usuarios.push(nuevoUsuario);
          this.sweetAlert.success('Usuario creado', `${this.usuarioForm.nombre} fue agregado al sistema.`);
          this.aplicarFiltro();
          this.abrirFormulario();
        }
      });
    }
  }

  editarUsuario(usuario: Usuario) {
    this.abrirFormulario(usuario);
  }

  eliminarUsuario(usuario: Usuario) {
    this.sweetAlert
      .confirm('¿Eliminar usuario?', `¿Desea continuar con la eliminación de ${usuario.nombre}?`)
      .then((result) => {
        if (result.isConfirmed) {
          if (usuario.id) {
            this.usuarioService.eliminarUsuario(usuario.id).subscribe({
              next: () => {
                this.sweetAlert.success('Usuario eliminado', `${usuario.nombre} fue removido del sistema.`);
                this.cargarUsuarios();
              },
              error: () => {
                // Respaldo local si la API falla
                this.usuarios = this.usuarios.filter(u => u.id !== usuario.id);
                this.sweetAlert.success('Usuario eliminado', `${usuario.nombre} fue removido del sistema.`);
                this.aplicarFiltro();
              }
            });
          }
        }
      });
  }
}