import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './recuperar-password.html',
})
export class RecuperarPasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  token: string | null = null;
  nuevaPassword = '';
  confirmarPassword = '';
  verificandoToken = true;
  tokenValido = false;
  procesando = false;
  completado = false;
  errorMensaje = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.verificandoToken = false;
      this.errorMensaje = 'El enlace de recuperación no contiene un token. Solicita uno nuevo.';
      return;
    }

    this.authService.validarTokenRecuperacion(this.token).subscribe({
      next: (response) => {
        this.verificandoToken = false;
        this.tokenValido = response.valido;
        if (!response.valido) {
          this.errorMensaje = response.error || 'El enlace de recuperación no es válido.';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.verificandoToken = false;
        this.errorMensaje = err.error?.error
          || err.error?.detail
          || 'El enlace de recuperación venció o no es válido. Solicita uno nuevo.';
        this.cdr.detectChanges();
      },
    });
  }

  restablecerContrasena(): void {
    this.errorMensaje = '';

    if (!this.token || !this.tokenValido) {
      this.errorMensaje = 'El enlace de recuperación no es válido. Solicita uno nuevo.';
      return;
    }

    if (this.nuevaPassword.length < 6) {
      this.errorMensaje = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    if (this.nuevaPassword !== this.confirmarPassword) {
      this.errorMensaje = 'Las contraseñas no coinciden.';
      return;
    }

    this.procesando = true;
    this.authService.confirmarRecuperacionContrasena({
      token: this.token,
      nueva_password: this.nuevaPassword,
      confirmar_password: this.confirmarPassword,
    }).subscribe({
      next: () => {
        this.procesando = false;
        this.completado = true;
        this.nuevaPassword = '';
        this.confirmarPassword = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.procesando = false;
        this.errorMensaje = err.error?.error
          || err.error?.detail
          || 'No fue posible cambiar la contraseña. Solicita un nuevo enlace e inténtalo otra vez.';
        this.cdr.detectChanges();
      },
    });
  }

  irAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
