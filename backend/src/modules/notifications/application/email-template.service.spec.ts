import { EmailTemplateService } from './email-template.service';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  const basePayload = {
    guest: {
      nombreCompleto: 'Carlos Santana',
      email: 'carlos@example.com',
      paisResidencia: 'Chile',
    },
    sede: {
      nombre: 'Sede Centro',
      ciudad: 'Santiago',
      direccion: 'Calle Moneda 500',
      hostalNombre: 'HosPal PMS',
      telefono: '+56912345678',
      email: 'centro@hospal.cl',
      horaCheckIn: '14:00',
      horaCheckOut: '11:00',
      politicaCancelacion: 'Cancelación gratuita hasta 24h antes.',
      serviciosIncluidos: 'Desayuno continental, Wi-Fi.',
      urlEncuesta: 'https://hospal.cl/encuesta',
      sitioWeb: 'https://hospal.cl',
    },
    reservation: {
      id: 1,
      codigo: 'HP-000042',
      fechaCheckIn: new Date('2026-11-10T14:00:00Z'),
      fechaCheckOut: new Date('2026-11-12T11:00:00Z'),
      noches: 2,
      cantidadPersonas: 2,
      habitacionNumero: '204',
      tipologiaNombre: 'Suite Matrimonial',
      precioTotal: 120000,
      montoPagado: 50000,
      saldoPendiente: 70000,
      pagoCompleto: false,
    },
  };

  it('renderiza Confirmación de Reserva en español', () => {
    const res = service.render('CONFIRMACION_RESERVA', basePayload);
    expect(res.subject).toContain('Confirmación de Reserva #HP-000042');
    expect(res.html_body).toContain('Carlos Santana');
    expect(res.html_body).toContain('Suite Matrimonial');
    expect(res.text_body).toContain('HP-000042');
  });

  it('renderiza Confirmación de Reserva en inglés para huéspedes no hispanos', () => {
    const englishPayload = {
      ...basePayload,
      guest: {
        ...basePayload.guest,
        paisResidencia: 'United States',
      },
    };
    const res = service.render('CONFIRMACION_RESERVA', englishPayload);
    expect(res.subject).toContain('Booking Confirmation #HP-000042');
    expect(res.html_body).toContain('Booking locator');
    expect(res.text_body).toContain('BOOKING CONFIRMATION');
  });

  it('renderiza Comprobante de Pago correctamente', () => {
    const paymentPayload = {
      ...basePayload,
      payment: {
        id: 1,
        referencia: 'PAY-000100',
        monto: 50000,
        metodoPago: 'TRANSFERENCIA',
        tipoOperacion: 'ABONO',
        fechaPago: new Date(),
        documentoTipo: 'BOLETA',
        documentoFolio: 1234,
      },
    };
    const res = service.render('COMPROBANTE_PAGO', paymentPayload);
    expect(res.subject).toContain('Comprobante de Pago #PAY-000100');
    expect(res.html_body).toContain('Monto pagado');
    expect(res.html_body).toContain('BOLETA');
    expect(res.text_body).toContain('PAY-000100');
  });

  it('renderiza Recordatorio Pre-Llegada correctamente', () => {
    const res = service.render('RECORDATORIO_PRE_LLEGADA', basePayload);
    expect(res.subject).toContain('Tu estadía comienza pronto en Sede Centro');
    expect(res.html_body).toContain('Google Maps');
    expect(res.text_body).toContain('Requisito de ingreso');
  });

  it('renderiza Resumen de Salida con enlace de encuesta', () => {
    const res = service.render('RESUMEN_CHECKOUT', basePayload);
    expect(res.subject).toContain('Gracias por tu estadía en Sede Centro');
    expect(res.html_body).toContain('Responder encuesta breve');
    expect(res.text_body).toContain('https://hospal.cl/encuesta');
  });
});
