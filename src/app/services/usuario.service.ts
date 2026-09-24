import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UsuarioModel } from '../models/usuario.model';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private apiUrl = 'http://127.0.0.1:8000/api/usuarios/';  

  constructor(private http: HttpClient) {}

  getUsuarios(): Observable<UsuarioModel[]> {
    return this.http.get<UsuarioModel[]>(this.apiUrl);
  }

  crearUsuario(usuario: UsuarioModel): Observable<UsuarioModel> {
    return this.http.post<UsuarioModel>(this.apiUrl, usuario);
  }

  actualizarUsuario(
    id: number,
    usuario: UsuarioModel
  ): Observable<UsuarioModel> {
    return this.http.put<UsuarioModel>(
      `${this.apiUrl}${id}/`,
      usuario
    );
  }

  eliminarUsuario(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}${id}/`
    );
  }
}