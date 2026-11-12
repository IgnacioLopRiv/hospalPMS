import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { LocationsRepository } from '../../../../features/locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../../features/locations/domain/testing/locations.repository.stub';
import { AuthService } from '../../../auth/application/auth.service';
import { UserRole } from '../../../auth/domain/auth.roles';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent (menú por rol)', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let auth: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub() },
      ],
    }).compileComponents();
    auth = TestBed.inject(AuthService);
    fixture = TestBed.createComponent(SidebarComponent);
  });

  afterEach(() => auth.logout());

  const showAs = (role: UserRole) => {
    auth.currentUser.set({ id: 1, name: 'Ana Pérez', email: 'ana@hostal.cl', role, sedeId: 1 });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return {
      links: Array.from(element.querySelectorAll<HTMLAnchorElement>('.nav-menu a.nav-item'))
        .map((link) => link.getAttribute('routerLink') ?? link.getAttribute('href')),
      roleLabel: element.querySelector('.sidebar-user small')?.textContent?.trim(),
      hasLogout: !!element.querySelector('.logout-btn'),
    };
  };

  it('el personal de aseo solo ve Habitaciones e Inventario, su rol y cerrar sesión', () => {
    const view = showAs('aseo');

    expect(view.links).toEqual(['/habitaciones', '/inventario']);
    expect(view.roleLabel).toBe('Personal de aseo');
    expect(view.hasLogout).toBeTrue();
  });

  it('staff ve recepción, huéspedes, reservas, habitaciones e inventario, pero no reportes ni tarifas', () => {
    const view = showAs('staff');

    expect(view.links).toEqual(['/recepcion', '/huespedes', '/reservas', '/habitaciones', '/inventario']);
  });

  it('el administrador además ve reportes y tarifas', () => {
    const view = showAs('admin');

    expect(view.links).toContain('/reportes');
    expect(view.links).toContain('/tarifas');
    expect(view.roleLabel).toBe('Administrador');
  });
});
