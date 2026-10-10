import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InicioComponent } from './inicio';
import { AuthService } from '../services/auth.service';

describe('InicioComponent', () => {
  let component: InicioComponent;
  let fixture: ComponentFixture<InicioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InicioComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            obtenerUsuario: () => ({
              nombre: 'Ana',
              apellido: 'Pérez',
              correo: 'ana@example.com',
              rol: 'Administrador',
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InicioComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
