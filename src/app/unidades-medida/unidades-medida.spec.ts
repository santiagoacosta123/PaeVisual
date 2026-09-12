import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UnidadesMedida } from './unidades-medida';

describe('UnidadesMedida', () => {
  let component: UnidadesMedida;
  let fixture: ComponentFixture<UnidadesMedida>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnidadesMedida],
    }).compileComponents();

    fixture = TestBed.createComponent(UnidadesMedida);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
