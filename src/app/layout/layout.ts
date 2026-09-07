import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent {
  constructor(private sweetAlert: SweetAlertService) {}

  configurar() {
    this.sweetAlert.info('Configuración', 'La configuración general del sistema estará disponible pronto.');
  }

  cerrarSesion() {
    this.sweetAlert
      .confirm('¿Cerrar sesión?', 'Se cerrará la sesión actual del administrador.')
      .then((result) => {
        if (result.isConfirmed) {
          this.sweetAlert.success('Sesión cerrada', 'Has salido correctamente del panel.');
        }
      });
  }
}