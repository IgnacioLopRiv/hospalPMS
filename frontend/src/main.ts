import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './app/core/auth/presentation/auth.interceptor';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/core/routing/app.routes';
import { AppComponent } from './app/app.component';
import {
  alertEnterAnimation,
  alertLeaveAnimation,
  modalEnterAnimation,
  modalLeaveAnimation,
} from './app/shared/presentation/animations/overlay-animations';
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
import { CaracteristicaRepository } from './app/features/locations/domain/caracteristica.repository';
import { CaracteristicaHttpRepository } from './app/features/locations/infraestructure/caracteristica-http.repository';
import { ReportesRepository } from './app/features/reports/domain/reportes.repository';
import { ReportesHttpRepository } from './app/features/reports/infraestructure/reportes-http.repository';
import { PosRepository } from './app/features/payments-pos/domain/pos.repository';
import { PosHttpRepository } from './app/features/payments-pos/infraestructure/pos-http.repository';
import { POS_LOCAL_DRIVERS } from './app/features/payments-pos/domain/pos-local-driver';
import { TransbankLocalDriver } from './app/features/payments-pos/infraestructure/local/transbank-local.driver';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({
      modalEnter: modalEnterAnimation,
      modalLeave: modalLeaveAnimation,
      alertEnter: alertEnterAnimation,
      alertLeave: alertLeaveAnimation,
    }),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: HuespedRepository, useClass: HuespedHttpRepository },
    { provide: InventarioRepository, useClass: InventarioHttpRepository },
    { provide: TarifasRepository, useClass: TarifasHttpRepository },
    { provide: LocationsRepository, useClass: LocationsHttpRepository },
    { provide: ReservasRepository, useClass: ReservasHttpRepository },
    { provide: FotoHabitacionRepository, useClass: FotoHabitacionHttpRepository },
    { provide: CaracteristicaRepository, useClass: CaracteristicaHttpRepository },
    { provide: ReportesRepository, useClass: ReportesHttpRepository },
    { provide: HostalRepository, useClass: HostalHttpRepository },
    { provide: PosRepository, useClass: PosHttpRepository },
    TransbankLocalDriver,
    // Conectores de navegador para proveedores en modo 'local'.
    { provide: POS_LOCAL_DRIVERS, useFactory: (tbk: TransbankLocalDriver) => [tbk], deps: [TransbankLocalDriver] },
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});
