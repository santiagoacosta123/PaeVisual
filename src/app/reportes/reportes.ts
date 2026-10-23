import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TimeoutError, forkJoin, of } from 'rxjs';
import { catchError, take, timeout } from 'rxjs/operators';
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

/** Si el servidor no responde en este tiempo, se muestra un error en vez de quedarse cargando */
const TIEMPO_MAXIMO_MS = 20000;

/** Convierte cualquier valor (incluso null o undefined) en texto, sin fallar */
const texto = (valor: unknown): string => (valor === null || valor === undefined ? '' : String(valor));

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
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorMensaje = '';

    forkJoin({
      // Las salidas son lo único indispensable: si fallan, se muestra el error
      salidas: this.inventarioService.cargarSalidas().pipe(take(1), timeout(TIEMPO_MAXIMO_MS)),
      // Si fallan los nombres de ingredientes o unidades, el reporte igual se muestra
      ingredientes: this.inventarioService.cargarIngredientes().pipe(
        take(1),
        timeout(TIEMPO_MAXIMO_MS),
        catchError((error: unknown) => {
          console.warn('No se pudieron cargar los ingredientes del reporte:', error);
          return of<IngredienteInventario[]>([]);
        }),
      ),
      unidades: this.inventarioService.cargarUnidades().pipe(
        take(1),
        timeout(TIEMPO_MAXIMO_MS),
        catchError((error: unknown) => {
          console.warn('No se pudieron cargar las unidades del reporte:', error);
          return of<UnidadInventario[]>([]);
        }),
      ),
    }).subscribe({
      next: ({ salidas, ingredientes, unidades }) => {
        this.salidas = salidas
          .map(salida => this.presentar(salida, ingredientes, unidades))
          // Lo más reciente primero
          .sort((a, b) => texto(b.fecha).localeCompare(texto(a.fecha)));
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Error al consultar salidas de inventario:', error);
        this.cargando = false;
        this.salidas = [];

        const estado = error instanceof HttpErrorResponse ? error.status : 0;
        this.errorMensaje = error instanceof TimeoutError
          ? 'El servidor tardó demasiado en responder. Intenta nuevamente.'
          : estado === 401
            ? 'La sesión expiró. Inicia sesión nuevamente para consultar el reporte.'
            : estado === 403
              ? 'Tu usuario no tiene permiso para consultar las salidas de inventario.'
              : 'No se pudieron cargar las salidas. Verifica la conexión e intenta nuevamente.';
        this.cdr.markForCheck();
        void this.alertas.error('No se pudo cargar el reporte', this.errorMensaje);
      },
    });
  }

  get salidasFiltradas(): SalidaPresentacion[] {
    return this.salidas.filter(salida => {
      const fecha = texto(salida.fecha).slice(0, 10);
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

    const filas: string[][] = [
      ['Fecha', 'Ingrediente', 'Cantidad', 'Unidad', 'Observaciones'],
      ...this.salidasFiltradas.map(salida => [
        texto(salida.fecha),
        salida.ingrediente,
        texto(salida.cantidad),
        salida.unidad,
        texto(salida.observaciones),
      ]),
    ];

    // Con ";" Excel en español separa bien las columnas
    const contenido = filas
      .map(fila => fila.map(valor => `"${valor.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const url = URL.createObjectURL(new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'reporte-salidas-inventario.csv';
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);

    void this.alertas.success('Reporte exportado', 'Se descargaron las salidas registradas del rango seleccionado.');
  }

  private presentar(
    salida: SalidaInventarioRegistro,
    ingredientes: IngredienteInventario[],
    unidades: UnidadInventario[],
  ): SalidaPresentacion {
    // Se comparan como texto por si un lado trae el id como número y el otro como texto
    const ingrediente = ingredientes.find(item => texto(item.id) === texto(salida.ingredienteId));
    const unidad = unidades.find(item => texto(item.id) === texto(salida.unidadId));

    return {
      ...salida,
      ingrediente: ingrediente?.nombre || `Ingrediente ${texto(salida.ingredienteId)}`,
      unidad: unidad ? `${unidad.nombre} (${unidad.abreviatura})` : `Unidad ${texto(salida.unidadId)}`,
    };
  }
}