import { Routes } from '@angular/router';

<<<<<<< Updated upstream
import { LoginComponent } from './login/login'; // <--- Corregido aquí
import { RecuperarPasswordComponent } from './recuperar-password/recuperar-password';
=======
import { LoginComponent } from './login/login';
>>>>>>> Stashed changes
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
import { authGuard } from './services/auth.guard';
import { BancoDatosComponent } from './banco-datos/banco-datos';

// Importaciones corregidas sin la extensión .component
import { RegistrarEntregaAlimentosComponent } from './registrar-entrega-alimentos/registrar-entrega-alimentos';
import { EntregasTipoMercadoComponent } from './entregas-tipo-mercado/entregas-tipo-mercado';
import { SaldosAlmacenComponent } from './saldos-almacen/saldos-almacen';
import { EntradasAjustesInventarioComponent } from './entradas-ajustes-inventario/entradas-ajustes-inventario';

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
        component: DashboardSupervisor
      },

      /* RUTAS MÓDULOS DE SUPERVISIÓN */
      {
        path: 'registrar-entrega-alimentos',
        component: RegistrarEntregaAlimentosComponent
      },

      {
        path: 'historial-entregas',
        component: RegistrarEntregaAlimentosComponent   // pantalla nueva: historial + alertas + editar/eliminar
      },

      {
        path: 'entregas-tipo-mercado',
        component: EntregasTipoMercadoComponent
      },

      {
        path: 'saldos-almacen',
        component: SaldosAlmacenComponent
      },

      {
        path: 'entradas-ajustes-inventario',
        component: EntradasAjustesInventarioComponent
      },

      /* RUTAS MANTENIDAS DEL SISTEMA */
      {
        path: 'usuarios',
        component: UsuariosComponent
      },

      {
        path: 'contratos',
        component: ContratosComponent
      },

      {
        path: 'contratos/:id/detalle',
        component: ContratoDetalleComponent
      },

      {
        path: 'crear-usuario',
        component: CrearUsuarioComponent
      },

      {
        path: 'rol',
        component: Rol
      },

      {
        path: 'ingredientes',
        component: Ingredientes
      },

      {
        path: 'nuevo-producto',
        component: NuevoProducto
      },

      {
        path: 'reporte-inventario',
        component: ReporteInventario
      },

      {
        path: 'unidades-medida',
        component: UnidadesMedidaComponent
      },

      {
        path: 'menus',
        component: MenusComponent
      },

      {
        path: 'notificaciones',
        component: NotificacionesComponent
      },
      {
        path: 'banco-datos',
        component: BancoDatosComponent
      },
      {
        path: 'entradas-inventario',
        component: EntradasInventario
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  }
];