
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { NotificacionService } from '../notificaciones/notificacion.service';
import { Notificacion } from '../notificaciones/notificacion.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule
  ],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent implements OnInit {

  // Estado del perfil
  mostrarPerfil = false;
  vistaActual = 'perfil';

  // Estado de las notificaciones
  mostrarNotificaciones = false;
  listaNotificaciones: Notificacion[] = [];
  notificacionesNoLeidas = 0;

  // Título de la página
  pageTitle = 'Inicio';

  perfil = {
    nombre: '',
    correo: '',
    rol: ''
  };

  editForm = { ...this.perfil };

  passwordForm = {
    actual: '',
    nueva: '',
    confirmar: ''
  };

  constructor(
    private notificacionService: NotificacionService,
    private authService: AuthService,
    private router: Router
  ) {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe(event => {
        if (event instanceof NavigationEnd) {
          this.actualizarTitulo(event.urlAfterRedirects);
        }
      });
  }

  ngOnInit(): void {
    const usuario = this.authService.obtenerUsuario();

    if (usuario) {
      this.perfil = {
        nombre: `${usuario.nombre ?? ''} ${usuario.apellido ?? ''}`.trim()
          || usuario.correo,
        correo: usuario.correo,
        rol: usuario.rol || 'Sin rol asignado'
      };

      this.editForm = { ...this.perfil };
    }

    this.cargarNotificacionesHeader();
  }

  actualizarTitulo(url: string): void {
    const routeTitles: { [key: string]: string } = {
      '/inicio': 'Inicio',
      '/contratos': 'Contratos',
      '/usuarios': 'Usuarios',
      '/rol': 'Roles',
      '/productos': 'Inventario',
      '/banco-datos': 'Banco de Datos',
      '/crear-usuario': 'Crear Usuario',
      '/nuevo-producto': 'Nuevo Producto',
      '/reporte-inventario': 'Reporte Inventario',
      '/unidades-medida': 'Unidades de Medida',
      '/menus': 'Menús',
      '/notificaciones': 'Notificaciones'
    };

    const rutaEncontrada = Object.keys(routeTitles).find(
      ruta => url.includes(ruta)
    );

    this.pageTitle = rutaEncontrada
      ? routeTitles[rutaEncontrada]
      : 'SIRAE';
  }

  cargarNotificacionesHeader(): void {
    this.notificacionService.obtenerNotificaciones().subscribe({
      next: (data: Notificacion[]) => {
        this.listaNotificaciones = data;
        this.notificacionesNoLeidas =
          data.filter((n: Notificacion) => !n.leida).length;
      },
      error: (err: any) =>
        console.error(
          'Error al cargar notificaciones en layout',
          err
        )
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
      next: () => this.cargarNotificacionesHeader(),
      error: (err: any) =>
        console.error('Error al marcar todas como leídas', err)
    });
  }

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
    if (
      !this.passwordForm.actual ||
      !this.passwordForm.nueva ||
      !this.passwordForm.confirmar
    ) {
      alert('Por favor completa todos los campos.');
      return;
    }

    if (this.passwordForm.nueva !== this.passwordForm.confirmar) {
      alert('Las nuevas contraseñas no coinciden.');
      return;
    }

    alert('Contraseña actualizada con éxito.');

    this.passwordForm = {
      actual: '',
      nueva: '',
      confirmar: ''
    };

    this.vistaActual = 'perfil';
  }

  configurar(): void {
    console.log('Navegando a configuración general');
  }

  cerrarSesion(): void {
    this.authService.cerrarSesion();
  }
}
