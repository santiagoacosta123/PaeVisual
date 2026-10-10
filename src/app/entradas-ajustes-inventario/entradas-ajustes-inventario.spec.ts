import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EntradasAjustesInventario } from './entradas-ajustes-inventario';

describe('EntradasAjustesInventario', () => {
  let component: EntradasAjustesInventario;
  let fixture: ComponentFixture<EntradasAjustesInventario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntradasAjustesInventario],
    }).compileComponents();

    fixture = TestBed.createComponent(EntradasAjustesInventario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
