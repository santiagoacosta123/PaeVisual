import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SiraeService } from '../services/contratos_pae.service';

@Component({
  selector: 'app-contrato-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contrato-detalle.html',
  styleUrls: ['./contrato-detalle.css']
})
export class ContratoDetalleComponent implements OnInit {
  contratoId: string | null = null;
  pestanaActiva = 'jornadas'; // 'jornadas', 'secciones', 'turnos'

  jornadas: any[] = [];
  seccionesMenu: any[] = [];
  contratosSeccionMenu: any[] = [];
  contrato: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private siraeService: SiraeService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.contratoId = params.get('id');
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
        const res = Array.isArray(datos) ? datos : (datos.results || []);
        this.jornadas = res.map((j: any) => ({ ...j, habilitada: false }));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('API de jornadas no encontrada o con error, usando datos temporales...', err);
        this.jornadas = [
          { id: 1, nombre: 'Mañana', estado: 'Activa', habilitada: false },
          { id: 2, nombre: 'Tarde', estado: 'Activa', habilitada: false }
        ];
        this.cdr.detectChanges();
      }
    });

    // 2. Cargar Secciones de Menú con normalización
    this.siraeService.getSeccionesMenu().subscribe({
      next: (datos: any) => {
        this.seccionesMenu = Array.isArray(datos) ? datos : (datos.results || []);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando secciones de menú:', err)
    });
  }

  cargarDetalleContrato() {
    if (!this.contratoId) return;

    // Cargar información básica del contrato desde la lista general
    this.siraeService.getContratos().subscribe({
      next: (datos: any) => {
        const listaContratos = Array.isArray(datos) ? datos : (datos.results || []);
        const contratoEncontrado = listaContratos.find((c: any) =>
          String(c.id_contrato || c.id || c.pk) === String(this.contratoId)
        );

        if (contratoEncontrado) {
          this.contrato = {
            ...contratoEncontrado,
            institucion: contratoEncontrado.institucion || contratoEncontrado.nombre_institucion || 'No especificada',
            zona: contratoEncontrado.zona || contratoEncontrado.nombre_zona || 'No especificada',
            fecha_inicio: contratoEncontrado.fecha_inicio || contratoEncontrado.inicio,
            fecha_fin: contratoEncontrado.fecha_fin || contratoEncontrado.fin,
            condiciones: contratoEncontrado.condiciones || contratoEncontrado.descripcion || ''
          };
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
        this.contratosSeccionMenu = Array.isArray(datos) ? datos : (datos.results || []);

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
      const jornadaNombreVal = String(jornada.nombre_jornada || jornada.nombre || '').toLowerCase();

      const seccionesDeEstaJornada = this.seccionesMenu.filter(s => {
        const secNombre = String(s.nombre_seccion || s.nombre || '').toLowerCase();
        
        if (jornadaNombreVal === 'mañana') {
          return secNombre.includes('desayuno') || secNombre.includes('merienda');
        } else if (jornadaNombreVal === 'tarde') {
          return secNombre.includes('almuerzo') || secNombre.includes('refrigerio') || secNombre.includes('sena') || secNombre.includes('cena');
        }
        return false;
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
      const secNombre = String(s.nombre_seccion || s.nombre || '').toLowerCase();
      
      return jornadasHabilitadas.some(j => {
        const jName = String(j.nombre_jornada || j.nombre || '').toLowerCase();
        
        // Mapeo manual porque el backend devuelve id_jornada: null
        if (jName === 'mañana') {
          return secNombre.includes('desayuno') || secNombre.includes('merienda');
        } else if (jName === 'tarde') {
          return secNombre.includes('almuerzo') || secNombre.includes('refrigerio') || secNombre.includes('sena') || secNombre.includes('cena');
        }
        return true; // Si es otra jornada, mostrar todo temporalmente
      });
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
    this.router.navigate(['/contratos']);
  }

  volver() {
    this.router.navigate(['/contratos']);
  }
}