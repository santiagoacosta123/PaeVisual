import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-reportes',
  styleUrls: ['./reportes.css'],
  templateUrl: './reportes.html',
})
export class Reportes {
  constructor(private sweetAlert: SweetAlertService) {}

  exportarReporte() {
    this.sweetAlert.success('Reporte exportado', 'El archivo fue generado correctamente.');
  }

  enviarReporte() {
    this.sweetAlert.info('Correo enviado', 'El reporte fue compartido con el equipo asignado.');
  }
}
