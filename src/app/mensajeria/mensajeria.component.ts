import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { MensajeriaService } from './mensajeria.service';
import { ContactoChat, Mensaje } from './mensajeria.model';
import { AuthService } from '../core/auth/auth.service';
import { SweetAlertService } from '../core/services/sweet-alert.service';

@Component({
  selector: 'app-mensajeria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mensajeria.component.html',
  styleUrls: ['./mensajeria.component.css']
})
export class MensajeriaComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('mensajesContainer') private mensajesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;

  contactos: ContactoChat[] = [];
  contactosFiltrados: ContactoChat[] = [];
  busqueda: string = '';

  contactoSeleccionado: ContactoChat | null = null;
  mensajes: Mensaje[] = [];

  cargandoContactos: boolean = false;
  cargandoMensajes: boolean = false;
  enviando: boolean = false;

  nuevoMensajeTexto: string = '';
  archivoImagen: File | null = null;
  vistaPreviaImagen: string | null = null;
  errorValidacion: string | null = null;

  imagenModalUrl: string | null = null;
  totalNoLeidos: number = 0;

  private pollSubscription?: Subscription;
  private shouldScrollBottom: boolean = false;

  constructor(
    private mensajeriaService: MensajeriaService,
    public authService: AuthService,
    private alertas: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.cargarContactos(true);

    // CA-11: Polling suave para sincronización de mensajes no leídos cada 5 segundos
    this.pollSubscription = interval(5000).subscribe(() => {
      this.cargarContactos(false);
      if (this.contactoSeleccionado) {
        this.recargarConversacionSilenciosa(this.contactoSeleccionado.id_usuario);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollBottom) {
      this.scrollToBottom();
      this.shouldScrollBottom = false;
    }
  }

  scrollToBottom(): void {
    try {
      if (this.mensajesContainer) {
        this.mensajesContainer.nativeElement.scrollTop =
          this.mensajesContainer.nativeElement.scrollHeight;
      }
    } catch {
      // scroll fallback
    }
  }

  cargarContactos(mostrarCargando: boolean = true): void {
    if (mostrarCargando) {
      this.cargandoContactos = true;
    }

    this.mensajeriaService.obtenerContactos().subscribe({
      next: (data) => {
        this.contactos = data;
        this.filtrarContactos();
        this.cargandoContactos = false;
        this.totalNoLeidos = this.contactos.reduce(
          (acc, c) => acc + (c.mensajes_no_leidos || 0),
          0
        );

        // Si hay contacto seleccionado, actualizar su referencia
        if (this.contactoSeleccionado) {
          const actualizado = this.contactos.find(
            (c) => c.id_usuario === this.contactoSeleccionado?.id_usuario
          );
          if (actualizado) {
            this.contactoSeleccionado = actualizado;
          }
        }
      },
      error: (err) => {
        this.cargandoContactos = false;
        console.error('Error al cargar contactos de mensajería:', err);
      }
    });
  }

  filtrarContactos(): void {
    const query = this.busqueda.trim().toLowerCase();
    if (!query) {
      this.contactosFiltrados = [...this.contactos];
    } else {
      this.contactosFiltrados = this.contactos.filter(
        (c) =>
          c.nombre_completo.toLowerCase().includes(query) ||
          c.rol.toLowerCase().includes(query) ||
          c.correo.toLowerCase().includes(query)
      );
    }
  }

  seleccionarContacto(contacto: ContactoChat): void {
    this.contactoSeleccionado = contacto;
    this.mensajes = [];
    this.cargandoMensajes = true;
    this.errorValidacion = null;
    this.limpiarAdjunto();

    this.mensajeriaService.obtenerConversacion(contacto.id_usuario).subscribe({
      next: (resp) => {
        this.mensajes = resp.mensajes || [];
        this.cargandoMensajes = false;
        this.shouldScrollBottom = true;

        // Resetear badge local del contacto
        contacto.mensajes_no_leidos = 0;
        this.totalNoLeidos = this.contactos.reduce(
          (acc, c) => acc + (c.mensajes_no_leidos || 0),
          0
        );
      },
      error: (err) => {
        this.cargandoMensajes = false;
        console.error('Error al cargar conversación:', err);
        const mensajeError =
          err?.error?.error ||
          err?.error?.detail ||
          'No fue posible cargar el historial de mensajes.';
        void this.alertas.supervisorError('Error de comunicación', mensajeError);
      }
    });
  }

  recargarConversacionSilenciosa(contactoId: number): void {
    this.mensajeriaService.obtenerConversacion(contactoId).subscribe({
      next: (resp) => {
        const nuevos = resp.mensajes || [];
        if (nuevos.length !== this.mensajes.length) {
          this.mensajes = nuevos;
          this.shouldScrollBottom = true;
        }
      },
      error: () => {}
    });
  }

  onSeleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.errorValidacion = null;

    if (!input.files || input.files.length === 0) {
      this.limpiarAdjunto();
      return;
    }

    const file = input.files[0];
    const nombre = file.name.toLowerCase();
    const extensionesPermitidas = ['.jpg', '.jpeg', '.png'];
    const esExtensionValida = extensionesPermitidas.some((ext) => nombre.endsWith(ext));

    if (!esExtensionValida) {
      this.errorValidacion = 'Solo se permiten imágenes en formato .jpg, .jpeg o .png.';
      this.limpiarAdjunto();
      return;
    }

    const tamanoMaximo = 5 * 1024 * 1024; // 5MB
    if (file.size > tamanoMaximo) {
      this.errorValidacion = 'La imagen no puede exceder el límite de 5MB.';
      this.limpiarAdjunto();
      return;
    }

    this.archivoImagen = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.vistaPreviaImagen = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  limpiarAdjunto(): void {
    this.archivoImagen = null;
    this.vistaPreviaImagen = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  enviarMensaje(): void {
    if (!this.contactoSeleccionado || this.enviando) {
      return;
    }

    const texto = this.nuevoMensajeTexto.trim();
    if (!texto && !this.archivoImagen) {
      this.errorValidacion = 'Escribe un mensaje o adjunta una imagen antes de enviar.';
      return;
    }

    this.errorValidacion = null;
    this.enviando = true;

    this.mensajeriaService
      .enviarMensaje(this.contactoSeleccionado.id_usuario, texto, this.archivoImagen)
      .subscribe({
        next: (mensajeCreado) => {
          this.mensajes.push(mensajeCreado);
          this.nuevoMensajeTexto = '';
          this.limpiarAdjunto();
          this.enviando = false;
          this.shouldScrollBottom = true;

          // Actualizar último mensaje en la lista
          if (this.contactoSeleccionado) {
            this.contactoSeleccionado.ultimo_mensaje =
              mensajeCreado.contenido_texto || '📷 [Imagen]';
            this.contactoSeleccionado.ultima_fecha = mensajeCreado.fecha_envio;
          }
        },
        error: (err) => {
          this.enviando = false;
          console.error('Error al enviar mensaje:', err);
          const errorMsg =
            err?.error?.error ||
            err?.error?.detail ||
            'Error al enviar el mensaje. Verifica tus permisos y conexión.';
          void this.alertas.supervisorError('Envío no permitido', errorMsg);
        }
      });
  }

  abrirModalImagen(url: string | null): void {
    this.imagenModalUrl = url;
  }

  cerrarModalImagen(): void {
    this.imagenModalUrl = null;
  }

  formatearHora(fechaIso: string): string {
    if (!fechaIso) return '';
    try {
      const fecha = new Date(fechaIso);
      return fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  formatearFechaRelativa(fechaIso: string | null): string {
    if (!fechaIso) return '';
    try {
      const fecha = new Date(fechaIso);
      const hoy = new Date();
      if (fecha.toDateString() === hoy.toDateString()) {
        return fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return fecha.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  obtenerColorRol(rol: string): string {
    const rolNorm = (rol || '').toLowerCase();
    if (rolNorm.includes('super')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (rolNorm.includes('admin')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (rolNorm.includes('supervisor')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (rolNorm.includes('jefa')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
