import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { POS_LOCAL_DRIVERS, PosLocalDriver } from '../domain/pos-local-driver';
import { PosConfig, PosProviderInfo, PosRepository, TransaccionPos } from '../domain/pos.repository';
import { PosCobroService, PosDisponible } from './pos-cobro.service';

const MP: PosProviderInfo = {
  code: 'MERCADO_PAGO_POINT', nombre: 'Mercado Pago Point', descripcion: '', modo: 'nube',
  disponible: true, soportaCobros: true, etiquetas: [], campos: [],
};
const TBK: PosProviderInfo = { ...MP, code: 'TRANSBANK_POS_INTEGRADO', nombre: 'Transbank', modo: 'local' };
const MANUAL: PosProviderInfo = { ...MP, code: 'MANUAL', nombre: 'Manual', soportaCobros: false };

const config = (proveedor: string, activo = true): PosConfig => ({
  sedeId: 1, configurado: true, proveedor, activo, parametros: { puerto: 'COM3' },
  credenciales: {}, actualizadoAt: null,
});

const tx = (extra: Partial<TransaccionPos> = {}): TransaccionPos => ({
  id: 7, reservaId: 10, proveedor: 'MERCADO_PAGO_POINT', monto: 30000, estado: 'PENDIENTE',
  estadoDetalle: null, metodoPago: null, mensaje: null, pagoId: null, final: false, modo: 'nube',
  ...extra,
});

const INPUT = { reservaId: 10, monto: 30000, tipoOperacion: 'ABONO' as const, tipoTarjeta: 'DEBITO' as const };

describe('PosCobroService', () => {
  let service: PosCobroService;
  let repo: jasmine.SpyObj<PosRepository>;
  let driver: jasmine.SpyObj<PosLocalDriver>;

  beforeEach(() => {
    repo = jasmine.createSpyObj<PosRepository>('PosRepository', [
      'listProviders', 'getConfig', 'iniciarCobro', 'obtenerCobro', 'cancelarCobro', 'reportarResultado',
    ]);
    repo.listProviders.and.returnValue(of([MP, TBK, MANUAL]));
    driver = jasmine.createSpyObj<PosLocalDriver>('PosLocalDriver', ['testConnection', 'listDevices', 'cobrar'], {
      code: 'TRANSBANK_POS_INTEGRADO',
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: PosRepository, useValue: repo },
        { provide: POS_LOCAL_DRIVERS, useValue: [driver] },
      ],
    });
    service = TestBed.inject(PosCobroService);
  });

  describe('posDisponible', () => {
    it('devuelve el POS activo que puede cobrar', async () => {
      repo.getConfig.and.returnValue(of(config('MERCADO_PAGO_POINT')));
      expect((await service.posDisponible(1))?.proveedor.code).toBe('MERCADO_PAGO_POINT');
    });

    it('es null si el POS está inactivo, es manual o falla la consulta', async () => {
      repo.getConfig.and.returnValue(of(config('MERCADO_PAGO_POINT', false)));
      expect(await service.posDisponible(1)).toBeNull();
      repo.getConfig.and.returnValue(of(config('MANUAL')));
      expect(await service.posDisponible(1)).toBeNull();
      repo.getConfig.and.returnValue(throwError(() => new Error('x')));
      expect(await service.posDisponible(1)).toBeNull();
    });
  });

  describe('cobro en la nube', () => {
    const pos: PosDisponible = { proveedor: MP, config: config('MERCADO_PAGO_POINT') };

    it('consulta el estado hasta que el terminal lo aprueba', fakeAsync(() => {
      repo.iniciarCobro.and.returnValue(of(tx()));
      repo.obtenerCobro.and.returnValues(
        of(tx({ estado: 'EN_TERMINAL' })),
        of(tx({ estado: 'APROBADA', final: true, pagoId: 99, metodoPago: 'TARJETA_DEBITO' })),
      );
      let result: TransaccionPos | null = null;
      void service.cobrar(INPUT, pos).then((value) => (result = value));
      flushMicrotasks();
      expect(service.etapa()).toBe('esperando');
      expect(service.puedeCancelar()).toBeTrue();

      tick(2500);
      expect(service.mensaje()).toContain('Esperando la tarjeta');
      tick(2500);

      expect(repo.iniciarCobro).toHaveBeenCalledWith(INPUT);
      expect(service.etapa()).toBe('aprobado');
      expect(result!.pagoId).toBe(99);
    }));

    it('informa el rechazo del terminal', fakeAsync(() => {
      repo.iniciarCobro.and.returnValue(of(tx()));
      repo.obtenerCobro.and.returnValue(of(tx({ estado: 'RECHAZADA', final: true })));
      void service.cobrar(INPUT, pos);
      tick(2500);
      expect(service.etapa()).toBe('fallido');
      expect(service.mensaje()).toBe('El terminal rechazó la tarjeta.');
    }));

    it('muestra el error del backend si no se pudo enviar', async () => {
      repo.iniciarCobro.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 409, error: { message: 'Ya hay un cobro en curso en el terminal de la sede.' },
      })));
      expect(await service.cobrar(INPUT, pos)).toBeNull();
      expect(service.etapa()).toBe('fallido');
      expect(service.mensaje()).toContain('cobro en curso');
    });

    it('cancela el cobro que espera la tarjeta', fakeAsync(() => {
      repo.iniciarCobro.and.returnValue(of(tx({ estado: 'EN_TERMINAL' })));
      repo.obtenerCobro.and.returnValue(of(tx({ estado: 'EN_TERMINAL' })));
      repo.cancelarCobro.and.returnValue(of(tx({ estado: 'CANCELADA', final: true })));
      void service.cobrar(INPUT, pos);
      flushMicrotasks();
      void service.cancelar();
      tick(2500);
      expect(repo.cancelarCobro).toHaveBeenCalledWith(7);
      expect(service.etapa()).toBe('fallido');
      expect(service.mensaje()).toBe('El cobro fue cancelado.');
    }));
  });

  describe('cobro local', () => {
    const pos: PosDisponible = { proveedor: TBK, config: config('TRANSBANK_POS_INTEGRADO') };
    const localTx = tx({ proveedor: 'TRANSBANK_POS_INTEGRADO', modo: 'local' });

    it('ejecuta la venta en el agente y reporta el resultado', async () => {
      const venta = { responseCode: 0, amount: 30000 };
      repo.iniciarCobro.and.returnValue(of(localTx));
      driver.cobrar.and.resolveTo(venta);
      repo.reportarResultado.and.returnValue(of({ ...localTx, estado: 'APROBADA', final: true, pagoId: 5 }));

      await service.cobrar(INPUT, pos);

      expect(driver.cobrar).toHaveBeenCalledWith(jasmine.objectContaining({
        monto: 30000, ticket: '7', parametros: { puerto: 'COM3' },
      }));
      expect(repo.reportarResultado).toHaveBeenCalledWith(7, venta);
      expect(service.etapa()).toBe('aprobado');
      expect(service.puedeCancelar()).toBeFalse();
    });

    it('cierra el cobro si el agente no responde', async () => {
      repo.iniciarCobro.and.returnValue(of(localTx));
      repo.cancelarCobro.and.returnValue(of({ ...localTx, estado: 'CANCELADA', final: true }));
      driver.cobrar.and.rejectWith(new Error('No se pudo conectar con el Agente POS'));

      expect(await service.cobrar(INPUT, pos)).toBeNull();

      expect(repo.cancelarCobro).toHaveBeenCalledWith(7);
      expect(service.etapa()).toBe('fallido');
      expect(service.mensaje()).toContain('Agente POS');
    });
  });
});
