import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SeccionesMenuService {
  private readonly apiUrl = 'https://backend-sirae-pyim.onrender.com/api/secciones_menu/';

  constructor(private http: HttpClient) {}

  getSecciones(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getSeccion(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}${id}/`);
  }

  createSeccion(seccion: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, seccion);
  }

  updateSeccion(id: number, seccion: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}${id}/`, seccion);
  }

  deleteSeccion(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}${id}/`);
  }
}
