import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-asistencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asistencia.html',
  styleUrls: ['./asistencia.css']
})
export class AsistenciaComponent {
  
  // Campos basados en la tabla asistencia_diaria y grados
  id_grado_seleccionado: string = 'todos';
  fecha_registro: string = new Date().toISOString().split('T')[0];
  id_usuario_manipuladorajefe: number = 1; // ID del usuario logueado actualmente

  // Lista simulada de grados (relación con la tabla 'grados')
  grados = [
    { id_grado: 1, nombre_grado: 'Grado 101' },
    { id_grado: 2, nombre_grado: 'Grado 102' },
    { id_grado: 3, nombre_grado: 'Grado 201' }
  ];

  // Lista de estudiantes que mapean con la asistencia diaria
  estudiantes = [
    { id: 1, nombre_completo: 'Carlos Andrés Pérez', id_grado: 1, asistio: true, ninos_presentes: 1, observaciones: 'Ninguna' },
    { id: 2, nombre_completo: 'María Alejandra Gómez', id_grado: 1, asistio: true, ninos_presentes: 1, observaciones: 'Ninguna' },
    { id: 3, nombre_completo: 'Juan José Rodríguez', id_grado: 2, asistio: false, ninos_presentes: 0, observaciones: 'Inasistencia injustificada' },
    { id: 4, nombre_completo: 'Ana Sofia Martínez', id_grado: 3, asistio: true, ninos_presentes: 1, observaciones: 'Llegó tarde' },
    { id: 5, nombre_completo: 'Luis Fernando Torres', id_grado: 3, asistio: true, ninos_presentes: 1, observaciones: 'Ninguna' }
  ];

  filtroBusqueda: string = '';

  // Filtrar según el grado seleccionado y la barra de búsqueda
  get estudiantesFiltrados() {
    return this.estudiantes.filter(est => {
      const coincideGrado = this.id_grado_seleccionado === 'todos' || est.id_grado.toString() === this.id_grado_seleccionado.toString();
      const coincideBusqueda = est.nombre_completo.toLowerCase().includes(this.filtroBusqueda.toLowerCase());
      return coincideGrado && coincideBusqueda;
    });
  }

  // Cambiar asistencia y actualizar el indicador ninos_presentes (1 o 0)
  toggleAsistencia(estudiante: any) {
    estudiante.asistio = !estudiante.asistio;
    estudiante.ninos_presentes = estudiante.asistio ? 1 : 0;
  }

  // Guardar datos listos para enviar a tu API de Django (tabla asistencia_diaria)
  guardarAsistencia() {
    const payloadAsistencia = {
      fecha: this.fecha_registro,
      id_usuario_manipuladorajefe: this.id_usuario_manipuladorajefe,
      registros: this.estudiantes.map(e => ({
        id_grado: e.id_grado,
        ninos_presentes: e.ninos_presentes,
        observaciones: e.observaciones
      }))
    };

    console.log('Datos preparados para la BD (asistencia_diaria):', payloadAsistencia);
    alert('¡Registro de asistencia diaria guardado correctamente en el sistema!');
  }
}