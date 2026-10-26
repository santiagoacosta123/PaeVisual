import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { UsuarioService } from '../services/usuario.service';
import { RolService } from '../services/rol.service';
import { BancoDatosService } from '../services/banco-datos.service';
import { SweetAlertService } from '../sweet-alert.service';
import { CustomSelectComponent } from '../shared/custom-select/custom-select';
import { environment } from '@env/environment';

import { AuthService } from '@core/auth';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CustomSelectComponent],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.css', '../banco-datos/banco-datos.css']
})
export class UsuariosComponent implements OnInit {

  usuarios: any[] = [];
  roles: any[] = []; // Se llena dinámicamente desde la BD
  instituciones: any[] = [];
  sedes: any[] = [];

  readonly tiposDocumento = [
    { value: 'CC', label: 'Cédula de Ciudadanía' },
    { value: 'CE', label: 'Cédula de Extranjería' },
    { value: 'TI', label: 'Tarjeta de Identidad' }
  ];

  get opcionesFiltroRol(): any[] {
    return [
      { id_rol: '', nombre_rol: 'Todos los Roles' },
      ...(this.roles || [])
    ];
  }

  modoEdicion: boolean = false;
  usuarioSeleccionadoId?: number;
  mostrarModal: boolean = false;

  filtroTexto: string = '';
  filtroRol: string = '';

  usuarioForm: any = {
    nombre: '',
    apellido: '',
    correo: '',
    tipo_documento: 'CC',
    numero_documento: '',
    rol: '',
    id_institucion: null,
    id_sede: null,
    password: '',
    is_active: true
  };

  supervisorInstitucionesSeleccionadas: number[] = [];
  supervisorRelacionesOriginales: any[] = [];

  constructor(
    private usuarioService: UsuarioService,
    private rolService: RolService,
    private bancoDatosService: BancoDatosService,
    private sweetAlert: SweetAlertService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.cargarRoles();
    this.cargarUsuarios();
    this.cargarInstitucionesYSedes();
  }

