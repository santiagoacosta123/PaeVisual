import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolService } from '../services/rol.service';
import { RolModel } from '../models/rol.model';

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

  rolForm: RolModel = {
    nombre: '',
    descripcion: ''
  };

  constructor(
    private rolService: RolService
  ) {}

  ngOnInit(): void {
    this.cargarRoles();
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (datos) => {
        this.roles = datos;

        alert('Roles cargados: ' + datos.length);
      },
      error: (error) => {
        console.error('Error al cargar roles:', error);
        alert('ERROR: No se pudieron cargar los roles.');
      }
    });
  }

  abrirFormulario(rol?: RolModel): void {

    if (rol) {
      this.modoEdicion = true;
      this.rolForm = { ...rol };
      return;
    }

    this.modoEdicion = false;

    this.rolForm = {
      nombre: '',
      descripcion: ''
    };
  }

  guardarRol(): void {

    if (
      !this.rolForm.nombre.trim() ||
      !this.rolForm.descripcion.trim()
    ) {
      alert(
        'ERROR: Completa el nombre y la descripción del rol.'
      );
      return;
    }

    if (this.modoEdicion && this.rolForm.id_rol) {

      this.rolService
        .actualizarRol(
          this.rolForm.id_rol,
          this.rolForm
        )
        .subscribe({

          next: (rolActualizado) => {

            alert(
              'ROL ACTUALIZADO: ' +
              rolActualizado.nombre
            );

            this.abrirFormulario();
            this.cargarRoles();
          },

          error: (error) => {

            console.error(
              'Error al actualizar:',
              error
            );

            alert(
              'ERROR: No se pudo actualizar el rol.'
            );
          }
        });

    } else {
      this.rolService
        .crearRol(this.rolForm)
        .subscribe({

          next: (nuevoRol) => {

            alert(
              'ROL CREADO: ' +
              nuevoRol.nombre
            );

            this.abrirFormulario();
            this.cargarRoles();
          },

          error: (error) => {

            console.error(
              'Error al crear:',
              error
            );

            alert(
              'ERROR: No se pudo crear el rol.'
            );
          }
        });
    }
  }

  editarRol(rol: RolModel): void {

    alert(
      'Editando rol: ' +
      rol.nombre
    );

    this.abrirFormulario(rol);
  }

  eliminarRol(rol: RolModel): void {

    if (!rol.id_rol) {
      alert('ERROR: El rol no tiene ID.');
      return;
    }

    const confirmar = confirm(
      '¿Desea eliminar el rol ' +
      rol.nombre +
      '?'
    );

    if (!confirmar) {
      return;
    }

    this.rolService
      .eliminarRol(rol.id_rol)
      .subscribe({

        next: () => {

          alert(
            'ROL ELIMINADO: ' +
            rol.nombre
          );

          this.cargarRoles();
        },

        error: (error) => {

          console.error(
            'Error al eliminar:',
            error
          );

          alert(
            'ERROR: No se pudo eliminar el rol.'
          );
        }
      });
  }
}