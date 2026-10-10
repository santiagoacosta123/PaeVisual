import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EntregasService, Entrega } from '../services/entregas.service';

export type { Entrega } from '../services/entregas.service';

type TabEntrega = 'Todas' | 'Granos' | 'Perecederos';

@Component({
  selector: 'app-registrar-entrega-alimentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registrar-entrega-alimentos.html',
  styleUrls: ['./registrar-entrega-alimentos.css']
})
export class RegistrarEntregaAlimentosComponent implements OnInit, OnDestroy {

  // ---------- Vista ----------
  mostrarModal: boolean = false;
  tabActivo: TabEntrega = 'Todas';
  entregaEnEdicion: Entrega | null = null;
  filtroFrecuencia: string = '';        // '' = todas | 'Mensual' | 'Quincenal'
  menuMercadoAbierto: boolean = false;  // desplegable [Filtrar por Mercado]
  private temporizador: any;

  // ---------- Filtros ----------
  filtroTexto: string = '';
  ingredienteSel: string = 'Todos';
  fechaDesde: string = '';
  fechaHasta: string = '';

  // ---------- Filtros aplicados ----------
  filtrosAplicados = { texto: '', ingrediente: 'Todos', desde: '', hasta: '' };

  // ---------- Paginación ----------
  paginaActual: number = 1;
  porPagina: number = 10;

  // Entregas (vienen del backend a través del servicio compartido)
  entregas: Entrega[] = [];

  // Formulario (valores que coinciden con las opciones del modal)
  entregaForm: Entrega = this.formularioVacio();

  constructor(
    private router: Router,
    private http: HttpClient,
    private entregasService: EntregasService
  ) {}

