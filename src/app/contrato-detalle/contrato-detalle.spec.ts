import { of } from 'rxjs';
import { ContratoDetalleComponent } from './contrato-detalle';

describe('ContratoDetalleComponent', () => {
  let component: ContratoDetalleComponent;
  let siraeMock: any;
  let routeMock: any;
  let routerMock: any;
  let usuarioServiceMock: any;
  let rolServiceMock: any;
  let authServiceMock: any;
  let httpMock: any;
  let cdrMock: any;
  let sweetAlertMock: any;

  beforeEach(() => {
    siraeMock = {
      getContratos: vi.fn().mockReturnValue(of([
        {
          id_contrato: 10,
          numero_cor: 'COR-2026-010',
          institucion: 'I.E. Santander',
          id_institucion: 5,
          cupos: 600,
          id_usuario_supervisor: 3,
          fecha_inicio: '2026-01-20',
          fecha_fin: '2026-11-25',
          estado: 'Activo',
          zona: 'Norte'
        }
      ])),
      actualizarContrato: vi.fn().mockReturnValue(of({})),
      getJornadas: vi.fn().mockReturnValue(of([])),
      getSeccionesMenu: vi.fn().mockReturnValue(of([])),
      getContratosSeccionMenu: vi.fn().mockReturnValue(of([])),
      getInstituciones: vi.fn().mockReturnValue(of([
        { id_institucion: 5, nombre_institucion: 'I.E. Santander', nit: '900123456-1' }
      ])),
      getSedes: vi.fn().mockReturnValue(of([
        { id_sede: 1, nombre_sede: 'Sede Principal', id_institucion: 5, cupos: 350, estado: 'ACTIVO' },
        { id_sede: 2, nombre_sede: 'Sede B', id_institucion: 5, cupos: 150, estado: 'ACTIVO' }
      ])),
    };

    routeMock = {
      paramMap: of({ get: (key: string) => (key === 'id' ? '10' : null) })
    };
    routerMock = { navigate: vi.fn() };
    usuarioServiceMock = { getUsuarios: vi.fn().mockReturnValue(of([])) };
    rolServiceMock = { getRoles: vi.fn().mockReturnValue(of([])) };
    authServiceMock = {
      obtenerToken: vi.fn().mockReturnValue('mock-token'),
      obtenerUsuario: vi.fn().mockReturnValue({
        nombre: 'Admin',
        apellido: 'PAE',
        correo: 'admin@sirae.gov.co',
        rol: 'Superadministrador'
      })
    };
    httpMock = { get: vi.fn().mockReturnValue(of([])) };
    cdrMock = { detectChanges: vi.fn() };
    sweetAlertMock = {
      success: vi.fn().mockResolvedValue({}),
      error: vi.fn().mockResolvedValue({}),
      warning: vi.fn().mockResolvedValue({}),
      confirm: vi.fn().mockResolvedValue({ isConfirmed: true })
    };

    component = new ContratoDetalleComponent(
      routeMock as any,
      routerMock as any,
      siraeMock as any,
      usuarioServiceMock as any,
      rolServiceMock as any,
      authServiceMock as any,
      httpMock as any,
      cdrMock as any,
      sweetAlertMock as any
    );
    component.contratoId = '10';
    component.modo = 'consulta';
    component.ngOnInit();
  });

  it('debe crear el componente de detalle de contrato', () => {
    expect(component).toBeTruthy();
  });

  it('debe iniciar en modo consulta por defecto', () => {
    expect(component.modo).toBe('consulta');
  });

  it('debe calcular correctamente los cupos autorizados, asignados y pendientes de distribución', () => {
    component.contrato = {
      codigo: 'COR-2026-010',
      institucion: 'I.E. Santander',
      cupos: 600,
      estado: 'Activo'
    };

    component.sedesInstitucion = [
      { id_sede: 1, nombre_sede: 'Sede Principal', cupos: 350 },
      { id_sede: 2, nombre_sede: 'Sede B', cupos: 150 }
    ];

    expect(component.cuposAutorizados).toBe(600);
    expect(component.totalCuposAsignadosSedes).toBe(500);
    expect(component.cuposPendientesDistribucion).toBe(100);
    expect(component.tieneDistribucionRealizada).toBe(true);
    expect(component.porcentajeDistribuido).toBe(83); // 500 / 600 = 83.33%
  });

  it('debe indicar que la distribución no ha sido realizada si las sedes no tienen cupos asignados', () => {
    component.contrato = {
      codigo: 'COR-2026-010',
      institucion: 'I.E. Santander',
      cupos: 600,
      estado: 'Activo'
    };

    component.sedesInstitucion = [
      { id_sede: 1, nombre_sede: 'Sede Principal', cupos: 0 },
      { id_sede: 2, nombre_sede: 'Sede B', cupos: 0 }
    ];

    expect(component.cuposAutorizados).toBe(600);
    expect(component.totalCuposAsignadosSedes).toBe(0);
    expect(component.cuposPendientesDistribucion).toBe(600);
    expect(component.tieneDistribucionRealizada).toBe(false);
  });

  it('debe calcular el porcentaje de cupos asignado a cada sede individualmente', () => {
    component.contrato = { cupos: 500 };
    const sede = { nombre_sede: 'Sede A', cupos: 100 };
    expect(component.porcentajeCuposSede(sede)).toBe(20);
  });

  it('debe emitir evento de cierre al llamar a volver()', () => {
    const emitSpy = vi.spyOn(component.cerrar, 'emit');
    component.volver();
    expect(emitSpy).toHaveBeenCalled();
  });

  describe('Control de Vigencia en el Detalle del Contrato (Criterios de Aceptación)', () => {
    it('Criterio 1 y 2 - debe identificar si el contrato está próximo a finalizar y alertar los días restantes', () => {
      // El contrato 10 tiene fecha_fin 2026-11-25 (a 15 días del 10 de nov)
      expect(component.esContratoProximoAVencer).toBe(true);
      expect(component.diasRestantesVigencia).toBe(15);
      expect(component.mensajeVigenciaContrato).toContain('Vence en 15 días');
      expect(component.esContratoNoVigente).toBe(false);
    });

    it('Criterio 3 - al cumplirse la fecha de finalización debe actualizar el estado a Finalizado', () => {
      const resultadoVencido = component.evaluarVigencia('2026-10-31', 'Activo');
      expect(resultadoVencido.estado).toBe('Finalizado');
      expect(resultadoVencido.alertaNivel).toBe('vencido');
      expect(resultadoVencido.diasRestantes).toBeLessThan(0);
    });

    it('Criterio 4 - los contratos finalizados deben conservar toda su información y registros relacionados', () => {
      component.contrato = {
        codigo: 'COR-2026-099',
        institucion: 'I.E. Santander',
        cupos: 600,
        fecha_inicio: '2025-01-15',
        fecha_fin: '2025-11-30',
        estado: 'Finalizado',
        zona: 'Norte',
        id_usuario_supervisor: 3
      };
      component.sedesInstitucion = [
        { id_sede: 1, nombre_sede: 'Sede Principal', cupos: 350 },
        { id_sede: 2, nombre_sede: 'Sede B', cupos: 150 }
      ];
      component.contratosSeccionMenu = [
        { id_contrato_seccion: 1, id_seccion: 1 }
      ];

      expect(component.esContratoFinalizado).toBe(true);
      expect(component.contrato.codigo).toBe('COR-2026-099');
      expect(component.sedesInstitucion.length).toBe(2);
      expect(component.totalCuposAsignadosSedes).toBe(500);
      expect(component.contratosSeccionMenu.length).toBe(1);
    });

    it('Criterio 5 - no debe permitir nuevas operaciones que requieran un contrato vigente (bloqueo en Finalizado/Inactivo)', async () => {
      component.contrato.estado = 'Finalizado';
      expect(component.esContratoNoVigente).toBe(true);

      // Intentar iniciar edición en contrato finalizado debe ser bloqueado
      component.iniciarEdicionSecciones();
      expect(component.editandoSecciones).toBe(false);
      expect(sweetAlertMock.warning).toHaveBeenCalledWith(
        'Operación no permitida',
        expect.stringContaining('no vigentes o finalizados')
      );

      // Intentar guardar secciones en contrato finalizado debe ser bloqueado
      await component.guardarSeccionesContrato();
      expect(sweetAlertMock.error).toHaveBeenCalledWith(
        'Operación bloqueada',
        expect.stringContaining('no vigente')
      );
    });
  });

  describe('Asociación de secciones de menú al contrato (Criterios de Aceptación)', () => {
    beforeEach(() => {
      component.contratoId = '10';
      component.contrato.estado = 'Activo';
      component.jornadas = [
        { id_jornada: 1, id: 1, nombre_jornada: 'Jornada Mañana', nombre: 'Mañana', habilitada: false },
        { id_jornada: 2, id: 2, nombre_jornada: 'Jornada Tarde', nombre: 'Tarde', habilitada: false }
      ];
      component.seccionesMenu = [
        { id_seccion: 1, id: 1, nombre_seccion: 'Desayuno', jornada: 'Mañana', id_jornada: 1 },
        { id_seccion: 2, id: 2, nombre_seccion: 'Almuerzo Mañana', jornada: 'Mañana', id_jornada: 1 },
        { id_seccion: 3, id: 3, nombre_seccion: 'Almuerzo Tarde', jornada: 'Tarde', id_jornada: 2 },
        { id_seccion: 4, id: 4, nombre_seccion: 'Refrigerio Tarde', jornada: 'Tarde', id_jornada: 2 }
      ];
      component.contratosSeccionMenu = [
        { id_contrato_seccion: 101, id_contrato: 10, id_seccion: 1 }
      ];
    });

    it('Criterio 1 - Catálogo disponible: debe mostrar el catálogo de secciones de menú según las jornadas amparadas', () => {
      // Sin jornadas amparadas habilitadas -> 0 secciones en catálogo disponible
      expect(component.seccionesFiltradasPorJornadasHabilitadas().length).toBe(0);

      // Habilitar Jornada Mañana
      component.jornadas[0].habilitada = true;
      const catalogoManana = component.seccionesFiltradasPorJornadasHabilitadas();
      expect(catalogoManana.length).toBe(2);
      expect(catalogoManana.map(s => s.nombre_seccion)).toEqual(['Desayuno', 'Almuerzo Mañana']);

      // Habilitar también Jornada Tarde
      component.jornadas[1].habilitada = true;
      const catalogoCompleto = component.seccionesFiltradasPorJornadasHabilitadas();
      expect(catalogoCompleto.length).toBe(4);
    });

    it('Criterio 2 - Asociación y Consulta: debe permitir asociar, desasociar y consultar secciones', () => {
      // Iniciar edición debe poblar seccionesSeleccionadasIds con la sección existente (ID 1)
      component.iniciarEdicionSecciones();
      expect(component.editandoSecciones).toBe(true);
      expect(component.estaSeccionSeleccionada(1)).toBe(true);
      expect(component.estaSeccionSeleccionada(2)).toBe(false);

      // Asociar sección 2 (Almuerzo Mañana)
      component.toggleSeleccionSeccion(component.seccionesMenu[1]);
      expect(component.estaSeccionSeleccionada(2)).toBe(true);
      expect(component.totalSeccionesSeleccionadas).toBe(2);

      // Desasociar sección 1 (Desayuno)
      component.toggleSeleccionSeccion(component.seccionesMenu[0]);
      expect(component.estaSeccionSeleccionada(1)).toBe(false);
      expect(component.totalSeccionesSeleccionadas).toBe(1);

      // Cancelar edición debe restaurar estado
      component.cancelarEdicionSecciones();
      expect(component.editandoSecciones).toBe(false);
    });

    it('Criterio 3 - Validación de duplicados: debe validar en tiempo real que no existan duplicados', () => {
      component.iniciarEdicionSecciones();

      // Sección 1 ya está seleccionada
      const val1 = component.validarDuplicado(component.seccionesMenu[0]);
      expect(val1.esDuplicado).toBe(true);
      expect(val1.mensaje).toContain('ya se encuentra asociada');

      // Intentar duplicar un componente con el mismo nombre y jornada
      const seccionDuplicadaMismaJornada = {
        id_seccion: 99,
        nombre_seccion: 'Desayuno',
        jornada: 'Mañana',
        id_jornada: 1
      };
      const val2 = component.validarDuplicado(seccionDuplicadaMismaJornada);
      expect(val2.esDuplicado).toBe(true);
      expect(val2.mensaje).toContain('ya está contemplado para la misma jornada');

      // Sección distinta en jornada diferente no es duplicada
      const val3 = component.validarDuplicado(component.seccionesMenu[2]);
      expect(val3.esDuplicado).toBe(false);
    });

    it('Criterio 4 - Persistencia: al presionar Guardar, debe persistir en base de datos y actualizar la vista', async () => {
      siraeMock.crearContratoSeccionMenu = vi.fn().mockReturnValue(of({ id_contrato_seccion: 102, id_contrato: 10, id_seccion: 2 }));
      siraeMock.eliminarContratoSeccionMenu = vi.fn().mockReturnValue(of({}));
      siraeMock.getContratosSeccionMenu = vi.fn().mockReturnValue(of([
        { id_contrato_seccion: 102, id_contrato: 10, id_seccion: 2 }
      ]));

      component.iniciarEdicionSecciones();

      // Desmarcar ID 1 y marcar ID 2
      component.toggleSeleccionSeccion(component.seccionesMenu[0]); // desasocia 1
      component.toggleSeleccionSeccion(component.seccionesMenu[1]); // asocia 2

      await component.guardarSeccionesContrato();

      // Verificaciones de persistencia
      expect(siraeMock.eliminarContratoSeccionMenu).toHaveBeenCalledWith(101);
      expect(siraeMock.crearContratoSeccionMenu).toHaveBeenCalledWith({
        id_contrato: 10,
        id_seccion: 2,
        estado: 'Activo',
        valor: 0
      });
      expect(siraeMock.getContratosSeccionMenu).toHaveBeenCalledWith(10);
      expect(component.editandoSecciones).toBe(false);
      expect(component.guardandoSecciones).toBe(false);
      expect(component.contratosSeccionMenu.length).toBe(1);
    });
  });

  describe('Prórroga y Renovación de Contrato (HU Superadministrador)', () => {
    beforeEach(() => {
      component.contrato = {
        codigo: 'COR-2026-010',
        institucion: 'I.E. Santander',
        cupos: 600,
        fecha_inicio: '2026-01-20',
        fecha_fin: '2026-11-25',
        estado: 'Activo'
      };
      component.contratoId = '10';
      component.historialModificaciones = [];
    });

    it('Criterio 1: debe permitir seleccionar un contrato y abrir el modal de prórroga o renovación', () => {
      component.abrirModalProrroga('PRORROGA');
      expect(component.modalProrrogaAbierto).toBe(true);
      expect(component.tipoOperacionVigencia).toBe('PRORROGA');
      expect(component.datosProrroga.nuevaFechaInicio).toBe('2026-01-20');
      expect(component.datosProrroga.nuevosCupos).toBe(600);

      component.cambiarTipoOperacion('RENOVACION');
      expect(component.tipoOperacionVigencia).toBe('RENOVACION');
      expect(component.datosProrroga.nuevaFechaInicio).toBe('2026-11-26');
      expect(component.modalProrrogaAbierto).toBe(true);

      component.cerrarModalProrroga();
      expect(component.modalProrrogaAbierto).toBe(false);
    });

    it('Criterio 2 y 3: debe validar campos requeridos y coherencia de fechas en prórroga', () => {
      component.abrirModalProrroga('PRORROGA');

      // 1. Falta autorización
      component.datosProrroga.numeroAutorizacion = '';
      component.datosProrroga.motivo = 'Ampliación de cobertura';
      component.datosProrroga.nuevaFechaFin = '2027-02-28';
      expect(component.validarFechasProrroga()).toBe(false);
      expect(component.datosProrroga.errorValidacion).toContain('número de autorización');

      // 2. Falta motivo
      component.datosProrroga.numeroAutorizacion = 'Resolución 105';
      component.datosProrroga.motivo = '';
      expect(component.validarFechasProrroga()).toBe(false);
      expect(component.datosProrroga.errorValidacion).toContain('motivo o justificación');

      // 3. Fecha fin incoherente (anterior o igual a la actual 2026-11-25)
      component.datosProrroga.motivo = 'Ampliación';
      component.datosProrroga.nuevaFechaFin = '2026-11-20';
      expect(component.validarFechasProrroga()).toBe(false);
      expect(component.datosProrroga.errorValidacion).toContain('estrictamente posterior a la fecha de finalización actual');

      // 4. Fechas válidas en prórroga
      component.datosProrroga.nuevaFechaFin = '2027-05-30';
      expect(component.validarFechasProrroga()).toBe(true);
      expect(component.datosProrroga.errorValidacion).toBe('');
    });

    it('Criterio 3: debe validar coherencia de fechas en renovación contractual', () => {
      component.abrirModalProrroga('RENOVACION');
      component.datosProrroga.numeroAutorizacion = 'Acuerdo 2027-01';
      component.datosProrroga.motivo = 'Renovación de vigencia anual';

      // Fecha inicio anterior al contrato previo
      component.datosProrroga.nuevaFechaInicio = '2026-10-01';
      component.datosProrroga.nuevaFechaFin = '2027-10-01';
      expect(component.validarFechasProrroga()).toBe(false);
      expect(component.datosProrroga.errorValidacion).toContain('debe ser igual o posterior a la fecha de término del contrato anterior');

      // Fecha fin menor o igual a fecha inicio
      component.datosProrroga.nuevaFechaInicio = '2026-12-01';
      component.datosProrroga.nuevaFechaFin = '2026-11-30';
      expect(component.validarFechasProrroga()).toBe(false);
      expect(component.datosProrroga.errorValidacion).toContain('posterior a la fecha de inicio');

      // Fechas de renovación coherentes
      component.datosProrroga.nuevaFechaInicio = '2026-12-01';
      component.datosProrroga.nuevaFechaFin = '2027-11-30';
      expect(component.validarFechasProrroga()).toBe(true);
    });

    it('Criterios 4, 5 y 6: debe conservar datos anteriores, registrar responsable/fecha y actualizar vigencia', () => {
      component.contrato = {
        id_contrato: 10,
        codigo: 'COR-2026-010',
        institucion: 'I.E. Santander',
        cupos: 600,
        fecha_inicio: '2026-01-20',
        fecha_fin: '2026-11-25',
        estado: 'Finalizado' // Estaba vencido
      };

      component.abrirModalProrroga('PRORROGA');
      component.datosProrroga.nuevaFechaFin = '2027-06-30';
      component.datosProrroga.nuevosCupos = 750;
      component.datosProrroga.numeroAutorizacion = 'Resolución MEN-504';
      component.datosProrroga.motivo = 'Extensión del calendario escolar PAE';

      component.guardarProrrogaORenovacion();

      // Criterio 4: Historial conserva datos del contrato anterior
      expect(component.historialModificaciones.length).toBe(1);
      const audit = component.historialModificaciones[0];
      expect(audit.tipo).toBe('PRORROGA');
      expect(audit.fecha_inicio_anterior).toBe('2026-01-20');
      expect(audit.fecha_fin_anterior).toBe('2026-11-25');
      expect(audit.cupos_anteriores).toBe(600);
      expect(audit.numero_autorizacion).toBe('Resolución MEN-504');
      expect(audit.motivo).toBe('Extensión del calendario escolar PAE');

      // Criterio 5: Registra quién realizó la modificación y cuándo
      expect(audit.usuario_responsable).toContain('Admin PAE');
      expect(audit.fecha_registro).toBeTruthy();

      // Criterio 6: Actualiza la vigencia y datos del contrato
      expect(component.contrato.fecha_fin).toBe('2027-06-30');
      expect(component.contrato.cupos).toBe(750);
      expect(component.contrato.estado).toBe('Activo'); // Vuelve a quedar activo al extender vigencia futura
      expect(component.modalProrrogaAbierto).toBe(false);

      // Persistencia en backend
      expect(siraeMock.actualizarContrato).toHaveBeenCalledWith(10, expect.objectContaining({
        fecha_fin: '2027-06-30',
        cupos: 750,
        estado: 'Activo'
      }));
    });
  });

  describe('Actualización de Contrato y Gestión de Estados (HU 4 y HU 5 Superadministrador)', () => {
    beforeEach(() => {
      component.contrato = {
        id_contrato: 10,
        codigo: 'COR-2026-010',
        institucion: 'I.E. Santander',
        cupos: 600,
        fecha_inicio: '2026-01-20',
        fecha_fin: '2026-12-31',
        estado: 'Activo',
        zona: 'Norte',
        id_usuario_supervisor: 3
      };
      component.contratoId = '10';
      component.sedesInstitucion = [
        { id_sede: 1, cupos: 350 },
        { id_sede: 2, cupos: 150 }
      ]; // Total distribuidos = 500 cupos
      component.historialModificaciones = [];
    });

    it('Criterios 1, 2 y 6: debe abrir modal de edición y permitir seleccionar y alternar entre estados Activo, Inactivo y Finalizado', () => {
      component.abrirModalEdicion();
      expect(component.modalEdicionAbierto).toBe(true);
      expect(component.datosEdicion.estado).toBe('Activo');
      expect(component.datosEdicion.cupos).toBe(600);
      expect(component.datosEdicion.zona).toBe('Norte');

      // Alternar a Inactivo
      component.seleccionarEstadoEdicion('Inactivo');
      expect(component.datosEdicion.estado).toBe('Inactivo');

      // Alternar a Finalizado
      component.seleccionarEstadoEdicion('Finalizado');
      expect(component.datosEdicion.estado).toBe('Finalizado');

      // Alternar a Activo
      component.seleccionarEstadoEdicion('Activo');
      expect(component.datosEdicion.estado).toBe('Activo');

      component.cerrarModalEdicion();
      expect(component.modalEdicionAbierto).toBe(false);
    });

    it('Criterio 4: debe validar que la fecha de finalización no sea anterior a la de inicio', () => {
      component.abrirModalEdicion();
      component.datosEdicion.fecha_inicio = '2026-05-01';
      component.datosEdicion.fecha_fin = '2026-04-30';
      expect(component.validarEdicionContrato()).toBe(false);
      expect(component.datosEdicion.errorValidacion).toContain('no puede ser anterior a la fecha de inicio');

      component.datosEdicion.fecha_fin = '2026-11-30';
      expect(component.validarEdicionContrato()).toBe(true);
    });

    it('Criterio 5: debe validar que los cupos autorizados no sean inferiores a los ya distribuidos en sedes', () => {
      component.abrirModalEdicion();
      // Total sedes = 500 cupos
      component.datosEdicion.cupos = 450;
      expect(component.validarEdicionContrato()).toBe(false);
      expect(component.datosEdicion.errorValidacion).toContain('no pueden ser inferiores al total de cupos ya distribuidos entre las sedes (500 cupos)');

      // Cupos iguales o mayores deben ser permitidos
      component.datosEdicion.cupos = 500;
      expect(component.validarEdicionContrato()).toBe(true);

      component.datosEdicion.cupos = 650;
      expect(component.validarEdicionContrato()).toBe(true);
    });

    it('Criterios 7 y 8: debe solicitar confirmación advirtiendo afectaciones operativas al inactivar', async () => {
      component.abrirModalEdicion();
      component.seleccionarEstadoEdicion('Inactivo');

      // Simular que el usuario cancela la confirmación
      sweetAlertMock.confirm.mockResolvedValueOnce({ isConfirmed: false });
      await component.guardarEdicionContrato();

      // No debe haberse actualizado
      expect(siraeMock.actualizarContrato).not.toHaveBeenCalled();
      expect(component.contrato.estado).toBe('Activo');

      // Simular que el usuario confirma
      sweetAlertMock.confirm.mockResolvedValueOnce({ isConfirmed: true });
      await component.guardarEdicionContrato();

      expect(sweetAlertMock.confirm).toHaveBeenCalledWith(
        expect.stringContaining('inactivar'),
        expect.stringContaining('suspenderán los procesos operativos')
      );
      expect(component.contrato.estado).toBe('Inactivo');
      expect(component.modalEdicionAbierto).toBe(false);
    });

    it('Criterios 10, 11 y HU 5 (1-5): debe registrar en la bitácora histórica cada campo modificado con valor anterior y nuevo', async () => {
      component.supervisores = [
        { id_usuario: 3, nombre_completo: 'Carlos Gómez' },
        { id_usuario: 8, nombre_completo: 'María Rodríguez' }
      ];
      component.contrato.id_usuario_supervisor = 3;

      component.abrirModalEdicion();
      component.datosEdicion.cupos = 700; // Cambia de 600 a 700
      component.datosEdicion.zona = 'Sur'; // Cambia de Norte a Sur
      component.datosEdicion.id_usuario_supervisor = 8; // Cambia de 3 a 8

      await component.guardarEdicionContrato();

      // Verifica que se guardó en historial
      expect(component.historialModificaciones.length).toBe(1);
      const audit = component.historialModificaciones[0];
      expect(audit.tipo).toBe('MODIFICACION');
      expect(audit.usuario_responsable).toContain('Admin PAE');
      expect(audit.fecha_registro).toBeTruthy();

      // Campos detectados en el array de cambios
      const cambioCupos = audit.cambios.find((c: any) => c.campo === 'Cupos autorizados');
      expect(cambioCupos).toEqual({
        campo: 'Cupos autorizados',
        anterior: '600 cupos',
        nuevo: '700 cupos'
      });

      const cambioZona = audit.cambios.find((c: any) => c.campo === 'Zona geográfica');
      expect(cambioZona).toEqual({
        campo: 'Zona geográfica',
        anterior: 'Norte',
        nuevo: 'Sur'
      });

      const cambioSupervisor = audit.cambios.find((c: any) => c.campo === 'Supervisor encargado');
      expect(cambioSupervisor).toEqual({
        campo: 'Supervisor encargado',
        anterior: 'Carlos Gómez',
        nuevo: 'María Rodríguez'
      });

      // El contrato local fue actualizado
      expect(component.contrato.cupos).toBe(700);
      expect(component.contrato.zona).toBe('Sur');
      expect(component.contrato.id_usuario_supervisor).toBe(8);

      // Persistencia al backend
      expect(siraeMock.actualizarContrato).toHaveBeenCalledWith(10, expect.objectContaining({
        cupos: 700,
        zona: 'Sur',
        id_usuario_supervisor: 8
      }));
    });
  });
});
