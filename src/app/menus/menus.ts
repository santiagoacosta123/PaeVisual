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

  menus: any[] = [];
  platos: any[] = [];
  preparacionesAsignadas: any[] = [];
  seccionesMenu: any[] = [];

  platoSeleccionado: any = null;
  mostrarDetallePlato: boolean = false;
  detallesPlato: any[] = [];


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


    this.menus = [{ id_menu: 1, id_jornada: 1, id_contrato: 1, nombre_jornada: 'Jornada Mañana', fecha: '2026-09-14', ninos_presentes: 150, estado: 'ACTIVO', informacion_nutricional: 'Alto en proteínas y carbohidratos', institucion: 'Institución Educativa Central' }];
    this.preparacionesAsignadas = [{ id_preparacion_asignada: 1, id_menu: 1, id_plato: 1, id_usuario_manipuladora: 1, nombre_menu: 'Menú #1 (14/09)', nombre_plato: 'Seco de Pollo con Arroz', manipuladora: 'Ana Gómez', fecha: '2026-09-14', hora_programada: '06:30', estado_preparacion: 'PENDIENTE', observaciones: 'Lavar bien los vegetales' }];
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
    this.cerrarFormulario();
    this.cerrarDetalle();
  }

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
    if (this.pestanaActiva === 'platos') {
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
    } else {
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
    }
  }

  // ---- CRUD DETALLE PLATO ----
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
}