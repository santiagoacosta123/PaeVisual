
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { SweetAlertService } from '../core/services/sweet-alert.service';
import { NotificacionService } from './notificacion.service';
import {
  Notificacion,
  NotificacionDestinatario
} from './notificacion.model';

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
  destinatarios: NotificacionDestinatario[] = [];
  destinatarioSeleccionadoId: number | null = null;
  cargandoDestinatarios = false;

  constructor(
    private notificacionService: NotificacionService,
    private authService: AuthService,
    private alertas: SweetAlertService
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
        void this.alertas.supervisorError(
          'No se pudieron cargar tus avisos',
          'No fue posible consultar las notificaciones asignadas. Verifica tu conexión e inténtalo nuevamente.'
        );
      }
    });
  }

  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.idEdicion = null;
    this.destinatarios = [];
    this.destinatarioSeleccionadoId = null;

    this.notificacionForm = {
      titulo: '',
      mensaje: '',
      leida: false,
      fecha_creacion: ''
    };

    this.limpiarImagen();
    this.mostrarModal = true;

    if (this.requiereSeleccionDestinatario) {
      this.cargandoDestinatarios = true;
      this.notificacionService.obtenerDestinatarios()
        .pipe(finalize(() => this.cargandoDestinatarios = false))
        .subscribe({
          next: (destinatarios) => {
            this.destinatarios = destinatarios;
          },
          error: (err: any) => {
            console.error('Error al cargar los destinatarios:', err);
            void this.alertas.supervisorWarning(
              'Destinatarios no disponibles',
              err?.error?.error || 'No fue posible cargar los destinatarios para esta asignación.'
            );
          }
        });
    }
  }

  get puedeEnviarNotificaciones(): boolean {
    const rol = this.authService.normalizarRol(
      this.authService.obtenerUsuario()?.rol
    );
    return this.authService.esAdministrador(rol)
      || this.authService.esSupervisor(rol)
      || this.authService.esJefa(rol)
      || rol === 'manipuladora'
      || rol === 'manipuladora de alimentos';
  }

  get requiereSeleccionDestinatario(): boolean {
    const rol = this.authService.normalizarRol(
      this.authService.obtenerUsuario()?.rol
    );
    return this.authService.esSupervisor(rol)
      || rol === 'manipuladora'
      || rol === 'manipuladora de alimentos';
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
      void this.alertas.supervisorWarning('Imagen no válida', 'Selecciona un archivo con formato de imagen.');
      input.value = '';
      this.limpiarImagen();
      return;
    }

    const limiteBytes = 5 * 1024 * 1024;

    if (archivo.size > limiteBytes) {
      void this.alertas.supervisorWarning('Imagen demasiado pesada', 'La fotografía no puede superar los 5 MB.');
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
      void this.alertas.supervisorWarning('Vista previa no disponible', 'No se pudo mostrar la fotografía seleccionada.');
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
      void this.alertas.supervisorWarning('Completa el aviso', 'Escribe el título y el mensaje antes de enviarlo.');
      return;
    }

    if (
      this.requiereSeleccionDestinatario
      && this.destinatarioSeleccionadoId === null
    ) {
      void this.alertas.supervisorWarning('Selecciona el destinatario', 'Elige a quién estará dirigido el aviso.');
      return;
    }

    if (titulo.length > 150) {
      void this.alertas.supervisorWarning('Título demasiado largo', 'El título no puede superar los 150 caracteres.');
      return;
    }

    // El backend proporcionado utiliza el endpoint "enviar"
    // para crear notificaciones y distribuirlas según el rol.
    if (this.modoEdicion) {
      void this.alertas.supervisorWarning(
        'La edición no está disponible en el envío de notificaciones. ' +
        'Crea una nueva notificación para comunicar el cambio.',
        'Los avisos enviados se conservan como registro de comunicación.'
      );
      return;
    }

    this.enviando = true;

    this.notificacionService
      .enviarNotificacion(
        titulo,
        mensaje,
        this.imagenSeleccionada,
        this.destinatarioSeleccionadoId
      )
      .pipe(finalize(() => this.enviando = false))
      .subscribe({
        next: (respuesta) => {
          const cantidad = respuesta.cantidad_destinatarios;

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
            void this.alertas.supervisorSuccess(
              'Aviso enviado',
              `La notificación fue entregada correctamente a ${cantidad} destinatario(s).`
            );
          } else {
            void this.alertas.supervisorSuccess(
              'Aviso enviado',
              respuesta.mensaje || 'La notificación fue enviada correctamente.'
            );
          }
        },
        error: (err: any) => {
          console.error('Error al enviar la notificación:', err);

          const detalle =
            err?.error?.error ||
            err?.error?.detail ||
            err?.error?.mensaje;

          void this.alertas.supervisorError(
            'No se pudo enviar el aviso',
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
        void this.alertas.supervisorWarning('No se pudo actualizar el aviso', 'La notificación no pudo marcarse como leída.');
      }
    });
  }
  eliminar(id?: number): void {
    if (id === undefined) {
      return;
    }

    void this.alertas.supervisorConfirm(
      '¿Eliminar este aviso?',
      'La notificación desaparecerá del historial.',
      'Sí, eliminar'
    ).then((resultado) => {
      if (!resultado.isConfirmed) return;
      this.notificacionService.eliminarNotificacion(id).subscribe({
        next: () => {
          void this.alertas.supervisorSuccess('Aviso eliminado', 'La notificación fue eliminada correctamente.');
          this.cargarNotificaciones();
        },
        error: (err: any) => {
          console.error('Error al eliminar:', err);
          void this.alertas.supervisorError('No se pudo eliminar el aviso', 'Verifica tu sesión e inténtalo nuevamente.');
        }
      });
    });
  }

  obtenerImagen(noti: Notificacion): string | null {
    return noti.imagen_url || null;
  }
}
