import { describe, expect, it } from 'vitest';
import {
  idInstitucionDeSede,
  listaSedesDePagina,
  normalizarInstitucionSupervisor,
  sedesDeInstitucion,
  urlSiguientePaginaSedes,
} from './institucion-supervisor.utils';

describe('institucion-supervisor.utils', () => {
  it('reads sede rows from paginated responses', () => {
    const sedes = [{ id_sede: 2 }, { id_sede: 3 }];

    expect(listaSedesDePagina({ count: 2, results: sedes })).toEqual(sedes);
    expect(listaSedesDePagina(sedes)).toEqual(sedes);
  });

  it('follows same-origin pagination and rejects external URLs', () => {
    expect(urlSiguientePaginaSedes(
      { next: 'https://api.example.com/api/sedes/?page=2' },
      'https://api.example.com/api',
    )).toBe('https://api.example.com/api/sedes/?page=2');

    expect(() => urlSiguientePaginaSedes(
      { next: 'https://other.example.com/sedes/?page=2' },
      'https://api.example.com/api',
    )).toThrow('fuera del servidor de la API');
  });

  it('matches sede institution IDs in primitive and nested forms', () => {
    const sedes = [
      { id_sede: 1, id_institucion: 3 },
      { id_sede: 2, id_institucion: { id: 3 } },
      { id_sede: 4, id_institucion: 5 },
    ];

    expect(sedesDeInstitucion(sedes, 3).map((sede) => sede.id_sede)).toEqual([1, 2]);
    expect(idInstitucionDeSede({ institucion: { id_institucion: '3' } })).toBe(3);
    expect(idInstitucionDeSede({ id_sede: 6 })).toBeNull();
  });

  it('uses the fetched associated sedes instead of stale nested data', () => {
    const institucion = normalizarInstitucionSupervisor(
      { id_institucion: 3, nombre_institucion: 'Institución Norte', sedes: [] },
      undefined,
      true,
      [
        { id_sede: 1, id_institucion: 3, nombre_sede: 'Sede Central' },
        { id_sede: 2, id_institucion: 4, nombre_sede: 'Otra institución' },
      ],
    );

    expect(institucion.sedes).toEqual([
      { id_sede: 1, id_institucion: 3, nombre_sede: 'Sede Central' },
    ]);
  });
});
