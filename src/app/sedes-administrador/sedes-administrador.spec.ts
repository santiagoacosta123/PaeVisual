import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { SedesAdministradorComponent } from './sedes-administrador';
import { AuthService } from '../core/auth/auth.service';

describe('SedesAdministradorComponent', () => {
  let component: SedesAdministradorComponent;
  let get: ReturnType<typeof vi.fn>;
  let obtenerUsuario: ReturnType<typeof vi.fn>;

  const sedes = [
    {
      id_sede: 11,
      nombre_sede: 'Sede Central',
      codigo_dane: '12345',
      direccion: 'Calle 1',
      telefono: '3000000000',
      estado: 'ACTIVO',
      institucion_nombre: 'Institución de prueba',
    },
  ];

  beforeEach(() => {
    get = vi.fn((url: string) => {
      if (url.includes('/jornadas/')) {
        return of([{ id_jornada: 2, nombre_jornada: 'Mañana', estado: 'ACTIVA' }]);
      }
      if (url.includes('/grados/')) {
        return of([{ id_grado: 1, nombre_grado: 'Primero' }]);
      }
      if (url.includes('/sedes/11/configuracion/')) {
        return of({
          sede: sedes[0],
          cupos_totales: 40,
          jornadas: [{
            id_jornada: 2,
            nombre_jornada: 'Mañana',
            cupos: 40,
            habilitada: true,
            secciones: [{ id_seccion: 5, nombre_seccion: 'Almuerzo', estado: 'ACTIVA' }],
            grados: [{ id_grado: 1, nombre_grado: 'Primero', cupos: 40 }],
          }],
        });
      }
      return of(sedes);
    });

    obtenerUsuario = vi.fn(() => ({
      institucion_nombre: 'Institución asignada al administrador',
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: { get, post: vi.fn(), put: vi.fn() } },
        { provide: AuthService, useValue: { obtenerUsuario } },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new SedesAdministradorComponent());
  });

  it('loads the institution-scoped sede list and displays active status', () => {
    component.ngOnInit();

    expect(get).toHaveBeenCalledWith(`${environment.apiUrl}/sedes/`);
    expect(component.sedes).toEqual(sedes);
    expect(component.sedeEstaActiva(component.sedes[0].estado)).toBe(true);
    expect(component.institucionAsignada).toBe('Institución asignada al administrador');
  });

  it('loads sedes from a paginated API response and finishes the loading state', () => {
    get.mockImplementationOnce(() => of([{ id_jornada: 2, nombre_jornada: 'Mañana', estado: 'ACTIVA' }]))
      .mockImplementationOnce(() => of([{ id_grado: 1, nombre_grado: 'Primero' }]))
      .mockImplementationOnce(() => of({
        count: 1,
        next: null,
        previous: null,
        results: sedes,
      }));

    component.ngOnInit();

    expect(component.sedes).toEqual(sedes);
    expect(component.sedes[0].nombre_sede).toBe('Sede Central');
    expect(component.cargandoSedes).toBe(false);
  });

  it('uses the institution returned with the sede when the user profile has no name', () => {
    obtenerUsuario.mockReturnValue({ institucion: '', institucion_nombre: '' });
    component.sedes = sedes;

    expect(component.institucionAsignada).toBe('Institución de prueba');
  });

  it('loads read-only detail with contract cupos and configured jornadas', () => {
    component.ngOnInit();
    component.seleccionarSede(sedes[0]);

    expect(get).toHaveBeenCalledWith(`${environment.apiUrl}/sedes/11/configuracion/`);
    expect(component.configuracion?.cupos_totales).toBe(40);
    expect(component.configuracion?.jornadas[0].secciones[0].nombre_seccion).toBe('Almuerzo');
  });

  it('supports empty configuration and refreshing updated data', () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/jornadas/')) {
        return of([]);
      }
      if (url.includes('/grados/')) {
        return of([]);
      }
      if (url.includes('/sedes/11/configuracion/')) {
        return of({ sede: sedes[0], cupos_totales: 0, jornadas: [] });
      }
      return of(sedes);
    });

    component.ngOnInit();
    component.seleccionarSede(sedes[0]);
    component.actualizar();

    expect(component.configuracion?.cupos_totales).toBe(0);
    expect(component.configuracion?.jornadas).toEqual([]);
  });
});
