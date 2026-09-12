import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SweetAlertService } from '../sweet-alert.service';
import { ProductoService } from '../services/producto.service';

@Component({
  standalone: true,
  selector: 'app-productos',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './productos.html',
  styleUrls: ['./productos.css']
})
export class Productos implements OnInit {

  productos: any[] = [];
  ingredientesList: any[] = [];
  unidadesList: any[] = [];
  categoriasList: any[] = [];

  mostrarFormulario = false;
  modoEdicion = false;

  productoForm = {
    id: null as number | null,
    nombre: '',
    categoria: '',
    stock: '',
    unidad: '',
    porcentaje: ''
  };

  constructor(
    private productoService: ProductoService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.obtenerProductos();
    this.obtenerIngredientes();
    this.obtenerUnidades();
    this.obtenerCategorias();
  }

  

  obtenerProductos(): void {
    this.productoService.getProductos().subscribe({
      next: (data: any) => {

        this.productos = Array.isArray(data)
          ? data
          : data?.results || [];

        console.log('PRODUCTOS:', this.productos);
      },

      error: (error: any) => {

        console.error('Error obteniendo inventario:', error);
        console.error('Respuesta backend:', error?.error);

        this.sweetAlert.warning(
          'Error',
          'No se pudieron cargar los productos.'
        );
      }
    });
  }

  // ==============================
  // OBTENER INGREDIENTES
  // ==============================

  obtenerIngredientes(): void {
    this.productoService.getIngredientes().subscribe({

      next: (data: any) => {

        this.ingredientesList = Array.isArray(data)
          ? data
          : data?.results || [];

        console.log('INGREDIENTES:', this.ingredientesList);
      },

      error: (error: any) => {
        console.error('Error obteniendo ingredientes:', error);
      }

    });
  }

  // ==============================
  // OBTENER UNIDADES
  // ==============================

  obtenerUnidades(): void {
    this.productoService.getUnidades().subscribe({

      next: (data: any) => {

        this.unidadesList = Array.isArray(data)
          ? data
          : data?.results || [];

        console.log('UNIDADES:', this.unidadesList);
      },

      error: (error: any) => {
        console.error('Error obteniendo unidades:', error);
      }

    });
  }

  // ==============================
  // OBTENER CATEGORIAS
  // ==============================

  obtenerCategorias(): void {
    this.productoService.getCategorias().subscribe({

      next: (data: any) => {

        this.categoriasList = Array.isArray(data)
          ? data
          : data?.results || [];

        console.log('CATEGORIAS:', this.categoriasList);
      },

      error: (error: any) => {
        console.error('Error obteniendo categorías:', error);
      }

    });
  }

  // ==============================
  // ABRIR FORMULARIO
  // ==============================

  abrirFormulario(producto?: any): void {

    this.mostrarFormulario = true;

    if (producto) {

      this.modoEdicion = true;

      this.productoForm = {
        id: producto.id_inventario ?? null,

        nombre:
          producto.nombre_ingrediente ??
          producto.nombre ??
          '',

        categoria:
          producto.nombre_categoria ??
          producto.categoria ??
          '',

        stock:
          producto.cantidad_actual ??
          producto.stock ??
          '',

        unidad:
          producto.nombre_unidad ??
          producto.unidad ??
          '',

        porcentaje:
          producto.stock_minimo ??
          producto.porcentaje ??
          ''
      };

    } else {

      this.modoEdicion = false;

      this.productoForm = {
        id: null,
        nombre: '',
        categoria: '',
        stock: '',
        unidad: '',
        porcentaje: ''
      };
    }
  }

  // ==============================
  // CERRAR FORMULARIO
  // ==============================

  cerrarFormulario(): void {

    this.mostrarFormulario = false;
    this.modoEdicion = false;

    this.productoForm = {
      id: null,
      nombre: '',
      categoria: '',
      stock: '',
      unidad: '',
      porcentaje: ''
    };
  }

  // ==============================
  // BUSCAR INGREDIENTE
  // ==============================

  buscarIngrediente(): any {

    const nombreBuscado =
      this.productoForm.nombre
        .trim()
        .toLowerCase();

    return this.ingredientesList.find(
      (ingrediente: any) => {

        const nombre =
          ingrediente.nombre_ingrediente
            ?.toString()
            .trim()
            .toLowerCase();

        return nombre === nombreBuscado;
      }
    );
  }

  // ==============================
  // BUSCAR UNIDAD
  // ==============================

  buscarUnidad(): any {

    const unidadBuscada =
      this.productoForm.unidad
        .trim()
        .toLowerCase();

    return this.unidadesList.find(
      (unidad: any) => {

        const nombre =
          unidad.nombre
            ?.toString()
            .trim()
            .toLowerCase();

        const abreviatura =
          unidad.abreviatura
            ?.toString()
            .trim()
            .toLowerCase();

        return (
          nombre === unidadBuscada ||
          abreviatura === unidadBuscada
        );
      }
    );
  }

  // ==============================
  // GUARDAR PRODUCTO
  // ==============================

