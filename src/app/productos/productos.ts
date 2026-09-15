import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-productos',
  styleUrls: ['./productos.css'],
  templateUrl: './productos.html',
})
export class Productos implements OnInit {
  // Pestaña activa para alternar rápido: 'inventario' | 'movimientos' | 'gramajes'
  pestanaActiva: string = 'inventario';

  // Tablas principales
  inventario: any[] = [];
  movimientosInventario: any[] = []; // Tabla: movimientos_inventario
  gramajes: any[] = []; // Tabla: gramajes

  // Catálogos foráneos
  categoriasInventario: any[] = [
    { id_categoria_inventario: 1, nombre_categoria: 'Granos y Cereales' },
    { id_categoria_inventario: 2, nombre_categoria: 'Proteínas y Carnes' }
  ];

  unidadesMedida: any[] = [
    { id_unidad_medida: 1, nombre: 'Kilogramos', abreviatura: 'kg' },
    { id_unidad_medida: 2, nombre: 'Gramos', abreviatura: 'g' },
    { id_unidad_medida: 3, nombre: 'Litros', abreviatura: 'L' }
  ];

  ingredientesDisponibles: any[] = [
    { id_ingrediente: 1, nombre_ingrediente: 'Arroz Diana' },
    { id_ingrediente: 2, nombre_ingrediente: 'Pechuga de Pollo' }
  ];

  mostrarFormulario = false;
  modoEdicion = false;
  indiceEdicion: number | null = null;

  // Formularios unificados
  itemForm: any = {
    id_inventario: null,
    nombre_ingrediente: '',
    id_categoria_inventario: '',
    marca_ingrediente: '',
    cantidad_actual: null,
    stock_minimo: null,
    id_unidad_medida: ''
  };

  movimientoForm: any = {
    id_ingrediente: '',
    tipo_movimiento: 'ENTRADA',
    cantidad: null,
    observaciones: '',
    id_unidad_medida: ''
  };

  gramajeForm: any = {
    id_ingrediente: '',
    id_grado: 1,
    cantidad_gramaje: null,
    id_unidad_medida: '',
    descripcion: ''
  };

  constructor(private sweetAlert: SweetAlertService) {}

  ngOnInit(): void {
    // Datos iniciales de prueba
    this.inventario = [
      { id_inventario: 1, nombre_ingrediente: 'Arroz Diana', nombre_categoria: 'Granos y Cereales', marca_ingrediente: 'Diana', cantidad_actual: 50, stock_minimo: 10, nombre_unidad: 'Kilogramos' }
    ];
    this.movimientosInventario = [
      { id_movimiento_inventario: 1, nombre_ingrediente: 'Arroz Diana', tipo_movimiento: 'ENTRADA', fecha: '2026-09-14', cantidad: 50, observaciones: 'Stock inicial', nombre_unidad: 'Kilogramos' }
    ];
    this.gramajes = [
      { id_gramaje: 1, nombre_ingrediente: 'Arroz Diana', cantidad_gramaje: 250, nombre_unidad: 'Gramos', descripcion: 'Porción estándar por plato' }
    ];
  }

  cambiarPestana(pestana: string): void {
    this.pestanaActiva = pestana;
    this.cerrarFormulario();
  }

  abrirFormulario(): void {
    this.mostrarFormulario = true;
    this.modoEdicion = false;
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
  }

  guardarTodo(): void {
    if (this.pestanaActiva === 'inventario') {
      if (!this.itemForm.nombre_ingrediente || this.itemForm.cantidad_actual === null) {
        this.sweetAlert.warning('Campos incompletos', 'Llene los campos obligatorios del inventario.');
        return;
      }
      const cat = this.categoriasInventario.find(c => c.id_categoria_inventario == this.itemForm.id_categoria_inventario);
      const um = this.unidadesMedida.find(u => u.id_unidad_medida == this.itemForm.id_unidad_medida);
      
      this.inventario.push({
        ...this.itemForm,
        id_inventario: this.inventario.length + 1,
        nombre_categoria: cat ? cat.nombre_categoria : 'General',
        nombre_unidad: um ? um.nombre : 'Unidad'
      });
      this.sweetAlert.success('Guardado', 'Insumo agregado al inventario.');
    } 
    else if (this.pestanaActiva === 'movimientos') {
      if (!this.movimientoForm.id_ingrediente || !this.movimientoForm.cantidad) {
        this.sweetAlert.warning('Campos incompletos', 'Complete los datos del movimiento.');
        return;
      }
      const ing = this.ingredientesDisponibles.find(i => i.id_ingrediente == this.movimientoForm.id_ingrediente);
      const um = this.unidadesMedida.find(u => u.id_unidad_medida == this.movimientoForm.id_unidad_medida);

      this.movimientosInventario.push({
        ...this.movimientoForm,
        id_movimiento_inventario: this.movimientosInventario.length + 1,
        nombre_ingrediente: ing ? ing.nombre_ingrediente : 'Ingrediente',
        fecha: new Date().toISOString().split('T')[0],
        nombre_unidad: um ? um.nombre : 'Unidad'
      });
      this.sweetAlert.success('Registrado', 'Movimiento de inventario guardado.');
    }
    else if (this.pestanaActiva === 'gramajes') {
      if (!this.gramajeForm.id_ingrediente || !this.gramajeForm.cantidad_gramaje) {
        this.sweetAlert.warning('Campos incompletos', 'Complete los datos del gramaje.');
        return;
      }
      const ing = this.ingredientesDisponibles.find(i => i.id_ingrediente == this.gramajeForm.id_ingrediente);
      const um = this.unidadesMedida.find(u => u.id_unidad_medida == this.gramajeForm.id_unidad_medida);

      this.gramajes.push({
        ...this.gramajeForm,
        id_gramaje: this.gramajes.length + 1,
        nombre_ingrediente: ing ? ing.nombre_ingrediente : 'Ingrediente',
        nombre_unidad: um ? um.nombre : 'Gramos'
      });
      this.sweetAlert.success('Registrado', 'Gramaje guardado correctamente.');
    }

    this.cerrarFormulario();
  }

  eliminarItem(lista: any[], item: any): void {
    this.sweetAlert.confirm('¿Eliminar?', '¿Desea eliminar este registro?', 'Sí, eliminar').then((res: any) => {
      if (res.isConfirmed) {
        const index = lista.indexOf(item);
        if (index > -1) lista.splice(index, 1);
        this.sweetAlert.success('Eliminado', 'Registro borrado con éxito.');
      }
    });
  }
}