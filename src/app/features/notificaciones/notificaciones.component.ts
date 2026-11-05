import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificacionService } from './notificacion.service';
import { Notificacion } from './notificacion.model';
import { SweetAlertService } from '../../core/services/sweet-alert.service';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notificaciones.component.html',
  styles: []
})
export class NotificacionesComponent implements OnInit {
  listaNotificaciones: Notificacion[] = [];
  
  notificacionForm: Notificacion = { titulo: '', mensaje: '', leida: false, fecha_creacion: '' };
  modoEdicion: boolean = false;
  idEdicion: number | null = null;
  mostrarModal: boolean = false;

  constructor(
    private notificacionService: NotificacionService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.cargarNotificaciones();
  }

  cargarNotificaciones(): void {
    this.notificacionService.obtenerNotificaciones().subscribe({
      next: (data: Notificacion[]) => {
        this.listaNotificaciones = data;
      },
      error: (err: any) => {
        console.error('Error al cargar notificaciones', err);
      }
    });
  }

  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.notificacionForm = { titulo: '', mensaje: '', leida: false, fecha_creacion: '' };
    this.mostrarModal = true;
  }

  abrirModalEditar(noti: Notificacion): void {
    this.modoEdicion = true;
    this.idEdicion = noti.id ?? null;
    this.notificacionForm = { ...noti };
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  guardarNotificacion(): void {
    if (!this.notificacionForm.titulo || !this.notificacionForm.mensaje) {
      void this.sweetAlert.warning('Completa el aviso', 'Escribe el título y el mensaje de la notificación.');
      return;
    }

    if (this.modoEdicion && this.idEdicion !== null) {
      this.notificacionService.actualizarNotificacion(this.idEdicion, this.notificacionForm).subscribe({
        next: () => {
          void this.sweetAlert.success('Notificación actualizada', 'Los cambios se guardaron correctamente.');
          this.cargarNotificaciones();
          this.cerrarModal();
        },
        error: (err: any) => console.error('Error al actualizar', err)
      });
    } else {
      this.notificacionService.crearNotificacion(this.notificacionForm).subscribe({
        next: () => {
          void this.sweetAlert.success('Notificación enviada', 'La notificación se creó y envió correctamente.');
          this.cargarNotificaciones();
          this.cerrarModal();
        },
        error: (err: any) => console.error('Error al crear', err)
      });
    }
  }

  marcarLeida(id?: number): void {
    if (id === undefined) return;
    this.notificacionService.marcarComoLeida(id).subscribe({
      next: () => {
        this.cargarNotificaciones();
      },
      error: (err: any) => console.error('Error al marcar como leída', err)
    });
  }

  eliminar(id?: number): void {
    if (id === undefined) return;
    void this.sweetAlert.confirm(
      '¿Eliminar esta notificación?',
      'Esta acción eliminará la notificación seleccionada.',
      'Sí, eliminar'
    ).then((resultado) => {
      if (!resultado.isConfirmed) return;
      this.notificacionService.eliminarNotificacion(id).subscribe({
        next: () => {
          void this.sweetAlert.success('Notificación eliminada', 'La notificación fue eliminada.');
          this.cargarNotificaciones();
        },
        error: (err: any) => console.error('Error al eliminar', err)
      });
    });
  }
}