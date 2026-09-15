import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menus.html',
  styleUrls: ['./menus.css']
})
export class MenusComponent implements OnInit {
  pestanaActiva: string = 'menus';

  // Listas principales
  menus: any[] = [];
  platos: any[] = [];
  preparacionesAsignadas: any[] = [];

  // Catálogos y datos para los selects
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

  seccionesMenu: any[] = [
    { id_seccion: 1, nombre_seccion: 'Desayuno' },
    { id_seccion: 2, nombre_seccion: 'Almuerzo' },
    { id_seccion: 3, nombre_seccion: 'Merienda' }
  ];

  // Control de interfaz
  mostrarFormulario: boolean = false;
  esEdicion: boolean = false;

  // Modelos de formularios
  menuForm: any = {
    id_menu: null,
    id_jornada: '',
    fecha: '',
    ninos_presentes: null,
    estado: 'ACTIVO',
    informacion_nutricional: '',
    id_contrato: ''
  };

  platoForm: any = {
    id_plato: null,
    id_seccion: '',
    nombre_plato: '',
    componente: ''
  };

  preparacionForm: any = {
    id_preparacion_asignada: null,
    id_menu: '',
    id_plato: '',
    id_usuario_manipuladora: '',
    fecha: '',
    hora_programada: '',
    estado_preparacion: 'PENDIENTE',
    observaciones: ''
  };

  ngOnInit(): void {
    // Datos iniciales de prueba
    this.menus = [
      { 
        id_menu: 1, 
        id_jornada: 1, 
        id_contrato: 1, 
        nombre_jornada: 'Jornada Mañana', 
        fecha: '2026-09-14', 
        ninos_presentes: 150, 
        estado: 'ACTIVO', 
        informacion_nutricional: 'Alto en proteínas y carbohidratos', 
        institucion: 'Institución Educativa Central' 
      }
    ];

    this.platos = [
      { 
        id_plato: 1, 
        id_seccion: 2, 
        nombre_seccion: 'Almuerzo', 
        nombre_plato: 'Seco de Pollo con Arroz', 
        componente: 'Proteína y Cereal' 
      }
    ];

    this.preparacionesAsignadas = [
      { 
        id_preparacion_asignada: 1, 
        id_menu: 1, 
        id_plato: 1, 
        id_usuario_manipuladora: 1, 
        nombre_menu: 'Menú #1 (14/09)', 
        nombre_plato: 'Seco de Pollo con Arroz', 
        manipuladora: 'Ana Gómez', 
        fecha: '2026-09-14', 
        hora_programada: '06:30', 
        estado_preparacion: 'PENDIENTE', 
        observaciones: 'Lavar bien los vegetales' 
      }
    ];
  }

  cambiarPestana(pestana: string): void {
    this.pestanaActiva = pestana;
    this.cerrarFormulario();
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
    if (this.pestanaActiva === 'menus') {
      const jor = this.jornadas.find(j => j.id_jornada == this.menuForm.id_jornada);
      const con = this.contratos.find(c => c.id_contrato == this.menuForm.id_contrato);

      if (this.esEdicion) {
        const index = this.menus.findIndex(m => m.id_menu === this.menuForm.id_menu);
        if (index > -1) {
          this.menus[index] = {
            ...this.menuForm,
            nombre_jornada: jor ? jor.nombre_jornada : 'General',
            institucion: con ? con.institucion : 'Contrato General'
          };
        }
      } else {
        this.menus.push({
          ...this.menuForm,
          id_menu: this.menus.length > 0 ? Math.max(...this.menus.map(m => m.id_menu)) + 1 : 1,
          nombre_jornada: jor ? jor.nombre_jornada : 'General',
          institucion: con ? con.institucion : 'Contrato General'
        });
      }
    } 
    else if (this.pestanaActiva === 'platos') {
      const sec = this.seccionesMenu.find(s => s.id_seccion == this.platoForm.id_seccion);

      if (this.esEdicion) {
        const index = this.platos.findIndex(p => p.id_plato === this.platoForm.id_plato);
        if (index > -1) {
          this.platos[index] = {
            ...this.platoForm,
            nombre_seccion: sec ? sec.nombre_seccion : 'General'
          };
        }
      } else {
        this.platos.push({
          ...this.platoForm,
          id_plato: this.platos.length > 0 ? Math.max(...this.platos.map(p => p.id_plato)) + 1 : 1,
          nombre_seccion: sec ? sec.nombre_seccion : 'General'
        });
      }
    }
    else if (this.pestanaActiva === 'preparaciones') {
      const man = this.usuariosManipuladoras.find(m => m.id_usuario_manipuladora == this.preparacionForm.id_usuario_manipuladora);
      const menuObj = this.menus.find(m => m.id_menu == this.preparacionForm.id_menu);
      const platoObj = this.platos.find(p => p.id_plato == this.preparacionForm.id_plato);

      if (this.esEdicion) {
        const index = this.preparacionesAsignadas.findIndex(pa => pa.id_preparacion_asignada === this.preparacionForm.id_preparacion_asignada);
        if (index > -1) {
          this.preparacionesAsignadas[index] = {
            ...this.preparacionForm,
            nombre_menu: menuObj ? `Menú #${menuObj.id_menu} (${menuObj.fecha})` : `Menú #${this.preparacionForm.id_menu}`,
            nombre_plato: platoObj ? platoObj.nombre_plato : 'Plato Seleccionado',
            manipuladora: man ? man.nombre : 'Sin asignar'
          };
        }
      } else {
        this.preparacionesAsignadas.push({
          ...this.preparacionForm,
          id_preparacion_asignada: this.preparacionesAsignadas.length > 0 ? Math.max(...this.preparacionesAsignadas.map(pa => pa.id_preparacion_asignada)) + 1 : 1,
          nombre_menu: menuObj ? `Menú #${menuObj.id_menu} (${menuObj.fecha})` : `Menú #${this.preparacionForm.id_menu}`,
          nombre_plato: platoObj ? platoObj.nombre_plato : 'Plato Seleccionado',
          manipuladora: man ? man.nombre : 'Sin asignar'
        });
      }
    }

    this.cerrarFormulario();
  }

  eliminarItem(lista: any[], item: any): void {
    const index = lista.indexOf(item);
    if (index > -1) {
      lista.splice(index, 1);
    }
  }
}