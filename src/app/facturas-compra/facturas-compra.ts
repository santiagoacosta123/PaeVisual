import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '@env/environment';
import { AuthService } from '../services/auth.service';
import { SweetAlertService } from '../sweet-alert.service';
import {
  FacturaCompra,
  FacturaCompraPayload,
  FacturasCompraService,
  InventarioCentralItem,
} from '../services/facturas-compra.service';

interface FilaDetalleForm {
  id_ingrediente: number | null;
  cantidad: number | null;
  precio_unitario: number | null;
  numero_lote: string;
  fecha_vencimiento: string;
}

@Component({
  selector: 'app-facturas-compra',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './facturas-compra.html',
  styleUrl: './facturas-compra.css',
})
export class FacturasCompraComponent implements OnInit {
  tabActiva: 'facturas' | 'bodega' = 'facturas';

  facturas: FacturaCompra[] = [];
  inventarioCentral: InventarioCentralItem[] = [];
  catalogoIngredientes: any[] = [];
  catalogoProveedores: any[] = [];

  cargando = true;
  guardando = false;
  procesandoAnulacion = false;

  // Filtros
  filtroEstado: string = 'TODAS';
  filtroBusqueda: string = '';
  filtroBusquedaBodega: string = '';

  // Modal Registro
  modalRegistroAbierto = false;
  formFactura = this.formularioVacio();

  // Modal Detalle
  modalDetalleAbierto = false;
  facturaSeleccionada: FacturaCompra | null = null;

  // Modal Anular
  modalAnularAbierto = false;
  facturaAAnular: FacturaCompra | null = null;
  motivoAnulacion: string = '';

  constructor(
    private facturasService: FacturasCompraService,
    private http: HttpClient,
    private authService: AuthService,
    private alertas: SweetAlertService,
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.cargarCatalogoIngredientes();
    this.cargarCatalogoProveedores();
    this.cargarFacturas();
    this.cargarBodega();
  }

  cargarFacturas(): void {
    this.facturasService.getFacturas().subscribe({
      next: (data) => {
        this.facturas = data;
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar facturas de compra:', err);
        this.cargando = false;
        void this.alertas.error('Error', 'No se pudieron consultar las facturas de compra.');
      },
    });
  }

  cargarBodega(): void {
    this.facturasService.getInventarioCentral().subscribe({
      next: (data) => {
        this.inventarioCentral = data;
      },
      error: (err) => {
        console.error('Error al cargar inventario central:', err);
      },
    });
  }

  cargarCatalogoIngredientes(): void {
    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);

