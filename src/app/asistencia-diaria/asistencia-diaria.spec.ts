import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AsistenciaDiariaComponent } from './asistencia-diaria';
import { AsistenciaDiariaService } from '../services/asistencia-diaria.service';
import { AuthService } from '../services/auth.service';
import { SweetAlertService } from '../sweet-alert.service';

describe('AsistenciaDiariaComponent', () => {
  let component: AsistenciaDiariaComponent;
  let fixture: ComponentFixture<AsistenciaDiariaComponent>;
  const asistenciaApi = {
    getAsistencias: vi.fn(() => of([])),
    getGrados: vi.fn(() => of([{ id_grado: 2, nombre_grado: 'Segundo' }])),
    registrar: vi.fn(() => of({
      id_asistencia: 3,
      id_grado: 2,
      fecha: '2026-10-10',
      ninos_presentes: 21,
      id_usuario_manipuladora: 16,
    })),
    actualizar: vi.fn(() => of({})),
    eliminar: vi.fn(() => of(undefined)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [AsistenciaDiariaComponent],
      providers: [
        { provide: AsistenciaDiariaService, useValue: asistenciaApi },
        { provide: AuthService, useValue: { obtenerUsuario: () => ({ id_usuario: 16 }) } },
        { provide: SweetAlertService, useValue: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), confirm: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AsistenciaDiariaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads the attendance list and grade catalog', () => {
    expect(asistenciaApi.getAsistencias).toHaveBeenCalled();
    expect(component.grados).toEqual([{ id_grado: 2, nombre_grado: 'Segundo' }]);
    expect(component.cargando).toBe(false);
  });

  it('registers the count with the authenticated Jefa user', () => {
    component.formulario = {
      id_grado: '2',
      fecha: '2026-10-10',
      ninos_presentes: '21',
    };

    component.guardar();

    expect(asistenciaApi.registrar).toHaveBeenCalledWith({
      id_grado: 2,
      fecha: '2026-10-10',
      ninos_presentes: 21,
      id_usuario_manipuladora: 16,
    });
  });
});
