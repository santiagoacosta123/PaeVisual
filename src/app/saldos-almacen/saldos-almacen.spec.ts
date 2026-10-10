import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SaldosAlmacen } from './saldos-almacen';

describe('SaldosAlmacen', () => {
  let component: SaldosAlmacen;
  let fixture: ComponentFixture<SaldosAlmacen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaldosAlmacen],
    }).compileComponents();

    fixture = TestBed.createComponent(SaldosAlmacen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
