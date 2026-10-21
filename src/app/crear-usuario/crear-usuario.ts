import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '@core/auth';
import { UsuarioService } from '../services/usuario.service';
import { RolService } from '../services/rol.service';
import { BancoDatosService } from '../services/banco-datos.service';
import { SweetAlertService } from '../sweet-alert.service';
import { RolModel } from '@shared/models/rol.model';
import { environment } from '@env/environment';

@Component({
  selector: 'app-crear-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crear-usuario.html',
  styleUrls: ['./crear-usuario.css']
})
export class CrearUsuarioComponent implements OnInit {
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private rolService = inject(RolService);
  private bancoDatosService = inject(BancoDatosService);
  private sweetAlert = inject(SweetAlertService);
  private router = inject(Router);
  private http = inject(HttpClient);

  currentUser = this.authService.obtenerUsuario();
  esSuperAdmin = this.authService.esSuperAdministrador(this.currentUser?.rol);
  esAdmin = !this.esSuperAdmin && (
    this.authService.normalizarRol(this.currentUser?.rol) === 'administrador' ||
    this.authService.normalizarRol(this.currentUser?.rol) === 'admin'
  );

  rolesDisponibles: RolModel[] = [];
  institucionesDisponibles: any[] = [];
  sedesDisponibles: any[] = [];
  cargando = false;
  guardando = false;

  form = {
    nombre: '',
    apellido: '',
    correo: '',
    tipo_documento: 'CC',
    numero_documento: '',
    rol: null as number | null,
    id_institucion: null as number | null,
    id_sede: null as number | null,
    password: '',
    is_active: true,
    institucionesSupervisor: [] as number[]
  };

  rolSeleccionadoNombre = '';

  ngOnInit(): void {
    if (this.esAdmin && this.currentUser?.id_institucion) {
      this.form.id_institucion = this.currentUser.id_institucion;
    }
    this.cargarRoles();
    this.cargarCatalogos();
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (roles) => {
        const todos = Array.isArray(roles) ? roles : (roles as any)?.results || [];
        if (this.esSuperAdmin) {
          // Super Admin solo crea Administradores y Supervisores
          this.rolesDisponibles = todos.filter((r: any) => {
            const nom = (r.nombre || '').toLowerCase();
            return nom.includes('admin') || nom.includes('supervisor') || nom.includes('coordinador');
          });
        } else if (this.esAdmin) {
          // Administrador solo crea personal de cocina
          this.rolesDisponibles = todos.filter((r: any) => {
            const nom = (r.nombre || '').toLowerCase();
            return nom.includes('manipuladora') || nom.includes('jefa') || nom.includes('cocina');
          });
        } else {
          this.rolesDisponibles = todos;
        }
      },
      error: (err) => console.error('Error al cargar roles:', err)
    });
  }

  cargarCatalogos(): void {
    this.bancoDatosService.obtenerDatos('instituciones').subscribe({
      next: (res) => {
        this.institucionesDisponibles = Array.isArray(res) ? res : res?.results || [];
      },
      error: (err) => console.error('Error al cargar instituciones:', err)
    });

    this.bancoDatosService.obtenerDatos('sedes').subscribe({
      next: (res) => {
        const todas = Array.isArray(res) ? res : res?.results || [];
        if (this.esAdmin && this.currentUser?.id_institucion) {
          this.sedesDisponibles = todas.filter((s: any) => s.id_institucion === this.currentUser?.id_institucion);
        } else {
          this.sedesDisponibles = todas;
        }
      },
      error: (err) => console.error('Error al cargar sedes:', err)
    });
  }

  onRolChange(): void {
    const r = this.rolesDisponibles.find(x => x.id_rol === Number(this.form.rol));
    this.rolSeleccionadoNombre = (r?.nombre || '').toLowerCase();

    if (this.esSuperAdmin && !this.esRolAdmin()) {
      this.form.id_institucion = null;
    }
  }

  esRolAdmin(): boolean {
    return this.rolSeleccionadoNombre.includes('admin');
  }

  esRolSupervisor(): boolean {
    return this.rolSeleccionadoNombre.includes('supervisor') || this.rolSeleccionadoNombre.includes('coordinador');
  }

  toggleInstitucionSupervisor(id: number): void {
    const idx = this.form.institucionesSupervisor.indexOf(id);
    if (idx > -1) {
      this.form.institucionesSupervisor.splice(idx, 1);
    } else {
      this.form.institucionesSupervisor.push(id);
    }
  }

  institucionSeleccionada(id: number): boolean {
    return this.form.institucionesSupervisor.includes(id);
  }

  guardarUsuario(): void {
    if (!this.form.nombre.trim() || !this.form.correo.trim() || !this.form.numero_documento.trim() || !this.form.rol || !this.form.password.trim()) {
      this.sweetAlert.warning('Campos incompletos', 'Por favor completa todos los campos obligatorios (*).');
      return;
    }

    if (this.esSuperAdmin && this.esRolAdmin() && !this.form.id_institucion) {
      this.sweetAlert.warning('Institución requerida', 'Debes asignar una institución educativa al Administrador.');
      return;
    }

    if (this.esAdmin && !this.form.id_sede) {
      this.sweetAlert.warning('Sede requerida', 'Debes asignar la sede escolar donde prestará servicio la manipuladora.');
      return;
    }

    this.guardando = true;

    let nombre = this.form.nombre.trim();
    let apellido = this.form.apellido.trim();
    if (!apellido && nombre.includes(' ')) {
      const partes = nombre.split(' ');
      nombre = partes[0];
      apellido = partes.slice(1).join(' ');
    } else if (!apellido) {
      apellido = '.';
    }

    const payload: any = {
      nombre,
      apellido,
      correo: this.form.correo.trim().toLowerCase(),
      tipo_documento: this.form.tipo_documento,
      numero_documento: this.form.numero_documento.trim(),
      rol: Number(this.form.rol),
      password: this.form.password,
      is_active: this.form.is_active,
      id_institucion: this.form.id_institucion || null,
      id_sede: this.form.id_sede || null,
    };

    this.usuarioService.crearUsuario(payload).subscribe({
      next: (usuarioCreado: any) => {
        if (this.esRolSupervisor() && this.form.institucionesSupervisor.length > 0 && usuarioCreado?.id_usuario) {
          const supervisorId = usuarioCreado.id_usuario;
          this.form.institucionesSupervisor.forEach(instId => {
            this.http.post(`${environment.apiUrl}/supervisor-instituciones/`, {
              id_supervisor: supervisorId,
              id_institucion: instId
            }).subscribe({ error: (e) => console.error(e) });
          });
        }

        this.guardando = false;
        this.sweetAlert.success('Usuario registrado', 'El usuario ha sido dado de alta exitosamente.').then(() => {
          this.router.navigate(['/usuarios']);
        });
      },
      error: (err: any) => {
        this.guardando = false;
        console.error('Error al crear usuario:', err);
        const msg = err?.error?.detail ||
          (typeof err?.error === 'object' ? Object.values(err.error).flat().join(' ') : 'No se pudo crear el usuario.');
        this.sweetAlert.error('Error', msg);
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/usuarios']);
  }
}