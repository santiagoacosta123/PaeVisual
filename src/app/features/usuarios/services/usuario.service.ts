import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UsuarioModel } from '@shared/models/usuario.model';
import { environment } from '@env/environment';

export interface UsuarioFiltrosConsulta {
  search?: string;
  rol?: string | number;
  estado?: string;
  id_institucion?: string | number;
  funcionalidad?: string;
  page?: number;
  page_size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private apiUrl = `${environment.apiUrl}/usuarios/`;
  private http = inject(HttpClient);

  private construirParams(filtros?: UsuarioFiltrosConsulta): HttpParams {
    let params = new HttpParams();
    if (!filtros) return params;

    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
        params = params.set(clave, String(valor).trim());
      }
    });
    return params;
  }

  getUsuarios(filtros?: UsuarioFiltrosConsulta): Observable<UsuarioModel[] | any> {
    const params = this.construirParams(filtros);
    if (params.keys().length === 0) {
      return this.http.get<UsuarioModel[]>(this.apiUrl);
    }
    return this.http.get<UsuarioModel[] | any>(this.apiUrl, { params });
  }

  getUsuariosSupervision(filtros?: UsuarioFiltrosConsulta): Observable<UsuarioModel[] | any> {
    const params = this.construirParams(filtros);
    return this.http.get<UsuarioModel[] | any>(`${this.apiUrl}consulta-supervision/`, { params });
  }

  getUsuarioById(id: number): Observable<UsuarioModel> {
    return this.http.get<UsuarioModel>(`${this.apiUrl}${id}/`);
  }

  crearUsuario(usuario: UsuarioModel): Observable<UsuarioModel> {
    return this.http.post<UsuarioModel>(this.apiUrl, usuario);
  }

  actualizarUsuario(id: number, usuario: Partial<UsuarioModel> | UsuarioModel | any): Observable<UsuarioModel> {
    return this.http.patch<UsuarioModel>(`${this.apiUrl}${id}/`, usuario);
  }

  cambiarEstadoUsuario(id: number, is_active: boolean): Observable<UsuarioModel> {
    return this.http.patch<UsuarioModel>(`${this.apiUrl}${id}/cambiar-estado/`, { is_active });
  }

  obtenerAuditoriaUsuario(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}${id}/auditoria/`);
  }

  eliminarUsuario(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }
}