  ngOnInit(): void {
    this.cargarEntregasBackend();
    // Refresca la vista cada minuto para que las alertas se actualicen solas
    this.temporizador = setInterval(() => {}, 60000);
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  private formularioVacio(): Entrega {
    const hoy = new Date().toISOString().split('T')[0];
    return {
      ingrediente: '',
      tipoMercado: 'Granos',
      frecuencia: 'Semanal',
      cantidad: null,
      unidad: 'Kg',
      fechaRecepcion: hoy,
      fechaVencimiento: hoy
    };
  }

  // =====================================================
  //  PETICIONES HTTP (Django REST Framework)
  // =====================================================
  cargarEntregasBackend(): void {
    this.entregasService.cargar().subscribe({
      next: () => {
        // Misma lista que usa la pantalla "Filtrar por tipo de mercado"
        this.entregas = this.entregasService.entregas;
        this.aplicarBusqueda();
      },
      error: (err) => console.error('Error al consultar entregas:', err)
    });
  }

  guardarEntrega(): void {
    if (!this.entregaForm.ingrediente || !this.entregaForm.tipoMercado ||
        !this.entregaForm.frecuencia || !this.entregaForm.cantidad ||
        !this.entregaForm.unidad || !this.entregaForm.fechaRecepcion ||
        !this.entregaForm.fechaVencimiento) {
      alert('Por favor complete todos los campos obligatorios del formulario.');
      return;
    }

    if (this.entregaForm.fechaVencimiento < this.entregaForm.fechaRecepcion) {
      alert('La fecha de vencimiento no puede ser anterior a la fecha de recepción.');
      return;
    }

    const payload = {
      ingrediente: this.entregaForm.ingrediente,
      tipo_mercado: this.entregaForm.tipoMercado,
      tipoMercado: this.entregaForm.tipoMercado,
      frecuencia: this.entregaForm.frecuencia,
      cantidad: Number(this.entregaForm.cantidad),
      unidad: this.entregaForm.unidad,
      fecha_recepcion: this.entregaForm.fechaRecepcion,
      fechaRecepcion: this.entregaForm.fechaRecepcion,
      fecha_vencimiento: this.entregaForm.fechaVencimiento,
      fechaVencimiento: this.entregaForm.fechaVencimiento
    };

    const apiUrl = this.entregasService.apiUrl;
    const headers = this.entregasService.getHeaders();

    if (this.entregaEnEdicion && this.entregaEnEdicion.id) {
      this.http.put<any>(`${apiUrl}${this.entregaEnEdicion.id}/`, payload, headers).subscribe({
        next: () => {
          alert('Entrega actualizada con éxito.');
          this.cargarEntregasBackend();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al actualizar:', err);
          alert('Error al actualizar el registro.');
        }
      });
    } else {
      this.http.post<any>(apiUrl, payload, headers).subscribe({
        next: () => {
          alert('Entrega registrada con éxito.');
          this.cargarEntregasBackend(); // recarga la lista: alertas y filtro se actualizan
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al guardar en backend:', err);
          if (err.status === 401) {
            alert('Error de autorización (401). Su sesión no tiene un token válido o ha expirado. Por favor vuelva a iniciar sesión.');
          } else {
            alert('Error al guardar la entrega.');
          }
        }
      });
    }
  }

  eliminar(entrega: Entrega): void {
    if (!entrega.id) return;
    if (!confirm(`¿Seguro que deseas eliminar "${entrega.ingrediente}"?`)) return;

    this.http.delete(`${this.entregasService.apiUrl}${entrega.id}/`, this.entregasService.getHeaders()).subscribe({
      next: () => {
        alert('Registro eliminado con éxito.');
        this.cargarEntregasBackend();
      },
      error: (err) => {
        console.error('Error al eliminar:', err);
        alert('No se pudo eliminar el registro.');
      }
    });
  }

  private cerrarModal(): void {
    this.entregaEnEdicion = null;
    this.mostrarModal = false;
    this.resetForm();
    this.paginaActual = 1;
  }

  // =====================================================
  //  ESTADO Y ALERTAS (la lógica vive en el servicio)
  // =====================================================
  obtenerEstado(e: Entrega): string {
    return this.entregasService.obtenerEstado(e);
  }

  claseEstado(estado: string): string {
    return this.entregasService.claseEstado(estado);
  }

  umbralAlerta(e: Entrega): number {
    return this.entregasService.umbralAlerta(e);
  }

  diasRestantes(e: Entrega): number {
    return this.entregasService.diasRestantes(e);
  }

  textoDias(d: number): string {
    if (d < -1) return `Vencido hace ${Math.abs(d)} días`;
    if (d === -1) return 'Venció ayer';
    if (d === 0) return 'Vence hoy';
    if (d === 1) return 'Vence mañana';
    return `Vence en ${d} días`;
  }

  // Productos vencidos o por vencer (perecederos: 7 días, no perecederos: 30 días)
  get alertas(): any[] {
    return this.entregas
      .filter(e => e.fechaVencimiento)
      .map(e => ({ ...e, dias: this.diasRestantes(e) }))
      .filter(e => e.dias <= this.umbralAlerta(e))
      .sort((x, y) => x.dias - y.dias);
  }

  // Alertas de la pestaña activa (Todas / Granos / Perecederos)
  get alertasTab(): any[] {
    if (this.tabActivo === 'Todas') return this.alertas;
    return this.alertas.filter(a => a.tipoMercado === this.tabActivo);
  }

  // =====================================================
  //  TABS, FILTROS Y BÚSQUEDA
  // =====================================================
  cambiarTab(tab: TabEntrega): void {
    this.tabActivo = tab;
    this.paginaActual = 1;
  }

  aplicarBusqueda(): void {
    this.filtrosAplicados = {
      texto: this.filtroTexto,
      ingrediente: this.ingredienteSel,
      desde: this.fechaDesde,
      hasta: this.fechaHasta
    };
    this.paginaActual = 1;
  }

  // [Filtrar por Mercado]: elige Granos / Perecederos y la tabla se actualiza al instante
  seleccionarMercado(mercado: TabEntrega): void {
    this.cambiarTab(mercado);
    this.menuMercadoAbierto = false;
  }

  // [Limpiar Filtros]: vuelve al listado completo
  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.ingredienteSel = 'Todos';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.filtroFrecuencia = '';
    this.tabActivo = 'Todas';
    this.menuMercadoAbierto = false;
    this.aplicarBusqueda();
  }

