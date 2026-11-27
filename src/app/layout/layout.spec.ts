import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { LayoutComponent } from './layout';
import { AuthService } from '../core/auth/auth.service';
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
        provideHttpClient(),
        {
          provide: AuthService,
          useValue: {
            estaAutenticado: () => true,
            obtenerToken: () => 'fake-token',
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
            obtenerSedeActiva: () => null,
            sedeActiva$: of(null),
            establecerSedeActiva: vi.fn(),
            obtenerInstitucionesSupervisor: () => [],
            obtenerInstitucionActiva: () => null,
            institucionActiva$: of(null),
            limpiarInstitucionActiva: vi.fn(),
            actualizarInstitucionActiva: vi.fn(),
            establecerInstitucionActiva: vi.fn(),
          },
        },
        {
          provide: NotificacionService,
          useValue: {
            obtenerNotificaciones: vi.fn(() => of([
              {
                id_notificacion: 10,
                titulo: 'Entrega programada',
                mensaje: 'Llegó remisión de alimentos.',
                leida: false,
                fecha_hora: '2026-11-25T16:00:00Z',
              },
              {
                id_notificacion: 11,
                titulo: 'Aviso anterior',
                mensaje: 'Ya revisado.',
                leida: true,
                fecha_hora: '2026-11-24T12:00:00Z',
              },
            ])),
            marcarComoLeida: vi.fn(() => of({})),
            marcarComoNoLeida: vi.fn(() => of({})),
            marcarTodasComoLeidas: vi.fn(() => of([])),
            tiempoRelativo: () => 'Hace un momento',
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

  it('opens a notification in modal without backdrop blocking and marks it read on close', () => {
    const bellBtn = fixture.nativeElement.querySelector('.saas-notif-bell-btn') as HTMLButtonElement;
    expect(bellBtn).toBeTruthy();

    bellBtn.click();
    fixture.detectChanges();

    expect(component.mostrarNotificaciones).toBe(true);
    // El backdrop invisible no debe cubrir ni bloquear el dropdown de notificaciones
    expect(fixture.nativeElement.querySelector('.popover-backdrop')).toBeNull();

    const rows = fixture.nativeElement.querySelectorAll('.saas-notif-row');
    expect(rows.length).toBe(2);

    // Clic en la primera notificación (no leída): abre el modal sin salir de la pantalla
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    expect(component.notificacionAbierta?.id_notificacion).toBe(10);
    expect(component.notificacionAbierta?.leida).toBe(false);
    expect(fixture.nativeElement.querySelector('.saas-notif-modal-card')).toBeTruthy();

    // Al cerrar el modal, pasa a leídas y actualiza contadores de historial
    const notificacionService = TestBed.inject(NotificacionService);
    component.cerrarNotificacionAbierta();
    fixture.detectChanges();

    expect(component.notificacionAbierta).toBeNull();
    expect(notificacionService.marcarComoLeida).toHaveBeenCalledWith(10);
    expect(component.notificacionesNoLeidas).toBe(0);
    expect(component.notificacionesLeidas).toBe(2);
  });
});
