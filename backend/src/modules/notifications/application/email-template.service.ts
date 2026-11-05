import { Injectable } from '@nestjs/common';
import { resolveGuestLocale, SupportedLocale } from '../domain/locale-resolver';
import {
  BaseNotificationPayload,
  EmailRenderResult,
  NotificationType,
  PaymentReceiptPayload,
} from '../domain/notification.types';
import { NotificationValidator } from '../domain/notification.validator';

@Injectable()
export class EmailTemplateService {
  render(type: NotificationType, payload: any): EmailRenderResult {
    NotificationValidator.validate(type, payload);

    const locale: SupportedLocale =
      payload.locale || resolveGuestLocale(payload.guest?.paisResidencia);

    switch (type) {
      case 'CONFIRMACION_RESERVA':
        return this.renderBookingConfirmation(payload, locale);
      case 'COMPROBANTE_PAGO':
        return this.renderPaymentReceipt(payload, locale);
      case 'RECORDATORIO_PRE_LLEGADA':
        return this.renderPreArrivalGuide(payload, locale);
      case 'RESUMEN_CHECKOUT':
        return this.renderCheckoutSummary(payload, locale);
      default:
        throw new Error(`Tipo de notificación no soportado: ${type}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Confirmación de Reserva
  // ---------------------------------------------------------------------------
  private renderBookingConfirmation(
    p: BaseNotificationPayload,
    locale: SupportedLocale,
  ): EmailRenderResult {
    const isEs = locale === 'es';
    const checkInStr = this.formatDate(p.reservation.fechaCheckIn, locale);
    const checkOutStr = this.formatDate(p.reservation.fechaCheckOut, locale);
    const horaIn = p.sede.horaCheckIn || '15:00';
    const horaOut = p.sede.horaCheckOut || '11:00';
    const cancelPolicy =
      p.sede.politicaCancelacion ||
      (isEs
        ? 'Cancelación sin costo hasta 48 horas antes de la fecha de llegada. Pasado este plazo se retendrá el valor del abono inicial.'
        : 'Free cancellation up to 48 hours before check-in date. Late cancellations forfeit the deposit.');
    const includedServices =
      p.sede.serviciosIncluidos ||
      (isEs
        ? 'Wi-Fi de alta velocidad, custodia de equipaje y áreas comunes.'
        : 'High-speed Wi-Fi, luggage storage, and common areas access.');

    const subject = isEs
      ? `Confirmación de Reserva #${p.reservation.codigo} — ${p.sede.nombre}`
      : `Booking Confirmation #${p.reservation.codigo} — ${p.sede.nombre}`;

    const contentHtml = `
      <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px; font-weight: 700;">
        ${isEs ? `¡Hola, ${this.escape(p.guest.nombreCompleto)}!` : `Dear ${this.escape(p.guest.nombreCompleto)},`}
      </h2>
      <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.5;">
        ${
          isEs
            ? `Gracias por elegir <strong>${this.escape(p.sede.nombre)}</strong>. Nos alegra confirmar que tu reserva ha sido ingresada con éxito.`
            : `Thank you for choosing <strong>${this.escape(p.sede.nombre)}</strong>. We are pleased to confirm that your booking is secured.`
        }
      </p>

      <!-- Cuadro de datos de reserva -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">
            ${isEs ? 'Código de reserva' : 'Booking locator'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #1e50d8; font-size: 15px; font-weight: 700; text-align: right;">
            ${this.escape(p.reservation.codigo)}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Check-in' : 'Check-in'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; text-align: right;">
            <strong>${checkInStr}</strong> <span style="color: #64748b;">(desde las ${this.escape(horaIn)})</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Check-out' : 'Check-out'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; text-align: right;">
            <strong>${checkOutStr}</strong> <span style="color: #64748b;">(hasta las ${this.escape(horaOut)})</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Alojamiento' : 'Accommodation'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; text-align: right;">
            ${this.escape(p.reservation.tipologiaNombre)} (Hab. #${this.escape(p.reservation.habitacionNumero)})
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Estadía' : 'Stay'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; text-align: right;">
            ${p.reservation.noches} ${isEs ? (p.reservation.noches === 1 ? 'noche' : 'noches') : p.reservation.noches === 1 ? 'night' : 'nights'} · ${p.reservation.cantidadPersonas} ${isEs ? (p.reservation.cantidadPersonas === 1 ? 'huésped' : 'huéspedes') : p.reservation.cantidadPersonas === 1 ? 'guest' : 'guests'}
          </td>
        </tr>
        ${
          p.reservation.precioTotal !== undefined &&
          p.reservation.precioTotal !== null
            ? `
        <tr>
          <td style="padding: 12px 16px; color: #64748b; font-size: 13px; font-weight: 600;">
            ${isEs ? 'Total reserva' : 'Total booking amount'}
          </td>
          <td style="padding: 12px 16px; color: #0f172a; font-size: 16px; font-weight: 700; text-align: right;">
            ${this.formatCurrency(p.reservation.precioTotal)}
          </td>
        </tr>`
            : ''
        }
      </table>

      <!-- Servicios y Políticas -->
      <div style="margin-bottom: 20px; padding: 14px 16px; background: #eff6ff; border-left: 4px solid #1e50d8; border-radius: 4px;">
        <p style="margin: 0 0 6px; color: #1e3a8a; font-size: 13px; font-weight: 700; text-transform: uppercase;">
          ${isEs ? 'Servicios incluidos' : 'Included services'}
        </p>
        <p style="margin: 0; color: #334155; font-size: 13px; line-height: 1.45;">
          ${this.escape(includedServices)}
        </p>
      </div>

      <div style="margin-bottom: 20px; padding: 14px 16px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px;">
        <p style="margin: 0 0 6px; color: #92400e; font-size: 13px; font-weight: 700; text-transform: uppercase;">
          ${isEs ? 'Política de cancelación' : 'Cancellation policy'}
        </p>
        <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.45;">
          ${this.escape(cancelPolicy)}
        </p>
      </div>

      <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
        ${
          isEs
            ? `Ubicación: <strong>${this.escape(p.sede.direccion)}, ${this.escape(p.sede.ciudad)}</strong>.`
            : `Location: <strong>${this.escape(p.sede.direccion)}, ${this.escape(p.sede.ciudad)}</strong>.`
        }
      </p>
    `;

    const html_body = this.wrapInBaseLayout(
      p.sede,
      subject,
      contentHtml,
      locale,
    );

    const text_body = isEs
      ? `CONFIRMACIÓN DE RESERVA — ${p.sede.nombre}
Hola, ${p.guest.nombreCompleto}:
Gracias por elegir ${p.sede.nombre}. Tu reserva ha sido confirmada con éxito.

Código de reserva: ${p.reservation.codigo}
Check-in: ${checkInStr} (desde las ${horaIn})
Check-out: ${checkOutStr} (hasta las ${horaOut})
Habitación: ${p.reservation.tipologiaNombre} (Hab. #${p.reservation.habitacionNumero})
Estadía: ${p.reservation.noches} noches · ${p.reservation.cantidadPersonas} huéspedes
${p.reservation.precioTotal ? `Total reserva: ${this.formatCurrency(p.reservation.precioTotal)}` : ''}

Servicios incluidos: ${includedServices}
Política de cancelación: ${cancelPolicy}
Dirección: ${p.sede.direccion}, ${p.sede.ciudad}

${this.footerText(p.sede, locale)}`
      : `BOOKING CONFIRMATION — ${p.sede.nombre}
Dear ${p.guest.nombreCompleto},
Thank you for choosing ${p.sede.nombre}. Your reservation is confirmed.

Booking locator: ${p.reservation.codigo}
Check-in: ${checkInStr} (from ${horaIn})
Check-out: ${checkOutStr} (until ${horaOut})
Accommodation: ${p.reservation.tipologiaNombre} (Room #${p.reservation.habitacionNumero})
Stay: ${p.reservation.noches} nights · ${p.reservation.cantidadPersonas} guests
${p.reservation.precioTotal ? `Total amount: ${this.formatCurrency(p.reservation.precioTotal)}` : ''}

Included services: ${includedServices}
Cancellation policy: ${cancelPolicy}
Address: ${p.sede.direccion}, ${p.sede.ciudad}

${this.footerText(p.sede, locale)}`;

    return { subject, html_body, text_body };
  }

  // ---------------------------------------------------------------------------
  // 2. Confirmación de Pago y Comprobante
  // ---------------------------------------------------------------------------
  private renderPaymentReceipt(
    p: PaymentReceiptPayload,
    locale: SupportedLocale,
  ): EmailRenderResult {
    const isEs = locale === 'es';
    const fechaPagoStr = this.formatDateTime(p.payment.fechaPago, locale);
    const montoStr = this.formatCurrency(p.payment.monto);
    const saldo =
      p.reservation.saldoPendiente !== undefined &&
      p.reservation.saldoPendiente !== null
        ? p.reservation.saldoPendiente
        : Math.max(
            0,
            (p.reservation.precioTotal || 0) - (p.reservation.montoPagado || 0),
          );

    const subject = isEs
      ? `Comprobante de Pago #${p.payment.referencia} — ${p.sede.nombre}`
      : `Payment Receipt #${p.payment.referencia} — ${p.sede.nombre}`;

    const docNote =
      p.payment.documentoTipo && p.payment.documentoFolio
        ? isEs
          ? `Documento tributario emitido: <strong>${p.payment.documentoTipo} Electrónica N° ${p.payment.documentoFolio}</strong>.`
          : `Issued tax document: <strong>Electronic ${p.payment.documentoTipo} #${p.payment.documentoFolio}</strong>.`
        : isEs
          ? `El documento tributario correspondiente (Boleta o Factura electrónica) se encuentra en proceso de emisión ante el Servicio de Impuestos Internos.`
          : `The official electronic tax document is currently being issued with the tax authority.`;

    const contentHtml = `
      <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px; font-weight: 700;">
        ${isEs ? `Comprobante de Pago Registrado` : `Payment Confirmation`}
      </h2>
      <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.5;">
        ${
          isEs
            ? `Hola, <strong>${this.escape(p.guest.nombreCompleto)}</strong>. Agradecemos tu pago recibido para la reserva <strong>#${this.escape(p.reservation.codigo)}</strong>.`
            : `Dear <strong>${this.escape(p.guest.nombreCompleto)}</strong>, thank you for your payment regarding reservation <strong>#${this.escape(p.reservation.codigo)}</strong>.`
        }
      </p>

      <!-- Tabla de desglose de pago -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">
            ${isEs ? 'Folio de transacción' : 'Transaction reference'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #1e50d8; font-size: 14px; font-weight: 700; text-align: right;">
            ${this.escape(p.payment.referencia)}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Fecha y hora' : 'Date & time'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; text-align: right;">
            ${fechaPagoStr}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Método de pago' : 'Payment method'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; text-align: right; text-transform: capitalize;">
            ${this.escape(p.payment.metodoPago.toLowerCase())}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Concepto' : 'Operation type'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; text-align: right;">
            ${this.escape(p.payment.tipoOperacion.replace(/_/g, ' '))}
          </td>
        </tr>
        <tr style="background: #edfcf2;">
          <td style="padding: 14px 16px; color: #166534; font-size: 14px; font-weight: 700;">
            ${isEs ? 'Monto pagado' : 'Amount paid'}
          </td>
          <td style="padding: 14px 16px; color: #166534; font-size: 18px; font-weight: 700; text-align: right;">
            ${montoStr}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">
            ${isEs ? 'Saldo pendiente' : 'Outstanding balance'}
          </td>
          <td style="padding: 12px 16px; color: ${saldo > 0 ? '#b91c1c' : '#166534'}; font-size: 14px; font-weight: 700; text-align: right;">
            ${saldo > 0 ? this.formatCurrency(saldo) : isEs ? 'Pagado en su totalidad' : 'Fully paid'}
          </td>
        </tr>
      </table>

      <div style="margin-bottom: 20px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.5;">
          ${docNote}
        </p>
      </div>
    `;

    const html_body = this.wrapInBaseLayout(
      p.sede,
      subject,
      contentHtml,
      locale,
    );

    const text_body = isEs
      ? `COMPROBANTE DE PAGO — ${p.sede.nombre}
Hola, ${p.guest.nombreCompleto}:
Agradecemos tu pago recibido para la reserva #${p.reservation.codigo}.

Folio de transacción: ${p.payment.referencia}
Fecha y hora: ${fechaPagoStr}
Método de pago: ${p.payment.metodoPago}
Monto pagado: ${montoStr}
Saldo pendiente: ${saldo > 0 ? this.formatCurrency(saldo) : 'Pagado en su totalidad'}

${docNote.replace(/<[^>]+>/g, '')}

${this.footerText(p.sede, locale)}`
      : `PAYMENT RECEIPT — ${p.sede.nombre}
Dear ${p.guest.nombreCompleto},
Thank you for your payment towards reservation #${p.reservation.codigo}.

Transaction reference: ${p.payment.referencia}
Date & time: ${fechaPagoStr}
Payment method: ${p.payment.metodoPago}
Amount paid: ${montoStr}
Outstanding balance: ${saldo > 0 ? this.formatCurrency(saldo) : 'Fully paid'}

${docNote.replace(/<[^>]+>/g, '')}

${this.footerText(p.sede, locale)}`;

    return { subject, html_body, text_body };
  }

  // ---------------------------------------------------------------------------
  // 3. Recordatorio Pre-Llegada (Pre-Arrival Guide)
  // ---------------------------------------------------------------------------
  private renderPreArrivalGuide(
    p: BaseNotificationPayload,
    locale: SupportedLocale,
  ): EmailRenderResult {
    const isEs = locale === 'es';
    const checkInStr = this.formatDate(p.reservation.fechaCheckIn, locale);
    const horaIn = p.sede.horaCheckIn || '15:00';
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${p.sede.direccion}, ${p.sede.ciudad}`,
    )}`;

    const subject = isEs
      ? `Tu estadía comienza pronto en ${p.sede.nombre} (Reserva #${p.reservation.codigo})`
      : `Your stay starts soon at ${p.sede.nombre} (Booking #${p.reservation.codigo})`;

    const contentHtml = `
      <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px; font-weight: 700;">
        ${isEs ? `¡Todo listo para recibirte!` : `We look forward to welcoming you!`}
      </h2>
      <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.5;">
        ${
          isEs
            ? `Hola, <strong>${this.escape(p.guest.nombreCompleto)}</strong>. Faltan muy pocos días para tu llegada a <strong>${this.escape(p.sede.nombre)}</strong>. Queremos que tu ingreso sea lo más cómodo y ágil posible.`
            : `Dear <strong>${this.escape(p.guest.nombreCompleto)}</strong>, your arrival at <strong>${this.escape(p.sede.nombre)}</strong> is right around the corner. Here is some essential information for a seamless check-in.`
        }
      </p>

      <!-- Recordatorio de Horarios -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Fecha de Check-in' : 'Check-in date'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 700; text-align: right;">
            ${checkInStr}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">
            ${isEs ? 'Horario de ingreso' : 'Check-in time'}
          </td>
          <td style="padding: 12px 16px; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">
            ${isEs ? `Desde las ${this.escape(horaIn)} horas` : `From ${this.escape(horaIn)}`}
          </td>
        </tr>
      </table>

      <!-- Requisitos de ingreso -->
      <div style="margin-bottom: 20px; padding: 14px 16px; background: #fff7ed; border-left: 4px solid #ea580c; border-radius: 4px;">
        <p style="margin: 0 0 6px; color: #9a3412; font-size: 13px; font-weight: 700; text-transform: uppercase;">
          ${isEs ? 'Documentos obligatorios para el ingreso' : 'Required identification upon arrival'}
        </p>
        <p style="margin: 0; color: #7c2d12; font-size: 13px; line-height: 1.45;">
          ${
            isEs
              ? 'Todos los huéspedes deben presentar su <strong>Cédula de Identidad o Pasaporte original y vigente</strong> al momento del Check-in en recepción.'
              : 'All guests must present their <strong>original and valid National ID or Passport</strong> at the front desk upon arrival.'
          }
        </p>
      </div>

      <!-- Cómo llegar -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px; color: #0f172a; font-size: 15px; font-weight: 700;">
          ${isEs ? '¿Cómo llegar?' : 'How to get here?'}
        </h3>
        <p style="margin: 0 0 12px; color: #475569; font-size: 13px; line-height: 1.5;">
          ${isEs ? 'Nos encontramos ubicados en' : 'We are located at'}: <strong>${this.escape(p.sede.direccion)}, ${this.escape(p.sede.ciudad)}</strong>.
        </p>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 18px; background: #1e50d8; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">
          ${isEs ? 'Ver ubicación en Google Maps' : 'Open in Google Maps'}
        </a>
      </div>
    `;

    const html_body = this.wrapInBaseLayout(
      p.sede,
      subject,
      contentHtml,
      locale,
    );

    const text_body = isEs
      ? `RECORDATORIO PRE-LLEGADA — ${p.sede.nombre}
Hola, ${p.guest.nombreCompleto}:
Tu estadía en ${p.sede.nombre} comienza muy pronto.

Reserva: #${p.reservation.codigo}
Fecha de Check-in: ${checkInStr} (desde las ${horaIn} hrs)

Requisito de ingreso:
Todos los huéspedes deben presentar Cédula de Identidad o Pasaporte original y vigente al ingresar.

Dirección: ${p.sede.direccion}, ${p.sede.ciudad}
Mapa: ${mapsUrl}

${this.footerText(p.sede, locale)}`
      : `PRE-ARRIVAL GUIDE — ${p.sede.nombre}
Dear ${p.guest.nombreCompleto},
Your stay at ${p.sede.nombre} is starting soon.

Booking locator: #${p.reservation.codigo}
Check-in date: ${checkInStr} (from ${horaIn})

Required identification:
All guests must present an original valid ID or Passport upon arrival.

Address: ${p.sede.direccion}, ${p.sede.ciudad}
Map: ${mapsUrl}

${this.footerText(p.sede, locale)}`;

    return { subject, html_body, text_body };
  }

  // ---------------------------------------------------------------------------
  // 4. Resumen de Salida y Agradecimiento (Post-Check-out & Invoice)
  // ---------------------------------------------------------------------------
  private renderCheckoutSummary(
    p: BaseNotificationPayload,
    locale: SupportedLocale,
  ): EmailRenderResult {
    const isEs = locale === 'es';
    const totalStr = this.formatCurrency(p.reservation.precioTotal || 0);
    const pagadoStr = this.formatCurrency(p.reservation.montoPagado || 0);
    const surveyUrl = p.sede.urlEncuesta;

    const subject = isEs
      ? `Gracias por tu estadía en ${p.sede.nombre} — Resumen de cuenta`
      : `Thank you for staying at ${p.sede.nombre} — Account summary`;

    const contentHtml = `
      <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px; font-weight: 700;">
        ${isEs ? `¡Gracias por visitarnos!` : `Thank you for your stay!`}
      </h2>
      <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.5;">
        ${
          isEs
            ? `Hola, <strong>${this.escape(p.guest.nombreCompleto)}</strong>. Ha sido un verdadero placer tenerte en <strong>${this.escape(p.sede.nombre)}</strong>. Esperamos que hayas disfrutado tu estadía.`
            : `Dear <strong>${this.escape(p.guest.nombreCompleto)}</strong>, it was a pleasure hosting you at <strong>${this.escape(p.sede.nombre)}</strong>. We hope you enjoyed your time with us.`
        }
      </p>

      <!-- Estado final de cuenta -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Código de reserva' : 'Booking reference'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 700; text-align: right;">
            ${this.escape(p.reservation.codigo)}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Habitación' : 'Accommodation'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; text-align: right;">
            ${this.escape(p.reservation.tipologiaNombre)} (Hab. #${this.escape(p.reservation.habitacionNumero)})
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Total estadía' : 'Total charge'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 700; text-align: right;">
            ${totalStr}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
            ${isEs ? 'Total pagado' : 'Total paid'}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #166534; font-size: 14px; font-weight: 700; text-align: right;">
            ${pagadoStr}
          </td>
        </tr>
        <tr style="background: #f0fdf4;">
          <td style="padding: 12px 16px; color: #166534; font-size: 13px; font-weight: 700;">
            ${isEs ? 'Estado final' : 'Final balance'}
          </td>
          <td style="padding: 12px 16px; color: #166534; font-size: 14px; font-weight: 700; text-align: right;">
            ${isEs ? 'Cuenta saldada' : 'Account fully settled'}
          </td>
        </tr>
      </table>

      ${
        surveyUrl
          ? `
      <div style="margin-bottom: 24px; padding: 18px 20px; background: #eff6ff; border-radius: 8px; text-align: center;">
        <h3 style="margin: 0 0 6px; color: #1e3a8a; font-size: 15px; font-weight: 700;">
          ${isEs ? '¿Cómo estuvo tu experiencia?' : 'How was your stay?'}
        </h3>
        <p style="margin: 0 0 14px; color: #475569; font-size: 13px;">
          ${
            isEs
              ? 'Nos ayuda mucho conocer tu opinión para seguir mejorando nuestro servicio.'
              : 'Your feedback helps us continuously improve our service.'
          }
        </p>
        <a href="${surveyUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 20px; background: #1e50d8; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">
          ${isEs ? 'Responder encuesta breve' : 'Take short satisfaction survey'}
        </a>
      </div>`
          : ''
      }
    `;

    const html_body = this.wrapInBaseLayout(
      p.sede,
      subject,
      contentHtml,
      locale,
    );

    const text_body = isEs
      ? `RESUMEN DE ESTADÍA — ${p.sede.nombre}
Hola, ${p.guest.nombreCompleto}:
Ha sido un placer recibirte en ${p.sede.nombre}.

Código de reserva: ${p.reservation.codigo}
Habitación: ${p.reservation.tipologiaNombre} (Hab. #${p.reservation.habitacionNumero})
Total estadía: ${totalStr}
Total pagado: ${pagadoStr}
Estado final: Cuenta saldada
${surveyUrl ? `\nEncuesta de satisfacción: ${surveyUrl}` : ''}

${this.footerText(p.sede, locale)}`
      : `CHECKOUT SUMMARY — ${p.sede.nombre}
Dear ${p.guest.nombreCompleto},
Thank you for staying with us at ${p.sede.nombre}.

Booking reference: ${p.reservation.codigo}
Accommodation: ${p.reservation.tipologiaNombre} (Room #${p.reservation.habitacionNumero})
Total stay: ${totalStr}
Total paid: ${pagadoStr}
Final balance: Account fully settled
${surveyUrl ? `\nSatisfaction survey: ${surveyUrl}` : ''}

${this.footerText(p.sede, locale)}`;

    return { subject, html_body, text_body };
  }

  // ---------------------------------------------------------------------------
  // Layout base HTML responsive y limpio
  // ---------------------------------------------------------------------------
  private wrapInBaseLayout(
    sede: BaseNotificationPayload['sede'],
    title: string,
    contentHtml: string,
    locale: SupportedLocale,
  ): string {
    const isEs = locale === 'es';
    const logoHtml = sede.hostalLogoUrl
      ? `<img src="${this.escape(sede.hostalLogoUrl)}" alt="${this.escape(sede.hostalNombre)}" style="max-height: 48px; max-width: 180px; display: block;" />`
      : `<span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${this.escape(sede.hostalNombre)}</span>`;

    const contactEmail = sede.email || sede.hostalEmail || '';
    const phone = sede.telefono || '';

    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escape(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal (máx 600px responsive) -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);">
          <!-- Cabecera institucional -->
          <tr>
            <td style="background-color: #1e50d8; padding: 24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>${logoHtml}</td>
                  <td align="right" style="color: rgba(255, 255, 255, 0.85); font-size: 13px;">
                    ${this.escape(sede.nombre)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding: 32px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Pie de página -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.5;">
              <p style="margin: 0 0 6px; font-weight: 600; color: #334155;">
                ${this.escape(sede.nombre)} · ${this.escape(sede.hostalNombre)}
              </p>
              <p style="margin: 0 0 6px;">
                ${this.escape(sede.direccion)}, ${this.escape(sede.ciudad)}
              </p>
              <p style="margin: 0;">
                ${contactEmail ? `${isEs ? 'Contacto' : 'Email'}: <a href="mailto:${this.escape(contactEmail)}" style="color: #1e50d8; text-decoration: none;">${this.escape(contactEmail)}</a>` : ''}
                ${contactEmail && phone ? ' · ' : ''}
                ${phone ? `${isEs ? 'Teléfono' : 'Phone'}: ${this.escape(phone)}` : ''}
              </p>
              ${
                sede.sitioWeb
                  ? `<p style="margin: 8px 0 0;"><a href="${this.escape(sede.sitioWeb)}" target="_blank" rel="noopener noreferrer" style="color: #1e50d8; text-decoration: none;">${this.escape(sede.sitioWeb)}</a></p>`
                  : ''
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private footerText(
    sede: BaseNotificationPayload['sede'],
    locale: SupportedLocale,
  ): string {
    const isEs = locale === 'es';
    const email = sede.email || sede.hostalEmail || '';
    const phone = sede.telefono || '';
    return `---
${sede.nombre} · ${sede.hostalNombre}
${sede.direccion}, ${sede.ciudad}
${email ? `${isEs ? 'Contacto' : 'Email'}: ${email}` : ''} ${phone ? `| Tel: ${phone}` : ''}
${sede.sitioWeb || ''}`.trim();
  }

  private formatDate(date: Date, locale: SupportedLocale): string {
    const d = new Date(date);
    return d.toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatDateTime(date: Date, locale: SupportedLocale): string {
    const d = new Date(date);
    return d.toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private escape(str: string | null | undefined): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
