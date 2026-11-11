import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AuthService } from '../core/auth/auth.service';
import { BancoDatosService } from '../features/banco-datos/services/banco-datos.service';
import { CustomSelectComponent } from '../shared/custom-select/custom-select';

interface OpcionSelect {
  id: number | null;
  label: string;
}

@Component({
  selector: 'app-consulta-gramajes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CustomSelectComponent],
  templateUrl: './consulta-gramajes.html',
  styleUrls: ['./consulta-gramajes.css'],
})
export class ConsultaGramajesComponent implements OnInit {
  cargando = false;
  errorCarga = '';

  alcance: any = null;
  permisos: { puede_modificar_gramajes: boolean } = { puede_modificar_gramajes: false };
  resumen = {
    total_sede_jornadas: 0,
    total_grados_atendidos: 0,
    total_alertas: 0,
    total_alertas_faltantes: 0,
  };

  alertasAlcance: any[] = [];
  alertasFaltantes: any[] = [];
  sedeJornadas: any[] = [];
  ingredientesCatalogo: OpcionSelect[] = [];
  gradosCatalogo: OpcionSelect[] = [];

  filtros: {
    id_institucion: number | null;
    id_sede: number | null;
    id_jornada: number | null;
    id_grado: number | null;
    id_ingrediente: number | null;
  } = {
    id_institucion: null,
    id_sede: null,
    id_jornada: null,
    id_grado: null,
    id_ingrediente: null,
  };

  private inicializacionSupervisorAplicada = false;

  constructor(
    private bancoDatosService: BancoDatosService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarCatalogosFiltro();
    this.consultar();
  }

  get institucionesOpciones(): OpcionSelect[] {
    const lista = this.alcance?.instituciones_disponibles ?? [];
    return lista.map((inst: any) => ({
      id: inst.id_institucion,
      label: inst.nombre_institucion,
    }));
  }

  get sedesOpciones(): OpcionSelect[] {
    let lista = this.alcance?.sedes_disponibles ?? [];
    if (this.filtros.id_institucion) {
      lista = lista.filter(
        (s: any) => Number(s.id_institucion) === Number(this.filtros.id_institucion),
      );
    }
    return lista.map((s: any) => ({
      id: s.id_sede,
      label: s.nombre_institucion && !this.filtros.id_institucion
        ? `${s.nombre_sede} (${s.nombre_institucion})`
        : s.nombre_sede,
    }));
  }

  get jornadasOpciones(): OpcionSelect[] {
    const lista = this.alcance?.jornadas_disponibles ?? [];
    return lista.map((j: any) => ({
      id: j.id_jornada,
      label: j.nombre_jornada,
    }));
  }

  get etiquetaAlcanceRol(): string {
    const nivel = this.alcance?.rol_nivel;
    if (nivel === 'SUPERADMINISTRADOR') {
      return 'Superadministrador: visibilidad global sobre todas las instituciones, sedes y jornadas';
    }
    if (nivel === 'SUPERVISOR') {
      return 'Supervisor: consulta restringida a tus instituciones y sedes asignadas';
    }
    if (nivel === 'ADMINISTRADOR') {
      return 'Administrador institucional: consulta restringida a tu institución y sus sedes';
    }
    if (nivel === 'JEFA_MANIPULADORAS') {
      return 'Jefa de manipuladoras: consulta restringida a tu sede y jornada asignada';
    }
    return 'Consulta de alcance institucional';
  }

  get esSoloLectura(): boolean {
    return !this.permisos?.puede_modificar_gramajes;
  }

