import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UsuarioService } from '../services/usuario.service';
import { RolService } from '../services/rol.service';
import { BancoDatosService } from '../services/banco-datos.service';
import { SweetAlertService } from '../sweet-alert.service';
import { CustomSelectComponent } from '../shared/custom-select/custom-select';
import { environment } from '@env/environment';

import { AuthService } from '@core/auth';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    CustomSelectComponent
  ],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.css', '../banco-datos/banco-datos.css']
})
export class UsuariosComponent implements OnInit {

  usuarios: any[] = [];
  roles: any[] = []; // Opciones para el select según el creador
  todosLosRoles: any[] = []; // Diccionario completo para mapear nombres en la tabla
  instituciones: any[] = [];
  sedes: any[] = [];
  jornadas: any[] = [];

  readonly tiposDocumento = [
    { value: 'CC', label: 'Cédula de Ciudadanía' },
    { value: 'CE', label: 'Cédula de Extranjería' },
    { value: 'TI', label: 'Tarjeta de Identidad' },
    { value: 'PP', label: 'Pasaporte' },
    { value: 'PPT', label: 'Permiso por Protección Temporal' }
  ];

  private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  private readonly CAMPOS_SENSIBLES = [
    'password',
    'codigo_hash',
    'password_reset_code',
    'access',
    'refresh',
    'token',
    'intentos_fallidos_login',
    'bloqueado_hasta',
    'ultimo_intento_fallido',
    'user_permissions',
    'groups'
  ];

  registroForm!: FormGroup;
  intentoEnvio: boolean = false;
  mensajeRetroalimentacion: string = '';

  // Criterio 8: Estados de UI (carga, vacío y error comprensible)
  cargandoUsuarios: boolean = false;
  errorConsulta: string = '';

  // Criterio 7: Indicador de funcionalidad explícita para consulta del Supervisor
  funcionalidadSupervisionActiva: boolean = false;

  // Criterio 10: Estado de paginación del lado del cliente y metadatos del servidor
  paginaActual: number = 1;
  tamanoPagina: number = 10;
  readonly opcionesTamanoPagina: number[] = [10, 25, 50, 100];
  totalRegistrosServidor: number = 0;
  tieneSiguienteServidor: boolean = false;
  tieneAnteriorServidor: boolean = false;

  get esSuperAdmin(): boolean {
    const usuarioActual = this.authService.obtenerUsuario();
    if (!usuarioActual) return false;
    return !!(
      usuarioActual.is_superuser ||
      this.authService.esSuperAdministrador(usuarioActual.rol)
    );
  }

  get esAdminInstitucional(): boolean {
    const usuarioActual = this.authService.obtenerUsuario();
    if (!usuarioActual || this.esSuperAdmin) return false;
    return this.authService.esAdministrador(usuarioActual.rol);
  }

  get esSupervisorActual(): boolean {
    const usuarioActual = this.authService.obtenerUsuario();
    if (!usuarioActual || this.esSuperAdmin || this.esAdminInstitucional) return false;
    return this.authService.esSupervisor(usuarioActual.rol);
  }

  get puedeGestionarUsuarios(): boolean {
    return this.esSuperAdmin || this.esAdminInstitucional;
  }

  // Criterio 1: Determinar claramente el estado actual de la cuenta (Activo / Inactivo / Bloqueado)
  esCuentaBloqueada(u: any): boolean {
    if (!u) return false;
    if (u.esta_bloqueado === true) return true;
    const est = String(u.estado_display || u.estado || '').trim().toLowerCase();
    return est === 'bloqueado' || est === 'bloqueada';
  }

  obtenerEstadoCuenta(u: any): 'Activo' | 'Inactivo' | 'Bloqueado' {
    if (!u) return 'Inactivo';
    if (u.is_active === false || String(u.estado_display || u.estado || '').trim().toLowerCase().startsWith('inactiv')) {
      return 'Inactivo';
    }
    if (this.esCuentaBloqueada(u)) {
      return 'Bloqueado';
    }
    return 'Activo';
  }

  esPropioUsuario(u: any): boolean {
    if (!u) return false;
    const usuarioActual = this.authService.obtenerUsuario();
    if (!usuarioActual) return false;
    const miId = Number(usuarioActual.id_usuario);
    const uId = Number(u.id_usuario || u.id || u.pk || u.user_id);
    return Boolean(miId && uId && miId === uId);
  }

  // Criterios 3 y 10: Autorización estricta y restricción de autogestión para activar/desactivar cuentas
  puedeCambiarEstadoUsuario(u: any): boolean {
    if (!u || !this.puedeGestionarUsuarios) return false;
    if (this.esPropioUsuario(u)) return false;
    if (this.esUsuarioSuperAdmin(u)) return false;
    if (this.esSuperAdmin) return true;

    const usuarioActual = this.authService.obtenerUsuario();
    if (!usuarioActual) return false;

    if (this.esAdminInstitucional) {
      if (this.esUsuarioSupervisor(u) || this.esUsuarioAdmin(u)) return false;
      const miInstId = Number(usuarioActual.id_institucion);
      if (!miInstId) return false;
      const uInstId = typeof u.id_institucion === 'object' && u.id_institucion !== null
        ? Number(u.id_institucion.id_institucion || u.id_institucion.id)
        : Number(u.id_institucion);
      return uInstId === miInstId;
    }

    return false;
  }

  // Criterio 2 y 6: Verificar si el usuario autenticado puede editar a un usuario específico
  puedeEditarUsuario(u: any): boolean {
    if (!u || !this.puedeGestionarUsuarios) return false;
    if (this.esSuperAdmin) return true;

    const usuarioActual = this.authService.obtenerUsuario();
    if (!usuarioActual) return false;

    if (this.esAdminInstitucional) {
      if (this.esUsuarioSuperAdmin(u) || this.esUsuarioSupervisor(u)) return false;
      const miId = Number(usuarioActual.id_usuario);
      const uId = Number(u.id_usuario || u.id);
      if (uId === miId) return true;
      if (this.esUsuarioAdmin(u)) return false;

      const miInstId = Number(usuarioActual.id_institucion);
      if (!miInstId) return false;
      const uInstId = typeof u.id_institucion === 'object' && u.id_institucion !== null
        ? Number(u.id_institucion.id_institucion || u.id_institucion.id)
        : Number(u.id_institucion);
      return uInstId === miInstId;
    }

    return false;
  }

  get editandoPropioUsuario(): boolean {
    if (!this.modoEdicion || !this.usuarioSeleccionadoId) return false;
    const miId = Number(this.authService.obtenerUsuario()?.id_usuario);
    return Boolean(miId && Number(this.usuarioSeleccionadoId) === miId);
  }

  get editandoPropioPerfilAdmin(): boolean {
    if (!this.modoEdicion || !this.esAdminInstitucional || !this.usuarioSeleccionadoId) {
      return false;
    }
    const miId = Number(this.authService.obtenerUsuario()?.id_usuario);
    return Number(this.usuarioSeleccionadoId) === miId;
  }

  get rolesFormularioDisponibles(): any[] {
    if (this.editandoPropioPerfilAdmin && this.usuarioForm.rol) {
      const idRol = Number(this.usuarioForm.rol);
      const encontrado = this.todosLosRoles.find(r => Number(r.id_rol) === idRol);
      if (encontrado) {
        return [encontrado];
      }
      return [{ id_rol: idRol, nombre_rol: this.obtenerNombreRol(idRol) }];
    }
    return this.roles;
  }

  // Criterio 4: Filtrar por institución cuando corresponda al ámbito del usuario autenticado
  get puedeFiltrarPorInstitucion(): boolean {
    if (this.esSuperAdmin) return true;
    if (this.esSupervisorActual && this.funcionalidadSupervisionActiva) return true;
    return false;
  }

  private _institucionesFiltroCache: any[] = [];
  private _opcionesFiltroRolCache: any[] = [{ id_rol: '', nombre_rol: 'Todos los Roles' }];

