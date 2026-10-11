import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  let rol: string;
  const authServiceMock = {
    obtenerUsuario: () => ({ rol }),
    normalizarRol: (value: string | null | undefined) => value?.trim().toLowerCase() ?? '',
    esSupervisor: (value: string | null | undefined) =>
      ['supervisor', 'coordinador', 'coordinador pae'].includes(value?.trim().toLowerCase() ?? ''),
    esJefa: (value: string | null | undefined) =>
      ['jefa de manipuladoras', 'jefa manipuladoras', 'jefamanipuladoras'].includes(value?.trim().toLowerCase() ?? ''),
  };

  beforeEach(() => {
    rol = 'supervisor';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  function routeWithRoles(roles: string[]): ActivatedRouteSnapshot {
    const route = new ActivatedRouteSnapshot();
    Object.defineProperty(route, 'data', { value: { roles } });
    return route;
  }

  it('allows Supervisor on screens assigned to Supervisor and Coordinator PAE', () => {
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(routeWithRoles(['supervisor', 'coordinador pae']), {} as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });

  it('blocks Supervisor from the administration screens', () => {
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(routeWithRoles(['administrador']), {} as RouterStateSnapshot)
    );

    expect(result).toEqual(TestBed.inject(Router).parseUrl('/dashboard-supervisor'));
  });

  it('allows Coordinator PAE as the legacy name for Supervisor', () => {
    rol = 'coordinador pae';

    const result = TestBed.runInInjectionContext(() =>
      roleGuard(routeWithRoles(['supervisor', 'coordinador pae']), {} as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });
});
