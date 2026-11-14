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
  let post: ReturnType<typeof vi.fn>;
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
    post = vi.fn(() => of({ mensaje: 'Configuración guardada correctamente.', jornadas: [] }));
    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: { get, post, put: vi.fn() } },
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

  it('posts only enabled jornadas and positive grado cupos to /configuracion/', () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/jornadas/')) {
        return of([
          { id_jornada: 2, nombre_jornada: 'Mañana', estado: 'ACTIVA' },
          { id_jornada: 3, nombre_jornada: 'Tarde', estado: 'ACTIVA' },
        ]);
      }
      if (url.includes('/grados/')) {
        return of([
          { id_grado: 1, nombre_grado: 'Primero', estado: 'ACTIVO' },
          { id_grado: 2, nombre_grado: 'Segundo', estado: 'ACTIVO' },
          { id_grado: 3, nombre_grado: 'Archivado', estado: 'INACTIVO' },
        ]);
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
            secciones: [],
            grados: [{ id_grado: 1, nombre_grado: 'Primero', cupos: 40 }],
          }],
        });
      }
      return of(sedes);
    });

    component.ngOnInit();
    component.seleccionarSede(sedes[0]);
    expect(component.gradosDisponibles.map(g => g.id_grado)).toEqual([1, 2]);
    expect(component.configuracion?.jornadas[0].grados.map(g => g.id_grado)).toEqual([1, 2]);

    component.guardarConfiguracion();

    expect(post).toHaveBeenCalledWith(
      `${environment.apiUrl}/sedes/11/configuracion/`,
      expect.objectContaining({
        id_sede: 11,
        jornadas: [
          expect.objectContaining({
            id_jornada: 2,
            cupos: 40,
            grados: [{ id_grado: 1, nombre_grado: 'Primero', cupos: 40 }],
          }),
        ],
      }),
    );
    expect(component.mensajeGuardado).toContain('Configuración guardada correctamente');
  });

  it('does not display unassigned catalog jornadas when only Mañana is authorized for the sede', () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/jornadas/')) {
        return of([
          { id_jornada: 2, nombre_jornada: 'Mañana', estado: 'ACTIVA' },
          { id_jornada: 3, nombre_jornada: 'Tarde', estado: 'ACTIVA' },
          { id_jornada: 4, nombre_jornada: 'Jornada Única', estado: 'ACTIVA' },
        ]);
      }
      if (url.includes('/grados/')) {
        return of([{ id_grado: 1, nombre_grado: 'Primero', estado: 'ACTIVO' }]);
      }
      if (url.includes('/sedes/11/configuracion/')) {
        return of({
          sede: sedes[0],
          cupos_totales: 50,
          jornadas: [{
            id_jornada: 2,
            nombre_jornada: 'Mañana',
            cupos: 50,
            habilitada: true,
            secciones: [{ id_seccion: 1, nombre_seccion: 'Desayuno', estado: 'ACTIVA' }],
            grados: [{ id_grado: 1, nombre_grado: 'Primero', cupos: 0 }],
          }],
        });
      }
      return of(sedes);
    });

    component.ngOnInit();
    component.seleccionarSede(sedes[0]);

    // Debe contener únicamente la jornada Mañana autorizada por el contrato, NO la tarde ni única
    expect(component.configuracion?.jornadas.length).toBe(1);
    expect(component.configuracion?.jornadas[0].nombre_jornada).toBe('Mañana');
    expect(component.configuracion?.jornadas.some(j => j.nombre_jornada === 'Tarde')).toBe(false);
  });

  it('allows assigning cupos to grades and auto-adjusts jornada cupos without resetting to zero', () => {
    get.mockImplementation((url: string) => {
      if (url.includes('/jornadas/')) {
        return of([{ id_jornada: 2, nombre_jornada: 'Mañana', estado: 'ACTIVA' }]);
      }
      if (url.includes('/grados/')) {
        return of([
          { id_grado: 1, nombre_grado: 'Primero', estado: 'ACTIVO' },
          { id_grado: 2, nombre_grado: 'Segundo', estado: 'ACTIVO' },
        ]);
      }
      if (url.includes('/sedes/11/configuracion/')) {
        return of({
          sede: sedes[0],
          cupos_totales: 50,
          jornadas: [{
            id_jornada: 2,
            nombre_jornada: 'Mañana',
            cupos: 0,
            habilitada: true,
            secciones: [],
            grados: [
              { id_grado: 1, nombre_grado: 'Primero', cupos: 0 },
              { id_grado: 2, nombre_grado: 'Segundo', cupos: 0 },
            ],
          }],
        });
      }
      return of(sedes);
    });

    component.ngOnInit();
    component.seleccionarSede(sedes[0]);

    const jornada = component.configuracion!.jornadas[0];
    const grado1 = jornada.grados[0];
    const grado2 = jornada.grados[1];

    // jornada.cupos se inicializa automáticamente en 50 porque es la única jornada y tiene 50 cupos en contrato
    expect(jornada.cupos).toBe(50);

    // Asignar 30 al grado 1: no debe quedar en 0, debe quedar en 30
    component.actualizarCupoGrado(jornada, grado1, '30');
    expect(grado1.cupos).toBe(30);
    expect(jornada.cupos).toBe(50);

    // Asignar 20 al grado 2: debe quedar en 20
    component.actualizarCupoGrado(jornada, grado2, '20');
    expect(grado2.cupos).toBe(20);
    expect(jornada.cupos).toBe(50);
    expect(component.calcularSumaGrados(jornada)).toBe(50);
  });
});
