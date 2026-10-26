import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.obtenerToken();
  const requestPath = new URL(req.url, 'http://localhost').pathname.replace(/\/+$/, '');
  const isPublicAuthRequest = [
    '/auth/login',
    '/auth/recuperar-password',
    '/auth/confirmar-recuperacion-password',
    '/auth/password-reset/validar-token',
    '/auth/password-reset/confirmar',
  ].some((path) => requestPath.endsWith(path));

  let authReq = req;
  if (token && !isPublicAuthRequest) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isPublicAuthRequest) {
        authService.limpiarSesion();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
