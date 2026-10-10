import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistorialEntregas } from './historial-entregas';

describe('HistorialEntregas', () => {
  let component: HistorialEntregas;
  let fixture: ComponentFixture<HistorialEntregas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistorialEntregas],
    }).compileComponents();

    fixture = TestBed.createComponent(HistorialEntregas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
