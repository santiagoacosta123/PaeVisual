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
  mostrarModal = false;
  rolForm: RolModel = { nombre: '', descripcion: '' };

  constructor(private rolService: RolService, private sweetAlert: SweetAlertService) {}

  ngOnInit(): void { 
    this.cargarRoles(); 
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (datos) => { this.roles = datos; },
      error: (err) => {
        console.error('Error al cargar roles:', err);
      }
    });
  }

  abrirFormulario(rol?: RolModel): void {
    this.mostrarModal = true;
    if (rol) { 
      this.modoEdicion = true; 
      this.rolForm = { ...rol }; 
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
      nombre_rol: this.rolForm.nombre
    };

    if (this.modoEdicion && this.rolForm.id_rol) {
      // Si estamos editando, sí guardamos y cerramos normalmente
      this.rolService.actualizarRol(this.rolForm.id_rol, datosEnviar).subscribe({
        next: () => {
          this.sweetAlert.success('Rol actualizado', 'El rol se actualizó correctamente.');
          this.cerrarFormulario(); 
          this.cargarRoles();
        },
        error: (err) => {
          console.error('Error al actualizar rol:', err);
          this.sweetAlert.error('Error', 'No se pudo actualizar el rol.');
        }
      });
    } else {
      // Si estamos CREANDO uno nuevo: guardamos, recargamos la tabla y LIMPIAMOS el formulario SIN cerrar el modal
      this.rolService.crearRol(datosEnviar).subscribe({
        next: () => {
          this.cargarRoles();
          this.rolForm = { nombre: '', descripcion: '' }; // Limpia las cajas para el siguiente
          // Opcional: una alerta sutil o un aviso de que ya se guardó y puedes seguir escribiendo
          this.sweetAlert.success('¡Guardado!', 'Rol agregado con éxito. Puedes registrar otro.');
        },
        error: (err) => {
          console.error('Error al crear rol:', err);
          this.sweetAlert.error('Error', 'No se pudo crear el rol.');
        }
      });
    }
  }

  editarRol(rol: RolModel): void { 
    this.abrirFormulario(rol); 
  }

  eliminarRol(rol: RolModel): void {
    if (!rol.id_rol) return;
    this.sweetAlert.confirm('¿Eliminar rol?', `¿Desea eliminar el rol ${rol.nombre}?`, 'Sí, eliminar')
      .then((res: any) => {
        if (res.isConfirmed) {
          this.rolService.eliminarRol(rol.id_rol!).subscribe({
            next: () => {
              this.sweetAlert.success('Rol eliminado', 'El rol se eliminó correctamente.');
              this.cargarRoles();
            },
            error: (err) => {
              console.error('Error al eliminar rol:', err);
              this.sweetAlert.error('Error', 'No se pudo eliminar el rol.');
            }
          });
        }
      });
  }
}