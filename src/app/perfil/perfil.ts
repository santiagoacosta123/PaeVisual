import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, AuthenticatedUser } from '../core/auth/auth.service';
import { SweetAlertService } from '../core/services/sweet-alert.service';
import { ReconocimientoFacialService } from '../services/reconocimiento-facial.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.css']
})
export class PerfilComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sweetAlert = inject(SweetAlertService);
  private cdr = inject(ChangeDetectorRef);
  private facialService = inject(ReconocimientoFacialService);

  cargando = false;
  guardando = false;
  modoEdicion = false;
  mensajeExito = '';
  mensajeError = '';

  // Control de pestañas en la interfaz
  tabActiva: 'info' | 'facial' | 'seguridad' = 'info';

  // Variables para Cambio de Contraseña
  passwordForm = {
    actual: '',
    nueva: '',
    confirmar: ''
  };
  passwordProcesando = false;
  passwordError = '';
  passwordMensaje = '';

  // Variables para Reconocimiento Facial Biométrico en Perfil
  tieneBiometria = false;
  cargandoBiometria = false;
  mostrarModalFacial = false;
  pasoFacial: 1 | 2 | 3 = 1;
  fotoCapturada = '';
  mensajeFacial = '';
  cargandoFacial = false;
  streamVideo: MediaStream | null = null;

  // Criterio 1: Datos actuales del usuario autenticado
  usuario: AuthenticatedUser | null = null;

  // Criterios 2 y 4: Formulario reactivo con campos autorizados y validaciones
  perfilForm: FormGroup = this.fb.group({
    nombre: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\-]+$/)
      ]
    ],
    apellido: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\-]+$/)
      ]
    ]
  });

  ngOnInit(): void {
    this.cargarDatosUsuario();
    this.consultarBiometria();
  }

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      void this.sweetAlert.warning('Archivo no válido', 'Por favor selecciona una imagen válida (JPG o PNG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.authService.actualizarPerfil({ foto_perfil: base64 }).subscribe({
        next: () => {
          if (this.usuario) {
            this.usuario.foto_perfil = base64;
          }
          void this.sweetAlert.success('Foto actualizada', 'Tu foto de perfil se guardó correctamente.');
          this.cdr.detectChanges();
        },
        error: () => {
          void this.sweetAlert.error('Error', 'No se pudo guardar la foto de perfil en el servidor.');
        }
      });
    };
    reader.readAsDataURL(file);
  }

  eliminarFotoPerfil(): void {
    this.authService.actualizarPerfil({ foto_perfil: '' }).subscribe({
      next: () => {
        if (this.usuario) {
          this.usuario.foto_perfil = null;
        }
        void this.sweetAlert.success('Foto eliminada', 'Se restableció el avatar por defecto.');
        this.cdr.detectChanges();
      },
      error: () => {
        void this.sweetAlert.error('Error', 'No fue posible eliminar la foto de perfil.');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.streamVideo) {
      this.streamVideo.getTracks().forEach(track => track.stop());
      this.streamVideo = null;
    }
  }

  get nombreControl() {
    return this.perfilForm.get('nombre');
  }

  get apellidoControl() {
    return this.perfilForm.get('apellido');
  }

  get esSuperAdmin(): boolean {
    return this.authService.esSuperAdministrador(this.usuario?.rol);
  }

  /**
   * Criterio 1: Visualización de datos actuales desde el backend (/api/usuarios/me/)
   */
  cargarDatosUsuario(): void {
    this.cargando = true;
    this.usuario = this.authService.obtenerUsuario();

    this.authService.obtenerPerfil().subscribe({
      next: (perfilServidor) => {
        if (perfilServidor) {
          this.usuario = perfilServidor;
        }
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // En caso de modo offline o indisponibilidad temporal, conservar usuario local
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Criterios 2 y 3: Activación del formulario reactivo y precarga de información actual
   */
  activarEdicion(): void {
    this.mensajeExito = '';
    this.mensajeError = '';
    const u = this.usuario || this.authService.obtenerUsuario();

    this.perfilForm.patchValue({
      nombre: u?.nombre || '',
      apellido: u?.apellido || '',
    });
    this.perfilForm.markAsPristine();
    this.perfilForm.markAsUntouched();
    this.modoEdicion = true;
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.mensajeError = '';
    this.mensajeExito = '';
    this.perfilForm.reset();
  }

  /**
   * Criterios 4, 5 y 6: Validación previa, restricción de campos protegidos y retroalimentación
   */
  guardarCambios(): void {
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      this.mensajeError = 'Por favor verifica los campos obligatorios. El nombre y apellido deben tener al menos 2 letras válidas.';
      void this.sweetAlert.warning('Formulario incompleto', this.mensajeError);
      return;
    }

    this.guardando = true;
    this.mensajeError = '';
    this.mensajeExito = '';

    const { nombre, apellido } = this.perfilForm.value;

    // Criterio 5: Solo se transmiten los campos autorizados para autogestión
    this.authService.actualizarPerfil({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
    }).subscribe({
      next: (actualizado) => {
        this.guardando = false;
        this.modoEdicion = false;
        if (this.usuario) {
          this.usuario = {
            ...this.usuario,
            nombre: actualizado.nombre ?? nombre.trim(),
            apellido: actualizado.apellido ?? apellido.trim(),
          };
        }
        this.mensajeExito = 'Perfil actualizado exitosamente.';
        void this.sweetAlert.success('Perfil actualizado', 'Tus datos se guardaron correctamente.');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.guardando = false;
        const detalle = err.error?.nombre?.[0]
          || err.error?.apellido?.[0]
          || err.error?.detail
          || err.message
          || 'No fue posible guardar los cambios en el servidor.';
        this.mensajeError = detalle;
        void this.sweetAlert.error('Error al actualizar', detalle);
        this.cdr.detectChanges();
      }
    });
  }

  // ==========================================
  // RECONOCIMIENTO FACIAL BIOMÉTRICO (PERFIL)
  // ==========================================

  consultarBiometria(): void {
    this.cargandoBiometria = true;
    this.facialService.consultarEstadoBiometria().subscribe({
      next: (res) => {
        this.tieneBiometria = Boolean(res?.tiene_biometria);
        this.cargandoBiometria = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoBiometria = false;
        this.cdr.detectChanges();
      }
    });
  }

  async abrirModalFacial(): Promise<void> {
    this.pasoFacial = 1;
    this.fotoCapturada = '';
    this.mensajeFacial = '';
    this.cargandoFacial = false;
    this.mostrarModalFacial = true;
    this.cdr.detectChanges();

    try {
      this.streamVideo = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      setTimeout(() => {
        const videoElement = document.getElementById('videoWebcamPerfil') as HTMLVideoElement;
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

  cerrarModalFacial(): void {
    if (this.streamVideo) {
      this.streamVideo.getTracks().forEach(track => track.stop());
      this.streamVideo = null;
    }
    this.mostrarModalFacial = false;
    this.pasoFacial = 1;
    this.fotoCapturada = '';
    this.cargandoFacial = false;
    this.mensajeFacial = '';
    this.cdr.detectChanges();
  }

  capturarYRegistrarRostro(): void {
    const videoElement = document.getElementById('videoWebcamPerfil') as HTMLVideoElement;
    if (!videoElement) return;

    // 1. Capturar el fotograma directamente de la cámara en espejo horizontal
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

    // 3. Registrar biometría en el backend
    this.facialService.registrarRostro(imagenBase64).subscribe({
      next: () => {
        this.cargandoFacial = false;
        this.tieneBiometria = true;
        this.pasoFacial = 3;
        void this.sweetAlert.success('Rostro registrado', 'Tu biometría facial se vinculó exitosamente a tu cuenta.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoFacial = false;
        this.pasoFacial = 1;
        this.mensajeFacial = err.error?.detail || 'No se detectó un rostro claro en la imagen. Enfoca bien la cámara e inténtalo de nuevo.';
        this.cdr.detectChanges();
      }
    });
  }

  async confirmarEliminarBiometria(): Promise<void> {
    const result = await this.sweetAlert.confirm(
      '¿Desvincular rostro?',
      'Si eliminas tu biometría facial, no podrás iniciar sesión con tu rostro y deberás usar tu contraseña.',
      'Sí, desvincular'
    );
    if (result.isConfirmed) {
      this.facialService.eliminarBiometria().subscribe({
        next: () => {
          this.tieneBiometria = false;
          void this.sweetAlert.success('Biometría eliminada', 'Tu rostro ha sido desvinculado.');
          this.cdr.detectChanges();
        },
        error: () => {
          void this.sweetAlert.error('Error', 'No fue posible eliminar la biometría facial.');
        }
      });
    }
  }

  // ==========================================
  // CAMBIO DE CONTRASEÑA EN PERFIL
  // ==========================================
  cambiarPassword(): void {
    this.passwordError = '';
    this.passwordMensaje = '';

    if (!this.passwordForm.actual || !this.passwordForm.nueva || !this.passwordForm.confirmar) {
      this.passwordError = 'Por favor completa todos los campos requeridos.';
      void this.sweetAlert.warning('Campos incompletos', this.passwordError);
      return;
    }
    if (this.passwordForm.nueva !== this.passwordForm.confirmar) {
      this.passwordError = 'Las nuevas contraseñas no coinciden.';
      void this.sweetAlert.warning('Contraseñas no coinciden', this.passwordError);
      return;
    }

    this.passwordProcesando = true;
    this.authService.cambiarContrasena({
      password_actual: this.passwordForm.actual,
      nueva_password: this.passwordForm.nueva,
      confirmar_password: this.passwordForm.confirmar,
    }).subscribe({
      next: (res: any) => {
        this.passwordProcesando = false;
        this.passwordMensaje = res.mensaje || 'Contraseña actualizada correctamente.';
        this.passwordForm = { actual: '', nueva: '', confirmar: '' };
        void this.sweetAlert.success('Contraseña actualizada', this.passwordMensaje);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.passwordProcesando = false;
        this.passwordError = err.error?.error || err.error?.detail || 'No fue posible actualizar la contraseña.';
        void this.sweetAlert.error('Error', this.passwordError);
        this.cdr.detectChanges();
      }
    });
  }
}
