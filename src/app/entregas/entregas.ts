import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SweetAlertService } from '../sweet-alert.service';

interface Entrega {
  id_entrega: number;
  fecha: string;
  id_usuario_supervisor: number;
}

@Component({
  selector: 'app-entregas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './entregas.html',
  styleUrls: ['./entregas.css']
})
export class EntregasComponent {
  // Lista simulada basada en tu modelo relacional
  entregas: Entrega[] = [
    { id_entrega: 1, fecha: '2026-09-15', id_usuario_supervisor: 101 },
    { id_entrega: 2, fecha: '2026-09-15', id_usuario_supervisor: 102 },
    { id_entrega: 3, fecha: '2026-09-14', id_usuario_supervisor: 101 },
  ];

  filtroBusqueda: string = '';

  // Control del Modal
  modalAbierto: boolean = false;
  modoEdicion: boolean = false;

  // Formulario actual adaptado a la tabla entregas
  entregaActual: Entrega = {
    id_entrega: 0,
    fecha: new Date().toISOString().split('T')[0],
    id_usuario_supervisor: 0
  };

  constructor(private sweetAlert: SweetAlertService) {}

  // Filtrado reactivo de la tabla
  get entregasFiltradas(): Entrega[] {
    return this.entregas.filter(item => {
      const termino = this.filtroBusqueda.toLowerCase();
      return item.id_entrega.toString().includes(termino) ||
             item.id_usuario_supervisor.toString().includes(termino) ||
             item.fecha.includes(termino);
    });
  }

  // Abrir modal para NUEVA entrega
  abrirModalCrear() {
    this.modoEdicion = false;
    this.entregaActual = {
      id_entrega: Date.now(), // Simulando ID autoincrementable
      fecha: new Date().toISOString().split('T')[0],
      id_usuario_supervisor: 0
    };
    this.modalAbierto = true;
  }

  // Abrir modal para EDITAR entrega existente
  abrirModalEditar(entrega: Entrega) {
    this.modoEdicion = true;
    this.entregaActual = { ...entrega };
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
  }

  // Guardar (Crear o Actualizar)
  guardarEntrega() {
    if (!this.entregaActual.id_usuario_supervisor || !this.entregaActual.fecha) {
      this.sweetAlert.error('Campos incompletos', 'Por favor llena todos los campos obligatorios.');
      return;
    }

    if (this.modoEdicion) {
      const index = this.entregas.findIndex(e => e.id_entrega === this.entregaActual.id_entrega);
      if (index !== -1) {
        this.entregas[index] = { ...this.entregaActual };
        this.sweetAlert.success('Actualizado', 'El registro de entrega se actualizó correctamente.');
      }
    } else {
      this.entregas.unshift({ ...this.entregaActual });
      this.sweetAlert.success('Registrado', 'La nueva entrega se registró con éxito.');
    }

    this.cerrarModal();
  }

  // Eliminar registro
  eliminarEntrega(id_entrega: number) {
    this.sweetAlert.confirm('¿Eliminar registro?', 'Esta acción no se puede deshacer.').then(result => {
      if (result.isConfirmed) {
        this.entregas = this.entregas.filter(e => e.id_entrega !== id_entrega);
        this.sweetAlert.success('Eliminado', 'El registro de entrega fue eliminado.');
      }
    });
  }
}