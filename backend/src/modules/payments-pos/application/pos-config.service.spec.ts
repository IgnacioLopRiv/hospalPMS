import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PosConfigRecord,
  PosConfigRepository,
  PosConfigUpsert,
} from '../domain/pos-config.repository';
import { PosProvider, PosProviderError } from '../domain/pos-provider';
import { GetnetPosProvider } from '../infrastructure/providers/convenio-pendiente.provider';
import { ManualPosProvider } from '../infrastructure/providers/manual.provider';
import { MercadoPagoPointProvider } from '../infrastructure/providers/mercado-pago-point.provider';
import { PosConfigService } from './pos-config.service';
import { PosCryptoService } from './pos-crypto.service';
import { PosProviderRegistry } from './pos-provider.registry';

class InMemoryRepo extends PosConfigRepository {
  rows = new Map<number, PosConfigRecord>();
  sedeExists(sedeId: number) {
    return Promise.resolve(sedeId === 1);
  }
  findBySede(sedeId: number) {
    return Promise.resolve(this.rows.get(sedeId) ?? null);
  }
  upsert(sedeId: number, data: PosConfigUpsert) {
    const row = { sedeId, ...data, actualizadoAt: new Date() };
    this.rows.set(sedeId, row);
    return Promise.resolve(row);
  }
}

const KEY = 'clave-de-prueba-suficientemente-larga';

describe('PosConfigService', () => {
  let repo: InMemoryRepo;
  let crypto: PosCryptoService;
  let mp: MercadoPagoPointProvider;
  let service: PosConfigService;

  beforeEach(() => {
    repo = new InMemoryRepo();
    crypto = new PosCryptoService(
      new ConfigService({ POS_ENCRYPTION_KEY: KEY }),
    );
    mp = new MercadoPagoPointProvider();
    const registry = new PosProviderRegistry([
      mp,
      new ManualPosProvider(),
      new GetnetPosProvider(),
    ]);
    service = new PosConfigService(repo, registry, crypto);
  });

  it('devuelve config vacía si la sede no tiene POS', async () => {
    const view = await service.getConfig(1);
    expect(view.configurado).toBe(false);
    expect(view.proveedor).toBeNull();
  });

  it('rechaza sedes inexistentes', async () => {
    await expect(service.getConfig(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza proveedores desconocidos', async () => {
    await expect(
      service.saveConfig(1, { proveedor: 'OTRO' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no permite guardar proveedores aún no disponibles', async () => {
    await expect(
      service.saveConfig(1, { proveedor: 'GETNET', activo: false }),
    ).rejects.toThrow('aún no está disponible');
    expect(repo.rows.size).toBe(0);
  });

  it('cifra el token y nunca lo devuelve completo', async () => {
    const view = await service.saveConfig(1, {
      proveedor: 'MERCADO_PAGO_POINT',
      activo: true,
      credenciales: { accessToken: 'APP_USR-123456789' },
      parametros: { deviceId: 'PAX_A910__SMARTPOS1', extra: 'x' },
    });

    const stored = repo.rows.get(1)!;
    expect(stored.credenciales).not.toContain('APP_USR');
    expect(crypto.decrypt(stored.credenciales)).toEqual({
      accessToken: 'APP_USR-123456789',
    });
    expect(stored.parametros).toEqual({ deviceId: 'PAX_A910__SMARTPOS1' });
    expect(view.credenciales.accessToken).toBe('••••••••6789');
    expect(JSON.stringify(view)).not.toContain('APP_USR-123456789');
  });

  it('mantiene el token guardado si llega vacío', async () => {
    await service.saveConfig(1, {
      proveedor: 'MERCADO_PAGO_POINT',
      credenciales: { accessToken: 'APP_USR-original' },
    });
    await service.saveConfig(1, {
      proveedor: 'MERCADO_PAGO_POINT',
      activo: true,
      credenciales: { accessToken: '' },
      parametros: { deviceId: 'DEV1' },
    });
    expect(crypto.decrypt(repo.rows.get(1)!.credenciales)).toEqual({
      accessToken: 'APP_USR-original',
    });
  });

  it('descarta credenciales al cambiar de proveedor', async () => {
    await service.saveConfig(1, {
      proveedor: 'MERCADO_PAGO_POINT',
      credenciales: { accessToken: 'APP_USR-original' },
    });
    await service.saveConfig(1, { proveedor: 'MANUAL', activo: true });
    expect(repo.rows.get(1)!.credenciales).toBeNull();
  });

  it('exige campos obligatorios solo al activar', async () => {
    await expect(
      service.saveConfig(1, { proveedor: 'MERCADO_PAGO_POINT', activo: true }),
    ).rejects.toThrow('Access Token, Terminal');
    await expect(
      service.saveConfig(1, { proveedor: 'MERCADO_PAGO_POINT', activo: false }),
    ).resolves.toMatchObject({ activo: false });
  });

  it('prueba conexión usando el token guardado y traduce errores', async () => {
    await service.saveConfig(1, {
      proveedor: 'MERCADO_PAGO_POINT',
      credenciales: { accessToken: 'APP_USR-guardado' },
    });
    const spy = jest
      .spyOn(mp as PosProvider, 'testConnection')
      .mockRejectedValue(new PosProviderError('Token inválido', 401));

    const result = await service.testConnection(1, {
      proveedor: 'MERCADO_PAGO_POINT',
    });

    expect(spy).toHaveBeenCalledWith({
      credenciales: { accessToken: 'APP_USR-guardado' },
      parametros: {},
    });
    expect(result).toEqual({ ok: false, mensaje: 'Token inválido' });
  });

  it('advierte si las credenciales no se pueden descifrar', async () => {
    repo.rows.set(1, {
      sedeId: 1,
      proveedor: 'MERCADO_PAGO_POINT',
      activo: false,
      credenciales: 'v1:basura',
      parametros: {},
      actualizadoAt: new Date(),
    });
    const view = await service.getConfig(1);
    expect(view.advertencia).toBeDefined();
    expect(view.credenciales).toEqual({});
  });
});

describe('PosCryptoService', () => {
  it('falla con mensaje claro si no hay clave', () => {
    const crypto = new PosCryptoService(new ConfigService({}));
    expect(() => crypto.encrypt({ a: 'b' })).toThrow('POS_ENCRYPTION_KEY');
  });

  it('no descifra con otra clave', () => {
    const a = new PosCryptoService(
      new ConfigService({ POS_ENCRYPTION_KEY: KEY }),
    );
    const b = new PosCryptoService(
      new ConfigService({ POS_ENCRYPTION_KEY: `${KEY}-otra` }),
    );
    expect(() => b.decrypt(a.encrypt({ token: 'x' }))).toThrow();
  });
});
