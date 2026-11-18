import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ReconocimientoFacialService {
    private http = inject(HttpClient);
    // Usa la URL base de tu backend configurada en environments
    private apiUrl = `${environment.apiUrl}/reconocimiento-facial`;

    // Equivalente a capture('/register-face') del React de tu instructora
    registrarRostro(correo: string, imagenBase64: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/register-face/`, {
            correo: correo,
            image: imagenBase64
        });
    }

    // Equivalente a capture('/verify-face') del React de tu instructora
    verificarRostro(imagenBase64: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/verify-face/`, {
            image: imagenBase64
        });
    }
}