import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SweetAlertService } from '../sweet-alert.service';
import {
  EntregasService,
  IngredienteOpcion,
  TipoMercadoOpcion,
} from '../services/entregas.service';

// Importación de los componentes activos para las pestañas
import { SaldosAlmacenComponent } from '../saldos-almacen/saldos-almacen';
import { EntradasAjustesInventarioComponent } from '../entradas-ajustes-inventario/entradas-ajustes-inventario';

@Component({
  selector: 'app-registrar-entrega-alimentos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SaldosAlmacenComponent,
    EntradasAjustesInventarioComponent,
  ],
  templateUrl: './registrar-entrega-alimentos.html',
  styleUrls: ['./registrar-entrega-alimentos.css'],
})
export class RegistrarEntregaAlimentosComponent implements OnInit {
  // Control de la pestaña activa en la parte superior
  pestanaActiva: 'formulario' | 'saldos' | 'ajustes' | 'reporte-salidas' = 'formulario';

  ingredientes: IngredienteOpcion[] = [];
  tiposMercado: TipoMercadoOpcion[] = [];
  cargandoCatalogos = true;
  guardando = false;
  errorMensaje = '';

  entregaForm = {
    idIngrediente: null as number | null,
    idTipoMercado: null as number | null,
    frecuencia: '',
    cantidad: null as number | null,
    unidad: '',
    fechaRecepcion: this.fechaHoy(),
    fechaVencimiento: '',
    observaciones: '',
  };

  constructor(
    private entregasService: EntregasService,
    private alertas: SweetAlertService,
  ) {}

  ngOnInit(): void {
    this.cargarCatalogos();
  }

  cargarCatalogos(): void {
    this.cargandoCatalogos = true;
    this.errorMensaje = '';
    forkJoin({
      ingredientes: this.entregasService.cargarIngredientes(),
      tiposMercado: this.entregasService.cargarTiposMercado(),
    }).subscribe({
      next: ({ ingredientes, tiposMercado }) => {
        this.ingredientes = ingredientes;
        this.tiposMercado = tiposMercado;
        this.cargandoCatalogos = false;
        if (this.tiposMercado.length === 0) {
          this.errorMensaje = 'No hay tipos de mercado configurados. Actualiza el catálogo o contacta al administrador.';
          void this.alertas.error('Catálogo incompleto', this.errorMensaje);
        } else if (this.ingredientes.length === 0) {
          this.errorMensaje = 'No hay ingredientes disponibles para registrar la entrega.';
          void this.alertas.warning('Sin ingredientes', this.errorMensaje);
        }
      },
      error: (error) => {
        console.error('Error al cargar catálogos de entregas:', error);
        this.errorMensaje = error.status === 401
          ? 'La sesión expiró. Inicia sesión nuevamente para registrar entregas.'
          : 'No se pudieron cargar ingredientes o tipos de mercado.';
        void this.alertas.error('No se pudo cargar el formulario', this.errorMensaje);
        this.cargandoCatalogos = false;
      },
    });
  }

  guardarEntrega(): void {
    if (this.tiposMercado.length === 0 || this.ingredientes.length === 0) {
      this.errorMensaje = this.tiposMercado.length === 0
        ? 'No hay tipos de mercado configurados. Actualiza el catálogo o contacta al administrador.'
        : 'No hay ingredientes disponibles para registrar la entrega.';
      void this.alertas.warning('No se puede registrar', this.errorMensaje);
      return;
    }

    this.errorMensaje = '';

    if (
      !this.entregaForm.idIngrediente
      || !this.entregaForm.idTipoMercado
      || !this.entregaForm.frecuencia
      || this.entregaForm.cantidad == null
      || this.entregaForm.cantidad <= 0
      || !this.entregaForm.unidad
      || !this.entregaForm.fechaRecepcion
      || !this.entregaForm.fechaVencimiento
    ) {
      this.errorMensaje = 'Completa todos los campos obligatorios con valores válidos.';
      void this.alertas.warning('Revisa el formulario', this.errorMensaje);
      return;
    }

    if (this.entregaForm.fechaVencimiento < this.entregaForm.fechaRecepcion) {
      this.errorMensaje = 'La fecha de vencimiento no puede ser anterior a la fecha de recepción.';
      void this.alertas.warning('Fechas no válidas', this.errorMensaje);
      return;
    }

    this.guardando = true;
    this.entregasService.registrar({
        id_ingrediente: this.entregaForm.idIngrediente!,
        id_tipo_mercado: this.entregaForm.idTipoMercado!,
        frecuencia: this.entregaForm.frecuencia,
        cantidad: this.entregaForm.cantidad,
        unidad: this.entregaForm.unidad,
        fecha_entrega: this.entregaForm.fechaRecepcion,
        fecha_vencimiento: this.entregaForm.fechaVencimiento,
        observaciones: this.entregaForm.observaciones,
      }).subscribe({
      next: () => {
        this.guardando = false;
        void this.alertas.success('Entrega registrada', 'La entrega se guardó correctamente.');
        this.reiniciarFormulario();
      },
      error: (error) => {
        console.error('Error al registrar entrega:', error);
        this.guardando = false;
        this.errorMensaje = error.status === 401
          ? 'La sesión expiró. Inicia sesión nuevamente.'
          : error.status === 403
            ? 'Tu usuario no tiene permiso para registrar entregas.'
            : 'No se pudo registrar la entrega. Verifica los datos e intenta de nuevo.';
        void this.alertas.error('No se pudo registrar la entrega', this.errorMensaje);
      },
    });
  }

  reiniciarFormulario(): void {
    this.entregaForm = {
      idIngrediente: null,
      idTipoMercado: null,
      frecuencia: '',
      cantidad: null,
      unidad: '',
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