  guardarProducto(): void {

    // ------------------------------
    // VALIDACIONES
    // ------------------------------

    if (!this.productoForm.nombre.trim()) {

      this.sweetAlert.warning(
        'Datos incompletos',
        'Ingrese el nombre del producto.'
      );

      return;
    }

    if (!this.productoForm.stock.trim()) {

      this.sweetAlert.warning(
        'Datos incompletos',
        'Ingrese el stock.'
      );

      return;
    }

    if (!this.productoForm.unidad.trim()) {

      this.sweetAlert.warning(
        'Datos incompletos',
        'Ingrese la unidad de medida.'
      );

      return;
    }

    // ------------------------------
    // BUSCAR INGREDIENTE
    // ------------------------------

    const ingrediente = this.buscarIngrediente();

    console.log(
      'INGREDIENTE ENCONTRADO:',
      ingrediente
    );

    if (!ingrediente) {

      this.sweetAlert.warning(
        'Ingrediente no encontrado',
        `No existe un ingrediente llamado "${this.productoForm.nombre}".`
      );

      return;
    }

    // ------------------------------
    // BUSCAR UNIDAD
    // ------------------------------

    const unidad = this.buscarUnidad();

    console.log(
      'UNIDAD ENCONTRADA:',
      unidad
    );

    if (!unidad) {

      this.sweetAlert.warning(
        'Unidad no encontrada',
        `No existe la unidad "${this.productoForm.unidad}".`
      );

      return;
    }

    // ------------------------------
    // CONVERTIR DATOS
    // ------------------------------

    const datosInventario = {

      id_ingrediente:
        ingrediente.id_ingrediente,

      cantidad_actual:
        this.productoForm.stock.trim(),

      stock_minimo:
        this.productoForm.porcentaje.trim(),

      id_unidad_medida:
        unidad.id_unidad_medida

    };

    console.log(
      'DATOS CONVERTIDOS PARA DJANGO:',
      datosInventario
    );

    // ------------------------------
    // ACTUALIZAR
    // ------------------------------

    if (
      this.modoEdicion &&
      this.productoForm.id !== null
    ) {

      this.productoService
        .actualizarProducto(
          this.productoForm.id,
          datosInventario
        )
        .subscribe({

          next: (respuesta: any) => {

            console.log(
              'PRODUCTO ACTUALIZADO:',
              respuesta
            );

            this.sweetAlert.success(
              'Producto actualizado',
              'El producto se actualizó correctamente.'
            );

            this.cerrarFormulario();
            this.obtenerProductos();
          },

          error: (error: any) => {

            console.error(
              'ERROR ACTUALIZANDO:',
              error
            );

            console.error(
              'ERROR BACKEND:',
              error?.error
            );

            const detalle =
              error?.error
                ? JSON.stringify(error.error)
                : 'No se pudo actualizar el producto.';

            this.sweetAlert.warning(
              'Error al actualizar producto',
              detalle
            );
          }

        });

      return;
    }

    // ------------------------------
    // CREAR
    // ------------------------------

    this.productoService
      .crearProducto(datosInventario)
      .subscribe({

        next: (respuesta: any) => {

          console.log(
            'PRODUCTO CREADO:',
            respuesta
          );

          this.sweetAlert.success(
            'Producto creado',
            'El producto se registró correctamente.'
          );

          this.cerrarFormulario();
          this.obtenerProductos();
        },

        error: (error: any) => {

          console.error(
            'ERROR COMPLETO AL CREAR:',
            error
          );

          console.error(
            'RESPUESTA DEL BACKEND:',
            error?.error
          );

          const detalle =
            error?.error
              ? JSON.stringify(error.error)
              : 'No se pudo crear el producto.';

          this.sweetAlert.warning(
            'Error al crear producto',
            detalle
          );
        }

      });
  }

  // ==============================
  // EDITAR
  // ==============================

  editarProducto(producto: any): void {

    this.abrirFormulario(producto);
  }

  // ==============================
  // ELIMINAR
  // ==============================

  eliminarProducto(producto: any): void {

    const id = producto.id_inventario;

    const nombre =
      producto.nombre_ingrediente ??
      producto.nombre ??
      'Producto';

    if (!id) {

      this.sweetAlert.warning(
        'Error',
        'No se encontró el ID del inventario.'
      );

      return;
    }

    this.sweetAlert.confirm(
      '¿Eliminar producto?',
      `¿Está seguro de eliminar "${nombre}"?`
    )
    .then((resultado: any) => {

      const confirmado =
        resultado === true ||
        resultado?.isConfirmed === true ||
        resultado?.value === true;

      if (!confirmado) {
        return;
      }

      this.productoService
        .eliminarProducto(id)
        .subscribe({

          next: () => {

            this.sweetAlert.success(
              'Producto eliminado',
              'El producto se eliminó correctamente.'
            );

            this.obtenerProductos();
          },

          error: (error: any) => {

            console.error(
              'ERROR ELIMINANDO:',
              error
            );

            console.error(
              'ERROR BACKEND:',
              error?.error
            );

            const detalle =
              error?.error
                ? JSON.stringify(error.error)
                : 'No se pudo eliminar el producto.';

            this.sweetAlert.warning(
              'Error al eliminar',
              detalle
            );
          }

        });

    });
  }
}