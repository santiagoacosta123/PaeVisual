import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  mostrarModal = false;

  unidadForm = {
    nombre: '',
    abreviatura: ''
  };

  constructor(
    private unidadService: UnidadMedidaService,
    private sweetAlert: SweetAlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarUnidades();
  }

  cargarUnidades(): void {
    this.cargando = true;

    this.unidadService.getUnidades().subscribe({
      next: (data: any) => {
        this.cargando = false;
        
        const unidadesApi = Array.isArray(data) ? data : (data?.results || data?.data || data?.unidades || []);
        
        this.unidades = unidadesApi.map((u: any) => ({
          ...u,
          id_unidad_medida: u.id_unidad_medida || u.id || u.pk,
          nombre: u.nombre || u.nombre_unidad || u.name,
          abreviatura: u.abreviatura || u.simbolo || ''
        }));

        console.log('Unidades procesadas:', this.unidades);
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.cargando = false;
        console.error('Error al cargar:', error);
        this.sweetAlert.error(
          'Error de conexión',
          'No se pudieron cargar las unidades del servidor.'
        );
      }
    });
  }

  abrirFormulario(unidad?: any): void {
    this.mostrarModal = true;
    if (unidad) {
      this.modoEdicion = true;
      this.idSeleccionado = unidad.id_unidad_medida || unidad.id || unidad.pk;
      this.unidadForm = {
        nombre: unidad.nombre || '',
        abreviatura: unidad.abreviatura || ''
      };
      return;
    }
    this.cancelarEdicion();
  }

  guardarUnidad(): void {
    if (!this.unidadForm.nombre || !this.unidadForm.nombre.trim()) {
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
        error: (err) => {
          console.error('Error al actualizar:', err);
          this.sweetAlert.error('Error', 'No se pudo actualizar la unidad.');
        }
      });

    } else {
      this.unidadService.crearUnidad(this.unidadForm).subscribe({
        next: (creada: any) => {
          this.sweetAlert.success(
            'Unidad creada',
            `La unidad "${creada?.nombre || this.unidadForm.nombre}" fue registrada con éxito.`
          );
          this.cancelarEdicion();
          this.cargarUnidades();
        },
        error: (err) => {
          console.error('Error al crear:', err);
          this.sweetAlert.error('Error', 'No se pudo registrar la unidad.');
        }
      });
    }
  }

  editarUnidad(unidad: any): void {
    this.abrirFormulario(unidad);
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.idSeleccionado = null;
    this.mostrarModal = false;
    this.limpiarFormulario();
  }

  limpiarFormulario(): void {
    this.unidadForm = {
      nombre: '',
      abreviatura: ''
    };
  }

  eliminarUnidad(unidad: any): void {
    const idUnidad = unidad.id_unidad_medida || unidad.id || unidad.pk;
    if (!idUnidad) {
      this.sweetAlert.error('Error', 'Esta unidad no tiene un ID válido.');
      return;
    }

    this.sweetAlert
      .confirm(
        '¿Eliminar unidad?',
        `¿Estás seguro de eliminar "${unidad.nombre}"?`,
        'Sí, eliminar'
      )
      .then((resultado: any) => {
        if (resultado.isConfirmed) {
          this.unidadService.eliminarUnidad(idUnidad).subscribe({
            next: () => {
              this.sweetAlert.success('Eliminado', 'La unidad fue eliminada.');
              this.cargarUnidades();
            },
            error: (err) => {
              console.error('Error al eliminar:', err);
              this.sweetAlert.error('Error', 'No se pudo eliminar la unidad.');
            }
          });
        }
      });
  }
}