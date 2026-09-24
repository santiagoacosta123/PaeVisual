import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent {
  // Estado y métodos del perfil de usuario desplegable
  mostrarPerfil: boolean = false;
  vistaActual: string = 'perfil';

  perfil = {
    nombre: 'Administrador PAE',
    sede: 'Sede Principal Popayán',
    correo: 'admin.pae@colombia.gov.co',
    telefono: '+57 300 1234567'
  };

  editForm = { ...this.perfil };
  passwordForm = { actual: '', nueva: '', confirmar: '' };

  togglePerfil() {
    this.mostrarPerfil = !this.mostrarPerfil;
  }

  cerrarPanel() {
    this.mostrarPerfil = false;
  }

  irA(vista: string) {
    this.vistaActual = vista;
    if (vista === 'editar') {
      this.editForm = { ...this.perfil };
    }
  }

  guardarPerfil() {
    this.perfil = { ...this.editForm };
    alert('Perfil actualizado correctamente.');
    this.vistaActual = 'perfil';
  }

  guardarPassword() {
    if (!this.passwordForm.actual || !this.passwordForm.nueva || !this.passwordForm.confirmar) {
      alert('Por favor completa todos los campos.');
      return;
    }
    if (this.passwordForm.nueva !== this.passwordForm.confirmar) {
      alert('Las nuevas contraseñas no coinciden.');
      return;
    }
    alert('Contraseña actualizada con éxito.');
    this.passwordForm = { actual: '', nueva: '', confirmar: '' };
    this.vistaActual = 'perfil';
  }

  configurar() {
    console.log('Navegando a configuración general');
  }

  cerrarSesion() {
    console.log('Cerrando sesión...');
    // Aquí puedes agregar la redirección al login cuando lo configures
  }
}