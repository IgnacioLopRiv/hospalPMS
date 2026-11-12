import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { LocationsRepository } from '../../../features/locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../features/locations/domain/testing/locations.repository.stub';
import { AuthService } from '../application/auth.service';
import { Permission, UserRole } from '../domain/auth.roles';
import { permissionGuard } from './auth.guard';

describe('permissionGuard (acceso por rol)', () => {
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub() },
      ],
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => auth.logout());

  const loginAs = (role: UserRole) =>
    auth.currentUser.set({ id: 1, name: 'Usuario', email: 'u@hostal.cl', role, sedeId: 1 });

  const run = (permission: Permission) =>
    TestBed.runInInjectionContext(() =>
      permissionGuard(permission)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  const urlOf = (result: unknown) => router.serializeUrl(result as UrlTree);

  it('el rol aseo solo entra a habitaciones e inventario', () => {
    loginAs('aseo');

    expect(run('viewRooms')).toBeTrue();
    expect(run('viewInventory')).toBeTrue();
    for (const permission of ['frontDesk', 'changeSede', 'viewReports', 'manageUsers'] as Permission[]) {
      expect(urlOf(run(permission))).withContext(permission).toBe('/habitaciones');
    }
  });

  it('staff mantiene recepción, habitaciones e inventario, y vuelve a recepción si no tiene permiso', () => {
    loginAs('staff');

    expect(run('frontDesk')).toBeTrue();
    expect(run('viewRooms')).toBeTrue();
    expect(run('viewInventory')).toBeTrue();
    expect(urlOf(run('viewReports'))).toBe('/recepcion');
  });

  it('el administrador tiene acceso a todo', () => {
    loginAs('admin');

    for (const permission of ['frontDesk', 'changeSede', 'viewRooms', 'viewInventory', 'viewReports', 'manageUsers'] as Permission[]) {
      expect(run(permission)).withContext(permission).toBeTrue();
    }
  });
});
