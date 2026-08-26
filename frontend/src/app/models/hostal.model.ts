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