import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EntradasAjustesInventarioComponent } from './entradas-ajustes-inventario';

describe('EntradasAjustesInventarioComponent', () => {
  let component: EntradasAjustesInventarioComponent;
  let fixture: ComponentFixture<EntradasAjustesInventarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntradasAjustesInventarioComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EntradasAjustesInventarioComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