  get institucionesFiltroDisponibles(): any[] {
    return this._institucionesFiltroCache;
  }

  get opcionesFiltroRol(): any[] {
    return this._opcionesFiltroRolCache;
  }

  private actualizarOpcionesFiltrosCatalogo(): void {
    const catalogo = this.todosLosRoles.length > 0 ? this.todosLosRoles : this.roles;
    let rolesOpciones = catalogo;

    if (this.esAdminInstitucional) {
      rolesOpciones = catalogo.filter((r: any) => {
        const nom = (r.nombre_rol || r.nombre || '').toLowerCase();
        return !nom.includes('super');
      });
    }

    this._opcionesFiltroRolCache = [
      { id_rol: '', nombre_rol: 'Todos los Roles' },
      ...(rolesOpciones || [])
    ];

    if (this.esSuperAdmin) {
      this._institucionesFiltroCache = this.instituciones;
    } else if (this.esSupervisorActual && this.funcionalidadSupervisionActiva) {
      const idsAsignados = this.obtenerIdsInstitucionesSupervisorActual();
      this._institucionesFiltroCache = this.instituciones.filter(i =>
        idsAsignados.includes(Number(i.id_institucion || i.id))
      );
    } else if (this.esAdminInstitucional) {
      const miInst = this.authService.obtenerUsuario()?.id_institucion;
      this._institucionesFiltroCache = miInst
        ? this.instituciones.filter(i => Number(i.id_institucion || i.id) === Number(miInst))
        : [];
    } else {
      this._institucionesFiltroCache = [];
    }
  }

  modoEdicion: boolean = false;
  usuarioSeleccionadoId?: number;
  mostrarModal: boolean = false;
  mostrarModalDetalleSupervisor: boolean = false;
  supervisorDetalle: any = null;
  usuarioDetalleModal: any = null;
  institucionesDetalleModal: any[] = [];

  // Criterios 2, 3 y 4: Filtros reactivos de búsqueda, rol, estado e institución
  filtroTexto: string = '';
  filtroRol: string = '';
  filtroEstado: string = '';
  filtroInstitucion: string = '';

  usuarioForm: any = {
    nombre: '',
    apellido: '',
    correo: '',
    tipo_documento: 'CC',
    numero_documento: '',
    rol: '',
    id_institucion: null,
    id_sede: null,
    id_jornada: null,
    password: '',
    is_active: true
  };

  supervisorInstitucionesSeleccionadas: number[] = [];
  supervisorRelacionesOriginales: any[] = [];

