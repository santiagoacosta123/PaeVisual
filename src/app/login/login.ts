import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Store } from '@ngrx/store';
import { login as loginAction } from '../store/action';
import { Subscription } from 'rxjs';
import { ReconocimientoFacialService } from '../services/reconocimiento-facial.service';

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
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private store = inject(Store);
  private facialService = inject(ReconocimientoFacialService);

  loginForm!: FormGroup;
  cargando: boolean = false;
  textoBotonCargando: string = 'Iniciando sesión.';
  private temporizadorAnimacionPuntos?: ReturnType<typeof setInterval>;
  errorMensaje: string = '';
  avisoDespertando: string = '';
  mostrarClave: boolean = false;

  mostrarModalRecuperar: boolean = false;
  correoRecuperacion: string = '';
  enviandoRecuperacion: boolean = false;
  errorRecuperacion: string = '';
  mensajeRecuperacion: string = '';
  enlaceRecuperacionDesarrollo: string = '';
  codigoRecuperacionDesarrollo: string = '';
  private solicitudLogin?: Subscription;
  private temporizadorAvisoDespertar?: ReturnType<typeof setTimeout>;

  // Variables para la cámara y reconocimiento facial
  mostrarModalFacial: boolean = false;
  modoFacial: 'login' | 'registro' = 'login';
  pasoFacial: 1 | 2 | 3 = 1;
  fotoCapturada: string = '';
  usuarioReconocido: any = null;
  correoParaRegistroFacial: string = '';
  mensajeFacial: string = '';
  cargandoFacial: boolean = false;
  streamVideo: MediaStream | null = null;
  private temporizadorRedireccionFacial?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.authService.despertarBackend();
    this.loginForm = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]]
    });

    if (this.route.snapshot.queryParamMap.get('acceso') === 'denegado') {
      this.errorMensaje = 'Esta cuenta no tiene permiso para acceder a esta aplicación.';
      return;
    }

    if (this.authService.estaAutenticado?.()) {
      const usuarioActivo = this.authService.obtenerUsuario?.();
      if (this.authService.rolPermitido(usuarioActivo?.rol)) {
        if (this.authService.esSupervisor(usuarioActivo?.rol)) {
          this.router.navigate(['/dashboard-supervisor']);
        } else if (this.authService.esJefa(usuarioActivo?.rol)) {
          this.router.navigate(['/asistencia-diaria']);
        } else {
          this.router.navigate(['/inicio']);
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.solicitudLogin?.unsubscribe();
    this.detenerAnimacionPuntos();
    if (this.temporizadorAvisoDespertar) clearTimeout(this.temporizadorAvisoDespertar);
    if (this.temporizadorRedireccionFacial) clearTimeout(this.temporizadorRedireccionFacial);
    if (this.streamVideo) {
      this.streamVideo.getTracks().forEach(track => track.stop());
    }
  }

  get correo() { return this.loginForm.get('correo'); }
  get clave() { return this.loginForm.get('clave'); }

  alternarClave(): void {
    this.mostrarClave = !this.mostrarClave;
    this.cdr.detectChanges();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.iniciarAnimacionPuntos();
    this.errorMensaje = '';
    this.avisoDespertando = '';
    this.cdr.detectChanges();

    const credenciales = {
      correo: this.loginForm.value.correo,
      clave: this.loginForm.value.clave
    };

    this.solicitudLogin?.unsubscribe();
    if (this.temporizadorAvisoDespertar) clearTimeout(this.temporizadorAvisoDespertar);

    // Si tarda más de 12 segundos, informar al usuario que Render está despertando del modo inactivo
    this.temporizadorAvisoDespertar = setTimeout(() => {
      if (this.cargando) {
        this.avisoDespertando = 'El servidor en la nube se está activando tras inactividad. Esto puede tardar unos segundos, por favor espera...';
        this.cdr.detectChanges();
      }
    }, 12000);

    this.solicitudLogin = this.authService.login(credenciales).subscribe({
      next: (response) => {
        if (this.temporizadorAvisoDespertar) {
          clearTimeout(this.temporizadorAvisoDespertar);
          this.temporizadorAvisoDespertar = undefined;
        }
        this.avisoDespertando = '';
        if (!this.authService.rolPermitido(response.usuario?.rol)) {
          this.authService.limpiarSesion();
          this.cargando = false;
          this.detenerAnimacionPuntos();
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
        this.detenerAnimacionPuntos();
        this.cdr.detectChanges();

        if (this.authService.esSupervisor(response.usuario?.rol)) {
          this.authService.limpiarInstitucionActiva?.();
          this.router.navigate(['/dashboard-supervisor']);
        } else if (this.authService.esJefa(response.usuario?.rol)) {
          this.router.navigate(['/asistencia-diaria']);
        } else {
          this.router.navigate(['/inicio']);
        }
      },
      error: (err) => {
        if (this.temporizadorAvisoDespertar) clearTimeout(this.temporizadorAvisoDespertar);
        this.avisoDespertando = '';
        this.cargando = false;
        this.detenerAnimacionPuntos();
        if (err.name === 'TimeoutError') {
          this.errorMensaje = 'El servidor está tardando en responder. Intenta iniciar sesión nuevamente; puede tardar un momento mientras el backend se activa.';
        } else if (err.status === 0) {
          this.errorMensaje = 'No se pudo conectar con el servidor. Verifica tu conexión o espera unos segundos mientras el backend inicia.';
        } else {
          this.errorMensaje = err.error?.detail
            || err.error?.message
            || err.error?.non_field_errors?.[0]
            || (typeof err.error === 'string' ? err.error : '')
            || 'Credenciales inválidas o error de conexión.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  private iniciarAnimacionPuntos(): void {
    this.detenerAnimacionPuntos();
    const estados = ['Iniciando sesión.', 'Iniciando sesión..', 'Iniciando sesión...'];
    let index = 0;
    this.textoBotonCargando = estados[index];
    this.temporizadorAnimacionPuntos = setInterval(() => {
      index = (index + 1) % estados.length;
      this.textoBotonCargando = estados[index];
      this.cdr.detectChanges();
    }, 600);
  }

  private detenerAnimacionPuntos(): void {
    if (this.temporizadorAnimacionPuntos) {
      clearInterval(this.temporizadorAnimacionPuntos);
      this.temporizadorAnimacionPuntos = undefined;
    }
    this.textoBotonCargando = 'Iniciando sesión.';
  }

  abrirModalRecuperar(): void {
    this.mostrarModalRecuperar = true;
    this.correoRecuperacion = this.correo?.value?.trim() ?? '';
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
    this.enlaceRecuperacionDesarrollo = '';
    this.codigoRecuperacionDesarrollo = '';
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

  // ==========================================
  // RECONOCIMIENTO FACIAL (ESTILO INSTRUCTORA)
  // ==========================================

  async abrirCamaraFacial(modo: 'login' | 'registro' = 'login'): Promise<void> {
    this.modoFacial = modo;
    this.pasoFacial = 1;
    this.fotoCapturada = '';
    this.usuarioReconocido = null;
    this.mensajeFacial = '';
    this.cargandoFacial = false;
    this.mostrarModalFacial = true;
    this.cdr.detectChanges();

    if (this.temporizadorRedireccionFacial) {
      clearTimeout(this.temporizadorRedireccionFacial);
      this.temporizadorRedireccionFacial = undefined;
    }

    try {
      this.streamVideo = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      setTimeout(() => {
        const videoElement = document.getElementById('videoWebcam') as HTMLVideoElement;
        if (videoElement && this.streamVideo) {
          videoElement.srcObject = this.streamVideo;
          videoElement.play();
        }
      }, 100);
    } catch (err) {
      this.mensajeFacial = 'No se pudo acceder a la cámara. Revisa los permisos de tu navegador.';
      this.cdr.detectChanges();
    }
  }

  cerrarCamaraFacial(): void {
    if (this.streamVideo) {
      this.streamVideo.getTracks().forEach(track => track.stop());
      this.streamVideo = null;
    }
    if (this.temporizadorRedireccionFacial) {
      clearTimeout(this.temporizadorRedireccionFacial);
      this.temporizadorRedireccionFacial = undefined;
    }
    this.mostrarModalFacial = false;
    this.pasoFacial = 1;
    this.fotoCapturada = '';
    this.cargandoFacial = false;
    this.cdr.detectChanges();
  }

  capturarYEnviarFacial(): void {
    const videoElement = document.getElementById('videoWebcam') as HTMLVideoElement;
    if (!videoElement) return;

    // 1. Capturar el fotograma directamente de la cámara antes de cambiar de paso
    // Se dibuja en espejo horizontal para que la foto capturada coincida con la vista selfie
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const imagenBase64 = canvas.toDataURL('image/jpeg', 0.95);
    this.fotoCapturada = imagenBase64;

    // 2. Activar la animación de escaneo en el paso 2
    this.pasoFacial = 2;
    this.cargandoFacial = true;
    this.mensajeFacial = '';
    this.cdr.detectChanges();

    // Verificación de rostro para inicio de sesión
    this.facialService.verificarRostro(imagenBase64).subscribe({
      next: (response) => {
        this.cargandoFacial = false;
        this.usuarioReconocido = response.usuario || { nombre: 'Usuario', rol: 'Autorizado' };

        // Guardamos sesión igual al login tradicional
        this.authService.guardarSesion(response);
        this.store.dispatch(loginAction({
          username: response.usuario?.correo || '',
          token: response.access || '',
          rol: response.usuario?.rol || '',
          nombre: `${response.usuario?.nombre || ''} ${response.usuario?.apellido || ''}`.trim(),
          id_usuario: response.usuario?.id_usuario || 0,
          institucion: '',
          mensaje: 'Inicio de sesión facial exitoso'
        }));

        this.pasoFacial = 3;
        this.cdr.detectChanges();

        // Redirección suave al dashboard correspondiente
        this.temporizadorRedireccionFacial = setTimeout(() => {
          this.continuarAccesoFacial();
        }, 2200);
      },
      error: (err) => {
        this.cargandoFacial = false;
        this.pasoFacial = 1;
        this.mensajeFacial = err.error?.detail || 'No se detectó ningún rostro en la cámara. Enfoca bien tu cara dentro del óvalo.';
        this.cdr.detectChanges();
      }
    });
  }

  continuarAccesoFacial(): void {
    if (this.modoFacial === 'registro') {
      this.modoFacial = 'login';
      this.pasoFacial = 1;
      this.fotoCapturada = '';
      this.mensajeFacial = '';
      this.cdr.detectChanges();
      return;
    }

    const rol = this.usuarioReconocido?.rol;
    this.cerrarCamaraFacial();

    if (this.authService.esSupervisor(rol)) {
      this.authService.limpiarInstitucionActiva?.();
      this.router.navigate(['/dashboard-supervisor']);
    } else if (this.authService.esJefa(rol)) {
      this.router.navigate(['/asistencia-diaria']);
    } else {
      this.router.navigate(['/inicio']);
    }
  }

}
