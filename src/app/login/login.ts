import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

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
    private router: Router
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

    // Validación simulada directamente aquí (sin servicio aparte)
    setTimeout(() => {
      this.cargando = false;

      if (correo === 'admin@pae.com' && clave === '123456') {
        localStorage.setItem('pae_token', 'token-simulado-123');
        this.router.navigate(['/inicio']);
      } else {
        this.errorMensaje = 'Correo o contraseña incorrectos';
      }
    }, 800);
  }
}