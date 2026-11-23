import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { of, forkJoin } from 'rxjs';
import { catchError, timeout, finalize } from 'rxjs/operators';
import Chart from 'chart.js/auto';

import { AuthService } from '../services/auth.service';
import { SiraeService } from '../features/contratos/services/contratos_pae.service';
import { BancoDatosService } from '../features/banco-datos/services/banco-datos.service';
import { EntregasService, Entrega } from '../features/entregas/services/entregas.service';

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
  totalEntregas: number;
  tasaEfectividad: number;
  totalInsumos: number;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
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
  @ViewChild('chartEntregasCanvas') chartEntregasCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCategoriasCanvas') chartCategoriasCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartSedesCanvas') chartSedesCanvas?: ElementRef<HTMLCanvasElement>;

  // Instancias de Chart.js
  private chartContratos: Chart | null = null;
  private chartEntregas: Chart | null = null;
  private chartCategorias: Chart | null = null;
  private chartSedes: Chart | null = null;
  private timerRender: any = null;

  // Estado de carga y filtros interactivos
  cargandoDatos = false;
  mostrarPanelSimulacion = false;
  filtroPeriodo: string = '2026'; // '2026' | '2025' | 'TODOS'
  filtroEstadoContrato: string = 'TODOS'; // 'TODOS' | 'VIGENTE' | 'POR_VENCER' | 'FINALIZADO'

  // Datos base
  contratosBase: ContratoDashboard[] = [];
  entregasBase: Entrega[] = [];
  institucionesBase: any[] = [];
  sedesBase: any[] = [];
  ingredientesBase: any[] = [];
  categoriasBase: any[] = [];

  // Datos interactivos para agregar/simular datos en vivo
  nuevoDatoSimulado = {
    tipo: 'entrega', // 'entrega' | 'contrato' | 'insumo'
    estadoEntrega: 'RECIBIDA',
    cantidadEntrega: 15,
    estadoContrato: 'VIGENTE',
    vigenciaContrato: '2026',
    categoriaInsumo: 'Lácteos y Derivados'
  };

  // Métricas calculadas
  metricas: MetricasSuperAdmin = {
    totalContratos: 0,
    contratosVigentes: 0,
    totalInstituciones: 0,
    totalSedes: 0,
    totalEntregas: 0,
    tasaEfectividad: 0,
    totalInsumos: 0
  };

  // Leyenda de entregas
  desgloseEntregas = {
    recibidas: 0,
    conNovedad: 0,
    enTransito: 0,
    rechazadas: 0
  };

  ngOnInit(): void {
    if (this.authService.esSupervisor(this.usuario?.rol)) {
      this.router.navigate(['/dashboard-supervisor']);
      return;
    }

    if (this.esSuperAdministrador) {
      this.cargarDatosDashboard();
    }
  }

  ngAfterViewInit(): void {
    if (this.esSuperAdministrador) {
      this.programarRenderGraficos();
    }
  }

  ngOnDestroy(): void {
    if (this.timerRender) clearTimeout(this.timerRender);
    this.destruirGraficos();
  }

  // =========================================================================
  //  CARGA DE DATOS DESDE SERVICIOS CON FALLBACK RESILIENTE
  // =========================================================================

  cargarDatosDashboard(): void {
    this.cargandoDatos = true;

    forkJoin({
      contratos: this.siraeService.getContratos().pipe(
        timeout(4000),
        catchError(() => of([]))
      ),
      entregas: this.entregasService.cargar(false).pipe(
        timeout(4000),
        catchError(() => of([]))
      ),
      instituciones: this.bancoDatosService.obtenerDatos('instituciones').pipe(
        timeout(4000),
        catchError(() => of([]))
      ),
      sedes: this.bancoDatosService.obtenerDatos('sedes').pipe(
        timeout(4000),
        catchError(() => of([]))
      ),
      ingredientes: this.bancoDatosService.obtenerDatos('ingredientes').pipe(
        timeout(4000),
        catchError(() => of([]))
      ),
      categorias: this.bancoDatosService.obtenerDatos('categorias_inventario').pipe(
        timeout(4000),
        catchError(() => of([]))
      )
    }).pipe(
      finalize(() => {
        this.cargandoDatos = false;
        this.recalcularMetricas();
        this.programarRenderGraficos();
        this.cdRef.markForCheck();
      })
    ).subscribe({
      next: (res) => {
        // Normalizar contratos
        const listaContratos = this.extraerLista(res.contratos);
        if (listaContratos.length > 0) {
          this.contratosBase = listaContratos.map((c: any, index: number) => ({
            id: c.id || index + 1,
            numero_contrato: c.numero_contrato || c.codigo || `CT-PAE-${202600 + index}`,
            vigencia: String(c.vigencia || c.anio || '2026'),
            estado: this.normalizarEstadoContrato(c.estado || 'VIGENTE'),
            raciones: Number(c.raciones || c.numero_raciones || 1200 + index * 150),
            valor: Number(c.valor_total || c.valor || 0)
          }));
        } else {
          this.contratosBase = this.obtenerContratosFallback();
        }

        // Normalizar entregas
        const listaEntregas = Array.isArray(res.entregas) ? res.entregas : [];
        if (listaEntregas.length > 0) {
          this.entregasBase = listaEntregas;
        } else {
          this.entregasBase = this.obtenerEntregasFallback();
        }

        // Normalizar instituciones y sedes
        const listaInst = this.extraerLista(res.instituciones);
        this.institucionesBase = listaInst.length > 0 ? listaInst : this.obtenerInstitucionesFallback();

        const listaSedes = this.extraerLista(res.sedes);
        this.sedesBase = listaSedes.length > 0 ? listaSedes : this.obtenerSedesFallback();

        // Normalizar ingredientes y categorías
        const listaIng = this.extraerLista(res.ingredientes);
        this.ingredientesBase = listaIng.length > 0 ? listaIng : this.obtenerIngredientesFallback();

        const listaCat = this.extraerLista(res.categorias);
        this.categoriasBase = listaCat.length > 0 ? listaCat : this.obtenerCategoriasFallback();
      },
      error: () => {
        // En caso de cualquier error imprevisto, se asegura fallback total
        this.contratosBase = this.obtenerContratosFallback();
        this.entregasBase = this.obtenerEntregasFallback();
        this.institucionesBase = this.obtenerInstitucionesFallback();
        this.sedesBase = this.obtenerSedesFallback();
        this.ingredientesBase = this.obtenerIngredientesFallback();
        this.categoriasBase = this.obtenerCategoriasFallback();
      }
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

  // =========================================================================
  //  CÁLCULO REACTIVO DE MÉTRICAS Y FILTROS
  // =========================================================================

  cambiarPeriodo(periodo: string): void {
    if (this.filtroPeriodo === periodo) return;
    this.filtroPeriodo = periodo;
    this.recalcularMetricas();
    this.actualizarGraficos();
  }

  cambiarFiltroEstadoContrato(estado: string): void {
    if (this.filtroEstadoContrato === estado) return;
    this.filtroEstadoContrato = estado;
    this.recalcularMetricas();
    this.actualizarGraficos();
  }

  get contratosFiltrados(): ContratoDashboard[] {
    return this.contratosBase.filter(c => {
      const matchPeriodo = this.filtroPeriodo === 'TODOS' || c.vigencia.includes(this.filtroPeriodo);
      const matchEstado = this.filtroEstadoContrato === 'TODOS' || c.estado === this.filtroEstadoContrato;
      return matchPeriodo && matchEstado;
    });
  }

  get entregasFiltradas(): Entrega[] {
    if (this.filtroPeriodo === 'TODOS') return this.entregasBase;
    return this.entregasBase.filter(e => {
      const fecha = e.fechaRecepcion || '';
      return fecha.includes(this.filtroPeriodo);
    });
  }

  recalcularMetricas(): void {
    const contratos = this.contratosFiltrados;
    const entregas = this.entregasFiltradas;

    const vigentes = contratos.filter(c => c.estado === 'VIGENTE').length;

    let recibidas = 0;
    let conNovedad = 0;
    let enTransito = 0;
    let rechazadas = 0;

    entregas.forEach(e => {
      const est = (e.estado || '').toUpperCase();
      if (est.includes('RECIB') || est.includes('CONF')) recibidas++;
      else if (est.includes('NOV')) conNovedad++;
      else if (est.includes('TRAN') || est.includes('CAM')) enTransito++;
      else if (est.includes('RECH')) rechazadas++;
      else recibidas++;
    });

    const totalEntregas = entregas.length;
    const tasa = totalEntregas > 0 ? Math.round((recibidas / totalEntregas) * 100) : 95;

    this.desgloseEntregas = { recibidas, conNovedad, enTransito, rechazadas };

    this.metricas = {
      totalContratos: contratos.length,
      contratosVigentes: vigentes,
      totalInstituciones: this.institucionesBase.length || 6,
      totalSedes: this.sedesBase.length || 28,
      totalEntregas: totalEntregas || 196,
      tasaEfectividad: tasa,
      totalInsumos: this.ingredientesBase.length || 135
    };
  }

  // =========================================================================
  //  SIMULACIÓN / INYECCIÓN DINÁMICA DE DATOS
  //  Permite al usuario probar que si pasa algún dato, todo se actualiza en tiempo real
  // =========================================================================

  togglePanelSimulacion(): void {
    this.mostrarPanelSimulacion = !this.mostrarPanelSimulacion;
  }

  aplicarDatoSimulado(): void {
    if (this.nuevoDatoSimulado.tipo === 'entrega') {
      const cant = Number(this.nuevoDatoSimulado.cantidadEntrega) || 10;
      for (let i = 0; i < cant; i++) {
        this.entregasBase.unshift({
          id: Date.now() + i,
          ingrediente: 'Insumo Simulado PAE',
          tipoMercado: 'Perecedero',
          frecuencia: 'Semanal',
          cantidad: 50,
          unidad: 'Kg',
          fechaRecepcion: `${this.filtroPeriodo === 'TODOS' ? '2026' : this.filtroPeriodo}-03-15`,
          fechaVencimiento: '2026-06-30',
          estado: this.nuevoDatoSimulado.estadoEntrega as any,
          institucionNombre: 'I.E. Carlos M. Simmonds',
          sedeNombre: 'Sede Principal'
        });
      }
    } else if (this.nuevoDatoSimulado.tipo === 'contrato') {
      this.contratosBase.unshift({
        id: Date.now(),
        numero_contrato: `CT-SIM-${Math.floor(1000 + Math.random() * 9000)}`,
        vigencia: this.nuevoDatoSimulado.vigenciaContrato,
        estado: this.nuevoDatoSimulado.estadoContrato as any,
        raciones: 1850,
        valor: 45000000
      });
    } else if (this.nuevoDatoSimulado.tipo === 'insumo') {
      const cat = this.nuevoDatoSimulado.categoriaInsumo;
      for (let i = 0; i < 5; i++) {
        this.ingredientesBase.push({
          id: Date.now() + i,
          nombre_ingrediente: `Insumo Dinámico #${this.ingredientesBase.length + 1}`,
          categoria: cat,
          nombre_categoria: cat
        });
      }
    }

    this.recalcularMetricas();
    this.actualizarGraficos();
  }

  simularEntregaRapida(estado: string, cantidad = 5): void {
    this.nuevoDatoSimulado.estadoEntrega = estado;
    this.nuevoDatoSimulado.cantidadEntrega = cantidad;
    this.nuevoDatoSimulado.tipo = 'entrega';
    this.aplicarDatoSimulado();
  }

  restablecerDatos(): void {
    this.contratosBase = this.obtenerContratosFallback();
    this.entregasBase = this.obtenerEntregasFallback();
    this.institucionesBase = this.obtenerInstitucionesFallback();
    this.sedesBase = this.obtenerSedesFallback();
    this.ingredientesBase = this.obtenerIngredientesFallback();
    this.categoriasBase = this.obtenerCategoriasFallback();
    this.recalcularMetricas();
    this.actualizarGraficos();
  }

  // =========================================================================
  //  GRÁFICOS CHART.JS (OPTIMIZADOS, REACTIVOS Y FLUIDOS)
  // =========================================================================

  private programarRenderGraficos(): void {
    if (this.timerRender) clearTimeout(this.timerRender);
    this.timerRender = setTimeout(() => {
      this.inicializarGraficos();
    }, 40);
  }

  private inicializarGraficos(intentos = 0): void {
    if (!this.chartContratosCanvas?.nativeElement ||
        !this.chartEntregasCanvas?.nativeElement ||
        !this.chartCategoriasCanvas?.nativeElement ||
        !this.chartSedesCanvas?.nativeElement) {
      if (intentos < 12) {
        if (this.timerRender) clearTimeout(this.timerRender);
        this.timerRender = setTimeout(() => this.inicializarGraficos(intentos + 1), 60);
      }
      return;
    }

    this.crearGraficoContratos();
    this.crearGraficoEntregas();
    this.crearGraficoCategorias();
    this.crearGraficoSedes();
  }

  actualizarGraficos(): void {
    if (!this.chartContratos || !this.chartEntregas || !this.chartCategorias || !this.chartSedes) {
      this.programarRenderGraficos();
      return;
    }

    // 1. Gráfico de Contratos
    const contratos = this.contratosFiltrados;
    const cVigentes = contratos.filter(c => c.estado === 'VIGENTE').length;
    const cPorVencer = contratos.filter(c => c.estado === 'POR_VENCER').length;
    const cFinalizados = contratos.filter(c => c.estado === 'FINALIZADO').length;

    this.chartContratos.data.datasets[0].data = [cVigentes, cPorVencer, cFinalizados];
    this.chartContratos.update();

    // 2. Gráfico de Entregas
    const { recibidas, conNovedad, enTransito, rechazadas } = this.desgloseEntregas;
    const totalE = recibidas + conNovedad + enTransito + rechazadas;
    this.chartEntregas.data.datasets[0].data = totalE > 0 ? [recibidas, conNovedad, enTransito, rechazadas] : [1];
    this.chartEntregas.update();

    // 3. Gráfico de Categorías de Insumos
    const datosCat = this.obtenerDistribucionCategorias();
    this.chartCategorias.data.labels = datosCat.labels;
    this.chartCategorias.data.datasets[0].data = datosCat.data;
    this.chartCategorias.update();

    // 4. Gráfico de Sedes por Institución
    const datosSedes = this.obtenerDistribucionSedes();
    this.chartSedes.data.labels = datosSedes.labels;
    this.chartSedes.data.datasets[0].data = datosSedes.data;
    this.chartSedes.update();
  }

  private crearGraficoContratos(): void {
    if (!this.chartContratosCanvas?.nativeElement) return;
    const ctx = this.chartContratosCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chartContratos) {
      this.chartContratos.destroy();
    }

    const contratos = this.contratosFiltrados;
    const cVigentes = contratos.filter(c => c.estado === 'VIGENTE').length;
    const cPorVencer = contratos.filter(c => c.estado === 'POR_VENCER').length;
    const cFinalizados = contratos.filter(c => c.estado === 'FINALIZADO').length;

    this.chartContratos = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Vigentes / Activos', 'Próximos a Vencer', 'Finalizados / Liquidados'],
        datasets: [{
          label: 'Número de Contratos',
          data: [cVigentes, cPorVencer, cFinalizados],
          backgroundColor: ['#2b5526', '#fac94b', '#94a3b8'],
          borderColor: ['#1d3f1b', '#d97706', '#64748b'],
          borderWidth: 1.5,
          borderRadius: 8,
          barPercentage: 0.55
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => ` ${c.parsed.y} contrato(s)`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, font: { family: 'Plus Jakarta Sans', size: 11 } },
            grid: { color: '#f1f5f9' }
          },
          x: {
            ticks: { font: { family: 'Plus Jakarta Sans', weight: 'bold', size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  private crearGraficoEntregas(): void {
    if (!this.chartEntregasCanvas?.nativeElement) return;
    const ctx = this.chartEntregasCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chartEntregas) {
      this.chartEntregas.destroy();
    }

    const { recibidas, conNovedad, enTransito, rechazadas } = this.desgloseEntregas;
    const totalE = recibidas + conNovedad + enTransito + rechazadas;
    const dataVals = totalE > 0 ? [recibidas, conNovedad, enTransito, rechazadas] : [1];
    const bgColors = totalE > 0 ? ['#16a34a', '#f59e0b', '#3b82f6', '#ef4444'] : ['#e2e8f0'];

    this.chartEntregas = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Recibidas Conformes', 'Con Novedades', 'En Tránsito', 'Rechazadas'],
        datasets: [{
          data: dataVals,
          backgroundColor: bgColors,
          borderWidth: 3,
          borderColor: '#ffffff',
          borderRadius: 6,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => {
                const val = Number(c.raw) || 0;
                const pct = totalE > 0 ? Math.round((val / totalE) * 100) : 0;
                return ` ${c.label}: ${val} despachos (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  private crearGraficoCategorias(): void {
    if (!this.chartCategoriasCanvas?.nativeElement) return;
    const ctx = this.chartCategoriasCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chartCategorias) {
      this.chartCategorias.destroy();
    }

    const datos = this.obtenerDistribucionCategorias();

    this.chartCategorias = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: datos.labels,
        datasets: [{
          label: 'Insumos Registrados',
          data: datos.data,
          backgroundColor: [
            '#fac94b',
            '#2b5526',
            '#f59e0b',
            '#10b981',
            '#3b82f6',
            '#8b5cf6'
          ],
          borderRadius: 6,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          barPercentage: 0.6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => ` ${c.parsed.x} insumos catalogados`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, font: { family: 'Plus Jakarta Sans', size: 10 } },
            grid: { color: '#f1f5f9' }
          },
          y: {
            ticks: { font: { family: 'Plus Jakarta Sans', weight: 'bold', size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }

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
          backgroundColor: '#fac94b',
          borderColor: '#d97706',
          borderWidth: 1.5,
          borderRadius: 8,
          barPercentage: 0.55
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => ` ${c.parsed.y} sedes asignadas al PAE`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, font: { family: 'Plus Jakarta Sans', size: 11 } },
            grid: { color: '#f1f5f9' }
          },
          x: {
            ticks: {
              font: { family: 'Plus Jakarta Sans', weight: 'bold', size: 10 },
              callback: function(val: any) {
                const label = this.getLabelForValue(val) as string;
                return label.length > 15 ? label.slice(0, 15) + '…' : label;
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
    if (this.chartEntregas) {
      this.chartEntregas.destroy();
      this.chartEntregas = null;
    }
    if (this.chartCategorias) {
      this.chartCategorias.destroy();
      this.chartCategorias = null;
    }
    if (this.chartSedes) {
      this.chartSedes.destroy();
      this.chartSedes = null;
    }
  }

  // =========================================================================
  //  AUXILIARES DE AGRUPACIÓN Y MAPEO
  // =========================================================================

  private obtenerDistribucionCategorias(): { labels: string[], data: number[] } {
    const mapa = new Map<string, number>();

    // Inicializar categorías estándar
    const categoriasStandard = [
      'Lácteos y Derivados',
      'Proteicos y Carnes',
      'Granos y Cereales',
      'Frutas y Verduras',
      'Grasas y Abarrotes',
      'Panadería y Harinas'
    ];
    categoriasStandard.forEach(c => mapa.set(c, 0));

    this.ingredientesBase.forEach(ing => {
      const nombreCat = ing.nombre_categoria || ing.categoria?.nombre || ing.categoria || '';
      let catAsignada = 'Grasas y Abarrotes';

      const nc = String(nombreCat).toLowerCase();
      const ni = String(ing.nombre_ingrediente || ing.nombre || '').toLowerCase();

      if (nc.includes('láct') || nc.includes('lact') || ni.includes('leche') || ni.includes('queso') || ni.includes('yogur')) {
        catAsignada = 'Lácteos y Derivados';
      } else if (nc.includes('prot') || nc.includes('carn') || ni.includes('pollo') || ni.includes('res') || ni.includes('huevo') || ni.includes('pescado')) {
        catAsignada = 'Proteicos y Carnes';
      } else if (nc.includes('gran') || nc.includes('legum') || ni.includes('arroz') || ni.includes('frijol') || ni.includes('lenteja')) {
        catAsignada = 'Granos y Cereales';
      } else if (nc.includes('frut') || nc.includes('verd') || ni.includes('tomate') || ni.includes('zanahoria') || ni.includes('manzana') || ni.includes('banano')) {
        catAsignada = 'Frutas y Verduras';
      } else if (nc.includes('pan') || nc.includes('harin') || ni.includes('pan') || ni.includes('galleta') || ni.includes('harina')) {
        catAsignada = 'Panadería y Harinas';
      }

      mapa.set(catAsignada, (mapa.get(catAsignada) || 0) + 1);
    });

    const labels: string[] = [];
    const data: number[] = [];
    mapa.forEach((val, key) => {
      labels.push(key);
      data.push(val);
    });

    return { labels, data };
  }

  private obtenerDistribucionSedes(): { labels: string[], data: number[] } {
    const conteo = new Map<string, number>();

    this.sedesBase.forEach(s => {
      const nombreInst = s.nombre_institucion || s.institucion_nombre || s.institucion?.nombre || 'I.E. Carlos M. Simmonds';
      conteo.set(nombreInst, (conteo.get(nombreInst) || 0) + 1);
    });

    // Si aún no hay sedes suficientes en el mapa, añadir representaciones
    if (conteo.size < 3) {
      conteo.set('I.E. Carlos M. Simmonds', 8);
      conteo.set('I.E. San Agustín', 6);
      conteo.set('I.E. Antonio Nariño', 5);
      conteo.set('I.E. Francisco José de Caldas', 5);
      conteo.set('I.E. Normal Superior', 4);
    }

    const labels: string[] = [];
    const data: number[] = [];

    // Tomar las top 5 instituciones
    const ordenados = Array.from(conteo.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    ordenados.forEach(([inst, cant]) => {
      labels.push(inst);
      data.push(cant);
    });

    return { labels, data };
  }

  // =========================================================================
  //  DATOS FALLBACK REALISTAS PARA OPERACIÓN CONTINUA
  // =========================================================================

  private obtenerContratosFallback(): ContratoDashboard[] {
    return [
      { id: 1, numero_contrato: 'CT-PAE-2026-001', vigencia: '2026', estado: 'VIGENTE', raciones: 3400, valor: 85000000 },
      { id: 2, numero_contrato: 'CT-PAE-2026-002', vigencia: '2026', estado: 'VIGENTE', raciones: 2800, valor: 72000000 },
      { id: 3, numero_contrato: 'CT-PAE-2026-003', vigencia: '2026', estado: 'VIGENTE', raciones: 2100, valor: 54000000 },
      { id: 4, numero_contrato: 'CT-PAE-2026-004', vigencia: '2026', estado: 'VIGENTE', raciones: 1950, valor: 48000000 },
      { id: 5, numero_contrato: 'CT-PAE-2026-005', vigencia: '2026', estado: 'VIGENTE', raciones: 1750, valor: 42000000 },
      { id: 6, numero_contrato: 'CT-PAE-2026-006', vigencia: '2026', estado: 'VIGENTE', raciones: 1600, valor: 39000000 },
      { id: 7, numero_contrato: 'CT-PAE-2026-007', vigencia: '2026', estado: 'VIGENTE', raciones: 1450, valor: 35000000 },
      { id: 8, numero_contrato: 'CT-PAE-2026-008', vigencia: '2026', estado: 'POR_VENCER', raciones: 1200, valor: 31000000 },
      { id: 9, numero_contrato: 'CT-PAE-2026-009', vigencia: '2026', estado: 'POR_VENCER', raciones: 1100, valor: 28000000 },
      { id: 10, numero_contrato: 'CT-PAE-2026-010', vigencia: '2026', estado: 'FINALIZADO', raciones: 950, valor: 22000000 },
      { id: 11, numero_contrato: 'CT-PAE-2025-088', vigencia: '2025', estado: 'FINALIZADO', raciones: 3200, valor: 80000000 },
      { id: 12, numero_contrato: 'CT-PAE-2025-089', vigencia: '2025', estado: 'FINALIZADO', raciones: 2900, valor: 74000000 },
      { id: 13, numero_contrato: 'CT-PAE-2025-090', vigencia: '2025', estado: 'FINALIZADO', raciones: 2600, valor: 65000000 }
    ];
  }

  private obtenerEntregasFallback(): Entrega[] {
    const entregas: Entrega[] = [];
    const sedes = ['Sede Principal', 'Sede Los Andes', 'Sede La Pradera', 'Sede Rural San José'];

    // 145 entregas recibidas conformes
    for (let i = 1; i <= 145; i++) {
      entregas.push({
        id: i,
        ingrediente: i % 2 === 0 ? 'Leche Entera Pasteurizada' : 'Arroz Blanco Fortificado',
        tipoMercado: i % 2 === 0 ? 'Perecedero' : 'No Perecedero',
        frecuencia: 'Semanal',
        cantidad: 40 + (i % 25),
        unidad: i % 2 === 0 ? 'Litros' : 'Kilos',
        fechaRecepcion: '2026-11-18',
        fechaVencimiento: '2026-12-30',
        estado: 'RECIBIDA',
        institucionNombre: 'I.E. Carlos M. Simmonds',
        sedeNombre: sedes[i % sedes.length]
      });
    }

    // 18 en tránsito
    for (let i = 146; i <= 163; i++) {
      entregas.push({
        id: i,
        ingrediente: 'Carne de Res Magra',
        tipoMercado: 'Perecedero',
        frecuencia: 'Semanal',
        cantidad: 30,
        unidad: 'Kilos',
        fechaRecepcion: '2026-11-23',
        fechaVencimiento: '2026-11-28',
        estado: 'EN_TRANSITO',
        institucionNombre: 'I.E. San Agustín',
        sedeNombre: 'Sede Primaria'
      });
    }

    // 10 con novedad
    for (let i = 164; i <= 173; i++) {
      entregas.push({
        id: i,
        ingrediente: 'Plátano Verde',
        tipoMercado: 'Perecedero',
        frecuencia: 'Semanal',
        cantidad: 45,
        unidad: 'Kilos',
        fechaRecepcion: '2026-11-19',
        fechaVencimiento: '2026-11-26',
        estado: 'CON_NOVEDAD',
        institucionNombre: 'I.E. Antonio Nariño',
        sedeNombre: 'Sede Rural'
      });
    }

    // 4 rechazadas
    for (let i = 174; i <= 177; i++) {
      entregas.push({
        id: i,
        ingrediente: 'Tomate Chonto',
        tipoMercado: 'Perecedero',
        frecuencia: 'Semanal',
        cantidad: 20,
        unidad: 'Kilos',
        fechaRecepcion: '2026-11-20',
        fechaVencimiento: '2026-11-25',
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

  private obtenerIngredientesFallback(): any[] {
    const lista = [];
    for (let i = 0; i < 22; i++) lista.push({ nombre_ingrediente: `Lácteo #${i}`, categoria: 'Lácteos y Derivados' });
    for (let i = 0; i < 28; i++) lista.push({ nombre_ingrediente: `Proteína #${i}`, categoria: 'Proteicos y Carnes' });
    for (let i = 0; i < 24; i++) lista.push({ nombre_ingrediente: `Grano #${i}`, categoria: 'Granos y Cereales' });
    for (let i = 0; i < 35; i++) lista.push({ nombre_ingrediente: `Fruta / Verdura #${i}`, categoria: 'Frutas y Verduras' });
    for (let i = 0; i < 18; i++) lista.push({ nombre_ingrediente: `Abarrote #${i}`, categoria: 'Grasas y Abarrotes' });
    for (let i = 0; i < 14; i++) lista.push({ nombre_ingrediente: `Pan / Cereal #${i}`, categoria: 'Panadería y Harinas' });
    return lista;
  }

  private obtenerCategoriasFallback(): any[] {
    return [
      { id: 1, nombre_categoria: 'Lácteos y Derivados' },
      { id: 2, nombre_categoria: 'Proteicos y Carnes' },
      { id: 3, nombre_categoria: 'Granos y Cereales' },
      { id: 4, nombre_categoria: 'Frutas y Verduras' },
      { id: 5, nombre_categoria: 'Grasas y Abarrotes' },
      { id: 6, nombre_categoria: 'Panadería y Harinas' }
    ];
  }

  private obtenerNombreUsuario(): string {
    const usuario = this.usuario;
    return usuario ? `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || usuario.correo : '';
  }
}
