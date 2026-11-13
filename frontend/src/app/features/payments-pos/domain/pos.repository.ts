import { Observable } from 'rxjs';

export type PosFieldType = 'text' | 'secret' | 'boolean' | 'select' | 'device';

/** Campo de configuración declarado por cada proveedor en el backend. */
export interface PosConfigField {
  key: string;
  label: string;
  type: PosFieldType;
  required: boolean;
  placeholder?: string;
  ayuda?: string;
  opciones?: { value: string; label: string }[];
}

/**
 * - `nube`: HosPal (backend) llama a la API del proveedor.
 * - `local`: este navegador habla con un agente instalado en el PC de recepción.
 */
export type PosIntegrationMode = 'nube' | 'local';

export interface PosProviderInfo {
  code: string;
  nombre: string;
  descripcion: string;
  modo: PosIntegrationMode;
  /** False si aún no se puede usar (p. ej. requiere convenio con el proveedor). */
  disponible: boolean;
  nota?: string;
  /** Palabras extra para el buscador. */
  etiquetas: string[];
  campos: PosConfigField[];
  /** False para proveedores sin integración: no permiten cobrar con tarjeta. */
  soportaCobros: boolean;
}

export interface PosConfig {
  sedeId: number;
  configurado: boolean;
  proveedor: string | null;
  activo: boolean;
  parametros: Record<string, unknown>;
  /** Secretos guardados, enmascarados por el backend. */
  credenciales: Record<string, string>;
  actualizadoAt: string | null;
  advertencia?: string;
}

export interface PosConfigInput {
  proveedor: string;
  activo?: boolean;
  /** Secretos nuevos; vacío = mantener el guardado. */
  credenciales?: Record<string, string>;
  parametros?: Record<string, unknown>;
}

export interface PosTestResult {
  ok: boolean;
  mensaje: string;
  cuenta?: Record<string, string>;
}

export interface PosDevice {
  id: string;
  nombre: string;
  modoOperacion?: string;
  disponible: boolean;
  detalle?: string;
}

export type EstadoTransaccionPos =
  | 'PENDIENTE'
  | 'EN_TERMINAL'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'CANCELADA'
  | 'EXPIRADA'
  | 'REEMBOLSADA'
  | 'ERROR';

export type TipoTarjeta = 'DEBITO' | 'CREDITO';

export interface IniciarCobroInput {
  reservaId: number;
  monto: number;
  tipoOperacion: 'ABONO' | 'PAGO_FINAL' | 'PAGO_SERVICIO_ADICIONAL';
  tipoTarjeta?: TipoTarjeta;
}

/** Cobro enviado a un terminal POS. */
export interface TransaccionPos {
  id: number;
  reservaId: number;
  proveedor: string;
  monto: number;
  estado: EstadoTransaccionPos;
  estadoDetalle: string | null;
  metodoPago: 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | null;
  mensaje: string | null;
  pagoId: number | null;
  /** Referencia enviada al proveedor (p. ej. HOSPAL-R18-T8). */
  externalReference?: string | null;
  /** True cuando ya no cambiará de estado. */
  final: boolean;
  /** 'local': este navegador debe ejecutar el cobro con el agente del proveedor. */
  modo: PosIntegrationMode;
}

export abstract class PosRepository {
  abstract listProviders(): Observable<PosProviderInfo[]>;
  abstract getConfig(sedeId: number): Observable<PosConfig>;
  abstract saveConfig(sedeId: number, input: PosConfigInput): Observable<PosConfig>;
  abstract testConnection(sedeId: number, input: PosConfigInput): Observable<PosTestResult>;
  abstract listDevices(sedeId: number, input: PosConfigInput): Observable<PosDevice[]>;

  abstract iniciarCobro(input: IniciarCobroInput): Observable<TransaccionPos>;
  /** Consulta el cobro; el backend lo sincroniza con el proveedor si no terminó. */
  abstract obtenerCobro(id: number): Observable<TransaccionPos>;
  abstract cancelarCobro(id: number): Observable<TransaccionPos>;
  /** Envía al backend la respuesta del agente local (modo 'local'). */
  abstract reportarResultado(id: number, resultado: unknown): Observable<TransaccionPos>;
}
