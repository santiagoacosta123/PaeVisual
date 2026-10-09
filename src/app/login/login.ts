import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loginForm!: FormGroup;
  cargando: boolean = false;
  errorMensaje: string = '';
  mostrarClave: boolean = false;

  mostrarModalRecuperar: boolean = false;
  correoRecuperacion: string = '';
  enviandoRecuperacion: boolean = false;

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]]
    });

    if (this.route.snapshot.queryParamMap.get('acceso') === 'denegado') {
      this.errorMensaje = 'Esta cuenta no tiene permiso para acceder a esta aplicación.';
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
        if (!this.authService.rolPermitido(response.usuario?.rol)) {
          this.authService.limpiarSesion();
          this.cargando = false;
          this.errorMensaje = 'Esta cuenta no tiene permiso para acceder a esta aplicación.';
          this.cdr.detectChanges();
          return;
        }

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