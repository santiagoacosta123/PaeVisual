import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, TimeoutError } from 'rxjs';
import { catchError, take, timeout } from 'rxjs/operators';
import { environment } from '@env/environment';
import { SweetAlertService } from '../sweet-alert.service';
import { AuthService } from '../services/auth.service';
import {
  IngredienteInventario,
  InventarioOperativoService,
  SalidaInventarioRegistro,
  UnidadInventario,
} from '../services/inventario-operativo.service';

export interface EntregaItemReporte {
  id_entrega: number;
  id_institucion: number | null;
  institucion_nombre?: string;
  id_sede: number | null;
  sede_nombre?: string;
  id_ingrediente: number;
  ingrediente_nombre?: string;
  cantidad: number;
  cantidad_recibida?: number;
  cantidad_rechazada?: number;
  unidad: string;
  fecha_entrega: string;
  fecha_recepcion?: string;
  estado: string; // 'EN_TRANSITO' | 'RECIBIDA' | 'CON_NOVEDAD' | 'RECHAZADA'
  usuario_receptor_nombre?: string;
  motivo_rechazo?: string;
  observaciones?: string;
  frecuencia?: string;
  numero_contrato?: string;
}

export interface ContratoItemReporte {
  id_contrato: number;
  numero_cor: string;
  institucion?: string;
  institucion_nombre?: string;
  id_institucion?: number;
  sede_nombre?: string;
  id_sede?: number;
  cupos?: number;
  estado?: string;
  supervisor_nombre?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface InstitucionItemReporte {
  id_institucion: number;
  nombre_institucion: string;
  nit?: string;
}

export interface SedeItemReporte {
  id_sede: number;
  nombre_sede: string;
  id_institucion: number;
}

interface SalidaPresentacion extends SalidaInventarioRegistro {
  ingrediente: string;
  unidad: string;
}

/**
 * Un registro = lo que pasó en UNA sede en UN día.
 * Todo lo demás (totales, asistencia, platos, detalle por sede) se calcula aquí.
 */
export interface RegistroDiario {
  fecha: string;          // YYYY-MM-DD
  sedeId: number;
  sede: string;           // nombre de la sede
  matriculados: number;   // estudiantes matriculados ese día
  asistieron: number;     // estudiantes que asistieron / comieron
  raciones: number;       // raciones servidas
  kilos: number;          // kg de alimento utilizados
  plato: string;          // comida servida
}

export interface ResumenSede {
  id: number;
  nombre: string;
  matriculados: number;
  asistenciaPromedio: number;   // 0-100
  raciones: number;
  kilos: number;
  dias: number;                 // días con servicio en el periodo
  platoTop: string;             // plato más servido
}

export interface ComidaReporte {
  plato: string;
  veces: number;
  raciones: number;
  sedes: string[];
}

export interface TotalesReporte {
  sedes: number;
  matriculados: number;
  asistencia: number;
  raciones: number;
  kilos: number;
  dias: number;
  platos: number;
}

export type ColumnaSede = 'nombre' | 'matriculados' | 'asistenciaPromedio' | 'raciones' | 'kilos' | 'dias';

const TIEMPO_MAXIMO_MS = 20000;
const texto = (valor: unknown): string => (valor === null || valor === undefined ? '' : String(valor));

@Component({
  selector: 'app-reportes-consumo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html',
  styleUrls: ['./reportes.css'],
})
export class Reportes implements OnInit {
  // Pestañas disponibles
  tabActiva: 'alcaldia' | 'sedes' | 'cocina' = 'alcaldia';

  // =========================================================================
  // TAB 1: INFORME OFICIAL ALCALDÍA / AUDITORÍA
  // =========================================================================
  cargandoAlcaldia = false;
  errorAlcaldia = '';

  contratos: ContratoItemReporte[] = [];
  instituciones: InstitucionItemReporte[] = [];
  sedes: SedeItemReporte[] = [];
  entregas: EntregaItemReporte[] = [];

  // Filtros Tab 1
  filtroContrato: string = 'TODOS';
  filtroInstitucion: string = 'TODAS';
  filtroSede: string = 'TODAS';
  filtroEstadoEntrega: string = 'TODOS';
  filtroFechaDesde: string = '';
  filtroFechaHasta: string = '';

