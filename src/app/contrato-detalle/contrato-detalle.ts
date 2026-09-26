import { Component, OnInit } from '@angular/core';
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
  
  // Para asignar
  jornadaSeleccionada: any = null;
  seccionesPorJornada: any[] = [];

  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private siraeService: SiraeService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.contratoId = params.get('id');
      this.cargarDatosMaestros();
      this.cargarDetalleContrato();
    });
  }

  cargarDatosMaestros() {
    this.siraeService.getJornadas().subscribe(res => {
      this.jornadas = res;
    }, err => {
      console.warn('API de jornadas no encontrada, usando datos temporales...');
      this.jornadas = [
        { id: 1, nombre: 'Mañana', estado: 'Activa' },
        { id: 2, nombre: 'Tarde', estado: 'Activa' }
      ];
    });

    this.siraeService.getSeccionesMenu().subscribe(res => {
      this.seccionesMenu = res;
    }, err => console.error('Error cargando secciones de menú:', err));
  }

  cargarDetalleContrato() {
    if (!this.contratoId) return;
    
    this.siraeService.getContratosSeccionMenu(Number(this.contratoId)).subscribe(res => {
      this.contratosSeccionMenu = res;
    }, err => console.error('Error cargando relaciones del contrato:', err));
  }

  seleccionarJornada(jornada: any) {
    this.jornadaSeleccionada = jornada;
    // Filtrar las secciones de menú que pertenecen a esta jornada
    // Asumiendo que seccion.jornada es el ID o el nombre de la jornada
    this.seccionesPorJornada = this.seccionesMenu.filter(s => s.jornada === jornada.id || s.jornada === jornada.nombre);
  }

  estaSeccionAsignada(seccionId: number): boolean {
    return this.contratosSeccionMenu.some(rel => rel.id_seccion === seccionId || rel.id_seccion?.id_seccion === seccionId);
  }

  toggleSeccionMenu(seccionId: number, evento: any) {
    const asignada = evento.target.checked;
    
    if (asignada) {
      // Crear relación
      const payload = {
        id_contrato: Number(this.contratoId),
        id_seccion: seccionId,
        estado: 'Activo',
        valor: 0 // Valor por defecto, si aplica
      };
      this.siraeService.crearContratoSeccionMenu(payload).subscribe(res => {
        this.contratosSeccionMenu.push(res);
      }, err => console.error('Error asignando sección', err));
    } else {
      // Eliminar relación
      const relacion = this.contratosSeccionMenu.find(rel => rel.id_seccion === seccionId || rel.id_seccion?.id_seccion === seccionId);
      if (relacion) {
        this.siraeService.eliminarContratoSeccionMenu(relacion.id_contrato_seccion).subscribe(() => {
          this.contratosSeccionMenu = this.contratosSeccionMenu.filter(r => r.id_contrato_seccion !== relacion.id_contrato_seccion);
        }, err => console.error('Error quitando sección', err));
      }
    }
  }

  seleccionarPestana(pestana: string) {
    this.pestanaActiva = pestana;
  }

  volver() {
    this.router.navigate(['/contratos']);
  }
}
