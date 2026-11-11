import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { NotificacionService } from './notificacion.service';
import { NotificacionesComponent } from './notificaciones.component';

describe('NotificacionesComponent', () => {
  let fixture: ComponentFixture<NotificacionesComponent>;
  const notificacionService = {
    obtenerNotificaciones: vi.fn(() => of([{
      id_notificacion: 3,
      titulo: 'Evidencia de entrega',
      mensaje: 'Adjunto fotografía del producto recibido.',
      leida: false,
      imagen_url: 'https://res.cloudinary.com/sirae/image/upload/evidencia.png',
    }])),
    obtenerDestinatarios: vi.fn(() => of([])),
    enviarNotificacion: vi.fn(() => of({ cantidad_destinatarios: 1, resultados: [] })),
    marcarComoLeida: vi.fn(() => of({})),
    eliminarNotificacion: vi.fn(() => of({})),
  };
  const authService = {
    obtenerUsuario: vi.fn(() => ({ rol: 'Manipuladora' })),
    normalizarRol: vi.fn((rol: string | null | undefined) => rol?.toLowerCase() ?? ''),
    esAdministrador: vi.fn(() => false),
    esSupervisor: vi.fn(() => false),
    esJefa: vi.fn(() => false),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [NotificacionesComponent],
      providers: [
        { provide: NotificacionService, useValue: notificacionService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificacionesComponent);
    fixture.detectChanges();
  });

  it('renders the attached image inside the notification message', () => {
    const message = fixture.nativeElement.querySelector('tbody tr td:nth-child(2)');
    const image = message.querySelector('img');

    expect(message.textContent).toContain('Adjunto fotografía del producto recibido.');
    expect(message.textContent).toContain('Fotografía adjunta');
    expect(image.getAttribute('src')).toBe(
      'https://res.cloudinary.com/sirae/image/upload/evidencia.png',
    );
    expect(message.querySelector('a').getAttribute('href')).toBe(
      'https://res.cloudinary.com/sirae/image/upload/evidencia.png',
    );
  });
});
