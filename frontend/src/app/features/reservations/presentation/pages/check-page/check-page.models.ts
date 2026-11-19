import { MetodoPagoReserva, MetodoPagoTarjeta, SedeHabitacion } from '../../../../../shared/domain/hostal.model';
import { isRoomReadyForGuest } from '../../../domain/stay-schedule';
import { PosCobroService, PosDisponible } from '../../../../payments-pos/application/pos-cobro.service';

export interface GuestDraft {
  documentType: 'rut' | 'passport';
  documento: string;
  nombre: string;
  apellido: string;
  telefono: string;
  phoneCountry: string;
  email: string;
  nacionalidad: string;
}

export type PaymentMethod = MetodoPagoReserva;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transferencia: 'transferencia',
  efectivo: 'efectivo',
  debito: 'tarjeta de débito',
  credito: 'tarjeta de crédito',
};

export const isCardMethod = (method: PaymentMethod | ''): method is MetodoPagoTarjeta =>
  method === 'debito' || method === 'credito';

export interface ReservationQuote {
  nights: number;
  total: number;
  depositPercentage: number;
  deposit: number;
  typologyName: string;
  roomNumber: string;
  guestName: string;
}

/** Comprobante que se muestra tras cobrar una reserva nueva o el saldo del check-in. */
export interface PaymentReceipt {
  subtitle: string;
  guestName: string;
  roomNumber: string;
  typologyName: string;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  nights: number;
  personCount: number;
  total: number;
  /** Lo pagado antes de este cobro (abono de la reserva). */
  previouslyPaid?: number;
  paid: number;
  pending: number;
  methodLabel: string;
  reference: string;
  paidAt: Date;
  note?: string;
}

export interface CheckItemPlaceholder {
  id: number;
  guestName: string;
  initials: string;
  country: string;
  phone?: string;
  email?: string;
  roomNumber: string;
  roomType: string;
  dateRange: string;
  nights: number;
  scheduledTime: string;
  timeWindowLabel: string;
  statusBadge: string;
  avatarColor: 'green' | 'orange' | 'blue' | 'purple';
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  hasPaymentRecord: boolean;
  notes?: string;
  isVip?: boolean;
  /** Llegada o salida de un día anterior que sigue pendiente. */
  isOverdue?: boolean;
}

/** Resultado que un modal hijo devuelve a Recepción al terminar bien. */
export interface CheckModalResult {
  message: string;
  receipt?: PaymentReceipt;
}

/** Motivo por el que la habitación no puede recibir un huésped, o null si está libre. */
export function roomBlockedReason(rooms: SedeHabitacion[], roomNumber: string): string | null {
  const room = rooms.find((h) => String(h.numero).trim() === String(roomNumber).trim());
  if (isRoomReadyForGuest(room?.estado)) return null;
  return room?.estado === 'en aseo'
    ? `la habitación ${roomNumber} está en aseo`
    : `la habitación ${roomNumber} está ocupada`;
}

/** Envía el cobro con tarjeta al terminal; devuelve el tipo de tarjeta usado si quedó aprobado. */
export async function chargeWithPos(
  posCobro: PosCobroService,
  pos: PosDisponible | null,
  reservaId: number,
  monto: number,
  tipoOperacion: 'ABONO' | 'PAGO_FINAL',
  method: MetodoPagoTarjeta,
): Promise<MetodoPagoTarjeta | null> {
  if (!pos) return null;
  const tx = await posCobro.cobrar(
    { reservaId, monto, tipoOperacion, tipoTarjeta: method === 'debito' ? 'DEBITO' : 'CREDITO' },
    pos,
  );
  if (tx?.estado !== 'APROBADA' || !tx.pagoId) return null;
  // El terminal informa el tipo real de tarjeta usado.
  return tx.metodoPago === 'TARJETA_DEBITO' ? 'debito' : tx.metodoPago === 'TARJETA_CREDITO' ? 'credito' : method;
}
