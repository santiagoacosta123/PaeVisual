import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SweetAlertService } from '../sweet-alert.service';
import { AuthService } from '../services/auth.service';
import {
  Entrega,
  EntregaPayload,
  EntregasService,
  IngredienteOpcion,
  TipoMercadoOpcion,
} from '../services/entregas.service';

interface GrupoEntregasDia {
  fecha: string;
  entregas: Entrega[];
  pendientes: number;
  recibidas: number;
  novedades: number;
}

type FiltroEstado = 'TODAS' | 'POR_RECIBIR' | 'RECIBIDA' | 'CON_NOVEDAD';

@Component({
  selector: 'app-historial-entregas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './historial-entregas.css',
  templateUrl: './historial-entregas.html',
})
export class HistorialEntregas implements OnInit {
  // Lista visible (ya filtrada por institución del usuario)
  entregas: Entrega[] = [];
  // Lista completa SIN filtrar por institución (fuente de verdad)
  private entregasOrigen: Entrega[] = [];

  ingredientes: IngredienteOpcion[] = [];
  tiposMercado: TipoMercadoOpcion[] = [];
  cargando = true;
  cargandoCatalogos = false;
  guardando = false;
  errorMensaje = '';
  crudAbierto = false;
  editandoId: number | null = null;
  private catalogosCargados = false;
  private gruposInicializados = false;

  // Búsqueda: al escribir, se expanden los grupos automáticamente
  private _filtroTexto = '';
  get filtroTexto(): string {
    return this._filtroTexto;
  }
  set filtroTexto(valor: string) {
    this._filtroTexto = valor ?? '';
    if (this._filtroTexto.trim()) {
      this.expandirGrupos();
    }
  }

  // Memoización de getters (evita reordenar/agrupar en cada ciclo de detección)
  private cacheFiltradas: { src: Entrega[]; estado: string; texto: string; res: Entrega[] } | null = null;
  private cacheGrupos: { src: Entrega[]; res: GrupoEntregasDia[] } | null = null;

  // Roles de usuario y contexto
  esAdministrador = false;
  esSupervisor = false;
  esSuperAdmin = false;
  institucionNombreUsuario = '';
  institucionIdUsuario: number | null = null;
  tieneSedes = false;
  idsSedesPropias = new Set<number>();

  // Filtros avanzados
  filtroEstado: FiltroEstado = 'TODAS';

  // Modal de Recepción y Control de Calidad (Administrador)
  modalRecepcionAbierto = false;
  entregaSeleccionada: Entrega | null = null;
  gruposExpandidos = new Set<string>();
  modoRechazoDirecto = false;
  formRecepcion = {
    cantidadRecibida: 0,
    cantidadRechazada: 0,
    motivoRechazo: '',
  };
  procesandoRecepcion = false;

  // Modal de Detalle de Novedad / Auditoría
  modalDetalleAbierto = false;
  entregaDetalle: Entrega | null = null;

  crudForm = this.formularioVacio();

  // Quién puede Recibir / Rechazar entregas en tránsito
  get puedeGestionarRecepcion(): boolean {
    return this.esAdministrador || this.esSuperAdmin;
  }

  constructor(
    public entregasService: EntregasService,
    private alertas: SweetAlertService,
    private authService: AuthService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    const user = this.authService.obtenerUsuario();
    const rol = user?.rol;
    this.esSuperAdmin = this.authService.esSuperAdministrador(rol);
    this.esSupervisor = this.authService.esSupervisor(rol);
    this.esAdministrador =
      (this.authService.esAdministrador(rol) || rol === 'admin' || rol === 'administrador') && !this.esSuperAdmin;
    this.institucionNombreUsuario = user?.institucion_nombre || user?.institucion || '';
    this.institucionIdUsuario = user?.id_institucion ? Number(user.id_institucion) : null;

    // Verificar si la institución asignada maneja sedes
    if (this.esAdministrador && this.institucionIdUsuario) {
      this.cargarSedesInstitucion(this.institucionIdUsuario);
    }

    // 1. Carga inmediata desde caché local
    const cacheadas = this.leerCacheEntregas();
    if (cacheadas.length > 0) {
      this.entregasOrigen = cacheadas;
      this.aplicarFiltroInstitucion();
      this.cargando = false;
      this.expandirGruposIniciales();
    }

    // 2. Consulta de datos actualizados al backend en segundo plano
    this.cargarHistorial();
  }

