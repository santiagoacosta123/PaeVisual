import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { EntregasService } from '../services/entregas.service';
import { SweetAlertService } from '../sweet-alert.service';

interface Entrega {
  id?: number;
  fechaRecepcion: string;
  ingrediente: string;
  tipoMercado: string;
  categoria?: string;
  cantidad: number;
  unidad: string;
  fechaVencimiento: string;
  frecuencia?: string;
  institucion?: string;
}

interface FacturaGrupo {
  folio: string;
  fecha: string;
  items: Entrega[];
  alertas: number;
}

interface FilaLote {
  idIngrediente: number;
  nombre: string;
  tieneHistorial: boolean;
  cantidad: number | null;
  unidad: string;
  fechaVencimiento: string;
  idTipoMercado: number | null;
  frecuenciaDias: number | null;
}

@Component({
  selector: 'app-registrar-entrega-alimentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registrar-entrega-alimentos.html',
  styleUrls: ['./registrar-entrega-alimentos.css']
})
export class RegistrarEntregaAlimentosComponent implements OnInit {
  cargandoHistorial: boolean = false;
  errorHistorial: boolean = false;
  cargandoCatalogos: boolean = false;
  guardandoLote: boolean = false;
  errorMensaje: string = '';

  historial: Entrega[] = [];
  ingredientesHistorial: string[] = [];
  ingredientes: { id: number; nombre: string }[] = [];
  tiposMercado: { id: number; nombre: string }[] = [];
  instituciones: string[] = ['Liceo de Occidente'];

  vista: 'facturas' | 'detalle' = 'facturas';
  mostrarModalEntrega: boolean = false;
  facturasAbiertas: { [fecha: string]: boolean } = {};

  filtroEstado: string = 'Todos';
  filtroMercado: string = 'Todos';
  textoFiltro: string = '';
  fechaDesde: string = '';
  fechaHasta: string = '';
  ingredienteFiltro: string = 'Todos';

  paginaActual: number = 1;
  porPagina: number = 10;
  opcionesPorPagina: number[] = [5, 10, 20, 50];

  ordenColumna: string = 'fechaRecepcion';
  ordenDireccion: 'asc' | 'desc' = 'desc';

  institucionLote: string = 'Liceo de Occidente';
  fechaRecepcionLote: string = this.fechaHoy();
  busquedaLote: string = '';
  filasLote: FilaLote[] = [];

