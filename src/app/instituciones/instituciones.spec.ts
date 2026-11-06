import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { InstitucionesComponent } from './instituciones';
import { environment } from '../../environments/environment';
import { InstitucionAsignada } from '../core/auth/auth.service';

describe('InstitucionesComponent', () => {
  let component: InstitucionesComponent;
  let fixture: ComponentFixture<InstitucionesComponent>;
  let httpMock: HttpTestingController;

  const instPrueba: InstitucionAsignada = {
    id_institucion: 10,
    nombre_institucion: 'I.E. Central',
    nit: '900.123.456-1',
    representante_legal: 'Rector Juan',
    telefono: '3001234567',
    correo_contacto: 'rector@central.edu.co',
    estado: 'ACTIVO',
    sedes: [
      {
        id_sede: 101,
        nombre_sede: 'Sede Principal',
        codigo_dane: '12345',
        direccion: 'Calle 10 # 5-20',
        telefono: '3001112233',
        estado: 'ACTIVO',
        matriculados: 150,
      },
      {
        id_sede: 102,
        nombre_sede: 'Sede Rural',
        codigo_dane: '67890',
        direccion: 'Vereda El Carmen',
        telefono: '3009998877',
        estado: 'INACTIVO',
        matriculados: 50,
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstitucionesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InstitucionesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Resolver cualquier petición pendiente de ngOnInit
    httpMock.match(`${environment.apiUrl}/instituciones/`).forEach(req => req.flush([]));
    httpMock.match(`${environment.apiUrl}/ingredientes/`).forEach(req => req.flush([]));
    httpMock.verify();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('construye la lista de sedes de la institución activa', () => {
    component.institucionActiva = instPrueba;
    component.construirListaSedes();

    expect(component.sedes.length).toBe(2);
    expect(component.sedes[0].nombre_sede).toBe('Sede Principal');
    expect(component.sedes[1].nombre_sede).toBe('Sede Rural');
  });

  it('filtra las sedes por texto y por estado', () => {
    component.institucionActiva = instPrueba;
    component.construirListaSedes();

    component.textoBusqueda = 'Rural';
    expect(component.filtradas.length).toBe(1);
    expect(component.filtradas[0].nombre_sede).toBe('Sede Rural');

    component.limpiarFiltros();
    expect(component.textoBusqueda).toBe('');
    expect(component.filtroEstado).toBe('Todos');

    component.filtroEstado = 'INACTIVO';
    expect(component.filtradas.length).toBe(1);
    expect(component.filtradas[0].estado).toBe('INACTIVO');
  });

  it('al pulsar abrir(sede) carga las sedes de la institución', () => {
    component.institucionActiva = instPrueba;
    component.construirListaSedes();

    const sedeSeleccionada = component.sedes[0];
    component.abrir(sedeSeleccionada);

    expect(component.seleccionada).toBe(sedeSeleccionada);
    expect(component.institucionSeleccionada?.id_institucion).toBe(10);
    expect(component.sedesDeInstitucion.length).toBe(2);
    expect(component.sedesDeInstitucion[0].nombre_sede).toBe('Sede Principal');
  });

  it('volver() limpia la selección y la lista de sedes de la institución', () => {
    component.institucionActiva = instPrueba;
    component.construirListaSedes();

    component.abrir(component.sedes[0]);
    expect(component.seleccionada).toBeTruthy();

    component.volver();
    expect(component.seleccionada).toBeNull();
    expect(component.sedesDeInstitucion.length).toBe(0);
    expect(component.institucionSeleccionada).toBeNull();
  });

  it('claseEstado devuelve las clases CSS correctas', () => {
    expect(component.claseEstado('ACTIVO')).toContain('emerald');
    expect(component.claseEstado('BAJO')).toContain('amber');
    expect(component.claseEstado('AGOTADO')).toContain('red');
    expect(component.claseEstado('OTRO')).toContain('slate');
  });

  it('fechaCorta y fechaHora formatean fechas adecuadamente', () => {
    expect(component.fechaCorta('2026-10-25')).toBe('25/10/2026');
    expect(component.fechaCorta('')).toBe('—');
    expect(component.fechaHora('')).toBe('—');
    expect(component.fechaHora('2026-10-25')).toBe('25/10/2026');
  });
});
