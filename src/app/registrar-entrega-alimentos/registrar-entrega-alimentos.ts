import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SweetAlertService } from '../sweet-alert.service';
import {
  EntregasService,
  IngredienteOpcion,
  TipoMercadoOpcion,
} from '../services/entregas.service';

// Importación de los componentes activos para las pestañas
import { SaldosAlmacenComponent } from '../saldos-almacen/saldos-almacen';
import { EntradasAjustesInventarioComponent } from '../entradas-ajustes-inventario/entradas-ajustes-inventario';

// Fila que se muestra en la tabla del historial
interface FilaEntrega {
  id?: number;
  ingrediente: string;
  tipoMercado: string;                   // nombre del catálogo
  categoria: 'Granos' | 'Perecederos';   // para colores y alertas
  frecuencia: string;
  cantidad: number;
  unidad: string;
  fechaRecepcion: string;                // YYYY-MM-DD
  fechaVencimiento: string;              // YYYY-MM-DD
}

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

  // ===================== HISTORIAL DE ENTREGAS =====================
  // Si te da error 404 al cargar la tabla, pon aquí la misma ruta que usa registrar() en entregas.service.ts
  private readonly urlEntregas = `${environment.apiUrl}/entregas/`;

  mostrarModalEntrega = false;
  cargandoHistorial = false;
  errorHistorial = false;

  private entregasRaw: any[] = [];
  historial: FilaEntrega[] = [];

  fechaDesde = '';
  fechaHasta = '';
  ingredienteFiltro = 'Todos';
  textoFiltro = '';
  filtrosAplicados = { desde: '', hasta: '', ingrediente: 'Todos', texto: '' };

  paginaActual = 1;
  porPagina = 10;

  constructor(
    private entregasService: EntregasService,
    private alertas: SweetAlertService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarHistorial();
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
        this.reconstruirHistorial(); // ya hay nombres de catálogo para la tabla
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
        this.mostrarModalEntrega = false;   // cierra la ventana
        this.cargarHistorial();             // actualiza la tabla y las alertas
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

  // =====================================================
  //  HISTORIAL: carga de la tabla
  // =====================================================
  cargarHistorial(): void {
    this.cargandoHistorial = true;
    this.errorHistorial = false;

    this.http.get<any>(this.urlEntregas).pipe(
      map(d => (Array.isArray(d) ? d : (d?.results ?? [])) as any[])
    ).subscribe({
      next: (lista) => {
        this.entregasRaw = lista;
        this.reconstruirHistorial();
        this.cargandoHistorial = false;
      },
      error: (error) => {
        console.error('Error al consultar entregas:', error);
        this.cargandoHistorial = false;
        this.errorHistorial = true;
      },
    });
  }

  // Convierte lo que devuelve el backend en filas con nombres (usa los catálogos por id)
  private reconstruirHistorial(): void {
    this.historial = this.entregasRaw.map(item => this.aFila(item));
  }

  private aFila(item: any): FilaEntrega {
    const idIngrediente = item.id_ingrediente ??
      (typeof item.ingrediente === 'number' ? item.ingrediente : item.ingrediente?.id);
    const idTipo = item.id_tipo_mercado ??
      (typeof item.tipo_mercado === 'number' ? item.tipo_mercado : item.tipo_mercado?.id);

    const ingrediente =
      this.texto(item.ingrediente_nombre) ||
      this.texto(item.nombre_ingrediente) ||
      this.texto(item.ingrediente) ||
      this.ingredientes.find(i => i.id === idIngrediente)?.nombre || '';

    const tipoMercado =
      this.texto(item.tipo_mercado_nombre) ||
      this.texto(item.nombre_tipo_mercado) ||
      this.texto(item.tipo_mercado) ||
      this.tiposMercado.find(t => t.id === idTipo)?.nombre || '';

    const nombreMercado = tipoMercado.toLowerCase();
    const esPerecedero = nombreMercado.includes('perecedero') && !nombreMercado.includes('no perecedero');

    return {
      id: item.id,
      ingrediente,
      tipoMercado,
      categoria: esPerecedero ? 'Perecederos' : 'Granos',
      frecuencia: item.frecuencia || '',
      cantidad: Number(item.cantidad) || 0,
      unidad: item.unidad || '',
      fechaRecepcion: this.soloFecha(item.fecha_entrega ?? item.fecha_recepcion ?? item.fechaRecepcion),
      fechaVencimiento: this.soloFecha(item.fecha_vencimiento ?? item.fechaVencimiento),
    };
  }

  // Acepta texto o un objeto { nombre }. Un número (id) no es un nombre.
  private texto(valor: any): string {
    if (valor == null) return '';
    if (typeof valor === 'object') return String(valor.nombre ?? valor.name ?? '');
    if (typeof valor === 'number') return '';
    return String(valor);
  }

  private soloFecha(valor: any): string {
    return String(valor ?? '').substring(0, 10);
  }

  abrirModalEntrega(): void {
    this.mostrarModalEntrega = true;
  }

  cerrarModalEntrega(): void {
    this.mostrarModalEntrega = false;
  }

  // =====================================================
  //  HISTORIAL: filtros, estado, alertas y paginación
  // =====================================================
  get ingredientesHistorial(): string[] {
    return Array.from(new Set(this.historial.map(e => e.ingrediente))).sort();
  }

  // Más recientes primero
  get historialFiltrado(): FilaEntrega[] {
    const f = this.filtrosAplicados;
    const texto = f.texto.trim().toLowerCase();

    return this.historial
      .filter(e => {
        if (f.ingrediente !== 'Todos' && e.ingrediente !== f.ingrediente) return false;
        if (f.desde && e.fechaRecepcion < f.desde) return false;
        if (f.hasta && e.fechaRecepcion > f.hasta) return false;
        if (texto) {
          const coincide =
            e.ingrediente.toLowerCase().includes(texto) ||
            e.tipoMercado.toLowerCase().includes(texto) ||
            e.frecuencia.toLowerCase().includes(texto) ||
            this.estadoDe(e).toLowerCase().includes(texto);
          if (!coincide) return false;
        }
        return true;
      })
      .sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion));
  }

  aplicarBusqueda(): void {
    this.filtrosAplicados = {
      desde: this.fechaDesde,
      hasta: this.fechaHasta,
      ingrediente: this.ingredienteFiltro,
      texto: this.textoFiltro,
    };
    this.paginaActual = 1;
  }

  // Perecederos avisan con 7 días; granos / no perecederos con 30 días
  private umbralAlerta(e: FilaEntrega): number {
    return e.categoria === 'Perecederos' ? 7 : 30;
  }

  private diasRestantes(e: FilaEntrega): number {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vence = new Date(e.fechaVencimiento + 'T00:00:00');
    return Math.round((vence.getTime() - hoy.getTime()) / 86400000);
  }

  estadoDe(e: FilaEntrega): string {
    if (!e.fechaVencimiento) return 'Vigente';
    const dias = this.diasRestantes(e);
    if (dias < 0) return 'Vencido';
    if (dias <= this.umbralAlerta(e)) return 'Próximo a vencer';
    return 'Vigente';
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'Vigente':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Vencido':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  }

  textoDias(d: number): string {
    if (d < -1) return `Vencido hace ${Math.abs(d)} días`;
    if (d === -1) return 'Venció ayer';
    if (d === 0) return 'Vence hoy';
    if (d === 1) return 'Vence mañana';
    return `Vence en ${d} días`;
  }

  // Productos vencidos o por vencer (alimenta la barra de alerta)
  get alertasVencimiento(): any[] {
    return this.historial
      .filter(e => e.fechaVencimiento)
      .map(e => ({ ...e, dias: this.diasRestantes(e) }))
      .filter(e => e.dias <= this.umbralAlerta(e))
      .sort((x, y) => x.dias - y.dias);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.historialFiltrado.length / this.porPagina));
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  get historialPaginado(): FilaEntrega[] {
    if (this.paginaActual > this.totalPaginas) this.paginaActual = this.totalPaginas;
    const inicio = (this.paginaActual - 1) * this.porPagina;
    return this.historialFiltrado.slice(inicio, inicio + this.porPagina);
  }

  get desdeRegistro(): number {
    return this.historialFiltrado.length === 0 ? 0 : (this.paginaActual - 1) * this.porPagina + 1;
  }

  get hastaRegistro(): number {
    return Math.min(this.paginaActual * this.porPagina, this.historialFiltrado.length);
  }

  irAPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas) this.paginaActual = p;
  }

  // =====================================================
  //  HISTORIAL: exportar a Excel (respeta los filtros)
  // =====================================================
  exportarExcelHistorial(): void {
    const lista = this.historialFiltrado;
    if (lista.length === 0) {
      void this.alertas.warning('Sin registros', 'No hay registros para exportar.');
      return;
    }

    const esc = (v: any) => String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fecha = (iso: string) => {
      if (!iso) return '';
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    };

    const filas = lista.map(e => `
      <tr>
        <td>${fecha(e.fechaRecepcion)}</td>
        <td>${esc(e.ingrediente)}</td>
        <td>${esc(e.tipoMercado)}</td>
        <td>${esc(e.frecuencia)}</td>
        <td style="text-align:right">${esc(e.cantidad)}</td>
        <td>${esc(e.unidad)}</td>
        <td>${fecha(e.fechaVencimiento)}</td>
        <td>${esc(this.estadoDe(e))}</td>
      </tr>`).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>
        <table border="1">
          <thead><tr>
            <th>Fecha</th><th>Ingrediente</th><th>Tipo de mercado</th><th>Frecuencia</th>
            <th>Cantidad</th><th>Unidad</th><th>Vencimiento</th><th>Estado</th>
          </tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </body></html>`;

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_entregas_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}