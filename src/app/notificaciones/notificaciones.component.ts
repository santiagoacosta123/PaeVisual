import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { SweetAlertService } from '../core/services/sweet-alert.service';
import { NotificacionService, OpcionesNotificacion } from './notificacion.service';
import {
  Notificacion,
  NotificacionDestinatario,
  PlantillaAviso,
  PrioridadNotificacion,
  CategoriaNotificacion
} from './notificacion.model';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notificaciones.component.html',
  styles: []
})
export class NotificacionesComponent implements OnInit {
  private notificacionService = inject(NotificacionService);
  public authService = inject(AuthService);
  private alertas = inject(SweetAlertService, { optional: true });
  private router = inject(Router, { optional: true });
  private cdr = inject(ChangeDetectorRef);

  listaNotificaciones: Notificacion[] = [];
  notificacionDetalle: Notificacion | null = null;

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

  // Filtros y Búsqueda
  filtroEstado: 'todas' | 'no_leidas' | 'leidas' = 'todas';
  filtroPrioridad: string = 'todas';
  busqueda: string = '';

  // Metadatos de la nueva notificación según rol
  prioridadSeleccionada: PrioridadNotificacion = 'media';
  categoriaSeleccionada: CategoriaNotificacion = 'sistema';
  rutaAccionSugerida: string = '';
  plantillaActivaId: string | null = null;

  constructor() {}

  ngOnInit(): void {
    this.cargarNotificaciones();
  }

  // Identificación de Roles segura (compatible con mocks de pruebas)
  get rolUsuarioNormalizado(): string {
    const usuario = this.authService?.obtenerUsuario ? this.authService.obtenerUsuario() : null;
    const rol = usuario?.rol;
    if (this.authService?.normalizarRol) {
      return this.authService.normalizarRol(rol);
    }
    return rol?.toLowerCase() ?? '';
  }

  get esSuperAdmin(): boolean {
    const rol = this.rolUsuarioNormalizado;
    if (this.authService?.esSuperAdministrador) {
      return this.authService.esSuperAdministrador(rol);
    }
    return rol === 'superadministrador'
      || rol === 'super administrador'
      || rol === 'super admin';
  }

  get esAdminInstitucional(): boolean {
    if (this.esSuperAdmin) return false;
    const rol = this.rolUsuarioNormalizado;
    if (this.authService?.esAdministrador) {
      return Boolean(this.authService.esAdministrador(rol));
    }
    return rol === 'administrador' || rol === 'admin' || rol === 'administrador institucional';
  }

  get esSupervisor(): boolean {
    const rol = this.rolUsuarioNormalizado;
    if (this.authService?.esSupervisor) {
      return this.authService.esSupervisor(rol);
    }
    return rol === 'supervisor' || rol === 'coordinador' || rol === 'coordinador pae';
  }

  get esManipuladora(): boolean {
    const rol = this.rolUsuarioNormalizado;
    if (this.authService?.esJefa) {
      return this.authService.esJefa(rol) || rol === 'manipuladora' || rol === 'manipuladora de alimentos';
    }
    return rol === 'manipuladora' || rol === 'manipuladora de alimentos' || rol === 'jefa de manipuladoras';
  }

  get puedeEnviarNotificaciones(): boolean {
    return this.esSuperAdmin || this.esAdminInstitucional || this.esSupervisor || this.esManipuladora;
  }

  get requiereSeleccionDestinatario(): boolean {
    return this.esAdminInstitucional || this.esSupervisor || this.esManipuladora;
  }

