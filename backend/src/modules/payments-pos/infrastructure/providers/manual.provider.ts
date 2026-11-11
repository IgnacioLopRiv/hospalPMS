import { Injectable } from '@nestjs/common';
import {
  PosDevice,
  PosProvider,
  PosTestResult,
} from '../../domain/pos-provider';

/**
 * Sin integración: el cobro se hace en un terminal no conectado y el
 * recepcionista registra el pago a mano.
 */
@Injectable()
export class ManualPosProvider implements PosProvider {
  readonly code = 'MANUAL';
  readonly nombre = 'Manual (sin integración)';
  readonly descripcion =
    'El cobro se hace en un terminal no conectado y el pago se registra a mano en HosPal.';
  readonly modo = 'nube' as const;
  readonly disponible = true;
  readonly etiquetas = ['sin integración', 'efectivo', 'otro'];
  readonly campos = [];
  readonly soportaCobros = false;

  testConnection(): Promise<PosTestResult> {
    return Promise.resolve({
      ok: true,
      mensaje: 'El modo manual no requiere conexión.',
    });
  }

  listDevices(): Promise<PosDevice[]> {
    return Promise.resolve([]);
  }
}
