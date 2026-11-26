import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SweetAlertService } from '../sweet-alert.service';
import { ProductoService } from '../services/producto.service';
import { AuthService } from '../core/auth/auth.service';
import { environment } from '../../environments/environment';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CustomSelectComponent } from '../shared/custom-select/custom-select';

export interface SedeInventario {
  id_sede: number;
  nombre_sede: string;
  codigo_dane?: string;
  cupos?: number;
  es_principal: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  selector: 'app-ingredientes',
  styleUrls: ['./ingredientes.css', '../banco-datos/banco-datos.css'],
  templateUrl: './ingredientes.html',
})
export class Ingredientes implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Sedes y Sede Activa (Sede Principal por defecto)
  sedes: SedeInventario[] = [];
  sedeSeleccionadaId: number | null = null;
  sedeActivaNombre: string = 'Sede Principal';

  // Pestaña activa: inventario | movimientos | gramajes
  pestanaActiva: string = 'inventario';

  // Variable para el funcionamiento de la barra de búsqueda
  filtroBusqueda: string = '';

  // Tablas principales
  inventario: any[] = [];
  itemSeleccionado: any = null;
  entradasInventario: any[] = [];
  salidasInventario: any[] = [];
  gramajes: any[] = [];

  // Categorías
  categoriasInventario: any[] = [];

  // Unidades de medida
  unidadesMedida: any[] = [];

  get unidadesMedidaOpciones(): any[] {
    return (this.unidadesMedida || []).map((u: any) => ({
      id_unidad_medida: u.id_unidad_medida,
      label: (u.nombre || u.nombre_unidad || '') + (u.abreviatura ? ` (${u.abreviatura})` : '')
    }));
  }

  // Ingredientes disponibles
  ingredientesDisponibles: any[] = [];

  mostrarFormulario = false;
  modoEdicion = false;
  modalTipo: string = 'INSUMO'; // INSUMO | ENTRADA | SALIDA
  editandoId: any = null;
  indiceEdicion: number | null = null;

  // Formulario de inventario
  itemForm: any = {
    id_inventario: null,
    id_ingrediente: '',
    cantidad_actual: null,
    stock_minimo: null,
    id_unidad_medida: ''
  };

  // Formulario de movimientos
  movimientoForm: any = {
    id_movimiento_inventario: null,
    id_ingrediente: '',
    tipo_movimiento: 'ENTRADA',
    cantidad: null,
    observaciones: '',
    id_unidad_medida: ''
  };

  // Formulario de gramajes
  gramajeForm: any = {
    id_gramaje: null,
    id_ingrediente: '',
    id_grado: 1,
    cantidad_gramaje: null,
    id_unidad_medida: '',
    descripcion: ''
  };

  private sweetAlert = inject(SweetAlertService);
  private cdr = inject(ChangeDetectorRef);
  private productoService = inject(ProductoService);

  constructor() {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    forkJoin({
      ingredientes: this.productoService.getIngredientes().pipe(catchError(() => of([]))),
      categorias: this.productoService.getCategorias().pipe(catchError(() => of([]))),
      unidades: this.productoService.getUnidades().pipe(catchError(() => of([]))),
      inventario: this.productoService.getProductos().pipe(catchError(() => of([]))),
      entradas: this.productoService.getEntradas().pipe(catchError(() => of([]))),
      salidas: this.productoService.getSalidas().pipe(catchError(() => of([]))),
      sedesRaw: this.http.get<any>(`${environment.apiUrl}/sedes/`).pipe(catchError(() => of([])))
    }).subscribe({
      next: (res: any) => {
        // Asignar catálogos
        this.ingredientesDisponibles = Array.isArray(res.ingredientes) ? res.ingredientes : (res.ingredientes.value || res.ingredientes.results || []);
        this.categoriasInventario = Array.isArray(res.categorias) ? res.categorias : (res.categorias.value || res.categorias.results || []);
        this.unidadesMedida = Array.isArray(res.unidades) ? res.unidades : (res.unidades.value || res.unidades.results || []);

        const rawInventario = Array.isArray(res.inventario) ? res.inventario : (res.inventario.value || res.inventario.results || []);
        const rawEntradas = Array.isArray(res.entradas) ? res.entradas : (res.entradas.value || res.entradas.results || []);
        const rawSalidas = Array.isArray(res.salidas) ? res.salidas : (res.salidas.value || res.salidas.results || []);

        // Procesar Sedes de la institución asignada
        const usuarioActual = this.authService.obtenerUsuario();
        const listaSedesRaw = Array.isArray(res.sedesRaw) ? res.sedesRaw : (res.sedesRaw?.results || []);
        const sedesFiltradas = listaSedesRaw.filter((s: any) => {
          if (!usuarioActual?.id_institucion) return true;
          return Number(s.id_institucion) === Number(usuarioActual.id_institucion);
        });

        const sedesProcesadas = (sedesFiltradas.length > 0 ? sedesFiltradas : listaSedesRaw).map((s: any, idx: number) => {
          const nombre = String(s.nombre_sede || s.nombre || `Sede ${s.id_sede || idx + 1}`).trim();
          const esPrincipal = nombre.toLowerCase().includes('principal') || idx === 0;
          return {
            id_sede: Number(s.id_sede ?? s.id ?? idx + 1),
            nombre_sede: nombre,
            codigo_dane: s.codigo_dane || s.dane || '11900100001',
            cupos: Number(s.cupos) || (esPrincipal ? 150 : 80),
            es_principal: esPrincipal
          };
        });

        this.sedes = sedesProcesadas.length > 0 ? sedesProcesadas : [
          { id_sede: 1, nombre_sede: 'Sede Principal', codigo_dane: '11900100001', cupos: 150, es_principal: true },
          { id_sede: 2, nombre_sede: 'Sede Norte', codigo_dane: '11900100002', cupos: 80, es_principal: false }
        ];

        // Sede Principal activa por defecto
        const principal = this.sedes.find(s => s.es_principal) || this.sedes[0];
        if (principal && this.sedeSeleccionadaId === null) {
          this.sedeSeleccionadaId = principal.id_sede;
          this.sedeActivaNombre = principal.nombre_sede;
        }

        // Mapear inventario con nombres de ingredientes, categorías, unidades y asignación de sede
        this.inventario = rawInventario.map((inv: any, idx: number) => {
          const ing = this.ingredientesDisponibles.find(i => i.id_ingrediente == inv.id_ingrediente);
          const cat = ing ? this.categoriasInventario.find(c => c.id_categoria_inventario == ing.id_categoria_inventario) : null;
          const um = this.unidadesMedida.find(u => u.id_unidad_medida == inv.id_unidad_medida);

          // Asignación de sede consistente: si no trae id_sede, por defecto asignado a Sede Principal
          const idSedeItem = inv.id_sede != null ? Number(inv.id_sede) : (principal ? principal.id_sede : 1);
          const sedeItemObj = this.sedes.find(s => s.id_sede === idSedeItem);

          return {
            ...inv,
            id_sede: idSedeItem,
            nombre_sede: sedeItemObj ? sedeItemObj.nombre_sede : 'Sede Principal',
            nombre_ingrediente: ing ? ing.nombre_ingrediente : (inv.nombre_ingrediente || 'Insumo PAE'),
            marca_ingrediente: ing ? ing.marca_ingrediente : (inv.marca_ingrediente || 'Oficial'),
            nombre_categoria: cat ? cat.nombre_categoria : (inv.nombre_categoria || 'Víveres'),
            nombre_unidad: um ? (um.nombre || um.nombre_unidad) : (inv.nombre_unidad || 'Unidad')
          };
        });

        // Guardar entradas y salidas
        this.entradasInventario = rawEntradas;
        this.salidasInventario = rawSalidas;

        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando los datos del módulo productos:', err)
    });
  }

  // Filtrar inventario por la Sede seleccionada
  get inventarioPorSede(): any[] {
    if (this.sedeSeleccionadaId === null) {
      return this.inventario;
    }
    return this.inventario.filter(item => {
      if (item.id_sede != null) {
        return Number(item.id_sede) === Number(this.sedeSeleccionadaId);
      }
      const actual = this.sedes.find(s => s.id_sede === this.sedeSeleccionadaId);
      return !!actual?.es_principal;
    });
  }

  // Resumen KPI de alertas de stock para la sede activa
  get resumenAlertas() {
    const items = this.inventarioPorSede;
    const optimos = items.filter(i => {
      const c = Number(i.cantidad_actual) || 0;
      const m = Number(i.stock_minimo) || 10;
      return c > m;
    }).length;
    const bajos = items.filter(i => {
      const c = Number(i.cantidad_actual) || 0;
      const m = Number(i.stock_minimo) || 10;
      return c > 0 && c <= m;
    }).length;
    const agotados = items.filter(i => (Number(i.cantidad_actual) || 0) <= 0).length;
    return {
      total: items.length,
      optimos,
      bajos,
      agotados
    };
  }

  // Función para conmutar entre sedes desde las píldoras
  filtrarPorSede(idSede: number | null): void {
    this.sedeSeleccionadaId = idSede;
    if (idSede === null) {
      this.sedeActivaNombre = 'Todas las Sedes';
    } else {
      const encontrada = this.sedes.find(s => s.id_sede === idSede);
      this.sedeActivaNombre = encontrada ? encontrada.nombre_sede : 'Sede';
    }
    this.cdr.detectChanges();
  }

  // Estado y color de alerta de stock para cada fila
  obtenerEstadoStock(item: any): { texto: string; clase: 'ok' | 'low' | 'critico' } {
    const c = Number(item.cantidad_actual) || 0;
    const m = Number(item.stock_minimo) || 10;
    if (c <= 0) {
      return { texto: 'Agotado', clase: 'critico' };
    }
    if (c <= m) {
      return { texto: 'Stock bajo', clase: 'low' };
    }
    return { texto: 'Óptimo', clase: 'ok' };
  }

  // Getters para el filtrado en tiempo real según la pestaña y texto ingresado
  get inventarioFiltrado() {
    const base = this.inventarioPorSede;
    if (!(this.filtroBusqueda || '').trim()) return base;
    const texto = this.filtroBusqueda.toLowerCase();
    return base.filter(item =>
      item.nombre_ingrediente?.toLowerCase().includes(texto) ||
      item.nombre_categoria?.toLowerCase().includes(texto) ||
      item.marca_ingrediente?.toLowerCase().includes(texto)
    );
  }

  get movimientosFiltrados() {
    const mapearMov = (m: any, tipo: 'ENTRADA' | 'SALIDA') => {
      const idIng = typeof m.id_ingrediente === 'object' ? m.id_ingrediente?.id_ingrediente : m.id_ingrediente;
      const ing = this.ingredientesDisponibles.find(i => Number(i.id_ingrediente) === Number(idIng));
      return {
        ...m,
        tipo_movimiento: tipo,
        nombre_ingrediente: m.ingrediente_nombre || ing?.nombre_ingrediente || 'Insumo',
        cantidad: Number(m.cantidad ?? m.cantidad_salida ?? 0),
        fecha_movimiento: m.fecha || m.fecha_creacion || ''
      };
    };

    const combinados = [
      ...(this.entradasInventario || []).map(e => mapearMov(e, 'ENTRADA')),
      ...(this.salidasInventario || []).map(s => mapearMov(s, 'SALIDA')),
    ].sort((a, b) => String(b.fecha_movimiento).localeCompare(String(a.fecha_movimiento)));

    if (!(this.filtroBusqueda || '').trim()) return combinados;
    const texto = this.filtroBusqueda.toLowerCase();
    return combinados.filter(mov =>
      mov.nombre_ingrediente?.toLowerCase().includes(texto) ||
      mov.tipo_movimiento?.toLowerCase().includes(texto) ||
      mov.observaciones?.toLowerCase().includes(texto)
    );
  }

  get gramajesFiltrados() {
    if (!(this.filtroBusqueda || '').trim()) return this.gramajes;
    const texto = this.filtroBusqueda.toLowerCase();
    return this.gramajes.filter(gram =>
      gram.nombre_ingrediente?.toLowerCase().includes(texto) ||
      gram.descripcion?.toLowerCase().includes(texto)
    );
  }

  seleccionarPestana(pestana: string): void {
    this.pestanaActiva = pestana;
    this.filtroBusqueda = ''; // Limpia la búsqueda al cambiar de pestaña
    this.cerrarFormulario();
    this.cerrarDetalles();
    this.cdr.detectChanges();
  }

  cambiarPestana(pestana: string): void {
    this.seleccionarPestana(pestana);
  }

  verDetalles(item: any): void {
    this.cerrarFormulario();
    this.itemSeleccionado = item;
  }

  cerrarDetalles(): void {
    this.itemSeleccionado = null;
  }

  abrirFormulario(item: any = null): void {
    this.cerrarDetalles();
    this.mostrarFormulario = true;
    this.modalTipo = 'INSUMO';

    if (item) {
      this.modoEdicion = true;
      this.editandoId = true;
      this.indiceEdicion = this.inventario.indexOf(item);
      this.itemForm = { ...item };
    } else {
      this.modoEdicion = false;
      this.editandoId = null;
      this.indiceEdicion = null;
      this.limpiarFormularios();
    }
    this.cdr.detectChanges();
  }

  abrirModalMovimiento(tipo: string): void {
    this.cerrarDetalles();
    this.mostrarFormulario = true;
    this.modalTipo = tipo;
    this.modoEdicion = false;
    this.limpiarFormularios();
    this.movimientoForm.tipo_movimiento = tipo;
    this.cdr.detectChanges();
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.modoEdicion = false;
    this.editandoId = null;
    this.indiceEdicion = null;
    this.limpiarFormularios();
    this.cdr.detectChanges();
  }

  limpiarFormularios(): void {
    this.itemForm = {
      id_inventario: null,
      id_ingrediente: '',
      cantidad_actual: null,
      stock_minimo: null,
      id_unidad_medida: ''
    };

    this.movimientoForm = {
      id_movimiento_inventario: null,
      id_ingrediente: '',
      tipo_movimiento: 'ENTRADA',
      cantidad: null,
      observaciones: '',
      id_unidad_medida: ''
    };

    this.gramajeForm = {
      id_gramaje: null,
      id_ingrediente: '',
      id_grado: 1,
      cantidad_gramaje: null,
      id_unidad_medida: '',
      descripcion: ''
    };
  }

  guardarInventario(): void {
    const usuarioSesion = this.authService?.obtenerUsuario?.()
      || (() => { try { return JSON.parse(localStorage.getItem('usuario') || 'null'); } catch { return null; } })();
    const instUsuario = usuarioSesion?.id_institucion ?? null;
    const sedeUsuario = usuarioSesion?.id_sede ?? null;

    if (this.modalTipo === 'INSUMO') {
      if (!this.itemForm.id_ingrediente || this.itemForm.cantidad_actual === null) {
        this.sweetAlert.warning('Campos incompletos', 'Llene los campos obligatorios del inventario.');
        return;
      }

      const ingSeleccionado = this.ingredientesDisponibles.find(
        i => Number(i.id_ingrediente) === Number(this.itemForm.id_ingrediente)
      );
      const unidadFallback = ingSeleccionado?.id_unidad_medida
        || (this.unidadesMedida.length > 0 ? this.unidadesMedida[0].id_unidad_medida : 1);

      const payloadInsumo: any = {
        id_ingrediente: Number(this.itemForm.id_ingrediente),
        cantidad_actual: Number(this.itemForm.cantidad_actual),
        stock_minimo: Number(this.itemForm.stock_minimo ?? 0),
        id_unidad_medida: Number(this.itemForm.id_unidad_medida || unidadFallback),
      };

      if (this.modoEdicion && this.itemForm.id_inventario) {
        if (this.itemForm.id_institucion) payloadInsumo.id_institucion = this.itemForm.id_institucion;
        else if (instUsuario) payloadInsumo.id_institucion = instUsuario;
        if (this.itemForm.id_sede) payloadInsumo.id_sede = this.itemForm.id_sede;

        this.productoService.actualizarProducto(this.itemForm.id_inventario, payloadInsumo).subscribe({
          next: () => {
            this.sweetAlert.success('Actualizado', 'Insumo modificado con éxito.');
            this.cargarDatos();
            this.cerrarFormulario();
          },
          error: () => this.sweetAlert.error('Error', 'No se pudo actualizar el inventario.')
        });
      } else {
        if (instUsuario) payloadInsumo.id_institucion = instUsuario;
        if (sedeUsuario) payloadInsumo.id_sede = sedeUsuario;

        this.productoService.crearProducto(payloadInsumo).subscribe({
          next: () => {
            this.sweetAlert.success('Guardado', 'Nuevo insumo agregado al inventario.');
            this.cargarDatos();
            this.cerrarFormulario();
          },
          error: () => this.sweetAlert.error('Error', 'No se pudo crear el insumo.')
        });
      }
    } else if (this.modalTipo === 'ENTRADA' || this.modalTipo === 'SALIDA') {
      if (!this.movimientoForm.id_ingrediente || !this.movimientoForm.cantidad) {
        this.sweetAlert.warning('Campos incompletos', 'Complete los datos del movimiento.');
        return;
      }

      const id_usuario = usuarioSesion?.id_usuario || usuarioSesion?.id || 1;
      const invItem = this.inventario.find(i => Number(i.id_ingrediente) === Number(this.movimientoForm.id_ingrediente));

      if (!invItem && this.modalTipo === 'SALIDA') {
        this.sweetAlert.warning(
          'Insumo no encontrado',
          'Este ingrediente aún no está en el inventario. Agrégalo primero como nuevo insumo.'
        );
        return;
      }

      const id_unidad_medida = invItem?.id_unidad_medida ?? (this.unidadesMedida.length > 0 ? this.unidadesMedida[0].id_unidad_medida : 1);
      const cantidadMov = Number(this.movimientoForm.cantidad);
      const stockActual = Number(invItem?.cantidad_actual) || 0;
      const nuevoStock = this.modalTipo === 'ENTRADA' ? stockActual + cantidadMov : stockActual - cantidadMov;

      if (this.modalTipo === 'SALIDA' && nuevoStock < 0) {
        this.sweetAlert.warning('Stock Insuficiente', 'No puedes retirar más de lo que hay en inventario.');
        return;
      }

      if (this.modalTipo === 'ENTRADA') {
        const payload = {
          id_inventario: invItem?.id_inventario ?? null,
          id_ingrediente: Number(this.movimientoForm.id_ingrediente),
          cantidad: cantidadMov,
          id_unidad_medida,
          observaciones: this.movimientoForm.observaciones || '',
          id_usuario
        };

        this.productoService.crearEntrada(payload).subscribe({
          next: () => {
            this.sweetAlert.success('Completado', 'Entrada registrada e inventario actualizado correctamente.');
            this.cargarDatos();
            this.cerrarFormulario();
          },
          error: (err) => {
            const msg = err?.error?.cantidad?.[0] || err?.error?.detail || 'No se pudo registrar la entrada en el servidor.';
            this.sweetAlert.error('Error', msg);
          }
        });
      } else {
        const payload = {
          id_inventario: invItem?.id_inventario ?? null,
          id_ingrediente: Number(this.movimientoForm.id_ingrediente),
          cantidad_salida: cantidadMov,
          cantidad: cantidadMov,
          id_unidad_medida,
          observaciones: this.movimientoForm.observaciones || '',
          id_usuario
        };

        this.productoService.crearSalida(payload).subscribe({
          next: () => {
            this.sweetAlert.success('Completado', 'Salida registrada e inventario descontado correctamente.');
            this.cargarDatos();
            this.cerrarFormulario();
          },
          error: (err) => {
            const msg = err?.error?.cantidad?.[0] || err?.error?.id_ingrediente?.[0] || err?.error?.detail || 'No se pudo registrar la salida en el servidor.';
            this.sweetAlert.error('Error', msg);
          }
        });
      }
    }
  }

  // Método auxiliar para garantizar la actualización del stock
  private actualizarStockDirecto(invItem: any, nuevoStock: number): void {
    if (invItem && invItem.id_inventario) {
      const payloadInventario = {
        id_ingrediente: invItem.id_ingrediente,
        cantidad_actual: nuevoStock.toString(),
        stock_minimo: (invItem.stock_minimo ?? 0).toString(),
        id_unidad_medida: invItem.id_unidad_medida
      };
      this.productoService.actualizarProducto(invItem.id_inventario, payloadInventario).subscribe({
        next: () => {
          this.sweetAlert.success('Completado', 'Inventario actualizado correctamente.');
          this.cargarDatos();
          this.cerrarFormulario();
        },
        error: () => {
          this.sweetAlert.error('Error', 'Se registró el movimiento pero falló la actualización visual.');
          this.cargarDatos();
          this.cerrarFormulario();
        }
      });
    } else {
      this.sweetAlert.success('Registrado', 'Movimiento registrado con éxito.');
      this.cargarDatos();
      this.cerrarFormulario();
    }
  }

  eliminarItem(lista: any[], item: any): void {
    this.sweetAlert.confirm('¿Eliminar?', '¿Desea eliminar este registro?', 'Sí, eliminar').then((res: any) => {
      if (res.isConfirmed) {
        if (this.pestanaActiva === 'inventario') {
          this.productoService.eliminarProducto(item.id_inventario).subscribe({
            next: () => {
              this.sweetAlert.success('Eliminado', 'El registro fue borrado.');
              this.cargarDatos();
            },
            error: () => this.sweetAlert.error('Error', 'No se pudo eliminar el inventario.')
          });
        } else if (this.pestanaActiva === 'movimientos') {
          // Actualmente los movimientos no se listan en el HTML principal
        } else {
          // gramajes simulado
          const index = lista.indexOf(item);
          if (index > -1) {
            lista.splice(index, 1);
          }
          this.sweetAlert.success('Eliminado', 'Registro borrado con éxito.');
          this.cdr.detectChanges();
        }
      }
    });
  }
}