/** Débito y crédito se cobran en el terminal POS de la sede. */
export type MetodoPagoReserva = 'transferencia' | 'efectivo' | 'debito' | 'credito';
export type MetodoPagoTarjeta = 'debito' | 'credito';

export interface Huesped {
  id_huesped: number;
  id_sede: number;
  documento?: string;
  nombre: string;
  apellido: string;
  nacionalidad: string;
  telefono: string;
  email: string;
  es_recurrente?: boolean;
  dias_ultimo_registro?: number;
}

export interface Tipologia {
  id_tipologia: number;
  nombre_tipologia: string;
  capacidad: number;
  precio_noche?: number;
}

export interface Habitacion {
  id_habitacion: number;
  numero_habitacion: string;
  id_hostal: number;
  id_tipologia: number;
  estado?: string;
}

export interface Reserva {
  id_reserva: number;
  id_huesped: number;
  id_habitacion: number;
  fecha_llegada: string;
  fecha_salida: string;
  hora_llegada?: string;
  hora_salida?: string;
  cantidad_personas?: number;
  estado_reserva: 'HOSPEDADO' | 'CHECK-IN HOY' | 'CHECK-OUT HOY' | 'CONFIRMADA' | 'FINALIZADA' | 'CANCELADA';
  precio_total?: number;
  porcentaje_abono?: number;
  monto_pagado?: number;
  metodo_pago?: MetodoPagoReserva;
  pago_completo?: boolean;
}

export interface GuestCardView {
  id_reserva?: number;
  id_huesped: number;
  hasReservation: boolean;
  initials: string;
  guestName: string;
  country: string;
  roomNumber: string;
  roomType: string;
  dateRange: string;
  status: 'hospedado' | 'checkin_hoy' | 'checkout_hoy' | 'confirmada' | 'inactivo';
  statusBadge: string;
  cardColor: 'blue' | 'green' | 'orange' | 'purple';
  metric1Label: string;
  metric1Value: string;
  metric2Label: string;
  metric2Value: string;
  recurrentNote?: string;
  isVip?: boolean;
  /** Teléfono del huésped, usado para abrir WhatsApp. */
  phone?: string;
  /** Reservas activas adicionales a la que muestra la tarjeta. */
  extraReservations?: number;
  /** Estados de todas las reservas activas del huésped (para los filtros). */
  statuses?: GuestCardView['status'][];
}

export interface GuestReservationDetail {
  reservation: Reserva;
  roomNumber: string;
  roomType: string;
  nights: number;
}

export interface SedeTipologia {
  id: number;
  nombre: string;
  capacidad: number;
  color?: string;
  precioBase?: number;
  descripcion?: string;
}

export type EstadoHabitacion = 'libre' | 'ocupada' | 'en aseo';

export interface SedeInventarioItem {
  id: number;
  nombre: string;
  cantidad: number;
  observaciones?: string;
}

export interface SedeHabitacion {
  id: number;
  numero: string;
  tipo: string;
  tipologiaId?: number;
  tamanoM2: number | null;
  disposicionMuebles: string;
  descripcion?: string;
  inventario?: SedeInventarioItem[];
  estado?: EstadoHabitacion;
  huespedActual?: string;
  aseoIniciado?: number;
}

export interface Sede {
  id: number;
  nombre: string;
  ciudad: string;
  email?: string | null;
  horaCheckIn?: string;
  horaCheckOut?: string;
  tipologias?: SedeTipologia[];
  habitaciones: SedeHabitacion[];
}