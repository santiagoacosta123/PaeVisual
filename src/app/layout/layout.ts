import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css'] // Si tu hoja de estilos está integrada en el HTML o en un archivo .css aparte
})
export class LayoutComponent {
  // Estado para el modal de ingredientes
  modalAbierto: boolean = false;
  modoEdicion: boolean = false;
  filtroBusqueda: string = '';

  // Modelo del ingrediente actual (para crear o editar)
  ingredienteActual: any = {
    id: null,
    nombre: '',
    categoria: '',
    unidad_medida: '',
    imagen: '',
    descripcion: ''
  };

  // Lista de ingredientes de ejemplo (puedes conectarla con tu servicio backend)
  ingredientes: any[] = [
    {
      id: 1,
      nombre: 'Arroz blanco',
      categoria: 'Granos y Cereales',
      unidad_medida: 'Kilogramos (kg)',
      imagen: 'https://via.placeholder.com/40',
      descripcion: 'Arroz de primera calidad para almuerzos PAE.'
    }
  ];

  get ingredientesFiltrados() {
    if (!this.filtroBusqueda) return this.ingredientes;
    const texto = this.filtroBusqueda.toLowerCase();
    return this.ingredientes.filter(item => 
      item.nombre.toLowerCase().includes(texto) ||
      item.categoria.toLowerCase().includes(texto) ||
      item.unidad_medida.toLowerCase().includes(texto)
    );
  }

  abrirModalCrear() {
    this.modoEdicion = false;
    this.ingredienteActual = { id: null, nombre: '', categoria: '', unidad_medida: '', imagen: '', descripcion: '' };
    this.modalAbierto = true;
  }

  abrirModalEditar(item: any) {
    this.modoEdicion = true;
    this.ingredienteActual = { ...item };
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
  }

  guardarIngrediente() {
    if (this.modoEdicion) {
      const index = this.ingredientes.findIndex(i => i.id === this.ingredienteActual.id);
      if (index !== -1) {
        this.ingredientes[index] = { ...this.ingredienteActual };
      }
    } else {
      this.ingredienteActual.id = Date.now();
      this.ingredientes.push({ ...this.ingredienteActual });
    }
    this.cerrarModal();
  }

  eliminarIngrediente(id: number) {
    this.ingredientes = this.ingredientes.filter(i => i.id !== id);
  }

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
    // Aquí puedes agregar la redirección al login
  }
}