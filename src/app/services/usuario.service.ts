import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Usuario } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private usuarios: Usuario[] = [
    { id: 1, nombre: 'Jader', rol: 'Admin', estado: 'Activo' },
    { id: 2, nombre: 'Maria', rol: 'Coordinador', estado: 'Activo' },
    { id: 3, nombre: 'Carlos', rol: 'Supervisor', estado: 'Inactivo' },
    { id: 4, nombre: 'Ana', rol: 'Jefa', estado: 'Activo' }
  ];

  getUsuarios(): Observable<Usuario[]> {
    return of(this.usuarios);
  }

  crearUsuario(usuario: Usuario): Observable<Usuario> {
    const nuevoUsuario = { ...usuario, id: Date.now() };
    this.usuarios.push(nuevoUsuario);
    return of(nuevoUsuario);
  }

  actualizarUsuario(id: number, usuario: Usuario): Observable<Usuario> {
    const index = this.usuarios.findIndex((u) => u.id === id);
    if (index !== -1) {
      this.usuarios[index] = { ...usuario, id };
      return of(this.usuarios[index]);
    }
    return of(usuario);
  }

  eliminarUsuario(id: number): Observable<boolean> {
    this.usuarios = this.usuarios.filter((u) => u.id !== id);
    return of(true);
  }
}
