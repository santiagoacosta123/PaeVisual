import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.obtenerToken();

  const backendHost = 'https://backend-sirae-pyim.onrender.com';
  let normalizedUrl = req.url
    .replace(/^http:\/\/(localhost|127\.0\.0\.1):8000/i, backendHost)
    .replace(/^https:\/\/backend-sirae-t9zi\.onrender\.com/i, backendHost);

  if (
    normalizedUrl.startsWith(backendHost) &&
    !normalizedUrl.startsWith(`${backendHost}/api/`) &&
    !normalizedUrl.startsWith(`${backendHost}/api`) &&
    !normalizedUrl.startsWith(`${backendHost}/media/`)
  ) {
    normalizedUrl = normalizedUrl.replace(backendHost, `${backendHost}/api`);
  }

  const requestPath = new URL(normalizedUrl, 'http://localhost').pathname.replace(/\/+$/, '');
  const isPublicAuthRequest = [
    '/auth/login',
    '/auth/recuperar-password',
    '/auth/confirmar-recuperacion-password',
    '/auth/password-reset/validar-token',
    '/auth/password-reset/confirmar',
  ].some((path) => requestPath.endsWith(path));

  let authReq = req;
  const urlChanged = normalizedUrl !== req.url;
  const needsAuth = Boolean(token && !isPublicAuthRequest && !req.headers.has('Authorization'));

  if (urlChanged || needsAuth) {
    authReq = req.clone({
      ...(urlChanged ? { url: normalizedUrl } : {}),
      ...(needsAuth ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isPublicAuthRequest) {
        authService.limpiarSesion();
        router.navigate(['/login'], { replaceUrl: true });
      }
      return throwError(() => error);
    })
  );
};
