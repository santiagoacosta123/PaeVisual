import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, Route } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of, forkJoin } from 'rxjs';
import { catchError, timeout, finalize } from 'rxjs/operators';
import Chart from 'chart.js/auto';

import { AuthService } from '../services/auth.service';
import { SiraeService } from '../features/contratos/services/contratos_pae.service';
import { BancoDatosService } from '../features/banco-datos/services/banco-datos.service';
import { EntregasService, Entrega } from '../features/entregas/services/entregas.service';
import { SweetAlertService } from '../sweet-alert.service';
import { environment } from '../../environments/environment';

// Fuente y color global de las gráficas
Chart.defaults.font.family = "'Roboto', system-ui, -apple-system, sans-serif";
Chart.defaults.color = '#64748b';

// Paleta institucional tipo semáforo (Super Administrador)
const VERDE = '#2B5424';
const VERDE_BORDE = '#1d3f1b';
const AMARILLO = '#F5B81F';
const AMARILLO_BORDE = '#d4a01b';
const ROJO = '#dc2626';
const ROJO_BORDE = '#b91c1c';
const LIMA = '#84cc16';
const LIMA_BORDE = '#65a30d';

// Colores de las gráficas del Administrador Institucional
const VERDE_VIVO = '#16a34a';
const AMARILLO_VIVO = '#F5B81F';
const TRACK_GAUGE = '#e2e8f0';

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

export interface SedeAdminDashboard {
  id: number;
  nombre: string;
  codigoDane?: string;
  direccion: string;
  beneficiarios: number;
  racionesAsignadas: number;
  racionesServidas: number;
  porcentajeCumplimiento: number;
  jornadas: string;
  estadoComedor: 'OPERATIVO' | 'EN_SERVICIO' | 'ABASTECIDO';
  responsableCocina: string;
  stockEstado: 'OPTIMO' | 'BAJO' | 'CRITICO';
}

export interface InsumoAdminDashboard {
  id: number;
  idInventario?: number;
  idIngrediente?: number;
  idUnidadMedida?: number;
  nombre: string;
  categoria: 'Abarrotes' | 'Lácteos' | 'Cárnicos y Huevos' | 'Frutas y Verduras';
  stockActual: number;
  stockMinimo: number;
  unidad: string;
  estado: 'OPTIMO' | 'BAJO' | 'CRITICO';
  diasVencimientoProximo: number;
  lote: string;
}

export interface MovimientoAdminReciente {
  id: number;
  tipo: 'ENTRADA' | 'SALIDA';
  insumo: string;
  cantidad: number;
  unidad: string;
  fechaHora: string;
  origenDestino: string;
  responsable: string;
}

export interface MetricasAdminInstitucional {
  totalSedes: number;
  sedesOperativas: number;
  totalBeneficiarios: number;
  totalRacionesDia: number;
  racionesServidasDia: number;
  porcentajeCumplimiento: number;
  totalInsumos: number;
  insumosCriticos: number;
  insumosBajos: number;
  insumosOptimos: number;
  lotesPorVencer7Dias: number;
  lotesPorVencer15Dias: number;
  entregasRecibidasMes: number;
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
  private http = inject(HttpClient);
  private sweetAlert = inject(SweetAlertService);
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

