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
    if (!this.configuracion) {
      return;
    }

    const jornadasActuales = this.configuracion.jornadas ?? [];
    if (jornadasActuales.length === 0) {
      return;
    }

    const mapaCatalogo = new Map(this.jornadasDisponibles.map(j => [j.id_jornada, j]));

    // Mantener ÚNICAMENTE las jornadas autorizadas para esta sede
    this.configuracion.jornadas = jornadasActuales.map(jornadaActual => {
      const jornadaCatalogo = mapaCatalogo.get(jornadaActual.id_jornada);
      const nombre = jornadaCatalogo?.nombre_jornada || jornadaActual.nombre_jornada;

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

      let cuposJornada = Number(jornadaActual.cupos || 0);
      if (cuposJornada === 0 && jornadasActuales.length === 1 && (this.configuracion?.cupos_totales || 0) > 0) {
        cuposJornada = Number(this.configuracion?.cupos_totales || 0);
      }

      return {
        ...jornadaActual,
        nombre_jornada: nombre,
        cupos: cuposJornada,
        grados: gradosCombinados,
        habilitada: Boolean(jornadaActual.habilitada || cuposJornada > 0 || (jornadaActual.secciones && jornadaActual.secciones.length > 0)),
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
      return [];
    }

    const autorizadas = jornadas.filter((j, index, self) => index === self.findIndex(t => t.id_jornada === j.id_jornada));

    return autorizadas.map(jornada => {
      let cupos = Number(jornada.cupos || 0);
      if (cupos === 0 && autorizadas.length === 1 && (this.configuracion?.cupos_totales || 0) > 0) {
        cupos = Number(this.configuracion?.cupos_totales || 0);
      }

      return {
        ...jornada,
        cupos,
        habilitada: Boolean(jornada.habilitada || cupos > 0 || (jornada.secciones && jornada.secciones.length > 0)),
        secciones: jornada.secciones ?? [],
        grados: (jornada.grados ?? []).map(grado => ({
          id_grado: grado.id_grado,
          nombre_grado: grado.nombre_grado,
          cupos: Number(grado.cupos || 0),
        })),
      };
    });
  }

  toggleJornada(jornada: JornadaConfigurada): void {
    jornada.habilitada = !jornada.habilitada;
    if (!jornada.habilitada) {
      jornada.cupos = 0;
      jornada.grados = (jornada.grados || []).map(grado => ({ ...grado, cupos: 0 }));
    } else if (jornada.cupos === 0 && this.cuposPendientes > 0) {
      jornada.cupos = this.cuposPendientes;
    }
    this.errorValidacion = '';
    this.mensajeGuardado = '';
  }

  actualizarCupoJornada(jornada: JornadaConfigurada, valor: string | number): void {
    const numero = Number(valor || 0);
    const cuposAutorizados = Number(this.configuracion?.cupos_totales || 0);
    const nuevoValor = Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0;

    if (cuposAutorizados > 0 && nuevoValor > cuposAutorizados) {
      jornada.cupos = cuposAutorizados;
      this.errorValidacion = `No puedes asignar más de los ${cuposAutorizados} cupos autorizados para la sede.`;
    } else {
      jornada.cupos = nuevoValor;
      this.errorValidacion = '';
    }

    const sumaActual = (jornada.grados || []).reduce((sum, grado) => sum + Number(grado.cupos || 0), 0);
    if (sumaActual > jornada.cupos) {
      let restante = jornada.cupos;
      jornada.grados = (jornada.grados || []).map(grado => {
        const c = Math.min(Number(grado.cupos || 0), restante);
        restante = Math.max(0, restante - c);
        return {
          ...grado,
          cupos: c,
        };
      });
    }
    this.mensajeGuardado = '';
  }

  actualizarCupoGrado(jornada: JornadaConfigurada, grado: GradoCupo, valor: string | number): void {
    const numero = Number(valor || 0);
    const cupoDeseado = Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0;
    grado.cupos = cupoDeseado;

    const otrosGrados = (jornada.grados || []).filter(g => g.id_grado !== grado.id_grado);
    const sumaOtros = otrosGrados.reduce((sum, g) => sum + Number(g.cupos || 0), 0);
    const nuevaSuma = sumaOtros + cupoDeseado;
    const cuposAutorizados = Number(this.configuracion?.cupos_totales || 0);

    if (nuevaSuma > (jornada.cupos || 0)) {
      if (cuposAutorizados > 0 && nuevaSuma <= cuposAutorizados) {
        // Auto-incrementar los cupos de la jornada si está dentro de lo autorizado para la sede
        jornada.cupos = nuevaSuma;
        this.errorValidacion = '';
      } else if (cuposAutorizados > 0 && nuevaSuma > cuposAutorizados) {
        const maxPermitido = Math.max(0, cuposAutorizados - sumaOtros);
        grado.cupos = maxPermitido;
        jornada.cupos = cuposAutorizados;
        this.errorValidacion = `La suma de cupos por grado supera el total autorizado de la sede (${cuposAutorizados} cupos).`;
        return;
      } else if (jornada.cupos > 0) {
        const exceso = nuevaSuma - jornada.cupos;
        grado.cupos = Math.max(0, cupoDeseado - exceso);
        this.errorValidacion = `La suma de cupos por grado supera los ${jornada.cupos} cupos asignados a la jornada.`;
        return;
      }
    }

    this.errorValidacion = '';
    this.mensajeGuardado = '';
  }

  calcularSumaGrados(jornada: JornadaConfigurada): number {
    return (jornada.grados || []).reduce((sum, grado) => sum + Number(grado.cupos || 0), 0);
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
