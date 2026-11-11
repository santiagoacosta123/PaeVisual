import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { AuthService } from './auth.service';
import { authGuard, guestGuard } from './auth.guard';
import { environment } from '../../environments/environment';
import { logout } from '../store/action';

describe('authGuard & guestGuard', () => {
  let authenticated: boolean;
  let role: string | null;
  const authServiceMock = {
    estaAutenticado: () => authenticated,
    obtenerUsuario: () => role ? { rol: role } : null,
    esSupervisor: (value: string | null | undefined) =>
      ['supervisor', 'coordinador', 'coordinador pae'].includes(value?.trim().toLowerCase() ?? ''),
    esJefa: (value: string | null | undefined) =>
      ['jefa de manipuladoras', 'jefa manipuladoras', 'jefamanipuladoras'].includes(value?.trim().toLowerCase() ?? ''),
    rolPermitido: (value: string | null | undefined) => {
      const normalized = value
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

      return normalized === 'administrador'
        || normalized === 'supervisor'
        || normalized === 'coordinador'
        || normalized === 'coordinador pae'
        || normalized === 'jefa de manipuladoras'
        || normalized === 'jefa manipuladoras'
        || normalized === 'jefamanipuladoras';
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

  it.each(['Administrador', 'Supervisor', 'Jefa de manipuladoras', 'JefaManipuladoras'])('allows the %s role', (allowedRole) => {
    role = allowedRole;

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toBe(true);
    expect(authServiceMock.limpiarSesion).not.toHaveBeenCalled();
  });

  it('allows the legacy Coordinator role as Supervisor-equivalent', () => {
    role = 'Coordinador PAE';

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toBe(true);
    expect(authServiceMock.limpiarSesion).not.toHaveBeenCalled();
  });

  it.each(['Manipuladora'])('blocks the %s role', (deniedRole) => {
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

  it('guestGuard redirects already authenticated users from /login to their role dashboard', () => {
    authenticated = true;
    role = 'Supervisor';

    const result = TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toEqual(TestBed.inject(Router).parseUrl('/dashboard-supervisor'));
  });

  it('guestGuard allows unauthenticated users to access /login', () => {
    authenticated = false;

    const result = TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });
});

describe('AuthService - Cierre de Sesión (Logout)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;
  let store: MockStore;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore(),
        AuthService,
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    store = TestBed.inject(MockStore);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('revokes the session on the backend, clears tokens/user data in storage and memory, and redirects to /login with replaceUrl', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    service.guardarSesion({
      access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.sig',
      refresh: 'valid-refresh-token',
      usuario: {
        id_usuario: 10,
        nombre: 'Carlos',
        apellido: 'Ruiz',
        correo: 'carlos@sirae.com',
        numero_documento: '100200300',
        rol: 'Supervisor',
      },
    });
    service.establecerInstitucionActiva({
      id_institucion: 5,
      nombre_institucion: 'Colegio Central',
    });
    service.establecerSedeActiva({
      id_sede: 8,
      nombre_sede: 'Sede Norte',
    });
    sessionStorage.setItem('temp_credential', 'secret');

    service.cerrarSesion();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refresh: 'valid-refresh-token' });
    expect(req.request.headers.get('Authorization')).toContain('Bearer ');
    req.flush({ mensaje: 'Sesión cerrada correctamente.' });

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('usuario')).toBeNull();
    expect(localStorage.getItem('sirae_institucion_activa')).toBeNull();
    expect(localStorage.getItem('sirae_sede_activa')).toBeNull();
    expect(sessionStorage.getItem('temp_credential')).toBeNull();

    expect(service.obtenerUsuario()).toBeNull();
    expect(service.obtenerInstitucionActiva()).toBeNull();
    expect(service.obtenerSedeActiva()).toBeNull();
    expect(service.estaAutenticado()).toBe(false);
    expect(dispatchSpy).toHaveBeenCalledWith(logout());
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });

    // Verificar que tras cerrar sesión el guard impide regresar a pantallas privadas
    const guardResult = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(guardResult).toEqual(router.parseUrl('/login'));
  });

  it('cleans all local data and blocks private screens even if the backend logout request fails', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    service.guardarSesion({
      access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.sig',
      refresh: 'refresh-token-on-error',
      usuario: {
        id_usuario: 11,
        nombre: 'Elena',
        apellido: 'Gómez',
        correo: 'elena@sirae.com',
        numero_documento: '998877',
        rol: 'Administrador',
      },
    });

    service.cerrarSesion();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout/`);
    req.flush({ detail: 'Error interno del servidor' }, { status: 500, statusText: 'Server Error' });

    expect(service.obtenerToken()).toBeNull();
    expect(service.obtenerRefreshToken()).toBeNull();
    expect(service.obtenerUsuario()).toBeNull();
    expect(service.estaAutenticado()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });

    const guardResult = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(guardResult).toEqual(router.parseUrl('/login'));
  });
});
