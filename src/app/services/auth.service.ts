import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface LoginResponse {
  access: string;
  refresh: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = 'https://backend-sirae-pyim.onrender.com/api/auth/login/';

  constructor(private http: HttpClient) {}

  login(correo: string, clave: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.apiUrl, {
      correo: correo,
      password: clave
    });
  }
 
  guardarTokens(response: LoginResponse): void {
    localStorage.setItem('access_token', response.access);
    localStorage.setItem('refresh_token', response.refresh);
  }

  obtenerToken(): string | null {
    return localStorage.getItem('access_token');
  }

  cerrarSesion(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}