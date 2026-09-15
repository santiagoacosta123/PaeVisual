import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
}

interface UnidadMedida {
  id_unidad: number;
  nombre_unidad: string;
  abreviatura: string;
}

interface Ingrediente {
  id_ingrediente?: number;
  nombre: string;
  descripcion: string;
  imagen: string;
  id_categoria: number;
  categoria_nombre?: string;
  id_unidad_medida: number;
  unidad_nombre?: string;
  stock_actual: number;
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
          <p style="margin:4px 0 0 0; font-size:13px; color:#777;">Control de insumos, categorías, unidades de medida y stock actual</p>
        </div>
        <button type="button" (click)="abrirModalNuevo()"
          style="background:#f4b41f; color:#333; font-weight:700; border:none; padding:10px 16px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:13px;">
          <span class="material-symbols-outlined" style="font-size:18px;">add</span>
          Nuevo Ingrediente
        </button>
      </div>

      <!-- Tabla de Inventario -->
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
            <tr *ngFor="let item of listaInventario" style="border-bottom:1px solid #eee; color:#333;">
              <td style="padding:12px; width:60px;">
                <img [src]="item.imagen || 'https://via.placeholder.com/150'" alt="img" style="width:45px; height:45px; border-radius:6px; object-fit:cover; border:1px solid #ddd;" />
              </td>
              <td style="padding:12px;">
                <div style="font-weight:600; color:#222;">{{ item.nombre }}</div>
                <div style="font-size:11px; color:#666; max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ item.descripcion }}</div>
              </td>
              <td style="padding:12px;">
                <span style="background:#e3f2fd; color:#1565c0; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:600;">
                  {{ item.categoria_nombre }}
                </span>
              </td>
              <td style="padding:12px;">
                <span style="background:#f5f5f5; color:#444; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:600;">
                  {{ item.unidad_nombre }}
                </span>
              </td>
              <td style="padding:12px; font-weight:700; color:#2e7d32;">{{ item.stock_actual }}</td>
              <td style="padding:12px; text-align:center; white-space:nowrap;">
                <button type="button" (click)="abrirModalEditar(item)" style="background:none; border:none; cursor:pointer; color:#1976d2; margin-right:8px;" title="Editar">
                  <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
                </button>
                <button type="button" (click)="eliminarIngrediente(item.id_ingrediente!)" style="background:none; border:none; cursor:pointer; color:#e53935;" title="Eliminar">
                  <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
                </button>
              </td>
            </tr>
            <tr *ngIf="listaInventario.length === 0">
              <td colspan="6" style="text-align:center; padding:24px; color:#777;">No hay ingredientes registrados en el inventario.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal CRUD (Crear / Editar) -->
      <div *ngIf="mostrarModal" style="position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:1000;">
        <div style="background:#fff; width:500px; border-radius:12px; padding:24px; box-shadow:0 8px 24px rgba(0,0,0,0.15); max-height:90vh; overflow-y:auto;">
          <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:700; color:#333;">
            {{ esEdicion ? 'Editar Ingrediente' : 'Registrar Nuevo Ingrediente' }}
          </h3>
          
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">Nombre del Ingrediente</label>
              <input type="text" [(ngModel)]="formIngrediente.nombre" placeholder="Ej. Lentejas" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px;" />
            </div>

            <div>
              <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">Descripción</label>
              <textarea [(ngModel)]="formIngrediente.descripcion" rows="2" placeholder="Detalles del insumo..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px; resize:none;"></textarea>
            </div>

            <div>
              <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">URL de la Imagen</label>
              <input type="text" [(ngModel)]="formIngrediente.imagen" placeholder="https://..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px;" />
            </div>

            <div style="display:flex; gap:12px;">
              <div style="flex:1;">
                <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">Categoría</label>
                <select [(ngModel)]="formIngrediente.id_categoria" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px;">
                  <option *ngFor="let cat of categorias" [value]="cat.id_categoria">{{ cat.nombre_categoria }}</option>
                </select>
              </div>
              <div style="flex:1;">
                <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">Unidad de Medida</label>
                <select [(ngModel)]="formIngrediente.id_unidad_medida" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px;">
                  <option *ngFor="let und of unidadesMedida" [value]="und.id_unidad">{{ und.nombre_unidad }} ({{ und.abreviatura }})</option>
                </select>
              </div>
            </div>

