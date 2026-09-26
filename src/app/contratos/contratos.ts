import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SiraeService } from '../services/contratos_pae.service';

@Component({
  selector: 'app-gestion-contratos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contratos.html',
  styleUrls: ['./contratos.css']
})
export class ContratosComponent implements OnInit {
  constructor(private router: Router, private siraeService: SiraeService) {}

  ngOnInit() {
    this.cargarContratos();
    this.cargarDatosMaestros();
  }

  cargarContratos() {
    this.siraeService.getContratos().subscribe(
      (data) => {
        // Mapear los campos del backend (ej: id_contrato, numero_cor, fecha_inicio) 
        // a los nombres que usa la tabla en Angular
        this.contratos = data.map(c => ({
          id: c.id_contrato,
          codigo: c.numero_cor,
          institucion: c.institucion,
          fechaInicio: c.fecha_inicio,
          fechaFin: c.fecha_fin,
          estado: c.estado,
          zona: c.zona,
          expandido: false
        }));
      },
      (error) => {
        console.error('Error al cargar contratos desde la API', error);
      }
    );
  }

  cargarDatosMaestros() {
    this.siraeService.getJornadas().subscribe(res => {
      this.jornadas = res.map(j => ({
        id: j.id_jornada,
        nombre: j.nombre_jornada,
        estado: 'Activa' // Si no viene en el backend
      }));
    }, err => {
      console.warn('Usando jornadas de prueba temporalmente', err);
    });

    this.siraeService.getSeccionesMenu().subscribe(res => {
      this.secciones = res.map(s => ({
        id: s.id_seccion,
        nombre: s.nombre_seccion || s.nombre,
        jornada: s.jornada,
        estado: 'Activa'
      }));
    }, err => {
      console.warn('Usando secciones de prueba temporalmente', err);
    });
  }

  pestanaActiva = 'contratos';

  filtroBusquedaContratos = '';
  filtroBusquedaJornadas = '';
  filtroBusquedaSecciones = '';
  filtroBusquedaTurnos = '';

  modalContratoAbierto = false;
  modoEdicionContrato = false;


  modalJornadaAbierto = false;
  modoEdicionJornada = false;

  modalSeccionAbierto = false;
  modoEdicionSeccion = false;

  modalTurnoAbierto = false;
  modoEdicionTurno = false;

  contratoActual: any = {
    id: null,
    codigo: '',
    institucion: '',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    estado: 'Activo',
    zona: ''
  };

  jornadaActual: any = {
    id: null,
    nombre: '',
    estado: 'Activa'
  };

  seccionActual: any = {
    id: null,
    nombre: '',
    jornada: '',
    estado: 'Activa'
  };

  turnoActual: any = {
    id: null,
    nombre: '',
    horaInicio: '',
    horaFin: ''
  };

  contratos: any[] = [];

  jornadas: any[] = [];
  secciones: any[] = [];

  // Turnos sin datos de prueba
  turnos: any[] = [];


  get contratosFiltrados() {
    const filtro = this.filtroBusquedaContratos.toLowerCase();

    return this.contratos.filter(c =>
      (c.codigo && c.codigo.toLowerCase().includes(filtro)) ||
      (c.institucion && c.institucion.toLowerCase().includes(filtro))
    );
  }

  get jornadasFiltradas() {
    const filtro = this.filtroBusquedaJornadas.toLowerCase();

    return this.jornadas.filter(j =>
      j.nombre.toLowerCase().includes(filtro)
    );
  }

  get seccionesFiltradas() {
    const filtro = this.filtroBusquedaSecciones.toLowerCase();

    return this.secciones.filter(s =>
      s.nombre.toLowerCase().includes(filtro) ||
      s.jornada.toLowerCase().includes(filtro)
    );
  }

  get turnosFiltrados() {
    const filtro = this.filtroBusquedaTurnos.toLowerCase();

    return this.turnos.filter(t =>
      t.nombre.toLowerCase().includes(filtro) ||
      t.horaInicio.includes(filtro) ||
      t.horaFin.includes(filtro)
    );
  }

  seleccionarPestana(pestana: string) {
    this.pestanaActiva = pestana;
  }

  toggleExpandir(contrato: any) {
    contrato.expandido = !contrato.expandido;
  }

  // CONTRATOS

  configurarContrato(contratoId: number) {
    this.router.navigate(['/contratos', contratoId, 'detalle']);
  }

  abrirModalContrato(contrato?: any) {
    if (contrato) {
      this.modoEdicionContrato = true;
      this.contratoActual = { ...contrato };
    } else {
      this.modoEdicionContrato = false;
      this.contratoActual = {
        id: null,
        codigo: 'COR-2026-00' + (this.contratos.length + 1),
        institucion: '',
        zona: '',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        estado: 'Activo',
        expandido: false
      };
    }

    this.modalContratoAbierto = true;
  }

