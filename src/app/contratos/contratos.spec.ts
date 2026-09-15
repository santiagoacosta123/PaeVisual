import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Contratos } from './contratos';

describe('Contratos', () => {
  let component: Contratos;
  let fixture: ComponentFixture<Contratos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Contratos],
    }).compileComponents();

    fixture = TestBed.createComponent(Contratos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
