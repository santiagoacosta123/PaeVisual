import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Subscription, catchError, of } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { environment } from '../../environments/environment';

interface SedeResumen {
  id_sede: number;
  nombre_sede: string;
  codigo_dane: string | null;
  direccion: string | null;
  telefono: string | null;
  estado: string;
  institucion_nombre: string | null;
}

interface SeccionConfigurada {
  id_seccion: number;
  nombre_seccion: string;
  estado: string | null;
}

interface GradoCupo {
  id_grado: number;
  nombre_grado: string;
  cupos: number;
}

interface JornadaConfigurada {
  id_jornada: number;
  nombre_jornada: string;
  cupos: number;
  habilitada: boolean;
  secciones: SeccionConfigurada[];
  grados: GradoCupo[];
}

interface HistorialCambio {
  id: number;
  fecha_hora: string;
  usuario: string;
  descripcion: string;
}

interface ConfiguracionSede {
  sede: SedeResumen;
  cupos_totales: number;
  jornadas: JornadaConfigurada[];
  historial?: HistorialCambio[];
}

interface JornadaCatalogo {
  id_jornada: number;
  nombre_jornada: string;
  estado?: string | null;
}

interface GradoCatalogo {
  id_grado: number;
  nombre_grado: string;
  estado?: string | null;
}

function listaDe<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === 'object') {
    const data = response as { results?: unknown; data?: unknown };
    if (Array.isArray(data.results)) return data.results as T[];
    if (Array.isArray(data.data)) return data.data as T[];
  }
  return [];
}

