import { Injectable } from '@nestjs/common';
import type { TarifaAbono as PrismaTarifaAbono } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import {
  PORCENTAJE_ABONO_POR_DEFECTO,
  TarifaAbono,
} from '../../domain/entities/tarifa-abono.entity';
import { TarifaAbonoRepository } from '../../domain/repositories/tarifa-abono.repository';

/**
 * Adaptador de repositorio Prisma para TarifaAbono – Infrastructure layer
 */
@Injectable()
export class PrismaTarifaAbonoRepository implements TarifaAbonoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(raw: PrismaTarifaAbono): TarifaAbono {
    return new TarifaAbono(raw.id, raw.sedeId, raw.porcentajeAbono);
  }

  async findBySedeId(sedeId: number): Promise<TarifaAbono | null> {
    const row = await this.prisma.tarifaAbono.findUnique({ where: { sedeId } });
    return row ? this.toEntity(row) : null;
  }

  async ensureForSede(sedeId: number): Promise<TarifaAbono> {
    const row = await this.prisma.tarifaAbono.upsert({
      where: { sedeId },
      create: { sedeId, porcentajeAbono: PORCENTAJE_ABONO_POR_DEFECTO },
      update: {},
    });
    return this.toEntity(row);
  }

  async save(data: {
    sedeId: number;
    porcentajeAbono: number;
  }): Promise<TarifaAbono> {
    const row = await this.prisma.tarifaAbono.upsert({
      where: { sedeId: data.sedeId },
      create: { sedeId: data.sedeId, porcentajeAbono: data.porcentajeAbono },
      update: { porcentajeAbono: data.porcentajeAbono },
    });
    return this.toEntity(row);
  }
}
