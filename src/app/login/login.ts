import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {

  loginForm: FormGroup;
  mostrarClave = false;
  cargando = false;
  errorMensaje = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get correo() {
    return this.loginForm.get('correo');
  }

  get clave() {
    return this.loginForm.get('clave');
  }

  alternarClave(): void {
    this.mostrarClave = !this.mostrarClave;
  }

  onSubmit(): void {
    this.errorMensaje = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.cargando = true;

    const { correo, clave } = this.loginForm.value;

    this.authService.login(correo, clave).subscribe({
      next: (response) => {

        // Guardar los tokens reales enviados por Django
        this.authService.guardarTokens(response);

        this.cargando = false;

        // Ir al inicio después de iniciar sesión correctamente
        this.router.navigate(['/inicio']);
      },

      error: (error) => {
        this.cargando = false;

        if (error.status === 401) {
          this.errorMensaje = 'Correo o contraseña incorrectos';
        } else {
          this.errorMensaje = 'No se pudo conectar con el servidor';
        }

        console.error('Error de login:', error);
      }
    });
  }
}
