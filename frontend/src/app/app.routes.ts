import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'recuperar',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/recuperar/recuperar.page').then((m) => m.RecuperarPage),
  },
  {
    path: 'restablecer',
    loadComponent: () =>
      import('./pages/restablecer/restablecer.page').then((m) => m.RestablecerPage),
  },
  {
    path: 'sedes',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/sedes/sedes.page').then((m) => m.SedesPage),
  },
  {
    path: 'main',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/main/main.page').then((m) => m.MainPage),
  },
  {
    path: 'habitaciones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/habitaciones/habitaciones.page').then((m) => m.HabitacionesPage),
  },
  {
    path: 'reservas',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/reservas/reservas.page').then((m) => m.ReservasPage),
  },
  {
    path: 'reportes',
    canActivate: [authGuard, permissionGuard('viewReports')],
    loadComponent: () => import('./pages/reportes/reportes.page').then((m) => m.ReportesPage),
  },
];
