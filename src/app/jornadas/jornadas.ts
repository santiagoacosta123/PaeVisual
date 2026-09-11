import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JornadasService } from '../services/jornadas';
import { Jornada } from '../models/jornada';

@Component({
  selector: 'app-jornadas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './jornadas.html',
  styleUrl: './jornadas.css',
})
export class Jornadas implements OnInit {

  jornadas: Jornada[] = [];

  // Estado de edición inline
  idEditando: number | null = null;
  nombre_jornada: string = '';

  // Estado de creación inline
  creandoNuevo: boolean = false;
  nuevoNombre: string = '';

  cargando: boolean = false;

  constructor(private jornadasService: JornadasService) {}

  ngOnInit(): void {
    this.obtenerJornadas();
  }

  obtenerJornadas(): void {
    this.cargando = true;
    this.jornadasService.obtenerJornadas().subscribe({
      next: (data) => {
        this.jornadas = data;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al obtener jornadas:', error);
        this.cargando = false;
      }
    });
  }

  iniciarCreacion(): void {
    this.cancelarEdicion();
    this.creandoNuevo = true;
    this.nuevoNombre = '';
  }

  cancelarCreacion(): void {
    this.creandoNuevo = false;
    this.nuevoNombre = '';
  }

  guardarNuevaJornada(): void {
    if (!this.nuevoNombre.trim()) {
      alert('Ingresa el nombre de la jornada');
      return;
    }

    const nuevaJornada: Jornada = {
      nombre_jornada: this.nuevoNombre.trim()
    };

    this.jornadasService.crearJornada(nuevaJornada).subscribe({
      next: () => {
        this.creandoNuevo = false;
        this.nuevoNombre = '';
        this.obtenerJornadas();
      },
      error: (error) => {
        console.error('Error al crear jornada:', error);
      }
    });
  }

  editarJornada(jornada: Jornada): void {
    this.cancelarCreacion();
    this.idEditando = jornada.id_jornada!;
    this.nombre_jornada = jornada.nombre_jornada;
  }

  actualizarJornada(): void {
    if (!this.nombre_jornada.trim() || this.idEditando === null) {
      alert('Ingresa un nombre válido');
      return;
    }

    const jornadaActualizada: Jornada = {
      nombre_jornada: this.nombre_jornada.trim()
    };

    this.jornadasService.editarJornada(this.idEditando, jornadaActualizada).subscribe({
      next: () => {
        this.cancelarEdicion();
        this.obtenerJornadas();
      },
      error: (error) => {
        console.error('Error al actualizar jornada:', error);
      }
    });
  }

  eliminarJornada(id: number): void {
    if (!confirm('¿Estás seguro de que deseas eliminar esta jornada?')) {
      return;
    }

    this.jornadasService.eliminarJornada(id).subscribe({
      next: () => {
        this.obtenerJornadas();
      },
      error: (error) => {
        console.error('Error al eliminar jornada:', error);
      }
    });
  }

  cancelarEdicion(): void {
    this.idEditando = null;
    this.nombre_jornada = '';
  }
}

