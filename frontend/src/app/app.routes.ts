import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'guests-view',
    pathMatch: 'full',
  },
  {
    path: 'home',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'guests-view',
    loadComponent: () => import('./pages/guests-view/guests-view.page').then((m) => m.GuestsViewPage),
  },
  {
    path: 'habitaciones',
    loadComponent: () => import('./pages/habitaciones/habitaciones.page').then((m) => m.HabitacionesPage),
  },
  {
    path: 'main',
    loadComponent: () => import('./pages/main/main.page').then((m) => m.MainPage),
  },
  {
    path: 'reservas',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/reservas/reservas.page').then((m) => m.ReservasPage),
  }
];
