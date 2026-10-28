import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '@core/auth';
import { Reportes } from './reportes';
import { InventarioOperativoService } from '../services/inventario-operativo.service';
import { SweetAlertService } from '../sweet-alert.service';
import { EntregasService } from '../features/entregas/services/entregas.service';
import { SiraeService } from '../features/contratos/services/contratos_pae.service';

const entrega = (datos: Record<string, unknown>) => ({
  ingrediente: 'Arroz', tipoMercado: 'Granos', frecuencia: '', cantidad: 10, unidad: 'Kg',
  fechaRecepcion: '2026-10-01', fechaVencimiento: '', estado: 'RECIBIDA', idInstitucion: 5, ...datos,
});

const sedes = [
  { id_sede: 1, nombre_sede: 'Sede 1', id_institucion: 5 },
  { id_sede: 2, nombre_sede: 'Sede 2', id_institucion: 5 },
];
const contratos = [
  { id_sede: 1, id_institucion: 5, cupos: 100, estado: 'ACTIVO' },
  { id_sede: 1, id_institucion: 5, cupos: 999, estado: 'FINALIZADO' },   // no cuenta: ya terminó
  { id_sede: 2, id_institucion: 5, cupos: 50, estado: 'ACTIVO' },
];
const entregas = [
  entrega({ id: 1, idSede: 1, ingrediente: 'Arroz', cantidad: 10, cantidadRecibida: 10, fechaRecepcion: '2026-10-01' }),
  entrega({ id: 2, idSede: 1, ingrediente: 'Arroz', cantidad: 5, cantidadRecibida: 4, estado: 'CON_NOVEDAD', fechaRecepcion: '2026-10-02' }),
  entrega({ id: 3, idSede: 2, ingrediente: 'Lentejas', cantidad: 8, estado: 'RECHAZADA', fechaRecepcion: '2026-10-01' }),
  entrega({ id: 4, idSede: 2, ingrediente: 'Leche', cantidad: 20, unidad: 'Litros', fechaRecepcion: '2026-10-03' }),
  entrega({ id: 5, ingrediente: 'Arroz', fechaRecepcion: '2026-10-03' }),   // sin sede
];

describe('Reportes', () => {
  let component: Reportes;
  let fixture: ComponentFixture<Reportes>;
  const inventarioMock = {
    cargarSalidas: vi.fn(() => of([
      { id: 1, ingredienteId: 10, usuarioId: 14, fecha: '2026-10-10T08:00:00', cantidad: 3, unidadId: 2, observaciones: 'Distribución de alimentos' },
    ])),
    cargarIngredientes: vi.fn(() => of([{ id: 10, nombre: 'Arroz', unidadId: 2, categoriaId: 1 }])),
    cargarUnidades: vi.fn(() => of([{ id: 2, nombre: 'Kilogramo', abreviatura: 'kg' }])),
  };
  const entregasMock = { cargar: vi.fn() };
  const siraeMock = { getSedes: vi.fn(), getContratos: vi.fn() };
  const authMock = { institucionActiva$: of(null) };
  const alertasMock = { error: vi.fn(), warning: vi.fn(), success: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    entregasMock.cargar.mockReturnValue(of(entregas));
    siraeMock.getSedes.mockReturnValue(of(sedes));
    siraeMock.getContratos.mockReturnValue(of(contratos));

    await TestBed.configureTestingModule({
      imports: [Reportes],
      providers: [
        { provide: InventarioOperativoService, useValue: inventarioMock },
        { provide: EntregasService, useValue: entregasMock },
        { provide: SiraeService, useValue: siraeMock },
        { provide: AuthService, useValue: authMock },
        { provide: SweetAlertService, useValue: alertasMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Reportes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows real inventory outflows and filters by date', () => {
    component.cargar();
    component.fechaDesde = '2026-10-11';

    expect(component.salidas).toHaveLength(1);
    expect(component.salidas[0].ingrediente).toBe('Arroz');
    expect(component.salidasFiltradas).toHaveLength(0);
  });

  it('calcula los totales con sedes, cupos de contratos vigentes y entregas', () => {
    component.cargar();

    expect(component.totales).toEqual({
      sedes: 2, cupos: 150, entregas: 4, kilos: 14, novedades: 2, dias: 3, ingredientes: 3,
    });
    // Orden por defecto: más kilos recibidos primero
    expect(component.resumenSedes.map(s => s.nombre)).toEqual(['Sede 1', 'Sede 2']);
    expect(component.resumenSedes[0]).toMatchObject({
      cupos: 100, entregas: 2, kilos: 14, novedades: 1, dias: 2, ingredienteTop: 'Arroz', ultimaEntrega: '2026-10-02',
    });
    // Solo cuentan los kilos ya recibidos: una rechazada o en litros no suma
    expect(component.resumenSedes[1].kilos).toBe(0);
  });

  it('avisa de las entregas que no tienen sede', () => {
    component.cargar();
    expect(component.avisoDatos).toContain('1 entrega no tiene sede asignada');
  });

  it('filtra por sede y por fecha', () => {
    component.cargar();

    component.sedeFiltro = 2;
    expect(component.resumenSedes).toHaveLength(1);
    expect(component.totales.entregas).toBe(2);

    component.sedeFiltro = 'Todas';
    component.fechaDesde = '2026-10-02';
    expect(component.totales.entregas).toBe(2);
    expect(component.totales.kilos).toBe(4);
  });

  it('ordena la tabla por la columna elegida', () => {
    component.cargar();

    component.ordenarPor('nombre');
    expect(component.resumenSedes.map(s => s.nombre)).toEqual(['Sede 1', 'Sede 2']);
    component.ordenarPor('nombre');
    expect(component.resumenSedes.map(s => s.nombre)).toEqual(['Sede 2', 'Sede 1']);
  });

  it('muestra el detalle de una sede: entregas recientes primero e ingredientes', () => {
    component.cargar();
    component.abrirSede(component.resumenSedes[0]);

    expect(component.entregasSede.map(e => e.fecha)).toEqual(['2026-10-02', '2026-10-01']);
    expect(component.ingredientesSede).toEqual([{ ingrediente: 'Arroz', veces: 2 }]);
  });

  it('pide solo las sedes de la institución activa', () => {
    component.institucionActiva = { id_institucion: 5, nombre_institucion: 'Colegio' };
    component.cargar();

    expect(siraeMock.getSedes).toHaveBeenCalledWith(5);
  });

  it('si fallan los contratos, el reporte sigue con aviso y cupos en cero', () => {
    siraeMock.getContratos.mockReturnValue(throwError(() => new Error('falló')));
    component.cargar();

    expect(component.avisoDatos).toContain('los contratos');
    expect(component.totales.cupos).toBe(0);
    expect(component.totales.entregas).toBe(4);
    expect(component.salidas).toHaveLength(1);
  });

  it('si fallan las salidas de inventario, muestra el error', () => {
    inventarioMock.cargarSalidas.mockReturnValueOnce(throwError(() => new Error('falló')));
    component.cargar();

    expect(component.errorMensaje).not.toBe('');
    expect(component.cargando).toBe(false);
  });
});