import { Injectable } from '@nestjs/common';
import {
  PosChargeSnapshot,
  PosConfigField,
  PosDevice,
  PosProvider,
  PosProviderError,
  PosTestResult,
} from '../../domain/pos-provider';

/** Campos de `SaleResponse` del SDK transbank-pos-sdk-web que usa HosPal. */
interface TransbankSaleResponse {
  responseCode: number;
  responseMessage?: string | null;
  authorizationCode?: string | null;
  amount?: number;
  operationNumber?: number | string;
  terminalId?: string;
  cardType?: string;
  cardBrand?: string;
  last4Digits?: number | null;
}

/**
 * Transbank POS Integrado.
 *
 * El terminal se conecta por USB/serial al PC de recepción, donde corre el
 * Agente POS de Transbank (https://localhost:8090). El navegador ejecuta la
 * venta con el SDK web y envía el resultado a HosPal, que lo normaliza aquí.
 */
@Injectable()
export class TransbankPosIntegradoProvider implements PosProvider {
  readonly code = 'TRANSBANK_POS_INTEGRADO';
  readonly nombre = 'Transbank POS Integrado';
  readonly descripcion =
    'Terminal Transbank conectado por USB al PC de recepción mediante el Agente POS.';
  readonly modo = 'local' as const;
  readonly disponible = true;
  readonly nota =
    'Instala el Agente POS de Transbank (github.com/TransbankDevelopers/transbank-pos-sdk-web-agent2) en el PC de recepción y deja el terminal en modo integrado. La conexión se prueba desde ese PC.';
  readonly etiquetas = ['tbk', 'redcompra', 'webpay', 'usb', 'serial'];
  readonly soportaCobros = true;
  readonly campos: PosConfigField[] = [
    {
      key: 'puerto',
      label: 'Puerto del terminal',
      type: 'device',
      required: false,
      placeholder: 'COM3 o /dev/ttyUSB0',
      ayuda:
        'Puerto USB/serial del terminal en el PC de recepción. Déjalo vacío para detectarlo automáticamente.',
    },
  ];

  /** La conexión vive en el PC de recepción: el servidor no la puede probar. */
  testConnection(): Promise<PosTestResult> {
    return Promise.resolve({
      ok: false,
      mensaje:
        'Este terminal se prueba desde el navegador del PC de recepción con el Agente POS.',
    });
  }

  listDevices(): Promise<PosDevice[]> {
    return Promise.resolve([]);
  }

  parseLocalResult(raw: unknown): PosChargeSnapshot {
    if (!raw || typeof raw !== 'object') {
      throw new PosProviderError('Resultado de Transbank inválido.');
    }
    const sale = raw as TransbankSaleResponse;
    if (typeof sale.responseCode !== 'number') {
      throw new PosProviderError(
        'Resultado de Transbank sin código de respuesta.',
      );
    }

    // Código 0 = transacción aprobada (tabla de respuestas de POS Integrado).
    const aprobada = sale.responseCode === 0;
    const operation =
      sale.operationNumber !== undefined && sale.operationNumber !== ''
        ? String(sale.operationNumber)
        : undefined;
    const mensaje = sale.responseMessage?.trim() || undefined;

    return {
      // Solo las ventas aprobadas tienen número de operación único.
      externalId:
        aprobada && operation
          ? `${sale.terminalId ?? 'TBK'}-${operation}`
          : undefined,
      estado: aprobada ? 'APROBADA' : 'RECHAZADA',
      estadoDetalle: `${sale.responseCode}${mensaje ? ` ${mensaje}` : ''}`,
      mensaje: aprobada
        ? undefined
        : (mensaje ??
          `Transbank rechazó la venta (código ${sale.responseCode}).`),
      montoCobrado: typeof sale.amount === 'number' ? sale.amount : undefined,
      tipoTarjeta: this.cardType(sale.cardType),
      raw: {
        responseCode: sale.responseCode,
        responseMessage: sale.responseMessage,
        authorizationCode: sale.authorizationCode,
        amount: sale.amount,
        operationNumber: sale.operationNumber,
        terminalId: sale.terminalId,
        cardType: sale.cardType,
        cardBrand: sale.cardBrand,
        last4Digits: sale.last4Digits,
      },
    };
  }

  private cardType(value?: string): 'CREDITO' | 'DEBITO' | undefined {
    const code = value?.trim().toUpperCase();
    if (code === 'CR') return 'CREDITO';
    if (code === 'DB' || code === 'PR') return 'DEBITO';
    return undefined;
  }
}
