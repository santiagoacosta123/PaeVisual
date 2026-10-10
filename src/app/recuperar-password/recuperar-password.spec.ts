import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { RecuperarPasswordComponent } from './recuperar-password';

describe('RecuperarPasswordComponent', () => {
  let component: RecuperarPasswordComponent;
  let fixture: ComponentFixture<RecuperarPasswordComponent>;
  const authServiceMock = {
    validarTokenRecuperacion: vi.fn(),
    confirmarRecuperacionContrasena: vi.fn(),
    confirmarRecuperacionCodigo: vi.fn(),
  };
  const routeMock = {
    snapshot: {
      queryParamMap: {
        get: vi.fn(),
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    routeMock.snapshot.queryParamMap.get.mockReturnValue('token-de-prueba');
    authServiceMock.validarTokenRecuperacion.mockReturnValue(of({ valido: true }));

    await TestBed.configureTestingModule({
      imports: [RecuperarPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecuperarPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('validates the token from the recovery link', () => {
    expect(authServiceMock.validarTokenRecuperacion).toHaveBeenCalledWith('token-de-prueba');
    expect(component.tokenValido).toBe(true);
  });

  it('submits matching passwords with the validated token', () => {
    authServiceMock.confirmarRecuperacionContrasena.mockReturnValue(of({
      status: 'success',
      mensaje: 'Contraseña restablecida.',
    }));
    component.nuevaPassword = 'nueva-clave-segura';
    component.confirmarPassword = 'nueva-clave-segura';

    component.restablecerContrasena();

    expect(authServiceMock.confirmarRecuperacionContrasena).toHaveBeenCalledWith({
      token: 'token-de-prueba',
      nueva_password: 'nueva-clave-segura',
      confirmar_password: 'nueva-clave-segura',
    });
    expect(component.completado).toBe(true);
  });

  it('submits the recovery code with the matching passwords', () => {
    authServiceMock.confirmarRecuperacionCodigo.mockReturnValue(of({
      mensaje: 'Contraseña restablecida.',
    }));
    component.token = null;
    component.correo = 'ana@example.com';
    component.codigo = '123456';
    component.modoCodigo = true;
    component.tokenValido = true;
    component.nuevaPassword = 'nueva-clave-segura';
    component.confirmarPassword = 'nueva-clave-segura';

    component.restablecerContrasena();

    expect(authServiceMock.confirmarRecuperacionCodigo).toHaveBeenCalledWith({
      correo: 'ana@example.com',
      codigo: '123456',
      nueva_password: 'nueva-clave-segura',
      confirmar_password: 'nueva-clave-segura',
    });
    expect(component.completado).toBe(true);
  });

  it('does not submit when the passwords do not match', () => {
    component.nuevaPassword = 'nueva-clave-segura';
    component.confirmarPassword = 'otra-clave-segura';

    component.restablecerContrasena();

    expect(authServiceMock.confirmarRecuperacionContrasena).not.toHaveBeenCalled();
    expect(component.errorMensaje).toContain('no coinciden');
  });
});
