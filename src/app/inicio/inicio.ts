import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inicio.html',
  styleUrls: ['./inicio.css']
})
export class InicioComponent {
  nombreUsuario = 'Mariana Gomez';
  fechaActual = 'SÁBADO, 29 DE AGOSTO DE 2026';

  resumen = [
    { label: 'Usuarios', valor: '120', cambio: '+8% este mes', color: 'bg-[#FAB41F]' },
    { label: 'Productos', valor: '85', cambio: '+12 nuevos', color: 'bg-[#FFF4D6]' },
    { label: 'Sedes', valor: '12', cambio: '3 activas hoy', color: 'bg-[#FAB41F]' },
    { label: 'Reportes', valor: '34', cambio: '7 pendientes', color: 'bg-[#FFF4D6]' }
  ];

  alertas = [
    { nombre: 'Arroz', stock: 12, estado: 'Bajo stock' },
    { nombre: 'Leche', stock: 8, estado: 'Crítico' },
    { nombre: 'Frijoles', stock: 15, estado: 'Poco stock' }
  ];

  actividad = [
    { texto: 'Jader creó un nuevo usuario', tiempo: 'Hace 15 min' },
    { texto: 'Se actualizó el inventario central', tiempo: 'Hace 1 hora' },
    { texto: 'Se generó reporte de ventas', tiempo: 'Hace 2 horas' },
    { texto: 'Se asignó un nuevo rol', tiempo: 'Ayer' }
  ];

  usuariosRecientes = [
    { nombre: 'María', rol: 'Coordinadora', estado: 'Activo' },
    { nombre: 'Carlos', rol: 'Supervisor', estado: 'Activo' },
    { nombre: 'Ana', rol: 'Jefa', estado: 'Inactivo' }
  ];
}