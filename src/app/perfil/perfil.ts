import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, switchMap, timeout } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { UsuarioService } from '../services/usuario.service';

type VistaPerfil = 'perfil' | 'editar' | 'password';
type CambioGuardado = 'perfil' | 'password' | null;

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil.html',
})
export class PerfilComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  usuario: any = null;
  vista: VistaPerfil = 'perfil';
  cambioGuardado: CambioGuardado = null;
  guardando = false;
  errorMensaje = '';
  errorFoto = '';
  private datosPerfilInicial = { nombre: '', apellido: '', correo: '', telefono: '' };

  perfilForm = this.fb.group({
    nombre: [''],
    apellido: [''],
    correo: ['', Validators.email],
    telefono: [''],
  });

  passwordForm = this.fb.group({
    actual: ['', Validators.required],
    nueva: ['', [Validators.required, Validators.minLength(8)]],
    confirmar: ['', Validators.required],
  });

  ngOnInit(): void {
    this.usuario = this.authService.obtenerUsuario();
    if (!this.usuario) {
      void this.router.navigate(['/login']);
      return;
    }

    this.route.queryParamMap.subscribe((params) => {
      const vista = params.get('vista');
      this.vista = vista === 'editar' || vista === 'password' ? vista : 'perfil';
      this.cambioGuardado = null;
      this.errorMensaje = '';

      if (this.vista === 'editar') {
        this.cargarFormularioPerfil();
      } else if (this.vista === 'password') {
        this.passwordForm.reset();
      }
    });
  }

  get nombreCompleto(): string {
    const nombre = [this.usuario?.nombre, this.usuario?.apellido].filter(Boolean).join(' ');
    return nombre || this.usuario?.correo || 'Usuario SIRAE';
  }

  get rolNombre(): string {
    const rol = this.usuario?.rol;
    if (this.usuario?.is_superuser) return 'Super Admin';
    if (typeof rol === 'object' && rol) {
      return rol.nombre_rol || rol.nombre || rol.name || 'Usuario';
    }
    return this.usuario?.nombre_rol || this.usuario?.rol_nombre || (this.usuario?.is_staff ? 'Administrador' : 'Usuario');
  }

  get telefono(): string {
    return this.usuario?.telefono || this.usuario?.numero_telefono || this.usuario?.phone || 'No registrado';
  }

  get fotoPerfil(): string {
    return this.usuario?.fotoPerfilLocal
      || this.usuario?.foto_perfil
      || this.usuario?.avatar_url
      || this.usuario?.foto
      || '/administrador.png';
  }

  seleccionarFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    const formatosPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    const extensionPermitida = /\.(jpe?g|png|webp)$/i.test(archivo.name);
    if (!formatosPermitidos.includes(archivo.type) && !extensionPermitida) {
      this.errorFoto = 'Elige una imagen JPG, PNG o WebP.';
      input.value = '';
      return;
    }
    if (archivo.size > 8_000_000) {
      this.errorFoto = 'La imagen original debe pesar menos de 8 MB.';
      input.value = '';
      return;
    }

    void this.guardarFotoLocal(archivo);
    input.value = '';
  }

  private async guardarFotoLocal(archivo: File): Promise<void> {
    this.errorFoto = '';
    try {
      const imagen = await createImageBitmap(archivo);
      const dimensionMaxima = 512;
      const escala = Math.min(1, dimensionMaxima / Math.max(imagen.width, imagen.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(imagen.width * escala));
      canvas.height = Math.max(1, Math.round(imagen.height * escala));
      const contexto = canvas.getContext('2d');
      if (!contexto) throw new Error('No se pudo procesar la imagen.');

      contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      imagen.close();
      const fotoPerfilLocal = canvas.toDataURL('image/jpeg', 0.82);
      const usuarioActualizado = { ...this.usuario, fotoPerfilLocal };

      this.authService.guardarSesion({ usuario: usuarioActualizado });
      this.usuario = usuarioActualizado;
      this.errorFoto = '';
    } catch {
      this.errorFoto = 'No se pudo guardar la foto en este navegador. Prueba con otra imagen más pequeña.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  abrirVista(vista: VistaPerfil): void {
    this.errorMensaje = '';
    this.cambioGuardado = null;
    void this.router.navigate(['/perfil'], { queryParams: { vista } });
  }

  volverAlPerfil(): void {
    this.passwordForm.reset();
    this.abrirVista('perfil');
  }

  guardarPerfil(): void {
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    const idUsuario = this.obtenerIdUsuario();
    if (!idUsuario) {
      this.errorMensaje = 'No se encontró el identificador de tu usuario. Vuelve a iniciar sesión.';
      return;
    }

    const datosPerfil = this.perfilForm.getRawValue();
    const cambios: Record<string, string> = {};
    const campos: Array<keyof typeof this.datosPerfilInicial> = ['nombre', 'apellido', 'correo', 'telefono'];

    for (const campo of campos) {
      const valor = String(datosPerfil[campo] || '').trim();
      const normalizado = campo === 'correo' ? valor.toLowerCase() : valor;
      if (normalizado !== this.datosPerfilInicial[campo]) {
        cambios[campo] = normalizado;
      }
    }

    if (Object.keys(cambios).length === 0) {
      this.errorMensaje = 'No hay cambios para guardar.';
      return;
    }
    if (('nombre' in cambios && !cambios['nombre']) || ('apellido' in cambios && !cambios['apellido'])) {
      this.errorMensaje = 'Nombre y apellido no pueden quedar vacíos.';
      return;
    }
    if ('correo' in cambios && !cambios['correo']) {
      this.errorMensaje = 'El correo electrónico no puede quedar vacío.';
      return;
    }

    this.guardando = true;
    this.errorMensaje = '';
    this.usuarioService.actualizarUsuarioParcial(idUsuario, cambios).pipe(
      timeout({ first: 30000 }),
      finalize(() => {
        this.guardando = false;
        this.cdr.detectChanges();
      }),
    ).subscribe({
      next: (respuesta: any) => {
        const usuarioRespuesta = respuesta?.usuario || respuesta?.data || respuesta || {};
        this.usuario = { ...this.usuario, ...cambios, ...usuarioRespuesta };
        this.datosPerfilInicial = {
          nombre: String(this.usuario.nombre || '').trim(),
          apellido: String(this.usuario.apellido || '').trim(),
          correo: String(this.usuario.correo || '').trim().toLowerCase(),
          telefono: String(this.usuario.telefono || this.usuario.numero_telefono || this.usuario.phone || '').trim(),
        };
        try {
          this.authService.guardarSesion({ usuario: this.usuario });
        } catch {
          this.errorMensaje = 'El perfil se guardó, pero no se pudo actualizar la sesión local. Vuelve a iniciar sesión para sincronizarla.';
        }
        this.cambioGuardado = 'perfil';
      },
      error: (error) => {
        this.errorMensaje = error?.name === 'TimeoutError'
          ? 'El servidor no confirmó el guardado en 30 segundos. Revisa tus datos antes de volver a intentarlo.'
          : this.mensajeApi(error, 'No se pudieron guardar los cambios del perfil.');
      },
    });
  }

  cambiarContrasena(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { actual, nueva, confirmar } = this.passwordForm.getRawValue();
    if (nueva !== confirmar) {
      this.errorMensaje = 'La nueva contraseña y su confirmación no coinciden.';
      return;
    }

    const idUsuario = this.obtenerIdUsuario();
    if (!idUsuario || !this.usuario?.correo) {
      this.errorMensaje = 'No se encontró la información de tu cuenta. Vuelve a iniciar sesión.';
      return;
    }

    const datosUsuario: any = {
      ...this.usuario,
      rol: this.obtenerIdRol(),
      password: nueva,
    };
    delete datosUsuario.telefono;
    delete datosUsuario.numero_telefono;
    delete datosUsuario.phone;

    this.guardando = true;
    this.errorMensaje = '';
    this.authService.login({ correo: this.usuario.correo, clave: actual || '' }).pipe(
      switchMap(() => this.usuarioService.actualizarUsuario(idUsuario, datosUsuario)),
      timeout({ each: 30000 }),
      finalize(() => {
        this.guardando = false;
        this.cdr.detectChanges();
      }),
    ).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.cambioGuardado = 'password';
      },
      error: (error) => {
        this.errorMensaje = error.status === 401
          ? 'La contraseña actual no es correcta.'
          : error?.name === 'TimeoutError'
            ? 'El servidor no confirmó el cambio en 30 segundos. Vuelve a intentarlo.'
            : this.mensajeApi(error, 'No se pudo actualizar la contraseña.');
      },
    });
  }

  private cargarFormularioPerfil(): void {
    this.datosPerfilInicial = {
      nombre: String(this.usuario?.nombre || '').trim(),
      apellido: String(this.usuario?.apellido || '').trim(),
      correo: String(this.usuario?.correo || '').trim().toLowerCase(),
      telefono: String(this.usuario?.telefono || this.usuario?.numero_telefono || this.usuario?.phone || '').trim(),
    };
    this.perfilForm.reset({
      nombre: this.usuario?.nombre || '',
      apellido: this.usuario?.apellido || '',
      correo: this.usuario?.correo || '',
      telefono: this.usuario?.telefono || this.usuario?.numero_telefono || this.usuario?.phone || '',
    });
  }

  private obtenerIdUsuario(): number | null {
    const id = this.usuario?.id_usuario || this.usuario?.id || this.usuario?.pk || this.usuario?.user_id;
    return id ? Number(id) : null;
  }

  private obtenerIdRol(): number | string | null {
    const rol = this.usuario?.rol;
    if (rol && typeof rol === 'object') {
      return rol.id_rol || rol.id || rol.pk || null;
    }
    return rol ?? null;
  }

  private mensajeApi(error: any, fallback: string): string {
    const detalle = error?.error?.detail || error?.error?.message;
    if (detalle) return detalle;

    if (error?.error && typeof error.error === 'object') {
      const primerCampo = Object.values(error.error).flat()[0];
      if (typeof primerCampo === 'string') return primerCampo;
    }

    return fallback;
  }
}