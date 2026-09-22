import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { SedesPage } from './sedes.page';
import { AuthService } from '../../../../../core/auth/application/auth.service';

describe('SedesPage', () => {
  let component: SedesPage;
  let fixture: ComponentFixture<SedesPage>;
  let authService: AuthService;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [SedesPage],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(SedesPage);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('canEditSede should return false for staff users', () => {
    authService.currentUser.set({
      id: 2,
      name: 'Recepcionista',
      email: 'recepcion@hostal.cl',
      role: 'staff',
    });

    expect(component.canEditSede()).toBeFalse();
  });

  it('canEditSede should return true for admin users', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });

    expect(component.canEditSede()).toBeTrue();
  });
});

