import { Injectable } from '@nestjs/common';
import {
  PosDevice,
  PosIntegrationMode,
  PosProvider,
  PosTestResult,
} from '../../domain/pos-provider';

/**
 * Proveedor conocido cuya API de terminal integrado no es pública: se muestra
 * en el selector para que el comercio sepa que está contemplado, pero no se
 * puede activar hasta implementar su adaptador con la documentación oficial.
 */
abstract class ConvenioPendienteProvider implements PosProvider {
  abstract readonly code: string;
  abstract readonly nombre: string;
  abstract readonly descripcion: string;
  abstract readonly nota: string;
  abstract readonly etiquetas: string[];
  readonly modo: PosIntegrationMode = 'nube';
  readonly disponible = false;
  readonly soportaCobros = false;
  readonly campos = [];

  testConnection(): Promise<PosTestResult> {
    return Promise.resolve({ ok: false, mensaje: this.nota });
  }

  listDevices(): Promise<PosDevice[]> {
    return Promise.resolve([]);
  }
}

@Injectable()
export class GetnetPosProvider extends ConvenioPendienteProvider {
  readonly code = 'GETNET';
  readonly nombre = 'Getnet (Santander)';
  readonly descripcion = 'Terminales Getnet de Banco Santander.';
  readonly nota =
    'Getnet no publica la API de su POS integrado. Solicita a tu ejecutivo Getnet la documentación técnica y credenciales de integración para habilitarlo.';
  readonly etiquetas = ['santander', 'banco', 'getnet'];
}

@Injectable()
export class KlapPosProvider extends ConvenioPendienteProvider {
  readonly code = 'KLAP';
  readonly nombre = 'Klap';
  readonly descripcion = 'Terminales POS de Klap.';
  readonly nota =
    'Klap entrega la integración de sus terminales solo a partners. Solicita a Klap la documentación técnica y credenciales para habilitarlo.';
  readonly etiquetas = ['klap', 'multicaja', 'tap'];
}
