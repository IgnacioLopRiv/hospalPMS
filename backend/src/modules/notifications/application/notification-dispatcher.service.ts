import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationType } from '../domain/notification.types';
import { resolveGuestLocale } from '../domain/locale-resolver';
import { EmailTemplateService } from '../application/email-template.service';
import { MailService } from '../infrastructure/mail.service';

export interface EnqueueNotificationParams {
  type: NotificationType;
  reservaId: number;
  pagoId?: number | null;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 3000, 6000];

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: EmailTemplateService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Procesa de forma asíncrona y segura una notificación por correo:
   * 1. Consulta la reserva con todas sus relaciones requeridas.
   * 2. Resuelve el idioma del huésped.
   * 3. Resuelve el Reply-To: Sede.email -> Hostal.email -> null.
   * 4. Renderiza las plantillas con validación estricta.
   * 5. Envía el correo con hasta 3 reintentos.
   * 6. Registra en la tabla notificacion_email para trazabilidad y auditoría.
   */
  async dispatch(params: EnqueueNotificationParams): Promise<boolean> {
    const { type, reservaId, pagoId } = params;

    try {
      const reserva = await this.prisma.reserva.findUnique({
        where: { id: reservaId },
        include: {
          huesped: true,
          habitacion: {
            include: {
              tipologia: true,
              sede: {
                include: {
                  hostal: true,
                },
              },
            },
          },
          pagos: {
            orderBy: { fechaPago: 'desc' },
          },
          documentos: {
            orderBy: { fechaEmision: 'desc' },
          },
        },
      });

      if (!reserva) {
        this.logger.warn(
          `No se encontró la reserva #${reservaId} para despachar ${type}.`,
        );
        return false;
      }

      const huesped = reserva.huesped;
      const habitacion = reserva.habitacion;
      const sede = habitacion?.sede;
      const hostal = sede?.hostal;

      if (!huesped || !huesped.email) {
        this.logger.warn(
          `La reserva #${reservaId} no cuenta con email de huésped.`,
        );
        return false;
      }

      // Asegurar código de reserva
      const codigoReserva =
        reserva.codigo || `HP-${String(reserva.id).padStart(6, '0')}`;

      // Cálculo de noches
      const checkInMs = new Date(reserva.fechaCheckIn).getTime();
      const checkOutMs = new Date(reserva.fechaCheckOut).getTime();
      const noches = Math.max(
        1,
        Math.round((checkOutMs - checkInMs) / (1000 * 60 * 60 * 24)),
      );

      // Desglose de pago asociado si aplica
      let paymentData: any = null;
      if (type === 'COMPROBANTE_PAGO') {
        const pago = pagoId
          ? reserva.pagos.find((p) => p.id === pagoId)
          : reserva.pagos[0];

        if (!pago) {
          this.logger.warn(
            `No se encontró el pago #${pagoId} para la reserva #${reservaId}.`,
          );
          return false;
        }

        const doc = reserva.documentos[0];
        paymentData = {
          id: pago.id,
          referencia:
            pago.referencia || `PAY-${String(pago.id).padStart(6, '0')}`,
          monto: pago.monto,
          metodoPago: pago.metodoPago,
          tipoOperacion: pago.tipoOperacion,
          fechaPago: pago.fechaPago,
          documentoTipo: doc ? doc.tipoDocumento : null,
          documentoFolio: doc ? doc.folioSii : null,
        };
      }

      const locale = resolveGuestLocale(huesped.paisResidencia);

      const payload = {
        locale,
        guest: {
          nombreCompleto: `${huesped.nombres} ${huesped.apellidos}`.trim(),
          email: huesped.email,
          telefono: huesped.telefono,
          paisResidencia: huesped.paisResidencia,
        },
        sede: {
          nombre: sede?.nombreSede || 'HosPal Hostal',
          ciudad: sede?.ciudad || 'Chile',
          direccion: sede?.direccion || '',
          telefono: sede?.telefono || null,
          email: sede?.email || null,
          horaCheckIn: sede?.horaCheckIn || '15:00',
          horaCheckOut: sede?.horaCheckOut || '11:00',
          politicaCancelacion: sede?.politicaCancelacion || null,
          serviciosIncluidos: sede?.serviciosIncluidos || null,
          urlEncuesta: sede?.urlEncuesta || null,
          sitioWeb: sede?.sitioWeb || null,
          hostalNombre:
            hostal?.nombreFantasia || hostal?.razonSocial || 'HosPal',
          hostalEmail: hostal?.email || null,
          hostalLogoUrl: hostal?.logoUrl || null,
        },
        reservation: {
          id: reserva.id,
          codigo: codigoReserva,
          fechaCheckIn: reserva.fechaCheckIn,
          fechaCheckOut: reserva.fechaCheckOut,
          horaLlegada: reserva.horaLlegada,
          cantidadPersonas: reserva.cantidadPersonas,
          noches,
          habitacionNumero: habitacion?.numero || '',
          tipologiaNombre: habitacion?.tipologia?.nombre || 'Estándar',
          precioTotal: reserva.precioTotal,
          montoPagado: reserva.montoPagado,
          saldoPendiente: Math.max(
            0,
            (reserva.precioTotal || 0) - (reserva.montoPagado || 0),
          ),
          pagoCompleto: reserva.pagoCompleto,
        },
        payment: paymentData,
      };

      // 1. Renderizar plantilla con validación estricta
      const rendered = this.templateService.render(type, payload);

      // 2. Resolver Reply-To: Sede.email -> Hostal.email -> null
      const replyTo = sede?.email?.trim() || hostal?.email?.trim() || null;

      // 3. Crear registro en BD en estado PENDIENTE
      const logRecord = await this.prisma.notificacionEmail.create({
        data: {
          tipo: type as any,
          reservaId: reserva.id,
          pagoId: paymentData ? paymentData.id : null,
          destinatario: huesped.email,
          idioma: locale,
          asunto: rendered.subject,
          estado: 'PENDIENTE',
          intentos: 0,
        },
      });

      // 4. Intentos con reintento y backoff
      let attempts = 0;
      let lastError: string | null = null;
      let sentSuccess = false;

      while (attempts < MAX_RETRIES && !sentSuccess) {
        attempts++;
        this.logger.log(
          `Intento ${attempts}/${MAX_RETRIES} enviando ${type} a ${huesped.email}`,
        );

        const result = await this.mailService.sendMail({
          to: huesped.email,
          subject: rendered.subject,
          html: rendered.html_body,
          text: rendered.text_body,
          replyTo,
        });

        if (result.success) {
          sentSuccess = true;
          lastError = null;
          break;
        }

        lastError = result.error || 'Error desconocido al enviar correo.';
        this.logger.warn(`Intento ${attempts} fallido: ${lastError}`);

        if (attempts < MAX_RETRIES) {
          const delay = RETRY_DELAYS_MS[attempts - 1] || 2000;
          await new Promise((res) => setTimeout(res, delay));
        }
      }

      // 5. Actualizar estado en BD
      await this.prisma.notificacionEmail.update({
        where: { id: logRecord.id },
        data: {
          estado: sentSuccess ? 'ENVIADA' : 'FALLIDA',
          intentos: attempts,
          enviadoAt: sentSuccess ? new Date() : null,
          ultimoError: lastError,
        },
      });

      return sentSuccess;
    } catch (error: any) {
      const errMsg = [
        error?.code ? `[Code: ${error.code}]` : '',
        error?.message || String(error),
      ]
        .filter(Boolean)
        .join(' ');

      this.logger.error(
        `Error procesando notificación ${type} para reserva #${reservaId}: ${errMsg}`,
        error?.stack,
      );
      return false;
    }
  }
}