  // =========================================================================
  // CARGA DE DATOS
  // =========================================================================

  private aplicarFiltroInstitucion(): void {
    this.entregas = this.filtrarPorInstitucionUsuario(this.entregasOrigen);
  }

  private cargarSedesInstitucion(idInst: number): void {
    this.http
      .get<any>(`${environment.apiUrl}/sedes/?id_institucion=${idInst}`)
      .pipe(
        timeout(6000),
        catchError(() => of([])),
      )
      .subscribe((res) => {
        const lista = Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : [];
        this.idsSedesPropias = new Set<number>(
          lista.map((s: any) => Number(s.id_sede ?? s.id)).filter((id: number) => !isNaN(id)),
        );
        this.tieneSedes = this.idsSedesPropias.size > 0;
        // Re-filtra desde la lista completa, no desde la ya filtrada
        this.aplicarFiltroInstitucion();
        this.expandirGruposIniciales();
      });
  }

  cargarHistorial(): void {
    if (this.entregas.length === 0) {
      this.cargando = true;
    }
    this.errorMensaje = '';
    this.entregasService.cargar().subscribe({
      next: (entregas) => {
        this.entregasOrigen = this.combinarConEntregasLocales(entregas);
        this.aplicarFiltroInstitucion();
        this.guardarCacheEntregas(this.entregasOrigen);
        this.cargando = false;
        this.expandirGruposIniciales();
      },
      error: (error) => {
        console.error('Error al consultar historial de entregas:', error);
        this.entregasOrigen = this.combinarConEntregasLocales(this.entregasOrigen);
        this.aplicarFiltroInstitucion();
        this.cargando = false;
        this.errorMensaje =
          error?.status === 401
            ? 'La sesión expiró o no es válida. Inicia sesión nuevamente para consultar el historial.'
            : error?.status === 403
              ? 'Tu usuario no tiene permiso para consultar el historial.'
              : '';
        if (this.errorMensaje) {
          void this.alertas.error('No se pudo cargar el historial', this.errorMensaje);
        }
      },
    });
  }

