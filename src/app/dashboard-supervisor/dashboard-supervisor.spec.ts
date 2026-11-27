import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { DashboardSupervisor } from './dashboard-supervisor';

describe('DashboardSupervisor', () => {
  let component: DashboardSupervisor;
  let fixture: ComponentFixture<DashboardSupervisor>;
  const authService = {
    obtenerUsuario: () => null,
    obtenerInstitucionesSupervisor: () => [],
    institucionActiva$: of(null),
    obtenerInstitucionActiva: () => null,
    establecerInstitucionActiva: vi.fn(),
    limpiarInstitucionActiva: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardSupervisor],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: HttpClient, useValue: { get: () => of([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardSupervisor);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('finishes loading when the institutions request completes empty', () => {
    expect(component.cargando).toBe(false);
    expect(component.instituciones).toEqual([]);
  });

  it('shows selected institution name when an institution is active', () => {
    const inst = {
      id_institucion: 8,
      nombre_institucion: 'Institución Central',
      estado: 'ACTIVO',
      nit: '900123456',
      administrador_asignado: { nombre: 'Ana', apellido: 'Gómez' },
      sedes: [{ id_sede: 1, nombre_sede: 'Sede Norte' }, { id_sede: 2, nombre_sede: 'Sede Sur' }],
    };
    component.cargando = false;
    component.errorMensaje = '';
    component.instituciones = [inst];
    component.institucionActiva = inst;
    (component as any).cdr.detectChanges();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Control y seguimiento PAE');
    expect(texto).toContain('2 sedes');
  });

  it('handles institution with empty sedes without crashing', () => {
    const inst = {
      id_institucion: 8,
      nombre_institucion: 'Institución Central',
      estado: '',
      nit: '',
      administrador_asignado: null,
      sedes: [],
    };
    component.cargando = false;
    component.errorMensaje = '';
    component.instituciones = [inst];
    component.institucionActiva = inst;
    (component as any).cdr.detectChanges();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Control y seguimiento PAE');
    expect(texto).toContain('0 sedes');
    expect(component.institucionActiva.sedes).toEqual([]);
  });
});
