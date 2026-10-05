import { Module } from '@nestjs/common';
import { ReservaRepository } from './domain/repositories/reserva.repository';
import { PrismaReservaRepository } from './infrastructure/repositories/prisma-reserva.repository';

/**
 * ReservationsModule – Feature module
 */
@Module({
  providers: [
    { provide: ReservaRepository, useClass: PrismaReservaRepository },
    // Use cases se agregarán aquí
  ],
  exports: [ReservaRepository],
})
export class ReservationsModule {}
