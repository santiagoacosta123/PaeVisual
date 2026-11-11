import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '@core/auth';
import { Reportes } from './reportes';
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
  const entregasMock = { cargar: vi.fn() };
  const siraeMock = { getSedes: vi.fn(), getContratos: vi.fn() };
  const authMock = { institucionActiva$: of({ id_institucion: 5, nombre_institucion: 'Colegio' }), sedeActiva$: of(null) };
  const alertasMock = { error: vi.fn(), warning: vi.fn(), success: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    entregasMock.cargar.mockReturnValue(of(entregas));
    siraeMock.getSedes.mockReturnValue(of(sedes));
    siraeMock.getContratos.mockReturnValue(of(contratos));

    await TestBed.configureTestingModule({
      imports: [Reportes],
      providers: [
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
  });

  it('si fallan todas las consultas, avisa y deja el reporte vacío sin romperse', () => {
    siraeMock.getSedes.mockReturnValue(throwError(() => new Error('falló')));
    siraeMock.getContratos.mockReturnValue(throwError(() => new Error('falló')));
    entregasMock.cargar.mockReturnValue(throwError(() => new Error('falló')));
    component.cargar();

    expect(component.cargando).toBe(false);
    expect(component.avisoDatos).toContain('las sedes');
    expect(component.totales.sedes).toBe(0);
    expect(component.resumenSedes).toHaveLength(0);
  });
});

import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlanillasPaeService } from '../services/planillas-pae.service';
import { environment } from '@env/environment';

