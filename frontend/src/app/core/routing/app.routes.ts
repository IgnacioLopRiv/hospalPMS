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
    path: 'recepcion',
    canActivate: [authGuard, permissionGuard('frontDesk')],
    loadComponent: () => import('../../features/reservations/presentation/pages/check-page/check-page.page').then(m => m.CheckPagePage),
  },
  {
    path: 'check-page',
    redirectTo: 'recepcion',
    pathMatch: 'full',
  },
  {
    path: 'main',
    redirectTo: 'recepcion',
    pathMatch: 'full',
  },
  {
    path: 'inicio',
    redirectTo: 'recepcion',
    pathMatch: 'full',
  },
  {
    path: 'sedes',
    canActivate: [authGuard, permissionGuard('changeSede')],
    loadComponent: () => import('../../features/locations/presentation/pages/sedes/sedes.page').then((m) => m.SedesPage),
  },
  {
    path: 'huespedes',
    canActivate: [authGuard, permissionGuard('frontDesk')],
    loadComponent: () => import('../../features/huespedes/presentation/pages/huespedes/huespedes.page').then((m) => m.HuespedesPage),
  },
  {
    path: 'guests-view',
    redirectTo: 'huespedes',
    pathMatch: 'full',
  },
  {
    path: 'habitaciones',
    canActivate: [authGuard, permissionGuard('viewRooms')],
    loadComponent: () => import('../../features/locations/presentation/pages/habitaciones/habitaciones.page').then((m) => m.HabitacionesPage),
  },
  {
    path: 'inventario',
    canActivate: [authGuard, permissionGuard('viewInventory')],
    loadComponent: () => import('../../features/inventory/presentation/pages/inventario/inventario.page').then((m) => m.InventarioPage),
  },
  {
    path: 'reportes',
    canActivate: [authGuard, permissionGuard('viewReports')],
    loadComponent: () => import('../../features/reports/presentation/pages/reportes/reportes.page').then((m) => m.ReportesPage),
  },
  {
    path: 'reservas',
    canActivate: [authGuard, permissionGuard('frontDesk')],
    loadComponent: () => import('../../features/reservations/presentation/pages/reservas/reservas.page').then((m) => m.ReservasPage),
  },
  {
    path: 'recepcion',
    canActivate: [authGuard, permissionGuard('frontDesk')],
    loadComponent: () => import('../../features/reservations/presentation/pages/check-page/check-page.page').then(m => m.CheckPagePage),
  },
  {
    path: 'check-page',
    redirectTo: 'recepcion',
    pathMatch: 'full',
  },
  {
    path: 'tarifas',
    canActivate: [authGuard, permissionGuard('viewReports')],
    loadComponent: () => import('../../features/locations/presentation/pages/tarifas').then((m) => m.TarifasPage),
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
