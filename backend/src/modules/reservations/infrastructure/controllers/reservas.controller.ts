import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EstadoReserva, MetodoPago, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

interface ReservaInput {
  id_huesped?: number;
  id_habitacion?: number;
  fecha_llegada?: string;
  fecha_salida?: string;
  hora_llegada?: string;
  cantidad_personas?: number;
  estado_reserva?: 'CONFIRMADA' | 'HOSPEDADO' | 'CHECK-IN HOY' | 'CHECK-OUT HOY' | 'FINALIZADA';
  precio_total?: number;
  porcentaje_abono?: number;
  monto_pagado?: number;
  metodo_pago?: 'transferencia' | 'efectivo';
  pago_completo?: boolean;
}

@Controller('reservas')
export class ReservasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query('sedeId') sedeId?: string) {
    const reservas = await this.prisma.reserva.findMany({
      where: sedeId ? { habitacion: { sedeId: Number(sedeId) } } : undefined,
      orderBy: { fechaCheckIn: 'asc' },
    });
    return reservas.map((reservation) => this.toFrontend(reservation));
  }

  @Post()
  async create(@Body() input: ReservaInput) {
    const reservation = await this.prisma.reserva.create({
      data: this.toDatabase(input) as Prisma.ReservaUncheckedCreateInput,
    });
    return this.toFrontend(reservation);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: ReservaInput) {
    try {
      const reservation = await this.prisma.reserva.update({
        where: { id },
        data: this.toDatabase(input, true) as Prisma.ReservaUncheckedUpdateInput,
      });
      return this.toFrontend(reservation);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la reserva ${id}.`);
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.pago.deleteMany({ where: { reservaId: id } });
        await transaction.documentoFacturacion.deleteMany({ where: { reservaId: id } });
        await transaction.reserva.delete({ where: { id } });
      });
      return { deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`No existe la reserva ${id}.`);
      }
      throw error;
    }
  }

  private toDatabase(input: ReservaInput, partial = false): Prisma.ReservaUncheckedCreateInput | Prisma.ReservaUncheckedUpdateInput {
    const state = input.estado_reserva === 'HOSPEDADO' ? EstadoReserva.EN_CURSO
      : input.estado_reserva === 'FINALIZADA' ? EstadoReserva.FINALIZADA
        : input.estado_reserva === 'CHECK-OUT HOY' ? EstadoReserva.EN_CURSO
          : EstadoReserva.CONFIRMADA;
    const paymentMethod = input.metodo_pago === 'transferencia' ? MetodoPago.TRANSFERENCIA
      : input.metodo_pago === 'efectivo' ? MetodoPago.EFECTIVO
        : undefined;
    return {
      ...(input.id_huesped !== undefined ? { huespedId: input.id_huesped } : {}),
      ...(input.id_habitacion !== undefined ? { habitacionId: input.id_habitacion } : {}),
      ...(input.fecha_llegada !== undefined ? { fechaCheckIn: new Date(`${input.fecha_llegada}T00:00:00`) } : {}),
      ...(input.fecha_salida !== undefined ? { fechaCheckOut: new Date(`${input.fecha_salida}T00:00:00`) } : {}),
      ...(input.hora_llegada !== undefined ? { horaLlegada: input.hora_llegada } : {}),
      ...(input.cantidad_personas !== undefined ? { cantidadPersonas: input.cantidad_personas } : {}),
      ...(input.estado_reserva !== undefined ? { estado: state } : partial ? {} : { estado: EstadoReserva.CONFIRMADA }),
      ...(input.precio_total !== undefined ? { precioTotal: input.precio_total } : {}),
      ...(input.porcentaje_abono !== undefined ? { porcentajeAbono: input.porcentaje_abono } : {}),
      ...(input.monto_pagado !== undefined ? { montoPagado: input.monto_pagado } : {}),
      ...(paymentMethod !== undefined ? { metodoPago: paymentMethod } : {}),
      ...(input.pago_completo !== undefined ? { pagoCompleto: input.pago_completo } : {}),
    };
  }

  private toFrontend(reservation: {
    id: number;
    huespedId: number;
    habitacionId: number;
    fechaCheckIn: Date;
    fechaCheckOut: Date;
    horaLlegada?: string | null;
    cantidadPersonas?: number;
    precioTotal?: number | null;
    porcentajeAbono?: number | null;
    montoPagado?: number | null;
    metodoPago?: MetodoPago | null;
    pagoCompleto?: boolean;
    estado: EstadoReserva;
  }) {
    return {
      id_reserva: reservation.id,
      id_huesped: reservation.huespedId,
      id_habitacion: reservation.habitacionId,
      fecha_llegada: reservation.fechaCheckIn.toISOString().slice(0, 10),
      fecha_salida: reservation.fechaCheckOut.toISOString().slice(0, 10),
      hora_llegada: reservation.horaLlegada ?? undefined,
      cantidad_personas: reservation.cantidadPersonas ?? 1,
      estado_reserva: reservation.estado === EstadoReserva.EN_CURSO ? 'HOSPEDADO'
        : reservation.estado === EstadoReserva.FINALIZADA ? 'FINALIZADA' : 'CONFIRMADA',
      precio_total: reservation.precioTotal ?? undefined,
      porcentaje_abono: reservation.porcentajeAbono ?? undefined,
      monto_pagado: reservation.montoPagado ?? undefined,
      metodo_pago: reservation.metodoPago === MetodoPago.TRANSFERENCIA ? 'transferencia'
        : reservation.metodoPago === MetodoPago.EFECTIVO ? 'efectivo' : undefined,
      pago_completo: reservation.pagoCompleto ?? false,
    };
  }
}