import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
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

  instituciones: InstitucionAsignada[] = [];
  institucionActiva: InstitucionAsignada | null = null;
  cargando = true;
  errorMensaje = '';
  nombreSupervisor = '';

  ngOnInit(): void {
    const usuario = this.authService.obtenerUsuario();
    this.nombreSupervisor = usuario?.nombre ? `${usuario.nombre} ${usuario.apellido ?? ''}`.trim() : 'Supervisor PAE';

    // 1. Cargar caché inmediata si existe en la sesión
    const cacheadas = this.authService.obtenerInstitucionesSupervisor();
    if (cacheadas.length > 0) {
      this.instituciones = cacheadas;
      this.institucionActiva = this.authService.obtenerInstitucionActiva() || cacheadas[0];
      this.cargando = false;
    }

    // 2. Consultar siempre la lista actualizada al backend
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

        const activaGuardada = this.authService.obtenerInstitucionActiva();
        if (activaGuardada && this.instituciones.some(i => i.id_institucion === activaGuardada.id_institucion)) {
          this.institucionActiva = this.instituciones.find(i => i.id_institucion === activaGuardada.id_institucion) || activaGuardada;
        } else if (this.instituciones.length > 0) {
          this.seleccionarInstitucion(this.instituciones[0]);
        }

        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar instituciones del supervisor:', err);
        // Si no teníamos datos cacheados, reportar el error
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

  trabajarCon(inst: InstitucionAsignada, destino: 'entregas' | 'sedes'): void {
    this.seleccionarInstitucion(inst);
    if (destino === 'entregas') {
      this.router.navigate(['/registrar-entrega-alimentos']);
    } else {
      this.router.navigate(['/instituciones']);
    }
  }

  esActiva(inst: InstitucionAsignada): boolean {
    return !!(this.institucionActiva && this.institucionActiva.id_institucion === inst.id_institucion);
  }
}