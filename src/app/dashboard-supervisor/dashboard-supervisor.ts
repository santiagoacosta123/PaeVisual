import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, finalize, throwIfEmpty, timeout } from 'rxjs/operators';
import { AuthService, InstitucionAsignada } from '../core/auth/auth.service';
import { environment } from '../../environments/environment';
import { IMAGENES_INSTITUCION } from './imagenes-instituciones';
import { SweetAlertService } from '../core/services/sweet-alert.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-dashboard-supervisor',
  styleUrl: './dashboard-supervisor.css',
  templateUrl: './dashboard-supervisor.html',
})
export class DashboardSupervisor implements OnInit {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private alertas = inject(SweetAlertService);

  instituciones: InstitucionAsignada[] = [];
  institucionActiva: InstitucionAsignada | null = null;
  cargando = true;
  errorMensaje = '';
  nombreSupervisor = '';

  ngOnInit(): void {
    const usuario = this.authService.obtenerUsuario();
    this.nombreSupervisor = usuario?.nombre ? `${usuario.nombre} ${usuario.apellido ?? ''}`.trim() : 'Supervisor PAE';
    this.cargando = true;

    // Escuchar si viene con parámetro para cambiar de institución
    this.route.queryParams.subscribe(params => {
      if (params['cambiar'] === 'true') {
        this.deseleccionarInstitucion();
      }
    });

    // Suscripción reactiva al estado de la institución activa
    this.authService.institucionActiva$.subscribe(inst => {
      this.institucionActiva = inst;
    });

    // 1. Cargar caché inmediata
    const cacheadas = this.authService.obtenerInstitucionesSupervisor();
    if (cacheadas.length > 0) {
      this.instituciones = cacheadas;
      this.cargando = false;
    } else if (Array.isArray(usuario?.instituciones_supervisor) && usuario!.instituciones_supervisor!.length > 0) {
      this.instituciones = usuario!.instituciones_supervisor!;
    }

    // 2. Consultar lista actualizada
    this.cargarInstitucionesServidor();
  }

  /**
   * Trae del servidor las instituciones asignadas al supervisor (el backend ya filtra por supervisor).
   * Si el servidor responde, su lista reemplaza a la guardada; si falla, se deja la que ya había.
   */
  cargarInstitucionesServidor(): void {
    this.errorMensaje = '';
    const usuario = this.authService.obtenerUsuario();
    const asignadasUsuario = usuario?.instituciones_supervisor;
    if (!this.instituciones.length && Array.isArray(asignadasUsuario) && asignadasUsuario.length > 0) {
      this.instituciones = asignadasUsuario;
      this.cargando = false;
    }

    if (!this.instituciones.length) {
      this.cargando = false;
      this.cargarInstitucionesDesdePerfil(usuario?.id_usuario);
    }

    const limiteCarga = window.setTimeout(() => {
      if (!this.cargando) return;
      this.cargando = false;
      if (this.instituciones.length === 0) {
        this.errorMensaje = 'El servidor está tardando más de lo esperado. Intenta cargar las instituciones nuevamente.';
      }
    }, 12000);

    this.http.get<any>(`${environment.apiUrl}/instituciones/`).pipe(
      timeout(6000),
      throwIfEmpty(() => new Error('La respuesta de instituciones llegó vacía.')),
      catchError(err => {
        return of(null);
      }),
      finalize(() => {
        window.clearTimeout(limiteCarga);
        this.cargando = false;
      })
    ).subscribe(resp => {
      if (resp === null) {
        this.cargarInstitucionesDesdePerfil(usuario?.id_usuario);
        return;
      }

      const lista = Array.isArray(resp) ? resp : (resp?.results ?? []);
      const institucionesServidor = lista.map((item: any) => ({
        id_institucion: item.id_institucion ?? item.id,
        nombre_institucion: item.nombre_institucion ?? item.nombre,
        nit: item.nit ?? '',
        sedes: Array.isArray(item.sedes) ? item.sedes : [],
        representante_legal: item.representante_legal,
        telefono: item.telefono,
        correo_contacto: item.correo_contacto,
        estado: item.estado ?? 'ACTIVO',
        administrador_asignado: item.administrador_asignado,
      }));

      const asignadasIds = new Set(
        (asignadasUsuario ?? [])
          .map((item: InstitucionAsignada) => item.id_institucion ?? (item as any).id)
          .filter((id): id is number => id !== undefined && id !== null)
          .map((id) => Number(id))
      );

      if (asignadasIds.size > 0) {
        this.instituciones = institucionesServidor.filter((item: InstitucionAsignada) =>
          asignadasIds.has(Number(item.id_institucion))
        );
      } else if (institucionesServidor.length > 0) {
        this.instituciones = institucionesServidor;
      }

      if (this.instituciones.length === 0) {
        this.cargarInstitucionesDesdePerfil(usuario?.id_usuario);
      }

      // Solo sincronizar la institución si el usuario ya la tiene seleccionada activamente en esta sesión
      const activaGuardada = this.authService.obtenerInstitucionActiva();
      if (activaGuardada && this.institucionActiva) {
        const encontrada = this.instituciones.find(i => i.id_institucion === activaGuardada.id_institucion);
        if (encontrada) {
          this.institucionActiva = encontrada;
        } else {
          this.deseleccionarInstitucion();
        }
      }
    });
  }

