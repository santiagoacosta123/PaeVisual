import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SaldosAlmacenComponent } from './saldos-almacen';

describe('SaldosAlmacenComponent', () => {
  let component: SaldosAlmacenComponent;
  let fixture: ComponentFixture<SaldosAlmacenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaldosAlmacenComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SaldosAlmacenComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
