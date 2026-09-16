import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HabitacionesPage } from './habitaciones.page';
import { AuthService } from '../../../../../core/auth/application/auth.service';

describe('HabitacionesPage', () => {
  let component: HabitacionesPage;
  let fixture: ComponentFixture<HabitacionesPage>;
  let authService: AuthService;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HabitacionesPage],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(HabitacionesPage);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not open modal when user is not admin', () => {
    authService.currentUser.set({
      id: 2,
      name: 'Recepcionista',
      email: 'recepcion@hostal.cl',
      role: 'staff',
    });

    component.addHabitaciones();
    expect(component.editHabitacionesOpen()).toBeFalse();
  });

  it('should open modal when user is admin', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });

    component.addHabitaciones();
    expect(component.editHabitacionesOpen()).toBeTrue();
  });
});
