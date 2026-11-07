import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class SiraeService {
  private http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}/contratos/`;
  private turnosUrl = `${environment.apiUrl}/turnos/`;
  private jornadasUrl = `${environment.apiUrl}/jornadas/`;
  private seccionesMenuUrl = `${environment.apiUrl}/secciones_menu/`;
  private contratosSeccionMenuUrl = `${environment.apiUrl}/contratos-secciones-menu/`;
  private institucionesUrl = `${environment.apiUrl}/instituciones/`;
  private sedesUrl = `${environment.apiUrl}/sedes/`;

  // Caché en memoria
  private cacheInstituciones: any[] | null = null;
  private cacheSedes: any[] | null = null;
  private cacheJornadas: any[] | null = null;
  private cacheSecciones: any[] | null = null;

  // CONTRATOS
  getContratos(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  crearContrato(contrato: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, contrato);
  }

  actualizarContrato(id: number, contrato: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}${id}/`, contrato);
  }

  eliminarContrato(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}${id}/`);
  }

  // TURNOS
  getTurnos(): Observable<any[]> {
    return this.http.get<any[]>(this.turnosUrl);
  }

  crearTurno(turno: any): Observable<any> {
    return this.http.post<any>(this.turnosUrl, turno);
  }

  actualizarTurno(id: number, turno: any): Observable<any> {
    return this.http.put<any>(`${this.turnosUrl}${id}/`, turno);
  }

  eliminarTurno(id: number): Observable<any> {
    return this.http.delete<any>(`${this.turnosUrl}${id}/`);
  }

  // JORNADAS (con caché)
  getJornadas(forzarRecarga = false): Observable<any[]> {
    if (!forzarRecarga && this.cacheJornadas) {
      return of(this.cacheJornadas);
    }
    return this.http.get<any[]>(this.jornadasUrl).pipe(
      tap(data => this.cacheJornadas = data)
    );
  }

  crearJornada(jornada: any): Observable<any> {
    this.cacheJornadas = null;
    return this.http.post<any>(this.jornadasUrl, jornada);
  }

  actualizarJornada(id: number, jornada: any): Observable<any> {
    this.cacheJornadas = null;
    return this.http.put<any>(`${this.jornadasUrl}${id}/`, jornada);
  }

  eliminarJornada(id: number): Observable<any> {
    this.cacheJornadas = null;
    return this.http.delete<any>(`${this.jornadasUrl}${id}/`);
  }

  // SECCIONES DE MENÚ (con caché)
  getSeccionesMenu(forzarRecarga = false): Observable<any[]> {
    if (!forzarRecarga && this.cacheSecciones) {
      return of(this.cacheSecciones);
    }
    return this.http.get<any[]>(this.seccionesMenuUrl).pipe(
      tap(data => this.cacheSecciones = data)
    );
  }

  crearSeccionMenu(seccion: any): Observable<any> {
    this.cacheSecciones = null;
    return this.http.post<any>(this.seccionesMenuUrl, seccion);
  }

  actualizarSeccionMenu(id: number, seccion: any): Observable<any> {
    this.cacheSecciones = null;
    return this.http.put<any>(`${this.seccionesMenuUrl}${id}/`, seccion);
  }

  eliminarSeccionMenu(id: number): Observable<any> {
    this.cacheSecciones = null;
    return this.http.delete<any>(`${this.seccionesMenuUrl}${id}/`);
  }

  // CONTRATOS - SECCION MENÚ
  getContratosSeccionMenu(contratoId?: number): Observable<any[]> {
    const url = contratoId ? `${this.contratosSeccionMenuUrl}?contrato=${contratoId}` : this.contratosSeccionMenuUrl;
    return this.http.get<any[]>(url);
  }

  crearContratoSeccionMenu(data: any): Observable<any> {
    return this.http.post<any>(this.contratosSeccionMenuUrl, data);
  }

  eliminarContratoSeccionMenu(id: number): Observable<any> {
    return this.http.delete<any>(`${this.contratosSeccionMenuUrl}${id}/`);
  }

  // INSTITUCIONES (con caché)
  getInstituciones(forzarRecarga = false): Observable<any[]> {
    if (!forzarRecarga && this.cacheInstituciones) {
      return of(this.cacheInstituciones);
    }
    return this.http.get<any[]>(this.institucionesUrl).pipe(
      tap(data => this.cacheInstituciones = data)
    );
  }

  crearInstitucion(institucion: any): Observable<any> {
    this.cacheInstituciones = null;
    return this.http.post<any>(this.institucionesUrl, institucion);
  }

  actualizarInstitucion(id: number, institucion: any): Observable<any> {
    this.cacheInstituciones = null;
    return this.http.put<any>(`${this.institucionesUrl}${id}/`, institucion);
  }

  eliminarInstitucion(id: number): Observable<any> {
    this.cacheInstituciones = null;
    return this.http.delete<any>(`${this.institucionesUrl}${id}/`);
  }

  // SEDES (con caché para la lista general)
  getSedes(idInstitucion?: number, forzarRecarga = false): Observable<any[]> {
    if (!idInstitucion && !forzarRecarga && this.cacheSedes) {
      return of(this.cacheSedes);
    }
    const url = idInstitucion ? `${this.sedesUrl}?id_institucion=${idInstitucion}` : this.sedesUrl;
    return this.http.get<any[]>(url).pipe(
      tap(data => {
        if (!idInstitucion) {
          this.cacheSedes = data;
        }
      })
    );
  }

  crearSede(sede: any): Observable<any> {
    this.cacheSedes = null;
    return this.http.post<any>(this.sedesUrl, sede);
  }

  actualizarSede(id: number, sede: any): Observable<any> {
    this.cacheSedes = null;
    return this.http.put<any>(`${this.sedesUrl}${id}/`, sede);
  }

  eliminarSede(id: number): Observable<any> {
    this.cacheSedes = null;
    return this.http.delete<any>(`${this.sedesUrl}${id}/`);
  }
}
