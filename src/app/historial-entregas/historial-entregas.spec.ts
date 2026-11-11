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
    expect(fixture.nativeElement.textContent).not.toContain('Arroz');
    const grupoDia = fixture.nativeElement.querySelector('.he-day-group-toggle') as HTMLButtonElement;
    grupoDia.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Arroz');
    expect(fixture.nativeElement.textContent).not.toContain('Guardar entrega');
  });

  it('filters history by search text without category filters', () => {
    component.filtroTexto = 'arroz';

    expect(component.entregasFiltradas).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('Perecederos');

    component.filtroTexto = 'leche';
    expect(component.entregasFiltradas).toHaveLength(0);
  });

  it('groups deliveries by date and expands the selected day', () => {
    component.entregas = [
      ...component.entregas,
      { ...component.entregas[0], id: 2, ingrediente: 'Lentejas', estado: 'RECIBIDA' },
      { ...component.entregas[0], id: 3, ingrediente: 'Fríjol', estado: 'CON_NOVEDAD' },
      { ...component.entregas[0], id: 4, ingrediente: 'Leche', fechaRecepcion: '2026-10-11' },
    ];

    expect(component.gruposPorFecha).toHaveLength(2);
    const grupoDia = component.gruposPorFecha.find(grupo => grupo.fecha === '2026-10-10');
    expect(grupoDia?.entregas).toHaveLength(3);
    expect(grupoDia?.pendientes).toBe(1);
    expect(grupoDia?.recibidas).toBe(1);
    expect(grupoDia?.novedades).toBe(1);

    component.alternarGrupoFecha('2026-10-10');
    fixture.detectChanges();

    expect(component.grupoEstaExpandido('2026-10-10')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Arroz');
    expect(fixture.nativeElement.textContent).toContain('Lentejas');
    expect(fixture.nativeElement.textContent).toContain('Fríjol');
  });

  it('expands and collapses all visible date groups', () => {
    component.entregas = [
      ...component.entregas,
      { ...component.entregas[0], id: 2, fechaRecepcion: '2026-10-11' },
    ];
    fixture.detectChanges();

    component.expandirGrupos();
    expect(component.grupoEstaExpandido('2026-10-10')).toBe(true);
    expect(component.grupoEstaExpandido('2026-10-11')).toBe(true);

    component.contraerGrupos();
    expect(component.grupoEstaExpandido('2026-10-10')).toBe(false);
    expect(component.grupoEstaExpandido('2026-10-11')).toBe(false);
  });

  it('formats calendar dates without shifting them to another day', () => {
    expect(component.formatoFecha('2026-10-10')).toBe('10/10/2026');
    expect(component.formatoFecha('not-a-date')).toBe('Fecha no disponible');
  });

  it('prepares the selected delivery for a full rejection', () => {
    component.abrirModalRechazo(component.entregas[0]);

    expect(component.modalRecepcionAbierto).toBe(true);
    expect(component.modoRechazoDirecto).toBe(true);
    expect(component.formRecepcion.cantidadRecibida).toBe(0);
    expect(component.formRecepcion.cantidadRechazada).toBe(12.5);
  });

  it('records a rejection only for the selected delivery after the server confirms it', () => {
    localStorage.setItem('sirae_entradas_extra', JSON.stringify({
      'id:1': { destino: 'Sede A' },
      '4|2026-10-10|12.5': { destino: 'Sede B' },
    }));
    component.abrirModalRechazo(component.entregas[0]);
    component.formRecepcion.motivoRechazo = 'Producto averiado';
    component.confirmarRecepcion();

    const request = httpTestingController.expectOne(
      request => request.url.endsWith('/entregas/1/confirmar-recepcion/') && request.method === 'POST',
    );
    expect(request.request.body).toEqual({
      cantidad_recibida: 0,
      cantidad_rechazada: 12.5,
      motivo_rechazo: 'Producto averiado',
    });
    request.flush({});
    httpTestingController.expectOne(request => request.url.endsWith('/entregas/')).flush([]);

    const extras = JSON.parse(localStorage.getItem('sirae_entradas_extra') || '{}');
    expect(extras['id:1'].estadoAprobacion).toBe('RECHAZADA');
    expect(extras['4|2026-10-10|12.5'].estadoAprobacion).toBeUndefined();
  });

  it('keeps the rejection form open when the server does not confirm it', () => {
    component.abrirModalRechazo(component.entregas[0]);
    component.formRecepcion.motivoRechazo = 'Producto averiado';
    component.confirmarRecepcion();

    httpTestingController.expectOne(
      request => request.url.endsWith('/entregas/1/confirmar-recepcion/'),
    ).flush({}, { status: 500, statusText: 'Server Error' });

    expect(component.modalRecepcionAbierto).toBe(true);
    expect(alertas.error).toHaveBeenCalledWith(
      'No se pudo confirmar la entrega',
      'El servidor no registró la recepción. Revisa la conexión e inténtalo nuevamente.',
    );
    expect(alertas.success).not.toHaveBeenCalled();
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
