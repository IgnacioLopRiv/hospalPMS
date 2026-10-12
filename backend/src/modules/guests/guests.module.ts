import { Module } from '@nestjs/common';
import { HuespedRepository } from './domain/repositories/huesped.repository';
import { PrismaHuespedRepository } from './infrastructure/repositories/prisma-huesped.repository';
import { HuespedesController } from './infrastructure/controllers/huespedes.controller';

/**
 * GuestsModule – Feature module
 */
@Module({
  controllers: [HuespedesController],
  providers: [
    { provide: HuespedRepository, useClass: PrismaHuespedRepository },
    // Use cases se agregarán aquí
  ],
  exports: [HuespedRepository],
})
export class GuestsModule {}
