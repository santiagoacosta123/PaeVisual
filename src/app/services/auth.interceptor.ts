import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service'; 

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.obtenerToken();
  const requestPath = new URL(req.url, 'http://localhost').pathname.replace(/\/+$/, '');
  const isPublicAuthRequest = [
    '/auth/login',
    '/auth/recuperar-password',
    '/auth/password-reset/validar-token',
    '/auth/password-reset/confirmar',
  ].some((path) => requestPath.endsWith(path));

  if (token && !isPublicAuthRequest) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }

  return next(req);
};
