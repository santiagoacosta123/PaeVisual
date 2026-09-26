import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-gestion-contratos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contratos.html',
  styleUrls: ['./contratos.css']
})
export class ContratosComponent {
  pestanaActiva: string = 'contratos';

  // Barras de búsqueda independientes
  filtroBusquedaContratos: string = '';
  filtroBusquedaTareas: string = '';
  filtroBusquedaJornadas: string = '';
  filtroBusquedaSecciones: string = '';

  // Estados de modales
  modalContratoAbierto: boolean = false;
  modoEdicionContrato: boolean = false;

  modalTareaAbierto: boolean = false;
  modoEdicionTarea: boolean = false;

  modalJornadaAbierto: boolean = false;
  modoEdicionJornada: boolean = false;

  modalSeccionAbierto: boolean = false;
  modoEdicionSeccion: boolean = false;

  contratoActual: any = { 
    id: null, 
    codigo: '', 
    institucion: '', 
    fechaInicio: '2026-01-01', 
    fechaFin: '2026-12-31', 
    estado: 'Activo' 
  };

  tareaActual: any = {
    id: null,
    tarea: '',
    responsable: '',
    fechaLimite: '',
    estado: 'Pendiente'
  };

  jornadaActual: any = {
    id: null,
    nombre: '',
    estado: 'Activa'
  };

  seccionActual: any = {
    id: null,
    nombre: '',
    jornada: '',
    estado: 'Activa'
  };

  // Lista de contratos
  contratos = [
    { 
      id: 1, 
      codigo: 'COR-2026-001', 
      institucion: 'I.E. San Agustín', 
      fechaInicio: '2026-01-01', 
      fechaFin: '2026-12-31', 
      estado: 'Activo',
      expandido: false,
      tareas: [
        { id: 101, tarea: 'Supervisión de raciones PAE', responsable: 'Carlos Pérez', fechaLimite: '2026-04-10', estado: 'Pendiente' },
        { id: 102, tarea: 'Revisión de inventario inicial', responsable: 'Ana Gómez', fechaLimite: '2026-01-05', estado: 'Completado' }
      ]
    },
    { 
      id: 2, 
      codigo: 'COR-2026-002', 
      institucion: 'I.E. Simón Bolívar', 
      fechaInicio: '2026-02-15', 
      fechaFin: '2026-11-15', 
      estado: 'Activo',
      expandido: false,
      tareas: [
        { id: 103, tarea: 'Auditoría de entregas de alimentos', responsable: 'Luisa Martínez', fechaLimite: '2026-05-20', estado: 'En proceso' }
      ]
    }
  ];

  jornadas = [
    { id: 1, nombre: 'Mañana', estado: 'Activa' },
    { id: 2, nombre: 'Tarde', estado: 'Activa' }
  ];

  secciones = [
    { id: 1, nombre: 'Desayuno', jornada: 'Mañana', estado: 'Activa' },
    { id: 2, nombre: 'Almuerzo', jornada: 'Tarde', estado: 'Activa' },
    { id: 3, nombre: 'Merienda', jornada: 'Mañana', estado: 'Activa' },
    { id: 4, nombre: 'Refrigerio', jornada: 'Tarde', estado: 'Activa' }
  ];

  // Getter para todas las tareas centralizadas de la pestaña Asignar Tareas
  get todasLasTareas() {
    let lista: any[] = [];
    this.contratos.forEach(c => {
      c.tareas.forEach(t => {
        lista.push({ ...t, institucion: c.institucion, contratoCodigo: c.codigo });
      });
    });
    return lista;
  }

  get tareasFiltradas() {
    return this.todasLasTareas.filter(t => 
      t.tarea.toLowerCase().includes(this.filtroBusquedaTareas.toLowerCase()) ||
      t.responsable.toLowerCase().includes(this.filtroBusquedaTareas.toLowerCase()) ||
      t.institucion.toLowerCase().includes(this.filtroBusquedaTareas.toLowerCase())
    );
  }

  get contratosFiltrados() {
    return this.contratos.filter(c => 
      c.codigo.toLowerCase().includes(this.filtroBusquedaContratos.toLowerCase()) ||
      c.institucion.toLowerCase().includes(this.filtroBusquedaContratos.toLowerCase())
    );
  }

  get jornadasFiltradas() {
    return this.jornadas.filter(j =>
      j.nombre.toLowerCase().includes(this.filtroBusquedaJornadas.toLowerCase())
    );
  }

  get seccionesFiltradas() {
    return this.secciones.filter(s =>
      s.nombre.toLowerCase().includes(this.filtroBusquedaSecciones.toLowerCase()) ||
      s.jornada.toLowerCase().includes(this.filtroBusquedaSecciones.toLowerCase())
    );
  }

  seleccionarPestana(pestana: string) {
    this.pestanaActiva = pestana;
  }

  toggleExpandir(contrato: any) {
    contrato.expandido = !contrato.expandido;
  }

  // --- MODAL CONTRATOS ---
  abrirModalContrato(contrato?: any) {
    if (contrato) {
      this.modoEdicionContrato = true;
      this.contratoActual = { ...contrato };
    } else {
      this.modoEdicionContrato = false;
      this.contratoActual = { 
        id: Date.now(), 
        codigo: 'COR-2026-00' + (this.contratos.length + 1), 
        institucion: '', 
        fechaInicio: '2026-01-01', 
        fechaFin: '2026-12-31', 
        estado: 'Activo',
        expandido: false,
        tareas: []
      };
    }
    this.modalContratoAbierto = true;
  }

