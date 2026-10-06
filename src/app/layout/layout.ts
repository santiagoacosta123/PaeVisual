import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NotificacionService } from '../notificaciones/notificacion.service';
import { Notificacion } from '../notificaciones/notificacion.model';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent implements OnInit {
  // Estado del menú desplegable de perfil
  mostrarPerfil: boolean = false;

  // Estado del panel de notificaciones
  mostrarNotificaciones: boolean = false;
  listaNotificaciones: Notificacion[] = [];
  notificacionesNoLeidas: number = 0;

  constructor(
    private notificacionService: NotificacionService,
    private authService: AuthService,
    private router: Router
  ) {}

  get perfilNombre(): string {
    const usuario = this.authService.obtenerUsuario();
    return [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ')
      || usuario?.correo
      || 'Usuario SIRAE';
  }

  get perfilCorreo(): string {
    return this.authService.obtenerUsuario()?.correo || 'Correo no registrado';
  }

  get perfilFoto(): string {
    const usuario = this.authService.obtenerUsuario();
    return usuario?.fotoPerfilLocal || usuario?.foto_perfil || usuario?.avatar_url || usuario?.foto || 'administrador.png';
  }

  get perfilTelefono(): string {
    const usuario = this.authService.obtenerUsuario();
    return usuario?.telefono || usuario?.numero_telefono || usuario?.phone || 'No registrado';
  }

  get perfilSede(): string {
    const usuario = this.authService.obtenerUsuario();
    return usuario?.sede?.nombre || usuario?.sede_nombre || usuario?.sede || 'Sede no asignada';
  }

  get perfilRol(): string {
    const usuario = this.authService.obtenerUsuario();
    const rol = usuario?.rol;
    if (usuario?.is_superuser) return 'Super Admin';
    if (rol && typeof rol === 'object') return rol.nombre_rol || rol.nombre || rol.name || 'Usuario';
    return usuario?.nombre_rol || usuario?.rol_nombre || (usuario?.is_staff ? 'Administrador' : 'Usuario');
  }

  get tituloPanel(): string {
    return this.router.url.startsWith('/perfil') ? 'Mi perfil' : 'Panel de Control';
  }

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

  irA(vista: 'perfil' | 'editar' | 'password'): void {
    this.mostrarPerfil = false;
    void this.router.navigate(['/perfil'], { queryParams: { vista } });
  }

  configurar(): void {
    console.log('Navegando a configuración general');
  }

  cerrarSesion(): void {
    this.authService.cerrarSesion();
  }
}