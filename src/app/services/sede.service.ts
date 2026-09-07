import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Sede } from '../models/sede.model';

@Injectable({ providedIn: 'root' })
export class SedeService {
  private sedes: Sede[] = [
    { id: 1, nombre: 'Sede Norte', direccion: 'Cra 12 #45-20', estado: 'Activa' },
    { id: 2, nombre: 'Sede Centro', direccion: 'Av 68 #15-10', estado: 'Activa' },
    { id: 3, nombre: 'Sede Sur', direccion: 'Cll 35 #18-40', estado: 'Inactiva' }
  ];

  getSedes(): Observable<Sede[]> {
    return of(this.sedes);
  }

  crearSede(sede: Sede): Observable<Sede> {
    const nueva = { ...sede, id: Date.now() };
    this.sedes.push(nueva);
    return of(nueva);
  }

  actualizarSede(id: number, sede: Sede): Observable<Sede> {
    const index = this.sedes.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.sedes[index] = { ...sede, id };
      return of(this.sedes[index]);
    }
    return of(sede);
  }

  eliminarSede(id: number): Observable<boolean> {
    this.sedes = this.sedes.filter((s) => s.id !== id);
    return of(true);
  }
}
