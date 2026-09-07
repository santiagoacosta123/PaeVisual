import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NuevoProducto } from './nuevo-producto';

describe('NuevoProducto', () => {
  let component: NuevoProducto;
  let fixture: ComponentFixture<NuevoProducto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NuevoProducto],
    }).compileComponents();

    fixture = TestBed.createComponent(NuevoProducto);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
