import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationDispatcherService } from '../application/notification-dispatcher.service';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcherService
  ) {}

  @Get()
  async listNotifications(
    @Query('reservaId') reservaId?: string,
    @Query('limit') limit?: string
  ) {
    const take = limit ? Math.min(Number(limit), 100) : 20;
    return this.prisma.notificacionEmail.findMany({
      where: reservaId ? { reservaId: Number(reservaId) } : undefined,
      orderBy: { creadoAt: 'desc' },
      take,
      include: {
        reserva: {
          select: {
            codigo: true,
            huesped: {
              select: {
                nombres: true,
                apellidos: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  @Post(':id/reenviar')
  async resendNotification(@Param('id', ParseIntPipe) id: number) {
    const notif = await this.prisma.notificacionEmail.findUnique({ where: { id } });
    if (!notif) {
      throw new NotFoundException(`No existe la notificación #${id}.`);
    }

    const success = await this.dispatcher.dispatch({
      type: notif.tipo as any,
      reservaId: notif.reservaId,
      pagoId: notif.pagoId,
    });

    return { success, message: success ? 'Notificación reenviada exitosamente.' : 'El reenvío falló; revisa los logs.' };
  }
}
