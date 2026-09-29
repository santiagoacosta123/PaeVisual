import { bootstrapApplication } from '@angular/platform-browser';
import { App as AppComponent } from './app/app'; // <--- Renombramos la importación si la clase se llama App
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));