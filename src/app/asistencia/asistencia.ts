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
  
  fecha_registro: string = new Date().toISOString().split('T')[0];
  id_usuario_manipuladorajefe: number = 1; 
  filtroJornada: string = 'todas';

  // Control de pestañas internas: 'asistencia' | 'grados'
  pestanaAsistenciaActiva: string = 'asistencia';

  // Control del formulario para crear / editar grados
  mostrarFormularioGrado = false;
  modoEdicionGrado = false;
  indiceEdicionGrado: number | null = null;

  gradoForm: any = {
    id_grado: null,
    nombre_grado: '',
    jornada: 'Mañana',
    ninos_esperados: 40,
    ninos_asistieron: 0
  };

  // Lista de grados de Primero a Once con cantidad esperada y asistentes
  grados = [
    { id_grado: 1, nombre_grado: 'Primero (1°)', jornada: 'Mañana', ninos_esperados: 40, ninos_asistieron: 30 },
    { id_grado: 2, nombre_grado: 'Segundo (2°)', jornada: 'Mañana', ninos_esperados: 38, ninos_asistieron: 25 },
    { id_grado: 3, nombre_grado: 'Tercero (3°)', jornada: 'Mañana', ninos_esperados: 35, ninos_asistieron: 32 },
    { id_grado: 4, nombre_grado: 'Cuarto (4°)', jornada: 'Mañana', ninos_esperados: 42, ninos_asistieron: 39 },
    { id_grado: 5, nombre_grado: 'Quinto (5°)', jornada: 'Mañana', ninos_esperados: 40, ninos_asistieron: 37 },
    { id_grado: 6, nombre_grado: 'Sexto (6°)', jornada: 'Tarde', ninos_esperados: 45, ninos_asistieron: 40 },
    { id_grado: 7, nombre_grado: 'Séptimo (7°)', jornada: 'Tarde', ninos_esperados: 42, ninos_asistieron: 38 },
    { id_grado: 8, nombre_grado: 'Octavo (8°)', jornada: 'Tarde', ninos_esperados: 38, ninos_asistieron: 34 },
    { id_grado: 9, nombre_grado: 'Noveno (9°)', jornada: 'Tarde', ninos_esperados: 36, ninos_asistieron: 30 },
    { id_grado: 10, nombre_grado: 'Décimo (10°)', jornada: 'Tarde', ninos_esperados: 35, ninos_asistieron: 33 },
    { id_grado: 11, nombre_grado: 'Once (11°)', jornada: 'Tarde', ninos_esperados: 34, ninos_asistieron: 30 }
  ];

  cambiarPestanaAsistencia(pestana: string): void {
    this.pestanaAsistenciaActiva = pestana;
    this.cerrarFormularioGrado();
  }

  // Filtrar según la jornada seleccionada
  get gradosFiltrados() {
    if (this.filtroJornada === 'todas') {
      return this.grados;
    }
    return this.grados.filter(g => g.jornada.toLowerCase() === this.filtroJornada.toLowerCase());
  }

  // Totales calculados para resumen
  get totalEsperados(): number {
    return this.gradosFiltrados.reduce((acc, g) => acc + (Number(g.ninos_esperados) || 0), 0);
  }

  get totalAsistieron(): number {
    return this.gradosFiltrados.reduce((acc, g) => acc + (Number(g.ninos_asistieron) || 0), 0);
  }

  get porcentajeGeneral(): number {
    if (this.totalEsperados === 0) return 0;
    return Math.round((this.totalAsistieron / this.totalEsperados) * 100);
  }

  // Gestión de Grados
  abrirFormularioGrado(grado: any = null): void {
    this.mostrarFormularioGrado = true;
    if (grado) {
      this.modoEdicionGrado = true;
      this.indiceEdicionGrado = this.grados.indexOf(grado);
      this.gradoForm = { ...grado };
    } else {
      this.modoEdicionGrado = false;
      this.indiceEdicionGrado = null;
      this.gradoForm = { id_grado: null, nombre_grado: '', jornada: 'Mañana', ninos_esperados: 35, ninos_asistieron: 0 };
    }
  }

  cerrarFormularioGrado(): void {
    this.mostrarFormularioGrado = false;
    this.modoEdicionGrado = false;
    this.indiceEdicionGrado = null;
    this.gradoForm = { id_grado: null, nombre_grado: '', jornada: 'Mañana', ninos_esperados: 35, ninos_asistieron: 0 };
  }

  guardarGrado(): void {
    if (!this.gradoForm.nombre_grado || !this.gradoForm.jornada) {
      alert('Por favor complete el nombre del grado y seleccione una jornada.');
      return;
    }

    if (this.modoEdicionGrado && this.indiceEdicionGrado !== null && this.indiceEdicionGrado > -1) {
      this.grados[this.indiceEdicionGrado] = { ...this.gradoForm };
      alert('Grado actualizado con éxito.');
    } else {
      const nuevoId = this.grados.length > 0 ? Math.max(...this.grados.map(g => g.id_grado)) + 1 : 1;
      this.grados.push({
        ...this.gradoForm,
        id_grado: nuevoId
      });
      alert('Grado creado correctamente.');
    }

    this.cerrarFormularioGrado();
  }

  eliminarGrado(grado: any): void {
    if (confirm(`¿Desea eliminar el ${grado.nombre_grado}?`)) {
      const index = this.grados.indexOf(grado);
      if (index > -1) {
        this.grados.splice(index, 1);
        alert('Grado eliminado con éxito.');
      }
    }
  }

  // Guardar asistencia diaria por grados
  guardarAsistencia() {
    const payloadAsistencia = {
      fecha: this.fecha_registro,
      id_usuario_manipuladorajefe: this.id_usuario_manipuladorajefe,
      total_esperados: this.totalEsperados,
      total_asistieron: this.totalAsistieron,
      registros: this.grados.map(g => ({
        id_grado: g.id_grado,
        nombre_grado: g.nombre_grado,
        jornada: g.jornada,
        ninos_esperados: Number(g.ninos_esperados) || 0,
        ninos_asistieron: Number(g.ninos_asistieron) || 0
      }))
    };

    console.log('Datos preparados para la BD (asistencia_diaria por grados):', payloadAsistencia);
    alert('¡Registro de asistencia diaria por grados guardado correctamente en el sistema!');
  }
}