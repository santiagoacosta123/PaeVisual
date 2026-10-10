import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EntregasService } from '../services/entregas.service';

type Mercado = 'Todas' | 'Granos' | 'Perecederos';

@Component({
  selector: 'app-entregas-tipo-mercado',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './entregas-tipo-mercado.html'
})
export class EntregasTipoMercadoComponent implements OnInit {

  mercadoSel: Mercado = 'Todas';   // [Filtrar por Mercado]
  frecuenciaSel: string = '';      // '' = todas | 'Mensual' | 'Quincenal'
  menuAbierto: boolean = false;

  constructor(public entregasService: EntregasService) {}

  // Al abrir la pantalla se cargan las entregas registradas desde el backend
  ngOnInit(): void {
    this.entregasService.cargar().subscribe({
      error: (err) => console.error('Error al consultar entregas:', err)
    });
  }

  // Todas las entregas registradas (lista compartida)
  get entregas(): any[] {
    return this.entregasService.entregas;
  }

  // Tabla filtrada: se recalcula sola al cambiar cualquier filtro
  get entregasFiltradas(): any[] {
    return this.entregas.filter(e => {
      if (this.mercadoSel !== 'Todas' && e.tipoMercado !== this.mercadoSel) return false;
      if (this.frecuenciaSel && e.frecuencia !== this.frecuenciaSel) return false;
      return true;
    });
  }

  get hayFiltros(): boolean {
    return this.mercadoSel !== 'Todas' || this.frecuenciaSel !== '';
  }

  // [Filtrar por Mercado] -> Granos / Perecederos
  seleccionarMercado(mercado: Mercado): void {
    this.mercadoSel = mercado;
    this.menuAbierto = false;
  }

  // [Limpiar Filtros] -> listado completo
  limpiarFiltros(): void {
    this.mercadoSel = 'Todas';
    this.frecuenciaSel = '';
    this.menuAbierto = false;
  }
}

// Alias: así funciona sin importar si tu app.routes.ts usa
// EntregasTipoMercadoComponent o EntregasTipoMercado
export { EntregasTipoMercadoComponent as EntregasTipoMercado };