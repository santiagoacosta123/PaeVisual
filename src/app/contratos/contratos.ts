import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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

  constructor(
    private router: Router,
    private siraeService: SiraeService,
    private cdr: ChangeDetectorRef // <--- Inyectado para forzar renderizado inmediato
  ) { }

  ngOnInit() {
    this.cargarContratos();
    this.cargarDatosMaestros();
  }

  cargarContratos() {
    this.siraeService.getContratos().subscribe({
      next: (data: any) => {
        // Soporta array directo o respuesta paginada con .results
        const lista = Array.isArray(data) ? data : (data.results || []);

        this.contratos = lista.map((c: any) => ({
          id: c.id_contrato || c.id,
          codigo: c.numero_cor || c.codigo,
          institucion: c.institucion,
          fechaInicio: c.fecha_inicio,
          fechaFin: c.fecha_fin,
          estado: c.estado,
          zona: c.zona,
          expandido: false
        }));

        this.cdr.detectChanges(); // <--- Fuerza a Angular a pintar la tabla al instante
      },
      error: (error) => {
        console.error('Error al cargar contratos desde la API', error);
      }
    });
  }

  cargarDatosMaestros() {
    this.siraeService.getJornadas().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || []);
        this.jornadas = res.map((j: any) => ({
          id: j.id_jornada || j.id,
          nombre: j.nombre_jornada || j.nombre,
          estado: 'Activa'
        }));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('Usando jornadas de prueba temporalmente', err);
        this.cdr.detectChanges();
      }
    });

    this.siraeService.getSeccionesMenu().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || []);
        this.secciones = res.map((s: any) => ({
          id: s.id_seccion || s.id,
          nombre: s.nombre_seccion || s.nombre,
          jornada: s.jornada,
          estado: 'Activa'
        }));
        this.cdr.detectChanges();
      },
      error: (err) => console.warn('Usando secciones de prueba temporalmente', err)
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
    return this.jornadas.filter(j => j.nombre && j.nombre.toLowerCase().includes(filtro));
  }

  get seccionesFiltradas() {
    const filtro = this.filtroBusquedaSecciones.toLowerCase();
    return this.secciones.filter(s =>
      (s.nombre && s.nombre.toLowerCase().includes(filtro)) ||
      (s.jornada && String(s.jornada).toLowerCase().includes(filtro))
    );
  }

  get turnosFiltrados() {
    const filtro = this.filtroBusquedaTurnos.toLowerCase();
    return this.turnos.filter(t =>
      (t.nombre && t.nombre.toLowerCase().includes(filtro)) ||
      (t.horaInicio && t.horaInicio.includes(filtro)) ||
      (t.horaFin && t.horaFin.includes(filtro))
    );
  }

  seleccionarPestana(pestana: string) {
    this.pestanaActiva = pestana;
    this.cdr.detectChanges();
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
    this.cdr.detectChanges();
  }

  cerrarModalContrato() {
    this.modalContratoAbierto = false;
    this.cdr.detectChanges();
  }

  guardarContrato() {
    if (!this.contratoActual.institucion) {
      alert('Por favor, ingresa el nombre de la institución.');
      return;
    }

    const payload = {
      numero_cor: this.contratoActual.codigo,
      institucion: this.contratoActual.institucion,
      zona: this.contratoActual.zona,
      fecha_inicio: this.contratoActual.fechaInicio,
      fecha_fin: this.contratoActual.fechaFin,
      estado: this.contratoActual.estado
    };

    if (this.modoEdicionContrato) {
      this.siraeService.actualizarContrato(this.contratoActual.id, payload).subscribe({
        next: () => {
          this.cargarContratos();
          this.cerrarModalContrato();
        },
        error: (err) => console.error('Error al actualizar contrato', err)
      });
    } else {
      this.siraeService.crearContrato(payload).subscribe({
        next: () => {
          this.cargarContratos();
          this.cerrarModalContrato();
        },
        error: (err) => console.error('Error al crear contrato', err)
      });
    }
  }

  eliminarContrato(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar este contrato?')) {
      this.siraeService.eliminarContrato(id).subscribe({
        next: () => this.cargarContratos(),
        error: (err) => console.error('Error al eliminar contrato', err)
      });
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
    this.cdr.detectChanges();
  }

  cerrarModalJornada() {
    this.modalJornadaAbierto = false;
    this.cdr.detectChanges();
  }

  guardarJornada() {
    if (!this.jornadaActual.nombre) {
      alert('Por favor, ingresa el nombre de la jornada.');
      return;
    }

    const payload = { nombre_jornada: this.jornadaActual.nombre };

    if (this.modoEdicionJornada) {
      this.siraeService.actualizarJornada(this.jornadaActual.id, payload).subscribe({
        next: () => {
          this.cargarDatosMaestros();
          this.cerrarModalJornada();
        },
        error: (err) => console.error('Error al actualizar jornada', err)
      });
    } else {
      this.siraeService.crearJornada(payload).subscribe({
        next: () => {
          this.cargarDatosMaestros();
          this.cerrarModalJornada();
        },
        error: (err) => console.error('Error al crear jornada', err)
      });
    }
  }

  eliminarJornada(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar esta jornada?')) {
      this.siraeService.eliminarJornada(id).subscribe({
        next: () => this.cargarDatosMaestros(),
        error: (err) => console.error('Error al eliminar jornada', err)
      });
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
        jornada: this.jornadas.length ? this.jornadas[0].nombre : '',
        estado: 'Activa'
      };
    }
    this.modalSeccionAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalSeccion() {
    this.modalSeccionAbierto = false;
    this.cdr.detectChanges();
  }

  guardarSeccion() {
    if (!this.seccionActual.nombre || !this.seccionActual.jornada) {
      alert('Por favor, ingresa el nombre de la sección y selecciona la jornada.');
      return;
    }

    const payload = {
      nombre_seccion: this.seccionActual.nombre,
      jornada: this.seccionActual.jornada
    };

    if (this.modoEdicionSeccion) {
      this.siraeService.actualizarSeccionMenu(this.seccionActual.id, payload).subscribe({
        next: () => {
          this.cargarDatosMaestros();
          this.cerrarModalSeccion();
        },
        error: (err) => console.error('Error al actualizar sección', err)
      });
    } else {
      this.siraeService.crearSeccionMenu(payload).subscribe({
        next: () => {
          this.cargarDatosMaestros();
          this.cerrarModalSeccion();
        },
        error: (err) => console.error('Error al crear sección', err)
      });
    }
  }

  eliminarSeccion(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar esta sección?')) {
      this.siraeService.eliminarSeccionMenu(id).subscribe({
        next: () => this.cargarDatosMaestros(),
        error: (err) => console.error('Error al eliminar sección', err)
      });
    }
  }
}