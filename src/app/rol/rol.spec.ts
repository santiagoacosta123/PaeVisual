import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Rol } from './rol';
import { RolService } from '../services/rol.service';
import { SweetAlertService } from '../sweet-alert.service';
import { AuthService } from '../services/auth.service';
import {
  RolModel,
  ModuloPermisosModel,
  AuditoriaPermisoRolModel
} from '../models/rol.model';

describe('Rol Component - Auditoría de 11 Criterios de Configuración y Administración de Permisos de Roles', () => {
  let component: Rol;
  let fixture: ComponentFixture<Rol>;
  let mockRolService: any;
  let mockSweetAlert: any;
  let mockAuthService: any;

  const mockRoles: RolModel[] = [
    {
      id_rol: 1,
      nombre: 'SuperAdministrador',
      nombre_display: 'Super Administrador del Sistema',
      descripcion: 'Acceso total y administración transversal de la plataforma SIRAE.',
      es_protegido: true,
      total_usuarios_activos: 1,
      puede_editar_permisos: true,
      permisos: [
        { modulo: 'Usuarios y Roles', codigo: 'usuarios_roles_total', descripcion: 'Gestión total de usuarios' },
        { modulo: 'Instituciones y Sedes', codigo: 'instituciones_sedes_global', descripcion: 'Gestión de colegios' },
        { modulo: 'Contratos PAE', codigo: 'contratos_gestion_total', descripcion: 'Gestión de contratos' },
        { modulo: 'Catálogo Global', codigo: 'catalogo_global_control', descripcion: 'Catálogo global' },
        { modulo: 'Auditoría', codigo: 'auditoria_operativa_lectura', descripcion: 'Auditoría transversal' }
      ]
    },
    {
      id_rol: 2,
      nombre: 'Administrador',
      nombre_display: 'Administrador Institucional PAE',
      descripcion: 'Administración institucional del PAE.',
      es_protegido: true,
      total_usuarios_activos: 3,
      puede_editar_permisos: true,
      permisos: [
        { modulo: 'Personal de Cocina', codigo: 'personal_cocina_gestion', descripcion: 'Gestión cocina' }
      ]
    },
    {
      id_rol: 3,
      nombre: 'supervisor',
      nombre_display: 'Supervisor de Interventoría',
      descripcion: 'Supervisión técnica de comedores.',
      es_protegido: true,
      total_usuarios_activos: 2,
      puede_editar_permisos: true,
      permisos: [
        { modulo: 'Supervisión', codigo: 'supervision_instituciones_asignadas', descripcion: 'Fiscalización' }
      ]
    },
    {
      id_rol: 6,
      nombre: 'AuxiliarCocina',
      nombre_display: 'Auxiliar de Cocina Especial',
      descripcion: 'Perfil de apoyo en cocina.',
      es_protegido: false,
      total_usuarios_activos: 0,
      puede_editar_permisos: true,
      permisos: []
    }
  ];

  const mockMatriz: ModuloPermisosModel[] = [
    {
      modulo: 'Usuarios y Roles',
      nombre_modulo: 'Gestión de Usuarios y Roles',
      descripcion: 'Cuentas y perfiles',
      permisos: [
        { codigo: 'usuarios_roles_total', nombre: 'Total', descripcion: 'Total', nivel_requerido: 'SuperAdministrador' },
        { codigo: 'personal_cocina_gestion', nombre: 'Cocina', descripcion: 'Cocina', nivel_requerido: 'Administrador' }
      ]
    },
    {
      modulo: 'Supervisión',
      nombre_modulo: 'Supervisión PAE',
      descripcion: 'Fiscalización',
      permisos: [
        { codigo: 'supervision_instituciones_asignadas', nombre: 'Supervisión', descripcion: 'Supervisión', nivel_requerido: 'supervisor' }
      ]
    }
  ];

  const mockAuditorias: AuditoriaPermisoRolModel[] = [
    {
      id_auditoria: 1,
      rol: 2,
      actor_correo: 'superadmin@sirae.gov.co',
      accion: 'MODIFICACION_PERMISOS',
      permisos_anteriores: ['personal_cocina_gestion'],
      permisos_nuevos: ['personal_cocina_gestion', 'inventario_institucional'],
      detalle: 'Permisos actualizados con éxito.',
      creado_en: '2026-11-11T09:00:00Z'
    }
  ];

  beforeEach(async () => {
    mockRolService = {
      getRoles: vi.fn().mockReturnValue(of(mockRoles)),
      getMatrizModulos: vi.fn().mockReturnValue(of(mockMatriz)),
      getPermisosRol: vi.fn().mockReturnValue(of(mockRoles[1].permisos)),
      asignarPermisosRol: vi.fn().mockReturnValue(of({ mensaje: 'Permisos asignados' })),
      getAuditoriaPermisosRol: vi.fn().mockReturnValue(of(mockAuditorias)),
      crearRol: vi.fn().mockReturnValue(of({})),
      actualizarRol: vi.fn().mockReturnValue(of({})),
      eliminarRol: vi.fn().mockReturnValue(of({}))
    };

    mockSweetAlert = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      confirm: vi.fn().mockResolvedValue({ isConfirmed: true })
    };

    mockAuthService = {
      obtenerUsuario: vi.fn().mockReturnValue({
        id_usuario: 1,
        correo: 'superadmin@sirae.gov.co',
        rol: 'SuperAdministrador'
      }),
      esSuperAdministrador: vi.fn().mockImplementation((r) => r === 'SuperAdministrador'),
      esAdministrador: vi.fn().mockImplementation((r) => r === 'Administrador')
    };

    await TestBed.configureTestingModule({
      imports: [Rol],
      providers: [
        { provide: RolService, useValue: mockRolService },
        { provide: SweetAlertService, useValue: mockSweetAlert },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Rol);
    component = fixture.componentInstance;
  });

  it('debe crearse el componente exitosamente', () => {
    expect(component).toBeTruthy();
  });

  it('Criterio 1: debe mostrar claramente los roles principales definidos en SIRAE', () => {
    fixture.detectChanges();

    expect(component.roles.length).toBe(4);
    const nombres = component.roles.map(r => r.nombre);
    expect(nombres).toContain('SuperAdministrador');
    expect(nombres).toContain('Administrador');
    expect(nombres).toContain('supervisor');
  });

  it('Criterio 2: debe consultar y exponer la matriz completa de módulos y funcionalidades', () => {
    fixture.detectChanges();

    expect(mockRolService.getMatrizModulos).toHaveBeenCalled();
    expect(component.matrizModulos.length).toBe(2);

    component.cambiarVista('matriz');
    expect(component.vistaActiva).toBe('matriz');
  });

  it('Criterio 3: debe permitir consultar de forma granular los permisos asociados a cada rol', () => {
    fixture.detectChanges();

    const rolAdmin = component.roles[1];
    component.verPermisos(rolAdmin);

    expect(component.mostrarModalPermisos).toBe(true);
    expect(component.rolSeleccionadoPermisos).toBe(rolAdmin);
    expect(component.rolSeleccionadoPermisos?.permisos?.length).toBe(1);

    component.cerrarModalPermisos();
    expect(component.mostrarModalPermisos).toBe(false);
  });

  it('Criterio 4: permite abrir modal de configuración de permisos únicamente a usuarios autorizados (Superadmin)', () => {
    fixture.detectChanges();

    const rolAdmin = component.roles[1];
    component.abrirConfigurarPermisos(rolAdmin);

    expect(component.mostrarModalConfigurarPermisos).toBe(true);
    expect(component.rolConfigurando).toBe(rolAdmin);

    // Si el usuario no es superadmin, se bloquea la apertura
    mockAuthService.esSuperAdministrador.mockReturnValue(false);
    component.cerrarModalConfigurarPermisos();

    component.abrirConfigurarPermisos(rolAdmin);
    expect(component.mostrarModalConfigurarPermisos).toBe(false);
    expect(mockSweetAlert.warning).toHaveBeenCalledWith(
      'Operación no autorizada',
      expect.stringContaining('Solo el Superadministrador cuenta con autorización')
    );
  });

  it('Criterio 5: previene escalada de privilegios bloqueando permisos de Superadmin en roles subordinados', () => {
    fixture.detectChanges();

    const rolSupervisor = component.roles[2];
    component.abrirConfigurarPermisos(rolSupervisor);

    // El permiso 'usuarios_roles_total' está reservado y debe estar bloqueado para supervisor
    const estaBloqueado = component.esPermisoBloqueado('usuarios_roles_total');
    expect(estaBloqueado).toBe(true);

    component.togglePermiso('usuarios_roles_total');
    expect(component.codigosPermisosSeleccionados.has('usuarios_roles_total')).toBe(false);
  });

  it('Criterio 6: blinda los permisos críticos del Superadministrador impidiendo su desmarque o revocación', () => {
    fixture.detectChanges();

    const rolSuper = component.roles[0];
    component.abrirConfigurarPermisos(rolSuper);

    // Permisos críticos están bloqueados inmutables en Superadministrador
    expect(component.esPermisoBloqueado('usuarios_roles_total')).toBe(true);
    expect(component.codigosPermisosSeleccionados.has('usuarios_roles_total')).toBe(true);

    component.togglePermiso('usuarios_roles_total');
    expect(component.codigosPermisosSeleccionados.has('usuarios_roles_total')).toBe(true);
  });

  it('Criterio 8 y 9: solicita confirmación explícita advirtiendo revocación de sesiones activas y aplica cambios de inmediato', async () => {
    fixture.detectChanges();

    const rolAdmin = component.roles[1];
    component.abrirConfigurarPermisos(rolAdmin);

    component.guardarPermisosRol();

    expect(mockSweetAlert.confirm).toHaveBeenCalledWith(
      '¿Confirmar actualización de permisos?',
      expect.stringContaining('revocará las sesiones activas de todos los usuarios vinculados'),
      'Sí, actualizar y revocar sesiones'
    );

    await Promise.resolve();

    expect(mockRolService.asignarPermisosRol).toHaveBeenCalledWith(
      2,
      expect.any(Array)
    );
    expect(mockSweetAlert.success).toHaveBeenCalledWith(
      'Permisos actualizados',
      expect.any(String)
    );
  });

  it('Criterio 10: consulta y despliega la bitácora de auditoría histórica de permisos del rol', () => {
    fixture.detectChanges();

    const rolAdmin = component.roles[1];
    component.verAuditoriaPermisos(rolAdmin);

    expect(mockRolService.getAuditoriaPermisosRol).toHaveBeenCalledWith(2);
    expect(component.mostrarModalAuditoria).toBe(true);
    expect(component.auditoriasRol.length).toBe(1);
    expect(component.auditoriasRol[0].actor_correo).toBe('superadmin@sirae.gov.co');
  });

  it('Criterio 11: impide la eliminación de roles que posean usuarios asociados activos', () => {
    fixture.detectChanges();

    const rolConUsuarios = component.roles[1]; // Administrador: total_usuarios_activos = 3
    expect(rolConUsuarios.total_usuarios_activos).toBe(3);

    component.eliminarRol(rolConUsuarios);

    expect(mockSweetAlert.warning).toHaveBeenCalledWith(
      'Usuarios Activos Vinculados',
      expect.stringContaining('cuenta con 3 usuario(s) activo(s) asociado(s). Debe reasignar el personal previamente.')
    );
    expect(mockRolService.eliminarRol).not.toHaveBeenCalled();
  });

  it('Criterio 11: permite eliminar roles personalizados sin usuarios activos asociados', async () => {
    fixture.detectChanges();

    const rolSinUsuarios = component.roles[3]; // AuxiliarCocina: es_protegido = false, total_usuarios_activos = 0
    component.eliminarRol(rolSinUsuarios);

    expect(mockSweetAlert.confirm).toHaveBeenCalled();
    await Promise.resolve();
    expect(mockRolService.eliminarRol).toHaveBeenCalledWith(6);
  });
});
