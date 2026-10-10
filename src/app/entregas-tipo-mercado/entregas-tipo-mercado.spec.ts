import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EntregasTipoMercado } from './entregas-tipo-mercado';

describe('EntregasTipoMercado', () => {
  let component: EntregasTipoMercado;
  let fixture: ComponentFixture<EntregasTipoMercado>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntregasTipoMercado],
    }).compileComponents();

    fixture = TestBed.createComponent(EntregasTipoMercado);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
