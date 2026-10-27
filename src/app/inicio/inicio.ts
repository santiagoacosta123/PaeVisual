import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inicio.html',
  styleUrls: ['./inicio.css']
})
export class InicioComponent implements OnInit {
  private authService = inject(AuthService);

  usuario = this.authService.obtenerUsuario();
  nombreUsuario = this.obtenerNombreUsuario();
  rolUsuario = this.usuario?.rol || 'Sin rol asignado';
  esSuperAdministrador = this.authService.esSuperAdministrador(this.usuario?.rol);
  esAdministrador = (this.authService.normalizarRol(this.usuario?.rol) === 'administrador' || this.authService.normalizarRol(this.usuario?.rol) === 'admin') && !this.esSuperAdministrador;
  
  fechaActual = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  ngOnInit(): void {}

  private obtenerNombreUsuario(): string {
    const usuario = this.usuario;
    return usuario ? `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || usuario.correo : '';
  }
}