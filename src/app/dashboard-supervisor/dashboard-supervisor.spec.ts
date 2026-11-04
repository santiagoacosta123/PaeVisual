import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { DashboardSupervisor } from './dashboard-supervisor';

describe('DashboardSupervisor', () => {
  let component: DashboardSupervisor;
  let fixture: ComponentFixture<DashboardSupervisor>;
  const authService = {
    obtenerUsuario: () => null,
    obtenerInstitucionesSupervisor: () => [],
    institucionActiva$: of(null),
    obtenerInstitucionActiva: () => null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardSupervisor],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: HttpClient, useValue: { get: () => EMPTY } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardSupervisor);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links to the inventory-outflow report for Coordinator duties', () => {
    expect(fixture.nativeElement.textContent).toContain('Consultar salidas de inventario');
    expect(fixture.nativeElement.querySelector('a[href="/reportes-consumo"]')).toBeTruthy();
  });

  it('stops loading and shows an error when the institutions request completes empty', () => {
    expect(component.cargando).toBe(false);
    expect(component.errorMensaje).toContain('No se pudieron cargar');
  });
});
