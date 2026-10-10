# Paevisual

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Password recovery

Run the Angular app at `http://localhost:4200` and configure the backend's
`FRONTEND_URL` to that same origin for local development. The recovery email
links to `/recuperar-password?token=...`; the token expires after 15 minutes.

The backend must be deployed with the updated password-reset routes. In
production, set `FRONTEND_URL` to the public frontend origin, add that origin
to `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, and configure SMTP with
`EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, and `DEFAULT_FROM_EMAIL`. Render
deployment variables are intentionally left for the deployment owner to set;
do not use `localhost` or the example domain for production.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
