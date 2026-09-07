import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  selector: 'app-productos',
  styleUrls: ['./productos.css'],
  templateUrl: './productos.html',
})
export class Productos {
  productos = [
    { nombre: 'Arroz', categoria: 'Grano', stock: 50 },
    { nombre: 'Leche', categoria: 'Lacteo', stock: 20 },
    { nombre: 'Queso', categoria: 'Lacteo', stock: 12 },
    { nombre: 'Frijoles', categoria: 'Grano', stock: 35 }
  ];

  modoEdicion = false;
  productoForm = { nombre: '', categoria: '', stock: 0 };

  constructor(private sweetAlert: SweetAlertService) {}

  abrirFormulario(producto?: { nombre: string; categoria: string; stock: number }) {
    if (producto) {
      this.modoEdicion = true;
      this.productoForm = { ...producto };
      return;
    }

    this.modoEdicion = false;
    this.productoForm = { nombre: '', categoria: '', stock: 0 };
  }

  guardarProducto() {
    if (!this.productoForm.nombre.trim() || !this.productoForm.categoria.trim()) {
      this.sweetAlert.warning('Datos incompletos', 'Completa el nombre y la categoría del producto.');
      return;
    }

    if (this.modoEdicion) {
      const index = this.productos.findIndex((p) => p.nombre === this.productoForm.nombre);
      if (index >= 0) {
        this.productos[index] = { ...this.productoForm };
        this.sweetAlert.success('Producto actualizado', `${this.productoForm.nombre} fue actualizado correctamente.`);
      }
    } else {
      this.productos.push({ ...this.productoForm });
      this.sweetAlert.success('Producto registrado', `${this.productoForm.nombre} se guardó en el inventario.`);
    }

    this.abrirFormulario();
  }

  editarProducto(producto: { nombre: string; categoria: string; stock: number }) {
    this.abrirFormulario(producto);
  }

  eliminarProducto(producto: { nombre: string }) {
    this.sweetAlert
      .confirm('¿Eliminar producto?', `¿Desea continuar con la eliminación de ${producto.nombre}?`)
      .then((result) => {
        if (result.isConfirmed) {
          this.productos = this.productos.filter((p) => p.nombre !== producto.nombre);
          this.sweetAlert.success('Producto eliminado', `${producto.nombre} fue removido del inventario.`);
        }
      });
  }
}
