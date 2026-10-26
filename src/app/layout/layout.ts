import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
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

  // Declaración de pageTitle
  pageTitle: string = 'Panel de Control';

  // Control de Roles
  rolUsuario: string = '';
  esSuperAdministrador: boolean = false;
  esSupervisor: boolean = false;
  esJefa: boolean = false;
  esAdministrador: boolean = false;
  esGestor: boolean = false;
  institucionUsuario: string = '';

  // Estado del perfil
  mostrarPerfil = false;
  vistaActual = 'perfil';

  // Estado de las notificaciones
  mostrarNotificaciones = false;
  listaNotificaciones: Notificacion[] = [];
  notificacionesNoLeidas = 0;

  // Datos del perfil y formularios
  perfil = {
    nombre: '',
    correo: '',
    rol: ''
  };

  editForm = { ...this.perfil };

  passwordForm = { actual: '', nueva: '', confirmar: '' };
  passwordProcesando = false;
  passwordError = '';
  passwordMensaje = '';

  constructor(
    private notificacionService: NotificacionService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    // Escuchar los cambios de ruta para actualizar el título automáticamente
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.actualizarTitulo(event.urlAfterRedirects);
    });
  }

  ngOnInit(): void {
    const usuario = this.authService.obtenerUsuario();

    if (usuario) {
      // Normalizar y evaluar el rol del usuario autenticado
      this.rolUsuario = this.authService.normalizarRol(usuario.rol);
      this.esSuperAdministrador = this.authService.esSuperAdministrador(usuario.rol);
      this.esSupervisor = this.authService.esSupervisor(usuario.rol);
      this.esJefa = this.authService.esJefa(usuario.rol);
      this.esAdministrador = (this.rolUsuario === 'admin' || this.rolUsuario === 'administrador') && !this.esSuperAdministrador;
      this.esGestor = this.rolUsuario.includes('gestor');

      const rolNombre = this.esSuperAdministrador
        ? 'Super Administrador'
        : this.esSupervisor
          ? 'Supervisor (Coordinador PAE)'
          : this.esJefa
            ? 'Jefa de manipuladoras'
            : usuario.rol || 'Sin rol asignado';

      this.perfil = {
        nombre: `${usuario.nombre ?? ''} ${usuario.apellido ?? ''}`.trim() || usuario.correo,
        correo: usuario.correo,
        rol: rolNombre
      };

      this.editForm = { ...this.perfil };

      // Asignación de institución para el administrador
      this.institucionUsuario = usuario.institucion || (this.esAdministrador ? 'Institución Educativa Asignada' : '');

      // Primer ingreso con contraseña provisional
      if (usuario.debe_cambiar_password) {
        this.mostrarPerfil = true;
        this.vistaActual = 'password';
        this.passwordMensaje = 'Por seguridad, debes actualizar tu contraseña provisional en este primer inicio de sesión.';
      }
    }

    this.cargarNotificacionesHeader();
    this.actualizarTitulo(this.router.url);
  }

  actualizarTitulo(url: string): void {
    const routeTitles: { [key: string]: string } = {
      '/inicio': 'Inicio',
      '/dashboard-supervisor': 'Panel del Supervisor',
      '/asistencia-diaria': 'Asistencia diaria',
      '/contratos': 'Contratos',
      '/usuarios': 'Usuarios',
      '/rol': 'Roles',
      '/ingredientes': 'Inventario',
      '/entradas-inventario': 'Inventario',
      '/saldos-almacen': 'Saldos de almacén',
      '/entradas-ajustes-inventario': 'Ajustes de inventario',
      '/registrar-entrega-alimentos': 'Registrar entrega de alimentos',
      '/historial-entregas': 'Entregas',
      '/entregas-tipo-mercado': 'Entregas por tipo de mercado',
      '/instituciones': 'Sedes',
      '/banco-datos': 'Banco de Datos',
      '/crear-usuario': 'Crear Usuario',
      '/nuevo-producto': 'Nuevo Producto',
      '/reporte-inventario': 'Reporte Inventario',
      '/unidades-medida': 'Unidades de Medida',
      '/menus': 'Menús',
      '/facturas-compra': 'Facturas',
      '/bodega-central': 'Bodega Central',
      '/reportes-consumo': 'Reportes',
      '/notificaciones': 'Notificaciones'
    };

    if (url.includes('bodega-central') || (url.includes('facturas-compra') && url.includes('tab=bodega'))) {
      this.pageTitle = 'Bodega Central';
      this.cdr.detectChanges();
      return;
    }

    if (url.includes('facturas-compra')) {
      this.pageTitle = 'Facturas de Compra';
      this.cdr.detectChanges();
      return;
    }

    const rutaEncontrada = Object.keys(routeTitles).find(
      ruta => url.includes(ruta)
    );

    this.pageTitle = rutaEncontrada
      ? routeTitles[rutaEncontrada]
      : 'SIRAE';
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container') && !target.closest('.user-pill-btn') && !target.closest('.notif-btn') && !target.closest('.config-btn')) {
      this.mostrarPerfil = false;
      this.mostrarNotificaciones = false;
    }
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
      next: () => this.cargarNotificacionesHeader(),
      error: (err: any) => console.error('Error al marcar todas como leídas', err)
    });
  }

  cerrarPanel(): void {
    this.mostrarPerfil = false;
    this.mostrarNotificaciones = false;
  }

  irA(vista: string): void {
    this.vistaActual = vista;
    this.passwordError = '';
    this.passwordMensaje = '';

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
      next: (response: any) => {
        this.passwordProcesando = false;
        this.passwordMensaje = response.mensaje || 'Contraseña actualizada correctamente.';
        this.passwordForm = { actual: '', nueva: '', confirmar: '' };
        this.cdr.detectChanges();
        setTimeout(() => this.vistaActual = 'perfil', 1200);
      },
      error: (err: any) => {
        this.passwordProcesando = false;
        this.passwordError = err.error?.error
          || err.error?.detail
          || 'No fue posible actualizar la contraseña. Inténtalo nuevamente.';
        this.cdr.detectChanges();
      }
    });
  }

  configurar(): void {
    console.log('Navegando a configuración general');
  }

  cerrarSesion(): void {
    this.authService.cerrarSesion();
  }
}