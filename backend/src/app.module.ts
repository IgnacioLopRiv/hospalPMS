import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { GuestsModule } from './modules/guests/guests.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { HostalModule } from './modules/hostal/hostal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LocationsModule,
    GuestsModule,
    ReservationsModule,
    InventoryModule,
    HostalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
