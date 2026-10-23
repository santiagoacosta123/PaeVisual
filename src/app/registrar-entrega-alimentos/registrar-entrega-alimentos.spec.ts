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

  const esPost = (request: { url: string; method: string }) =>
    request.url.endsWith('/entregas/') && request.method === 'POST';

  // Deja la fila de Arroz lista para guardar
  function llenarFilaArroz(): void {
    const fila = component.filasLote[0];
    fila.cantidad = 12.5;
    fila.unidad = 'Kg';
    fila.idTipoMercado = 1;
    fila.frecuenciaDias = 20;
    fila.fechaVencimiento = '2026-11-10';
  }

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
    expect(component.ingredientes.map(i => ({ id: i.id, nombre: i.nombre }))).toEqual([{ id: 3, nombre: 'Arroz' }]);
    expect(component.tiposMercado.map(t => ({ id: t.id, nombre: t.nombre }))).toEqual([{ id: 1, nombre: 'Granos' }]);
  });

  it('uses the built-in product list when the server returns no ingredients', () => {
    component.cargarCatalogos();
    httpTestingController.expectOne(r => r.url.endsWith('/ingredientes/')).flush([]);
    httpTestingController.expectOne(r => r.url.endsWith('/tipos-mercado/')).flush([
      { id_tipo_mercado: 1, nombre_tipo: 'Granos' },
    ]);

    component.abrirModalEntrega();

    expect(component.filasLote.length).toBeGreaterThan(1);
    expect(component.filasLote.map(f => f.nombre)).toContain('Arroz');
  });

  it('shows what was registered for each product in the menu cards', () => {
    httpTestingController.expectOne(r => r.url.endsWith('/entregas/') && r.method === 'GET').flush([
      { id: 1, id_ingrediente: 3, id_tipo_mercado: 1, frecuencia: 'Cada 20 días', cantidad: 10, unidad: 'Kg',
        fecha_entrega: '2026-10-01', fecha_vencimiento: '2099-12-31' },
      { id: 2, id_ingrediente: 3, id_tipo_mercado: 1, frecuencia: 'Cada 20 días', cantidad: 5, unidad: 'Kg',
        fecha_entrega: '2026-10-15', fecha_vencimiento: '2099-12-31' },
    ]);

    const registro = component.registroDe('Arroz');

    expect(registro).toEqual({
      fechaIngreso: '2026-10-15', cantidadIngresada: 5, unidad: 'Kg', totalRecibido: 15, entradas: 2,
    });
    expect(component.registroDe('Producto inexistente')).toBeNull();
  });

  it('lists the catalog products as cards grouped by category', () => {
    expect(component.productosMenu.map(p => p.nombre)).toEqual(['Arroz']);
    expect(component.productosMenu[0].categoria).toBe('Granos y cereales');
    expect(component.productosMenu[0].unidad).toBe('Kg');
    expect(component.gruposMenu.map(g => g.nombre)).toEqual(['Granos y cereales']);
    expect(component.gruposMenu[0].productos.length).toBe(1);
    expect(component.categoriasMenu.map(c => c.nombre)).toEqual(['Todos', 'Granos y cereales']);
  });

  it('filters the catalog by market type, category and search text', () => {
    component.ingredientes = [
      { id: 1, nombre: 'Arroz' }, { id: 2, nombre: 'Leche' }, { id: 3, nombre: 'Pollo' },
    ];

    component.filtroMercado = 'Perecederos';
    expect(component.productosMenu.map(p => p.nombre)).toEqual(['Leche', 'Pollo']);

    component.filtroMercado = 'Granos';
    expect(component.productosMenu.map(p => p.nombre)).toEqual(['Arroz']);

    component.filtroMercado = 'Todos';
    component.categoriaMenu = 'Lácteos';
    expect(component.productosMenu.map(p => p.nombre)).toEqual(['Leche']);

    component.categoriaMenu = 'Todos';
    component.textoFiltro = 'pol';
    expect(component.productosMenu.map(p => p.nombre)).toEqual(['Pollo']);
  });

  it('uses the market type of the last delivery to tell perishable products', () => {
    const arroz = { id: 3, nombre: 'Arroz', categoria: 'Granos y cereales', unidad: 'Kg', idTipoMercado: 1 };
    component.tiposMercado = [{ id: 1, nombre: 'Perecedero' }, { id: 2, nombre: 'No perecedero' }];

    expect(component.esPerecedero(arroz)).toBe(true);
    expect(component.nombreTipo(arroz)).toBe('Perecedero');
    expect(component.esPerecedero({ ...arroz, idTipoMercado: 2 })).toBe(false);
    expect(component.nombreTipo({ ...arroz, idTipoMercado: 2 })).toBe('No perecedero');
    expect(component.esPerecedero({ ...arroz, idTipoMercado: null })).toBe(false);
    expect(component.nombreTipo({ ...arroz, nombre: 'Pollo', idTipoMercado: null })).toBe('Perecedero');
  });

  it('opens the modal filtered on the product whose + button was pressed', () => {
    component.abrirModalEntrega('Arroz');

    expect(component.mostrarModalEntrega).toBe(true);
    expect(component.busquedaLote).toBe('Arroz');
    expect(component.filasLoteVisibles.map(f => f.nombre)).toEqual(['Arroz']);
  });

  it('keeps the form usable with built-in catalogs when the server fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    component.ingredientes = [];
    component.tiposMercado = [];

    component.cargarCatalogos();
    httpTestingController.expectOne(r => r.url.endsWith('/ingredientes/'))
      .flush({}, { status: 0, statusText: 'Unknown Error' });
    httpTestingController.match(r => r.url.endsWith('/tipos-mercado/'));
    component.abrirModalEntrega();

    expect(component.errorCatalogos).toContain('No se pudieron cargar los catálogos');
    expect(component.filasLote.length).toBeGreaterThan(1);
    expect(component.tiposMercado.length).toBeGreaterThan(0);
  });

  it('lists every inventory product when the modal opens', () => {
    component.abrirModalEntrega();
    fixture.detectChanges();

    expect(component.mostrarModalEntrega).toBe(true);
    expect(component.filasLote.length).toBe(1);
    expect(component.filasLote[0].nombre).toBe('Arroz');
    expect(component.filasLote[0].cantidad).toBeNull();
    expect(component.filasConCantidad.length).toBe(0);
  });

  it('opens the modal with today as the date', () => {
    component.alCambiarFechaLote('2020-01-01');

    component.abrirModalEntrega();

    expect(component.fechaRecepcionLote).toBe(component.fechaHoy());
  });

  it('formats the date in a long readable Spanish format', () => {
    const texto = component.fechaLarga('2026-10-16').toLowerCase();

    expect(texto).toContain('16');
    expect(texto).toContain('octubre');
    expect(texto).toContain('2026');
    expect(component.fechaLarga('')).toBe('');
  });

  it('asks for a quantity before saving and sends nothing', () => {
    component.abrirModalEntrega();

    component.guardarLote();

    expect(component.errorMensaje).toContain('Escribe la cantidad');
    httpTestingController.expectNone(esPost);
  });

  it('explains when the market catalog is empty and prevents saving', () => {
    component.abrirModalEntrega();
    llenarFilaArroz();
    component.tiposMercado = [];

    component.guardarLote();

    expect(component.errorMensaje).toContain('No hay catálogos cargados');
    httpTestingController.expectNone(esPost);
  });

  it('does not save products with missing data', () => {
    component.abrirModalEntrega();
    component.filasLote[0].cantidad = 5; // sin unidad, mercado, frecuencia ni vencimiento

    component.guardarLote();

    expect(component.errorMensaje).toContain('Completa los datos marcados en rojo');
    expect(component.errorMensaje).toContain('Arroz');
    httpTestingController.expectNone(esPost);
  });

  it('submits each product of the inventory using the backend API contract', () => {
    component.abrirModalEntrega();
    component.alCambiarFechaLote('2026-10-10');
    llenarFilaArroz();

    component.guardarLote();

    const createRequest = httpTestingController.expectOne(esPost);
    expect(createRequest.request.body).toEqual({
      id_ingrediente: 3,
      id_tipo_mercado: 1,
      frecuencia: 'Cada 20 días',
      cantidad: 12.5,
      unidad: 'Kg',
      fecha_entrega: '2026-10-10',
      fecha_vencimiento: '2026-11-10',
      observaciones: '',
    });
    createRequest.flush({});

    expect(alertas.success).toHaveBeenCalledWith(
      'Inventario guardado',
      'Se registraron 1 producto(s) con fecha 10/10/2026.'
    );
    expect(component.mostrarModalEntrega).toBe(false);
  });

  it('keeps the quantity of products that failed so the user can retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    component.abrirModalEntrega();
    component.alCambiarFechaLote('2026-10-10');
    llenarFilaArroz();

    component.guardarLote();
    httpTestingController.expectOne(esPost)
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(component.guardandoLote).toBe(false);
    expect(component.errorMensaje).toContain('fallaron 1');
    expect(component.errorMensaje).toContain('Arroz');
    expect(component.filasLote[0].cantidad).toBe(12.5);
    expect(component.mostrarModalEntrega).toBe(true);
    expect(alertas.error).toHaveBeenCalled();
  });

  describe('calendario de entregas', () => {
    const entrega = (fechaRecepcion: string, ingrediente: string, fechaVencimiento: string, id: number) => ({
      id, idIngrediente: id, idTipoMercado: 1, ingrediente, tipoMercado: 'Granos', categoria: 'Granos' as const,
      frecuencia: 'Cada 20 días', cantidad: 10, unidad: 'Kg', fechaRecepcion, fechaVencimiento,
    });

    beforeEach(() => {
      component.mesCalendario = new Date(2026, 9, 1);   // octubre de 2026
      component.diaSeleccionado = '2026-10-15';
    });

    it('arma el mes con semanas completas que empiezan en lunes', () => {
      const dias = component.diasCalendario;

      expect(component.tituloMes).toBe('Octubre 2026');
      expect(dias.length).toBe(35);
      expect(dias[0].iso).toBe('2026-09-28');
      expect(dias[0].enMes).toBe(false);
      expect(dias[3].iso).toBe('2026-10-01');
      expect(dias[3].enMes).toBe(true);
    });

    it('muestra en cada día cuántos productos se entregaron', () => {
      component.historial = [
        entrega('2026-10-15', 'Arroz', '2099-12-31', 1),
        entrega('2026-10-15', 'Frijol', '2099-12-31', 2),
        entrega('2026-10-20', 'Lenteja', '2099-12-31', 3),
      ];

      const dias = component.diasCalendario;

      expect(dias.find(d => d.iso === '2026-10-15')?.entregas).toBe(2);
      expect(dias.find(d => d.iso === '2026-10-20')?.entregas).toBe(1);
      expect(dias.find(d => d.iso === '2026-10-16')?.entregas).toBe(0);
    });

    it('colorea el día según el peor estado de sus productos', () => {
      component.historial = [
        entrega('2026-10-05', 'Arroz', '2099-12-31', 1),
        entrega('2026-10-06', 'Pollo', '2020-01-01', 2),
        entrega('2026-10-06', 'Leche', '2099-12-31', 3),
      ];

      const dias = component.diasCalendario;

      expect(dias.find(d => d.iso === '2026-10-05')?.estado).toBe('Vigente');
      expect(dias.find(d => d.iso === '2026-10-06')?.estado).toBe('Vencido');
      expect(dias.find(d => d.iso === '2026-10-07')?.estado).toBeNull();
      expect(component.claseChipEstado('Vencido')).toBe('est-bad');
      expect(component.claseChipEstado('Próximo a vencer')).toBe('est-warn');
      expect(component.claseChipEstado('Vigente')).toBe('est-ok');
    });

    it('cuenta los productos que vencen cada día', () => {
      component.historial = [
        entrega('2026-10-01', 'Arroz', '2026-10-25', 1),
        entrega('2026-10-02', 'Frijol', '2026-10-25', 2),
      ];

      expect(component.diasCalendario.find(d => d.iso === '2026-10-25')?.vencen).toBe(2);
    });

    it('marca el día de hoy', () => {
      component.irAHoy();

      const hoy = component.diasCalendario.filter(d => d.esHoy);

      expect(hoy.length).toBe(1);
      expect(hoy[0].seleccionado).toBe(true);
    });

    it('navega entre meses', () => {
      component.mesSiguiente();
      expect(component.tituloMes).toBe('Noviembre 2026');

      component.mesAnterior();
      component.mesAnterior();
      expect(component.tituloMes).toBe('Septiembre 2026');
    });

    it('al elegir un día gris cambia al mes de ese día', () => {
      component.seleccionarDia('2026-09-30');

      expect(component.diaSeleccionado).toBe('2026-09-30');
      expect(component.tituloMes).toBe('Septiembre 2026');
    });

    it('el buscador también filtra el calendario', () => {
      component.historial = [
        entrega('2026-10-15', 'Arroz', '2099-12-31', 1),
        entrega('2026-10-15', 'Frijol', '2099-12-31', 2),
      ];

      component.textoFiltro = 'arroz';

      expect(component.diasCalendario.find(d => d.iso === '2026-10-15')?.entregas).toBe(1);
      expect(component.entregasDelDia.map(e => e.ingrediente)).toEqual(['Arroz']);
    });

    it('el detalle del día lista lo entregado y lo que vence', () => {
      component.historial = [
        entrega('2026-10-15', 'Frijol', '2026-11-30', 1),
        entrega('2026-10-15', 'Arroz', '2026-11-30', 2),
        entrega('2026-10-01', 'Pollo', '2026-10-15', 3),
      ];

      expect(component.entregasDelDia.map(e => e.ingrediente)).toEqual(['Arroz', 'Frijol']);
      expect(component.vencenDelDia.map(e => e.ingrediente)).toEqual(['Pollo']);
    });

    it('la opción Calendario muestra el calendario en lugar del catálogo', () => {
      component.irACalendario();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('#view-calendario')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('#view-menu')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Octubre 2026');
    });
  });
});