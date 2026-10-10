import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const usuario = authService.obtenerUsuario();
  const rol = authService.normalizarRol(usuario?.rol);
  const rolesPermitidos = route.data['roles'] as string[] | undefined;

  if (rolesPermitidos?.includes(rol)) {
    return true;
  }

  return router.createUrlTree([
    authService.esSupervisor(usuario?.rol)
      ? '/dashboard-supervisor'
      : authService.esJefa(usuario?.rol)
        ? '/asistencia-diaria'
        : '/inicio',
  ]);
};