describe('PlanillasPaeService y flujo SIR-170 a SIR-173 (sin datos quemados)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('sin HttpClient retorna estructuras vacías sin datos quemados', () => {
    TestBed.configureTestingModule({
      providers: [PlanillasPaeService, { provide: HttpClient, useValue: null }],
    });
    const svc = TestBed.inject(PlanillasPaeService);

    let consolidadoResp: any;
    svc.consultarReporteConsolidado().subscribe(r => { consolidadoResp = r; });

    let plantillasResp: any;
    svc.listarPlantillas().subscribe(r => { plantillasResp = r; });

    let planillasResp: any;
    svc.listarPlanillas().subscribe(r => { planillasResp = r; });

    expect(plantillasResp).toEqual([]);
    expect(planillasResp).toEqual([]);
    expect(consolidadoResp.comparativo_productos).toEqual([]);
    expect(consolidadoResp.consolidado_sedes).toEqual([]);
    expect(consolidadoResp.detalle).toEqual([]);
  });

  it('consulta reporte consolidado y planillas con los filtros reales hacia el API', () => {
    TestBed.configureTestingModule({
      providers: [PlanillasPaeService, provideHttpClient(), provideHttpClientTesting()],
    });
    const svc = TestBed.inject(PlanillasPaeService);
    const http = TestBed.inject(HttpTestingController);

    let respuesta: any;
    svc.consultarReporteConsolidado({
      tipo_reporte: 'RECEPCIONES_DIFERENCIAS',
      id_institucion: 12,
      id_sede: 34,
    }).subscribe(r => { respuesta = r; });

    const req = http.expectOne(r =>
      r.url === `${environment.apiUrl}/reportes/consolidados/` &&
      r.params.get('tipo_reporte') === 'RECEPCIONES_DIFERENCIAS' &&
      r.params.get('id_institucion') === '12' &&
      r.params.get('id_sede') === '34'
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      tipo_reporte: 'RECEPCIONES_DIFERENCIAS',
      tipos_disponibles: [{ codigo: 'RECEPCIONES_DIFERENCIAS', nombre: 'Recepciones' }],
      filtros_aplicados: { id_institucion: 12, id_sede: 34 },
      permisos_usuario: { rol: 'supervisor', alcance: null },
      fecha_actualizacion: '2026-11-11',
      resumen_ejecutivo: { sedes_autorizadas: 1, total_entregas: 3 },
      comparativo_productos: [],
      consolidado_sedes: [{ id_sede: 34, nombre: 'Sede Real 34' }],
      desagregado_grados: [],
      detalle: [],
      responsables: {},
      registros_origen: { sede_ids: [34] },
    });

    expect(respuesta.consolidado_sedes[0].nombre).toBe('Sede Real 34');

    // Listar plantillas paginadas DRF ({ results: [...] })
    let listTpl: any[] = [];
    svc.listarPlantillas({ categoria_proceso: 'REMISION' }).subscribe(r => { listTpl = r; });
    const reqTpl = http.expectOne(r => r.url === `${environment.apiUrl}/reportes/plantillas/`);
    reqTpl.flush({ count: 1, results: [{ id_plantilla: 1, codigo: 'PAE-REM-OFICIAL', nombre: 'Remisión Oficial' }] });
    expect(listTpl).toHaveLength(1);
    expect(listTpl[0].codigo).toBe('PAE-REM-OFICIAL');

    http.verify();
  });

  it('en Reportes coordina generación automática, edición manual de tabla, validación y Jefa de manipuladoras', async () => {
    const planillasSvcMock = {
      obtenerAlcance: vi.fn().mockReturnValue(of({
        rol: 'Jefa de manipuladoras',
        alcance: null,
        instituciones: [{ id_institucion: 10, nombre_institucion: 'IE Real', nit: '9001', estado: 'ACTIVA' }],
        sedes: [{ id_sede: 20, nombre_sede: 'Sede Central Real', codigo_dane: '123', id_institucion: 10, nombre_institucion: 'IE Real', estado: 'ACTIVA' }],
        contratos: [],
        jornadas: [],
      })),
      obtenerMetadatosPlantillas: vi.fn().mockReturnValue(of({
        procesos_pae: [{ codigo: 'REMISION', nombre: 'Remisión', descripcion: '' }],
        roles_disponibles: [{ codigo: 'Jefa de manipuladoras', nombre: 'Jefa' }],
        fuentes_sirae: [{ codigo: 'CONSUMO', nombre: 'Consumo', campos: ['cantidad_programada'] }],
        unidades_medida: [],
      })),
      listarPlantillas: vi.fn().mockReturnValue(of([])),
      consultarReporteConsolidado: vi.fn().mockReturnValue(of({
        tipo_reporte: 'RESUMEN_GENERAL',
        tipos_disponibles: [{ codigo: 'RESUMEN_GENERAL', nombre: 'Resumen General' }],
        filtros_aplicados: {},
        permisos_usuario: { rol: 'Jefa de manipuladoras', alcance: null },
        fecha_actualizacion: '2026-11-11',
        resumen_ejecutivo: {},
        comparativo_productos: [],
        consolidado_sedes: [],
        desagregado_grados: [],
        detalle: [],
        responsables: {},
        registros_origen: {},
      })),
      listarPlanillas: vi.fn().mockReturnValue(of([])),
      generarPlanilla: vi.fn().mockReturnValue(of({
        mensaje: 'Generada correctamente',
        creada: true,
        planilla: {
          id_planilla: 99,
          codigo_documento: 'PLN-REMI-20-001',
          nombre_documento: 'Remisión Real',
          categoria_proceso: 'REMISION',
          estado: 'BORRADOR',
          periodo: '2026-11',
          id_institucion: 10,
          institucion_nombre: 'IE Real',
          id_sede: 20,
          sede_nombre: 'Sede Central Real',
          contrato_numero: 'C-01',
          jornada_nombre: 'Única',
          id_plantilla_version: 1,
          plantilla_id: 1,
          plantilla_codigo: 'PAE-REM-OFICIAL',
          plantilla_nombre: 'Remisión',
          version_numero: 1,
          evento_origen: 'GENERACION_MANUAL_UI',
          responsable_nombre: 'Usuario Prueba',
          fecha_generacion: '2026-11-11T15:00:00Z',
          total_pendientes: 1,
          observaciones: '',
          valores_manuales: {},
          campos_pendientes: [{ tipo: 'CAMPO', codigo: 'obs_rec', etiqueta: 'Obs', origen: 'MANUAL', motivo: 'Pendiente' }],
          contenido_snapshot: {
            encabezado: { titulo: 'Remisión Real', institucion: { nombre: 'IE Real' }, sede: { nombre: 'Sede Central Real' } },
            campos: [{ codigo: 'obs_rec', etiqueta: 'Obs', origen: 'MANUAL', valor: 'PENDIENTE', pendiente: true }],
            tablas: [],
          },
        },
      })),
      actualizarPlanilla: vi.fn().mockImplementation((_id, payload) => of({
        id_planilla: 99,
        codigo_documento: 'PLN-REMI-20-001',
        nombre_documento: 'Remisión Real',
        categoria_proceso: 'REMISION',
        estado: payload.estado || 'PENDIENTE',
        periodo: '2026-11',
        id_institucion: 10,
        institucion_nombre: 'IE Real',
        id_sede: 20,
        sede_nombre: 'Sede Central Real',
        contrato_numero: 'C-01',
        jornada_nombre: 'Única',
        id_plantilla_version: 1,
        plantilla_id: 1,
        plantilla_codigo: 'PAE-REM-OFICIAL',
        plantilla_nombre: 'Remisión',
        version_numero: 1,
        evento_origen: 'GENERACION_MANUAL_UI',
        responsable_nombre: 'Usuario Prueba',
        fecha_generacion: '2026-11-11T15:00:00Z',
        total_pendientes: 0,
        observaciones: payload.observaciones || '',
        valores_manuales: payload.valores_manuales || {},
        campos_pendientes: [],
        contenido_snapshot: { encabezado: {}, campos: [], tablas: [] },
      })),
    };

    const authFullMock = {
      institucionActiva$: of(null),
      sedeActiva$: of(null),
      obtenerUsuario: () => ({ rol: 'Jefa de manipuladoras' }),
      esSuperAdministrador: () => false,
      esSupervisor: () => false,
      esAdministrador: () => false,
      esJefa: () => true,
    };

    await TestBed.configureTestingModule({
      imports: [Reportes],
      providers: [
        { provide: EntregasService, useValue: { cargar: () => of([]) } },
        { provide: SiraeService, useValue: { getSedes: () => of([]), getContratos: () => of([]) } },
        { provide: AuthService, useValue: authFullMock },
        { provide: SweetAlertService, useValue: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } },
        { provide: PlanillasPaeService, useValue: planillasSvcMock },
      ],
    }).compileComponents();

    const fx = TestBed.createComponent(Reportes);
    const cmp = fx.componentInstance;
    await fx.whenStable();

    // Para Jefa inicia automáticamente en 'planillas'
    expect(cmp.esJefa).toBe(true);
    expect(cmp.pestanaActiva).toBe('planillas');

    cmp.genPeriodo = '2026-11';
    cmp.generarNuevaPlanilla(false);
    expect(planillasSvcMock.generarPlanilla).toHaveBeenCalled();
    expect(cmp.planillaActiva?.codigo_documento).toBe('PLN-REMI-20-001');

    cmp.actualizarManualTabla('TABLA_1', 0, 'lote', 'LOTE-2026');
    cmp.guardarManualesPlanilla('VALIDADO');
    expect(planillasSvcMock.actualizarPlanilla).toHaveBeenCalledWith(99, expect.objectContaining({
      estado: 'VALIDADO',
      valores_manuales: expect.objectContaining({
        __tablas__: { TABLA_1: { '0': { lote: 'LOTE-2026' } } },
      }),
    }));
    expect(cmp.planillaActiva?.estado).toBe('VALIDADO');
  });
});