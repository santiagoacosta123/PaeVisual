import { Component, OnInit, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SiraeService } from '../services/contratos_pae.service';
import { UsuarioService } from '../services/usuario.service';
import { RolService } from '../services/rol.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { CustomSelectComponent } from '../shared/custom-select/custom-select';

@Component({
  selector: 'app-contrato-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './contrato-detalle.html',
  styleUrls: ['./contrato-detalle.css']
})
export class ContratoDetalleComponent implements OnInit {
  @Input() contratoId: string | null = null;
  @Output() cerrar = new EventEmitter<void>();
  
  pestanaActiva = 'jornadas'; // 'jornadas', 'secciones', 'turnos'

  jornadas: any[] = [];
  seccionesMenu: any[] = [];
  contratosSeccionMenu: any[] = [];
  supervisores: any[] = [];
  cargandoSupervisores = false;
  rolesCatalogo: any[] = [];
  contrato: any = { 
    codigo: '', 
    institucion: '', 
    zona: 'Norte', 
    fecha_inicio: '', 
    fecha_fin: '', 
    estado: 'Activo',
    cupos: 0,
    id_usuario_supervisor: null 
  };
  jornadaSeleccionada: any = null;

  get nombreSupervisorAsignado(): string {
    if (!this.contrato?.id_usuario_supervisor) return 'Sin asignar';
    const sup = this.supervisores.find(s => Number(s.id_usuario) === Number(this.contrato.id_usuario_supervisor));
    return sup ? sup.nombre_completo : `Supervisor #${this.contrato.id_usuario_supervisor}`;
  }

  readonly zonasDisponibles: string[] = [
    'Norte',
    'Sur',
    'Este',
    'Oeste',
    'Centro',
    'Oriente',
    'Occidente',
    'Nororiente',
    'Noroccidente',
    'Suroriente',
    'Suroccidente',
    'Urbana',
    'Rural'
  ];

  get opcionesZona(): string[] {
    const actual = this.contrato?.zona;
    if (actual && !this.zonasDisponibles.includes(actual)) {
      return [actual, ...this.zonasDisponibles];
    }
    return this.zonasDisponibles;
  }

  instituciones: any[] = [];
  sedes: any[] = [];
  sedesInstitucion: any[] = [];

  get jornadasHabilitadas() {
    return this.jornadas.filter(j => j.habilitada);
  }

  get resumenServiciosPorJornada() {
    const resumen: any = {};
    this.jornadasHabilitadas.forEach(j => {
      const nombre = j.nombre_jornada || j.nombre;
      const secciones = this.seccionesDeJornada(j);
      let count = 0;
      secciones.forEach(s => {
        if (this.estaSeccionAsignada(s.id_seccion || s.id)) {
          count++;
        }
      });
      resumen[nombre] = count;
    });
    return Object.keys(resumen).map(k => ({ jornada: k, total: resumen[k] }));
  }

  get totalAsignados() {
    return this.contratosSeccionMenu.length;
  }

  get seccionesDeshabilitadasPorFiltro() {
    if (!this.jornadaSeleccionada) return [];
    const idJornadaFiltro = this.jornadaSeleccionada.id_jornada || this.jornadaSeleccionada.id;

    return this.seccionesMenu.filter(s => {
      const sJornadaId = (typeof s.id_jornada === 'object' && s.id_jornada !== null) ? (s.id_jornada.id_jornada || s.id_jornada.id) : (s.id_jornada || s.jornada);
      return sJornadaId !== idJornadaFiltro;
    });
  }

  get institucionSeleccionadaInfo(): any {
    if (!this.contrato?.institucion) return null;
    return this.instituciones.find(i =>
      i.nombre_institucion?.toLowerCase() === this.contrato.institucion?.toLowerCase()
    );
  }

  mostrarSedesDetalle = false;
  modalSeleccionarInstitucionAbierto = false;
  busquedaInstitucion = '';
  institucionTemporalSeleccionada: any = null;

  toggleMostrarSedes(): void {
    this.mostrarSedesDetalle = !this.mostrarSedesDetalle;
    this.cdr.detectChanges();
  }

