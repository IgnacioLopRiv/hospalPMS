import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { Tarifa, TarifaPeriodo, TipoTemporada } from '../../domain/entities/tarifa.entity';
import { TarifaData, TarifaRepository } from '../../domain/repositories/tarifa.repository';

const INCLUDE_PRECIOS = { precios: true } as const;
type PrismaTarifaConPrecios = Prisma.TarifaGetPayload<{ include: typeof INCLUDE_PRECIOS }>;

/**
 * Adaptador de repositorio Prisma para Tarifa – Infrastructure layer
 *
 * Los precios por tipología se guardan en tarifa_tipologia y se exponen
 * a la capa de dominio como un mapa tipologiaId → precio.
 */
@Injectable()
export class PrismaTarifaRepository implements TarifaRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(raw: PrismaTarifaConPrecios): Tarifa {
    return new Tarifa(
      raw.id,
      raw.sedeId,
      raw.tarifaAbonoId,
      raw.nombre,
      raw.precioBase,
      raw.fechaInicio,
      raw.fechaFin,
      raw.tipoTemporada as TipoTemporada,
      raw.activa,
      raw.periodos as unknown as TarifaPeriodo[],
      Object.fromEntries(raw.precios.map((precio) => [precio.tipologiaId, precio.precio])),
    );
  }

  private toPreciosRows(precios: Record<number, number>) {
    return Object.entries(precios).map(([tipologiaId, precio]) => ({ tipologiaId: Number(tipologiaId), precio }));
  }

  async findBySedeId(sedeId: number): Promise<Tarifa[]> {
    const rows = await this.prisma.tarifa.findMany({
      where: { sedeId },
      include: INCLUDE_PRECIOS,
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findById(id: number): Promise<Tarifa | null> {
    const row = await this.prisma.tarifa.findUnique({ where: { id }, include: INCLUDE_PRECIOS });
    return row ? this.toEntity(row) : null;
  }

  async create(data: TarifaData): Promise<Tarifa> {
    const row = await this.prisma.tarifa.create({
      data: {
        sedeId: data.sedeId,
        tarifaAbonoId: data.tarifaAbonoId,
        nombre: data.nombre,
        precioBase: data.precioBase,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        tipoTemporada: data.tipoTemporada,
        activa: data.activa,
        periodos: data.periodos as unknown as Prisma.InputJsonValue,
        precios: { create: this.toPreciosRows(data.precios) },
      },
      include: INCLUDE_PRECIOS,
    });
    return this.toEntity(row);
  }

  async update(id: number, data: Partial<Omit<TarifaData, 'sedeId'>>): Promise<Tarifa> {
    const row = await this.prisma.tarifa.update({
      where: { id },
      data: {
        ...(data.tarifaAbonoId !== undefined ? { tarifaAbonoId: data.tarifaAbonoId } : {}),
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.precioBase !== undefined ? { precioBase: data.precioBase } : {}),
        ...(data.fechaInicio !== undefined ? { fechaInicio: data.fechaInicio } : {}),
        ...(data.fechaFin !== undefined ? { fechaFin: data.fechaFin } : {}),
        ...(data.tipoTemporada !== undefined ? { tipoTemporada: data.tipoTemporada } : {}),
        ...(data.activa !== undefined ? { activa: data.activa } : {}),
        ...(data.periodos !== undefined ? { periodos: data.periodos as unknown as Prisma.InputJsonValue } : {}),
        ...(data.precios !== undefined
          ? { precios: { deleteMany: {}, create: this.toPreciosRows(data.precios) } }
          : {}),
      },
      include: INCLUDE_PRECIOS,
    });
    return this.toEntity(row);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.tarifa.delete({ where: { id } });
  }
}
