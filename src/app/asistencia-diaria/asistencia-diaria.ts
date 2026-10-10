import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../services/auth.service';
import {
  AsistenciaDiaria,
  AsistenciaDiariaPayload,
  AsistenciaDiariaService,
  GradoAsistencia,
} from '../services/asistencia-diaria.service';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  selector: 'app-asistencia-diaria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asistencia-diaria.html',
})
export class AsistenciaDiariaComponent implements OnInit {
  asistencias: AsistenciaDiaria[] = [];
  grados: GradoAsistencia[] = [];
  cargando = true;
  guardando = false;
  errorMensaje = '';
  editandoId: number | null = null;
  readonly hoy = (() => {
    const ahora = new Date();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${ahora.getFullYear()}-${mes}-${dia}`;
  })();
  formulario = { id_grado: '', fecha: this.hoy, ninos_presentes: '' };

  constructor(
    private readonly asistenciaService: AsistenciaDiariaService,
    private readonly authService: AuthService,
    private readonly alertas: SweetAlertService,
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.errorMensaje = '';
    forkJoin({
      asistencias: this.asistenciaService.getAsistencias(),
      grados: this.asistenciaService.getGrados(),
    }).subscribe({
      next: ({ asistencias, grados }) => {
        this.asistencias = asistencias;
        this.grados = grados;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar asistencia diaria:', error);
        this.cargando = false;
        this.errorMensaje = error.status === 401
          ? 'La sesión expiró. Inicia sesión nuevamente.'
          : error.status === 403
            ? 'Solo la Jefa de manipuladoras puede consultar la asistencia.'
            : 'No fue posible cargar asistencia y grados. Verifica la conexión e intenta nuevamente.';
        void this.alertas.error('No se pudo cargar la asistencia', this.errorMensaje);
      },
    });
  }

  guardar(): void {
    const usuario = this.authService.obtenerUsuario();
    const idGrado = Number(this.formulario.id_grado);
    const presentes = Number(this.formulario.ninos_presentes);
    if (!usuario || !Number.isInteger(idGrado) || !this.formulario.fecha
      || !Number.isInteger(presentes) || presentes < 0) {
      void this.alertas.warning(
        'Revisa los datos',
        'Selecciona un grado y fecha, y registra una cantidad entera de estudiantes igual o mayor que cero.',
      );
      return;
    }

    const payload: AsistenciaDiariaPayload = {
      id_grado: idGrado,
      fecha: this.formulario.fecha,
      ninos_presentes: presentes,
      id_usuario_manipuladora: usuario.id_usuario,
    };
    this.guardando = true;
    const request = this.editandoId === null
      ? this.asistenciaService.registrar(payload)
      : this.asistenciaService.actualizar(this.editandoId, payload);
    request.subscribe({
      next: () => {
        this.guardando = false;
        this.reiniciarFormulario();
        this.cargarDatos();
        void this.alertas.success('Asistencia guardada', 'El registro diario quedó actualizado.');
      },
      error: (error) => {
        console.error('Error al guardar asistencia diaria:', error);
        this.guardando = false;
        const detalle = error.error?.detail
          || error.error?.ninos_presentes?.[0]
          || error.error?.id_grado?.[0]
          || 'No se pudo guardar el registro. Verifica los datos e intenta nuevamente.';
        void this.alertas.error('No se pudo guardar', detalle);
      },
    });
  }

  editar(asistencia: AsistenciaDiaria): void {
    this.editandoId = asistencia.id_asistencia;
    this.formulario = {
      id_grado: String(asistencia.id_grado),
      fecha: asistencia.fecha,
      ninos_presentes: String(asistencia.ninos_presentes),
    };
  }

  cancelarEdicion(): void {
    this.reiniciarFormulario();
  }

  eliminar(asistencia: AsistenciaDiaria): void {
    const grado = this.nombreGrado(asistencia.id_grado);
    void this.alertas.confirm(
      '¿Eliminar esta asistencia?',
      `Se eliminará el registro de ${grado} del ${asistencia.fecha}.`,
      'Sí, eliminar',
    ).then(result => {
      if (!result.isConfirmed) return;
      this.asistenciaService.eliminar(asistencia.id_asistencia).subscribe({
        next: () => {
          this.asistencias = this.asistencias.filter(item => item.id_asistencia !== asistencia.id_asistencia);
          void this.alertas.success('Asistencia eliminada', 'El registro fue eliminado.');
        },
        error: (error) => {
          console.error('Error al eliminar asistencia diaria:', error);
          void this.alertas.error('No se pudo eliminar', 'Verifica tus permisos e intenta nuevamente.');
        },
      });
    });
  }

  nombreGrado(id: number): string {
    return this.grados.find(grado => grado.id_grado === id)?.nombre_grado || `Grado ${id}`;
  }

  private reiniciarFormulario(): void {
    this.editandoId = null;
    this.formulario = { id_grado: '', fecha: this.hoy, ninos_presentes: '' };
  }
}
