import { createHmac } from 'node:crypto';
import { PosProviderError } from '../../domain/pos-provider';
import { MercadoPagoPointProvider } from './mercado-pago-point.provider';

const config = { credenciales: { accessToken: 'APP_USR-x' }, parametros: {} };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MercadoPagoPointProvider', () => {
  let provider: MercadoPagoPointProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    provider = new MercadoPagoPointProvider();
    fetchMock = jest.fn();
    provider.fetchFn = fetchMock;
  });

  it('valida la conexión con /users/me enviando el token', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { id: 42, nickname: 'HOSTAL', site_id: 'MLC' }),
    );

    const result = await provider.testConnection(config);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mercadopago.com/users/me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer APP_USR-x' },
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      cuenta: { Cuenta: 'HOSTAL', País: 'MLC' },
    });
  });

  it('traduce un 401 a un error legible', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'invalid' }));
    await expect(provider.testConnection(config)).rejects.toThrow(
      'rechazó el Access Token',
    );
  });

  it('falla sin token sin llamar a la API', async () => {
    await expect(
      provider.testConnection({ credenciales: {}, parametros: {} }),
    ).rejects.toBeInstanceOf(PosProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lista terminales y marca los que no están en modo PDV', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: {
          terminals: [
            { id: 'A', operating_mode: 'PDV', external_pos_id: 'CAJA1' },
            { id: 'B', operating_mode: 'STANDALONE' },
          ],
        },
      }),
    );

    const devices = await provider.listDevices(config);

    expect(devices).toEqual([
      expect.objectContaining({
        id: 'A',
        nombre: 'A (CAJA1)',
        disponible: true,
      }),
      expect.objectContaining({ id: 'B', disponible: false }),
    ]);
  });

  it('usa la API de integración anterior si la nueva responde 404', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, { devices: [{ id: 'C', operating_mode: 'PDV' }] }),
      );

    const devices = await provider.listDevices(config);

    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.mercadopago.com/point/integration-api/devices',
      expect.anything(),
    );
    expect(devices[0]).toMatchObject({ id: 'C', disponible: true });
  });

  describe('cobros', () => {
    const chargeConfig = {
      credenciales: { accessToken: 'APP_USR-x' },
      parametros: { deviceId: 'NEWLAND_N950__SBX0000001' },
    };

    it('crea una orden point con monto entero, terminal e idempotencia', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(201, { id: 'ORD01', status: 'created' }),
      );

      const snapshot = await provider.createCharge(chargeConfig, {
        monto: 45000,
        referenciaExterna: 'HOSPAL-R1-T2',
        descripcion: 'Reserva HP-1',
        idempotencyKey: 'hospal-pos-2',
      });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.mercadopago.com/v1/orders');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        'X-Idempotency-Key': 'hospal-pos-2',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(init.body as string)).toMatchObject({
        type: 'point',
        external_reference: 'HOSPAL-R1-T2',
        transactions: { payments: [{ amount: '45000' }] },
        config: { point: { terminal_id: 'NEWLAND_N950__SBX0000001' } },
      });
      expect(snapshot).toMatchObject({
        externalId: 'ORD01',
        estado: 'PENDIENTE',
      });
    });

    it('preselecciona débito o crédito en el terminal', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(201, { id: 'ORD01', status: 'created' }),
      );
      await provider.createCharge(chargeConfig, {
        monto: 1000,
        referenciaExterna: 'R',
        descripcion: 'D',
        idempotencyKey: 'K',
        tipoTarjeta: 'DEBITO',
      });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as {
        config: { payment_method?: unknown };
      };
      expect(body.config.payment_method).toEqual({
        default_type: 'debit_card',
      });
    });

    it('no crea la orden sin terminal configurado', async () => {
      await expect(
        provider.createCharge(config, {
          monto: 1,
          referenciaExterna: 'x',
          descripcion: 'x',
          idempotencyKey: 'x',
        }),
      ).rejects.toThrow('terminal');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ['at_terminal', 'EN_TERMINAL'],
      ['processed', 'APROBADA'],
      ['failed', 'RECHAZADA'],
      ['canceled', 'CANCELADA'],
      ['expired', 'EXPIRADA'],
      ['refunded', 'REEMBOLSADA'],
    ])('traduce el estado %s a %s', async (status, estado) => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'ORD01', status }));
      await expect(
        provider.getCharge(chargeConfig, 'ORD01'),
      ).resolves.toMatchObject({ estado });
    });

    it('informa si la tarjeta fue de débito', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          id: 'ORD01',
          status: 'processed',
          transactions: {
            payments: [
              {
                status_detail: 'accredited',
                payment_method: { type: 'debit_card' },
              },
            ],
          },
        }),
      );
      await expect(
        provider.getCharge(chargeConfig, 'ORD01'),
      ).resolves.toMatchObject({
        tipoTarjeta: 'DEBITO',
        estadoDetalle: 'accredited',
      });
    });

    it('cancela permitiendo órdenes ya tomadas por el terminal', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response(null, { status: 202 }))
        .mockResolvedValueOnce(
          jsonResponse(200, { id: 'ORD01', status: 'canceled' }),
        );

      const snapshot = await provider.cancelCharge(chargeConfig, 'ORD01', 'k');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.mercadopago.com/v1/orders/ORD01/cancel');
      expect(init.headers).toMatchObject({
        'x-allow-cancelable-status': 'at_terminal',
      });
      expect(snapshot.estado).toBe('CANCELADA');
    });

    it('explica cuando no se puede cancelar (409)', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(409, { errors: [{ message: 'cannot_cancel_order' }] }),
      );
      await expect(
        provider.cancelCharge(chargeConfig, 'ORD01', 'k'),
      ).rejects.toThrow('Cancélalo desde el terminal');
    });
  });

  describe('webhooks', () => {
    const secret = 'secreto-webhook';
    const sign = (manifest: string) =>
      createHmac('sha256', secret).update(manifest).digest('hex');

    it('extrae el id de la orden de la query o del cuerpo', () => {
      expect(
        provider.webhookChargeRef({
          headers: {},
          query: { 'data.id': 'ORD01', type: 'order' },
          body: {},
        }),
      ).toEqual({ externalId: 'ORD01', referenciaExterna: undefined });
      expect(
        provider.webhookChargeRef({
          headers: {},
          query: {},
          body: {
            type: 'order',
            data: { id: 'ORD02', external_reference: 'HOSPAL-R1-T2' },
          },
        }),
      ).toEqual({ externalId: 'ORD02', referenciaExterna: 'HOSPAL-R1-T2' });
    });

    it('ignora notificaciones de otros tipos', () => {
      expect(
        provider.webhookChargeRef({
          headers: {},
          query: { 'data.id': '1', type: 'payment' },
          body: {},
        }),
      ).toBeNull();
    });

    it('valida la firma x-signature', () => {
      const cfg = { credenciales: { webhookSecret: secret }, parametros: {} };
      const v1 = sign('id:ord01abc;request-id:req-1;ts:1700000000;');
      const request = {
        headers: {
          'x-signature': `ts=1700000000,v1=${v1}`,
          'x-request-id': 'req-1',
        },
        query: { 'data.id': 'ORD01ABC' },
        body: {},
      };

      expect(provider.verifyWebhook(request, cfg)).toBe(true);
      expect(
        provider.verifyWebhook(
          {
            ...request,
            headers: { ...request.headers, 'x-request-id': 'otro' },
          },
          cfg,
        ),
      ).toBe(false);
      expect(provider.verifyWebhook({ ...request, headers: {} }, cfg)).toBe(
        false,
      );
    });

    it('acepta sin clave configurada (el estado se consulta a la API)', () => {
      expect(
        provider.verifyWebhook(
          { headers: {}, query: {}, body: {} },
          { credenciales: {}, parametros: {} },
        ),
      ).toBe(true);
    });
  });
});
