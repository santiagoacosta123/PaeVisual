import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SweetAlertService } from '../sweet-alert.service';
import {
  IngredienteInventario,
  InventarioOperativoService,
  SalidaInventarioRegistro,
  UnidadInventario,
} from '../services/inventario-operativo.service';

interface SalidaPresentacion extends SalidaInventarioRegistro {
  ingrediente: string;
  unidad: string;
}

@Component({
  selector: 'app-reportes-consumo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html',
})
export class Reportes implements OnInit {
  salidas: SalidaPresentacion[] = [];
  cargando = true;
  errorMensaje = '';
  fechaDesde = '';
  fechaHasta = '';

  constructor(
    private readonly inventarioService: InventarioOperativoService,
    private readonly alertas: SweetAlertService,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorMensaje = '';
    forkJoin({
      salidas: this.inventarioService.cargarSalidas(),
      ingredientes: this.inventarioService.cargarIngredientes(),
      unidades: this.inventarioService.cargarUnidades(),
    }).subscribe({
      next: ({ salidas, ingredientes, unidades }) => {
        this.salidas = salidas.map(salida => this.presentar(salida, ingredientes, unidades));
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al consultar salidas de inventario:', error);
        this.cargando = false;
        this.errorMensaje = error.status === 401
          ? 'La sesión expiró. Inicia sesión nuevamente para consultar el reporte.'
          : error.status === 403
            ? 'Tu usuario no tiene permiso para consultar las salidas de inventario.'
            : 'No se pudieron cargar las salidas. Verifica la conexión e intenta nuevamente.';
        void this.alertas.error('No se pudo cargar el reporte', this.errorMensaje);
      },
    });
  }

  get salidasFiltradas(): SalidaPresentacion[] {
    return this.salidas.filter(salida => {
      const fecha = salida.fecha.slice(0, 10);
      return (!this.fechaDesde || fecha >= this.fechaDesde)
        && (!this.fechaHasta || fecha <= this.fechaHasta);
    });
  }

  get totalMovimientos(): number {
    return this.salidasFiltradas.length;
  }

  exportarCsv(): void {
    if (this.salidasFiltradas.length === 0) {
      void this.alertas.warning('Sin registros', 'No hay salidas para exportar en el rango seleccionado.');
      return;
    }

    const rows = [
      ['Fecha', 'Ingrediente', 'Cantidad', 'Unidad', 'Observaciones'],
      ...this.salidasFiltradas.map(salida => [
        salida.fecha,
        salida.ingrediente,
        String(salida.cantidad),
        salida.unidad,
        salida.observaciones,
      ]),
    ];
    const content = rows
      .map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte-salidas-inventario.csv';
    link.click();
    URL.revokeObjectURL(url);
    void this.alertas.success('Reporte exportado', 'Se descargaron las salidas registradas del rango seleccionado.');
  }

  private presentar(
    salida: SalidaInventarioRegistro,
    ingredientes: IngredienteInventario[],
    unidades: UnidadInventario[],
  ): SalidaPresentacion {
    const ingrediente = ingredientes.find(item => item.id === salida.ingredienteId);
    const unidad = unidades.find(item => item.id === salida.unidadId);
    return {
      ...salida,
      ingrediente: ingrediente?.nombre || `Ingrediente ${salida.ingredienteId}`,
      unidad: unidad ? `${unidad.nombre} (${unidad.abreviatura})` : `Unidad ${salida.unidadId}`,
    };
  }
}
