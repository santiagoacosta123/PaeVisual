import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ConsultaGramajesComponent } from './consulta-gramajes';
import { AuthService } from '../core/auth/auth.service';
import { BancoDatosService } from '../features/banco-datos/services/banco-datos.service';

describe('ConsultaGramajesComponent', () => {
  let component: ConsultaGramajesComponent;
  let fixture: ComponentFixture<ConsultaGramajesComponent>;
  let bancoDatosSpy: {
    obtenerDatos: ReturnType<typeof vi.fn>;
    consultarGramajesPorAlcance: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    bancoDatosSpy = {
      obtenerDatos: vi.fn((tabla: string) => {
        if (tabla === 'ingredientes') {
          return of([{ id_ingrediente: 10, nombre_ingrediente: 'Arroz' }]);
        }
        return of([{ id_grado: 1, nombre_grado: 'Primero', estado: 'ACTIVO' }]);
      }),
      consultarGramajesPorAlcance: vi.fn(() =>
        of({
          permisos: { puede_modificar_gramajes: false },
          alcance: {
            rol_nivel: 'JEFA_MANIPULADORAS',
            puede_filtrar_institucion: false,
            puede_filtrar_sede: false,
            puede_filtrar_jornada: false,
            id_institucion_asignada: 5,
            id_sede_asignada: 2,
            id_jornada_asignada: 1,
            instituciones_disponibles: [{ id_institucion: 5, nombre_institucion: 'IE Norte' }],
            sedes_disponibles: [{ id_sede: 2, nombre_sede: 'Sede A', id_institucion: 5 }],
            jornadas_disponibles: [{ id_jornada: 1, nombre_jornada: 'Mañana' }],
            alertas_alcance: [],
          },
          resumen: {
            total_sede_jornadas: 1,
            total_grados_atendidos: 1,
            total_alertas: 1,
            total_alertas_faltantes: 1,
          },
          alertas_alcance: [],
          alertas_faltantes: [
            {
              tipo: 'FALTA_GRAMAJE_REQUERIDO',
              severidad: 'ALTA',
              id_grado: 1,
              nombre_grado: 'Primero',
              id_ingrediente: 10,
              nombre_ingrediente: 'Arroz',
              cantidad_gramaje: null,
              mensaje: "El grado 'Primero' no tiene gramaje configurado para 'Arroz'.",
            },
          ],
          sede_jornadas: [
            {
              id_sede_jornada: 1,
              id_institucion: 5,
              nombre_institucion: 'IE Norte',
              id_sede: 2,
              nombre_sede: 'Sede A',
              id_jornada: 1,
              nombre_jornada: 'Mañana',
              cupos_jornada: 100,
              productos_requeridos: [{ id_ingrediente: 10, nombre_ingrediente: 'Arroz', origenes: ['Menú 1'] }],
              grados_atendidos: [
                {
                  id_grado: 1,
                  nombre_grado: 'Primero',
                  nivel_educativo: 'PRIMARIA',
                  nivel_educativo_display: 'Primaria',
                  id_grupo_gramaje: 1,
                  nombre_grupo_gramaje: 'Primaria',
                  cupos_grado: 50,
                  gramajes: [
                    {
                      id_gramaje: 99,
                      id_ingrediente: 11,
                      nombre_ingrediente: 'Pollo',
                      tipo_conservacion: 'perecedero',
                      tipo_alimento: 'Perecedero',
                      cantidad_gramaje: 90,
                      nombre_unidad_medida: 'Gramo',
                      abreviatura_unidad_medida: 'g',
                      tipo_magnitud_unidad: 'MASA',
                      contexto_aplicacion: 'GENERAL',
                      contexto_aplicacion_display: 'General',
                      descripcion: '',
                    },
                  ],
                  alertas: [],
                  tiene_alertas: false,
                },
              ],
              total_grados: 1,
              total_alertas: 1,
            },
          ],
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [ConsultaGramajesComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            obtenerInstitucionActiva: () => null,
          },
        },
        {
          provide: BancoDatosService,
          useValue: bancoDatosSpy,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsultaGramajesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra modo solo lectura y las alertas de producto sin gramaje configurado', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.esSoloLectura).toBe(true);
    expect(compiled.textContent).toContain('Solo lectura (no editable)');
    expect(compiled.textContent).toContain('Sede A — Jornada Mañana');
    expect(compiled.textContent).toContain('Primero');
    expect(compiled.textContent).toContain('Pollo');
    expect(compiled.textContent).toContain('90 g');
    expect(compiled.textContent).toContain("El grado 'Primero' no tiene gramaje configurado para 'Arroz'.");
  });
});

