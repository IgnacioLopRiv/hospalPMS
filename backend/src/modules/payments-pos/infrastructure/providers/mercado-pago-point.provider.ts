import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  PosChargeRequest,
  PosChargeSnapshot,
  PosChargeStatus,
  PosConfigField,
  PosDevice,
  PosProvider,
  PosProviderConfig,
  PosProviderError,
  PosTestResult,
  PosWebhookRef,
  PosWebhookRequest,
} from '../../domain/pos-provider';

const API_BASE = 'https://api.mercadopago.com';
const TIMEOUT_MS = 10_000;
/** Tiempo que el terminal espera la tarjeta antes de expirar el cobro. */
const ORDER_EXPIRATION = 'PT10M';

interface MpUser {
  id?: number;
  nickname?: string;
  site_id?: string;
}

interface MpTerminal {
  id: string;
  pos_id?: number;
  store_id?: string;
  external_pos_id?: string;
  operating_mode?: string;
}

interface MpOrder {
  id: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transactions?: {
    payments?: {
      id?: string;
      status?: string;
      status_detail?: string;
      payment_method?: { id?: string; type?: string };
    }[];
  };
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
}

/** Estados de orden de la Orders API → estado normalizado de HosPal. */
const ORDER_STATUS: Record<string, PosChargeStatus> = {
  created: 'PENDIENTE',
  at_terminal: 'EN_TERMINAL',
  action_required: 'EN_TERMINAL',
  processed: 'APROBADA',
  failed: 'RECHAZADA',
  canceled: 'CANCELADA',
  expired: 'EXPIRADA',
  refunded: 'REEMBOLSADA',
};

/**
 * Adaptador para terminales Mercado Pago Point (Point Smart), usando la
 * Orders API (`/v1/orders` con `type: "point"`). El terminal debe estar en
 * modo PDV para recibir cobros desde HosPal.
 */
@Injectable()
export class MercadoPagoPointProvider implements PosProvider {
  readonly code = 'MERCADO_PAGO_POINT';
  readonly nombre = 'Mercado Pago Point';
  readonly descripcion =
    'Cobra con un terminal Point Smart de Mercado Pago vinculado a la cuenta del hostal.';
  readonly modo = 'nube' as const;
  readonly disponible = true;
  readonly etiquetas = ['mercadolibre', 'mercado libre', 'point smart', 'mp'];
  readonly soportaCobros = true;
  readonly campos: PosConfigField[] = [
    {
      key: 'accessToken',
      label: 'Access Token',
      type: 'secret',
      required: true,
      placeholder: 'APP_USR-…',
      ayuda:
        'Se obtiene en Mercado Pago Developers → Tus integraciones → Credenciales de producción.',
    },
    {
      key: 'deviceId',
      label: 'Terminal',
      type: 'device',
      required: true,
      ayuda:
        'El terminal debe estar en modo PDV para recibir cobros desde HosPal.',
    },
    {
      key: 'webhookSecret',
      label: 'Clave secreta de webhooks',
      type: 'secret',
      required: false,
      ayuda:
        'Opcional. En Tus integraciones → Webhooks, configura la URL <API>/pos/webhooks/MERCADO_PAGO_POINT con el evento "Order (Mercado Pago)" y pega aquí la clave secreta. Sin webhooks, HosPal consulta el estado periódicamente.',
    },
  ];

  /** Reemplazable en tests. */
  fetchFn: typeof fetch = (input: string | URL | Request, init?: RequestInit) =>
    fetch(input, init);

  // ── Conexión ──────────────────────────────────────────────────────────────

  async testConnection(config: PosProviderConfig): Promise<PosTestResult> {
    const user = await this.request<MpUser>('/users/me', config);
    const cuenta: Record<string, string> = {};
    if (user.nickname) cuenta['Cuenta'] = user.nickname;
    if (user.id) cuenta['ID usuario'] = String(user.id);
    if (user.site_id) cuenta['País'] = user.site_id;
    return {
      ok: true,
      mensaje: 'Conexión exitosa con Mercado Pago.',
      cuenta,
    };
  }

