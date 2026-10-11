import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SweetAlertService } from '../sweet-alert.service';
import { HistorialEntregas } from './historial-entregas';

describe('HistorialEntregas', () => {
  let component: HistorialEntregas;
  let fixture: ComponentFixture<HistorialEntregas>;
  let httpTestingController: HttpTestingController;
  let alertas: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    alertas = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      confirm: vi.fn().mockResolvedValue({ isConfirmed: true }),
    };
    await TestBed.configureTestingModule({
      imports: [HistorialEntregas],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SweetAlertService, useValue: alertas },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HistorialEntregas);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpTestingController = TestBed.inject(HttpTestingController);
    httpTestingController.expectOne(request => request.url.endsWith('/entregas/')).flush([
      {
        id_entrega: 1,
        id_ingrediente: 3,
        ingrediente_nombre: 'Arroz',
        id_usuario_supervisor: 17,
        id_tipo_mercado: 1,
        tipo_mercado_nombre: 'Granos',
        fecha_entrega: '2026-10-10',
        fecha_vencimiento: '2026-11-10',
        cantidad: '12.50',
        frecuencia: 'Mensual',
        unidad: 'Kg',
        observaciones: 'Entrega de prueba',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.entregas).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Historial de Entregas');
    expect(fixture.nativeElement.textContent).toContain('Arroz');
    expect(fixture.nativeElement.textContent).not.toContain('Guardar entrega');
  });

  it('filters history by market and search text', () => {
    component.filtroMercado = 'Granos';
    component.filtroTexto = 'arroz';

    expect(component.entregasFiltradas).toHaveLength(1);

    component.filtroTexto = 'leche';
    expect(component.entregasFiltradas).toHaveLength(0);
  });

  it('opens the CRUD panel and creates a delivery with a success alert', () => {
    component.toggleCrud();
    httpTestingController.expectOne(request => request.url.endsWith('/ingredientes/')).flush([
      { id_ingrediente: 3, nombre_ingrediente: 'Arroz' },
    ]);
    httpTestingController.expectOne(request => request.url.endsWith('/tipos-mercado/')).flush([
      { id_tipo_mercado: 1, nombre_tipo: 'Granos' },
    ]);

    component.crudForm = {
      idIngrediente: 3,
      idTipoMercado: 1,
      frecuencia: 'Mensual',
      cantidad: 5,
      unidad: 'Kg',
      fechaRecepcion: '2026-10-10',
      fechaVencimiento: '2026-11-10',
      observaciones: 'Prueba CRUD',
    };
    component.guardarDesdeCrud();

    const createRequest = httpTestingController.expectOne(
      request => request.url.endsWith('/entregas/') && request.method === 'POST',
    );
    expect(createRequest.request.body.observaciones).toBe('Prueba CRUD');
    createRequest.flush({});
    httpTestingController.expectOne(request => request.url.endsWith('/entregas/')).flush([]);

    expect(alertas.success).toHaveBeenCalledWith('Entrega registrada', 'La entrega se agregó correctamente.');
    expect(component.crudAbierto).toBe(true);
  });

  it('edits an existing delivery and preserves its observations', () => {
    component.toggleCrud();
    httpTestingController.expectOne(request => request.url.endsWith('/ingredientes/')).flush([
      { id_ingrediente: 3, nombre_ingrediente: 'Arroz' },
    ]);
    httpTestingController.expectOne(request => request.url.endsWith('/tipos-mercado/')).flush([
      { id_tipo_mercado: 1, nombre_tipo: 'Granos' },
    ]);
    component.editar(component.entregas[0]);
    component.crudForm.cantidad = 18;
    component.guardarDesdeCrud();

    const updateRequest = httpTestingController.expectOne(
      request => request.url.endsWith('/entregas/1/') && request.method === 'PUT',
    );
    expect(updateRequest.request.body.cantidad).toBe(18);
    expect(updateRequest.request.body.observaciones).toBe('Entrega de prueba');
    updateRequest.flush({});
    httpTestingController.expectOne(request => request.url.endsWith('/entregas/')).flush([]);

    expect(alertas.success).toHaveBeenCalledWith('Entrega actualizada', 'Los cambios se guardaron correctamente.');
  });

  it('asks for confirmation before deleting a delivery', async () => {
    component.toggleCrud();
    httpTestingController.expectOne(request => request.url.endsWith('/ingredientes/')).flush([
      { id_ingrediente: 3, nombre_ingrediente: 'Arroz' },
    ]);
    httpTestingController.expectOne(request => request.url.endsWith('/tipos-mercado/')).flush([
      { id_tipo_mercado: 1, nombre_tipo: 'Granos' },
    ]);

    component.eliminar(component.entregas[0]);
    await fixture.whenStable();
    expect(alertas.confirm).toHaveBeenCalled();
    httpTestingController.expectOne(
      request => request.url.endsWith('/entregas/1/') && request.method === 'DELETE',
    ).flush({});
    httpTestingController.expectOne(request => request.url.endsWith('/entregas/')).flush([]);

    expect(alertas.success).toHaveBeenCalledWith('Entrega eliminada', 'El registro se eliminó correctamente.');
  });
});
