import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmailTemplateService } from '../src/modules/notifications/application/email-template.service';
import { MailService } from '../src/modules/notifications/infrastructure/mail.service';
import { NotificationType } from '../src/modules/notifications/domain/notification.types';

async function run() {
  const targetEmail = process.argv[2] || 'benjapalamara@gmail.com';
  console.log(`\n=============================================================`);
  console.log(` Iniciando envío de prueba de correos hacia: ${targetEmail}`);
  console.log(`=============================================================\n`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const templateService = app.get(EmailTemplateService);
  const mailService = app.get(MailService);

  const mockPayload = {
    locale: 'es' as const,
    guest: {
      nombreCompleto: 'Benjamín Palamara',
      email: targetEmail,
      telefono: '+56 9 1234 5678',
      paisResidencia: 'Chile',
    },
    sede: {
      nombre: 'Sede Viña del Mar',
      ciudad: 'Viña del Mar',
      direccion: 'Av. Marina 450',
      telefono: '+56 32 234 5678',
      email: 'vina@hospal.cl',
      horaCheckIn: '15:00',
      horaCheckOut: '11:00',
      politicaCancelacion: 'Cancelación gratuita hasta 48 horas antes de la llegada.',
      serviciosIncluidos: 'Desayuno continental, Wi-Fi 500Mbps y estacionamiento privado.',
      urlEncuesta: 'https://hospal.cl/feedback',
      sitioWeb: 'https://hospalpms.cl',
      hostalNombre: 'HosPal PMS',
      hostalEmail: 'contacto@hospalpms.cl',
      hostalLogoUrl: null,
    },
    reservation: {
      id: 999,
      codigo: 'HP-TEST-001',
      fechaCheckIn: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      fechaCheckOut: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      horaLlegada: '16:00',
      cantidadPersonas: 2,
      noches: 3,
      habitacionNumero: '204',
      tipologiaNombre: 'Habitación Doble Superior',
      precioTotal: 180000,
      montoPagado: 60000,
      saldoPendiente: 120000,
      pagoCompleto: false,
    },
    payment: {
      id: 888,
      referencia: 'PAY-TEST-001',
      monto: 60000,
      metodoPago: 'TRANSFERENCIA',
      tipoOperacion: 'ABONO',
      fechaPago: new Date(),
      documentoTipo: 'BOLETA',
      documentoFolio: 5432,
    },
  };

  const types: NotificationType[] = [
    'CONFIRMACION_RESERVA',
    'COMPROBANTE_PAGO',
    'RECORDATORIO_PRE_LLEGADA',
    'RESUMEN_CHECKOUT',
  ];

  for (const type of types) {
    console.log(`\n Renderizando plantilla para: ${type}...`);
    const rendered = templateService.render(type, mockPayload);
    console.log(` Asunto: "${rendered.subject}"`);
    console.log(` Enviando correo a través de MailService...`);

    const result = await mailService.sendMail({
      to: targetEmail,
      subject: rendered.subject,
      html: rendered.html_body,
      text: rendered.text_body,
      replyTo: mockPayload.sede.email,
    });

    if (result.success) {
      console.log(` [ÉXITO] Correo ${type} enviado correctamente. (MessageID: ${result.messageId})`);
    } else {
      console.error(` [FALLO] Error enviando ${type}: ${result.error}`);
    }
  }

  await app.close();
  console.log(`\n=============================================================`);
  console.log(` Prueba finalizada.`);
  console.log(`=============================================================\n`);
}

run().catch((err) => {
  console.error('Error fatal ejecutando script de prueba:', err);
  process.exit(1);
});
