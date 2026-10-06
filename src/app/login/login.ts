import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(element: HTMLElement, options: {
        theme: 'outline';
        size: 'large';
        text: 'continue_with';
        width: number;
      }): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

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
export class LoginComponent implements OnInit, AfterViewInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  @ViewChild('googleButton') googleButton?: ElementRef<HTMLDivElement>;

  loginForm!: FormGroup;
  cargando: boolean = false;
  errorMensaje: string = '';
  mostrarClave: boolean = false;

  mostrarModalRecuperar: boolean = false;
  enviandoRecuperacion: boolean = false;
  mensajeRecuperacion: string = '';
  errorRecuperacion: string = '';
  pasoRecuperacion: 'correo' | 'confirmacion' = 'correo';
  correoSolicitado: string = '';
  mensajeGoogle: string = '';
  formularioRecuperacion!: FormGroup;

  get correoRecuperacionEnmascarado(): string {
    const [usuario, dominio] = this.correoSolicitado.split('@');
    if (!usuario || !dominio) return this.correoSolicitado;
    return `${usuario.slice(0, 1)}${'*'.repeat(Math.min(usuario.length - 1, 6))}@${dominio}`;
  }

  get googleClientConfigurado(): boolean {
    return Boolean(environment.googleClientId.trim());
  }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]]
    });
    this.formularioRecuperacion = this.fb.group({
      correo: ['', [Validators.required, Validators.email]]
    });
  }

  ngAfterViewInit(): void {
    if (this.googleClientConfigurado) {
      void this.inicializarGoogle();
    }
  }

  private async inicializarGoogle(): Promise<void> {
    try {
      const google = await this.cargarGoogleIdentity();
      const elemento = this.googleButton?.nativeElement;
      if (!elemento) return;

      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (respuesta) => {
          if (respuesta.credential) {
            this.procesarLoginGoogle(respuesta.credential);
          } else {
            this.mensajeGoogle = 'Google no devolvió un token válido.';
          }
        },
      });
      google.accounts.id.renderButton(elemento, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: Math.min(360, elemento.clientWidth || 360),
      });
    } catch {
      this.mensajeGoogle = 'No se pudo cargar el acceso de Google. Revisa tu conexión e inténtalo de nuevo.';
    }
  }

  private cargarGoogleIdentity(): Promise<GoogleIdentityServices> {
    if (window.google) return Promise.resolve(window.google);

    return new Promise((resolve, reject) => {
      const script = document.querySelector<HTMLScriptElement>('#google-identity-script')
        ?? document.createElement('script');
      script.id = 'google-identity-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => window.google ? resolve(window.google) : reject();
      script.onerror = () => reject();
      if (!script.isConnected) document.head.appendChild(script);
    });
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
    this.mensajeGoogle = '';
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
        this.mensajeGoogle = err.error?.detail
          || err.error?.tipo_documento
          || err.error?.numero_documento
          || 'No se pudo iniciar sesión con Google.';
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalRecuperar(): void {
    this.mostrarModalRecuperar = true;
    this.pasoRecuperacion = 'correo';
    this.mensajeRecuperacion = '';
    this.errorRecuperacion = '';
    this.correoSolicitado = '';
    this.formularioRecuperacion.reset({
      correo: this.loginForm.get('correo')?.value || ''
    });
  }

  cerrarModalRecuperar(): void {
    this.mostrarModalRecuperar = false;
  }

  volverAEditarCorreo(): void {
    this.pasoRecuperacion = 'correo';
    this.mensajeRecuperacion = '';
    this.errorRecuperacion = '';
  }

  enviarCorreoRecuperacion(): void {
    if (this.enviandoRecuperacion) return;
    if (this.formularioRecuperacion.invalid) {
      this.formularioRecuperacion.markAllAsTouched();
      return;
    }

    this.enviandoRecuperacion = true;
    this.mensajeRecuperacion = '';
    this.errorRecuperacion = '';
    const correo = String(this.formularioRecuperacion.get('correo')?.value || '').trim().toLowerCase();

    this.authService.recuperarContrasena({ correo }).subscribe({
      next: () => {
        this.enviandoRecuperacion = false;
        this.correoSolicitado = correo;
        this.pasoRecuperacion = 'confirmacion';
        this.mensajeRecuperacion = 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.';
        this.cdr.detectChanges();
      },
      error: () => {
        this.enviandoRecuperacion = false;
        this.errorRecuperacion = 'No se pudo procesar la solicitud. Inténtalo de nuevo más tarde.';
        this.cdr.detectChanges();
      }
    });
  }
}