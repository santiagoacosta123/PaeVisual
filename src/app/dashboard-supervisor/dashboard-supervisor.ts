import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, InstitucionAsignada } from '../core/auth/auth.service';
import { environment } from '../../environments/environment';

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

  instituciones: InstitucionAsignada[] = [];
  institucionActiva: InstitucionAsignada | null = null;
  cargando = true;
  errorMensaje = '';
  nombreSupervisor = '';

  ngOnInit(): void {
    const usuario = this.authService.obtenerUsuario();
    this.nombreSupervisor = usuario?.nombre ? `${usuario.nombre} ${usuario.apellido ?? ''}`.trim() : 'Supervisor PAE';

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
    }

    // 2. Consultar lista actualizada
    this.cargarInstitucionesServidor();
  }

  cargarInstitucionesServidor(): void {
    this.errorMensaje = '';
    this.http.get<any>(`${environment.apiUrl}/instituciones/`).subscribe({
      next: (resp) => {
        const lista = Array.isArray(resp) ? resp : (resp?.results ?? []);
        this.instituciones = lista.map((item: any) => ({
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

        // Si ya había una activa guardada y sigue en la lista, mantenerla;
        // pero NO forzar selección automática para que el usuario pueda elegir primero
        const activaGuardada = this.authService.obtenerInstitucionActiva();
        if (activaGuardada) {
          const encontrada = this.instituciones.find(i => i.id_institucion === activaGuardada.id_institucion);
          if (encontrada) {
            this.institucionActiva = encontrada;
          }
        }

        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar instituciones del supervisor:', err);
        if (this.instituciones.length === 0) {
          this.errorMensaje = 'No se pudieron sincronizar las instituciones con el servidor. Revisa tu conexión.';
        }
        this.cargando = false;
      }
    });
  }

  seleccionarInstitucion(inst: InstitucionAsignada): void {
    this.institucionActiva = inst;
    this.authService.establecerInstitucionActiva(inst);
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