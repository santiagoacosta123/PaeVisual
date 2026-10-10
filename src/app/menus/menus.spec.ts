import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MenusComponent } from './menus';
import { PlatosService } from '../services/platos.service';
import { SeccionesMenuService } from '../services/secciones-menu.service';
import { DetallePlatosService } from '../services/detalle-platos.service';
import { MenusService } from '../services/menus.service';
import { SiraeService } from '../services/contratos_pae.service';
import { AuthService } from '../services/auth.service';
import { SweetAlertService } from '../sweet-alert.service';

describe('MenusComponent', () => {
  let component: MenusComponent;
  let fixture: ComponentFixture<MenusComponent>;
  const menusApi = {
    listar: vi.fn(() => of([
      {
        id_menu: 7,
        id_jornada: 2,
        fecha: '2026-10-10',
        ninos_presentes: 25,
        estado: 'ACTIVO',
        informacion_nutricional: 'Equilibrado',
        id_contrato: 4,
      },
    ])),
    crear: vi.fn(() => of({})),
    actualizar: vi.fn(() => of({})),
    eliminar: vi.fn(() => of(undefined)),
  };
  const auth = {
    obtenerUsuario: vi.fn(() => ({
      id_usuario: 16,
      rol: 'JefaManipuladoras',
    })),
    esJefa: vi.fn((rol: string | null | undefined) => rol === 'JefaManipuladoras'),
    normalizarRol: vi.fn((rol: string | null | undefined) => rol?.toLowerCase() ?? ''),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [MenusComponent],
      providers: [
        provideRouter([]),
        {
          provide: PlatosService,
          useValue: {
            getPlatos: vi.fn(() => of([{ id_plato: 8, id_seccion: 3, nombre_plato: 'Sopa', componente: 'Entrada' }])),
            createPlato: vi.fn(() => of({})),
            updatePlato: vi.fn(() => of({})),
            deletePlato: vi.fn(() => of(undefined)),
          },
        },
        { provide: SeccionesMenuService, useValue: { getSecciones: vi.fn(() => of([{ id_seccion: 3, nombre_seccion: 'Almuerzo' }])) } },
        { provide: DetallePlatosService, useValue: { getDetalles: vi.fn(() => of([])), createDetalle: vi.fn(() => of({})), deleteDetalle: vi.fn(() => of(undefined)) } },
        { provide: MenusService, useValue: menusApi },
        { provide: SiraeService, useValue: { getJornadas: vi.fn(() => of([{ id_jornada: 2, nombre_jornada: 'Jornada tarde' }])), getContratos: vi.fn(() => of([{ id_contrato: 4, institucion: 'Escuela Central' }])) } },
        { provide: AuthService, useValue: auth },
        { provide: SweetAlertService, useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), confirm: vi.fn(() => Promise.resolve({ isConfirmed: true })) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MenusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads actual menu records and resolves their jornada and institution', () => {
    expect(component.menus).toHaveLength(1);
    expect(component.menus[0].nombre_jornada).toBe('Jornada tarde');
    expect(component.menus[0].institucion).toBe('Escuela Central');
    expect(component.preparacionesAsignadas).toEqual([]);
  });

  it('saves a menu through the API using the Jefa profile', () => {
    component.menuForm = {
      id_menu: null,
      id_jornada: '2',
      fecha: '2026-10-11',
      ninos_presentes: '25',
      estado: 'ACTIVO',
      informacion_nutricional: 'Equilibrado',
      id_contrato: '4',
    };

    component.guardarTodo();

    expect(menusApi.crear).toHaveBeenCalledWith({
      id_jornada: 2,
      fecha: '2026-10-11',
      ninos_presentes: 25,
      estado: 'ACTIVO',
      informacion_nutricional: 'Equilibrado',
      id_contrato: 4,
    });
  });
});