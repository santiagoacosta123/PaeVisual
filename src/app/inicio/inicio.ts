import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SiraeService } from '../features/contratos/services/contratos_pae.service';
import { FacturasCompraService } from '../services/facturas-compra.service';
import { UsuarioService } from '../features/usuarios/services/usuario.service';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inicio.html',
  styleUrls: ['./inicio.css']
})
export class InicioComponent implements OnInit {
  private authService = inject(AuthService);
  private contratosService = inject(SiraeService);
  private facturasService = inject(FacturasCompraService);
  private usuarioService = inject(UsuarioService);
  private cdr = inject(ChangeDetectorRef);

  usuario = this.authService.obtenerUsuario();
  nombreUsuario = this.obtenerNombreUsuario();
  rolUsuario = this.usuario?.rol || 'Sin rol asignado';
  esSuperAdministrador = this.authService.esSuperAdministrador(this.usuario?.rol);
  esAdministrador = (this.authService.normalizarRol(this.usuario?.rol) === 'administrador' || this.authService.normalizarRol(this.usuario?.rol) === 'admin') && !this.esSuperAdministrador;
  
  fechaActual = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  // Métricas para el Super Administrador (valores por defecto según diseño)
  totalContratosActivos: number = 48;
  totalFacturasPendientes: number = 17;
  totalUnidadesStock: string = '12.480';
  totalUsuariosRegistrados: number = 126;

  ngOnInit(): void {
    if (this.esSuperAdministrador) {
      this.cargarMetricasSuperAdmin();
    }
  }

  private cargarMetricasSuperAdmin(): void {
    this.contratosService.getContratos().subscribe({
      next: (data) => {
        if (Array.isArray(data) && data.length > 0) {
          const activos = data.filter((c: any) => c.estado === 'Activo').length;
          this.totalContratosActivos = activos > 0 ? activos : data.length;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });

    this.facturasService.getFacturas().subscribe({
      next: (data) => {
        if (Array.isArray(data) && data.length > 0) {
          const pendientes = data.filter((f: any) => f.estado === 'REGISTRADA').length;
          this.totalFacturasPendientes = pendientes > 0 ? pendientes : data.length;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });

    this.facturasService.getInventarioCentral().subscribe({
      next: (data) => {
        if (Array.isArray(data) && data.length > 0) {
          const suma = data.reduce((sum: number, item: any) => sum + (Number(item.cantidad_disponible) || 0), 0);
          if (suma > 0) {
            this.totalUnidadesStock = new Intl.NumberFormat('es-CO').format(Math.round(suma));
            this.cdr.detectChanges();
          }
        }
      },
      error: () => {}
    });

    this.usuarioService.getUsuarios().subscribe({
      next: (data) => {
        if (Array.isArray(data) && data.length > 0) {
          this.totalUsuariosRegistrados = data.length;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  private obtenerNombreUsuario(): string {
    const usuario = this.usuario;
    return usuario ? `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || usuario.correo : '';
  }
}