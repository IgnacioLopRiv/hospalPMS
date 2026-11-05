import { Module } from '@nestjs/common';
import { HostalRepository } from './domain/repositories/hostal.repository';
import { PrismaHostalRepository } from './infrastructure/repositories/prisma-hostal.repository';
import { HostalesController } from './infrastructure/controllers/hostales.controller';

/**
 * HostalModule – Feature module
 *
 * Expone el repositorio para que otros módulos puedan inyectarlo
 * (p. ej. LocationsModule lo necesita para validar hostalId al crear sedes).
 */
@Module({
  controllers: [HostalesController],
  providers: [{ provide: HostalRepository, useClass: PrismaHostalRepository }],
  exports: [HostalRepository],
})
export class HostalModule {}
