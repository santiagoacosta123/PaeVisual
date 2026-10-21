import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuSupervisor } from './menu-supervisor';

describe('MenuSupervisor', () => {
  let component: MenuSupervisor;
  let fixture: ComponentFixture<MenuSupervisor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuSupervisor],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuSupervisor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
