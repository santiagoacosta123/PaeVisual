import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PlatosService } from '../services/platos.service';
import { SeccionesMenuService } from '../services/secciones-menu.service';
import { DetallePlatosService } from '../services/detalle-platos.service';
import { MenusService } from '../services/menus.service';
import { SiraeService } from '../services/contratos_pae.service';
import { AuthService } from '../services/auth.service';
import { SweetAlertService } from '../sweet-alert.service';
import { CustomSelectComponent } from '../shared/custom-select/custom-select';

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './menus.html',
  styleUrls: ['./menus.css']
})
export class MenusComponent implements OnInit {
  pestanaActiva: string = 'menus';

  // ---------- Datos Principales ----------
  menus: any[] = [];
  platos: any[] = [];
  preparacionesAsignadas: any[] = [];
  seccionesMenu: any[] = [];

  // ---------- Detalle de Platos ----------
  platoSeleccionado: any = null;
  mostrarDetallePlato: boolean = false;
  detallesPlato: any[] = [];

  // ---------- Filtros y Búsqueda ----------
  filtroTexto: string = '';
  seccionSel: string = 'Todas';
  fechaDesde: string = '';
  fechaHasta: string = '';
  filtrosAplicados = { texto: '', seccion: 'Todas', desde: '', hasta: '' };

  // ---------- Paginación ----------
  paginaActual: number = 1;
  porPagina: number = 10;

  // ---------- Catálogos Auxiliares ----------
  jornadas: any[] = [];
  contratos: any[] = [];
  usuariosManipuladoras: any[] = [];
  esJefa = false;
  esAdministrador = false;
  cargandoMenus = false;

  get contratosOpciones(): any[] {
    return (this.contratos || []).map((c: any) => ({
      id_contrato: c.id_contrato,
      label: `${c.numero_cor || ''} - ${c.institucion || ''}`
    }));
  }

  get menusOpciones(): any[] {
    return (this.menus || []).map((m: any) => ({
      id_menu: m.id_menu,
      label: `Menú #${m.id_menu} (${m.fecha || ''})`
    }));
  }

  get detalleMenusOpciones(): any[] {
    return (this.menus || []).map((m: any) => ({
      id_menu: m.id_menu,
      label: `${m.fecha || ''} - ${m.nombre_jornada || ''} - ${m.institucion || ''}`
    }));
  }

  // ---------- Modales y Formularios ----------
  mostrarFormulario: boolean = false;
  esEdicion: boolean = false;

  menuForm: any = {
    id_menu: null, id_jornada: '', fecha: '', ninos_presentes: null,
    estado: 'ACTIVO', informacion_nutricional: '', id_contrato: ''
  };

  platoForm: any = {
    id_plato: null, id_seccion: '', nombre_plato: '', componente: ''
  };

  preparacionForm: any = {
    id_preparacion_asignada: null, id_menu: '', id_plato: '',
    id_usuario_manipuladora: '', fecha: '', hora_programada: '',
    estado_preparacion: 'PENDIENTE', observaciones: ''
  };

  detalleForm: any = {
    id_detalle_plato: null, id_menu: '', id_plato: '',
    porcion_por_nino: null, total_a_preparar: null,
    unidad_total: '', estado_preparacion: 'Pendiente'
  };  constructor(
    private platosService: PlatosService,
    private seccionesService: SeccionesMenuService,
    private detallesService: DetallePlatosService,
    private menusService: MenusService,
    private catalogosService: SiraeService,
    private authService: AuthService,
    private sweetAlert: SweetAlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const rol = this.authService.obtenerUsuario()?.rol;
    this.esJefa = this.authService.esJefa(rol);
    const rolNorm = this.authService.normalizarRol(rol);
    this.esAdministrador = ['admin', 'administrador', 'superadmin', 'super administrador', 'superadministrador'].includes(rolNorm);
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargandoMenus = true;
    forkJoin({
      menus: this.menusService.listar(),
      jornadas: this.catalogosService.getJornadas(),
      contratos: this.catalogosService.getContratos(),
    }).subscribe({
      next: ({ menus, jornadas, contratos }) => {
        this.jornadas = jornadas;
        this.contratos = contratos;
        this.menus = menus.map(menu => ({
          ...menu,
          nombre_jornada: jornadas.find(j => Number(j.id_jornada) === menu.id_jornada)?.nombre_jornada || `Jornada ${menu.id_jornada}`,
          institucion: contratos.find(c => Number(c.id_contrato) === menu.id_contrato)?.institucion || `Contrato ${menu.id_contrato}`,
        }));
        this.cargandoMenus = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar menús y catálogos:', error);
        this.cargandoMenus = false;
        this.cdr.detectChanges();
        void this.sweetAlert.error(
          'No se pudieron cargar los menús',
          error.status === 403
            ? 'Tu usuario no tiene permiso para consultar este módulo.'
            : 'Verifica la conexión e intenta nuevamente.',
        );
      },
    });

    this.platosService.getPlatos().subscribe({
      next: (data) => {
        this.platos = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar platos:', err);
        void this.sweetAlert.error('No se pudo cargar el catálogo de platos', 'Verifica tu sesión y vuelve a intentarlo.');
      },
    });

    this.seccionesService.getSecciones().subscribe({
      next: (data) => {
        this.seccionesMenu = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar secciones de menú:', err);
        void this.sweetAlert.error('No se pudieron cargar las secciones', 'Verifica la conexión e intenta nuevamente.');
      },
    });
  }

