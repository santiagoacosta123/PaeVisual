import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { Ingredientes } from './ingredientes';
import { ProductoService } from '../services/producto.service';
import { SweetAlertService } from '../sweet-alert.service';
import { AuthService } from '../core/auth/auth.service';

describe('Ingredientes', () => {
  let component: Ingredientes;
  let fixture: ComponentFixture<Ingredientes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ingredientes],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
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
          useValue: {
            success: jasmine.createSpy('success'),
            error: jasmine.createSpy('error'),
            warning: jasmine.createSpy('warning'),
            confirm: jasmine.createSpy('confirm'),
          },
        },
        {
          provide: AuthService,
          useValue: {
            obtenerUsuario: () => null,
          },
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