  cargarInstitucionesYSedes(): void {
    this.bancoDatosService.obtenerDatos('instituciones').subscribe({
      next: (datos: any) => {
        this.instituciones = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar instituciones en usuarios:', err)
    });

    this.bancoDatosService.obtenerDatos('sedes').subscribe({
      next: (datos: any) => {
        this.sedes = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar sedes en usuarios:', err)
    });
  }

  esRolConInstitucion(): boolean {
    if (!this.usuarioForm.rol) return false;
    const nom = this.obtenerNombreRol(this.usuarioForm.rol).toLowerCase();
    return !nom.includes('super');
  }

  esRolRequiereInstitucion(): boolean {
    if (!this.usuarioForm.rol) return false;
    const nom = this.obtenerNombreRol(this.usuarioForm.rol).toLowerCase();
    return nom.includes('admin') && !nom.includes('super');
  }

  esRolSupervisor(): boolean {
    if (!this.usuarioForm.rol) return false;
    const nom = this.obtenerNombreRol(this.usuarioForm.rol).toLowerCase();
    return nom.includes('supervisor') || nom.includes('coordinador');
  }

  esRolAdmin(): boolean {
    if (!this.usuarioForm.rol) return false;
    const nom = this.obtenerNombreRol(this.usuarioForm.rol).toLowerCase();
    return nom.includes('admin') && !nom.includes('super');
  }

  // Helper: Saber si una institución ya tiene un Supervisor asignado diferente del que estamos editando
  institucionAsignadaAotroSupervisor(inst: any): boolean {
    if (!inst) return false;
    const supAsignado = inst.supervisor_asignado;
    if (!supAsignado) return false;
    if (this.modoEdicion && this.usuarioSeleccionadoId && Number(supAsignado.id_usuario) === Number(this.usuarioSeleccionadoId)) {
      return false;
    }
    return true;
  }

  nombreSupervisorAsignado(inst: any): string {
    return inst?.supervisor_asignado?.nombre_completo || 'Otro supervisor';
  }

  // Helper: Saber si una institución ya tiene un Administrador asignado diferente del que estamos editando
  institucionAsignadaAotroAdmin(inst: any): boolean {
    if (!inst) return false;
    const adminAsignado = inst.administrador_asignado;
    if (!adminAsignado) return false;
    if (this.modoEdicion && this.usuarioSeleccionadoId && Number(adminAsignado.id_usuario) === Number(this.usuarioSeleccionadoId)) {
      return false;
    }
    return true;
  }

  nombreAdminAsignado(inst: any): string {
    return inst?.administrador_asignado?.nombre_completo || 'Otro administrador';
  }

  get institucionesOpcionesAdmin(): any[] {
    return this.instituciones.map(inst => {
      const ocupado = this.institucionAsignadaAotroAdmin(inst);
      const ocupadoPor = ocupado ? ` (⚠️ Ocupada por: ${this.nombreAdminAsignado(inst)})` : '';
      return {
        ...inst,
        nombre_display: `${inst.nombre_institucion || inst.nombre}${ocupadoPor}`,
        deshabilitado: ocupado
      };
    });
  }

  toggleInstitucionSupervisor(inst: any): void {
    if (this.institucionAsignadaAotroSupervisor(inst)) {
      const nombre = this.nombreSupervisorAsignado(inst);
      this.sweetAlert.warning(
        'Institución Ocupada',
        `Esta institución ya se encuentra asignada al Supervisor ${nombre}. Cada institución solo puede tener un único Supervisor responsable.`
      );
      return;
    }
    const id = Number(inst.id_institucion || inst.id);
    const idx = this.supervisorInstitucionesSeleccionadas.indexOf(id);
    if (idx > -1) {
      this.supervisorInstitucionesSeleccionadas.splice(idx, 1);
    } else {
      this.supervisorInstitucionesSeleccionadas.push(id);
    }
    this.cdr.detectChanges();
  }

  institucionSupervisorSeleccionada(id: number): boolean {
    return this.supervisorInstitucionesSeleccionadas.includes(Number(id));
  }

  sincronizarInstitucionesSupervisor(supervisorId: number): void {
    const actuales = this.supervisorInstitucionesSeleccionadas.map(Number);
    const originales = this.supervisorRelacionesOriginales;

    originales.forEach((rel: any) => {
      const relInstId = typeof rel.id_institucion === 'object' ? (rel.id_institucion?.id_institucion || rel.id_institucion?.id) : rel.id_institucion;
      if (!actuales.includes(Number(relInstId))) {
        const relId = rel.id_supervisor_institucion || rel.id;
        if (relId) {
          this.http.delete(`${environment.apiUrl}/supervisor-instituciones/${relId}/`).subscribe({
            error: (err) => console.warn('Error al desvincular institución:', err)
          });
        }
      }
    });

    actuales.forEach((instId: number) => {
      const yaExiste = originales.some((rel: any) => {
        const relInstId = typeof rel.id_institucion === 'object' ? (rel.id_institucion?.id_institucion || rel.id_institucion?.id) : rel.id_institucion;
        return Number(relInstId) === Number(instId);
      });
      if (!yaExiste) {
        this.http.post(`${environment.apiUrl}/supervisor-instituciones/`, {
          id_supervisor: supervisorId,
          id_institucion: instId
        }).subscribe({
          error: (err) => console.warn('Error al vincular institución a supervisor:', err)
        });
      }
    });
  }

  esRolConSede(): boolean {
    if (!this.usuarioForm.rol) return false;
    const nom = this.obtenerNombreRol(this.usuarioForm.rol).toLowerCase();
    return nom.includes('manipuladora') || nom.includes('cocina');
  }

  get sedesDeInstitucionSeleccionada(): any[] {
    if (!this.usuarioForm.id_institucion) return [];
    const instId = Number(this.usuarioForm.id_institucion);
    return this.sedes.filter(s => {
      const sInstId = typeof s.id_institucion === 'object' && s.id_institucion !== null
        ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
        : s.id_institucion;
      return Number(sInstId) === instId;
    });
  }

  onInstitucionChange(): void {
    if (this.usuarioForm.id_sede) {
      const existe = this.sedesDeInstitucionSeleccionada.some(
        s => (s.id_sede || s.id) === Number(this.usuarioForm.id_sede)
      );
      if (!existe) {
        this.usuarioForm.id_sede = null;
      }
    }
  }

  cargarUsuarios(): void {
    this.usuarioService.getUsuarios().subscribe({
      next: (datos: any[]) => {
        this.usuarios = Array.isArray(datos) ? datos : (datos as any).results || [];
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
        this.sweetAlert.error('Error', 'No se pudieron cargar los usuarios del sistema.');
      }
    });
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (datos: any) => {
        const rolesApi = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        // Normalizamos las propiedades para soportar id_rol / id y nombre_rol / nombre
        const normalizados = rolesApi.map((r: any) => ({
          id_rol: r.id_rol || r.id || r.pk,
          nombre_rol: r.nombre_rol || r.nombre || r.name
        }));

        const usuarioActual = this.authService.obtenerUsuario();
        const esSuper = this.authService.esSuperAdministrador(usuarioActual?.rol);
        const esAdmin = this.authService.esAdministrador(usuarioActual?.rol);

        if (esSuper) {
          // El Super Administrador SOLO crea y asigna Administradores y Supervisores
          this.roles = normalizados.filter((r: any) => {
            const nom = (r.nombre_rol || '').toLowerCase();
            const esAdminRol = (nom === 'administrador' || nom === 'admin' || (nom.includes('admin') && !nom.includes('super')));
            const esSupervRol = nom.includes('supervisor') || nom.includes('coordinador');
            return esAdminRol || esSupervRol;
          });
        } else if (esAdmin) {
          // El Administrador de colegio solo crea personal de cocina
          this.roles = normalizados.filter((r: any) => {
            const nom = (r.nombre_rol || '').toLowerCase();
            return nom.includes('manipuladora') || nom.includes('jefa') || nom.includes('cocina');
          });
        } else {
          this.roles = normalizados;
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar los roles:', error);
        this.sweetAlert.error('Atención', 'No se pudieron sincronizar los roles desde la base de datos.');
      }
    });
  }

  obtenerNombreRol(idRol: any): string {
    if (!idRol) return 'Sin Rol';
    const idBuscado = typeof idRol === 'object' ? (idRol.id_rol || idRol.id || idRol.pk) : idRol;
    const rolEncontrado = this.roles.find(r => r.id_rol == idBuscado);
    if (!rolEncontrado) return typeof idRol === 'object' ? (idRol.nombre_rol || idRol.nombre || 'Rol') : `Rol ID: ${idRol}`;
    
    return rolEncontrado.nombre_rol;
  }

  get usuariosFiltrados(): any[] {
    return this.usuarios.filter(u => {
      const textoMatch = 
        (u.nombre?.toLowerCase() || '').includes(this.filtroTexto.toLowerCase()) ||
        (u.apellido?.toLowerCase() || '').includes(this.filtroTexto.toLowerCase()) ||
        (u.numero_documento || '').includes(this.filtroTexto) ||
        (u.correo?.toLowerCase() || '').includes(this.filtroTexto.toLowerCase());
      
      const uRolId = typeof u.rol === 'object' ? (u.rol?.id_rol || u.rol?.id || u.rol?.pk) : u.rol;
      const rolMatch = this.filtroRol ? uRolId?.toString() === this.filtroRol.toString() : true;

      return textoMatch && rolMatch;
    });
  }

  abrirFormulario(usuario?: any): void {
    this.mostrarModal = true;
    this.supervisorInstitucionesSeleccionadas = [];
    this.supervisorRelacionesOriginales = [];
    
    if (usuario) {
      this.modoEdicion = true;
      this.usuarioSeleccionadoId = usuario.id_usuario || usuario.id || usuario.pk || usuario.user_id;
      const rolValor = typeof usuario.rol === 'object' ? (usuario.rol?.id_rol || usuario.rol?.id || usuario.rol?.pk) : usuario.rol;
      const instValor = typeof usuario.id_institucion === 'object' 
        ? (usuario.id_institucion?.id_institucion || usuario.id_institucion?.id) 
        : usuario.id_institucion;
      const sedeValor = typeof usuario.id_sede === 'object'
        ? (usuario.id_sede?.id_sede || usuario.id_sede?.id)
        : usuario.id_sede;

      this.usuarioForm = { 
        ...usuario, 
        rol: Number(rolValor) || '',
        id_institucion: instValor ? Number(instValor) : null,
        id_sede: sedeValor ? Number(sedeValor) : null,
        password: '' 
      };

      if (this.esRolSupervisor() && this.usuarioSeleccionadoId) {
        this.http.get<any[]>(`${environment.apiUrl}/supervisor-instituciones/?id_supervisor=${this.usuarioSeleccionadoId}`).subscribe({
          next: (rels: any) => {
            const lista = Array.isArray(rels) ? rels : (rels.results || []);
            this.supervisorRelacionesOriginales = lista;
            this.supervisorInstitucionesSeleccionadas = lista.map((r: any) => {
              const instId = typeof r.id_institucion === 'object' ? (r.id_institucion?.id_institucion || r.id_institucion?.id) : r.id_institucion;
              return Number(instId);
            });
            this.cdr.detectChanges();
          },
          error: (err) => console.error('Error al cargar instituciones del supervisor:', err)
        });
      }
      return;
    }
    
    this.modoEdicion = false;
    this.usuarioSeleccionadoId = undefined;
    
    this.usuarioForm = {
      nombre: '',
      apellido: '',
      correo: '',
      tipo_documento: 'CC',
      numero_documento: '',
      rol: '',
      id_institucion: null,
      id_sede: null,
      password: '',
      is_active: true
    };
  }

  cerrarFormulario(): void {
    this.mostrarModal = false;
  }

  private formatearMensajeError(err: any): string {
    if (err.error) {
      if (typeof err.error === 'object') {
        const primerCampo = Object.keys(err.error)[0];
        const detalle = err.error[primerCampo];
        if (Array.isArray(detalle)) {
          return `${primerCampo.replace(/_/g, ' ')}: ${detalle[0]}`;
        } else if (typeof detalle === 'string') {
          return detalle;
        }
      } else if (typeof err.error === 'string') {
        return err.error;
      }
    }
    return 'Ocurrió un error inesperado en el servidor.';
  }

  guardarUsuario(): void {
    if (!this.usuarioForm.nombre || !this.usuarioForm.apellido || !this.usuarioForm.correo || !this.usuarioForm.numero_documento || !this.usuarioForm.rol) {
      this.sweetAlert.warning('Campos incompletos', 'Por favor llena todos los campos obligatorios incluyendo el rol.');
      return;
    }

    if (this.esRolRequiereInstitucion() && !this.usuarioForm.id_institucion) {
      this.sweetAlert.warning('Institución requerida', 'Debes seleccionar la institución educativa a la que pertenecerá el administrador.');
      return;
    }

    if (this.esRolAdmin() && this.usuarioForm.id_institucion) {
      const instSel = this.instituciones.find(i => Number(i.id_institucion || i.id) === Number(this.usuarioForm.id_institucion));
      if (instSel && this.institucionAsignadaAotroAdmin(instSel)) {
        this.sweetAlert.warning(
          'Institución con Administrador',
          `La institución "${instSel.nombre_institucion || instSel.nombre}" ya tiene asignado al Administrador ${this.nombreAdminAsignado(instSel)}. Cada institución solo puede tener un único Administrador activo.`
        );
        return;
      }
    }

    const datosEnviar: any = {
      ...this.usuarioForm,
      rol: Number(this.usuarioForm.rol),
      id_institucion: this.usuarioForm.id_institucion ? Number(this.usuarioForm.id_institucion) : null,
      id_sede: this.usuarioForm.id_sede ? Number(this.usuarioForm.id_sede) : null
    };

    if (this.modoEdicion && this.usuarioSeleccionadoId) {
      if (!datosEnviar.password || datosEnviar.password.trim() === '') {
        delete datosEnviar.password;
      }

      const idEditando = this.usuarioSeleccionadoId;
      this.usuarioService.actualizarUsuario(idEditando, datosEnviar).subscribe({
        next: () => {
          if (this.esRolSupervisor()) {
            this.sincronizarInstitucionesSupervisor(idEditando);
          }
          this.sweetAlert.success('¡Actualizado!', 'El usuario se actualizó correctamente.');
          this.cerrarFormulario();
          this.cargarUsuarios();
        },
        error: (err) => {
          const mensajeError = this.formatearMensajeError(err);
          this.sweetAlert.error('Error de Servidor', mensajeError);
        }
      });
    } else {
      if (!datosEnviar.password) {
        this.sweetAlert.warning('Contraseña requerida', 'Debes ingresar una contraseña para registrar el usuario.');
        return;
      }

      this.usuarioService.crearUsuario(datosEnviar).subscribe({
        next: (nuevoUsuario: any) => {
          const nuevoId = nuevoUsuario?.id_usuario || nuevoUsuario?.id;
          if (this.esRolSupervisor() && nuevoId) {
            this.sincronizarInstitucionesSupervisor(nuevoId);
          }
          this.sweetAlert.success('¡Creado!', 'El usuario se registró correctamente.');
          this.cerrarFormulario();
          this.cargarUsuarios();
        },
        error: (err) => {
          const mensajeError = this.formatearMensajeError(err);
          this.sweetAlert.error('Error de Servidor', mensajeError);
        }
      });
    }
  }

  editarUsuario(usuario: any): void {
    this.abrirFormulario(usuario);
  }

  toggleEstadoUsuario(usuario: any): void {
    const id = usuario.id_usuario || usuario.id || usuario.pk || usuario.user_id;
    if (!id) {
      this.sweetAlert.error('Error', 'Este usuario no tiene un ID válido.');
      return;
    }

    const nuevoEstado = !usuario.is_active;
    const datosEnviar = {
      is_active: nuevoEstado
    };

    this.usuarioService.actualizarUsuario(id, datosEnviar).subscribe({
      next: () => {
        usuario.is_active = nuevoEstado;
        this.sweetAlert.success(
          nuevoEstado ? 'Usuario activado' : 'Usuario inactivado',
          `El usuario ahora está ${nuevoEstado ? 'Activo' : 'Inactivo'}.`
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        const mensajeError = this.formatearMensajeError(err);
        this.sweetAlert.error('Error al cambiar estado', mensajeError);
        this.cdr.detectChanges();
      }
    });
  }

  eliminarUsuario(usuario: any): void {
    const id = usuario.id_usuario || usuario.id || usuario.pk || usuario.user_id;
    if (!id) {
      this.sweetAlert.error('Error', 'Este usuario no tiene un ID válido para eliminar.');
      return;
    }

    this.sweetAlert.confirm('¿Eliminar usuario?', `¿Deseas eliminar a ${usuario.nombre}?`, 'Sí, eliminar')
      .then((result: any) => {
        if (result.isConfirmed) {
          this.usuarioService.eliminarUsuario(id).subscribe({
            next: () => {
              this.sweetAlert.success('Eliminado', 'El usuario fue eliminado con éxito.');
              this.cargarUsuarios();
            },
            error: (err) => {
              const mensajeError = this.formatearMensajeError(err);
              this.sweetAlert.error('Error de Servidor', mensajeError);
            }
          });
        }
      });
  }
}