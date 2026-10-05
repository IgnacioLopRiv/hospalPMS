import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * DatabaseModule – Infrastructure layer
 *
 * Módulo global que provee PrismaService a toda la aplicación.
 * Al ser @Global(), no es necesario importarlo en cada feature module.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