  // Canvases para Chart.js (Super Admin)
  @ViewChild('chartContratosCanvas') chartContratosCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartFacturasCanvas') chartFacturasCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartLotesCanvas') chartLotesCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartSedesCanvas') chartSedesCanvas?: ElementRef<HTMLCanvasElement>;

  // Canvases para Chart.js (Administrador Institucional)
  @ViewChild('chartAdminSedesCanvas') chartAdminSedesCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartAdminStockCanvas') chartAdminStockCanvas?: ElementRef<HTMLCanvasElement>;

  // Instancias de Chart.js
  private chartContratos: Chart | null = null;
  private chartFacturas: Chart | null = null;
  private chartLotes: Chart | null = null;
  private chartSedes: Chart | null = null;
  private chartAdminSedes: Chart | null = null;
  private chartAdminStock: Chart | null = null;
  private timerRender: any = null;
  private timerRenderAdmin: any = null;

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
  facturasBase: any[] = [];
  datosRealesSuperAdmin = false;

  // =========================================================================
  //  ESTADO DEL DASHBOARD DEL ADMINISTRADOR INSTITUCIONAL
  // =========================================================================
  sedeFiltroSeleccionada: string = 'TODAS';
  categoriaFiltroInventario: string = 'TODAS';
  filtroSoloAlertas: boolean = false;
  busquedaInsumo: string = '';
  refrescandoDatos: boolean = false;

  // Persistencia Local
  private readonly STORAGE_INVENTARIO = 'sirae_admin_inventario';
  private readonly STORAGE_SEDES = 'sirae_admin_sedes';
  private readonly STORAGE_MOVIMIENTOS = 'sirae_admin_movimientos';

  // Modal 1: Ajuste Rápido de Stock
  modalAjusteAbierto: boolean = false;
  itemAjuste: InsumoAdminDashboard | null = null;
  tipoAjuste: 'ENTRADA' | 'SALIDA' | 'DIRECTO' = 'ENTRADA';
  cantidadAjuste: number | null = null;
  motivoAjuste: string = '';

  // Modal 2: Registrar Nuevo Insumo
  modalNuevoInsumoAbierto: boolean = false;
  nuevoInsumoForm = {
    nombre: '',
    categoria: 'Abarrotes' as 'Abarrotes' | 'Lácteos' | 'Cárnicos y Huevos' | 'Frutas y Verduras',
    stockActual: null as number | null,
    stockMinimo: null as number | null,
    unidad: 'Kg',
    lote: '',
    diasVencimiento: 30
  };

  // Modal 3: Registrar Raciones por Sede
  modalRacionesSedeAbierto: boolean = false;
  sedeRacionesSeleccionada: SedeAdminDashboard | null = null;
  racionesServidasInput: number | null = null;
  estadoComedorInput: 'OPERATIVO' | 'EN_SERVICIO' | 'ABASTECIDO' = 'OPERATIVO';

  get institucionNombre(): string {
    return this.usuario?.institucion_nombre?.trim()
      || this.usuario?.institucion?.trim()
      || 'Institución Educativa Comercial del Norte';
  }

  metricasAdmin: MetricasAdminInstitucional = {
    totalSedes: 4,
    sedesOperativas: 4,
    totalBeneficiarios: 980,
    totalRacionesDia: 980,
    racionesServidasDia: 920,
    porcentajeCumplimiento: 93.9,
    totalInsumos: 42,
    insumosCriticos: 3,
    insumosBajos: 8,
    insumosOptimos: 31,
    lotesPorVencer7Dias: 4,
    lotesPorVencer15Dias: 9,
    entregasRecibidasMes: 18
  };

  sedesAdmin: SedeAdminDashboard[] = [
    {
      id: 1,
      nombre: 'Sede Principal',
      codigoDane: '119001002341',
      direccion: 'Calle 5 # 12-40 (Comercial del Norte)',
      beneficiarios: 420,
      racionesAsignadas: 420,
      racionesServidas: 400,
      porcentajeCumplimiento: 95.2,
      jornadas: 'Mañana y Tarde',
      estadoComedor: 'OPERATIVO',
      responsableCocina: 'Martha Cecilia Ordóñez',
      stockEstado: 'OPTIMO'
    },
    {
      id: 2,
      nombre: 'Sede Primaria Las Américas',
      codigoDane: '119001002342',
      direccion: 'Cra 9 # 18-22 Barrio Las Américas',
      beneficiarios: 280,
      racionesAsignadas: 280,
      racionesServidas: 265,
      porcentajeCumplimiento: 94.6,
      jornadas: 'Mañana',
      estadoComedor: 'OPERATIVO',
      responsableCocina: 'Alba Nelly Gómez',
      stockEstado: 'BAJO'
    },
    {
      id: 3,
      nombre: 'Sede Rural San Isidro',
      codigoDane: '119001002343',
      direccion: 'Vereda San Isidro Km 3',
      beneficiarios: 160,
      racionesAsignadas: 160,
      racionesServidas: 155,
      porcentajeCumplimiento: 96.9,
      jornadas: 'Jornada Única',
      estadoComedor: 'OPERATIVO',
      responsableCocina: 'Carmen Lucía Campo',
      stockEstado: 'OPTIMO'
    },
    {
      id: 4,
      nombre: 'Sede El Carmen',
      codigoDane: '119001002344',
      direccion: 'Calle 15 # 3-50',
      beneficiarios: 120,
      racionesAsignadas: 120,
      racionesServidas: 100,
      porcentajeCumplimiento: 83.3,
      jornadas: 'Mañana',
      estadoComedor: 'EN_SERVICIO',
      responsableCocina: 'Rosa Helena Paz',
      stockEstado: 'OPTIMO'
    }
  ];

  insumosAdmin: InsumoAdminDashboard[] = [
    {
      id: 1,
      nombre: 'Arroz Blanco Fortificado',
      categoria: 'Abarrotes',
      stockActual: 240,
      stockMinimo: 80,
      unidad: 'Kg',
      estado: 'OPTIMO',
      diasVencimientoProximo: 120,
      lote: 'LOT-2026-AR-042'
    },
    {
      id: 2,
      nombre: 'Leche Entera Pasteurizada',
      categoria: 'Lácteos',
      stockActual: 35,
      stockMinimo: 80,
      unidad: 'Litros',
      estado: 'CRITICO',
      diasVencimientoProximo: 4,
      lote: 'LOT-2026-LC-108'
    },
    {
      id: 3,
      nombre: 'Pechuga de Pollo Fresca',
      categoria: 'Cárnicos y Huevos',
      stockActual: 65,
      stockMinimo: 40,
      unidad: 'Kg',
      estado: 'OPTIMO',
      diasVencimientoProximo: 5,
      lote: 'LOT-2026-CN-093'
    },
    {
      id: 4,
      nombre: 'Aceite Vegetal de Cocina',
      categoria: 'Abarrotes',
      stockActual: 18,
      stockMinimo: 30,
      unidad: 'Litros',
      estado: 'BAJO',
      diasVencimientoProximo: 180,
      lote: 'LOT-2026-AC-019'
    },
    {
      id: 5,
      nombre: 'Huevos Frescos Tipo A',
      categoria: 'Cárnicos y Huevos',
      stockActual: 480,
      stockMinimo: 200,
      unidad: 'Unds',
      estado: 'OPTIMO',
      diasVencimientoProximo: 12,
      lote: 'LOT-2026-HV-077'
    },
    {
      id: 6,
      nombre: 'Lenteja Seleccionada',
      categoria: 'Abarrotes',
      stockActual: 22,
      stockMinimo: 45,
      unidad: 'Kg',
      estado: 'BAJO',
      diasVencimientoProximo: 150,
      lote: 'LOT-2026-LT-031'
    },
    {
      id: 7,
      nombre: 'Plátano Verde Hartón',
      categoria: 'Frutas y Verduras',
      stockActual: 52,
      stockMinimo: 30,
      unidad: 'Kg',
      estado: 'OPTIMO',
      diasVencimientoProximo: 7,
      lote: 'LOT-2026-PL-084'
    },
    {
      id: 8,
      nombre: 'Zanahoria Fresca',
      categoria: 'Frutas y Verduras',
      stockActual: 38,
      stockMinimo: 25,
      unidad: 'Kg',
      estado: 'OPTIMO',
      diasVencimientoProximo: 6,
      lote: 'LOT-2026-ZN-112'
    },
    {
      id: 9,
      nombre: 'Carne de Res Molida',
      categoria: 'Cárnicos y Huevos',
      stockActual: 42,
      stockMinimo: 35,
      unidad: 'Kg',
      estado: 'OPTIMO',
      diasVencimientoProximo: 4,
      lote: 'LOT-2026-CR-066'
    },
    {
      id: 10,
      nombre: 'Panela en Bloque',
      categoria: 'Abarrotes',
      stockActual: 45,
      stockMinimo: 20,
      unidad: 'Kg',
      estado: 'OPTIMO',
      diasVencimientoProximo: 90,
      lote: 'LOT-2026-PN-015'
    },
    {
      id: 11,
      nombre: 'Papa Pastusa',
      categoria: 'Frutas y Verduras',
      stockActual: 75,
      stockMinimo: 40,
      unidad: 'Kg',
      estado: 'OPTIMO',
      diasVencimientoProximo: 14,
      lote: 'LOT-2026-PP-050'
    },
    {
      id: 12,
      nombre: 'Avena en Hojuelas',
      categoria: 'Abarrotes',
      stockActual: 30,
      stockMinimo: 15,
      unidad: 'Kg',
      estado: 'OPTIMO',
      diasVencimientoProximo: 75,
      lote: 'LOT-2026-AV-022'
    }
  ];

  movimientosAdmin: MovimientoAdminReciente[] = [
    {
      id: 1,
      tipo: 'ENTRADA',
      insumo: 'Arroz Blanco Fortificado',
      cantidad: 120,
      unidad: 'Kg',
      fechaHora: 'Hoy · 08:30 AM',
      origenDestino: 'Operador PAE (Remisión REM-8842)',
      responsable: 'Bodega Central'
    },
    {
      id: 2,
      tipo: 'SALIDA',
      insumo: 'Pechuga de Pollo Fresca',
      cantidad: 35,
      unidad: 'Kg',
      fechaHora: 'Hoy · 09:15 AM',
      origenDestino: 'Cocina Sede Principal (Minuta Almuerzo)',
      responsable: 'Martha Cecilia Ordóñez'
    },
    {
      id: 3,
      tipo: 'ENTRADA',
      insumo: 'Huevos Frescos Tipo A',
      cantidad: 480,
      unidad: 'Unds',
      fechaHora: 'Ayer · 02:40 PM',
      origenDestino: 'Distribuidor Avícola del Valle',
      responsable: 'Bodega Central'
    },
    {
      id: 4,
      tipo: 'SALIDA',
      insumo: 'Lenteja Seleccionada',
      cantidad: 15,
      unidad: 'Kg',
      fechaHora: 'Ayer · 10:00 AM',
      origenDestino: 'Cocina Sede Primaria Las Américas',
      responsable: 'Alba Nelly Gómez'
    }
  ];

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
    } else {
      // CARGA DE DASHBOARD ADMINISTRADOR INSTITUCIONAL
      this.cargarDatosAdmin();
    }
  }

  ngAfterViewInit(): void {
    if (this.esSuperAdministrador) {
      this.programarRenderGraficos(15);
    } else {
      this.programarRenderGraficosAdmin(25);
    }
  }

  ngOnDestroy(): void {
    if (this.timerRender) clearTimeout(this.timerRender);
    if (this.timerRenderAdmin) clearTimeout(this.timerRenderAdmin);
    this.destruirGraficos();
    this.destruirGraficosAdmin();
    if ((window as any).siraeSuperAdmin === this) {
      delete (window as any).siraeSuperAdmin;
    }
  }

  // =========================================================================
  //  MÉTODOS Y ACCIONES DEL DASHBOARD DE ADMINISTRADOR INSTITUCIONAL
  // =========================================================================

  private obtenerClaveStorage(base: string): string {
    const instId = this.usuario?.id_institucion;
    if (instId) return `${base}_inst_${instId}`;
    const usrId = this.usuario?.id_usuario;
    if (usrId) return `${base}_usr_${usrId}`;
    return base;
  }

  private clasificarCategoriaAdmin(nombreCat: string, nombreIng: string): 'Abarrotes' | 'Lácteos' | 'Cárnicos y Huevos' | 'Frutas y Verduras' {
    const txt = `${nombreCat || ''} ${nombreIng || ''}`.toLowerCase();
    if (txt.includes('lact') || txt.includes('láct') || txt.includes('leche') || txt.includes('queso') || txt.includes('yogur') || txt.includes('avena')) {
      return 'Lácteos';
    }
    if (txt.includes('carn') || txt.includes('cárn') || txt.includes('pollo') || txt.includes('res') || txt.includes('cerdo') || txt.includes('pescado') || txt.includes('atun') || txt.includes('atún') || txt.includes('huevo') || txt.includes('prote')) {
      return 'Cárnicos y Huevos';
    }
    if (txt.includes('frut') || txt.includes('verdu') || txt.includes('hortal') || txt.includes('papa') || txt.includes('platano') || txt.includes('plátano') || txt.includes('tomate') || txt.includes('cebolla') || txt.includes('zanahoria')) {
      return 'Frutas y Verduras';
    }
    return 'Abarrotes';
  }

  cargarPersistenciaAdmin(): void {
    try {
      const invGuardado = localStorage.getItem(this.obtenerClaveStorage(this.STORAGE_INVENTARIO));
      if (invGuardado) {
        const parsed = JSON.parse(invGuardado);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.insumosAdmin = parsed;
        }
      }

      const sedesGuardadas = localStorage.getItem(this.obtenerClaveStorage(this.STORAGE_SEDES));
      if (sedesGuardadas) {
        const parsed = JSON.parse(sedesGuardadas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.sedesAdmin = parsed;
        }
      }

      const movGuardados = localStorage.getItem(this.obtenerClaveStorage(this.STORAGE_MOVIMIENTOS));
      if (movGuardados) {
        const parsed = JSON.parse(movGuardados);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.movimientosAdmin = parsed;
        }
      }
    } catch (e) {
      console.warn('Error cargando persistencia del admin:', e);
    }
  }

  guardarPersistenciaAdmin(): void {
    try {
      localStorage.setItem(this.obtenerClaveStorage(this.STORAGE_INVENTARIO), JSON.stringify(this.insumosAdmin));
      localStorage.setItem(this.obtenerClaveStorage(this.STORAGE_SEDES), JSON.stringify(this.sedesAdmin));
      localStorage.setItem(this.obtenerClaveStorage(this.STORAGE_MOVIMIENTOS), JSON.stringify(this.movimientosAdmin));
      window.dispatchEvent(new CustomEvent('sirae:datos-actualizados'));
    } catch (e) {
      console.warn('Error guardando persistencia del admin:', e);
    }
  }

  private cargandoAdminEnCurso = false;

  cargarDatosAdmin(): void {
    // 1. Cargar datos persistidos por institución mientras responde el servidor
    this.cargarPersistenciaAdmin();
    this.recalcularMetricasAdmin();

    if (this.cargandoAdminEnCurso) {
      return;
    }
    this.cargandoAdminEnCurso = true;

    // 2. Sincronizar sedes, inventario (ya trae nombres de ingrediente/categoría/unidad) y entregas en 3 solas peticiones ligeras
    forkJoin({
      sedes: this.http.get<unknown>(`${environment.apiUrl}/sedes/`).pipe(timeout(45000), catchError(() => of(null))),
      inventario: this.http.get<unknown>(`${environment.apiUrl}/inventario/`).pipe(timeout(45000), catchError(() => of(null))),
      entregas: this.http.get<unknown>(`${environment.apiUrl}/entregas/`).pipe(timeout(45000), catchError(() => of(null))),
    }).pipe(
      finalize(() => {
        this.cargandoAdminEnCurso = false;
      })
    ).subscribe({
      next: ({ sedes, inventario, entregas }) => {
        const listaSedes = this.extraerLista(sedes);
        if (Array.isArray(listaSedes) && listaSedes.length > 0) {
          const previasPorId = new Map(this.sedesAdmin.map(s => [Number(s.id), s]));
          const sedesApi: SedeAdminDashboard[] = listaSedes.map((item: any, idx: number) => {
            const idSede = Number(item.id_sede || item.id || idx + 1);
            const previa = previasPorId.get(idSede);
            const cuposReales = Number(item.cupos_totales ?? item.cupos ?? previa?.racionesAsignadas ?? 0);
            const racionesAsignadas = cuposReales > 0 ? cuposReales : (previa?.racionesAsignadas || 0);
            const racionesServidas = previa && previa.racionesAsignadas === racionesAsignadas
              ? previa.racionesServidas
              : racionesAsignadas;
            const cumplimiento = racionesAsignadas > 0
              ? Number(((racionesServidas / racionesAsignadas) * 100).toFixed(1))
              : 100;

            return {
              id: idSede,
              nombre: item.nombre_sede || item.nombre || `Sede ${idx + 1}`,
              codigoDane: item.codigo_dane || previa?.codigoDane || '',
              direccion: item.direccion || 'Dirección registrada en institución',
              beneficiarios: racionesAsignadas,
              racionesAsignadas,
              racionesServidas,
              porcentajeCumplimiento: cumplimiento,
              jornadas: item.jornadas_nombres || previa?.jornadas || 'Jornada PAE',
              estadoComedor: previa?.estadoComedor || 'OPERATIVO',
              responsableCocina: item.jefa_nombre || previa?.responsableCocina || 'Equipo de Cocina PAE',
              stockEstado: previa?.stockEstado || 'OPTIMO'
            };
          });
          if (sedesApi.length > 0) {
            this.sedesAdmin = sedesApi;
          }
        }

        const listaInv = this.extraerLista(inventario);
        if (Array.isArray(listaInv) && listaInv.length > 0) {
          this.insumosAdmin = listaInv.map((inv: any, idx: number) => {
            const idIng = Number(inv.id_ingrediente);
            const stock = Number(inv.cantidad_actual ?? 0);
            const minimo = Number(inv.stock_minimo ?? 0);
            let estado: 'OPTIMO' | 'BAJO' | 'CRITICO' = 'OPTIMO';
            if (minimo > 0 && stock < minimo * 0.5) estado = 'CRITICO';
            else if (minimo > 0 && stock <= minimo) estado = 'BAJO';
            else if (stock <= 0) estado = 'CRITICO';

            const nombreIng = inv.ingrediente_nombre || inv.nombre_ingrediente || `Insumo #${idIng}`;
            const nombreCat = inv.categoria_nombre || '';
            const unidadTxt = inv.unidad_medida_nombre || 'Kg';

            return {
              id: Number(inv.id_inventario || idx + 1),
              idInventario: Number(inv.id_inventario) || undefined,
              idIngrediente: idIng || undefined,
              idUnidadMedida: Number(inv.id_unidad_medida) || 1,
              nombre: nombreIng,
              categoria: this.clasificarCategoriaAdmin(nombreCat, nombreIng),
              stockActual: stock,
              stockMinimo: minimo,
              unidad: unidadTxt,
              estado,
              diasVencimientoProximo: 30,
              lote: `INV-${inv.id_inventario || idx + 1}`
            };
          });
        }

        const listaEnt = this.extraerLista(entregas);
        if (Array.isArray(listaEnt) && listaEnt.length > 0) {
          const recibidas = listaEnt.filter((e: any) =>
            String(e.estado || '').toUpperCase() === 'RECIBIDA' || String(e.estado || '').toUpperCase() === 'CON_NOVEDAD'
          );
          this.metricasAdmin.entregasRecibidasMes = recibidas.length;
        }

        this.recalcularMetricasAdmin();
        this.actualizarGraficosAdmin();
        this.cdRef.markForCheck();
        (this.cdRef as any).detectChanges?.();
      },
      error: () => {}
    });
  }

  // --- MODAL 1: AJUSTE DE STOCK ---
  abrirModalAjuste(item: InsumoAdminDashboard): void {
    this.itemAjuste = { ...item };
    this.tipoAjuste = 'ENTRADA';
    this.cantidadAjuste = null;
    this.motivoAjuste = '';
    this.modalAjusteAbierto = true;
    this.cdRef.markForCheck();
  }

  cerrarModalAjuste(): void {
    this.modalAjusteAbierto = false;
    this.itemAjuste = null;
    this.cantidadAjuste = null;
    this.motivoAjuste = '';
    this.cdRef.markForCheck();
  }

  guardarAjuste(): void {
    if (!this.itemAjuste || this.cantidadAjuste === null || this.cantidadAjuste < 0) {
      this.sweetAlert.warning('Cantidad inválida', 'Por favor ingresa una cantidad válida para el ajuste.');
      return;
    }

    const idx = this.insumosAdmin.findIndex(i => i.id === this.itemAjuste!.id);
    if (idx === -1) return;

    const actual = this.insumosAdmin[idx].stockActual;
    let nuevoStock = actual;
    const cant = Number(this.cantidadAjuste);

    if (this.tipoAjuste === 'ENTRADA') {
      nuevoStock = actual + cant;
    } else if (this.tipoAjuste === 'SALIDA') {
      if (cant > actual) {
        this.sweetAlert.warning('Stock Insuficiente', `No puedes retirar ${cant} ${this.itemAjuste.unidad} porque solo hay ${actual} en bodega.`);
        return;
      }
      nuevoStock = Math.max(0, actual - cant);
    } else {
      nuevoStock = cant;
    }

    this.insumosAdmin[idx].stockActual = nuevoStock;

    // Actualizar estado según stock mínimo
    const minimo = this.insumosAdmin[idx].stockMinimo;
    if (nuevoStock < minimo * 0.5) {
      this.insumosAdmin[idx].estado = 'CRITICO';
    } else if (nuevoStock < minimo) {
      this.insumosAdmin[idx].estado = 'BAJO';
    } else {
      this.insumosAdmin[idx].estado = 'OPTIMO';
    }

    // Registrar en movimientos
    const horaActual = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date());
    const tipoMov = this.tipoAjuste === 'SALIDA' ? 'SALIDA' : 'ENTRADA';
    const motivoTexto = this.motivoAjuste?.trim() || (this.tipoAjuste === 'SALIDA' ? 'Despacho a cocina escolar' : 'Ajuste / Entrada en bodega');

    this.movimientosAdmin.unshift({
      id: Date.now(),
      tipo: tipoMov,
      insumo: this.insumosAdmin[idx].nombre,
      cantidad: cant,
      unidad: this.insumosAdmin[idx].unidad,
      fechaHora: `Hoy · ${horaActual}`,
      origenDestino: motivoTexto,
      responsable: this.nombreUsuario || 'Administrador'
    });

    if (this.movimientosAdmin.length > 8) {
      this.movimientosAdmin.pop();
    }

    const insumoRef = this.insumosAdmin[idx];
    if (insumoRef.idInventario && insumoRef.idIngrediente) {
      const payloadInv: any = {
        id_ingrediente: insumoRef.idIngrediente,
        cantidad_actual: nuevoStock,
        stock_minimo: insumoRef.stockMinimo ?? 0,
        id_unidad_medida: insumoRef.idUnidadMedida || 1,
      };
      if (this.usuario?.id_institucion) {
        payloadInv.id_institucion = this.usuario.id_institucion;
      }
      this.http.put(`${environment.apiUrl}/inventario/${insumoRef.idInventario}/`, payloadInv)
        .pipe(catchError(() => of(null)))
        .subscribe();
    }

    this.guardarPersistenciaAdmin();
    this.recalcularMetricasAdmin();
    this.actualizarGraficosAdmin();
    this.cerrarModalAjuste();
    this.sweetAlert.success('Stock Actualizado', `${this.insumosAdmin[idx].nombre} ahora tiene ${nuevoStock} ${this.insumosAdmin[idx].unidad} en bodega.`);
    (this.cdRef as any).detectChanges?.();
  }

  // --- MODAL 2: NUEVO INSUMO ---
  abrirModalNuevoInsumo(): void {
    const anio = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    this.nuevoInsumoForm = {
      nombre: '',
      categoria: 'Abarrotes',
      stockActual: null,
      stockMinimo: null,
      unidad: 'Kg',
      lote: `LOT-${anio}-INS-${rand}`,
      diasVencimiento: 45
    };
    this.modalNuevoInsumoAbierto = true;
    this.cdRef.markForCheck();
  }

  cerrarModalNuevoInsumo(): void {
    this.modalNuevoInsumoAbierto = false;
    this.cdRef.markForCheck();
  }

  guardarNuevoInsumo(): void {
    if (!this.nuevoInsumoForm.nombre?.trim()) {
      this.sweetAlert.warning('Nombre Requerido', 'Por favor ingresa el nombre del insumo o alimento.');
      return;
    }
    if (this.nuevoInsumoForm.stockActual === null || this.nuevoInsumoForm.stockActual < 0) {
      this.sweetAlert.warning('Stock Inválido', 'Ingresa la cantidad física actual en bodega.');
      return;
    }
    if (this.nuevoInsumoForm.stockMinimo === null || this.nuevoInsumoForm.stockMinimo <= 0) {
      this.sweetAlert.warning('Stock Mínimo Requerido', 'Ingresa un stock mínimo de seguridad válido.');
      return;
    }

    const stock = Number(this.nuevoInsumoForm.stockActual);
    const min = Number(this.nuevoInsumoForm.stockMinimo);
    let estado: 'OPTIMO' | 'BAJO' | 'CRITICO' = 'OPTIMO';
    if (stock < min * 0.5) estado = 'CRITICO';
    else if (stock < min) estado = 'BAJO';

    const nuevo: InsumoAdminDashboard = {
      id: Date.now(),
      nombre: this.nuevoInsumoForm.nombre.trim(),
      categoria: this.nuevoInsumoForm.categoria,
      stockActual: stock,
      stockMinimo: min,
      unidad: this.nuevoInsumoForm.unidad,
      estado,
      diasVencimientoProximo: Number(this.nuevoInsumoForm.diasVencimiento) || 30,
      lote: this.nuevoInsumoForm.lote || `LOT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
    };

    this.insumosAdmin.unshift(nuevo);

    const horaActual = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date());
    this.movimientosAdmin.unshift({
      id: Date.now(),
      tipo: 'ENTRADA',
      insumo: nuevo.nombre,
      cantidad: stock,
      unidad: nuevo.unidad,
      fechaHora: `Hoy · ${horaActual}`,
      origenDestino: 'Registro de nuevo insumo en bodega',
      responsable: this.nombreUsuario || 'Administrador'
    });

    this.guardarPersistenciaAdmin();
    this.recalcularMetricasAdmin();
    this.actualizarGraficosAdmin();
    this.cerrarModalNuevoInsumo();
    this.sweetAlert.success('Insumo Registrado', `${nuevo.nombre} ha sido agregado al inventario institucional.`);
  }

  // --- MODAL 3: REGISTRO DE RACIONES POR SEDE ---
  abrirModalRacionesSede(sede: SedeAdminDashboard): void {
    this.sedeRacionesSeleccionada = { ...sede };
    this.racionesServidasInput = sede.racionesServidas;
    this.estadoComedorInput = sede.estadoComedor;
    this.modalRacionesSedeAbierto = true;
    this.cdRef.markForCheck();
  }

  cerrarModalRacionesSede(): void {
    this.modalRacionesSedeAbierto = false;
    this.sedeRacionesSeleccionada = null;
    this.racionesServidasInput = null;
    this.cdRef.markForCheck();
  }

  guardarRacionesSede(): void {
    if (!this.sedeRacionesSeleccionada || this.racionesServidasInput === null || this.racionesServidasInput < 0) {
      this.sweetAlert.warning('Dato Inválido', 'Ingresa una cantidad de raciones servidas válida.');
      return;
    }

    const idx = this.sedesAdmin.findIndex(s => s.id === this.sedeRacionesSeleccionada!.id);
    if (idx === -1) return;

    const servidas = Number(this.racionesServidasInput);
    const asignadas = this.sedesAdmin[idx].racionesAsignadas;
    this.sedesAdmin[idx].racionesServidas = servidas;
    this.sedesAdmin[idx].estadoComedor = this.estadoComedorInput;
    this.sedesAdmin[idx].porcentajeCumplimiento = asignadas > 0 ? Number(((servidas / asignadas) * 100).toFixed(1)) : 100;

    this.guardarPersistenciaAdmin();
    this.recalcularMetricasAdmin();
    this.actualizarGraficosAdmin();
    this.cerrarModalRacionesSede();
    this.sweetAlert.success('Raciones Actualizadas', `Se registró la entrega de ${servidas} raciones en ${this.sedesAdmin[idx].nombre}.`);
  }

  // --- ACCIONES GENERALES ---
  refrescarDatosAdmin(): void {
    this.refrescandoDatos = true;
    setTimeout(() => {
      this.cargarDatosAdmin();
      this.refrescandoDatos = false;
      this.sweetAlert.success('Datos Actualizados', 'Información de sedes e inventario sincronizada.');
      this.cdRef.markForCheck();
    }, 450);
  }

  restablecerDatosAdmin(): void {
    this.sweetAlert.confirm('¿Restablecer datos?', 'Volverás a sincronizar los datos institucionales desde el servidor.', 'Sí, restablecer').then((res: any) => {
      if (res && res.isConfirmed) {
        localStorage.removeItem(this.obtenerClaveStorage(this.STORAGE_INVENTARIO));
        localStorage.removeItem(this.obtenerClaveStorage(this.STORAGE_SEDES));
        localStorage.removeItem(this.obtenerClaveStorage(this.STORAGE_MOVIMIENTOS));
        window.location.reload();
      }
    });
  }

  limpiarFiltros(): void {
    this.sedeFiltroSeleccionada = 'TODAS';
    this.categoriaFiltroInventario = 'TODAS';
    this.filtroSoloAlertas = false;
    this.busquedaInsumo = '';
    this.actualizarGraficosAdmin();
    this.cdRef.markForCheck();
  }

  programarRenderGraficosAdmin(delay = 20): void {
    if (this.timerRenderAdmin) clearTimeout(this.timerRenderAdmin);
    this.timerRenderAdmin = setTimeout(() => {
      this.inicializarGraficosAdmin();
    }, delay);
  }

  private inicializarGraficosAdmin(intentos = 0): void {
    if (!this.chartAdminSedesCanvas?.nativeElement ||
        !this.chartAdminStockCanvas?.nativeElement) {
      if (intentos < 12) {
        if (this.timerRenderAdmin) clearTimeout(this.timerRenderAdmin);
        this.timerRenderAdmin = setTimeout(() => this.inicializarGraficosAdmin(intentos + 1), 60);
      }
      return;
    }

    this.crearGraficoAdminSedes();
    this.crearGraficoAdminStock();
  }

  // Dona 1: raciones servidas vs. pendientes del día (respeta el filtro de sede)
  private crearGraficoAdminSedes(): void {
    if (!this.chartAdminSedesCanvas?.nativeElement) return;
    const ctx = this.chartAdminSedesCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chartAdminSedes) {
      this.chartAdminSedes.destroy();
    }

    const servidas = this.totalRacionesServidas;
    const pendientes = this.racionesPendientes;
    const sinDatos = servidas + pendientes === 0;

    this.chartAdminSedes = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: sinDatos ? ['Sin datos'] : ['Servidas', 'Pendientes'],
        datasets: [{
          data: sinDatos ? [1] : [servidas, pendientes],
          backgroundColor: sinDatos ? [TRACK_GAUGE] : [VERDE_VIVO, AMARILLO_VIVO],
          borderWidth: 0,
          borderRadius: 6,
          spacing: sinDatos ? 0 : 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_BLANCO,
            enabled: !sinDatos,
            callbacks: {
              label: (c) => ` ${c.label}: ${c.parsed} raciones`
            }
          }
        }
      }
    });
  }

  // Dona 2: estado del inventario (óptimo / reorden / crítico)
  private crearGraficoAdminStock(): void {
    if (!this.chartAdminStockCanvas?.nativeElement) return;
    const ctx = this.chartAdminStockCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chartAdminStock) {
      this.chartAdminStock.destroy();
    }

    const c = this.conteoInventario;
    const sinDatos = c.total === 0;

    this.chartAdminStock = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: sinDatos ? ['Sin datos'] : ['Óptimo', 'Reorden', 'Crítico'],
        datasets: [{
          data: sinDatos ? [1] : [c.optimo, c.bajo, c.critico],
          backgroundColor: sinDatos ? [TRACK_GAUGE] : [VERDE_VIVO, AMARILLO_VIVO, ROJO],
          borderWidth: 0,
          borderRadius: 6,
          spacing: sinDatos ? 0 : 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TOOLTIP_BLANCO,
            enabled: !sinDatos,
            callbacks: {
              label: (ctxTip) => ` ${ctxTip.label}: ${ctxTip.parsed} insumos`
            }
          }
        }
      }
    });
  }

  private actualizarGraficosAdmin(): void {
    if (!this.chartAdminSedes || !this.chartAdminStock) {
      this.programarRenderGraficosAdmin(15);
      return;
    }
    // Las donas se redibujan completas: son livianas y así cambian sus colores si no hay datos
    this.crearGraficoAdminSedes();
    this.crearGraficoAdminStock();
  }

  private destruirGraficosAdmin(): void {
    if (this.chartAdminSedes) {
      this.chartAdminSedes.destroy();
      this.chartAdminSedes = null;
    }
    if (this.chartAdminStock) {
      this.chartAdminStock.destroy();
      this.chartAdminStock = null;
    }
  }

  recalcularMetricasAdmin(): void {
    const totalBeneficiarios = this.sedesAdmin.reduce((sum, s) => sum + s.beneficiarios, 0);
    const totalRacionesDia = this.sedesAdmin.reduce((sum, s) => sum + s.racionesAsignadas, 0);
    const racionesServidasDia = this.sedesAdmin.reduce((sum, s) => sum + s.racionesServidas, 0);
    const porcentajeCumplimiento = totalRacionesDia > 0 ? Number(((racionesServidasDia / totalRacionesDia) * 100).toFixed(1)) : 0;

    const insumosCriticos = this.insumosAdmin.filter(i => i.estado === 'CRITICO').length;
    const insumosBajos = this.insumosAdmin.filter(i => i.estado === 'BAJO').length;
    const insumosOptimos = this.insumosAdmin.filter(i => i.estado === 'OPTIMO').length;
    const lotesPorVencer7Dias = this.insumosAdmin.filter(i => i.diasVencimientoProximo <= 7).length;
    const lotesPorVencer15Dias = this.insumosAdmin.filter(i => i.diasVencimientoProximo > 7 && i.diasVencimientoProximo <= 15).length;

    this.metricasAdmin = {
      totalSedes: this.sedesAdmin.length,
      sedesOperativas: this.sedesAdmin.filter(s => s.estadoComedor === 'OPERATIVO' || s.estadoComedor === 'EN_SERVICIO').length,
      totalBeneficiarios,
      totalRacionesDia,
      racionesServidasDia,
      porcentajeCumplimiento,
      totalInsumos: this.insumosAdmin.length,
      insumosCriticos,
      insumosBajos,
      insumosOptimos,
      lotesPorVencer7Dias,
      lotesPorVencer15Dias,
      entregasRecibidasMes: this.metricasAdmin.entregasRecibidasMes
    };
  }

  seleccionarFiltroSede(sede: string): void {
    this.sedeFiltroSeleccionada = sede;
    this.actualizarGraficosAdmin();
    this.cdRef.markForCheck();
  }

  seleccionarCategoria(cat: string): void {
    this.categoriaFiltroInventario = cat;
    this.cdRef.markForCheck();
  }

  toggleSoloAlertas(): void {
    this.filtroSoloAlertas = !this.filtroSoloAlertas;
    this.cdRef.markForCheck();
  }

  onBusquedaInsumo(e: Event): void {
    this.busquedaInsumo = (e.target as HTMLInputElement).value || '';
    this.cdRef.markForCheck();
  }

  Math = Math;

  calcularPorcentajeStock(actual: number, minimo: number): number {
    if (!minimo || minimo <= 0) return 100;
    return Math.min(100, Math.max(10, Math.round((actual / minimo) * 50)));
  }

  get insumosFiltrados(): InsumoAdminDashboard[] {
    return this.insumosAdmin.filter(item => {
      const coincideCat = this.categoriaFiltroInventario === 'TODAS' || item.categoria === this.categoriaFiltroInventario;
      const coincideAlerta = !this.filtroSoloAlertas || item.estado !== 'OPTIMO' || item.diasVencimientoProximo <= 7;
      const q = this.busquedaInsumo.trim().toLowerCase();
      const coincideTexto = !q || item.nombre.toLowerCase().includes(q) || item.lote.toLowerCase().includes(q);
      return coincideCat && coincideAlerta && coincideTexto;
    });
  }

  get sedesFiltradas(): SedeAdminDashboard[] {
    if (this.sedeFiltroSeleccionada === 'TODAS') return this.sedesAdmin;
    return this.sedesAdmin.filter(s => s.nombre === this.sedeFiltroSeleccionada);
  }

  // Remesas y entregas calculadas de forma 100% dinámica para el Administrador
  get remesasPendientesAdmin(): Entrega[] {
    const lista = Array.isArray(this.entregasBase) && this.entregasBase.length > 0
      ? this.entregasBase
      : this.obtenerEntregasFallback();
    return lista.filter(e => {
      const st = String(e.estado || 'EN_TRANSITO').toUpperCase();
      return st === 'EN_TRANSITO' || st === 'PENDIENTE' || st === 'EN_PROCESO' || st === 'POR_RECIBIR';
    }).slice(0, 5);
  }

  get remesasRecibidasAdmin(): Entrega[] {
    const lista = Array.isArray(this.entregasBase) && this.entregasBase.length > 0
      ? this.entregasBase
      : this.obtenerEntregasFallback();
    return lista.filter(e => {
      const st = String(e.estado || '').toUpperCase();
      return st === 'RECIBIDA' || st === 'ACEPTADA';
    }).slice(0, 4);
  }

  get totalDespachosPorRecibir(): number {
    return this.remesasPendientesAdmin.length;
  }

  // Getters del resumen y del indicador semicircular (respetan el filtro de sede)
  get totalRacionesServidas(): number {
    return this.sedesFiltradas.reduce((acc, s) => acc + (s.racionesServidas || 0), 0);
  }

  get totalRacionesAsignadas(): number {
    return this.sedesFiltradas.reduce((acc, s) => acc + (s.racionesAsignadas || 0), 0);
  }

  get porcentajeGlobalRaciones(): number {
    return this.totalRacionesAsignadas > 0
      ? Math.round((this.totalRacionesServidas / this.totalRacionesAsignadas) * 100)
      : 0;
  }

  get insumosEnRiesgo(): number {
    return this.insumosAdmin.filter(i => i.estado === 'CRITICO' || i.estado === 'BAJO').length;
  }

  get racionesPendientes(): number {
    return Math.max(0, this.totalRacionesAsignadas - this.totalRacionesServidas);
  }

  get conteoInventario(): { optimo: number; bajo: number; critico: number; total: number } {
    const optimo = this.insumosAdmin.filter(i => i.estado === 'OPTIMO').length;
    const bajo = this.insumosAdmin.filter(i => i.estado === 'BAJO').length;
    const critico = this.insumosAdmin.filter(i => i.estado === 'CRITICO').length;
    return { optimo, bajo, critico, total: optimo + bajo + critico };
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
    (this.cdRef as any).detectChanges?.();
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
    if (this.datosRealesSuperAdmin) {
      const contratosFiltrados = this.rangoDias === 8
        ? this.contratosBase.filter(c => c.estado !== 'FINALIZADO')
        : this.contratosBase;

      const vigentes = contratosFiltrados.filter(c => c.estado === 'VIGENTE').length;
      const porVencer = contratosFiltrados.filter(c => c.estado === 'POR_VENCER').length;
      const contratosVigentes = vigentes + porVencer;
      const totalContratos = contratosFiltrados.length;

      const instActivas = this.institucionesBase.filter(
        (i: any) => String(i.estado ?? 'ACTIVO').toUpperCase() !== 'INACTIVO'
      );
      const sedesActivas = this.sedesBase.filter(
        (s: any) => String(s.estado ?? 'ACTIVO').toUpperCase() !== 'INACTIVO'
      );
      const totalInstituciones = instActivas.length || this.institucionesBase.length;
      const totalSedes = sedesActivas.length || this.sedesBase.length;

      const facturasRegistradas = (this.facturasBase || []).filter(
        (f: any) => String(f.estado || 'REGISTRADA').toUpperCase() !== 'ANULADA'
      );

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const limiteVentanaMs = this.rangoDias * 24 * 60 * 60 * 1000;

      const facturasEnRango = this.rangoDias === 8
        ? facturasRegistradas.filter((f: any) => {
            const raw = f.fecha_compra || f.fecha_creacion;
            if (!raw) return true;
            const d = new Date(raw);
            if (isNaN(d.getTime())) return true;
            const diff = hoy.getTime() - d.getTime();
            return diff <= limiteVentanaMs && diff >= -86400000;
          })
        : facturasRegistradas;

      const conteoPorMes = new Array(12).fill(0);
      const fuenteCurva = facturasRegistradas.length > 0 ? facturasRegistradas : [];
      for (const f of fuenteCurva) {
        const raw = f.fecha_compra || f.fecha_creacion;
        if (!raw) continue;
        const partes = String(raw).slice(0, 10).split('-');
        const mesIdx = partes.length >= 2 ? Number(partes[1]) - 1 : new Date(raw).getMonth();
        if (mesIdx >= 0 && mesIdx < 12) {
          conteoPorMes[mesIdx]++;
        }
      }
      if (fuenteCurva.length === 0 && this.entregasBase.length > 0) {
        for (const e of this.entregasBase) {
          const raw = e.fechaRecepcion;
          if (!raw) continue;
          const partes = String(raw).slice(0, 10).split('-');
          const mesIdx = partes.length >= 2 ? Number(partes[1]) - 1 : new Date(raw).getMonth();
          if (mesIdx >= 0 && mesIdx < 12) {
            conteoPorMes[mesIdx]++;
          }
        }
      }
      this.facturasPorMes = conteoPorMes;

      // Clasificar lotes por fecha de vencimiento (detalles de facturas registradas + entregas)
      let criticos = 0;
      let alerta = 0;
      let proximos = 0;
      let optimos = 0;

      const fechasVencimiento: string[] = [];
      for (const f of facturasRegistradas) {
        for (const det of (f.detalles || [])) {
          if (det?.fecha_vencimiento) {
            fechasVencimiento.push(String(det.fecha_vencimiento).slice(0, 10));
          } else {
            optimos++;
          }
        }
      }
      if (fechasVencimiento.length === 0 && optimos === 0) {
        for (const e of this.entregasBase) {
          if (e?.fechaVencimiento) {
            fechasVencimiento.push(String(e.fechaVencimiento).slice(0, 10));
          }
        }
      }

      for (const fv of fechasVencimiento) {
        const p = fv.split('-');
        const dVenc = p.length === 3
          ? new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
          : new Date(fv);
        if (isNaN(dVenc.getTime())) {
          optimos++;
          continue;
        }
        const dias = Math.round((dVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (dias <= 7) criticos++;
        else if (dias <= 15) alerta++;
        else if (dias <= 30) proximos++;
        else optimos++;
      }

      this.resumenLotes = { criticos, alerta, proximos, optimos };
      const lotesEnRiesgo = this.rangoDias === 8 ? criticos : (criticos + alerta);

      const totalFacturas = this.rangoDias === 8
        ? (facturasEnRango.length > 0 ? facturasEnRango.length : facturasRegistradas.length)
        : facturasRegistradas.length;

      this.metricas = {
        totalContratos,
        contratosVigentes,
        totalInstituciones,
        totalSedes,
        totalFacturas,
        lotesEnRiesgo,
        totalEntregas: this.entregasBase.length || totalFacturas
      };
      return;
    }

    if (this.rangoDias === 8) {
      // =======================================================================
      // CICLO DE 8 DÍAS: Suministro semanal prioritario de alimentos perecederos
      // =======================================================================
      const contratosVigentes = 6;
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
        timeout(45000),
        catchError(() => of(null))
      ),
      facturas: this.http.get<any>(`${environment.apiUrl}/facturas-compra/`).pipe(
        timeout(45000),
        catchError(() => of(null))
      ),
      entregas: this.entregasService.cargar(false).pipe(
        timeout(45000),
        catchError(() => of(null))
      ),
      instituciones: this.bancoDatosService.obtenerDatos('instituciones').pipe(
        timeout(45000),
        catchError(() => of(null))
      ),
      sedes: this.bancoDatosService.obtenerDatos('sedes').pipe(
        timeout(45000),
        catchError(() => of(null))
      )
    }).pipe(
      finalize(() => {
        this.cargandoDatos = false;
        this.recalcularMetricas();
        this.actualizarGraficos();
        this.cdRef.markForCheck();
        (this.cdRef as any).detectChanges?.();
      })
    ).subscribe({
      next: (res) => {
        let respondioBackend = false;

        if (res.contratos !== null) {
          respondioBackend = true;
          const listaContratos = this.extraerLista(res.contratos);
          this.contratosBase = listaContratos.map((c: any, index: number) => ({
            id: c.id_contrato || c.id || index + 1,
            numero_contrato: c.numero_cor || c.numero_contrato || c.codigo || `CT-PAE-${this.filtroPeriodo}-${index + 1}`,
            vigencia: String(c.vigencia || c.anio || (c.fecha_inicio ? String(c.fecha_inicio).slice(0, 4) : this.filtroPeriodo)),
            estado: this.clasificarEstadoContratoReal(c),
            raciones: Number(c.cupos || c.raciones || c.numero_raciones || 0),
            valor: Number(c.valor_total || c.valor || 0)
          }));
        }

        if (res.facturas !== null) {
          respondioBackend = true;
          this.facturasBase = this.extraerLista(res.facturas);
        }

        if (res.entregas !== null && Array.isArray(res.entregas)) {
          respondioBackend = true;
          this.entregasBase = res.entregas;
        }

        if (res.instituciones !== null) {
          respondioBackend = true;
          this.institucionesBase = this.extraerLista(res.instituciones);
        }

        if (res.sedes !== null) {
          respondioBackend = true;
          this.sedesBase = this.extraerLista(res.sedes);
        }

        if (respondioBackend) {
          this.datosRealesSuperAdmin = true;
        }
      },
      error: () => {}
    });
  }

  private clasificarEstadoContratoReal(c: any): string {
    const estRaw = String(c?.estado || 'Activo').trim().toUpperCase();
    if (estRaw.includes('INACT') || estRaw.includes('FINALIZ') || estRaw.includes('VENCID') || estRaw.includes('TERMIN')) {
      return 'FINALIZADO';
    }
    const fechaFin = c?.fecha_fin || c?.fin;
    if (fechaFin) {
      const partes = String(fechaFin).slice(0, 10).split('-');
      const dFin = partes.length === 3
        ? new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))
        : new Date(fechaFin);
      if (!isNaN(dFin.getTime())) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const diasRestantes = Math.round((dFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diasRestantes < 0) return 'FINALIZADO';
        if (diasRestantes <= 30) return 'POR_VENCER';
      }
    }
    return this.normalizarEstadoContrato(c?.estado || 'VIGENTE');
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
    const ruta = this.buscarRutaFacturas(this.router.config) ?? '/facturas-compra';
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
    if (this.datosRealesSuperAdmin) {
      const vigentes = this.contratosBase.filter(c => c.estado === 'VIGENTE').length;
      const porVencer = this.contratosBase.filter(c => c.estado === 'POR_VENCER').length;
      const finalizados = this.rangoDias === 8
        ? 0
        : this.contratosBase.filter(c => c.estado === 'FINALIZADO').length;
      return [vigentes, porVencer, finalizados];
    }
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
    if (this.datosRealesSuperAdmin && this.institucionesBase.length > 0) {
      const conteoPorInst = this.institucionesBase
        .filter((inst: any) => String(inst.estado ?? 'ACTIVO').toUpperCase() !== 'INACTIVO')
        .map((inst: any) => {
          const instId = Number(inst.id_institucion ?? inst.id);
          const nombre = inst.nombre_institucion || inst.nombre || `Institución #${instId}`;
          const sedesCount = this.sedesBase.length > 0
            ? this.sedesBase.filter((s: any) => {
                const sInst = typeof s.id_institucion === 'object' && s.id_institucion !== null
                  ? Number(s.id_institucion.id_institucion ?? s.id_institucion.id)
                  : Number(s.id_institucion);
                return sInst === instId && String(s.estado ?? 'ACTIVO').toUpperCase() !== 'INACTIVO';
              }).length
            : (Array.isArray(inst.sedes) ? inst.sedes.length : 0);
          return { nombre, total: sedesCount };
        })
        .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));

      const limite = this.rangoDias === 8 ? 4 : 6;
      const top = conteoPorInst.slice(0, limite);
      if (top.length > 0) {
        return {
          labels: top.map(x => x.nombre),
          data: top.map(x => x.total)
        };
      }
    }

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