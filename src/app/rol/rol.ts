import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolService } from '../services/rol.service';
import { RolModel } from '../models/rol.model';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-rol',
  styleUrls: ['./rol.css'],
  templateUrl: './rol.html',
})
export class Rol implements OnInit {
  roles: RolModel[] = [];
  modoEdicion = false;
  rolForm: RolModel = { nombre: '', descripcion: '' };

  constructor(private rolService: RolService, private sweetAlert: SweetAlertService) {}

  ngOnInit(): void { this.cargarRoles(); }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (datos) => { this.roles = datos; },
      error: () => { this.sweetAlert.error('Error', 'No se pudieron cargar los roles.'); }
    });
  }

  abrirFormulario(rol?: RolModel): void {
    if (rol) { this.modoEdicion = true; this.rolForm = { ...rol }; return; }
    this.modoEdicion = false;
    this.rolForm = { nombre: '', descripcion: '' };
  }

  guardarRol(): void {
    if (!this.rolForm.nombre.trim() || !this.rolForm.descripcion.trim()) {
      this.sweetAlert.warning('Campos incompletos', 'Completa el nombre y la descripción del rol.');
      return;
    }
    if (this.modoEdicion && this.rolForm.id_rol) {
      this.rolService.actualizarRol(this.rolForm.id_rol, this.rolForm).subscribe({
        next: () => {
          this.sweetAlert.success('Rol actualizado', 'El rol se actualizó correctamente.');
          this.abrirFormulario(); this.cargarRoles();
        },
        error: () => this.sweetAlert.error('Error', 'No se pudo actualizar el rol.')
      });
    } else {
      this.rolService.crearRol(this.rolForm).subscribe({
        next: () => {
          this.sweetAlert.success('Rol creado', 'El rol se registró correctamente.');
          this.abrirFormulario(); this.cargarRoles();
        },
        error: () => this.sweetAlert.error('Error', 'No se pudo crear el rol.')
      });
    }
  }

  editarRol(rol: RolModel): void { this.abrirFormulario(rol); }

  eliminarRol(rol: RolModel): void {
    if (!rol.id_rol) return;
    this.sweetAlert.confirm('¿Eliminar rol?', `¿Desea eliminar el rol ${rol.nombre}?`, 'Sí, eliminar')
      .then((res) => {
        if (res.isConfirmed) {
          this.rolService.eliminarRol(rol.id_rol!).subscribe({
            next: () => {
              this.sweetAlert.success('Rol eliminado', 'El rol se eliminó correctamente.');
              this.cargarRoles();
            },
            error: () => this.sweetAlert.error('Error', 'No se pudo eliminar el rol.')
          });
        }
      });
  }
}