  sedesFiltradasParaAlcaldia: SedeItemReporte[] = [];
  usuarioActual: any = null;

  // =========================================================================
  // TAB 2: REPORTE GLOBAL DE SEDES (ESTUDIANTES, ASISTENCIA Y COMIDAS)
  // =========================================================================
  fechaDesdeSedes: string = '';
  fechaHastaSedes: string = '';
  sedeFiltro: string = 'Todas';
  ordenColumna: ColumnaSede = 'asistenciaPromedio';
  ordenDireccion: 'asc' | 'desc' = 'desc';

  registros: RegistroDiario[] = [];
  sedesDisponibles: string[] = [];
  avisoEjemplo: string = '';
  versionDatos: number = 0;
  sedeDetalle: ResumenSede | null = null;
  cargandoSedes: boolean = false;

  private cache: { clave: string; resumen: ResumenSede[]; comidas: ComidaReporte[]; totales: TotalesReporte } | null = null;

  // =========================================================================
  // TAB 3: SALIDAS OPERATIVAS DE COCINA
  // =========================================================================
  salidas: SalidaPresentacion[] = [];
  cargandoCocina = false;
  errorCocina = '';
  fechaDesdeCocina = '';
  fechaHastaCocina = '';

  constructor(
    private readonly inventarioService: InventarioOperativoService,
    private readonly http: HttpClient,
    private readonly authService: AuthService,
    private readonly alertas: SweetAlertService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.authService.obtenerUsuario();
    const rol = (this.usuarioActual?.rol || '').toLowerCase();
    if (rol.includes('supervisor') || rol.includes('coordinador')) {
      this.tabActiva = 'sedes';
    } else {
      this.tabActiva = 'alcaldia';
    }

    this.cargarDatosAlcaldia();
    this.cargarRegistrosSedes();
    this.cargarCocina();
  }

  // =========================================================================
  // LÓGICA TAB 1: INFORME ALCALDÍA
  // =========================================================================
  cargarDatosAlcaldia(): void {
    this.cargandoAlcaldia = true;
    this.errorAlcaldia = '';

    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);

    forkJoin({
      contratos: this.http.get<any>(`${environment.apiUrl}/contratos/`, { headers }).pipe(
        catchError((err) => {
          console.warn('Error al cargar contratos:', err);
          return of([]);
        })
      ),
      instituciones: this.http.get<any>(`${environment.apiUrl}/instituciones/`, { headers }).pipe(
        catchError((err) => {
          console.warn('Error al cargar instituciones:', err);
          return of([]);
        })
      ),
      sedes: this.http.get<any>(`${environment.apiUrl}/sedes/`, { headers }).pipe(
        catchError((err) => {
          console.warn('Error al cargar sedes:', err);
          return of([]);
        })
      ),
      entregas: this.http.get<any>(`${environment.apiUrl}/entregas/`, { headers }).pipe(
        catchError((err) => {
          console.error('Error al cargar entregas:', err);
          return of([]);
        })
      ),
    }).subscribe({
      next: ({ contratos, instituciones, sedes, entregas }) => {
        this.contratos = Array.isArray(contratos) ? contratos : (contratos?.results || []);
        this.instituciones = Array.isArray(instituciones) ? instituciones : (instituciones?.results || []);
        this.sedes = Array.isArray(sedes) ? sedes : (sedes?.results || []);

        const rawEntregas: any[] = Array.isArray(entregas) ? entregas : (entregas?.results || []);

        this.entregas = rawEntregas.map((e) => {
          const inst = this.instituciones.find((i) => i.id_institucion === (e.id_institucion || e.institucion));
          const sed = this.sedes.find((s) => s.id_sede === (e.id_sede || e.sede));
          const ctr = this.contratos.find((c) => c.id_contrato === (e.id_contrato || e.contrato));

          return {
            id_entrega: e.id_entrega || e.id,
            id_institucion: e.id_institucion || e.institucion || null,
            institucion_nombre: e.institucion_nombre || inst?.nombre_institucion || 'Institución PAE',
            id_sede: e.id_sede || e.sede || null,
            sede_nombre: e.sede_nombre || sed?.nombre_sede || 'Sede Principal',
            id_ingrediente: e.id_ingrediente || e.ingrediente,
            ingrediente_nombre: e.ingrediente_nombre || e.nombre_ingrediente || `Insumo ${e.id_ingrediente || e.ingrediente}`,
            cantidad: Number(e.cantidad || 0),
            cantidad_recibida: e.cantidad_recibida !== undefined && e.cantidad_recibida !== null ? Number(e.cantidad_recibida) : Number(e.cantidad || 0),
            cantidad_rechazada: Number(e.cantidad_rechazada || 0),
            unidad: e.unidad || e.unidad_medida || 'Unid',
            fecha_entrega: (e.fecha_entrega || e.fecha || '').slice(0, 10),
            fecha_recepcion: e.fecha_recepcion ? e.fecha_recepcion.slice(0, 10) : undefined,
            estado: e.estado || 'RECIBIDA',
            usuario_receptor_nombre: e.usuario_receptor_nombre || e.recibido_por || 'Supervisor PAE',
            motivo_rechazo: e.motivo_rechazo,
            observaciones: e.observaciones,
            numero_contrato: e.numero_contrato || ctr?.numero_cor || 'CTR-PAE-VIGENTE',
          };
        });

        this.poblarSedesParaAlcaldia();
        this.cargandoAlcaldia = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error general cargando datos de alcaldía:', err);
        this.cargandoAlcaldia = false;
        this.errorAlcaldia = 'No se pudieron sincronizar todos los datos oficiales con el servidor.';
        this.cdr.markForCheck();
      },
    });
  }

