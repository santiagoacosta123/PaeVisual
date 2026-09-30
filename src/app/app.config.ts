import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor';
import { 
  SocialAuthServiceConfig, 
  GoogleLoginProvider,
  GoogleInitOptions,
  SOCIAL_AUTH_CONFIG // <-- Importamos el token oficial de la librería
} from '@abacritt/angularx-social-login';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor])
    ),
    {
      provide: SOCIAL_AUTH_CONFIG, // <-- Usamos el token exportado para evitar el error de inyección
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(
              '399700788972-g3qicudpom1oncgc5ql4j2kg7tea01nf.apps.googleusercontent.com',
              {
                oneTapEnabled: false
              } as GoogleInitOptions
            )
          }
        ],
        onError: (err: any) => {
          console.error('Error en autenticación de Google:', err);
        }
      } as SocialAuthServiceConfig,
    }
  ]
};