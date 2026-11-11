import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Pago, TransaccionPos } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PagoService } from '../../billing/application/pago.service';
import {
  PosChargeSnapshot,
  PosProvider,
  PosProviderError,
} from '../domain/pos-provider';
import { TransbankPosIntegradoProvider } from '../infrastructure/providers/transbank-pos-integrado.provider';
import { PosChargeService } from './pos-charge.service';
import { PosConfigService } from './pos-config.service';
import { PosProviderRegistry } from './pos-provider.registry';

// @nestjs/event-emitter se publica como ESM y Jest no lo transforma.
jest.mock('@nestjs/event-emitter', () => ({ EventEmitter2: class {} }));

type Row = TransaccionPos;
type Where = Record<string, unknown>;

/** Prisma en memoria con lo justo que usa PosChargeService. */
function createFakePrisma() {
  const rows = new Map<number, Row>();
  let nextId = 1;

  const matches = (row: Row, where: Where = {}): boolean =>
    Object.entries(where).every(([key, cond]) => {
      if (key === 'OR') {
        return (cond as Where[]).some((part) => matches(row, part));
      }
      const value = (row as unknown as Record<string, unknown>)[key];
      if (cond && typeof cond === 'object' && 'in' in cond) {
        return (cond as { in: unknown[] }).in.includes(value);
      }
      return value === cond;
    });
  const withPago = (row: Row) => ({
    ...row,
    pago: row.pagoId ? ({ id: row.pagoId } as Pago) : null,
  });
  const update = ({ where, data }: { where: { id: number }; data: Where }) => {
    const row = rows.get(where.id)!;
    Object.assign(row, data, { actualizadoAt: new Date() });
    return Promise.resolve(row);
  };

  const prisma = {
    rows,
    reserva: {
      findUnique: jest.fn(({ where }: { where: { id: number } }) =>
        Promise.resolve(
          where.id === 10
            ? {
                id: 10,
                codigo: 'HP-10',
                habitacion: { sedeId: 1, numero: '101' },
              }
            : null,
        ),
      ),
    },
    transaccionPos: {
      create: ({ data }: { data: Partial<Row> }) => {
        const row = {
          id: nextId++,
          pagoId: null,
          externalId: null,
          externalReference: null,
          estado: 'PENDIENTE',
          estadoDetalle: null,
          metodoPago: null,
          mensaje: null,
          respuestaRaw: null,
          deviceId: null,
          creadoAt: new Date(),
          actualizadoAt: new Date(),
          ...data,
        } as Row;
        rows.set(row.id, row);
        return Promise.resolve(row);
      },
      update,
      updateMany: ({ where, data }: { where: Where; data: Where }) => {
        const hits = [...rows.values()].filter((row) => matches(row, where));
        hits.forEach((row) => Object.assign(row, data));
        return Promise.resolve({ count: hits.length });
      },
      findUnique: ({ where }: { where: { id: number } }) =>
        Promise.resolve(rows.get(where.id) ?? null),
      findUniqueOrThrow: ({ where }: { where: { id: number } }) =>
        Promise.resolve(withPago(rows.get(where.id)!)),
      findFirst: ({ where }: { where: Where }) =>
        Promise.resolve(
          [...rows.values()].find((row) => matches(row, where)) ?? null,
        ),
      findMany: ({ where }: { where?: Where }) =>
        Promise.resolve(
          [...rows.values()].filter((row) => matches(row, where)).map(withPago),
        ),
      count: ({ where }: { where: Where }) =>
        Promise.resolve(
          [...rows.values()].filter((row) => matches(row, where)).length,
        ),
    },
    $transaction: (fn: (trx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return prisma;
}

function createProvider(): jest.Mocked<Required<PosProvider>> {
  return {
    code: 'FAKE',
    nombre: 'Fake POS',
    descripcion: '',
    modo: 'nube',
    disponible: true,
    nota: '',
    etiquetas: [],
    campos: [
      { key: 'deviceId', label: 'Terminal', type: 'device', required: true },
    ],
    soportaCobros: true,
    parseLocalResult: jest.fn(),
    testConnection: jest.fn(),
    listDevices: jest.fn(),
    createCharge: jest.fn(),
    getCharge: jest.fn(),
    cancelCharge: jest.fn(),
    webhookChargeRef: jest.fn(),
    verifyWebhook: jest.fn().mockReturnValue(true),
  };
}

const snapshot = (estado: PosChargeSnapshot['estado'], extra = {}) => ({
  externalId: 'ORD01',
  estado,
  ...extra,
});

describe('PosChargeService', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let provider: jest.Mocked<Required<PosProvider>>;
  let pagoService: {
    validarEn: jest.Mock;
    registrarEn: jest.Mock;
    notificar: jest.Mock;
  };
  let loadStored: jest.Mock;
  let service: PosChargeService;

  beforeEach(() => {
    prisma = createFakePrisma();
    provider = createProvider();
    pagoService = {
      validarEn: jest.fn().mockResolvedValue({}),
      registrarEn: jest.fn().mockResolvedValue({ id: 99 }),
      notificar: jest.fn(),
    };
    loadStored = jest.fn().mockResolvedValue({
      provider,
      activo: true,
      config: { credenciales: {}, parametros: { deviceId: 'DEV-1' } },
    });
    service = new PosChargeService(
      prisma as unknown as PrismaService,
      pagoService as unknown as PagoService,
      { loadStored } as unknown as PosConfigService,
      new PosProviderRegistry([provider]),
    );
  });

  const iniciar = () =>
    service.iniciar({ reservaId: 10, monto: 30000, tipoOperacion: 'ABONO' });

  it('envía el cobro al terminal con referencia e idempotencia estables', async () => {
    provider.createCharge.mockResolvedValue(snapshot('PENDIENTE'));

    const tx = await iniciar();

    expect(pagoService.validarEn).toHaveBeenCalled();
    expect(provider.createCharge).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        monto: 30000,
        referenciaExterna: `HOSPAL-R10-T${tx.id}`,
        idempotencyKey: `hospal-pos-${tx.id}`,
      }),
    );
    expect(tx).toMatchObject({
      externalId: 'ORD01',
      estado: 'PENDIENTE',
      deviceId: 'DEV-1',
      final: false,
    });
  });

  it('usa la tarjeta elegida en recepción si el terminal no la informa', async () => {
    provider.createCharge.mockResolvedValue(snapshot('EN_TERMINAL'));
    await service.iniciar({
      reservaId: 10,
      monto: 30000,
      tipoOperacion: 'PAGO_FINAL',
      tipoTarjeta: 'DEBITO',
    });
    expect(provider.createCharge).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tipoTarjeta: 'DEBITO' }),
    );

    provider.getCharge.mockResolvedValue(snapshot('APROBADA'));
    await service.obtener(1);

    expect(pagoService.registrarEn).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        metodoPago: 'TARJETA_DEBITO',
        tipoOperacion: 'PAGO_FINAL',
      }),
    );
  });

  it('el tipo informado por el terminal manda sobre la preferencia', async () => {
    provider.createCharge.mockResolvedValue(snapshot('EN_TERMINAL'));
    await service.iniciar({
      reservaId: 10,
      monto: 30000,
      tipoOperacion: 'ABONO',
      tipoTarjeta: 'DEBITO',
    });
    provider.getCharge.mockResolvedValue(
      snapshot('APROBADA', { tipoTarjeta: 'CREDITO' }),
    );
    await service.obtener(1);

    expect(pagoService.registrarEn).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ metodoPago: 'TARJETA_CREDITO' }),
    );
  });

  it('rechaza si el POS está inactivo o no admite cobros', async () => {
    loadStored.mockResolvedValueOnce({ provider, activo: false, config: {} });
    await expect(iniciar()).rejects.toThrow('desactivado');

    loadStored.mockResolvedValueOnce({
      provider: { ...provider, soportaCobros: false, nombre: 'Manual' },
      activo: true,
      config: {},
    });
    await expect(iniciar()).rejects.toThrow('no admite cobros');
    expect(provider.createCharge).not.toHaveBeenCalled();
  });

  it('no inicia si las reglas de pago lo impiden', async () => {
    pagoService.validarEn.mockRejectedValue(
      new BadRequestException('El pago supera el precio total de la reserva.'),
    );
    await expect(iniciar()).rejects.toThrow('supera el precio');
    expect(prisma.rows.size).toBe(0);
  });

  it('no permite dos cobros a la vez en el terminal', async () => {
    provider.createCharge.mockResolvedValue(snapshot('EN_TERMINAL'));
    provider.getCharge.mockResolvedValue(snapshot('EN_TERMINAL'));
    await iniciar();

    await expect(iniciar()).rejects.toBeInstanceOf(ConflictException);
  });

  it('libera el terminal si el cobro anterior ya terminó', async () => {
    provider.createCharge.mockResolvedValue(snapshot('EN_TERMINAL'));
    await iniciar();
    provider.getCharge.mockResolvedValue(snapshot('EXPIRADA'));

    await expect(iniciar()).resolves.toBeDefined();
    expect(prisma.rows.get(1)?.estado).toBe('EXPIRADA');
  });

  it('marca ERROR si el proveedor falla al crear', async () => {
    provider.createCharge.mockRejectedValue(
      new PosProviderError('Terminal ocupado'),
    );
    await expect(iniciar()).rejects.toThrow('Terminal ocupado');
    expect(prisma.rows.get(1)).toMatchObject({
      estado: 'ERROR',
      mensaje: 'Terminal ocupado',
    });
  });

  describe('aprobación', () => {
    beforeEach(async () => {
      provider.createCharge.mockResolvedValue(snapshot('EN_TERMINAL'));
      await iniciar();
      provider.webhookChargeRef.mockReturnValue({ externalId: 'ORD01' });
    });

    const webhook = () =>
      service.procesarWebhook('FAKE', { headers: {}, query: {}, body: {} });

    it('registra el pago una sola vez con el tipo de tarjeta', async () => {
      provider.getCharge.mockResolvedValue(
        snapshot('APROBADA', { tipoTarjeta: 'DEBITO' }),
      );

      await webhook();
      await webhook();
      const tx = await service.obtener(1);

      expect(pagoService.registrarEn).toHaveBeenCalledTimes(1);
      expect(pagoService.registrarEn).toHaveBeenCalledWith(prisma, {
        reservaId: 10,
        monto: 30000,
        metodoPago: 'TARJETA_DEBITO',
        tipoOperacion: 'ABONO',
      });
      expect(pagoService.notificar).toHaveBeenCalledTimes(1);
      expect(tx).toMatchObject({ estado: 'APROBADA', pagoId: 99, final: true });
    });

    it('conserva el cobro aprobado aunque el pago no se pueda registrar', async () => {
      provider.getCharge.mockResolvedValue(snapshot('APROBADA'));
      pagoService.registrarEn.mockRejectedValue(
        new BadRequestException(
          'No se pueden registrar pagos en una reserva CANCELADA.',
        ),
      );

      await webhook();

      expect(prisma.rows.get(1)).toMatchObject({
        estado: 'APROBADA',
        pagoId: null,
      });
      expect(prisma.rows.get(1)?.mensaje).toContain('Regístralo manualmente');
      expect(pagoService.notificar).not.toHaveBeenCalled();
    });

    it('rechaza notificaciones con firma inválida', async () => {
      provider.verifyWebhook.mockReturnValue(false);
      await expect(webhook()).rejects.toBeInstanceOf(UnauthorizedException);
      expect(provider.getCharge).not.toHaveBeenCalled();
    });

    it('ignora notificaciones de órdenes desconocidas', async () => {
      provider.webhookChargeRef.mockReturnValue({ externalId: 'OTRA' });
      await expect(webhook()).resolves.toEqual({ recibido: true });
    });

    it('recupera un cobro en ERROR por su referencia externa', async () => {
      Object.assign(prisma.rows.get(1)!, { estado: 'ERROR', externalId: null });
      provider.webhookChargeRef.mockReturnValue({
        externalId: 'ORD01',
        referenciaExterna: 'HOSPAL-R10-T1',
      });
      provider.getCharge.mockResolvedValue(snapshot('APROBADA'));

      await webhook();

      expect(prisma.rows.get(1)).toMatchObject({
        estado: 'APROBADA',
        externalId: 'ORD01',
        pagoId: 99,
      });
    });
  });

  it('cancela un cobro en curso', async () => {
    provider.createCharge.mockResolvedValue(snapshot('EN_TERMINAL'));
    await iniciar();
    provider.cancelCharge.mockResolvedValue(snapshot('CANCELADA'));

    const tx = await service.cancelar(1);

    expect(provider.cancelCharge).toHaveBeenCalledWith(
      expect.anything(),
      'ORD01',
      'hospal-pos-cancel-1',
    );
    expect(tx).toMatchObject({ estado: 'CANCELADA', final: true });
    await expect(service.cancelar(1)).rejects.toThrow('ya terminó');
  });

  describe('cobro local (Transbank)', () => {
    const tbk = new TransbankPosIntegradoProvider();
    const venta = (extra = {}) => ({
      responseCode: 0,
      responseMessage: 'Aprobado',
      authorizationCode: '123456',
      amount: 30000,
      operationNumber: 21,
      terminalId: 'TERM01',
      cardType: 'DB',
      ...extra,
    });

    beforeEach(() => {
      service = new PosChargeService(
        prisma as unknown as PrismaService,
        pagoService as unknown as PagoService,
        { loadStored } as unknown as PosConfigService,
        new PosProviderRegistry([provider, tbk]),
      );
      loadStored.mockResolvedValue({
        provider: tbk,
        activo: true,
        config: { credenciales: {}, parametros: { puerto: 'COM3' } },
      });
    });

    it('deja el cobro pendiente para que lo ejecute recepción', async () => {
      const tx = await iniciar();
      expect(tx).toMatchObject({
        estado: 'PENDIENTE',
        modo: 'local',
        deviceId: 'COM3',
        proveedor: 'TRANSBANK_POS_INTEGRADO',
      });
    });

    it('registra el pago con la venta aprobada informada', async () => {
      await iniciar();
      const tx = await service.registrarResultadoLocal(1, venta());

      expect(tx).toMatchObject({
        estado: 'APROBADA',
        externalId: 'TERM01-21',
        metodoPago: 'TARJETA_DEBITO',
        pagoId: 99,
      });
      expect(pagoService.registrarEn).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ monto: 30000, metodoPago: 'TARJETA_DEBITO' }),
      );
      await expect(service.registrarResultadoLocal(1, venta())).rejects.toThrow(
        'ya tiene un resultado',
      );
    });

    it('marca rechazada sin crear pago', async () => {
      await iniciar();
      const tx = await service.registrarResultadoLocal(
        1,
        venta({
          responseCode: 5,
          responseMessage: 'Rechazada',
          operationNumber: 0,
        }),
      );
      expect(tx).toMatchObject({
        estado: 'RECHAZADA',
        mensaje: 'Rechazada',
        externalId: null,
      });
      expect(pagoService.registrarEn).not.toHaveBeenCalled();
    });

    it('no registra el pago si el terminal cobró otro monto', async () => {
      await iniciar();
      const tx = await service.registrarResultadoLocal(
        1,
        venta({ amount: 999 }),
      );
      expect(tx.estado).toBe('APROBADA');
      expect(tx.mensaje).toContain('Registra el pago manualmente');
      expect(pagoService.registrarEn).not.toHaveBeenCalled();
    });

    it('rechaza resultados con formato inválido', async () => {
      await iniciar();
      await expect(
        service.registrarResultadoLocal(1, { foo: 'bar' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('da por perdido un cobro local sin respuesta y libera el terminal', async () => {
      await iniciar();
      prisma.rows.get(1)!.creadoAt = new Date(Date.now() - 5 * 60_000);

      await expect(iniciar()).resolves.toMatchObject({ id: 2 });
      expect(prisma.rows.get(1)).toMatchObject({ estado: 'ERROR' });
      // Aún se puede recuperar con la última venta del terminal.
      await expect(
        service.registrarResultadoLocal(1, venta()),
      ).resolves.toMatchObject({ estado: 'APROBADA' });
    });

    it('no acepta resultados locales para cobros en la nube', async () => {
      loadStored.mockResolvedValue({
        provider,
        activo: true,
        config: { credenciales: {}, parametros: {} },
      });
      provider.createCharge.mockResolvedValue(snapshot('EN_TERMINAL'));
      await iniciar();
      await expect(service.registrarResultadoLocal(1, venta())).rejects.toThrow(
        'lo confirma el proveedor',
      );
    });
  });
});