  async listDevices(config: PosProviderConfig): Promise<PosDevice[]> {
    let terminals: MpTerminal[];
    try {
      const response = await this.request<{
        data?: { terminals?: MpTerminal[] };
      }>('/terminals/v1/list?limit=50', config);
      terminals = response.data?.terminals ?? [];
    } catch (error) {
      // Cuentas que aún usan la API de integración anterior.
      if (!(error instanceof PosProviderError) || error.status !== 404) {
        throw error;
      }
      const legacy = await this.request<{ devices?: MpTerminal[] }>(
        '/point/integration-api/devices',
        config,
      );
      terminals = legacy.devices ?? [];
    }

    return terminals.map((terminal) => {
      const pdv = terminal.operating_mode === 'PDV';
      return {
        id: terminal.id,
        nombre: terminal.external_pos_id
          ? `${terminal.id} (${terminal.external_pos_id})`
          : terminal.id,
        modoOperacion: terminal.operating_mode,
        disponible: pdv,
        detalle: pdv
          ? undefined
          : 'El terminal no está en modo PDV. Actívalo desde la app de Mercado Pago o la API.',
      };
    });
  }

  // ── Cobros ────────────────────────────────────────────────────────────────

  async createCharge(
    config: PosProviderConfig,
    request: PosChargeRequest,
  ): Promise<PosChargeSnapshot> {
    const terminalId = this.asString(config.parametros['deviceId']);
    if (!terminalId) {
      throw new PosProviderError('No hay un terminal configurado.');
    }
    const order = await this.request<MpOrder>('/v1/orders', config, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': request.idempotencyKey },
      body: {
        type: 'point',
        external_reference: request.referenciaExterna,
        expiration_time: ORDER_EXPIRATION,
        description: request.descripcion.slice(0, 150),
        transactions: {
          payments: [{ amount: String(request.monto) }],
        },
        config: {
          point: { terminal_id: terminalId },
          // Preselecciona el tipo de tarjeta en el terminal.
          ...(request.tipoTarjeta
            ? {
                payment_method: {
                  default_type:
                    request.tipoTarjeta === 'DEBITO'
                      ? 'debit_card'
                      : 'credit_card',
                },
              }
            : {}),
        },
      },
    });
    return this.toSnapshot(order);
  }

  async getCharge(
    config: PosProviderConfig,
    externalId: string,
  ): Promise<PosChargeSnapshot> {
    const order = await this.request<MpOrder>(
      `/v1/orders/${encodeURIComponent(externalId)}`,
      config,
    );
    return this.toSnapshot(order);
  }

  async cancelCharge(
    config: PosProviderConfig,
    externalId: string,
    idempotencyKey: string,
  ): Promise<PosChargeSnapshot> {
    try {
      await this.request<unknown>(
        `/v1/orders/${encodeURIComponent(externalId)}/cancel`,
        config,
        {
          method: 'POST',
          headers: {
            'X-Idempotency-Key': idempotencyKey,
            // Permite cancelar también cuando el terminal ya tomó la orden.
            'x-allow-cancelable-status': 'at_terminal',
          },
        },
      );
    } catch (error) {
      if (error instanceof PosProviderError && error.status === 409) {
        throw new PosProviderError(
          'Mercado Pago no permite cancelar el cobro en su estado actual. Cancélalo desde el terminal.',
          409,
        );
      }
      throw error;
    }
    // Una cancelación con el terminal ocupado es asíncrona (HTTP 202): se
    // devuelve el estado real y el webhook o la consulta confirmarán el final.
    return this.getCharge(config, externalId);
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  webhookChargeRef(request: PosWebhookRequest): PosWebhookRef | null {
    const body = (request.body ?? {}) as {
      type?: string;
      data?: { id?: unknown; external_reference?: unknown };
    };
    const type = this.queryValue(request.query, 'type') ?? body.type;
    if (type && type !== 'order') return null;
    const externalId =
      this.queryValue(request.query, 'data.id') ?? this.asString(body.data?.id);
    if (!externalId) return null;
    return {
      externalId,
      referenciaExterna: this.asString(body.data?.external_reference),
    };
  }

  /**
   * Valida la cabecera `x-signature` (HMAC-SHA256 del manifiesto
   * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`). Sin clave secreta
   * configurada no se puede validar y se acepta: el estado se consulta
   * siempre a la API, así que una notificación falsa solo fuerza una consulta.
   */
  verifyWebhook(request: PosWebhookRequest, config: PosProviderConfig) {
    const secret = config.credenciales['webhookSecret'];
    if (!secret) return true;

    const signature = this.header(request.headers, 'x-signature');
    if (!signature) return false;
    const parts = Object.fromEntries(
      signature.split(',').map((part) => {
        const [key, ...rest] = part.trim().split('=');
        return [key, rest.join('=')];
      }),
    );
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    const dataId = this.queryValue(request.query, 'data.id');
    const requestId = this.header(request.headers, 'x-request-id');
    let manifest = '';
    if (dataId) manifest += `id:${dataId.toLowerCase()};`;
    if (requestId) manifest += `request-id:${requestId};`;
    manifest += `ts:${ts};`;

    const expected = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(v1);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // ── Utilidades ────────────────────────────────────────────────────────────

  private toSnapshot(order: MpOrder): PosChargeSnapshot {
    if (!order?.id) {
      throw new PosProviderError('Mercado Pago devolvió una orden inválida.');
    }
    const payment = order.transactions?.payments?.[0];
    const cardType = payment?.payment_method?.type;
    return {
      externalId: order.id,
      estado: ORDER_STATUS[order.status ?? ''] ?? 'PENDIENTE',
      estadoDetalle: payment?.status_detail ?? order.status_detail,
      tipoTarjeta:
        cardType === 'credit_card'
          ? 'CREDITO'
          : cardType === 'debit_card' || cardType === 'prepaid_card'
            ? 'DEBITO'
            : undefined,
      raw: order,
    };
  }

  private async request<T>(
    path: string,
    config: PosProviderConfig,
    options: RequestOptions = {},
  ): Promise<T> {
    const token = config.credenciales['accessToken']?.trim();
    if (!token) {
      throw new PosProviderError('Falta el Access Token de Mercado Pago.');
    }

    let response: Response;
    try {
      response = await this.fetchFn(`${API_BASE}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...options.headers,
        },
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new PosProviderError(
        'No se pudo conectar con Mercado Pago. Revisa la conexión a internet.',
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new PosProviderError(
        'Mercado Pago rechazó el Access Token. Verifica que sea válido y de producción.',
        response.status,
      );
    }
    if (!response.ok) {
      const detail = await this.errorDetail(response);
      throw new PosProviderError(
        `Mercado Pago respondió con error ${response.status}${detail ? `: ${detail}` : ''}.`,
        response.status,
      );
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  private async errorDetail(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as {
        message?: string;
        errors?: { message?: string }[];
      };
      return body.errors?.[0]?.message ?? body.message ?? '';
    } catch {
      return '';
    }
  }

  private header(
    headers: PosWebhookRequest['headers'],
    name: string,
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  /** Lee `a.b` tanto con el parser de query simple como con el extendido. */
  private queryValue(query: Record<string, unknown>, key: string) {
    const direct = this.asString(query[key]);
    if (direct) return direct;
    const [head, tail] = key.split('.');
    if (!tail) return undefined;
    const nested = query[head];
    if (nested && typeof nested === 'object') {
      return this.asString((nested as Record<string, unknown>)[tail]);
    }
    return undefined;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
