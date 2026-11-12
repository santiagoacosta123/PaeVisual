import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { authReduce } from './store/reducer';
import { routes } from './app.routes';
import { authInterceptor, AuthService } from '@core/auth';

/**
 * Criterios 2 y 3: Inicializador de la aplicación que comprueba y valida
 * activamente la vigencia de la sesión persistida contra el backend.
 */
export function inicializarSesionApp(authService: AuthService) {
  return () => authService.verificarSesionInicial();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideStore({
      auth: authReduce
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: inicializarSesionApp,
      deps: [AuthService],
      multi: true,
    },
  ],
};
