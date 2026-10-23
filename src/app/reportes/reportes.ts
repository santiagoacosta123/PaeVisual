import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
  // Pestañas
  tabActiva: 'alcaldia' | 'cocina' = 'alcaldia';

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
  filtroBusquedaRapida: string = '';

  // =========================================================================
  // TAB 2: SALIDAS OPERATIVAS DE COCINA (EXISTENTE)
  // =========================================================================
  salidas: SalidaPresentacion[] = [];
  cargandoCocina = false;
  errorCocina = '';
  fechaDesdeCocina = '';
  fechaHastaCocina = '';

  // Datos usuario actual
  usuarioActual: any = null;

  constructor(
    private readonly inventarioService: InventarioOperativoService,
    private readonly http: HttpClient,
    private readonly authService: AuthService,
    private readonly alertas: SweetAlertService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.authService.obtenerUsuario();
    this.cargarDatosAlcaldia();
    this.cargarCocina();
  }

  // =========================================================================
  // CARGA DE DATOS PARA INFORME ALCALDÍA
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

        // Vincular número de contrato a cada entrega según la institución
        this.entregas = rawEntregas.map((e) => {
          const instId = e.id_institucion;
          const matchingContrato = this.contratos.find((c) => {
            if (instId && c.id_institucion === instId) return true;
            if (e.institucion_nombre && c.institucion_nombre && e.institucion_nombre.toLowerCase() === c.institucion_nombre.toLowerCase()) return true;
            if (e.institucion_nombre && c.institucion && e.institucion_nombre.toLowerCase().includes(c.institucion.toLowerCase())) return true;
            return false;
          });

          return {
            ...e,
            cantidad: Number(e.cantidad || 0),
            cantidad_recibida: e.cantidad_recibida !== null && e.cantidad_recibida !== undefined ? Number(e.cantidad_recibida) : Number(e.cantidad || 0),
            cantidad_rechazada: Number(e.cantidad_rechazada || 0),
            numero_contrato: matchingContrato?.numero_cor || 'CTR-PAE-GENERAL',
          };
        }).sort((a, b) => texto(b.fecha_entrega).localeCompare(texto(a.fecha_entrega)));

        this.cargandoAlcaldia = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error en carga consolidada para reporte alcaldía:', err);
        this.cargandoAlcaldia = false;
        this.errorAlcaldia = 'No se pudieron sincronizar los datos de auditoría.';
        this.cdr.markForCheck();
      },
    });
  }

  // =========================================================================
  // FILTRADO DINÁMICO TAB 1
  // =========================================================================

  get sedesDisponibles(): SedeItemReporte[] {
    if (this.filtroInstitucion === 'TODAS') {
      return this.sedes;
    }
    const idInst = Number(this.filtroInstitucion);
    return this.sedes.filter((s) => s.id_institucion === idInst);
  }

  onCambioContrato(): void {
    if (this.filtroContrato !== 'TODOS') {
      const c = this.contratos.find((item) => item.id_contrato === Number(this.filtroContrato));
      if (c && c.id_institucion) {
        this.filtroInstitucion = String(c.id_institucion);
        this.filtroSede = 'TODAS';
      }
    }
  }

  onCambioInstitucion(): void {
    this.filtroSede = 'TODAS';
  }

  setPeriodo(tipo: 'este_mes' | 'mes_anterior' | 'ultimos_30' | 'anio_actual' | 'todo'): void {
    const hoy = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formato = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (tipo === 'todo') {
      this.filtroFechaDesde = '';
      this.filtroFechaHasta = '';
      return;
    }

    if (tipo === 'este_mes') {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      this.filtroFechaDesde = formato(inicio);
      this.filtroFechaHasta = formato(fin);
      return;
    }

    if (tipo === 'mes_anterior') {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      this.filtroFechaDesde = formato(inicio);
      this.filtroFechaHasta = formato(fin);
      return;
    }

    if (tipo === 'ultimos_30') {
      const inicio = new Date();
      inicio.setDate(hoy.getDate() - 30);
      this.filtroFechaDesde = formato(inicio);
      this.filtroFechaHasta = formato(hoy);
      return;
    }

    if (tipo === 'anio_actual') {
      const inicio = new Date(hoy.getFullYear(), 0, 1);
      const fin = new Date(hoy.getFullYear(), 11, 31);
      this.filtroFechaDesde = formato(inicio);
      this.filtroFechaHasta = formato(fin);
      return;
    }
  }

  get entregasFiltradas(): EntregaItemReporte[] {
    const q = this.filtroBusquedaRapida.trim().toLowerCase();

    return this.entregas.filter((e) => {
      // Filtro de Contrato
      if (this.filtroContrato !== 'TODOS') {
        const c = this.contratos.find((item) => item.id_contrato === Number(this.filtroContrato));
        if (c) {
          const coincideNumero = e.numero_contrato === c.numero_cor;
          const coincideInst = c.id_institucion && e.id_institucion === c.id_institucion;
          if (!coincideNumero && !coincideInst) return false;
        }
      }

      // Filtro de Institución
      if (this.filtroInstitucion !== 'TODAS') {
        if (Number(e.id_institucion) !== Number(this.filtroInstitucion)) {
          return false;
        }
      }

      // Filtro de Sede
      if (this.filtroSede !== 'TODAS') {
        if (Number(e.id_sede) !== Number(this.filtroSede)) {
          return false;
        }
      }

      // Filtro de Estado
      if (this.filtroEstadoEntrega !== 'TODOS') {
        if (e.estado !== this.filtroEstadoEntrega) {
          return false;
        }
      }

      // Filtro de Fechas
      const f = texto(e.fecha_entrega).slice(0, 10);
      if (this.filtroFechaDesde && f < this.filtroFechaDesde) return false;
      if (this.filtroFechaHasta && f > this.filtroFechaHasta) return false;

      // Filtro de Texto
      if (q) {
        const txt = [
          e.numero_contrato,
          e.institucion_nombre,
          e.sede_nombre,
          e.ingrediente_nombre,
          e.estado,
          e.observaciones,
          e.usuario_receptor_nombre,
        ].join(' ').toLowerCase();
        if (!txt.includes(q)) return false;
      }

      return true;
    });
  }

  // =========================================================================
  // METRICAS / KPIS
  // =========================================================================

  get totalDespachos(): number {
    return this.entregasFiltradas.length;
  }

  get totalKilosUnidadesRecibidas(): number {
    return this.entregasFiltradas.reduce((sum, e) => sum + (e.cantidad_recibida || 0), 0);
  }

  get totalKilosUnidadesRechazadas(): number {
    return this.entregasFiltradas.reduce((sum, e) => sum + (e.cantidad_rechazada || 0), 0);
  }

  get porcentajeConformidad(): number {
    if (this.entregasFiltradas.length === 0) return 100;
    const recibidasConformes = this.entregasFiltradas.filter((e) => e.estado === 'RECIBIDA').length;
    return +((recibidasConformes / this.entregasFiltradas.length) * 100).toFixed(1);
  }

  get totalNovedades(): number {
    return this.entregasFiltradas.filter((e) => e.estado === 'CON_NOVEDAD' || e.estado === 'RECHAZADA').length;
  }

  get totalSedesAtendidas(): number {
    const ids = new Set(this.entregasFiltradas.map((e) => e.id_sede).filter(Boolean));
    return ids.size;
  }

  // =========================================================================
  // EXPORTACIÓN A EXCEL / CSV OFICIAL PARA LA ALCALDÍA
  // =========================================================================

  exportarExcelAlcaldia(): void {
    if (this.entregasFiltradas.length === 0) {
      void this.alertas.warning('Sin datos', 'No hay entregas para exportar con los filtros seleccionados.');
      return;
    }

    const contratoNombre = this.filtroContrato !== 'TODOS'
      ? (this.contratos.find((c) => c.id_contrato === Number(this.filtroContrato))?.numero_cor || this.filtroContrato)
      : 'CONSOLIDADO - TODOS LOS CONTRATOS';

    const institucionNombre = this.filtroInstitucion !== 'TODAS'
      ? (this.instituciones.find((i) => i.id_institucion === Number(this.filtroInstitucion))?.nombre_institucion || this.filtroInstitucion)
      : 'TODAS LAS INSTITUCIONES EDUCATIVAS';

    const sedeNombre = this.filtroSede !== 'TODAS'
      ? (this.sedes.find((s) => s.id_sede === Number(this.filtroSede))?.nombre_sede || this.filtroSede)
      : 'TODAS LAS SEDES';

    const rangoFechas = (this.filtroFechaDesde || this.filtroFechaHasta)
      ? `${this.filtroFechaDesde || 'Inicio'} hasta ${this.filtroFechaHasta || 'Actualidad'}`
      : 'PERÍODO COMPLETO';

    const fechaGeneracion = new Date().toLocaleString('es-CO');
    const usuarioNombre = this.usuarioActual?.nombre
      ? `${this.usuarioActual.nombre} ${this.usuarioActual.apellido || ''} (${this.usuarioActual.rol || 'Auditor'})`
      : 'Operador del Sistema';

    // Agrupación resumen por alimento
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
  // TAB 2: SALIDAS OPERATIVAS DE COCINA (EXISTENTE)
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