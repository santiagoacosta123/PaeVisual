import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProductoService } from '../services/producto.service';
import { CustomSelectComponent } from '../shared/custom-select/custom-select';

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
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './inventario.html',
  styleUrls: ['../banco-datos/banco-datos.css']
})
export class InventarioComponent implements OnInit {

  mostrarModal = false;
  esEdicion = false;
  cargando = false;
  errorCarga: string | null = null;

  categorias: Categoria[] = [];
  unidadesMedida: UnidadMedida[] = [];
  listaInventario: Ingrediente[] = [];
  listaInventarioFiltrada: Ingrediente[] = [];
  busquedaTexto: string = "";

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

  /**
   * Carga ordenada y sincronizada con forkJoin:
   * Realiza una sola petición por cada recurso en paralelo sin duplicados.
   */
  cargarDatos(): void {
    this.cargando = true;
    this.errorCarga = null;

    forkJoin({
      categorias: this.productoService.getCategorias().pipe(
        catchError(err => {
          console.error('Error cargando categorías:', err);
          return of([]);
        })
      ),
      ingredientes: this.productoService.getIngredientes().pipe(
        catchError(err => {
          console.error('Error cargando ingredientes:', err);
          return of([]);
        })
      ),
      unidades: this.productoService.getUnidades().pipe(
        catchError(err => {
          console.error('Error cargando unidades de medida:', err);
          return of([]);
        })
      ),
      inventario: this.productoService.getProductos().pipe(
        catchError(err => {
          console.error('Error cargando inventario:', err);
          return of([]);
        })
      )
    }).subscribe({
      next: ({ categorias, ingredientes, unidades, inventario }) => {
        this.categorias = Array.isArray(categorias) ? categorias : (categorias?.results || []);
        this.ingredientes = Array.isArray(ingredientes) ? ingredientes : (ingredientes?.results || []);
        this.unidadesMedida = Array.isArray(unidades) ? unidades : (unidades?.results || []);

        const listaInv = Array.isArray(inventario) ? inventario : (inventario?.results || []);
        this.procesarInventario(listaInv);
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error general cargando inventario:', error);
        this.errorCarga = 'No se pudieron cargar los datos del inventario.';
        this.cargando = false;
      }
    });
  }

  aplicarFiltroInventario(): void {
    const q = (this.busquedaTexto || "").trim().toLowerCase();
    if (!q) {
      this.listaInventarioFiltrada = this.listaInventario;
      return;
    }
    this.listaInventarioFiltrada = this.listaInventario.filter(item =>
      (item.nombre && item.nombre.toLowerCase().includes(q)) ||
      (item.categoria_nombre && item.categoria_nombre.toLowerCase().includes(q)) ||
      (item.descripcion && item.descripcion.toLowerCase().includes(q))
    );
  }

  trackPorInventario(index: number, item: Ingrediente): any {
    return item.id_inventario || item.id_ingrediente || index;
  }

  /**
   * Mapea los registros del inventario cruzándolos con los datos maestros en memoria
   */
  private procesarInventario(inventario: InventarioApi[]): void {
    const resultado = inventario.map(item => {
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
    this.listaInventario = resultado;
    this.aplicarFiltroInventario();
  }

  /**
   * Recarga únicamente la tabla de inventario cuando ya tenemos los catálogos en memoria
   */
  cargarInventario(): void {
    this.productoService.getProductos().subscribe({
      next: (inventario: any) => {
        const listaInv = Array.isArray(inventario) ? inventario : (inventario?.results || []);
        this.procesarInventario(listaInv);
      },
      error: (error) => {
        console.error('Error recargando inventario:', error);
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
      const nuevoItem: Ingrediente = {
        ...this.formIngrediente,
        id_inventario: Math.floor(Math.random() * 10000) + 1000,
        id_ingrediente: this.formIngrediente.id_ingrediente || Math.floor(Math.random() * 10000) + 1000
      };
      
      const cat = this.categorias.find(c => c.id_categoria_inventario === Number(this.formIngrediente.id_categoria));
      if (cat) nuevoItem.categoria_nombre = cat.nombre_categoria;
      
      const und = this.unidadesMedida.find(u => u.id_unidad_medida === Number(this.formIngrediente.id_unidad_medida));
      if (und) nuevoItem.unidad_nombre = `${und.nombre_unidad} (${und.abreviatura})`;

      this.listaInventario.unshift(nuevoItem);
      this.aplicarFiltroInventario();

      const payloadInventario = {
        id_ingrediente: nuevoItem.id_ingrediente,
        cantidad_actual: (this.formIngrediente.stock_actual || 0).toString(),
        stock_minimo: (this.formIngrediente.stock_minimo || 0).toString(),
        id_unidad_medida: this.formIngrediente.id_unidad_medida
      };

      this.productoService.crearProducto(payloadInventario).subscribe({
        next: () => this.cargarInventario(),
        error: (err) => console.error('Error al crear producto en backend:', err)
      });
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
          this.aplicarFiltroInventario();
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
