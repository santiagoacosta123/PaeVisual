import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface LoginResponse {
  access: string;
  refresh: string;
  usuario?: any;
}

interface PasswordResetValidationResponse {
  valido: boolean;
  mensaje?: string;
  error?: string;
  email?: string;
  nombre_completo?: string;
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

  login(credenciales: { correo: string; clave: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiBaseUrl}/auth/login/`, {
      correo: credenciales.correo,
      password: credenciales.clave
    });
  }

  recuperarContrasena(data: { correo: string }): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/auth/recuperar-password/`, data);
  }

  validarTokenRecuperacion(token: string): Observable<PasswordResetValidationResponse> {
    return this.http.post<PasswordResetValidationResponse>(
      `${this.apiBaseUrl}/auth/password-reset/validar-token/`,
      { token }
    );
  }

  confirmarRecuperacionContrasena(data: {
    token: string;
    nueva_password: string;
    confirmar_password: string;
  }): Observable<{ status: string; mensaje: string }> {
    return this.http.post<{ status: string; mensaje: string }>(
      `${this.apiBaseUrl}/auth/password-reset/confirmar/`,
      data
    );
  }

  loginConGoogle(token: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiBaseUrl}/auth/google/`, { token });
  }

  guardarSesion(respuesta: any): void {
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
    return localStorage.getItem(this.ACCESS_TOKEN);
  }

  obtenerRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN);
  }

  obtenerUsuario(): any | null {
    const usuario = localStorage.getItem(this.USUARIO);

    if (!usuario) {
      return null;
    }

    try {
      return JSON.parse(usuario);
    } catch {
      return null;
    }
  }

  estaAutenticado(): boolean {
    return !!this.obtenerToken();
  }

  cerrarSesion(): void {
    localStorage.removeItem(this.ACCESS_TOKEN);
    localStorage.removeItem(this.REFRESH_TOKEN);
    localStorage.removeItem(this.USUARIO);
    localStorage.removeItem('token');

    this.router.navigate(['/login']);
  }
}