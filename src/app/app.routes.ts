import { Routes } from '@angular/router';

import { Login } from './login/login';

import { LayoutComponent } from './layout/layout';
import { InicioComponent } from './inicio/inicio';
import { UsuariosComponent } from './usuarios/usuarios';
import { CrearUsuarioComponent } from './crear-usuario/crear-usuario';
import { Rol } from './rol/rol';
import { Productos } from './productos/productos';
import { NuevoProducto } from './nuevo-producto/nuevo-producto';
import { Reportes } from './reportes/reportes';
import { ReporteInventario } from './reporte-inventario/reporte-inventario';
import { Jornadas } from './jornadas/jornadas';
import { CategoriasComponent } from './categorias/categorias';
import { Menus } from './menus/menus';

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
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  },
  {
        path:'jornadas',
        component: Jornadas
    },
    {
        path:'categorias',
        component:CategoriasComponent
    },
    {
        path:'menus',
        component:Menus
    },
    {
        path:'',
        redirectTo:'jornadas',
        pathMatch:'full'

    }
];

