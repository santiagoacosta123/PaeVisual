import { of, throwError } from 'rxjs';
import { ContratosComponent } from './contratos';

describe('ContratosComponent', () => {
  let component: ContratosComponent;
  let siraeMock: any;
  let routerMock: any;
  let cdrMock: any;
  let sweetAlertMock: any;

  const contratosMock = [
    {
      id_contrato: 1,
      numero_cor: 'COR-2026-001',
      institucion: 'I.E. Gabriel García Márquez',
      cupos: 590,
      id_usuario_supervisor: 12,
      supervisor_nombre: 'Ing. Carlos Mendoza',
      fecha_inicio: '2026-01-15',
      fecha_fin: '2026-11-25', // Dentro de 15 días (Próximo a vencer)
      estado: 'Activo',
      zona: 'Norte'
    },
    {
      id_contrato: 2,
      numero_cor: 'COR-2026-002',
      institucion: 'Colegio Simón Bolívar',
      cupos: 320,
      id_usuario_supervisor: null,
      supervisor_nombre: null,
      fecha_inicio: '2026-02-01',
      fecha_fin: '2026-10-15', // Fecha pasada pero con estado Inactivo
      estado: 'Inactivo',
      zona: 'Sur'
    },
    {
      id_contrato: 3,
      numero_cor: 'COR-2026-003',
      institucion: 'Escuela Rural La Esperanza',
      cupos: 150,
      id_usuario_supervisor: null,
      supervisor_nombre: null,
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-10-31', // Fecha pasada con estado original Activo -> debe pasar a Finalizado
      estado: 'Activo',
      zona: 'Rural'
    },
    {
      id_contrato: 4,
      numero_cor: 'COR-2026-004',
      institucion: 'I.E. Ciudad de Pasto',
      cupos: 800,
      id_usuario_supervisor: 14,
      supervisor_nombre: 'Dra. Elena Ruiz',
      fecha_inicio: '2026-01-10',
      fecha_fin: '2027-06-30', // Más de 30 días -> Activo Vigente normal
      estado: 'Activo',
      zona: 'Centro'
    }
  ];

  beforeEach(() => {
    siraeMock = {
      getContratos: vi.fn().mockReturnValue(of(contratosMock)),
      actualizarContrato: vi.fn().mockReturnValue(of({})),
      getJornadas: vi.fn().mockReturnValue(of([])),
      getSeccionesMenu: vi.fn().mockReturnValue(of([])),
      getInstituciones: vi.fn().mockReturnValue(of([])),
      getSedes: vi.fn().mockReturnValue(of([])),
    };
    routerMock = { navigate: vi.fn() };
    cdrMock = { detectChanges: vi.fn() };
    sweetAlertMock = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

    component = new ContratosComponent(
      routerMock as any,
      siraeMock as any,
      cdrMock as any,
      sweetAlertMock as any
    );
    component.ngOnInit();
  });

  it('debe crear el componente de gestión de contratos', () => {
    expect(component).toBeTruthy();
  });

  it('debe cargar los contratos registrados en SIRAE al iniciar', () => {
    expect(component.contratos.length).toBe(4);
    expect(component.contratos[0].codigo).toBe('COR-2026-001');
    expect(component.contratos[0].cupos).toBe(590);
    expect(component.contratos[0].supervisor).toBe('Ing. Carlos Mendoza');
  });

  it('debe asignar "Sin asignar" cuando un contrato no tiene supervisor encargado', () => {
    expect(component.contratos[1].supervisor).toBe('Sin asignar');
  });

  it('debe filtrar los contratos por número de contrato o por institución educativa', () => {
    component.filtroBusquedaContratos = 'COR-2026-001';
    expect(component.contratosFiltrados.length).toBe(1);
    expect(component.contratosFiltrados[0].codigo).toBe('COR-2026-001');

    component.filtroBusquedaContratos = 'Simón Bolívar';
    expect(component.contratosFiltrados.length).toBe(1);
    expect(component.contratosFiltrados[0].institucion).toBe('Colegio Simón Bolívar');
  });

  it('debe restaurar todos los contratos al limpiar el campo de búsqueda', () => {
    component.filtroBusquedaContratos = 'Inexistente';
    expect(component.contratosFiltrados.length).toBe(0);

    component.limpiarBusquedaContratos();
    expect(component.filtroBusquedaContratos).toBe('');
    expect(component.contratosFiltrados.length).toBe(4);
  });

  it('debe abrir el modal en modo consulta al seleccionar la acción de ver detalle', () => {
    component.abrirModalGrandeContrato('1', 'consulta');
    expect(component.modalGrandeAbierto).toBe(true);
    expect(component.contratoIdSeleccionado).toBe('1');
    expect(component.modoModalDetalle).toBe('consulta');
  });

  it('debe abrir el modal en modo edición al seleccionar la acción de editar contrato', () => {
    component.abrirModalGrandeContrato('1', 'edicion');
    expect(component.modalGrandeAbierto).toBe(true);
    expect(component.contratoIdSeleccionado).toBe('1');
    expect(component.modoModalDetalle).toBe('edicion');
  });

  it('debe manejar adecuadamente los errores si falla la carga desde la API', () => {
    siraeMock.getContratos.mockReturnValue(throwError(() => new Error('Error de red')));
    component.cargarContratos();
    expect(component.cargandoContratos).toBe(false);
    expect(component.errorCargaContratos).toBeTruthy();
  });

  describe('Control de Vigencia de Contratos (Criterios de Aceptación)', () => {
    it('Criterio 1 - debe identificar los contratos próximos a su fecha de finalización', () => {
      // Contrato 1 vence el 2026-11-25 (a 15 días del 10 de nov)
      expect(component.contratos[0].esProximoAVencer).toBe(true);
      expect(component.contratos[0].alertaNivel).toBe('advertencia');
      expect(component.contratos[0].diasRestantes).toBe(15);
      expect(component.contratos[0].mensajeVigencia).toContain('Vence en 15 días');

      // Contrato 4 vence en 2027 (> 30 días) -> no es próximo a vencer
      expect(component.contratos[3].esProximoAVencer).toBe(false);
      expect(component.contratos[3].alertaNivel).toBe('normal');
    });

    it('Criterio 2 - debe generar alertas y contabilizar contratos próximos a vencer', () => {
      expect(component.totalContratosProximosVencer).toBe(1);
      expect(component.contratosProximosAVencer.length).toBe(1);
      expect(component.contratosProximosAVencer[0].codigo).toBe('COR-2026-001');
    });

    it('Criterio 3 - al cumplirse la fecha de finalización, debe actualizar el estado a Finalizado', () => {
      // Contrato 3 tenía fecha fin 2026-10-31 (ya venció) y estado original Activo
      const contratoVencido = component.contratos.find(c => c.codigo === 'COR-2026-003');
      expect(contratoVencido).toBeDefined();
      expect(contratoVencido?.estado).toBe('Finalizado');
      expect(contratoVencido?.alertaNivel).toBe('vencido');
      expect(contratoVencido?.diasRestantes).toBeLessThan(0);
      expect(siraeMock.actualizarContrato).toHaveBeenCalledWith(3, expect.objectContaining({ estado: 'Finalizado' }));
    });

    it('Criterio 6 - debe diferenciar los estados Activo, Inactivo y Finalizado y permitir filtrar por vigencia', () => {
      // Filtrar sólo Próximos a Vencer
      component.cambiarFiltroVigencia('PROXIMO_VENCER');
      expect(component.contratosFiltrados.length).toBe(1);
      expect(component.contratosFiltrados[0].codigo).toBe('COR-2026-001');

      // Filtrar sólo Finalizados
      component.cambiarFiltroVigencia('FINALIZADO');
      expect(component.contratosFiltrados.length).toBe(1);
      expect(component.contratosFiltrados[0].codigo).toBe('COR-2026-003');

      // Filtrar sólo Inactivos
      component.cambiarFiltroVigencia('INACTIVO');
      expect(component.contratosFiltrados.length).toBe(1);
      expect(component.contratosFiltrados[0].codigo).toBe('COR-2026-002');

      // Filtrar Activos plenamente vigentes (> 30 días)
      component.cambiarFiltroVigencia('ACTIVO');
      expect(component.contratosFiltrados.length).toBe(1);
      expect(component.contratosFiltrados[0].codigo).toBe('COR-2026-004');

      // Restaurar a Todos
      component.cambiarFiltroVigencia('TODOS');
      expect(component.contratosFiltrados.length).toBe(4);
    });
  });
});
