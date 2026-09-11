import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Categorias, Categoria } from '../services/categorias';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categorias.html',
  styleUrl: './categorias.css',
})
export class CategoriasComponent implements OnInit {

  categorias: Categoria[] = [];
  nombre_categoria: string = '';

  editando: boolean = false;
  idEditando: number | null = null;
  cargando: boolean = false;

  alerta: { mensaje: string; tipo: 'success' | 'error' | 'info' } | null = null;

  constructor(private categoriasService: Categorias) {}

  ngOnInit(): void {
    this.obtenerCategorias();
  }

  mostrarAlerta(mensaje: string, tipo: 'success' | 'error' | 'info' = 'success'): void {
    this.alerta = { mensaje, tipo };
    setTimeout(() => {
      if (this.alerta?.mensaje === mensaje) {
        this.alerta = null;
      }
    }, 4000);
  }

  obtenerCategorias(): void {
    this.cargando = true;
    this.categoriasService.obtenerCategorias().subscribe({
      next: (data) => {
        this.categorias = data;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al obtener categorías:', error);
        this.cargando = false;
        this.mostrarAlerta('No se pudieron sincronizar las categorías.', 'error');
      }
    });
  }

  guardarCategoria(): void {
    if (!this.nombre_categoria.trim()) {
      this.mostrarAlerta('Por favor, ingresa el nombre de la categoría.', 'error');
      return;
    }

    const categoria: Categoria = {
      nombre_categoria: this.nombre_categoria.trim()
    };

    this.categoriasService.crearCategoria(categoria).subscribe({
      next: () => {
        this.mostrarAlerta('¡Categoría registrada exitosamente con color institucional!', 'success');
        this.nombre_categoria = '';
        this.obtenerCategorias();
      },
      error: (error) => {
        console.error('Error al crear categoría:', error);
        this.mostrarAlerta('Error al guardar la categoría.', 'error');
      }
    });
  }

  editarCategoria(categoria: Categoria): void {
    this.nombre_categoria = categoria.nombre_categoria;
    this.idEditando = categoria.id_categoria_inventario!;
    this.editando = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  actualizarCategoria(): void {
    if (!this.nombre_categoria.trim() || this.idEditando === null) {
      this.mostrarAlerta('Por favor, ingresa un nombre válido.', 'error');
      return;
    }

    const categoria: Categoria = {
      nombre_categoria: this.nombre_categoria.trim()
    };

    this.categoriasService.editarCategoria(
      this.idEditando,
      categoria
    ).subscribe({
      next: () => {
        this.mostrarAlerta('Categoría actualizada correctamente.', 'success');
        this.cancelarEdicion();
        this.obtenerCategorias();
      },
      error: (error) => {
        console.error('Error al actualizar categoría:', error);
        this.mostrarAlerta('Error al actualizar la categoría.', 'error');
      }
    });
  }

  eliminarCategoria(id: number): void {
    if (!confirm('¿Estás seguro de que deseas eliminar esta categoría?')) {
      return;
    }

    this.categoriasService.eliminarCategoria(id).subscribe({
      next: () => {
        this.mostrarAlerta('Categoría eliminada del sistema.', 'info');
        this.obtenerCategorias();
      },
      error: (error) => {
        console.error('Error al eliminar categoría:', error);
        this.mostrarAlerta('Error al eliminar la categoría.', 'error');
      }
    });
  }

  cancelarEdicion(): void {
    this.nombre_categoria = '';
    this.idEditando = null;
    this.editando = false;
  }
}