    this.http.get<any>(`${environment.apiUrl}/ingredientes/`, { headers }).subscribe({
      next: (res) => {
        this.catalogoIngredientes = Array.isArray(res) ? res : (res?.results || []);
      },
      error: (err) => {
        console.error('Error al cargar catálogo de ingredientes:', err);
      },
    });
  }

  cargarCatalogoProveedores(): void {
    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);

    this.http.get<any>(`${environment.apiUrl}/proveedores/`, { headers }).subscribe({
      next: (res) => {
        const lista = Array.isArray(res) ? res : (res?.results || []);
        // Solo proveedores activos
        this.catalogoProveedores = lista.filter((p: any) => p.estado !== false);
      },
      error: (err) => {
        console.error('Error al cargar catálogo de proveedores:', err);
      },
    });
  }

  // =========================================================================
  // FILTRADO Y MÉTRICAS
  // =========================================================================

  get facturasFiltradas(): FacturaCompra[] {
    const txt = this.filtroBusqueda.trim().toLowerCase();
    return this.facturas.filter((f) => {
      const cumpleEstado = this.filtroEstado === 'TODAS' || f.estado === this.filtroEstado;
      const cumpleTexto =
        !txt ||
        f.numero_factura.toLowerCase().includes(txt) ||
        f.proveedor.toLowerCase().includes(txt);
      return cumpleEstado && cumpleTexto;
    });
  }

  get inventarioCentralFiltrado(): InventarioCentralItem[] {
    const txt = this.filtroBusquedaBodega.trim().toLowerCase();
    return this.inventarioCentral.filter((item) => {
      if (!txt) return true;
      return (
        item.ingrediente_nombre.toLowerCase().includes(txt) ||
        (item.categoria_nombre && item.categoria_nombre.toLowerCase().includes(txt))
      );
    });
  }

  get totalInversion(): number {
    return this.facturas
      .filter((f) => f.estado === 'REGISTRADA')
      .reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
  }

  get totalRegistradas(): number {
    return this.facturas.filter((f) => f.estado === 'REGISTRADA').length;
  }

  get totalAnuladas(): number {
    return this.facturas.filter((f) => f.estado === 'ANULADA').length;
  }

  get stockBajoCount(): number {
    return this.inventarioCentral.filter(
      (item) => Number(item.cantidad_disponible) <= Number(item.stock_minimo)
    ).length;
  }

  // =========================================================================
  // GESTIÓN DEL MODAL DE REGISTRO DE FACTURA
  // =========================================================================

  abrirModalRegistro(): void {
    this.formFactura = this.formularioVacio();
    this.modalRegistroAbierto = true;
  }

  cerrarModalRegistro(): void {
    this.modalRegistroAbierto = false;
  }

  agregarFilaDetalle(): void {
    this.formFactura.detalles.push({
      id_ingrediente: null,
      cantidad: null,
      precio_unitario: null,
      numero_lote: '',
      fecha_vencimiento: '',
    });
  }

  eliminarFilaDetalle(index: number): void {
    if (this.formFactura.detalles.length <= 1) {
      void this.alertas.warning('Mínimo requerido', 'La factura debe tener al menos un producto.');
      return;
    }
    this.formFactura.detalles.splice(index, 1);
  }

  calcularSubtotal(item: FilaDetalleForm): number {
    const cant = Number(item.cantidad) || 0;
    const precio = Number(item.precio_unitario) || 0;
    return +(cant * precio).toFixed(2);
  }

  get totalFacturaCalculado(): number {
    return this.formFactura.detalles.reduce((acc, item) => acc + this.calcularSubtotal(item), 0);
  }

  obtenerUnidadIngrediente(id: number | null): string {
    if (!id) return '';
    const ing = this.catalogoIngredientes.find((i) => i.id_ingrediente === Number(id));
    return ing?.unidad_abreviatura || ing?.unidad_nombre || 'Unid';
  }

  guardarFactura(): void {
    const { numero_factura, proveedor, fecha_compra, soporte_digital, detalles } = this.formFactura;

    if (!numero_factura.trim()) {
      void this.alertas.warning('Campo requerido', 'Ingresa el número de la factura.');
      return;
    }
    if (!proveedor.trim()) {
      void this.alertas.warning('Campo requerido', 'Ingresa el nombre del proveedor.');
      return;
    }
    if (!fecha_compra) {
      void this.alertas.warning('Campo requerido', 'Selecciona la fecha de compra.');
      return;
    }

    // Validar ítems
    const detallesValidos: any[] = [];
    for (let i = 0; i < detalles.length; i++) {
      const item = detalles[i];
      if (!item.id_ingrediente) {
        void this.alertas.warning('Producto no seleccionado', `Fila #${i + 1}: debes seleccionar un producto.`);
        return;
      }
      const cant = Number(item.cantidad);
      if (isNaN(cant) || cant <= 0) {
        void this.alertas.warning('Cantidad inválida', `Fila #${i + 1}: la cantidad debe ser mayor a 0.`);
        return;
      }

      detallesValidos.push({
        id_ingrediente: Number(item.id_ingrediente),
        cantidad: cant,
        precio_unitario: Number(item.precio_unitario) || 0,
        subtotal: this.calcularSubtotal(item),
        numero_lote: item.numero_lote.trim() || undefined,
        fecha_vencimiento: item.fecha_vencimiento || undefined,
      });
    }

    const payload: FacturaCompraPayload = {
      numero_factura: numero_factura.trim(),
      proveedor: proveedor.trim(),
      fecha_compra,
      soporte_digital: soporte_digital.trim() || undefined,
      valor_total: this.totalFacturaCalculado,
      detalles: detallesValidos,
    };

    this.guardando = true;
    this.facturasService.crearFactura(payload).subscribe({
      next: (facturaCreada) => {
        this.guardando = false;
        this.cerrarModalRegistro();
        void this.alertas.success(
          'Factura Registrada',
          `Factura ${facturaCreada.numero_factura} guardada con éxito. Los productos han ingresado a la Bodega Central.`
        );
        this.cargarFacturas();
        this.cargarBodega();
      },
      error: (err) => {
        this.guardando = false;
        console.error('Error al guardar factura:', err);
        const errObj = err?.error;
        let mensaje = 'No se pudo guardar la factura. Verifica los datos.';
        if (typeof errObj === 'string') mensaje = errObj;
        else if (errObj?.numero_factura) mensaje = Array.isArray(errObj.numero_factura) ? errObj.numero_factura[0] : errObj.numero_factura;
        else if (errObj?.detalles) mensaje = Array.isArray(errObj.detalles) ? errObj.detalles[0] : errObj.detalles;
        void this.alertas.error('Error al registrar factura', mensaje);
      },
    });
  }

  // =========================================================================
  // GESTIÓN DEL MODAL DE DETALLE DE FACTURA
  // =========================================================================

  abrirModalDetalle(factura: FacturaCompra): void {
    this.facturaSeleccionada = factura;
    this.modalDetalleAbierto = true;
  }

  cerrarModalDetalle(): void {
    this.modalDetalleAbierto = false;
    this.facturaSeleccionada = null;
  }

  // =========================================================================
  // GESTIÓN DEL MODAL DE ANULACIÓN
  // =========================================================================

  abrirModalAnular(factura: FacturaCompra): void {
    this.facturaAAnular = factura;
    this.motivoAnulacion = '';
    this.modalAnularAbierto = true;
  }

  cerrarModalAnular(): void {
    this.modalAnularAbierto = false;
    this.facturaAAnular = null;
    this.motivoAnulacion = '';
  }

  confirmarAnulacion(): void {
    if (!this.facturaAAnular) return;
    if (!this.motivoAnulacion.trim()) {
      void this.alertas.warning('Motivo requerido', 'Debes especificar el motivo de anulación de la factura.');
      return;
    }

    this.procesandoAnulacion = true;
    this.facturasService
      .anularFactura(this.facturaAAnular.id_factura, this.motivoAnulacion.trim())
      .subscribe({
        next: () => {
          this.procesandoAnulacion = false;
          const num = this.facturaAAnular?.numero_factura;
          this.cerrarModalAnular();
          void this.alertas.success(
            'Factura Anulada',
            `La factura ${num} fue anulada y el stock fue descontado de la Bodega Central.`
          );
          this.cargarFacturas();
          this.cargarBodega();
        },
        error: (err) => {
          this.procesandoAnulacion = false;
          console.error('Error al anular factura:', err);
          const msj = err?.error?.error || err?.error?.motivo_anulacion || 'No se pudo anular la factura.';
          void this.alertas.error('Error de anulación', msj);
        },
      });
  }

  private formularioVacio() {
    return {
      numero_factura: '',
      proveedor: '',
      fecha_compra: this.fechaHoy(),
      soporte_digital: '',
      detalles: [
        {
          id_ingrediente: null,
          cantidad: null,
          precio_unitario: null,
          numero_lote: '',
          fecha_vencimiento: '',
        },
      ] as FilaDetalleForm[],
    };
  }

  private fechaHoy(): string {
    const hoy = new Date();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mm}-${dd}`;
  }
}
