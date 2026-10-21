import { Routes } from '@angular/router';

import { LoginComponent } from './login/login';
import { RecuperarPasswordComponent } from './recuperar-password/recuperar-password';
import { LayoutComponent } from './layout/layout';
import { InicioComponent } from './inicio/inicio';
import { UsuariosComponent } from './usuarios/usuarios';
import { ContratosComponent } from './contratos/contratos';
import { CrearUsuarioComponent } from './crear-usuario/crear-usuario';
import { Rol } from './rol/rol';
import { Ingredientes } from './ingredientes/ingredientes';
import { NuevoProducto } from './nuevo-producto/nuevo-producto';
import { ReporteInventario } from './reporte-inventario/reporte-inventario';
import { UnidadesMedidaComponent } from './unidades-medida/unidades-medida';
import { MenusComponent } from './menus/menus';
import { EntradasInventario } from './entradas-inventario/entradas-inventario';
import { ContratoDetalleComponent } from './contrato-detalle/contrato-detalle';
import { NotificacionesComponent } from './notificaciones/notificaciones.component';
import { DashboardSupervisor } from './dashboard-supervisor/dashboard-supervisor';
import { authGuard, roleGuard } from '@core/auth';
import { BancoDatosComponent } from './banco-datos/banco-datos';

import { RegistrarEntregaAlimentosComponent } from './registrar-entrega-alimentos/registrar-entrega-alimentos';
import { HistorialEntregas } from './historial-entregas/historial-entregas';
import { EntregasTipoMercadoComponent } from './entregas-tipo-mercado/entregas-tipo-mercado';
import { SaldosAlmacenComponent } from './saldos-almacen/saldos-almacen';
import { EntradasAjustesInventarioComponent } from './entradas-ajustes-inventario/entradas-ajustes-inventario';
import { AsistenciaDiariaComponent } from './asistencia-diaria/asistencia-diaria';
import { Reportes } from './reportes/reportes';
import { InstitucionesComponent } from './instituciones/instituciones';

// NUEVO: página de Instituciones
import { InstitucionesComponent } from './instituciones/instituciones';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'recuperar-password',
    component: RecuperarPasswordComponent
  },

  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'inicio',
        component: InicioComponent
      },

      {
        path: 'dashboard-supervisor',
        component: DashboardSupervisor,
        canActivate: [roleGuard],
        data: { roles: ['supervisor', 'coordinador', 'coordinador pae'] }
      },

      {
        path: 'asistencia-diaria',
        component: AsistenciaDiariaComponent,
        canActivate: [roleGuard],
        data: { roles: ['jefa de manipuladoras', 'jefa manipuladoras', 'jefamanipuladoras'] }
      },

      {
        path: 'reportes-consumo',
        component: Reportes,
        canActivate: [roleGuard],
        data: { roles: ['supervisor', 'coordinador', 'coordinador pae', 'administrador', 'admin'] }
      },

      /* RUTAS MÓDULOS DE SUPERVISIÓN */
      {
        path: 'instituciones',
        component: InstitucionesComponent,
        canActivate: [roleGuard],
        data: { roles: ['supervisor', 'coordinador', 'coordinador pae', 'superadministrador', 'super administrador', 'administrador', 'admin'] }
      },
      {
        path: 'registrar-entrega-alimentos',
        component: RegistrarEntregaAlimentosComponent,
        canActivate: [roleGuard],
        data: { roles: ['supervisor', 'coordinador', 'coordinador pae'] }
      },

      {
        path: 'historial-entregas',
        component: HistorialEntregas,
        canActivate: [roleGuard],
        data: { roles: ['supervisor', 'coordinador', 'coordinador pae'] }
      },

      {
        path: 'entregas-tipo-mercado',
        component: EntregasTipoMercadoComponent,
        canActivate: [roleGuard],
        data: { roles: ['supervisor', 'coordinador', 'coordinador pae'] }
      },

      // NUEVO: Instituciones
      {
        path: 'instituciones',
        component: InstitucionesComponent,
        canActivate: [roleGuard],
        data: { roles: ['supervisor', 'coordinador', 'coordinador pae', 'administrador', 'admin'] }
      },

      {
        path: 'saldos-almacen',
        component: SaldosAlmacenComponent,
        canActivate: [roleGuard],
        data: { roles: ['supervisor', 'coordinador', 'coordinador pae', 'administrador', 'admin'] }
      },

      {
        path: 'entradas-ajustes-inventario',
        component: EntradasAjustesInventarioComponent,
        canActivate: [roleGuard],
        data: { roles: ['supervisor', 'coordinador', 'coordinador pae', 'administrador', 'admin'] }
      },

      /* RUTAS MANTENIDAS DEL SISTEMA */
      {
        path: 'usuarios',
        component: UsuariosComponent,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin', 'administrador', 'admin'] }
      },

      {
        path: 'contratos',
        component: ContratosComponent,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin'] }
      },

      {
        path: 'contratos/:id/detalle',
        component: ContratoDetalleComponent,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin'] }
      },

      {
        path: 'crear-usuario',
        component: CrearUsuarioComponent,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin', 'administrador', 'admin'] }
      },

      {
        path: 'rol',
        component: Rol,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin', 'administrador', 'admin'] }
      },

      {
        path: 'ingredientes',
        component: Ingredientes,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin', 'administrador', 'admin'] }
      },

      {
        path: 'nuevo-producto',
        component: NuevoProducto,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin', 'administrador', 'admin'] }
      },

      {
        path: 'reporte-inventario',
        component: ReporteInventario,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin', 'supervisor', 'coordinador', 'coordinador pae', 'administrador', 'admin'] }
      },

      {
        path: 'unidades-medida',
        component: UnidadesMedidaComponent,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin', 'administrador', 'admin'] }
      },

      {
        path: 'menus',
        component: MenusComponent,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin', 'jefa de manipuladoras', 'jefa manipuladoras', 'jefamanipuladoras', 'administrador', 'admin'] }
      },

      {
        path: 'notificaciones',
        component: NotificacionesComponent
      },
      {
        path: 'banco-datos',
        component: BancoDatosComponent,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin'] }
      },
      {
        path: 'entradas-inventario',
        component: EntradasInventario,
        canActivate: [roleGuard],
        data: { roles: ['superadministrador', 'super administrador', 'super admin', 'administrador', 'admin'] }
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  }
];