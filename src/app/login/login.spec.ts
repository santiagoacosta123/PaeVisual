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
});
