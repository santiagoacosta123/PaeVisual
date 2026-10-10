import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NuevoProducto } from './nuevo-producto';
import { SweetAlertService } from '../sweet-alert.service';

describe('NuevoProducto', () => {
  let component: NuevoProducto;
  let fixture: ComponentFixture<NuevoProducto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NuevoProducto],
      providers: [
        provideRouter([]),
        {
          provide: SweetAlertService,
          useValue: {
            success: vi.fn(),
            warning: vi.fn(),
            confirm: vi.fn(() => Promise.resolve({ isConfirmed: false })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NuevoProducto);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
