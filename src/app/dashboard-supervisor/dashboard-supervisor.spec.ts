import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardSupervisor } from './dashboard-supervisor';

describe('DashboardSupervisor', () => {
  let component: DashboardSupervisor;
  let fixture: ComponentFixture<DashboardSupervisor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardSupervisor],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardSupervisor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
