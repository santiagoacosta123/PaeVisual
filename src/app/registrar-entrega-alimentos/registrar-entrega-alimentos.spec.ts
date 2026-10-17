import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

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
  tiposMercado: { id: number; nombre: string }[] = [];
  instituciones: string[] = ['Institución Principal', 'Sede A', 'Sede B'];

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

  institucionLote: string = this.instituciones[0];
  fechaRecepcionLote: string = this.fechaHoy();
  busquedaLote: string = '';
  filasLote: FilaLote[] = [];

  filasEsqueleto = [1, 2, 3, 4, 5];
  columnasEsqueleto = [1, 2, 3, 4, 5, 6];

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.cargarHistorial();
    this.cargarCatalogos();
  }

  cargarHistorial(): void {
    this.cargandoHistorial = true;
    this.errorHistorial = false;
    
    setTimeout(() => {
      this.cargandoHistorial = false;
      this.historial = [];
      this.actualizarFiltrosIngredientes();
    }, 600);
  }

  cargarCatalogos(): void {
    this.cargandoCatalogos = true;
    setTimeout(() => {
      this.cargandoCatalogos = false;
      this.tiposMercado = [
        { id: 1, nombre: 'Perecedero' },
        { id: 2, nombre: 'No perecedero' }
      ];
      this.inicializarFilasLote();
    }, 500);
  }

  inicializarFilasLote(): void {
    this.filasLote = [
      { idIngrediente: 1, nombre: 'Arroz', tieneHistorial: true, cantidad: null, unidad: 'Kg', fechaVencimiento: '', idTipoMercado: 2, frecuenciaDias: 15 },
      { idIngrediente: 2, nombre: 'Tomate', tieneHistorial: true, cantidad: null, unidad: 'Kg', fechaVencimiento: '', idTipoMercado: 1, frecuenciaDias: 7 },
      { idIngrediente: 3, nombre: 'Pollo', tieneHistorial: false, cantidad: null, unidad: 'Kg', fechaVencimiento: '', idTipoMercado: 1, frecuenciaDias: 7 }
    ];
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
    this.guardandoLote = true;
    this.errorMensaje = '';

    setTimeout(() => {
      this.guardandoLote = false;
      this.cerrarModalEntrega();
      this.cargarHistorial();
    }, 1000);
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