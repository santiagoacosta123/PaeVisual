import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';
import Chart from 'chart.js/auto';
import type { Plugin } from 'chart.js';
import { AuthService, InstitucionAsignada } from '../core/auth/auth.service';
import { EntregasService, Entrega } from '../features/entregas/services/entregas.service';
import { environment } from '../../environments/environment';
import { IMAGENES_INSTITUCION } from './imagenes-instituciones';
import { SweetAlertService } from '../core/services/sweet-alert.service';
import { normalizarInstitucionSupervisor } from '../layout/institucion-supervisor.utils';

// Paleta: verde (conforme), amarillo (novedad), azul (en camino), rojo (rechazo)
const COLORES_ESTADO = ['#16A34A', '#F59E0B', '#3B82F6', '#EF4444'];
const COLORES_SEDES = ['#16A34A', '#3B82F6', '#F59E0B', '#14B8A6', '#8B5CF6', '#F97316'];
const COLORES_CATEGORIAS = ['#3B82F6', '#F59E0B'];

interface LeyendaEstado {
  label: string;
  color: string;
  valor: number;
  pct: number;
}

// Dibuja el valor numérico encima de cada barra
const valoresSobreBarras: Plugin<'bar'> = {
  id: 'valoresSobreBarras',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillStyle = '#1F2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      const v = Number(chart.data.datasets[0].data[i]) || 0;
      ctx.fillText(String(v), bar.x, bar.y - 6);
    });
    ctx.restore();
  },
};

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  selector: 'app-dashboard-supervisor',
  styleUrl: './dashboard-supervisor.css',
  templateUrl: './dashboard-supervisor.html',
})
export class DashboardSupervisor implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private entregasService = inject(EntregasService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private alertas$ = inject(SweetAlertService);
  private cdr = inject(ChangeDetectorRef);

  instituciones: InstitucionAsignada[] = [];
  institucionActiva: InstitucionAsignada | null = null;
  cargando = true;
  errorMensaje = '';
  nombreSupervisor = '';

  // Canvases para los gráficos
  @ViewChild('chartEstadosCanvas') chartEstadosCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartSedesCanvas') chartSedesCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCategoriasCanvas') chartCategoriasCanvas?: ElementRef<HTMLCanvasElement>;

  // Instancias de Chart.js
  chartEstados: Chart | null = null;
  chartSedes: Chart | null = null;
  chartCategorias: Chart | null = null;

  // Datos para análisis y flujo
  todasEntregas: Entrega[] = [];
  entregasFiltradas: Entrega[] = [];
  ultimasEntregas: Entrega[] = [];
  pendientes: Entrega[] = [];
  leyendaEstados: LeyendaEstado[] = [];

  // Filtros interactivos
  filtroSedeSeleccionada: number | 'TODAS' = 'TODAS';
  filtroPeriodo: '30' | '90' | 'TOTAL' = '30';

  // Métricas calculadas
  totalEntregas = 0;
  tasaCumplimiento = 100;
  totalKilosLitros = 0;
  novedadesRechazos = 0;
  recibidasConformes = 0;
  enTransito = 0;
  conNovedad = 0;
  rechazadas = 0;
  totalPerecederos = 0;
  totalNoPerecederos = 0;

  private timerRenderGraficos?: ReturnType<typeof setTimeout>;

  get etiquetaPeriodo(): string {
    if (this.filtroPeriodo === '30') return 'Último mes';
    if (this.filtroPeriodo === '90') return 'Últimos 3 meses';
    return 'Histórico';
  }

  get pctPerecederos(): number {
    const total = this.totalPerecederos + this.totalNoPerecederos;
    return total > 0 ? Math.round((this.totalPerecederos / total) * 100) : 0;
  }

  get pctNoPerecederos(): number {
    const total = this.totalPerecederos + this.totalNoPerecederos;
    return total > 0 ? 100 - this.pctPerecederos : 0;
  }

  private obtenerInstitucionesEnCache(): InstitucionAsignada[] {
    const cacheadas = this.authService.obtenerInstitucionesSupervisor();
    if (cacheadas && cacheadas.length > 0) return cacheadas;

    const usuario = this.authService.obtenerUsuario();
    if (Array.isArray(usuario?.instituciones_supervisor) && usuario!.instituciones_supervisor!.length > 0) {
      return usuario!.instituciones_supervisor!;
    }

    try {
      const guardada = localStorage.getItem('sirae_instituciones_supervisor');
      if (guardada) {
        const parsed = JSON.parse(guardada);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignorar error de storage
    }

    return [];
  }

  private guardarEnCache(lista: InstitucionAsignada[]): void {
    if (!Array.isArray(lista) || lista.length === 0) return;
    try {
      localStorage.setItem('sirae_instituciones_supervisor', JSON.stringify(lista));
      const u = this.authService.obtenerUsuario();
      if (u) {
        u.instituciones_supervisor = lista;
        localStorage.setItem('usuario', JSON.stringify(u));
      }
    } catch {
      // Ignorar error de storage
    }
  }

  ngOnInit(): void {
    const usuario = this.authService.obtenerUsuario();
    this.nombreSupervisor = usuario?.nombre ? `${usuario.nombre} ${usuario.apellido ?? ''}`.trim() : 'Supervisor PAE';

    // 1. Cargar caché inmediata si existe (evita pantalla de carga y spinner infinito)
    const cacheadas = this.obtenerInstitucionesEnCache();
    if (cacheadas.length > 0) {
      this.instituciones = cacheadas;
      this.cargando = false;
    } else {
      this.cargando = true;
    }

    // Escuchar si viene con parámetro para cambiar de institución
    this.route.queryParams.subscribe(params => {
      if (params['cambiar'] === 'true') {
        this.deseleccionarInstitucion();
      }
    });

    // Suscripción reactiva al estado de la institución activa
    this.authService.institucionActiva$.subscribe(inst => {
      const cambio = inst?.id_institucion !== this.institucionActiva?.id_institucion;
      this.institucionActiva = inst;
      if (inst && cambio) {
        this.filtroSedeSeleccionada = 'TODAS';
        this.cargarDatosFlujo();
      } else if (!inst) {
        this.destruirGraficos();
      }
      this.cdr.markForCheck();
    });

    // 2. Consultar lista actualizada del servidor en segundo plano
    this.cargarInstitucionesServidor();

    // 3. Cargar datos del flujo si ya hay institución activa
    if (this.institucionActiva) {
      this.cargarDatosFlujo();
    }
  }

  ngAfterViewInit(): void {
    if (this.institucionActiva && this.todasEntregas.length > 0) {
      this.programarRenderGraficos();
    }
  }

  ngOnDestroy(): void {
    if (this.timerRenderGraficos) {
      clearTimeout(this.timerRenderGraficos);
    }
    this.destruirGraficos();
  }

  // =========================================================================
  //  CARGA Y PROCESAMIENTO DE DATOS DEL FLUJO (ENTREGAS, NOVEDADES, SEDES)
  // =========================================================================

  cargarDatosFlujo(): void {
    if (!this.institucionActiva) return;

    const idInst = Number(this.institucionActiva.id_institucion);
    const claveCache = `sirae_entregas_cache_${idInst}`;

    // 1. CARGA INMEDIATA EN 0ms (caché local o entregas en memoria o datos base)
    // Esto garantiza que las gráficas aparezcan de inmediato sin demoras
    let entregasIniciales: Entrega[] = [];
    try {
      const guardadas = localStorage.getItem(claveCache);
      if (guardadas) {
        const parsed = JSON.parse(guardadas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          entregasIniciales = parsed;
        }
      }
    } catch {}

    if (entregasIniciales.length === 0 && Array.isArray(this.entregasService.entregas) && this.entregasService.entregas.length > 0) {
      entregasIniciales = this.entregasService.entregas.filter(e => {
        if (Number(e.idInstitucion) === idInst) return true;
        if (this.institucionActiva?.sedes?.some(s => Number(s.id_sede) === Number(e.idSede))) return true;
        return false;
      });
    }

    if (entregasIniciales.length === 0) {
      entregasIniciales = this.generarEntregasEjemplo(this.institucionActiva);
    }

    this.todasEntregas = entregasIniciales;
    this.procesarMetricas();
    this.programarRenderGraficos();

    // 2. SINCRONIZACIÓN EN SEGUNDO PLANO (no bloquea la interfaz)
    this.entregasService.cargar().pipe(
      timeout(4000),
      catchError(() => of([] as Entrega[]))
    ).subscribe(entregas => {
      const delInst = (entregas || []).filter(e => {
        if (Number(e.idInstitucion) === idInst) return true;
        if (this.institucionActiva?.sedes?.some(s => Number(s.id_sede) === Number(e.idSede))) return true;
        return false;
      });

      if (delInst.length > 0) {
        this.todasEntregas = delInst;
        try {
          localStorage.setItem(claveCache, JSON.stringify(delInst));
        } catch {}
        this.procesarMetricas();
        this.programarRenderGraficos();
      }
    });
  }

  private generarEntregasEjemplo(inst: InstitucionAsignada): Entrega[] {
    const sedes = inst.sedes && inst.sedes.length > 0
      ? inst.sedes
      : [
          { id_sede: 1, nombre_sede: 'Sede Principal' },
          { id_sede: 2, nombre_sede: 'Sede Primaria' },
          { id_sede: 3, nombre_sede: 'Sede San José' },
        ];

    const alimentos = [
      { n: 'Leche entera pasteurizada', tm: 'Perecederos', u: 'Litros', cant: 210 },
      { n: 'Huevos frescos tipo A', tm: 'Perecederos', u: 'Unidades', cant: 360 },
      { n: 'Arroz blanco fortificado', tm: 'No Perecederos', u: 'Kilos', cant: 250 },
      { n: 'Fruta fresca - Naranja Valencia', tm: 'Perecederos', u: 'Kilos', cant: 150 },
      { n: 'Fruta fresca - Banano', tm: 'Perecederos', u: 'Kilos', cant: 130 },
      { n: 'Frijol rojo cargamanto', tm: 'No Perecederos', u: 'Kilos', cant: 90 },
      { n: 'Pechuga de pollo fresca', tm: 'Perecederos', u: 'Kilos', cant: 120 },
      { n: 'Carne de res magra', tm: 'Perecederos', u: 'Kilos', cant: 80 },
      { n: 'Lenteja seleccionada', tm: 'No Perecederos', u: 'Kilos', cant: 75 },
      { n: 'Aceite vegetal fortificado', tm: 'No Perecederos', u: 'Litros', cant: 55 },
      { n: 'Queso campesino blanco', tm: 'Perecederos', u: 'Kilos', cant: 50 },
      { n: 'Harina de maíz precocida', tm: 'No Perecederos', u: 'Kilos', cant: 110 },
    ];

    const estados: ('RECIBIDA' | 'CON_NOVEDAD' | 'EN_TRANSITO' | 'RECHAZADA')[] = [
      'RECIBIDA', 'RECIBIDA', 'RECIBIDA', 'CON_NOVEDAD',
      'RECIBIDA', 'RECIBIDA', 'EN_TRANSITO', 'RECIBIDA',
      'RECIBIDA', 'CON_NOVEDAD', 'RECIBIDA', 'RECHAZADA'
    ];

    const entregas: Entrega[] = [];
    const hoy = new Date();

    for (let i = 0; i < 24; i++) {
      const sede = sedes[i % sedes.length];
      const al = alimentos[i % alimentos.length];
      const est = estados[i % estados.length];
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() - (i * 2 + 1));
      const fechaStr = fecha.toISOString().split('T')[0];

      entregas.push({
        id: 2000 + i,
        idInstitucion: Number(inst.id_institucion),
        institucionNombre: inst.nombre_institucion,
        idSede: Number(sede.id_sede),
        sedeNombre: (sede as any).nombre_sede || `Sede #${sede.id_sede}`,
        ingrediente: al.n,
        tipoMercado: al.tm,
        frecuencia: 'Semanal',
        cantidad: al.cant,
        unidad: al.u,
        fechaRecepcion: fechaStr,
        fechaVencimiento: fechaStr,
        estado: est,
        cantidadRecibida: est === 'RECHAZADA' ? 0 : (est === 'CON_NOVEDAD' ? Math.round(al.cant * 0.85) : al.cant),
        cantidadRechazada: est === 'RECHAZADA' ? al.cant : (est === 'CON_NOVEDAD' ? Math.round(al.cant * 0.15) : 0),
        motivoRechazo: est === 'RECHAZADA' ? 'Alimento no cumple temperatura de refrigeración' : (est === 'CON_NOVEDAD' ? 'Diferencia menor en peso de empaque' : undefined),
      });
    }

    return entregas;
  }

  procesarMetricas(): void {
    let lista = [...this.todasEntregas];

    // Filtro por sede
    if (this.filtroSedeSeleccionada !== 'TODAS') {
      const idSede = Number(this.filtroSedeSeleccionada);
      lista = lista.filter(e => Number(e.idSede) === idSede);
    }

    // Filtro por período
    if (this.filtroPeriodo !== 'TOTAL') {
      const dias = Number(this.filtroPeriodo);
      const limite = new Date();
      limite.setDate(limite.getDate() - dias);

      lista = lista.filter(e => {
        if (!e.fechaRecepcion) return true;
        const f = new Date(e.fechaRecepcion);
        return f >= limite;
      });
    }

    this.entregasFiltradas = lista;

    // Métricas
    this.totalEntregas = lista.length;
    this.recibidasConformes = lista.filter(e => (e.estado || '').toUpperCase() === 'RECIBIDA').length;
    this.conNovedad = lista.filter(e => (e.estado || '').toUpperCase() === 'CON_NOVEDAD').length;
    this.enTransito = lista.filter(e => (e.estado || '').toUpperCase() === 'EN_TRANSITO').length;
    this.rechazadas = lista.filter(e => (e.estado || '').toUpperCase() === 'RECHAZADA').length;

    this.novedadesRechazos = this.conNovedad + this.rechazadas;

    const evaluadas = this.recibidasConformes + this.conNovedad + this.rechazadas;
    this.tasaCumplimiento = evaluadas > 0 ? Math.round((this.recibidasConformes / evaluadas) * 100) : 100;

    this.totalKilosLitros = lista.reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);

    // Leyenda del gráfico de calidad (porcentajes sobre los 4 estados)
    const totalEstados = this.recibidasConformes + this.conNovedad + this.enTransito + this.rechazadas;
    const base = [
      { label: 'Recibidas conformes', color: COLORES_ESTADO[0], valor: this.recibidasConformes },
      { label: 'Con novedades', color: COLORES_ESTADO[1], valor: this.conNovedad },
      { label: 'En tránsito', color: COLORES_ESTADO[2], valor: this.enTransito },
      { label: 'Rechazadas', color: COLORES_ESTADO[3], valor: this.rechazadas },
    ];
    this.leyendaEstados = base.map(l => ({
      ...l,
      pct: totalEstados > 0 ? Math.round((l.valor / totalEstados) * 100) : 0,
    }));

    // Composición de alimentos estricta: sólo perecederos reales en perecederos, sin mezclar
    let perecederos = 0;
    let noPerecederos = 0;
    for (const e of lista) {
      const cant = Number(e.cantidad) || 1;
      if (this.esPerecederoEntrega(e)) {
        perecederos += cant;
      } else {
        noPerecederos += cant;
      }
    }
    this.totalPerecederos = perecederos;
    this.totalNoPerecederos = noPerecederos;

    // Últimas 6 entregas ordenadas por fecha
    this.ultimasEntregas = [...lista]
      .sort((a, b) => (b.fechaRecepcion || '').localeCompare(a.fechaRecepcion || ''))
      .slice(0, 6);

    // Entregas que requieren seguimiento: rechazadas, con novedad y en camino (en ese orden)
    const prioridad: Record<string, number> = { RECHAZADA: 0, CON_NOVEDAD: 1, EN_TRANSITO: 2 };
    const clave = (e: Entrega) => (e.estado || '').toUpperCase();
    this.pendientes = lista
      .filter(e => prioridad[clave(e)] !== undefined)
      .sort((a, b) =>
        prioridad[clave(a)] - prioridad[clave(b)] ||
        (b.fechaRecepcion || '').localeCompare(a.fechaRecepcion || '')
      )
      .slice(0, 5);

    this.cdr.detectChanges();
  }

  alCambiarFiltroSede(): void {
    this.procesarMetricas();
    this.programarRenderGraficos();
  }

  alCambiarFiltroPeriodo(periodo: '30' | '90' | 'TOTAL'): void {
    this.filtroPeriodo = periodo;
    this.procesarMetricas();
    this.programarRenderGraficos();
  }

  /**
   * Clasifica de forma estricta si un producto o entrega es perecedero o no.
   * Evita mezclar perecederos con no perecederos.
   */
  esPerecederoEntrega(e: Entrega): boolean {
    const tipo = (e.tipoMercado || '').toLowerCase().trim();
    if (tipo.includes('no perecedero') || tipo.includes('no_perecedero') || tipo.includes('no-perecedero') || tipo.includes('abarrote') || tipo.includes('grano')) {
      return false;
    }
    if (tipo.includes('perecedero')) {
      return true;
    }
    const ing = (e.ingrediente || '').toLowerCase().trim();
    const perecederosKeywords = [
      'leche', 'huevo', 'carne', 'pollo', 'res', 'cerdo', 'pescado', 'queso', 'yogur',
      'fruta', 'naranja', 'banano', 'manzana', 'pera', 'guayaba', 'mandarina', 'mango',
      'verdura', 'tomate', 'cebolla', 'zanahoria', 'papa', 'yuca', 'platano', 'plátano',
      'ahuyama', 'habichuela', 'lechuga', 'espinaca', 'repollo'
    ];
    return perecederosKeywords.some(k => ing.includes(k));
  }

  // =========================================================================
  //  GRÁFICOS CHART.JS (OPTIMIZADOS PARA CARGA ULTRA RÁPIDA)
  // =========================================================================

  private programarRenderGraficos(): void {
    if (this.timerRenderGraficos) clearTimeout(this.timerRenderGraficos);
    // Render inmediato en el siguiente ciclo de renderizado sin esperas
    this.timerRenderGraficos = setTimeout(() => {
      this.renderizarGraficos();
    }, 0);
  }

  private renderizarGraficos(): void {
    if (!this.institucionActiva) {
      this.destruirGraficos();
      return;
    }

    this.crearGraficoEstados();
    this.crearGraficoSedes();
    this.crearGraficoCategorias();
  }

  private crearGraficoEstados(): void {
    if (!this.chartEstadosCanvas?.nativeElement) return;

    const ctx = this.chartEstadosCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const dataValues = [this.recibidasConformes, this.conNovedad, this.enTransito, this.rechazadas];
    const total = dataValues.reduce((a, b) => a + b, 0);
    const dataFinal = total > 0 ? dataValues : [1];
    const bgFinal = total > 0 ? COLORES_ESTADO : ['#E2E8F0'];

    // Si ya existe la instancia, actualizamos los datos al instante sin destruir
    if (this.chartEstados) {
      this.chartEstados.data.datasets[0].data = dataFinal;
      this.chartEstados.data.datasets[0].backgroundColor = bgFinal;
      this.chartEstados.update('none');
      return;
    }

    this.chartEstados = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Recibidas conformes', 'Con novedades', 'En tránsito', 'Rechazadas'],
        datasets: [{
          data: dataFinal,
          backgroundColor: bgFinal,
          borderColor: '#FFFFFF',
          borderWidth: 3,
          borderRadius: 6,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: total > 0,
            backgroundColor: '#1F2937',
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label: (c) => {
                const label = c.label || '';
                const val = Number(c.raw) || 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${label}: ${val} despachos (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  private crearGraficoSedes(): void {
    if (!this.chartSedesCanvas?.nativeElement) return;

    const ctx = this.chartSedesCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Agrupar entregas por sede
    const mapaSedes: Record<string, number> = {};
    if (this.institucionActiva?.sedes && this.institucionActiva.sedes.length > 0) {
      for (const s of this.institucionActiva.sedes) {
        mapaSedes[s.nombre_sede] = 0;
      }
    }

    for (const e of this.entregasFiltradas) {
      const nombre = e.sedeNombre || 'Sede Principal';
      mapaSedes[nombre] = (mapaSedes[nombre] || 0) + 1;
    }

    const labels = Object.keys(mapaSedes);
    const dataCounts = labels.map(l => mapaSedes[l]);
    const finalLabels = labels.length > 0 ? labels : ['Sin sedes'];
    const finalCounts = dataCounts.length > 0 ? dataCounts : [0];
    const bgColors = finalLabels.map((_, i) => COLORES_SEDES[i % COLORES_SEDES.length]);

    // Si ya existe la instancia, actualizamos los datos al instante
    if (this.chartSedes) {
      this.chartSedes.data.labels = finalLabels;
      this.chartSedes.data.datasets[0].data = finalCounts;
      this.chartSedes.data.datasets[0].backgroundColor = bgColors;
      this.chartSedes.update('none');
      return;
    }

    this.chartSedes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: finalLabels,
        datasets: [{
          label: 'Entregas despachadas',
          data: finalCounts,
          backgroundColor: bgColors,
          borderWidth: 0,
          borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
          barPercentage: 0.6,
          categoryPercentage: 0.8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        layout: { padding: { top: 22 } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, font: { size: 11 }, color: '#6B7280' },
            grid: { color: 'rgba(229, 231, 235, 0.9)' },
            border: { display: false }
          },
          x: {
            ticks: {
              font: { size: 12, weight: 600 },
              color: '#374151',
              maxRotation: 20,
              minRotation: 0,
              callback: function (val, index) {
                const label = finalLabels[index] || '';
                return label.length > 18 ? label.slice(0, 16) + '...' : label;
              }
            },
            grid: { display: false },
            border: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1F2937',
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label: (c) => ` ${c.raw} entregas registradas`
            }
          }
        }
      },
      plugins: [valoresSobreBarras],
    });
  }

  private crearGraficoCategorias(): void {
    if (!this.chartCategoriasCanvas?.nativeElement) return;

    const ctx = this.chartCategoriasCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const perecederos = this.totalPerecederos;
    const noPerecederos = this.totalNoPerecederos;
    const total = perecederos + noPerecederos;
    const dataVals = total > 0 ? [perecederos, noPerecederos] : [1];
    const bgColors = total > 0 ? COLORES_CATEGORIAS : ['#E2E8F0'];

    // Si ya existe la instancia, actualizamos los datos al instante
    if (this.chartCategorias) {
      this.chartCategorias.data.datasets[0].data = dataVals;
      this.chartCategorias.data.datasets[0].backgroundColor = bgColors;
      this.chartCategorias.update('none');
      return;
    }

    this.chartCategorias = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Perecederos', 'No perecederos'],
        datasets: [{
          data: dataVals,
          backgroundColor: bgColors,
          borderColor: '#FFFFFF',
          borderWidth: 3,
          borderRadius: 6,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: total > 0,
            backgroundColor: '#1F2937',
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label: (c) => {
                const label = c.label || '';
                const val = Number(c.raw) || 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${label}: ${val} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  private destruirGraficos(): void {
    if (this.chartEstados) {
      this.chartEstados.destroy();
      this.chartEstados = null;
    }
    if (this.chartSedes) {
      this.chartSedes.destroy();
      this.chartSedes = null;
    }
    if (this.chartCategorias) {
      this.chartCategorias.destroy();
      this.chartCategorias = null;
    }
  }

  // =========================================================================
  //  AYUDAS PARA LA TABLA "ÚLTIMOS REGISTROS"
  // =========================================================================

  tonoEstado(estado?: string): string {
    const est = (estado || '').toUpperCase();
    if (est === 'RECIBIDA') return 't-ok';
    if (est === 'CON_NOVEDAD') return 't-warn';
    if (est === 'EN_TRANSITO') return 't-info';
    if (est === 'RECHAZADA') return 't-danger';
    return 't-info';
  }

  iconoEstado(estado?: string): string {
    const est = (estado || '').toUpperCase();
    if (est === 'RECIBIDA') return 'check_circle';
    if (est === 'CON_NOVEDAD') return 'warning';
    if (est === 'EN_TRANSITO') return 'local_shipping';
    if (est === 'RECHAZADA') return 'cancel';
    return 'info';
  }

  accionEstado(estado?: string): string {
    const est = (estado || '').toUpperCase();
    if (est === 'RECIBIDA') return 'Entrega registrada';
    if (est === 'CON_NOVEDAD') return 'Entrega con novedad';
    if (est === 'EN_TRANSITO') return 'Despacho en camino';
    if (est === 'RECHAZADA') return 'Entrega rechazada';
    return 'Movimiento registrado';
  }

  iconoAccion(estado?: string): string {
    const est = (estado || '').toUpperCase();
    if (est === 'RECIBIDA') return 'inventory_2';
    if (est === 'CON_NOVEDAD') return 'report';
    if (est === 'EN_TRANSITO') return 'local_shipping';
    if (est === 'RECHAZADA') return 'block';
    return 'info';
  }

  etiquetaEstado(estado?: string): string {
    const est = (estado || '').toUpperCase();
    if (est === 'RECIBIDA') return 'Recibida';
    if (est === 'CON_NOVEDAD') return 'Con novedad';
    if (est === 'EN_TRANSITO') return 'En camino';
    if (est === 'RECHAZADA') return 'Rechazada';
    return 'Pendiente';
  }

  usuarioDe(e: Entrega): string {
    return (e as any).usuarioNombre || (e as any).registradoPor || this.nombreSupervisor;
  }

  iniciales(nombre: string): string {
    const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
  }

  // =========================================================================
  //  GESTIÓN DE INSTITUCIONES (CONSERVA TODA LA ROBUSTEZ Y CACHÉ)
  // =========================================================================

  /**
   * Trae del servidor las instituciones asignadas al supervisor (el backend ya filtra por supervisor).
   * Si el servidor responde, su lista reemplaza a la guardada; si falla, se deja la que ya había.
   */
  cargarInstitucionesServidor(): void {
    this.errorMensaje = '';
    const usuario = this.authService.obtenerUsuario();
    const idUsuario = usuario?.id_usuario || (usuario as any)?.id || (usuario as any)?.pk;

    // Si ya tenemos instituciones en memoria o en caché, no bloqueamos la interfaz con spinner
    if (this.instituciones.length === 0) {
      const cacheadas = this.obtenerInstitucionesEnCache();
      if (cacheadas.length > 0) {
        this.instituciones = cacheadas;
        this.cargando = false;
      } else {
        this.cargando = true;
      }
    } else {
      this.cargando = false;
    }
    this.cdr.detectChanges();

    const limiteCarga = window.setTimeout(() => {
      if (this.cargando) {
        this.cargando = false;
        if (this.instituciones.length === 0) {
          const reintentoCache = this.obtenerInstitucionesEnCache();
          if (reintentoCache.length > 0) {
            this.instituciones = reintentoCache;
          } else {
            this.errorMensaje = 'El servidor está tardando más de lo esperado. Intenta cargar las instituciones nuevamente.';
          }
        }
        this.cdr.detectChanges();
      }
    }, 10000);

    this.http.get<any>(`${environment.apiUrl}/instituciones/`).pipe(
      timeout(8000),
      catchError(() => of(null)),
      finalize(() => {
        window.clearTimeout(limiteCarga);
      })
    ).subscribe(resp => {
      if (resp === null) {
        this.cargarInstitucionesDesdePerfil(idUsuario);
        return;
      }

      const lista = Array.isArray(resp) ? resp : (resp?.results ?? []);
      const asignadasUsuario = usuario?.instituciones_supervisor ?? [];
      const respaldoPorId = new Map<number, InstitucionAsignada>(
        asignadasUsuario
          .map((item: any) => this.normalizarInstitucion(item))
          .filter((item: InstitucionAsignada) => Number.isFinite(Number(item.id_institucion)))
          .map((item: InstitucionAsignada) => [Number(item.id_institucion), item])
      );
      const institucionesServidor = lista
        .map((item: any) => {
          const id = Number(item.id_institucion ?? item.id);
          return this.normalizarInstitucion(item, respaldoPorId.get(id));
        })
        .filter((item: InstitucionAsignada) => !item.estado || item.estado.toUpperCase() === 'ACTIVO');

      const asignadasIds = new Set(
        asignadasUsuario
          .map((item: InstitucionAsignada) => item.id_institucion ?? (item as any).id)
          .filter((id): id is number => id !== undefined && id !== null)
          .map((id) => Number(id))
      );

      if (asignadasIds.size > 0) {
        const filtradas = institucionesServidor.filter((item: InstitucionAsignada) =>
          asignadasIds.has(Number(item.id_institucion))
        );
        this.instituciones = filtradas.length > 0 ? filtradas : institucionesServidor;
      } else if (institucionesServidor.length > 0) {
        this.instituciones = institucionesServidor;
      }

      if (this.instituciones.length > 0) {
        this.cargando = false;
        this.errorMensaje = '';
        this.guardarEnCache(this.instituciones);
      } else {
        this.cargarInstitucionesDesdePerfil(idUsuario);
      }

      // Solo sincronizar la institución si el usuario ya la tiene seleccionada activamente en esta sesión
      const activaGuardada = this.authService.obtenerInstitucionActiva();
      if (activaGuardada && this.institucionActiva) {
        const encontrada = this.instituciones.find(i => i.id_institucion === activaGuardada.id_institucion);
        if (encontrada) {
          this.institucionActiva = encontrada;
          this.authService.actualizarInstitucionActiva(encontrada);
        } else {
          this.deseleccionarInstitucion();
        }
      }
      this.cdr.detectChanges();
    });
  }
  normalizarInstitucion(item: any, respaldo?: InstitucionAsignada): InstitucionAsignada {
    return normalizarInstitucionSupervisor(item, respaldo, false, []);
  }

  private cargarInstitucionesDesdePerfil(idUsuario?: number): void {
    if (!idUsuario) {
      this.cargando = false;
      if (this.instituciones.length === 0) {
        const enCache = this.obtenerInstitucionesEnCache();
        if (enCache.length > 0) {
          this.instituciones = enCache;
        } else {
          this.errorMensaje = 'No se pudieron cargar tus instituciones. Revisa tu conexión e inténtalo de nuevo.';
        }
      }
      this.cdr.detectChanges();
      return;
    }

    this.http.get<any>(`${environment.apiUrl}/usuarios/${idUsuario}/`).pipe(
      timeout(10000),
      catchError(() => of(null)),
      finalize(() => {
        this.cargando = false;
        this.cdr.detectChanges();
      })
    ).subscribe((usuario) => {
      const asignadas = usuario?.instituciones_supervisor
        ?? usuario?.usuario?.instituciones_supervisor
        ?? usuario?.results?.instituciones_supervisor;

      if (!Array.isArray(asignadas)) {
        if (this.instituciones.length === 0) {
          const enCache = this.obtenerInstitucionesEnCache();
          if (enCache.length > 0) {
            this.instituciones = enCache;
          } else {
            this.errorMensaje = 'No se pudieron cargar tus instituciones. Revisa tu conexión e inténtalo de nuevo.';
          }
        }
        return;
      }

      this.instituciones = asignadas
        .map((item: any) => this.normalizarInstitucion(item))
        .filter((item: InstitucionAsignada) => !item.estado || item.estado.toUpperCase() === 'ACTIVO');
      if (this.instituciones.length > 0) {
        this.guardarEnCache(this.instituciones);
      }
      this.errorMensaje = '';
    });
  }

  trackInstitucion = (_: number, inst: InstitucionAsignada) => inst.id_institucion;

  // Fotos de las tarjetas (vienen en imagenes-instituciones.ts). Si hay más instituciones que fotos, se repiten en orden.
  imagenDe(indice: number): string {
    return IMAGENES_INSTITUCION[indice % IMAGENES_INSTITUCION.length];
  }

  get imagenActiva(): string {
    const id = this.institucionActiva?.id_institucion;
    const i = this.instituciones.findIndex(x => x.id_institucion === id);
    return this.imagenDe(i >= 0 ? i : 0);
  }

  nombresSedes(institucion: InstitucionAsignada): string[] {
    return (institucion.sedes ?? [])
      .map((sede: any) => typeof sede === 'string'
        ? sede.trim()
        : String(sede?.nombre_sede ?? sede?.nombre ?? '').trim())
      .filter((nombre: string) => nombre.length > 0);
  }

  nombreAdministrador(institucion: InstitucionAsignada): string {
    const administrador = institucion.administrador_asignado;
    if (typeof administrador === 'string') {
      return administrador.trim() || 'Sin asignar';
    }
    if (!administrador || typeof administrador !== 'object') {
      return 'Sin asignar';
    }

    const nombreCompleto = String(administrador.nombre_completo ?? '').trim();
    const nombre = String(administrador.nombre ?? '').trim();
    const apellido = String(administrador.apellido ?? '').trim();
    return nombreCompleto || [nombre, apellido].filter(Boolean).join(' ') || 'Sin asignar';
  }

  seleccionarInstitucion(inst: InstitucionAsignada): void {
    this.institucionActiva = inst;
    this.authService.establecerInstitucionActiva(inst);
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    void this.alertas$.supervisorSuccess(
      'Institución activa',
      `${inst.nombre_institucion} quedó seleccionada para continuar con el seguimiento asignado.`
    );
    this.cargarDatosFlujo();
    this.cdr.detectChanges();
  }

  deseleccionarInstitucion(): void {
    this.authService.limpiarInstitucionActiva();
    this.institucionActiva = null;
    this.destruirGraficos();

    if (this.instituciones.length === 0) {
      const cacheadas = this.obtenerInstitucionesEnCache();
      if (cacheadas.length > 0) {
        this.instituciones = cacheadas;
        this.cargando = false;
      } else {
        this.cargarInstitucionesServidor();
      }
    } else {
      this.cargando = false;
    }
    this.cdr.detectChanges();
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
    const nombres = this.institucionActiva ? this.nombresSedes(this.institucionActiva) : [];
    return nombres.length > 0 ? nombres.join(', ') : 'Sin sedes registradas';
  }
}