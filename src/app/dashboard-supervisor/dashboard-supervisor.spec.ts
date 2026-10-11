import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardSupervisor } from './dashboard-supervisor';

describe('DashboardSupervisor', () => {
  let component: DashboardSupervisor;
  let fixture: ComponentFixture<DashboardSupervisor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardSupervisor],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardSupervisor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links to the inventory-outflow report for Coordinator duties', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Consultar salidas de inventario');
    expect(fixture.nativeElement.querySelector('a[href="/reportes-consumo"]')).toBeTruthy();
  });
});