  cerrarModalContrato() {
    this.modalContratoAbierto = false;
  }

  guardarContrato() {
    if (!this.contratoActual.institucion) {
      alert('Por favor, ingresa el nombre de la institución.');
      return;
    }

    // Adaptar payload al backend (numero_cor, fecha_inicio, id_contrato...)
    const payload = {
      numero_cor: this.contratoActual.codigo,
      institucion: this.contratoActual.institucion,
      zona: this.contratoActual.zona,
      fecha_inicio: this.contratoActual.fechaInicio,
      fecha_fin: this.contratoActual.fechaFin,
      estado: this.contratoActual.estado
    };

    if (this.modoEdicionContrato) {
      this.siraeService.actualizarContrato(this.contratoActual.id, payload).subscribe(() => {
        this.cargarContratos();
        this.cerrarModalContrato();
      }, err => console.error('Error al actualizar contrato', err));
    } else {
      this.siraeService.crearContrato(payload).subscribe(() => {
        this.cargarContratos();
        this.cerrarModalContrato();
      }, err => console.error('Error al crear contrato', err));
    }
  }

  eliminarContrato(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar este contrato?')) {
      this.siraeService.eliminarContrato(id).subscribe(() => {
        this.cargarContratos();
      }, err => console.error('Error al eliminar contrato', err));
    }
  }

  // JORNADAS

  abrirModalJornada(jornada?: any) {
    if (jornada) {
      this.modoEdicionJornada = true;
      this.jornadaActual = { ...jornada };
    } else {
      this.modoEdicionJornada = false;
      this.jornadaActual = {
        id: Date.now(),
        nombre: '',
        estado: 'Activa'
      };
    }

    this.modalJornadaAbierto = true;
  }

  cerrarModalJornada() {
    this.modalJornadaAbierto = false;
  }

  guardarJornada() {
    if (!this.jornadaActual.nombre) {
      alert('Por favor, ingresa el nombre de la jornada.');
      return;
    }

    const payload = {
      nombre_jornada: this.jornadaActual.nombre
    };

    if (this.modoEdicionJornada) {
      this.siraeService.actualizarJornada(this.jornadaActual.id, payload).subscribe(() => {
        this.cargarDatosMaestros();
        this.cerrarModalJornada();
      }, err => console.error('Error al actualizar jornada', err));
    } else {
      this.siraeService.crearJornada(payload).subscribe(() => {
        this.cargarDatosMaestros();
        this.cerrarModalJornada();
      }, err => console.error('Error al crear jornada', err));
    }
  }

  eliminarJornada(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar esta jornada?')) {
      this.siraeService.eliminarJornada(id).subscribe(() => {
        this.cargarDatosMaestros();
      }, err => console.error('Error al eliminar jornada', err));
    }
  }

  // SECCIONES

  abrirModalSeccion(seccion?: any) {
    if (seccion) {
      this.modoEdicionSeccion = true;
      this.seccionActual = { ...seccion };
    } else {
      this.modoEdicionSeccion = false;
      this.seccionActual = {
        id: Date.now(),
        nombre: '',
        jornada: this.jornadas.length
          ? this.jornadas[0].nombre
          : '',
        estado: 'Activa'
      };
    }

    this.modalSeccionAbierto = true;
  }

  cerrarModalSeccion() {
    this.modalSeccionAbierto = false;
  }

  guardarSeccion() {
    if (!this.seccionActual.nombre || !this.seccionActual.jornada) {
      alert('Por favor, ingresa el nombre de la sección y selecciona la jornada.');
      return;
    }

    const payload = {
      nombre_seccion: this.seccionActual.nombre,
      jornada: this.seccionActual.jornada // Ojo: Verifica si tu backend espera el nombre o el ID de la jornada
    };

    if (this.modoEdicionSeccion) {
      this.siraeService.actualizarSeccionMenu(this.seccionActual.id, payload).subscribe(() => {
        this.cargarDatosMaestros();
        this.cerrarModalSeccion();
      }, err => console.error('Error al actualizar sección', err));
    } else {
      this.siraeService.crearSeccionMenu(payload).subscribe(() => {
        this.cargarDatosMaestros();
        this.cerrarModalSeccion();
      }, err => console.error('Error al crear sección', err));
    }
  }

  eliminarSeccion(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar esta sección?')) {
      this.siraeService.eliminarSeccionMenu(id).subscribe(() => {
        this.cargarDatosMaestros();
      }, err => console.error('Error al eliminar sección', err));
    }
  }
}
