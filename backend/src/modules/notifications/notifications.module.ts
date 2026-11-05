import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { EmailTemplateService } from './application/email-template.service';
import { NotificationDispatcherService } from './application/notification-dispatcher.service';
import { MailService } from './infrastructure/mail.service';
import { NotificationEventsListener } from './infrastructure/notification-events.listener';
import { PreArrivalNotificationScheduler } from './infrastructure/pre-arrival.scheduler';
import { NotificacionesController } from './infrastructure/notificaciones.controller';

@Module({
  imports: [PrismaModule],
  controllers: [NotificacionesController],
  providers: [
    EmailTemplateService,
    MailService,
    NotificationDispatcherService,
    NotificationEventsListener,
    PreArrivalNotificationScheduler,
  ],
  exports: [EmailTemplateService, MailService, NotificationDispatcherService],
})
export class NotificationsModule {}
