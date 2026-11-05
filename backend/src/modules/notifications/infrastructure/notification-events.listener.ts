import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationDispatcherService } from '../application/notification-dispatcher.service';

export interface BookingCreatedEvent {
  reservaId: number;
}

export interface PaymentRecordedEvent {
  reservaId: number;
  pagoId: number;
}

export interface CheckoutCompletedEvent {
  reservaId: number;
}

@Injectable()
export class NotificationEventsListener {
  private readonly logger = new Logger(NotificationEventsListener.name);

  constructor(private readonly dispatcher: NotificationDispatcherService) {}

  @OnEvent('reserva.creada', { async: true })
  async handleReservaCreada(event: BookingCreatedEvent): Promise<void> {
    this.logger.log(
      `Evento 'reserva.creada' recibido para reserva #${event.reservaId}`,
    );
    await this.dispatcher.dispatch({
      type: 'CONFIRMACION_RESERVA',
      reservaId: event.reservaId,
    });
  }

  @OnEvent('pago.registrado', { async: true })
  async handlePagoRegistrado(event: PaymentRecordedEvent): Promise<void> {
    this.logger.log(
      `Evento 'pago.registrado' recibido para reserva #${event.reservaId}, pago #${event.pagoId}`,
    );
    await this.dispatcher.dispatch({
      type: 'COMPROBANTE_PAGO',
      reservaId: event.reservaId,
      pagoId: event.pagoId,
    });
  }

  @OnEvent('reserva.checkout', { async: true })
  async handleReservaCheckout(event: CheckoutCompletedEvent): Promise<void> {
    this.logger.log(
      `Evento 'reserva.checkout' recibido para reserva #${event.reservaId}`,
    );
    await this.dispatcher.dispatch({
      type: 'RESUMEN_CHECKOUT',
      reservaId: event.reservaId,
    });
  }
}