  // Plantillas Rápidas Contextuales según el Rol
  get plantillasDisponibles(): PlantillaAviso[] {
    if (this.esManipuladora) {
      return [
        {
          id: 'faltante-cocina',
          etiqueta: 'Faltante de víveres',
          titulo: '[Faltante de víveres] Insumo insuficiente en cocina',
          mensaje: 'Reporto faltante de insumos para la minuta del día en la sede:\n- Insumo(s) faltante(s): \n- Cantidad requerida: \n- Raciones escolares afectadas: \nFavor gestionar reposición urgente.',
          prioridad: 'alta',
          categoria: 'inventario',
          icono: 'inventory_2',
          rutaSugerida: '/entradas-ajustes-inventario'
        },
        {
          id: 'novedad-recepcion',
          etiqueta: 'Novedad en entrega',
          titulo: '[Novedad en entrega] Alimento no conforme / Faltante',
          mensaje: 'Se recibe entrega de alimentos con novedad en campo:\n- Alimento o producto afectado: \n- Motivo (mal estado / empaque roto / diferencia de peso): \nAdjunto fotografía para verificación del supervisor.',
          prioridad: 'critica',
          categoria: 'entrega',
          icono: 'assignment_late',
          rutaSugerida: '/registrar-entrega-alimentos'
        },
        {
          id: 'asistencia-raciones',
          etiqueta: 'Asistencia y Raciones',
          titulo: '[Asistencia diaria] Novedad en raciones servidas',
          mensaje: 'Se consolida el servicio de raciones del día:\n- Raciones preparadas: \n- Estudiantes asistentes: \n- Sobrantes o ajustes de ración: ',
          prioridad: 'media',
          categoria: 'asistencia',
          icono: 'how_to_reg',
          rutaSugerida: '/asistencia-diaria'
        }
      ];
    }

    if (this.esSupervisor) {
      return [
        {
          id: 'despacho-camino',
          etiqueta: 'Despacho programado',
          titulo: '[Despacho programado] Entrega de alimentos en camino',
          mensaje: 'Equipo de cocina: El proveedor se encuentra en ruta para entrega de víveres. Por favor verificar remisión, gramajes y estado de alimentos al recibir.',
          prioridad: 'media',
          categoria: 'entrega',
          icono: 'local_shipping',
          rutaSugerida: '/registrar-entrega-alimentos'
        },
        {
          id: 'ajuste-minuta',
          etiqueta: 'Ajuste en minuta',
          titulo: '[Ajuste de menú] Modificación autorizada de componente',
          mensaje: 'Por contingencia de abastecimiento se autoriza el siguiente cambio de minuta:\n- Componente sustituto: \n- Raciones autorizadas: \nFavor registrar en el reporte de consumo.',
          prioridad: 'media',
          categoria: 'menu',
          icono: 'restaurant_menu',
          rutaSugerida: '/menus'
        },
        {
          id: 'escalamiento-superadmin',
          etiqueta: 'Escalamiento a Super Admin',
          titulo: '[Escalamiento urgente] Incumplimiento crítico de contratista',
          mensaje: 'Se reporta a la administración central situación de desabastecimiento / no conformidad reiterada de operador en la zona.\n- Contrato / Proveedor: \n- Sedes afectadas: \n- Impacto de raciones: ',
          prioridad: 'critica',
          categoria: 'contrato',
          icono: 'warning',
          rutaSugerida: '/contratos'
        },
        {
          id: 'visita-tecnica',
          etiqueta: 'Visita de supervisión',
          titulo: '[Visita técnica] Acompañamiento y verificación en sede',
          mensaje: 'Se programa visita técnica de supervisión en cocina para verificación de condiciones de inocuidad, gramajes y almacenamiento.',
          prioridad: 'baja',
          categoria: 'sistema',
          icono: 'verified_user',
          rutaSugerida: '/dashboard-supervisor'
        }
      ];
    }

    // Super Admin
    return [
      {
        id: 'circular-general',
        etiqueta: 'Circular oficial PAE',
        titulo: '[Circular oficial] Directriz institucional del programa PAE',
        mensaje: 'Aviso a la red de supervisores y sedes operativas: Se comparte directriz general aplicable a partir de la fecha para el correcto desarrollo del programa.',
        prioridad: 'media',
        categoria: 'sistema',
        icono: 'campaign',
        rutaSugerida: '/inicio'
      },
      {
        id: 'alerta-contrato',
        etiqueta: 'Control de contratos',
        titulo: '[Contrato PAE] Límite presupuestal y ciclo de facturación',
        mensaje: 'Se notifica estado de ejecución contractual y fechas límite para legalización de actas de recibo y remisiones con los operadores.',
        prioridad: 'alta',
        categoria: 'contrato',
        icono: 'description',
        rutaSugerida: '/contratos'
      },
      {
        id: 'cierre-periodo',
        etiqueta: 'Cierre de ciclo / Auditoría',
        titulo: '[Cierre operativo] Consolidado de planillas y raciones',
        mensaje: 'Recordatorio a supervisores: Plazo final para cierre y validación de planillas de asistencia y reportes de consumo en el sistema.',
        prioridad: 'alta',
        categoria: 'asistencia',
        icono: 'fact_check',
        rutaSugerida: '/reportes-consumo'
      }
    ];
  }

