import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SweetAlertService } from '../sweet-alert.service';
import { AuthService } from '../services/auth.service';
import {
  Entrega,
  EntregaPayload,
  EntregasService,
  IngredienteOpcion,
  TipoMercadoOpcion,
} from '../services/entregas.service';

type FiltroMercado = 'Todas' | 'Granos' | 'Perecederos';

@Component({
  selector: 'app-historial-entregas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './historial-entregas.css',
  templateUrl: './historial-entregas.html',
})
export class HistorialEntregas implements OnInit {
  entregas: Entrega[] = [];
  ingredientes: IngredienteOpcion[] = [];
  tiposMercado: TipoMercadoOpcion[] = [];
  filtroMercado: FiltroMercado = 'Todas';
  filtroTexto = '';
  cargando = true;
  cargandoCatalogos = false;
  guardando = false;
  errorMensaje = '';
  crudAbierto = false;
  editandoId: number | null = null;
  private catalogosCargados = false;

  // Roles de usuario
  esAdministrador = false;
  esSupervisor = false;
  esSuperAdmin = false;

  // Modal de Recepción y Control de Calidad (Administrador)
  modalRecepcionAbierto = false;
  entregaSeleccionada: Entrega | null = null;
  formRecepcion = {
    cantidadRecibida: 0,
    cantidadRechazada: 0,
    motivoRechazo: '',
  };
  procesandoRecepcion = false;

  // Modal de Detalle de Novedad / Auditoría
  modalDetalleAbierto = false;
  entregaDetalle: Entrega | null = null;

  crudForm = this.formularioVacio();

  constructor(
    public entregasService: EntregasService,
    private alertas: SweetAlertService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.obtenerUsuario();
    const rol = user?.rol;
    this.esSuperAdmin = this.authService.esSuperAdministrador(rol);
    this.esSupervisor = this.authService.esSupervisor(rol);
    this.esAdministrador = (this.authService.esAdministrador(rol) || rol === 'admin' || rol === 'administrador') && !this.esSuperAdmin;

    this.cargarHistorial();
  }

  cargarHistorial(): void {
    this.cargando = true;
    this.errorMensaje = '';
    this.entregasService.cargar().subscribe({
      next: (entregas) => {
        this.entregas = entregas;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al consultar historial de entregas:', error);
        this.errorMensaje = error.status === 401
          ? 'La sesión expiró o no es válida. Inicia sesión nuevamente para consultar el historial.'
          : error.status === 403
            ? 'Tu usuario no tiene permiso para consultar el historial.'
            : 'No se pudo cargar el historial. Intenta nuevamente más tarde.';
        this.cargando = false;
        void this.alertas.error('No se pudo cargar el historial', this.errorMensaje);
      },
    });
  }

