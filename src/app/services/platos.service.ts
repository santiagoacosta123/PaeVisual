import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PlatosService {
  private readonly apiUrl = `${environment.apiUrl}/platos/`;

  constructor(private http: HttpClient) {}

  getPlatos(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getPlato(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}${id}/`);
  }

  createPlato(plato: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, plato);
  }

  updatePlato(id: number, plato: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}${id}/`, plato);
  }

  deletePlato(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}${id}/`);
  }
}
