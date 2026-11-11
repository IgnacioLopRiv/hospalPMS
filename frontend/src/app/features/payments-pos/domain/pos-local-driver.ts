import { InjectionToken } from '@angular/core';
import { PosDevice, PosTestResult } from './pos.repository';

export interface PosLocalChargeRequest {
  monto: number;
  /** Identificador del cobro en HosPal (se imprime en el voucher). */
  ticket: string;
  parametros: Record<string, unknown>;
  /** Mensajes intermedios del terminal ("Inserte tarjeta", etc.). */
  onEstado?: (mensaje: string) => void;
}

/**
 * Conector que corre en el navegador de recepción para proveedores en modo
 * `local` (el terminal está conectado al PC mediante un agente del proveedor).
 * Su `code` coincide con el del proveedor en el backend.
 */
export interface PosLocalDriver {
  readonly code: string;
  testConnection(parametros: Record<string, unknown>): Promise<PosTestResult>;
  listDevices(): Promise<PosDevice[]>;
  /** Ejecuta la venta y devuelve la respuesta cruda del agente para el backend. */
  cobrar(request: PosLocalChargeRequest): Promise<unknown>;
}

export const POS_LOCAL_DRIVERS = new InjectionToken<PosLocalDriver[]>('POS_LOCAL_DRIVERS');
