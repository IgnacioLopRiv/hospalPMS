import { of, throwError } from 'rxjs';
import { PosConfig, PosProviderInfo, PosRepository } from '../pos.repository';

/**
 * Repositorio POS para tests de páginas que muestran medios de pago.
 * Por defecto la sede no tiene POS (débito y crédito deshabilitados).
 */
export function createPosRepositoryStub(options: { providers?: PosProviderInfo[]; config?: Partial<PosConfig> } = {}): PosRepository {
  const config: PosConfig = {
    sedeId: 1,
    configurado: false,
    proveedor: null,
    activo: false,
    parametros: {},
    credenciales: {},
    actualizadoAt: null,
    ...options.config,
  };
  const notAvailable = () => throwError(() => new Error('POS no disponible en este test.'));
  return {
    listProviders: () => of(options.providers ?? []),
    getConfig: () => of(config),
    saveConfig: () => of(config),
    testConnection: () => of({ ok: false, mensaje: '' }),
    listDevices: () => of([]),
    iniciarCobro: notAvailable,
    obtenerCobro: notAvailable,
    cancelarCobro: notAvailable,
    reportarResultado: notAvailable,
  };
}
