import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RolModel } from '@shared/models/rol.model';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class RolService {

  private apiUrl = `${environment.apiUrl}/roles/`;
  private cacheRoles: RolModel[] | null = null;

  constructor(private http: HttpClient) {}

  getRoles(forzarRecarga = false): Observable<RolModel[]> {
    if (!forzarRecarga && this.cacheRoles) {
      return of(this.cacheRoles);
    }
    return this.http.get<RolModel[]>(this.apiUrl).pipe(
      tap(roles => this.cacheRoles = roles)
    );
  }

  crearRol(rol: RolModel): Observable<RolModel> {
    this.cacheRoles = null;
    return this.http.post<RolModel>(this.apiUrl, rol);
  }

  actualizarRol(id: number, rol: RolModel): Observable<RolModel> {
    this.cacheRoles = null;
    return this.http.put<RolModel>(`${this.apiUrl}${id}/`, rol);
  }

  eliminarRol(id: number): Observable<void> {
    this.cacheRoles = null;
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}
