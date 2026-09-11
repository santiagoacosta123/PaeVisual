import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenusService } from '../services/menus';
import { JornadasService } from '../services/jornadas';
import { Menu } from '../models/menu';
import { Jornada } from '../models/jornada';

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menus.html',
  styleUrl: './menus.css',
})
export class Menus implements OnInit {

  menus: Menu[] = [];
  jornadas: Jornada[] = [];

  // Campos de formulario
  id_jornada: number | '' = '';
  fecha: string = '';
  ninos_presentes: number | null = null;
  estado: string = 'Activo';
  informacion_nutricional: string = '';
  id_contrato: number | null = null;

  editando: boolean = false;
  idEditando: number | null = null;
  cargando: boolean = false;

  alerta: { mensaje: string; tipo: 'success' | 'error' | 'info' } | null = null;

  constructor(
    private menusService: MenusService,
    private jornadasService: JornadasService
  ) {}

  ngOnInit(): void {
    // Establecer fecha de hoy por defecto
    const hoy = new Date().toISOString().split('T')[0];
    this.fecha = hoy;

    this.cargarJornadas();
    this.obtenerMenus();
  }

  mostrarAlerta(mensaje: string, tipo: 'success' | 'error' | 'info' = 'success'): void {
    this.alerta = { mensaje, tipo };
    setTimeout(() => {
      if (this.alerta?.mensaje === mensaje) {
        this.alerta = null;
      }
    }, 4000);
  }

  cargarJornadas(): void {
    this.jornadasService.obtenerJornadas().subscribe({
      next: (data) => {
        this.jornadas = data;
      },
      error: (err) => console.error('Error al cargar jornadas para select:', err)
    });
  }

  obtenerMenus(): void {
    this.cargando = true;
    this.menusService.obtenerMenus().subscribe({
      next: (data) => {
        this.menus = data;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al obtener menús:', error);
        this.cargando = false;
        this.mostrarAlerta('No se pudieron obtener los menús.', 'error');
      }
    });
  }

  getNombreJornada(idJornada: number): string {
    const j = this.jornadas.find((x) => x.id_jornada === Number(idJornada));
    return j ? j.nombre_jornada : `Jornada #${idJornada}`;
  }

  guardarMenu(): void {
    if (!this.id_jornada) {
      this.mostrarAlerta('Por favor selecciona una jornada.', 'error');
      return;
    }
    if (!this.fecha) {
      this.mostrarAlerta('Por favor indica la fecha.', 'error');
      return;
    }
    if (this.ninos_presentes === null || this.ninos_presentes < 0) {
      this.mostrarAlerta('Indica una cantidad válida de niños.', 'error');
      return;
    }
    if (!this.informacion_nutricional.trim()) {
      this.mostrarAlerta('La información nutricional es obligatoria.', 'error');
      return;
    }
    if (this.id_contrato === null) {
      this.mostrarAlerta('Indica el número de contrato.', 'error');
      return;
    }

    const nuevoMenu: Menu = {
      id_jornada: Number(this.id_jornada),
      fecha: this.fecha,
      ninos_presentes: Number(this.ninos_presentes),
      estado: this.estado,
      informacion_nutricional: this.informacion_nutricional.trim(),
      id_contrato: Number(this.id_contrato)
    };

    this.menusService.crearMenu(nuevoMenu).subscribe({
      next: () => {
        this.mostrarAlerta('¡Menú registrado exitosamente!', 'success');
        this.limpiarFormulario();
        this.obtenerMenus();
      },
      error: (error) => {
        console.error('Error al crear menú:', error);
        this.mostrarAlerta('Error al crear el menú.', 'error');
      }
    });
  }

  editarMenu(menu: Menu): void {
    this.editando = true;
    this.idEditando = menu.id_menu!;
    this.id_jornada = menu.id_jornada;
    this.fecha = menu.fecha;
    this.ninos_presentes = menu.ninos_presentes;
    this.estado = menu.estado;
    this.informacion_nutricional = menu.informacion_nutricional;
    this.id_contrato = menu.id_contrato;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  actualizarMenu(): void {
    if (this.idEditando === null) return;

    if (!this.id_jornada || !this.fecha || this.ninos_presentes === null || !this.informacion_nutricional.trim() || this.id_contrato === null) {
      this.mostrarAlerta('Completa todos los campos requeridos.', 'error');
      return;
    }

    const menuActualizado: Menu = {
      id_menu: this.idEditando,
      id_jornada: Number(this.id_jornada),
      fecha: this.fecha,
      ninos_presentes: Number(this.ninos_presentes),
      estado: this.estado,
      informacion_nutricional: this.informacion_nutricional.trim(),
      id_contrato: Number(this.id_contrato)
    };

    this.menusService.editarMenu(this.idEditando, menuActualizado).subscribe({
      next: () => {
        this.mostrarAlerta('Menú actualizado correctamente.', 'success');
        this.cancelarEdicion();
        this.obtenerMenus();
      },
      error: (error) => {
        console.error('Error al actualizar menú:', error);
        this.mostrarAlerta('Error al actualizar el menú.', 'error');
      }
    });
  }

  eliminarMenu(id: number): void {
    if (!confirm('¿Estás seguro de que deseas eliminar este menú?')) {
      return;
    }

    this.menusService.eliminarMenu(id).subscribe({
      next: () => {
        this.mostrarAlerta('Menú eliminado del sistema.', 'info');
        this.obtenerMenus();
      },
      error: (error) => {
        console.error('Error al eliminar menú:', error);
        this.mostrarAlerta('Error al eliminar el menú.', 'error');
      }
    });
  }

  cancelarEdicion(): void {
    this.editando = false;
    this.idEditando = null;
    this.limpiarFormulario();
  }

  limpiarFormulario(): void {
    this.id_jornada = '';
    this.fecha = new Date().toISOString().split('T')[0];
    this.ninos_presentes = null;
    this.estado = 'Activo';
    this.informacion_nutricional = '';
    this.id_contrato = null;
  }
}

