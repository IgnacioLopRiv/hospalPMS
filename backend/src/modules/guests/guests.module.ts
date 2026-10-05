import { Module } from '@nestjs/common';
import { HuespedRepository } from './domain/repositories/huesped.repository';
import { PrismaHuespedRepository } from './infrastructure/repositories/prisma-huesped.repository';

/**
 * GuestsModule – Feature module
 */
@Module({
  providers: [
    { provide: HuespedRepository, useClass: PrismaHuespedRepository },
    // Use cases se agregarán aquí
  ],
  exports: [HuespedRepository],
})
export class GuestsModule {}
