import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, EMPTY, catchError, finalize, timeout } from 'rxjs';
import { Store } from '@ngrx/store';
import { environment } from '../../../environments/environment';
import { logout } from '../../store/action';

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

export interface SedeActiva {
  id_sede: number;
  nombre_sede: string;
  id_institucion?: number;
  nombre_institucion?: string;
}

export interface AuthenticatedUser {
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  numero_documento: string;
  rol: string | null;
  estado?: string;
  is_active?: boolean;
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
  private readonly SEDE_ACTIVA = 'sirae_sede_activa';
  private readonly CLAVES_SESION = [
    this.ACCESS_TOKEN,
    this.REFRESH_TOKEN,
    this.USUARIO,
    this.INSTITUCION_ACTIVA,
    this.SEDE_ACTIVA,
    'token',
  ];

  private http = inject(HttpClient);
  private router = inject(Router);
  private store = inject(Store, { optional: true });
  private institucionActivaSubject = new BehaviorSubject<InstitucionAsignada | null>(null);
  public institucionActiva$ = this.institucionActivaSubject.asObservable();
  private sedeActivaSubject = new BehaviorSubject<SedeActiva | null>(this.obtenerSedeActiva());
  public sedeActiva$ = this.sedeActivaSubject.asObservable();

  constructor() {
    this.institucionActivaSubject.next(this.obtenerInstitucionActiva());
  }

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

  private limpiarSessionStorage(): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        for (const clave of this.CLAVES_SESION) {
          sessionStorage.removeItem(clave);
        }
        sessionStorage.clear();
      }
    } catch {
      // Ignorar si sessionStorage no está disponible en el entorno actual
    }
  }

  login(credenciales: { correo: string; clave: string }): Observable<LoginResponse> {
    const correo = (credenciales.correo ?? '').trim();
    const clave = (credenciales.clave ?? '').trim();

    return this.http.post<LoginResponse>(`${this.apiBaseUrl}/auth/login/`, {
      correo,
      clave,
      password: clave,
    }).pipe(timeout(60000));
  }

  despertarBackend(): void {
    this.http.get(`${this.apiBaseUrl}/`, { responseType: 'text' })
      .pipe(timeout(30000), catchError(() => EMPTY))
      .subscribe();
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

  actualizarPerfil(data: { nombre: string; apellido: string; correo: string }): Observable<AuthenticatedUser> {
    const usuario = this.obtenerUsuario();
    if (!usuario?.id_usuario) {
      throw new Error('No se pudo identificar al usuario autenticado.');
    }

    return this.http.patch<AuthenticatedUser>(
      `${this.apiBaseUrl}/usuarios/${usuario.id_usuario}/`,
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
    }

    // Cada nuevo inicio de sesión debe empezar sin institución activa previa
    this.limpiarInstitucionActiva();
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
    this.institucionActivaSubject.next(institucion);
    this.limpiarSedeActiva();
  }

  obtenerSedeActiva(): SedeActiva | null {
    if (!this.estaDisponibleStorage()) return null;
    try {
      const guardada = localStorage.getItem(this.SEDE_ACTIVA);
      return guardada ? JSON.parse(guardada) as SedeActiva : null;
    } catch {
      return null;
    }
  }

  establecerSedeActiva(sede: SedeActiva): void {
    if (!this.estaDisponibleStorage()) return;
    localStorage.setItem(this.SEDE_ACTIVA, JSON.stringify(sede));
    this.sedeActivaSubject.next(sede);
  }

  limpiarSedeActiva(): void {
    if (this.estaDisponibleStorage()) {
      localStorage.removeItem(this.SEDE_ACTIVA);
    }
    this.sedeActivaSubject.next(null);
  }

  limpiarInstitucionActiva(): void {
    if (this.estaDisponibleStorage()) {
      localStorage.removeItem(this.INSTITUCION_ACTIVA);
    }
    this.institucionActivaSubject.next(null);
    this.limpiarSedeActiva();
  }

  tokenExpirado(token: string | null | undefined): boolean {
    if (!token) {
      return true;
    }
    const partes = token.split('.');
    if (partes.length !== 3) {
      return false;
    }
    try {
      const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      if (typeof payload.exp === 'number') {
        const ahoraSegundos = Math.floor(Date.now() / 1000);
        return payload.exp <= ahoraSegundos;
      }
      return false;
    } catch {
      return false;
    }
  }

  obtenerRutaInicialPorRol(rol: string | null | undefined): string {
    if (this.esSupervisor(rol)) {
      return '/dashboard-supervisor';
    }
    if (this.esJefa(rol)) {
      return '/asistencia-diaria';
    }
    return '/inicio';
  }

  estaAutenticado(): boolean {
    const token = this.obtenerToken();
    if (!token) {
      return false;
    }
    if (this.tokenExpirado(token)) {
      this.limpiarSesion();
      return false;
    }
    return true;
  }

  limpiarSesion(): void {
    this.institucionActivaSubject.next(null);
    this.sedeActivaSubject.next(null);
    this.store?.dispatch(logout());
    this.limpiarSessionStorage();

    if (!this.estaDisponibleStorage()) {
      return;
    }

    for (const clave of this.CLAVES_SESION) {
      localStorage.removeItem(clave);
    }
  }

  revocarSesionServidor(refresh?: string | null, access?: string | null): Observable<unknown> {
    const headers: Record<string, string> = {};
    if (access) {
      headers['Authorization'] = `Bearer ${access}`;
    }
    const payload = refresh ? { refresh } : {};
    return this.http.post(`${this.apiBaseUrl}/auth/logout/`, payload, { headers });
  }

  cerrarSesion(): void {
    const refresh = this.obtenerRefreshToken();
    const access = this.obtenerToken();

    this.limpiarSesion();
    void this.router.navigate(['/login'], { replaceUrl: true });

    if (refresh || access) {
      this.revocarSesionServidor(refresh, access).pipe(
        timeout(10000),
        catchError(() => EMPTY),
        finalize(() => {
          this.limpiarSesion();
          void this.router.navigate(['/login'], { replaceUrl: true });
        })
      ).subscribe();
    }
  }
}
