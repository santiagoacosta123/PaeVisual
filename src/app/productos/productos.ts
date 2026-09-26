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
  // Pestaña activa: inventario | movimientos | gramajes
  pestanaActiva: string = 'inventario';

  // Variable para el funcionamiento de la barra de búsqueda
  filtroBusqueda: string = '';

  // Tablas principales
  inventario: any[] = [];
  movimientosInventario: any[] = [];
  gramajes: any[] = [];

  // Categorías de prueba
  categoriasInventario: any[] = [
    { id_categoria_inventario: 1, nombre_categoria: 'Granos y Cereales' },
    { id_categoria_inventario: 2, nombre_categoria: 'Proteínas y Carnes' },
    { id_categoria_inventario: 3, nombre_categoria: 'Abarrotes' },
    { id_categoria_inventario: 4, nombre_categoria: 'Frutas y Verduras' }
  ];

  // Unidades de medida de prueba
  unidadesMedida: any[] = [
    { id_unidad_medida: 1, nombre_unidad: 'Kilogramos', abreviatura: 'kg' },
    { id_unidad_medida: 2, nombre_unidad: 'Gramos', abreviatura: 'g' },
    { id_unidad_medida: 3, nombre_unidad: 'Litros', abreviatura: 'L' },
    { id_unidad_medida: 4, nombre_unidad: 'Mililitros', abreviatura: 'ml' },
    { id_unidad_medida: 5, nombre_unidad: 'Unidades', abreviatura: 'und' }
  ];

  // Ingredientes disponibles
  ingredientesDisponibles: any[] = [
    { id_ingrediente: 1, nombre_ingrediente: 'Arroz Diana' },
    { id_ingrediente: 2, nombre_ingrediente: 'Pechuga de Pollo' },
    { id_ingrediente: 3, nombre_ingrediente: 'Frijol' },
    { id_ingrediente: 4, nombre_ingrediente: 'Lentejas' }
  ];

  mostrarFormulario = false;
  modoEdicion = false;
  editandoId: any = null;
  indiceEdicion: number | null = null;

  // Formulario de inventario
  itemForm: any = {
    id_inventario: null,
    nombre_ingrediente: '',
    id_categoria_inventario: '',
    marca_ingrediente: '',
    cantidad_actual: null,
    stock_minimo: null,
    id_unidad_medida: ''
  };

  // Formulario de movimientos
  movimientoForm: any = {
    id_movimiento_inventario: null,
    id_ingrediente: '',
    tipo_movimiento: 'ENTRADA',
    cantidad: null,
    observaciones: '',
    id_unidad_medida: ''
  };

  // Formulario de gramajes
  gramajeForm: any = {
    id_gramaje: null,
    id_ingrediente: '',
    id_grado: 1,
    cantidad_gramaje: null,
    id_unidad_medida: '',
    descripcion: ''
  };

  constructor(private sweetAlert: SweetAlertService) {}

  ngOnInit(): void {
    this.inventario = [
      {
        id_inventario: 1,
        nombre_ingrediente: 'Arroz Diana',
        id_categoria_inventario: 1,
        nombre_categoria: 'Granos y Cereales',
        marca_ingrediente: 'Diana',
        cantidad_actual: 50,
        stock_minimo: 10,
        id_unidad_medida: 1,
        nombre_unidad: 'Kilogramos',
        expandido: false
      }
    ];

    this.movimientosInventario = [
      {
        id_movimiento_inventario: 1,
        id_ingrediente: 1,
        nombre_ingrediente: 'Arroz Diana',
        tipo_movimiento: 'ENTRADA',
        fecha: '2026-09-14',
        cantidad: 50,
        observaciones: 'Stock inicial',
        id_unidad_medida: 1,
        nombre_unidad: 'Kilogramos'
      }
    ];

    this.gramajes = [
      {
        id_gramaje: 1,
        id_ingrediente: 1,
        nombre_ingrediente: 'Arroz Diana',
        cantidad_gramaje: 250,
        id_unidad_medida: 2,
        nombre_unidad: 'Gramos',
        descripcion: 'Porción estándar por plato'
      }
    ];
  }

  // Getters para el filtrado en tiempo real según la pestaña y texto ingresado
  get inventarioFiltrado() {
    if (!this.filtroBusqueda.trim()) return this.inventario;
    const texto = this.filtroBusqueda.toLowerCase();
    return this.inventario.filter(item => 
      item.nombre_ingrediente.toLowerCase().includes(texto) ||
      item.nombre_categoria?.toLowerCase().includes(texto) ||
      item.marca_ingrediente?.toLowerCase().includes(texto)
    );
  }

  get movimientosFiltrados() {
    if (!this.filtroBusqueda.trim()) return this.movimientosInventario;
    const texto = this.filtroBusqueda.toLowerCase();
    return this.movimientosInventario.filter(mov => 
      mov.nombre_ingrediente?.toLowerCase().includes(texto) ||
      mov.observaciones?.toLowerCase().includes(texto) ||
      mov.tipo_movimiento?.toLowerCase().includes(texto)
    );
  }

  get gramajesFiltrados() {
    if (!this.filtroBusqueda.trim()) return this.gramajes;
    const texto = this.filtroBusqueda.toLowerCase();
    return this.gramajes.filter(gram => 
      gram.nombre_ingrediente?.toLowerCase().includes(texto) ||
      gram.descripcion?.toLowerCase().includes(texto)
    );
  }

  cambiarPestana(pestana: string): void {
    this.pestanaActiva = pestana;
    this.filtroBusqueda = ''; // Limpia la búsqueda al cambiar de pestaña
    this.cerrarFormulario();
    this.cerrarDetalles();
  }

  verDetalles(item: any): void {
    this.cerrarFormulario();
    this.itemSeleccionado = item;
  }

  cerrarDetalles(): void {
    this.itemSeleccionado = null;
  }

  abrirFormulario(item: any = null): void {
    this.cerrarDetalles(); 
    this.mostrarFormulario = true;

    if (item) {
      this.modoEdicion = true;
      this.editandoId = true;

      if (this.pestanaActiva === 'inventario') {
        this.indiceEdicion = this.inventario.indexOf(item);
        this.itemForm = { ...item };
      } else if (this.pestanaActiva === 'movimientos') {
        this.indiceEdicion = this.movimientosInventario.indexOf(item);
        this.movimientoForm = { ...item };
      } else if (this.pestanaActiva === 'gramajes') {
        this.indiceEdicion = this.gramajes.indexOf(item);
        this.gramajeForm = { ...item };
      }
    } else {
      this.modoEdicion = false;
      this.editandoId = null;
      this.indiceEdicion = null;
      this.limpiarFormularios();
    }
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.modoEdicion = false;
    this.editandoId = null;
    this.indiceEdicion = null;
    this.limpiarFormularios();
  }

  limpiarFormularios(): void {
    this.itemForm = {
      id_inventario: null,
      nombre_ingrediente: '',
      id_categoria_inventario: '',
      marca_ingrediente: '',
      cantidad_actual: null,
      stock_minimo: null,
      id_unidad_medida: ''
    };

    this.movimientoForm = {
      id_movimiento_inventario: null,
      id_ingrediente: '',
      tipo_movimiento: 'ENTRADA',
      cantidad: null,
      observaciones: '',
      id_unidad_medida: ''
    };

    this.gramajeForm = {
      id_gramaje: null,
      id_ingrediente: '',
      id_grado: 1,
      cantidad_gramaje: null,
      id_unidad_medida: '',
      descripcion: ''
    };
  }

  guardarTodo(): void {
    if (this.pestanaActiva === 'inventario') {
      if (!this.itemForm.nombre_ingrediente || this.itemForm.cantidad_actual === null) {
        this.sweetAlert.warning('Campos incompletos', 'Llene los campos obligatorios del inventario.');
        return;
      }

      const cat = this.categoriasInventario.find(c => c.id_categoria_inventario == this.itemForm.id_categoria_inventario);
      const um = this.unidadesMedida.find(u => u.id_unidad_medida == this.itemForm.id_unidad_medida);

      if (this.modoEdicion && this.indiceEdicion !== null && this.indiceEdicion > -1) {
        this.inventario[this.indiceEdicion] = {
          ...this.itemForm,
          nombre_categoria: cat ? cat.nombre_categoria : 'General',
          nombre_unidad: um ? um.nombre_unidad : 'Unidad'
        };
        this.sweetAlert.success('Actualizado', 'Insumo modificado con éxito.');
      } else {
        this.inventario.push({
          ...this.itemForm,
          id_inventario: this.inventario.length + 1,
          nombre_categoria: cat ? cat.nombre_categoria : 'General',
          nombre_unidad: um ? um.nombre_unidad : 'Unidad'
        });
        this.sweetAlert.success('Guardado', 'Insumo agregado al inventario.');
      }
    } else if (this.pestanaActiva === 'movimientos') {
      if (!this.movimientoForm.id_ingrediente || !this.movimientoForm.cantidad) {
        this.sweetAlert.warning('Campos incompletos', 'Complete los datos del movimiento.');
        return;
      }

      const ing = this.ingredientesDisponibles.find(i => i.id_ingrediente == this.movimientoForm.id_ingrediente);
      const um = this.unidadesMedida.find(u => u.id_unidad_medida == this.movimientoForm.id_unidad_medida);

      if (this.modoEdicion && this.indiceEdicion !== null && this.indiceEdicion > -1) {
        this.movimientosInventario[this.indiceEdicion] = {
          ...this.movimientoForm,
          nombre_ingrediente: ing ? ing.nombre_ingrediente : 'Ingrediente',
          nombre_unidad: um ? um.nombre_unidad : 'Unidad'
        };
        this.sweetAlert.success('Actualizado', 'Movimiento modificado con éxito.');
      } else {
        this.movimientosInventario.push({
          ...this.movimientoForm,
          id_movimiento_inventario: this.movimientosInventario.length + 1,
          nombre_ingrediente: ing ? ing.nombre_ingrediente : 'Ingrediente',
          fecha: new Date().toISOString().split('T')[0],
          nombre_unidad: um ? um.nombre_unidad : 'Unidad'
        });
        this.sweetAlert.success('Registrado', 'Movimiento de inventario guardado.');
      }
    } else if (this.pestanaActiva === 'gramajes') {
      if (!this.gramajeForm.id_ingrediente || !this.gramajeForm.cantidad_gramaje) {
        this.sweetAlert.warning('Campos incompletos', 'Complete los datos del gramaje.');
        return;
      }

      const ing = this.ingredientesDisponibles.find(i => i.id_ingrediente == this.gramajeForm.id_ingrediente);
      const um = this.unidadesMedida.find(u => u.id_unidad_medida == this.gramajeForm.id_unidad_medida);

      if (this.modoEdicion && this.indiceEdicion !== null && this.indiceEdicion > -1) {
        this.gramajes[this.indiceEdicion] = {
          ...this.gramajeForm,
          nombre_ingrediente: ing ? ing.nombre_ingrediente : 'Ingrediente',
          nombre_unidad: um ? um.nombre_unidad : 'Gramos'
        };
        this.sweetAlert.success('Actualizado', 'Gramaje modificado con éxito.');
      } else {
        this.gramajes.push({
          ...this.gramajeForm,
          id_gramaje: this.gramajes.length + 1,
          nombre_ingrediente: ing ? ing.nombre_ingrediente : 'Ingrediente',
          nombre_unidad: um ? um.nombre_unidad : 'Gramos'
        });
        this.sweetAlert.success('Registrado', 'Gramaje guardado correctamente.');
      }
    }

    this.cerrarFormulario();
  }

  eliminarItem(lista: any[], item: any): void {
    this.sweetAlert.confirm('¿Eliminar?', '¿Desea eliminar este registro?', 'Sí, eliminar').then((res: any) => {
      if (res.isConfirmed) {
        const index = lista.indexOf(item);
        if (index > -1) {
          lista.splice(index, 1);
        }
        this.sweetAlert.success('Eliminado', 'Registro borrado con éxito.');
      }
    });
  }
}