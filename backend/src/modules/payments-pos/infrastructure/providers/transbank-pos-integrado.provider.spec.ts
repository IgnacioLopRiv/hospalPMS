import { PosProviderError } from '../../domain/pos-provider';
import { TransbankPosIntegradoProvider } from './transbank-pos-integrado.provider';

describe('TransbankPosIntegradoProvider', () => {
  const provider = new TransbankPosIntegradoProvider();

  it('es un proveedor local disponible con puerto opcional', () => {
    expect(provider.modo).toBe('local');
    expect(provider.disponible).toBe(true);
    expect(provider.campos).toEqual([
      expect.objectContaining({
        key: 'puerto',
        type: 'device',
        required: false,
      }),
    ]);
  });

  it.each([
    ['CR', 'CREDITO'],
    ['DB', 'DEBITO'],
    ['PR', 'DEBITO'],
    ['XX', undefined],
  ])('traduce el tipo de tarjeta %s', (cardType, tipoTarjeta) => {
    expect(
      provider.parseLocalResult({ responseCode: 0, cardType }).tipoTarjeta,
    ).toBe(tipoTarjeta);
  });

  it('solo guarda datos no sensibles de la venta', () => {
    const snapshot = provider.parseLocalResult({
      responseCode: 0,
      amount: 1500,
      operationNumber: 7,
      terminalId: 'T1',
      accountNumber: '123456789',
    });
    expect(snapshot).toMatchObject({
      estado: 'APROBADA',
      externalId: 'T1-7',
      montoCobrado: 1500,
    });
    expect(JSON.stringify(snapshot.raw)).not.toContain('123456789');
  });

  it('explica el rechazo con el código si no hay mensaje', () => {
    expect(provider.parseLocalResult({ responseCode: 9 })).toMatchObject({
      estado: 'RECHAZADA',
      mensaje: 'Transbank rechazó la venta (código 9).',
    });
  });

  it('rechaza respuestas sin código', () => {
    expect(() => provider.parseLocalResult({})).toThrow(PosProviderError);
    expect(() => provider.parseLocalResult('x')).toThrow(PosProviderError);
  });

  it('no prueba la conexión desde el servidor', async () => {
    await expect(provider.testConnection()).resolves.toMatchObject({
      ok: false,
    });
  });
});
