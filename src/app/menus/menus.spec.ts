import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Menus } from './menus';

describe('Menus', () => {
  let component: Menus;
  let fixture: ComponentFixture<Menus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Menus],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(Menus);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

