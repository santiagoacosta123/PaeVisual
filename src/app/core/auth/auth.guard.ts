import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

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

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const estaAutenticado = authService.estaAutenticado();
  const usuario = authService.obtenerUsuario();

  if (estaAutenticado && authService.rolPermitido(usuario?.rol)) {
    const rutaDestino = authService.esSupervisor(usuario?.rol)
      ? '/dashboard-supervisor'
      : authService.esJefa(usuario?.rol)
        ? '/asistencia-diaria'
        : '/inicio';
    return router.createUrlTree([rutaDestino]);
  }

  return true;
};
