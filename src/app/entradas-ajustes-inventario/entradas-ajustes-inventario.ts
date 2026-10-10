import { Component } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-entradas-ajustes-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './entradas-ajustes-inventario.html',
  styleUrls: ['./entradas-ajustes-inventario.css']
})
export class EntradasAjustesInventarioComponent {
  productos = [
    { id: 1, nombre: 'Arroz Blanco Extra', stockActual: 320, unidad: 'Kg' },
    { id: 2, nombre: 'Aceite Vegetal', stockActual: 15, unidad: 'Litros' },
    { id: 3, nombre: 'Leche Entera', stockActual: 45, unidad: 'Litros' },
    { id: 4, nombre: 'Lenteja', stockActual: 180, unidad: 'Kg' }
  ];

  ajusteForm = {
    productoId: 1,
    tipoMovimiento: 'Entrada',
    cantidad: null,
    observacion: ''
  };

  aplicarCambio(): void {
    if (!this.ajusteForm.productoId || !this.ajusteForm.cantidad || Number(this.ajusteForm.cantidad) <= 0) {
      alert('Seleccione un producto y digite una cantidad numérica válida.');
      return;
    }

    const prod = this.productos.find(p => p.id == this.ajusteForm.productoId);
    if (prod) {
      const cantidadNum = Number(this.ajusteForm.cantidad);
      if (this.ajusteForm.tipoMovimiento === 'Entrada') {
        prod.stockActual += cantidadNum;
      } else {
        prod.stockActual = Math.max(0, prod.stockActual - cantidadNum);
      }
      alert(`Operación aplicada con éxito. Nuevo stock de ${prod.nombre}: ${prod.stockActual} ${prod.unidad}`);
      this.cancelar();
    }
  }

  cancelar(): void {
    this.ajusteForm = {
      productoId: 1,
      tipoMovimiento: 'Entrada',
      cantidad: null,
      observacion: ''
    };
  }
}