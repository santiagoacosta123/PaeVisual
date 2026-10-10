import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LoginComponent } from './login';
import { of } from 'rxjs';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  const authServiceMock = {
    login: vi.fn(),
    rolPermitido: vi.fn((rol: string | null | undefined) =>
      rol?.toLowerCase() === 'administrador' || rol?.toLowerCase() === 'supervisor'
    ),
    limpiarSesion: vi.fn(),
    recuperarContrasena: vi.fn(),
    guardarSesion: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows only email and password authentication', () => {
    expect(fixture.nativeElement.textContent).not.toMatch(/Google|continúa con/i);
  });

  it('stores the authenticated profile and opens the application', () => {
    const response = {
      access: 'access-token',
      refresh: 'refresh-token',
      usuario: {
        id_usuario: 12,
        nombre: 'Ana',
        apellido: 'Pérez',
        correo: 'ana@example.com',
        numero_documento: '12345',
        rol: 'Supervisor',
      },
    };
    authServiceMock.login.mockReturnValue(of(response));
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    component.loginForm.setValue({
      correo: response.usuario.correo,
      clave: 'password-seguro',
    });

    component.onSubmit();

    expect(authServiceMock.login).toHaveBeenCalledWith({
      correo: response.usuario.correo,
      clave: 'password-seguro',
    });
    expect(authServiceMock.rolPermitido).toHaveBeenCalledWith('Supervisor');
    expect(authServiceMock.guardarSesion).toHaveBeenCalledWith(response);
    expect(navigate).toHaveBeenCalledWith(['/inicio']);
  });

  it('rejects users whose role does not have access to this web application', () => {
    const response = {
      access: 'access-token',
      refresh: 'refresh-token',
      usuario: {
        id_usuario: 13,
        nombre: 'Luisa',
        apellido: 'Gómez',
        correo: 'manipuladora@example.com',
        numero_documento: '54321',
        rol: 'Manipuladora',
      },
    };
    authServiceMock.login.mockReturnValue(of(response));
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    component.loginForm.setValue({
      correo: response.usuario.correo,
      clave: 'password-seguro',
    });

    component.onSubmit();

    expect(authServiceMock.limpiarSesion).toHaveBeenCalled();
    expect(authServiceMock.guardarSesion).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalledWith(['/inicio']);
    expect(component.errorMensaje).toContain('no tiene permiso');
    expect(component.cargando).toBe(false);
  });

  it('requests a password recovery email for a valid address', () => {
    authServiceMock.recuperarContrasena.mockReturnValue(of({
      mensaje: 'Si el correo está registrado, recibirás un código de verificación.',
    }));
    component.abrirModalRecuperar();
    component.correoRecuperacion = '  ana@example.com  ';

    component.enviarCorreoRecuperacion();

    expect(authServiceMock.recuperarContrasena).toHaveBeenCalledWith({
      correo: 'ana@example.com',
    });
    expect(component.mensajeRecuperacion).toContain('código');
    expect(component.enlaceRecuperacionDesarrollo).toBe('');
    expect(component.enviandoRecuperacion).toBe(false);
  });

  it('continues to the code verification form with the requested email', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    component.correoRecuperacion = 'ana@example.com';

    component.continuarRecuperacion();

    expect(navigate).toHaveBeenCalledWith(['/recuperar-password'], {
      queryParams: { correo: 'ana@example.com' },
    });
  });

  it('shows the local verification code when the backend uses the console mailer', () => {
    authServiceMock.recuperarContrasena.mockReturnValue(of({
      mensaje: 'Si el correo está registrado, recibirás un código de verificación.',
      debug_code: '123456',
    }));
    component.abrirModalRecuperar();
    component.correoRecuperacion = 'ana@example.com';

    component.enviarCorreoRecuperacion();

    expect(component.codigoRecuperacionDesarrollo).toBe('123456');
    expect(component.mensajeRecuperacion).toContain('Código de prueba');
  });

  it('rejects an invalid recovery email without calling the API', () => {
    component.abrirModalRecuperar();
    component.correoRecuperacion = 'no-es-un-correo';

    component.enviarCorreoRecuperacion();

    expect(authServiceMock.recuperarContrasena).not.toHaveBeenCalled();
    expect(component.errorRecuperacion).toContain('válido');
  });
});
