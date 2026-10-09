import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let authenticated: boolean;
  let role: string | null;
  const authServiceMock = {
    estaAutenticado: () => authenticated,
    obtenerUsuario: () => role ? { rol: role } : null,
    rolPermitido: (value: string | null | undefined) => {
      const normalized = value
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

      return normalized === 'administrador' || normalized === 'supervisor';
    },
    limpiarSesion: vi.fn(),
  };

  beforeEach(() => {
    authenticated = true;
    role = 'Supervisor';
    authServiceMock.limpiarSesion.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  it.each(['Administrador', 'Supervisor'])('allows the %s role', (allowedRole) => {
    role = allowedRole;

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toBe(true);
    expect(authServiceMock.limpiarSesion).not.toHaveBeenCalled();
  });

  it.each(['Manipuladora', 'Jefa de manipuladoras'])('blocks the %s role', (deniedRole) => {
    role = deniedRole;

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toEqual(
      TestBed.inject(Router).parseUrl('/login?acceso=denegado')
    );
    expect(authServiceMock.limpiarSesion).toHaveBeenCalled();
  });

  it('redirects unauthenticated users to login without treating them as role-denied', () => {
    authenticated = false;

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toEqual(TestBed.inject(Router).parseUrl('/login'));
    expect(authServiceMock.limpiarSesion).not.toHaveBeenCalled();
  });
});