  filasEsqueleto = [1, 2, 3, 4, 5];
  columnasEsqueleto = [1, 2, 3, 4, 5, 6];

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private authService: AuthService,
    private sweetAlert: SweetAlertService,
    private entregasService: EntregasService
  ) {}

  ngOnInit(): void {
    this.cargarCatalogos();
  }

  cargarHistorial(): void {
    this.cargandoHistorial = true;
    this.errorHistorial = false;

    this.http.get<any>(`${this.apiUrl}/entregas/`).subscribe({
      next: (res) => {
        this.cargandoHistorial = false;
        const data = Array.isArray(res) ? res : (res?.results || []);
        this.historial = data.map((item: any) => {
          let unidad = item.unidad;
          let frecuencia = item.frecuencia;
          const obs = item.observaciones || '';
          if (!unidad) {
            const matchUnidad = obs.match(/Unidad:\s*([^|]+)/i);
            if (matchUnidad) unidad = matchUnidad[1].trim();
          }
          if (!frecuencia) {
            const matchFrecuencia = obs.match(/Frecuencia:\s*([^|]+)/i);
            if (matchFrecuencia) frecuencia = matchFrecuencia[1].trim();
          }

          const ingObj = this.ingredientes.find(i => i.id === (item.id_ingrediente || item.idIngrediente));
          const ingredienteNombre = item.ingrediente_nombre || item.ingrediente || ingObj?.nombre || `Ingrediente ${item.id_ingrediente || item.idIngrediente || ''}`;

          const tipoObj = this.tiposMercado.find(t => t.id === (item.id_tipo_mercado || item.idTipoMercado));
          const tipoMercadoNombre = item.tipo_mercado_nombre || item.tipoMercado || tipoObj?.nombre || ((item.id_tipo_mercado || item.idTipoMercado) === 1 ? 'Perecedero' : 'No perecedero');

          return {
            id: item.id || item.id_entrega,
            fechaRecepcion: (item.fecha_entrega || item.fechaRecepcion || item.fecha_recepcion || '').substring(0, 10),
            ingrediente: ingredienteNombre,
            tipoMercado: tipoMercadoNombre,
            cantidad: Number(item.cantidad || 0),
            unidad: unidad || 'Kg',
            fechaVencimiento: (item.fecha_vencimiento || item.fechaVencimiento || '').substring(0, 10),
            frecuencia: frecuencia || 'Semanal',
            institucion: item.institucion || 'Liceo de Occidente'
          };
        });
        this.actualizarFiltrosIngredientes();
      },
      error: (err) => {
        console.error('Error al cargar historial de entregas:', err);
        this.cargandoHistorial = false;
        this.errorHistorial = true;
      }
    });
  }

  cargarCatalogos(): void {
    this.cargandoCatalogos = true;
    this.errorMensaje = '';

    const productosDefault = [
      { id: 1, nombre: 'Arroz' },
      { id: 2, nombre: 'Tomate' },
      { id: 3, nombre: 'Pollo' },
      { id: 4, nombre: 'Carne de res' },
      { id: 5, nombre: 'Leche' },
      { id: 6, nombre: 'Aceite vegetal' },
      { id: 7, nombre: 'Lentejas' },
      { id: 8, nombre: 'Frijol' },
      { id: 9, nombre: 'Pasta' },
      { id: 10, nombre: 'Papa' }
    ];

    const tiposDefault = [
      { id: 1, nombre: 'Perecedero' },
      { id: 2, nombre: 'No perecedero' }
    ];

    this.http.get<any>(`${this.apiUrl}/ingredientes/`).subscribe({
      next: (ingRes) => {
        const rawIng = Array.isArray(ingRes) ? ingRes : (ingRes?.results || []);
        const listaIng = (rawIng && rawIng.length > 0) ? rawIng : productosDefault;
        this.ingredientes = listaIng.map((i: any) => ({
          id: i.id_ingrediente || i.id,
          nombre: i.nombre_ingrediente || i.nombre
        }));

        this.http.get<any>(`${this.apiUrl}/tipos-mercado/`).subscribe({
          next: (tipoRes) => {
            this.cargandoCatalogos = false;
            const rawTipos = Array.isArray(tipoRes) ? tipoRes : (tipoRes?.results || []);
            const listaTipos = (rawTipos && rawTipos.length > 0) ? rawTipos : tiposDefault;
            this.tiposMercado = listaTipos.map((t: any) => ({
              id: t.id_tipo_mercado || t.id,
              nombre: t.nombre_tipo || t.nombre
            }));

            this.poblarFilasLote();
            this.cargarHistorial();
          },
          error: (err) => {
            console.warn('No se pudo cargar tipos-mercado, usando defaults', err);
            this.tiposMercado = tiposDefault;
            this.cargandoCatalogos = false;
            this.poblarFilasLote();
            this.cargarHistorial();
          }
        });
      },
      error: (err) => {
        console.warn('No se pudo cargar ingredientes, usando defaults', err);
        this.ingredientes = productosDefault;
        this.tiposMercado = tiposDefault;
        this.cargandoCatalogos = false;
        this.poblarFilasLote();
        this.cargarHistorial();
      }
    });
  }

  poblarFilasLote(): void {
    this.filasLote = this.ingredientes.map(ing => ({
      idIngrediente: ing.id,
      nombre: ing.nombre,
      tieneHistorial: true,
      cantidad: null,
      unidad: 'Kg',
      fechaVencimiento: '',
      idTipoMercado: this.tiposMercado.length > 0 ? this.tiposMercado[0].id : null,
      frecuenciaDias: 7
    }));
  }

  actualizarFiltrosIngredientes(): void {
    const setIng = new Set(this.historial.map(item => item.ingrediente));
    this.ingredientesHistorial = Array.from(setIng);
  }

  get resumen() {
    let total = this.historial.length;
    let vigentes = 0;
    let porVencer = 0;
    let vencidos = 0;

    this.historial.forEach(item => {
      const est = this.estadoDe(item);
      if (est === 'Vigente') vigentes++;
      else if (est === 'Próximo a vencer') porVencer++;
      else if (est === 'Vencido') vencidos++;
    });

    return { total, vigentes, porVencer, vencidos };
  }

  get hayFiltros(): boolean {
    return (
      this.filtroEstado !== 'Todos' ||
      this.filtroMercado !== 'Todos' ||
      this.textoFiltro.trim() !== '' ||
      this.fechaDesde !== '' ||
      this.fechaHasta !== '' ||
      this.ingredienteFiltro !== 'Todos'
    );
  }

  get historialFiltrado(): Entrega[] {
    return this.historial.filter(item => {
      if (this.filtroEstado !== 'Todos' && this.estadoDe(item) !== this.filtroEstado) return false;
      if (this.filtroMercado !== 'Todos' && item.tipoMercado !== this.filtroMercado) return false;
      if (this.ingredienteFiltro !== 'Todos' && item.ingrediente !== this.ingredienteFiltro) return false;
      if (this.fechaDesde && item.fechaRecepcion < this.fechaDesde) return false;
      if (this.fechaHasta && item.fechaRecepcion > this.fechaHasta) return false;

      if (this.textoFiltro.trim() !== '') {
        const texto = this.textoFiltro.toLowerCase();
        const coincideIngrediente = item.ingrediente.toLowerCase().includes(texto);
        const coincideTipo = item.tipoMercado.toLowerCase().includes(texto);
        if (!coincideIngrediente && !coincideTipo) return false;
      }
      return true;
    }).sort((a, b) => {
      let valA = (a as any)[this.ordenColumna];
      let valB = (b as any)[this.ordenColumna];
      if (valA < valB) return this.ordenDireccion === 'asc' ? -1 : 1;
      if (valA > valB) return this.ordenDireccion === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get historialPaginado(): Entrega[] {
    const inicio = (this.paginaActual - 1) * this.porPagina;
    return this.historialFiltrado.slice(inicio, inicio + this.porPagina);
  }

  get totalPaginas(): number {
    return Math.ceil(this.historialFiltrado.length / this.porPagina) || 1;
  }

  get desdeRegistro(): number {
    if (this.historialFiltrado.length === 0) return 0;
    return (this.paginaActual - 1) * this.porPagina + 1;
  }

  get hastaRegistro(): number {
    return Math.min(this.paginaActual * this.porPagina, this.historialFiltrado.length);
  }

  get paginasVisibles(): number[] {
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    const paginas: number[] = [];
    let inicio = Math.max(1, actual - 2);
    let fin = Math.min(total, actual + 2);

    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    return paginas;
  }

  get facturas(): FacturaGrupo[] {
    const grupos: { [fecha: string]: Entrega[] } = {};
    this.historialFiltrado.forEach(item => {
      const fecha = item.fechaRecepcion;
      if (!grupos[fecha]) grupos[fecha] = [];
      grupos[fecha].push(item);
    });

    return Object.keys(grupos).map(fecha => {
      const items = grupos[fecha];
      const alertas = items.filter(i => this.estadoDe(i) !== 'Vigente').length;
      return {
        folio: `#${fecha.replace(/-/g, '')}`,
        fecha,
        items,
        alertas
      };
    });
  }

  get filasLoteVisibles(): FilaLote[] {
    if (!this.busquedaLote.trim()) return this.filasLote;
    const q = this.busquedaLote.toLowerCase();
    return this.filasLote.filter(f => f.nombre.toLowerCase().includes(q));
  }

  get filasConCantidad(): FilaLote[] {
    return this.filasLote.filter(f => f.cantidad !== null && f.cantidad > 0);
  }

  setEstado(estado: string): void {
    this.filtroEstado = estado;
    this.paginaActual = 1;
  }

  setMercado(mercado: string): void {
    this.filtroMercado = mercado;
    this.paginaActual = 1;
  }

  limpiarFiltros(): void {
    this.filtroEstado = 'Todos';
    this.filtroMercado = 'Todos';
    this.textoFiltro = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.ingredienteFiltro = 'Todos';
    this.paginaActual = 1;
  }

  cambiarPorPagina(n: number): void {
    this.porPagina = Number(n);
    this.paginaActual = 1;
  }

  irAPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas) {
      this.paginaActual = p;
    }
  }

  ordenar(columna: string): void {
    if (this.ordenColumna === columna) {
      this.ordenDireccion = this.ordenDireccion === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenColumna = columna;
      this.ordenDireccion = 'asc';
    }
  }

  iconoOrden(columna: string): string {
    if (this.ordenColumna !== columna) return 'unfold_more';
    return this.ordenDireccion === 'asc' ? 'expand_less' : 'expand_more';
  }

  abrirModalEntrega(): void {
    this.mostrarModalEntrega = true;
    this.errorMensaje = '';
  }

  cerrarModalEntrega(): void {
    this.mostrarModalEntrega = false;
  }

  alCambiarFechaLote(nuevaFecha: string): void {
    this.fechaRecepcionLote = nuevaFecha;
  }

  guardarLote(): void {
    const itemsAProcesar = this.filasConCantidad;
    if (itemsAProcesar.length === 0) {
      this.errorMensaje = 'Debe ingresar al menos una cantidad para guardar.';
      void this.sweetAlert.warning('Atención', this.errorMensaje);
      return;
    }

    this.guardandoLote = true;
    this.errorMensaje = '';

    const usuario = this.authService.obtenerUsuario();
    const idSupervisor = usuario?.id_usuario || 1;

    let completados = 0;
    let errores = 0;

    itemsAProcesar.forEach(item => {
      const frecuenciaTexto = item.frecuenciaDias ? `${item.frecuenciaDias} días` : 'Semanal';
      const unidadTexto = item.unidad || 'Kg';
      const obsPartes = [
        `Institución: ${this.institucionLote || 'Liceo de Occidente'}`,
        `Frecuencia: ${frecuenciaTexto}`,
        `Unidad: ${unidadTexto}`
      ];

      const payload = {
        id_ingrediente: item.idIngrediente,
        id_usuario_supervisor: idSupervisor,
        id_tipo_mercado: item.idTipoMercado || (this.tiposMercado[0]?.id || 1),
        fecha_entrega: this.fechaRecepcionLote || this.fechaHoy(),
        fecha_vencimiento: item.fechaVencimiento || this.fechaRecepcionLote || this.fechaHoy(),
        cantidad: Number(item.cantidad),
        observaciones: obsPartes.join(' | ')
      };

      this.http.post(`${this.apiUrl}/entregas/`, payload).subscribe({
        next: () => {
          completados++;
          this.verificarFinLote(completados, errores, itemsAProcesar.length);
        },
        error: (err) => {
          console.error('Error guardando entrega', err);
          errores++;
          this.verificarFinLote(completados, errores, itemsAProcesar.length);
        }
      });
    });
  }

  verificarFinLote(completados: number, errores: number, total: number): void {
    if (completados + errores === total) {
      this.guardandoLote = false;
      if (errores === 0) {
        void this.sweetAlert.success(
          'Inventario guardado',
          `Se guardaron correctamente ${completados} registro(s) en el inventario.`
        );
        this.cerrarModalEntrega();
        this.filasLote.forEach(f => {
          f.cantidad = null;
          f.fechaVencimiento = '';
        });
        this.cargarHistorial();
        this.entregasService.cargar().subscribe({ error: () => {} });
      } else {
        const msg = `Se guardaron ${completados} productos, pero ${errores} fallaron al guardar.`;
        this.errorMensaje = msg;
        void this.sweetAlert.error('Error al guardar', msg);
      }
    }
  }

  toggleFactura(fecha: string): void {
    this.facturasAbiertas[fecha] = !this.facturasAbiertas[fecha];
  }

  estaAbierta(fecha: string): boolean {
    return !!this.facturasAbiertas[fecha];
  }

  diasDe(entrega: Entrega): number {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencimiento = new Date(entrega.fechaVencimiento);
    vencimiento.setHours(0, 0, 0, 0);
    const diff = vencimiento.getTime() - hoy.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  }

  estadoDe(entrega: Entrega): 'Vigente' | 'Próximo a vencer' | 'Vencido' {
    const dias = this.diasDe(entrega);
    if (dias < 0) return 'Vencido';
    if (dias <= 5) return 'Próximo a vencer';
    return 'Vigente';
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'Vigente': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'Próximo a vencer': return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'Vencido': return 'border-red-200 bg-red-50 text-red-700';
      default: return 'border-slate-200 bg-slate-50 text-slate-700';
    }
  }

  textoDias(dias: number): string {
    if (dias < 0) return `Venció hace ${Math.abs(dias)} día(s)`;
    if (dias === 0) return 'Vence hoy';
    return `Vence en ${dias} día(s)`;
  }

  fechaHoy(): string {
    return new Date().toISOString().split('T')[0];
  }

  fechaCorta(fechaStr: string): string {
    if (!fechaStr) return '';
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  fechaLarga(fechaStr: string): string {
    if (!fechaStr) return '';
    const fecha = new Date(fechaStr + 'T00:00:00');
    return fecha.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  resaltarHtml(texto: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(texto);
  }

  exportarExcelHistorial(): void {
    console.log('Exportando historial a Excel...');
  }

  trackFactura(index: number, item: FacturaGrupo): string {
    return item.fecha;
  }

  trackFila(index: number, item: Entrega): any {
    return item.id || index;
  }

  trackLote(index: number, item: FilaLote): number {
    return item.idIngrediente;
  }
}