  // Lista de Notificaciones Filtrada
  get notificacionesFiltradas(): Notificacion[] {
    const termino = this.busqueda.trim().toLowerCase();

    return this.listaNotificaciones.filter(noti => {
      // Filtro de estado
      const cumpleEstado = this.filtroEstado === 'todas'
        || (this.filtroEstado === 'no_leidas' && !noti.leida)
        || (this.filtroEstado === 'leidas' && noti.leida);

      if (!cumpleEstado) return false;

      // Filtro de prioridad
      if (this.filtroPrioridad !== 'todas') {
        const pNoti = noti.prioridad || this.deducirPrioridad(noti);
        if (pNoti !== this.filtroPrioridad) return false;
      }

      // Filtro de texto de búsqueda
      if (termino) {
        const tituloMatch = (noti.titulo || '').toLowerCase().includes(termino);
        const mensajeMatch = (noti.mensaje || '').toLowerCase().includes(termino);
        const remitenteMatch = (noti.nombre_remitente || '').toLowerCase().includes(termino);
        const sedeMatch = (noti.nombre_sede || '').toLowerCase().includes(termino);
        if (!tituloMatch && !mensajeMatch && !remitenteMatch && !sedeMatch) {
          return false;
        }
      }

      return true;
    });
  }

  get totalNoLeidas(): number {
    return this.listaNotificaciones.filter(n => !n.leida).length;
  }

  get totalLeidas(): number {
    return this.listaNotificaciones.filter(n => n.leida).length;
  }

