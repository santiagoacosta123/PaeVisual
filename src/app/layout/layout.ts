import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, CommonModule],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent {

  // Panel de perfil
  mostrarPerfil = false;
  vistaActual: 'perfil' | 'editar' | 'password' = 'perfil';

  perfil = {
    nombre: 'Administrador',
    sede: 'Sede La Simmonds',
    correo: 'admin@pae.com',
    telefono: '300 123 4567'
  };

  editForm = { ...this.perfil };

  passwordForm = {
    actual: '',
    nueva: '',
    confirmar: ''
  };

  constructor(private sweetAlert: SweetAlertService) {}

  togglePerfil() {
    this.mostrarPerfil = !this.mostrarPerfil;
    this.vistaActual = 'perfil';
  }

  cerrarPanel() {
    this.mostrarPerfil = false;
    this.vistaActual = 'perfil';
  }

  irA(vista: 'perfil' | 'editar' | 'password') {
    this.vistaActual = vista;
    if (vista === 'editar') {
      this.editForm = { ...this.perfil };
    }
    if (vista === 'password') {
      this.passwordForm = { actual: '', nueva: '', confirmar: '' };
    }
  }

  guardarPerfil() {
    this.perfil = { ...this.editForm };
    this.vistaActual = 'perfil';
    this.sweetAlert.success('Perfil actualizado', 'Los datos se guardaron correctamente.');
  }

  guardarPassword() {
    if (!this.passwordForm.actual) {
      this.sweetAlert.error('Error', 'Ingresa tu contraseña actual.');
      return;
    }
    if (this.passwordForm.nueva.length < 6) {
      this.sweetAlert.error('Error', 'La nueva contraseña debe tener mínimo 6 caracteres.');
      return;
    }
    if (this.passwordForm.nueva !== this.passwordForm.confirmar) {
      this.sweetAlert.error('Error', 'Las contraseñas no coinciden.');
      return;
    }
    this.vistaActual = 'perfil';
    this.sweetAlert.success('Contraseña actualizada', 'Tu contraseña fue cambiada correctamente.');
  }

  cerrarSesion() {
    this.mostrarPerfil = false;
    this.sweetAlert
      .confirm('¿Cerrar sesión?', 'Se cerrará la sesión del administrador.')
      .then((result) => {
        if (result.isConfirmed) {
          this.sweetAlert.success('Sesión cerrada', 'Has salido correctamente.');
        }
      });
  }

  configurar() {
    this.sweetAlert.info('Configuración', 'La configuración del sistema estará disponible pronto.');
  }
}