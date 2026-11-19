import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../application/auth.service';

/** Rutas de /auth que no deben cerrar sesión al responder 401. */
const PUBLIC_AUTH_PATHS = ['/auth/login'];

/**
 * RF-07: adjunta el JWT a cada petición hacia la API y, si la API responde 401
 * (token vencido o inválido), cierra la sesión y vuelve al login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const token = auth.token();
  const request =
    isApiRequest && token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      const isPublic = PUBLIC_AUTH_PATHS.some((path) => req.url.includes(path));
      if (
        isApiRequest &&
        !isPublic &&
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        auth.isAuthenticated()
      ) {
        auth.logout();
        void router.navigateByUrl('/home');
      }
      return throwError(() => error);
    }),
  );
};
