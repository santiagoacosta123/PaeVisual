import { Component, OnInit } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface SaldoAlmacen {
  id: number;
  producto: string;
  categoria: string;
  stockActual: number;
  unidad: string;
  nivelStock: 'Adecuado' | 'Bajo' | 'Crítico';
  ultimoMovimiento: string;
}

@Component({
  selector: 'app-saldos-almacen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './saldos-almacen.html',
  styleUrls: ['./saldos-almacen.css']
})
export class SaldosAlmacenComponent implements OnInit {
  saldos: SaldoAlmacen[] = [
    { id: 1, producto: 'Arroz Blanco Extra', categoria: 'Granos', stockActual: 320, unidad: 'Kg', nivelStock: 'Adecuado', ultimoMovimiento: '2026-10-05 Entrada' },
    { id: 2, producto: 'Aceite Vegetal', categoria: 'Abarrotes', stockActual: 15, unidad: 'Litros', nivelStock: 'Crítico', ultimoMovimiento: '2026-10-08 Salida' },
    { id: 3, producto: 'Leche Entera', categoria: 'Lácteos/Perecederos', stockActual: 45, unidad: 'Litros', nivelStock: 'Bajo', ultimoMovimiento: '2026-10-07 Entrada' },
    { id: 4, producto: 'Lenteja', categoria: 'Granos', stockActual: 180, unidad: 'Kg', nivelStock: 'Adecuado', ultimoMovimiento: '2026-09-28 Entrada' }
  ];

  saldosFiltrados: SaldoAlmacen[] = [];
  filtroCategoria: string = 'todas';
  soloAlertasStock: boolean = false;

  mostrarModalMovimientos: boolean = false;
  productoMovimiento: SaldoAlmacen | null = null;

  ngOnInit(): void {
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    this.saldosFiltrados = this.saldos.filter(item => {
      const cumpleCat = this.filtroCategoria === 'todas' || item.categoria.toLowerCase().includes(this.filtroCategoria.toLowerCase());
      const cumpleAlerta = !this.soloAlertasStock || item.nivelStock === 'Bajo' || item.nivelStock === 'Crítico';
      return cumpleCat && cumpleAlerta;
    });
  }

  toggleAlertasStock(): void {
    this.soloAlertasStock = !this.soloAlertasStock;
    this.aplicarFiltros();
  }

  verMovimientosProducto(prod: SaldoAlmacen): void {
    this.productoMovimiento = prod;
    this.mostrarModalMovimientos = true;
  }

  exportarInventario(formato: string): void {
    alert(`Exportando reporte consolidado de almacén en formato ${formato}...`);
  }
}