import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InstitucionesComponent } from './instituciones';
import { environment } from '../../environments/environment';

describe('InstitucionesComponent', () => {
  let component: InstitucionesComponent;
  let fixture: ComponentFixture<InstitucionesComponent>;
  let http: HttpTestingController;

  const urlLista = `${environment.apiUrl}/instituciones/`;
  const urlIngredientes = `${environment.apiUrl}/ingredientes`;

  const institucionApi = {
    id: 7,
    nombre: 'I.E. Prueba',
    administrador: 'Ana Pérez',
    matriculados: 100,
    asistencia_promedio: 90,
    dias_inventario: 12,
  };

  // Responde la petición de la lista que se lanza en ngOnInit
  function responderLista(cuerpo: object): void {
    http.expectOne(urlLista).flush(cuerpo);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstitucionesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(InstitucionesComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();   // dispara ngOnInit: lista de instituciones e ingredientes
    http.expectOne(urlIngredientes).flush([
      { nombre: 'Pollo', imagen: 'http://127.0.0.1:8000/media/ingredientes/pollo_3d.png' },
    ]);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('should create', () => {
    responderLista([]);
    expect(component).toBeTruthy();
  });

  it('usa instituciones de ejemplo cuando el servidor no devuelve nada', () => {
    responderLista([]);
    expect(component.instituciones.length).toBe(6);
    expect(component.avisoRespaldo).toContain('ejemplo');
  });

  it('usa instituciones de ejemplo y explica el error cuando falla el servidor', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    http.expectOne(urlLista).flush('error', { status: 500, statusText: 'Server Error' });

    expect(component.instituciones.length).toBe(6);
    expect(component.avisoRespaldo).toContain('500');
    expect(component.cargando).toBe(false);
  });

  it('convierte los campos del backend y calcula el estado por días de inventario', () => {
    responderLista({ results: [institucionApi] });

    expect(component.instituciones.length).toBe(1);
    expect(component.instituciones[0].nombre).toBe('I.E. Prueba');
    expect(component.instituciones[0].matriculados).toBe(100);
    expect(component.instituciones[0].estado).toBe('Ok');
    expect(component.avisoRespaldo).toBe('');
  });

  it('estadoPorDias respeta los límites 10 / 4', () => {
    responderLista([]);
    expect(component.estadoPorDias(10)).toBe('Ok');
    expect(component.estadoPorDias(9)).toBe('Bajo');
    expect(component.estadoPorDias(4)).toBe('Bajo');
    expect(component.estadoPorDias(3)).toBe('Crítico');
  });

  it('filtra por texto y por estado', () => {
    responderLista([]);

    component.textoBusqueda = 'rosal';
    expect(component.filtradas.map(i => i.nombre)).toEqual(['I.E. El Rosal']);

    component.limpiarFiltros();
    component.filtroEstado = 'Crítico';
    expect(component.filtradas.every(i => i.estado === 'Crítico')).toBe(true);
    expect(component.filtradas.length).toBeGreaterThan(0);
  });

  it('al abrir una institución une las entregas del mismo producto', () => {
    responderLista([institucionApi]);
    component.abrir(component.instituciones[0]);

    http.expectOne(`${urlLista}7/entregas/`).flush([
      { ingrediente: 'Arroz', unidad: 'Kg', cantidad: 50, fecha_registro: '2026-10-01T08:00:00' },
      { ingrediente: 'Arroz', unidad: 'Kg', cantidad: 30, fecha_registro: '2026-10-15T09:30:00' },
      { ingrediente: 'Leche', unidad: 'Litros', cantidad: 120, fecha_registro: '2026-10-10T07:00:00' },
    ]);

    expect(component.entregasUnidas.length).toBe(2);
    const arroz = component.entregasUnidas.find(e => e.ingrediente === 'Arroz')!;
    expect(arroz.cantidad).toBe(80);
    expect(arroz.fechaRegistro).toBe('2026-10-15T09:30:00');   // la más reciente
    expect(component.entregasUnidas[0].ingrediente).toBe('Arroz');   // orden: más reciente primero
    expect(component.cargandoEntregas).toBe(false);
    expect(component.errorEntregas).toBe('');
  });

  it('muestra un error si fallan las entregas', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    responderLista([institucionApi]);
    component.abrir(component.instituciones[0]);

    http.expectOne(`${urlLista}7/entregas/`).flush('no existe', { status: 404, statusText: 'Not Found' });

    expect(component.errorEntregas).toContain('404');
    expect(component.entregasUnidas.length).toBe(0);
  });

  it('con instituciones de ejemplo usa entregas de ejemplo sin llamar al servidor', () => {
    responderLista([]);
    component.abrir(component.instituciones[0]);

    // http.verify() en afterEach falla si se hubiera hecho otra petición
    expect(component.entregasUnidas.length).toBeGreaterThan(0);
    const nombres = component.entregasUnidas.map(e => e.ingrediente);
    expect(new Set(nombres).size).toBe(nombres.length);   // sin productos repetidos
  });

  it('usa la imagen del catálogo, si no <ruta>/<nombre>.png, y cae al emoji si falla', () => {
    responderLista([]);
    expect(component.urlImagen('Pollo')).toContain('pollo_3d.png');       // del catálogo
    expect(component.urlImagen('Carne de res')).toContain('carne_de_res.png');   // por nombre
    expect(component.mostrarImagen('Arroz')).toBe(true);

    component.marcarFallo('Arroz');
    expect(component.mostrarImagen('Arroz')).toBe(false);
  });

  it('volver() cierra el detalle', () => {
    responderLista([]);
    component.abrir(component.instituciones[0]);
    component.volver();
    expect(component.seleccionada).toBeNull();
  });

  it('fechaHora no desplaza el día cuando solo viene la fecha', () => {
    responderLista([]);
    expect(component.fechaHora('2026-10-20')).toBe('20/10/2026');
    expect(component.fechaHora('')).toBe('—');
  });
});