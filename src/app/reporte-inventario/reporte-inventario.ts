import { Component, AfterViewInit, OnDestroy, OnInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SweetAlertService } from '../sweet-alert.service';
import Chart from 'chart.js/auto';
import { forkJoin } from 'rxjs';
import { InventarioOperativoService } from '../services/inventario-operativo.service';

export interface ProductoInventario {
  nombre: string;
  categoria: string;
  stock: number;
  stockMinimo: number;
  estado: 'Poco stock' | 'Disponible' | 'Suficiente';
}

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-reporte-inventario',
  styleUrls: ['./reporte-inventario.css'],
  templateUrl: './reporte-inventario.html',
})
export class ReporteInventario implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  chart: Chart | null = null;

  productos: ProductoInventario[] = [];
  cargando = true;
  errorMensaje = '';

  estadosDisponibles: Array<'Poco stock' | 'Disponible' | 'Suficiente'> = [
    'Poco stock',
    'Disponible',
    'Suficiente'
  ];

  coloresPorEstado: Record<string, { bg: string; hover: string; border: string; badge: string; text: string }> = {
    'Poco stock': {
      bg: '#EF4444',
      hover: '#DC2626',
      border: '#F87171',
      badge: 'bg-red-100 text-red-700 border-red-200',
      text: 'text-red-600'
    },
    'Disponible': {
      bg: '#10B981',
      hover: '#059669',
      border: '#34D399',
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      text: 'text-emerald-600'
    },
    'Suficiente': {
      bg: '#FAB41F',
      hover: '#E59F0B',
      border: '#FCD34D',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      text: 'text-amber-600'
    }
  };

  estadoSeleccionado: 'Poco stock' | 'Disponible' | 'Suficiente' | null = null;

  constructor(
    private sweetAlert: SweetAlertService,
    private ngZone: NgZone,
    private inventarioService: InventarioOperativoService,
  ) {}

  ngOnInit(): void {
    this.cargarReporte();
  }

  ngAfterViewInit(): void {
    this.crearGrafico();
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  cargarReporte(): void {
    this.cargando = true;
    this.errorMensaje = '';
    forkJoin({
      saldos: this.inventarioService.cargarSaldos(),
      ingredientes: this.inventarioService.cargarIngredientes(),
    }).subscribe({
      next: ({ saldos, ingredientes }) => {
        this.productos = saldos.map(saldo => {
          const ingrediente = ingredientes.find(item => item.id === saldo.ingredienteId);
          const estado = saldo.cantidad <= saldo.stockMinimo
            ? 'Poco stock'
            : saldo.cantidad <= saldo.stockMinimo * 2
              ? 'Disponible'
              : 'Suficiente';
          return {
            nombre: ingrediente?.nombre || `Ingrediente ${saldo.ingredienteId}`,
            categoria: ingrediente?.categoriaId == null ? 'Sin categoría' : `Categoría ${ingrediente.categoriaId}`,
            stock: saldo.cantidad,
            stockMinimo: saldo.stockMinimo,
            estado,
          };
        });
        this.cargando = false;
        this.actualizarGrafico();
      },
      error: (error) => {
        console.error('Error al cargar el reporte de inventario:', error);
        this.cargando = false;
        this.errorMensaje = error.status === 401
          ? 'La sesión expiró. Inicia sesión nuevamente para consultar el reporte.'
          : error.status === 403
            ? 'Tu usuario no tiene permiso para consultar el reporte.'
            : 'No se pudieron cargar los datos del reporte. Verifica la conexión e intenta nuevamente.';
        void this.sweetAlert.error('No se pudo cargar el reporte', this.errorMensaje);
      },
    });
  }

  get totalProductos(): number {
    return this.productos.length;
  }

  getCantidadPorEstado(estado: 'Poco stock' | 'Disponible' | 'Suficiente'): number {
    return this.productos.filter(p => p.estado === estado).length;
  }

  getPorcentajePorEstado(estado: 'Poco stock' | 'Disponible' | 'Suficiente'): number {
    if (this.totalProductos === 0) return 0;
    const cantidad = this.getCantidadPorEstado(estado);
    return Math.round((cantidad / this.totalProductos) * 100);
  }

  get productosFiltrados(): ProductoInventario[] {
    if (!this.estadoSeleccionado) {
      return this.productos;
    }
    return this.productos.filter(p => p.estado === this.estadoSeleccionado);
  }

  seleccionarEstado(estado: 'Poco stock' | 'Disponible' | 'Suficiente' | null): void {
    if (this.estadoSeleccionado === estado) {
      this.estadoSeleccionado = null; // Si hace clic al mismo, deselecciona para ver todos
    } else {
      this.estadoSeleccionado = estado;
    }
  }

  private crearGrafico(): void {
    if (!this.chartCanvas) return;

    const dataCounts = this.estadosDisponibles.map(estado => this.getCantidadPorEstado(estado));
    const bgColors = this.estadosDisponibles.map(estado => this.coloresPorEstado[estado].bg);
    const hoverColors = this.estadosDisponibles.map(estado => this.coloresPorEstado[estado].hover);

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: this.estadosDisponibles,
        datasets: [
          {
            data: dataCounts,
            backgroundColor: bgColors,
            hoverBackgroundColor: hoverColors,
            borderWidth: 3,
            borderColor: '#FFFFFF',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 18,
              font: {
                family: 'Inter, system-ui, sans-serif',
                size: 13,
                weight: 600
              }
            }
          },
          tooltip: {
            backgroundColor: '#1E293B',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = Number(context.raw) || 0;
                const total = this.totalProductos;
                const porcentaje = total > 0 ? Math.round((value / total) * 100) : 0;
                return ` ${label}: ${value} producto(s) (${porcentaje}%)`;
              }
            }
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const estado = this.estadosDisponibles[index];
            this.ngZone.run(() => {
              this.seleccionarEstado(estado);
            });
          }
        }
      }
    });
  }

  private actualizarGrafico(): void {
    if (!this.chart) return;
    this.chart.data.datasets[0].data = this.estadosDisponibles.map(estado => this.getCantidadPorEstado(estado));
    this.chart.update();
  }

  verReporte() {
    this.cargarReporte();
  }

  descargarReporte() {
    if (this.productos.length === 0) {
      void this.sweetAlert.warning('No hay datos para exportar', 'No hay saldos de inventario cargados.');
      return;
    }

    const filas = [
      ['Ingrediente', 'Categoría', 'Saldo actual', 'Stock mínimo', 'Estado'],
      ...this.productos.map(producto => [
        producto.nombre,
        producto.categoria,
        String(producto.stock),
        String(producto.stockMinimo),
        producto.estado,
      ]),
    ];
    const contenido = filas
      .map(fila => fila.map(celda => `"${celda.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte-inventario.csv';
    link.click();
    URL.revokeObjectURL(url);
    void this.sweetAlert.success('Reporte exportado', 'Se descargó el reporte actualizado de inventario.');
  }
}