  private leerCacheEntregas(): Entrega[] {
    try {
      const raw = localStorage.getItem('sirae_entregas_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return this.combinarConEntregasLocales(parsed);
        }
      }
    } catch (e) {
      console.warn('Error leyendo caché de entregas:', e);
    }
    return this.combinarConEntregasLocales([]);
  }

  private guardarCacheEntregas(lista: Entrega[]): void {
    try {
      localStorage.setItem('sirae_entregas_cache', JSON.stringify(lista));
    } catch (e) {
      console.warn('Error guardando caché de entregas:', e);
    }
  }

  filtrarPorInstitucionUsuario(lista: Entrega[]): Entrega[] {
    if (!this.esAdministrador) {
      return lista;
    }

    const norm = (s: string | null | undefined) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const miInstNombre = norm(this.institucionNombreUsuario);
    const miInstId = this.institucionIdUsuario;

    return lista.filter((entrega) => {
      // 1. Filtrar por ID de institución si ambos están disponibles
      if (miInstId != null && entrega.idInstitucion != null && Number(entrega.idInstitucion) !== Number(miInstId)) {
        return false;
      }

      // 2. Filtrar por nombre de institución si está especificado y no es genérico
      const entInstNombre = norm(entrega.institucionNombre);
      if (
        miInstNombre &&
        entInstNombre &&
        entInstNombre !== 'institucion asignada' &&
        entInstNombre !== 'institucion educativa'
      ) {
        if (!entInstNombre.includes(miInstNombre) && !miInstNombre.includes(entInstNombre)) {
          return false;
        }
      }

      // 3. Filtrar si en observaciones se menciona explícitamente OTRA institución
      const obs = norm(entrega.observaciones);
      if (obs.includes('institucion:') || obs.includes('institucion :')) {
        const match = obs.match(/institucion\s*:\s*([^|]+)/i);
        if (match && match[1]) {
          const instEnObs = norm(match[1]);
          if (miInstNombre && !instEnObs.includes(miInstNombre) && !miInstNombre.includes(instEnObs)) {
            return false;
          }
        }
      }

      // 4. Sedes
      if (!this.tieneSedes) {
        // Institución sin sedes: no mostrar entregas con sede asignada
        if (entrega.idSede != null || (entrega.sedeNombre && entrega.sedeNombre.trim() !== '')) {
          return false;
        }
      } else if (this.idsSedesPropias.size > 0 && entrega.idSede != null) {
        // Institución con sedes: solo las que le pertenecen
        if (!this.idsSedesPropias.has(Number(entrega.idSede))) {
          return false;
        }
      }

      return true;
    });
  }

  // Combina servidor + locales. NO filtra por institución (eso lo hace aplicarFiltroInstitucion).
  private combinarConEntregasLocales(servidor: Entrega[]): Entrega[] {
    let recepciones: Record<string, any> = {};
    try {
      recepciones = JSON.parse(localStorage.getItem('sirae_recepciones_admin') || '{}');
    } catch {
      recepciones = {};
    }

    // Sincronizar estado de recepciones para las del servidor
    const servidorActualizado = servidor.map((e) => {
      const idKey = e.id != null ? `id:${e.id}` : '';
      const compKey = `${(e.ingrediente || '').toLowerCase().trim()}|${e.fechaRecepcion}|${e.cantidad}`;
      const rec = (idKey && recepciones[idKey]) || recepciones[compKey];
      if (rec) {
        return {
          ...e,
          estado: rec.estado || e.estado,
          cantidadRecibida: rec.cantidad_recibida != null ? Number(rec.cantidad_recibida) : e.cantidadRecibida,
          cantidadRechazada: rec.cantidad_rechazada != null ? Number(rec.cantidad_rechazada) : e.cantidadRechazada,
          motivoRechazo: rec.motivo_rechazo || e.motivoRechazo,
          usuarioReceptorNombre: rec.usuario_receptor_nombre || e.usuarioReceptorNombre,
        };
      }
      return e;
    });

    let locales: any[] = [];
    try {
      locales = JSON.parse(localStorage.getItem('sirae_entregas_locales') || '[]');
      if (!Array.isArray(locales)) locales = [];
    } catch {
      locales = [];
    }

    const idSet = new Set(servidorActualizado.map((e) => e.id).filter((id) => id != null));
    const clavesSet = new Set(
      servidorActualizado.map((e) => `${(e.ingrediente || '').toLowerCase().trim()}|${e.fechaRecepcion}|${e.cantidad}`),
    );

    const localesFiltradas: Entrega[] = locales
      .filter((l) => {
        if (l.id != null && idSet.has(l.id)) return false;
        const k = `${(l.ingrediente || '').toLowerCase().trim()}|${l.fechaRecepcion}|${l.cantidad}`;
        return !clavesSet.has(k);
      })
      .map((l) => {
        const idKey = l.id != null ? `id:${l.id}` : '';
        const compKey = `${(l.ingrediente || '').toLowerCase().trim()}|${l.fechaRecepcion}|${l.cantidad}`;
        const rec = (idKey && recepciones[idKey]) || recepciones[compKey];
        return {
          id: l.id,
          idIngrediente: l.idIngrediente,
          idTipoMercado: l.idTipoMercado,
          idInstitucion: l.idInstitucion,
          institucionNombre:
            l.institucionNombre ||
            l.destino ||
            (this.esAdministrador ? this.institucionNombreUsuario : 'Institución asignada'),
          idSede: l.idSede,
          sedeNombre: l.sedeNombre,
          ingrediente: l.ingrediente,
          tipoMercado: l.tipoMercado || 'Perecederos',
          frecuencia: l.frecuencia || 'Semanal',
          cantidad: l.cantidad,
          unidad: l.unidad || 'Kg',
          fechaRecepcion: l.fechaRecepcion,
          fechaVencimiento: l.fechaVencimiento || l.fechaRecepcion,
          estado: (rec?.estado || l.estado || 'EN_TRANSITO').toUpperCase(),
          cantidadRecibida:
            rec?.cantidad_recibida != null ? Number(rec.cantidad_recibida) : (l.cantidadRecibida ?? null),
          cantidadRechazada:
            rec?.cantidad_rechazada != null ? Number(rec.cantidad_rechazada) : (l.cantidadRechazada ?? null),
          motivoRechazo: rec?.motivo_rechazo || l.motivoRechazo || '',
          usuarioReceptorNombre: rec?.usuario_receptor_nombre || l.usuarioReceptorNombre || '',
          observaciones: l.observaciones || (l.responsable ? `Responsable: ${l.responsable}` : ''),
        };
      });

    return [...localesFiltradas, ...servidorActualizado];
  }

  // SP-249: Exportar historial de entregas a Excel
  exportarExcel(): void {
    this.entregasService.exportarExcel().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Historial_Entregas_${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        void this.alertas.success('Exportación exitosa', 'El archivo Excel se descargó correctamente.');
      },
      error: (error) => {
        console.error('Error al exportar Excel:', error);
        void this.alertas.error('No se pudo exportar', 'Ocurrió un error al generar el archivo Excel.');
      },
    });
  }

  // =========================================================================
  // CRUD (SUPER ADMIN)
  // =========================================================================

  toggleCrud(): void {
    this.crudAbierto = !this.crudAbierto;
    if (this.crudAbierto && !this.catalogosCargados && !this.cargandoCatalogos) {
      this.cargarCatalogos();
    }
  }

  cargarCatalogos(): void {
    this.cargandoCatalogos = true;
    forkJoin({
      ingredientes: this.entregasService.cargarIngredientes(),
      tiposMercado: this.entregasService.cargarTiposMercado(),
    }).subscribe({
      next: ({ ingredientes, tiposMercado }) => {
        this.ingredientes = ingredientes;
        this.tiposMercado = tiposMercado;
        this.cargandoCatalogos = false;
        this.catalogosCargados = true;
        if (!ingredientes.length || !tiposMercado.length) {
          const mensaje = !tiposMercado.length
            ? 'No hay tipos de mercado configurados. El administrador debe cargar el catálogo.'
            : 'No hay ingredientes disponibles para registrar entregas.';
          void this.alertas.warning('Catálogo incompleto', mensaje);
        }
      },
      error: (error) => {
        console.error('Error al cargar catálogos del CRUD de entregas:', error);
        this.cargandoCatalogos = false;
        void this.alertas.error(
          'No se pudieron cargar los catálogos',
          error.status === 401
            ? 'La sesión expiró. Inicia sesión nuevamente.'
            : 'Verifica tu conexión e intenta cargar el catálogo otra vez.',
        );
      },
    });
  }

  nuevoRegistro(): void {
    this.editandoId = null;
    this.crudForm = this.formularioVacio();
  }

  editar(entrega: Entrega): void {
    if (!entrega.id || !entrega.idIngrediente || !entrega.idTipoMercado) {
      void this.alertas.error('No se puede editar', 'La entrega no contiene los identificadores requeridos.');
      return;
    }

    this.editandoId = entrega.id;
    this.crudForm = {
      idIngrediente: entrega.idIngrediente,
      idTipoMercado: entrega.idTipoMercado,
      frecuencia: entrega.frecuencia,
      cantidad: entrega.cantidad,
      unidad: entrega.unidad,
      fechaRecepcion: entrega.fechaRecepcion,
      fechaVencimiento: entrega.fechaVencimiento,
      observaciones: entrega.observaciones ?? '',
    };
    document.getElementById('crudFormTitle')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  cancelarEdicion(): void {
    this.nuevoRegistro();
  }

  guardarDesdeCrud(): void {
    const { idIngrediente, idTipoMercado, frecuencia, cantidad, unidad, fechaRecepcion } = this.crudForm;
    // El formulario HTML no tiene campo de vencimiento: por defecto = fecha de entrega
    const fechaVencimiento = this.crudForm.fechaVencimiento || fechaRecepcion;

    if (
      !idIngrediente ||
      !idTipoMercado ||
      !frecuencia ||
      cantidad == null ||
      cantidad <= 0 ||
      !unidad ||
      !fechaRecepcion
    ) {
      void this.alertas.warning('Revisa el formulario', 'Completa todos los campos obligatorios con valores válidos.');
      return;
    }
    if (fechaVencimiento < fechaRecepcion) {
      void this.alertas.warning('Fechas no válidas', 'El vencimiento no puede ser anterior a la fecha de recepción.');
      return;
    }

    const payload: EntregaPayload = {
      id_ingrediente: idIngrediente,
      id_tipo_mercado: idTipoMercado,
      fecha_entrega: fechaRecepcion,
      fecha_vencimiento: fechaVencimiento,
      cantidad,
      observaciones: this.crudForm.observaciones,
      frecuencia,
      unidad,
    };

    this.guardando = true;
    const request = this.editandoId
      ? this.entregasService.actualizar(this.editandoId, payload)
      : this.entregasService.registrar(payload);
    request.subscribe({
      next: () => {
        this.guardando = false;
        void this.alertas.success(
          this.editandoId ? 'Entrega actualizada' : 'Entrega registrada',
          this.editandoId ? 'Los cambios se guardaron correctamente.' : 'La entrega se agregó correctamente.',
        );
        this.nuevoRegistro();
        this.cargarHistorial();
      },
      error: (error) => {
        console.error('Error al guardar entrega desde el CRUD:', error);
        this.guardando = false;
        void this.alertas.error(
          'No se pudo guardar la entrega',
          error.status === 401
            ? 'La sesión expiró. Inicia sesión nuevamente.'
            : error.status === 403
              ? 'Tu usuario no tiene permiso para realizar esta operación.'
              : 'Verifica los datos e intenta nuevamente.',
        );
      },
    });
  }

  eliminar(entrega: Entrega): void {
    if (!entrega.id) {
      void this.alertas.error('No se puede eliminar', 'La entrega no tiene un identificador válido.');
      return;
    }
    this.alertas
      .confirm(
        '¿Eliminar esta entrega?',
        `Se eliminará el registro de ${entrega.ingrediente}. Esta acción no se puede deshacer.`,
        'Sí, eliminar',
      )
      .then((result) => {
        if (!result.isConfirmed) return;

        this.entregasService.eliminar(entrega.id!).subscribe({
          next: () => {
            void this.alertas.success('Entrega eliminada', 'El registro se eliminó correctamente.');
            this.cargarHistorial();
          },
          error: (error) => {
            console.error('Error al eliminar entrega:', error);
            void this.alertas.error(
              'No se pudo eliminar la entrega',
              error.status === 401
                ? 'La sesión expiró. Inicia sesión nuevamente.'
                : error.status === 403
                  ? 'Tu usuario no tiene permiso para eliminar entregas.'
                  : 'Intenta nuevamente más tarde.',
            );
          },
        });
      });
  }

  // =========================================================================
  // FILTROS Y AGRUPACIÓN (memoizados)
  // =========================================================================

  get entregasFiltradas(): Entrega[] {
    const texto = this.filtroTexto.trim().toLocaleLowerCase();
    const c = this.cacheFiltradas;
    if (c && c.src === this.entregas && c.estado === this.filtroEstado && c.texto === texto) {
      return c.res;
    }

    const res = this.entregas
      .filter((entrega) => {
        const st = (entrega.estado || 'EN_TRANSITO').toUpperCase();

        if (
          this.filtroEstado === 'POR_RECIBIR' &&
          !(st === 'EN_TRANSITO' || st === 'PENDIENTE' || st === 'EN_PROCESO')
        ) {
          return false;
        }
        if (this.filtroEstado === 'RECIBIDA' && st !== 'RECIBIDA') return false;
        if (this.filtroEstado === 'CON_NOVEDAD' && !(st === 'CON_NOVEDAD' || st === 'RECHAZADA')) return false;

        if (!texto) return true;
        return [
          entrega.ingrediente,
          entrega.tipoMercado,
          entrega.frecuencia,
          entrega.unidad,
          entrega.institucionNombre,
          entrega.sedeNombre,
          entrega.observaciones,
          this.estadoEntrega(entrega),
        ].some((valor) => (valor || '').toLocaleLowerCase().includes(texto));
      })
      .sort((a, b) => {
        const comp = (b.fechaRecepcion || '').localeCompare(a.fechaRecepcion || '');
        return comp !== 0 ? comp : (Number(b.id) || 0) - (Number(a.id) || 0);
      });

    this.cacheFiltradas = { src: this.entregas, estado: this.filtroEstado, texto, res };
    return res;
  }

  get gruposPorFecha(): GrupoEntregasDia[] {
    const filtradas = this.entregasFiltradas;
    if (this.cacheGrupos && this.cacheGrupos.src === filtradas) {
      return this.cacheGrupos.res;
    }

    const mapa = new Map<string, Entrega[]>();
    for (const entrega of filtradas) {
      const fecha = entrega.fechaRecepcion?.slice(0, 10) || 'sin-fecha';
      const lista = mapa.get(fecha) ?? [];
      lista.push(entrega);
      mapa.set(fecha, lista);
    }

    const esPendiente = (e: Entrega) =>
      ['EN_TRANSITO', 'PENDIENTE', 'EN_PROCESO'].includes((e.estado || 'EN_TRANSITO').toUpperCase());
    const esNovedad = (e: Entrega) => ['CON_NOVEDAD', 'RECHAZADA'].includes((e.estado || '').toUpperCase());

    const res: GrupoEntregasDia[] = Array.from(mapa, ([fecha, entregas]) => ({
      fecha,
      entregas,
      pendientes: entregas.filter(esPendiente).length,
      recibidas: entregas.filter((e) => (e.estado || '').toUpperCase() === 'RECIBIDA').length,
      novedades: entregas.filter(esNovedad).length,
    }));

    this.cacheGrupos = { src: filtradas, res };
    return res;
  }

  alternarGrupoFecha(fecha: string): void {
    const gruposExpandidos = new Set(this.gruposExpandidos);
    if (gruposExpandidos.has(fecha)) {
      gruposExpandidos.delete(fecha);
    } else {
      gruposExpandidos.add(fecha);
    }
    this.gruposExpandidos = gruposExpandidos;
  }

  grupoEstaExpandido(fecha: string): boolean {
    return this.gruposExpandidos.has(fecha);
  }

  expandirGrupos(): void {
    this.gruposExpandidos = new Set(this.gruposPorFecha.map((grupo) => grupo.fecha));
  }

  contraerGrupos(): void {
    this.gruposExpandidos = new Set();
  }

  // En la primera carga abre los días con entregas por recibir (o el más reciente)
  private expandirGruposIniciales(): void {
    if (this.gruposInicializados || this.entregas.length === 0) return;
    this.gruposInicializados = true;
    const grupos = this.gruposPorFecha;
    const abiertos = grupos.filter((g) => g.pendientes > 0).map((g) => g.fecha);
    this.gruposExpandidos = new Set(abiertos.length ? abiertos : grupos.slice(0, 1).map((g) => g.fecha));
  }

  formatoFecha(fecha: string | null | undefined): string {
    const [anio, mes, dia] = (fecha || '').slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return 'Fecha no disponible';
    const fechaValidada = new Date(anio, mes - 1, dia);
    if (
      fechaValidada.getFullYear() !== anio ||
      fechaValidada.getMonth() !== mes - 1 ||
      fechaValidada.getDate() !== dia
    ) {
      return 'Fecha no disponible';
    }
    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
  }

  contarEstado(tipo: string): number {
    if (tipo === 'TODAS') return this.entregas.length;
    if (tipo === 'POR_RECIBIR') {
      return this.entregas.filter((e) => {
        const st = (e.estado || 'EN_TRANSITO').toUpperCase();
        return st === 'EN_TRANSITO' || st === 'PENDIENTE' || st === 'EN_PROCESO';
      }).length;
    }
    if (tipo === 'RECIBIDA') {
      return this.entregas.filter((e) => (e.estado || '').toUpperCase() === 'RECIBIDA').length;
    }
    if (tipo === 'CON_NOVEDAD') {
      return this.entregas.filter((e) => {
        const st = (e.estado || '').toUpperCase();
        return st === 'CON_NOVEDAD' || st === 'RECHAZADA';
      }).length;
    }
    return 0;
  }

  cambiarFiltroEstado(nuevo: FiltroEstado): void {
    this.filtroEstado = nuevo;
    this.expandirGrupos(); // al filtrar por estado se ven directamente los resultados
  }

  get vencidas(): number {
    return this.entregas.filter((entrega) => this.estado(entrega) === 'Vencido').length;
  }

  get porVencer(): number {
    return this.entregas.filter((entrega) => this.estado(entrega) === 'Próximo a vencer').length;
  }

  estado(entrega: Entrega): string {
    return this.entregasService.obtenerEstado(entrega);
  }

  claseEstado(entrega: Entrega): string {
    return this.entregasService.claseEstado(this.estado(entrega));
  }

  // =========================================================================
  // CONTROL DE CALIDAD Y RECEPCIÓN TÉCNICA (ADMINISTRADOR)
  // =========================================================================

  abrirModalRecepcion(entrega: Entrega): void {
    this.entregaSeleccionada = entrega;
    this.modoRechazoDirecto = false;
    const totalCant = entrega.cantidad || 0;
    this.formRecepcion = {
      cantidadRecibida: totalCant,
      cantidadRechazada: 0,
      motivoRechazo: '',
    };
    this.modalRecepcionAbierto = true;
  }

  abrirModalRechazo(entrega: Entrega): void {
    const totalCant = Number(entrega.cantidad);
    if (!Number.isFinite(totalCant) || totalCant <= 0) {
      void this.alertas.warning('No se puede rechazar', 'La entrega no tiene una cantidad válida para registrar.');
      return;
    }

    this.entregaSeleccionada = entrega;
    this.modoRechazoDirecto = true;
    this.formRecepcion = {
      cantidadRecibida: 0,
      cantidadRechazada: totalCant,
      motivoRechazo: '',
    };
    this.modalRecepcionAbierto = true;
  }

  cerrarModalRecepcion(): void {
    this.modalRecepcionAbierto = false;
    this.entregaSeleccionada = null;
    this.modoRechazoDirecto = false;
  }

  onCambioCantidades(campo: 'recibida' | 'rechazada'): void {
    if (!this.entregaSeleccionada) return;
    const total = this.entregaSeleccionada.cantidad || 0;
    if (campo === 'rechazada') {
      const rech = Math.max(0, Number(this.formRecepcion.cantidadRechazada) || 0);
      this.formRecepcion.cantidadRecibida = Math.max(0, +(total - rech).toFixed(3));
    } else {
      const rec = Math.max(0, Number(this.formRecepcion.cantidadRecibida) || 0);
      this.formRecepcion.cantidadRechazada = Math.max(0, +(total - rec).toFixed(3));
    }
  }

  private guardarRecepcionLocal(entrega: Entrega, rec: number, rech: number, motivo: string, estado: string): void {
    try {
      const key = 'sirae_recepciones_admin';
      const recepciones = JSON.parse(localStorage.getItem(key) || '{}');
      const receptor = this.authService.obtenerUsuario();
      const nombreReceptor = receptor
        ? `${receptor.nombre || ''} ${receptor.apellido || ''}`.trim() || receptor.correo
        : 'Administrador';

      const datos = {
        id: entrega.id,
        estado,
        cantidad_recibida: rec,
        cantidad_rechazada: rech,
        motivo_rechazo: motivo,
        usuario_receptor_nombre: nombreReceptor,
        fecha: new Date().toISOString(),
      };

      if (entrega.id != null) {
        recepciones[`id:${entrega.id}`] = datos;
      }
      if (entrega.ingrediente && entrega.fechaRecepcion) {
        const k = `${entrega.ingrediente.toLowerCase().trim()}|${entrega.fechaRecepcion}|${entrega.cantidad}`;
        recepciones[k] = datos;
      }
      localStorage.setItem(key, JSON.stringify(recepciones));

      // Actualizar también en sirae_entradas_extra
      const extrasKey = 'sirae_entradas_extra';
      const extras = JSON.parse(localStorage.getItem(extrasKey) || '{}');
      const clavesExtra = [
        entrega.id != null ? `id:${entrega.id}` : '',
        entrega.idIngrediente != null && entrega.fechaRecepcion
          ? `${entrega.idIngrediente}|${entrega.fechaRecepcion}|${entrega.cantidad}`
          : '',
      ].filter(Boolean);
      for (const clave of clavesExtra) {
        if (!extras[clave]) continue;
        extras[clave].estadoAprobacion = estado;
        extras[clave].motivoRechazo = motivo;
      }
      localStorage.setItem(extrasKey, JSON.stringify(extras));
    } catch (e) {
      console.warn('No se pudo guardar la recepción localmente:', e);
    }
  }

  confirmarRecepcion(): void {
    const entregaRef = this.entregaSeleccionada;
    if (!entregaRef || typeof entregaRef.id !== 'number') return;
    const entregaId: number = entregaRef.id;
    const rec = Number(this.formRecepcion.cantidadRecibida);
    const rech = Number(this.formRecepcion.cantidadRechazada);
    // Se guarda antes del subscribe: el modal puede cerrarse antes de que responda el servidor
    const motivo = this.formRecepcion.motivoRechazo.trim();

    if (isNaN(rec) || rec < 0 || isNaN(rech) || rech < 0) {
      void this.alertas.warning('Cantidades inválidas', 'Las cantidades deben ser números positivos.');
      return;
    }

    if (rech > 0 && !motivo) {
      void this.alertas.warning(
        'Motivo requerido',
        'Has reportado productos dañados o rechazados. Por favor especifica el motivo (ej: tomates magullados o empaque averiado).',
      );
      return;
    }

    const estado = rech > 0 && rec > 0 ? 'CON_NOVEDAD' : rech > 0 ? 'RECHAZADA' : 'RECIBIDA';
    this.procesandoRecepcion = true;

    this.entregasService
      .confirmarRecepcion(entregaId, {
        cantidad_recibida: rec,
        cantidad_rechazada: rech,
        motivo_rechazo: motivo,
      })
      .subscribe({
        next: () => {
          this.procesandoRecepcion = false;
          this.guardarRecepcionLocal(entregaRef, rec, rech, motivo, estado);
          this.cerrarModalRecepcion();
          const unidad = entregaRef.unidad || 'unidades';
          const msj =
            rech > 0
              ? rec === 0
                ? `Se reportaron ${rech} ${unidad} rechazadas en control de calidad.`
                : `Se recibieron ${rec} ${unidad} en buen estado y se reportaron ${rech} ${unidad} con novedad/avería. El inventario ha sido acreditado.`
              : `Se recibieron exitosamente los ${rec} ${unidad}. El inventario ha sido acreditado.`;
          void this.alertas.success('Recepción confirmada', msj);
          this.cargarHistorial();
        },
        error: (err) => {
          console.error('Error al confirmar recepción de entrega:', err);
          this.procesandoRecepcion = false;
          void this.alertas.error(
            'No se pudo confirmar la entrega',
            err?.status === 401
              ? 'La sesión expiró. Inicia sesión nuevamente.'
              : err?.status === 403
                ? 'Tu usuario no tiene permiso para registrar la recepción.'
                : 'El servidor no registró la recepción. Revisa la conexión e inténtalo nuevamente.',
          );
        },
      });
  }

  verDetalleNovedad(entrega: Entrega): void {
    this.entregaDetalle = entrega;
    this.modalDetalleAbierto = true;
  }

  cerrarModalDetalle(): void {
    this.modalDetalleAbierto = false;
    this.entregaDetalle = null;
  }

  // Helpers de estado del ciclo de vida de la entrega
  estadoEntrega(entrega: Entrega): string {
    const e = (entrega.estado || 'EN_TRANSITO').toUpperCase();
    switch (e) {
      case 'RECIBIDA':
        return 'Recibida OK';
      case 'CON_NOVEDAD':
        return 'Con Novedad';
      case 'RECHAZADA':
        return 'Rechazada';
      case 'EN_TRANSITO':
      default:
        return 'En tránsito';
    }
  }

  claseEstadoEntrega(entrega: Entrega): string {
    const e = (entrega.estado || 'EN_TRANSITO').toUpperCase();
    switch (e) {
      case 'RECIBIDA':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'CON_NOVEDAD':
        return 'border-orange-300 bg-orange-50 text-orange-800';
      case 'RECHAZADA':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'EN_TRANSITO':
      default:
        return 'border-amber-200 bg-amber-50 text-amber-800';
    }
  }

  iconoEstadoEntrega(entrega: Entrega): string {
    const e = (entrega.estado || 'EN_TRANSITO').toUpperCase();
    switch (e) {
      case 'RECIBIDA':
        return 'check_circle';
      case 'CON_NOVEDAD':
        return 'warning';
      case 'RECHAZADA':
        return 'cancel';
      case 'EN_TRANSITO':
      default:
        return 'local_shipping';
    }
  }

  private formularioVacio() {
    return {
      idIngrediente: null as number | null,
      idTipoMercado: null as number | null,
      frecuencia: 'Semanal',
      cantidad: null as number | null,
      unidad: 'Kg',
      fechaRecepcion: this.fechaHoy(),
      fechaVencimiento: '',
      observaciones: '',
    };
  }

  private fechaHoy(): string {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  }
}