  get ingredientesDisponibles(): string[] {
    return Array.from(new Set(this.entregas.map(e => e.ingrediente))).sort();
  }

  get entregasFiltradas(): Entrega[] {
    const f = this.filtrosAplicados;
    const texto = f.texto.trim().toLowerCase();

    return this.entregas.filter(e => {
      if (this.tabActivo !== 'Todas' && e.tipoMercado !== this.tabActivo) return false;
      if (f.ingrediente !== 'Todos' && e.ingrediente !== f.ingrediente) return false;
      if (this.filtroFrecuencia && e.frecuencia !== this.filtroFrecuencia) return false;

      if (texto) {
        const coincide =
          e.ingrediente.toLowerCase().includes(texto) ||
          e.tipoMercado.toLowerCase().includes(texto) ||
          e.frecuencia.toLowerCase().includes(texto) ||
          this.obtenerEstado(e).toLowerCase().includes(texto);
        if (!coincide) return false;
      }

      if (f.desde && e.fechaRecepcion < f.desde) return false;
      if (f.hasta && e.fechaRecepcion > f.hasta) return false;

      return true;
    });
  }

  // =====================================================
  //  PAGINACIÓN
  // =====================================================
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.entregasFiltradas.length / this.porPagina));
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  get entregasPaginadas(): Entrega[] {
    if (this.paginaActual > this.totalPaginas) this.paginaActual = this.totalPaginas;
    const inicio = (this.paginaActual - 1) * this.porPagina;
    return this.entregasFiltradas.slice(inicio, inicio + this.porPagina);
  }

  get desdeRegistro(): number {
    return this.entregasFiltradas.length === 0 ? 0 : (this.paginaActual - 1) * this.porPagina + 1;
  }

  get hastaRegistro(): number {
    return Math.min(this.paginaActual * this.porPagina, this.entregasFiltradas.length);
  }

  irAPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas) this.paginaActual = p;
  }

  // =====================================================
  //  MODAL
  // =====================================================
  abrirFormulario(): void {
    this.entregaEnEdicion = null;
    this.resetForm();
    this.mostrarModal = true;
  }

  editar(entrega: Entrega): void {
    this.entregaEnEdicion = entrega;
    this.entregaForm = { ...entrega };
    this.mostrarModal = true;
  }

  cancelar(): void {
    this.cerrarModal();
  }

  resetForm(): void {
    this.entregaForm = this.formularioVacio();
  }

  // =====================================================
  //  EXPORTAR EXCEL
  // =====================================================
  private formatearFecha(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private escapar(valor: any): string {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private construirFilasHtml(): string {
    return this.entregasFiltradas.map(e => `
      <tr>
        <td>${this.formatearFecha(e.fechaRecepcion)}</td>
        <td>${this.escapar(e.ingrediente)}</td>
        <td>${this.escapar(e.tipoMercado === 'Granos' ? 'Granos / No perecederos' : e.tipoMercado)}</td>
        <td>${this.escapar(e.frecuencia)}</td>
        <td style="text-align:right">${this.escapar(e.cantidad)}</td>
        <td>${this.escapar(e.unidad)}</td>
        <td>${this.formatearFecha(e.fechaVencimiento)}</td>
        <td>${this.escapar(this.obtenerEstado(e))}</td>
      </tr>`).join('');
  }

  private encabezadoHtml(): string {
    return `
      <tr>
        <th>Fecha</th><th>Ingrediente</th><th>Tipo de mercado</th><th>Frecuencia</th>
        <th>Cantidad</th><th>Unidad</th><th>Vencimiento</th><th>Estado</th>
      </tr>`;
  }

  exportarExcel(): void {
    if (this.entregasFiltradas.length === 0) {
      alert('No hay registros para exportar.');
      return;
    }

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>
        <table border="1">
          <thead>${this.encabezadoHtml()}</thead>
          <tbody>${this.construirFilasHtml()}</tbody>
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

// Alias: así funciona sin importar si tu app.routes.ts usa
// RegistrarEntregaAlimentosComponent o RegistrarEntregaAlimentos
export { RegistrarEntregaAlimentosComponent as RegistrarEntregaAlimentos };