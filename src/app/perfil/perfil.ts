import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, AuthenticatedUser } from '../core/auth/auth.service';
import { SweetAlertService } from '../core/services/sweet-alert.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.css']
})
export class PerfilComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sweetAlert = inject(SweetAlertService);
  private cdr = inject(ChangeDetectorRef);

  cargando = false;
  guardando = false;
  modoEdicion = false;
  mensajeExito = '';
  mensajeError = '';

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
  }

  get nombreControl() {
    return this.perfilForm.get('nombre');
  }

  get apellidoControl() {
    return this.perfilForm.get('apellido');
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
}
