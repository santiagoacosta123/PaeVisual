import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UnidadMedidaService } from '../services/unidad-medida.service';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  selector: 'app-unidades-medida',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './unidades-medida.html',
  styleUrls: ['./unidades-medida.css']
})
export class UnidadesMedidaComponent implements OnInit {

  unidades: any[] = [];

  cargando = false;
  modoEdicion = false;
  idSeleccionado: number | null = null;

  unidadForm = {
    nombre_unidad: '',
    abreviatura: ''
  };

  constructor(
    private unidadService: UnidadMedidaService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.cargarUnidades();
  }

  cargarUnidades(): void {
    this.cargando = true;

    this.unidadService.getUnidades().subscribe({
      next: (data: any) => {
        this.cargando = false;
        this.unidades = data;
        console.log('Unidades cargadas:', this.unidades);
      },
      error: (error) => {
        this.cargando = false;
        console.error('Error al cargar unidades:', error);
        this.sweetAlert.error(
          'Error de conexión',
          'No se pudieron cargar las unidades del servidor.'
        );
      }
    });
  }

  guardarUnidad(): void {
    if (!this.unidadForm.nombre_unidad.trim()) {
      this.sweetAlert.warning(
        'Campo obligatorio',
        'Por favor ingresa el nombre de la unidad.'
      );
      return;
    }

    if (this.modoEdicion && this.idSeleccionado !== null) {

      this.unidadService.actualizarUnidad(this.idSeleccionado, this.unidadForm).subscribe({
        next: () => {
          this.sweetAlert.success(
            'Unidad actualizada',
            'Los cambios se guardaron correctamente.'
          );
          this.cancelarEdicion();
          this.cargarUnidades();
        },
        error: () => {
          this.sweetAlert.error('Error', 'No se pudo actualizar la unidad.');
        }
      });

    } else {

      this.unidadService.crearUnidad(this.unidadForm).subscribe({
        next: (creada: any) => {
          this.sweetAlert.success(
            'Unidad creada',
            `La unidad "${creada.nombre_unidad}" fue registrada con éxito.`
          );
          this.limpiarFormulario();
          this.cargarUnidades();
        },
        error: () => {
          this.sweetAlert.error('Error', 'No se pudo registrar la unidad.');
        }
      });
    }
  }


  editarUnidad(unidad: any): void {
    this.modoEdicion = true;
    this.idSeleccionado = unidad.id_unidad_medida;
    this.unidadForm = {
      nombre_unidad: unidad.nombre_unidad,
      abreviatura: unidad.abreviatura || ''
    };
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.idSeleccionado = null;
    this.limpiarFormulario();
  }

  limpiarFormulario(): void {
    this.unidadForm = {
      nombre_unidad: '',
      abreviatura: ''
    };
  }


  eliminarUnidad(unidad: any): void {
    this.sweetAlert
      .confirm(
        '¿Eliminar unidad?',
        `¿Estás seguro de eliminar "${unidad.nombre_unidad}"?`,
        'Sí, eliminar'
      )
      .then((resultado) => {
        if (resultado.isConfirmed) {
          this.unidadService.eliminarUnidad(unidad.id_unidad_medida).subscribe({
            next: () => {
              this.sweetAlert.success('Eliminado', 'La unidad fue eliminada.');
              this.cargarUnidades();
            },
            error: () => {
              this.sweetAlert.error('Error', 'No se pudo eliminar la unidad.');
            }
          });
        }
      });
  }
}