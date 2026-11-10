import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { EstadoHabitacion, EstadoReserva } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

const ACTIVE_STATES: EstadoReserva[] = [
  EstadoReserva.CONFIRMADA,
  EstadoReserva.EN_CURSO,
];

@Controller('reportes')
export class ReportesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('resumen')
  async resumen(@Query('sedeId') sedeIdRaw?: string) {
    if (!sedeIdRaw || !/^\d+$/.test(sedeIdRaw)) {
      throw new BadRequestException('Se requiere un sedeId válido.');
    }
    const sedeId = Number(sedeIdRaw);

    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { id: true },
    });
    if (!sede) throw new NotFoundException(`No existe la sede ${sedeId}.`);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const previousYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const previousYearEnd = new Date(now.getFullYear(), 0, 1);

    const [rooms, reservas, pagos, inventario] = await Promise.all([
      this.prisma.habitacion.findMany({
        where: { sedeId, activa: true },
        select: {
          id: true,
          estado: true,
          reservas: {
            select: { fechaCheckIn: true, fechaCheckOut: true, estado: true },
          },
        },
      }),
      this.prisma.reserva.findMany({
        where: { habitacion: { sedeId } },
        select: {
          id: true,
          fechaCheckIn: true,
          fechaCheckOut: true,
          precioTotal: true,
          montoPagado: true,
          estado: true,
        },
      }),
      this.prisma.pago.findMany({
        where: { reserva: { habitacion: { sedeId } } },
        select: { monto: true, tipoOperacion: true, fechaPago: true },
      }),
      this.prisma.insumoInventario.findMany({
        where: { sedeId },
        select: { stockActual: true, stockMinimo: true, activo: true },
      }),
    ]);

    const totalHabitaciones = rooms.length;
    const occupiedRooms = rooms.filter((room) => {
      if (room.estado === EstadoHabitacion.OCUPADA) return true;
      return room.reservas.some(
        (reserva) =>
          ACTIVE_STATES.includes(reserva.estado) &&
          reserva.fechaCheckIn <= now &&
          reserva.fechaCheckOut > now,
      );
    }).length;
    const availableRooms = Math.max(0, totalHabitaciones - occupiedRooms);
    const occupancyRate =
      totalHabitaciones === 0
        ? 0
        : Math.round((occupiedRooms / totalHabitaciones) * 100);

    const monthReservations = reservas.filter(
      (reserva) =>
        reserva.fechaCheckIn >= monthStart && reserva.fechaCheckIn < monthEnd,
    );
    const monthReservationCount = monthReservations.length;
    const monthCancelaciones = monthReservations.filter(
      (reserva) => reserva.estado === EstadoReserva.CANCELADA,
    ).length;

    const byPaymentDate = (from: Date, to: Date) =>
      pagos
        .filter((pago) => pago.fechaPago >= from && pago.fechaPago < to)
        .reduce(
          (total, pago) =>
            total +
            (pago.tipoOperacion === 'REEMBOLSO' ? -pago.monto : pago.monto),
          0,
        );
    const monthIncome = byPaymentDate(monthStart, monthEnd);
    const previousMonthIncome = byPaymentDate(
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
      monthStart,
    );
    const yearIncome = byPaymentDate(yearStart, now);
    const previousYearIncome = byPaymentDate(
      previousYearStart,
      previousYearEnd,
    );

    const pendingAmount = reservas
      .filter(
        (reserva) => !['FINALIZADA', 'CANCELADA'].includes(reserva.estado),
      )
      .reduce(
        (total, reserva) =>
          total +
          Math.max(0, (reserva.precioTotal ?? 0) - (reserva.montoPagado ?? 0)),
        0,
      );

    const totalNights = reservas.reduce((total, reserva) => {
      const nights = Math.round(
        (reserva.fechaCheckOut.getTime() - reserva.fechaCheckIn.getTime()) /
          86_400_000,
      );
      return total + Math.max(0, nights);
    }, 0);
    const averageStayNights =
      reservas.length === 0
        ? 0
        : Math.round((totalNights / reservas.length) * 10) / 10;

    const lowStockCount = inventario.filter(
      (insumo) => insumo.activo && insumo.stockActual <= insumo.stockMinimo,
    ).length;

    return {
      sedeId,
      fecha: now.toISOString(),
      habitaciones: {
        total: totalHabitaciones,
        ocupadas: occupiedRooms,
        disponibles: availableRooms,
        tasaOcupacion: occupancyRate,
      },
      reservas: {
        total: reservas.length,
        mes: monthReservationCount,
        canceladasMes: monthCancelaciones,
        pendientes: reservas.filter(
          (reserva) => reserva.estado === EstadoReserva.CONFIRMADA,
        ).length,
        enCurso: reservas.filter(
          (reserva) => reserva.estado === EstadoReserva.EN_CURSO,
        ).length,
        finalizadas: reservas.filter(
          (reserva) => reserva.estado === EstadoReserva.FINALIZADA,
        ).length,
        canceladas: reservas.filter(
          (reserva) => reserva.estado === EstadoReserva.CANCELADA,
        ).length,
        estadiaPromedioNoches: averageStayNights,
      },
      ingresos: {
        mes: monthIncome,
        mesAnterior: previousMonthIncome,
        anio: yearIncome,
        anioAnterior: previousYearIncome,
        pendiente: pendingAmount,
      },
      inventario: {
        totalInsumos: inventario.length,
        bajoMinimo: lowStockCount,
      },
    };
  }
}
