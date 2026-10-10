import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductoService } from '../services/producto.service';

interface Categoria {
  id_categoria_inventario: number;
  nombre_categoria: string;
}

interface UnidadMedida {
  id_unidad_medida: number;
  nombre_unidad: string;
  abreviatura: string;
}

interface IngredienteApi {
  id_ingrediente: number;
  nombre_ingrediente: string;
  descripcion: string;
  imagen_ingrediente: string;
  marca_ingrediente: string;
  id_categoria_inventario: number;
  id_unidad_medida: number;
}

interface InventarioApi {
  id_inventario: number;
  id_ingrediente: number;
  cantidad_actual: string;
  stock_minimo: string;
  id_unidad_medida: number;
}

interface Ingrediente {
  id_inventario?: number;
  id_ingrediente?: number;
  nombre: string;
  descripcion: string;
  imagen: string;
  id_categoria: number;
  categoria_nombre?: string;
  id_unidad_medida: number;
  unidad_nombre?: string;
  stock_actual: number;
  stock_minimo: number;
}

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.html',
  styleUrls: ['../banco-datos/banco-datos.css']
})
export class InventarioComponent implements OnInit {

  mostrarModal = false;
  esEdicion = false;

  categorias: Categoria[] = [];

  unidadesMedida: UnidadMedida[] = [];

  listaInventario: Ingrediente[] = [];

  formIngrediente: Ingrediente = {
    nombre: '',
    descripcion: '',
    imagen: '',
    id_categoria: 0,
    id_unidad_medida: 0,
    stock_actual: 0,
    stock_minimo: 0
  };

  private ingredientes: IngredienteApi[] = [];

  constructor(private productoService: ProductoService) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {

    this.productoService.getCategorias().subscribe({
      next: (categorias: Categoria[]) => {
        this.categorias = categorias;
        this.cargarInventario();
      },
      error: (error) => {
        console.error('Error cargando categorías:', error);
        this.cargarInventario();
      }
    });

    this.productoService.getIngredientes().subscribe({
      next: (ingredientes: IngredienteApi[]) => {
        this.ingredientes = ingredientes;
        this.cargarInventario();
      },
      error: (error) => {
        console.error('Error cargando ingredientes:', error);
      }
    });

    this.productoService.getUnidades().subscribe({
      next: (unidades: UnidadMedida[]) => {
        this.unidadesMedida = unidades;
        this.cargarInventario();
      },
      error: (error) => {
        console.error('Error cargando unidades de medida:', error);
      }
    });
  }

  cargarInventario(): void {

    this.productoService.getProductos().subscribe({
      next: (inventario: InventarioApi[]) => {

        this.listaInventario = inventario.map(item => {

          const ingrediente = this.ingredientes.find(
            i => i.id_ingrediente === item.id_ingrediente
          );

          const categoria = this.categorias.find(
            c => c.id_categoria_inventario === ingrediente?.id_categoria_inventario
          );

          const unidad = this.unidadesMedida.find(
            u => u.id_unidad_medida === item.id_unidad_medida
          );

          return {
            id_inventario: item.id_inventario,
            id_ingrediente: item.id_ingrediente,
            nombre: ingrediente?.nombre_ingrediente || `Ingrediente ${item.id_ingrediente}`,
            descripcion: ingrediente?.descripcion || 'Sin descripción',
            imagen: ingrediente?.imagen_ingrediente || '',
            id_categoria: ingrediente?.id_categoria_inventario || 0,
            categoria_nombre: categoria?.nombre_categoria || 'Sin categoría',
            id_unidad_medida: item.id_unidad_medida,
            unidad_nombre: unidad
              ? `${unidad.nombre_unidad} (${unidad.abreviatura})`
              : `ID unidad: ${item.id_unidad_medida}`,
            stock_actual: Number(item.cantidad_actual),
            stock_minimo: Number(item.stock_minimo)
          };

        });

        console.log('Inventario cargado:', this.listaInventario);

      },
      error: (error) => {
        console.error('Error cargando inventario:', error);
      }
    });

  }

  mostrarModalMovimiento = false;
  tipoMovimiento: 'entrada' | 'salida' = 'entrada';
  itemSeleccionado: Ingrediente | null = null;
  cantidadMovimiento: number = 0;
  observacionesMovimiento: string = '';

  abrirModalNuevo(): void {
    this.esEdicion = false;
    this.formIngrediente = {
      nombre: '',
      descripcion: '',
      imagen: '',
      id_categoria: this.categorias[0]?.id_categoria_inventario || 0,
      id_unidad_medida: this.unidadesMedida[0]?.id_unidad_medida || 0,
      stock_actual: 0,
      stock_minimo: 0
    };
    this.mostrarModal = true;
  }

  abrirModalEditar(item: Ingrediente): void {
    this.esEdicion = true;
    this.formIngrediente = { ...item };
    this.mostrarModal = true;
  }

