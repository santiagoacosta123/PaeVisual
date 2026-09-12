import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RolModel } from '../models/rol.model';

@Injectable({
  providedIn: 'root'
})
export class RolService {

  private apiUrl = 'https://backend-sirae-pyim.onrender.com/api/roles/';

  constructor(private http: HttpClient) {}

  getRoles(): Observable<RolModel[]> {
    return this.http.get<RolModel[]>(this.apiUrl);
  }

  crearRol(rol: RolModel): Observable<RolModel> {
    return this.http.post<RolModel>(this.apiUrl, rol);
  }

  actualizarRol(id: number, rol: RolModel): Observable<RolModel> {
    return this.http.put<RolModel>(`${this.apiUrl}${id}/`, rol);
  }

  eliminarRol(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}