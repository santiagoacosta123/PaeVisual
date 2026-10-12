import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SweetAlertService } from '../sweet-alert.service';
import {
  EntradaInventarioRegistro,
  InventarioOperativoService,
  IngredienteInventario,
  SaldoInventario,
  UnidadInventario,
} from '../services/inventario-operativo.service';

@Component({
  selector: 'app-entradas-ajustes-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './entradas-ajustes-inventario.html',
  styleUrls: ['./entradas-ajustes-inventario.css'],
})
export class EntradasAjustesInventarioComponent implements OnInit {
  ingredientes: IngredienteInventario[] = [];
  unidades: UnidadInventario[] = [];
  saldos: SaldoInventario[] = [];
  entradas: EntradaInventarioRegistro[] = [];
  cargando = true;
  guardando = false;
  errorMensaje = '';
  ajusteForm = {
    id_ingrediente: null as number | null,
    cantidad: null as number | null,
    id_unidad_medida: null as number | null,
    observaciones: '',
  };

  constructor(
    private inventarioService: InventarioOperativoService,
    private alertas: SweetAlertService,
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.errorMensaje = '';
    forkJoin({
      ingredientes: this.inventarioService.cargarIngredientes(),
      unidades: this.inventarioService.cargarUnidades(),
      saldos: this.inventarioService.cargarSaldos(),
      entradas: this.inventarioService.cargarEntradas(),
    }).subscribe({
      next: ({ ingredientes, unidades, saldos, entradas }) => {
        this.ingredientes = ingredientes;
        this.unidades = unidades;
        this.saldos = saldos;
        this.entradas = entradas;
        this.cargando = false;
        this.seleccionarIngredienteInicial();
        if (this.ingredientesConSaldo.length === 0) {
          void this.alertas.warning(
            'No hay productos para recibir',
            'Primero debe existir un saldo de inventario para el ingrediente.',
          );
        }
      },
      error: (error) => {
        console.error('Error al cargar datos de entrada de inventario:', error);
        this.cargando = false;
        this.errorMensaje = error.status === 401
          ? 'La sesión expiró. Inicia sesión nuevamente para registrar entradas.'
          : error.status === 403
            ? 'Tu usuario no tiene permiso para registrar entradas de inventario.'
            : 'No se pudieron cargar los catálogos o movimientos de inventario.';
        void this.alertas.error('No se pudo cargar la pantalla', this.errorMensaje);
      },
    });
  }

  // SP-258: Exportar Entradas a Excel
  exportarExcelEntradas(): void {
    this.inventarioService.exportarEntradasExcel().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Entradas_Inventario_${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        void this.alertas.success('Exportación exitosa', 'El reporte de entradas se descargó correctamente.');
      },
      error: (error) => {
        console.error('Error al exportar entradas a Excel:', error);
        void this.alertas.error('No se pudo exportar', 'Ocurrió un error al generar el archivo Excel de entradas.');
      }
    });
  }

  get ingredientesConSaldo(): IngredienteInventario[] {
    const ids = new Set(this.saldos.map(saldo => saldo.ingredienteId));
    return this.ingredientes.filter(ingrediente => ids.has(ingrediente.id));
  }

  get entradasRecientes(): EntradaInventarioRegistro[] {
    return [...this.entradas]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 8);
  }

  cambiarIngrediente(): void {
    const saldo = this.saldos.find(item => item.ingredienteId === this.ajusteForm.id_ingrediente);
    if (saldo) this.ajusteForm.id_unidad_medida = saldo.unidadId;
  }

  aplicarCambio(): void {
    const ingrediente = this.ingredientesConSaldo.find(item => item.id === this.ajusteForm.id_ingrediente);
    if (!ingrediente || !this.ajusteForm.id_unidad_medida
      || this.ajusteForm.cantidad == null || this.ajusteForm.cantidad <= 0) {
      void this.alertas.warning(
        'Revisa los datos',
        'Selecciona un ingrediente con inventario e ingresa una cantidad mayor que cero.',
      );
      return;
    }

    this.guardando = true;
    this.inventarioService.registrarEntrada({
      id_ingrediente: ingrediente.id,
      cantidad: this.ajusteForm.cantidad,
      id_unidad_medida: this.ajusteForm.id_unidad_medida,
      observaciones: this.ajusteForm.observaciones.trim(),
    }).subscribe({
      next: () => {
        this.guardando = false;
        void this.alertas.success(
          'Entrada registrada',
          `La entrada de ${ingrediente.nombre} se guardó y el saldo fue actualizado.`,
        );
        this.ajusteForm.cantidad = null;
        this.ajusteForm.observaciones = '';
        this.cargarDatos();
      },
      error: (error) => {
        console.error('Error al registrar entrada de inventario:', error);
        this.guardando = false;
        void this.alertas.error(
          'No se pudo registrar la entrada',
          error.status === 401
            ? 'La sesión expiró. Inicia sesión nuevamente.'
            : error.error?.id_ingrediente?.[0]
              || error.error?.detail
              || 'Revisa que el ingrediente tenga un saldo activo y vuelve a intentarlo.',
        );
      },
    });
  }

  nombreIngrediente(id: number): string {
    return this.ingredientes.find(item => item.id === id)?.nombre || `Ingrediente ${id}`;
  }

  unidad(id: number): string {
    const unidad = this.unidades.find(item => item.id === id);
    return unidad ? `${unidad.abreviatura || unidad.nombre}` : `Unidad ${id}`;
  }

  saldoIngrediente(id: number): number {
    return this.saldos.find(item => item.ingredienteId === id)?.cantidad ?? 0;
  }

  private seleccionarIngredienteInicial(): void {
    if (!this.ajusteForm.id_ingrediente && this.ingredientesConSaldo.length) {
      this.ajusteForm.id_ingrediente = this.ingredientesConSaldo[0].id;
    }
    this.cambiarIngrediente();
  }
}