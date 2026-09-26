import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RolModel } from '../models/rol.model';

@Injectable({
  providedIn: 'root'
})
export class RolService {

  private apiUrl = 'https://backend-sirae-pyim.onrender.com/api/roles/';

  constructor(private http: HttpClient) {}

  // Método auxiliar para obtener las cabeceras HTTP con el Token JWT
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token'); // Asegúrate de que este nombre sea la clave usada en el login
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getRoles(): Observable<RolModel[]> {
    return this.http.get<RolModel[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  crearRol(rol: RolModel): Observable<RolModel> {
    return this.http.post<RolModel>(this.apiUrl, rol, { headers: this.getHeaders() });
  }

  actualizarRol(id: number, rol: RolModel): Observable<RolModel> {
    return this.http.put<RolModel>(`${this.apiUrl}${id}/`, rol, { headers: this.getHeaders() });
  }

  eliminarRol(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`, { headers: this.getHeaders() });
  }
}