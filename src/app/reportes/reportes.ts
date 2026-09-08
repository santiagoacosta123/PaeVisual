import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SweetAlertService } from '../sweet-alert.service';

interface ItemInventario {
  producto: string;
  entradas: number;
  consumos: number;
  saldo: number;
  estado: 'Disponible' | 'Poco stock' | 'Agotado';
}

interface SemanaConsolidado {
  semana: string;
  asistencia: number;
  menus: number;
  porciones: number;
  consumos: number;
  cumplimiento: number;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-reportes',
  styleUrls: ['./reportes.css'],
  templateUrl: './reportes.html',
})

export class Reportes {

  inventario: ItemInventario[] = [
    { producto: 'Arroz', entradas: 40, consumos: 22, saldo: 28, estado: 'Disponible' },
    { producto: 'Frijoles', entradas: 30, consumos: 18, saldo: 12, estado: 'Poco stock' },
    { producto: 'Leche', entradas: 25, consumos: 25, saldo: 0, estado: 'Agotado' },
    { producto: 'Aceite', entradas: 15, consumos: 10, saldo: 5, estado: 'Poco stock' },
    { producto: 'Sal', entradas: 20, consumos: 8, saldo: 12, estado: 'Disponible' },
    { producto: 'Azúcar', entradas: 18, consumos: 22, saldo: 0, estado: 'Agotado' },
  ];

  consolidado: SemanaConsolidado[] = [
    { semana: 'Semana 1', asistencia: 96, menus: 385, porciones: 1155, consumos: 78, cumplimiento: 98 },
    { semana: 'Semana 2', asistencia: 92, menus: 370, porciones: 1110, consumos: 74, cumplimiento: 94 },
    { semana: 'Semana 3', asistencia: 95, menus: 390, porciones: 1170, consumos: 80, cumplimiento: 97 },
    { semana: 'Semana 4', asistencia: 93, menus: 395, porciones: 1185, consumos: 80, cumplimiento: 96 },
  ];

  constructor(private sweetAlert: SweetAlertService) {}

  exportarInventario() {
    this.sweetAlert.success('Reporte exportado', 'El reporte de inventario fue generado correctamente.');
  }

  enviarInventario() {
    this.sweetAlert.info('Correo enviado', 'El reporte de inventario fue compartido.');
  }

  exportarConsolidado() {
    this.sweetAlert.success('Consolidado exportado', 'El consolidado mensual fue generado correctamente.');
  }

  enviarConsolidado() {
    this.sweetAlert.info('Correo enviado', 'El consolidado mensual fue compartido.');
  }
}