import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Permission, ROLES_WITH_SEDE } from '../domain/auth.roles';
import { AuthService } from '../application/auth.service';
import { SedeService } from '../../../features/locations/application/sede.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/home']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const sedeService = inject(SedeService);

  if (!auth.isAuthenticated()) {
    return true;
  }

  // Si el usuario trabaja en una sede asignada (staff o aseo), entra directo a ella
  const user = auth.currentUser();
  if (user && ROLES_WITH_SEDE.includes(user.role) && user.sedeId) {
    const sede = sedeService.sedes().find((s) => s.id === user.sedeId);
    if (sede) {
      sedeService.selectSede(sede);
      return router.createUrlTree([user.role === 'staff' ? '/huespedes' : auth.homeRoute()]);
    }
  }

  return router.createUrlTree([auth.homeRoute()]);
};

export const permissionGuard = (permission: Permission): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/home']);
    }

    if (auth.can(permission)) {
      return true;
    }

    // Sin permiso: vuelve a la página de inicio de su rol (aseo → habitaciones)
    return router.createUrlTree([auth.homeRoute()]);
  };
};
