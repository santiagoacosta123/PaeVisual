import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginResponse {
  access: string;
  refresh: string;
  usuario: AuthenticatedUser;
}

export interface InstitucionAsignada {
  id_institucion: number;
  nombre_institucion: string;
  nit?: string;
  sedes?: any[];
  representante_legal?: string;
  telefono?: string;
  correo_contacto?: string;
  estado?: string;
  administrador_asignado?: any;
}

export interface AuthenticatedUser {
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  numero_documento: string;
  rol: string | null;
  institucion?: string;
  id_institucion?: number;
  institucion_nombre?: string;
  id_sede?: number;
  sede_nombre?: string;
  instituciones_supervisor?: InstitucionAsignada[];
  is_superuser?: boolean;
  debe_cambiar_password?: boolean;
}

export interface PasswordResetResponse {
  status?: string;
  mensaje?: string;
  error?: string;
  debug_link?: string;
  debug_code?: string;
}

export interface PasswordResetTokenResponse {
  valido: boolean;
  mensaje?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiBaseUrl = environment.apiUrl;
  private readonly ACCESS_TOKEN = 'access_token';
  private readonly REFRESH_TOKEN = 'refresh_token';
  private readonly USUARIO = 'usuario';
  private readonly INSTITUCION_ACTIVA = 'sirae_institucion_activa';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  private estaDisponibleStorage(): boolean {
    try {
      const testKey = '__auth_service_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  login(credenciales: { correo: string; clave: string }): Observable<LoginResponse> {
    const correo = (credenciales.correo ?? '').trim();
    const clave = (credenciales.clave ?? '').trim();

    return this.http.post<LoginResponse>(`${this.apiBaseUrl}/auth/login/`, {
      correo,
      clave,
      password: clave,
    });
  }

  esSuperAdministrador(rol: string | null | undefined): boolean {
    const rolNormalizado = this.normalizarRol(rol);
    return rolNormalizado === 'superadministrador'
      || rolNormalizado === 'super administrador'
      || rolNormalizado === 'super admin';
  }

  esAdministrador(rol: string | null | undefined): boolean {
    const rolNormalizado = this.normalizarRol(rol);
    return rolNormalizado === 'administrador' || rolNormalizado === 'admin';
  }

  rolPermitido(rol: string | null | undefined): boolean {
    const rolNormalizado = this.normalizarRol(rol);

    return this.esSuperAdministrador(rol)
      || rolNormalizado === 'administrador'
      || rolNormalizado === 'admin'
      || this.esSupervisor(rol)
      || this.esJefa(rol);
  }

  normalizarRol(rol: string | null | undefined): string {
    return rol
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') ?? '';
  }

  esSupervisor(rol: string | null | undefined): boolean {
    const rolNormalizado = this.normalizarRol(rol);
    return rolNormalizado === 'supervisor'
      || rolNormalizado === 'coordinador'
      || rolNormalizado === 'coordinador pae';
  }

  esJefa(rol: string | null | undefined): boolean {
    return ['jefa de manipuladoras', 'jefa manipuladoras', 'jefamanipuladoras'].includes(this.normalizarRol(rol));
  }

  recuperarContrasena(data: { correo: string }): Observable<PasswordResetResponse> {
    return this.http.post<PasswordResetResponse>(`${this.apiBaseUrl}/auth/recuperar-password/`, data);
  }

  confirmarRecuperacionCodigo(data: {
    correo: string;
    codigo: string;
    nueva_password: string;
    confirmar_password: string;
  }): Observable<PasswordResetResponse> {
    return this.http.post<PasswordResetResponse>(
      `${this.apiBaseUrl}/auth/confirmar-recuperacion-password/`,
      data
    );
  }

  validarTokenRecuperacion(token: string): Observable<PasswordResetTokenResponse> {
    return this.http.post<PasswordResetTokenResponse>(
      `${this.apiBaseUrl}/auth/password-reset/validar-token/`,
      { token }
    );
  }

  confirmarRecuperacionContrasena(data: {
    token: string;
    nueva_password: string;
    confirmar_password: string;
  }): Observable<PasswordResetResponse> {
    return this.http.post<PasswordResetResponse>(
      `${this.apiBaseUrl}/auth/password-reset/confirmar/`,
      data
    );
  }

  cambiarContrasena(data: {
    password_actual: string;
    nueva_password: string;
    confirmar_password: string;
  }): Observable<PasswordResetResponse> {
    return this.http.post<PasswordResetResponse>(
      `${this.apiBaseUrl}/auth/cambiar-password/`,
      data
    );
  }

  guardarSesion(respuesta: LoginResponse): void {
    if (!this.estaDisponibleStorage()) {
      return;
    }

    if (respuesta.access) {
      localStorage.setItem(this.ACCESS_TOKEN, respuesta.access);
    }

    if (respuesta.refresh) {
      localStorage.setItem(this.REFRESH_TOKEN, respuesta.refresh);
    }

    if (respuesta.usuario) {
      localStorage.setItem(
        this.USUARIO,
        JSON.stringify(respuesta.usuario)
      );

      // Si es supervisor, preseleccionar la primera institución asignada si no hay una activa válida
      if (this.esSupervisor(respuesta.usuario.rol) && respuesta.usuario.instituciones_supervisor?.length) {
        const guardada = this.obtenerInstitucionActiva();
        const coincide = guardada && respuesta.usuario.instituciones_supervisor.some(
          i => i.id_institucion === guardada.id_institucion
        );
        if (!coincide) {
          this.establecerInstitucionActiva(respuesta.usuario.instituciones_supervisor[0]);
        }
      }
    }
  }

  obtenerToken(): string | null {
    if (!this.estaDisponibleStorage()) {
      return null;
    }

    return localStorage.getItem(this.ACCESS_TOKEN);
  }

  obtenerRefreshToken(): string | null {
    if (!this.estaDisponibleStorage()) {
      return null;
    }

    return localStorage.getItem(this.REFRESH_TOKEN);
  }

  obtenerUsuario(): AuthenticatedUser | null {
    if (!this.estaDisponibleStorage()) {
      return null;
    }

    const usuario = localStorage.getItem(this.USUARIO);

    if (!usuario) {
      return null;
    }

    try {
      return JSON.parse(usuario) as AuthenticatedUser;
    } catch {
      return null;
    }
  }

  obtenerInstitucionesSupervisor(): InstitucionAsignada[] {
    const usuario = this.obtenerUsuario();
    if (!usuario || !this.esSupervisor(usuario.rol)) {
      return [];
    }
    return usuario.instituciones_supervisor ?? [];
  }

  obtenerInstitucionActiva(): InstitucionAsignada | null {
    if (!this.estaDisponibleStorage()) {
      return null;
    }

    const guardada = localStorage.getItem(this.INSTITUCION_ACTIVA);
    if (!guardada) {
      const asignadas = this.obtenerInstitucionesSupervisor();
      if (asignadas.length > 0) {
        this.establecerInstitucionActiva(asignadas[0]);
        return asignadas[0];
      }
      return null;
    }

    try {
      return JSON.parse(guardada) as InstitucionAsignada;
    } catch {
      return null;
    }
  }

  establecerInstitucionActiva(institucion: InstitucionAsignada): void {
    if (!this.estaDisponibleStorage() || !institucion) {
      return;
    }
    localStorage.setItem(this.INSTITUCION_ACTIVA, JSON.stringify(institucion));
  }

  estaAutenticado(): boolean {
    return !!this.obtenerToken();
  }

  limpiarSesion(): void {
    if (!this.estaDisponibleStorage()) {
      return;
    }

    localStorage.removeItem(this.ACCESS_TOKEN);
    localStorage.removeItem(this.REFRESH_TOKEN);
    localStorage.removeItem(this.USUARIO);
    localStorage.removeItem(this.INSTITUCION_ACTIVA);
    localStorage.removeItem('token');
  }

  cerrarSesion(): void {
    this.limpiarSesion();
    this.router.navigate(['/login']);
  }
}
