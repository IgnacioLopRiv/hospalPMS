export interface Huesped {
  id_huesped: number;
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
  estado_reserva: 'HOSPEDADO' | 'CHECK-IN HOY' | 'CHECK-OUT HOY' | 'CONFIRMADA';
}

export interface GuestCardView {
  id_reserva: number;
  initials: string;
  guestName: string;
  country: string;
  roomNumber: string;
  roomType: string;
  dateRange: string;
  status: 'hospedado' | 'checkin_hoy' | 'checkout_hoy';
  statusBadge: string;
  cardColor: 'blue' | 'green' | 'orange' | 'purple';
  metric1Label: string;
  metric1Value: string;
  metric2Label: string;
  metric2Value: string;
  recurrentNote?: string;
  isVip?: boolean;
}

export const ROOM_TYPES = ['Individual', 'Doble', 'Triple', 'Suite', 'Familiar'] as const;
export type RoomType = (typeof ROOM_TYPES)[number] | string;

export interface SedeTipologia {
  id: number;
  nombre: string;
  capacidad: number;
  precioBase?: number;
  descripcion?: string;
}

export interface SedeHabitacion {
  id: number;
  numero: string;
  tipo: string;
  tipologiaId?: number;
  tamanoM2: number | null;
  disposicionMuebles: string;
}

export interface Sede {
  id: number;
  nombre: string;
  ciudad: string;
  tipologias?: SedeTipologia[];
  habitaciones: SedeHabitacion[];
}