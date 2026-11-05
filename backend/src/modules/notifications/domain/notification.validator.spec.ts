import { BadRequestException } from '@nestjs/common';
import { NotificationValidator } from './notification.validator';

describe('NotificationValidator', () => {
  const validBasePayload = {
    guest: {
      nombreCompleto: 'Juan Pérez',
      email: 'juan@example.com',
      paisResidencia: 'Chile',
    },
    sede: {
      nombre: 'Sede Viña',
      ciudad: 'Viña del Mar',
      direccion: 'Av. Marina 123',
      hostalNombre: 'HosPal',
    },
    reservation: {
      codigo: 'HP-000001',
      fechaCheckIn: new Date(),
      fechaCheckOut: new Date(),
      noches: 2,
      habitacionNumero: '101',
      tipologiaNombre: 'Doble',
    },
  };

  it('valida con éxito un payload correcto de confirmación', () => {
    expect(() =>
      NotificationValidator.validate('CONFIRMACION_RESERVA', validBasePayload),
    ).not.toThrow();
  });

  it('falla si el payload es nulo', () => {
    expect(() =>
      NotificationValidator.validate('CONFIRMACION_RESERVA', null),
    ).toThrow(BadRequestException);
  });

  it('falla si el correo del huésped es inválido', () => {
    const invalid = {
      ...validBasePayload,
      guest: { ...validBasePayload.guest, email: 'no-es-correo' },
    };
    expect(() =>
      NotificationValidator.validate('CONFIRMACION_RESERVA', invalid),
    ).toThrow(BadRequestException);
  });

  it('falla si faltan campos obligatorios de la reserva', () => {
    const invalid = {
      ...validBasePayload,
      reservation: { ...validBasePayload.reservation, codigo: '' },
    };
    expect(() =>
      NotificationValidator.validate('CONFIRMACION_RESERVA', invalid),
    ).toThrow(BadRequestException);
  });

  it('valida campos específicos para comprobante de pago', () => {
    const withoutPayment = { ...validBasePayload };
    expect(() =>
      NotificationValidator.validate('COMPROBANTE_PAGO', withoutPayment),
    ).toThrow(BadRequestException);

    const withValidPayment = {
      ...validBasePayload,
      payment: {
        referencia: 'PAY-000001',
        monto: 50000,
        metodoPago: 'TRANSFERENCIA',
        fechaPago: new Date(),
      },
    };
    expect(() =>
      NotificationValidator.validate('COMPROBANTE_PAGO', withValidPayment),
    ).not.toThrow();
  });
});
