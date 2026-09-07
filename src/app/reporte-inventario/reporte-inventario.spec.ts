import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReporteInventario } from './reporte-inventario';

describe('ReporteInventario', () => {
  let component: ReporteInventario;
  let fixture: ComponentFixture<ReporteInventario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReporteInventario],
    }).compileComponents();

    fixture = TestBed.createComponent(ReporteInventario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
