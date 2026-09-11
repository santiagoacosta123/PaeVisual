import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Categorias } from './categorias';

describe('Categorias', () => {
  let service: Categorias;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()]
    });
    service = TestBed.inject(Categorias);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

