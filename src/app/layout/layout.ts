import { Component, OnDestroy, OnInit, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd
} from '@angular/router';
import { filter, timeout, catchError, expand, map, reduce } from 'rxjs/operators';
import { EMPTY, interval, of, Subscription } from 'rxjs';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificacionService } from '../notificaciones/notificacion.service';
import { Notificacion } from '../notificaciones/notificacion.model';
import { AuthService, InstitucionAsignada, SedeActiva } from '../core/auth/auth.service';
import { SiraeService } from '../features/contratos/services/contratos_pae.service';
import { FacturasCompraService } from '../services/facturas-compra.service';
import { environment } from '../../environments/environment';
import { SweetAlertService } from '../core/services/sweet-alert.service';
import { ReconocimientoFacialService } from '../services/reconocimiento-facial.service';
import {
  listaSedesDePagina,
  normalizarInstitucionSupervisor,
  sedesDeInstitucion,
  urlSiguientePaginaSedes,
} from './institucion-supervisor.utils';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent implements OnInit, OnDestroy {

  // Declaración de pageTitle
  pageTitle: string = 'Panel de Control';

  // ¿El supervisor está en su pantalla de inicio?
  get enInicioSupervisor(): boolean {
    return this.esSupervisor && this.router.url.split('?')[0].startsWith('/dashboard-supervisor');
  }

  // Título de la cabecera: en el inicio del supervisor se ve "Bienvenido: <nombre>"
  get tituloEncabezado(): string {
    return this.enInicioSupervisor ? `Bienvenido: ${this.perfil.nombre}` : this.pageTitle;
  }

  get nombreSedeActiva(): string {
    if (this.sedeActiva?.nombre_sede) {
      return this.sedeActiva.nombre_sede;
    }
    const inst = this.institucionActiva;
    if (inst && Array.isArray(inst.sedes) && inst.sedes.length > 0) {
      const principal = inst.sedes.find((s: any) =>
        (s.nombre_sede || s.nombre || '').toLowerCase().includes('principal') ||
        (s.nombre_sede || s.nombre || '').toLowerCase().includes('central')
      ) || inst.sedes[0];
      return principal?.nombre_sede ?? principal?.nombre ?? 'Sede Central';
    }
    const u = this.authService.obtenerUsuario();
    if (u?.sede_nombre) return u.sede_nombre;
    return 'Sede Central';
  }

  get iniciales(): string {
    const nom = this.perfil?.nombre?.trim();
    if (!nom) return 'SA';
    const partes = nom.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) {
      return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
    }
    return nom.slice(0, 2).toUpperCase();
  }

  // Badges exclusivos de Super Administrador (valores por defecto según diseño)
  conteoContratos: number = 12;
  conteoFacturas: number = 3;

  // Control de Roles
  rolUsuario: string = '';
  esSuperAdministrador: boolean = false;
  esSupervisor: boolean = false;
  esJefa: boolean = false;
  esAdministrador: boolean = false;
  esGestor: boolean = false;
  institucionUsuario: string = '';

  // Institución Activa de Trabajo para Supervisor
  institucionActiva: InstitucionAsignada | null = null;
  sedeActiva: SedeActiva | null = null;
  institucionesSupervisor: InstitucionAsignada[] = [];
  mostrarSelectorInstitucion = false;
  errorSedesInstitucion = '';
  private navegacionSubscription?: Subscription;
  private institucionesSubscription?: Subscription;
  private sedesSubscription?: Subscription;
  private refrescoInstitucionesSubscription?: Subscription;
  private notificacionesSubscription?: Subscription;
  private sedesSupervisor: any[] = [];
  private sedesSupervisorCargadas = false;

  // Estado del perfil
  mostrarPerfil = false;
  vistaActual = 'perfil';

  // Estado de las notificaciones
  mostrarNotificaciones = false;
  listaNotificaciones: Notificacion[] = [];
  notificacionesNoLeidas = 0;
  filtroNotificaciones: 'todas' | 'no_leidas' | 'leidas' = 'todas';
  notificacionAbierta: Notificacion | null = null;
  private aperturaModalTimestamp = 0;
  toastNotificacion: Notificacion | null = null;

  // Datos del perfil y formularios
  perfil: {
    nombre: string;
    correo: string;
    rol: string;
    foto_perfil?: string | null;
    numero_documento?: string;
    institucion?: string;
    sede?: string;
  } = {
    nombre: '',
    correo: '',
    rol: '',
    foto_perfil: null,
    numero_documento: '',
    institucion: '',
    sede: ''
  };

  editForm = { ...this.perfil };

  private fb = inject(FormBuilder);
  perfilForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\-]+$/)]],
    apellido: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\-]+$/)]],
  });

  passwordForm = { actual: '', nueva: '', confirmar: '' };
  passwordProcesando = false;
  passwordError = '';
  passwordMensaje = '';

  private notificacionService = inject(NotificacionService);
  private authService = inject(AuthService);
  private contratosService = inject(SiraeService);
  private facturasService = inject(FacturasCompraService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private sweetAlert = inject(SweetAlertService);

  constructor() {
    // Escuchar los cambios de ruta para actualizar el título automáticamente
    this.navegacionSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.actualizarTitulo(event.urlAfterRedirects);
      const usuarioActualizado = this.authService.obtenerUsuario();
      if (usuarioActualizado) {
        this.perfil.foto_perfil = usuarioActualizado.foto_perfil || null;
        this.perfil.nombre = `${usuarioActualizado.nombre ?? ''} ${usuarioActualizado.apellido ?? ''}`.trim() || usuarioActualizado.correo;
      }
      if (this.esSupervisor) {
        this.cargarInstitucionesSupervisor();
        this.cargarSedesSupervisor();
      }
    });
  }

  ngOnInit(): void {
    const usuario = this.authService.obtenerUsuario();

    if (usuario) {
      // Normalizar y evaluar el rol del usuario autenticado
      this.rolUsuario = this.authService.normalizarRol(usuario.rol);
      this.esSupervisor = this.authService.esSupervisor(usuario.rol) ||
        Boolean(usuario.correo?.toLowerCase().includes('supervisor')) ||
        (Array.isArray(usuario.instituciones_supervisor) && usuario.instituciones_supervisor.length > 0);
      this.esSuperAdministrador = !this.esSupervisor && (
        this.authService.esSuperAdministrador(usuario.rol) ||
        Boolean(usuario.correo?.toLowerCase().includes('superadmin'))
      );
      this.esJefa = !this.esSupervisor && !this.esSuperAdministrador && this.authService.esJefa(usuario.rol);
      this.esAdministrador = !this.esSupervisor && !this.esSuperAdministrador && !this.esJefa;
      this.esGestor = this.rolUsuario.includes('gestor');

      const rolNombre = this.esSupervisor
        ? 'Supervisor'
        : this.esSuperAdministrador
          ? 'Super Administrador'
          : this.esJefa
            ? 'Jefa de manipuladoras'
            : 'Administrador';

      this.perfil = {
        nombre: `${usuario.nombre ?? ''} ${usuario.apellido ?? ''}`.trim() || usuario.correo,
        correo: usuario.correo,
        rol: rolNombre,
        foto_perfil: usuario.foto_perfil || null,
        numero_documento: usuario.numero_documento || 'No registrado',
        institucion: usuario.institucion_nombre || usuario.institucion || (this.esSupervisor ? 'Múltiples Instituciones (PAE)' : (this.esAdministrador ? 'Institución Educativa Asignada' : 'Ámbito Central')),
        sede: usuario.sede_nombre || ''
      };

      this.editForm = { ...this.perfil };

      // Asignación de institución para el administrador
      this.institucionUsuario = usuario.institucion || (this.esAdministrador ? 'Institución Educativa Asignada' : '');

      if (usuario.debe_cambiar_password) {
        this.passwordMensaje = 'Por seguridad, debes actualizar tu contraseña provisional en este primer inicio de sesión.';
      }
    }

    this.cargarNotificacionesHeader();
    if (this.authService.estaAutenticado?.() && this.notificacionService?.conectarWebSocket) {
      this.notificacionService.conectarWebSocket(this.authService.obtenerToken?.());
    }
    this.notificacionesSubscription = interval(1_000).subscribe(() => {
      if (this.authService.estaAutenticado?.() && !this.notificacionService?.estaWebSocketConectado?.()) {
        this.cargarNotificacionesHeader(true);
      }
    });
    if ((this.authService as any)?.usuarioActual$) {
      (this.authService as any).usuarioActual$.subscribe((usuarioActualizado: any) => {
        if (usuarioActualizado) {
          this.perfil.foto_perfil = usuarioActualizado.foto_perfil || null;
          this.perfil.nombre = `${usuarioActualizado.nombre ?? ''} ${usuarioActualizado.apellido ?? ''}`.trim() || usuarioActualizado.correo;
          this.refrescarVista();
        }
      });
    }
    if (this.notificacionService?.notificaciones$) {
      this.notificacionService.notificaciones$.subscribe((lista) => {
        if (Array.isArray(lista) && (lista.length > 0 || this.listaNotificaciones.length > 0)) {
          const filtrada = this.filtrarNotificacionesPorInstitucion(lista);
          this.listaNotificaciones = filtrada;
          this.notificacionesNoLeidas = filtrada.filter(n => !n.leida).length;
          this.refrescarVista();
        }
      });
    }
    if (this.notificacionService?.noLeidas$) {
      this.notificacionService.noLeidas$.subscribe((conteo) => {
        if (this.esAdministrador || this.esSupervisor) {
          this.notificacionesNoLeidas = this.listaNotificaciones.filter(n => !n.leida).length;
        } else {
          this.notificacionesNoLeidas = conteo;
        }
        this.refrescarVista();
      });
    }
    if (this.notificacionService?.toastActivo$) {
      this.notificacionService.toastActivo$.subscribe((toast) => {
        this.toastNotificacion = toast;
        this.refrescarVista();
      });
    }
    this.actualizarTitulo(this.router.url);

    this.sedeActiva = this.authService.obtenerSedeActiva();
    this.authService.sedeActiva$.subscribe((sede) => {
      this.sedeActiva = sede;
      this.cdr.detectChanges();
    });

    if (this.esSupervisor) {
      this.institucionesSupervisor = this.authService.obtenerInstitucionesSupervisor();
      this.institucionActiva = this.authService.obtenerInstitucionActiva();
      this.authService.institucionActiva$.subscribe((inst) => {
        const idAnterior = this.institucionActiva?.id_institucion;
        this.institucionActiva = inst;
        if (inst && Number(inst.id_institucion) !== Number(idAnterior)) {
          this.cargarSedesSupervisor();
        }
        this.cdr.detectChanges();
      });
      this.iniciarActualizacionInstituciones();
    }

    if (this.esSuperAdministrador) {
      this.contratosService.getContratos().subscribe({
        next: (data: any) => {
          const lista = Array.isArray(data) ? data : (data?.results || []);
          if (Array.isArray(lista)) {
            this.conteoContratos = lista.length;
            this.refrescarVista();
          }
        },
        error: () => {}
      });

      this.facturasService.getFacturas().subscribe({
        next: (data: any) => {
          const lista = Array.isArray(data) ? data : (data?.results || []);
          if (Array.isArray(lista)) {
            const pendientes = lista.filter((f: any) => f.estado === 'REGISTRADA').length;
            this.conteoFacturas = pendientes > 0 ? pendientes : lista.length;
            this.refrescarVista();
          }
        },
        error: () => {}
      });
    }
  }

  ngOnDestroy(): void {
    this.navegacionSubscription?.unsubscribe();
    this.institucionesSubscription?.unsubscribe();
    this.sedesSubscription?.unsubscribe();
    this.refrescoInstitucionesSubscription?.unsubscribe();
    this.notificacionesSubscription?.unsubscribe();
    this.notificacionService?.desconectarWebSocket?.();
  }

  private iniciarActualizacionInstituciones(): void {
    this.cargarInstitucionesSupervisor();
    this.cargarSedesSupervisor();
    this.refrescoInstitucionesSubscription = interval(60_000).subscribe(() => {
      this.cargarInstitucionesSupervisor();
      this.cargarSedesSupervisor();
    });
  }

  actualizarTitulo(url: string): void {
    const routeTitles: { [key: string]: string } = {
      '/inicio': 'Inicio',
      '/dashboard-supervisor': 'Panel del Supervisor',
      '/asistencia-diaria': 'Asistencia diaria',
      '/contratos': 'Contratos',
      '/usuarios': 'Usuarios',
      '/rol': 'Roles',
      '/ingredientes': 'Inventario',
      '/entradas-inventario': 'Inventario',
      '/saldos-almacen': 'Saldos de almacén',
      '/entradas-ajustes-inventario': 'Ajustes de inventario',
      '/registrar-entrega-alimentos': 'Registrar entrega de alimentos',
      '/historial-entregas': 'Entregas',
      '/entregas-tipo-mercado': 'Entregas por tipo de mercado',
      '/instituciones': 'Sedes',
      '/sedes-institucion': 'Sedes',
      '/banco-datos': 'Banco de Datos',
      '/consulta-gramajes': 'Gramajes por Sede y Jornada',
      '/crear-usuario': 'Crear Usuario',
      '/nuevo-producto': 'Nuevo Producto',
      '/reporte-inventario': 'Reporte Inventario',
      '/unidades-medida': 'Unidades de Medida',
      '/menus': 'Menús',
      '/facturas-compra': 'Facturas',
      '/bodega-central': 'Bodega Central',
      '/plantillas-maestras': 'Plantillas Maestras PAE',
      '/plantillas-operativas': 'Mis Plantillas Operativas PAE',
      '/reportes-consumo': 'Mis Plantillas Operativas PAE',
      '/notificaciones': 'Notificaciones'
    };

    if (url.includes('bodega-central') || (url.includes('facturas-compra') && url.includes('tab=bodega'))) {
      this.pageTitle = 'Bodega Central';
      this.cdr.detectChanges();
      return;
    }

    if (url.includes('facturas-compra')) {
      this.pageTitle = 'Facturas de Compra';
      this.cdr.detectChanges();
      return;
    }

    const rutaEncontrada = Object.keys(routeTitles).find(
      ruta => url.includes(ruta)
    );

    this.pageTitle = rutaEncontrada
      ? routeTitles[rutaEncontrada]
      : 'SIRAE';
    this.cdr.detectChanges();
  }

  private refrescarVista(): void {
    this.cdr.markForCheck();
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignorar si el componente aún está inicializándose o destruyéndose
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.notificacionAbierta) {
      this.cerrarNotificacionAbierta();
      return;
    }
    if (this.mostrarNotificaciones || this.mostrarPerfil || this.mostrarSelectorInstitucion) {
      this.cerrarPanel();
      this.refrescarVista();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.notificacionAbierta) {
      return;
    }
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const dentroDePanel = path.some((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const cl = node.classList;
      return (
        cl.contains('dropdown-container') ||
        cl.contains('saas-notif-dropdown') ||
        cl.contains('saas-notif-bell-btn') ||
        cl.contains('saas-notif-modal-backdrop') ||
        cl.contains('saas-notif-modal-card') ||
        cl.contains('saas-floating-toast') ||
        cl.contains('user-pill-btn') ||
        cl.contains('notif-btn') ||
        cl.contains('config-btn')
      );
    });
    if (dentroDePanel) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target || !target.isConnected) {
      return;
    }
    if (
      !target.closest('.dropdown-container') &&
      !target.closest('.saas-notif-dropdown') &&
      !target.closest('.saas-notif-bell-btn') &&
      !target.closest('.saas-notif-modal-backdrop') &&
      !target.closest('.user-pill-btn') &&
      !target.closest('.notif-btn') &&
      !target.closest('.config-btn')
    ) {
      if (this.mostrarPerfil || this.mostrarNotificaciones) {
        this.mostrarPerfil = false;
        this.mostrarNotificaciones = false;
        this.refrescarVista();
      }
    }
  }

  trackByNotificacion(index: number, notif: Notificacion): number | string {
    return notif.id_notificacion ?? notif.id ?? `${notif.titulo}-${index}`;
  }

  /**
   * Filtra las notificaciones para que el Administrador y el Supervisor
   * SOLO vean las alertas y eventos de sus instituciones y sedes asignadas,
   * excluyendo completamente notificaciones pertenecientes a otras instituciones ajenas.
   */
  filtrarNotificacionesPorInstitucion(lista: Notificacion[]): Notificacion[] {
    if (!lista || lista.length === 0) return [];
    if (!this.esAdministrador && !this.esSupervisor) {
      return lista;
    }

    const norm = (s: string) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const usuario = this.authService.obtenerUsuario();

    const otrasInstituciones = [
      'francisco jose de caldas',
      'caldas inen',
      'comercial del norte',
      'san jose',
      'don bosco',
      'inmaculada',
      'la milagrosa',
      'pedro antonio torre',
      'sagrado corazon',
      'guillermo valencia',
      'tomas cipriano'
    ];

    // ========================================================
    // CASO 1: ADMINISTRADOR INSTITUCIONAL
    // ========================================================
    if (this.esAdministrador) {
      const instUsuario = (
        this.institucionUsuario ||
        usuario?.institucion_nombre ||
        usuario?.institucion ||
        this.perfil.institucion ||
        ''
      ).trim();
      const instIdUsuario = usuario?.id_institucion;

      if (
        !instUsuario ||
        instUsuario.toLowerCase() === 'ámbito central' ||
        instUsuario.toLowerCase() === 'institución educativa asignada'
      ) {
        return lista;
      }

      const miInstNorm = norm(instUsuario);

      return lista.filter((n) => {
        const nInstId = (n as any).id_institucion;
        if (nInstId && instIdUsuario && Number(nInstId) !== Number(instIdUsuario)) {
          return false;
        }

        const texto = norm(`${n.titulo || ''} ${n.mensaje || ''}`);
        if (texto.includes(miInstNorm)) {
          return true;
        }

        for (const otra of otrasInstituciones) {
          if (!miInstNorm.includes(otra) && texto.includes(otra)) {
            return false;
          }
        }

        const matchSede = texto.match(/en sede:\s*([^,\.\n]+)/i);
        if (matchSede && matchSede[1]) {
          const sedeMencionada = matchSede[1].trim();
          if (!miInstNorm.includes(sedeMencionada) && !sedeMencionada.includes(miInstNorm)) {
            for (const otra of otrasInstituciones) {
              if (sedeMencionada.includes(otra) && !miInstNorm.includes(otra)) {
                return false;
              }
            }
          }
        }

        return true;
      });
    }

    // ========================================================
    // CASO 2: SUPERVISOR
    // ========================================================
    if (this.esSupervisor) {
      const instsSupervisor = (this.institucionesSupervisor && this.institucionesSupervisor.length > 0)
        ? this.institucionesSupervisor
        : (this.authService.obtenerInstitucionesSupervisor() || []);

      const misInstitucionesNombres = instsSupervisor.map((i) => norm(i.nombre_institucion)).filter(Boolean);
      const misInstitucionesIds = new Set(instsSupervisor.map((i) => Number(i.id_institucion)).filter(Boolean));
      const misSedesNombres = (this.sedesSupervisor || []).map((s) => norm(s.nombre_sede || s.nombre)).filter(Boolean);

      if (misInstitucionesNombres.length > 0 || misInstitucionesIds.size > 0 || misSedesNombres.length > 0) {
        return lista.filter((n) => {
          const nInstId = (n as any).id_institucion;
          if (nInstId && misInstitucionesIds.size > 0 && !misInstitucionesIds.has(Number(nInstId))) {
            return false;
          }

          const texto = norm(`${n.titulo || ''} ${n.mensaje || ''}`);

          const mencionaMiInst = misInstitucionesNombres.some((nom) => nom.length > 3 && texto.includes(nom));
          const mencionaMiSede = misSedesNombres.some((nom) => nom.length > 3 && texto.includes(nom));
          if (mencionaMiInst || mencionaMiSede) {
            return true;
          }

          for (const otra of otrasInstituciones) {
            const esMia = misInstitucionesNombres.some((nom) => nom.includes(otra));
            if (!esMia && texto.includes(otra)) {
              return false;
            }
          }

          const matchSede = texto.match(/en sede:\s*([^,\.\n]+)/i);
          if (matchSede && matchSede[1]) {
            const sedeMencionada = matchSede[1].trim();
            const esMiSede = misSedesNombres.some((s) => s.includes(sedeMencionada) || sedeMencionada.includes(s));
            const esMiInst = misInstitucionesNombres.some((i) => i.includes(sedeMencionada) || sedeMencionada.includes(i));
            if (!esMiSede && !esMiInst) {
              for (const otra of otrasInstituciones) {
                if (sedeMencionada.includes(otra)) {
                  return false;
                }
              }
            }
          }

          return true;
        });
      }
    }

    return lista;
  }

  cargarNotificacionesHeader(silent = false): void {
    this.notificacionService.obtenerNotificaciones().subscribe({
      next: (data: Notificacion[]) => {
        const dataFiltrada = this.filtrarNotificacionesPorInstitucion(data);
        const previosPorId = new Map<number | string, Notificacion>();
        for (const prev of this.listaNotificaciones) {
          const key = prev.id ?? prev.id_notificacion;
          if (key !== undefined) previosPorId.set(key, prev);
        }
        const nuevasSinLeer = dataFiltrada.filter(n => !n.leida && !previosPorId.has(n.id ?? n.id_notificacion ?? ''));

        // Preservar referencias cuando no cambiaron para no destruir nodos DOM durante un clic
        this.listaNotificaciones = dataFiltrada.map((item) => {
          const key = item.id ?? item.id_notificacion;
          const existente = key !== undefined ? previosPorId.get(key) : undefined;
          if (existente && existente.leida === item.leida && existente.titulo === item.titulo && existente.mensaje === item.mensaje) {
            return existente;
          }
          return item;
        });
        this.notificacionesNoLeidas = this.listaNotificaciones.filter((n: Notificacion) => !n.leida).length;

        // Si llegó una nueva notificación sin leer en sondeo suave, mostrar el Toast emergente
        if (silent && nuevasSinLeer.length > 0 && previosPorId.size > 0) {
          const masReciente = nuevasSinLeer[0];
          this.notificacionService.mostrarToast(masReciente);
        }
        this.refrescarVista();
      },
      error: () => {
        if (!silent) {
          this.listaNotificaciones = [];
          this.notificacionesNoLeidas = 0;
          this.refrescarVista();
        }
      }
    });
  }

  toggleNotificaciones(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.mostrarNotificaciones = !this.mostrarNotificaciones;

    if (this.mostrarNotificaciones) {
      this.mostrarPerfil = false;
      this.mostrarSelectorInstitucion = false;
      this.cargarNotificacionesHeader(true);
    }
    this.refrescarVista();
  }

  // Abre/cierra el desplegable de perfil (usado por el Administrador institucional)
  togglePerfil(): void {
    this.mostrarPerfil = !this.mostrarPerfil;

    if (this.mostrarPerfil) {
      this.mostrarNotificaciones = false;
      this.mostrarSelectorInstitucion = false;
      this.irA('perfil');
    }
  }

  marcarTodasComoLeidasDesdePanel(event?: MouseEvent): void {
    event?.stopPropagation();
    this.listaNotificaciones = this.listaNotificaciones.map(n => ({ ...n, leida: true }));
    this.notificacionesNoLeidas = 0;
    this.refrescarVista();

    this.notificacionService.marcarTodasComoLeidas().subscribe({
      next: () => this.cargarNotificacionesHeader(true),
      error: (err: any) => console.error('Error al marcar todas como leídas', err)
    });
  }

  get notificacionesFiltradas(): Notificacion[] {
    const lista = this.filtrarNotificacionesPorInstitucion(this.listaNotificaciones);
    if (this.filtroNotificaciones === 'no_leidas') {
      return lista.filter(n => !n.leida);
    }
    if (this.filtroNotificaciones === 'leidas') {
      return lista.filter(n => n.leida);
    }
    return lista;
  }

  get notificacionesLeidas(): number {
    return this.listaNotificaciones.filter(n => n.leida).length;
  }

  cambiarFiltroNotificaciones(filtro: 'todas' | 'no_leidas' | 'leidas', event?: MouseEvent): void {
    event?.stopPropagation();
    this.filtroNotificaciones = filtro;
    this.refrescarVista();
  }

  /** Abre la notificación en un modal sin salir de la pantalla actual. */
  abrirNotificacion(notif: Notificacion, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.aperturaModalTimestamp = Date.now();
    this.notificacionAbierta = notif;
    this.mostrarNotificaciones = false;
    this.refrescarVista();
  }

  /** Abre la notificación desde el toast flotante sin sacar al usuario de su pantalla. */
  abrirNotificacionDesdeToast(notif: Notificacion, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.aperturaModalTimestamp = Date.now();
    this.notificacionService.cerrarToast?.();
    this.toastNotificacion = null;
    this.notificacionAbierta = notif;
    this.mostrarNotificaciones = false;
    this.refrescarVista();
  }

  /** Evita que un doble clic o tap rápido en la esquina cierre el modal recién abierto. */
  cerrarNotificacionDesdeBackdrop(event?: MouseEvent): void {
    event?.stopPropagation();
    if (Date.now() - this.aperturaModalTimestamp < 450) {
      return;
    }
    this.cerrarNotificacionAbierta();
  }

  /** Cierra el detalle, marca como leída y regresa al desplegable de historial (Todas / No leídas / Leídas). */
  volverAListaNotificaciones(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    const notif = this.notificacionAbierta;
    this.notificacionAbierta = null;
    if (notif && !notif.leida) {
      this.marcarNotificacionLeida(notif);
    }
    this.mostrarNotificaciones = true;
    this.refrescarVista();
  }

  /** Al cerrar el detalle, la notificación pasa a leídas para quedar en el historial. */
  cerrarNotificacionAbierta(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    const notif = this.notificacionAbierta;
    this.notificacionAbierta = null;
    if (notif && !notif.leida) {
      this.marcarNotificacionLeida(notif);
    }
    this.refrescarVista();
  }

  /** Permite regresar una notificación leída al estado "No leída" y cerrar el detalle. */
  dejarComoNoLeidaYCerrar(): void {
    const notif = this.notificacionAbierta;
    this.notificacionAbierta = null;
    if (notif && notif.leida) {
      this.marcarNotificacionNoLeida(notif);
    }
    this.refrescarVista();
  }

  private marcarNotificacionLeida(notif: Notificacion): void {
    const id = notif.id ?? notif.id_notificacion;
    notif.leida = true;
    this.listaNotificaciones = this.listaNotificaciones.map(n =>
      (n.id ?? n.id_notificacion) === id ? { ...n, leida: true } : n
    );
    this.notificacionesNoLeidas = this.listaNotificaciones.filter(n => !n.leida).length;
    this.refrescarVista();

    if (id && this.notificacionService.marcarComoLeida) {
      this.notificacionService.marcarComoLeida(id).subscribe({
        next: () => this.refrescarVista(),
        error: (err: any) => console.error('Error al marcar como leída', err)
      });
    }
  }

  private marcarNotificacionNoLeida(notif: Notificacion): void {
    const id = notif.id ?? notif.id_notificacion;
    notif.leida = false;
    this.listaNotificaciones = this.listaNotificaciones.map(n =>
      (n.id ?? n.id_notificacion) === id ? { ...n, leida: false } : n
    );
    this.notificacionesNoLeidas = this.listaNotificaciones.filter(n => !n.leida).length;
    this.refrescarVista();

    if (id && this.notificacionService.marcarComoNoLeida) {
      this.notificacionService.marcarComoNoLeida(id).subscribe({
        next: () => this.refrescarVista(),
        error: (err: any) => console.error('Error al marcar como no leída', err)
      });
    }
  }

  verHistorialNotificaciones(event?: MouseEvent): void {
    event?.stopPropagation();
    this.mostrarNotificaciones = false;
    this.refrescarVista();
    void this.router.navigateByUrl('/notificaciones');
  }

  /** Calcula una ruta válida y permitida según el rol actual (evita redirecciones a /login o bloqueos de guard). */
  obtenerRutaSeguraNotificacion(notif: Notificacion | null): string | null {
    if (!notif) return null;

    const texto = ((notif.titulo || '') + ' ' + (notif.mensaje || '')).toLowerCase();
    const cat = (notif.categoria || '').toLowerCase();
    const matchRem = (notif.mensaje || '').match(/#?(REM-[\w\-]+|ENT-[\w\-]+)/i)
      || (notif.titulo || '').match(/#?(REM-[\w\-]+|ENT-[\w\-]+)/i);
    const remisionDoc = matchRem ? matchRem[1] : '';

    if (texto.includes('factura') || texto.includes('bodega central') || texto.includes('abastecid')) {
      if (this.esSuperAdministrador) return '/facturas-compra';
      if (this.esSupervisor || this.esAdministrador) return '/saldos-almacen';
      return null;
    }

    if (texto.includes('recepci') || texto.includes('remisi') || cat.includes('entrega') || texto.includes('despacho')) {
      if (this.esSupervisor && (texto.includes('despachad') || texto.includes('programado'))) {
        return '/registrar-entrega-alimentos';
      }
      if (this.esSupervisor || this.esAdministrador || this.esSuperAdministrador) {
        return remisionDoc
          ? '/historial-entregas?buscar=' + encodeURIComponent(remisionDoc) + '&modo=facturas'
          : '/historial-entregas';
      }
      return null;
    }

    if (texto.includes('stock') || texto.includes('insumo') || cat.includes('inventario')) {
      if (this.esAdministrador) return '/ingredientes';
      if (this.esSuperAdministrador) return '/bodega-central';
      if (this.esSupervisor) return '/saldos-almacen';
      return null;
    }

    if (cat.includes('contrato') || texto.includes('contrato')) {
      return this.esSuperAdministrador ? '/contratos' : null;
    }

    if (cat.includes('asistencia') || texto.includes('asistencia')) {
      if (this.esJefa) return '/asistencia-diaria';
      return '/reportes-consumo';
    }

    if (cat.includes('menu') || texto.includes('minuta')) {
      if (this.esSuperAdministrador || this.esSupervisor || this.esJefa) return '/menus';
      return null;
    }

    return null;
  }

  /** Navegación opcional desde el detalle (botón "Ir al módulo"). */
  irDesdeNotificacionAbierta(): void {
    const notif = this.notificacionAbierta;
    if (!notif) return;
    this.notificacionAbierta = null;
    this.hacerClicNotificacion(notif);
  }

  hacerClicNotificacion(notif: Notificacion): void {
    if (!notif.leida) {
      this.marcarNotificacionLeida(notif);
    }

    this.mostrarNotificaciones = false;

    const ruta = this.obtenerRutaSeguraNotificacion(notif);
    if (ruta) {
      void this.router.navigateByUrl(ruta);
    }
  }

  cerrarToast(): void {
    this.notificacionService.cerrarToast();
  }

  tiempoRelativo(fecha?: string): string {
    return this.notificacionService.tiempoRelativo(fecha);
  }

  obtenerIconoNotificacion(notif: Notificacion): { icono: string; color: string; bg: string } {
    const texto = ((notif.titulo || '') + ' ' + (notif.mensaje || '')).toLowerCase();
    const cat = (notif.categoria || '').toLowerCase();
    const prio = (notif.prioridad || '').toLowerCase();

    if (prio === 'critica' || prio === 'alta' || texto.includes('alerta') || texto.includes('novedad') || texto.includes('rechazad')) {
      return { icono: 'warning', color: '#ef4444', bg: '#fee2e2' };
    }
    if (texto.includes('factura') || texto.includes('bodega')) {
      return { icono: 'warehouse', color: '#7a5a0b', bg: '#fdf3d7' };
    }
    if (texto.includes('aceptad') || texto.includes('conforme') || texto.includes('acreditad')) {
      return { icono: 'check_circle', color: '#2B5424', bg: '#eaf2e8' };
    }
    if (cat.includes('entrega') || texto.includes('despacho') || texto.includes('remisi') || texto.includes('tránsito') || texto.includes('transito') || texto.includes('entrega')) {
      return { icono: 'local_shipping', color: '#7a5a0b', bg: '#fdf3d7' };
    }
    if (cat.includes('contrato') || texto.includes('contrato')) {
      return { icono: 'description', color: '#8b5cf6', bg: '#ede9fe' };
    }
    if (cat.includes('menu') || texto.includes('minuta')) {
      return { icono: 'restaurant_menu', color: '#2B5424', bg: '#eaf2e8' };
    }
    if (cat.includes('asistencia') || texto.includes('asistencia')) {
      return { icono: 'fact_check', color: '#2B5424', bg: '#eaf2e8' };
    }
    return { icono: 'notifications', color: '#3b82f6', bg: '#eff6ff' };
  }

  cargarInstitucionesSupervisor(): void {
    this.institucionesSubscription?.unsubscribe();
    this.institucionesSubscription = this.http.get<any>(`${environment.apiUrl}/instituciones/`).pipe(
      timeout(20000),
      catchError(() => of(null))
    ).subscribe({
      next: (resp) => {
        const lista = resp === null ? [] : (Array.isArray(resp) ? resp : (resp?.results ?? []));
        if (lista.length > 0) {
          this.institucionesSupervisor = lista
            .map((item: any) => {
              const id = item.id_institucion ?? item.id;
              const respaldo = this.institucionesSupervisor.find(
                institucion => Number(institucion.id_institucion) === Number(id)
              ) ?? (Number(this.institucionActiva?.id_institucion) === Number(id)
                ? this.institucionActiva ?? undefined
                : undefined);
              return normalizarInstitucionSupervisor(
                item,
                respaldo,
                this.sedesSupervisorCargadas,
                this.sedesSupervisor,
              );
            })
            .filter((item: InstitucionAsignada) => !item.estado || item.estado.toUpperCase() === 'ACTIVO');
          try {
            localStorage.setItem('sirae_instituciones_supervisor', JSON.stringify(this.institucionesSupervisor));
          } catch {}
          this.sincronizarInstitucionActiva(true);
          this.cdr.detectChanges();
          return;
        }

        this.cargarInstitucionesDesdePerfil();
      },
      error: () => this.cargarInstitucionesDesdePerfil()
    });
  }

  private cargarSedesSupervisor(): void {
    this.sedesSubscription?.unsubscribe();
    this.sedesSubscription = this.http.get<unknown>(`${environment.apiUrl}/sedes/`).pipe(
      timeout(20000),
      expand((respuesta) => {
        const siguiente = urlSiguientePaginaSedes(respuesta, environment.apiUrl);
        return siguiente
          ? this.http.get<unknown>(siguiente).pipe(timeout(20000))
          : EMPTY;
      }),
      map(listaSedesDePagina),
      reduce((sedes, pagina) => sedes.concat(pagina), [] as any[]),
      catchError((error) => {
        console.error('No se pudieron actualizar las sedes de la institución:', error);
        this.errorSedesInstitucion = 'No se pudieron actualizar las sedes. Se conserva la última información disponible.';
        this.cdr.detectChanges();
        return of(null);
      })
    ).subscribe((sedes) => {
      if (sedes === null) return;

      this.errorSedesInstitucion = '';
      this.sedesSupervisor = sedes;
      this.sedesSupervisorCargadas = true;
      this.institucionesSupervisor = this.institucionesSupervisor.map((institucion) => ({
        ...institucion,
        sedes: sedesDeInstitucion(this.sedesSupervisor, institucion.id_institucion),
      }));
      this.sincronizarInstitucionActiva();
      this.cdr.detectChanges();
    });
  }

  private sincronizarInstitucionActiva(limpiarSiNoExiste = false): void {
    const activa = this.authService.obtenerInstitucionActiva() ?? this.institucionActiva;
    if (!activa) return;

    const actualizada = this.institucionesSupervisor.find(
      institucion => Number(institucion.id_institucion) === Number(activa.id_institucion)
    );
    if (!actualizada) {
      if (limpiarSiNoExiste) {
        this.institucionActiva = null;
        this.authService.limpiarInstitucionActiva();
      }
      return;
    }

    this.institucionActiva = actualizada;
    this.authService.actualizarInstitucionActiva(actualizada);
  }

  private cargarInstitucionesDesdePerfil(): void {
    const usuario = this.authService.obtenerUsuario();
    if (!usuario?.id_usuario) {
      return;
    }

    this.http.get<any>(`${environment.apiUrl}/usuarios/${usuario.id_usuario}/`).pipe(
      timeout(15000),
      catchError(() => of(null))
    ).subscribe((perfil) => {
      const asignadas = perfil?.instituciones_supervisor;
      if (!Array.isArray(asignadas)) {
        return;
      }

      this.institucionesSupervisor = asignadas
        .map((item: any) => {
          const id = item.id_institucion ?? item.id;
          const respaldo = this.institucionesSupervisor.find(
            institucion => Number(institucion.id_institucion) === Number(id)
          );
          return normalizarInstitucionSupervisor(
            item,
            respaldo,
            this.sedesSupervisorCargadas,
            this.sedesSupervisor,
          );
        })
        .filter((item: InstitucionAsignada) => !item.estado || item.estado.toUpperCase() === 'ACTIVO');
      try {
        localStorage.setItem('sirae_instituciones_supervisor', JSON.stringify(this.institucionesSupervisor));
      } catch {}
      this.sincronizarInstitucionActiva(true);
      this.cdr.detectChanges();
    });
  }

  cambiarInstitucion(): void {
    const nombreActual = this.institucionActiva?.nombre_institucion;
    this.authService.limpiarInstitucionActiva();
    this.institucionActiva = null;
    this.mostrarSelectorInstitucion = false;
    if (nombreActual) {
      void this.sweetAlert.info(
        'Selección de institución reiniciada',
        `Puedes volver a seleccionar una institución. ${nombreActual} quedó disponible en el listado.`
      );
    }
    this.router.navigate(['/dashboard-supervisor'], { queryParams: { cambiar: 'true' } });
    this.cdr.detectChanges();
  }

  toggleSelectorInstitucion(): void {
    this.mostrarSelectorInstitucion = !this.mostrarSelectorInstitucion;
    if (this.mostrarSelectorInstitucion) {
      this.mostrarPerfil = false;
      this.mostrarNotificaciones = false;
    }
  }

  seleccionarInstitucionSupervisor(inst: InstitucionAsignada): void {
    this.authService.establecerInstitucionActiva(inst);
    this.institucionActiva = inst;
    this.mostrarSelectorInstitucion = false;
    this.cdr.detectChanges();
    void this.sweetAlert.supervisorSuccess(
      'Institución seleccionada',
      `${inst.nombre_institucion} quedó activa para supervisar entregas, sedes e historial.`
    );
    void this.router.navigate(['/dashboard-supervisor']);
  }

  cerrarPanel(): void {
    this.mostrarPerfil = false;
    this.mostrarNotificaciones = false;
    this.mostrarSelectorInstitucion = false;
  }

  irA(vista: string): void {
    this.vistaActual = vista;
    this.passwordError = '';
    this.passwordMensaje = '';

    if (vista === 'perfil' || vista === 'editar') {
      const u = this.authService.obtenerUsuario();
      if (u) {
        this.perfilForm.patchValue({
          nombre: u.nombre || '',
          apellido: u.apellido || '',
        });
        this.perfilForm.markAsPristine();
        this.perfilForm.markAsUntouched();
      }
    }
    this.cdr.detectChanges();
  }

  guardarPerfil(): void {
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      void this.sweetAlert.warning('Datos inválidos', 'El nombre y apellido deben tener al menos 2 letras válidas.');
      return;
    }

    const { nombre, apellido } = this.perfilForm.value;
    this.authService.actualizarPerfil({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
    }).subscribe({
      next: (usuarioActualizado) => {
        const nom = usuarioActualizado.nombre ?? nombre.trim();
        const ape = usuarioActualizado.apellido ?? apellido.trim();
        this.perfil.nombre = `${nom} ${ape}`.trim();
        this.vistaActual = 'perfil';
        void this.sweetAlert.success('Perfil actualizado', 'Tus datos se guardaron correctamente.');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        const mensaje = err.error?.nombre?.[0]
          || err.error?.apellido?.[0]
          || err.error?.detail
          || 'No fue posible guardar los datos.';
        void this.sweetAlert.error('No se pudo actualizar el perfil', mensaje);
      }
    });
  }

  guardarPassword(): void {
    this.passwordError = '';
    this.passwordMensaje = '';

    if (!this.passwordForm.actual || !this.passwordForm.nueva || !this.passwordForm.confirmar) {
      this.passwordError = 'Por favor completa todos los campos.';
      void this.sweetAlert.supervisorWarning('Completa todos los campos', 'Debes ingresar la contraseña actual y confirmar la nueva.');
      return;
    }
    if (this.passwordForm.nueva !== this.passwordForm.confirmar) {
      this.passwordError = 'Las nuevas contraseñas no coinciden.';
      void this.sweetAlert.supervisorWarning('Contraseñas diferentes', 'La nueva contraseña y su confirmación deben coincidir.');
      return;
    }

    this.passwordProcesando = true;
    this.authService.cambiarContrasena({
      password_actual: this.passwordForm.actual,
      nueva_password: this.passwordForm.nueva,
      confirmar_password: this.passwordForm.confirmar,
    }).subscribe({
      next: (response: any) => {
        this.passwordProcesando = false;
        this.passwordMensaje = response.mensaje || 'Contraseña actualizada correctamente.';
        this.passwordForm = { actual: '', nueva: '', confirmar: '' };
        this.cdr.detectChanges();
        void this.sweetAlert.supervisorSuccess('Contraseña actualizada', this.passwordMensaje);
        setTimeout(() => this.vistaActual = 'perfil', 1200);
      },
      error: (err: any) => {
        this.passwordProcesando = false;
        this.passwordError = err.error?.error
          || err.error?.detail
          || 'No fue posible actualizar la contraseña. Inténtalo nuevamente.';
        this.cdr.detectChanges();
        void this.sweetAlert.supervisorError('No se pudo cambiar la contraseña', this.passwordError);
      }
    });
  }

  configurar(): void {
    console.log('Navegando a configuración general');
  }

  cerrarSesion(): void {
    this.notificacionService?.desconectarWebSocket?.();
    this.cerrarPanel();
    this.perfil = { nombre: '', correo: '', rol: '', foto_perfil: null };
    this.editForm = { ...this.perfil };
    this.institucionActiva = null;
    this.sedeActiva = null;
    this.institucionesSupervisor = [];
    this.listaNotificaciones = [];
    this.notificacionesNoLeidas = 0;
    this.authService.cerrarSesion();
  }

  get tieneSedes(): boolean {
    if (!this.institucionActiva) return false;
    if (Array.isArray(this.institucionActiva.sedes)) {
      return this.institucionActiva.sedes.length > 0;
    }
    const encontrada = this.institucionesSupervisor.find(
      i => i.id_institucion === this.institucionActiva?.id_institucion
    );
    if (encontrada && Array.isArray(encontrada.sedes)) {
      return encontrada.sedes.length > 0;
    }
    return false;
  }

  get nombreAdministradorInstitucion(): string {
    const administrador = this.institucionActiva?.administrador_asignado;
    if (typeof administrador === 'string') {
      return administrador.trim() || 'Sin asignar';
    }
    if (!administrador || typeof administrador !== 'object') {
      return 'Sin asignar';
    }

    const nombreCompleto = String(administrador.nombre_completo ?? '').trim();
    const nombre = String(administrador.nombre ?? '').trim();
    const apellido = String(administrador.apellido ?? '').trim();
    return nombreCompleto || [nombre, apellido].filter(Boolean).join(' ') || 'Sin asignar';
  }

  get nombresSedesInstitucion(): string[] {
    return (this.institucionActiva?.sedes ?? [])
      .map((sede: any) => typeof sede === 'string'
        ? sede.trim()
        : String(sede?.nombre_sede ?? sede?.nombre ?? '').trim())
      .filter((nombre: string) => nombre.length > 0);
  }
}