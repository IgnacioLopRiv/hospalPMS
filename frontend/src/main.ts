import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/core/routing/app.routes';
import { AppComponent } from './app/app.component';
import { HuespedRepository } from './app/features/huespedes/domain/huesped.repository';
import { HuespedHttpRepository } from './app/features/huespedes/infraestructure/huesped-http.repository';
import { InventarioRepository } from './app/features/inventory/domain/inventario.repository';
import { InventarioHttpRepository } from './app/features/inventory/infraestructure/inventario-http.repository';
import { TarifasRepository } from './app/features/locations/domain/tarifas.repository';
import { TarifasHttpRepository } from './app/features/locations/infraestructure/tarifas-http.repository';
import { LocationsRepository } from './app/features/locations/domain/locations.repository';
import { LocationsHttpRepository } from './app/features/locations/infraestructure/locations-http.repository';
import { ReservasRepository } from './app/features/reservations/domain/reservas.repository';
import { ReservasHttpRepository } from './app/features/reservations/infraestructure/reservas-http.repository';
import { HostalRepository } from './app/features/hostal/domain/hostal.repository';
import { HostalHttpRepository } from './app/features/hostal/infraestructure/hostal-http.repository';
import { FotoHabitacionRepository } from './app/features/locations/domain/foto-habitacion.repository';
import { FotoHabitacionHttpRepository } from './app/features/locations/infraestructure/foto-habitacion-http.repository';
import { ReportesRepository } from './app/features/reports/domain/reportes.repository';
import { ReportesHttpRepository } from './app/features/reports/infraestructure/reportes-http.repository';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideHttpClient(),
    { provide: HuespedRepository, useClass: HuespedHttpRepository },
    { provide: InventarioRepository, useClass: InventarioHttpRepository },
    { provide: TarifasRepository, useClass: TarifasHttpRepository },
    { provide: LocationsRepository, useClass: LocationsHttpRepository },
    { provide: ReservasRepository, useClass: ReservasHttpRepository },
    { provide: FotoHabitacionRepository, useClass: FotoHabitacionHttpRepository },
    { provide: ReportesRepository, useClass: ReportesHttpRepository },
    { provide: HostalRepository, useClass: HostalHttpRepository },
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});
