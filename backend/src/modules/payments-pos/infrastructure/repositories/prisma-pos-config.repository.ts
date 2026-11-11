import { Injectable } from '@nestjs/common';
import { ConfiguracionPos, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import {
  PosConfigRecord,
  PosConfigRepository,
  PosConfigUpsert,
} from '../../domain/pos-config.repository';

@Injectable()
export class PrismaPosConfigRepository extends PosConfigRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async sedeExists(sedeId: number): Promise<boolean> {
    const count = await this.prisma.sede.count({ where: { id: sedeId } });
    return count > 0;
  }

  async findBySede(sedeId: number): Promise<PosConfigRecord | null> {
    const row = await this.prisma.configuracionPos.findUnique({
      where: { sedeId },
    });
    return row ? this.toRecord(row) : null;
  }

  async upsert(
    sedeId: number,
    data: PosConfigUpsert,
  ): Promise<PosConfigRecord> {
    const values = {
      proveedor: data.proveedor,
      activo: data.activo,
      credenciales: data.credenciales,
      parametros: data.parametros as Prisma.InputJsonObject,
    };
    const row = await this.prisma.configuracionPos.upsert({
      where: { sedeId },
      create: { sedeId, ...values },
      update: values,
    });
    return this.toRecord(row);
  }

  private toRecord(row: ConfiguracionPos): PosConfigRecord {
    const parametros =
      row.parametros &&
      typeof row.parametros === 'object' &&
      !Array.isArray(row.parametros)
        ? (row.parametros as Record<string, unknown>)
        : {};
    return {
      sedeId: row.sedeId,
      proveedor: row.proveedor,
      activo: row.activo,
      credenciales: row.credenciales,
      parametros,
      actualizadoAt: row.actualizadoAt,
    };
  }
}
