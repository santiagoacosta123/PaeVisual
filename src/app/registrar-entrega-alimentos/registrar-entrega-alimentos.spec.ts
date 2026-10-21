import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import {
  CategoriaMenu,
  GrupoProductos,
  Producto,
  RegistrarEntregaAlimentosComponent,
  URL_ENTREGAS,
  URL_INGREDIENTES,
  URL_TIPOS_MERCADO
} from './registrar-entrega-alimentos';

describe('RegistrarEntregaAlimentosComponent', () => {
  let fixture: ComponentFixture<RegistrarEntregaAlimentosComponent>;
  let component: RegistrarEntregaAlimentosComponent;
  let http: HttpTestingController;

  const TIPOS = [
    { id: 1, nombre: 'Perecedero' },
    { id: 2, nombre: 'No perecedero' }
  ];

  const PRODUCTOS = [
    { nombre: 'Arroz', categoria: 'Granos y cereales', unidad: 'Kg', idTipoMercado: 2, frecuenciaDias: 15 },
    { nombre: 'Frijol', categoria: 'Granos y cereales', unidad: 'Kg', idTipoMercado: 2, frecuenciaDias: 15 },
    { nombre: 'Leche', categoria: 'Lácteos', unidad: 'L', idTipoMercado: 1, frecuenciaDias: 7 },
    { nombre: 'Carne de res', categoria: 'Carnes y huevos', unidad: 'Kg', idTipoMercado: 1, frecuenciaDias: 8 }
  ];

  /** Busca un producto del catálogo y falla con un mensaje claro si no existe (evita usar "!"). */
  function buscarProducto(nombre: string) {
    const encontrado = component.catalogo.find((prod: Producto) => prod.nombre === nombre);
    if (!encontrado) {
      throw new Error(`El producto "${nombre}" no está en el catálogo de la prueba`);
    }
    return encontrado;
  }

  /** Arranca el componente y responde las 3 peticiones iniciales. */
  function iniciar(opciones: { catalogoOk?: boolean; historial?: unknown[] } = {}): void {
    const { catalogoOk = true, historial = [] } = opciones;

    fixture.detectChanges(); // dispara ngOnInit

    const reqProductos = http.expectOne({ method: 'GET', url: URL_INGREDIENTES });
    const reqTipos = http.expectOne({ method: 'GET', url: URL_TIPOS_MERCADO });
    const reqHistorial = http.expectOne({ method: 'GET', url: URL_ENTREGAS });

    if (catalogoOk) {
      reqProductos.flush(PRODUCTOS);
      reqTipos.flush(TIPOS);
    } else {
      reqProductos.flush('error', { status: 500, statusText: 'Server Error' });
      reqTipos.flush('error', { status: 500, statusText: 'Server Error' });
    }
    reqHistorial.flush(historial);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrarEntregaAlimentosComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrarEntregaAlimentosComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('se crea el componente', () => {
    iniciar();
    expect(component).toBeTruthy();
  });

  describe('carga del catálogo', () => {
    it('carga los productos y tipos del servidor', () => {
      iniciar();
      expect(component.catalogo.length).toBe(4);
      expect(component.tiposMercado.length).toBe(2);
      expect(component.errorCatalogos).toBe('');
    });

    it('usa productos de ejemplo cuando el servidor responde 500', () => {
      iniciar({ catalogoOk: false });
      expect(component.errorCatalogos).not.toBe('');
      expect(component.catalogo.length).toBe(20);
      expect(component.tiposMercado.length).toBe(2);
    });

  });

  describe('categorías de abastecimiento', () => {
    beforeEach(() => iniciar());

    it('arma la lista de categorías con "Todos" primero y su conteo', () => {
      const cats = component.categoriasMenu;
      expect(cats[0].nombre).toBe('Todos');
      expect(cats[0].total).toBe(4);
      const granos = cats.find((c: CategoriaMenu) => c.nombre === 'Granos y cereales');
      expect(granos?.total).toBe(2);
    });

    it('agrupa los productos por categoría', () => {
      const nombres = component.gruposMenu.map((g: GrupoProductos) => g.nombre);
      expect(nombres).toEqual(['Carnes y huevos', 'Granos y cereales', 'Lácteos']);
      const granos = component.gruposMenu.find((g: GrupoProductos) => g.nombre === 'Granos y cereales');
      expect(granos?.productos.length).toBe(2);
    });

    it('filtra por categoría', () => {
      component.categoriaMenu = 'Lácteos';
      expect(component.productosMenu.map((prod: Producto) => prod.nombre)).toEqual(['Leche']);
    });

    it('filtra por texto sin importar tildes ni mayúsculas', () => {
      component.textoFiltro = 'LACTEOS';
      expect(component.productosMenu.length).toBe(0);
      component.textoFiltro = 'carne';
      expect(component.productosMenu.map((prod: Producto) => prod.nombre)).toEqual(['Carne de res']);
    });

    it('filtra perecederos y no perecederos', () => {
      component.setMercado('Perecederos');
      expect(component.productosMenu.map((prod: Producto) => prod.nombre).sort()).toEqual(['Carne de res', 'Leche']);

      component.setMercado('Granos');
      expect(component.productosMenu.map((prod: Producto) => prod.nombre).sort()).toEqual(['Arroz', 'Frijol']);
    });

    it('indica si un producto es perecedero', () => {
      const leche = buscarProducto('Leche');
      const arroz = buscarProducto('Arroz');
      expect(component.esPerecedero(leche)).toBe(true);
      expect(component.esPerecedero(arroz)).toBe(false);
      expect(component.nombreTipo(arroz)).toBe('No perecedero');
    });
  });

  describe('historial de entregas', () => {
    it('calcula la última entrega y el resumen', () => {
      const hoy = new Date();
      const iso = (dias: number) => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      iniciar({
        historial: [
          { ingrediente: 'Leche', cantidad: 2, unidad: 'L', tipoMercado: 'Perecedero', fechaRecepcion: iso(0), fechaVencimiento: iso(3) },
          { ingrediente: 'Arroz', cantidad: 10, unidad: 'Kg', tipoMercado: 'No perecedero', fechaRecepcion: iso(0), fechaVencimiento: iso(90) },
          { ingrediente: 'Carne de res', cantidad: 1, unidad: 'Kg', tipoMercado: 'Perecedero', fechaRecepcion: iso(-10), fechaVencimiento: iso(-2) }
        ]
      });

      expect(component.resumen).toEqual({ total: 3, vigentes: 1, porVencer: 1, vencidos: 1 });
      expect(component.ultimoRegistro?.items.length).toBe(2);
      expect(component.ultimoRegistro?.totales).toBe(12);
    });

    it('marca error cuando el historial no carga', () => {
      fixture.detectChanges();
      http.expectOne({ method: 'GET', url: URL_INGREDIENTES }).flush(PRODUCTOS);
      http.expectOne({ method: 'GET', url: URL_TIPOS_MERCADO }).flush(TIPOS);
      http.expectOne({ method: 'GET', url: URL_ENTREGAS })
        .flush('error', { status: 500, statusText: 'Server Error' });

      expect(component.errorHistorial).toBe(true);
      expect(component.cargandoHistorial).toBe(false);
    });
  });

  describe('auxiliares', () => {
    beforeEach(() => iniciar());

    it('da formato dd/mm/aaaa a las fechas', () => {
      expect(component.fechaCorta('2026-10-19')).toBe('19/10/2026');
      expect(component.fechaCorta('2026-10-19T00:00:00')).toBe('19/10/2026');
      expect(component.fechaCorta('')).toBe('—');
      expect(component.fechaCorta(null)).toBe('—');
    });

    it('devuelve categoría y emoji de un producto', () => {
      expect(component.categoriaDe('Leche')).toBe('Lácteos');
      expect(component.categoriaDe('No existe')).toBe('Otros');
      expect(component.emojiDe('Leche')).toBe('🥛');
      expect(component.emojiCategoria('Verduras')).toBe('🥕');
    });
  });
});