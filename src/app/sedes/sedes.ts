import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-sedes',
  styleUrls: ['./sedes.css'],
  templateUrl: './sedes.html',
})
export class Sedes {
  sedes = [
    { nombre: 'Sede Norte', direccion: 'Cra 12 #45-20', estado: 'Activa' },
    { nombre: 'Sede Centro', direccion: 'Av 68 #15-10', estado: 'Activa' },
    { nombre: 'Sede Sur', direccion: 'Cll 35 #18-40', estado: 'Inactiva' }
  ];

  modoEdicion = false;
  sedeForm = { nombre: '', direccion: '', estado: 'Activa' };

  constructor(private sweetAlert: SweetAlertService) {}

  abrirFormulario(sede?: { nombre: string; direccion: string; estado: string }) {
    if (sede) {
      this.modoEdicion = true;
      this.sedeForm = { ...sede };
      return;
    }

    this.modoEdicion = false;
    this.sedeForm = { nombre: '', direccion: '', estado: 'Activa' };
  }

  guardarSede() {
    if (!this.sedeForm.nombre.trim() || !this.sedeForm.direccion.trim()) {
      this.sweetAlert.warning('Datos incompletos', 'Completa el nombre y la dirección de la sede.');
      return;
    }

    if (this.modoEdicion) {
      const index = this.sedes.findIndex((s) => s.nombre === this.sedeForm.nombre);
      if (index >= 0) {
        this.sedes[index] = { ...this.sedeForm };
        this.sweetAlert.success('Sede actualizada', `${this.sedeForm.nombre} se actualizó correctamente.`);
      }
    } else {
      this.sedes.push({ ...this.sedeForm });
      this.sweetAlert.success('Sede creada', `${this.sedeForm.nombre} fue registrada.`);
    }

    this.abrirFormulario();
  }

  editarSede(sede: { nombre: string; direccion: string; estado: string }) {
    this.abrirFormulario(sede);
  }

  eliminarSede(sede: { nombre: string }) {
    this.sweetAlert
      .confirm('¿Eliminar sede?', `¿Desea remover la sede ${sede.nombre}?`)
      .then((result) => {
        if (result.isConfirmed) {
          this.sedes = this.sedes.filter((s) => s.nombre !== sede.nombre);
          this.sweetAlert.success('Sede eliminada', `${sede.nombre} fue eliminada del sistema.`);
        }
      });
  }
}
