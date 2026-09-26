import { Routes } from '@angular/router';

import { Login } from './login/login';

import { LayoutComponent } from './layout/layout';
import { InicioComponent } from './inicio/inicio';
import { UsuariosComponent } from './usuarios/usuarios';
import { ContratosComponent } from './contratos/contratos';
import { CrearUsuarioComponent } from './crear-usuario/crear-usuario';
import { Rol } from './rol/rol';
import { Productos } from './productos/productos';
import { NuevoProducto } from './nuevo-producto/nuevo-producto';
import { Reportes } from './reportes/reportes';
import { ReporteInventario } from './reporte-inventario/reporte-inventario';
import { UnidadesMedidaComponent } from './unidades-medida/unidades-medida';
import { MenusComponent } from './menus/menus';
import { AsistenciaComponent } from './asistencia/asistencia';
import { EntregasComponent } from './entregas/entregas';
import { ContratoDetalleComponent } from './contrato-detalle/contrato-detalle';

export const routes: Routes = [

  {
    path: 'login',
    component: Login
  },

  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: '',
    component: LayoutComponent,
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
        path: 'reportes',
        component: Reportes
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
        path: 'asistencia',
        component: AsistenciaComponent
      },

      {
        path: 'entregas',
        component: EntregasComponent
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  }
];