  abrirModalSeleccionarInstitucion(): void {
    this.busquedaInstitucion = '';
    this.institucionTemporalSeleccionada = this.instituciones.find(i =>
      i.nombre_institucion?.toLowerCase() === this.contrato.institucion?.toLowerCase()
    ) || null;
    this.modalSeleccionarInstitucionAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalSeleccionarInstitucion(): void {
    this.modalSeleccionarInstitucionAbierto = false;
    this.cdr.detectChanges();
  }

  marcarInstitucion(inst: any): void {
    this.institucionTemporalSeleccionada = inst;
    this.cdr.detectChanges();
  }

  seleccionarInstitucionDesdeModal(inst: any): void {
    this.institucionTemporalSeleccionada = inst;
    this.contrato.institucion = inst.nombre_institucion;
    this.onInstitucionChange();
    this.cerrarModalSeleccionarInstitucion();
  }

  confirmarSeleccionInstitucion(): void {
    if (this.institucionTemporalSeleccionada) {
      this.contrato.institucion = this.institucionTemporalSeleccionada.nombre_institucion;
      this.onInstitucionChange();
    }
    this.cerrarModalSeleccionarInstitucion();
  }

  deseleccionarInstitucion(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.contrato.institucion = '';
    this.institucionTemporalSeleccionada = null;
    this.onInstitucionChange();
    this.cdr.detectChanges();
  }

  get institucionesFiltradasModal(): any[] {
    const q = this.busquedaInstitucion.trim().toLowerCase();
    if (!q) return this.instituciones;
    return this.instituciones.filter(i =>
      (i.nombre_institucion && i.nombre_institucion.toLowerCase().includes(q)) ||
      (i.nit && i.nit.toLowerCase().includes(q)) ||
      (i.representante_legal && i.representante_legal.toLowerCase().includes(q))
    );
  }

  obtenerSedesDeInst(inst: any): any[] {
    const instId = inst?.id_institucion || inst?.id;
    return this.sedes.filter(s => {
      const sInstId = typeof s.id_institucion === 'object' && s.id_institucion !== null
        ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
        : s.id_institucion;
      return Number(sInstId) === Number(instId);
    });
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private siraeService: SiraeService,
    private usuarioService: UsuarioService,
    private rolService: RolService,
    private authService: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      if (!this.contratoId) {
        this.contratoId = params.get('id');
      }
      this.cargarDatosMaestros();
      this.cargarDetalleContrato();
    });
  }

  seleccionarPestana(pestana: string) {
    this.pestanaActiva = pestana;
    this.cdr.detectChanges();
  }

  cargarDatosMaestros() {
    // 1. Cargar Jornadas con normalización
    this.siraeService.getJornadas().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.jornadas = res.map((j: any) => ({ ...j, habilitada: false }));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('API de jornadas no encontrada o con error, usando datos temporales...', err);
        this.cdr.detectChanges();
      }
    });

    // 2. Cargar Secciones de Menú con normalización
    this.siraeService.getSeccionesMenu().subscribe({
      next: (datos: any) => {
        this.seccionesMenu = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando secciones de menú:', err);
        this.cdr.detectChanges();
      }
    });

    // 3. Cargar Instituciones reales
    this.siraeService.getInstituciones().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.instituciones = res;
        this.actualizarSedesDeInstitucion();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando instituciones en detalle:', err);
        this.cdr.detectChanges();
      }
    });

    // 4. Cargar Sedes reales
    this.siraeService.getSedes().subscribe({
      next: (datos: any) => {
        const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        this.sedes = res;
        this.actualizarSedesDeInstitucion();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando sedes en detalle:', err);
        this.cdr.detectChanges();
      }
    });

    // 5. Cargar Supervisores disponibles
    this.cargarSupervisores();
  }

  cargarSupervisores(): void {
    this.cargandoSupervisores = true;
    const token = this.authService.obtenerToken()?.replace(/^(Bearer|Token)\s+/i, '').trim();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);

    // 1. Cargar catálogo de roles para resolver IDs de supervisor
    this.rolService.getRoles().subscribe({
      next: (datosRoles: any) => {
        const rolesArr = Array.isArray(datosRoles) ? datosRoles : (datosRoles.results || datosRoles.data || []);
        this.rolesCatalogo = rolesArr.map((r: any) => ({
          id_rol: Number(r.id_rol || r.id || r.pk),
          nombre: (r.nombre_rol || r.nombre || '').toLowerCase()
        }));
        this.obtenerUsuariosSupervisores(headers);
      },
      error: () => {
        this.obtenerUsuariosSupervisores(headers);
      }
    });
  }

  private obtenerUsuariosSupervisores(headers: HttpHeaders): void {
    this.http.get<any[]>(`${environment.apiUrl}/usuarios/`, { headers }).subscribe({
      next: (datos: any) => {
        this.procesarUsuariosSupervisores(datos);
      },
      error: (errHttp) => {
        console.warn('Fallo petición directa a /usuarios/, intentando usuarioService:', errHttp);
        this.usuarioService.getUsuarios().subscribe({
          next: (datosFallback: any) => {
            this.procesarUsuariosSupervisores(datosFallback);
          },
          error: (err) => {
            console.error('Error al cargar supervisores:', err);
            this.cargandoSupervisores = false;
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  private procesarUsuariosSupervisores(datos: any): void {
    const res = Array.isArray(datos) ? datos : (datos.results || datos.data || []);

    // IDs de roles que corresponden a supervisor o coordinador
    const supervisorRolIds = this.rolesCatalogo
      .filter(r => r.nombre.includes('supervisor') || r.nombre.includes('coordinador'))
      .map(r => r.id_rol);

    const filtrados = res.filter((u: any) => {
      // 1. Chequeo por rol_detalle
      const nomDetalle = (u.rol_detalle?.nombre_rol || u.rol_detalle?.nombre || u.rol_nombre || '').toLowerCase();
      if (nomDetalle && (nomDetalle.includes('supervisor') || nomDetalle.includes('coordinador'))) return true;

      // 2. Chequeo por rol string
      if (typeof u.rol === 'string') {
        const r = u.rol.toLowerCase();
        if (r.includes('supervisor') || r.includes('coordinador')) return true;
      }

      // 3. Chequeo por rol objeto
      if (typeof u.rol === 'object' && u.rol !== null) {
        const r = (u.rol.nombre_rol || u.rol.nombre || '').toLowerCase();
        if (r.includes('supervisor') || r.includes('coordinador')) return true;
      }

      // 4. Chequeo por ID en roles cargados o ID 27 por defecto
      const idRol = typeof u.rol === 'object' ? (u.rol?.id_rol || u.rol?.id) : Number(u.rol);
      if (idRol && (supervisorRolIds.includes(idRol) || idRol === 27)) return true;

      // 5. Si tiene instituciones_supervisor asignadas
      if (Array.isArray(u.instituciones_supervisor) && u.instituciones_supervisor.length > 0) return true;

      // 6. Si el correo contiene 'supervisor'
      if (u.correo && typeof u.correo === 'string' && u.correo.toLowerCase().includes('supervisor')) return true;

      return false;
    });

    this.supervisores = filtrados.map((u: any) => ({
      id_usuario: Number(u.id_usuario || u.id),
      nombre_completo: `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.correo || `Supervisor #${u.id_usuario || u.id}`
    }));

    // Si el contrato ya tiene un supervisor asignado que no esté en la lista filtrada, preservarlo
    if (this.contrato?.id_usuario_supervisor) {
      const supIdNum = Number(this.contrato.id_usuario_supervisor);
      const existe = this.supervisores.some(s => Number(s.id_usuario) === supIdNum);
      if (!existe) {
        this.supervisores.unshift({
          id_usuario: supIdNum,
          nombre_completo: this.contrato.supervisor_nombre || `Supervisor #${supIdNum}`
        });
      }
    }

    this.cargandoSupervisores = false;
    this.cdr.detectChanges();
  }

  actualizarSedesDeInstitucion() {
    if (!this.contrato?.institucion) {
      this.sedesInstitucion = [];
      return;
    }
    const inst = this.instituciones.find(i =>
      i.nombre_institucion?.toLowerCase() === this.contrato.institucion?.toLowerCase() ||
      String(i.id_institucion) === String(this.contrato.institucion)
    );
    if (inst) {
      const instId = inst.id_institucion || inst.id;
      this.sedesInstitucion = this.sedes.filter(s => {
        const sInstId = typeof s.id_institucion === 'object' && s.id_institucion !== null
          ? (s.id_institucion.id_institucion ?? s.id_institucion.id)
          : s.id_institucion;
        return Number(sInstId) === Number(instId);
      });
    } else {
      this.sedesInstitucion = [];
    }
    this.cdr.detectChanges();
  }

  onInstitucionChange() {
    this.actualizarSedesDeInstitucion();
  }

  cargarDetalleContrato() {
    if (!this.contratoId) return;

    // Cargar información básica del contrato desde la lista general
    this.siraeService.getContratos().subscribe({
      next: (datos: any) => {
        const listaContratos = Array.isArray(datos) ? datos : (datos.results || datos.data || []);
        const contratoEncontrado = listaContratos.find((c: any) =>
          String(c.id_contrato || c.id || c.pk) === String(this.contratoId)
        );

        if (contratoEncontrado) {
          const instId = contratoEncontrado.id_institucion ? (contratoEncontrado.id_institucion?.id_institucion || contratoEncontrado.id_institucion) : null;
          const supId = contratoEncontrado.id_usuario_supervisor ? (contratoEncontrado.id_usuario_supervisor?.id_usuario || contratoEncontrado.id_usuario_supervisor) : null;

          this.contrato = {
            ...contratoEncontrado,
            institucion: contratoEncontrado.institucion || contratoEncontrado.nombre_institucion || 'No especificada',
            id_institucion: instId,
            zona: contratoEncontrado.zona || contratoEncontrado.nombre_zona || 'No especificada',
            fecha_inicio: contratoEncontrado.fecha_inicio || contratoEncontrado.inicio,
            fecha_fin: contratoEncontrado.fecha_fin || contratoEncontrado.fin,
            condiciones: contratoEncontrado.condiciones || contratoEncontrado.descripcion || '',
            cupos: contratoEncontrado.cupos || 0,
            id_usuario_supervisor: supId ? Number(supId) : null
          };
          this.actualizarSedesDeInstitucion();
        } else {
          // Fallback por si acaso entra directo por URL y el backend requiere detalle por ID específico
          this.contrato = { codigo: `COR-${this.contratoId}`, estado: 'Activo' };
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar el contrato:', err)
    });

    // Cargar las relaciones de secciones asignadas a este contrato
    this.siraeService.getContratosSeccionMenu(Number(this.contratoId)).subscribe({
      next: (datos: any) => {
        this.contratosSeccionMenu = Array.isArray(datos) ? datos : (datos.results || datos.data || []);

        // Auto-habilitar las jornadas basándose en las secciones que ya tiene asignadas
        setTimeout(() => {
          const jornadasConSecciones = new Set<any>();
          this.contratosSeccionMenu.forEach(rel => {
            const seccionIdBuscado = rel.id_seccion?.id_seccion || rel.id_seccion;
            const seccion = this.seccionesMenu.find(s => (s.id_seccion || s.id) === seccionIdBuscado);
            if (seccion) {
              jornadasConSecciones.add(seccion.jornada);
            }
          });

          this.jornadas.forEach(j => {
            const jornadaIdEvaluar = j.nombre_jornada || j.nombre || j.id_jornada || j.id;
            if (jornadasConSecciones.has(jornadaIdEvaluar)) {
              j.habilitada = true;
            }
          });
          this.cdr.detectChanges();
        }, 300);

        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando relaciones del contrato:', err)
    });
  }

  toggleJornada(jornada: any, evento: any) {
    jornada.habilitada = evento.target.checked;

    // Si se deshabilita la jornada, quitamos las secciones correspondientes
    if (!jornada.habilitada) {
      const jId = jornada.id_jornada || jornada.id;

      const seccionesDeEstaJornada = this.seccionesMenu.filter(s => {
        const sJornadaId = (typeof s.id_jornada === 'object' && s.id_jornada !== null) ? (s.id_jornada.id_jornada || s.id_jornada.id) : (s.id_jornada || s.jornada);
        return sJornadaId === jId;
      });

      seccionesDeEstaJornada.forEach(seccion => {
        const secId = seccion.id_seccion || seccion.id;
        if (this.estaSeccionAsignada(secId)) {
          this.toggleSeccionMenu(secId, { target: { checked: false } });
        }
      });
    }
    this.cdr.detectChanges();
  }

  seccionesFiltradasPorJornadasHabilitadas(): any[] {
    const jornadasHabilitadas = this.jornadas.filter(j => j.habilitada);

    return this.seccionesMenu.filter(s => {
      const sJornadaId = (typeof s.id_jornada === 'object' && s.id_jornada !== null) ? (s.id_jornada.id_jornada || s.id_jornada.id) : (s.id_jornada || s.jornada);

      return jornadasHabilitadas.some(j => {
        const jId = j.id_jornada || j.id;
        return sJornadaId === jId;
      });
    });
  }

  seleccionarJornadaParaVer(jornada: any) {
    this.jornadaSeleccionada = jornada;
    this.cdr.detectChanges();
  }

  seccionesDeJornada(jornada: any): any[] {
    if (!jornada) return [];
    const jId = jornada.id_jornada || jornada.id;

    return this.seccionesMenu.filter(s => {
      const sJornadaId = (typeof s.id_jornada === 'object' && s.id_jornada !== null) ? (s.id_jornada.id_jornada || s.id_jornada.id) : (s.id_jornada || s.jornada);
      return sJornadaId === jId;
    });
  }

  estaSeccionAsignada(seccionId: number): boolean {
    return this.contratosSeccionMenu.some(rel => {
      const relSecId = typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion;
      return Number(relSecId) === Number(seccionId);
    });
  }

  toggleSeccionMenu(seccionId: number, evento: any) {
    const asignada = evento.target.checked;

    if (this.contratoId === 'nuevo') {
      if (asignada) {
        this.contratosSeccionMenu.push({ id_seccion: seccionId });
      } else {
        this.contratosSeccionMenu = this.contratosSeccionMenu.filter(rel => {
          const relSecId = typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion;
          return Number(relSecId) !== Number(seccionId);
        });
      }
      this.cdr.detectChanges();
      return;
    }

    if (asignada) {
      const payload = {
        id_contrato: Number(this.contratoId),
        id_seccion: Number(seccionId),
        estado: 'Activo',
        valor: 0
      };
      this.siraeService.crearContratoSeccionMenu(payload).subscribe({
        next: (res) => {
          this.contratosSeccionMenu.push(res);
          this.cdr.detectChanges();
        },
        error: (err) => console.error('Error asignando sección', err)
      });
    } else {
      const relacion = this.contratosSeccionMenu.find(rel => {
        const relSecId = typeof rel.id_seccion === 'object' ? (rel.id_seccion?.id_seccion || rel.id_seccion?.id) : rel.id_seccion;
        return Number(relSecId) === Number(seccionId);
      });

      if (relacion) {
        const relacionId = relacion.id_contrato_seccion || relacion.id;
        this.siraeService.eliminarContratoSeccionMenu(relacionId).subscribe({
          next: () => {
            this.contratosSeccionMenu = this.contratosSeccionMenu.filter(r => (r.id_contrato_seccion || r.id) !== relacionId);
            this.cdr.detectChanges();
          },
          error: (err) => console.error('Error quitando sección', err)
        });
      }
    }
  }

  guardarTodo() {
    if (!this.contrato.institucion) {
      alert('Por favor, selecciona o ingresa la institución educativa.');
      return;
    }

    const instEncontrada = this.institucionSeleccionadaInfo;
    const idInst = instEncontrada?.id_institucion || instEncontrada?.id || this.contrato.id_institucion || null;

    const payload: any = {
      numero_cor: this.contrato.codigo || ('COR-2026-' + Math.floor(Math.random() * 1000)),
      institucion: this.contrato.institucion,
      id_institucion: idInst ? Number(idInst) : null,
      zona: this.contrato.zona || 'Norte',
      fecha_inicio: this.contrato.fecha_inicio || '2026-01-01',
      fecha_fin: this.contrato.fecha_fin || '2026-12-31',
      estado: this.contrato.estado || 'Activo',
      cupos: Number(this.contrato.cupos) || 0,
      id_usuario_supervisor: this.contrato.id_usuario_supervisor ? Number(this.contrato.id_usuario_supervisor) : null
    };

    const esNuevo = !this.contratoId || this.contratoId === 'nuevo' || this.contratoId === '0';

    if (esNuevo) {
      this.siraeService.crearContrato(payload).subscribe({
        next: (res: any) => {
          const newId = res.id_contrato || res.id || res.pk;

          if (this.contratosSeccionMenu.length === 0) {
            this.cerrar.emit();
            this.router.navigate(['/contratos']);
            return;
          }

          // Asignar las secciones guardadas en memoria
          const promesas = this.contratosSeccionMenu.map(rel => {
            return new Promise((resolve) => {
              this.siraeService.crearContratoSeccionMenu({
                id_contrato: newId,
                id_seccion: rel.id_seccion,
                estado: 'Activo',
                valor: 0
              }).subscribe({
                next: () => resolve(true),
                error: () => resolve(false)
              });
            });
          });

          Promise.all(promesas).then(() => {
            this.cerrar.emit();
            this.router.navigate(['/contratos']);
          });
        },
        error: (err) => {
          console.error('Error al crear contrato', err);
          alert('Hubo un error al crear el contrato.');
        }
      });
    } else {
      this.siraeService.actualizarContrato(Number(this.contratoId), payload).subscribe({
        next: () => {
          this.cerrar.emit();
          this.router.navigate(['/contratos']);
        },
        error: (err) => {
          console.error('Error al actualizar contrato', err);
          alert('Hubo un error al actualizar el contrato.');
        }
      });
    }
  }

  volver() {
    this.cerrar.emit();
    this.router.navigate(['/contratos']);
  }
}