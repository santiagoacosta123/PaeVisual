import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService } from '@core/auth';
import { SweetAlertService } from '../sweet-alert.service';
import { CustomSelectComponent } from '../shared/custom-select/custom-select';
import { CATALOGO_PREPARACIONES_PAE } from '../banco-datos/recetas-pae-base';

export interface IngredienteComponenteReceta {
  id_ingrediente: number;
  nombre_ingrediente: string;
  unidad?: string;
  observacion?: string;
}

export interface PasoPreparacionReceta {
  numero_paso: number;
  descripcion_paso: string;
}

export interface ComponentePlatoReceta {
  id_temporal: string;
  tipo_componente: string;
  nombre_componente: string;
  ingredientes: IngredienteComponenteReceta[];
  pasos: PasoPreparacionReceta[];
  ingredienteTempId?: any;
  observacionTemp?: string;
}

export interface RecetaMenuExtendida {
  id_plato?: number;
  numero_menu?: number | null;
  nombre_plato: string;
  secciones?: string[];
  componentes: ComponentePlatoReceta[];
}

export interface MomentoDiaMinuta {
  momento: 'Desayuno' | 'Almuerzo' | 'Merienda';
  tiene_menu_registrado: boolean;
  numeroMenu?: number;
  id_menu?: number;
  id_plato?: number;
  nombre_plato: string;
  origen: 'PAE_ESTIPULADO' | 'SUGERENCIA_IA' | 'PENDIENTE';
  ninos_presentes: number;
  estado_aprobacion: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO' | 'SIN_SERVICIO';
  motivo_rechazo_o_cancelacion?: string;
  usuario_jefa?: string;
  usuario_evaluador?: string;
  fecha_evaluacion?: string;
  componentes: {
    bebida_leche: string;
    proteico: string;
    cereal: string;
    fruta: string;
    agua: string;
  };
  ingredientes: string[];
  pasos: string[];
}

export interface CeldaDiaMinutaSede {
  numeroMenu: number; // 1..20
  semana: number; // 1..4
  diaSemana: string; // Lunes..Viernes
  fecha: string;
  momentos: Record<'Desayuno' | 'Almuerzo' | 'Merienda', MomentoDiaMinuta>;
  // Propiedades auxiliares y de retrocompatibilidad
  tiene_menu_registrado: boolean;
  jornada?: string;
  seccion?: string;
  id_menu?: number;
  id_plato?: number;
  nombre_plato: string;
  origen: 'PAE_ESTIPULADO' | 'SUGERENCIA_IA' | 'PENDIENTE';
  ninos_presentes: number;
  estado: string;
  componentes: {
    bebida_leche: string;
    proteico: string;
    cereal: string;
    fruta: string;
    agua: string;
  };
  ingredientes: string[];
  pasos: string[];
}

export interface SemanaMinutaSede {
  numeroSemana: number;
  titulo: string;
  dias: CeldaDiaMinutaSede[];
}

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './menus.html',
  styleUrls: ['./menus.css']
})
export class MenusComponent implements OnInit {
  private apiUrl = environment.apiUrl;
  private readonly STORAGE_MINUTA_SEDE_KEY = 'sirae_minutas_por_sede_v1';
  private readonly STORAGE_APROBACIONES_KEY = 'sirae_aprobaciones_minuta_v1';
  private readonly STORAGE_SEDES_MOMENTOS_KEY = 'sirae_sedes_momentos_v1';
  private readonly STORAGE_PLATOS_CATALOGO_KEY = 'sirae_platos_catalogo_personalizados_v6';
  private readonly STORAGE_COMP_CATALOGO_KEY = 'sirae_catalogo_componentes_pae_v2';

  pestanaActiva: 'minuta' | 'platos' | 'menus' | 'preparaciones' = 'platos';

  // Roles y contexto del usuario actual
  currentUser: any = null;
  esSuperAdmin = false;
  esAdministrador = false;
  esJefaManipuladoras = false;
  esSupervisor = false;

  // Sedes de la institución y Jefa asignada por sede
  sedesInstitucion: any[] = [];
  sedeSeleccionadaId: number | null = null;
  usuariosInstitucion: any[] = [];

  // Filtros de la Minuta de 20 días por Sede
  filtroSeccionMinuta: 'TODAS' | 'Desayuno' | 'Almuerzo' | 'Merienda' = 'TODAS';
  semanaSeleccionada: number = 1;

  // Filtros y estado del Catálogo de Platos y Recetas
  filtroMomentoPlatos: string = 'TODAS';
  busquedaPlatos: string = '';
  menuAccionAbiertoId: any = null;
  modalVerRecetaAbierto: boolean = false;
  platoVerReceta: any = null;

  // Modal Oficial de Receta y Componentes (Idéntico a Banco de Datos / Super Admin)
  modalRecetaPlatoAbierto: boolean = false;
  modoEdicionReceta: boolean = true;
  guardandoReceta: boolean = false;
  platoRecetaSeleccionado: any = null;

  menuRecetaForm: RecetaMenuExtendida = {
    nombre_plato: '',
    componentes: []
  };

  opcionesIngredientes: any[] = [];

  readonly tiposComponentePAE = [
    { id: 'Bebida con leche', label: 'Bebida con leche' },
    { id: 'Alimento proteico', label: 'Alimento proteico' },
    { id: 'Cereal acompañante', label: 'Cereal acompañante' },
    { id: 'Fruta', label: 'Fruta' },
    { id: 'Agua / Sopa', label: 'Agua potable tratada / Sopa' }
  ];

  readonly momentosPlatoOpciones: string[] = ['Desayuno', 'Almuerzo', 'Merienda'];

  readonly filasComponentesPAE: {
    key: 'bebida_leche' | 'proteico' | 'cereal' | 'fruta' | 'agua';
    label: string;
    icon: string;
  }[] = [
    { key: 'bebida_leche', label: 'Bebida con leche', icon: 'local_cafe' },
    { key: 'proteico', label: 'Alimento proteico', icon: 'egg_alt' },
    { key: 'cereal', label: 'Cereal acompañante', icon: 'bakery_dining' },
    { key: 'fruta', label: 'Fruta', icon: 'nutrition' },
    { key: 'agua', label: 'Agua', icon: 'water_drop' }
  ];

  // Datos crudos del backend
  menusDiarios: any[] = [];
  platos: any[] = [];
  preparacionesAsignadas: any[] = [];
  detallesPlatoTodos: any[] = [];

  // Catálogos para selects
  jornadas: any[] = [];
  contratos: any[] = [];
  seccionesMenu: any[] = [
    { id_seccion: 1, nombre_seccion: 'Desayuno' },
    { id_seccion: 2, nombre_seccion: 'Almuerzo' },
    { id_seccion: 3, nombre_seccion: 'Merienda' }
  ];
  usuariosManipuladoras: any[] = [];

  // Sugerencias de IA + Platos Estipulados PAE por defecto
  cargandoSugerenciasIA = false;
  opcionesSugeridasIA: any[] = [];
  platosEstipuladosPAE: any[] = [];
  platosGeneradosIA: any[] = [];
  textoSugerenciaIA = '';
  modoFuenteEleccion: 'TODOS' | 'PAE_ESTIPULADO' | 'IA_INVENTARIO' = 'TODOS';
  preferenciaIA = '';

  // Modal de programación de Menú del Día por Sede (Jefa / Admin)
  mostrarModalProgramarDia = false;
  guardandoMenuDia = false;
  programarDiaForm = {
    id_sede: null as number | null,
    numero_menu_ciclo: 1,
    fecha: this.obtenerFechaManana(),
    id_seccion: 1,
    id_jornada: 1,
    ninos_presentes: 120,
    origen_eleccion: 'PAE_ESTIPULADO' as 'PAE_ESTIPULADO' | 'SUGERENCIA_IA',
    opcionSeleccionadaIndex: 0,
    id_plato: null as number | null,
    nombre_plato: '',
    bebida_leche: '',
    proteico: '',
    cereal: '',
    fruta: '',
    agua: 'Agua potable tratada',
    ingredientes: [] as string[],
    pasos: [] as string[]
  };

  // Modal para ver la Ficha Técnica de Receta de un día de la Minuta
  mostrarModalFichaReceta = false;
  celdaRecetaSeleccionada: CeldaDiaMinutaSede | null = null;

  // Modal de Rechazo obligatorio para el Supervisor
  mostrarModalRechazoSupervisor = false;
  rechazoForm = {
    dia: null as CeldaDiaMinutaSede | null,
    momento: '' as 'Desayuno' | 'Almuerzo' | 'Merienda' | '',
    motivo: ''
  };

  // Modal de Novedad (Cancelado de última hora / Sin servicio por no haber clase)
  mostrarModalNovedadMomento = false;
  novedadForm = {
    dia: null as CeldaDiaMinutaSede | null,
    momento: '' as 'Desayuno' | 'Almuerzo' | 'Merienda' | '',
    tipo: 'CANCELADO' as 'CANCELADO' | 'SIN_SERVICIO',
    motivo: ''
  };

  // Estados de formularios clásicos
  mostrarFormulario = false;
  esEdicion = false;
  idEditando: number | null = null;
  mostrarDetallePlato = false;
  platoSeleccionado: any = null;
  detallesPlato: any[] = [];

  menuForm = {
    id_jornada: null as number | null,
    fecha: '',
    ninos_presentes: null as number | null,
    id_contrato: null as number | null,
    id_seccion: 1 as number | null,
    id_sede: null as number | null,
    id_plato: null as number | null,
    estado: 'Programado',
    informacion_nutricional: ''
  };

  platoForm = {
    id_seccion: null as number | null,
    nombre_plato: '',
    componente: ''
  };

  preparacionForm = {
    id_menu: null as number | null,
    id_plato: null as number | null,
    id_usuario_manipuladora: null as number | null,
    fecha: '',
    hora_programada: '',
    estado_preparacion: 'Pendiente',
    observaciones: ''
  };

  detalleForm = {
    id_menu: null as number | null,
    porcion_por_nino: null as number | null,
    total_a_preparar: null as number | null,
    unidad_total: 'raciones',
    estado_preparacion: 'Pendiente'
  };

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.obtenerUsuario();
    this.esSuperAdmin = this.authService.esSuperAdministrador(this.currentUser?.rol);
    this.esAdministrador = this.authService.esAdministrador(this.currentUser?.rol);
    const rolNorm = (this.authService.normalizarRol(this.currentUser?.rol) || '').toLowerCase();
    this.esJefaManipuladoras = rolNorm.includes('jefa') || rolNorm.includes('jefe');
    this.esSupervisor = this.authService.esSupervisor(this.currentUser?.rol) || rolNorm.includes('supervisor') || rolNorm.includes('coordinador');

