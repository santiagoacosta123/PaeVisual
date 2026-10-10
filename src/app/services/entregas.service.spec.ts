import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { Entrega, EntregasService } from './entregas.service';

describe('EntregasService', () => {
  let service: EntregasService;
  let authService: AuthService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(EntregasService);
    authService = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('usuario');
  });

  afterEach(() => {
    httpTestingController.verify();
    authService.limpiarSesion();
  });

  it('sends the logged-in access token when loading deliveries', () => {
    authService.guardarSesion({
      access: 'access-token',
      refresh: 'refresh-token',
      usuario: {
        id_usuario: 12,
        nombre: 'Ana',
        apellido: 'Pérez',
        correo: 'ana@example.com',
        numero_documento: '12345',
        rol: 'Supervisor',
      },
    });

    let entregas: Entrega[] = [];
    service.cargar().subscribe(result => entregas = result);

    const request = httpTestingController.expectOne(service.apiUrl);
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    request.flush([{
      id_entrega: 8,
      id_ingrediente: 14,
      ingrediente_nombre: 'Arroz',
      id_usuario_supervisor: 17,
      id_tipo_mercado: 2,
      tipo_mercado_nombre: 'Granos',
      fecha_entrega: '2026-10-10',
      fecha_vencimiento: '2026-11-10',
      cantidad: '12.50',
      frecuencia: 'Mensual',
      unidad: 'Kg',
    }]);

    expect(entregas[0]).toMatchObject({
      id: 8,
      idIngrediente: 14,
      idTipoMercado: 2,
      ingrediente: 'Arroz',
      tipoMercado: 'Granos',
      fechaRecepcion: '2026-10-10',
      fechaVencimiento: '2026-11-10',
      cantidad: 12.5,
      frecuencia: 'Mensual',
      unidad: 'Kg',
    });
  });

  it('does not send an authorization header without a logged-in session', () => {
    service.cargar().subscribe();

    const request = httpTestingController.expectOne(service.apiUrl);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });
});
