import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Permission } from '../domain/auth.roles';
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

  // Si el usuario es staff con sede asignada, redirigir directo a la sede
  const user = auth.currentUser();
  if (user?.role === 'staff' && user.sedeId) {
    const sede = sedeService.sedes().find((s) => s.id === user.sedeId);
    if (sede) {
      sedeService.selectSede(sede);
      return router.createUrlTree(['/huespedes']);
    }
  }

  return router.createUrlTree(['/sedes']);
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

    return router.createUrlTree(['/main']);
  };
};
