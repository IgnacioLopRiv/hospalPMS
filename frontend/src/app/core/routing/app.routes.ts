import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from '../auth/presentation/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    canActivate: [guestGuard],
    loadComponent: () => import('../auth/presentation/pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'main',
    loadComponent: () => import('../../features/dashboard/presentation/pages/main/main.page').then((m) => m.MainPage),
  },
  {
    path: 'sedes',
    canActivate: [authGuard],
    loadComponent: () => import('../../features/locations/presentation/pages/sedes/sedes.page').then((m) => m.SedesPage),
  },
  {
    path: 'guests-view',
    loadComponent: () => import('../../features/guests/presentation/pages/guests-view/guests-view.page').then((m) => m.GuestsViewPage),
  },
{
    path: 'habitaciones',
    canActivate: [authGuard],
    loadComponent: () =>import('../../features/locations/presentation/pages/habitaciones/habitaciones.page').then((m) => m.HabitacionesPage),
  },
  {
    path: 'reportes',
    canActivate: [authGuard, permissionGuard('viewReports')],
    loadComponent: () => import('../../features/reports/presentation/pages/reportes/reportes.page').then((m) => m.ReportesPage),
  },
  {
    path: 'reservas',
    canActivate: [authGuard],
    loadComponent: () => import('../../features/reservations/presentation/pages/reservas/reservas.page').then((m) => m.ReservasPage),
  },
  {
    path: 'check-page',
    loadComponent: () => import('../../features/reservations/presentation/pages/check-page/check-page.page').then( m => m.CheckPagePage)
  },
  {
    path: 'recuperar',
    loadComponent: () => import('../auth/presentation/pages/recuperar/recuperar.page').then((m) => m.RecuperarPage),
  },
  {
    path: 'restablecer',
    loadComponent: () => import('../auth/presentation/pages/restablecer/restablecer.page').then((m) => m.RestablecerPage),
  }

];
