import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NotificacionService } from '../notificaciones/notificacion.service';
import { Notificacion } from '../notificaciones/notificacion.model';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent implements OnInit {
  // Estado y métodos del perfil de usuario desplegable
  mostrarPerfil: boolean = false;
  vistaActual: string = 'perfil';

  // Estado del panel de notificaciones
  mostrarNotificaciones: boolean = false;
  listaNotificaciones: Notificacion[] = [];
  notificacionesNoLeidas: number = 0;

  constructor(private notificacionService: NotificacionService) {}

  ngOnInit(): void {
    this.cargarNotificacionesHeader();
  }

  cargarNotificacionesHeader(): void {
    this.notificacionService.obtenerNotificaciones().subscribe({
      next: (data: Notificacion[]) => {
        this.listaNotificaciones = data;
        this.notificacionesNoLeidas = data.filter((n: Notificacion) => !n.leida).length;
      },
      error: (err: any) => console.error('Error al cargar notificaciones en layout', err)
    });
  }

  toggleNotificaciones(): void {
    this.mostrarNotificaciones = !this.mostrarNotificaciones;
    if (this.mostrarNotificaciones) {
      this.mostrarPerfil = false; 
      this.cargarNotificacionesHeader();
    }
  }

  togglePerfil(): void {
    this.mostrarPerfil = !this.mostrarPerfil;
    if (this.mostrarPerfil) {
      this.mostrarNotificaciones = false; 
    }
  }

  marcarTodasComoLeidasDesdePanel(): void {
    this.notificacionService.marcarTodasComoLeidas().subscribe({
      next: () => {
        this.cargarNotificacionesHeader();
      },
      error: (err: any) => console.error('Error al marcar todas como leídas', err)
    });
  }

  perfil = {
    nombre: 'Administrador PAE',
    sede: 'Sede Principal Popayán',
    correo: 'admin.pae@colombia.gov.co',
    telefono: '+57 300 1234567'
  };

  editForm = { ...this.perfil };
  passwordForm = { actual: '', nueva: '', confirmar: '' };

  cerrarPanel(): void {
    this.mostrarPerfil = false;
    this.mostrarNotificaciones = false;
  }

  irA(vista: string): void {
    this.vistaActual = vista;
    if (vista === 'editar') {
      this.editForm = { ...this.perfil };
    }
  }

  guardarPerfil(): void {
    this.perfil = { ...this.editForm };
    alert('Perfil actualizado correctamente.');
    this.vistaActual = 'perfil';
  }

  guardarPassword(): void {
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

  configurar(): void {
    console.log('Navegando a configuración general');
  }

  cerrarSesion(): void {
    console.log('Cerrando sesión...');
  }
}