import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SweetAlertService } from '../sweet-alert.service';
import {
  InventarioOperativoService,
  IngredienteInventario,
  SaldoInventario,
  UnidadInventario,
} from '../services/inventario-operativo.service';

interface SaldoPresentacion extends SaldoInventario {
  ingrediente: string;
  categoria: string;
  unidad: string;
  nivelStock: 'Adecuado' | 'Bajo' | 'Crítico';
}

@Component({
  selector: 'app-saldos-almacen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './saldos-almacen.html',
  styleUrls: ['./saldos-almacen.css'],
})
export class SaldosAlmacenComponent implements OnInit {
  saldos: SaldoPresentacion[] = [];
  filtroTexto = '';
  filtroCategoria = 'todas';
  soloAlertasStock = false;
  cargando = true;
  errorMensaje = '';

  constructor(
    private inventarioService: InventarioOperativoService,
    private alertas: SweetAlertService,
  ) {}

  ngOnInit(): void {
    this.cargarSaldos();
  }

  cargarSaldos(): void {
    this.cargando = true;
    this.errorMensaje = '';
    forkJoin({
      saldos: this.inventarioService.cargarSaldos(),
      ingredientes: this.inventarioService.cargarIngredientes(),
      unidades: this.inventarioService.cargarUnidades(),
    }).subscribe({
      next: ({ saldos, ingredientes, unidades }) => {
        this.saldos = saldos.map(saldo => this.presentarSaldo(saldo, ingredientes, unidades));
        this.cargando = false;
        if (this.saldos.length === 0) {
          void this.alertas.info('Inventario vacío', 'Todavía no hay saldos de inventario registrados.');
        }
      },
      error: (error) => {
        console.error('Error al consultar saldos de inventario:', error);
        this.cargando = false;
        this.errorMensaje = error.status === 401
          ? 'La sesión expiró. Inicia sesión nuevamente para consultar el inventario.'
          : error.status === 403
            ? 'Tu usuario no tiene permiso para consultar el inventario.'
            : 'No se pudieron cargar los saldos. Verifica la conexión e intenta nuevamente.';
        void this.alertas.error('No se pudo cargar el inventario', this.errorMensaje);
      },
    });
  }

  get categorias(): string[] {
    return [...new Set(this.saldos.map(saldo => saldo.categoria))].sort();
  }

  get saldosFiltrados(): SaldoPresentacion[] {
    const texto = this.filtroTexto.trim().toLocaleLowerCase();
    return this.saldos.filter(saldo => {
      const coincideCategoria = this.filtroCategoria === 'todas'
        || saldo.categoria === this.filtroCategoria;
      const coincideAlerta = !this.soloAlertasStock || saldo.nivelStock !== 'Adecuado';
      const coincideTexto = !texto
        || `${saldo.ingrediente} ${saldo.categoria} ${saldo.unidad}`.toLocaleLowerCase().includes(texto);
      return coincideCategoria && coincideAlerta && coincideTexto;
    });
  }

  get productosEnAlerta(): number {
    return this.saldos.filter(saldo => saldo.nivelStock !== 'Adecuado').length;
  }

  cambiarFiltroAlerta(): void {
    this.soloAlertasStock = !this.soloAlertasStock;
  }

  descargarCsv(): void {
    if (!this.saldosFiltrados.length) {
      void this.alertas.warning('No hay datos para exportar', 'Ajusta los filtros o revisa el inventario.');
      return;
    }

    const filas = [
      ['Ingrediente', 'Categoría', 'Saldo actual', 'Unidad', 'Stock mínimo', 'Estado'],
      ...this.saldosFiltrados.map(saldo => [
        saldo.ingrediente,
        saldo.categoria,
        String(saldo.cantidad),
        saldo.unidad,
        String(saldo.stockMinimo),
        saldo.nivelStock,
      ]),
    ];
    const contenido = filas.map(fila => fila.map(celda => `"${celda.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'saldos-inventario.csv';
    link.click();
    URL.revokeObjectURL(url);
    void this.alertas.success('Reporte exportado', 'Se descargó el archivo CSV de saldos.');
  }

  private presentarSaldo(
    saldo: SaldoInventario,
    ingredientes: IngredienteInventario[],
    unidades: UnidadInventario[],
  ): SaldoPresentacion {
    const ingrediente = ingredientes.find(item => item.id === saldo.ingredienteId);
    const unidad = unidades.find(item => item.id === saldo.unidadId);
    const nivelStock = saldo.cantidad <= 0
      ? 'Crítico'
      : saldo.cantidad <= saldo.stockMinimo
        ? 'Bajo'
        : 'Adecuado';
    return {
      ...saldo,
      ingrediente: ingrediente?.nombre || `Ingrediente ${saldo.ingredienteId}`,
      categoria: ingrediente?.categoriaId == null ? 'Sin categoría' : `Categoría ${ingrediente.categoriaId}`,
      unidad: unidad ? `${unidad.nombre} (${unidad.abreviatura})` : `Unidad ${saldo.unidadId}`,
      nivelStock,
    };
  }
}