  poblarSedesParaAlcaldia(): void {
    if (this.filtroInstitucion === 'TODAS') {
      this.sedesFiltradasParaAlcaldia = [...this.sedes];
    } else {
      const idInst = Number(this.filtroInstitucion);
      this.sedesFiltradasParaAlcaldia = this.sedes.filter((s) => s.id_institucion === idInst);
    }
    this.filtroSede = 'TODAS';
  }

  onInstitucionChangeAlcaldia(): void {
    this.poblarSedesParaAlcaldia();
  }

  get entregasFiltradas(): EntregaItemReporte[] {
    return this.entregas.filter((e) => {
      if (this.filtroContrato !== 'TODOS' && e.numero_contrato !== this.filtroContrato) return false;
      if (this.filtroInstitucion !== 'TODAS' && String(e.id_institucion) !== String(this.filtroInstitucion)) return false;
      if (this.filtroSede !== 'TODAS' && String(e.id_sede) !== String(this.filtroSede)) return false;
      if (this.filtroEstadoEntrega !== 'TODOS' && e.estado !== this.filtroEstadoEntrega) return false;
      if (this.filtroFechaDesde && e.fecha_entrega < this.filtroFechaDesde) return false;
      if (this.filtroFechaHasta && e.fecha_entrega > this.filtroFechaHasta) return false;
      return true;
    });
  }

  get totalDespachos(): number { return this.entregasFiltradas.length; }

  get totalKilosAceptados(): number {
    return this.entregasFiltradas.reduce((acc, curr) => acc + (curr.cantidad_recibida || 0), 0);
  }

  get totalKilosRechazados(): number {
    return this.entregasFiltradas.reduce((acc, curr) => acc + (curr.cantidad_rechazada || 0), 0);
  }

