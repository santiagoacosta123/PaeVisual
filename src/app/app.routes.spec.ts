import { HistorialEntregas } from './historial-entregas/historial-entregas';
import { routes } from './app.routes';
import { RegistrarEntregaAlimentosComponent } from './registrar-entrega-alimentos/registrar-entrega-alimentos';

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

  describe('PAE operational routes', () => {
    const layoutRoute = routes.find(route => route.children !== undefined);
    const children = layoutRoute?.children ?? [];

    it('limits attendance to the Jefa role and allows Jefa menu management', () => {
      const attendance = children.find(route => route.path === 'asistencia-diaria');
      const menus = children.find(route => route.path === 'menus');

      expect(attendance?.data?.['roles']).toContain('jefamanipuladoras');
      expect(menus?.data?.['roles']).toContain('jefa de manipuladoras');
    });

    it('provides the Supervisor with a real inventory movement report route', () => {
      const report = children.find(route => route.path === 'reportes-consumo');

      expect(report?.data?.['roles']).toContain('supervisor');
    });
  });
});
