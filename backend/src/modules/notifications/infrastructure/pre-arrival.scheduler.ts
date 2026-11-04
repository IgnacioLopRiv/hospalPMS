import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationDispatcherService } from '../application/notification-dispatcher.service';

@Injectable()
export class PreArrivalNotificationScheduler {
  private readonly logger = new Logger(PreArrivalNotificationScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcherService
  ) {}

  /**
   * Ejecuta cada hora la verificación de reservas próximas (entre 24 y 48 horas hacia adelante).
   * Identifica reservas CONFIRMADA cuyo check-in esté en esa ventana y que no hayan recibido
   * previamente el correo RECORDATORIO_PRE_LLEGADA.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkUpcomingReservations(): Promise<void> {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    try {
      const upcomingReservas = await this.prisma.reserva.findMany({
        where: {
          estado: 'CONFIRMADA',
          fechaCheckIn: {
            gte: in24Hours,
            lte: in48Hours,
          },
          notificaciones: {
            none: {
              tipo: 'RECORDATORIO_PRE_LLEGADA',
              estado: 'ENVIADA',
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (upcomingReservas.length > 0) {
        this.logger.log(
          `Encontradas ${upcomingReservas.length} reservas para recordatorio pre-llegada.`
        );

        for (const reserva of upcomingReservas) {
          await this.dispatcher.dispatch({
            type: 'RECORDATORIO_PRE_LLEGADA',
            reservaId: reserva.id,
          });
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Error al ejecutar el cronjob de recordatorios pre-llegada: ${error?.message}`,
        error?.stack
      );
    }
  }
}
