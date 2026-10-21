import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { ConfiguracionTarifa } from '../../domain/entities/configuracion-tarifa.entity';
import { ConfiguracionTarifaRepository } from '../../domain/repositories/configuracion-tarifa.repository';

@Injectable()
export class PrismaConfiguracionTarifaRepository implements ConfiguracionTarifaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySedeId(sedeId: number): Promise<ConfiguracionTarifa | null> {
    const row = await this.prisma.configuracionTarifa.findUnique({ where: { sedeId } });
    return row ? new ConfiguracionTarifa(row.id, row.sedeId, row.porcentajeAbono, row.tarifas as unknown[]) : null;
  }

  async save(data: { sedeId: number; porcentajeAbono: number; tarifas: unknown[] }): Promise<ConfiguracionTarifa> {
    const row = await this.prisma.configuracionTarifa.upsert({
      where: { sedeId: data.sedeId },
      create: {
        sedeId: data.sedeId,
        porcentajeAbono: data.porcentajeAbono,
        tarifas: data.tarifas as Prisma.InputJsonValue,
      },
      update: {
        porcentajeAbono: data.porcentajeAbono,
        tarifas: data.tarifas as Prisma.InputJsonValue,
      },
    });
    return new ConfiguracionTarifa(row.id, row.sedeId, row.porcentajeAbono, row.tarifas as unknown[]);
  }
}