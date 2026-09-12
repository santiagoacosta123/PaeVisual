import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly ACCESS_TOKEN = 'access_token';
  private readonly REFRESH_TOKEN = 'refresh_token';
  private readonly USUARIO = 'usuario';

  constructor(private router: Router) {}

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