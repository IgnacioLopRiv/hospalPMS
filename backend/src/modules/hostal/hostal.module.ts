import { Module } from '@nestjs/common';
import { HostalRepository } from './domain/repositories/hostal.repository';
import { HostalesController } from './infrastructure/controllers/hostales.controller';
import { PrismaHostalRepository } from './infrastructure/repositories/prisma-hostal.repository';

@Module({
  controllers: [HostalesController],
  providers: [{ provide: HostalRepository, useClass: PrismaHostalRepository }],
  exports: [HostalRepository],
})
export class HostalModule {}