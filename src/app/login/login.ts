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
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html'
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

    const credenciales = {
      correo: this.loginForm.value.correo,
      clave: this.loginForm.value.clave
    };

    this.authService.login(credenciales).subscribe({
      next: (respuesta: any) => {
        this.cargando = false;

        this.authService.guardarSesion(respuesta);

        Swal.fire({
          icon: 'success',
          title: '¡Bienvenido!',
          text: 'Has iniciado sesión correctamente.',
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/inicio']);
        });
      },

      error: (error: any) => {
        this.cargando = false;

        if (error?.error?.detail) {
          this.errorMensaje = error.error.detail;
        } else if (typeof error?.error === 'object') {
          this.errorMensaje = 'Correo o contraseña incorrectos.';
        } else {
          this.errorMensaje = 'No se pudo conectar con el servidor.';
        }

        Swal.fire({
          icon: 'error',
          title: 'Error de acceso',
          text: this.errorMensaje
        });
      }
    });
  }
}