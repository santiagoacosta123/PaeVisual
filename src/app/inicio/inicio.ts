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
  fechaActual = new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' }).format(new Date());

}