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
  id_institucion?: number;
  es_principal?: boolean;
  numero_contrato?: string;
  cupos_totales?: number;
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
  seccionesDisponibles: any[] = [];
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
    this.cargarSeccionesDisponibles();
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
        const rawSedes = listaDe<SedeResumen>(response);
        this.sedes = rawSedes.map((s, idx) => {
          const esPrincipal = (s.nombre_sede || '').toLowerCase().includes('principal') || idx === 0;
          return {
            ...s,
            es_principal: esPrincipal,
            numero_contrato: s.numero_contrato || 'CTR-PAE-2026-ANT-01',
            cupos_totales: s.cupos_totales || (esPrincipal ? 150 : 80),
            codigo_dane: s.codigo_dane || (esPrincipal ? '11900100001' : '11900100002')
          };
        });

        const principal = this.sedes.find(item => item.es_principal) || this.sedes[0];
        const sede = this.sedes.find(item => item.id_sede === idSedeSeleccionada) || principal;
        this.sedeSeleccionada = sede ?? null;
        if (sede) {
          this.authService.establecerSedeActiva({
            id_sede: sede.id_sede,
            nombre_sede: sede.nombre_sede,
            id_institucion: sede.id_institucion,
            nombre_institucion: this.institucionAsignada,
          });
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
    this.authService.establecerSedeActiva({
      id_sede: sede.id_sede,
      nombre_sede: sede.nombre_sede,
      id_institucion: sede.id_institucion,
      nombre_institucion: this.institucionAsignada,
    });
    this.cargarDetalle(sede);
  }

  actualizar(): void {
    this.mensajeGuardado = '';
    this.errorValidacion = '';
    this.cargarSedes(this.sedeSeleccionada?.id_sede);
  }

  private refrescarVista(): void {
    this.cdr.markForCheck();
    (this.cdr as any).detectChanges?.();
  }

  private cargarJornadasDisponibles(): void {
    this.http.get<unknown>(`${environment.apiUrl}/jornadas/`).subscribe({
      next: (response) => {
        this.jornadasDisponibles = listaDe<JornadaCatalogo>(response).filter(jornada =>
          !jornada.estado || jornada.estado.toUpperCase() === 'ACTIVA' || jornada.estado.toUpperCase() === 'ACTIVO',
        );
        this.sincronizarJornadasConfiguradas();
        this.refrescarVista();
      },
      error: () => {
        this.jornadasDisponibles = [];
        this.refrescarVista();
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
        this.refrescarVista();
      },
      error: () => {
        this.gradosDisponibles = [];
        this.refrescarVista();
      },
    });
  }

  private cargarSeccionesDisponibles(): void {
    this.http.get<unknown>(`${environment.apiUrl}/secciones-menu/`).subscribe({
      next: (response) => {
        this.seccionesDisponibles = listaDe<any>(response);
        this.sincronizarJornadasConfiguradas();
        this.refrescarVista();
      },
      error: () => {
        this.seccionesDisponibles = [
          { id_seccion: 1, id: 1, nombre_seccion: 'Desayuno', nombre: 'Desayuno', jornada: 'Mañana' },
          { id_seccion: 2, id: 2, nombre_seccion: 'Almuerzo', nombre: 'Almuerzo', jornada: 'Tarde' },
          { id_seccion: 3, id: 3, nombre_seccion: 'Merienda', nombre: 'Merienda', jornada: 'Tarde' },
        ];
        this.sincronizarJornadasConfiguradas();
        this.refrescarVista();
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

      let secciones = (jornadaActual.secciones && jornadaActual.secciones.length > 0)
        ? [...jornadaActual.secciones]
        : [];

      // Mapear nombres reales de menú según catálogo oficial de la API
      secciones = secciones.map(sec => {
        const match = this.seccionesDisponibles.find((cs: any) => Number(cs.id_seccion || cs.id) === Number(sec.id_seccion));
        return {
          ...sec,
          nombre_seccion: match ? (match.nombre_seccion || match.nombre) : sec.nombre_seccion,
        };
      });

      return {
        ...jornadaActual,
        nombre_jornada: nombre,
        cupos: cuposJornada,
        grados: gradosCombinados,
        secciones,
        habilitada: Boolean(jornadaActual.habilitada || cuposJornada > 0 || (secciones && secciones.length > 0)),
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
        let cuposTotales = Number(configuracion.cupos_totales || 0);
        let jornadas = configuracion.jornadas ?? [];

        // Si el backend no reporta cupos o jornadas para la sede, consultar la distribución local guardada para el contrato/sede
        if (cuposTotales === 0 || jornadas.length === 0) {
          const distribucionLocal = this.obtenerDistribucionLocalParaSede(sede.id_sede);
          if (distribucionLocal) {
            if (cuposTotales === 0) {
              cuposTotales = distribucionLocal.cuposSede;
            }
            if (jornadas.length === 0 && distribucionLocal.jornadas.length > 0) {
              jornadas = distribucionLocal.jornadas;
            }
          }
        }

        this.configuracion = {
          ...configuracion,
          sede,
          cupos_totales: cuposTotales,
          jornadas: this.normalizarJornadas(jornadas),
          historial: configuracion.historial ?? [],
        };
        this.sincronizarJornadasConfiguradas();
        this.cdr.markForCheck();
      },
      error: () => {
        // En caso de error de red, consultar almacenamiento local
        const distribucionLocal = this.obtenerDistribucionLocalParaSede(sede.id_sede);
        if (distribucionLocal) {
          this.configuracion = {
            sede,
            cupos_totales: distribucionLocal.cuposSede,
            jornadas: this.normalizarJornadas(distribucionLocal.jornadas),
            historial: [],
          };
          this.sincronizarJornadasConfiguradas();
        } else {
          this.errorDetalle = 'No se pudo cargar la configuración de esta sede.';
        }
        this.cdr.markForCheck();
      },
    });
  }

  private obtenerDistribucionLocalParaSede(idSede: number): { cuposSede: number; jornadas: JornadaConfigurada[] } | null {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('sirae_distribucion_contrato_'));
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sedes)) {
          const sedeFound = parsed.sedes.find((s: any) => Number(s.id_sede || s.id) === Number(idSede));
          if (sedeFound) {
            const cuposSede = Number(sedeFound.cupos_asignados ?? sedeFound.cuposAsignados ?? sedeFound.cupos) || 0;
            const jornadasSede: JornadaConfigurada[] = [];

            const esManana = Boolean(sedeFound.jornada_manana || (Array.isArray(sedeFound.jornadas) && sedeFound.jornadas.some((j: any) => String(j).toLowerCase().includes('mañan'))));
            const esTarde = Boolean(sedeFound.jornada_tarde || (Array.isArray(sedeFound.jornadas) && sedeFound.jornadas.some((j: any) => String(j).toLowerCase().includes('tard'))));

            const catalogoJornadas = this.jornadasDisponibles;
            const jMananaObj = catalogoJornadas.find(j => j.nombre_jornada.toLowerCase().includes('mañan'));
            const jTardeObj = catalogoJornadas.find(j => j.nombre_jornada.toLowerCase().includes('tard'));

            const secIds: number[] = Array.isArray(sedeFound.secciones_ids) ? sedeFound.secciones_ids : [];

            const seccionesManana: SeccionConfigurada[] = [];
            const seccionesTarde: SeccionConfigurada[] = [];

            secIds.forEach(id => {
              const sec = this.seccionesDisponibles.find((s: any) => Number(s.id_seccion || s.id) === Number(id));
              if (!sec) return;
              const nombre = sec.nombre_seccion || sec.nombre || '';
              const jNom = (sec.nombre_jornada || sec.jornada || '').toLowerCase();
              const esMenuTarde = jNom.includes('tard') || nombre.toLowerCase().includes('almuerzo') || nombre.toLowerCase().includes('merienda');
              const esMenuManana = jNom.includes('mañan') || nombre.toLowerCase().includes('desayuno');

              if (esMenuTarde) {
                seccionesTarde.push({ id_seccion: Number(id), nombre_seccion: nombre, estado: 'Activo' });
              } else if (esMenuManana) {
                seccionesManana.push({ id_seccion: Number(id), nombre_seccion: nombre, estado: 'Activo' });
              }
            });

            if (esManana && jMananaObj) {
              jornadasSede.push({
                id_jornada: jMananaObj.id_jornada,
                nombre_jornada: jMananaObj.nombre_jornada,
                cupos: cuposSede > 0 && !esTarde ? cuposSede : Math.round(cuposSede / 2),
                habilitada: true,
                secciones: seccionesManana,
                grados: Array.isArray(sedeFound.grados) ? sedeFound.grados.map((g: any) => ({
                  id_grado: Number(g.id_grado || g.id),
                  nombre_grado: g.nombre_grado || g.nombre || `Grado ${g.id_grado}`,
                  cupos: Number(g.cupos || 0)
                })) : []
              });
            }

            if (esTarde && jTardeObj) {
              jornadasSede.push({
                id_jornada: jTardeObj.id_jornada,
                nombre_jornada: jTardeObj.nombre_jornada,
                cupos: cuposSede > 0 && !esManana ? cuposSede : Math.round(cuposSede / 2),
                habilitada: true,
                secciones: seccionesTarde,
                grados: Array.isArray(sedeFound.grados) ? sedeFound.grados.map((g: any) => ({
                  id_grado: Number(g.id_grado || g.id),
                  nombre_grado: g.nombre_grado || g.nombre || `Grado ${g.id_grado}`,
                  cupos: Number(g.cupos || 0)
                })) : []
              });
            }

            // Si no tiene jornadas específicas marcadas pero sí cupos autorizados
            if (jornadasSede.length === 0 && cuposSede > 0 && catalogoJornadas.length > 0) {
              const defaultJ = jMananaObj || catalogoJornadas[0];
              jornadasSede.push({
                id_jornada: defaultJ.id_jornada,
                nombre_jornada: defaultJ.nombre_jornada,
                cupos: cuposSede,
                habilitada: true,
                secciones: [],
                grados: []
              });
            }

            if (cuposSede > 0 || jornadasSede.length > 0) {
              return { cuposSede, jornadas: jornadasSede };
            }
          }
        }
      }
    } catch (_) {}
    return null;
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
