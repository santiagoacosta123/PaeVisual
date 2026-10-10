import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NotificacionService } from '../notificaciones/notificacion.service';
import { Notificacion } from '../notificaciones/notificacion.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent implements OnInit {
  // Control de Roles para el Menú Lateral
  rolUsuario: string = '';
  esSupervisor: boolean = false;
  esAdministrador: boolean = false;
  esGestor: boolean = false;

  // Estado y métodos del perfil de usuario desplegable
  mostrarPerfil: boolean = false;
  vistaActual: string = 'perfil';

  // Estado del panel de notificaciones
  mostrarNotificaciones: boolean = false;
  listaNotificaciones: Notificacion[] = [];
  notificacionesNoLeidas: number = 0;

  perfil = {
    nombre: '',
    correo: '',
    rol: '',
  };

  editForm = { ...this.perfil };
  passwordForm = { actual: '', nueva: '', confirmar: '' };

  constructor(
    private notificacionService: NotificacionService,
<<<<<<< Updated upstream
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
=======
    private authService: AuthService
>>>>>>> Stashed changes
  ) {}

  ngOnInit(): void {
    const usuario = this.authService.obtenerUsuario();
    if (usuario) {
      this.perfil = {
        nombre: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || usuario.correo,
        correo: usuario.correo,
        rol: usuario.rol || 'Sin rol asignado',
      };
      this.editForm = { ...this.perfil };

      // Normalizar y evaluar el rol del usuario autenticado
      this.rolUsuario = String(usuario.rol || '').toLowerCase().trim();
      
      this.esSupervisor = this.rolUsuario.includes('supervisor');
      this.esAdministrador = this.rolUsuario.includes('admin') || this.rolUsuario.includes('administrador');
      this.esGestor = this.rolUsuario.includes('gestor');
    }

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

<<<<<<< Updated upstream
  perfil = {
    nombre: '',
    correo: '',
    rol: '',
  };

  editForm = { ...this.perfil };
  passwordForm = { actual: '', nueva: '', confirmar: '' };
  passwordProcesando = false;
  passwordError = '';
  passwordMensaje = '';

=======
>>>>>>> Stashed changes
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
    this.passwordError = '';
    this.passwordMensaje = '';

    if (!this.passwordForm.actual || !this.passwordForm.nueva || !this.passwordForm.confirmar) {
      this.passwordError = 'Por favor completa todos los campos.';
      return;
    }
    if (this.passwordForm.nueva !== this.passwordForm.confirmar) {
      this.passwordError = 'Las nuevas contraseñas no coinciden.';
      return;
    }

    this.passwordProcesando = true;
    this.authService.cambiarContrasena({
      password_actual: this.passwordForm.actual,
      nueva_password: this.passwordForm.nueva,
      confirmar_password: this.passwordForm.confirmar,
    }).subscribe({
      next: (response) => {
        this.passwordProcesando = false;
        this.passwordMensaje = response.mensaje || 'Contraseña actualizada correctamente.';
        this.passwordForm = { actual: '', nueva: '', confirmar: '' };
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.passwordProcesando = false;
        this.passwordError = err.error?.error
          || err.error?.detail
          || 'No fue posible actualizar la contraseña. Inténtalo nuevamente.';
        this.cdr.detectChanges();
      },
    });
  }

  configurar(): void {
    console.log('Navegando a configuración general');
  }

  cerrarSesion(): void {
    this.authService.cerrarSesion();
  }
}