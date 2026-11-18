import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ReconocimientoFacialService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/reconocimiento-facial`;

    // Consulta si el usuario autenticado tiene biometría activa registrada
    consultarEstadoBiometria(): Observable<{ tiene_biometria: boolean; correo?: string }> {
        return this.http.get<{ tiene_biometria: boolean; correo?: string }>(`${this.apiUrl}/estado/`);
    }

    // Registra o actualiza el rostro del usuario (si está autenticado toma request.user)
    registrarRostro(imagenBase64: string, correo?: string): Observable<any> {
        const body: { image: string; correo?: string } = { image: imagenBase64 };
        if (correo) {
            body.correo = correo;
        }
        return this.http.post(`${this.apiUrl}/register-face/`, body);
    }

    // Permite al usuario desvincular su biometría facial registrada
    eliminarBiometria(): Observable<any> {
        return this.http.delete(`${this.apiUrl}/eliminar/`);
    }

    // Verifica el rostro escaneado para iniciar sesión
    verificarRostro(imagenBase64: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/verify-face/`, {
            image: imagenBase64
        });
    }
}
