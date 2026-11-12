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
  private sedesSupervisor: any[] = [];
  private sedesSupervisorCargadas = false;

  // Estado del perfil
  mostrarPerfil = false;
  vistaActual = 'perfil';

  // Estado de las notificaciones
  mostrarNotificaciones = false;
  listaNotificaciones: Notificacion[] = [];
  notificacionesNoLeidas = 0;

  // Datos del perfil y formularios
  perfil = {
    nombre: '',
    correo: '',
    rol: ''
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

  constructor(








  ) {
    // Escuchar los cambios de ruta para actualizar el título automáticamente
    this.navegacionSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.actualizarTitulo(event.urlAfterRedirects);
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
      this.esSuperAdministrador = this.authService.esSuperAdministrador(usuario.rol);
      this.esSupervisor = this.authService.esSupervisor(usuario.rol);
      this.esJefa = this.authService.esJefa(usuario.rol);
      this.esAdministrador = (this.rolUsuario === 'admin' || this.rolUsuario === 'administrador') && !this.esSuperAdministrador;
      this.esGestor = this.rolUsuario.includes('gestor');

      const rolNombre = this.esSuperAdministrador
        ? 'Super Administrador'
        : this.esSupervisor
          ? 'Supervisor (Coordinador PAE)'
          : this.esJefa
            ? 'Jefa de manipuladoras'
            : usuario.rol || 'Sin rol asignado';

      this.perfil = {
        nombre: `${usuario.nombre ?? ''} ${usuario.apellido ?? ''}`.trim() || usuario.correo,
        correo: usuario.correo,
        rol: rolNombre
      };

      this.editForm = { ...this.perfil };

      // Asignación de institución para el administrador
      this.institucionUsuario = usuario.institucion || (this.esAdministrador ? 'Institución Educativa Asignada' : '');

      // Primer ingreso con contraseña provisional (preparar vista para cuando abra su perfil)
      if (usuario.debe_cambiar_password) {
        this.vistaActual = 'password';
        this.passwordMensaje = 'Por seguridad, debes actualizar tu contraseña provisional en este primer inicio de sesión.';
      }
    }

    this.cargarNotificacionesHeader();
    this.actualizarTitulo(this.router.url);

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
      this.sedeActiva = this.authService.obtenerSedeActiva();
      this.authService.sedeActiva$.subscribe((sede) => {
        this.sedeActiva = sede;
        this.cdr.detectChanges();
      });
      this.iniciarActualizacionInstituciones();
    }

    if (this.esSuperAdministrador) {
      this.contratosService.getContratos().subscribe({
        next: (data) => {
          if (Array.isArray(data) && data.length > 0) {
            this.conteoContratos = data.length;
            this.cdr.detectChanges();
          }
        },
        error: () => {}
      });

      this.facturasService.getFacturas().subscribe({
        next: (data) => {
          if (Array.isArray(data) && data.length > 0) {
            const pendientes = data.filter((f: any) => f.estado === 'REGISTRADA').length;
            this.conteoFacturas = pendientes > 0 ? pendientes : data.length;
            this.cdr.detectChanges();
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container') && !target.closest('.user-pill-btn') && !target.closest('.notif-btn') && !target.closest('.config-btn')) {
      this.mostrarPerfil = false;
      this.mostrarNotificaciones = false;
    }
  }

  cargarNotificacionesHeader(): void {
    this.notificacionService.obtenerNotificaciones().subscribe({
      next: (data: Notificacion[]) => {
        this.listaNotificaciones = data;
        this.notificacionesNoLeidas = data.filter((n: Notificacion) => !n.leida).length;
      },
      error: () => {
        this.listaNotificaciones = [];
        this.notificacionesNoLeidas = 0;
      }
    });
  }

  toggleNotificaciones(): void {
    this.mostrarNotificaciones = !this.mostrarNotificaciones;

    if (this.mostrarNotificaciones) {
      this.mostrarPerfil = false;
      this.cargarNotificacionesHeader();
    }
  }

  togglePerfil(): void {
    this.mostrarPerfil = !this.mostrarPerfil;

    if (this.mostrarPerfil) {
      this.mostrarNotificaciones = false;
    }
  }

  marcarTodasComoLeidasDesdePanel(): void {
    this.notificacionService.marcarTodasComoLeidas().subscribe({
      next: () => this.cargarNotificacionesHeader(),
      error: (err: any) => console.error('Error al marcar todas como leídas', err)
    });
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

    if (vista === 'editar') {
      const u = this.authService.obtenerUsuario();
      this.perfilForm.patchValue({
        nombre: u?.nombre || '',
        apellido: u?.apellido || '',
      });
      this.perfilForm.markAsPristine();
      this.perfilForm.markAsUntouched();
    }
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
    void this.sweetAlert.confirm(
      '¿Cerrar sesión?',
      'Tu sesión actual finalizará.',
      'Sí, cerrar sesión'
    ).then((resultado) => {
      if (resultado.isConfirmed) {
        this.cerrarPanel();
        this.perfil = { nombre: '', correo: '', rol: '' };
        this.editForm = { ...this.perfil };
        this.institucionActiva = null;
        this.sedeActiva = null;
        this.institucionesSupervisor = [];
        this.listaNotificaciones = [];
        this.notificacionesNoLeidas = 0;
        this.authService.cerrarSesion();
      }
    });
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