import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-rol',
  styleUrls: ['./rol.css'],
  templateUrl: './rol.html',
})
export class Rol {
  roles = [
    { nombre: 'Administrador', descripcion: 'Control total', estado: 'Activo' },
    { nombre: 'Coordinador', descripcion: 'Registra inventario', estado: 'Activo' },
    { nombre: 'Jefa', descripcion: 'Selecciona menú', estado: 'Activo' }
  ];

  modoEdicion = false;
  rolForm = { nombre: '', descripcion: '', estado: 'Activo' };

  constructor(private sweetAlert: SweetAlertService) {}

  abrirFormulario(rol?: { nombre: string; descripcion: string; estado: string }) {
    if (rol) {
      this.modoEdicion = true;
      this.rolForm = { ...rol };
      return;
    }

    this.modoEdicion = false;
    this.rolForm = { nombre: '', descripcion: '', estado: 'Activo' };
  }

  guardarRol() {
    if (!this.rolForm.nombre.trim() || !this.rolForm.descripcion.trim()) {
      this.sweetAlert.warning('Datos incompletos', 'Completa el nombre y la descripción del rol.');
      return;
    }

    if (this.modoEdicion) {
      const index = this.roles.findIndex((r) => r.nombre === this.rolForm.nombre);
      if (index >= 0) {
        this.roles[index] = { ...this.rolForm };
        this.sweetAlert.success('Rol actualizado', `${this.rolForm.nombre} fue actualizado.`);
      }
    } else {
      this.roles.push({ ...this.rolForm });
      this.sweetAlert.success('Rol creado', `${this.rolForm.nombre} fue agregado correctamente.`);
    }

    this.abrirFormulario();
  }

  editarRol(rol: { nombre: string; descripcion: string; estado: string }) {
    this.abrirFormulario(rol);
  }

  eliminarRol(rol: { nombre: string }) {
    this.sweetAlert
      .confirm('¿Eliminar rol?', `¿Desea remover el rol ${rol.nombre}?`)
      .then((result) => {
        if (result.isConfirmed) {
          this.roles = this.roles.filter((r) => r.nombre !== rol.nombre);
          this.sweetAlert.success('Rol eliminado', `${rol.nombre} fue quitado exitosamente.`);
        }
      });
  }
}
