import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificacionService } from './notificacion.service';
import { Notificacion } from './notificacion.model';

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

  constructor(private notificacionService: NotificacionService) {}

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
      alert('Por favor completa todos los campos requeridos.');
      return;
    }

    if (this.modoEdicion && this.idEdicion !== null) {
      this.notificacionService.actualizarNotificacion(this.idEdicion, this.notificacionForm).subscribe({
        next: () => {
          alert('Notificación actualizada con éxito');
          this.cargarNotificaciones();
          this.cerrarModal();
        },
        error: (err: any) => console.error('Error al actualizar', err)
      });
    } else {
      this.notificacionService.crearNotificacion(this.notificacionForm).subscribe({
        next: () => {
          alert('Notificación creada y enviada con éxito');
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
    if (confirm('¿Estás seguro de eliminar esta notificación?')) {
      this.notificacionService.eliminarNotificacion(id).subscribe({
        next: () => {
          alert('Notificación eliminada');
          this.cargarNotificaciones();
        },
        error: (err: any) => console.error('Error al eliminar', err)
      });
    }
  }
}