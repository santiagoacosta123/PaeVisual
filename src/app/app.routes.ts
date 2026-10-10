import { Routes } from '@angular/router';

import { LoginComponent } from './login/login'; // <--- Corregido aquí
import { RecuperarPasswordComponent } from './recuperar-password/recuperar-password';
import { LayoutComponent } from './layout/layout';
import { InicioComponent } from './inicio/inicio';
import { UsuariosComponent } from './usuarios/usuarios';
import { ContratosComponent } from './contratos/contratos';
import { CrearUsuarioComponent } from './crear-usuario/crear-usuario';
import { Rol } from './rol/rol';
import { Productos } from './productos/productos';
import { NuevoProducto } from './nuevo-producto/nuevo-producto';
import { ReporteInventario } from './reporte-inventario/reporte-inventario';
import { UnidadesMedidaComponent } from './unidades-medida/unidades-medida';
import { MenusComponent } from './menus/menus';
import { ContratoDetalleComponent } from './contrato-detalle/contrato-detalle';
import { NotificacionesComponent } from './notificaciones/notificaciones.component';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [

  {
    path: 'login',
    component: LoginComponent // <--- Corregido aquí también
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
        path: 'productos',
        component: Productos
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
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  }
];