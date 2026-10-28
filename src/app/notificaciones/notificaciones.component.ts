
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
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

  notificacionForm: Notificacion = {
    titulo: '',
    mensaje: '',
    leida: false,
    fecha_creacion: ''
  };

  modoEdicion = false;
  idEdicion: number | null = null;
  mostrarModal = false;
  enviando = false;

  imagenSeleccionada: File | null = null;
  vistaPreviaImagen: string | null = null;

  constructor(
    private notificacionService: NotificacionService
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
        console.error('Error al cargar notificaciones:', err);
        alert('No se pudieron cargar las notificaciones.');
      }
    });
  }

  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.idEdicion = null;

    this.notificacionForm = {
      titulo: '',
      mensaje: '',
      leida: false,
      fecha_creacion: ''
    };

    this.limpiarImagen();
    this.mostrarModal = true;
  }

  abrirModalEditar(noti: Notificacion): void {
    this.modoEdicion = true;
    this.idEdicion = noti.id ?? null;
    this.notificacionForm = { ...noti };
    this.limpiarImagen();
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    if (this.enviando) {
      return;
    }

    this.mostrarModal = false;
    this.limpiarImagen();
  }

  onImagenSeleccionada(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];

    if (!archivo) {
      return;
    }

    if (!archivo.type.startsWith('image/')) {
      alert('Selecciona un archivo de imagen válido.');
      input.value = '';
      this.limpiarImagen();
      return;
    }

    const limiteBytes = 5 * 1024 * 1024;

    if (archivo.size > limiteBytes) {
      alert('La fotografía no puede superar los 5 MB.');
      input.value = '';
      this.limpiarImagen();
      return;
    }

    this.imagenSeleccionada = archivo;

    const lector = new FileReader();

    lector.onload = () => {
      this.vistaPreviaImagen = lector.result as string;
    };

    lector.onerror = () => {
      alert('No se pudo mostrar la vista previa de la fotografía.');
      this.limpiarImagen();
      input.value = '';
    };

    lector.readAsDataURL(archivo);
  }

  quitarImagen(input?: HTMLInputElement): void {
    this.limpiarImagen();

    if (input) {
      input.value = '';
    }
  }

  private limpiarImagen(): void {
    this.imagenSeleccionada = null;
    this.vistaPreviaImagen = null;
  }

  guardarNotificacion(): void {
    const titulo = this.notificacionForm.titulo?.trim() ?? '';
    const mensaje = this.notificacionForm.mensaje?.trim() ?? '';

    if (!titulo || !mensaje) {
      alert('Escribe el título y el mensaje de la notificación.');
      return;
    }

    if (titulo.length > 150) {
      alert('El título no puede superar los 150 caracteres.');
      return;
    }

    // El backend proporcionado utiliza el endpoint "enviar"
    // para crear notificaciones y distribuirlas según el rol.
    if (this.modoEdicion) {
      alert(
        'La edición no está disponible en el envío de notificaciones. ' +
        'Crea una nueva notificación para comunicar el cambio.'
      );
      return;
    }

    this.enviando = true;

    this.notificacionService
      .enviarNotificacion(
        titulo,
        mensaje,
        this.imagenSeleccionada
      )
      .pipe(finalize(() => this.enviando = false))
      .subscribe({
        next: (respuesta: any) => {
          const cantidad = respuesta?.cantidad_destinatarios;

          this.mostrarModal = false;
          this.limpiarImagen();

          this.notificacionForm = {
            titulo: '',
            mensaje: '',
            leida: false,
            fecha_creacion: ''
          };

          this.cargarNotificaciones();

          if (typeof cantidad === 'number') {
            alert(
              `Notificación enviada correctamente a ${cantidad} destinatario(s).`
            );
          } else {
            alert(
              respuesta?.mensaje ?? 'Notificación enviada correctamente.'
            );
          }
        },
        error: (err: any) => {
          console.error('Error al enviar la notificación:', err);

          const detalle =
            err?.error?.error ||
            err?.error?.detail ||
            err?.error?.mensaje;

          alert(
            detalle ||
            'No se pudo enviar la notificación. Verifica tu sesión y la conexión con el backend.'
          );
        }
      });
  }

  marcarLeida(id?: number): void {
  if (id === undefined) {
    return;
  }

  this.notificacionService.marcarComoLeida(id).subscribe({
    next: () => this.cargarNotificaciones(),
    error: (err: any) => {
      console.error('Error al marcar como leída:', err);
      alert('No se pudo marcar la notificación como leída.');
    }
  });
}
  eliminar(id?: number): void {
    if (id === undefined) {
      return;
    }

    if (!confirm('¿Estás seguro de eliminar esta notificación?')) {
      return;
    }

    this.notificacionService.eliminarNotificacion(id).subscribe({
      next: () => {
        alert('Notificación eliminada.');
        this.cargarNotificaciones();
      },
      error: (err: any) => {
        console.error('Error al eliminar:', err);
        alert('No se pudo eliminar la notificación.');
      }
    });
  }

  obtenerImagen(noti: Notificacion): string | null {
    const datos = noti as any;
    return datos.imagen_url || datos.imagen || null;
  }
}
