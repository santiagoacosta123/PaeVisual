import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EntradasInventario } from './entradas-inventario';

describe('EntradasInventario', () => {
  let component: EntradasInventario;
  let fixture: ComponentFixture<EntradasInventario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntradasInventario],
    }).compileComponents();

    fixture = TestBed.createComponent(EntradasInventario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
