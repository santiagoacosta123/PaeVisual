import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { of } from 'rxjs';

describe('authInterceptor', () => {
  const token = 'stored-access-token';
  let forwardedRequest: HttpRequest<unknown> | undefined;
  const next: HttpHandlerFn = (request) => {
    forwardedRequest = request;
    return of(new HttpResponse());
  };

  beforeEach(() => {
    forwardedRequest = undefined;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { obtenerToken: () => token },
        },
      ],
    });
  });

  it('does not send a stored token to the login endpoint', () => {
    const request = new HttpRequest(
      'POST',
      'https://backend-sirae-pyim.onrender.com/api/auth/login/',
      null
    );

    TestBed.runInInjectionContext(() => authInterceptor(request, next)).subscribe();

    expect(forwardedRequest?.headers.has('Authorization')).toBe(false);
  });

  it('sends the stored token to protected endpoints', () => {
    const request = new HttpRequest(
      'GET',
      'https://backend-sirae-pyim.onrender.com/api/usuarios/'
    );

    TestBed.runInInjectionContext(() => authInterceptor(request, next)).subscribe();

    expect(forwardedRequest?.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });
});
