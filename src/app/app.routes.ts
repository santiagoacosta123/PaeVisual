import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout';
import { InicioComponent } from './inicio/inicio';
import { UsuariosComponent } from './usuarios/usuarios';
import { CrearUsuarioComponent } from './crear-usuario/crear-usuario';
import { Rol } from './rol/rol';
import { Productos } from './productos/productos';
import { NuevoProducto } from './nuevo-producto/nuevo-producto';
import { Sedes } from './sedes/sedes';
import { Reportes } from './reportes/reportes';
import { ReporteInventario } from './reporte-inventario/reporte-inventario';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', component: InicioComponent },
      { path: 'usuarios', component: UsuariosComponent },
      { path: 'crear-usuario', component: CrearUsuarioComponent },
      { path: 'rol', component: Rol },
      { path: 'productos', component: Productos },
      { path: 'nuevo-producto', component: NuevoProducto },
      { path: 'sedes', component: Sedes },
      { path: 'reportes', component: Reportes },
      { path: 'reporte-inventario', component: ReporteInventario },
    ]
  }
];