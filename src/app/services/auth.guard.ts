import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {

  const authService = inject(AuthService);
  const router = inject(Router);

  const estaAutenticado = authService.estaAutenticado();

  if (estaAutenticado && authService.rolPermitido(authService.obtenerUsuario()?.rol)) {
    return true;
  }

  if (estaAutenticado) {
    authService.limpiarSesion();
  }

  return router.createUrlTree(['/login'], {
    queryParams: estaAutenticado ? { acceso: 'denegado' } : undefined,
  });
};
