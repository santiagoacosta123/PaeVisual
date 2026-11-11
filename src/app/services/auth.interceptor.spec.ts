import { HttpErrorResponse, HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../environments/environment';
import { of, throwError } from 'rxjs';

describe('authInterceptor', () => {
  const token = 'stored-access-token';
  let forwardedRequest: HttpRequest<unknown> | undefined;
  const authServiceMock = {
    obtenerToken: vi.fn(() => token),
    limpiarSesion: vi.fn(),
  };
  const next: HttpHandlerFn = (request) => {
    forwardedRequest = request;
    return of(new HttpResponse());
  };

  beforeEach(() => {
    forwardedRequest = undefined;
    authServiceMock.obtenerToken.mockReturnValue(token);
    authServiceMock.limpiarSesion.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    });
  });

  it('does not send a stored token to the login endpoint', () => {
    const request = new HttpRequest(
      'POST',
      `${environment.apiUrl}/auth/login/`,
      null
    );

    TestBed.runInInjectionContext(() => authInterceptor(request, next)).subscribe();

    expect(forwardedRequest?.headers.has('Authorization')).toBe(false);
  });

  it('sends the stored token to protected endpoints', () => {
    const request = new HttpRequest(
      'GET',
      `${environment.apiUrl}/entregas/`
    );

    TestBed.runInInjectionContext(() => authInterceptor(request, next)).subscribe();

    expect(forwardedRequest?.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('clears the local session and redirects to /login when a protected request fails with 401 (revoked or expired token)', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const request = new HttpRequest(
      'GET',
      `${environment.apiUrl}/entregas/`
    );
    const unauthorizedNext: HttpHandlerFn = () =>
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }));

    let capturedError: HttpErrorResponse | undefined;
    TestBed.runInInjectionContext(() => authInterceptor(request, unauthorizedNext)).subscribe({
      error: (err) => {
        capturedError = err;
      },
    });

    expect(capturedError?.status).toBe(401);
    expect(authServiceMock.limpiarSesion).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });
});
