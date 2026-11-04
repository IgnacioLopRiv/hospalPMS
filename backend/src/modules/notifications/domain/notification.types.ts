import { SupportedLocale } from './locale-resolver';

export type NotificationType =
  | 'CONFIRMACION_RESERVA'
  | 'COMPROBANTE_PAGO'
  | 'RECORDATORIO_PRE_LLEGADA'
  | 'RESUMEN_CHECKOUT';

export interface EmailRenderResult {
  subject: string;
  html_body: string;
  text_body: string;
}

export interface GuestNotificationData {
  nombreCompleto: string;
  email: string;
  telefono?: string | null;
  paisResidencia?: string | null;
}

export interface SedeNotificationData {
  nombre: string;
  ciudad: string;
  direccion: string;
  telefono?: string | null;
  email?: string | null;
  horaCheckIn?: string | null;
  horaCheckOut?: string | null;
  politicaCancelacion?: string | null;
  serviciosIncluidos?: string | null;
  urlEncuesta?: string | null;
  sitioWeb?: string | null;
  hostalNombre: string;
  hostalEmail?: string | null;
  hostalLogoUrl?: string | null;
}

export interface ReservationNotificationData {
  id: number;
  codigo: string;
  fechaCheckIn: Date;
  fechaCheckOut: Date;
  horaLlegada?: string | null;
  cantidadPersonas: number;
  noches: number;
  habitacionNumero: string;
  tipologiaNombre: string;
  precioTotal?: number | null;
  montoPagado?: number | null;
  saldoPendiente?: number | null;
  pagoCompleto: boolean;
}

export interface PaymentNotificationData {
  id: number;
  referencia: string;
  monto: number;
  metodoPago: string;
  tipoOperacion: string;
  fechaPago: Date;
  documentoTipo?: string | null;
  documentoFolio?: number | null;
}

export interface BaseNotificationPayload {
  guest: GuestNotificationData;
  sede: SedeNotificationData;
  reservation: ReservationNotificationData;
  locale?: SupportedLocale;
}

export interface PaymentReceiptPayload extends BaseNotificationPayload {
  payment: PaymentNotificationData;
}
