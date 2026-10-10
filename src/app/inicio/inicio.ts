import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // Importante para la navegación con botones
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inicio.html',
  styleUrls: ['./inicio.css']
})
export class InicioComponent {
  private authService = inject(AuthService);
  nombreUsuario = this.obtenerNombreUsuario();
  rolUsuario = this.authService.obtenerUsuario()?.rol || 'Sin rol asignado';
  fechaActual = new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' }).format(new Date());

  private obtenerNombreUsuario(): string {
    const usuario = this.authService.obtenerUsuario();
    return usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.correo : '';
  }
}