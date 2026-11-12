import { HistorialEntregas } from './historial-entregas/historial-entregas';
import { routes } from './app.routes';
import { RegistrarEntregaAlimentosComponent } from './registrar-entrega-alimentos/registrar-entrega-alimentos';
import { PlanillasOperativasComponent } from './plantillas-operativas/plantillas-operativas';

describe('delivery routes', () => {
  const layoutRoute = routes.find(route => route.children !== undefined);
  const children = layoutRoute?.children ?? [];

  it('opens a separate screen for registration and history', () => {
    const registrationRoute = children.find(route => route.path === 'registrar-entrega-alimentos');
    const historyRoute = children.find(route => route.path === 'historial-entregas');

    expect(registrationRoute?.component).toBe(RegistrarEntregaAlimentosComponent);
    expect(historyRoute?.component).toBe(HistorialEntregas);
    expect(registrationRoute?.component).not.toBe(historyRoute?.component);
  });

  it('limits delivery registration to super administrators and supervisors', () => {
    const registrationRoute = children.find(route => route.path === 'registrar-entrega-alimentos');

    expect(registrationRoute?.data?.['roles']).toEqual([
      'superadministrador',
      'super administrador',
      'super admin',
      'supervisor',
      'coordinador',
      'coordinador pae',
    ]);
  });

  describe('PAE operational routes', () => {
    const layoutRoute = routes.find(route => route.children !== undefined);
    const children = layoutRoute?.children ?? [];

    it('limits attendance to the Jefa role and allows Jefa menu management', () => {
      const attendance = children.find(route => route.path === 'asistencia-diaria');
      const menus = children.find(route => route.path === 'menus');

      expect(attendance?.data?.['roles']).toContain('jefamanipuladoras');
      expect(menus?.data?.['roles']).toContain('jefa de manipuladoras');
    });

    it('uses the operational templates as the main reports screen', () => {
      const report = children.find(route => route.path === 'reportes-consumo');

      expect(report?.component).toBe(PlanillasOperativasComponent);
      expect(report?.data?.['roles']).toContain('supervisor');
    });

    it('separates master templates into a SuperAdmin-only route', () => {
      const plantillasRoute = children.find(route => route.path === 'plantillas-maestras');

      expect(plantillasRoute).toBeTruthy();
      expect(plantillasRoute?.data?.['modoModulo']).toBe('plantillas');
      expect(plantillasRoute?.data?.['roles']).toEqual([
        'superadministrador',
        'super administrador',
        'super admin',
      ]);
      expect(plantillasRoute?.data?.['roles']).not.toContain('supervisor');
    });

    it('restores the three operational templates for supervisors', () => {
      const plantillasOperativas = children.find(route => route.path === 'plantillas-operativas');

      expect(plantillasOperativas?.component).toBe(PlanillasOperativasComponent);
      expect(plantillasOperativas?.data?.['roles']).toContain('supervisor');
    });
  });
});
