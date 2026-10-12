import { Module } from '@nestjs/common';
import { ReservaRepository } from './domain/repositories/reserva.repository';
import { PrismaReservaRepository } from './infrastructure/repositories/prisma-reserva.repository';
import { ReservasController } from './infrastructure/controllers/reservas.controller';

/**
 * ReservationsModule – Feature module
 */
@Module({
  controllers: [ReservasController],
  providers: [
    { provide: ReservaRepository, useClass: PrismaReservaRepository },
    // Use cases se agregarán aquí
  ],
  exports: [ReservaRepository],
})
export class ReservationsModule {}
