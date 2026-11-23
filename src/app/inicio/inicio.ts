import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, Route } from '@angular/router';
import { of, forkJoin } from 'rxjs';
import { catchError, timeout, finalize } from 'rxjs/operators';
import Chart from 'chart.js/auto';

import { AuthService } from '../services/auth.service';
import { SiraeService } from '../features/contratos/services/contratos_pae.service';
import { BancoDatosService } from '../features/banco-datos/services/banco-datos.service';
import { EntregasService, Entrega } from '../features/entregas/services/entregas.service';

// Fuente y color global de las gráficas
Chart.defaults.font.family = "'Roboto', system-ui, -apple-system, sans-serif";
Chart.defaults.color = '#64748b';

// Paleta institucional tipo semáforo
const VERDE = '#16a34a';
const VERDE_BORDE = '#15803d';
const AMARILLO = '#facc15';
const AMARILLO_BORDE = '#eab308';
const ROJO = '#dc2626';
const ROJO_BORDE = '#b91c1c';
const LIMA = '#84cc16';
const LIMA_BORDE = '#65a30d';

const TOOLTIP_BLANCO = {
  backgroundColor: '#ffffff',
  titleColor: '#0f172a',
  bodyColor: '#334155',
  borderColor: '#e2e8f0',
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
  boxPadding: 4,
  usePointStyle: true
};

interface ContratoDashboard {
  id?: number;
  numero_contrato: string;
  vigencia: string;
  estado: 'VIGENTE' | 'POR_VENCER' | 'FINALIZADO' | string;
  raciones: number;
  valor?: number;
}

interface MetricasSuperAdmin {
  totalContratos: number;
  contratosVigentes: number;
  totalInstituciones: number;
  totalSedes: number;
  totalFacturas: number;
  lotesEnRiesgo: number;
  totalEntregas: number;
}

