import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Store } from '@ngrx/store';
import { login as loginAction } from '../store/action';

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
  private store = inject(Store);

  loginForm!: FormGroup;
  cargando: boolean = false;
  errorMensaje: string = '';
  mostrarClave: boolean = false;

  mostrarModalRecuperar: boolean = false;
  correoRecuperacion: string = '';
  enviandoRecuperacion: boolean = false;
  errorRecuperacion: string = '';
  mensajeRecuperacion: string = '';
  enlaceRecuperacionDesarrollo: string = '';
  codigoRecuperacionDesarrollo: string = '';

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

        // Guardar sesión en el store de NgRx (mismo patrón que proyecto ngrx)
        this.store.dispatch(loginAction({
          username: response.usuario?.correo || credenciales.correo,
          token: response.access || '',
          rol: response.usuario?.rol || '',
          nombre: `${response.usuario?.nombre || ''} ${response.usuario?.apellido || ''}`.trim(),
          id_usuario: response.usuario?.id_usuario || 0,
          institucion: response.usuario?.institucion_nombre || response.usuario?.institucion || '',
          mensaje: 'Inicio de sesión exitoso'
        }));

        this.cargando = false;
        this.cdr.detectChanges();

        if (this.authService.esSupervisor(response.usuario?.rol)) {
          this.router.navigate(['/dashboard-supervisor']);
        } else if (this.authService.esJefa(response.usuario?.rol)) {
          this.router.navigate(['/asistencia-diaria']);
        } else {
          this.router.navigate(['/inicio']);
        }
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
    this.errorRecuperacion = '';
    this.mensajeRecuperacion = '';
    this.enlaceRecuperacionDesarrollo = '';
    this.codigoRecuperacionDesarrollo = '';
  }

  cerrarModalRecuperar(): void {
    this.mostrarModalRecuperar = false;
    this.errorRecuperacion = '';
    this.mensajeRecuperacion = '';
    this.enlaceRecuperacionDesarrollo = '';
    this.codigoRecuperacionDesarrollo = '';
  }

  continuarRecuperacion(): void {
    this.router.navigate(['/recuperar-password'], {
      queryParams: { correo: this.correoRecuperacion.trim() },
    });
  }

  enviarCorreoRecuperacion(): void {
    const correo = this.correoRecuperacion.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      this.errorRecuperacion = 'Ingresa un correo electrónico válido.';
      this.mensajeRecuperacion = '';
      return;
    }

    this.errorRecuperacion = '';
    this.mensajeRecuperacion = '';
    this.enviandoRecuperacion = true;
    this.authService.recuperarContrasena({ correo }).subscribe({
      next: (response) => {
        this.enviandoRecuperacion = false;
        this.enlaceRecuperacionDesarrollo = response.debug_link || '';
        this.codigoRecuperacionDesarrollo = response.debug_code || '';
        this.mensajeRecuperacion = this.codigoRecuperacionDesarrollo
          ? 'Código de prueba: úsalo para cambiar tu contraseña.'
          : this.enlaceRecuperacionDesarrollo
          ? 'Modo local: abre este enlace para crear la nueva contraseña.'
          : response.mensaje
            || 'Si el correo está registrado, recibirás un código para restablecer la contraseña.';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.enviandoRecuperacion = false;
        this.errorRecuperacion = err.error?.error
          || err.error?.detail
          || 'Ocurrió un error al procesar la solicitud. Inténtalo nuevamente.';
        this.cdr.detectChanges();
      }
    });
  }
}
