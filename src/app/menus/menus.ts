import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatosService } from '../services/platos.service';
import { SeccionesMenuService } from '../services/secciones-menu.service';
import { DetallePlatosService } from '../services/detalle-platos.service';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  jornadas: any[] = [
    { id_jornada: 1, nombre_jornada: 'Jornada Mañana' },
    { id_jornada: 2, nombre_jornada: 'Jornada Tarde' }
  ];

  contratos: any[] = [
    { id_contrato: 1, numero_cor: 'COR-2026-001', institucion: 'Institución Educativa Central' }
  ];

  usuariosManipuladoras: any[] = [
    { id_usuario_manipuladora: 1, nombre: 'Ana Gómez' },
    { id_usuario_manipuladora: 2, nombre: 'Carmen Rosa' }
  ];

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
  };

  constructor(
    private platosService: PlatosService,
    private seccionesService: SeccionesMenuService,
    private detallesService: DetallePlatosService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();

    this.menus = [{
      id_menu: 1, id_jornada: 1, id_contrato: 1,
      nombre_jornada: 'Jornada Mañana', fecha: '2026-09-14',
      ninos_presentes: 150, estado: 'ACTIVO',
      informacion_nutricional: 'Alto en proteínas y carbohidratos',
      institucion: 'Institución Educativa Central'
    }];

    this.preparacionesAsignadas = [{
      id_preparacion_asignada: 1, id_menu: 1, id_plato: 1,
      id_usuario_manipuladora: 1, nombre_menu: 'Menú #1 (14/09)',
      nombre_plato: 'Seco de Pollo con Arroz', manipuladora: 'Ana Gómez',
      fecha: '2026-09-14', hora_programada: '06:30',
      estado_preparacion: 'PENDIENTE', observaciones: 'Lavar bien los vegetales'
    }];
  }

  cargarDatos(): void {
    this.platosService.getPlatos().subscribe({
      next: (data) => this.platos = data,
      error: (err) => console.error('Error al cargar platos:', err)
    });

    this.seccionesMenu = [
      { id_seccion: 1, nombre_seccion: 'Desayuno' },
      { id_seccion: 2, nombre_seccion: 'Almuerzo' },
      { id_seccion: 3, nombre_seccion: 'Merienda' }
    ];
  }

  cambiarPestana(pestana: string): void {
    this.pestanaActiva = pestana;
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
    this.esEdicion = false;
    this.resetFormularios();
    this.mostrarFormulario = true;
  }

  abrirEdicion(item: any): void {
    this.esEdicion = true;
    if (this.pestanaActiva === 'menus') {
      this.menuForm = { ...item };
    } else if (this.pestanaActiva === 'platos') {
      this.platoForm = { ...item };
    } else if (this.pestanaActiva === 'preparaciones') {
      this.preparacionForm = { ...item };
    }
    this.mostrarFormulario = true;
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.resetFormularios();
  }

  resetFormularios(): void {
    this.menuForm = { id_menu: null, id_jornada: '', fecha: '', ninos_presentes: null, estado: 'ACTIVO', informacion_nutricional: '', id_contrato: '' };
    this.platoForm = { id_plato: null, id_seccion: '', nombre_plato: '', componente: '' };
    this.preparacionForm = { id_preparacion_asignada: null, id_menu: '', id_plato: '', id_usuario_manipuladora: '', fecha: '', hora_programada: '', estado_preparacion: 'PENDIENTE', observaciones: '' };
  }

  guardarTodo(): void {
    if (this.pestanaActiva === 'menus') {
      const jornadaObj = this.jornadas.find(j => j.id_jornada == this.menuForm.id_jornada);
      const contratoObj = this.contratos.find(c => c.id_contrato == this.menuForm.id_contrato);

      if (this.esEdicion) {
        const index = this.menus.findIndex(m => m.id_menu === this.menuForm.id_menu);
        if (index !== -1) {
          this.menus[index] = {
            ...this.menuForm,
            nombre_jornada: jornadaObj?.nombre_jornada || 'Jornada',
            institucion: contratoObj?.institucion || 'Institución'
          };
        }
        this.sweetAlert.success('Menú actualizado', 'El menú fue actualizado correctamente.');
      } else {
        const nuevoMenu = {
          ...this.menuForm,
          id_menu: Date.now(),
          nombre_jornada: jornadaObj?.nombre_jornada || 'Jornada',
          institucion: contratoObj?.institucion || 'Institución'
        };
        this.menus.push(nuevoMenu);
        this.sweetAlert.success('Menú creado', 'El menú fue registrado con éxito.');
      }
      this.cerrarFormulario();

    } else if (this.pestanaActiva === 'platos') {
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
    if (this.pestanaActiva === 'platos') {
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
        this.detallesPlato = data.filter((d: any) => d.id_plato === idPlato);
      }
    });
  }

  guardarDetalle(): void {
    this.detalleForm.id_plato = this.platoSeleccionado.id_plato;
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
          }
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