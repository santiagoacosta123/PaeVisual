import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

type EstadoRestablecimiento = 'validando' | 'formulario' | 'exito' | 'error';

@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './recuperar-password.html',
})
export class RecuperarPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  estado: EstadoRestablecimiento = 'validando';
  token = '';
  nombreUsuario = '';
  correoUsuario = '';
  mensajeError = '';
  enviando = false;
  mostrarContrasenas = false;

  formulario = this.fb.nonNullable.group({
    nueva_password: ['', [Validators.required, Validators.minLength(6)]],
    confirmar_password: ['', Validators.required],
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() || '';
    if (!this.token) {
      this.mostrarError('El enlace no contiene un token de recuperación. Solicita uno nuevo.');
      return;
    }

    this.authService.validarTokenRecuperacion(this.token).subscribe({
      next: (respuesta) => {
        if (!respuesta.valido) {
          this.mostrarError(respuesta.error || 'El enlace no es válido. Solicita uno nuevo.');
          return;
        }
        this.nombreUsuario = respuesta.nombre_completo || '';
        this.correoUsuario = respuesta.email || '';
        this.estado = 'formulario';
      },
      error: (error) => this.mostrarError(
        error?.error?.error || error?.error?.detail || 'El enlace venció o no es válido. Solicita uno nuevo.'
      ),
    });
  }

  restablecerContrasena(): void {
    if (this.enviando) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { nueva_password, confirmar_password } = this.formulario.getRawValue();
    if (nueva_password !== confirmar_password) {
      this.mensajeError = 'Las contraseñas no coinciden. Verifica ambos campos.';
      return;
    }

    this.enviando = true;
    this.mensajeError = '';
    this.authService.confirmarRecuperacionContrasena({
      token: this.token,
      nueva_password,
      confirmar_password,
    }).subscribe({
      next: () => {
        this.enviando = false;
        this.estado = 'exito';
        this.formulario.reset();
      },
      error: (error) => {
        this.enviando = false;
        this.mensajeError = error?.error?.error
          || error?.error?.detail
          || 'No se pudo cambiar la contraseña. Solicita un nuevo enlace e inténtalo otra vez.';
      },
    });
  }

  volverAlLogin(): void {
    void this.router.navigate(['/login']);
  }

  private mostrarError(mensaje: string): void {
    this.mensajeError = mensaje;
    this.estado = 'error';
  }
}