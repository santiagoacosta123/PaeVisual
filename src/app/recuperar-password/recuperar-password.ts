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
  correo = '';
  codigo = '';
  modoCodigo = false;
  nuevaPassword = '';
  confirmarPassword = '';
  verificandoToken = true;
  tokenValido = false;
  procesando = false;
  completado = false;
  errorMensaje = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (this.token) {
      this.validarToken(this.token);
      return;
    }

    this.correo = this.route.snapshot.queryParamMap.get('correo')?.trim() ?? '';
    if (this.correo) {
      this.modoCodigo = true;
      this.verificandoToken = false;
      this.tokenValido = true;
      return;
    }

    this.verificandoToken = false;
    this.errorMensaje = 'El enlace no contiene un token ni un correo para verificar el código. Solicita una recuperación nueva.';
  }

  private validarToken(token: string): void {
    this.authService.validarTokenRecuperacion(token).subscribe({
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

    if (!this.tokenValido || (!this.token && (!this.correo || !/^\d{6}$/.test(this.codigo)))) {
      this.errorMensaje = this.modoCodigo
        ? 'Ingresa el código de seis dígitos enviado a tu correo.'
        : 'El enlace de recuperación no es válido. Solicita uno nuevo.';
      return;
    }

    const longitudMinima = this.modoCodigo ? 8 : 6;
    if (this.nuevaPassword.length < longitudMinima) {
      this.errorMensaje = `La contraseña debe tener al menos ${longitudMinima} caracteres.`;
      return;
    }

    if (this.nuevaPassword !== this.confirmarPassword) {
      this.errorMensaje = 'Las contraseñas no coinciden.';
      return;
    }

    this.procesando = true;
    const solicitud = this.token
      ? this.authService.confirmarRecuperacionContrasena({
          token: this.token,
          nueva_password: this.nuevaPassword,
          confirmar_password: this.confirmarPassword,
        })
      : this.authService.confirmarRecuperacionCodigo({
          correo: this.correo,
          codigo: this.codigo,
          nueva_password: this.nuevaPassword,
          confirmar_password: this.confirmarPassword,
        });

    solicitud.subscribe({
      next: () => {
        this.procesando = false;
        this.completado = true;
        this.codigo = '';
        this.nuevaPassword = '';
        this.confirmarPassword = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.procesando = false;
        const error = err.error?.error || err.error?.detail;
        this.errorMensaje = Array.isArray(error)
          ? error.join(' ')
          : error || 'No fue posible cambiar la contraseña. Verifica el código e inténtalo otra vez.';
        this.cdr.detectChanges();
      },
    });
  }

  irAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
