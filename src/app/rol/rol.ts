import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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

  constructor(
    private rolService: RolService, 
    private sweetAlert: SweetAlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { 
    this.cargarRoles(); 
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (datos) => { 
        const rolesApi = Array.isArray(datos) ? datos : (datos as any).results || []; 
        this.roles = rolesApi.map((r: any) => ({
          ...r,
          nombre: r.nombre || r.nombre_rol || r.name
        }));
        this.cdr.detectChanges(); 
      },
      error: (err) => {
        console.error('Error al cargar roles:', err);
        this.sweetAlert.error('Error', 'No se pudieron cargar los roles del sistema.');
      }
    });
  }

  abrirFormulario(rol?: RolModel): void {
    this.mostrarModal = true;
    if (rol) { 
      this.modoEdicion = true; 
      this.rolForm = { ...rol, nombre: rol.nombre || (rol as any).nombre_rol }; 
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
      nombre: this.rolForm.nombre,
      nombre_rol: this.rolForm.nombre // Enviamos ambos para compatibilidad total con Django
    };

    if (this.modoEdicion && this.rolForm.id_rol) {
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
      this.rolService.crearRol(datosEnviar).subscribe({
        next: () => {
          this.cargarRoles();
          this.rolForm = { nombre: '', descripcion: '' }; 
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
    const idRol = rol.id_rol || (rol as any).id;
    if (!idRol) return;

    this.sweetAlert.confirm('¿Eliminar rol?', `¿Desea eliminar el rol ${rol.nombre}?`, 'Sí, eliminar')
      .then((res: any) => {
        if (res.isConfirmed) {
          this.rolService.eliminarRol(idRol).subscribe({
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