    this.cargarCatalogoBasePlatos();
    this.cargarContextoSedesYDatos();
  }

  obtenerFechaManana(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  cargarContextoSedesYDatos(): void {
    forkJoin({
      sedes: this.http.get<any>(`${this.apiUrl}/sedes/`).pipe(catchError(() => of([]))),
      usuarios: this.http.get<any>(`${this.apiUrl}/usuarios/`).pipe(catchError(() => of([]))),
      jornadas: this.http.get<any>(`${this.apiUrl}/jornadas/`).pipe(catchError(() => of([]))),
      contratos: this.http.get<any>(`${this.apiUrl}/contratos/`).pipe(catchError(() => of([]))),
      secciones: this.http.get<any>(`${this.apiUrl}/secciones-menu/`).pipe(catchError(() => of([]))),
      platos: this.http.get<any>(`${this.apiUrl}/platos/`).pipe(catchError(() => of([]))),
      menus: this.http.get<any>(`${this.apiUrl}/menus/`).pipe(catchError(() => of([]))),
      detalles: this.http.get<any>(`${this.apiUrl}/detalle-platos/`).pipe(catchError(() => of([]))),
      preparaciones: this.http.get<any>(`${this.apiUrl}/preparaciones-asignadas/`).pipe(catchError(() => of([]))),
      ingredientes: this.http.get<any>(`${this.apiUrl}/ingredientes/`).pipe(catchError(() => of([])))
    }).subscribe(({ sedes, usuarios, jornadas, contratos, secciones, platos, menus, detalles, preparaciones, ingredientes }) => {
      const listaSedes = Array.isArray(sedes) ? sedes : (sedes?.results || []);
      const listaUsuarios = Array.isArray(usuarios) ? usuarios : (usuarios?.results || []);

      const idInstUsuario = typeof this.currentUser?.id_institucion === 'object'
        ? (this.currentUser?.id_institucion?.id_institucion || this.currentUser?.id_institucion?.id)
        : this.currentUser?.id_institucion;
      const idSedeUsuario = typeof this.currentUser?.id_sede === 'object'
        ? (this.currentUser?.id_sede?.id_sede || this.currentUser?.id_sede?.id)
        : this.currentUser?.id_sede;

      const instActiva = this.authService.obtenerInstitucionActiva();
      const idInstSupervisor = instActiva?.id_institucion;

      if (this.esJefaManipuladoras && idSedeUsuario) {
        this.sedesInstitucion = listaSedes.filter((s: any) => Number(s.id_sede || s.id) === Number(idSedeUsuario));
      } else if (this.esSupervisor && idInstSupervisor) {
        const filtradas = listaSedes.filter((s: any) => {
          const sInst = typeof s.id_institucion === 'object'
            ? (s.id_institucion?.id_institucion || s.id_institucion?.id)
            : s.id_institucion;
          return Number(sInst) === Number(idInstSupervisor);
        });
        this.sedesInstitucion = filtradas.length > 0 ? filtradas : listaSedes;
      } else if (this.esAdministrador && idInstUsuario) {
        this.sedesInstitucion = listaSedes.filter((s: any) => {
          const sInst = typeof s.id_institucion === 'object'
            ? (s.id_institucion?.id_institucion || s.id_institucion?.id)
            : s.id_institucion;
          return Number(sInst) === Number(idInstUsuario);
        });
      } else {
        this.sedesInstitucion = listaSedes;
      }

      if (this.sedesInstitucion.length > 0 && !this.sedeSeleccionadaId) {
        this.sedeSeleccionadaId = Number(
          idSedeUsuario || this.sedesInstitucion[0].id_sede || this.sedesInstitucion[0].id
        );
      }

      this.usuariosInstitucion = listaUsuarios;
      this.usuariosManipuladoras = listaUsuarios
        .filter((u: any) => {
          const rolNom = (u.rol_detalle?.nombre_rol || u.rol_detalle?.nombre || u.rol || '').toString().toLowerCase();
          return rolNom.includes('manipuladora') || rolNom.includes('jefa') || rolNom.includes('cocina');
        })
        .map((u: any) => ({
          id_usuario_manipuladora: u.id_usuario || u.id,
          nombre: `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.correo,
          id_sede: typeof u.id_sede === 'object' ? (u.id_sede?.id_sede || u.id_sede?.id) : u.id_sede
        }));

      this.jornadas = Array.isArray(jornadas) ? jornadas : (jornadas?.results || []);
      this.contratos = Array.isArray(contratos) ? contratos : (contratos?.results || []);
      const secApi = Array.isArray(secciones) ? secciones : (secciones?.results || []);
      if (secApi.length > 0) {
        this.seccionesMenu = secApi;
      }

      this.platos = Array.isArray(platos) ? platos : (platos?.results || []);
      this.menusDiarios = Array.isArray(menus) ? menus : (menus?.results || []);
      this.detallesPlatoTodos = Array.isArray(detalles) ? detalles : (detalles?.results || []);
      const preps = Array.isArray(preparaciones) ? preparaciones : (preparaciones?.results || []);
      this.preparacionesAsignadas = preps.map((p: any) => ({
        ...p,
        nombre_menu: `Menú #${p.id_menu}`,
        nombre_plato: this.getNombrePlato(p.id_plato),
        manipuladora: this.getNombreManipuladora(p.id_usuario_manipuladora)
      }));

      const listaIng = Array.isArray(ingredientes) ? ingredientes : (ingredientes?.results || []);
      this.opcionesIngredientes = listaIng.map((i: any) => ({
        id: i.id_ingrediente || i.id,
        label: i.nombre_ingrediente || i.nombre || `Ingrediente #${i.id_ingrediente || i.id}`
      }));
      if (this.opcionesIngredientes.length === 0) {
        this.opcionesIngredientes = [
          { id: 1, label: 'Huevos tipo A' },
          { id: 2, label: 'Leche entera pasteurizada' },
          { id: 3, label: 'Arroz blanco de primera' },
          { id: 4, label: 'Pechuga de pollo' },
          { id: 5, label: 'Carne de res magra molida' },
          { id: 6, label: 'Lentejas secas' },
          { id: 7, label: 'Frijoles rojos' },
          { id: 8, label: 'Harina de maíz precocida' },
          { id: 9, label: 'Avena en hojuelas' },
          { id: 10, label: 'Chocolate en pastilla' },
          { id: 11, label: 'Panela en bloque' },
          { id: 12, label: 'Pasta alimenticia tipo fideos' },
          { id: 13, label: 'Papa común / parda' },
          { id: 14, label: 'Tomate chonto fresco' },
          { id: 15, label: 'Cebolla cabezona / junca' },
          { id: 16, label: 'Zanahoria fresca' },
          { id: 17, label: 'Banano maduro' },
          { id: 18, label: 'Papaya' },
          { id: 19, label: 'Mandarina' },
          { id: 20, label: 'Aceite vegetal comestible' }
        ];
      }

      this.cargarCatalogoBasePlatos();
      this.cdr.detectChanges();
    });
  }

  // ============================================================
  // INFORMACIÓN DE SEDE Y JEFA DE MANIPULADORAS POR SEDE
  // ============================================================

  get sedeActualObj(): any | null {
    if (!this.sedeSeleccionadaId) return null;
    return this.sedesInstitucion.find(
      s => Number(s.id_sede || s.id) === Number(this.sedeSeleccionadaId)
    ) || null;
  }

  obtenerJefaDeSede(idSede: number | null): any | null {
    if (!idSede) return null;
    return this.usuariosInstitucion.find(u => {
      if (u.is_active === false) return false;
      const uSede = typeof u.id_sede === 'object' ? (u.id_sede?.id_sede || u.id_sede?.id) : u.id_sede;
      if (Number(uSede) !== Number(idSede)) return false;
      const rolNom = (u.rol_detalle?.nombre_rol || u.rol_detalle?.nombre || u.rol || '').toString().toLowerCase();
      return rolNom.includes('jefa') || rolNom.includes('jefe');
    }) || null;
  }

  obtenerNombreJefaDeSede(idSede: number | null): string {
    const jefa = this.obtenerJefaDeSede(idSede);
    if (!jefa) return 'Sin jefa asignada';
    return `${jefa.nombre || ''} ${jefa.apellido || ''}`.trim() || jefa.correo;
  }

  get nombreJefaSedeActual(): string {
    const jefa = this.obtenerJefaDeSede(this.sedeSeleccionadaId);
    if (!jefa) return 'Sin Jefa asignada en esta sede';
    return `${jefa.nombre || ''} ${jefa.apellido || ''}`.trim() || jefa.correo;
  }

  seleccionarSede(idSede: number): void {
    this.sedeSeleccionadaId = Number(idSede);
    this.cdr.detectChanges();
  }

  get sedesOpcionesSelect(): any[] {
    return this.sedesInstitucion.map(s => {
      const id = Number(s.id_sede || s.id);
      const jefa = this.obtenerJefaDeSede(id);
      const jefaTexto = jefa ? ` — Jefa: ${jefa.nombre} ${jefa.apellido || ''}`.trim() : ' — Sin Jefa asignada';
      return {
        id_sede: id,
        label: `${s.nombre_sede || s.nombre}${jefaTexto}`
      };
    });
  }

  // ============================================================
  // CONSTRUCCIÓN DINÁMICA DE LA MINUTA DE 20 DÍAS POR SEDE
  // ============================================================

  get momentosVisibles(): ('Desayuno' | 'Almuerzo' | 'Merienda')[] {
    if (this.filtroSeccionMinuta && this.filtroSeccionMinuta !== 'TODAS') {
      return [this.filtroSeccionMinuta as 'Desayuno' | 'Almuerzo' | 'Merienda'];
    }
    return ['Desayuno', 'Almuerzo', 'Merienda'];
  }

  crearMomentoVacio(momento: 'Desayuno' | 'Almuerzo' | 'Merienda'): MomentoDiaMinuta {
    return {
      momento,
      tiene_menu_registrado: false,
      nombre_plato: '',
      origen: 'PENDIENTE',
      ninos_presentes: 0,
      estado_aprobacion: 'PENDIENTE',
      motivo_rechazo_o_cancelacion: '',
      componentes: {
        bebida_leche: '—',
        proteico: '—',
        cereal: '—',
        fruta: '—',
        agua: '—'
      },
      ingredientes: [],
      pasos: []
    };
  }

  private leerMinutasLocalesPorSede(): Record<string, Record<string, any>> {
    try {
      const raw = localStorage.getItem(this.STORAGE_MINUTA_SEDE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  guardarMomentoEnMinutaLocalSede(
    idSede: number,
    numeroMenu: number,
    momento: string,
    datos: Partial<MomentoDiaMinuta>
  ): void {
    try {
      const todo = this.leerMinutasLocalesPorSede();
      const key = String(idSede);
      if (!todo[key]) todo[key] = {};
      const slotKey = `${numeroMenu}_${momento.toLowerCase()}`;
      todo[key][slotKey] = {
        ...(todo[key][slotKey] || {}),
        ...datos,
        momento: momento as any,
        tiene_menu_registrado: datos.tiene_menu_registrado !== undefined ? datos.tiene_menu_registrado : true
      };
      localStorage.setItem(this.STORAGE_MINUTA_SEDE_KEY, JSON.stringify(todo));
    } catch (e) {
      console.warn('No se pudo guardar minuta local de la sede:', e);
    }
  }

  private guardarDiaEnMinutaLocalSede(idSede: number, numeroMenu: number, datos: any): void {
    const sec = datos.seccion || 'Almuerzo';
    this.guardarMomentoEnMinutaLocalSede(idSede, numeroMenu, sec, {
      ...datos,
      momento: sec as any,
      estado_aprobacion: datos.estado_aprobacion || 'PENDIENTE'
    });
  }

  extraerComponentesDesdePlato(nombrePlato: string, componenteTexto: string, platoObj?: any): {
    bebida_leche: string;
    proteico: string;
    cereal: string;
    fruta: string;
    agua: string;
  } {
    const base = {
      bebida_leche: '—',
      proteico: '—',
      cereal: '—',
      fruta: '—',
      agua: '—'
    };

    // 1. Revisar componentes estructurados del objeto plato
    if (platoObj && Array.isArray(platoObj.componentes)) {
      for (const comp of platoObj.componentes) {
        const tipo = (comp.tipo_componente || '').toLowerCase();
        const nom = (comp.nombre_componente || '').trim();
        if (!nom) continue;
        if (tipo.includes('bebida') || tipo.includes('leche')) base.bebida_leche = nom;
        else if (tipo.includes('proteico') || tipo.includes('proteina')) base.proteico = nom;
        else if (tipo.includes('cereal')) base.cereal = nom;
        else if (tipo.includes('fruta')) base.fruta = nom;
        else if (tipo.includes('agua')) base.agua = nom;
      }
    }

    if (platoObj && Array.isArray(platoObj.receta_componentes)) {
      for (const rc of platoObj.receta_componentes) {
        const tipo = (rc.tipo_componente || '').toLowerCase();
        const nom = (rc.nombre_componente || rc.nombre_ingrediente || '').trim();
        if (!nom) continue;
        if ((tipo.includes('bebida') || tipo.includes('leche')) && base.bebida_leche === '—') base.bebida_leche = nom;
        else if ((tipo.includes('proteico') || tipo.includes('proteina')) && base.proteico === '—') base.proteico = nom;
        else if (tipo.includes('cereal') && base.cereal === '—') base.cereal = nom;
        else if (tipo.includes('fruta') && base.fruta === '—') base.fruta = nom;
        else if (tipo.includes('agua') && base.agua === '—') base.agua = nom;
      }
    }

    // 2. Extraer desde el texto del componente o nombre del plato
    const texto = `${componenteTexto || ''} | ${nombrePlato || ''}`;
    const partes = texto.split(/[,•|\/]+/).map(s => s.trim()).filter(Boolean);

    for (const p of partes) {
      const low = p.toLowerCase();
      if ((low.includes('bebida') || low.includes('leche') || low.includes('avena') || low.includes('colada') || low.includes('chocolate') || low.includes('café') || low.includes('peto')) && base.bebida_leche === '—') {
        base.bebida_leche = p.replace(/^bebida con leche:\s*/i, '').trim();
      } else if ((low.includes('proteico') || low.includes('huevo') || low.includes('pollo') || low.includes('carne') || low.includes('queso') || low.includes('lenteja') || low.includes('frijol')) && base.proteico === '—') {
        base.proteico = p.replace(/^alimento proteico:\s*/i, '').trim();
      } else if ((low.includes('cereal') || low.includes('arepa') || low.includes('arroz') || low.includes('pan') || low.includes('papa') || low.includes('maduro') || low.includes('bollo') || low.includes('galleta') || low.includes('envuelto') || low.includes('pasta') || low.includes('fideos')) && base.cereal === '—') {
        base.cereal = p.replace(/^cereal acompañante:\s*/i, '').trim();
      } else if ((low.includes('fruta') || low.includes('mango') || low.includes('mandarina') || low.includes('pera') || low.includes('banano') || low.includes('melón') || low.includes('manzana') || low.includes('granadilla') || low.includes('papaya') || low.includes('guayaba') || low.includes('piña')) && base.fruta === '—') {
        base.fruta = p.replace(/^fruta:\s*/i, '').trim();
      } else if (low.includes('agua') && base.agua === '—') {
        base.agua = p.replace(/^agua:\s*/i, '').trim();
      }
    }

    return base;
  }

  limpiarNombrePlato(nombre: string): string {
    if (!nombre) return '';
    return nombre.replace(/^men[uú]\s*\d+\s*:\s*/i, '').trim();
  }

  private getCatalogo20MenusBasePAE(): {
    numeroMenu: number;
    semana: number;
    nombre_plato: string;
    seccion: string;
    secciones: string[];
    componentes: { bebida_leche: string; proteico: string; cereal: string; fruta: string; agua: string };
    ingredientes: string[];
    pasos: string[];
  }[] {
    return [
      {
        numeroMenu: 1, semana: 1, seccion: 'Desayuno',
        secciones: ['Desayuno'],
        nombre_plato: 'Pericos con arroz',
        componentes: { bebida_leche: 'Refresco de avena', proteico: 'Huevos pericos', cereal: 'Arroz blanco', fruta: '—', agua: 'Agua potable' },
        ingredientes: ['Avena', 'Leche líquida', 'Azúcar', 'Huevos', 'Tomate', 'Cebolla', 'Arroz', 'Ajo', 'Aceite vegetal', 'Sal', 'Agua potable'],
        pasos: ['Preparar el refresco de avena con leche líquida y azúcar.', 'Elaborar los huevos pericos bien cocidos con tomate y cebolla.', 'Cocinar el arroz blanco con ajo y sal, servir con agua potable.']
      },
      {
        numeroMenu: 2, semana: 1, seccion: 'Almuerzo',
        secciones: ['Almuerzo'],
        nombre_plato: 'Pollo en salsa blanca con pasta',
        componentes: { bebida_leche: 'Jugo de fruta en leche', proteico: 'Pollo en salsa blanca', cereal: 'Pasta', fruta: '—', agua: '—' },
        ingredientes: ['Leche líquida', 'Azúcar', 'Mango', 'Pollo', 'Harina de trigo', 'Mantequilla', 'Pasta', 'Sal', 'Agua potable'],
        pasos: ['Licuar el jugo de fruta en leche líquida con azúcar.', 'Cocinar el pollo y preparar en salsa blanca suave.', 'Cocinar la pasta al dente y servir caliente.']
      },
      {
        numeroMenu: 3, semana: 1, seccion: 'Desayuno',
        secciones: ['Desayuno', 'Merienda'],
        nombre_plato: 'Arepa con chocolate',
        componentes: { bebida_leche: 'Chocolate en leche', proteico: '—', cereal: 'Arepa de maíz', fruta: 'Banano', agua: '—' },
        ingredientes: ['Chocolate', 'Leche líquida', 'Azúcar', 'Harina de maíz', 'Mantequilla', 'Sal', 'Banano'],
        pasos: ['Preparar el chocolate en leche líquida caliente con azúcar.', 'Asar la arepa de maíz en plancha limpia.', 'Lavar y entregar el banano para el servicio.']
      },
      {
        numeroMenu: 4, semana: 1, seccion: 'Almuerzo',
        secciones: ['Almuerzo'],
        nombre_plato: 'Lentejas con arroz',
        componentes: { bebida_leche: 'Jugo de fruta en leche', proteico: 'Lentejas con papa guisada', cereal: 'Arroz blanco', fruta: '—', agua: '—' },
        ingredientes: ['Leche líquida', 'Azúcar', 'Mango', 'Lentejas', 'Papa', 'Tomate', 'Cebolla', 'Ajo', 'Arroz', 'Aceite vegetal', 'Sal', 'Agua potable'],
        pasos: ['Preparar el jugo de fruta en leche líquida.', 'Cocinar las lentejas guisadas con papa, tomate y cebolla.', 'Preparar el arroz blanco con ajo y servir.']
      },
      {
        numeroMenu: 5, semana: 1, seccion: 'Desayuno',
        secciones: ['Desayuno'],
        nombre_plato: 'Torta de huevo con arroz',
        componentes: { bebida_leche: 'Bebida dulce en leche', proteico: 'Torta de huevo', cereal: 'Arroz blanco', fruta: '—', agua: '—' },
        ingredientes: ['Leche líquida', 'Azúcar', 'Huevos', 'Tomate', 'Cebolla', 'Arroz', 'Ajo', 'Aceite vegetal', 'Sal', 'Agua potable'],
        pasos: ['Preparar la bebida dulce en leche líquida con azúcar.', 'Cocinar completamente la torta de huevo con tomate y cebolla.', 'Acompañar con arroz blanco recién hecho con ajo y sal.']
      },
      {
        numeroMenu: 6, semana: 2, seccion: 'Almuerzo',
        secciones: ['Almuerzo'],
        nombre_plato: 'Carne guisada con arroz',
        componentes: { bebida_leche: 'Refresco de avena', proteico: 'Carne de res guisada', cereal: 'Arroz blanco', fruta: '—', agua: '—' },
        ingredientes: ['Avena', 'Leche líquida', 'Azúcar', 'Carne de res', 'Tomate', 'Cebolla', 'Pimentón', 'Ajo', 'Arroz', 'Aceite vegetal', 'Sal', 'Agua potable'],
        pasos: ['Preparar el refresco de avena en leche líquida con azúcar.', 'Guisar la carne de res con tomate, cebolla y pimentón hasta que esté blanda.', 'Servir acompañada de arroz blanco con ajo.']
      },
      {
        numeroMenu: 7, semana: 2, seccion: 'Merienda',
        secciones: ['Merienda', 'Desayuno'],
        nombre_plato: 'Hojaldras con chocolate',
        componentes: { bebida_leche: 'Chocolate en leche', proteico: '—', cereal: 'Hojaldras', fruta: 'Papaya', agua: 'Agua potable' },
        ingredientes: ['Chocolate', 'Leche líquida', 'Azúcar', 'Harina de trigo', 'Polvo de hornear', 'Aceite vegetal', 'Sal', 'Papaya', 'Agua potable'],
        pasos: ['Preparar el chocolate en leche líquida caliente.', 'Elaborar y freír las hojaldras hasta dorar.', 'Porcionar la papaya limpia y entregar con agua potable.']
      },
      {
        numeroMenu: 8, semana: 2, seccion: 'Almuerzo',
        secciones: ['Almuerzo'],
        nombre_plato: 'Frijoles guisados con arroz',
        componentes: { bebida_leche: 'Bebida dulce en leche', proteico: 'Frijoles guisados con papa', cereal: 'Arroz con fideos', fruta: '—', agua: '—' },
        ingredientes: ['Leche líquida', 'Azúcar', 'Frijoles', 'Papa', 'Tomate', 'Cebolla', 'Ajo', 'Arroz', 'Pasta', 'Aceite vegetal', 'Sal', 'Agua potable'],
        pasos: ['Preparar la bebida dulce en leche líquida con azúcar.', 'Cocinar los frijoles guisados con papa.', 'Preparar el arroz con fideos dorados y servir.']
      },
      {
        numeroMenu: 9, semana: 2, seccion: 'Merienda',
        secciones: ['Merienda', 'Desayuno'],
        nombre_plato: 'Galleta cuca con leche',
        componentes: { bebida_leche: 'Leche líquida', proteico: 'Galleta', cereal: 'Maní salado', fruta: 'Mango', agua: '—' },
        ingredientes: ['Leche líquida', 'Galleta', 'Maní salado', 'Mango'],
        pasos: ['Servir la porción de leche líquida.', 'Acompañar con galleta y maní salado.', 'Entregar con mango lavado y porcionado.']
      },
      {
        numeroMenu: 10, semana: 2, seccion: 'Desayuno',
        secciones: ['Desayuno'],
        nombre_plato: 'Huevos revueltos con arroz',
        componentes: { bebida_leche: 'Jugo de fruta en leche', proteico: 'Huevos revueltos', cereal: 'Arroz blanco', fruta: '—', agua: '—' },
        ingredientes: ['Leche líquida', 'Azúcar', 'Mango', 'Huevos', 'Arroz', 'Ajo', 'Aceite vegetal', 'Sal', 'Agua potable'],
        pasos: ['Preparar el jugo de fruta en leche líquida.', 'Cocinar los huevos revueltos bien cocidos en sartén caliente.', 'Servir con arroz blanco recién hecho con ajo y sal.']
      },
      {
        numeroMenu: 11, semana: 3, seccion: 'Almuerzo',
        secciones: ['Almuerzo'],
        nombre_plato: 'Pollo guisado con arroz',
        componentes: { bebida_leche: 'Refresco de avena', proteico: 'Pollo guisado', cereal: 'Arroz blanco', fruta: '—', agua: '—' },
        ingredientes: ['Avena', 'Leche líquida', 'Azúcar', 'Pollo', 'Tomate', 'Cebolla', 'Pimentón', 'Ajo', 'Papa', 'Arroz', 'Aceite vegetal', 'Sal', 'Agua potable'],
        pasos: ['Preparar el refresco de avena en leche líquida con azúcar.', 'Cocinar el pollo guisado con tomate, cebolla, pimentón y papa.', 'Servir con arroz blanco con ajo.']
      },
      {
        numeroMenu: 12, semana: 3, seccion: 'Merienda',
        secciones: ['Merienda', 'Desayuno'],
        nombre_plato: 'Torta pastel con yogurt',
        componentes: { bebida_leche: 'Yogurt', proteico: '—', cereal: 'Torta pastel', fruta: 'Manzana', agua: '—' },
        ingredientes: ['Yogurt', 'Harina de trigo', 'Huevos', 'Azúcar', 'Mantequilla', 'Polvo de hornear', 'Leche líquida', 'Manzana'],
        pasos: ['Servir el yogurt frío.', 'Entregar con porción de torta pastel.', 'Acompañar con manzana lavada y desinfectada.']
      },
      {
        numeroMenu: 13, semana: 3, seccion: 'Almuerzo',
        secciones: ['Almuerzo'],
        nombre_plato: 'Arroz con cerdo y verduras',
        componentes: { bebida_leche: 'Jugo de fruta en leche', proteico: 'Arroz con carne de cerdo y verduras', cereal: 'Arroz con carne de cerdo y verduras', fruta: '—', agua: 'Agua potable' },
        ingredientes: ['Leche líquida', 'Azúcar', 'Mango', 'Carne de cerdo', 'Arroz', 'Zanahoria', 'Pimentón', 'Ajo', 'Aceite vegetal', 'Sal', 'Agua potable'],
        pasos: ['Preparar el jugo de fruta en leche líquida.', 'Cocinar la carne de cerdo salteada con verduras e integrar con el arroz.', 'Servir con agua potable.']
      },
      {
        numeroMenu: 14, semana: 4, seccion: 'Merienda',
        secciones: ['Merienda', 'Desayuno'],
        nombre_plato: 'Arroz con leche y galletas',
        componentes: { bebida_leche: 'Arroz con leche y canela', proteico: '—', cereal: 'Galleta tipo crackers', fruta: 'Papaya', agua: 'Agua potable' },
        ingredientes: ['Arroz', 'Leche líquida', 'Azúcar', 'Canela', 'Galleta tipo crackers', 'Papaya', 'Agua potable'],
        pasos: ['Preparar el arroz con leche líquida, azúcar y canela.', 'Acompañar con galleta tipo crackers.', 'Entregar con porción de papaya fresca y agua potable.']
      },
      {
        numeroMenu: 15, semana: 4, seccion: 'Almuerzo',
        secciones: ['Almuerzo'],
        nombre_plato: 'Pollo con verduras y papas',
        componentes: { bebida_leche: 'Refresco de avena', proteico: 'Pollo en julianas con verduras', cereal: 'Papas en casco', fruta: '—', agua: '—' },
        ingredientes: ['Avena', 'Leche líquida', 'Azúcar', 'Pollo', 'Zanahoria', 'Pimentón', 'Cebolla', 'Papa', 'Aceite vegetal', 'Sal', 'Agua potable'],
        pasos: ['Preparar el refresco de avena en leche líquida con azúcar.', 'Saltear y cocinar el pollo en julianas con verduras.', 'Asar las papas en casco y servir.']
      }
    ];
  }

  // ============================================================
  // CONFIGURACIÓN DE MOMENTOS (SECCIONES) POR SEDE
  // ============================================================
  obtenerMomentosDeSede(idSede: number | null): string[] {
    if (!idSede) return ['Desayuno', 'Almuerzo', 'Merienda'];
    try {
      const raw = localStorage.getItem(this.STORAGE_SEDES_MOMENTOS_KEY);
      const mapa = raw ? JSON.parse(raw) : {};
      if (mapa[String(idSede)] && Array.isArray(mapa[String(idSede)])) {
        const list = mapa[String(idSede)];
        if (!list.includes('Merienda')) list.push('Merienda');
        return list;
      }
    } catch (e) {
      console.error('Error al leer momentos de la sede:', e);
    }
    return ['Desayuno', 'Almuerzo', 'Merienda'];
  }

  sedeManejaMomento(idSede: number | null, momento: string): boolean {
    return this.obtenerMomentosDeSede(idSede).includes(momento);
  }

  toggleMomentoEnSede(idSede: number | null, momento: string): void {
    if (!idSede) return;
    const momentosActuales = [...this.obtenerMomentosDeSede(idSede)];
    const idx = momentosActuales.indexOf(momento);
    if (idx >= 0) {
      if (momentosActuales.length <= 1) {
        this.sweetAlert.warning('Momento requerido', 'La sede debe manejar al menos un momento de menú (Desayuno, Almuerzo o Merienda).');
        return;
      }
      momentosActuales.splice(idx, 1);
    } else {
      momentosActuales.push(momento);
    }

    try {
      const raw = localStorage.getItem(this.STORAGE_SEDES_MOMENTOS_KEY);
      const mapa = raw ? JSON.parse(raw) : {};
      mapa[String(idSede)] = momentosActuales;
      localStorage.setItem(this.STORAGE_SEDES_MOMENTOS_KEY, JSON.stringify(mapa));
      this.sweetAlert.success(
        'Configuración de Sede actualizada',
        `Esta sede ahora maneja: ${momentosActuales.join(', ')}.`
      );
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error al guardar momentos de la sede:', e);
    }
  }

  // ============================================================
  // CATÁLOGO DE PLATOS Y RECETAS PAE (SUPERVISOR Y COCINA)
  // ============================================================
  private normalizarTextoComp(t: any): string {
    return (t || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private obtenerFirmaComponentesPlato(comp: any): string {
    if (!comp) return '';
    const b = this.normalizarTextoComp(comp.bebida_leche);
    const p = this.normalizarTextoComp(comp.proteico);
    const c = this.normalizarTextoComp(comp.cereal);
    const f = this.normalizarTextoComp(comp.fruta);
    const contenido = [b, p, c, f].filter(x => x && x !== '' && x !== '—');
    if (contenido.length === 0) return '';
    return `${b}|${p}|${c}|${f}`;
  }

  private obtenerClaveCanonicaPlato(nombre: string): string {
    const norm = (nombre || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (norm.includes('frijol')) return 'frijoles_guisados_arroz';
    if (norm.includes('perico')) return 'pericos_con_arroz';
    if (norm.includes('torta de huevo')) return 'torta_huevo_arroz';
    if (norm.includes('lenteja')) return 'lentejas_con_arroz';
    if (norm.includes('pollo') && (norm.includes('salsa blanca') || norm.includes('pasta'))) return 'pollo_salsa_blanca_pasta';
    if (norm.includes('pollo') && norm.includes('guisado')) return 'pollo_guisado_arroz';
    if (norm.includes('pollo') && (norm.includes('verdura') || norm.includes('papa'))) return 'pollo_verduras_papas';
    if (norm.includes('carne') && norm.includes('guisada')) return 'carne_guisada_arroz';
    if (norm.includes('arepa') && norm.includes('chocolate')) return 'arepa_con_chocolate';
    if (norm.includes('hojaldra')) return 'hojaldras_con_chocolate';
    if (norm.includes('cuca')) return 'galleta_cuca_leche';
    if (norm.includes('revuelto')) return 'huevos_revueltos_arroz';
    if (norm.includes('pastel') || norm.includes('yogurt')) return 'torta_pastel_yogurt';
    if (norm.includes('cerdo')) return 'arroz_cerdo_verduras';
    if (norm.includes('arroz con leche')) return 'arroz_leche_galletas';

    return norm.replace(/[^a-z0-9]/g, '');
  }

  cargarCatalogoBasePlatos(): void {
    // 1. Limpiar versiones anteriores del almacenamiento local para que no persistan duplicados ni momentos desactualizados
    try {
      localStorage.removeItem('sirae_platos_catalogo_personalizados_v1');
      localStorage.removeItem('sirae_platos_catalogo_personalizados_v2');
      localStorage.removeItem('sirae_platos_catalogo_personalizados_v3');
      localStorage.removeItem('sirae_platos_catalogo_personalizados_v4');
      localStorage.removeItem('sirae_platos_catalogo_personalizados_v5');
      localStorage.removeItem('sirae_catalogo_componentes_pae_v1');
      localStorage.removeItem('sirae_catalogo_platos_pae_estipulados_v1');
    } catch {}

    const baseMenus = this.getCatalogo20MenusBasePAE();
    const baseMap = new Map<string, any>();
    for (const b of baseMenus) {
      const k = this.obtenerClaveCanonicaPlato(b.nombre_plato);
      if (k) baseMap.set(k, b);
    }

    let personalizados: any[] = [];
    try {
      const raw = localStorage.getItem(this.STORAGE_PLATOS_CATALOGO_KEY);
      personalizados = raw ? JSON.parse(raw) : [];
    } catch {
      personalizados = [];
    }

    const mapa = new Map<string, any>();
    const componentesRegistrados = new Set<string>();

    const registrarPlatoUnico = (item: any) => {
      if (!item || !item.nombre_plato) return;
      item.nombre_plato = this.limpiarNombrePlato(item.nombre_plato);
      const claveCanon = this.obtenerClaveCanonicaPlato(item.nombre_plato);
      if (!claveCanon || mapa.has(claveCanon)) return;

      const firma = this.obtenerFirmaComponentesPlato(item.componentes);
      // Evitar registrar platos que tengan exactamente los mismos componentes
      if (firma && componentesRegistrados.has(firma)) {
        return;
      }
      if (firma) {
        componentesRegistrados.add(firma);
      }
      mapa.set(claveCanon, item);
    };

    let eliminados: string[] = [];
    try {
      const rawEl = localStorage.getItem('sirae_platos_eliminados_v1');
      eliminados = rawEl ? JSON.parse(rawEl) : [];
    } catch {
      eliminados = [];
    }

    // 1. Platos base oficiales del PAE (con sus secciones canónicas actualizadas)
    for (const b of baseMenus) {
      const k = this.obtenerClaveCanonicaPlato(b.nombre_plato);
      if (k && eliminados.includes(k)) continue;
      registrarPlatoUnico(b);
    }

    // 2. Platos personalizados o editados previamente por el usuario
    for (const pers of personalizados) {
      if (!pers || !pers.nombre_plato) continue;
      const k = this.obtenerClaveCanonicaPlato(pers.nombre_plato);
      if (!k) continue;

      if (baseMap.has(k)) {
        // Es un plato base que el usuario configuró o editó:
        // Preservamos sus componentes editados, ingredientes y pasos personalizados
        const base = baseMap.get(k);
        const platoActualizado = {
          ...base,
          ...pers,
          secciones: pers.secciones && pers.secciones.length > 0 && pers.secciones.length < 3
            ? pers.secciones
            : base.secciones,
          seccion: base.seccion,
          componentes: pers.componentes || base.componentes,
          componentes_estructurados: pers.componentes_estructurados || base.componentes_estructurados
        };
        mapa.set(k, platoActualizado);
      } else {
        // Plato totalmente nuevo creado por el usuario
        registrarPlatoUnico(pers);
      }
    }

    // 3. Platos traídos del backend
    for (const p of this.platos || []) {
      const secNom = this.getNombreSeccion(p.id_seccion);
      const secs = secNom && secNom !== 'Desconocida' ? [secNom] : ['Desayuno', 'Almuerzo'];
      const platoObj = {
        id_plato: p.id_plato,
        numeroMenu: p.id_plato,
        nombre_plato: this.limpiarNombrePlato(p.nombre_plato),
        secciones: secs,
        seccion: secs[0],
        componentes: this.extraerComponentesDesdePlato(p.nombre_plato, p.componente, p),
        ingredientes: (p.receta_componentes || []).map((rc: any) => rc.nombre_ingrediente).filter(Boolean),
        pasos: (p.pasos_preparacion || []).map((ps: any) => ps.descripcion_paso).filter(Boolean),
        origen: 'PAE_ESTIPULADO'
      };
      registrarPlatoUnico(platoObj);
    }

    this.platosEstipuladosPAE = Array.from(mapa.values());
    this.guardarEstadoCatalogoPlatos();
    this.cdr.detectChanges();
  }

  private guardarEstadoCatalogoPlatos(): void {
    try {
      localStorage.setItem(this.STORAGE_PLATOS_CATALOGO_KEY, JSON.stringify(this.platosEstipuladosPAE));
    } catch (e) {
      console.error('Error guardando catálogo de platos:', e);
    }
  }

  get catalogoPlatosVista(): any[] {
    const mapaUnicos = new Map<string, any>();
    const baseMenus = this.getCatalogo20MenusBasePAE();
    const baseMap = new Map<string, any>();
    for (const b of baseMenus) {
      const k = this.obtenerClaveCanonicaPlato(b.nombre_plato);
      if (k) baseMap.set(k, b);
    }

    for (const p of this.platosEstipuladosPAE || []) {
      const nombreLimpio = this.limpiarNombrePlato(p.nombre_plato);
      if (!nombreLimpio) continue;

      const claveCanon = this.obtenerClaveCanonicaPlato(nombreLimpio);
      if (mapaUnicos.has(claveCanon)) continue;

      const baseMatch = baseMap.get(claveCanon);
      const secRaw = baseMatch
        ? [...baseMatch.secciones]
        : (p.secciones && p.secciones.length > 0
            ? p.secciones
            : (p.seccion ? [p.seccion] : ['Desayuno', 'Almuerzo']));

      mapaUnicos.set(claveCanon, {
        ...p,
        nombre_plato: nombreLimpio,
        secciones: secRaw
      });
    }

    let lista = Array.from(mapaUnicos.values());

    if (this.filtroMomentoPlatos && this.filtroMomentoPlatos !== 'TODAS') {
      if (this.filtroMomentoPlatos === 'SEDE_ACTIVA') {
        const momentosSede = this.obtenerMomentosDeSede(this.sedeSeleccionadaId);
        lista = lista.filter(p =>
          (p.secciones || []).some((s: string) => momentosSede.includes(s))
        );
      } else {
        lista = lista.filter(p =>
          (p.secciones || []).some((s: string) => s.toLowerCase() === this.filtroMomentoPlatos.toLowerCase())
        );
      }
    }

    if (this.busquedaPlatos && this.busquedaPlatos.trim()) {
      const q = this.busquedaPlatos.trim().toLowerCase();
      lista = lista.filter(p => (p.nombre_plato || '').toLowerCase().includes(q));
    }

    return lista;
  }

  crearComponenteVacio(tipo: string = 'Alimento proteico', nombre: string = ''): ComponentePlatoReceta {
    return {
      id_temporal: 'comp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      tipo_componente: tipo,
      nombre_componente: nombre,
      ingredientes: [],
      pasos: [{ numero_paso: 1, descripcion_paso: '' }],
      ingredienteTempId: null,
      observacionTemp: ''
    };
  }

  obtenerMenuBasePorNombre(nombrePlato: string): any {
    const k = this.obtenerClaveCanonicaPlato(nombrePlato);
    if (!k) return null;
    const baseMenus = this.getCatalogo20MenusBasePAE();
    return baseMenus.find(b => this.obtenerClaveCanonicaPlato(b.nombre_plato) === k) || null;
  }

  crearComponentesDesdeMenuPAE(menuBase: any): ComponentePlatoReceta[] {
    const comps: ComponentePlatoReceta[] = [];
    let contador = 1;

    // Si el objeto recibido no trae componentes completos, buscar en la minuta oficial PAE
    const canon = this.obtenerMenuBasePorNombre(menuBase?.nombre_plato);
    const fuente = canon || menuBase;

    const agregarComp = (tipo: string, nombre: string, defaultIngs: string[] = [], defaultPasos: string[] = []) => {
      if (!nombre || nombre === '—') return;
      const baseReceta = this.buscarComponenteEnCatalogo(nombre) || CATALOGO_PREPARACIONES_PAE[(nombre || '').trim().toLowerCase()];
      if (baseReceta && (baseReceta.ingredientes?.length > 0 || baseReceta.pasos?.length > 0)) {
        comps.push({
          id_temporal: 'comp_' + Date.now() + '_' + (contador++),
          tipo_componente: baseReceta.tipo_componente || tipo,
          nombre_componente: baseReceta.nombre_componente || nombre,
          ingredientes: (baseReceta.ingredientes || []).map(i => ({ ...i })),
          pasos: (baseReceta.pasos || []).map((p, idx) => ({ numero_paso: idx + 1, descripcion_paso: p.descripcion_paso })),
          ingredienteTempId: null,
          observacionTemp: ''
        });
        return;
      }
      comps.push({
        id_temporal: 'comp_' + Date.now() + '_' + (contador++),
        tipo_componente: tipo,
        nombre_componente: nombre,
        ingredientes: defaultIngs.map((ing, idx) => ({
          id_ingrediente: idx + 1,
          nombre_ingrediente: ing,
          unidad: 'g',
          observacion: ''
        })),
        pasos: defaultPasos.length > 0
          ? defaultPasos.map((p, idx) => ({ numero_paso: idx + 1, descripcion_paso: p }))
          : [{ numero_paso: 1, descripcion_paso: `Preparar ${nombre} según guía PAE.` }],
        ingredienteTempId: null,
        observacionTemp: ''
      });
    };

    if (fuente.componentes) {
      if (fuente.componentes.bebida_leche && fuente.componentes.bebida_leche !== '—') {
        agregarComp('Bebida con leche', fuente.componentes.bebida_leche);
      }

      if (fuente.componentes.proteico && fuente.componentes.proteico !== '—') {
        agregarComp('Alimento proteico', fuente.componentes.proteico);
      }

      if (fuente.componentes.cereal && fuente.componentes.cereal !== '—') {
        agregarComp('Cereal acompañante', fuente.componentes.cereal);
      }

      if (fuente.componentes.fruta && fuente.componentes.fruta !== '—') {
        agregarComp('Fruta', fuente.componentes.fruta, [fuente.componentes.fruta], ['Lavar, desinfectar y porcionar la fruta fresca.']);
      }

      if (fuente.componentes.agua && fuente.componentes.agua !== '—') {
        agregarComp('Agua', fuente.componentes.agua, ['Agua potable'], ['Servir agua potable fresca en vasos limpios.']);
      }
    }

    if (comps.length === 0) {
      comps.push(this.crearComponenteVacio('Alimento proteico', menuBase.nombre_plato || 'Componente principal'));
    }

    return comps;
  }

  abrirModalRecetaPlato(plato: any): void {
    this.modoEdicionReceta = true;
    this.platoRecetaSeleccionado = plato;

    const baseCanon = this.obtenerMenuBasePorNombre(plato.nombre_plato);
    let compsExistentes: ComponentePlatoReceta[] = [];

    const tieneCompsValidos = Array.isArray(plato.componentes_estructurados) &&
      plato.componentes_estructurados.length > 0 &&
      plato.componentes_estructurados.some((c: any) => c.ingredientes && c.ingredientes.length > 0);

    if (tieneCompsValidos) {
      compsExistentes = JSON.parse(JSON.stringify(plato.componentes_estructurados));
    } else {
      compsExistentes = this.crearComponentesDesdeMenuPAE(baseCanon || plato);
    }

    this.menuRecetaForm = {
      id_plato: plato.id_plato,
      numero_menu: plato.numeroMenu || baseCanon?.numeroMenu,
      nombre_plato: this.limpiarNombrePlato(plato.nombre_plato),
      secciones: (plato.secciones && plato.secciones.length > 0 && plato.secciones.length < 3)
        ? plato.secciones
        : (baseCanon?.secciones || ['Desayuno', 'Almuerzo']),
      componentes: compsExistentes
    };

    this.modalRecetaPlatoAbierto = true;
    this.cdr.detectChanges();
  }

  abrirModalCrearPlato(): void {
    this.modoEdicionReceta = false;
    this.platoRecetaSeleccionado = null;
    const sigNumero = (this.platosEstipuladosPAE?.length || 19) + 1;
    this.menuRecetaForm = {
      numero_menu: sigNumero,
      nombre_plato: '',
      secciones: this.obtenerMomentosDeSede(this.sedeSeleccionadaId),
      componentes: [
        this.crearComponenteVacio('Bebida con leche', ''),
        this.crearComponenteVacio('Alimento proteico', ''),
        this.crearComponenteVacio('Cereal acompañante', '')
      ]
    };
    this.modalRecetaPlatoAbierto = true;
    this.cdr.detectChanges();
  }

  platoAplicaMomento(momento: string): boolean {
    return (this.menuRecetaForm.secciones || []).includes(momento);
  }

  toggleMomentoEnPlatoForm(momento: string): void {
    if (!this.menuRecetaForm.secciones) {
      this.menuRecetaForm.secciones = [];
    }
    const idx = this.menuRecetaForm.secciones.indexOf(momento);
    if (idx >= 0) {
      if (this.menuRecetaForm.secciones.length <= 1) {
        this.sweetAlert.warning('Momento requerido', 'El plato debe pertenecer al menos a una sección o momento.');
        return;
      }
      this.menuRecetaForm.secciones.splice(idx, 1);
    } else {
      this.menuRecetaForm.secciones.push(momento);
    }
    this.menuRecetaForm.secciones = [...this.menuRecetaForm.secciones];
    this.cdr.detectChanges();
  }

  trackByCompId(index: number, comp: ComponentePlatoReceta): string {
    return comp.id_temporal || ('comp_' + index);
  }

  get opcionesComponentesReutilizables(): { id: string; label: string }[] {
    const catalogo = this.obtenerCatalogoComponentesLocal();
    return Object.values(catalogo).map(c => ({
      id: c.nombre_componente,
      label: `${c.nombre_componente} (${c.tipo_componente} • ${c.ingredientes.length} ingr.)`
    }));
  }

  private obtenerCatalogoComponentesLocal(): Record<string, ComponentePlatoReceta> {
    try {
      const raw = localStorage.getItem(this.STORAGE_COMP_CATALOGO_KEY);
      const guardado = raw ? JSON.parse(raw) : {};
      const res: Record<string, ComponentePlatoReceta> = { ...CATALOGO_PREPARACIONES_PAE };
      for (const [k, v] of Object.entries(guardado)) {
        if (v && typeof v === 'object' && Array.isArray((v as any).ingredientes) && (v as any).ingredientes.length > 0) {
          res[k] = v as any;
        }
      }
      return res;
    } catch {
      return { ...CATALOGO_PREPARACIONES_PAE };
    }
  }

  private buscarComponenteEnCatalogo(nombreComponente: string): ComponentePlatoReceta | null {
    const clave = (nombreComponente || '').trim().toLowerCase();
    if (!clave) return null;
    const cat = this.obtenerCatalogoComponentesLocal();
    if (cat[clave]) return cat[clave];
    for (const [k, v] of Object.entries(cat)) {
      if (k === clave || k.includes(clave) || clave.includes(k)) {
        return v;
      }
    }
    return null;
  }

  onNombreComponenteChange(comp: ComponentePlatoReceta): void {
    if (!comp.nombre_componente || comp.ingredientes.length > 0) return;
    const guardado = this.buscarComponenteEnCatalogo(comp.nombre_componente);
    if (guardado && (guardado.ingredientes.length > 0 || guardado.pasos.length > 0)) {
      comp.ingredientes = guardado.ingredientes.map(i => ({ ...i }));
      comp.pasos = guardado.pasos.map((p, idx) => ({
        numero_paso: idx + 1,
        descripcion_paso: p.descripcion_paso
      }));
      this.cdr.detectChanges();
    }
  }

  reutilizarComponenteGuardado(comp: ComponentePlatoReceta, nombreCatalogo: string): void {
    if (!nombreCatalogo) return;
    const guardado = this.buscarComponenteEnCatalogo(nombreCatalogo);
    if (!guardado) return;
    comp.nombre_componente = guardado.nombre_componente;
    comp.tipo_componente = guardado.tipo_componente || comp.tipo_componente;
    comp.ingredientes = guardado.ingredientes.map(i => ({ ...i }));
    comp.pasos = guardado.pasos.length > 0
      ? guardado.pasos.map((p, idx) => ({ numero_paso: idx + 1, descripcion_paso: p.descripcion_paso }))
      : [{ numero_paso: 1, descripcion_paso: '' }];
    this.cdr.detectChanges();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.menuAccionAbiertoId !== null) {
      this.menuAccionAbiertoId = null;
    }
  }

  toggleMenuAccion(id: any, event: Event): void {
    event.stopPropagation();
    this.menuAccionAbiertoId = this.menuAccionAbiertoId === id ? null : id;
  }

  cerrarMenuAccion(): void {
    this.menuAccionAbiertoId = null;
  }

  abrirModalVerReceta(plato: any): void {
    this.platoVerReceta = {
      ...plato,
      nombre_plato: this.limpiarNombrePlato(plato.nombre_plato),
      componentes_estructurados: plato.componentes_estructurados && plato.componentes_estructurados.length > 0
        ? plato.componentes_estructurados
        : this.crearComponentesDesdeMenuPAE(plato)
    };
    this.modalVerRecetaAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalVerReceta(): void {
    this.modalVerRecetaAbierto = false;
    this.platoVerReceta = null;
    this.cdr.detectChanges();
  }

  eliminarPlato(plato: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.cerrarMenuAccion();

    this.sweetAlert.confirm(
      '¿Eliminar plato?',
      `¿Estás seguro de que deseas eliminar "${plato.nombre_plato}"? Esta acción no se puede deshacer.`
    ).then((result: any) => {
      if (result.isConfirmed) {
        const idx = this.platosEstipuladosPAE.findIndex(p =>
          (plato.id_plato && p.id_plato === plato.id_plato) ||
          p.nombre_plato === plato.nombre_plato
        );
        if (idx >= 0) {
          this.platosEstipuladosPAE.splice(idx, 1);
          this.guardarEstadoCatalogoPlatos();
        }

        const claveCanon = this.obtenerClaveCanonicaPlato(plato.nombre_plato);
        try {
          const rawEl = localStorage.getItem('sirae_platos_eliminados_v1');
          const eliminados: string[] = rawEl ? JSON.parse(rawEl) : [];
          if (claveCanon && !eliminados.includes(claveCanon)) {
            eliminados.push(claveCanon);
            localStorage.setItem('sirae_platos_eliminados_v1', JSON.stringify(eliminados));
          }
        } catch {}

        if (plato.id_plato) {
          this.http.delete(`${this.apiUrl}/platos/${plato.id_plato}/`).pipe(
            catchError(() => of(null))
          ).subscribe();
        }

        this.sweetAlert.success('Plato eliminado', `El plato "${plato.nombre_plato}" ha sido eliminado del sistema.`);
        this.cdr.detectChanges();
      }
    });
  }

  cerrarModalRecetaPlato(): void {
    this.modalRecetaPlatoAbierto = false;
    this.platoRecetaSeleccionado = null;
    this.cdr.detectChanges();
  }

  agregarComponenteAlPlato(): void {
    if (!this.menuRecetaForm) {
      this.menuRecetaForm = { nombre_plato: '', componentes: [] };
    }
    if (!this.menuRecetaForm.componentes) {
      this.menuRecetaForm.componentes = [];
    }
    const nuevoComp = this.crearComponenteVacio('Alimento proteico', '');
    this.menuRecetaForm.componentes = [...this.menuRecetaForm.componentes, nuevoComp];
    this.cdr.detectChanges();
  }

  eliminarComponenteDelPlato(index: number): void {
    if (this.menuRecetaForm.componentes.length <= 1) {
      this.sweetAlert.warning('Mínimo un componente', 'El plato debe tener al menos un componente registrado.');
      return;
    }
    const comps = [...this.menuRecetaForm.componentes];
    comps.splice(index, 1);
    this.menuRecetaForm.componentes = comps;
    this.cdr.detectChanges();
  }

  agregarIngredienteAComponente(comp: ComponentePlatoReceta): void {
    const idIng = Number(comp.ingredienteTempId);
    if (!idIng) {
      this.sweetAlert.warning('Selecciona un ingrediente', 'Elige un ingrediente del inventario para agregarlo a este componente.');
      return;
    }
    if (comp.ingredientes.some(i => Number(i.id_ingrediente) === idIng)) {
      this.sweetAlert.warning('Ingrediente duplicado', 'Este ingrediente ya está incluido en este componente.');
      return;
    }

    const ingOp = this.opcionesIngredientes.find(o => Number(o.id) === idIng);
    comp.ingredientes = [
      ...comp.ingredientes,
      {
        id_ingrediente: idIng,
        nombre_ingrediente: ingOp?.label || `Ingrediente #${idIng}`,
        unidad: '',
        observacion: (comp.observacionTemp || '').trim()
      }
    ];

    comp.ingredienteTempId = null;
    comp.observacionTemp = '';
    this.cdr.detectChanges();
  }

  quitarIngredienteDeComponente(comp: ComponentePlatoReceta, index: number): void {
    const ings = [...comp.ingredientes];
    ings.splice(index, 1);
    comp.ingredientes = ings;
    this.cdr.detectChanges();
  }

  agregarPasoAComponente(comp: ComponentePlatoReceta): void {
    comp.pasos = [
      ...comp.pasos,
      {
        numero_paso: comp.pasos.length + 1,
        descripcion_paso: ''
      }
    ];
    this.cdr.detectChanges();
  }

  quitarPasoDeComponente(comp: ComponentePlatoReceta, index: number): void {
    if (comp.pasos.length <= 1) {
      comp.pasos = [{ numero_paso: 1, descripcion_paso: '' }];
      this.cdr.detectChanges();
      return;
    }
    const pasos = [...comp.pasos];
    pasos.splice(index, 1);
    pasos.forEach((p, idx) => (p.numero_paso = idx + 1));
    comp.pasos = pasos;
    this.cdr.detectChanges();
  }

  moverPasoComponente(comp: ComponentePlatoReceta, index: number, direccion: -1 | 1): void {
    const destino = index + direccion;
    if (destino < 0 || destino >= comp.pasos.length) return;
    const pasos = [...comp.pasos];
    const temp = pasos[index];
    pasos[index] = pasos[destino];
    pasos[destino] = temp;
    pasos.forEach((p, idx) => (p.numero_paso = idx + 1));
    comp.pasos = pasos;
    this.cdr.detectChanges();
  }

  private obtenerIdSeccionDeLista(secciones: string[]): number {
    if (!secciones || secciones.length === 0) return 1;
    if (secciones.includes('Almuerzo')) return 2;
    if (secciones.includes('Merienda')) return 3;
    return 1;
  }

  guardarRecetaPlato(): void {
    const nombre = this.limpiarNombrePlato(this.menuRecetaForm.nombre_plato || '').trim();
    if (!nombre) {
      this.sweetAlert.warning('Nombre requerido', 'Ingresa el nombre del plato.');
      return;
    }
    if (!this.menuRecetaForm.componentes || this.menuRecetaForm.componentes.length === 0) {
      this.sweetAlert.warning('Componentes requeridos', 'Registra al menos un componente para el plato.');
      return;
    }

    this.guardandoReceta = true;

    const compResumenObj: any = {
      bebida_leche: '—',
      proteico: '—',
      cereal: '—',
      fruta: '—',
      agua: 'Agua potable tratada'
    };

    const listaIngredientesTotal: string[] = [];
    const listaPasosTotal: string[] = [];

    for (const c of this.menuRecetaForm.componentes) {
      const tipo = c.tipo_componente;
      const nom = c.nombre_componente || '';
      if (tipo === 'Bebida con leche') compResumenObj.bebida_leche = nom;
      else if (tipo === 'Alimento proteico') compResumenObj.proteico = nom;
      else if (tipo === 'Cereal acompañante') compResumenObj.cereal = nom;
      else if (tipo === 'Fruta') compResumenObj.fruta = nom;
      else if (tipo.includes('Agua') || tipo.includes('Sopa')) compResumenObj.agua = nom;

      for (const ing of c.ingredientes || []) {
        if (ing.nombre_ingrediente && !listaIngredientesTotal.includes(ing.nombre_ingrediente)) {
          listaIngredientesTotal.push(ing.nombre_ingrediente);
        }
      }
      for (const p of c.pasos || []) {
        if (p.descripcion_paso && p.descripcion_paso.trim()) {
          listaPasosTotal.push(`[${nom}] ${p.descripcion_paso.trim()}`);
        }
      }
    }

    const numMenu = this.menuRecetaForm.numero_menu;
    const claveCanon = this.obtenerClaveCanonicaPlato(nombre);
    const claveSel = this.platoRecetaSeleccionado
      ? this.obtenerClaveCanonicaPlato(this.platoRecetaSeleccionado.nombre_plato)
      : '';

    const idx = this.platosEstipuladosPAE.findIndex(p => {
      const c = this.obtenerClaveCanonicaPlato(p.nombre_plato);
      return (claveSel && c === claveSel) ||
             (claveCanon && c === claveCanon) ||
             (p.id_plato && this.menuRecetaForm.id_plato && Number(p.id_plato) === Number(this.menuRecetaForm.id_plato));
    });

    const platoActualizado = {
      ...(idx >= 0 ? this.platosEstipuladosPAE[idx] : {}),
      id_plato: this.menuRecetaForm.id_plato || (idx >= 0 && this.platosEstipuladosPAE[idx].id_plato ? this.platosEstipuladosPAE[idx].id_plato : Date.now()),
      numeroMenu: numMenu || (idx >= 0 ? this.platosEstipuladosPAE[idx].numeroMenu : this.platosEstipuladosPAE.length + 1),
      nombre_plato: nombre,
      secciones: [...(this.menuRecetaForm.secciones || ['Desayuno', 'Almuerzo'])],
      componentes: compResumenObj,
      componentes_estructurados: JSON.parse(JSON.stringify(this.menuRecetaForm.componentes)),
      ingredientes: listaIngredientesTotal.length > 0 ? listaIngredientesTotal : ['Ingredientes estandarizados PAE'],
      pasos: listaPasosTotal.length > 0 ? listaPasosTotal : ['Preparar según las directrices de inocuidad del PAE.'],
      origen: 'PAE_ESTIPULADO'
    };

    if (idx >= 0) {
      this.platosEstipuladosPAE[idx] = platoActualizado;
    } else {
      this.platosEstipuladosPAE.unshift(platoActualizado);
    }

    this.platosEstipuladosPAE = [...this.platosEstipuladosPAE];
    this.guardarEstadoCatalogoPlatos();
    this.cdr.detectChanges();

    try {
      const catComp = this.obtenerCatalogoComponentesLocal();
      for (const comp of this.menuRecetaForm.componentes || []) {
        const claveComp = (comp.nombre_componente || '').trim().toLowerCase();
        if (claveComp && (comp.ingredientes.length > 0 || comp.pasos.some(p => p.descripcion_paso.trim()))) {
          catComp[claveComp] = {
            id_temporal: comp.id_temporal,
            tipo_componente: comp.tipo_componente,
            nombre_componente: comp.nombre_componente.trim(),
            ingredientes: comp.ingredientes.map(i => ({ ...i })),
            pasos: comp.pasos.filter(p => p.descripcion_paso.trim()).map((p, idx) => ({
              numero_paso: idx + 1,
              descripcion_paso: p.descripcion_paso.trim()
            }))
          };
        }
      }
      localStorage.setItem(this.STORAGE_COMP_CATALOGO_KEY, JSON.stringify(catComp));
    } catch (e) {
      console.warn('No se pudo guardar catálogo de componentes:', e);
    }

    const compTexto = [compResumenObj.bebida_leche, compResumenObj.proteico, compResumenObj.cereal, compResumenObj.fruta]
      .filter(c => c && c !== '—')
      .join(', ');

    const idSeccionPrincipal = this.obtenerIdSeccionDeLista(platoActualizado.secciones);
    const req = (this.modoEdicionReceta && platoActualizado.id_plato)
      ? this.http.put<any>(`${this.apiUrl}/platos/${platoActualizado.id_plato}/`, {
          nombre_plato: nombre.slice(0, 100),
          componente: (compTexto || 'Componentes PAE').slice(0, 50),
          id_seccion: idSeccionPrincipal
        })
      : this.http.post<any>(`${this.apiUrl}/platos/`, {
          nombre_plato: nombre.slice(0, 100),
          componente: (compTexto || 'Componentes PAE').slice(0, 50),
          id_seccion: idSeccionPrincipal
        });

    req.pipe(catchError(() => of(null))).subscribe((respPlato: any) => {
      this.guardandoReceta = false;
      const platoIdFinal = Number(respPlato?.id_plato || platoActualizado.id_plato);
      if (platoIdFinal) {
        this.sincronizarRecetaYPasosEnBackend(platoIdFinal, platoActualizado);
      }
    });

    this.sweetAlert.success(
      this.modoEdicionReceta ? 'Plato actualizado' : 'Plato creado',
      `La receta y momentos del plato "${nombre}" han sido guardados.`
    );
    this.cerrarModalRecetaPlato();
  }

  /** Guarda los ingredientes y pasos del plato en las tablas receta_componente y pasos_preparacion de PostgreSQL. */
  private sincronizarRecetaYPasosEnBackend(idPlato: number, plato: any): void {
    if (!idPlato || !plato) return;

    // 1. Sincronizar ingredientes en /api/receta_componente/
    const idsIngredientes = new Set<number>();
    for (const comp of plato.componentes_estructurados || []) {
      for (const ing of comp.ingredientes || []) {
        if (ing.id_ingrediente) {
          idsIngredientes.add(Number(ing.id_ingrediente));
        }
      }
    }

    if (idsIngredientes.size > 0) {
      this.http.get<any[]>(`${this.apiUrl}/receta_componente/`).pipe(catchError(() => of([]))).subscribe((resRc: any) => {
        const listaRc = Array.isArray(resRc) ? resRc : (resRc?.results || []);
        const yaRegistrados = new Set<number>(
          listaRc
            .filter((rc: any) => {
              const pId = typeof rc.id_plato === 'object' ? (rc.id_plato?.id_plato || rc.id_plato?.id) : rc.id_plato;
              return Number(pId) === Number(idPlato);
            })
            .map((rc: any) => {
              const ingId = typeof rc.id_ingrediente === 'object' ? (rc.id_ingrediente?.id_ingrediente || rc.id_ingrediente?.id) : rc.id_ingrediente;
              return Number(ingId);
            })
        );

        idsIngredientes.forEach(idIng => {
          if (!yaRegistrados.has(idIng)) {
            this.http.post<any>(`${this.apiUrl}/receta_componente/`, {
              id_plato: idPlato,
              id_ingrediente: idIng,
              id_gramaje: null
            }).pipe(catchError(() => of(null))).subscribe();
          }
        });
      });
    }

    // 2. Sincronizar pasos de preparación en /api/pasos_preparacion/
    this.http.get<any[]>(`${this.apiUrl}/pasos_preparacion/`).pipe(catchError(() => of([]))).subscribe((resPasos: any) => {
      const listaPasos = Array.isArray(resPasos) ? resPasos : (resPasos?.results || []);
      const viejos = listaPasos.filter((p: any) => {
        const pId = typeof p.id_plato === 'object' ? (p.id_plato?.id_plato || p.id_plato?.id) : p.id_plato;
        return Number(pId) === Number(idPlato);
      });

      const registrarNuevos = () => {
        let contador = 1;
        for (const comp of plato.componentes_estructurados || []) {
          for (const paso of comp.pasos || []) {
            const texto = (paso.descripcion_paso || '').trim();
            if (!texto) continue;
            this.http.post<any>(`${this.apiUrl}/pasos_preparacion/`, {
              id_plato: idPlato,
              numero_paso: contador++,
              descripcion_paso: `[${comp.nombre_componente}] ${texto}`
            }).pipe(catchError(() => of(null))).subscribe();
          }
        }
      };

      if (viejos.length > 0) {
        const borrarObs = viejos.map((v: any) => {
          const idP = v.id_paso_preparacion || v.id_paso || v.id;
          return this.http.delete<any>(`${this.apiUrl}/pasos_preparacion/${idP}/`).pipe(catchError(() => of(null)));
        });
        forkJoin(borrarObs).subscribe({
          next: () => registrarNuevos(),
          error: () => registrarNuevos()
        });
      } else {
        registrarNuevos();
      }
    });
  }

  // ============================================================
  // FLUJO DE APROBACIÓN DE MINUTA (JEFA DE COCINA Y SUPERVISOR)
  // ============================================================
  private obtenerAprobacionesLocales(): Record<string, any> {
    try {
      const raw = localStorage.getItem(this.STORAGE_APROBACIONES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  obtenerAprobacionSemana(semana: number): { aprobado_jefa: boolean; aprobado_supervisor: boolean; jefa_nombre?: string; supervisor_nombre?: string; fecha_jefa?: string; fecha_supervisor?: string } {
    const sedeId = this.sedeSeleccionadaId || 0;
    const mapa = this.obtenerAprobacionesLocales();
    const clave = `sede_${sedeId}_sem_${semana}`;
    return mapa[clave] || { aprobado_jefa: false, aprobado_supervisor: false };
  }

  aprobarSemanaComoSupervisor(semana: number): void {
    const sedeId = this.sedeSeleccionadaId;
    if (!sedeId) return;
    this.sweetAlert.confirm(
      `¿Aprobar Minuta de la Semana ${semana}?`,
      `Al dar tu visto bueno como Supervisor PAE, confirmas que todos los menús programados de esta semana cumplen con los lineamientos del programa.`
    ).then((conf) => {
      if (conf) {
        const mapa = this.obtenerAprobacionesLocales();
        const clave = `sede_${sedeId}_sem_${semana}`;
        const actual = mapa[clave] || { aprobado_jefa: true };
        const nombreSup = `${this.currentUser?.nombre || 'Supervisor'} ${this.currentUser?.apellido || ''}`.trim();
        const fechaSup = new Date().toLocaleDateString('es-CO');

        mapa[clave] = {
          ...actual,
          aprobado_supervisor: true,
          supervisor_nombre: nombreSup,
          fecha_supervisor: fechaSup
        };
        localStorage.setItem(this.STORAGE_APROBACIONES_KEY, JSON.stringify(mapa));

        // Actualizar todos los momentos de los días de la semana a APROBADO
        const semObj = this.semanasMinutaSedeActual.find(s => s.numeroSemana === semana);
        if (semObj) {
          for (const dia of semObj.dias) {
            for (const mom of ['Desayuno', 'Almuerzo', 'Merienda'] as const) {
              const item = dia.momentos[mom];
              if (item && item.tiene_menu_registrado && item.estado_aprobacion !== 'CANCELADO' && item.estado_aprobacion !== 'SIN_SERVICIO') {
                item.estado_aprobacion = 'APROBADO';
                item.usuario_evaluador = nombreSup;
                item.fecha_evaluacion = fechaSup;
                this.guardarMomentoEnMinutaLocalSede(Number(sedeId), dia.numeroMenu, mom, item);

                if (item.id_menu) {
                  this.http.put<any>(`${this.apiUrl}/menus/${item.id_menu}/`, { estado: 'Aprobado' })
                    .pipe(catchError(() => of(null))).subscribe();
                }
              }
            }
          }
        }

        // Notificar al móvil de la Jefa de la Sede
        const formData = new FormData();
        formData.append('titulo', `Minuta Semana ${semana} Aprobada por Supervisor`);
        formData.append(
          'mensaje',
          `El Supervisor PAE (${nombreSup}) ha aprobado la programación de la Semana ${semana} para la sede ${this.sedeActualObj?.nombre_sede || 'asignada'}. La minuta oficial ha quedado fijada.`
        );
        this.http.post(`${this.apiUrl}/notificaciones/enviar/`, formData)
          .pipe(catchError(() => of(null))).subscribe();

        this.sweetAlert.success('Minuta Aprobada', `La Semana ${semana} ha sido formalmente aprobada por el Supervisor PAE.`);
        this.cdr.detectChanges();
      }
    });
  }

  aprobarSemanaComoJefa(semana: number): void {
    const sedeId = this.sedeSeleccionadaId;
    if (!sedeId) return;
    const mapa = this.obtenerAprobacionesLocales();
    const clave = `sede_${sedeId}_sem_${semana}`;
    const actual = mapa[clave] || {};
    mapa[clave] = {
      ...actual,
      aprobado_jefa: true,
      jefa_nombre: `${this.currentUser?.nombre || 'Jefa de Manipuladoras'} ${this.currentUser?.apellido || ''}`.trim(),
      fecha_jefa: new Date().toLocaleDateString('es-CO')
    };
    localStorage.setItem(this.STORAGE_APROBACIONES_KEY, JSON.stringify(mapa));
    this.sweetAlert.success('Visto Bueno Registrado', `Has aprobado la minuta de la Semana ${semana} para tu sede. Ahora se encuentra lista para el visto bueno del Supervisor.`);
    this.cdr.detectChanges();
  }

  // Acciones individuales del Supervisor
  aprobarMomentoPlato(dia: CeldaDiaMinutaSede, momento: 'Desayuno' | 'Almuerzo' | 'Merienda'): void {
    const idSede = Number(this.sedeSeleccionadaId);
    if (!idSede) return;
    const item = dia.momentos[momento];
    if (!item || !item.tiene_menu_registrado) return;

    item.estado_aprobacion = 'APROBADO';
    item.motivo_rechazo_o_cancelacion = '';
    item.usuario_evaluador = `${this.currentUser?.nombre || 'Supervisor'} ${this.currentUser?.apellido || ''}`.trim();
    item.fecha_evaluacion = new Date().toLocaleDateString('es-CO');

    this.guardarMomentoEnMinutaLocalSede(idSede, dia.numeroMenu, momento, item);

    if (item.id_menu) {
      this.http.put<any>(`${this.apiUrl}/menus/${item.id_menu}/`, {
        estado: 'Aprobado'
      }).pipe(catchError(() => of(null))).subscribe();
    }

    this.sweetAlert.success(
      'Plato Aprobado',
      `El menú de ${momento} del ${dia.diaSemana} ha sido aprobado para la sede.`
    );
    this.cdr.detectChanges();
  }

  abrirModalRechazoSupervisor(dia: CeldaDiaMinutaSede, momento: 'Desayuno' | 'Almuerzo' | 'Merienda'): void {
    this.rechazoForm = {
      dia,
      momento,
      motivo: dia.momentos[momento]?.motivo_rechazo_o_cancelacion || ''
    };
    this.mostrarModalRechazoSupervisor = true;
    this.cdr.detectChanges();
  }

  confirmarRechazoSupervisor(): void {
    const idSede = Number(this.sedeSeleccionadaId);
    const { dia, momento, motivo } = this.rechazoForm;
    if (!dia || !momento || !idSede) return;

    if (!motivo || !motivo.trim()) {
      this.sweetAlert.warning(
        'Motivo obligatorio',
        'Debes ingresar el motivo por el cual rechazas este plato para que la jefa de cocina sepa qué debe corregir.'
      );
      return;
    }

    const item = dia.momentos[momento as 'Desayuno' | 'Almuerzo' | 'Merienda'];
    if (item) {
      item.estado_aprobacion = 'RECHAZADO';
      item.motivo_rechazo_o_cancelacion = motivo.trim();
      item.usuario_evaluador = `${this.currentUser?.nombre || 'Supervisor'} ${this.currentUser?.apellido || ''}`.trim();
      item.fecha_evaluacion = new Date().toLocaleDateString('es-CO');

      this.guardarMomentoEnMinutaLocalSede(idSede, dia.numeroMenu, momento, item);

      if (item.id_menu) {
        this.http.put<any>(`${this.apiUrl}/menus/${item.id_menu}/`, {
          estado: 'Rechazado'
        }).pipe(catchError(() => of(null))).subscribe();
      }

      // Enviar notificación a la Jefa de la Sede con el motivo del rechazo
      const formData = new FormData();
      formData.append('titulo', `Plato devuelto por Supervisor - ${momento}`);
      formData.append(
        'mensaje',
        `El plato "${item.nombre_plato}" del ${dia.diaSemana} (${momento}) fue devuelto por el supervisor para la sede ${this.sedeActualObj?.nombre_sede || 'asignada'}. Motivo: ${motivo.trim()}. Debes ingresar a la app y cambiar este plato.`
      );
      this.http.post(`${this.apiUrl}/notificaciones/enviar/`, formData)
        .pipe(catchError(() => of(null))).subscribe();
    }

    this.mostrarModalRechazoSupervisor = false;
    this.sweetAlert.success(
      'Plato Rechazado',
      `Se registró la observación para ${momento} del ${dia.diaSemana}. La jefa de cocina verá la alerta para cambiarlo.`
    );
    this.cdr.detectChanges();
  }

  abrirModalNovedadMomento(dia: CeldaDiaMinutaSede, momento: 'Desayuno' | 'Almuerzo' | 'Merienda', tipo: 'CANCELADO' | 'SIN_SERVICIO'): void {
    this.novedadForm = {
      dia,
      momento,
      tipo,
      motivo: dia.momentos[momento]?.motivo_rechazo_o_cancelacion || ''
    };
    this.mostrarModalNovedadMomento = true;
    this.cdr.detectChanges();
  }

  confirmarNovedadMomento(): void {
    const idSede = Number(this.sedeSeleccionadaId);
    const { dia, momento, tipo, motivo } = this.novedadForm;
    if (!dia || !momento || !idSede) return;

    if (!motivo || !motivo.trim()) {
      this.sweetAlert.warning(
        'Motivo obligatorio',
        tipo === 'CANCELADO'
          ? 'Ingresa la justificación de la cancelación (ej. "Aviso de rectoría: primaria no tuvo clase").'
          : 'Ingresa por qué no habrá servicio (ej. "Jornada pedagógica institucional" o "Paro docente").'
      );
      return;
    }

    const item = dia.momentos[momento as 'Desayuno' | 'Almuerzo' | 'Merienda'];
    if (item) {
      item.estado_aprobacion = tipo;
      item.motivo_rechazo_o_cancelacion = motivo.trim();
      item.tiene_menu_registrado = true;

      this.guardarMomentoEnMinutaLocalSede(idSede, dia.numeroMenu, momento, item);
    }

    this.mostrarModalNovedadMomento = false;
    this.sweetAlert.success(
      'Novedad Registrada',
      tipo === 'CANCELADO'
        ? `Se registró como Cancelado el ${momento} del ${dia.diaSemana}. Se mostrará al supervisor en la minuta.`
        : `Se registró como Sin Servicio el ${momento} del ${dia.diaSemana}.`
    );
    this.cdr.detectChanges();
  }

  reactivarMomento(dia: CeldaDiaMinutaSede, momento: 'Desayuno' | 'Almuerzo' | 'Merienda'): void {
    const idSede = Number(this.sedeSeleccionadaId);
    if (!idSede) return;
    const item = dia.momentos[momento];
    if (item) {
      item.estado_aprobacion = 'PENDIENTE';
      item.motivo_rechazo_o_cancelacion = '';
      this.guardarMomentoEnMinutaLocalSede(idSede, dia.numeroMenu, momento, item);
      this.cdr.detectChanges();
    }
  }

  abrirModalProgramarMenuDiaMomento(dia: CeldaDiaMinutaSede, momento: 'Desayuno' | 'Almuerzo' | 'Merienda'): void {
    const idSede = Number(this.sedeSeleccionadaId || this.currentUser?.id_sede || (this.sedesInstitucion[0]?.id_sede));
    const seccionId = (momento === 'Desayuno' ? 1 : momento === 'Merienda' ? 3 : 2);
    const mObj = dia.momentos[momento];

    this.programarDiaForm = {
      id_sede: idSede,
      numero_menu_ciclo: dia.numeroMenu,
      fecha: dia.fecha && /^\d{4}-\d{2}-\d{2}$/.test(dia.fecha) ? dia.fecha : this.obtenerFechaManana(),
      id_seccion: seccionId,
      id_jornada: this.jornadas[0]?.id_jornada || 1,
      ninos_presentes: mObj?.ninos_presentes || 120,
      origen_eleccion: mObj?.origen === 'SUGERENCIA_IA' ? 'SUGERENCIA_IA' : 'PAE_ESTIPULADO',
      opcionSeleccionadaIndex: 0,
      id_plato: mObj?.id_plato || null,
      nombre_plato: mObj?.nombre_plato || '',
      bebida_leche: mObj?.componentes?.bebida_leche || '',
      proteico: mObj?.componentes?.proteico || '',
      cereal: mObj?.componentes?.cereal || '',
      fruta: mObj?.componentes?.fruta || '',
      agua: mObj?.componentes?.agua || 'Agua potable tratada',
      ingredientes: [...(mObj?.ingredientes || [])],
      pasos: [...(mObj?.pasos || [])]
    };

    this.mostrarModalProgramarDia = true;
    this.consultarSugerenciasIAParaSede();
  }

  verFichaRecetaMomento(dia: CeldaDiaMinutaSede, momento: 'Desayuno' | 'Almuerzo' | 'Merienda'): void {
    const item = dia.momentos[momento];
    if (!item) return;
    this.celdaRecetaSeleccionada = {
      tiene_menu_registrado: item.tiene_menu_registrado,
      numeroMenu: dia.numeroMenu,
      semana: dia.semana,
      diaSemana: dia.diaSemana,
      fecha: dia.fecha,
      jornada: `Momento ${momento}`,
      seccion: momento,
      nombre_plato: item.nombre_plato,
      origen: item.origen,
      ninos_presentes: item.ninos_presentes,
      estado: item.estado_aprobacion,
      componentes: item.componentes,
      ingredientes: item.ingredientes,
      pasos: item.pasos,
      momentos: dia.momentos
    };
    this.mostrarModalFichaReceta = true;
    this.cdr.detectChanges();
  }

  /**
   * Filtra los menús diarios registrados en el backend que pertenecen a la Sede seleccionada.
   * Cada sede tiene su propia Jefa de Manipuladoras y por tanto su propia programación de 20 días.
   */
  get menusDeSedeSeleccionada(): any[] {
    if (!this.sedeSeleccionadaId) return this.menusDiarios;
    const idSede = Number(this.sedeSeleccionadaId);

    // Contratos asociados a esta sede
    const contratosDeSede = this.contratos
      .filter(c => {
        const cSede = typeof c.id_sede === 'object' ? (c.id_sede?.id_sede || c.id_sede?.id) : c.id_sede;
        return Number(cSede) === idSede;
      })
      .map(c => Number(c.id_contrato));

    return this.menusDiarios.filter(m => {
      if (m.id_sede && Number(m.id_sede) === idSede) {
        return true;
      }
      const rawInfo = String(m.informacion_nutricional || '');
      const matchSede = rawInfo.match(/\[SEDE:(\d+)\]/);
      if (matchSede) {
        return Number(matchSede[1]) === idSede;
      }
      if (contratosDeSede.length > 0 && contratosDeSede.includes(Number(m.id_contrato))) {
        return true;
      }
      return false;
    });
  }

  /**
   * Construye las 4 semanas (Menú 1 a Menú 20) específicas para la Sede seleccionada.
   * Muestra Desayuno, Almuerzo y Merienda para cada día con datos 100% dinámicos.
   */
  get semanasMinutaSedeActual(): SemanaMinutaSede[] {
    const menusSede = [...this.menusDeSedeSeleccionada].sort((a, b) =>
      String(a.fecha || '').localeCompare(String(b.fecha || ''))
    );

    const idSede = Number(this.sedeSeleccionadaId || 0);
    const minutasLocalesSede = this.leerMinutasLocalesPorSede()[String(idSede)] || {};
    const diasSemanaNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const celdas20: CeldaDiaMinutaSede[] = [];

    for (let i = 0; i < 20; i++) {
      const numMenu = i + 1;
      const numSemana = Math.floor(i / 5) + 1;
      const diaNombre = diasSemanaNombres[i % 5];
      let fechaDia = `Día ${numMenu}`;

      const momentosDia: Record<'Desayuno' | 'Almuerzo' | 'Merienda', MomentoDiaMinuta> = {
        Desayuno: this.crearMomentoVacio('Desayuno'),
        Almuerzo: this.crearMomentoVacio('Almuerzo'),
        Merienda: this.crearMomentoVacio('Merienda')
      };

      const momentosNombres: ('Desayuno' | 'Almuerzo' | 'Merienda')[] = ['Desayuno', 'Almuerzo', 'Merienda'];

      for (const m of momentosNombres) {
        const idSec = m === 'Desayuno' ? 1 : (m === 'Merienda' ? 3 : 2);
        const slotKey = `${numMenu}_${m.toLowerCase()}`;

        // 1. Ver si existe en local
        const localSlot = minutasLocalesSede[slotKey] || (minutasLocalesSede[numMenu]?.seccion === m ? minutasLocalesSede[numMenu] : null);

        // 2. Ver si existe en backend
        const menuBackend = menusSede.find(mb => {
          const matchSec = Number(mb.id_seccion) === idSec;
          const info = String(mb.informacion_nutricional || '');
          const matchDia = info.match(/\[MENU_CICLO:(\d+)\]/);
          return matchSec && (matchDia ? Number(matchDia[1]) === numMenu : false);
        });

        if (menuBackend && !fechaDia.includes('-') && menuBackend.fecha) {
          fechaDia = menuBackend.fecha;
        }
        if (localSlot && !fechaDia.includes('-') && localSlot.fecha) {
          fechaDia = localSlot.fecha;
        }

        if (localSlot && (localSlot.nombre_plato || localSlot.estado_aprobacion === 'CANCELADO' || localSlot.estado_aprobacion === 'SIN_SERVICIO')) {
          momentosDia[m] = {
            momento: m,
            tiene_menu_registrado: localSlot.tiene_menu_registrado !== undefined ? localSlot.tiene_menu_registrado : Boolean(localSlot.nombre_plato),
            id_menu: localSlot.id_menu || menuBackend?.id_menu,
            id_plato: localSlot.id_plato,
            nombre_plato: localSlot.nombre_plato || '',
            origen: localSlot.origen || 'PAE_ESTIPULADO',
            ninos_presentes: Number(localSlot.ninos_presentes || 120),
            estado_aprobacion: localSlot.estado_aprobacion || 'PENDIENTE',
            motivo_rechazo_o_cancelacion: localSlot.motivo_rechazo_o_cancelacion || '',
            usuario_jefa: localSlot.usuario_jefa || 'Jefa de Cocina',
            usuario_evaluador: localSlot.usuario_evaluador,
            fecha_evaluacion: localSlot.fecha_evaluacion,
            componentes: localSlot.componentes || {
              bebida_leche: '—',
              proteico: '—',
              cereal: '—',
              fruta: '—',
              agua: '—'
            },
            ingredientes: localSlot.ingredientes || [],
            pasos: localSlot.pasos || []
          };
        } else if (menuBackend) {
          const platoDet = (menuBackend.platos_detalle && menuBackend.platos_detalle[0]) || null;
          const platoCatalogo = platoDet?.id_plato
            ? this.platos.find(p => Number(p.id_plato) === Number(platoDet.id_plato))
            : (menuBackend.id_plato ? this.platos.find(p => Number(p.id_plato) === Number(menuBackend.id_plato)) : null);

          const nombrePlato = platoDet?.nombre_plato || platoCatalogo?.nombre_plato || menuBackend.nombre_plato || `Menú ${numMenu}`;
          const compTexto = platoDet?.componente || platoCatalogo?.componente || menuBackend.componente_plato || '';
          const infoLimpia = String(menuBackend.informacion_nutricional_limpia || menuBackend.informacion_nutricional || '');
          const esIA = infoLimpia.toUpperCase().includes('IA');

          const comps = this.extraerComponentesDesdePlato(nombrePlato, compTexto, platoCatalogo);
          const ingList = (platoCatalogo?.receta_componentes || []).map((rc: any) => rc.nombre_ingrediente || rc.nombre_componente).filter(Boolean);
          const pasosList = (platoCatalogo?.pasos_preparacion || []).map((ps: any) => ps.descripcion_paso).filter(Boolean);

          let estadoBackend: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO' | 'SIN_SERVICIO' = 'PENDIENTE';
          if (menuBackend.estado?.toLowerCase().includes('aprob')) estadoBackend = 'APROBADO';
          else if (menuBackend.estado?.toLowerCase().includes('rechaz')) estadoBackend = 'RECHAZADO';
          else if (menuBackend.estado?.toLowerCase().includes('cancel')) estadoBackend = 'CANCELADO';

          momentosDia[m] = {
            momento: m,
            tiene_menu_registrado: true,
            id_menu: menuBackend.id_menu,
            id_plato: platoDet?.id_plato || platoCatalogo?.id_plato,
            nombre_plato: nombrePlato,
            origen: esIA ? 'SUGERENCIA_IA' : 'PAE_ESTIPULADO',
            ninos_presentes: Number(menuBackend.ninos_presentes || 120),
            estado_aprobacion: estadoBackend,
            motivo_rechazo_o_cancelacion: '',
            componentes: comps,
            ingredientes: ingList,
            pasos: pasosList
          };
        }
      }

      const celda: CeldaDiaMinutaSede = {
        numeroMenu: numMenu,
        semana: numSemana,
        diaSemana: diaNombre,
        fecha: fechaDia,
        momentos: momentosDia,
        tiene_menu_registrado: Object.values(momentosDia).some(m => m.tiene_menu_registrado),
        nombre_plato: momentosDia.Almuerzo?.nombre_plato || momentosDia.Desayuno?.nombre_plato || '',
        seccion: 'Almuerzo',
        origen: 'PAE_ESTIPULADO',
        ninos_presentes: 120,
        estado: 'Elegido por Jefa',
        componentes: momentosDia.Almuerzo?.componentes || momentosDia.Desayuno?.componentes,
        ingredientes: [],
        pasos: []
      };

      celdas20.push(celda);
    }

    const semanas: SemanaMinutaSede[] = [1, 2, 3, 4].map(numSem => {
      const inicio = (numSem - 1) * 5 + 1;
      const fin = numSem * 5;
      const diasDeSemana = celdas20.filter(c => c.semana === numSem);

      return {
        numeroSemana: numSem,
        titulo: `Semana ${numSem} (Menú ${inicio} al Menú ${fin})`,
        dias: diasDeSemana
      };
    });

    return semanas;
  }

  get semanaActualMinuta(): SemanaMinutaSede | undefined {
    return this.semanasMinutaSedeActual.find(s => s.numeroSemana === Number(this.semanaSeleccionada)) || this.semanasMinutaSedeActual[0];
  }

  contarDiasElegidosPorJefa(idSede: number | null): number {
    if (!idSede) return 0;
    const locales = Object.keys(this.leerMinutasLocalesPorSede()[String(idSede)] || {}).length;
    const enBackend = this.menusDiarios.filter(m => Number(m.id_sede) === Number(idSede)).length;
    return Math.min(20, Math.max(locales, enBackend));
  }

  // ============================================================
  // PROGRAMACIÓN DEL MENÚ DEL DÍA (ESTIPULADO PAE O SUGERENCIA IA)
  // ============================================================

  abrirModalProgramarMenuDia(celda?: CeldaDiaMinutaSede): void {
    const idSede = Number(this.sedeSeleccionadaId || this.currentUser?.id_sede || (this.sedesInstitucion[0]?.id_sede));
    const numMenu = celda ? celda.numeroMenu : 1;
    const seccionId = celda
      ? (celda.seccion === 'Desayuno' ? 1 : celda.seccion === 'Merienda' ? 3 : 2)
      : 1;

    this.programarDiaForm = {
      id_sede: idSede,
      numero_menu_ciclo: numMenu,
      fecha: celda && /^\d{4}-\d{2}-\d{2}$/.test(celda.fecha) ? celda.fecha : this.obtenerFechaManana(),
      id_seccion: seccionId,
      id_jornada: this.jornadas[0]?.id_jornada || 1,
      ninos_presentes: celda?.ninos_presentes || 120,
      origen_eleccion: celda?.origen === 'SUGERENCIA_IA' ? 'SUGERENCIA_IA' : 'PAE_ESTIPULADO',
      opcionSeleccionadaIndex: 0,
      id_plato: celda?.id_plato || null,
      nombre_plato: celda?.nombre_plato || '',
      bebida_leche: celda?.componentes?.bebida_leche || '',
      proteico: celda?.componentes?.proteico || '',
      cereal: celda?.componentes?.cereal || '',
      fruta: celda?.componentes?.fruta || '',
      agua: celda?.componentes?.agua || 'Agua',
      ingredientes: [...(celda?.ingredientes || [])],
      pasos: [...(celda?.pasos || [])]
    };

    this.mostrarModalProgramarDia = true;
    this.consultarSugerenciasIAParaSede();
  }

  cerrarModalProgramarMenuDia(): void {
    this.mostrarModalProgramarDia = false;
  }

  /**
   * Llama a `/api/ia/sugerencias-recetas/` que devuelve por defecto los platos
   * estipulados del PAE (creados por el Super Admin + ciclo oficial) junto con
   * las nuevas sugerencias generadas por la IA según el inventario de la sede.
   */
  consultarSugerenciasIAParaSede(): void {
    const idSede = Number(this.programarDiaForm.id_sede || this.sedeSeleccionadaId || 1);
    const ninos = Number(this.programarDiaForm.ninos_presentes || 100);
    const idSeccion = Number(this.programarDiaForm.id_seccion || 1);

    this.cargandoSugerenciasIA = true;

    this.http.post<any>(`${this.apiUrl}/ia/sugerencias-recetas/`, {
      id_sede: idSede,
      ninos_presentes: ninos > 0 ? ninos : 100,
      id_seccion: idSeccion,
      preferencia: this.preferenciaIA || ''
    }).pipe(
      catchError(() => of(null))
    ).subscribe((resp) => {
      this.cargandoSugerenciasIA = false;

      if (resp && (Array.isArray(resp.todas_las_opciones) || Array.isArray(resp.platos_estipulados_pae))) {
        this.platosEstipuladosPAE = resp.platos_estipulados_pae || [];
        this.platosGeneradosIA = resp.sugerencias_ia_estructuradas || [];
        this.opcionesSugeridasIA = resp.todas_las_opciones || [
          ...this.platosEstipuladosPAE,
          ...this.platosGeneradosIA
        ];
        this.textoSugerenciaIA = resp.sugerencias || '';
      } else {
        // Fallback construyendo desde el catálogo global de platos del Super Admin + ciclo oficial PAE
        const platosCatalogo = this.platos.map(p => ({
          id_plato: p.id_plato,
          nombre_plato: p.nombre_plato,
          id_seccion: p.id_seccion || 2,
          componente: p.componente || 'Alimento proteico, Cereal acompañante',
          imagen_url: p.imagen_url,
          ingredientes: (p.receta_componentes || []).map((rc: any) => rc.nombre_ingrediente),
          pasos: (p.pasos_preparacion || []).map((ps: any) => ps.descripcion_paso),
          origen: 'PAE_ESTIPULADO',
          etiqueta: 'Catálogo Global Super Admin (PAE)'
        }));

        const base20 = this.getCatalogo20MenusBasePAE().map(b => ({
          id_plato: null,
          nombre_plato: b.nombre_plato,
          id_seccion: b.seccion === 'Desayuno' ? 1 : b.seccion === 'Merienda' ? 3 : 2,
          componente: `${b.componentes.bebida_leche}, ${b.componentes.proteico}, ${b.componentes.cereal}, ${b.componentes.fruta}`,
          componentes_detalle: b.componentes,
          ingredientes: b.ingredientes,
          pasos: b.pasos,
          origen: 'PAE_ESTIPULADO',
          etiqueta: `Menú Estipulado PAE #${b.numeroMenu} (Por defecto en IA)`
        }));

        const iaExtras = [
          {
            id_plato: null,
            nombre_plato: 'Sugerencia IA: Arroz nutritivo con pollo guisado, bebida láctea y fruta de temporada',
            id_seccion: idSeccion,
            componente: 'Bebida con leche, Alimento proteico, Cereal acompañante, Fruta, Agua',
            componentes_detalle: {
              'Bebida con leche': 'Avena tibia en leche',
              'Alimento proteico': 'Pollo guisado con vegetales',
              'Cereal acompañante': 'Arroz con zanahoria',
              'Fruta': 'Mango / Banano',
              'Agua': 'Agua'
            },
            ingredientes: ['Pollo', 'Arroz', 'Leche', 'Avena', 'Zanahoria', 'Fruta fresca'],
            pasos: [
              'Verificar existencias en inventario de la sede y desinfectar ingredientes.',
              'Cocinar el pollo en guiso natural y preparar el arroz con zanahoria.',
              'Servir con avena en leche, fruta fresca y agua tratada.'
            ],
            origen: 'IA_INVENTARIO',
            etiqueta: 'Generado por IA según Inventario de la Sede'
          },
          {
            id_plato: null,
            nombre_plato: 'Sugerencia IA: Cazuela escolar de lentejas con huevo cocido, arepa y fruta',
            id_seccion: idSeccion,
            componente: 'Bebida con leche, Alimento proteico, Cereal acompañante, Fruta, Agua',
            componentes_detalle: {
              'Bebida con leche': 'Colada de maizena en leche',
              'Alimento proteico': 'Lentejas con huevo cocido',
              'Cereal acompañante': 'Arepa redonda de maíz',
              'Fruta': 'Mandarina',
              'Agua': 'Agua'
            },
            ingredientes: ['Lentejas', 'Huevos', 'Harina de maíz', 'Leche', 'Maizena', 'Mandarina'],
            pasos: [
              'Remojar y cocinar las lentejas con guiso suave.',
              'Cocinar los huevos duros y asar las arepas de maíz.',
              'Acompañar con colada en leche, mandarina y agua potable.'
            ],
            origen: 'IA_INVENTARIO',
            etiqueta: 'Generado por IA según Inventario de la Sede'
          }
        ];

        this.platosEstipuladosPAE = [...platosCatalogo, ...base20];
        this.platosGeneradosIA = iaExtras;
        this.opcionesSugeridasIA = [...iaExtras, ...this.platosEstipuladosPAE];
      }

      if (this.opcionesFiltradasModalProgramar.length > 0 && !this.programarDiaForm.nombre_plato) {
        this.seleccionarOpcionParaDia(this.opcionesFiltradasModalProgramar[0], 0);
      }
      this.cargarCatalogoBasePlatos();
      this.cdr.detectChanges();
    });
  }

  get opcionesFiltradasModalProgramar(): any[] {
    if (this.modoFuenteEleccion === 'PAE_ESTIPULADO') {
      return this.opcionesSugeridasIA.filter(o => o.origen === 'PAE_ESTIPULADO');
    }
    if (this.modoFuenteEleccion === 'IA_INVENTARIO') {
      return this.opcionesSugeridasIA.filter(o => o.origen === 'IA_INVENTARIO');
    }
    return this.opcionesSugeridasIA;
  }

  onPlatoSeleccionadoEnSelect(): void {
    const plato = this.platosEstipuladosPAE.find(p => p.nombre_plato === this.programarDiaForm.nombre_plato);
    if (plato) {
      this.seleccionarOpcionParaDia(plato, 0);
    }
  }

  seleccionarOpcionParaDia(opcion: any, idx: number): void {
    this.programarDiaForm.opcionSeleccionadaIndex = idx;
    this.programarDiaForm.id_plato = opcion.id_plato || null;
    this.programarDiaForm.nombre_plato = opcion.nombre_plato;
    this.programarDiaForm.origen_eleccion = opcion.origen === 'IA_INVENTARIO' ? 'SUGERENCIA_IA' : 'PAE_ESTIPULADO';

    const det = opcion.componentes_detalle;
    if (det) {
      this.programarDiaForm.bebida_leche = det['Bebida con leche'] || det.bebida_leche || 'Bebida láctea';
      this.programarDiaForm.proteico = det['Alimento proteico'] || det.proteico || 'Proteína';
      this.programarDiaForm.cereal = det['Cereal acompañante'] || det.cereal || 'Cereal';
      this.programarDiaForm.fruta = det['Fruta'] || det.fruta || 'Fruta fresca';
      this.programarDiaForm.agua = det['Agua'] || det.agua || 'Agua';
    } else {
      const extraidos = this.extraerComponentesDesdePlato(opcion.nombre_plato, opcion.componente);
      this.programarDiaForm.bebida_leche = extraidos.bebida_leche;
      this.programarDiaForm.proteico = extraidos.proteico;
      this.programarDiaForm.cereal = extraidos.cereal;
      this.programarDiaForm.fruta = extraidos.fruta;
      this.programarDiaForm.agua = extraidos.agua;
    }

    this.programarDiaForm.ingredientes = Array.isArray(opcion.ingredientes) ? [...opcion.ingredientes] : [];
    this.programarDiaForm.pasos = Array.isArray(opcion.pasos) ? [...opcion.pasos] : [];
  }

  guardarProgramacionDiaSede(): void {
    const idSede = Number(this.programarDiaForm.id_sede || this.sedeSeleccionadaId);
    if (!idSede) {
      this.sweetAlert.warning('Sede requerida', 'Selecciona la sede para la cual vas a programar el menú del día.');
      return;
    }
    if (!this.programarDiaForm.nombre_plato.trim()) {
      this.sweetAlert.warning('Plato requerido', 'Elige un plato estipulado del PAE o una sugerencia de la IA.');
      return;
    }

    const numMenu = Number(this.programarDiaForm.numero_menu_ciclo || 1);
    const seccionNombre = this.getNombreSeccion(this.programarDiaForm.id_seccion);
    const momentoCanon: 'Desayuno' | 'Almuerzo' | 'Merienda' =
      (seccionNombre === 'Desayuno' || seccionNombre === 'Merienda') ? seccionNombre : 'Almuerzo';
    const jornadaNombre = this.jornadas.length > 0
      ? this.getNombreJornada(Number(this.programarDiaForm.id_jornada || this.jornadas[0].id_jornada))
      : 'Jornada Mañana';

    // 1. Guardar inmediatamente en la minuta de la sede por momento (Desayuno, Almuerzo o Merienda)
    this.guardarMomentoEnMinutaLocalSede(idSede, numMenu, momentoCanon, {
      momento: momentoCanon,
      numeroMenu: numMenu,
      tiene_menu_registrado: true,
      nombre_plato: this.programarDiaForm.nombre_plato.trim(),
      id_plato: this.programarDiaForm.id_plato || undefined,
      origen: this.programarDiaForm.origen_eleccion as any,
      ninos_presentes: Number(this.programarDiaForm.ninos_presentes || 120),
      estado_aprobacion: 'PENDIENTE',
      motivo_rechazo_o_cancelacion: '',
      usuario_jefa: `${this.currentUser?.nombre || 'Jefa de Cocina'} ${this.currentUser?.apellido || ''}`.trim(),
      componentes: {
        bebida_leche: this.programarDiaForm.bebida_leche || 'Bebida con leche',
        proteico: this.programarDiaForm.proteico || 'Alimento proteico',
        cereal: this.programarDiaForm.cereal || 'Cereal acompañante',
        fruta: this.programarDiaForm.fruta || 'Fruta',
        agua: this.programarDiaForm.agua || 'Agua potable tratada'
      },
      ingredientes: this.programarDiaForm.ingredientes,
      pasos: this.programarDiaForm.pasos
    });

    // 2. Persistir también en el backend (`/api/menus/`) asociado a la sede
    const contratoSede = this.contratos.find(c => {
      const cSede = typeof c.id_sede === 'object' ? (c.id_sede?.id_sede || c.id_sede?.id) : c.id_sede;
      return Number(cSede) === idSede;
    }) || this.contratos[0];

    if (contratoSede && this.jornadas.length > 0) {
      this.guardandoMenuDia = true;
      const etiquetaOrigen = this.programarDiaForm.origen_eleccion === 'SUGERENCIA_IA' ? 'Sugerencia IA' : 'Estipulado PAE';
      const infoNutricional = `[SEDE:${idSede}] [MENU_CICLO:${numMenu}] [${etiquetaOrigen}] ${this.programarDiaForm.nombre_plato} | Bebida: ${this.programarDiaForm.bebida_leche} | Proteico: ${this.programarDiaForm.proteico} | Cereal: ${this.programarDiaForm.cereal} | Fruta: ${this.programarDiaForm.fruta}`;

      this.http.post<any>(`${this.apiUrl}/menus/`, {
        id_jornada: Number(this.programarDiaForm.id_jornada || this.jornadas[0].id_jornada),
        fecha: this.programarDiaForm.fecha,
        ninos_presentes: Number(this.programarDiaForm.ninos_presentes || 120),
        id_contrato: Number(contratoSede.id_contrato),
        id_seccion: Number(this.programarDiaForm.id_seccion || 1),
        id_sede: idSede,
        id_plato: this.programarDiaForm.id_plato || null,
        estado: 'Programado',
        informacion_nutricional: infoNutricional
      }).pipe(catchError(() => of(null))).subscribe(() => {
        this.guardandoMenuDia = false;
        this.mostrarModalProgramarDia = false;
        this.cargarMenus();
        this.sweetAlert.success(
          'Menú del Día Programado',
          `El Menú #${numMenu} (${seccionNombre}) quedó registrado para la sede y ya es visible en la Minuta de 20 Días del Administrador.`
        );
      });
    } else {
      this.mostrarModalProgramarDia = false;
      this.sweetAlert.success(
        'Menú del Día Programado',
        `El Menú #${numMenu} (${seccionNombre}) quedó actualizado en la Minuta de 20 Días de la sede seleccionada.`
      );
      this.cdr.detectChanges();
    }
  }

  verFichaRecetaDia(celda: CeldaDiaMinutaSede): void {
    this.celdaRecetaSeleccionada = celda;
    this.mostrarModalFichaReceta = true;
  }

  cerrarModalFichaReceta(): void {
    this.mostrarModalFichaReceta = false;
    this.celdaRecetaSeleccionada = null;
  }

  // ============================================================
  // MÉTODOS AUXILIARES Y CRUD DE TABLAS SECUNDARIAS
  // ============================================================

  get contratosOpciones(): any[] {
    return this.contratos.map(c => ({
      ...c,
      label: `Contrato #${c.id_contrato} - ${c.institucion || c.operador || 'PAE'}`
    }));
  }

  get menusOpciones(): any[] {
    return this.menusDiarios.map(m => ({
      ...m,
      label: `Menú #${m.id_menu} (${m.fecha})`
    }));
  }

  get detalleMenusOpciones(): any[] {
    return this.menusDiarios.map(m => ({
      ...m,
      label: `#${m.id_menu} (${m.fecha})`
    }));
  }

  getNombreJornada(id: number): string {
    const j = this.jornadas.find(x => x.id_jornada == id);
    return j ? j.nombre_jornada : `Jornada #${id}`;
  }

  getNombreSeccion(id: any): string {
    if (!id) return 'Desconocida';
    const s = this.seccionesMenu.find(x => x.id_seccion == id);
    if (s) return s.nombre_seccion;
    if (Number(id) === 1) return 'Desayuno';
    if (Number(id) === 2) return 'Almuerzo';
    if (Number(id) === 3) return 'Merienda';
    return 'Desconocida';
  }

  getNombrePlato(id: number): string {
    const p = this.platos.find(x => x.id_plato == id);
    return p ? p.nombre_plato : `Plato #${id}`;
  }

  getNombreManipuladora(id: number): string {
    const u = this.usuariosManipuladoras.find(x => x.id_usuario_manipuladora == id);
    return u ? u.nombre : `Usuario #${id}`;
  }

  cargarMenus(): void {
    this.http.get<any[]>(`${this.apiUrl}/menus/`).subscribe({
      next: (data) => {
        this.menusDiarios = Array.isArray(data) ? data : (data as any).results || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar menús:', err)
    });
  }

  cargarPlatos(): void {
    this.http.get<any[]>(`${this.apiUrl}/platos/`).subscribe({
      next: (data) => {
        this.platos = Array.isArray(data) ? data : (data as any).results || [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar platos:', err)
    });
  }

  cargarPreparaciones(): void {
    this.http.get<any[]>(`${this.apiUrl}/preparaciones-asignadas/`).subscribe({
      next: (data) => {
        const raw = Array.isArray(data) ? data : (data as any).results || [];
        this.preparacionesAsignadas = raw.map((p: any) => ({
          ...p,
          nombre_menu: `Menú #${p.id_menu}`,
          nombre_plato: this.getNombrePlato(p.id_plato),
          manipuladora: this.getNombreManipuladora(p.id_usuario_manipuladora)
        }));
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar preparaciones:', err)
    });
  }

  cambiarPestana(pestana: 'minuta' | 'menus' | 'platos' | 'preparaciones'): void {
    this.pestanaActiva = pestana;
    this.cerrarFormulario();
  }

  abrirFormulario(): void {
    if (this.pestanaActiva === 'minuta' || this.pestanaActiva === 'menus') {
      this.abrirModalProgramarMenuDia();
      return;
    }
    this.esEdicion = false;
    this.idEditando = null;
    this.limpiarFormularios();
    this.mostrarFormulario = true;
  }

  abrirEdicion(item: any): void {
    this.esEdicion = true;
    this.mostrarFormulario = true;

    if (this.pestanaActiva === 'menus') {
      this.idEditando = item.id_menu;
      this.menuForm = { ...item };
    } else if (this.pestanaActiva === 'platos') {
      this.idEditando = item.id_plato;
      this.platoForm = { ...item };
    } else if (this.pestanaActiva === 'preparaciones') {
      this.idEditando = item.id_preparacion_asignada;
      this.preparacionForm = {
        id_menu: item.id_menu,
        id_plato: item.id_plato,
        id_usuario_manipuladora: item.id_usuario_manipuladora,
        fecha: item.fecha,
        hora_programada: item.hora_programada,
        estado_preparacion: item.estado_preparacion,
        observaciones: item.observaciones
      };
    }
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.esEdicion = false;
    this.idEditando = null;
    this.limpiarFormularios();
  }

  limpiarFormularios(): void {
    this.menuForm = {
      id_jornada: null,
      fecha: '',
      ninos_presentes: null,
      id_contrato: null,
      id_seccion: 1,
      id_sede: this.sedeSeleccionadaId,
      id_plato: null,
      estado: 'Programado',
      informacion_nutricional: ''
    };
    this.platoForm = { id_seccion: null, nombre_plato: '', componente: '' };
    this.preparacionForm = {
      id_menu: null,
      id_plato: null,
      id_usuario_manipuladora: null,
      fecha: '',
      hora_programada: '',
      estado_preparacion: 'Pendiente',
      observaciones: ''
    };
  }

  guardarTodo(): void {
    if (this.pestanaActiva === 'menus') {
      if (!this.menuForm.id_jornada || !this.menuForm.fecha || !this.menuForm.ninos_presentes || !this.menuForm.id_contrato) {
        this.sweetAlert.warning('Campos obligatorios', 'Por favor completa todos los campos obligatorios.');
        return;
      }

      const body = {
        id_jornada: Number(this.menuForm.id_jornada),
        fecha: this.menuForm.fecha,
        ninos_presentes: Number(this.menuForm.ninos_presentes),
        id_contrato: Number(this.menuForm.id_contrato),
        id_seccion: Number(this.menuForm.id_seccion || 1),
        id_sede: Number(this.menuForm.id_sede || this.sedeSeleccionadaId),
        id_plato: this.menuForm.id_plato ? Number(this.menuForm.id_plato) : null,
        estado: this.menuForm.estado || 'Programado',
        informacion_nutricional: this.menuForm.informacion_nutricional || 'Estandarizado PAE'
      };

      const req = (this.esEdicion && this.idEditando)
        ? this.http.put(`${this.apiUrl}/menus/${this.idEditando}/`, body)
        : this.http.post(`${this.apiUrl}/menus/`, body);

      req.subscribe({
        next: () => { this.cargarMenus(); this.cerrarFormulario(); },
        error: () => this.sweetAlert.error('Error', 'Error al guardar el menú.')
      });
    } else if (this.pestanaActiva === 'preparaciones') {
      if (!this.preparacionForm.id_menu || !this.preparacionForm.id_plato || !this.preparacionForm.id_usuario_manipuladora || !this.preparacionForm.fecha || !this.preparacionForm.hora_programada) {
        this.sweetAlert.warning('Campos obligatorios', 'Completa todos los campos obligatorios.');
        return;
      }

      const body = {
        id_menu: Number(this.preparacionForm.id_menu),
        id_plato: Number(this.preparacionForm.id_plato),
        id_usuario_manipuladora: Number(this.preparacionForm.id_usuario_manipuladora),
        fecha: this.preparacionForm.fecha,
        hora_programada: this.preparacionForm.hora_programada,
        estado_preparacion: this.preparacionForm.estado_preparacion || 'Pendiente',
        observaciones: this.preparacionForm.observaciones || 'Sin observaciones'
      };

      const req = (this.esEdicion && this.idEditando)
        ? this.http.put(`${this.apiUrl}/preparaciones-asignadas/${this.idEditando}/`, body)
        : this.http.post(`${this.apiUrl}/preparaciones-asignadas/`, body);

      req.subscribe({
        next: () => { this.cargarPreparaciones(); this.cerrarFormulario(); },
        error: () => this.sweetAlert.error('Error', 'Error al guardar la preparación.')
      });
    }
  }

  eliminarItem(lista: any[], item: any): void {
    let endpoint = '';
    let id = null;

    if (this.pestanaActiva === 'menus') { endpoint = 'menus'; id = item.id_menu; }
    else if (this.pestanaActiva === 'platos') { endpoint = 'platos'; id = item.id_plato; }
    else if (this.pestanaActiva === 'preparaciones') { endpoint = 'preparaciones-asignadas'; id = item.id_preparacion_asignada; }

    if (!id) return;

    this.http.delete(`${this.apiUrl}/${endpoint}/${id}/`).subscribe({
      next: () => {
        if (this.pestanaActiva === 'menus') this.cargarMenus();
        else if (this.pestanaActiva === 'platos') this.cargarPlatos();
        else if (this.pestanaActiva === 'preparaciones') this.cargarPreparaciones();
      },
      error: (err) => console.error('Error al eliminar:', err)
    });
  }

  abrirDetalle(plato: any): void {
    this.platoSeleccionado = plato;
    this.mostrarDetallePlato = true;
    this.cargarDetallesPlato(plato.id_plato);
  }

  cerrarDetalle(): void {
    this.mostrarDetallePlato = false;
    this.platoSeleccionado = null;
    this.detallesPlato = [];
  }

  cargarDetallesPlato(idPlato: number): void {
    this.http.get<any[]>(`${this.apiUrl}/detalle-platos/`).subscribe({
      next: (data) => {
        const todos = Array.isArray(data) ? data : (data as any).results || [];
        this.detallesPlato = todos.filter((d: any) => d.id_plato == idPlato);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar detalles del plato:', err)
    });
  }

  guardarDetalle(): void {
    if (!this.detalleForm.id_menu || !this.platoSeleccionado) return;

    const body = {
      id_menu: Number(this.detalleForm.id_menu),
      id_plato: Number(this.platoSeleccionado.id_plato),
      porcion_por_nino: Number(this.detalleForm.porcion_por_nino) || 1,
      total_a_preparar: Number(this.detalleForm.total_a_preparar) || 100,
      unidad_total: this.detalleForm.unidad_total || 'raciones',
      estado_preparacion: 'Pendiente'
    };

    this.http.post(`${this.apiUrl}/detalle-platos/`, body).subscribe({
      next: () => {
        this.cargarDetallesPlato(this.platoSeleccionado.id_plato);
        this.detalleForm = { id_menu: null, porcion_por_nino: null, total_a_preparar: null, unidad_total: 'raciones', estado_preparacion: 'Pendiente' };
      }
    });
  }

  eliminarDetalle(idDetalle: number): void {
    this.http.delete(`${this.apiUrl}/detalle-platos/${idDetalle}/`).subscribe({
      next: () => this.cargarDetallesPlato(this.platoSeleccionado.id_plato)
    });
  }
}
