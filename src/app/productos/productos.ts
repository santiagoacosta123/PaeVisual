import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SweetAlertService } from '../sweet-alert.service';
import { ProductoService } from '../services/producto.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

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
  itemSeleccionado: any = null;
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
    id_ingrediente: '',
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

  constructor(
    private sweetAlert: SweetAlertService,
    private cdr: ChangeDetectorRef,
    private productoService: ProductoService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    forkJoin({
      ingredientes: this.productoService.getIngredientes().pipe(catchError(() => of([]))),
      categorias: this.productoService.getCategorias().pipe(catchError(() => of([]))),
      unidades: this.productoService.getUnidades().pipe(catchError(() => of([]))),
      inventario: this.productoService.getProductos().pipe(catchError(() => of([]))),
      movimientos: this.productoService.getMovimientos().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res: any) => {
        // Asignar catálogos
        this.ingredientesDisponibles = Array.isArray(res.ingredientes) ? res.ingredientes : (res.ingredientes.results || []);
        this.categoriasInventario = Array.isArray(res.categorias) ? res.categorias : (res.categorias.results || []);
        this.unidadesMedida = Array.isArray(res.unidades) ? res.unidades : (res.unidades.results || []);

        const rawInventario = Array.isArray(res.inventario) ? res.inventario : (res.inventario.results || []);
        const rawMovimientos = Array.isArray(res.movimientos) ? res.movimientos : (res.movimientos.results || []);

        // Mapear inventario con nombres de ingredientes, categorías y unidades
        this.inventario = rawInventario.map((inv: any) => {
          const ing = this.ingredientesDisponibles.find(i => i.id_ingrediente == inv.id_ingrediente);
          const cat = ing ? this.categoriasInventario.find(c => c.id_categoria_inventario == ing.id_categoria_inventario) : null;
          const um = this.unidadesMedida.find(u => u.id_unidad_medida == inv.id_unidad_medida);

          return {
            ...inv,
            nombre_ingrediente: ing ? ing.nombre_ingrediente : 'Desconocido',
            marca_ingrediente: ing ? ing.marca_ingrediente : '',
            nombre_categoria: cat ? cat.nombre_categoria : 'Sin categoría',
            nombre_unidad: um ? um.nombre_unidad : ''
          };
        });

        // Mapear movimientos
        this.movimientosInventario = rawMovimientos.map((mov: any) => {
          const ing = this.ingredientesDisponibles.find(i => i.id_ingrediente == mov.id_ingrediente);
          const um = this.unidadesMedida.find(u => u.id_unidad_medida == mov.id_unidad_medida);

          return {
            ...mov,
            nombre_ingrediente: ing ? ing.nombre_ingrediente : 'Desconocido',
            nombre_unidad: um ? um.nombre_unidad : ''
          };
        });

        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando los datos del módulo productos:', err)
    });
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

  seleccionarPestana(pestana: string): void {
    this.pestanaActiva = pestana;
    this.filtroBusqueda = ''; // Limpia la búsqueda al cambiar de pestaña
    this.cerrarFormulario();
    this.cerrarDetalles();
    this.cdr.detectChanges();
  }

  cambiarPestana(pestana: string): void {
    this.seleccionarPestana(pestana);
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
    this.cdr.detectChanges();
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.modoEdicion = false;
    this.editandoId = null;
    this.indiceEdicion = null;
    this.limpiarFormularios();
    this.cdr.detectChanges();
  }

  limpiarFormularios(): void {
    this.itemForm = {
      id_inventario: null,
      id_ingrediente: '',
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

  guardarInventario(): void {
    if (this.pestanaActiva === 'inventario') {
      if (!this.itemForm.id_ingrediente || this.itemForm.cantidad_actual === null) {
        this.sweetAlert.warning('Campos incompletos', 'Llene los campos obligatorios del inventario.');
        return;
      }

      if (this.modoEdicion && this.itemForm.id_inventario) {
        this.productoService.actualizarProducto(this.itemForm.id_inventario, this.itemForm).subscribe({
          next: () => {
            this.sweetAlert.success('Actualizado', 'Insumo modificado con éxito.');
            this.cargarDatos();
            this.cerrarFormulario();
          },
          error: (err) => this.sweetAlert.error('Error', 'No se pudo actualizar el inventario.')
        });
      } else {
        this.productoService.crearProducto(this.itemForm).subscribe({
          next: () => {
            this.sweetAlert.success('Guardado', 'Nuevo insumo agregado al inventario.');
            this.cargarDatos();
            this.cerrarFormulario();
          },
          error: (err) => this.sweetAlert.error('Error', 'No se pudo crear el insumo.')
        });
      }
    } else if (this.pestanaActiva === 'movimientos') {
      if (!this.movimientoForm.id_ingrediente || !this.movimientoForm.cantidad) {
        this.sweetAlert.warning('Campos incompletos', 'Complete los datos del movimiento.');
        return;
      }

      if (this.modoEdicion && this.movimientoForm.id_movimiento_inventario) {
        this.sweetAlert.warning('No soportado', 'Editar movimientos directamente no está permitido por seguridad. Considere anular y crear uno nuevo.');
      } else {
        this.productoService.crearMovimiento(this.movimientoForm).subscribe({
          next: () => {
            this.sweetAlert.success('Registrado', 'Movimiento de inventario guardado.');
            this.cargarDatos();
            this.cerrarFormulario();
          },
          error: (err) => this.sweetAlert.error('Error', 'No se pudo registrar el movimiento.')
        });
      }
    } else if (this.pestanaActiva === 'gramajes') {
      this.sweetAlert.success('Simulado', 'La funcionalidad de gramajes será conectada al backend próximamente.');
      this.cerrarFormulario();
    }
  }

  eliminarItem(lista: any[], item: any): void {
    this.sweetAlert.confirm('¿Eliminar?', '¿Desea eliminar este registro?', 'Sí, eliminar').then((res: any) => {
      if (res.isConfirmed) {
        if (this.pestanaActiva === 'inventario') {
          this.productoService.eliminarProducto(item.id_inventario).subscribe({
            next: () => {
              this.sweetAlert.success('Eliminado', 'El registro fue borrado.');
              this.cargarDatos();
            },
            error: () => this.sweetAlert.error('Error', 'No se pudo eliminar el inventario.')
          });
        } else if (this.pestanaActiva === 'movimientos') {
          this.productoService.eliminarMovimiento(item.id_movimiento_inventario).subscribe({
            next: () => {
              this.sweetAlert.success('Eliminado', 'El movimiento fue borrado.');
              this.cargarDatos();
            },
            error: () => this.sweetAlert.error('Error', 'No se pudo eliminar el movimiento.')
          });
        } else {
          // gramajes simulado
          const index = lista.indexOf(item);
          if (index > -1) {
            lista.splice(index, 1);
          }
          this.sweetAlert.success('Eliminado', 'Registro borrado con éxito.');
          this.cdr.detectChanges();
        }
      }
    });
  }
}