  cambiarPestana(pestana: string): void {
    if (this.esJefa && !['menus', 'platos'].includes(pestana)) return;
    if (pestana === 'preparaciones') return;
    this.pestanaActiva = pestana;
    this.cdr.detectChanges();
  } pestana;
    this.paginaActual = 1;
    this.limpiarFiltros();
    this.cerrarFormulario();
    this.cerrarDetalle();
  }

  // =====================================================
  //  FILTROS Y BÚSQUEDA
  // =====================================================
  aplicarBusqueda(): void {
    this.filtrosAplicados = {
      texto: this.filtroTexto,
      seccion: this.seccionSel,
      desde: this.fechaDesde,
      hasta: this.fechaHasta
    };
    this.paginaActual = 1;
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.seccionSel = 'Todas';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.aplicarBusqueda();
  }

  get itemsFiltrados(): any[] {
    const f = this.filtrosAplicados;
    const texto = f.texto.trim().toLowerCase();

    if (this.pestanaActiva === 'menus') {
      return this.menus.filter(m => {
        if (texto && !m.nombre_jornada.toLowerCase().includes(texto) && !m.institucion.toLowerCase().includes(texto)) return false;
        if (f.desde && m.fecha < f.desde) return false;
        if (f.hasta && m.fecha > f.hasta) return false;
        return true;
      });
    }

    if (this.pestanaActiva === 'platos') {
      return this.platos.filter(p => {
        if (f.seccion !== 'Todas' && String(p.id_seccion) !== String(f.seccion)) return false;
        if (texto && !p.nombre_plato.toLowerCase().includes(texto) && !(p.componente || '').toLowerCase().includes(texto)) return false;
        return true;
      });
    }

    if (this.pestanaActiva === 'preparaciones') {
      return this.preparacionesAsignadas.filter(p => {
        if (texto && !p.nombre_plato.toLowerCase().includes(texto) && !p.manipuladora.toLowerCase().includes(texto)) return false;
        if (f.desde && p.fecha < f.desde) return false;
        if (f.hasta && p.fecha > f.hasta) return false;
        return true;
      });
    }

    return [];
  }

  // =====================================================
  //  PAGINACIÓN
  // =====================================================
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.itemsFiltrados.length / this.porPagina));
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  get itemsPaginados(): any[] {
    if (this.paginaActual > this.totalPaginas) this.paginaActual = this.totalPaginas;
    const inicio = (this.paginaActual - 1) * this.porPagina;
    return this.itemsFiltrados.slice(inicio, inicio + this.porPagina);
  }

  get desdeRegistro(): number {
    return this.itemsFiltrados.length === 0 ? 0 : (this.paginaActual - 1) * this.porPagina + 1;
  }

  get hastaRegistro(): number {
    return Math.min(this.paginaActual * this.porPagina, this.itemsFiltrados.length);
  }

  irAPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas) this.paginaActual = p;
  }

  // =====================================================
  //  FORMULARIOS Y MODALES
  // =====================================================
  abrirFormulario(): void {
    if (this.esJefa && this.pestanaActiva !== 'menus') return;
    this.esEdicion = false;
    this.resetFormularios();
    this.mostrarFormulario = true;
    this.cdr.detectChanges();
  }

  abrirEdicion(item: any): void {
    if (this.esJefa && this.pestanaActiva !== 'menus') return;
    this.esEdicion = true;
    if (this.pestanaActiva === 'menus') {
      this.menuForm = { ...item };
    } else if (this.pestanaActiva === 'platos') {
      this.platoForm = { ...item };
    } else if (this.pestanaActiva === 'preparaciones') {
      this.preparacionForm = { ...item };
    }
    this.mostrarFormulario = true;
    this.cdr.detectChanges();
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.resetFormularios();
    this.cdr.detectChanges();
  }

  resetFormularios(): void {
    this.menuForm = { id_menu: null, id_jornada: '', fecha: '', ninos_presentes: null, estado: 'ACTIVO', informacion_nutricional: '', id_contrato: '' };
    this.platoForm = { id_plato: null, id_seccion: '', nombre_plato: '', componente: '' };
    this.preparacionForm = { id_preparacion_asignada: null, id_menu: '', id_plato: '', id_usuario_manipuladora: '', fecha: '', hora_programada: '', estado_preparacion: 'PENDIENTE', observaciones: '' };
  }

  guardarTodo(): void {
    if (this.pestanaActiva === 'menus') {
      const idJornada = Number(this.menuForm.id_jornada);
      const idContrato = Number(this.menuForm.id_contrato);
      const ninosPresentes = Number(this.menuForm.ninos_presentes);
      if (!idJornada || !idContrato || !this.menuForm.fecha || !Number.isInteger(ninosPresentes) || ninosPresentes < 0) {
        void this.sweetAlert.warning('Revisa los datos', 'Selecciona jornada, contrato, fecha y una cantidad válida de niños presentes.');
        return;
      }
      const payload = {
        id_jornada: idJornada,
        fecha: this.menuForm.fecha,
        ninos_presentes: ninosPresentes,
        estado: this.menuForm.estado,
        informacion_nutricional: this.menuForm.informacion_nutricional || '',
        id_contrato: idContrato,
      };
      const request = this.esEdicion
        ? this.menusService.actualizar(Number(this.menuForm.id_menu), payload)
        : this.menusService.crear(payload);
      request.subscribe({
        next: () => {
          void this.sweetAlert.success(
            this.esEdicion ? 'Menú actualizado' : 'Menú creado',
            this.esEdicion ? 'El menú fue actualizado correctamente.' : 'El menú quedó registrado.',
          );
          this.cerrarFormulario();
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al guardar menú:', error);
          void this.sweetAlert.error('No se pudo guardar el menú', 'Verifica los campos y vuelve a intentarlo.');
        },
      });

    } else if (this.pestanaActiva === 'platos') {
      if (!this.esAdministrador) return;
      if (this.esEdicion) {
        this.platosService.updatePlato(this.platoForm.id_plato, this.platoForm).subscribe({
          next: () => {
            this.sweetAlert.success('Plato actualizado', 'Se actualizó el plato con éxito.');
            this.cargarDatos();
            this.cerrarFormulario();
          },
          error: () => this.sweetAlert.error('Error', 'No se pudo actualizar el plato.')
        });
      } else {
        this.platosService.createPlato(this.platoForm).subscribe({
          next: () => {
            this.sweetAlert.success('Plato creado', 'El plato fue registrado.');
            this.cargarDatos();
            this.cerrarFormulario();
          },
          error: (err) => {
            console.error('Error al crear plato:', err);
            this.sweetAlert.error('Error', 'No se pudo registrar el plato. ' + (err.status === 404 ? 'API no encontrada (404)' : 'Revisa la consola.'));
          }
        });
      }

    } else if (this.pestanaActiva === 'preparaciones') {
      const menuObj = this.menus.find(m => m.id_menu == this.preparacionForm.id_menu);
      const platoObj = this.platos.find(p => p.id_plato == this.preparacionForm.id_plato);
      const manipObj = this.usuariosManipuladoras.find(u => u.id_usuario_manipuladora == this.preparacionForm.id_usuario_manipuladora);

      if (this.esEdicion) {
        const index = this.preparacionesAsignadas.findIndex(p => p.id_preparacion_asignada === this.preparacionForm.id_preparacion_asignada);
        if (index !== -1) {
          this.preparacionesAsignadas[index] = {
            ...this.preparacionForm,
            nombre_menu: menuObj ? `Menú #${menuObj.id_menu}` : '',
            nombre_plato: platoObj?.nombre_plato || 'Plato',
            manipuladora: manipObj?.nombre || 'Manipuladora'
          };
        }
        this.sweetAlert.success('Preparación actualizada', 'Se actualizó la asignación.');
      } else {
        const nuevaPrep = {
          ...this.preparacionForm,
          id_preparacion_asignada: Date.now(),
          nombre_menu: menuObj ? `Menú #${menuObj.id_menu}` : '',
          nombre_plato: platoObj?.nombre_plato || 'Plato',
          manipuladora: manipObj?.nombre || 'Manipuladora'
        };
        this.preparacionesAsignadas.push(nuevaPrep);
        this.sweetAlert.success('Preparación asignada', 'Se registró la nueva preparación.');
      }
      this.cerrarFormulario();
    }
  }

  eliminarItem(lista: any[], item: any): void {
    if (this.esJefa && this.pestanaActiva === 'platos') return;
    if (this.pestanaActiva === 'menus') {
      void this.sweetAlert.confirm('¿Eliminar menú?', 'Esta acción no se puede deshacer.', 'Eliminar').then(result => {
        if (!result.isConfirmed) return;
        this.menusService.eliminar(Number(item.id_menu)).subscribe({
          next: () => {
            this.menus = this.menus.filter(menu => menu.id_menu !== item.id_menu);
            void this.sweetAlert.success('Menú eliminado', 'El menú fue eliminado correctamente.');
          },
          error: (error) => {
            console.error('Error al eliminar menú:', error);
            void this.sweetAlert.error('No se pudo eliminar', 'Verifica si el menú tiene registros asociados.');
          },
        });
      });
    } else if (this.pestanaActiva === 'platos') {
      this.sweetAlert.confirm('¿Eliminar plato?', 'Esta acción no se puede deshacer.', 'Eliminar').then(res => {
        if (res.isConfirmed) {
          this.platosService.deletePlato(item.id_plato).subscribe({
            next: () => {
              this.sweetAlert.success('Eliminado', 'Plato eliminado correctamente.');
              this.cargarDatos();
            }
          });
        }
      });
    } else {
      this.sweetAlert.confirm('¿Eliminar registro?', 'Esta acción quitará el elemento.', 'Sí, eliminar').then(res => {
        if (res.isConfirmed) {
          const index = lista.indexOf(item);
          if (index > -1) {
            lista.splice(index, 1);
            this.sweetAlert.success('Eliminado', 'Registro eliminado correctamente.');
          }
        }
      });
    }
  }

  // =====================================================
  //  CRUD DETALLE PLATO
  // =====================================================
  abrirDetalle(plato: any): void {
    this.platoSeleccionado = plato;
    this.mostrarDetallePlato = true;
    this.detalleForm = {
      id_detalle_plato: null, id_menu: '', id_plato: plato.id_plato,
      porcion_por_nino: null, total_a_preparar: null,
      unidad_total: '', estado_preparacion: 'Pendiente'
    };
    this.cargarDetallesPlato(plato.id_plato);
  }

  cerrarDetalle(): void {
    this.mostrarDetallePlato = false;
    this.platoSeleccionado = null;
  }

  cargarDetallesPlato(idPlato: number): void {
    this.detallesService.getDetalles().subscribe({
      next: (data) => {
        this.detallesPlato = data.filter((d: any) => Number(d.id_plato) === idPlato);
      },
      error: (error) => {
        console.error('Error al cargar los detalles del plato:', error);
        void this.sweetAlert.error('No se cargaron las porciones', 'Verifica la conexión y vuelve a intentarlo.');
      },
    });
  }

  guardarDetalle(): void {
    const total = this.detalleForm.total_a_preparar === '' || this.detalleForm.total_a_preparar == null
      ? Number.NaN
      : Number(this.detalleForm.total_a_preparar);
    const porcion = this.detalleForm.porcion_por_nino === '' || this.detalleForm.porcion_por_nino == null
      ? Number.NaN
      : Number(this.detalleForm.porcion_por_nino);
    if (!Number(this.detalleForm.id_menu) || !Number.isFinite(total) || total <= 0
      || !Number.isFinite(porcion) || porcion <= 0 || !this.detalleForm.unidad_total) {
      void this.sweetAlert.warning(
        'Completa los datos del plato',
        'Selecciona un menú e indica una porción, el total a preparar y su unidad.',
      );
      return;
    }
    this.detalleForm.id_plato = this.platoSeleccionado.id_plato;
    this.detalleForm.porcion_por_nino = porcion;
    this.detalleForm.total_a_preparar = total;
    this.detallesService.createDetalle(this.detalleForm).subscribe({
      next: () => {
        this.sweetAlert.success('Detalle agregado', 'Se agregó el detalle al plato.');
        this.cargarDetallesPlato(this.platoSeleccionado.id_plato);
        this.detalleForm = {
          id_detalle_plato: null, id_menu: '', id_plato: this.platoSeleccionado.id_plato,
          porcion_por_nino: null, total_a_preparar: null,
          unidad_total: '', estado_preparacion: 'Pendiente'
        };
      },
      error: () => this.sweetAlert.error('Error', 'No se pudo agregar el detalle.')
    });
  }

  eliminarDetalle(id: number): void {
    this.sweetAlert.confirm('¿Eliminar detalle?', 'Se quitará del plato.', 'Sí, eliminar').then(res => {
      if (res.isConfirmed) {
        this.detallesService.deleteDetalle(id).subscribe({
          next: () => {
            this.sweetAlert.success('Eliminado', 'Detalle eliminado.');
            this.cargarDetallesPlato(this.platoSeleccionado.id_plato);
          },
          error: (error) => {
            console.error('Error al eliminar el detalle del plato:', error);
            void this.sweetAlert.error('No se pudo eliminar', 'Verifica tus permisos e intenta nuevamente.');
          },
        });
      }
    });
  }

  getNombreSeccion(id_seccion: number): string {
    if (!id_seccion) return 'General';
    const sec = this.seccionesMenu.find(s => s.id_seccion === id_seccion);
    return sec ? sec.nombre_seccion : 'General';
  }

  // =====================================================
  //  EXPORTAR A EXCEL
  // =====================================================
  exportarExcel(): void {
    if (this.itemsFiltrados.length === 0) {
      alert('No hay registros para exportar.');
      return;
    }

    let filasHtml = '';
    let encabezadoHtml = '';

    if (this.pestanaActiva === 'menus') {
      encabezadoHtml = `<tr><th>ID</th><th>Fecha</th><th>Jornada</th><th>Institución</th><th>Niños</th><th>Estado</th></tr>`;
      filasHtml = this.itemsFiltrados.map(m => `
        <tr>
          <td>${m.id_menu}</td>
          <td>${m.fecha}</td>
          <td>${m.nombre_jornada}</td>
          <td>${m.institucion}</td>
          <td>${m.ninos_presentes}</td>
          <td>${m.estado}</td>
        </tr>`).join('');
    } else if (this.pestanaActiva === 'platos') {
      encabezadoHtml = `<tr><th>ID</th><th>Plato</th><th>Sección</th><th>Componente</th></tr>`;
      filasHtml = this.itemsFiltrados.map(p => `
        <tr>
          <td>${p.id_plato}</td>
          <td>${p.nombre_plato}</td>
          <td>${this.getNombreSeccion(p.id_seccion)}</td>
          <td>${p.componente || 'N/A'}</td>
        </tr>`).join('');
    } else {
      encabezadoHtml = `<tr><th>ID</th><th>Menú</th><th>Plato</th><th>Manipuladora</th><th>Fecha</th><th>Hora</th><th>Estado</th></tr>`;
      filasHtml = this.itemsFiltrados.map(pr => `
        <tr>
          <td>${pr.id_preparacion_asignada}</td>
          <td>${pr.nombre_menu}</td>
          <td>${pr.nombre_plato}</td>
          <td>${pr.manipuladora}</td>
          <td>${pr.fecha}</td>
          <td>${pr.hora_programada}</td>
          <td>${pr.estado_preparacion}</td>
        </tr>`).join('');
    }

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>
        <table border="1">
          <thead>${encabezadoHtml}</thead>
          <tbody>${filasHtml}</tbody>
        </table>
      </body></html>`;

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${this.pestanaActiva}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}