import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SweetAlertService } from '../sweet-alert.service';
import { RegistrarEntregaAlimentosComponent } from './registrar-entrega-alimentos';

describe('RegistrarEntregaAlimentosComponent', () => {
  let component: RegistrarEntregaAlimentosComponent;
  let fixture: ComponentFixture<RegistrarEntregaAlimentosComponent>;
  let httpTestingController: HttpTestingController;
  let alertas: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    alertas = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [RegistrarEntregaAlimentosComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SweetAlertService, useValue: alertas },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrarEntregaAlimentosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpTestingController = TestBed.inject(HttpTestingController);
    httpTestingController.expectOne(request => request.url.endsWith('/ingredientes/')).flush([
      { id_ingrediente: 3, nombre_ingrediente: 'Arroz' },
    ]);
    httpTestingController.expectOne(request => request.url.endsWith('/tipos-mercado/')).flush([
      { id_tipo_mercado: 1, nombre_tipo: 'Granos' },
    ]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.ingredientes).toEqual([{ id: 3, nombre: 'Arroz' }]);
    expect(component.tiposMercado).toEqual([{ id: 1, nombre: 'Granos' }]);
  });

  it('explains when the market catalog is empty and prevents an invalid submission', () => {
    component.tiposMercado = [];
    component.entregaForm.idTipoMercado = null;
    fixture.detectChanges();

    const marketSelect: HTMLSelectElement = fixture.nativeElement.querySelector('#tipoMercado');
    const submitButton: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');

    expect(marketSelect.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No hay tipos de mercado disponibles');
    expect(submitButton.disabled).toBe(true);

    component.guardarEntrega();
    expect(component.errorMensaje).toContain('No hay tipos de mercado configurados');
  });

  it('submits delivery fields using the backend API contract', () => {
    component.entregaForm = {
      idIngrediente: 3,
      idTipoMercado: 1,
      frecuencia: 'Mensual',
      cantidad: 12.5,
      unidad: 'Kg',
      fechaRecepcion: '2026-10-10',
      fechaVencimiento: '2026-11-10',
      observaciones: '',
    };

    component.guardarEntrega();

    const createRequest = httpTestingController.expectOne(
      request => request.url.endsWith('/entregas/') && request.method === 'POST'
    );
    expect(createRequest.request.body).toEqual({
      id_ingrediente: 3,
      id_tipo_mercado: 1,
      frecuencia: 'Mensual',
      cantidad: 12.5,
      unidad: 'Kg',
      fecha_entrega: '2026-10-10',
      fecha_vencimiento: '2026-11-10',
      observaciones: '',
    });
    createRequest.flush({});
    expect(alertas.success).toHaveBeenCalledWith('Entrega registrada', 'La entrega se guardó correctamente.');
  });

  it('shows an authentication message when the backend rejects the session', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    component.entregaForm = {
      idIngrediente: 3,
      idTipoMercado: 1,
      frecuencia: 'Mensual',
      cantidad: 12.5,
      unidad: 'Kg',
      fechaRecepcion: '2026-10-10',
      fechaVencimiento: '2026-11-10',
      observaciones: '',
    };

    component.guardarEntrega();
    httpTestingController.expectOne(
      request => request.url.endsWith('/entregas/') && request.method === 'POST'
    ).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(component.guardando).toBe(false);
    expect(component.errorMensaje).toContain('sesión expiró');
    expect(alertas.error).toHaveBeenCalled();
  });
});