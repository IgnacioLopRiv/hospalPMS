import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'sedes',
    loadComponent: () => import('./pages/sedes/sedes.page').then((m) => m.SedesPage),
  },
  {
    path: 'main',
    loadComponent: () => import('./pages/main/main.page').then((m) => m.MainPage),
  },
  {
    path: 'habitaciones',
    loadComponent: () =>
      import('./pages/habitaciones/habitaciones.page').then((m) => m.HabitacionesPage),
  },
  {
    path: 'reservas',
    loadComponent: () => import('./pages/reservas/reservas.page').then((m) => m.ReservasPage),
  },
];
