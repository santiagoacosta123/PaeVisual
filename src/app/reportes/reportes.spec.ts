import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Reportes } from './reportes';
import { InventarioOperativoService } from '../services/inventario-operativo.service';
import { SweetAlertService } from '../sweet-alert.service';

describe('Reportes', () => {
  let component: Reportes;
  let fixture: ComponentFixture<Reportes>;
  const inventarioMock = {
    cargarSalidas: vi.fn(() => of([
      {
        id: 1,
        ingredienteId: 10,
        usuarioId: 14,
        fecha: '2026-10-10T08:00:00',
        cantidad: 3,
        unidadId: 2,
        observaciones: 'Distribución de alimentos',
      },
    ])),
    cargarIngredientes: vi.fn(() => of([
      { id: 10, nombre: 'Arroz', unidadId: 2, categoriaId: 1 },
    ])),
    cargarUnidades: vi.fn(() => of([
      { id: 2, nombre: 'Kilogramo', abreviatura: 'kg' },
    ])),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [Reportes],
      providers: [
        { provide: InventarioOperativoService, useValue: inventarioMock },
        { provide: SweetAlertService, useValue: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Reportes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows real inventory outflows and filters by date', () => {
    component.cargar();
    component.fechaDesde = '2026-10-11';

    expect(component.salidas).toHaveLength(1);
    expect(component.salidas[0].ingrediente).toBe('Arroz');
    expect(component.salidasFiltradas).toHaveLength(0);
  });
});