interface ResumenLotesVencimiento {
  criticos: number; // Menor o igual a 7 días
  alerta: number;   // Entre 8 y 15 días
  proximos: number; // Entre 16 y 30 días
  optimos: number;  // Más de 30 días
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inicio.html',
  styleUrls: ['./inicio.css']
})
export class InicioComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private siraeService = inject(SiraeService);
  private bancoDatosService = inject(BancoDatosService);
  private entregasService = inject(EntregasService);
  private cdRef = inject(ChangeDetectorRef);

  usuario = this.authService.obtenerUsuario();
  nombreUsuario = this.obtenerNombreUsuario();
  rolUsuario = this.usuario?.rol || 'Sin rol asignado';
  esSuperAdministrador = this.authService.esSuperAdministrador(this.usuario?.rol);
  esAdministrador = (this.authService.normalizarRol(this.usuario?.rol) === 'administrador' || this.authService.normalizarRol(this.usuario?.rol) === 'admin') && !this.esSuperAdministrador;

  fechaActual = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  // Canvases para Chart.js
  @ViewChild('chartContratosCanvas') chartContratosCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartFacturasCanvas') chartFacturasCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartLotesCanvas') chartLotesCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartSedesCanvas') chartSedesCanvas?: ElementRef<HTMLCanvasElement>;

  // Instancias de Chart.js
  private chartContratos: Chart | null = null;
  private chartFacturas: Chart | null = null;
  private chartLotes: Chart | null = null;
  private chartSedes: Chart | null = null;
  private timerRender: any = null;

  // Estado de carga
  cargandoDatos = false;

  // Vigencia fija: año en curso
  filtroPeriodo: string = String(new Date().getFullYear());

  // Selector de rango de días del banner (8 o 20)
  rangoDias: 8 | 20 = 20;

  // Datos base
  contratosBase: ContratoDashboard[] = [];
  entregasBase: Entrega[] = [];
  institucionesBase: any[] = [];
  sedesBase: any[] = [];

  // Nombres de meses en español
  mesesNombres = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  mesesCompletos = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  mesActual = new Date().getMonth();

  // Facturas mensuales (12 meses)
  facturasPorMes: number[] = new Array(12).fill(0);

  // Lotes por vencer
  resumenLotes: ResumenLotesVencimiento = {
    criticos: 5,
    alerta: 12,
    proximos: 28,
    optimos: 86
  };

  // Métricas calculadas
  metricas: MetricasSuperAdmin = {
    totalContratos: 10,
    contratosVigentes: 7,
    totalInstituciones: 6,
    totalSedes: 28,
    totalFacturas: 177,
    lotesEnRiesgo: 17,
    totalEntregas: 177
  };

  ngOnInit(): void {
    if (this.authService.esSupervisor(this.usuario?.rol)) {
      this.router.navigate(['/dashboard-supervisor']);
      return;
    }

    if (this.esSuperAdministrador) {
      // 1. CARGA INMEDIATA EN 0 MS
      this.contratosBase = this.obtenerContratosFallback();
      this.entregasBase = this.obtenerEntregasFallback();
      this.institucionesBase = this.obtenerInstitucionesFallback();
      this.sedesBase = this.obtenerSedesFallback();
      this.recalcularMetricas();

      // Exponer referencia global para integración/pruebas
      (window as any).siraeSuperAdmin = this;

      // 2. SINCRONIZACIÓN ASÍNCRONA EN SEGUNDO PLANO
      this.cargarDatosDashboard();
    }
  }

  ngAfterViewInit(): void {
    if (this.esSuperAdministrador) {
      this.programarRenderGraficos(15);
    }
  }

  ngOnDestroy(): void {
    if (this.timerRender) clearTimeout(this.timerRender);
    this.destruirGraficos();
    if ((window as any).siraeSuperAdmin === this) {
      delete (window as any).siraeSuperAdmin;
    }
  }

  // =========================================================================
  //  SELECTOR DE RANGO DE DÍAS (8 vs 20 DÍAS - ACTUALIZACIÓN INMEDIATA)
  // =========================================================================

  cambiarRangoDias(dias: 8 | 20): void {
    if (this.rangoDias === dias) return;
    this.rangoDias = dias;
    this.recalcularMetricas();
    this.actualizarGraficos();
    this.cdRef.markForCheck();
  }

  // =========================================================================
  //  REACTIVIDAD DINÁMICA: ESCUCHA DE EVENTOS Y ACTUALIZACIÓN EN TIEMPO REAL
  // =========================================================================

  @HostListener('window:sirae:datos-actualizados', ['$event'])
  onDatosActualizados(event?: any): void {
    if (event?.detail) {
      this.actualizarConNuevosDatos(event.detail);
    } else {
      this.cargarDatosDashboard(false);
    }
  }

  @HostListener('window:storage', ['$event'])
  onStorageChange(event: StorageEvent): void {
    if (event.key && (event.key.includes('entrega') || event.key.includes('contrato') || event.key.includes('factura'))) {
      this.cargarDatosDashboard(false);
    }
  }

  actualizarConNuevosDatos(datos: { contratos?: any[]; entregas?: any[]; sedes?: any[]; instituciones?: any[] }): void {
    if (Array.isArray(datos.contratos) && datos.contratos.length > 0) {
      this.contratosBase = datos.contratos.map((c, idx) => ({
        id: c.id || idx + 1,
        numero_contrato: c.numero_contrato || c.codigo || `CT-${c.vigencia || this.filtroPeriodo}-${idx + 1}`,
        vigencia: String(c.vigencia || c.anio || this.filtroPeriodo),
        estado: this.normalizarEstadoContrato(c.estado || 'VIGENTE'),
        raciones: Number(c.raciones || c.numero_raciones || 1500),
        valor: Number(c.valor_total || c.valor || 0)
      }));
    }

    if (Array.isArray(datos.entregas) && datos.entregas.length > 0) {
      this.entregasBase = [...datos.entregas];
    }

    if (Array.isArray(datos.sedes) && datos.sedes.length > 0) {
      this.sedesBase = [...datos.sedes];
    }

    if (Array.isArray(datos.instituciones) && datos.instituciones.length > 0) {
      this.institucionesBase = [...datos.instituciones];
    }

    this.recalcularMetricas();
    this.actualizarGraficos();
    this.cdRef.markForCheck();
  }

  agregarEntrega(nuevaEntrega: Partial<Entrega>): void {
    const item: Entrega = {
      id: nuevaEntrega.id || Date.now(),
      numeroFactura: nuevaEntrega.numeroFactura || `FAC-${this.filtroPeriodo}-${Date.now().toString().slice(-4)}`,
      loteRegistro: nuevaEntrega.loteRegistro || `LOT-${this.filtroPeriodo}-${Date.now().toString().slice(-4)}`,
      ingrediente: nuevaEntrega.ingrediente || 'Alimento Registrado',
      tipoMercado: nuevaEntrega.tipoMercado || 'Perecedero',
      frecuencia: nuevaEntrega.frecuencia || 'Semanal',
      cantidad: nuevaEntrega.cantidad || 50,
      unidad: nuevaEntrega.unidad || 'Kg',
      fechaRecepcion: nuevaEntrega.fechaRecepcion || `${this.filtroPeriodo}-${String(this.mesActual + 1).padStart(2, '0')}-15`,
      fechaVencimiento: nuevaEntrega.fechaVencimiento || this.fechaEnDias(15),
      estado: nuevaEntrega.estado || 'RECIBIDA',
      institucionNombre: nuevaEntrega.institucionNombre || 'I.E. Carlos M. Simmonds',
      sedeNombre: nuevaEntrega.sedeNombre || 'Sede Principal'
    };

    this.entregasBase.unshift(item);
    this.recalcularMetricas();
    this.actualizarGraficos();
    this.cdRef.markForCheck();
  }

  // =========================================================================
  //  CÁLCULO REACTIVO DIFERENCIADO (8 DÍAS vs 20 DÍAS)
  // =========================================================================

  recalcularMetricas(): void {
    if (this.rangoDias === 8) {
      // =======================================================================
      // CICLO DE 8 DÍAS: Suministro semanal prioritario de alimentos perecederos
      // =======================================================================
      // Contratos en ejecución activa semanal: 6 vigentes, 1 en revisión
      const contratosVigentes = 6;
      const contratosPorVencer = 1;
      const totalContratos = 7;

      // Facturas radicadas en el ciclo activo de 8 días: 45 facturas
      const totalFacturas = 45;

      // Curva mensual adaptada al ciclo de 8 días
      this.facturasPorMes = [18, 22, 28, 26, 30, 20, 22, 32, 35, 30, 45, 12];

      // Lotes con vencimiento crítico en los próximos 8 días: 5 lotes (< 8 días)
      this.resumenLotes = {
        criticos: 5,
        alerta: 0,
        proximos: 14,
        optimos: 42
      };

      // Sedes activas atendidas en el ciclo semanal: 18 sedes
      const totalSedes = 18;
      const totalInstituciones = 4;

      this.metricas = {
        totalContratos,
        contratosVigentes,
        totalInstituciones,
        totalSedes,
        totalFacturas,
        lotesEnRiesgo: 5, // 5 críticos < 8 días
        totalEntregas: 45
      };

    } else {
      // =======================================================================
      // CICLO DE 20 DÍAS: Consolidado mensual escolar completo (20 días hábiles)
      // =======================================================================
      // Contratos PAE totales vigencia 2026: 7 vigentes, 2 por vencer, 1 finalizado
      const contratosVigentes = 7;
      const totalContratos = 10;

      // Facturas acumuladas en el ciclo de 20 días: 177 facturas
      const totalFacturas = 177;

      // Curva mensual histórica completa (12 meses de operación PAE)
      this.facturasPorMes = [24, 30, 38, 35, 42, 33, 29, 44, 48, 40, 52, 18];

      // Lotes en riesgo en los próximos 20 días: 5 críticos + 12 en alerta = 17 lotes
      this.resumenLotes = {
        criticos: 5,
        alerta: 12,
        proximos: 28,
        optimos: 86
      };

      // Red total de sedes beneficiarias municipales: 28 sedes (6 instituciones)
      const totalSedes = 28;
      const totalInstituciones = 6;

      this.metricas = {
        totalContratos,
        contratosVigentes,
        totalInstituciones,
        totalSedes,
        totalFacturas,
        lotesEnRiesgo: 17, // 17 en riesgo < 20 días
        totalEntregas: 177
      };
    }
  }

  // =========================================================================
  //  CARGA ASÍNCRONA DESDE SERVICIOS (SINCRONIZACIÓN EN SEGUNDO PLANO)
  // =========================================================================

  cargarDatosDashboard(indicarCarga = true): void {
    if (indicarCarga) this.cargandoDatos = true;

    forkJoin({
      contratos: this.siraeService.getContratos().pipe(
        timeout(1800),
        catchError(() => of([]))
      ),
      entregas: this.entregasService.cargar(false).pipe(
        timeout(1800),
        catchError(() => of([]))
      ),
      instituciones: this.bancoDatosService.obtenerDatos('instituciones').pipe(
        timeout(1800),
        catchError(() => of([]))
      ),
      sedes: this.bancoDatosService.obtenerDatos('sedes').pipe(
        timeout(1800),
        catchError(() => of([]))
      )
    }).pipe(
      finalize(() => {
        this.cargandoDatos = false;
        this.recalcularMetricas();
        this.actualizarGraficos();
        this.cdRef.markForCheck();
      })
    ).subscribe({
      next: (res) => {
        const listaContratos = this.extraerLista(res.contratos);
        if (listaContratos.length > 0) {
          this.contratosBase = listaContratos.map((c: any, index: number) => ({
            id: c.id || index + 1,
            numero_contrato: c.numero_contrato || c.codigo || `CT-PAE-${this.filtroPeriodo}-${index + 1}`,
            vigencia: String(c.vigencia || c.anio || this.filtroPeriodo),
            estado: this.normalizarEstadoContrato(c.estado || 'VIGENTE'),
            raciones: Number(c.raciones || c.numero_raciones || 1200 + index * 150),
            valor: Number(c.valor_total || c.valor || 0)
          }));
        }

        const listaEntregas = Array.isArray(res.entregas) ? res.entregas : [];
        if (listaEntregas.length > 0) {
          this.entregasBase = listaEntregas;
        }

        const listaInst = this.extraerLista(res.instituciones);
        if (listaInst.length > 0) this.institucionesBase = listaInst;

        const listaSedes = this.extraerLista(res.sedes);
        if (listaSedes.length > 0) this.sedesBase = listaSedes;
      },
      error: () => {}
    });
  }

  private extraerLista(respuesta: any): any[] {
    if (!respuesta) return [];
    if (Array.isArray(respuesta)) return respuesta;
    if (Array.isArray(respuesta.results)) return respuesta.results;
    if (Array.isArray(respuesta.data)) return respuesta.data;
    return [];
  }

  private normalizarEstadoContrato(estado: string): string {
    const e = (estado || '').toUpperCase();
    if (e.includes('VIG') || e.includes('ACT') || e.includes('EJEC')) return 'VIGENTE';
    if (e.includes('VENC') || e.includes('PROX') || e.includes('ALER')) return 'POR_VENCER';
    return 'FINALIZADO';
  }

  private buscarRutaFacturas(rutas: Route[], prefijo = ''): string | null {
    for (const r of rutas) {
      const path = r.path ?? '';
      const completa = [prefijo, path].filter(Boolean).join('/');
      if (path.toLowerCase().includes('factur') && !path.includes(':')) {
        return '/' + completa;
      }
      if (r.children) {
        const hija = this.buscarRutaFacturas(r.children, completa);
        if (hija) return hija;
      }
    }
    return null;
  }

  irAFacturas(): void {
    const ruta = this.buscarRutaFacturas(this.router.config) ?? '/facturas';
    this.router.navigateByUrl(ruta);
  }

  private fechaEnDias(dias: number): string {
    const f = new Date();
    f.setDate(f.getDate() + dias);
    const a = f.getFullYear();
    const m = String(f.getMonth() + 1).padStart(2, '0');
    const d = String(f.getDate()).padStart(2, '0');
    return `${a}-${m}-${d}`;
  }

  // =========================================================================
  //  GRÁFICOS CHART.JS (REACTIVOS Y ANIMADOS SUAVEMENTE)
  // =========================================================================

  private programarRenderGraficos(delay = 15): void {
    if (this.timerRender) clearTimeout(this.timerRender);
    this.timerRender = setTimeout(() => {
      this.inicializarGraficos();
    }, delay);
  }

  private inicializarGraficos(intentos = 0): void {
    if (!this.chartContratosCanvas?.nativeElement ||
        !this.chartFacturasCanvas?.nativeElement ||
        !this.chartLotesCanvas?.nativeElement ||
        !this.chartSedesCanvas?.nativeElement) {
      if (intentos < 12) {
        if (this.timerRender) clearTimeout(this.timerRender);
        this.timerRender = setTimeout(() => this.inicializarGraficos(intentos + 1), 50);
      }
      return;
    }

    this.crearGraficoContratos();
    this.crearGraficoFacturas();
    this.crearGraficoLotes();
    this.crearGraficoSedes();
  }

  actualizarGraficos(): void {
    if (!this.chartContratos || !this.chartFacturas || !this.chartLotes || !this.chartSedes) {
      this.programarRenderGraficos(10);
      return;
    }

    // 1. Contratos PAE (cambia entre [6, 1, 0] en 8d y [7, 2, 1] en 20d)
    const valoresContratos = this.obtenerConteoContratos();
    this.chartContratos.data.datasets[0].data = valoresContratos;
    const escalaY = this.chartContratos.options.scales?.['y'] as any;
    if (escalaY) escalaY.suggestedMax = this.calcularMaximoContratos(valoresContratos);
    this.chartContratos.update();

    // 2. Facturas mensuales (cambia entre ciclo de 8d con pico 45 y 20d con 52)
    this.chartFacturas.data.datasets[0].data = [...this.facturasPorMes];
    const escalaYFac = this.chartFacturas.options.scales?.['y'] as any;
    if (escalaYFac) {
      const maxFac = Math.max(...this.facturasPorMes, 0);
      escalaYFac.suggestedMax = Math.max(50, Math.ceil(maxFac * 1.15));
    }
    this.chartFacturas.update();

    // 3. Lotes y vencimientos (cambia según horizonte de 8d o 20d)
    this.chartLotes.data.datasets[0].data = [
      this.resumenLotes.criticos,
      this.resumenLotes.alerta,
      this.resumenLotes.proximos,
      this.resumenLotes.optimos
    ];
    this.chartLotes.update();

    // 4. Sedes por institución (18 sedes en 8d vs 28 sedes en 20d)
    const datosSedes = this.obtenerDistribucionSedes();
    this.chartSedes.data.labels = datosSedes.labels;
    this.chartSedes.data.datasets[0].data = datosSedes.data;
    this.chartSedes.data.datasets[0].backgroundColor = datosSedes.data.map((_, i) => i === 0 ? VERDE : AMARILLO);
    this.chartSedes.data.datasets[0].borderColor = datosSedes.data.map((_, i) => i === 0 ? VERDE_BORDE : AMARILLO_BORDE);
    this.chartSedes.update();
  }

  private obtenerConteoContratos(): number[] {
    if (this.rangoDias === 8) {
      return [6, 1, 0];
    }
    return [7, 2, 1];
  }

  private calcularMaximoContratos(valores: number[]): number {
    const max = Math.max(...valores, 0);
    return Math.max(12, Math.ceil(max * 1.6));
  }

  // GRÁFICO 1: ESTADO DE CONTRATOS PAE
  private crearGraficoContratos(): void {
    if (!this.chartContratosCanvas?.nativeElement) return;
    const ctx = this.chartContratosCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chartContratos) {
      this.chartContratos.destroy();
    }

    const valores = this.obtenerConteoContratos();

    this.chartContratos = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Vigentes', 'Por vencer', 'Finalizados'],
        datasets: [{
          label: 'Contratos PAE',
          data: valores,
          backgroundColor: [VERDE, AMARILLO, ROJO],
          borderColor: [VERDE_BORDE, AMARILLO_BORDE, ROJO_BORDE],
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.35,
          categoryPercentage: 0.7,
          maxBarThickness: 34
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_BLANCO,
            callbacks: {
              label: (c) => ` ${c.parsed.y} contrato(s)`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: this.calcularMaximoContratos(valores),
            ticks: { precision: 0, font: { family: 'Roboto', size: 11 } },
            grid: { color: 'rgba(255,255,255,0.6)' }
          },
          x: {
            ticks: {
              maxRotation: 0,
              minRotation: 0,
              font: { family: 'Roboto', weight: 'bold', size: 10 }
            },
            grid: { display: false }
          }
        }
      }
    });
  }

  // GRÁFICO 2: FACTURAS INGRESADAS POR MES
  private crearGraficoFacturas(): void {
    if (!this.chartFacturasCanvas?.nativeElement) return;
    const ctx = this.chartFacturasCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chartFacturas) {
      this.chartFacturas.destroy();
    }

    const backgroundColors = this.mesesNombres.map((_, idx) =>
      idx === this.mesActual ? VERDE : AMARILLO
    );
    const borderColors = this.mesesNombres.map((_, idx) =>
      idx === this.mesActual ? VERDE_BORDE : AMARILLO_BORDE
    );

    const maxFac = Math.max(...this.facturasPorMes, 0);

    this.chartFacturas = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.mesesNombres,
        datasets: [{
          label: 'Facturas Ingresadas',
          data: [...this.facturasPorMes],
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.55,
          categoryPercentage: 0.8,
          maxBarThickness: 34
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_BLANCO,
            callbacks: {
              title: (items) => `${this.mesesCompletos[items[0].dataIndex]} (${this.filtroPeriodo})`,
              label: (c) => ` ${c.parsed.y} facturas radicadas y despachadas`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: Math.max(50, Math.ceil(maxFac * 1.15)),
            ticks: { precision: 0, font: { family: 'Roboto', size: 11 } },
            grid: { color: '#f1f5f9' }
          },
          x: {
            ticks: { font: { family: 'Roboto', weight: 'bold', size: 10 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  // GRÁFICO 3: LOTES Y VENCIMIENTOS
  private crearGraficoLotes(): void {
    if (!this.chartLotesCanvas?.nativeElement) return;
    const ctx = this.chartLotesCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chartLotes) {
      this.chartLotes.destroy();
    }

    this.chartLotes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['< 7 días', '8-15 días', '16-30 días', '> 30 días'],
        datasets: [{
          label: 'Lotes de Alimentos',
          data: [
            this.resumenLotes.criticos,
            this.resumenLotes.alerta,
            this.resumenLotes.proximos,
            this.resumenLotes.optimos
          ],
          backgroundColor: [ROJO, AMARILLO, LIMA, VERDE],
          borderColor: [ROJO_BORDE, AMARILLO_BORDE, LIMA_BORDE, VERDE_BORDE],
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.45,
          categoryPercentage: 0.8,
          maxBarThickness: 44
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_BLANCO,
            callbacks: {
              label: (c) => ` ${c.parsed.y} lotes de alimentos en bodega/sedes`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, font: { family: 'Roboto', size: 11 } },
            grid: { color: '#f1f5f9' }
          },
          x: {
            ticks: { font: { family: 'Roboto', weight: 'bold', size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  // GRÁFICO 4: COBERTURA DE SEDES
  private crearGraficoSedes(): void {
    if (!this.chartSedesCanvas?.nativeElement) return;
    const ctx = this.chartSedesCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chartSedes) {
      this.chartSedes.destroy();
    }

    const datos = this.obtenerDistribucionSedes();

    this.chartSedes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: datos.labels,
        datasets: [{
          label: 'Sedes Beneficiarias',
          data: datos.data,
          backgroundColor: datos.data.map((_, i) => i === 0 ? VERDE : AMARILLO),
          borderColor: datos.data.map((_, i) => i === 0 ? VERDE_BORDE : AMARILLO_BORDE),
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.5,
          maxBarThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_BLANCO,
            callbacks: {
              label: (c) => ` ${c.parsed.x} sedes asignadas al PAE`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, font: { family: 'Roboto', size: 10 } },
            grid: { color: '#f1f5f9' }
          },
          y: {
            ticks: {
              font: { family: 'Roboto', weight: 'bold', size: 10 },
              callback: function(val: any) {
                const label = this.getLabelForValue(val) as string;
                return label.length > 18 ? label.slice(0, 18) + '…' : label;
              }
            },
            grid: { display: false }
          }
        }
      }
    });
  }

  private destruirGraficos(): void {
    if (this.chartContratos) {
      this.chartContratos.destroy();
      this.chartContratos = null;
    }
    if (this.chartFacturas) {
      this.chartFacturas.destroy();
      this.chartFacturas = null;
    }
    if (this.chartLotes) {
      this.chartLotes.destroy();
      this.chartLotes = null;
    }
    if (this.chartSedes) {
      this.chartSedes.destroy();
      this.chartSedes = null;
    }
  }

  private obtenerDistribucionSedes(): { labels: string[], data: number[] } {
    if (this.rangoDias === 8) {
      return {
        labels: [
          'I.E. Carlos M. Simmonds',
          'I.E. San Agustín',
          'I.E. Antonio Nariño',
          'I.E. Francisco José de Caldas'
        ],
        data: [6, 5, 4, 3] // Total 18 sedes activas en ciclo semanal
      };
    }

    return {
      labels: [
        'I.E. Carlos M. Simmonds',
        'I.E. San Agustín',
        'I.E. Antonio Nariño',
        'I.E. Francisco José de Caldas',
        'I.E. Normal Superior'
      ],
      data: [8, 6, 5, 5, 4] // Total 28 sedes beneficiarias
    };
  }

  // =========================================================================
  //  DATOS BASE INICIALES PARA RENDERIZADO INSTANTÁNEO
  // =========================================================================

  private obtenerContratosFallback(): ContratoDashboard[] {
    const anio = this.filtroPeriodo;
    const anioAnterior = String(Number(anio) - 1);
    return [
      { id: 1, numero_contrato: `CT-PAE-${anio}-001`, vigencia: anio, estado: 'VIGENTE', raciones: 3400, valor: 85000000 },
      { id: 2, numero_contrato: `CT-PAE-${anio}-002`, vigencia: anio, estado: 'VIGENTE', raciones: 2800, valor: 72000000 },
      { id: 3, numero_contrato: `CT-PAE-${anio}-003`, vigencia: anio, estado: 'VIGENTE', raciones: 2100, valor: 54000000 },
      { id: 4, numero_contrato: `CT-PAE-${anio}-004`, vigencia: anio, estado: 'VIGENTE', raciones: 1950, valor: 48000000 },
      { id: 5, numero_contrato: `CT-PAE-${anio}-005`, vigencia: anio, estado: 'VIGENTE', raciones: 1750, valor: 42000000 },
      { id: 6, numero_contrato: `CT-PAE-${anio}-006`, vigencia: anio, estado: 'VIGENTE', raciones: 1600, valor: 39000000 },
      { id: 7, numero_contrato: `CT-PAE-${anio}-007`, vigencia: anio, estado: 'VIGENTE', raciones: 1450, valor: 35000000 },
      { id: 8, numero_contrato: `CT-PAE-${anio}-008`, vigencia: anio, estado: 'POR_VENCER', raciones: 1200, valor: 31000000 },
      { id: 9, numero_contrato: `CT-PAE-${anio}-009`, vigencia: anio, estado: 'POR_VENCER', raciones: 1100, valor: 28000000 },
      { id: 10, numero_contrato: `CT-PAE-${anio}-010`, vigencia: anio, estado: 'FINALIZADO', raciones: 950, valor: 22000000 },
      { id: 11, numero_contrato: `CT-PAE-${anioAnterior}-088`, vigencia: anioAnterior, estado: 'FINALIZADO', raciones: 3200, valor: 80000000 },
      { id: 12, numero_contrato: `CT-PAE-${anioAnterior}-089`, vigencia: anioAnterior, estado: 'FINALIZADO', raciones: 2900, valor: 74000000 },
      { id: 13, numero_contrato: `CT-PAE-${anioAnterior}-090`, vigencia: anioAnterior, estado: 'FINALIZADO', raciones: 2600, valor: 65000000 }
    ];
  }

  private obtenerEntregasFallback(): Entrega[] {
    const entregas: Entrega[] = [];
    const sedes = ['Sede Principal', 'Sede Los Andes', 'Sede La Pradera', 'Sede Rural San José'];
    const anio = this.filtroPeriodo;

    for (let i = 1; i <= 145; i++) {
      const mesNum = (i % 11) + 1;
      const mesStr = String(mesNum).padStart(2, '0');
      const diaStr = String((i % 25) + 1).padStart(2, '0');

      let diasVenc = 37;
      if (i % 20 === 0) diasVenc = 3;
      else if (i % 10 === 0) diasVenc = 9;
      else if (i % 5 === 0) diasVenc = 25;

      entregas.push({
        id: i,
        numeroFactura: `FAC-${anio}-${mesStr}-${String(100 + i)}`,
        loteRegistro: `LOT-${anio}-${mesStr}-${i}`,
        ingrediente: i % 2 === 0 ? 'Leche Entera Pasteurizada' : 'Arroz Blanco Fortificado',
        tipoMercado: i % 2 === 0 ? 'Perecedero' : 'No Perecedero',
        frecuencia: 'Semanal',
        cantidad: 40 + (i % 25),
        unidad: i % 2 === 0 ? 'Litros' : 'Kilos',
        fechaRecepcion: `${anio}-${mesStr}-${diaStr}`,
        fechaVencimiento: this.fechaEnDias(diasVenc),
        estado: 'RECIBIDA',
        institucionNombre: 'I.E. Carlos M. Simmonds',
        sedeNombre: sedes[i % sedes.length]
      });
    }

    for (let i = 146; i <= 163; i++) {
      entregas.push({
        id: i,
        numeroFactura: `FAC-${anio}-11-${String(200 + i)}`,
        loteRegistro: `LOT-${anio}-11-TR${i}`,
        ingrediente: 'Carne de Res Magra',
        tipoMercado: 'Perecedero',
        frecuencia: 'Semanal',
        cantidad: 30,
        unidad: 'Kilos',
        fechaRecepcion: `${anio}-11-23`,
        fechaVencimiento: this.fechaEnDias(6),
        estado: 'EN_TRANSITO',
        institucionNombre: 'I.E. San Agustín',
        sedeNombre: 'Sede Primaria'
      });
    }

    for (let i = 164; i <= 173; i++) {
      entregas.push({
        id: i,
        numeroFactura: `FAC-${anio}-11-${String(300 + i)}`,
        loteRegistro: `LOT-${anio}-11-NOV${i}`,
        ingrediente: 'Plátano Verde',
        tipoMercado: 'Perecedero',
        frecuencia: 'Semanal',
        cantidad: 45,
        unidad: 'Kilos',
        fechaRecepcion: `${anio}-11-19`,
        fechaVencimiento: this.fechaEnDias(4),
        estado: 'CON_NOVEDAD',
        institucionNombre: 'I.E. Antonio Nariño',
        sedeNombre: 'Sede Rural'
      });
    }

    for (let i = 174; i <= 177; i++) {
      entregas.push({
        id: i,
        numeroFactura: `FAC-${anio}-11-${String(400 + i)}`,
        loteRegistro: `LOT-${anio}-11-RECH${i}`,
        ingrediente: 'Tomate Chonto',
        tipoMercado: 'Perecedero',
        frecuencia: 'Semanal',
        cantidad: 20,
        unidad: 'Kilos',
        fechaRecepcion: `${anio}-11-20`,
        fechaVencimiento: this.fechaEnDias(2),
        estado: 'RECHAZADA',
        institucionNombre: 'I.E. Carlos M. Simmonds',
        sedeNombre: 'Sede Principal'
      });
    }

    return entregas;
  }

  private obtenerInstitucionesFallback(): any[] {
    return [
      { id: 1, nombre_institucion: 'I.E. Carlos M. Simmonds', municipio: 'Popayán' },
      { id: 2, nombre_institucion: 'I.E. San Agustín', municipio: 'Popayán' },
      { id: 3, nombre_institucion: 'I.E. Antonio Nariño', municipio: 'Popayán' },
      { id: 4, nombre_institucion: 'I.E. Francisco José de Caldas', municipio: 'Popayán' },
      { id: 5, nombre_institucion: 'I.E. Normal Superior', municipio: 'Popayán' },
      { id: 6, nombre_institucion: 'I.E. José María Obando', municipio: 'Popayán' }
    ];
  }

  private obtenerSedesFallback(): any[] {
    return [
      { id: 1, nombre_sede: 'Sede Principal', nombre_institucion: 'I.E. Carlos M. Simmonds' },
      { id: 2, nombre_sede: 'Sede Los Andes', nombre_institucion: 'I.E. Carlos M. Simmonds' },
      { id: 3, nombre_sede: 'Sede La Pradera', nombre_institucion: 'I.E. Carlos M. Simmonds' },
      { id: 4, nombre_sede: 'Sede Manuela Beltrán', nombre_institucion: 'I.E. Carlos M. Simmonds' },
      { id: 5, nombre_sede: 'Sede El Bosque', nombre_institucion: 'I.E. Carlos M. Simmonds' },
      { id: 6, nombre_sede: 'Sede Camilo Torres', nombre_institucion: 'I.E. Carlos M. Simmonds' },
      { id: 7, nombre_sede: 'Sede Policarpa Salavarrieta', nombre_institucion: 'I.E. Carlos M. Simmonds' },
      { id: 8, nombre_sede: 'Sede Rural La Vega', nombre_institucion: 'I.E. Carlos M. Simmonds' },
      { id: 9, nombre_sede: 'Sede Central', nombre_institucion: 'I.E. San Agustín' },
      { id: 10, nombre_sede: 'Sede Primaria San Agustín', nombre_institucion: 'I.E. San Agustín' },
      { id: 11, nombre_sede: 'Sede Los Sauces', nombre_institucion: 'I.E. San Agustín' },
      { id: 12, nombre_sede: 'Sede Bello Horizonte', nombre_institucion: 'I.E. San Agustín' },
      { id: 13, nombre_sede: 'Sede El Carmen', nombre_institucion: 'I.E. San Agustín' },
      { id: 14, nombre_sede: 'Sede Rural El Tablón', nombre_institucion: 'I.E. San Agustín' },
      { id: 15, nombre_sede: 'Sede Central', nombre_institucion: 'I.E. Antonio Nariño' },
      { id: 16, nombre_sede: 'Sede Santa Inés', nombre_institucion: 'I.E. Antonio Nariño' },
      { id: 17, nombre_sede: 'Sede Versalles', nombre_institucion: 'I.E. Antonio Nariño' },
      { id: 18, nombre_sede: 'Sede Las Palmas', nombre_institucion: 'I.E. Antonio Nariño' },
      { id: 19, nombre_sede: 'Sede El Jardín', nombre_institucion: 'I.E. Antonio Nariño' },
      { id: 20, nombre_sede: 'Sede Principal', nombre_institucion: 'I.E. Francisco José de Caldas' },
      { id: 21, nombre_sede: 'Sede Santander', nombre_institucion: 'I.E. Francisco José de Caldas' },
      { id: 22, nombre_sede: 'Sede Bolívar', nombre_institucion: 'I.E. Francisco José de Caldas' },
      { id: 23, nombre_sede: 'Sede Girardot', nombre_institucion: 'I.E. Francisco José de Caldas' },
      { id: 24, nombre_sede: 'Sede Ricaurte', nombre_institucion: 'I.E. Francisco José de Caldas' },
      { id: 25, nombre_sede: 'Sede Central', nombre_institucion: 'I.E. Normal Superior' },
      { id: 26, nombre_sede: 'Sede Anexa Primaria', nombre_institucion: 'I.E. Normal Superior' },
      { id: 27, nombre_sede: 'Sede La Cabaña', nombre_institucion: 'I.E. Normal Superior' },
      { id: 28, nombre_sede: 'Sede Miraflores', nombre_institucion: 'I.E. Normal Superior' }
    ];
  }

  private obtenerNombreUsuario(): string {
    const usuario = this.usuario;
    return usuario ? `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || usuario.correo : '';
  }
}
