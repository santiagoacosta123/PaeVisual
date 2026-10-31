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

  const esPost = (r: { url: string; method: string }) => r.url.endsWith('/entregas/') && r.method === 'POST';
  const esGet = (r: { url: string; method: string }) => r.url.endsWith('/entregas/') && r.method === 'GET';

  // Fecha ISO local a N días de hoy
  const isoEn = (dias: number): string => {
    const f = new Date();
    f.setDate(f.getDate() + dias);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  };

  // Una entrada de Arroz tal como la devuelve el servidor
  const entradaArroz = (extra: Record<string, unknown> = {}) => ({
    id: 1, id_ingrediente: 3, id_tipo_mercado: 1, frecuencia: 'Cada 20 días', cantidad: 15, unidad: 'Kg',
    fecha_entrega: '2026-10-01', fecha_vencimiento: '2099-12-31', ...extra,
  });

  // Responde todas las consultas GET pendientes del historial
  function responderHistorial(datos: unknown[] = []): void {
    httpTestingController.match(esGet).forEach(r => r.flush(datos));
  }

  // Pide el historial de nuevo y lo responde
  function cargarEntradas(datos: unknown[]): void {
    component.cargarHistorial();
    responderHistorial(datos);
  }

  // Simula que hay una institución activa (sin ella no se puede registrar nada)
  function usarInstitucion(): void {
    component.institucionActiva = { id_institucion: 7, nombre_institucion: 'Liceo de Occidente', sedes: [] } as any;
    component.idInstitucion = 7;
  }

  // Simula el gesto de deslizar una tarjeta (dx > 0 = derecha, dx < 0 = izquierda)
  function deslizar(producto: any, dx: number): void {
    component.alIniciarDeslizar({ pointerType: 'touch', button: 0, clientX: 0, clientY: 0 } as PointerEvent, producto);
    component.alMoverDeslizar({
      clientX: dx, clientY: 0, pointerId: 1, currentTarget: { setPointerCapture: () => {} },
    } as unknown as PointerEvent);
    component.alTerminarDeslizar(producto);
  }

  beforeEach(async () => {
    localStorage.clear();
    alertas = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RegistrarEntregaAlimentosComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SweetAlertService, useValue: alertas },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrarEntregaAlimentosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpTestingController = TestBed.inject(HttpTestingController);
    httpTestingController.expectOne(r => r.url.endsWith('/ingredientes/')).flush([
      { id_ingrediente: 3, nombre_ingrediente: 'Arroz' },
    ]);
    httpTestingController.expectOne(r => r.url.endsWith('/tipos-mercado/')).flush([
      { id_tipo_mercado: 1, nombre_tipo: 'Granos' },
    ]);
    responderHistorial([]);
    fixture.detectChanges();
  });

  // ===================== CATÁLOGOS =====================
  describe('catálogos', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
      expect(component.ingredientes.map(i => ({ id: i.id, nombre: i.nombre }))).toEqual([{ id: 3, nombre: 'Arroz' }]);
      expect(component.tiposMercado.map(t => ({ id: t.id, nombre: t.nombre }))).toEqual([{ id: 1, nombre: 'Granos' }]);
      expect(component.cargandoCatalogos).toBe(false);
    });

    it('guarda en caché lo que llega del servidor', () => {
      const cache = JSON.parse(localStorage.getItem('sirae_cache_ingredientes') || 'null');
      expect(cache).toMatchObject([{ id: 3, nombre: 'Arroz' }]);
    });

    it('usa los productos y tipos de ejemplo cuando el servidor no devuelve datos', () => {
      component.cargarCatalogos();
      httpTestingController.expectOne(r => r.url.endsWith('/ingredientes/')).flush([]);
      httpTestingController.expectOne(r => r.url.endsWith('/tipos-mercado/')).flush([]);

      expect(component.ingredientes.length).toBeGreaterThan(1);
      expect(component.ingredientes.map(i => i.nombre)).toContain('Arroz');
      expect(component.tiposMercado.map(t => t.nombre)).toEqual(['Perecedero', 'No perecedero']);
    });

    it('avisa con una alerta cuando el servidor falla', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      component.cargarCatalogos();
      httpTestingController.expectOne(r => r.url.endsWith('/ingredientes/'))
        .flush({}, { status: 500, statusText: 'Server Error' });
      httpTestingController.match(r => r.url.endsWith('/tipos-mercado/'));

      expect(alertas.error).toHaveBeenCalledWith('No se pudo cargar el catálogo', expect.stringContaining('error 500'));
      expect(component.cargandoCatalogos).toBe(false);
    });
  });

  // ===================== MENÚ DE PRODUCTOS =====================
  describe('menú de productos', () => {
    it('lista los productos del catálogo agrupados por categoría', () => {
      expect(component.productosMenu.map(p => p.nombre)).toEqual(['Arroz']);
      expect(component.productosMenu[0].categoria).toBe('Granos y cereales');
      expect(component.productosMenu[0].unidad).toBe('Kg');
      expect(component.gruposPagina.map(g => g.nombre)).toEqual(['Granos y cereales']);
      expect(component.gruposPagina[0].productos.length).toBe(1);
      expect(component.categoriasMenu.map(c => c.nombre)).toEqual(['Todos', 'Granos y cereales']);
    });

    it('filtra por tipo de mercado, categoría y texto de búsqueda', () => {
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

    it('usa el tipo de mercado de la última entrada para saber si es perecedero', () => {
      const arroz = { id: 3, nombre: 'Arroz', categoria: 'Granos y cereales', unidad: 'Kg', idTipoMercado: 1 };
      component.tiposMercado = [{ id: 1, nombre: 'Perecedero' }, { id: 2, nombre: 'No perecedero' }];

      expect(component.esPerecedero(arroz)).toBe(true);
      expect(component.nombreTipo(arroz)).toBe('Perecedero');
      expect(component.esPerecedero({ ...arroz, idTipoMercado: 2 })).toBe(false);
      expect(component.nombreTipo({ ...arroz, idTipoMercado: 2 })).toBe('No perecedero');
      expect(component.esPerecedero({ ...arroz, idTipoMercado: null })).toBe(false);
      expect(component.nombreTipo({ ...arroz, nombre: 'Pollo', idTipoMercado: null })).toBe('Perecedero');
    });

    it('muestra un nombre corto en la tarjeta sin cambiar el nombre original', () => {
      expect(component.nombreMostrado('Carne molida de res')).toBe('Res molida');
      expect(component.nombreMostrado('Tocino de cerdo')).toBe('Tocino');
      expect(component.nombreMostrado('Arroz')).toBe('Arroz');
    });

    it('asigna emoji, imagen y categoría según el nombre', () => {
      expect(component.emojiDe('Leche')).toBe('🥛');
      expect(component.emojiDe('Algo raro')).toBe('🍽️');
      expect(component.imagenDe('Arroz')).toBe('/arroz.png');
      expect(component.imagenDe('Algo raro')).toBeNull();
      expect(component.categoriaDe('Queso')).toBe('Lácteos');
      expect(component.categoriaDe('Algo raro')).toBe('Otros');
      expect(component.imagenCategoria('Todos')).toBe('/plato.png');
    });

    it('pagina los productos de 4 en 4', () => {
      component.ingredientes = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, nombre: `Producto ${String(i + 1).padStart(2, '0')}` }));

      expect(component.totalProductosMenu).toBe(10);
      expect(component.totalPaginas).toBe(3);
      expect(component.numerosPagina).toEqual([1, 2, 3]);
      expect(component.desdeMostrado).toBe(1);
      expect(component.hastaMostrado).toBe(4);

      component.irAPagina(2);
      expect(component.paginaEfectiva).toBe(2);
      expect(component.desdeMostrado).toBe(5);
      expect(component.hastaMostrado).toBe(8);
      expect(component.gruposPagina[0].productos.map(p => p.nombre))
        .toEqual(['Producto 05', 'Producto 06', 'Producto 07', 'Producto 08']);

      component.irAPagina(9);   // fuera de rango: se ignora
      expect(component.paginaEfectiva).toBe(2);

      component.setMercado('Perecederos');
      expect(component.paginaActual).toBe(1);
    });
  });

  // ===================== HISTORIAL, TOTALES E INVENTARIO =====================
  describe('historial, totales e inventario', () => {
    it('calcula lo disponible como entradas menos envíos', () => {
      cargarEntradas([
        entradaArroz({ id: 1, cantidad: 10 }),
        entradaArroz({ id: 2, cantidad: 5, fecha_entrega: '2026-10-15' }),
        { id: 3, id_ingrediente: 3, ingrediente_nombre: 'Arroz', destino: 'Liceo de Occidente', cantidad: 4, unidad: 'Kg',
          fecha_entrega: '2026-10-20', fecha_salida: '2026-10-20' },
      ]);

      const arroz = component.productosMenu[0];
      expect(component.historial.length).toBe(2);
      expect(component.historialEnvios.length).toBe(1);
      expect(component.tieneEntradas(arroz)).toBe(true);
      expect(component.totalDisponible(arroz)).toBe(11);
      expect(component.fueEnviado('Arroz')).toBe(true);
    });

    it('agrupa en una tarjeta lo que se registró junto', () => {
      cargarEntradas([
        entradaArroz({ id: 1, cantidad: 10, destino: 'Liceo de Occidente', lote_registro: 'L1', created_at: '2026-10-15' }),
        entradaArroz({ id: 2, cantidad: 5, destino: 'Liceo de Occidente', lote_registro: 'L1', created_at: '2026-10-15' }),
      ]);

      expect(component.entradasHistorial.length).toBe(2);
      expect(component.gruposEntradas.length).toBe(1);
      const grupo = component.gruposEntradas[0];
      expect(grupo.destino).toBe('Liceo de Occidente');
      expect(grupo.fechaRegistro).toBe('2026-10-15');
      expect(grupo.productos).toMatchObject([{ ingrediente: 'Arroz', cantidad: 15, unidad: 'Kg', veces: 2 }]);
    });

    it('agrupa los envíos por destino y fechas', () => {
      const envio = (id: number, cantidad: number) => ({
        id_entrega: id, id_ingrediente: 3, ingrediente_nombre: 'Arroz', institucion_nombre: 'Liceo de Occidente',
        cantidad, unidad: 'Kg', fecha_entrega: '2026-10-20', fecha_salida: '2026-10-20',
      });
      cargarEntradas([entradaArroz(), envio(20, 2), envio(21, 3)]);

      expect(component.gruposEnvios.length).toBe(1);
      expect(component.gruposEnvios[0].destino).toBe('Liceo de Occidente');
      expect(component.gruposEnvios[0].items.length).toBe(2);
    });

    it('separa el inventario en disponible y no disponible', () => {
      component.ingredientes = [{ id: 3, nombre: 'Arroz' }, { id: 4, nombre: 'Leche' }];
      cargarEntradas([entradaArroz()]);

      expect(component.inventarioDisponible.map(i => i.producto.nombre)).toEqual(['Arroz']);
      expect(component.inventarioDisponible[0].cantidad).toBe(15);
      expect(component.inventarioNoDisponible.map(i => ({ n: i.producto.nombre, m: i.motivo })))
        .toEqual([{ n: 'Leche', m: 'Sin entradas' }]);
    });

    it('marca como agotado el producto que se envió completo', () => {
      cargarEntradas([
        entradaArroz({ cantidad: 10 }),
        { id: 9, id_ingrediente: 3, ingrediente_nombre: 'Arroz', destino: 'Liceo', cantidad: 10, unidad: 'Kg',
          fecha_entrega: '2026-10-20', fecha_salida: '2026-10-20' },
      ]);

      expect(component.inventarioDisponible.length).toBe(0);
      expect(component.inventarioNoDisponible[0].motivo).toBe('Agotado');
    });

    it('muestra un aviso cuando falla la consulta del historial', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      component.cargarHistorial();
      httpTestingController.expectOne(esGet).flush({}, { status: 500, statusText: 'Server Error' });

      expect(component.errorHistorial).toBe(true);
      expect(component.cargandoHistorial).toBe(false);
    });
  });

  // ===================== DESLIZAR Y PANEL =====================
  describe('deslizar productos hacia el panel', () => {
    it('deslizar a la derecha agrega el producto y a la izquierda lo quita', () => {
      cargarEntradas([entradaArroz()]);
      const arroz = component.productosMenu[0];

      deslizar(arroz, 100);
      expect(component.seleccionados.length).toBe(1);
      expect(component.tarjetaActiva(arroz)).toBe(true);
      expect(component.mostrarHistorialEnvios).toBe(false);

      deslizar(arroz, -100);
      expect(component.seleccionados.length).toBe(0);
      expect(component.tarjetaActiva(arroz)).toBe(false);
    });

    it('un deslizamiento corto no hace nada', () => {
      cargarEntradas([entradaArroz()]);

      deslizar(component.productosMenu[0], 30);

      expect(component.seleccionados.length).toBe(0);
    });

    it('avisa si el producto todavía no tiene entradas', () => {
      deslizar(component.productosMenu[0], 100);

      expect(component.seleccionados.length).toBe(0);
      expect(alertas.warning).toHaveBeenCalledWith('Sin inventario', expect.stringContaining('Arroz'));
    });

    it('quita un producto con el botón de cerrar de la tarjeta', () => {
      cargarEntradas([entradaArroz()]);
      deslizar(component.productosMenu[0], 100);

      component.quitarSeleccionado(component.seleccionados[0]);

      expect(component.seleccionados.length).toBe(0);
    });
  });

  // ===================== ENVÍO DESDE EL PANEL =====================
  describe('envío desde el panel', () => {
    beforeEach(() => {
      usarInstitucion();
      cargarEntradas([entradaArroz()]);
      deslizar(component.productosMenu[0], 100);
    });

    it('limita la cantidad a enviar a lo disponible', () => {
      const sel = component.seleccionados[0];

      expect(component.disponibleDe(sel)).toBe(15);
      component.ajustarCantidadEnviar(sel, 1);
      expect(component.cantidadEnviarDe(sel)).toBe(1);
      component.ajustarCantidadEnviar(sel, 100);
      expect(component.cantidadEnviarDe(sel)).toBe(15);
      component.ajustarCantidadEnviar(sel, -100);
      expect(component.cantidadEnviarDe(sel)).toBe(0);
      expect(component.productosParaEnviar.length).toBe(0);
    });

    it('pide una cantidad antes de enviar y no manda nada', () => {
      component.enviarSeleccionados();

      expect(component.errorEnvioPanel).toContain('Escribe la cantidad a enviar');
      httpTestingController.expectNone(esPost);
    });

    it('no deja enviar más de lo disponible', () => {
      component.fijarCantidadEnviar(component.seleccionados[0], 99);

      component.enviarSeleccionados();

      expect(component.errorEnvioPanel).toContain('No puedes enviar más de lo disponible');
      expect(component.errorEnvioPanel).toContain('Arroz');
      httpTestingController.expectNone(esPost);
    });

    it('exige el identificador de la institución', () => {
      component.institucionActiva = null;
      component.idInstitucion = null;
      component.fijarCantidadEnviar(component.seleccionados[0], 5);

      component.enviarSeleccionados();

      expect(component.errorEnvioPanel).toContain('identificador de la institución');
      httpTestingController.expectNone(esPost);
    });

    it('registra el envío en el servidor usando el contrato de la API', () => {
      const hoy = component.fechaHoy();
      component.fijarCantidadEnviar(component.seleccionados[0], 5);

      component.enviarSeleccionados();

      const peticion = httpTestingController.expectOne(esPost);
      expect(peticion.request.body).toEqual({
        id_ingrediente: 3,
        id_tipo_mercado: 1,
        id_institucion: 7,
        fecha_entrega: hoy,
        fecha_salida: hoy,
        fecha_vencimiento: '2099-12-31',
        cantidad: 5,
        observaciones: '',
        frecuencia: 'Cada 20 días',
        unidad: 'Kg',
        destino: 'Liceo de Occidente',
      });
      peticion.flush({});

      expect(component.guardandoEnvio).toBe(false);
      expect(component.mostrarHistorialEnvios).toBe(true);

      // Se vuelve a consultar el servidor y se reemplaza lo mostrado al instante
      responderHistorial([
        entradaArroz(),
        { id_entrega: 55, id_ingrediente: 3, id_institucion: 7, ingrediente_nombre: 'Arroz', institucion_nombre: 'Liceo de Occidente',
          cantidad: 5, unidad: 'Kg', fecha_entrega: hoy, fecha_salida: hoy },
      ]);

      expect(component.historialEnvios[0]).toMatchObject({ id: 55, ingrediente: 'Arroz', destino: 'Liceo de Occidente', cantidad: 5 });
      expect(component.totalDisponible(component.productosMenu[0])).toBe(10);
      expect(alertas.success).toHaveBeenCalledWith(
        'Envío registrado',
        expect.stringContaining('1 producto(s) enviados a Liceo de Occidente'),
      );
    });

    it('mantiene el producto en el panel y muestra el error cuando el servidor lo rechaza', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      component.fijarCantidadEnviar(component.seleccionados[0], 5);

      component.enviarSeleccionados();
      httpTestingController.expectOne(esPost).flush({}, { status: 500, statusText: 'Server Error' });

      expect(component.guardandoEnvio).toBe(false);
      expect(component.seleccionados.length).toBe(1);
      expect(component.cantidadEnviarDe(component.seleccionados[0])).toBe(5);
      expect(component.errorEnvioPanel).toContain('No se pudo enviar');
      expect(component.errorEnvioPanel).toContain('Arroz');
      expect(alertas.error).toHaveBeenCalledWith('Envío incompleto', component.errorEnvioPanel);
    });
  });

  // ===================== REGISTRAR ENTRADA =====================
  describe('registrar entrada', () => {
    it('abre el modal con hoy como fecha y la institución como destino', () => {
      usarInstitucion();
      component.entradaFecha = '2020-01-01';

      component.abrirModalEntrada();

      expect(component.mostrarModalEntrada).toBe(true);
      expect(component.entradaFecha).toBe(component.fechaHoy());
      expect(component.entradaDestino).toBe('Liceo de Occidente');
      expect(component.entradaFilas.length).toBe(0);
    });

    it('un toque agrega el producto y otro lo quita', () => {
      component.abrirModalEntrada();

      component.alternarProductoEntrada(3);
      expect(component.estaEnEntrada(3)).toBe(true);
      expect(component.entradaFilas[0]).toMatchObject({ idIngrediente: 3, cantidad: null, unidad: 'Kg', perecedero: false });
      expect(component.nombreIngrediente(3)).toBe('Arroz');

      component.alternarProductoEntrada(3);
      expect(component.estaEnEntrada(3)).toBe(false);
    });

    it('filtra los productos del modal con el buscador', () => {
      component.ingredientes = [{ id: 1, nombre: 'Arroz' }, { id: 2, nombre: 'Leche' }];
      component.busquedaEntrada = 'lec';

      expect(component.productosRapidos.map(p => p.nombre)).toEqual(['Leche']);
    });

    it('ajusta la cantidad con los botones + y −', () => {
      const fila = { idIngrediente: 3, cantidad: null as number | null, unidad: 'Kg', perecedero: false };

      component.ajustarCantidadEntrada(fila, 1);
      expect(fila.cantidad).toBe(1);
      component.ajustarCantidadEntrada(fila, -5);
      expect(fila.cantidad).toBeNull();
    });

    it('valida los datos antes de guardar y no envía nada', () => {
      component.abrirModalEntrada();
      component.guardarEntrada();
      expect(component.errorEntrada).toBe('Elige el destino.');

      usarInstitucion();
      component.abrirModalEntrada();
      component.guardarEntrada();
      expect(component.errorEntrada).toBe('Escribe el nombre del responsable.');

      component.entradaResponsable = 'Ana Pérez';
      component.guardarEntrada();
      expect(component.errorEntrada).toContain('Toca los productos');

      component.alternarProductoEntrada(3);
      component.guardarEntrada();
      expect(component.errorEntrada).toBe('Escribe la cantidad de: Arroz.');

      component.entradaFilas[0].cantidad = 5;
      component.tiposMercado = [];
      component.guardarEntrada();
      expect(component.errorEntrada).toContain('No se encontró el tipo de mercado');

      httpTestingController.expectNone(esPost);
    });

    describe('al guardar', () => {
      beforeEach(() => {
        usarInstitucion();
        component.tiposMercado = [{ id: 1, nombre: 'Perecedero' }, { id: 2, nombre: 'No perecedero' }];
        component.abrirModalEntrada();
        component.entradaFecha = '2026-10-10';
        component.entradaResponsable = 'Ana Pérez';
        component.alternarProductoEntrada(3);
        component.entradaFilas[0].cantidad = 12.5;
      });

      it('envía cada producto con el contrato de la API y calcula vencimiento y frecuencia', () => {
        component.guardarEntrada();

        const peticion = httpTestingController.expectOne(esPost);
        expect(peticion.request.body).toEqual({
          id_ingrediente: 3,
          id_tipo_mercado: 2,                 // no perecedero
          frecuencia: 'Cada 8 días',          // sin entradas previas
          cantidad: 12.5,
          unidad: 'Kg',
          fecha_entrega: '2026-10-10',
          fecha_vencimiento: '2027-01-08',    // 90 días para no perecederos
          id_institucion: 7,
          destino: 'Liceo de Occidente',
          responsable: 'Ana Pérez',
          observaciones: '',
        });
        peticion.flush({ id: 99 });

        expect(component.mostrarModalEntrada).toBe(false);
        expect(alertas.success).toHaveBeenCalledWith(
          'Entrada registrada',
          'Se registraron 1 producto(s) con destino a Liceo de Occidente.',
        );
        expect(component.tituloMes).toBe('Octubre 2026');
        expect(component.diaSeleccionado).toBe('2026-10-10');
        expect(component.mostrarHistorialEnvios).toBe(true);

        // La entrada aparece al instante, antes de recargar del servidor
        expect(component.historial.length).toBe(1);
        expect(component.historial[0]).toMatchObject({ destino: 'Liceo de Occidente', responsable: 'Ana Pérez', cantidad: 12.5 });
        responderHistorial([]);
      });

      it('usa 7 días de vigencia para un producto perecedero', () => {
        component.entradaFilas[0].perecedero = true;

        component.guardarEntrada();

        const peticion = httpTestingController.expectOne(esPost);
        expect(peticion.request.body.id_tipo_mercado).toBe(1);
        expect(peticion.request.body.fecha_vencimiento).toBe('2026-10-17');
        peticion.flush({ id: 99 });
        responderHistorial([]);
      });

      it('deja solo los productos fallidos para reintentar', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        component.guardarEntrada();
        httpTestingController.expectOne(esPost).flush({}, { status: 500, statusText: 'Server Error' });

        expect(component.guardandoEntrada).toBe(false);
        expect(component.mostrarModalEntrada).toBe(true);
        expect(component.entradaFilas.length).toBe(1);
        expect(component.entradaFilas[0].cantidad).toBe(12.5);
        expect(component.errorEntrada).toContain('Se guardaron 0 y fallaron 1');
        expect(alertas.success).not.toHaveBeenCalled();
      });
    });
  });

  // ===================== FECHAS Y ESTADOS =====================
  describe('fechas y estados', () => {
    it('da formato corto y largo a las fechas', () => {
      expect(component.fechaCorta('2026-10-10')).toBe('10/10/2026');
      expect(component.fechaCorta('')).toBe('');

      const texto = component.fechaDiaModal('2026-10-16').toLowerCase();
      expect(texto).toContain('16');
      expect(texto).toContain('octubre');
      expect(texto).toContain('2026');
      expect(component.fechaDiaModal('')).toBe('');
    });

    it('calcula el estado según los días que faltan para vencer', () => {
      const fila = (categoria: 'Granos' | 'Perecederos', dias: number) => ({
        idIngrediente: 3, idTipoMercado: 1, ingrediente: 'X', tipoMercado: '', categoria, frecuencia: '',
        cantidad: 1, unidad: 'Kg', fechaRecepcion: isoEn(-1), fechaVencimiento: isoEn(dias),
      });

      expect(component.estadoDe(fila('Perecederos', -1))).toBe('Vencido');
      expect(component.estadoDe(fila('Perecederos', 5))).toBe('Próximo a vencer');
      expect(component.estadoDe(fila('Perecederos', 10))).toBe('Vigente');
      expect(component.estadoDe(fila('Granos', 20))).toBe('Próximo a vencer');
      expect(component.estadoDe(fila('Granos', 40))).toBe('Vigente');
    });

    it('Escape cierra primero el inventario, luego el modal de entrada y luego el del día', () => {
      component.mostrarModalInventario = true;
      component.mostrarModalEntrada = true;
      component.modalDiaAbierto = true;

      component.alPresionarEsc();
      expect(component.mostrarModalInventario).toBe(false);
      expect(component.mostrarModalEntrada).toBe(true);

      component.alPresionarEsc();
      expect(component.mostrarModalEntrada).toBe(false);
      expect(component.modalDiaAbierto).toBe(true);

      component.alPresionarEsc();
      expect(component.modalDiaAbierto).toBe(false);
    });
  });

  // ===================== EXCEL =====================
  describe('exportar a Excel', () => {
    it('avisa cuando no hay registros para exportar', () => {
      component.exportarExcelHistorial();

      expect(alertas.warning).toHaveBeenCalledWith('Sin registros', 'No hay registros para exportar.');
    });
  });

  // ===================== CALENDARIO =====================
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

    it('al elegir un día gris cambia al mes de ese día y abre el registro del día', () => {
      component.seleccionarDia('2026-09-30');

      expect(component.diaSeleccionado).toBe('2026-09-30');
      expect(component.tituloMes).toBe('Septiembre 2026');
      expect(component.modalDiaAbierto).toBe(true);
    });

    it('el buscador también filtra el calendario', () => {
      component.historial = [
        entrega('2026-10-15', 'Arroz', '2099-12-31', 1),
        entrega('2026-10-15', 'Frijol', '2099-12-31', 2),
      ];

      component.textoFiltro = 'arroz';

      expect(component.diasCalendario.find(d => d.iso === '2026-10-15')?.entregas).toBe(1);
      expect(component.registrosDelDia[0].items.map(e => e.ingrediente)).toEqual(['Arroz']);
    });

    it('el registro del día lista lo entregado y lo que vence', () => {
      component.historial = [
        entrega('2026-10-15', 'Frijol', '2026-11-30', 1),
        entrega('2026-10-15', 'Arroz', '2026-11-30', 2),
        entrega('2026-10-01', 'Pollo', '2026-10-15', 3),
      ];

      expect(component.registrosDelDia.length).toBe(1);
      expect(component.registrosDelDia[0].codigo).toBe('CI-20261015');
      expect(component.registrosDelDia[0].items.map(e => e.ingrediente)).toEqual(['Arroz', 'Frijol']);
      expect(component.vencenDelDia.map(e => e.ingrediente)).toEqual(['Pollo']);
    });

    it('la opción Calendario muestra el calendario en lugar del catálogo', () => {
      component.irACalendario();
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent as string;
      expect(component.mostrarCalendario).toBe(true);
      expect(texto).toContain('Octubre 2026');
      expect(texto).not.toContain('Categorías de Abastecimiento SIRAE');
    });

    it('el catálogo se ve mientras el calendario está cerrado', () => {
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent as string;
      expect(component.mostrarCalendario).toBe(false);
      expect(texto).toContain('Categorías de Abastecimiento SIRAE');
      expect(texto).toContain('Arroz');
    });
  });
});