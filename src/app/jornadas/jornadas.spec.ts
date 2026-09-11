import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Jornadas } from './jornadas';

describe('Jornadas', () => {
  let component: Jornadas;
  let fixture: ComponentFixture<Jornadas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Jornadas],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(Jornadas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

