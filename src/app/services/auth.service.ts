import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginResponse {
  access: string;
  refresh: string;
  usuario: AuthenticatedUser;
}

export interface AuthenticatedUser {
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  numero_documento: string;
  rol: string | null;
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

  rolPermitido(rol: string | null | undefined): boolean {
    const rolNormalizado = rol
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    return rolNormalizado === 'administrador' || rolNormalizado === 'supervisor';
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
    localStorage.removeItem('token');
  }

  cerrarSesion(): void {
    this.limpiarSesion();
    this.router.navigate(['/login']);
  }
}