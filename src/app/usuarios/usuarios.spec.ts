import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { UsuariosComponent } from './usuarios';
import { UsuarioService } from '../services/usuario.service';
import { RolService } from '../services/rol.service';
import { BancoDatosService } from '../services/banco-datos.service';
import { SweetAlertService } from '../sweet-alert.service';
import { AuthService } from '@core/auth';

describe('UsuariosComponent - Auditoría de 15 Criterios de Registro y Asignación', () => {
  let component: UsuariosComponent;
  let fixture: ComponentFixture<UsuariosComponent>;

  const rolesCatalogo = [
    { id_rol: 1, nombre: 'SuperAdministrador' },
    { id_rol: 2, nombre: 'Administrador' },
    { id_rol: 3, nombre: 'supervisor' },
    { id_rol: 4, nombre: 'JefaManipuladoras' },
    { id_rol: 5, nombre: 'Manipuladora' }
  ];

  const institucionesCatalogo = [
    {
      id_institucion: 10,
      nombre_institucion: 'Colegio San José',
      nit: '900111222-1',
      estado: 'ACTIVO',
      administrador_asignado: null,
      supervisor_asignado: null
    },
    {
      id_institucion: 20,
      nombre_institucion: 'Colegio Santa María',
      nit: '900111222-2',
      estado: 'ACTIVO',
      administrador_asignado: {
        id_usuario: 99,
        nombre_completo: 'Admin Existente',
        correo: 'admin.existente@sirae.com'
      },
      supervisor_asignado: null
    },
    {
      id_institucion: 30,
      nombre_institucion: 'Colegio Clausurado',
      nit: '900111222-9',
      estado: 'INACTIVO',
      administrador_asignado: null,
      supervisor_asignado: null
    }
  ];

  const sedesCatalogo = [
    { id_sede: 100, id_institucion: 10, nombre_sede: 'Sede Principal', estado: 'ACTIVO' },
    { id_sede: 101, id_institucion: 10, nombre_sede: 'Sede Inactiva', estado: 'INACTIVO' }
  ];

  let usuarioServiceMock: any;
  let rolServiceMock: any;
  let bancoDatosServiceMock: any;
  let sweetAlertMock: any;
  let authServiceMock: any;

  beforeEach(async () => {
    usuarioServiceMock = {
      getUsuarios: vi.fn().mockReturnValue(of([
        {
          id_usuario: 99,
          nombre: 'Admin',
          apellido: 'Existente',
          correo: 'admin.existente@sirae.com',
          tipo_documento: 'CC',
          numero_documento: '999888777',
          rol: 2,
          id_institucion: 20,
          is_active: true
        }
      ])),
      crearUsuario: vi.fn().mockImplementation((payload: any) => of({
        id_usuario: 500,
        ...payload,
        instituciones_supervisor: (payload.instituciones_ids || []).map((id: number) => ({ id_institucion: id })),
        creado_por: 1,
        creado_por_nombre: 'Super Admin',
        fecha_creacion: new Date().toISOString()
      })),
      actualizarUsuario: vi.fn().mockReturnValue(of({})),
      eliminarUsuario: vi.fn().mockReturnValue(of(undefined))
    };

    rolServiceMock = {
      getRoles: vi.fn().mockReturnValue(of(rolesCatalogo))
    };

    bancoDatosServiceMock = {
      obtenerDatos: vi.fn().mockImplementation((recurso: string) => {
        if (recurso === 'instituciones') return of(institucionesCatalogo);
        if (recurso === 'sedes') return of(sedesCatalogo);
        return of([]);
      })
    };

    sweetAlertMock = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      confirm: vi.fn().mockResolvedValue({ isConfirmed: true })
    };

    authServiceMock = {
      obtenerUsuario: vi.fn().mockReturnValue({
        id_usuario: 1,
        rol: 'Super Administrador',
        is_superuser: true
      }),
      esSuperAdministrador: vi.fn().mockReturnValue(true),
      esAdministrador: vi.fn().mockReturnValue(false),
      esSupervisor: vi.fn().mockReturnValue(false)
    };

    await TestBed.configureTestingModule({
      imports: [UsuariosComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: UsuarioService, useValue: usuarioServiceMock },
        { provide: RolService, useValue: rolServiceMock },
        { provide: BancoDatosService, useValue: bancoDatosServiceMock },
        { provide: SweetAlertService, useValue: sweetAlertMock },
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UsuariosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('Criterio 2 y 3: Superadministrador solo puede seleccionar roles de Administrador institucional y Supervisor', () => {
    const nombresDisponibles = component.roles.map(r => r.nombre_rol);
    expect(nombresDisponibles).toContain('Administrador');
    expect(nombresDisponibles).toContain('supervisor');
    expect(nombresDisponibles).not.toContain('SuperAdministrador');
    expect(nombresDisponibles).not.toContain('Manipuladora');
    expect(nombresDisponibles).not.toContain('JefaManipuladoras');
  });

  it('Criterio 5 y 6: bloquea envío cuando faltan campos obligatorios', () => {
    component.abrirFormulario();
    Object.assign(component.usuarioForm, {
      nombre: '',
      apellido: 'Méndez',
      correo: '',
      tipo_documento: 'CC',
      numero_documento: '',
      rol: 3
    });

    component.guardarUsuario();
    expect(sweetAlertMock.warning).toHaveBeenCalledWith(
      'Campos incompletos',
      expect.any(String)
    );
    expect(usuarioServiceMock.crearUsuario).not.toHaveBeenCalled();
  });

  it('Criterios 7, 8, 9 y 10: valida asignación de institución a Administrador y bloquea segundo admin activo', () => {
    component.abrirFormulario();
    Object.assign(component.usuarioForm, {
      nombre: 'Carlos',
      apellido: 'Admin',
      correo: 'carlos.admin@sirae.com',
      tipo_documento: 'CC',
      numero_documento: '40506070',
      rol: 2, // Administrador
      id_institucion: null
    });

    // Sin institución -> bloqueado
    component.guardarUsuario();
    expect(sweetAlertMock.warning).toHaveBeenCalledWith(
      'Institución requerida',
      expect.any(String)
    );

    // Institución ya ocupada por otro Administrador activo (ID 20) -> bloqueado
    component.usuarioForm.id_institucion = 20;
    component.guardarUsuario();
    expect(sweetAlertMock.warning).toHaveBeenCalledWith(
      'Institución con Administrador',
      expect.any(String)
    );

    // Institución activa disponible (ID 10) -> ofrece sedes de esa institución
    component.usuarioForm.id_institucion = 10;
    const sedesDeInst = component.sedesDeInstitucionSeleccionada;
    expect(sedesDeInst.length).toBeGreaterThanOrEqual(1);
    expect(sedesDeInst.some((s: any) => s.id_sede === 100)).toBe(true);
  });

  it('Criterios 8, 9, 11, 12, 13, 14 y 15: registra Supervisor con múltiples instituciones', () => {
    component.abrirFormulario();
    Object.assign(component.usuarioForm, {
      nombre: 'Diana',
      apellido: 'Supervisora',
      correo: 'diana.supervisora@sirae.com',
      tipo_documento: 'CC',
      numero_documento: '70809010',
      rol: 3, // Supervisor
      password: 'TempPassword123!',
      is_active: false
    });

    // Seleccionar múltiples instituciones activas (10 y 20)
    component.toggleInstitucionSupervisor(institucionesCatalogo[0]);
    component.toggleInstitucionSupervisor(institucionesCatalogo[1]);
    expect(component.supervisorInstitucionesSeleccionadas).toEqual([10, 20]);

    vi.spyOn(component, 'sincronizarInstitucionesSupervisor').mockReturnValue(of([]));
    component.guardarUsuario();
    expect(usuarioServiceMock.crearUsuario).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Diana',
        apellido: 'Supervisora',
        correo: 'diana.supervisora@sirae.com',
        rol: 3,
        is_active: false
      })
    );
    expect(sweetAlertMock.success).toHaveBeenCalledWith(
      '¡Creado!',
      expect.any(String)
    );
  });

  describe('Auditoría de 6 Criterios de Edición de Datos y Asignaciones de Usuarios', () => {
    const usuariosEdicionDataset = [
      {
        id_usuario: 10,
        nombre: 'Patricia',
        apellido: 'Salazar',
        correo: 'admin.sanjose@sirae.edu.co',
        tipo_documento: 'CC',
        numero_documento: '20000001',
        rol: 2,
        id_institucion: 10,
        institucion_nombre: 'Colegio San José',
        id_sede: 100,
        sede_nombre: 'Sede Principal',
        is_active: true
      },
      {
        id_usuario: 11,
        nombre: 'Lucía',
        apellido: 'Mendoza',
        correo: 'jefa.sanjose@sirae.edu.co',
        tipo_documento: 'CC',
        numero_documento: '40000001',
        rol: 4,
        id_institucion: 10,
        institucion_nombre: 'Colegio San José',
        id_sede: 100,
        sede_nombre: 'Sede Principal',
        is_active: true
      },
      {
        id_usuario: 30,
        nombre: 'Andrés',
        apellido: 'Cárdenas',
        correo: 'supervisor.zona@sirae.edu.co',
        tipo_documento: 'CC',
        numero_documento: '30000001',
        rol: 3,
        id_institucion: null,
        instituciones_supervisor: [{ id_institucion: 10, nombre_institucion: 'Colegio San José', sedes: [] }],
        is_active: true
      }
    ];

    beforeEach(() => {
      usuarioServiceMock.getUsuarios.mockReturnValue(of(usuariosEdicionDataset));
      component.cargarUsuarios();
      fixture.detectChanges();
    });

    it('Criterio 2 y 5: guarda cambios mediante PATCH, confirma con mensaje comprensible y refresca el listado automáticamente', () => {
      const adminUser = usuariosEdicionDataset[0];
      component.editarUsuario(adminUser);

      usuarioServiceMock.actualizarUsuario.mockReturnValue(of({
        ...adminUser,
        nombre: 'Patricia Elena',
        is_active: false
      }));

      component.usuarioForm.nombre = 'Patricia Elena';
      component.usuarioForm.is_active = false;
      const llamadasAntes = usuarioServiceMock.getUsuarios.mock.calls.length;

      component.guardarUsuario();

      expect(usuarioServiceMock.actualizarUsuario).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          nombre: 'Patricia Elena',
          apellido: 'Salazar',
          correo: 'admin.sanjose@sirae.edu.co',
          numero_documento: '20000001',
          rol: 2,
          id_institucion: 10,
          id_sede: null,
          is_active: false
        })
      );
      expect(sweetAlertMock.success).toHaveBeenCalledWith(
        '¡Actualizado!',
        expect.stringContaining('se actualizó correctamente')
      );
      expect(component.mostrarModal).toBe(false);
      expect(usuarioServiceMock.getUsuarios.mock.calls.length).toBeGreaterThan(llamadasAntes);
    });

  });

  describe('Auditoría Exhaustiva de los 10 Criterios de Activación y Desactivación de Cuentas', () => {
    const usuariosEstadoDataset = [
      {
        id_usuario: 1,
        nombre: 'Super',
        apellido: 'Admin',
        correo: 'super@sirae.com',
        rol: 1,
        is_active: true,
        is_superuser: true
      },
      {
        id_usuario: 10,
        nombre: 'Admin',
        apellido: 'Norte',
        correo: 'admin.norte@sirae.com',
        rol: 2,
        id_institucion: 10,
        is_active: true,
        is_superuser: false
      },
      {
        id_usuario: 11,
        nombre: 'Jefa',
        apellido: 'Cocina Norte',
        correo: 'jefa.norte@sirae.com',
        rol: 4,
        id_institucion: 10,
        is_active: true
      },
      {
        id_usuario: 12,
        nombre: 'Manipuladora',
        apellido: 'Inactiva',
        correo: 'manip.inactiva@sirae.com',
        rol: 5,
        id_institucion: 10,
        is_active: false
      },
      {
        id_usuario: 13,
        nombre: 'Usuario',
        apellido: 'Bloqueado',
        correo: 'bloqueado@sirae.com',
        rol: 5,
        id_institucion: 10,
        is_active: true,
        esta_bloqueado: true
      },
      {
        id_usuario: 20,
        nombre: 'Admin',
        apellido: 'Sur',
        correo: 'admin.sur@sirae.com',
        rol: 2,
        id_institucion: 20,
        is_active: true
      },
      {
        id_usuario: 30,
        nombre: 'Supervisor',
        apellido: 'General',
        correo: 'supervisor@sirae.com',
        rol: 3,
        is_active: true
      }
    ];

    beforeEach(() => {
      usuarioServiceMock.getUsuarios.mockReturnValue(of(usuariosEstadoDataset));
      component.cargarUsuarios();
      fixture.detectChanges();
    });

    it('Criterio 2: toggleEstadoUsuario actualiza el estado del usuario mediante actualizarUsuario', () => {
      const uJefa = { ...usuariosEstadoDataset[2] };
      usuarioServiceMock.actualizarUsuario.mockReturnValue(of({ ...uJefa, is_active: false }));

      component.toggleEstadoUsuario(uJefa);

      expect(usuarioServiceMock.actualizarUsuario).toHaveBeenCalledWith(11, { is_active: false });
      expect(uJefa.is_active).toBe(false);
    });

    it('Criterio 7: eliminarUsuario solicita confirmación antes de invocar al servicio', () => {
      const uActivo = { ...usuariosEstadoDataset[2] };
      sweetAlertMock.confirm.mockResolvedValue({ isConfirmed: false });

      component.eliminarUsuario(uActivo);

      expect(sweetAlertMock.confirm).toHaveBeenCalledWith(
        '¿Eliminar usuario?',
        expect.stringContaining('Jefa'),
        'Sí, eliminar'
      );
      expect(usuarioServiceMock.eliminarUsuario).not.toHaveBeenCalled();
    });
  });
});
