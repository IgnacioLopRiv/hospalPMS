/**
 * Contrato que cumple cada proveedor de terminales de pago (POS).
 *
 * Para agregar un proveedor nuevo basta con implementar esta interfaz y
 * registrarlo en `POS_PROVIDERS` (payments-pos.module.ts). El frontend arma
 * el formulario de configuración a partir de `campos`, así que no requiere
 * cambios de interfaz.
 */

export type PosFieldType = 'text' | 'secret' | 'boolean' | 'select' | 'device';

export interface PosConfigField {
  /** Clave con que se guarda el valor. */
  key: string;
  label: string;
  type: PosFieldType;
  required: boolean;
  placeholder?: string;
  ayuda?: string;
  /** Solo para `select`. */
  opciones?: { value: string; label: string }[];
}

/**
 * - `nube`: el backend llama a la API del proveedor (p. ej. Mercado Pago).
 * - `local`: el navegador de recepción habla con un agente instalado en el
 *   PC conectado al terminal (p. ej. Transbank) y reporta el resultado.
 */
export type PosIntegrationMode = 'nube' | 'local';

export interface PosProviderInfo {
  code: string;
  nombre: string;
  descripcion: string;
  modo: PosIntegrationMode;
  /** False si aún no se puede usar (p. ej. falta documentación del proveedor). */
  disponible: boolean;
  /** Explicación visible cuando no está disponible o requiere pasos extra. */
  nota?: string;
  /** Palabras extra para el buscador del selector. */
  etiquetas: string[];
  campos: PosConfigField[];
  /** False para proveedores sin integración (p. ej. MANUAL): no cobran con tarjeta. */
  soportaCobros: boolean;
}

/** Valores ya descifrados que recibe el proveedor. */
export interface PosProviderConfig {
  credenciales: Record<string, string>;
  parametros: Record<string, unknown>;
}

export interface PosTestResult {
  ok: boolean;
  mensaje: string;
  /** Datos de la cuenta (alias, país, etc.) para mostrar al usuario. */
  cuenta?: Record<string, string>;
}

export interface PosDevice {
  id: string;
  nombre: string;
  modoOperacion?: string;
  /** False cuando el dispositivo existe pero no está listo para cobros integrados. */
  disponible: boolean;
  detalle?: string;
}

/** Estado normalizado de un cobro (coincide con EstadoTransaccionPos). */
export type PosChargeStatus =
  | 'PENDIENTE'
  | 'EN_TERMINAL'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'CANCELADA'
  | 'EXPIRADA'
  | 'REEMBOLSADA';

export const FINAL_CHARGE_STATUSES: readonly string[] = [
  'APROBADA',
  'RECHAZADA',
  'CANCELADA',
  'EXPIRADA',
  'REEMBOLSADA',
  'ERROR',
];

export interface PosChargeRequest {
  /** Monto entero en la moneda de la cuenta (CLP no admite decimales). */
  monto: number;
  /** Referencia única de HosPal (máx. 64, solo letras, números, - y _). */
  referenciaExterna: string;
  descripcion: string;
  /** Clave estable para que reintentos no creen cobros duplicados. */
  idempotencyKey: string;
  /** Tarjeta elegida en recepción, para preseleccionarla en el terminal si se puede. */
  tipoTarjeta?: 'DEBITO' | 'CREDITO';
}

export interface PosChargeSnapshot {
  /** ID del cobro en el proveedor; puede faltar en cobros locales rechazados. */
  externalId?: string;
  /** Monto que informa el terminal, para contrastar con el solicitado. */
  montoCobrado?: number;
  /** Mensaje legible del proveedor (p. ej. motivo de rechazo). */
  mensaje?: string;
  estado: PosChargeStatus;
  estadoDetalle?: string;
  /** Tipo de tarjeta informado por el terminal, si ya se conoce. */
  tipoTarjeta?: 'CREDITO' | 'DEBITO';
  raw?: unknown;
}

export interface PosWebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  body: unknown;
}

export interface PosWebhookRef {
  externalId: string;
  /** Permite ubicar cobros cuya creación no alcanzó a confirmarse. */
  referenciaExterna?: string;
}

export interface PosProvider extends PosProviderInfo {
  testConnection(config: PosProviderConfig): Promise<PosTestResult>;
  listDevices(config: PosProviderConfig): Promise<PosDevice[]>;
  createCharge?(
    config: PosProviderConfig,
    request: PosChargeRequest,
  ): Promise<PosChargeSnapshot>;
  getCharge?(
    config: PosProviderConfig,
    externalId: string,
  ): Promise<PosChargeSnapshot>;
  cancelCharge?(
    config: PosProviderConfig,
    externalId: string,
    idempotencyKey: string,
  ): Promise<PosChargeSnapshot>;

  /**
   * Solo modo `local`: normaliza el resultado que el navegador obtuvo del
   * agente. Lanza PosProviderError si el formato no es válido.
   */
  parseLocalResult?(raw: unknown): PosChargeSnapshot;

  /** Cobro al que se refiere una notificación, o null si no aplica. */
  webhookChargeRef?(request: PosWebhookRequest): PosWebhookRef | null;
  /** Verifica la firma de la notificación con la configuración de la sede. */
  verifyWebhook?(
    request: PosWebhookRequest,
    config: PosProviderConfig,
  ): boolean;
}

/** Error esperado del proveedor (credenciales inválidas, API caída, etc.). */
export class PosProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PosProviderError';
  }
}

export const POS_PROVIDERS = Symbol('POS_PROVIDERS');
