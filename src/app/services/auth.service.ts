import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiLoginUrl = 'http://127.0.0.1:8000/api/auth/login/';

  constructor(private http: HttpClient) {}

  login(credenciales: { correo: string; clave: string }): Observable<any> {
    console.log('POST LOGIN:', credenciales);

    return this.http.post<any>(
      this.apiLoginUrl,
      {
        correo: credenciales.correo,
        password: credenciales.clave
      }
    );
  }
}