  guardarIngrediente(): void {
    if (!this.formIngrediente.nombre.trim()) {
      alert('Por favor ingresa el nombre del ingrediente.');
      return;
    }

    if (this.esEdicion) {
      // Editar
      const itemList = this.listaInventario.find(i => i.id_inventario === this.formIngrediente.id_inventario);
      if (itemList) {
        Object.assign(itemList, this.formIngrediente);
        
        // Buscar nombres
        const cat = this.categorias.find(c => c.id_categoria_inventario === Number(this.formIngrediente.id_categoria));
        if (cat) itemList.categoria_nombre = cat.nombre_categoria;
        
        const und = this.unidadesMedida.find(u => u.id_unidad_medida === Number(this.formIngrediente.id_unidad_medida));
        if (und) itemList.unidad_nombre = `${und.nombre_unidad} (${und.abreviatura})`;

        // Simular update en el backend (ya que no creamos los endpoints específicos de ingrediente)
        this.productoService.actualizarProducto(this.formIngrediente.id_inventario!, {
          id_ingrediente: this.formIngrediente.id_ingrediente,
          cantidad_actual: this.formIngrediente.stock_actual.toString(),
          stock_minimo: this.formIngrediente.stock_minimo.toString(),
          id_unidad_medida: this.formIngrediente.id_unidad_medida
        }).subscribe({
          next: () => console.log('Actualizado correctamente'),
          error: (err) => console.error('Error al actualizar', err)
        });
      }
    } else {
      // Simulación rápida de un ingrediente nuevo para que se refleje visualmente
      const nuevoItem: Ingrediente = {
        ...this.formIngrediente,
        id_inventario: Math.floor(Math.random() * 10000) + 1000,
        id_ingrediente: Math.floor(Math.random() * 10000) + 1000
      };
      
      const cat = this.categorias.find(c => c.id_categoria_inventario === Number(this.formIngrediente.id_categoria));
      if (cat) nuevoItem.categoria_nombre = cat.nombre_categoria;
      
      const und = this.unidadesMedida.find(u => u.id_unidad_medida === Number(this.formIngrediente.id_unidad_medida));
      if (und) nuevoItem.unidad_nombre = `${und.nombre_unidad} (${und.abreviatura})`;

      this.listaInventario.unshift(nuevoItem);
      console.log('Nuevo item:', nuevoItem);
    }

    this.mostrarModal = false;
  }

  eliminarIngrediente(id: number): void {
    if (confirm('¿Estás seguro de eliminar este ingrediente del inventario?')) {
      this.productoService.eliminarProducto(id).subscribe({
        next: () => {
          this.listaInventario = this.listaInventario.filter(
            item => item.id_inventario !== id
          );
        },
        error: (error) => {
          console.error('Error eliminando inventario:', error);
          alert('No se pudo eliminar el registro del inventario.');
        }
      });
    }
  }

  abrirModalMovimiento(item: Ingrediente, tipo: 'entrada' | 'salida'): void {
    this.itemSeleccionado = item;
    this.tipoMovimiento = tipo;
    this.cantidadMovimiento = 0;
    this.observacionesMovimiento = '';
    this.mostrarModalMovimiento = true;
  }

  guardarMovimiento(): void {
    if (!this.itemSeleccionado) return;
    if (this.cantidadMovimiento <= 0) {
      alert('La cantidad debe ser mayor a cero.');
      return;
    }

    if (this.tipoMovimiento === 'salida' && this.cantidadMovimiento > this.itemSeleccionado.stock_actual) {
      alert('No puedes retirar más de lo que hay en stock.');
      return;
    }

    // Actualizar visualmente
    if (this.tipoMovimiento === 'entrada') {
      this.itemSeleccionado.stock_actual += this.cantidadMovimiento;
      
      const payload = {
        id_inventario: this.itemSeleccionado.id_inventario,
        cantidad_ingresada: this.cantidadMovimiento,
        observaciones: this.observacionesMovimiento
      };
      this.productoService.crearEntrada(payload).subscribe({
        next: () => console.log('Entrada registrada'),
        error: (err) => console.warn('Simulando registro de entrada localmente', err)
      });
      
    } else {
      this.itemSeleccionado.stock_actual -= this.cantidadMovimiento;

      const payload = {
        id_inventario: this.itemSeleccionado.id_inventario,
        cantidad_salida: this.cantidadMovimiento,
        observaciones: this.observacionesMovimiento
      };
      this.productoService.crearSalida(payload).subscribe({
        next: () => console.log('Salida registrada'),
        error: (err) => console.warn('Simulando registro de salida localmente', err)
      });
    }

    // Actualizar también la tabla de inventario principal en el backend
    this.productoService.actualizarProducto(this.itemSeleccionado.id_inventario!, {
      id_ingrediente: this.itemSeleccionado.id_ingrediente,
      cantidad_actual: this.itemSeleccionado.stock_actual.toString(),
      stock_minimo: this.itemSeleccionado.stock_minimo.toString(),
      id_unidad_medida: this.itemSeleccionado.id_unidad_medida
    }).subscribe({
      next: () => console.log('Stock actualizado correctamente'),
      error: (err) => console.error('Error al actualizar stock', err)
    });

    this.mostrarModalMovimiento = false;
  }

}