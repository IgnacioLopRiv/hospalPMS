import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EstadoTransaccionPos,
  MetodoPago,
  Pago,
  Prisma,
  TipoOperacion,
  TransaccionPos,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PagoService } from '../../billing/application/pago.service';
import {
  FINAL_CHARGE_STATUSES,
  PosChargeSnapshot,
  PosIntegrationMode,
  PosProviderError,
  PosWebhookRequest,
} from '../domain/pos-provider';
import { PosConfigService } from './pos-config.service';
import { PosProviderRegistry } from './pos-provider.registry';

export interface IniciarCobroInput {
  reservaId: number;
  monto: number;
  tipoOperacion: TipoOperacion;
  /** Tarjeta que eligió el recepcionista; manda lo que informe el terminal. */
  tipoTarjeta?: 'DEBITO' | 'CREDITO';
}

export type TransaccionPosView = TransaccionPos & {
  pago: Pago | null;
  final: boolean;
  /** 'local': el navegador de recepción debe ejecutar el cobro (ticket = id). */
  modo: PosIntegrationMode;
};

const ABIERTOS: EstadoTransaccionPos[] = ['PENDIENTE', 'EN_TERMINAL'];
/** Tiempo tras el cual un cobro sin ID del proveedor se da por fallido. */
const SIN_CONFIRMAR_MS = 60_000;
/** El SDK de Transbank espera hasta 2 min; se deja margen para el reporte. */
const SIN_RESPUESTA_LOCAL_MS = 4 * 60_000;

/**
 * Orquesta los cobros por terminal POS: crea la transacción, la envía al
 * proveedor, sincroniza su estado (webhook o consulta) y, cuando el cobro
 * se aprueba, registra el Pago con las mismas reglas que un pago manual.
 */
@Injectable()
export class PosChargeService {
  private readonly logger = new Logger(PosChargeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pagoService: PagoService,
    private readonly configService: PosConfigService,
    private readonly registry: PosProviderRegistry,
  ) {}

  async iniciar(input: IniciarCobroInput): Promise<TransaccionPosView> {
    if (input.tipoOperacion === TipoOperacion.REEMBOLSO) {
      throw new BadRequestException(
        'Los reembolsos no se cobran en el terminal.',
      );
    }
    if (!Number.isInteger(input.monto) || input.monto <= 0) {
      throw new BadRequestException(
        'El monto debe ser un número entero mayor que cero.',
      );
    }

    const reserva = await this.prisma.reserva.findUnique({
      where: { id: input.reservaId },
      include: { habitacion: { select: { sedeId: true, numero: true } } },
    });
    if (!reserva) {
      throw new NotFoundException(`No existe la reserva ${input.reservaId}.`);
    }
    const sedeId = reserva.habitacion.sedeId;

    const stored = await this.configService.loadStored(sedeId);
    if (!stored) {
      throw new BadRequestException('La sede no tiene un POS configurado.');
    }
    if (!stored.activo) {
      throw new BadRequestException('El POS de la sede está desactivado.');
    }
    const { provider, config } = stored;
    const soporta =
      provider.soportaCobros &&
      (provider.modo === 'local'
        ? !!provider.parseLocalResult
        : !!provider.createCharge);
    if (!soporta) {
      throw new BadRequestException(
        `${provider.nombre} no admite cobros integrados.`,
      );
    }

    // Mismas reglas que un pago manual; el tipo de tarjeta no afecta la validación.
    await this.prisma.$transaction((trx) =>
      this.pagoService.validarEn(trx, {
        ...input,
        metodoPago: MetodoPago.TARJETA_CREDITO,
      }),
    );

    await this.asegurarTerminalLibre(sedeId);

    // El dispositivo es el campo 'device' del proveedor (terminal, puerto…).
    const deviceField = provider.campos.find(
      (field) => field.type === 'device',
    );
    const deviceId = deviceField ? config.parametros[deviceField.key] : null;
    const created = await this.prisma.transaccionPos.create({
      data: {
        reservaId: reserva.id,
        sedeId,
        proveedor: provider.code,
        deviceId: typeof deviceId === 'string' ? deviceId : null,
        monto: input.monto,
        tipoOperacion: input.tipoOperacion,
        // Preferencia inicial; se reemplaza por el tipo que informe el terminal.
        metodoPago:
          input.tipoTarjeta === 'DEBITO'
            ? MetodoPago.TARJETA_DEBITO
            : input.tipoTarjeta === 'CREDITO'
              ? MetodoPago.TARJETA_CREDITO
              : null,
      },
    });
    const referenciaExterna = `HOSPAL-R${reserva.id}-T${created.id}`;
    await this.prisma.transaccionPos.update({
      where: { id: created.id },
      data: { externalReference: referenciaExterna },
    });

    // Cobro local: el navegador de recepción lo ejecuta y reporta el resultado.
    if (provider.modo === 'local') return this.view(created.id);

    let snapshot: PosChargeSnapshot;
    try {
      snapshot = await provider.createCharge!(config, {
        monto: input.monto,
        referenciaExterna,
        descripcion: `Reserva ${reserva.codigo ?? `#${reserva.id}`} - Hab. ${reserva.habitacion.numero}`,
        idempotencyKey: `hospal-pos-${created.id}`,
        tipoTarjeta: input.tipoTarjeta,
      });
    } catch (error) {
      if (error instanceof PosProviderError) {
        await this.prisma.transaccionPos.update({
          where: { id: created.id },
          data: { estado: 'ERROR', mensaje: error.message.slice(0, 500) },
        });
        throw new BadRequestException(
          `No se pudo enviar el cobro al terminal. ${error.message}`,
        );
      }
      throw error;
    }

    return this.aplicar(created.id, snapshot);
  }

