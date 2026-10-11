import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Ingredientes } from './ingredientes';
import { ProductoService } from '../services/producto.service';
import { SweetAlertService } from '../sweet-alert.service';

describe('Ingredientes', () => {
  let component: Ingredientes;
  let fixture: ComponentFixture<Ingredientes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ingredientes],
      providers: [
        {
          provide: ProductoService,
          useValue: {
            getIngredientes: () => of([]),
            getCategorias: () => of([]),
            getUnidades: () => of([]),
            getProductos: () => of([]),
            getEntradas: () => of([]),
            getSalidas: () => of([]),
          },
        },
        {
          provide: SweetAlertService,
          useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), confirm: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Ingredientes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
