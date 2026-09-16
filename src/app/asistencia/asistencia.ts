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
  
  // Campos de control general
  id_grado_seleccionado: string = 'todos';
  fecha_registro: string = new Date().toISOString().split('T')[0];
  id_usuario_manipuladorajefe: number = 1; 
  filtroBusqueda: string = '';

  // Control de pestañas internas: 'asistencia' | 'grados'
  pestanaAsistenciaActiva: string = 'asistencia';

  // Control del formulario para crear / editar grados
  mostrarFormularioGrado = false;
  modoEdicionGrado = false;
  indiceEdicionGrado: number | null = null;

  gradoForm: any = {
    id_grado: null,
    nombre_grado: '',
    jornada: 'Mañana'
  };

  // Catálogo de grados con su respectiva jornada
  grados = [
    { id_grado: 1, nombre_grado: 'Grado 101', jornada: 'Mañana' },
    { id_grado: 2, nombre_grado: 'Grado 102', jornada: 'Tarde' },
    { id_grado: 3, nombre_grado: 'Grado 201', jornada: 'Mañana' }
  ];

  // Lista de estudiantes fijos vinculados a los grados
  estudiantes = [
    { id: 1, nombre_completo: 'Carlos Andrés Pérez', id_grado: 1, asistio: true, ninos_presentes: 1, observaciones: 'Ninguna' },
    { id: 2, nombre_completo: 'María Alejandra Gómez', id_grado: 1, asistio: true, ninos_presentes: 1, observaciones: 'Ninguna' },
    { id: 3, nombre_completo: 'Juan José Rodríguez', id_grado: 2, asistio: false, ninos_presentes: 0, observaciones: 'Inasistencia injustificada' },
    { id: 4, nombre_completo: 'Ana Sofia Martínez', id_grado: 3, asistio: true, ninos_presentes: 1, observaciones: 'Llegó tarde' },
    { id: 5, nombre_completo: 'Luis Fernando Torres', id_grado: 3, asistio: true, ninos_presentes: 1, observaciones: 'Ninguna' }
  ];

  cambiarPestanaAsistencia(pestana: string): void {
    this.pestanaAsistenciaActiva = pestana;
    this.cerrarFormularioGrado();
  }

  // Función para traducir el ID del grado al formato legible "Nombre Grado (Jornada)"
  obtenerInfoGrado(idGrado: number): string {
    const gradoEncontrado = this.grados.find(g => g.id_grado == idGrado);
    return gradoEncontrado ? `${gradoEncontrado.nombre_grado} (${gradoEncontrado.jornada})` : 'Sin asignar';
  }

  // Filtrar según el grado seleccionado y la barra de búsqueda
  get estudiantesFiltrados() {
    return this.estudiantes.filter(est => {
      const coincideGrado = this.id_grado_seleccionado === 'todos' || est.id_grado.toString() === this.id_grado_seleccionado.toString();
      const coincideBusqueda = est.nombre_completo.toLowerCase().includes(this.filtroBusqueda.toLowerCase());
      return coincideGrado && coincideBusqueda;
    });
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
      this.gradoForm = { id_grado: null, nombre_grado: '', jornada: 'Mañana' };
    }
  }

  cerrarFormularioGrado(): void {
    this.mostrarFormularioGrado = false;
    this.modoEdicionGrado = false;
    this.indiceEdicionGrado = null;
    this.gradoForm = { id_grado: null, nombre_grado: '', jornada: 'Mañana' };
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
    const enUso = this.estudiantes.some(e => e.id_grado === grado.id_grado);
    if (enUso) {
      alert('No se puede eliminar este grado porque tiene estudiantes asociados.');
      return;
    }

    if (confirm(`¿Desea eliminar el grado ${grado.nombre_grado}?`)) {
      const index = this.grados.indexOf(grado);
      if (index > -1) {
        this.grados.splice(index, 1);
        alert('Grado eliminado con éxito.');
      }
    }
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
        id_estudiante: e.id,
        id_grado: e.id_grado,
        ninos_presentes: e.ninos_presentes,
        observaciones: e.observaciones
      }))
    };

    console.log('Datos preparados para la BD (asistencia_diaria):', payloadAsistencia);
    alert('¡Registro de asistencia diaria guardado correctamente en el sistema!');
  }
}