  /**
   * Registra el resultado de un cobro local (p. ej. la respuesta del Agente
   * POS de Transbank que obtuvo el navegador de recepción).
   */
  async registrarResultadoLocal(
    id: number,
    resultado: unknown,
  ): Promise<TransaccionPosView> {
    const tx = await this.find(id);
    const provider = this.registry.get(tx.proveedor);
    if (provider.modo !== 'local' || !provider.parseLocalResult) {
      throw new BadRequestException(
        'Este cobro lo confirma el proveedor, no el equipo de recepción.',
      );
    }
    // ERROR se acepta: permite recuperar una venta cuya respuesta se perdió.
    if (this.isFinal(tx) && tx.estado !== 'ERROR') {
      throw new BadRequestException('El cobro ya tiene un resultado.');
    }
    try {
      return await this.aplicar(id, provider.parseLocalResult(resultado));
    } catch (error) {
      if (error instanceof PosProviderError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /** Devuelve el cobro con su estado actualizado desde el proveedor. */
  async obtener(id: number): Promise<TransaccionPosView> {
    await this.sincronizar(id);
    return this.view(id);
  }

  async listar(reservaId?: number): Promise<TransaccionPosView[]> {
    const rows = await this.prisma.transaccionPos.findMany({
      where: reservaId ? { reservaId } : undefined,
      include: { pago: true },
      orderBy: { creadoAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.withFinal(row));
  }

  async cancelar(id: number): Promise<TransaccionPosView> {
    const tx = await this.find(id);
    if (this.isFinal(tx)) {
      throw new BadRequestException(
        'El cobro ya terminó y no se puede cancelar.',
      );
    }
    if (!tx.externalId) {
      await this.prisma.transaccionPos.update({
        where: { id },
        data: { estado: 'CANCELADA' },
      });
      return this.view(id);
    }

    const stored = await this.storedFor(tx);
    if (!stored?.provider.cancelCharge) {
      throw new BadRequestException(
        'La configuración del POS cambió; cancela el cobro desde el terminal.',
      );
    }
    try {
      const snapshot = await stored.provider.cancelCharge(
        stored.config,
        tx.externalId,
        `hospal-pos-cancel-${id}`,
      );
      return await this.aplicar(id, snapshot);
    } catch (error) {
      if (error instanceof PosProviderError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /** Procesa una notificación del proveedor. Siempre consulta el estado real a la API. */
  async procesarWebhook(
    providerCode: string,
    request: PosWebhookRequest,
  ): Promise<{ recibido: true; transaccionId?: number }> {
    const provider = this.registry.get(providerCode);
    const ref = provider.webhookChargeRef?.(request);
    if (!ref) return { recibido: true };

    const tx = await this.prisma.transaccionPos.findFirst({
      where: {
        proveedor: provider.code,
        OR: [
          { externalId: ref.externalId },
          ...(ref.referenciaExterna
            ? [{ externalReference: ref.referenciaExterna }]
            : []),
        ],
      },
    });
    // Puede ser una orden creada fuera de HosPal: se ignora sin error.
    if (!tx) return { recibido: true };

    const stored = await this.storedFor(tx);
    if (stored && provider.verifyWebhook) {
      if (!provider.verifyWebhook(request, stored.config)) {
        throw new UnauthorizedException('Firma de notificación inválida.');
      }
    }

    if (!tx.externalId) {
      await this.prisma.transaccionPos.update({
        where: { id: tx.id },
        data: { externalId: ref.externalId },
      });
    }
    await this.sincronizar(tx.id);
    return { recibido: true, transaccionId: tx.id };
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  private async asegurarTerminalLibre(sedeId: number): Promise<void> {
    const abiertos = await this.prisma.transaccionPos.findMany({
      where: { sedeId, estado: { in: ABIERTOS } },
      select: { id: true },
    });
    for (const { id } of abiertos) {
      await this.sincronizar(id);
    }
    const siguen = await this.prisma.transaccionPos.count({
      where: { sedeId, estado: { in: ABIERTOS } },
    });
    if (siguen > 0) {
      throw new ConflictException(
        'Ya hay un cobro en curso en el terminal de la sede. Espera a que termine o cancélalo.',
      );
    }
  }

  private async sincronizar(id: number): Promise<void> {
    const tx = await this.find(id);
    // ERROR se reintenta: la orden pudo crearse aunque la respuesta no llegara.
    if (this.isFinal(tx) && tx.estado !== 'ERROR') return;

    const provider = this.registry.get(tx.proveedor);
    if (provider.modo === 'local') {
      const age = Date.now() - tx.creadoAt.getTime();
      if (!this.isFinal(tx) && age > SIN_RESPUESTA_LOCAL_MS) {
        await this.prisma.transaccionPos.update({
          where: { id },
          data: {
            estado: 'ERROR',
            mensaje:
              'El equipo de recepción no informó el resultado. Revisa la última venta en el terminal.',
          },
        });
      }
      return;
    }

    if (!tx.externalId) {
      const age = Date.now() - tx.creadoAt.getTime();
      if (tx.estado === 'PENDIENTE' && age > SIN_CONFIRMAR_MS) {
        await this.prisma.transaccionPos.update({
          where: { id },
          data: {
            estado: 'ERROR',
            mensaje:
              'El proveedor no confirmó la creación del cobro. Revisa el terminal.',
          },
        });
      }
      return;
    }

    const stored = await this.storedFor(tx);
    if (!stored?.provider.getCharge) return;
    try {
      const snapshot = await stored.provider.getCharge(
        stored.config,
        tx.externalId,
      );
      await this.aplicar(id, snapshot);
    } catch (error) {
      if (!(error instanceof PosProviderError)) throw error;
      this.logger.warn(
        `No se pudo consultar el cobro POS #${id}: ${error.message}`,
      );
    }
  }

  private async aplicar(
    id: number,
    snapshot: PosChargeSnapshot,
  ): Promise<TransaccionPosView> {
    const metodoPago: MetodoPago | undefined =
      snapshot.tipoTarjeta === 'DEBITO'
        ? MetodoPago.TARJETA_DEBITO
        : snapshot.tipoTarjeta === 'CREDITO'
          ? MetodoPago.TARJETA_CREDITO
          : undefined;

    const tx = await this.find(id);
    const montoDistinto =
      snapshot.estado === 'APROBADA' &&
      snapshot.montoCobrado !== undefined &&
      snapshot.montoCobrado !== tx.monto;

    await this.prisma.transaccionPos.update({
      where: { id },
      data: {
        ...(snapshot.externalId ? { externalId: snapshot.externalId } : {}),
        ...(snapshot.mensaje
          ? { mensaje: snapshot.mensaje.slice(0, 500) }
          : {}),
        ...(montoDistinto
          ? {
              mensaje: `El terminal cobró ${snapshot.montoCobrado} en lugar de ${tx.monto}. Registra el pago manualmente.`,
            }
          : {}),
        estado: snapshot.estado,
        estadoDetalle: snapshot.estadoDetalle?.slice(0, 100) ?? null,
        ...(metodoPago ? { metodoPago } : {}),
        respuestaRaw:
          snapshot.raw === undefined
            ? undefined
            : (JSON.parse(
                JSON.stringify(snapshot.raw),
              ) as Prisma.InputJsonValue),
      },
    });

    if (snapshot.estado === 'APROBADA' && !montoDistinto) {
      await this.registrarPago(
        id,
        metodoPago ?? tx.metodoPago ?? MetodoPago.TARJETA_CREDITO,
      );
    }
    return this.view(id);
  }

  /** Crea el Pago una sola vez aunque lleguen webhooks y consultas a la vez. */
  private async registrarPago(id: number, metodoPago: MetodoPago) {
    let pago: Pago | null = null;
    try {
      pago = await this.prisma.$transaction(async (trx) => {
        // Bloquea la fila: solo una ejecución ve pagoId en null.
        const claim = await trx.transaccionPos.updateMany({
          where: { id, pagoId: null },
          data: { mensaje: null },
        });
        if (claim.count === 0) return null;
        const tx = await trx.transaccionPos.findUniqueOrThrow({
          where: { id },
        });
        const created = await this.pagoService.registrarEn(trx, {
          reservaId: tx.reservaId,
          monto: tx.monto,
          metodoPago,
          tipoOperacion: tx.tipoOperacion,
        });
        await trx.transaccionPos.update({
          where: { id },
          data: { pagoId: created.id },
        });
        return created;
      });
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      // El cliente ya pagó en el terminal: no se pierde el registro del cobro.
      const mensaje = `Cobro aprobado en el terminal, pero no se pudo registrar el pago: ${error.message} Regístralo manualmente.`;
      this.logger.error(`Transacción POS #${id}: ${mensaje}`);
      await this.prisma.transaccionPos.update({
        where: { id },
        data: { mensaje: mensaje.slice(0, 500) },
      });
    }
    if (pago) this.pagoService.notificar(pago);
  }

  private async storedFor(tx: TransaccionPos) {
    const stored = await this.configService.loadStored(tx.sedeId);
    // Si la sede cambió de proveedor, la transacción ya no se puede consultar.
    return stored && stored.provider.code === tx.proveedor ? stored : null;
  }

  private async find(id: number): Promise<TransaccionPos> {
    const tx = await this.prisma.transaccionPos.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException(`No existe el cobro POS ${id}.`);
    return tx;
  }

  private async view(id: number): Promise<TransaccionPosView> {
    const tx = await this.prisma.transaccionPos.findUniqueOrThrow({
      where: { id },
      include: { pago: true },
    });
    return this.withFinal(tx);
  }

  private withFinal(tx: TransaccionPos & { pago: Pago | null }) {
    let modo: PosIntegrationMode = 'nube';
    try {
      modo = this.registry.get(tx.proveedor).modo;
    } catch {
      // Proveedor retirado del sistema: se informa como nube.
    }
    return { ...tx, final: this.isFinal(tx), modo };
  }

  private isFinal(tx: TransaccionPos): boolean {
    return FINAL_CHARGE_STATUSES.includes(tx.estado);
  }
}
