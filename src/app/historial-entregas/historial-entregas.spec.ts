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

  const texto = () => fixture.nativeElement.textContent as string;
  const cabeceraDia = () => fixture.nativeElement.querySelector('.he-day-group-toggle') as HTMLButtonElement;

  // Abre el panel CRUD y responde los catálogos que pide
  const abrirCrudConCatalogos = () => {
    component.toggleCrud();
    httpTestingController.expectOne(request => request.url.endsWith('/ingredientes/')).flush([
      { id_ingrediente: 3, nombre_ingrediente: 'Arroz' },
    ]);
    httpTestingController.expectOne(request => request.url.endsWith('/tipos-mercado/')).flush([
      { id_tipo_mercado: 1, nombre_tipo: 'Granos' },
    ]);
  };

  beforeEach(async () => {
    // El componente usa caché en localStorage: se limpia para que cada prueba parta de cero
    localStorage.clear();

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
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.entregas).toHaveLength(1);
    expect(texto()).toContain('Historial de Entregas');
    expect(texto()).not.toContain('Guardar entrega');

    // CAMBIO: el día con entregas por recibir ahora se abre solo
    expect(texto()).toContain('Arroz');

    // Al hacer clic en la cabecera del día se contrae...
    cabeceraDia().click();
    fixture.detectChanges();
    expect(texto()).not.toContain('Arroz');

    // ...y al hacer clic otra vez se vuelve a abrir
    cabeceraDia().click();
    fixture.detectChanges();
    expect(texto()).toContain('Arroz');
  });

  it('opens the days that have pending deliveries on first load', () => {
    expect(component.grupoEstaExpandido('2026-10-10')).toBe(true);
  });

  it('shows a guide banner telling the user what to do', () => {
    // Sin rol de administrador solo se ofrece consulta
    expect(texto()).toContain('Consulta del historial de entregas');
  });

  it('filters history by search text without category filters', () => {
    component.filtroTexto = 'arroz';

    expect(component.entregasFiltradas).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('Perecederos');

    component.filtroTexto = 'leche';
    expect(component.entregasFiltradas).toHaveLength(0);
  });

  it('expands the groups automatically when searching', () => {
    component.contraerGrupos();
    expect(component.grupoEstaExpandido('2026-10-10')).toBe(false);

    component.filtroTexto = 'arroz';

    expect(component.grupoEstaExpandido('2026-10-10')).toBe(true);
  });

  it('expands the groups automatically when changing the status filter', () => {
    component.entregas = [
      ...component.entregas,
      { ...component.entregas[0], id: 2, ingrediente: 'Lentejas', estado: 'RECIBIDA' },
    ];
    component.contraerGrupos();

    component.cambiarFiltroEstado('RECIBIDA');

    expect(component.entregasFiltradas).toHaveLength(1);
    expect(component.entregasFiltradas[0].ingrediente).toBe('Lentejas');
    expect(component.grupoEstaExpandido('2026-10-10')).toBe(true);
  });

  it('reuses the filtered list while nothing changes (memoized getter)', () => {
    expect(component.entregasFiltradas).toBe(component.entregasFiltradas);
    expect(component.gruposPorFecha).toBe(component.gruposPorFecha);
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

    // CAMBIO: el día ya viene abierto, así que primero se contrae y luego se alterna
    component.contraerGrupos();
    expect(component.grupoEstaExpandido('2026-10-10')).toBe(false);

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

  it('keeps deliveries recoverable when the institution sedes arrive after the first load', () => {
    const entregaConSede = { ...component.entregas[0], id: 9, idInstitucion: 1, idSede: 5, sedeNombre: 'Sede 5' };
    (component as any).entregasOrigen = [entregaConSede];

    component.esAdministrador = true;
    component.institucionIdUsuario = 1;
    component.institucionNombreUsuario = '';

    // Antes de conocer las sedes, la entrega con sede se oculta...
    component.tieneSedes = false;
    component.idsSedesPropias = new Set<number>();
    (component as any).aplicarFiltroInstitucion();
    expect(component.entregas).toHaveLength(0);

    // ...pero al llegar las sedes se recupera, porque se filtra desde la lista completa
    component.tieneSedes = true;
    component.idsSedesPropias = new Set<number>([5]);
    (component as any).aplicarFiltroInstitucion();
    expect(component.entregas).toHaveLength(1);
    expect(component.entregas[0].id).toBe(9);
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
    abrirCrudConCatalogos();

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

  it('uses the delivery date as expiration date when the form leaves it empty', () => {
    abrirCrudConCatalogos();

    component.crudForm = {
      idIngrediente: 3,
      idTipoMercado: 1,
      frecuencia: 'Semanal',
      cantidad: 2,
      unidad: 'Kg',
      fechaRecepcion: '2026-10-10',
      fechaVencimiento: '',
      observaciones: '',
    };
    component.guardarDesdeCrud();

    const createRequest = httpTestingController.expectOne(
      request => request.url.endsWith('/entregas/') && request.method === 'POST',
    );
    expect(createRequest.request.body.fecha_vencimiento).toBe('2026-10-10');
    createRequest.flush({});
    httpTestingController.expectOne(request => request.url.endsWith('/entregas/')).flush([]);

    expect(alertas.warning).not.toHaveBeenCalled();
    expect(alertas.success).toHaveBeenCalledWith('Entrega registrada', 'La entrega se agregó correctamente.');
  });

  it('edits an existing delivery and preserves its observations', () => {
    abrirCrudConCatalogos();
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
    abrirCrudConCatalogos();

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