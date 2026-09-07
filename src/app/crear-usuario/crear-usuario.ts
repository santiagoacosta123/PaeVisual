import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SweetAlertService } from '../sweet-alert.service';

@Component({
  selector: 'app-crear-usuario',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './crear-usuario.html',
  styleUrls: ['./crear-usuario.css']
})
export class CrearUsuarioComponent {
  constructor(private sweetAlert: SweetAlertService) {}

  guardarUsuario() {
    this.sweetAlert.success('Usuario guardado', 'El usuario se registró correctamente.');
  }

  cancelar() {
    this.sweetAlert.confirm('¿Cancelar?', 'Se perderán los cambios realizados.');
  }
}