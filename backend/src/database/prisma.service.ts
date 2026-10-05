import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService – Infrastructure layer
 *
 * Envuelve PrismaClient y gestiona el ciclo de vida de la conexión
 * siguiendo las buenas prácticas de NestJS + Clean Architecture.
 *
 * Prisma 7+: la URL de conexión se pasa directamente al constructor
 * en lugar de definirse en schema.prisma.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

