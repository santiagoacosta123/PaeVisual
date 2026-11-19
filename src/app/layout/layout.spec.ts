import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LayoutComponent } from './layout';
import { AuthService } from '../services/auth.service';
import { NotificacionService } from '../notificaciones/notificacion.service';
import { SweetAlertService } from '../core/services/sweet-alert.service';

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  const sweetAlertMock = {
    confirm: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    supervisorSuccess: vi.fn(),
    supervisorWarning: vi.fn(),
    supervisorError: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
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
            normalizarRol: (rol: string | null | undefined) => rol?.trim().toLowerCase() ?? '',
            esSuperAdministrador: (rol: string | null | undefined) => rol?.toLowerCase().includes('super') ?? false,
            esSupervisor: (rol: string | null | undefined) => rol?.toLowerCase().includes('supervisor') ?? false,
            esJefa: (rol: string | null | undefined) => rol?.toLowerCase().includes('jefa') ?? false,
            esAdministrador: (rol: string | null | undefined) => {
              const r = rol?.toLowerCase() ?? '';
              return r.includes('admin') && !r.includes('super') && !r.includes('supervisor');
            },
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
        {
          provide: SweetAlertService,
          useValue: sweetAlertMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('displays a visible logout button and executes cerrarSesion immediately', () => {
    const logoutBtn = fixture.nativeElement.querySelector('button[title="Cerrar sesión"]') as HTMLButtonElement;
    expect(logoutBtn).toBeTruthy();
    expect(logoutBtn.textContent).toMatch(/Cerrar Sesión/i);

    const authService = TestBed.inject(AuthService);

    component.cerrarSesion();

    expect(authService.cerrarSesion).toHaveBeenCalledTimes(1);
    expect(component.perfil.nombre).toBe('');
    expect(component.perfil.correo).toBe('');
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
