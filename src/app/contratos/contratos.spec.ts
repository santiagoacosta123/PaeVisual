import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ContratosComponent } from './contratos';
import { SiraeService } from '../services/contratos_pae.service';

describe('ContratosComponent', () => {
  let component: ContratosComponent;
  let fixture: ComponentFixture<ContratosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContratosComponent],
      providers: [
        provideRouter([]),
        {
          provide: SiraeService,
          useValue: {
            getContratos: () => of([]),
            getJornadas: () => of([]),
            getSeccionesMenu: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContratosComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});