  cargarCatalogosFiltro(): void {
    this.bancoDatosService.obtenerDatos('ingredientes').subscribe({
      next: (res: any) => {
        const items = Array.isArray(res) ? res : res?.results || res?.data || [];
        this.ingredientesCatalogo = items.map((i: any) => ({
          id: i.id_ingrediente,
          label: i.nombre_ingrediente || i.nombre || `Producto #${i.id_ingrediente}`,
        }));
        this.cdr.detectChanges();
      },
      error: () => {},
    });

    this.bancoDatosService.obtenerDatos('grados').subscribe({
      next: (res: any) => {
        const items = Array.isArray(res) ? res : res?.results || res?.data || [];
        this.gradosCatalogo = items
          .filter((g: any) => (g.estado || 'ACTIVO') === 'ACTIVO')
          .map((g: any) => ({
            id: g.id_grado,
            label: g.nombre_grupo_gramaje ? `${g.nombre_grado} (${g.nombre_grupo_gramaje})` : g.nombre_grado,
          }));
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  onInstitucionChange(): void {
    if (this.filtros.id_sede) {
      const sigueValida = this.sedesOpciones.some(
        (s) => Number(s.id) === Number(this.filtros.id_sede),
      );
      if (!sigueValida) {
        this.filtros.id_sede = null;
      }
    }
    this.consultar();
  }

  limpiarFiltros(): void {
    if (this.alcance?.puede_filtrar_institucion) {
      this.filtros.id_institucion = null;
    }
    if (this.alcance?.puede_filtrar_sede) {
      this.filtros.id_sede = null;
    }
    if (this.alcance?.puede_filtrar_jornada) {
      this.filtros.id_jornada = null;
    }
    this.filtros.id_grado = null;
    this.filtros.id_ingrediente = null;
    this.consultar();
  }

  consultar(): void {
    this.cargando = true;
    this.errorCarga = '';

    this.bancoDatosService.consultarGramajesPorAlcance(this.filtros).subscribe({
      next: (resp: any) => {
        this.alcance = resp?.alcance || null;
        this.permisos = resp?.permisos || { puede_modificar_gramajes: false };
        this.resumen = resp?.resumen || {
          total_sede_jornadas: 0,
          total_grados_atendidos: 0,
          total_alertas: 0,
          total_alertas_faltantes: 0,
        };
        this.alertasAlcance = Array.isArray(resp?.alertas_alcance) ? resp.alertas_alcance : [];
        this.alertasFaltantes = Array.isArray(resp?.alertas_faltantes) ? resp.alertas_faltantes : [];
        this.sedeJornadas = Array.isArray(resp?.sede_jornadas) ? resp.sede_jornadas : [];

        // Si el Supervisor ya eligió institución activa globalmente, sincronizamos una vez
        if (!this.inicializacionSupervisorAplicada && this.alcance?.rol_nivel === 'SUPERVISOR') {
          this.inicializacionSupervisorAplicada = true;
          const instActiva = this.authService.obtenerInstitucionActiva();
          const existe = instActiva && this.institucionesOpciones.some(
            (i) => Number(i.id) === Number(instActiva.id_institucion),
          );
          if (existe && !this.filtros.id_institucion) {
            this.filtros.id_institucion = Number(instActiva!.id_institucion);
            this.consultar();
            return;
          }
        }

        // Pre-fijar filtros bloqueados para Administrador o Jefa según su alcance
        if (this.alcance && !this.alcance.puede_filtrar_institucion && this.alcance.id_institucion_asignada) {
          this.filtros.id_institucion = this.alcance.id_institucion_asignada;
        }
        if (this.alcance && !this.alcance.puede_filtrar_sede && this.alcance.id_sede_asignada) {
          this.filtros.id_sede = this.alcance.id_sede_asignada;
        }
        if (this.alcance && !this.alcance.puede_filtrar_jornada && this.alcance.id_jornada_asignada) {
          this.filtros.id_jornada = this.alcance.id_jornada_asignada;
        }

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.cargando = false;
        this.errorCarga =
          err?.error?.detail ||
          err?.error?.error ||
          'No fue posible consultar los gramajes autorizados para tu alcance.';
        this.cdr.detectChanges();
      },
    });
  }
}

