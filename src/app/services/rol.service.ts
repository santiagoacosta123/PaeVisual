import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { RolModel } from '../models/rol.model';

@Injectable({ providedIn: 'root' })
export class RolService {
  private roles: RolModel[] = [
    { id: 1, nombre: 'Administrador', descripcion: 'Control total', estado: 'Activo' },
    { id: 2, nombre: 'Coordinador', descripcion: 'Registra inventario', estado: 'Activo' },
    { id: 3, nombre: 'Jefa', descripcion: 'Selecciona menú', estado: 'Activo' }
  ];

  getRoles(): Observable<RolModel[]> {
    return of(this.roles);
  }

  crearRol(rol: RolModel): Observable<RolModel> {
    const nuevo = { ...rol, id: Date.now() };
    this.roles.push(nuevo);
    return of(nuevo);
  }

  actualizarRol(id: number, rol: RolModel): Observable<RolModel> {
    const index = this.roles.findIndex((r) => r.id === id);
    if (index !== -1) {
      this.roles[index] = { ...rol, id };
      return of(this.roles[index]);
    }
    return of(rol);
  }

  eliminarRol(id: number): Observable<boolean> {
    this.roles = this.roles.filter((r) => r.id !== id);
    return of(true);
  }
}
