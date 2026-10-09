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

  rolPermitido(rol: string | null | undefined): boolean {
    const rolNormalizado = rol
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    return rolNormalizado === 'administrador' || rolNormalizado === 'supervisor';
  }

  recuperarContrasena(data: { correo: string }): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/auth/recuperar-password/`, data);
  }

  guardarSesion(respuesta: LoginResponse): void {
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

  obtenerUsuario(): AuthenticatedUser | null {
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