import { BadRequestException } from '@nestjs/common';
import {
  BaseNotificationPayload,
  NotificationType,
  PaymentReceiptPayload,
} from './notification.types';

export class NotificationValidator {
  static validate(type: NotificationType, payload: any): void {
    if (!payload) {
      throw new BadRequestException(`El payload para ${type} no puede ser nulo o indefinido.`);
    }

    const missing: string[] = [];

    // Validaciones transversales del Huésped
    if (!payload.guest) {
      missing.push('guest');
    } else {
      if (!payload.guest.nombreCompleto?.trim()) missing.push('guest.nombreCompleto');
      if (!payload.guest.email?.trim()) {
        missing.push('guest.email');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.guest.email.trim())) {
        throw new BadRequestException(`El correo del huésped (${payload.guest.email}) no tiene un formato válido.`);
      }
    }

    // Validaciones transversales de la Sede
    if (!payload.sede) {
      missing.push('sede');
    } else {
      if (!payload.sede.nombre?.trim()) missing.push('sede.nombre');
      if (!payload.sede.ciudad?.trim()) missing.push('sede.ciudad');
      if (!payload.sede.direccion?.trim()) missing.push('sede.direccion');
    }

    // Validaciones transversales de la Reserva
    if (!payload.reservation) {
      missing.push('reservation');
    } else {
      if (!payload.reservation.codigo?.trim()) missing.push('reservation.codigo');
      if (!payload.reservation.fechaCheckIn) missing.push('reservation.fechaCheckIn');
      if (!payload.reservation.fechaCheckOut) missing.push('reservation.fechaCheckOut');
      if (typeof payload.reservation.noches !== 'number' || payload.reservation.noches < 0) {
        missing.push('reservation.noches');
      }
      if (!payload.reservation.habitacionNumero?.trim()) missing.push('reservation.habitacionNumero');
      if (!payload.reservation.tipologiaNombre?.trim()) missing.push('reservation.tipologiaNombre');
    }

    // Validaciones específicas para Comprobante de Pago
    if (type === 'COMPROBANTE_PAGO') {
      const paymentPayload = payload as PaymentReceiptPayload;
      if (!paymentPayload.payment) {
        missing.push('payment');
      } else {
        if (!paymentPayload.payment.referencia?.trim()) missing.push('payment.referencia');
        if (typeof paymentPayload.payment.monto !== 'number') missing.push('payment.monto');
        if (!paymentPayload.payment.metodoPago?.trim()) missing.push('payment.metodoPago');
        if (!paymentPayload.payment.fechaPago) missing.push('payment.fechaPago');
      }
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `Parámetros obligatorios faltantes para ${type}: ${missing.join(', ')}.`
      );
    }
  }
}