            <div>
              <label style="font-size:11px; font-weight:600; color:#666; display:block; margin-bottom:4px;">Stock Actual</label>
              <input type="number" [(ngModel)]="formIngrediente.stock_actual" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:13px;" />
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
            <button type="button" (click)="mostrarModal = false" style="background:#f1f1f1; border:none; padding:8px 16px; border-radius:6px; font-weight:600; cursor:pointer; font-size:13px; color:#555;">Cancelar</button>
            <button type="button" (click)="guardarIngrediente()" style="background:#f4b41f; border:none; padding:8px 16px; border-radius:6px; font-weight:700; cursor:pointer; font-size:13px; color:#333;">Guardar</button>
          </div>
        </div>
      </div>

    </div>
  `
})
export class InventarioComponent {
  mostrarModal = false;
  esEdicion = false;

  categorias: Categoria[] = [
    { id_categoria: 1, nombre_categoria: 'Granos y Cereales' },
    { id_categoria: 2, nombre_categoria: 'Proteínas / Carnes' },
    { id_categoria: 3, nombre_categoria: 'Aceites y Grasas' },
    { id_categoria: 4, nombre_categoria: 'Frutas y Verduras' }
  ];

  unidadesMedida: UnidadMedida[] = [
    { id_unidad: 1, nombre_unidad: 'Kilogramos', abreviatura: 'kg' },
    { id_unidad: 2, nombre_unidad: 'Gramos', abreviatura: 'g' },
    { id_unidad: 3, nombre_unidad: 'Litros', abreviatura: 'L' },
    { id_unidad: 4, nombre_unidad: 'Unidades', abreviatura: 'und' }
  ];

  listaInventario: Ingrediente[] = [
    {
      id_ingrediente: 1,
      nombre: 'Arroz Diana',
      descripcion: 'Arroz blanco de primera calidad, grano entero.',
      imagen: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80',
      id_categoria: 1,
      categoria_nombre: 'Granos y Cereales',
      id_unidad_medida: 1,
      unidad_nombre: 'Kilogramos (kg)',
      stock_actual: 150
    },
    {
      id_ingrediente: 2,
      nombre: 'Pollo Despresado',
      descripcion: 'Muslo y pechuga congelados para preparaciones del PAE.',
      imagen: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=300&q=80',
      id_categoria: 2,
      categoria_nombre: 'Proteínas / Carnes',
      id_unidad_medida: 1,
      unidad_nombre: 'Kilogramos (kg)',
      stock_actual: 80
    }
  ];

  formIngrediente: Ingrediente = {
    nombre: '',
    descripcion: '',
    imagen: '',
    id_categoria: 1,
    id_unidad_medida: 1,
    stock_actual: 0
  };

  abrirModalNuevo() {
    this.esEdicion = false;
    this.formIngrediente = {
      nombre: '',
      descripcion: '',
      imagen: '',
      id_categoria: this.categorias[0]?.id_categoria || 1,
      id_unidad_medida: this.unidadesMedida[0]?.id_unidad || 1,
      stock_actual: 0
    };
    this.mostrarModal = true;
  }

  abrirModalEditar(item: Ingrediente) {
    this.esEdicion = true;
    this.formIngrediente = { ...item };
    this.mostrarModal = true;
  }

  guardarIngrediente() {
    if (!this.formIngrediente.nombre.trim()) {
      alert('Por favor ingresa el nombre del ingrediente.');
      return;
    }

    const catObj = this.categorias.find(c => c.id_categoria == Number(this.formIngrediente.id_categoria));
    const undObj = this.unidadesMedida.find(u => u.id_unidad == Number(this.formIngrediente.id_unidad_medida));

    const catNombre = catObj ? catObj.nombre_categoria : 'Sin categoría';
    const undNombre = undObj ? `${undObj.nombre_unidad} (${undObj.abreviatura})` : 'Unidad';

    if (this.esEdicion) {
      const index = this.listaInventario.findIndex(i => i.id_ingrediente === this.formIngrediente.id_ingrediente);
      if (index !== -1) {
        this.listaInventario[index] = {
          ...this.formIngrediente,
          categoria_nombre: catNombre,
          unidad_nombre: undNombre
        };
      }
    } else {
      const nuevoId = this.listaInventario.length > 0 
        ? Math.max(...this.listaInventario.map(i => i.id_ingrediente || 0)) + 1 
        : 1;

      this.listaInventario.push({
        ...this.formIngrediente,
        id_ingrediente: nuevoId,
        categoria_nombre: catNombre,
        unidad_nombre: undNombre
      });
    }

    this.mostrarModal = false;
  }

  eliminarIngrediente(id: number) {
    if (confirm('¿Estás seguro de eliminar este ingrediente del inventario?')) {
      this.listaInventario = this.listaInventario.filter(i => i.id_ingrediente !== id);
    }
  }
}