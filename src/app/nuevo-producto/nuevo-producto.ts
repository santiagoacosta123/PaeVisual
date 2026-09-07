import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  selector: 'app-nuevo-producto',
  styleUrls: ['./nuevo-producto.css'],
  templateUrl: './nuevo-producto.html',
})
export class NuevoProducto {
  producto = {
    nombre: '',
    categoria: '',
    stock: 0,
    precio: 0
  };

  constructor(private sweetAlert: SweetAlertService) {}

  guardarProducto() {
    if (!this.producto.nombre || !this.producto.categoria) {
      this.sweetAlert.warning('Campos incompletos', 'Debe ingresar nombre y categoría del producto.');
      return;
    }

    this.sweetAlert.success('Producto guardado', `${this.producto.nombre} se registró correctamente.`);
  }

  cancelar() {
    this.sweetAlert
      .confirm('¿Cancelar?', 'Se perderán los datos ingresados.')
      .then((result) => {
        if (result.isConfirmed) {
          this.producto = { nombre: '', categoria: '', stock: 0, precio: 0 };
        }
      });
  }
}
