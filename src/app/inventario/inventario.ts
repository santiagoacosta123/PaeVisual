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
  template: `
    <div style="background:#fff; border-radius:12px; padding:24px; border:1px solid #e0e0e0; box-shadow:0 2px 8px rgba(0,0,0,0.04);">

      <!-- Cabecera -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <div>
          <h2 style="margin:0; font-size:20px; font-weight:700; color:#333;">Inventario de Ingredientes</h2>
          <p style="margin:4px 0 0 0; font-size:13px; color:#777;">
            Control de insumos, categorías, unidades de medida y stock actual
          </p>
        </div>

        <button
          type="button"
          (click)="abrirModalNuevo()"
          style="background:#f4b41f; color:#333; font-weight:700; border:none; padding:10px 16px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:13px;">
          <span class="material-symbols-outlined" style="font-size:18px;">add</span>
          Nuevo Ingrediente
        </button>
      </div>

      <!-- Tabla -->
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">

          <thead>
            <tr style="background:#fafafa; border-bottom:2px solid #eee; color:#555;">
              <th style="padding:12px;">Imagen</th>
              <th style="padding:12px;">Ingrediente / Descripción</th>
              <th style="padding:12px;">Categoría</th>
              <th style="padding:12px;">Unidad de Medida</th>
              <th style="padding:12px;">Stock Actual</th>
              <th style="padding:12px; text-align:center;">Acciones</th>
            </tr>
          </thead>

          <tbody>

            <tr *ngFor="let item of listaInventario"
                style="border-bottom:1px solid #eee; color:#333;">

              <td style="padding:12px; width:60px;">
                <img
                  [src]="item.imagen || 'https://via.placeholder.com/150'"
                  alt="img"
                  style="width:45px; height:45px; border-radius:6px; object-fit:cover; border:1px solid #ddd;" />
              </td>

              <td style="padding:12px;">
                <div style="font-weight:600; color:#222;">
                  {{ item.nombre }}
                </div>

                <div style="font-size:11px; color:#666; max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  {{ item.descripcion }}
                </div>
              </td>

              <td style="padding:12px;">
                <span
                  style="background:#e3f2fd; color:#1565c0; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:600;">
                  {{ item.categoria_nombre }}
                </span>
              </td>

              <td style="padding:12px;">
                <span
                  style="background:#f5f5f5; color:#444; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:600;">
                  {{ item.unidad_nombre }}
                </span>
              </td>

              <td style="padding:12px; font-weight:700; color:#2e7d32;">
                {{ item.stock_actual }}
              </td>

              <td style="padding:12px; text-align:center; white-space:nowrap;">

                <button
                  type="button"
                  (click)="abrirModalEditar(item)"
                  style="background:none; border:none; cursor:pointer; color:#1976d2; margin-right:8px;"
                  title="Editar">

                  <span class="material-symbols-outlined" style="font-size:18px;">
                    edit
                  </span>

                </button>

                <button
                  type="button"
                  (click)="eliminarIngrediente(item.id_inventario!)"
                  style="background:none; border:none; cursor:pointer; color:#e53935;"
                  title="Eliminar">

                  <span class="material-symbols-outlined" style="font-size:18px;">
                    delete
                  </span>

                </button>

              </td>

            </tr>

            <tr *ngIf="listaInventario.length === 0">

              <td
                colspan="6"
                style="text-align:center; padding:24px; color:#777;">

                No hay ingredientes registrados en el inventario.

              </td>

            </tr>

          </tbody>
        </table>
      </div>

      <!-- Modal -->
      <div
        *ngIf="mostrarModal"
        style="position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:1000;">

        <div
          style="background:#fff; width:500px; border-radius:12px; padding:24px; box-shadow:0 8px 24px rgba(0,0,0,0.15); max-height:90vh; overflow-y:auto;">

          <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:700; color:#333;">
            {{ esEdicion ? 'Editar Ingrediente' : 'Registrar Nuevo Ingrediente' }}
          </h3>

          <div style="display:flex; flex-direction:column; gap:12px;">

            <div>
              <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">
                Nombre del Ingrediente
              </label>

              <input
                type="text"
                [(ngModel)]="formIngrediente.nombre"
                placeholder="Ej. Lentejas"
                style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px;" />
            </div>

            <div>
              <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">
                Descripción
              </label>

              <textarea
                [(ngModel)]="formIngrediente.descripcion"
                rows="2"
                placeholder="Detalles del insumo..."
                style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px; resize:none;">
              </textarea>
            </div>

            <div>
              <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">
                URL de la Imagen
              </label>

              <input
                type="text"
                [(ngModel)]="formIngrediente.imagen"
                placeholder="https://..."
                style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px;" />
            </div>

            <div style="display:flex; gap:12px;">

              <div style="flex:1;">

                <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">
                  Categoría
                </label>

                <select
                  [(ngModel)]="formIngrediente.id_categoria"
                  style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px;">

                  <option
                    *ngFor="let cat of categorias"
                    [value]="cat.id_categoria_inventario">

                    {{ cat.nombre_categoria }}

                  </option>

                </select>

              </div>

              <div style="flex:1;">

                <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">
                  Unidad de Medida
                </label>

                <select
                  [(ngModel)]="formIngrediente.id_unidad_medida"
                  style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px;">

                  <option
                    *ngFor="let und of unidadesMedida"
                    [value]="und.id_unidad_medida">

                    {{ und.nombre_unidad }} ({{ und.abreviatura }})

                  </option>

                </select>

              </div>

            </div>

            <div>

              <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">
                Stock Actual
              </label>

              <input
                type="number"
                [(ngModel)]="formIngrediente.stock_actual"
                style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px;" />

            </div>

          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">

            <button
              type="button"
              (click)="mostrarModal = false"
              style="background:#f1f1f1; border:none; padding:8px 16px; border-radius:6px; font-weight:600; cursor:pointer; font-size:13px; color:#555;">

              Cancelar

            </button>

            <button
              type="button"
              (click)="guardarIngrediente()"
              style="background:#f4b41f; border:none; padding:8px 16px; border-radius:6px; font-weight:700; cursor:pointer; font-size:13px; color:#333;">

              Guardar

            </button>

          </div>

        </div>

      </div>

    </div>
  `
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

    console.log('Formulario:', this.formIngrediente);

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

}