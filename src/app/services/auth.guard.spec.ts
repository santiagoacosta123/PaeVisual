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

describe('Módulo de Conservación Segura de Sesión (Persistencia de Sesión)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;
  let store: MockStore;

  const tokenValido = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.sig';
  const tokenExpirado = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MDAwMDAwMDB9.sig';

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

  it('Criterio 1 y 5: Almacenamiento local seguro y Cero contraseñas en texto plano', () => {
    const payloadConClaveInsegura: any = {
      id_usuario: 42,
      nombre: 'Lucía',
      apellido: 'Méndez',
      correo: 'lucia@sirae.com',
      numero_documento: '55443322',
      rol: 'Administrador',
      is_active: true,
      password: 'TextoPlanoSuperSecreto123!',
      clave: '12345678',
      contrasena: 'password-sensible',
    };

    service.guardarSesion({
      access: tokenValido,
      refresh: 'refresh-42',
      usuario: payloadConClaveInsegura,
    });

    expect(localStorage.getItem('access_token')).toBe(tokenValido);
    expect(localStorage.getItem('refresh_token')).toBe('refresh-42');

    const usuarioRaw = localStorage.getItem('usuario') || '';
    expect(usuarioRaw).not.toContain('TextoPlanoSuperSecreto123!');
    expect(usuarioRaw).not.toContain('12345678');
    expect(usuarioRaw).not.toContain('password-sensible');

    const usuarioRecuperado = service.obtenerUsuario();
    expect(usuarioRecuperado?.id_usuario).toBe(42);
    expect(usuarioRecuperado?.correo).toBe('lucia@sirae.com');
    expect(usuarioRecuperado?.rol).toBe('Administrador');
    expect((usuarioRecuperado as any).password).toBeUndefined();
    expect((usuarioRecuperado as any).clave).toBeUndefined();
    expect((usuarioRecuperado as any).contrasena).toBeUndefined();
  });

  it('Criterio 2: Restauración y rehidratación automática de la sesión al recargar la app', () => {
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    localStorage.setItem('access_token', tokenValido);
    localStorage.setItem('refresh_token', 'refresh-token-restored');
    localStorage.setItem(
      'usuario',
      JSON.stringify({
        id_usuario: 50,
        nombre: 'Andrés',
        apellido: 'Castro',
        correo: 'andres@sirae.com',
        numero_documento: '77889900',
        rol: 'Supervisor',
        is_active: true,
        institucion_nombre: 'Institución Educativa Norte',
      })
    );
    localStorage.setItem(
      'sirae_institucion_activa',
      JSON.stringify({
        id_institucion: 3,
        nombre_institucion: 'Sede Principal Norte',
      })
    );

    const restaurada = service.restaurarSesion();
    expect(restaurada).toBe(true);
    expect(service.estaAutenticado()).toBe(true);
    expect(service.obtenerUsuario()?.correo).toBe('andres@sirae.com');
    expect(service.obtenerInstitucionActiva()?.nombre_institucion).toBe('Sede Principal Norte');

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[Auth] Login',
        username: 'andres@sirae.com',
        token: tokenValido,
        rol: 'Supervisor',
      })
    );
  });

  it('Criterio 3: Validación activa con el backend al inicializar la aplicación (/auth/verify/)', () => {
    localStorage.setItem('access_token', tokenValido);
    localStorage.setItem(
      'usuario',
      JSON.stringify({
        id_usuario: 60,
        nombre: 'Paola',
        apellido: 'Reyes',
        correo: 'paola@sirae.com',
        numero_documento: '11223344',
        rol: 'Administrador',
        is_active: true,
      })
    );

    let resultadoValidacion: boolean | undefined;
    service.verificarSesionInicial().subscribe((val) => {
      resultadoValidacion = val;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/verify/`);
    expect(req.request.method).toBe('GET');
    req.flush({
      valido: true,
      usuario: {
        id_usuario: 60,
        nombre: 'Paola',
        apellido: 'Reyes',
        correo: 'paola@sirae.com',
        numero_documento: '11223344',
        rol: 'Administrador',
        is_active: true,
        institucion_nombre: 'Institución Central',
      },
    });

    expect(resultadoValidacion).toBe(true);
    expect(service.estaAutenticado()).toBe(true);
    expect(service.obtenerUsuario()?.institucion_nombre).toBe('Institución Central');
  });

  it('Criterio 4: Manejo de sesiones inválidas o revocadas en el backend con limpieza y redirección a /login', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    localStorage.setItem('access_token', tokenValido);
    localStorage.setItem(
      'usuario',
      JSON.stringify({
        id_usuario: 70,
        nombre: 'Usuario',
        apellido: 'Revocado',
        correo: 'revocado@sirae.com',
        numero_documento: '990011',
        rol: 'Administrador',
      })
    );

    let resultadoValidacion: boolean | undefined;
    service.verificarSesionInicial().subscribe((val) => {
      resultadoValidacion = val;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/verify/`);
    req.flush({ detail: 'Token inválido o sesión revocada.' }, { status: 401, statusText: 'Unauthorized' });

    expect(resultadoValidacion).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('usuario')).toBeNull();
    expect(service.estaAutenticado()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });

  it('Criterio 4: Token expirado localmente dispara limpieza inmediata sin requerir petición remota', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    localStorage.setItem('access_token', tokenExpirado);
    localStorage.setItem(
      'usuario',
      JSON.stringify({
        id_usuario: 80,
        correo: 'expirado@sirae.com',
        rol: 'Supervisor',
      })
    );

    let resultadoValidacion: boolean | undefined;
    service.verificarSesionInicial().subscribe((val) => {
      resultadoValidacion = val;
    });

    httpMock.expectNone(`${environment.apiUrl}/auth/verify/`);

    expect(resultadoValidacion).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('usuario')).toBeNull();
    expect(service.estaAutenticado()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });
});
