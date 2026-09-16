import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-contratos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contratos.html',
  styles: []
})
export class ContratosComponent implements OnInit {

  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api/contratos';

  pestanaActiva: string = 'contratos';
  mostrarFormulario: boolean = false;
  esEdicion: boolean = false;

  contratos: any[] = [];
  preparaciones: any[] = [];

  menus: any[] = [];
  platos: any[] = [];
  usuariosManipuladoras: any[] = [];
  turnos: any[] = [
    { id_turno: 1, nombre_turno: 'Mañana' },
    { id_turno: 2, nombre_turno: 'Tarde' }
  ];

  contratoForm: any = {
    id_contrato: null,
    numero_cor: '',
    institucion: '',
    zona: '',
    estado: 'ACTIVO',
    fecha_inicio: '',
    fecha_fin: ''
  };

  preparacionForm: any = {
    id_preparacion_asignada: null,
    id_menu: '',
    id_plato: '',
    id_usuario_manipuladora: '',
    id_turno: '',
    fecha: '',
    hora_programada: '',
    estado_preparacion: 'PENDIENTE',
    observaciones: ''
  };

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales() {
    console.log('Cargando contratos desde:', this.apiUrl);
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        console.log('Contratos cargados con éxito:', data);
        this.contratos = data;
      },
      error: (err) => {
        console.error('Error al conectar con la API (GET):', err);
      }
    });
  }

  cambiarPestana(pestana: string) {
    this.pestanaActiva = pestana;
  }

  abrirFormulario() {
    this.esEdicion = false;
    this.limpiarFormularios();
    this.mostrarFormulario = true;
  }

  abrirEdicion(item: any) {
    this.esEdicion = true;
    this.mostrarFormulario = true;

    if (this.pestanaActiva === 'contratos') {
      this.contratoForm = { ...item };
    } else if (this.pestanaActiva === 'preparaciones') {
      this.preparacionForm = { ...item };
    }
  }

  cerrarFormulario() {
    this.mostrarFormulario = false;
    this.limpiarFormularios();
  }

  limpiarFormularios() {
    this.contratoForm = {
      id_contrato: null,
      numero_cor: '',
      institucion: '',
      zona: '',
      estado: 'ACTIVO',
      fecha_inicio: '',
      fecha_fin: ''
    };
    this.preparacionForm = {
      id_preparacion_asignada: null,
      id_menu: '',
      id_plato: '',
      id_usuario_manipuladora: '',
      id_turno: '',
      fecha: '',
      hora_programada: '',
      estado_preparacion: 'PENDIENTE',
      observaciones: ''
    };
  }

  guardarTodo() {
    if (this.pestanaActiva === 'contratos') {
      if (this.esEdicion) {
        console.log('Actualizando contrato ID:', this.contratoForm.id_contrato);
        this.http.put(`${this.apiUrl}${this.contratoForm.id_contrato}/`, this.contratoForm).subscribe({
          next: (contratoActualizado: any) => {
            console.log('Contrato actualizado:', contratoActualizado);
            const index = this.contratos.findIndex(c => c.id_contrato === contratoActualizado.id_contrato);
            if (index !== -1) this.contratos[index] = contratoActualizado;
            this.cerrarFormulario();
          },
          error: (err) => {
            console.error('Error en PUT:', err);
            alert('Error al actualizar el contrato. Revisa la consola.');
          }
        });
      } else {
        console.log('Enviando nuevo contrato:', this.contratoForm);
        this.http.post<any>(this.apiUrl, this.contratoForm).subscribe({
          next: (nuevoContrato) => {
            console.log('Contrato creado con éxito:', nuevoContrato);
            this.contratos.push(nuevoContrato);
            this.cerrarFormulario();
          },
          error: (err) => {
            console.error('Error en POST:', err);
            alert('Error al guardar el contrato. Revisa la consola (F12).');
          }
        });
      }
    } else if (this.pestanaActiva === 'preparaciones') {
      if (this.esEdicion) {
        const index = this.preparaciones.findIndex(p => p.id_preparacion_asignada === this.preparacionForm.id_preparacion_asignada);
        if (index !== -1) this.preparaciones[index] = { ...this.preparacionForm };
      } else {
        const nuevaPrep = { ...this.preparacionForm, id_preparacion_asignada: Date.now() };
        this.preparaciones.push(nuevaPrep);
      }
      this.cerrarFormulario();
    }
  }

  eliminarItem(lista: any[], item: any) {
    if (lista === this.contratos) {
      console.log('Eliminando contrato ID:', item.id_contrato);
      this.http.delete(`${this.apiUrl}${item.id_contrato}/`).subscribe({
        next: () => {
          console.log('Contrato eliminado correctamente');
          const index = lista.indexOf(item);
          if (index > -1) lista.splice(index, 1);
        },
        error: (err) => {
          console.error('Error en DELETE:', err);
          alert('Error al eliminar el contrato.');
        }
      });
    } else {
      const index = lista.indexOf(item);
      if (index > -1) lista.splice(index, 1);
    }
  }
}