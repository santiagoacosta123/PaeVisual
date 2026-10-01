import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SocialAuthService, SocialUser, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    GoogleSigninButtonModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private socialAuthService = inject(SocialAuthService);
  private cdr = inject(ChangeDetectorRef);

  loginForm!: FormGroup;
  cargando: boolean = false;
  errorMensaje: string = '';
  mostrarClave: boolean = false;

  // Variables para el modal de recuperación de contraseña
  mostrarModalRecuperar: boolean = false;
  correoRecuperacion: string = '';
  enviandoRecuperacion: boolean = false;

  private authSubscription!: Subscription;

  ngOnInit(): void {
    // Inicializar el formulario tradicional
    this.loginForm = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Escuchar el evento de inicio de sesión con Google
    this.authSubscription = this.socialAuthService.authState.subscribe({
      next: (user: SocialUser) => {
        if (user && user.idToken) {
          this.procesarLoginGoogle(user.idToken);
        }
      },
      error: (err: any) => {
        console.error('Error en autenticación de Google:', err);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  get correo() { return this.loginForm.get('correo'); }
  get clave() { return this.loginForm.get('clave'); }

  alternarClave(): void {
    this.mostrarClave = !this.mostrarClave;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.errorMensaje = '';
    this.cdr.detectChanges();

    const credenciales = {
      correo: this.loginForm.value.correo,
      clave: this.loginForm.value.clave
    };

    this.authService.login(credenciales).subscribe({
      next: (response) => {
        this.authService.guardarSesion(response);
        this.cargando = false;
        this.cdr.detectChanges();
        this.router.navigate(['/inicio']);
      },
      error: (err) => {
        this.cargando = false;
        this.errorMensaje = err.error?.detail || err.error?.message || err.error?.non_field_errors?.[0] || 'Credenciales inválidas o error de conexión.';
        this.cdr.detectChanges();
      }
    });
  }

  private procesarLoginGoogle(idToken: string): void {
    this.cargando = true;
    this.errorMensaje = '';
    this.cdr.detectChanges();

    this.authService.loginConGoogle(idToken).subscribe({
      next: (response) => {
        this.authService.guardarSesion(response);
        this.cargando = false;
        this.cdr.detectChanges();
        this.router.navigate(['/inicio']);
      },
      error: (err) => {
        this.cargando = false;
        this.errorMensaje = err.error?.detail || err.error?.message || err.error?.non_field_errors?.[0] || 'No se pudo iniciar sesión con Google.';
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalRecuperar(): void {
    this.mostrarModalRecuperar = true;
    this.correoRecuperacion = '';
  }

  cerrarModalRecuperar(): void {
    this.mostrarModalRecuperar = false;
  }

  enviarCorreoRecuperacion(): void {
    if (!this.correoRecuperacion) return;

    this.enviandoRecuperacion = true;
    this.authService.recuperarContrasena({ correo: this.correoRecuperacion }).subscribe({
      next: () => {
        this.enviandoRecuperacion = false;
        alert('Se han enviado las instrucciones a tu correo.');
        this.cerrarModalRecuperar();
      },
      error: (err) => {
        this.enviandoRecuperacion = false;
        alert(err.error?.detail || 'Ocurrió un error al procesar la solicitud.');
      }
    });
  }
}