  private usuarioService = inject(UsuarioService);
  private rolService = inject(RolService);
  private bancoDatosService = inject(BancoDatosService);
  private sweetAlert = inject(SweetAlertService);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);

  constructor() {
    this.inicializarFormularioReactivo();
  }

  private inicializarFormularioReactivo(): void {
    this.registroForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      apellido: ['', [Validators.required, Validators.maxLength(100)]],
      correo: ['', [Validators.required, Validators.email, Validators.pattern(this.EMAIL_REGEX)]],
      tipo_documento: ['CC', [Validators.required]],
      numero_documento: ['', [Validators.required, Validators.maxLength(20)]],
      rol: ['', [Validators.required]],
      id_institucion: [null],
      id_sede: [null],
      password: [''],
      is_active: [true, [Validators.required]]
    });

    this.registroForm.valueChanges.subscribe(valores => {
      Object.assign(this.usuarioForm, valores);
    });
  }

  sincronizarFormularioReactivo(): void {
    if (!this.registroForm) return;
    this.registroForm.patchValue(
      {
        nombre: this.usuarioForm.nombre ?? '',
        apellido: this.usuarioForm.apellido ?? '',
        correo: this.usuarioForm.correo ?? '',
        tipo_documento: this.usuarioForm.tipo_documento || 'CC',
        numero_documento: this.usuarioForm.numero_documento ?? '',
        rol: this.usuarioForm.rol ?? '',
        id_institucion: this.usuarioForm.id_institucion ?? null,
        id_sede: this.usuarioForm.id_sede ?? null,
        password: this.usuarioForm.password ?? '',
        is_active: this.usuarioForm.is_active !== undefined ? Boolean(this.usuarioForm.is_active) : true
      },
      { emitEvent: false }
    );
    this.actualizarValidadoresInstitucionales();
  }

  actualizarValidadoresInstitucionales(): void {
    if (!this.registroForm) return;
    const ctrlInst = this.registroForm.get('id_institucion');
    if (!ctrlInst) return;

    if (this.esRolRequiereInstitucion()) {
      ctrlInst.setValidators([Validators.required]);
    } else {
      ctrlInst.clearValidators();
    }
    ctrlInst.updateValueAndValidity({ emitEvent: false });
  }

  ngOnInit(): void {
    this.cargarRoles();
    this.cargarUsuarios();
    this.cargarInstitucionesYSedes();
  }

  cargarInstitucionesYSedes(): void {
    this.bancoDatosService.obtenerDatos('instituciones').subscribe({
      next: (datos: any) => {
        this.instituciones = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.actualizarOpcionesFiltrosCatalogo();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar instituciones en usuarios:', err)
    });

    this.bancoDatosService.obtenerDatos('sedes').subscribe({
      next: (datos: any) => {
        this.sedes = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar sedes en usuarios:', err)
    });

    this.bancoDatosService.obtenerDatos('jornadas').subscribe({
      next: (datos: any) => {
        this.jornadas = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar jornadas en usuarios:', err)
    });
  }

  esInstitucionActiva(inst: any): boolean {
    if (!inst) return false;
    if (inst.estado === undefined || inst.estado === null || inst.estado === '') {
      return true;
    }
    const estadoNorm = String(inst.estado).trim().toLowerCase();
    return ['activo', 'activa', 'active', 'true', '1'].includes(estadoNorm);
  }

  institucionInactiva(inst: any): boolean {
    return !this.esInstitucionActiva(inst);
  }

  esSedeActiva(sede: any): boolean {
    if (!sede) return false;
    if (sede.estado === undefined || sede.estado === null || sede.estado === '') {
      return true;
    }
    const estadoNorm = String(sede.estado).trim().toLowerCase();
    return ['activo', 'activa', 'active', 'true', '1'].includes(estadoNorm);
  }

  esCorreoValido(correo: string): boolean {
    if (!correo || typeof correo !== 'string') return false;
    return this.EMAIL_REGEX.test(correo.trim());
  }

  esRolConInstitucion(): boolean {
    if (!this.usuarioForm.rol) return false;
    const nom = this.obtenerNombreRol(this.usuarioForm.rol).toLowerCase();
    return !nom.includes('super');
  }

  esRolRequiereInstitucion(): boolean {
    if (!this.usuarioForm.rol) return false;
    const nom = this.obtenerNombreRol(this.usuarioForm.rol).toLowerCase();
    return nom.includes('admin') && !nom.includes('super');
  }

  esRolSupervisor(usuario?: any): boolean {
    const u = usuario || this.usuarioForm;
    return this.esUsuarioSupervisor(u);
  }

  esUsuarioSupervisor(u: any): boolean {
    if (!u) return false;
    // 1. Chequeo por rol_detalle
    const nomDetalle = (u.rol_detalle?.nombre_rol || u.rol_detalle?.nombre || '').toLowerCase();
    if (nomDetalle && (nomDetalle.includes('supervisor') || nomDetalle.includes('coordinador'))) return true;

    // 2. Chequeo por rol directo (string o objeto)
    if (typeof u.rol === 'string') {
      const r = u.rol.toLowerCase();
      if (r.includes('supervisor') || r.includes('coordinador')) return true;
    }
    if (typeof u.rol === 'object' && u.rol !== null) {
      const r = (u.rol.nombre_rol || u.rol.nombre || '').toLowerCase();
      if (r.includes('supervisor') || r.includes('coordinador')) return true;
    }

    // 3. Chequeo buscando en el catálogo de roles
    const idRol = typeof u.rol === 'object' ? (u.rol?.id_rol || u.rol?.id || u.rol?.pk) : u.rol;
    if (idRol) {
      const nomCatalog = this.obtenerNombreRol(idRol).toLowerCase();
      if (nomCatalog.includes('supervisor') || nomCatalog.includes('coordinador')) return true;
    }

    // 4. Si el backend ya le serializó instituciones_supervisor
    if (Array.isArray(u.instituciones_supervisor) && u.instituciones_supervisor.length > 0) {
      return true;
    }

    return false;
  }

  esUsuarioAdmin(u: any): boolean {
    if (!u) return false;
    // 1. Chequeo por rol_detalle
    const nomDetalle = (u.rol_detalle?.nombre_rol || u.rol_detalle?.nombre || '').toLowerCase();
    if (nomDetalle && nomDetalle.includes('admin') && !nomDetalle.includes('super')) return true;

    // 2. Chequeo por rol directo (string o objeto)
    if (typeof u.rol === 'string') {
      const r = u.rol.toLowerCase();
      if (r.includes('admin') && !r.includes('super')) return true;
    }
    if (typeof u.rol === 'object' && u.rol !== null) {
      const r = (u.rol.nombre_rol || u.rol.nombre || '').toLowerCase();
      if (r.includes('admin') && !r.includes('super')) return true;
    }

    // 3. Chequeo buscando en el catálogo de roles
    const idRol = typeof u.rol === 'object' ? (u.rol?.id_rol || u.rol?.id || u.rol?.pk) : u.rol;
    if (idRol) {
      const nomCatalog = this.obtenerNombreRol(idRol).toLowerCase();
      if (nomCatalog.includes('admin') && !nomCatalog.includes('super')) return true;
    }

    return false;
  }

  esUsuarioSuperAdmin(u: any): boolean {
    if (!u) return false;
    if (u.is_superuser) return true;
    const nomDetalle = (u.rol_detalle?.nombre_rol || u.rol_detalle?.nombre || '').toLowerCase();
    if (nomDetalle.includes('super')) return true;
    if (typeof u.rol === 'string' && u.rol.toLowerCase().includes('super')) return true;
    if (typeof u.rol === 'object' && u.rol !== null) {
      const r = (u.rol.nombre_rol || u.rol.nombre || '').toLowerCase();
      if (r.includes('super')) return true;
    }
    const idRol = typeof u.rol === 'object' ? (u.rol?.id_rol || u.rol?.id || u.rol?.pk) : u.rol;
    if (idRol) {
      const nomCatalog = this.obtenerNombreRol(idRol).toLowerCase();
      if (nomCatalog.includes('super')) return true;
    }
    return false;
  }

  obtenerIdsInstitucionesSupervisorActual(): number[] {
    const usuarioActual = this.authService.obtenerUsuario();
    if (!usuarioActual) return [];
    const ids = new Set<number>();
    if (usuarioActual.id_institucion) {
      ids.add(Number(usuarioActual.id_institucion));
    }
    if (Array.isArray(usuarioActual.instituciones_supervisor)) {
      usuarioActual.instituciones_supervisor.forEach((inst: any) => {
        const id = Number(inst?.id_institucion || inst?.id);
        if (!Number.isNaN(id) && id > 0) ids.add(id);
      });
    }
    return Array.from(ids);
  }

  activarConsultaSupervision(activa: boolean): void {
    this.funcionalidadSupervisionActiva = activa;
    this.paginaActual = 1;
    this.actualizarUsuariosFiltrados();
  }

  sanitizarUsuario(u: any): any {
    if (!u || typeof u !== 'object') return u;
    const copia: Record<string, any> = { ...u };
    for (const campo of this.CAMPOS_SENSIBLES) {
      delete copia[campo];
    }
    return copia;
  }

  esUsuarioVisible(u: any): boolean {
    if (!u) return false;

    // Criterio 5: El Superadministrador puede consultar y visualizar los usuarios
    // de todas las instituciones del sistema sin restricciones.
    if (this.esSuperAdmin) {
      return true;
    }

    const usuarioActual = this.authService.obtenerUsuario();
    if (!usuarioActual) return false;

    // Criterio 6: El Administrador institucional únicamente puede consultar usuarios
    // pertenecientes estrictamente a su propia institución y dentro de las facultades autorizadas.
    if (this.esAdminInstitucional) {
      if (this.esUsuarioSuperAdmin(u)) return false;
      const miInstId = Number(usuarioActual.id_institucion);
      if (!miInstId) {
        return Number(u.id_usuario || u.id) === Number(usuarioActual.id_usuario);
      }
      const uInstId = typeof u.id_institucion === 'object' && u.id_institucion !== null
        ? Number(u.id_institucion.id_institucion || u.id_institucion.id)
        : Number(u.id_institucion);
      return uInstId === miInstId;
    }

    // Criterio 7: El Supervisor únicamente puede consultar información de usuarios
    // cuando una funcionalidad específica y explícita se lo permita.
    if (this.esSupervisorActual) {
      const miId = Number(usuarioActual.id_usuario);
      const uId = Number(u.id_usuario || u.id);
      if (uId === miId) return true;

      if (!this.funcionalidadSupervisionActiva) {
        return false;
      }
      if (this.esUsuarioSuperAdmin(u)) return false;

      const idsPermitidos = this.obtenerIdsInstitucionesSupervisorActual();
      const uInstId = typeof u.id_institucion === 'object' && u.id_institucion !== null
        ? Number(u.id_institucion.id_institucion || u.id_institucion.id)
        : Number(u.id_institucion);
      return idsPermitidos.includes(uInstId);
    }

    return Number(u.id_usuario || u.id) === Number(usuarioActual.id_usuario);
  }

  contarSedesSupervisor(u: any): number {
    if (!u?.instituciones_supervisor || !Array.isArray(u.instituciones_supervisor)) return 0;
    return u.instituciones_supervisor.reduce((acc: number, inst: any) => acc + (inst.sedes?.length || 0), 0);
  }

  contarSedesTotalDetalle(): number {
    if (!this.institucionesDetalleModal || !Array.isArray(this.institucionesDetalleModal)) return 0;
    return this.institucionesDetalleModal.reduce((acc: number, inst: any) => acc + (inst.sedes?.length || 0), 0);
  }

  verDetalleUsuario(u: any): void {
    // Criterio 9: Garantizar que el detalle completo jamás exponga datos sensibles
    const usuarioLimpio = this.sanitizarUsuario(u);
    this.usuarioDetalleModal = usuarioLimpio;
    this.supervisorDetalle = usuarioLimpio; // Compatibilidad
    
    if (this.esUsuarioSupervisor(usuarioLimpio)) {
      this.institucionesDetalleModal = usuarioLimpio.instituciones_supervisor || [];
    } else if (usuarioLimpio?.id_institucion) {
      const sedesInst = this.obtenerSedesDeInstitucion(usuarioLimpio.id_institucion);
      const instObj = this.instituciones.find(i => Number(i.id_institucion || i.id) === Number(usuarioLimpio.id_institucion));
      this.institucionesDetalleModal = [{
        id_institucion: usuarioLimpio.id_institucion,
        nombre_institucion: usuarioLimpio.institucion_nombre || instObj?.nombre_institucion || instObj?.nombre || 'Institución Educativa',
        nit: instObj?.nit || instObj?.codigo_dane || '',
        sedes: sedesInst
      }];
    } else {
      this.institucionesDetalleModal = [];
    }

    this.mostrarModalDetalleSupervisor = true;
  }

  verDetalleInstitucionesSupervisor(u: any): void {
    this.verDetalleUsuario(u);
  }

  cerrarModalDetalleSupervisor(): void {
    this.mostrarModalDetalleSupervisor = false;
    this.supervisorDetalle = null;
    this.usuarioDetalleModal = null;
    this.institucionesDetalleModal = [];
  }

  editarDesdeDetalle(): void {
    const u = this.usuarioDetalleModal || this.supervisorDetalle;
    this.cerrarModalDetalleSupervisor();
    if (u) {
      this.abrirFormulario(u);
    }
  }

  esRolAdmin(): boolean {
    if (!this.usuarioForm.rol) return false;
    const nom = this.obtenerNombreRol(this.usuarioForm.rol).toLowerCase();
    return nom.includes('admin') && !nom.includes('super');
  }

  onRolChange(): void {
    this.sincronizarFormularioReactivo();
    if (this.esRolSupervisor()) {
      this.usuarioForm.id_institucion = null;
      this.usuarioForm.id_sede = null;
      this.registroForm?.patchValue({ id_institucion: null, id_sede: null }, { emitEvent: false });
    } else if (this.esRolAdmin()) {
      this.supervisorInstitucionesSeleccionadas = [];
    }
  }

  // Helper: Saber si una institución ya tiene un Supervisor asignado diferente del que estamos editando
  institucionAsignadaAotroSupervisor(inst: any): boolean {
    if (!inst) return false;
    const supAsignado = inst.supervisor_asignado;
    if (!supAsignado) return false;
    if (this.modoEdicion && this.usuarioSeleccionadoId && Number(supAsignado.id_usuario) === Number(this.usuarioSeleccionadoId)) {
      return false;
    }
    return true;
  }

  nombreSupervisorAsignado(inst: any): string {
    return inst?.supervisor_asignado?.nombre_completo || 'Otro supervisor';
  }

  // Helper: Saber si una institución ya tiene un Administrador asignado diferente del que estamos editando
  institucionAsignadaAotroAdmin(inst: any): boolean {
    if (!inst) return false;
    const adminAsignado = inst.administrador_asignado;
    if (!adminAsignado) return false;
    if (this.modoEdicion && this.usuarioSeleccionadoId && Number(adminAsignado.id_usuario) === Number(this.usuarioSeleccionadoId)) {
      return false;
    }
    return true;
  }

  nombreAdminAsignado(inst: any): string {
    return inst?.administrador_asignado?.nombre_completo || 'Otro administrador';
  }

  get institucionesOpcionesAdmin(): any[] {
    let baseInstituciones = this.instituciones;
    if (this.esAdminInstitucional) {
      const miInstId = Number(this.authService.obtenerUsuario()?.id_institucion);
      baseInstituciones = miInstId
        ? this.instituciones.filter(inst => Number(inst.id_institucion || inst.id) === miInstId)
        : [];
    }

    return baseInstituciones.map(inst => {
      const inactiva = this.institucionInactiva(inst);
      const ocupado = this.esRolAdmin() && this.institucionAsignadaAotroAdmin(inst);
      let sufijo = '';
      if (inactiva) {
        sufijo = ' (🚫 Inactiva)';
      } else if (ocupado) {
        sufijo = ` (⚠️ Ocupada por: ${this.nombreAdminAsignado(inst)})`;
      }
      return {
        ...inst,
        nombre_display: `${inst.nombre_institucion || inst.nombre}${sufijo}`,
        deshabilitado: inactiva || ocupado
      };
    });
  }

  toggleInstitucionSupervisor(inst: any): void {
    if (this.institucionInactiva(inst)) {
      this.sweetAlert.warning(
        'Institución Inactiva',
        `No se puede asignar la institución "${inst?.nombre_institucion || inst?.nombre}" porque se encuentra en estado inactivo.`
      );
      return;
    }
    if (this.institucionAsignadaAotroSupervisor(inst)) {
      const nombre = this.nombreSupervisorAsignado(inst);
      this.sweetAlert.warning(
        'Institución Ocupada',
        `Esta institución ya se encuentra asignada al Supervisor ${nombre}. Cada institución solo puede tener un único Supervisor responsable.`
      );
      return;
    }
    const id = Number(inst.id_institucion || inst.id);
    const idx = this.supervisorInstitucionesSeleccionadas.indexOf(id);
    if (idx > -1) {
      this.supervisorInstitucionesSeleccionadas.splice(idx, 1);
    } else {
      this.supervisorInstitucionesSeleccionadas.push(id);
    }
    this.cdr.detectChanges();
  }

  institucionSupervisorSeleccionada(id: number): boolean {
    return this.supervisorInstitucionesSeleccionadas.includes(Number(id));
  }

  sincronizarInstitucionesSupervisor(supervisorId: number, usuarioRespuesta?: any): Observable<any> {
    const actuales = this.supervisorInstitucionesSeleccionadas.map(Number);
    if (Array.isArray(usuarioRespuesta?.instituciones_supervisor)) {
      const idsServidor = usuarioRespuesta.instituciones_supervisor.map((i: any) => Number(i.id_institucion || i.id));
      const yaSincronizado = actuales.length === idsServidor.length && actuales.every(id => idsServidor.includes(id));
      if (yaSincronizado) {
        return of([]);
      }
    }
    const originales = this.supervisorRelacionesOriginales;
    const operaciones: Observable<any>[] = [];

    // 1. Eliminar relaciones desmarcadas
    originales.forEach((rel: any) => {
      const relInstId = typeof rel.id_institucion === 'object' ? (rel.id_institucion?.id_institucion || rel.id_institucion?.id) : rel.id_institucion;
      if (!actuales.includes(Number(relInstId))) {
        const relId = rel.id_supervisor_institucion || rel.id;
        if (relId) {
          operaciones.push(
            this.http.delete(`${environment.apiUrl}/supervisor-instituciones/${relId}/`).pipe(
              catchError(err => {
                console.warn('Error al desvincular institución:', err);
                return of(null);
              })
            )
          );
        }
      }
    });

    // 2. Vincular nuevas instituciones marcadas
    actuales.forEach((instId: number) => {
      const yaExiste = originales.some((rel: any) => {
        const relInstId = typeof rel.id_institucion === 'object' ? (rel.id_institucion?.id_institucion || rel.id_institucion?.id) : rel.id_institucion;
        return Number(relInstId) === Number(instId);
      });
      if (!yaExiste) {
        operaciones.push(
          this.http.post(`${environment.apiUrl}/supervisor-instituciones/`, {
            id_supervisor: supervisorId,
            id_institucion: instId
          }).pipe(
            catchError(err => {
              console.warn('Error al vincular institución a supervisor:', err);
              return of(null);
            })
          )
        );
      }
    });

    if (operaciones.length === 0) {
      return of([]);
    }

    return forkJoin(operaciones);
  }

  obtenerSedesDeInstitucion(idInst: any): any[] {
    if (!idInst) return [];
    const instId = typeof idInst === 'object' && idInst !== null
      ? (idInst.id_institucion ?? idInst.id)
      : Number(idInst);
    return this.sedes.filter(s => {
      const sInstId = typeof s.id_institucion === 'object' && s.id_institucion !== null
        ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
        : Number(s.id_institucion);
      return Number(sInstId) === Number(instId) && this.esSedeActiva(s);
    });
  }

  esRolConSede(): boolean {
    if (!this.usuarioForm.rol) return false;
    if (this.esRolSupervisor()) return false;
    const nom = this.obtenerNombreRol(this.usuarioForm.rol).toLowerCase();
    if (nom.includes('super')) return false;
    return true;
  }

  esRolJefa(): boolean {
    if (!this.usuarioForm.rol) return false;
    const nom = this.obtenerNombreRol(this.usuarioForm.rol).toLowerCase();
    return nom.includes('jefa');
  }

  get sedesDeInstitucionSeleccionada(): any[] {
    return this.obtenerSedesDeInstitucion(this.usuarioForm.id_institucion);
  }

  onInstitucionChange(): void {
    this.sincronizarFormularioReactivo();
    if (this.usuarioForm.id_sede) {
      const existe = this.sedesDeInstitucionSeleccionada.some(
        s => (s.id_sede || s.id) === Number(this.usuarioForm.id_sede)
      );
      if (!existe) {
        this.usuarioForm.id_sede = null;
        this.registroForm?.patchValue({ id_sede: null }, { emitEvent: false });
      }
    }
  }

  cargarUsuarios(): void {
    this.cargandoUsuarios = true;
    this.errorConsulta = '';

    const peticion$ = (this.esSupervisorActual && this.funcionalidadSupervisionActiva && typeof (this.usuarioService as any).getUsuariosSupervision === 'function')
      ? (this.usuarioService as any).getUsuariosSupervision()
      : this.usuarioService.getUsuarios();

    peticion$.subscribe({
      next: (datos: any) => {
        const listaCruda = Array.isArray(datos) ? datos : (datos?.results || datos?.data || []);
        this.usuarios = listaCruda.map((u: any) => this.sanitizarUsuario(u));
        this.totalRegistrosServidor = typeof datos?.count === 'number' ? datos.count : this.usuarios.length;
        this.tieneSiguienteServidor = Boolean(datos?.next);
        this.tieneAnteriorServidor = Boolean(datos?.previous);
        this.cargandoUsuarios = false;
        this.actualizarUsuariosFiltrados();
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error al cargar usuarios:', error);
        this.cargandoUsuarios = false;
        this.usuarios = [];
        this._usuariosFiltradosCache = [];
        const detalleError = error?.error?.detail || error?.message || '';
        this.errorConsulta = detalleError
          ? `No se pudieron cargar los usuarios del sistema (${detalleError}).`
          : 'No se pudieron cargar los usuarios del sistema. Verifica tu conexión e inténtalo nuevamente.';
        this.sweetAlert.error('Error', 'No se pudieron cargar los usuarios del sistema.');
        this.cdr.detectChanges();
      }
    });
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (datos: any) => {
        const rolesApi = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        // Normalizamos las propiedades para soportar id_rol / id y nombre_rol / nombre
        const normalizados = rolesApi.map((r: any) => ({
          id_rol: r.id_rol || r.id || r.pk,
          nombre_rol: r.nombre_rol || r.nombre || r.name
        }));

        this.todosLosRoles = normalizados;

        const usuarioActual = this.authService.obtenerUsuario();
        const esSuper = this.esSuperAdmin;
        const esAdmin = this.authService.esAdministrador(usuarioActual?.rol);

        if (esSuper) {
          // El Super Administrador SOLO crea y asigna Administradores institucionales y Supervisores
          this.roles = normalizados.filter((r: any) => {
            const nom = (r.nombre_rol || '').toLowerCase();
            const esAdminRol = (nom === 'administrador' || nom === 'admin' || (nom.includes('admin') && !nom.includes('super')));
            const esSupervRol = nom.includes('supervisor') || nom.includes('coordinador');
            return esAdminRol || esSupervRol;
          });
        } else if (esAdmin) {
          // El Administrador de colegio solo crea personal de cocina
          this.roles = normalizados.filter((r: any) => {
            const nom = (r.nombre_rol || '').toLowerCase();
            return nom.includes('manipuladora') || nom.includes('jefa') || nom.includes('cocina');
          });
        } else {
          this.roles = normalizados;
        }

        this.actualizarOpcionesFiltrosCatalogo();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar los roles:', error);
        this.sweetAlert.error('Atención', 'No se pudieron sincronizar los roles desde la base de datos.');
      }
    });
  }

  obtenerNombreRol(idRol: any): string {
    if (!idRol) return 'Sin Rol';
    const idBuscado = typeof idRol === 'object' ? (idRol.id_rol || idRol.id || idRol.pk) : idRol;
    const catalogo = this.todosLosRoles.length > 0 ? this.todosLosRoles : this.roles;
    const rolEncontrado = catalogo.find(r => r.id_rol == idBuscado);
    if (!rolEncontrado) {
      if (typeof idRol === 'object') {
        return idRol.nombre_rol || idRol.nombre || 'Rol';
      }
      return `Rol ID: ${idRol}`;
    }
    
    return rolEncontrado.nombre_rol;
  }

  private _usuariosBaseCache: any[] = [];
  private _usuariosFiltradosCache: any[] = [];
  private _usuariosPaginadosCache: any[] = [];
  private _paginasVisiblesCache: number[] = [1];

  get usuariosBase(): any[] {
    return this._usuariosBaseCache;
  }

  get usuariosFiltrados(): any[] {
    return this._usuariosFiltradosCache;
  }

  // Criterio 10: Paginación del lado del cliente sincronizada con el listado filtrado
  get totalPaginas(): number {
    const total = this._usuariosFiltradosCache.length;
    return Math.max(1, Math.ceil(total / Math.max(1, this.tamanoPagina)));
  }

  get usuariosPaginados(): any[] {
    return this._usuariosPaginadosCache;
  }

  get paginasVisibles(): number[] {
    return this._paginasVisiblesCache;
  }

  private recalcularPaginacion(): void {
    const total = this.totalPaginas;
    if (this.paginaActual > total) {
      this.paginaActual = 1;
    }
    const inicio = (this.paginaActual - 1) * this.tamanoPagina;
    this._usuariosPaginadosCache = this._usuariosFiltradosCache.slice(inicio, inicio + this.tamanoPagina);

    const paginas: number[] = [];
    const pInicio = Math.max(1, this.paginaActual - 2);
    const pFin = Math.min(total, pInicio + 4);
    for (let p = pInicio; p <= pFin; p++) {
      paginas.push(p);
    }
    this._paginasVisiblesCache = paginas.length > 0 ? paginas : [1];
  }

  get tieneFiltrosActivos(): boolean {
    return Boolean(
      (this.filtroTexto || '').trim() ||
      (this.filtroRol || '').toString().trim() ||
      (this.filtroEstado || '').toString().trim() ||
      (this.filtroInstitucion || '').toString().trim()
    );
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroRol = '';
    this.filtroEstado = '';
    this.filtroInstitucion = '';
    this.paginaActual = 1;
    this.actualizarUsuariosFiltrados();
  }

  irAPagina(pagina: number): void {
    const destino = Math.min(Math.max(1, Number(pagina) || 1), this.totalPaginas);
    this.paginaActual = destino;
    this.recalcularPaginacion();
  }

  paginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.recalcularPaginacion();
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual < this.totalPaginas) {
      this.paginaActual++;
      this.recalcularPaginacion();
    }
  }

  cambiarTamanoPagina(nuevoTamano: number): void {
    const tam = Number(nuevoTamano);
    if (!Number.isNaN(tam) && tam > 0) {
      this.tamanoPagina = tam;
      this.paginaActual = 1;
      this.recalcularPaginacion();
    }
  }

  actualizarUsuariosFiltrados(): void {
    this.actualizarOpcionesFiltrosCatalogo();
    const base = this.usuarios.filter(u => this.esUsuarioVisible(u));
    this._usuariosBaseCache = base;
    const texto = (this.filtroTexto || '').trim().toLowerCase();
    const rol = this.filtroRol ? this.filtroRol.toString().trim() : '';
    const estado = (this.filtroEstado || '').toString().trim().toLowerCase();
    const instFiltro = (this.filtroInstitucion || '').toString().trim();

    if (!texto && !rol && !estado && !instFiltro) {
      this._usuariosFiltradosCache = base;
      this.recalcularPaginacion();
      return;
    }

    this._usuariosFiltradosCache = base.filter(u => {
      const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`.trim().toLowerCase();
      const textoMatch = !texto ||
        (u.nombre?.toLowerCase() || '').includes(texto) ||
        (u.apellido?.toLowerCase() || '').includes(texto) ||
        nombreCompleto.includes(texto) ||
        String(u.numero_documento || '').toLowerCase().includes(texto) ||
        (u.correo?.toLowerCase() || '').includes(texto);

      let rolMatch = true;
      if (rol) {
        const uRolId = typeof u.rol === 'object' ? (u.rol?.id_rol || u.rol?.id || u.rol?.pk) : u.rol;
        const uRolNom = this.obtenerNombreRol(u.rol).toLowerCase();
        rolMatch = (uRolId?.toString() === rol) || (uRolNom === rol.toLowerCase());
      }

      let estadoMatch = true;
      if (estado) {
        const estadoActual = this.obtenerEstadoCuenta(u).toLowerCase();
        const esActivo = Boolean(u.is_active);
        if (['bloqueado', 'bloqueada', 'locked'].includes(estado)) {
          estadoMatch = estadoActual === 'bloqueado';
        } else if (['activo', 'activa', 'true', '1'].includes(estado)) {
          estadoMatch = esActivo && estadoActual !== 'bloqueado';
        } else if (['inactivo', 'inactiva', 'false', '0'].includes(estado)) {
          estadoMatch = !esActivo;
        }
      }

      let instMatch = true;
      if (instFiltro && this.puedeFiltrarPorInstitucion) {
        const idBuscado = Number(instFiltro);
        const uInstId = typeof u.id_institucion === 'object' && u.id_institucion !== null
          ? Number(u.id_institucion.id_institucion || u.id_institucion.id)
          : Number(u.id_institucion);
        const tieneEnSupervisor = Array.isArray(u.instituciones_supervisor) &&
          u.instituciones_supervisor.some((i: any) => Number(i.id_institucion || i.id) === idBuscado);
        instMatch = (uInstId === idBuscado) || tieneEnSupervisor;
      } else if (instFiltro && !this.puedeFiltrarPorInstitucion) {
        const miInstId = Number(this.authService.obtenerUsuario()?.id_institucion);
        instMatch = Number(instFiltro) === miInstId;
      }

      return textoMatch && rolMatch && estadoMatch && instMatch;
    });

    this.recalcularPaginacion();
  }

  trackPorUsuario(index: number, u: any): any {
    return u.id_usuario || u.id || index;
  }

  abrirFormulario(usuario?: any): void {
    if (usuario && !this.puedeEditarUsuario(usuario)) {
      this.sweetAlert.warning(
        'Acceso Restringido',
        'No tienes autorización para modificar usuarios, roles o asignaciones fuera de tu ámbito institucional.'
      );
      return;
    }

    this.mostrarModal = true;
    this.intentoEnvio = false;
    this.mensajeRetroalimentacion = '';
    this.supervisorInstitucionesSeleccionadas = [];
    this.supervisorRelacionesOriginales = [];
    
    if (usuario) {
      this.modoEdicion = true;
      this.usuarioSeleccionadoId = usuario.id_usuario || usuario.id || usuario.pk || usuario.user_id;
      const rolValor = typeof usuario.rol === 'object' ? (usuario.rol?.id_rol || usuario.rol?.id || usuario.rol?.pk) : usuario.rol;
      const miInstAdmin = this.esAdminInstitucional ? this.authService.obtenerUsuario()?.id_institucion : null;
      const instValor = typeof usuario.id_institucion === 'object' 
        ? (usuario.id_institucion?.id_institucion || usuario.id_institucion?.id) 
        : (usuario.id_institucion ?? miInstAdmin);
      const sedeValor = typeof usuario.id_sede === 'object'
        ? (usuario.id_sede?.id_sede || usuario.id_sede?.id)
        : usuario.id_sede;
      const jornadaValor = typeof usuario.id_jornada === 'object'
        ? (usuario.id_jornada?.id_jornada || usuario.id_jornada?.id)
        : usuario.id_jornada;

      this.usuarioForm = { 
        ...usuario, 
        rol: Number(rolValor) || '',
        id_institucion: instValor ? Number(instValor) : null,
        id_sede: sedeValor ? Number(sedeValor) : null,
        id_jornada: jornadaValor ? Number(jornadaValor) : null,
        password: '' 
      };
      this.sincronizarFormularioReactivo();

      // Si el usuario ya trae instituciones_supervisor cargadas, las poblamos de inmediato
      if (Array.isArray(usuario.instituciones_supervisor) && usuario.instituciones_supervisor.length > 0) {
        this.supervisorInstitucionesSeleccionadas = usuario.instituciones_supervisor.map((i: any) => Number(i.id_institucion || i.id));
      }

      // Si es supervisor, consultamos la tabla relacional para tener los id_supervisor_institucion exactos para desvincular
      const esSupervisor = this.esRolSupervisor(usuario) || this.esRolSupervisor(this.usuarioForm);
      if (esSupervisor && this.usuarioSeleccionadoId) {
        this.http.get<any[]>(`${environment.apiUrl}/supervisor-instituciones/?id_supervisor=${this.usuarioSeleccionadoId}`).subscribe({
          next: (rels: any) => {
            const lista = Array.isArray(rels) ? rels : (rels.results || []);
            this.supervisorRelacionesOriginales = lista;
            this.supervisorInstitucionesSeleccionadas = lista.map((r: any) => {
              const instId = typeof r.id_institucion === 'object' ? (r.id_institucion?.id_institucion || r.id_institucion?.id) : r.id_institucion;
              return Number(instId);
            });
            this.cdr.detectChanges();
          },
          error: (err) => console.error('Error al cargar instituciones del supervisor:', err)
        });
      }
      return;
    }
    
    this.modoEdicion = false;
    this.usuarioSeleccionadoId = undefined;
    const miInstDefecto = this.esAdminInstitucional
      ? (Number(this.authService.obtenerUsuario()?.id_institucion) || null)
      : null;
    
    this.usuarioForm = {
      nombre: '',
      apellido: '',
      correo: '',
      tipo_documento: 'CC',
      numero_documento: '',
      rol: '',
      id_institucion: miInstDefecto,
      id_sede: null,
      id_jornada: null,
      password: '',
      is_active: true
    };
    this.sincronizarFormularioReactivo();
  }

  cerrarFormulario(): void {
    this.mostrarModal = false;
    this.intentoEnvio = false;
    this.usuarioForm.password = '';
    this.registroForm?.patchValue({ password: '' }, { emitEvent: false });
  }

  campoInvalido(nombreCampo: string): boolean {
    const control = this.registroForm?.get(nombreCampo);
    if (!control) return false;
    return control.invalid && (control.dirty || control.touched || this.intentoEnvio);
  }

  private formatearMensajeError(err: any): string {
    const etiquetasCampos: Record<string, string> = {
      nombre: 'Nombre',
      apellido: 'Apellido',
      correo: 'Correo electrónico',
      tipo_documento: 'Tipo de documento',
      numero_documento: 'Número de documento',
      rol: 'Rol',
      id_institucion: 'Institución educativa',
      instituciones_ids: 'Instituciones asignadas',
      id_sede: 'Sede educativa',
      password: 'Contraseña',
      non_field_errors: 'Validación'
    };

    if (err?.error) {
      if (typeof err.error === 'object') {
        const primerCampo = Object.keys(err.error)[0];
        const etiqueta = etiquetasCampos[primerCampo] || primerCampo.replace(/_/g, ' ');
        const detalle = err.error[primerCampo];
        if (Array.isArray(detalle)) {
          return `${etiqueta}: ${detalle[0]}`;
        } else if (typeof detalle === 'string') {
          return primerCampo === 'detail' ? detalle : `${etiqueta}: ${detalle}`;
        }
      } else if (typeof err.error === 'string') {
        return err.error;
      }
    }
    return 'Ocurrió un error inesperado en el servidor.';
  }

  existeCorreoDuplicado(correo: string): boolean {
    const correoLimpio = (correo || '').trim().toLowerCase();
    if (!correoLimpio) return false;
    return this.usuarios.some(u => {
      const idU = Number(u.id_usuario || u.id || u.pk);
      if (this.modoEdicion && this.usuarioSeleccionadoId && idU === Number(this.usuarioSeleccionadoId)) {
        return false;
      }
      return (u.correo || '').trim().toLowerCase() === correoLimpio;
    });
  }

  existeDocumentoDuplicado(numeroDoc: string): boolean {
    const docLimpio = (numeroDoc || '').trim().toLowerCase();
    if (!docLimpio) return false;
    return this.usuarios.some(u => {
      const idU = Number(u.id_usuario || u.id || u.pk);
      if (this.modoEdicion && this.usuarioSeleccionadoId && idU === Number(this.usuarioSeleccionadoId)) {
        return false;
      }
      return (u.numero_documento || '').trim().toLowerCase() === docLimpio;
    });
  }

  guardarUsuario(): void {
    this.intentoEnvio = true;
    this.sincronizarFormularioReactivo();
    this.registroForm?.markAllAsTouched();

    const nombre = (this.usuarioForm.nombre || '').trim();
    const apellido = (this.usuarioForm.apellido || '').trim();
    const correo = (this.usuarioForm.correo || '').trim().toLowerCase();
    const tipoDoc = (this.usuarioForm.tipo_documento || '').trim();
    const numDoc = (this.usuarioForm.numero_documento || '').trim();
    const rol = this.usuarioForm.rol;

    // Criterio 4: Validación rigurosa de campos obligatorios
    if (!nombre || !apellido || !correo || !tipoDoc || !numDoc || !rol) {
      this.sweetAlert.warning('Campos incompletos', 'Por favor llena todos los campos obligatorios: Nombre, Apellido, Tipo y Número de documento, Correo electrónico y Rol.');
      return;
    }

    // Criterio 5: Validación de formato de correo electrónico
    if (!this.esCorreoValido(correo)) {
      this.sweetAlert.warning('Correo inválido', 'Por favor ingresa un correo electrónico con un formato válido (ejemplo: usuario@institucion.edu.co).');
      return;
    }

    // Criterio 6: Validación preventiva de unicidad de correo y número de documento
    if (this.existeCorreoDuplicado(correo)) {
      this.sweetAlert.warning('Correo duplicado', 'Ya existe un usuario registrado con este correo electrónico.');
      return;
    }

    if (this.existeDocumentoDuplicado(numDoc)) {
      this.sweetAlert.warning('Documento duplicado', 'Ya existe un usuario registrado con este número de documento.');
      return;
    }

    // Control de alcance (Privilegios) para el Administrador institucional (Criterio 2 y 6)
    if (this.esAdminInstitucional) {
      const usuarioActual = this.authService.obtenerUsuario();
      const miInstId = Number(usuarioActual?.id_institucion);
      if (!miInstId) {
        this.sweetAlert.warning(
          'Alcance restringido',
          'Tu cuenta de Administrador no tiene una institución asignada autorizada.'
        );
        return;
      }

      if (this.usuarioForm.id_institucion && Number(this.usuarioForm.id_institucion) !== miInstId) {
        this.sweetAlert.warning(
          'Alcance restringido',
          'No tienes autorización para asignar usuarios a otra institución fuera de tu ámbito.'
        );
        return;
      }

      this.usuarioForm.id_institucion = miInstId;
      this.registroForm?.patchValue({ id_institucion: miInstId }, { emitEvent: false });

      if (this.usuarioForm.id_sede) {
        const sedeValida = this.obtenerSedesDeInstitucion(miInstId).some(
          s => Number(s.id_sede || s.id) === Number(this.usuarioForm.id_sede)
        );
        if (!sedeValida) {
          this.sweetAlert.warning(
            'Sede fuera de alcance',
            'La sede seleccionada no pertenece a tu institución educativa.'
          );
          return;
        }
      }

      if (!this.editandoPropioPerfilAdmin) {
        const nomRolSel = this.obtenerNombreRol(rol).toLowerCase();
        const esRolCocina = nomRolSel.includes('manipuladora') || nomRolSel.includes('jefa') || nomRolSel.includes('cocina');
        if (!esRolCocina) {
          this.sweetAlert.warning(
            'Rol no autorizado',
            'El Administrador institucional solo puede asignar roles de cocina (Manipuladora Jefe o Manipuladoras).'
          );
          return;
        }
      }
    }

    // Criterios 7, 8, 9 y 10 para Administrador institucional (1 sola institución activa, sin duplicar admin activo)
    if (this.esRolRequiereInstitucion() && !this.usuarioForm.id_institucion) {
      this.sweetAlert.warning('Institución requerida', 'Debes seleccionar la institución educativa activa a la que pertenecerá el Administrador institucional.');
      return;
    }

    if (this.usuarioForm.id_institucion) {
      const instSel = this.instituciones.find(i => Number(i.id_institucion || i.id) === Number(this.usuarioForm.id_institucion));
      if (instSel && this.institucionInactiva(instSel)) {
        this.sweetAlert.warning(
          'Institución Inactiva',
          `No se puede asignar el usuario a la institución "${instSel.nombre_institucion || instSel.nombre}" porque se encuentra en estado inactivo.`
        );
        return;
      }
      if (this.esRolAdmin() && instSel && this.institucionAsignadaAotroAdmin(instSel) && this.usuarioForm.is_active !== false) {
        this.sweetAlert.warning(
          'Institución con Administrador',
          `La institución "${instSel.nombre_institucion || instSel.nombre}" ya tiene asignado al Administrador ${this.nombreAdminAsignado(instSel)}. Cada institución solo puede tener un único Administrador activo.`
        );
        return;
      }
    }

    // Criterio 8 y 9 para Supervisor: verificar que ninguna institución seleccionada esté inactiva
    if (this.esRolSupervisor() && this.supervisorInstitucionesSeleccionadas.length > 0) {
      const instInactivaSel = this.supervisorInstitucionesSeleccionadas
        .map(id => this.instituciones.find(i => Number(i.id_institucion || i.id) === Number(id)))
        .find(inst => inst && this.institucionInactiva(inst));

      if (instInactivaSel) {
        this.sweetAlert.warning(
          'Institución Inactiva',
          `No se puede asignar la institución "${instInactivaSel.nombre_institucion || instInactivaSel.nombre}" porque se encuentra en estado inactivo.`
        );
        return;
      }
    }

    const esSup = this.esRolSupervisor();
    const datosEnviar: any = {
      nombre,
      apellido,
      correo,
      tipo_documento: tipoDoc,
      numero_documento: numDoc,
      rol: Number(rol),
      id_institucion: (!esSup && this.usuarioForm.id_institucion) ? Number(this.usuarioForm.id_institucion) : null,
      id_sede: (!esSup && this.usuarioForm.id_sede) ? Number(this.usuarioForm.id_sede) : null,
      id_jornada: (!esSup && this.usuarioForm.id_jornada) ? Number(this.usuarioForm.id_jornada) : null,
      is_active: this.usuarioForm.is_active !== undefined ? Boolean(this.usuarioForm.is_active) : true
    };

    if (esSup) {
      datosEnviar.instituciones_ids = this.supervisorInstitucionesSeleccionadas.map(Number);
    }

    // Criterios 11 y 12: Si el usuario ingresa una contraseña se envía por canal seguro para su hash;
    // si se deja en blanco al crear, el backend genera automáticamente una contraseña temporal segura hasheada
    // y envía un enlace firmado de activación por correo sin exponer texto plano.
    if (this.usuarioForm.password && String(this.usuarioForm.password).trim() !== '') {
      datosEnviar.password = String(this.usuarioForm.password).trim();
    }

    // Limpiar el campo de contraseña en memoria del formulario de inmediato
    this.usuarioForm.password = '';
    this.registroForm?.patchValue({ password: '' }, { emitEvent: false });

    if (this.modoEdicion && this.usuarioSeleccionadoId) {
      const idEditando = this.usuarioSeleccionadoId;
      this.usuarioService.actualizarUsuario(idEditando, datosEnviar).subscribe({
        next: (usuarioActualizado: any) => {
          if (esSup) {
            this.sincronizarInstitucionesSupervisor(idEditando, usuarioActualizado).subscribe({
              next: () => {
                this.mensajeRetroalimentacion = 'El usuario y sus asignaciones institucionales se actualizaron correctamente.';
                this.sweetAlert.success('¡Actualizado!', this.mensajeRetroalimentacion);
                this.cerrarFormulario();
                this.cargarUsuarios();
                this.cargarInstitucionesYSedes();
              },
              error: () => {
                this.mensajeRetroalimentacion = 'El usuario se actualizó correctamente.';
                this.sweetAlert.success('¡Actualizado!', this.mensajeRetroalimentacion);
                this.cerrarFormulario();
                this.cargarUsuarios();
                this.cargarInstitucionesYSedes();
              }
            });
          } else {
            this.mensajeRetroalimentacion = 'El usuario se actualizó correctamente.';
            this.sweetAlert.success('¡Actualizado!', this.mensajeRetroalimentacion);
            this.cerrarFormulario();
            this.cargarUsuarios();
            this.cargarInstitucionesYSedes();
          }
        },
        error: (err) => {
          const mensajeError = this.formatearMensajeError(err);
          this.sweetAlert.error('Error de Validación', mensajeError);
        }
      });
    } else {
      this.usuarioService.crearUsuario(datosEnviar).subscribe({
        next: (nuevoUsuario: any) => {
          const nuevoId = nuevoUsuario?.id_usuario || nuevoUsuario?.id;
          const msgActivacion = !datosEnviar.password
            ? ' Se generó una clave temporal segura y se envió el enlace de activación al correo del usuario.'
            : '';
          if (esSup && nuevoId) {
            this.sincronizarInstitucionesSupervisor(nuevoId, nuevoUsuario).subscribe({
              next: () => {
                this.mensajeRetroalimentacion = `El usuario y sus asignaciones se registraron correctamente.${msgActivacion}`;
                this.sweetAlert.success('¡Usuario Registrado!', this.mensajeRetroalimentacion);
                this.cerrarFormulario();
                this.cargarUsuarios();
                this.cargarInstitucionesYSedes();
              },
              error: () => {
                this.mensajeRetroalimentacion = `El usuario se registró correctamente.${msgActivacion}`;
                this.sweetAlert.success('¡Usuario Registrado!', this.mensajeRetroalimentacion);
                this.cerrarFormulario();
                this.cargarUsuarios();
                this.cargarInstitucionesYSedes();
              }
            });
          } else {
            this.mensajeRetroalimentacion = `El usuario se registró correctamente.${msgActivacion}`;
            this.sweetAlert.success('¡Usuario Registrado!', this.mensajeRetroalimentacion);
            this.cerrarFormulario();
            this.cargarUsuarios();
            this.cargarInstitucionesYSedes();
          }
        },
        error: (err) => {
          const mensajeError = this.formatearMensajeError(err);
          this.sweetAlert.error('Error de Validación', mensajeError);
        }
      });
    }
  }

  editarUsuario(usuario: any): void {
    this.abrirFormulario(usuario);
  }

  cambiarEstadoUsuario(usuario: any): void {
    this.toggleEstadoUsuario(usuario);
  }

  toggleEstadoUsuario(usuario: any): void {
    const id = usuario?.id_usuario || usuario?.id || usuario?.pk || usuario?.user_id;
    if (!id) {
      this.sweetAlert.error('Error', 'Este usuario no tiene un ID válido.');
      return;
    }

    // Criterio 10: Restricción de Autogestión
    if (this.esPropioUsuario(usuario)) {
      this.sweetAlert.warning(
        'Operación no permitida',
        'No tienes autorización para activar o desactivar tu propia cuenta.'
      );
      return;
    }

    // Criterio 3: Autorización estricta por rol y ámbito institucional
    if (!this.puedeCambiarEstadoUsuario(usuario)) {
      this.sweetAlert.warning(
        'Acceso Restringido',
        'No tienes autorización para cambiar el estado de esta cuenta fuera de tus privilegios o ámbito institucional.'
      );
      return;
    }

    const nuevoEstado = !usuario.is_active;
    const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || usuario.correo || 'este usuario';
    const tituloConfirmacion = nuevoEstado ? '¿Activar cuenta de usuario?' : '¿Desactivar cuenta de usuario?';
    const mensajeConfirmacion = nuevoEstado
      ? `¿Confirmas que deseas activar la cuenta de ${nombreCompleto}? El usuario podrá iniciar sesión nuevamente en el sistema.`
      : `¿Confirmas que deseas desactivar la cuenta de ${nombreCompleto}? Se revocarán sus sesiones activas de inmediato y no podrá acceder al sistema.`;
    const botonConfirmacion = nuevoEstado ? 'Sí, activar' : 'Sí, desactivar';

    // Criterio 2: Solicitar obligatoriamente confirmación antes de ejecutar el cambio de estado
    this.sweetAlert.confirm(tituloConfirmacion, mensajeConfirmacion, botonConfirmacion)
      .then((result: any) => {
        if (!result || !result.isConfirmed) {
          return;
        }

        const datosEnviar = {
          is_active: nuevoEstado
        };

        this.usuarioService.actualizarUsuario(id, datosEnviar).subscribe({
          next: (respuesta: any) => {
            const estadoConfirmado = respuesta && typeof respuesta.is_active === 'boolean'
              ? respuesta.is_active
              : nuevoEstado;
            const estadoDisplayConfirmado = respuesta?.estado_display || (estadoConfirmado ? 'Activo' : 'Inactivo');

            // Criterio 8: Refresco visual inmediato y reactivo en la interfaz de usuario
            usuario.is_active = estadoConfirmado;
            usuario.estado_display = estadoDisplayConfirmado;
            if (estadoConfirmado) {
              usuario.esta_bloqueado = false;
            }

            const idx = this.usuarios.findIndex(u => Number(u.id_usuario || u.id) === Number(id));
            if (idx > -1) {
              this.usuarios[idx] = {
                ...this.usuarios[idx],
                is_active: estadoConfirmado,
                estado_display: estadoDisplayConfirmado,
                esta_bloqueado: estadoConfirmado ? false : this.usuarios[idx].esta_bloqueado
              };
            }

            if (this.usuarioDetalleModal && Number(this.usuarioDetalleModal.id_usuario || this.usuarioDetalleModal.id) === Number(id)) {
              this.usuarioDetalleModal = {
                ...this.usuarioDetalleModal,
                is_active: estadoConfirmado,
                estado_display: estadoDisplayConfirmado,
                esta_bloqueado: estadoConfirmado ? false : this.usuarioDetalleModal.esta_bloqueado
              };
              this.supervisorDetalle = this.usuarioDetalleModal;
            }

            this.actualizarUsuariosFiltrados();
            this.sweetAlert.success(
              estadoConfirmado ? 'Usuario activado' : 'Usuario inactivado',
              `El usuario ahora está ${estadoConfirmado ? 'Activo' : 'Inactivo'}.`
            );
            this.cdr.detectChanges();
          },
          error: (err) => {
            const mensajeError = this.formatearMensajeError(err);
            this.sweetAlert.error('Error al cambiar estado', mensajeError);
            this.cdr.detectChanges();
          }
        });
      });
  }

  eliminarUsuario(usuario: any): void {
    // Criterio 7: Integridad Histórica (nunca eliminar físicamente, solo alternar estado lógico)
    if (!usuario) return;
    if (usuario.is_active !== false) {
      this.toggleEstadoUsuario(usuario);
      return;
    }
    this.sweetAlert.info?.(
      'Cuenta ya inactiva',
      'Por integridad histórica las cuentas no se eliminan físicamente del sistema; esta cuenta ya se encuentra inactiva.'
    );
  }
}
