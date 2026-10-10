import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LayoutComponent } from './layout';
import { AuthService } from '../services/auth.service';
import { NotificacionService } from '../notificaciones/notificacion.service';

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            obtenerUsuario: () => ({
              nombre: 'Ana',
              apellido: 'Pérez',
              correo: 'ana@example.com',
              rol: 'Administrador',
            }),
            cerrarSesion: vi.fn(),
            cambiarContrasena: vi.fn(),
          },
        },
        {
          provide: NotificacionService,
          useValue: {
            obtenerNotificaciones: () => of([]),
            marcarTodasComoLeidas: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('updates the password through the authenticated service', () => {
    const authService = TestBed.inject(AuthService);
    vi.mocked(authService.cambiarContrasena).mockReturnValue(of({
      status: 'success',
      mensaje: 'Contraseña actualizada.',
    }));
    component.passwordForm = {
      actual: 'clave-anterior',
      nueva: 'clave-nueva-segura',
      confirmar: 'clave-nueva-segura',
    };

    component.guardarPassword();

    expect(authService.cambiarContrasena).toHaveBeenCalledWith({
      password_actual: 'clave-anterior',
      nueva_password: 'clave-nueva-segura',
      confirmar_password: 'clave-nueva-segura',
    });
    expect(component.passwordMensaje).toBe('Contraseña actualizada.');
    expect(component.passwordForm.actual).toBe('');
  });
});