  private cargarInstitucionesDesdePerfil(idUsuario?: number): void {
    if (!idUsuario) return;

    this.http.get<any>(`${environment.apiUrl}/usuarios/${idUsuario}/`).pipe(
      timeout(15000),
      catchError(() => of(null))
    ).subscribe((usuario) => {
      const asignadas = usuario?.instituciones_supervisor
        ?? usuario?.usuario?.instituciones_supervisor
        ?? usuario?.results?.instituciones_supervisor;
      if (!Array.isArray(asignadas) || asignadas.length === 0) return;

      this.instituciones = asignadas.map((item: any) => ({
        id_institucion: item.id_institucion ?? item.id,
        nombre_institucion: item.nombre_institucion ?? item.nombre,
        nit: item.nit ?? '',
        sedes: Array.isArray(item.sedes) ? item.sedes : [],
      }));
      this.errorMensaje = '';
    });
  }

  trackInstitucion = (_: number, inst: InstitucionAsignada) => inst.id_institucion;

  // Fotos de las tarjetas (vienen en imagenes-instituciones.ts). Si hay más instituciones que fotos, se repiten en orden.
  imagenDe(indice: number): string {
    return IMAGENES_INSTITUCION[indice % IMAGENES_INSTITUCION.length];
  }

  // Foto de la institución seleccionada (la misma que tenía en la lista del paso 1)
  get imagenActiva(): string {
    const id = this.institucionActiva?.id_institucion;
    const i = this.instituciones.findIndex(x => x.id_institucion === id);
    return this.imagenDe(i >= 0 ? i : 0);
  }

  seleccionarInstitucion(inst: InstitucionAsignada): void {
    this.institucionActiva = inst;
    this.authService.establecerInstitucionActiva(inst);
    // Limpiar queryParam 'cambiar' de la URL para que no deseleccione si se refresca la página
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    void this.alertas.supervisorSuccess(
      'Institución activa',
      `${inst.nombre_institucion} quedó seleccionada para continuar con el seguimiento asignado.`
    );
  }

  deseleccionarInstitucion(): void {
    this.authService.limpiarInstitucionActiva();
    this.institucionActiva = null;
  }

  irA(destino: 'entregas' | 'sedes' | 'reportes'): void {
    if (!this.institucionActiva) return;

    if (destino === 'entregas') {
      this.router.navigate(['/registrar-entrega-alimentos']);
    } else if (destino === 'sedes') {
      this.router.navigate(['/instituciones']);
    } else if (destino === 'reportes') {
      this.router.navigate(['/reportes-consumo']);
    }
  }

  get resumenSedes(): string {
    if (!this.institucionActiva?.sedes || this.institucionActiva.sedes.length === 0) {
      return 'Sin sedes registradas';
    }
    return this.institucionActiva.sedes.map((s: any) => s.nombre_sede).join(', ');
  }
}