@Component({
  selector: 'app-sedes-administrador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sedes-administrador.html',
})
export class SedesAdministradorComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly apiUrl = `${environment.apiUrl}/sedes/`;
  private listaSubscription?: Subscription;
  private detalleSubscription?: Subscription;

  sedes: SedeResumen[] = [];
  sedeSeleccionada: SedeResumen | null = null;
  configuracion: ConfiguracionSede | null = null;
  jornadasDisponibles: JornadaCatalogo[] = [];
  gradosDisponibles: GradoCatalogo[] = [];
  cargandoSedes = false;
  cargandoDetalle = false;
  errorSedes = '';
  errorDetalle = '';
  errorValidacion = '';
  mensajeGuardado = '';

  get institucionAsignada(): string {
    const usuario = this.authService.obtenerUsuario();
    return usuario?.institucion_nombre?.trim()
      || usuario?.institucion?.trim()
      || this.sedeSeleccionada?.institucion_nombre?.trim()
      || this.sedes.find(sede => sede.institucion_nombre?.trim())?.institucion_nombre?.trim()
      || 'Institución no reportada por la cuenta';
  }

  get cuposTotalesDistribuidos(): number {
    if (!this.configuracion) return 0;
    return this.configuracion.jornadas
      .filter(j => j.habilitada)
      .reduce((sum, jornada) => sum + Number(jornada.cupos || 0), 0);
  }

  get cuposPendientes(): number {
    if (!this.configuracion) return 0;
    return Math.max((this.configuracion.cupos_totales || 0) - this.cuposTotalesDistribuidos, 0);
  }

  ngOnInit(): void {
    this.cargarJornadasDisponibles();
    this.cargarGradosDisponibles();
    this.cargarSedes();
  }

  ngOnDestroy(): void {
    this.listaSubscription?.unsubscribe();
    this.detalleSubscription?.unsubscribe();
  }

  cargarSedes(idSedeSeleccionada?: number): void {
    this.listaSubscription?.unsubscribe();
    this.cargandoSedes = true;
    this.errorSedes = '';

    this.listaSubscription = this.http.get<unknown>(this.apiUrl).pipe(
      finalize(() => {
        this.cargandoSedes = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: (response) => {
        this.sedes = listaDe<SedeResumen>(response);
        const sede = this.sedes.find(item => item.id_sede === idSedeSeleccionada);
        this.sedeSeleccionada = sede ?? null;
        if (sede) {
          this.cargarDetalle(sede);
        } else {
          this.configuracion = null;
          this.errorDetalle = '';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorSedes = 'No se pudieron cargar las sedes de tu institución.';
        this.cdr.markForCheck();
      },
    });
  }

  seleccionarSede(sede: SedeResumen): void {
    this.sedeSeleccionada = sede;
    this.cargarDetalle(sede);
  }

  actualizar(): void {
    this.mensajeGuardado = '';
    this.errorValidacion = '';
    this.cargarSedes(this.sedeSeleccionada?.id_sede);
  }

  private cargarJornadasDisponibles(): void {
    this.http.get<unknown>(`${environment.apiUrl}/jornadas/`).subscribe({
      next: (response) => {
        this.jornadasDisponibles = listaDe<JornadaCatalogo>(response).filter(jornada =>
          !jornada.estado || jornada.estado.toUpperCase() === 'ACTIVA' || jornada.estado.toUpperCase() === 'ACTIVO',
        );
        this.sincronizarJornadasConfiguradas();
      },
      error: () => {
        this.jornadasDisponibles = [];
      },
    });
  }

  private cargarGradosDisponibles(): void {
    this.http.get<unknown>(`${environment.apiUrl}/grados/`).subscribe({
      next: (response) => {
        this.gradosDisponibles = listaDe<GradoCatalogo>(response).filter(
          grado => !grado.estado || String(grado.estado).toUpperCase() === 'ACTIVO'
        );
        this.sincronizarJornadasConfiguradas();
      },
      error: () => {
        this.gradosDisponibles = [];
      },
    });
  }

  private sincronizarJornadasConfiguradas(): void {
    if (!this.configuracion || this.jornadasDisponibles.length === 0) {
      return;
    }

    const jornadasActuales = this.configuracion.jornadas ?? [];
    const mapaJornadas = new Map(jornadasActuales.map(jornada => [jornada.id_jornada, jornada]));

    this.configuracion.jornadas = this.jornadasDisponibles.map(jornadaCatalogo => {
      const jornadaActual = mapaJornadas.get(jornadaCatalogo.id_jornada) ?? {
        id_jornada: jornadaCatalogo.id_jornada,
        nombre_jornada: jornadaCatalogo.nombre_jornada,
        cupos: 0,
        habilitada: false,
        secciones: [],
        grados: [],
      };

      const gradosGuardados = jornadaActual.grados ?? [];
      const cuposPorGrado = new Map(gradosGuardados.map(g => [g.id_grado, Number(g.cupos || 0)]));
      const gradosCombinados: GradoCupo[] = this.gradosDisponibles.length > 0
        ? this.gradosDisponibles.map(gradoCatalogo => ({
            id_grado: gradoCatalogo.id_grado,
            nombre_grado: gradoCatalogo.nombre_grado,
            cupos: cuposPorGrado.get(gradoCatalogo.id_grado) ?? 0,
          }))
        : gradosGuardados;

      const idsEnCatalogo = new Set(gradosCombinados.map(g => g.id_grado));
      for (const guardado of gradosGuardados) {
        if (!idsEnCatalogo.has(guardado.id_grado) && Number(guardado.cupos || 0) > 0) {
          gradosCombinados.push({
            id_grado: guardado.id_grado,
            nombre_grado: guardado.nombre_grado,
            cupos: Number(guardado.cupos || 0),
          });
        }
      }

      return {
        ...jornadaActual,
        nombre_jornada: jornadaCatalogo.nombre_jornada,
        grados: gradosCombinados,
        habilitada: Boolean(jornadaActual.habilitada || jornadaActual.cupos > 0 || jornadaActual.secciones?.length),
      };
    });
  }

  private cargarDetalle(sede: SedeResumen, conservarMensaje = false): void {
    this.detalleSubscription?.unsubscribe();
    this.cargandoDetalle = !conservarMensaje;
    if (!conservarMensaje) {
      this.configuracion = null;
    }
    this.errorDetalle = '';
    if (!conservarMensaje) {
      this.errorValidacion = '';
      this.mensajeGuardado = '';
    }

    this.detalleSubscription = this.http.get<ConfiguracionSede>(
      `${this.apiUrl}${sede.id_sede}/configuracion/`,
    ).pipe(
      catchError(() => of({
        sede,
        cupos_totales: 0,
        jornadas: [],
        historial: [],
      } as ConfiguracionSede)),
      finalize(() => {
        this.cargandoDetalle = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: (configuracion) => {
        this.configuracion = {
          ...configuracion,
          sede,
          cupos_totales: Number(configuracion.cupos_totales || 0),
          jornadas: this.normalizarJornadas(configuracion.jornadas ?? []),
          historial: configuracion.historial ?? [],
        };
        this.sincronizarJornadasConfiguradas();
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorDetalle = 'No se pudo cargar la configuración de esta sede.';
        this.cdr.markForCheck();
      },
    });
  }

  private normalizarJornadas(jornadas: JornadaConfigurada[]): JornadaConfigurada[] {
    if (!jornadas || jornadas.length === 0) {
      return this.jornadasDisponibles.map(jornada => ({
        id_jornada: jornada.id_jornada,
        nombre_jornada: jornada.nombre_jornada,
        cupos: 0,
        habilitada: false,
        secciones: [],
        grados: this.gradosDisponibles.map(grado => ({
          id_grado: grado.id_grado,
          nombre_grado: grado.nombre_grado,
          cupos: 0,
        })),
      }));
    }

    return jornadas.map(jornada => ({
      ...jornada,
      cupos: Number(jornada.cupos || 0),
      habilitada: Boolean(jornada.habilitada || jornada.cupos > 0),
      secciones: jornada.secciones ?? [],
      grados: (jornada.grados ?? []).map(grado => ({
        id_grado: grado.id_grado,
        nombre_grado: grado.nombre_grado,
        cupos: Number(grado.cupos || 0),
      })),
    }));
  }

  toggleJornada(jornada: JornadaConfigurada): void {
    jornada.habilitada = !jornada.habilitada;
    if (!jornada.habilitada) {
      jornada.cupos = 0;
      jornada.grados = jornada.grados.map(grado => ({ ...grado, cupos: 0 }));
    }
    this.errorValidacion = '';
    this.mensajeGuardado = '';
  }

  actualizarCupoJornada(jornada: JornadaConfigurada, valor: string): void {
    const numero = Number(valor || 0);
    jornada.cupos = Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0;
    if (jornada.habilitada && jornada.cupos > 0) {
      const sumaActual = jornada.grados.reduce((sum, grado) => sum + Number(grado.cupos || 0), 0);
      if (sumaActual > jornada.cupos) {
        jornada.grados = jornada.grados.map(grado => ({
          ...grado,
          cupos: Math.min(Number(grado.cupos || 0), Math.max(0, jornada.cupos)),
        }));
      }
    }
    this.errorValidacion = '';
    this.mensajeGuardado = '';
  }

  actualizarCupoGrado(jornada: JornadaConfigurada, grado: GradoCupo, valor: string): void {
    const numero = Number(valor || 0);
    grado.cupos = Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0;
    const sumaTotal = jornada.grados.reduce((sum, item) => sum + Number(item.cupos || 0), 0);
    if (sumaTotal > (jornada.cupos || 0)) {
      const exceso = sumaTotal - (jornada.cupos || 0);
      grado.cupos = Math.max(0, grado.cupos - exceso);
    }
    this.errorValidacion = '';
    this.mensajeGuardado = '';
  }

  validarConfiguracion(): string | null {
    if (!this.configuracion) return 'No hay sede seleccionada.';

    const cuposAutorizados = Number(this.configuracion.cupos_totales || 0);
    const cuposDistribuidos = this.configuracion.jornadas
      .filter(j => j.habilitada)
      .reduce((sum, jornada) => sum + Number(jornada.cupos || 0), 0);

    if (cuposDistribuidos > cuposAutorizados) {
      return 'La suma de cupos por jornada supera el total autorizado de la sede.';
    }

    for (const jornada of this.configuracion.jornadas.filter(j => j.habilitada)) {
      if (jornada.cupos < 0) {
        return `La jornada ${jornada.nombre_jornada} no puede tener cupos negativos.`;
      }

      const totalGrados = jornada.grados.reduce((sum, grado) => sum + Number(grado.cupos || 0), 0);
      if (totalGrados > (jornada.cupos || 0)) {
        return `La suma de cupos por grado en ${jornada.nombre_jornada} supera el total autorizado.`;
      }
    }

    return null;
  }

  guardarConfiguracion(): void {
    const error = this.validarConfiguracion();
    if (error) {
      this.errorValidacion = error;
      this.mensajeGuardado = '';
      return;
    }

    if (!this.sedeSeleccionada || !this.configuracion) {
      this.errorValidacion = 'Debes seleccionar una sede antes de guardar la configuración.';
      return;
    }

    const payload = {
      id_sede: this.sedeSeleccionada.id_sede,
      cupos_totales: Number(this.configuracion.cupos_totales || 0),
      jornadas: this.configuracion.jornadas
        .filter(jornada => jornada.habilitada)
        .map(jornada => ({
          id_jornada: jornada.id_jornada,
          nombre_jornada: jornada.nombre_jornada,
          cupos: Number(jornada.cupos || 0),
          habilitada: true,
          secciones: jornada.secciones,
          grados: jornada.grados
            .filter(grado => Number(grado.cupos || 0) > 0)
            .map(grado => ({
              id_grado: grado.id_grado,
              nombre_grado: grado.nombre_grado,
              cupos: Number(grado.cupos || 0),
            })),
        })),
    };

    const url = `${this.apiUrl}${this.sedeSeleccionada.id_sede}/configuracion/`;
    const sedeActual = this.sedeSeleccionada;

    this.http.post<unknown>(url, payload).subscribe({
      next: () => {
        this.errorValidacion = '';
        this.mensajeGuardado = 'Configuración guardada correctamente. Los cupos y jornadas quedaron actualizados.';
        this.cargarDetalle(sedeActual, true);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorValidacion = this.extraerMensajeError(err);
        this.mensajeGuardado = '';
        this.cdr.markForCheck();
      },
    });
  }

  private extraerMensajeError(err: any): string {
    const body = err?.error;
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (body && typeof body === 'object') {
      for (const clave of ['jornadas', 'grados', 'cupos', 'detail', 'error', 'mensaje']) {
        const valor = body[clave];
        if (typeof valor === 'string' && valor.trim()) return valor.trim();
        if (Array.isArray(valor) && typeof valor[0] === 'string' && valor[0].trim()) {
          return valor[0].trim();
        }
      }
      for (const valor of Object.values(body)) {
        if (typeof valor === 'string' && valor.trim()) return valor.trim();
        if (Array.isArray(valor) && typeof valor[0] === 'string' && valor[0].trim()) {
          return valor[0].trim();
        }
      }
    }
    return 'No se pudo guardar la configuración. Intenta nuevamente.';
  }

  sedeEstaActiva(estado: string): boolean {
    return (estado || '').trim().toUpperCase() === 'ACTIVO';
  }
}
