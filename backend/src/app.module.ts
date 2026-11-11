import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { HostalModule } from './modules/hostal/hostal.module';
import { LocationsModule } from './modules/locations/locations.module';
import { StaffModule } from './modules/staff/staff.module';
import { GuestsModule } from './modules/guests/guests.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { BillingModule } from './modules/billing/billing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsPosModule } from './modules/payments-pos/payments-pos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    HostalModule,
    LocationsModule,
    StaffModule,
    GuestsModule,
    ReservationsModule,
    InventoryModule,
    BillingModule,
    ReportsModule,
    NotificationsModule,
    PaymentsPosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
