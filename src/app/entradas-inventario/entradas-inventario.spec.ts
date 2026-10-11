import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EntradasInventario } from './entradas-inventario';
import { ProductoService } from '../services/producto.service';
import { SweetAlertService } from '../sweet-alert.service';

describe('EntradasInventario', () => {
  let component: EntradasInventario;
  let fixture: ComponentFixture<EntradasInventario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntradasInventario],
      providers: [
        {
          provide: ProductoService,
          useValue: {
            getEntradas: () => of([]),
            getIngredientes: () => of([]),
            getUnidades: () => of([]),
          },
        },
        {
          provide: SweetAlertService,
          useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EntradasInventario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
