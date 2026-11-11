import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  RolModel,
  PermisoRolModel,
  ModuloPermisosModel,
  AuditoriaPermisoRolModel
} from '@shared/models/rol.model';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class RolService {

  private apiUrl = `${environment.apiUrl}/roles/`;
  private cacheRoles: RolModel[] | null = null;
  private cacheMatriz: ModuloPermisosModel[] | null = null;

  constructor(private http: HttpClient) {}

  getRoles(forzarRecarga = false, soloAsignables = false): Observable<RolModel[]> {
    if (!forzarRecarga && !soloAsignables && this.cacheRoles) {
      return of(this.cacheRoles);
    }

    let params = new HttpParams();
    if (soloAsignables) {
      params = params.set('asignables', 'true');
    }

    return this.http.get<RolModel[]>(this.apiUrl, { params }).pipe(
      tap(roles => {
        if (!soloAsignables) {
          this.cacheRoles = roles;
        }
      })
    );
  }

  getMatrizModulos(): Observable<ModuloPermisosModel[]> {
    if (this.cacheMatriz) {
      return of(this.cacheMatriz);
    }
    return this.http.get<ModuloPermisosModel[]>(`${this.apiUrl}matriz-modulos/`).pipe(
      tap(matriz => this.cacheMatriz = matriz)
    );
  }

  getPermisosRol(idRol: number): Observable<PermisoRolModel[]> {
    return this.http.get<PermisoRolModel[]>(`${this.apiUrl}${idRol}/permisos/`);
  }

  asignarPermisosRol(idRol: number, permisos: string[]): Observable<any> {
    this.cacheRoles = null;
    return this.http.post<any>(`${this.apiUrl}${idRol}/asignar-permisos/`, { permisos });
  }

  getAuditoriaPermisosRol(idRol: number): Observable<AuditoriaPermisoRolModel[]> {
    return this.http.get<AuditoriaPermisoRolModel[]>(`${this.apiUrl}${idRol}/auditoria/`);
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