  cerrarModalContrato() {
    this.modalContratoAbierto = false;
  }

  guardarContrato() {
    if (!this.contratoActual.institucion) {
      alert('Por favor, ingresa el nombre de la institución.');
      return;
    }
    if (this.modoEdicionContrato) {
      const index = this.contratos.findIndex(c => c.id === this.contratoActual.id);
      if (index !== -1) {
        this.contratos[index] = { ...this.contratoActual, tareas: this.contratos[index].tareas, expandido: this.contratos[index].expandido };
      }
    } else {
      this.contratos.push({ ...this.contratoActual });
    }
    this.cerrarModalContrato();
  }

  eliminarContrato(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar este contrato?')) {
      this.contratos = this.contratos.filter(c => c.id !== id);
    }
  }

  // --- MODAL TAREAS ---
  abrirModalTarea(tarea?: any) {
    if (tarea) {
      this.modoEdicionTarea = true;
      this.tareaActual = { ...tarea };
    } else {
      this.modoEdicionTarea = false;
      this.tareaActual = {
        id: Date.now(),
        tarea: '',
        responsable: '',
        fechaLimite: new Date().toISOString().split('T')[0],
        estado: 'Pendiente',
        contratoId: this.contratos.length > 0 ? this.contratos[0].id : null
      };
    }
    this.modalTareaAbierto = true;
  }

  cerrarModalTarea() {
    this.modalTareaAbierto = false;
  }

  guardarTarea() {
    if (!this.tareaActual.tarea || !this.tareaActual.responsable) {
      alert('Por favor, completa la descripción de la tarea y el responsable.');
      return;
    }

    if (this.modoEdicionTarea) {
      // Buscar y actualizar dentro del contrato correspondiente
      for (let c of this.contratos) {
        const tIndex = c.tareas.findIndex((t: any) => t.id === this.tareaActual.id);
        if (tIndex !== -1) {
          c.tareas[tIndex] = { ...this.tareaActual };
          break;
        }
      }
    } else {
      // Agregar al contrato seleccionado o al primero por defecto
      const contratoDestino = this.contratos.find(c => c.id == Number(this.tareaActual.contratoId)) || this.contratos[0];
      if (contratoDestino) {
        contratoDestino.tareas.push({ ...this.tareaActual });
      }
    }
    this.cerrarModalTarea();
  }

  eliminarTarea(idTarea: number) {
    if (confirm('¿Estás seguro de eliminar esta tarea?')) {
      for (let c of this.contratos) {
        c.tareas = c.tareas.filter((t: any) => t.id !== idTarea);
      }
    }
  }

  // --- MODAL JORNADAS ---
  abrirModalJornada(jornada?: any) {
    if (jornada) {
      this.modoEdicionJornada = true;
      this.jornadaActual = { ...jornada };
    } else {
      this.modoEdicionJornada = false;
      this.jornadaActual = { id: Date.now(), nombre: '', estado: 'Activa' };
    }
    this.modalJornadaAbierto = true;
  }

  cerrarModalJornada() {
    this.modalJornadaAbierto = false;
  }

  guardarJornada() {
    if (!this.jornadaActual.nombre) {
      alert('Por favor, ingresa el nombre de la jornada.');
      return;
    }
    if (this.modoEdicionJornada) {
      const index = this.jornadas.findIndex(j => j.id === this.jornadaActual.id);
      if (index !== -1) {
        this.jornadas[index] = { ...this.jornadaActual };
      }
    } else {
      this.jornadas.push({ ...this.jornadaActual });
    }
    this.cerrarModalJornada();
  }

  eliminarJornada(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar esta jornada?')) {
      this.jornadas = this.jornadas.filter(j => j.id !== id);
    }
  }

  // --- MODAL SECCIONES ---
  abrirModalSeccion(seccion?: any) {
    if (seccion) {
      this.modoEdicionSeccion = true;
      this.seccionActual = { ...seccion };
    } else {
      this.modoEdicionSeccion = false;
      this.seccionActual = { 
        id: Date.now(), 
        nombre: '', 
        jornada: this.jornadas.length > 0 ? this.jornadas[0].nombre : '', 
        estado: 'Activa' 
      };
    }
    this.modalSeccionAbierto = true;
  }

  cerrarModalSeccion() {
    this.modalSeccionAbierto = false;
  }

  guardarSeccion() {
    if (!this.seccionActual.nombre) {
      alert('Por favor, ingresa el nombre de la sección.');
      return;
    }
    if (this.modoEdicionSeccion) {
      const index = this.secciones.findIndex(s => s.id === this.seccionActual.id);
      if (index !== -1) {
        this.secciones[index] = { ...this.seccionActual };
      }
    } else {
      this.secciones.push({ ...this.seccionActual });
    }
    this.cerrarModalSeccion();
  }

  eliminarSeccion(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar esta sección?')) {
      this.secciones = this.secciones.filter(s => s.id !== id);
    }
  }
}