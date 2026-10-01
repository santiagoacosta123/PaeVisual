import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
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

  @ViewChild('googleButton') googleButton?: ElementRef<HTMLDivElement>;

  loginForm!: FormGroup;
  cargando: boolean = false;
  errorMensaje: string = '';
  mostrarClave: boolean = false;

  mostrarModalRecuperar: boolean = false;
  correoRecuperacion: string = '';
  enviandoRecuperacion: boolean = false;
  mensajeGoogle: string = '';

  get googleClientConfigurado(): boolean {
    return Boolean(environment.googleClientId.trim());
  }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]],
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

    const credenciales = {
      correo: this.loginForm.value.correo,
      clave: this.loginForm.value.clave
    };

    this.authService.login(credenciales).subscribe({
      next: (response) => {
        this.authService.guardarSesion(response);
        this.cargando = false;
        this.router.navigate(['/inicio']);
      },
      error: (err) => {
        this.cargando = false;
        this.errorMensaje = err.error?.detail || 'Credenciales inválidas o error de conexión.';
      }
    });
  }

  private procesarLoginGoogle(idToken: string): void {
    this.cargando = true;
    this.errorMensaje = '';
    this.mensajeGoogle = '';

    this.authService.loginConGoogle(idToken).subscribe({
      next: (response) => {
        this.authService.guardarSesion(response);
        this.cargando = false;
        this.router.navigate(['/inicio']);
      },
      error: (err) => {
        this.cargando = false;
        this.mensajeGoogle = err.error?.detail
          || err.error?.tipo_documento
          || err.error?.numero_documento
          || 'No se pudo iniciar sesión con Google.';
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