import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Entregas } from './entregas';

describe('Entregas', () => {
  let component: Entregas;
  let fixture: ComponentFixture<Entregas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Entregas],
    }).compileComponents();

    fixture = TestBed.createComponent(Entregas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
