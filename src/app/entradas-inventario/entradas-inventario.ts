import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductoService } from '../services/producto.service';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  selector: 'app-entradas-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './entradas-inventario.html',
  styleUrls: ['./entradas-inventario.css', '../banco-datos/banco-datos.css']
})
export class EntradasInventario implements OnInit {

  entradas: any[] = [];
  ingredientes: any[] = [];
  unidades: any[] = [];

  mostrarModal = false;
  guardando = false;

  formEntrada: any = {
    id_ingrediente: null,
    cantidad: null,
    id_unidad_medida: null,
    observaciones: ''
  };

  constructor(
    private productoService: ProductoService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos() {
    this.productoService.getEntradas().subscribe({
      next: (res) => {
        this.entradas = Array.isArray(res) ? res : (res.results || []);
      },
      error: (err) => {
        console.error('Error al cargar entradas', err);
      }
    });

    this.productoService.getIngredientes().subscribe({
      next: (res) => {
        this.ingredientes = Array.isArray(res) ? res : (res.results || []);
      }
    });

    this.productoService.getUnidades().subscribe({
      next: (res) => {
        this.unidades = Array.isArray(res) ? res : (res.results || []);
      }
    });
  }

  abrirModalNuevaEntrada() {
    this.formEntrada = {
      id_ingrediente: null,
      cantidad: null,
      id_unidad_medida: null,
      observaciones: ''
    };
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  guardarEntrada() {
    if (!this.formEntrada.id_ingrediente || !this.formEntrada.cantidad || !this.formEntrada.id_unidad_medida) {
      this.sweetAlert.error('Error', 'Por favor completa los campos obligatorios.');
      return;
    }

    this.guardando = true;
    this.productoService.crearEntrada(this.formEntrada).subscribe({
      next: () => {
        this.guardando = false;
        this.sweetAlert.success('Entrada Registrada', 'El inventario se ha actualizado correctamente.');
        this.cerrarModal();
        this.cargarDatos();
      },
      error: (err) => {
        this.guardando = false;
        console.error(err);
        this.sweetAlert.error('Error', 'Hubo un problema al registrar la entrada.');
      }
    });
  }

  obtenerNombreIngrediente(id: number): string {
    const ing = this.ingredientes.find(i => i.id_ingrediente === id);
    return ing ? (ing.nombre_ingrediente || ing.nombre) : 'Desconocido';
  }

  obtenerNombreUnidad(id: number): string {
    const un = this.unidades.find(u => u.id_unidad_medida === id);
    return un ? (un.nombre_unidad || un.nombre || un.abreviatura) : '';
  }

}
