import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UnidadesMedidaComponent } from './unidades-medida';

describe('UnidadesMedidaComponent', () => {
  let component: UnidadesMedidaComponent;
  let fixture: ComponentFixture<UnidadesMedidaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnidadesMedidaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UnidadesMedidaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