  // SP-249: Exportar historial de entregas a Excel
  exportarExcel(): void {
    this.entregasService.exportarExcel().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Historial_Entregas_${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        void this.alertas.success('Exportación exitosa', 'El archivo Excel se descargó correctamente.');
      },
      error: (error) => {
        console.error('Error al exportar Excel:', error);
        void this.alertas.error('No se pudo exportar', 'Ocurrió un error al generar el archivo Excel.');
      }
    });
  }

  toggleCrud(): void {
    this.crudAbierto = !this.crudAbierto;
    if (this.crudAbierto && !this.catalogosCargados && !this.cargandoCatalogos) {
      this.cargarCatalogos();
    }
  }

  cargarCatalogos(): void {
    this.cargandoCatalogos = true;
    forkJoin({
      ingredientes: this.entregasService.cargarIngredientes(),
      tiposMercado: this.entregasService.cargarTiposMercado(),
    }).subscribe({
      next: ({ ingredientes, tiposMercado }) => {
        this.ingredientes = ingredientes;
        this.tiposMercado = tiposMercado;
        this.cargandoCatalogos = false;
        this.catalogosCargados = true;
        if (!ingredientes.length || !tiposMercado.length) {
          const mensaje = !tiposMercado.length
            ? 'No hay tipos de mercado configurados. El administrador debe cargar el catálogo.'
            : 'No hay ingredientes disponibles para registrar entregas.';
          void this.alertas.warning('Catálogo incompleto', mensaje);
        }
      },
      error: (error) => {
        console.error('Error al cargar catálogos del CRUD de entregas:', error);
        this.cargandoCatalogos = false;
        void this.alertas.error(
          'No se pudieron cargar los catálogos',
          error.status === 401
            ? 'La sesión expiró. Inicia sesión nuevamente.'
            : 'Verifica tu conexión e intenta cargar el catálogo otra vez.',
        );
      },
    });
  }

  nuevoRegistro(): void {
    this.editandoId = null;
    this.crudForm = this.formularioVacio();
  }

  editar(entrega: Entrega): void {
    if (!entrega.id || !entrega.idIngrediente || !entrega.idTipoMercado) {
      void this.alertas.error('No se puede editar', 'La entrega no contiene los identificadores requeridos.');
      return;
    }

    this.editandoId = entrega.id;
    this.crudForm = {
      idIngrediente: entrega.idIngrediente,
      idTipoMercado: entrega.idTipoMercado,
      frecuencia: entrega.frecuencia,
      cantidad: entrega.cantidad,
      unidad: entrega.unidad,
      fechaRecepcion: entrega.fechaRecepcion,
      fechaVencimiento: entrega.fechaVencimiento,
      observaciones: entrega.observaciones ?? '',
    };
    document.getElementById('crudFormTitle')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  cancelarEdicion(): void {
    this.nuevoRegistro();
  }

  guardarDesdeCrud(): void {
    const { idIngrediente, idTipoMercado, frecuencia, cantidad, unidad, fechaRecepcion, fechaVencimiento } = this.crudForm;
    if (!idIngrediente || !idTipoMercado || !frecuencia || cantidad == null || cantidad <= 0
      || !unidad || !fechaRecepcion || !fechaVencimiento) {
      void this.alertas.warning('Revisa el formulario', 'Completa todos los campos obligatorios con valores válidos.');
      return;
    }
    if (fechaVencimiento < fechaRecepcion) {
      void this.alertas.warning('Fechas no válidas', 'El vencimiento no puede ser anterior a la fecha de recepción.');
      return;
    }

    const payload: EntregaPayload = {
      id_ingrediente: idIngrediente,
      id_tipo_mercado: idTipoMercado,
      fecha_entrega: fechaRecepcion,
      fecha_vencimiento: fechaVencimiento,
      cantidad,
      observaciones: this.crudForm.observaciones,
      frecuencia,
      unidad,
    };

    this.guardando = true;
    const request = this.editandoId
      ? this.entregasService.actualizar(this.editandoId, payload)
      : this.entregasService.registrar(payload);
    request.subscribe({
      next: () => {
        this.guardando = false;
        void this.alertas.success(
          this.editandoId ? 'Entrega actualizada' : 'Entrega registrada',
          this.editandoId ? 'Los cambios se guardaron correctamente.' : 'La entrega se agregó correctamente.',
        );
        this.nuevoRegistro();
        this.cargarHistorial();
      },
      error: (error) => {
        console.error('Error al guardar entrega desde el CRUD:', error);
        this.guardando = false;
        void this.alertas.error(
          'No se pudo guardar la entrega',
          error.status === 401
            ? 'La sesión expiró. Inicia sesión nuevamente.'
            : error.status === 403
              ? 'Tu usuario no tiene permiso para realizar esta operación.'
              : 'Verifica los datos e intenta nuevamente.',
        );
      },
    });
  }

  eliminar(entrega: Entrega): void {
    if (!entrega.id) {
      void this.alertas.error('No se puede eliminar', 'La entrega no tiene un identificador válido.');
      return;
    }
    this.alertas.confirm(
      '¿Eliminar esta entrega?',
      `Se eliminará el registro de ${entrega.ingrediente}. Esta acción no se puede deshacer.`,
      'Sí, eliminar',
    ).then(result => {
      if (!result.isConfirmed) return;

      this.entregasService.eliminar(entrega.id!).subscribe({
        next: () => {
          void this.alertas.success('Entrega eliminada', 'El registro se eliminó correctamente.');
          this.cargarHistorial();
        },
        error: (error) => {
          console.error('Error al eliminar entrega:', error);
          void this.alertas.error(
            'No se pudo eliminar la entrega',
            error.status === 401
              ? 'La sesión expiró. Inicia sesión nuevamente.'
              : error.status === 403
                ? 'Tu usuario no tiene permiso para eliminar entregas.'
                : 'Intenta nuevamente más tarde.',
          );
        },
      });
    });
  }

  get entregasFiltradas(): Entrega[] {
    const texto = this.filtroTexto.trim().toLocaleLowerCase();
    return this.entregas.filter((entrega) => {
      if (this.filtroMercado !== 'Todas' && entrega.tipoMercado !== this.filtroMercado) {
        return false;
      }
      if (!texto) return true;
      return [
        entrega.ingrediente,
        entrega.tipoMercado,
        entrega.frecuencia,
        entrega.unidad,
      ].some(valor => valor.toLocaleLowerCase().includes(texto));
    });
  }

  get vencidas(): number {
    return this.entregas.filter(entrega => this.estado(entrega) === 'Vencido').length;
  }

  get porVencer(): number {
    return this.entregas.filter(entrega => this.estado(entrega) === 'Próximo a vencer').length;
  }

  estado(entrega: Entrega): string {
    return this.entregasService.obtenerEstado(entrega);
  }

  claseEstado(entrega: Entrega): string {
    return this.entregasService.claseEstado(this.estado(entrega));
  }

  // =========================================================================
  // CONTROL DE CALIDAD Y RECEPCIÓN TÉCNICA (ADMINISTRADOR)
  // =========================================================================

  abrirModalRecepcion(entrega: Entrega): void {
    this.entregaSeleccionada = entrega;
    const totalCant = entrega.cantidad || 0;
    this.formRecepcion = {
      cantidadRecibida: totalCant,
      cantidadRechazada: 0,
      motivoRechazo: '',
    };
    this.modalRecepcionAbierto = true;
  }

  cerrarModalRecepcion(): void {
    this.modalRecepcionAbierto = false;
    this.entregaSeleccionada = null;
  }

  onCambioCantidades(campo: 'recibida' | 'rechazada'): void {
    if (!this.entregaSeleccionada) return;
    const total = this.entregaSeleccionada.cantidad || 0;
    if (campo === 'rechazada') {
      const rech = Math.max(0, Number(this.formRecepcion.cantidadRechazada) || 0);
      this.formRecepcion.cantidadRecibida = Math.max(0, +(total - rech).toFixed(3));
    } else {
      const rec = Math.max(0, Number(this.formRecepcion.cantidadRecibida) || 0);
      this.formRecepcion.cantidadRechazada = Math.max(0, +(total - rec).toFixed(3));
    }
  }

  confirmarRecepcion(): void {
    if (!this.entregaSeleccionada || !this.entregaSeleccionada.id) return;
    const rec = Number(this.formRecepcion.cantidadRecibida);
    const rech = Number(this.formRecepcion.cantidadRechazada);

    if (isNaN(rec) || rec < 0 || isNaN(rech) || rech < 0) {
      void this.alertas.warning('Cantidades inválidas', 'Las cantidades deben ser números positivos.');
      return;
    }

    if (rech > 0 && !this.formRecepcion.motivoRechazo.trim()) {
      void this.alertas.warning(
        'Motivo requerido',
        'Has reportado productos dañados o rechazados. Por favor especifica el motivo (ej: tomates magullados o empaque averiado).'
      );
      return;
    }

    this.procesandoRecepcion = true;
    this.entregasService.confirmarRecepcion(this.entregaSeleccionada.id, {
      cantidad_recibida: rec,
      cantidad_rechazada: rech,
      motivo_rechazo: this.formRecepcion.motivoRechazo.trim(),
    }).subscribe({
      next: (res) => {
        this.procesandoRecepcion = false;
        this.cerrarModalRecepcion();
        const unidad = this.entregaSeleccionada?.unidad || 'unidades';
        const msj = rech > 0
          ? `Se recibieron ${rec} ${unidad} en buen estado y se reportaron ${rech} ${unidad} con novedad/avería. El inventario ha sido acreditado.`
          : `Se recibieron exitosamente los ${rec} ${unidad}. El inventario ha sido acreditado.`;
        void this.alertas.success('Recepción confirmada', msj);
        this.cargarHistorial();
      },
      error: (err) => {
        this.procesandoRecepcion = false;
        console.error('Error al confirmar recepción:', err);
        const errMsj = err?.error?.error || 'No se pudo confirmar la recepción. Intenta nuevamente.';
        void this.alertas.error('Error al confirmar recepción', errMsj);
      },
    });
  }

  verDetalleNovedad(entrega: Entrega): void {
    this.entregaDetalle = entrega;
    this.modalDetalleAbierto = true;
  }

  cerrarModalDetalle(): void {
    this.modalDetalleAbierto = false;
    this.entregaDetalle = null;
  }

  // Helpers de estado del ciclo de vida de la entrega
  estadoEntrega(entrega: Entrega): string {
    const e = (entrega.estado || 'EN_TRANSITO').toUpperCase();
    switch (e) {
      case 'RECIBIDA': return 'Recibida OK';
      case 'CON_NOVEDAD': return 'Con Novedad';
      case 'RECHAZADA': return 'Rechazada';
      case 'EN_TRANSITO':
      default:
        return 'En tránsito';
    }
  }

  claseEstadoEntrega(entrega: Entrega): string {
    const e = (entrega.estado || 'EN_TRANSITO').toUpperCase();
    switch (e) {
      case 'RECIBIDA':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'CON_NOVEDAD':
        return 'border-orange-300 bg-orange-50 text-orange-800';
      case 'RECHAZADA':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'EN_TRANSITO':
      default:
        return 'border-amber-200 bg-amber-50 text-amber-800';
    }
  }

  iconoEstadoEntrega(entrega: Entrega): string {
    const e = (entrega.estado || 'EN_TRANSITO').toUpperCase();
    switch (e) {
      case 'RECIBIDA': return 'check_circle';
      case 'CON_NOVEDAD': return 'warning';
      case 'RECHAZADA': return 'cancel';
      case 'EN_TRANSITO':
      default:
        return 'local_shipping';
    }
  }

  private formularioVacio() {
    return {
      idIngrediente: null as number | null,
      idTipoMercado: null as number | null,
      frecuencia: 'Semanal',
      cantidad: null as number | null,
      unidad: 'Kg',
      fechaRecepcion: this.fechaHoy(),
      fechaVencimiento: '',
      observaciones: '',
    };
  }

  private fechaHoy(): string {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  }
}