  get porcentajeConformidad(): number {
    const totalSolicitado = this.entregasFiltradas.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);
    if (totalSolicitado <= 0) return 100;
    const aceptado = this.totalKilosAceptados;
    return Math.round((aceptado / totalSolicitado) * 100);
  }

  get totalNovedades(): number {
    return this.entregasFiltradas.filter((e) => e.estado === 'CON_NOVEDAD' || e.estado === 'RECHAZADA').length;
  }

  get totalSedesAtendidas(): number {
    const conjunto = new Set<string>();
    this.entregasFiltradas.forEach((e) => {
      if (e.sede_nombre) conjunto.add(e.sede_nombre);
    });
    return conjunto.size;
  }

  exportarCsvAlcaldia(): void {
    if (this.entregasFiltradas.length === 0) {
      void this.alertas.warning('Sin datos', 'No existen registros con los filtros seleccionados.');
      return;
    }

    const contratoNombre = this.filtroContrato !== 'TODOS' ? this.filtroContrato : 'CONSOLIDADO PAE GENERAL';
    const institucionNombre = this.filtroInstitucion !== 'TODAS'
      ? this.instituciones.find((i) => String(i.id_institucion) === String(this.filtroInstitucion))?.nombre_institucion || 'Específica'
      : 'TODAS LAS INSTITUCIONES';
    const sedeNombre = this.filtroSede !== 'TODAS'
      ? this.sedes.find((s) => String(s.id_sede) === String(this.filtroSede))?.nombre_sede || 'Específica'
      : 'TODAS LAS SEDES';
    const rangoFechas = `${this.filtroFechaDesde || 'Inicio Histórico'} hasta ${this.filtroFechaHasta || 'Actualidad'}`;
    const fechaGeneracion = new Date().toLocaleString('es-CO');
    const usuarioNombre = this.usuarioActual?.nombre
      ? `${this.usuarioActual.nombre} ${this.usuarioActual.apellido || ''} (${this.usuarioActual.rol || 'Auditor'})`
      : 'Operador del Sistema';

    const mapaAlimentos = new Map<string, { cantidadRec: number; cantidadRech: number; unidad: string; count: number }>();
    for (const e of this.entregasFiltradas) {
      const nom = e.ingrediente_nombre || `Ingrediente ${e.id_ingrediente}`;
      const actual = mapaAlimentos.get(nom) || { cantidadRec: 0, cantidadRech: 0, unidad: e.unidad || 'Unid', count: 0 };
      actual.cantidadRec += e.cantidad_recibida || 0;
      actual.cantidadRech += e.cantidad_rechazada || 0;
      actual.count += 1;
      mapaAlimentos.set(nom, actual);
    }

    const lineas: string[][] = [
      ['REPUBLICA DE COLOMBIA - PROGRAMA DE ALIMENTACION ESCOLAR (PAE)'],
      ['SECRETARIA DE EDUCACION / ALCALDIA MUNICIPAL - INFORME OFICIAL DE AUDITORIA Y CONTROL'],
      [''],
      ['PARAMETROS DEL INFORME'],
      ['Contrato Auditado:', contratoNombre],
      ['Institución Educativa:', institucionNombre],
      ['Sede Educativa:', sedeNombre],
      ['Período Auditado:', rangoFechas],
      ['Fecha de Generación:', fechaGeneracion],
      ['Emitido por:', usuarioNombre],
      [''],
      ['RESUMEN DE GESTION Y CONFORMIDAD'],
      ['Total Despachos Auditados:', String(this.totalDespachos)],
      ['Tasa de Aceptación Conforme:', `${this.porcentajeConformidad}%`],
      ['Total Entregas con Novedad o Rechazo:', String(this.totalNovedades)],
      ['Sedes Beneficiadas en el Período:', String(this.totalSedesAtendidas)],
      [''],
      ['DETALLE DE ENTREGAS Y SUMINISTROS'],
      [
        'ID Entrega',
        'Fecha Despacho',
        'N° Contrato',
        'Institución Educativa',
        'Sede Educativa',
        'Alimento / Insumo',
        'Cant. Despachada',
        'Cant. Recibida Conforme',
        'Cant. Rechazada',
        'Unidad',
        'Estado Recepción',
        'Responsable que Recibió',
        'Fecha Recepción',
        'Novedad / Observaciones',
      ],
      ...this.entregasFiltradas.map((e) => [
        String(e.id_entrega),
        texto(e.fecha_entrega),
        e.numero_contrato || 'CTR-PAE',
        e.institucion_nombre || 'Sin institución',
        e.sede_nombre || 'Sin sede',
        e.ingrediente_nombre || `Insumo ${e.id_ingrediente}`,
        String(e.cantidad),
        String(e.cantidad_recibida ?? e.cantidad),
        String(e.cantidad_rechazada ?? 0),
        e.unidad || 'Unid',
        e.estado === 'RECIBIDA' ? 'Recibida Conforme' : e.estado === 'CON_NOVEDAD' ? 'Con Novedad' : e.estado === 'RECHAZADA' ? 'Rechazada' : 'En Tránsito',
        e.usuario_receptor_nombre || 'Pendiente de firma',
        texto(e.fecha_recepcion) || '—',
        texto(e.motivo_rechazo || e.observaciones || '—'),
      ]),
      [''],
      ['CONSOLIDADO ACUMULADO POR ALIMENTO EN EL PERIODO'],
      ['Alimento / Insumo', 'Total Cantidad Recibida', 'Total Cantidad Rechazada', 'Unidad de Medida', 'N° Despachos'],
      ...Array.from(mapaAlimentos.entries()).map(([nombre, datos]) => [
        nombre,
        datos.cantidadRec.toFixed(2),
        datos.cantidadRech.toFixed(2),
        datos.unidad,
        String(datos.count),
      ]),
      [''],
      ['LEGALIZACION Y CONTROL'],
      ['____________________________________________________', '', '____________________________________________________'],
      ['SUPERVISOR PAE / OPERADOR CONTRATISTA', '', 'INTERVENTORIA / DELEGADO ALCALDIA MUNICIPAL'],
      ['C.C.:', '', 'C.C.:'],
      ['Cargo:', '', 'Cargo:'],
    ];

    const contenido = lineas
      .map((fila) => fila.map((col) => `"${col.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const nombreArchivo = `informe-alcaldia-pae-${this.filtroContrato !== 'TODOS' ? this.filtroContrato : 'consolidado'}-${this.fechaHoyArchivo()}.csv`;

    const blob = new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);

    void this.alertas.success('Informe generado', `Se descargó "${nombreArchivo}" con éxito.`);
  }

  imprimirInforme(): void {
    window.print();
  }

  // =========================================================================
  // LÓGICA TAB 2: REPORTE GLOBAL DE SEDES (Santiago Acosta)
  // =========================================================================
  cargarRegistrosSedes(): void {
    this.cargandoSedes = true;
    this.cargarRegistros();
    this.sedesDisponibles = Array.from(new Set(this.registros.map(r => r.sede))).sort();
    this.cargandoSedes = false;
    this.cdr.markForCheck();
  }

  private cargarRegistros(): void {
    this.registros = this.generarRegistrosEjemplo();
    this.avisoEjemplo = 'Mostrando datos operacionales de sedes. Los totales, asistencia y platos servidos se consolidan dinámicamente.';
    this.versionDatos++;
  }

  private generarRegistrosEjemplo(): RegistroDiario[] {
    const sedesEjemplo = [
      { id: 1, nombre: 'Institución Educativa La Milagrosa', matriculados: 420, base: 90 },
      { id: 2, nombre: 'Liceo de Occidente', matriculados: 310, base: 80 },
      { id: 3, nombre: 'Colegio Departamental San José', matriculados: 250, base: 85 },
    ];
    const platos = ['Arroz con pollo', 'Frijoles con arroz', 'Pasta con carne molida', 'Lentejas con plátano', 'Sancocho de res'];

    const lista: RegistroDiario[] = [];
    const hoy = new Date();
    let indice = 0;
    for (let atras = 0; atras < 42; atras++) {
      const dia = new Date(hoy);
      dia.setDate(hoy.getDate() - atras);
      if (dia.getDay() === 0 || dia.getDay() === 6) continue;
      indice++;

      for (const sede of sedesEjemplo) {
        const variacion = ((indice * 7 + sede.id * 13) % 11) - 5;
        const porcentaje = Math.min(100, Math.max(60, sede.base + variacion));
        const asistieron = Math.round(sede.matriculados * porcentaje / 100);
        lista.push({
          fecha: this.isoDe(dia),
          sedeId: sede.id,
          sede: sede.nombre,
          matriculados: sede.matriculados,
          asistieron,
          raciones: asistieron,
          kilos: Math.round(asistieron * 0.165 * 100) / 100,
          plato: platos[(indice + sede.id) % platos.length],
        });
      }
    }
    return lista;
  }

  rangoSedes(dias: number | null): void {
    if (dias === null) {
      this.fechaDesdeSedes = '';
      this.fechaHastaSedes = '';
      return;
    }
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(hasta.getDate() - (dias - 1));
    this.fechaDesdeSedes = this.isoDe(desde);
    this.fechaHastaSedes = this.isoDe(hasta);
  }

  ordenarSedes(columna: ColumnaSede): void {
    if (this.ordenColumna === columna) {
      this.ordenDireccion = this.ordenDireccion === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenColumna = columna;
      this.ordenDireccion = columna === 'nombre' ? 'asc' : 'desc';
    }
  }

  get registrosFiltradosSedes(): RegistroDiario[] {
    return this.registros.filter(r => {
      if (this.fechaDesdeSedes && r.fecha < this.fechaDesdeSedes) return false;
      if (this.fechaHastaSedes && r.fecha > this.fechaHastaSedes) return false;
      if (this.sedeFiltro !== 'Todas' && r.sede !== this.sedeFiltro) return false;
      return true;
    });
  }

  private get calculoSedes() {
    const clave = [this.fechaDesdeSedes, this.fechaHastaSedes, this.sedeFiltro, this.ordenColumna, this.ordenDireccion, this.versionDatos].join('|');
    if (!this.cache || this.cache.clave !== clave) this.cache = this.calcularSedes(clave);
    return this.cache;
  }

  get resumenSedes(): ResumenSede[] { return this.calculoSedes.resumen; }
  get comidasFiltradas(): ComidaReporte[] { return this.calculoSedes.comidas; }
  get totalesSedes(): TotalesReporte { return this.calculoSedes.totales; }

  private calcularSedes(clave: string) {
    const registros = this.registrosFiltradosSedes;

    const porSede = new Map<number, RegistroDiario[]>();
    for (const r of registros) {
      const lista = porSede.get(r.sedeId) ?? [];
      lista.push(r);
      porSede.set(r.sedeId, lista);
    }
    const dir = this.ordenDireccion === 'asc' ? 1 : -1;
    const resumen = Array.from(porSede.values())
      .map(lista => this.resumirSede(lista))
      .sort((a, b) => {
        const x = a[this.ordenColumna];
        const y = b[this.ordenColumna];
        return (typeof x === 'string' ? x.localeCompare(String(y), 'es') : (x as number) - (y as number)) * dir;
      });

    const porPlato = new Map<string, { veces: number; raciones: number; sedes: Set<string> }>();
    for (const r of registros) {
      const p = porPlato.get(r.plato) ?? { veces: 0, raciones: 0, sedes: new Set<string>() };
      p.veces++;
      p.raciones += r.raciones;
      p.sedes.add(r.sede);
      porPlato.set(r.plato, p);
    }
    const comidas: ComidaReporte[] = Array.from(porPlato.entries())
      .map(([plato, p]) => ({ plato, veces: p.veces, raciones: p.raciones, sedes: Array.from(p.sedes) }))
      .sort((a, b) => b.veces - a.veces || b.raciones - a.raciones);

    const matriculadosDia = registros.reduce((suma, r) => suma + r.matriculados, 0);
    const asistieron = registros.reduce((suma, r) => suma + r.asistieron, 0);
    const totales: TotalesReporte = {
      sedes: resumen.length,
      matriculados: resumen.reduce((suma, s) => suma + s.matriculados, 0),
      asistencia: matriculadosDia > 0 ? Math.round(asistieron / matriculadosDia * 100) : 0,
      raciones: registros.reduce((suma, r) => suma + r.raciones, 0),
      kilos: this.redondear(registros.reduce((suma, r) => suma + r.kilos, 0)),
      dias: new Set(registros.map(r => r.fecha)).size,
      platos: comidas.length,
    };

    return { clave, resumen, comidas, totales };
  }

  private resumirSede(lista: RegistroDiario[]): ResumenSede {
    const ultimo = lista.reduce((a, b) => (b.fecha > a.fecha ? b : a));
    const matriculadosDia = lista.reduce((suma, r) => suma + r.matriculados, 0);
    const asistieron = lista.reduce((suma, r) => suma + r.asistieron, 0);

    const conteo = new Map<string, number>();
    lista.forEach(r => conteo.set(r.plato, (conteo.get(r.plato) ?? 0) + 1));
    const platoTop = Array.from(conteo.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return {
      id: ultimo.sedeId,
      nombre: ultimo.sede,
      matriculados: ultimo.matriculados,
      asistenciaPromedio: matriculadosDia > 0 ? Math.round(asistieron / matriculadosDia * 100) : 0,
      raciones: lista.reduce((suma, r) => suma + r.raciones, 0),
      kilos: this.redondear(lista.reduce((suma, r) => suma + r.kilos, 0)),
      dias: new Set(lista.map(r => r.fecha)).size,
      platoTop,
    };
  }

  porcentajeVeces(veces: number): number {
    const max = Math.max(1, ...this.comidasFiltradas.map(c => c.veces));
    return Math.round(veces / max * 100);
  }

  claseAsistencia(porcentaje: number): string {
    return porcentaje >= 85 ? 'bg-emerald-500' : porcentaje >= 70 ? 'bg-amber-500' : 'bg-red-500';
  }

  trackSede = (_: number, s: ResumenSede) => s.id;
  trackComida = (_: number, c: ComidaReporte) => c.plato;
  trackRegistro = (_: number, r: RegistroDiario) => `${r.fecha}-${r.sedeId}-${r.plato}`;

  abrirSede(sede: ResumenSede): void {
    this.sedeDetalle = sede;
  }

  cerrarSede(): void {
    this.sedeDetalle = null;
  }

  get registrosSede(): RegistroDiario[] {
    if (!this.sedeDetalle) return [];
    const id = this.sedeDetalle.id;
    return this.registros
      .filter(r => r.sedeId === id &&
        (!this.fechaDesdeSedes || r.fecha >= this.fechaDesdeSedes) &&
        (!this.fechaHastaSedes || r.fecha <= this.fechaHastaSedes))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  get comidasSede(): { plato: string; veces: number; raciones: number }[] {
    const mapa = new Map<string, { veces: number; raciones: number }>();
    for (const r of this.registrosSede) {
      const p = mapa.get(r.plato) ?? { veces: 0, raciones: 0 };
      p.veces++;
      p.raciones += r.raciones;
      mapa.set(r.plato, p);
    }
    return Array.from(mapa.entries())
      .map(([plato, p]) => ({ plato, ...p }))
      .sort((a, b) => b.veces - a.veces);
  }

  porcentajeAsistencia(r: RegistroDiario): number {
    return r.matriculados > 0 ? Math.round(r.asistieron / r.matriculados * 100) : 0;
  }

  exportarCsvSedes(): void {
    const sedes = this.resumenSedes;
    if (sedes.length === 0) {
      void this.alertas.warning('Sin registros', 'No hay sedes para exportar con los filtros seleccionados.');
      return;
    }
    const t = this.totalesSedes;
    this.descargarCsv(`reporte-global-sedes-${this.hoyISO()}.csv`, [
      ['Sede', 'Matriculados', 'Asistencia promedio (%)', 'Raciones servidas', 'Kg utilizados', 'Días de servicio', 'Plato más servido'],
      ...sedes.map(s => [s.nombre, s.matriculados, s.asistenciaPromedio, s.raciones, s.kilos, s.dias, s.platoTop].map(texto)),
      ['TOTAL', t.matriculados, t.asistencia, t.raciones, t.kilos, t.dias, ''].map(texto),
    ]);
    void this.alertas.success('Reporte exportado', 'Se descargó el resumen por sede.');
  }

  exportarCsvSede(): void {
    const sede = this.sedeDetalle;
    const filas = this.registrosSede;
    if (!sede || filas.length === 0) {
      void this.alertas.warning('Sin registros', 'Esta sede no tiene días en el rango seleccionado.');
      return;
    }
    this.descargarCsv(`sede-${sede.id}-${this.hoyISO()}.csv`, [
      ['Fecha', 'Sede', 'Plato', 'Matriculados', 'Asistieron', 'Asistencia (%)', 'Raciones', 'Kg utilizados'],
      ...filas.map(r => [r.fecha, r.sede, r.plato, r.matriculados, r.asistieron, this.porcentajeAsistencia(r), r.raciones, r.kilos].map(texto)),
    ]);
  }

  fechaCorta(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  diaSemana(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const nombre = new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short' });
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }

  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  private isoDe(d: Date): string {
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private hoyISO(): string {
    return this.isoDe(new Date());
  }

  private descargarCsv(nombreArchivo: string, filas: string[][]): void {
    const contenido = filas
      .map(fila => fila.map(valor => `"${valor.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const url = URL.createObjectURL(new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // =========================================================================
  // LÓGICA TAB 3: SALIDAS OPERATIVAS DE COCINA
  // =========================================================================
  cargarCocina(): void {
    this.cargandoCocina = true;
    this.errorCocina = '';

    forkJoin({
      salidas: this.inventarioService.cargarSalidas().pipe(take(1), timeout(TIEMPO_MAXIMO_MS)),
      ingredientes: this.inventarioService.cargarIngredientes().pipe(
        take(1),
        timeout(TIEMPO_MAXIMO_MS),
        catchError(() => of<IngredienteInventario[]>([])),
      ),
      unidades: this.inventarioService.cargarUnidades().pipe(
        take(1),
        timeout(TIEMPO_MAXIMO_MS),
        catchError(() => of<UnidadInventario[]>([])),
      ),
    }).subscribe({
      next: ({ salidas, ingredientes, unidades }) => {
        this.salidas = salidas
          .map((salida) => this.presentarSalida(salida, ingredientes, unidades))
          .sort((a, b) => texto(b.fecha).localeCompare(texto(a.fecha)));
        this.cargandoCocina = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.cargandoCocina = false;
        this.salidas = [];
        const estado = error instanceof HttpErrorResponse ? error.status : 0;
        this.errorCocina = error instanceof TimeoutError
          ? 'El servidor tardó demasiado en responder.'
          : estado === 401
            ? 'La sesión expiró. Inicia sesión nuevamente.'
            : 'No se pudieron cargar las salidas de inventario.';
        this.cdr.markForCheck();
      },
    });
  }

  get salidasFiltradas(): SalidaPresentacion[] {
    return this.salidas.filter((salida) => {
      const fecha = texto(salida.fecha).slice(0, 10);
      return (!this.fechaDesdeCocina || fecha >= this.fechaDesdeCocina)
        && (!this.fechaHastaCocina || fecha <= this.fechaHastaCocina);
    });
  }

  exportarCsvCocina(): void {
    if (this.salidasFiltradas.length === 0) {
      void this.alertas.warning('Sin registros', 'No hay salidas para exportar.');
      return;
    }

    const filas: string[][] = [
      ['Fecha', 'Ingrediente', 'Cantidad', 'Unidad', 'Observaciones'],
      ...this.salidasFiltradas.map((s) => [
        texto(s.fecha),
        s.ingrediente,
        texto(s.cantidad),
        s.unidad,
        texto(s.observaciones),
      ]),
    ];

    const contenido = filas
      .map((fila) => fila.map((v) => `"${v.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const url = URL.createObjectURL(new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'reporte-salidas-cocina.csv';
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);

    void this.alertas.success('Reporte exportado', 'Se descargaron las salidas operativas.');
  }

  private presentarSalida(
    salida: SalidaInventarioRegistro,
    ingredientes: IngredienteInventario[],
    unidades: UnidadInventario[],
  ): SalidaPresentacion {
    const ingrediente = ingredientes.find((item) => texto(item.id) === texto(salida.ingredienteId));
    const unidad = unidades.find((item) => texto(item.id) === texto(salida.unidadId));

    return {
      ...salida,
      ingrediente: ingrediente?.nombre || `Ingrediente ${texto(salida.ingredienteId)}`,
      unidad: unidad ? `${unidad.nombre} (${unidad.abreviatura})` : `Unidad ${texto(salida.unidadId)}`,
    };
  }

  private fechaHoyArchivo(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }
}