import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // Importante para la navegación con botones

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inicio.html',
  styleUrls: ['./inicio.css']
})
export class InicioComponent {
  nombreUsuario = 'Administrador';
  fechaActual = 'martes 28 de mayo de 2026';

  // Datos para las 4 tarjetas principales con soporte de rutas
  resumen = [
    { titulo: 'Usuarios Activos', valor: '4', desc: 'Usuarios', ruta: '/usuarios', btnTexto: 'Ver Usuarios' },
    { titulo: 'Inventarios Activos', valor: '6', desc: 'Inventarios', ruta: '/productos', btnTexto: 'Ver Inventarios' },
    { titulo: 'Menus Programados', valor: '10', desc: 'Menus', ruta: '/calendario', btnTexto: 'Ver Menus' },
    { titulo: 'Entregas Realizadas', valor: '4', desc: 'Entregas', ruta: '/reportes', btnTexto: 'Ver Entregas' }
  ];

  alertas = [
    { nombre: 'Arroz', stock: 12, estado: 'Bajo stock' },
    { nombre: 'Leche', stock: 8, estado: 'Crítico' },
    { nombre: 'Frijoles', stock: 15, estado: 'Poco stock' }
  ];

  usuariosRecientes = [
    { nombre: 'María', rol: 'Coordinadora', estado: 'Activo' },
    { nombre: 'Carlos', rol: 'Supervisor', estado: 'Activo' },
    { nombre: 'Ana', rol: 'Jefa', estado: 'Inactivo' }
  ];

  actividad = [
    { texto: 'Se actualizó el inventario de granos y cereales.', tiempo: 'Hace 15 minutos' },
    { texto: 'Nuevo usuario registrado: Carlos (Supervisor).', tiempo: 'Hace 2 horas' },
    { texto: 'Se programó el menú escolar para la sede principal.', tiempo: 'Hace 5 horas' }
  ];
}