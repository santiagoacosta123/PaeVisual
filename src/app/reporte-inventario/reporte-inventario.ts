import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-reporte-inventario',
  styleUrls: ['./reporte-inventario.css'],
  templateUrl: './reporte-inventario.html',
})
export class ReporteInventario {
  productos = [
    { nombre: 'Arroz', categoria: 'Grano', stock: 50, estado: 'Disponible' },
    { nombre: 'Leche', categoria: 'Lacteo', stock: 20, estado: 'Poco stock' },
    { nombre: 'Frijoles', categoria: 'Grano', stock: 35, estado: 'Disponible' }
  ];

  constructor(private sweetAlert: SweetAlertService) {}

  verReporte() {
    this.sweetAlert.info('Reporte generado', 'Se actualizó el inventario del día.');
  }

  descargarReporte() {
    this.sweetAlert.success('Descarga exitosa', 'El reporte fue descargado correctamente.');
  }
}
