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
import { RecetaComponentesService } from '../services/receta-componentes.service';
import { SugerenciasRecetasService } from '../services/sugerencias-recetas.service';
import { ProductoService } from '../features/inventario/services/producto.service';

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
  const recetaApi = {
    listar: vi.fn(() => of([])),
    crear: vi.fn(() => of({})),
    actualizar: vi.fn(() => of({})),
    eliminar: vi.fn(() => of(undefined)),
  };
  const sugerenciasApi = {
    sugerir: vi.fn(() => of({
      id_menu: 7,
      id_plato: 8,
      nombre_plato: 'Sopa',
      ninos_presentes: 25,
      ingredientes: [],
      es_sugerencia: true as const,
    })),
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
        { provide: RecetaComponentesService, useValue: recetaApi },
        { provide: SugerenciasRecetasService, useValue: sugerenciasApi },
        { provide: ProductoService, useValue: { getIngredientes: vi.fn(() => of([])) } },
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

  it('shows an optional recipe suggestion without saving changes to the recipe', () => {
    component.abrirDetalle({ id_plato: 8, nombre_plato: 'Sopa', componente: 'Entrada' });
    component.menuSugerenciaId = 7;

    component.solicitarSugerenciaReceta();

    expect(sugerenciasApi.sugerir).toHaveBeenCalledWith(7, 8);
    expect(component.mostrarSugerenciaReceta).toBe(true);
    expect(component.sugerenciaReceta?.ninos_presentes).toBe(25);
    expect(recetaApi.crear).not.toHaveBeenCalled();
    expect(recetaApi.actualizar).not.toHaveBeenCalled();
  });
});