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

  it('Criterio 1 y 4: inicializa ReactiveForms con todos los campos requeridos y validadores', () => {
    expect(component).toBeTruthy();
    expect(component.registroForm).toBeDefined();
    for (const campo of ['nombre', 'apellido', 'correo', 'tipo_documento', 'numero_documento', 'rol', 'is_active']) {
      expect(component.registroForm.get(campo)).toBeTruthy();
    }

    component.abrirFormulario();
    component.guardarUsuario();
    expect(sweetAlertMock.warning).toHaveBeenCalledWith(
      'Campos incompletos',
      expect.stringContaining('campos obligatorios')
    );
    expect(usuarioServiceMock.crearUsuario).not.toHaveBeenCalled();
  });

  it('Criterio 2 y 3: Superadministrador solo puede seleccionar roles de Administrador institucional y Supervisor', () => {
    const nombresDisponibles = component.roles.map(r => r.nombre_rol);
    expect(nombresDisponibles).toContain('Administrador');
    expect(nombresDisponibles).toContain('supervisor');
    expect(nombresDisponibles).not.toContain('SuperAdministrador');
    expect(nombresDisponibles).not.toContain('Manipuladora');
    expect(nombresDisponibles).not.toContain('JefaManipuladoras');
  });

  it('Criterio 5 y 6: valida formato de correo y rechaza correos o números de documento duplicados', () => {
    component.abrirFormulario();
    Object.assign(component.usuarioForm, {
      nombre: 'Laura',
      apellido: 'Méndez',
      correo: 'correo-invalido-sin-dominio',
      tipo_documento: 'CC',
      numero_documento: '10203040',
      rol: 3
    });

    component.guardarUsuario();
    expect(sweetAlertMock.warning).toHaveBeenCalledWith(
      'Correo inválido',
      expect.any(String)
    );

    // Correo duplicado
    component.usuarioForm.correo = 'ADMIN.EXISTENTE@SIRAE.COM';
    component.guardarUsuario();
    expect(sweetAlertMock.warning).toHaveBeenCalledWith(
      'Correo duplicado',
      expect.any(String)
    );

    // Documento duplicado
    component.usuarioForm.correo = 'laura.mendez@sirae.com';
    component.usuarioForm.numero_documento = '999888777';
    component.guardarUsuario();
    expect(sweetAlertMock.warning).toHaveBeenCalledWith(
      'Documento duplicado',
      expect.any(String)
    );
  });

  it('Criterios 7, 8, 9 y 10: valida asignación de 1 institución activa a Administrador, bloquea inactivas y segundo admin activo', () => {
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

    // Institución inactiva (ID 30) -> bloqueado
    component.usuarioForm.id_institucion = 30;
    component.guardarUsuario();
    expect(sweetAlertMock.warning).toHaveBeenCalledWith(
      'Institución Inactiva',
      expect.any(String)
    );

    // Institución ya ocupada por otro Administrador activo (ID 20) -> bloqueado
    component.usuarioForm.id_institucion = 20;
    component.guardarUsuario();
    expect(sweetAlertMock.warning).toHaveBeenCalledWith(
      'Institución con Administrador',
      expect.any(String)
    );

    // Institución activa disponible (ID 10) -> permitido (y solo ofrece sedes activas)
    component.usuarioForm.id_institucion = 10;
    const sedesActivas = component.sedesDeInstitucionSeleccionada;
    expect(sedesActivas.length).toBe(1);
    expect(sedesActivas[0].id_sede).toBe(100);
  });

  it('Criterios 8, 9, 11, 12, 13, 14 y 15: registra Supervisor con múltiples instituciones activas, clave temporal sin texto plano y estado configurable', () => {
    component.abrirFormulario();
    Object.assign(component.usuarioForm, {
      nombre: 'Diana',
      apellido: 'Supervisora',
      correo: 'diana.supervisora@sirae.com',
      tipo_documento: 'CC',
      numero_documento: '70809010',
      rol: 3, // Supervisor
      password: '', // Vacía para disparar clave temporal segura en backend
      is_active: false // Inicialmente inactiva (Criterio 13)
    });

    // Intentar seleccionar institución inactiva (ID 30) -> bloqueado
    const instInactiva = institucionesCatalogo.find(i => i.id_institucion === 30);
    component.toggleInstitucionSupervisor(instInactiva);
    expect(component.supervisorInstitucionesSeleccionadas).not.toContain(30);

    // Seleccionar múltiples instituciones activas (10 y 20)
    component.toggleInstitucionSupervisor(institucionesCatalogo[0]);
    component.toggleInstitucionSupervisor(institucionesCatalogo[1]);
    expect(component.supervisorInstitucionesSeleccionadas).toEqual([10, 20]);

    component.guardarUsuario();
    expect(usuarioServiceMock.crearUsuario).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Diana',
        apellido: 'Supervisora',
        correo: 'diana.supervisora@sirae.com',
        rol: 3,
        is_active: false,
        instituciones_ids: [10, 20]
      })
    );
    const payloadEnviado = usuarioServiceMock.crearUsuario.mock.calls[0][0];
    expect(payloadEnviado.password).toBeUndefined();
    expect(sweetAlertMock.success).toHaveBeenCalledWith(
      '¡Usuario Registrado!',
      expect.stringContaining('clave temporal segura')
    );
  });

  describe('Auditoría de 10 Criterios de Consulta, Búsqueda y Filtrado de Usuarios', () => {
    const usuariosDataset = [
      {
        id_usuario: 1,
        nombre: 'Roberto',
        apellido: 'Gómez',
        correo: 'superadmin@sirae.gov.co',
        tipo_documento: 'CC',
        numero_documento: '10000001',
        rol: 1,
        id_institucion: null,
        is_active: true,
        is_superuser: true,
        password: 'pbkdf2_sha256$hashed_secret',
        token: 'secret-token-xyz'
      },
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
        is_active: true
      },
      {
        id_usuario: 12,
        nombre: 'Carmen',
        apellido: 'Rojas',
        correo: 'manipuladora.sanjose@sirae.edu.co',
        tipo_documento: 'CE',
        numero_documento: '50000001',
        rol: 5,
        id_institucion: 10,
        institucion_nombre: 'Colegio San José',
        is_active: false
      },
      {
        id_usuario: 20,
        nombre: 'Fernando',
        apellido: 'Vargas',
        correo: 'admin.santamaria@sirae.edu.co',
        tipo_documento: 'CC',
        numero_documento: '20000002',
        rol: 2,
        id_institucion: 20,
        institucion_nombre: 'Colegio Santa María',
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
      usuarioServiceMock.getUsuarios.mockReturnValue(of({
        count: usuariosDataset.length,
        next: null,
        previous: null,
        results: usuariosDataset
      }));
      component.cargarUsuarios();
      fixture.detectChanges();
    });

    it('Criterios 1, 2, 3, 4 y 5: Superadministrador visualiza usuarios de todas las instituciones y filtra por texto, rol, estado e institución', () => {
      // Criterio 5: Visibilidad total sin restricciones
      expect(component.usuariosBase.length).toBe(6);
      expect(component.usuariosFiltrados.length).toBe(6);

      // Criterio 2: Búsqueda dinámica por nombre completo, documento o correo
      component.filtroTexto = 'Patricia Salazar';
      component.actualizarUsuariosFiltrados();
      expect(component.usuariosFiltrados.length).toBe(1);
      expect(component.usuariosFiltrados[0].correo).toBe('admin.sanjose@sirae.edu.co');

      component.filtroTexto = '50000001';
      component.actualizarUsuariosFiltrados();
      expect(component.usuariosFiltrados.length).toBe(1);
      expect(component.usuariosFiltrados[0].nombre).toBe('Carmen');

      component.filtroTexto = 'admin.santamaria@sirae.edu.co';
      component.actualizarUsuariosFiltrados();
      expect(component.usuariosFiltrados.length).toBe(1);
      expect(component.usuariosFiltrados[0].nombre).toBe('Fernando');

      // Criterio 3: Filtrado por rol y por estado de la cuenta
      component.limpiarFiltros();
      component.filtroRol = '5'; // Manipuladora
      component.filtroEstado = 'inactivo';
      component.actualizarUsuariosFiltrados();
      expect(component.usuariosFiltrados.length).toBe(1);
      expect(component.usuariosFiltrados[0].correo).toBe('manipuladora.sanjose@sirae.edu.co');

      // Criterio 4: Filtrado por institución en ámbito SuperAdmin
      component.limpiarFiltros();
      expect(component.puedeFiltrarPorInstitucion).toBe(true);
      component.filtroInstitucion = '10';
      component.actualizarUsuariosFiltrados();
      // Usuarios de la institución 10 (Patricia, Lucía, Carmen y Supervisor asignado a 10)
      expect(component.usuariosFiltrados.length).toBe(4);
    });

    it('Criterio 6: Administrador institucional únicamente consulta usuarios de su propia institución y nunca Superadministradores', () => {
      authServiceMock.obtenerUsuario.mockReturnValue({
        id_usuario: 10,
        rol: 'Administrador',
        id_institucion: 10,
        is_superuser: false
      });
      authServiceMock.esSuperAdministrador.mockReturnValue(false);
      authServiceMock.esAdministrador.mockReturnValue(true);
      authServiceMock.esSupervisor.mockReturnValue(false);

      component.actualizarUsuariosFiltrados();
      const correosVisibles = component.usuariosFiltrados.map(u => u.correo);
      expect(correosVisibles).toEqual([
        'admin.sanjose@sirae.edu.co',
        'jefa.sanjose@sirae.edu.co',
        'manipuladora.sanjose@sirae.edu.co'
      ]);
      expect(correosVisibles).not.toContain('superadmin@sirae.gov.co');
      expect(correosVisibles).not.toContain('admin.santamaria@sirae.edu.co');
      expect(component.puedeFiltrarPorInstitucion).toBe(false);
    });

    it('Criterio 7: Supervisor solo consulta usuarios cuando la funcionalidad explícita de supervisión está activa y dentro de sus instituciones', () => {
      authServiceMock.obtenerUsuario.mockReturnValue({
        id_usuario: 30,
        rol: 'supervisor',
        instituciones_supervisor: [{ id_institucion: 10, nombre_institucion: 'Colegio San José' }],
        is_superuser: false
      });
      authServiceMock.esSuperAdministrador.mockReturnValue(false);
      authServiceMock.esAdministrador.mockReturnValue(false);
      authServiceMock.esSupervisor.mockReturnValue(true);

      // Sin funcionalidad explícita activa -> solo ve su propio usuario
      component.activarConsultaSupervision(false);
      expect(component.usuariosFiltrados.map(u => u.id_usuario)).toEqual([30]);

      // Con funcionalidad explícita activa -> ve su perfil + personal de su institución asignada (ID 10)
      component.activarConsultaSupervision(true);
      const idsSupervision = component.usuariosFiltrados.map(u => u.id_usuario);
      expect(idsSupervision).toEqual([10, 11, 12, 30]);
      expect(idsSupervision).not.toContain(1);  // No ve SuperAdmin
      expect(idsSupervision).not.toContain(20); // No ve otra institución (ID 20)
    });

    it('Criterios 8, 9 y 10: maneja estados de carga/error/vacío, protege información sensible en detalle y pagina resultados', () => {
      // Criterio 9: Sanitización de contraseñas en hash y tokens tanto en listado como en modal de detalle
      const superUserEnLista = component.usuarios.find(u => u.id_usuario === 1);
      expect(superUserEnLista.password).toBeUndefined();
      expect(superUserEnLista.token).toBeUndefined();

      component.verDetalleUsuario({
        ...usuariosDataset[1],
        password: 'pbkdf2_sha256$leak_attempt',
        access: 'jwt-access-leak',
        refresh: 'jwt-refresh-leak',
        codigo_hash: 'reset-hash-leak'
      });
      expect(component.usuarioDetalleModal).toBeTruthy();
      expect(component.usuarioDetalleModal.password).toBeUndefined();
      expect(component.usuarioDetalleModal.access).toBeUndefined();
      expect(component.usuarioDetalleModal.refresh).toBeUndefined();
      expect(component.usuarioDetalleModal.codigo_hash).toBeUndefined();

      // Criterio 10: Paginación reactiva en el cliente
      component.cambiarTamanoPagina(2);
      expect(component.totalPaginas).toBe(3);
      expect(component.usuariosPaginados.length).toBe(2);
      component.paginaSiguiente();
      expect(component.paginaActual).toBe(2);
      expect(component.usuariosPaginados[0].id_usuario).toBe(11);

      // Criterio 8: Manejo comprensible de errores en la consulta
      usuarioServiceMock.getUsuarios.mockReturnValue(
        throwError(() => ({ error: { detail: 'Servicio temporalmente no disponible' } }))
      );
      component.cargarUsuarios();
      expect(component.cargandoUsuarios).toBe(false);
      expect(component.errorConsulta).toContain('Servicio temporalmente no disponible');
      expect(component.usuariosFiltrados.length).toBe(0);
    });
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

    it('Criterios 1 y 3: selecciona un usuario existente, abre formulario de edición con datos precargados y muestra asignaciones previas', () => {
      const adminUser = usuariosEdicionDataset[0];
      component.editarUsuario(adminUser);

      expect(component.mostrarModal).toBe(true);
      expect(component.modoEdicion).toBe(true);
      expect(component.usuarioSeleccionadoId).toBe(10);
      expect(component.registroForm.get('nombre')?.value).toBe('Patricia');
      expect(component.registroForm.get('apellido')?.value).toBe('Salazar');
      expect(component.registroForm.get('correo')?.value).toBe('admin.sanjose@sirae.edu.co');
      expect(component.registroForm.get('tipo_documento')?.value).toBe('CC');
      expect(component.registroForm.get('numero_documento')?.value).toBe('20000001');
      expect(component.registroForm.get('rol')?.value).toBe(2);
      expect(component.registroForm.get('id_institucion')?.value).toBe(10);
      expect(component.registroForm.get('id_sede')?.value).toBe(100);
      expect(component.registroForm.get('is_active')?.value).toBe(true);

      // Criterio 3: Al abrir un Supervisor, precarga sus instituciones asignadas actuales
      const supervisorUser = usuariosEdicionDataset[2];
      component.editarUsuario(supervisorUser);
      expect(component.modoEdicion).toBe(true);
      expect(component.usuarioSeleccionadoId).toBe(30);
      expect(component.supervisorInstitucionesSeleccionadas).toEqual([10]);
    });

    it('Criterio 4: al editar permite conservar el propio correo y documento, pero bloquea colisiones con otros usuarios', () => {
      const adminUser = usuariosEdicionDataset[0];
      component.editarUsuario(adminUser);

      // Su propio correo y documento NO deben considerarse duplicados
      expect(component.existeCorreoDuplicado('admin.sanjose@sirae.edu.co')).toBe(false);
      expect(component.existeDocumentoDuplicado('20000001')).toBe(false);

      // El correo o documento de otro usuario (Lucía, ID 11) SÍ debe detectarse como colisión
      expect(component.existeCorreoDuplicado('jefa.sanjose@sirae.edu.co')).toBe(true);
      expect(component.existeDocumentoDuplicado('40000001')).toBe(true);

      component.usuarioForm.correo = 'jefa.sanjose@sirae.edu.co';
      component.guardarUsuario();
      expect(sweetAlertMock.warning).toHaveBeenCalledWith('Correo duplicado', expect.any(String));
      expect(usuarioServiceMock.actualizarUsuario).not.toHaveBeenCalled();
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
          id_sede: 100,
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

    it('Criterio 2 y 6: controla estrictamente el alcance del Administrador institucional al editar', () => {
      authServiceMock.obtenerUsuario.mockReturnValue({
        id_usuario: 10,
        rol: 'Administrador',
        id_institucion: 10,
        is_superuser: false
      });
      authServiceMock.esSuperAdministrador.mockReturnValue(false);
      authServiceMock.esAdministrador.mockReturnValue(true);
      authServiceMock.esSupervisor.mockReturnValue(false);
      component.cargarRoles();

      // El Administrador institucional puede editar a la Jefa de su misma institución (ID 11)
      const jefaMismaInst = usuariosEdicionDataset[1];
      expect(component.puedeEditarUsuario(jefaMismaInst)).toBe(true);

      // No puede editar a un Supervisor ni a usuarios de otra institución
      expect(component.puedeEditarUsuario(usuariosEdicionDataset[2])).toBe(false);
      expect(component.puedeEditarUsuario({ id_usuario: 99, rol: 5, id_institucion: 20 })).toBe(false);

      // Si intenta abrir formulario de un usuario fuera de su alcance, se bloquea con alerta
      component.abrirFormulario({ id_usuario: 99, rol: 5, id_institucion: 20 });
      expect(sweetAlertMock.warning).toHaveBeenCalledWith(
        'Acceso Restringido',
        expect.stringContaining('fuera de tu ámbito institucional')
      );

      // Al editar a su empleada de cocina, no puede cambiarla a otra institución ni asignarle rol de Supervisor/Admin
      component.editarUsuario(jefaMismaInst);
      expect(component.institucionesOpcionesAdmin.map(i => i.id_institucion)).toEqual([10]);

      component.usuarioForm.id_institucion = 20;
      component.guardarUsuario();
      expect(sweetAlertMock.warning).toHaveBeenCalledWith(
        'Alcance restringido',
        expect.stringContaining('otra institución')
      );
      expect(usuarioServiceMock.actualizarUsuario).not.toHaveBeenCalled();
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

    it('Criterio 1: muestra claramente el estado actual (Activa / Inactiva / Bloqueada) en la interfaz y en el detalle', () => {
      const uActivo = usuariosEstadoDataset[2];
      const uInactivo = usuariosEstadoDataset[3];
      const uBloqueado = usuariosEstadoDataset[4];

      expect(component.obtenerEstadoCuenta(uActivo)).toBe('Activo');
      expect(component.obtenerEstadoCuenta(uInactivo)).toBe('Inactivo');
      expect(component.obtenerEstadoCuenta(uBloqueado)).toBe('Bloqueado');

      // Comprobación en modal de detalle
      component.verDetalleUsuario(uBloqueado);
      expect(component.usuarioDetalleModal).toBeTruthy();
      expect(component.obtenerEstadoCuenta(component.usuarioDetalleModal)).toBe('Bloqueado');
    });

    it('Criterio 2 y 8: solicita confirmación antes de la operación y actualiza de forma reactiva el estado en la UI', async () => {
      const uJefa = { ...usuariosEstadoDataset[2] };
      sweetAlertMock.confirm.mockResolvedValue({ isConfirmed: true });
      usuarioServiceMock.actualizarUsuario.mockReturnValue(of({
        ...uJefa,
        is_active: false,
        estado_display: 'Inactivo'
      }));

      component.toggleEstadoUsuario(uJefa);

      // Criterio 2: Confirmación obligatoria antes de ejecutar
      expect(sweetAlertMock.confirm).toHaveBeenCalledWith(
        '¿Desactivar cuenta de usuario?',
        expect.stringContaining('¿Confirmas que deseas desactivar la cuenta'),
        'Sí, desactivar'
      );

      await Promise.resolve();

      // Criterio 8: Refresco reactivo e inmediato en la interfaz
      expect(usuarioServiceMock.actualizarUsuario).toHaveBeenCalledWith(11, { is_active: false });
      expect(uJefa.is_active).toBe(false);
      expect(uJefa.estado_display).toBe('Inactivo');
      expect(sweetAlertMock.success).toHaveBeenCalledWith(
        'Usuario inactivado',
        expect.stringContaining('Inactivo')
      );
    });

    it('Criterio 2: si el usuario cancela la confirmación en el modal, NO ejecuta la petición al backend', () => {
      const uJefa = { ...usuariosEstadoDataset[2] };
      sweetAlertMock.confirm.mockResolvedValue({ isConfirmed: false });

      component.toggleEstadoUsuario(uJefa);

      expect(sweetAlertMock.confirm).toHaveBeenCalled();
      expect(usuarioServiceMock.actualizarUsuario).not.toHaveBeenCalled();
      expect(uJefa.is_active).toBe(true);
    });

    it('Criterio 3 y 10: autoriza únicamente a Administrador en su ámbito e impide autogestión de estado', () => {
      // Caso 1: Administrador institucional en su ámbito
      authServiceMock.obtenerUsuario.mockReturnValue({
        id_usuario: 10,
        rol: 'Administrador',
        id_institucion: 10,
        is_superuser: false
      });
      authServiceMock.esSuperAdministrador.mockReturnValue(false);
      authServiceMock.esAdministrador.mockReturnValue(true);
      authServiceMock.esSupervisor.mockReturnValue(false);

      // Puede desactivar/activar personal de cocina de su institución (ID 11)
      expect(component.puedeCambiarEstadoUsuario(usuariosEstadoDataset[2])).toBe(true);

      // Criterio 10: No puede desactivarse a sí mismo (autogestión bloqueada)
      expect(component.esPropioUsuario(usuariosEstadoDataset[1])).toBe(true);
      expect(component.puedeCambiarEstadoUsuario(usuariosEstadoDataset[1])).toBe(false);

      component.toggleEstadoUsuario(usuariosEstadoDataset[1]);
      expect(sweetAlertMock.warning).toHaveBeenCalledWith(
        'Operación no permitida',
        expect.stringContaining('tu propia cuenta')
      );
      expect(usuarioServiceMock.actualizarUsuario).not.toHaveBeenCalled();

      // No puede cambiar estado de usuarios fuera de su institución (ID 20)
      expect(component.puedeCambiarEstadoUsuario(usuariosEstadoDataset[5])).toBe(false);

      // No puede cambiar estado del SuperAdmin (ID 1)
      expect(component.puedeCambiarEstadoUsuario(usuariosEstadoDataset[0])).toBe(false);

      // No puede cambiar estado de un Supervisor (ID 30)
      expect(component.puedeCambiarEstadoUsuario(usuariosEstadoDataset[6])).toBe(false);
    });

    it('Criterio 7: nunca elimina físicamente el registro (integridad histórica)', () => {
      const uActivo = { ...usuariosEstadoDataset[2] };
      sweetAlertMock.confirm.mockResolvedValue({ isConfirmed: true });
      usuarioServiceMock.actualizarUsuario.mockReturnValue(of({ ...uActivo, is_active: false }));

      component.eliminarUsuario(uActivo);

      // No invoca DELETE físico (eliminarUsuario en backend), sino alternar estado lógico (is_active: false)
      expect(usuarioServiceMock.eliminarUsuario).not.toHaveBeenCalled();
      expect(sweetAlertMock.confirm).toHaveBeenCalledWith(
        '¿Desactivar cuenta de usuario?',
        expect.any(String),
        'Sí, desactivar'
      );
    });
  });
});
