import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ReporteInventario } from './reporte-inventario';
import { SweetAlertService } from '../sweet-alert.service';
import { InventarioOperativoService } from '../services/inventario-operativo.service';

describe('ReporteInventario', () => {
  let component: ReporteInventario;
  let fixture: ComponentFixture<ReporteInventario>;
  const inventarioMock = {
    cargarSaldos: vi.fn(() => of([
      { id: 1, ingredienteId: 10, cantidad: 5, stockMinimo: 5, unidadId: 1 },
      { id: 2, ingredienteId: 11, cantidad: 10, stockMinimo: 5, unidadId: 1 },
      { id: 3, ingredienteId: 12, cantidad: 25, stockMinimo: 5, unidadId: 1 },
    ])),
    cargarIngredientes: vi.fn(() => of([
      { id: 10, nombre: 'Arroz', unidadId: 1, categoriaId: 2 },
      { id: 11, nombre: 'Lenteja', unidadId: 1, categoriaId: 2 },
      { id: 12, nombre: 'Frijol', unidadId: 1, categoriaId: 2 },
    ])),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ReporteInventario],
      providers: [
        { provide: InventarioOperativoService, useValue: inventarioMock },
        { provide: SweetAlertService, useValue: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReporteInventario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('builds the report from the current inventory balances', () => {
    component.cargarReporte();

    expect(component.productos.map(producto => producto.nombre)).toEqual(['Arroz', 'Lenteja', 'Frijol']);
    expect(component.productos.map(producto => producto.estado)).toEqual([
      'Poco stock',
      'Disponible',
      'Suficiente',
    ]);
    expect(component.cargando).toBe(false);
  });
});