  private refrescarVista(): void {
    this.cdr.markForCheck();
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignorar si aún no está montado
    }
  }

  cambiarFiltroEstado(estado: 'todas' | 'no_leidas' | 'leidas'): void {
    this.filtroEstado = estado;
    this.refrescarVista();
  }

  abrirDetalleNotificacion(noti: Notificacion): void {
    this.notificacionDetalle = noti;
    this.refrescarVista();
  }

  cerrarDetalleNotificacion(): void {
    const noti = this.notificacionDetalle;
    this.notificacionDetalle = null;
    if (noti && !noti.leida) {
      const id = noti.id_notificacion ?? noti.id;
      noti.leida = true;
      this.listaNotificaciones = this.listaNotificaciones.map(item =>
        (item.id_notificacion ?? item.id) === id ? { ...item, leida: true } : item
      );
      this.refrescarVista();
      if (id !== undefined) {
        this.marcarLeida(id);
      }
    } else {
      this.refrescarVista();
    }
  }

  marcarNoLeida(noti: Notificacion): void {
    const id = noti.id_notificacion ?? noti.id;
    noti.leida = false;
    this.listaNotificaciones = this.listaNotificaciones.map(item =>
      (item.id_notificacion ?? item.id) === id ? { ...item, leida: false } : item
    );
    if (this.notificacionDetalle && (this.notificacionDetalle.id_notificacion ?? this.notificacionDetalle.id) === id) {
      this.notificacionDetalle = null;
    }
    this.refrescarVista();

    if (id !== undefined && this.notificacionService.marcarComoNoLeida) {
      this.notificacionService.marcarComoNoLeida(id).subscribe({
        next: () => this.cargarNotificaciones(),
        error: (err: any) => console.error('Error al marcar como no leída:', err)
      });
    }
  }

  cargarNotificaciones(): void {
    this.notificacionService.obtenerNotificaciones().subscribe({
      next: (data: Notificacion[]) => {
        this.listaNotificaciones = data;
        this.refrescarVista();
      },
      error: (err: any) => {
        console.error('Error al cargar notificaciones:', err);
        if (this.alertas) {
          void this.alertas.supervisorError(
            'No se pudieron cargar tus avisos',
            'No fue posible consultar las notificaciones asignadas. Verifica tu conexión e inténtalo nuevamente.'
          );
        }
      }
    });
  }

  abrirModalCrear(): void {
    this.modoEdicion = false;
    this.idEdicion = null;
    this.destinatarios = [];
    this.destinatarioSeleccionadoId = null;
    this.plantillaActivaId = null;

    this.notificacionForm = {
      titulo: '',
      mensaje: '',
      leida: false,
      fecha_creacion: ''
    };

    this.prioridadSeleccionada = this.esManipuladora ? 'alta' : 'media';
    this.categoriaSeleccionada = this.esManipuladora ? 'inventario' : 'sistema';
    this.rutaAccionSugerida = '';

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
            if (this.alertas) {
              void this.alertas.supervisorWarning(
                'Destinatarios no disponibles',
                err?.error?.error || 'No fue posible cargar los destinatarios para esta asignación.'
              );
            }
          }
        });
    }
  }

  seleccionarPlantilla(plantilla: PlantillaAviso): void {
    this.plantillaActivaId = plantilla.id;
    this.notificacionForm.titulo = plantilla.titulo;
    this.notificacionForm.mensaje = plantilla.mensaje;
    this.prioridadSeleccionada = plantilla.prioridad;
    this.categoriaSeleccionada = plantilla.categoria;
    this.rutaAccionSugerida = plantilla.rutaSugerida || '';
  }

  abrirModalEditar(noti: Notificacion): void {
    this.modoEdicion = true;
    this.idEdicion = noti.id ?? noti.id_notificacion ?? null;
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
      if (this.alertas) {
        void this.alertas.supervisorWarning('Imagen no válida', 'Selecciona un archivo con formato de imagen.');
      }
      input.value = '';
      this.limpiarImagen();
      return;
    }

    const limiteBytes = 5 * 1024 * 1024;

    if (archivo.size > limiteBytes) {
      if (this.alertas) {
        void this.alertas.supervisorWarning('Imagen demasiado pesada', 'La fotografía no puede superar los 5 MB.');
      }
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
      if (this.alertas) {
        void this.alertas.supervisorWarning('Vista previa no disponible', 'No se pudo mostrar la fotografía seleccionada.');
      }
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
      if (this.alertas) {
        void this.alertas.supervisorWarning('Completa el aviso', 'Escribe el título y el mensaje antes de enviarlo.');
      }
      return;
    }

    if (this.requiereSeleccionDestinatario && this.destinatarioSeleccionadoId === null) {
      if (this.alertas) {
        void this.alertas.supervisorWarning('Selecciona el destinatario', 'Elige a quién estará dirigido el aviso.');
      }
      return;
    }

    if (titulo.length > 150) {
      if (this.alertas) {
        void this.alertas.supervisorWarning('Título demasiado largo', 'El título no puede superar los 150 caracteres.');
      }
      return;
    }

    if (this.modoEdicion) {
      if (this.alertas) {
        void this.alertas.supervisorWarning(
          'La edición no está disponible en el envío de notificaciones. ' +
          'Crea una nueva notificación para comunicar el cambio.',
          'Los avisos enviados se conservan como registro de comunicación.'
        );
      }
      return;
    }

    this.enviando = true;

    const opciones: OpcionesNotificacion = {
      prioridad: this.prioridadSeleccionada,
      categoria: this.categoriaSeleccionada,
      ruta_accion: this.rutaAccionSugerida
    };

    this.notificacionService
      .enviarNotificacion(
        titulo,
        mensaje,
        this.imagenSeleccionada,
        this.destinatarioSeleccionadoId,
        opciones
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

          if (this.alertas) {
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
          }
        },
        error: (err: any) => {
          console.error('Error al enviar la notificación:', err);
          const detalle = err?.error?.error || err?.error?.detail || err?.error?.mensaje;
          if (this.alertas) {
            void this.alertas.supervisorError(
              'No se pudo enviar el aviso',
              detalle || 'No se pudo enviar la notificación. Verifica tu sesión y la conexión con el backend.'
            );
          }
        }
      });
  }

  marcarLeida(id?: number): void {
    if (id === undefined) return;

    this.notificacionService.marcarComoLeida(id).subscribe({
      next: () => this.cargarNotificaciones(),
      error: (err: any) => {
        console.error('Error al marcar como leída:', err);
        if (this.alertas) {
          void this.alertas.supervisorWarning('No se pudo actualizar el aviso', 'La notificación no pudo marcarse como leída.');
        }
      }
    });
  }

  marcarTodasLeidas(): void {
    this.notificacionService.marcarTodasComoLeidas().subscribe({
      next: () => {
        if (this.alertas) {
          void this.alertas.supervisorSuccess('Avisos leídos', 'Todas las notificaciones fueron marcadas como leídas.');
        }
        this.cargarNotificaciones();
      },
      error: (err: any) => console.error('Error al marcar todas leídas:', err)
    });
  }

  eliminar(id?: number): void {
    if (id === undefined) return;

    if (!this.alertas) {
      this.notificacionService.eliminarNotificacion(id).subscribe({
        next: () => this.cargarNotificaciones()
      });
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
          void this.alertas?.supervisorSuccess('Aviso eliminado', 'La notificación fue eliminada correctamente.');
          this.cargarNotificaciones();
        },
        error: (err: any) => {
          console.error('Error al eliminar:', err);
          void this.alertas?.supervisorError('No se pudo eliminar el aviso', 'Verifica tu sesión e inténtalo nuevamente.');
        }
      });
    });
  }

  obtenerImagen(noti: Notificacion): string | null {
    return noti.imagen_url || null;
  }

  // Deducción inteligente de Prioridad si no viene explícita del backend
  deducirPrioridad(noti: Notificacion): PrioridadNotificacion {
    if (noti.prioridad) {
      return noti.prioridad as PrioridadNotificacion;
    }
    const texto = `${noti.titulo} ${noti.mensaje}`.toLowerCase();
    if (texto.includes('urgente') || texto.includes('critico') || texto.includes('alerta') || texto.includes('no apto')) {
      return 'critica';
    }
    if (texto.includes('faltante') || texto.includes('desabastecimiento') || texto.includes('vencimiento') || texto.includes('retraso')) {
      return 'alta';
    }
    if (texto.includes('minuta') || texto.includes('asistencia') || texto.includes('entrega') || texto.includes('despacho')) {
      return 'media';
    }
    return 'baja';
  }

  // Smart Deep Linking hacia el módulo PAE correspondiente
  detectarRutaAccion(noti: Notificacion): string | null {
    if (noti.ruta_accion) return noti.ruta_accion;
    if (noti.accion?.ruta) return noti.accion.ruta;

    const texto = `${noti.titulo} ${noti.mensaje}`.toLowerCase();
    if (texto.includes('entrega') || texto.includes('despacho') || texto.includes('mercado') || texto.includes('recepción')) {
      return '/registrar-entrega-alimentos';
    }
    if (texto.includes('inventario') || texto.includes('stock') || texto.includes('víveres') || texto.includes('viveres') || texto.includes('ajuste')) {
      return '/entradas-ajustes-inventario';
    }
    if (texto.includes('asistencia') || texto.includes('ración') || texto.includes('raciones')) {
      return '/asistencia-diaria';
    }
    if (texto.includes('minuta') || texto.includes('menú') || texto.includes('menu')) {
      return '/menus';
    }
    if (texto.includes('contrato') || texto.includes('operador') || texto.includes('proveedor')) {
      return '/contratos';
    }
    return null;
  }

  navegarAccion(noti: Notificacion): void {
    const id = noti.id_notificacion ?? noti.id;
    if (id !== undefined && !noti.leida) {
      this.marcarLeida(id);
    }

    const ruta = this.detectarRutaAccion(noti);
    if (ruta && this.router) {
      this.router.navigate([ruta]);
    }
  }
}
