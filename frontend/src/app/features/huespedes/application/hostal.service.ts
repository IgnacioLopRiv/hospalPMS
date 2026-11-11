import { effect, Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { Huesped, Habitacion, Tipologia, Reserva, GuestCardView, GuestReservationDetail } from '../../../shared/domain/hostal.model';
import { SedeService } from '../../locations/application/sede.service';
import { CreateHuesped, Huesped as HuespedDomain, HuespedRepository } from '../domain/huesped.repository';
import { CreateReserva, ReservasRepository, UpdateReserva } from '../../reservations/domain/reservas.repository';

export interface RegisterEntryInput {
  guestId?: number;
  newGuest?: Omit<Huesped, 'id_huesped' | 'id_sede'>;
  roomId: number;
  personCount: number;
  arrivalDate: string;
  departureDate: string;
  arrivalTime: string;
  departureTime?: string;
  payment?: {
    totalAmount: number;
    paidAmount: number;
    depositPercentage: number;
    method: 'transferencia' | 'efectivo';
    paidInFull: boolean;
  };
}

/** Mensaje legible de un error: el que envía el backend (HttpErrorResponse) o el de un Error. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  const apiMessage = (error as { error?: { message?: unknown } } | null)?.error?.message;
  if (Array.isArray(apiMessage)) return apiMessage.join(' ');
  return typeof apiMessage === 'string' && apiMessage ? apiMessage : fallback;
}

/**
 * La reserva falló después de crear al huésped nuevo. El huésped ya existe en el
 * backend, así que se devuelve para reintentar con él en vez de volver a crearlo.
 */
export class EntryReservationError extends Error {
  constructor(message: string, readonly guest: Huesped) {
    super(message);
  }
}

export interface ReservationCalendarEntry {
  id: number;
  guestName: string;
  country: string;
  phone: string;
  email: string;
  isVip: boolean;
  roomNumber: string;
  roomType: string;
  arrivalDate: string;
  departureDate: string;
  arrivalTime: string;
  departureTime: string;
  status: Reserva['estado_reserva'];
  totalAmount: number;
  amountPaid: number;
  hasPaymentRecord: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class HostalService {
  private readonly BASE_PREFIX = 'hospal_db_';
  private readonly huespedRepository = inject(HuespedRepository);
  private readonly reservasRepository = inject(ReservasRepository);
  private guestsViewSubject = new BehaviorSubject<GuestCardView[]>([]);
  public guestsView$: Observable<GuestCardView[]> = this.guestsViewSubject.asObservable();

  private readonly sedeService = inject(SedeService);
  private guests: Huesped[] = [];
  private reservations: Reserva[] = [];
  private loadedSedeId: number | null = null;
  private loadingSede: { id: number; promise: Promise<void> } | null = null;
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.sedeService.ready
      .then(() => this.loadForSelectedSede())
      .catch(() => this.guestsViewSubject.next([]));
    effect(() => {
      const sede = this.sedeService.selectedSede();
      if (!sede) {
        this.guests = [];
        this.reservations = [];
        this.loadedSedeId = null;
        this.guestsViewSubject.next([]);
      } else if (sede.id !== this.loadedSedeId) {
        void this.loadForSelectedSede(sede.id).catch(() => this.guestsViewSubject.next([]));
      }
    });
  }

  // ── Sede-scoped storage key ────────────────────────────────────────────────

  private get sedeId(): number {
    const sede = this.sedeService.selectedSede();
    if (!sede) {
      throw new Error('No hay sede seleccionada. Selecciona una sede antes de continuar.');
    }
    return sede.id;
  }

  private loadForSelectedSede(sedeId = this.sedeService.selectedSede()?.id): Promise<void> {
    if (!sedeId) return Promise.resolve();
    if (this.loadedSedeId === sedeId) return Promise.resolve();
    if (this.loadingSede?.id === sedeId) return this.loadingSede.promise;

    const promise = Promise.all([
      firstValueFrom(this.huespedRepository.list(sedeId)),
      firstValueFrom(this.reservasRepository.listBySede(sedeId)),
    ]).then(([guests, reservations]) => {
      if (this.sedeService.selectedSede()?.id !== sedeId) return;
      this.guests = guests.map((guest) => this.fromDomainHuesped(guest, guest.sedeId || sedeId));
      this.reservations = reservations.map((reservation) => this.normalizeReservation(reservation));
      this.loadedSedeId = sedeId;
      this.refreshView();
    }).finally(() => {
      if (this.loadingSede?.id === sedeId) this.loadingSede = null;
    });
    this.loadingSede = { id: sedeId, promise };
    return promise;
  }

  private normalizeReservation(reservation: Reserva): Reserva {
    const today = this.localDateKey(new Date());
    if (reservation.estado_reserva === 'CONFIRMADA' && reservation.fecha_llegada === today) {
      return { ...reservation, estado_reserva: 'CHECK-IN HOY' };
    }
    if (reservation.estado_reserva === 'HOSPEDADO' && reservation.fecha_salida === today) {
      return { ...reservation, estado_reserva: 'CHECK-OUT HOY' };
    }
    return reservation;
  }

  private localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onSedeChanged(): void {
    void this.loadForSelectedSede().catch(() => this.guestsViewSubject.next([]));
  }

  // ── View projection ────────────────────────────────────────────────────────

  public refreshView(): void {
    const sede = this.sedeService.selectedSede();
    if (!sede) {
      this.guestsViewSubject.next([]);
      return;
    }

    const huespedes = this.getGuests();
    const habitaciones = this.getManagedRooms();
    const tipologias = this.getManagedTypologies();
    // Most relevant reservation first, so each guest's card shows it as the main one.
    const statusPriority: Record<Reserva['estado_reserva'], number> = {
      'HOSPEDADO': 0, 'CHECK-OUT HOY': 1, 'CHECK-IN HOY': 2, 'CONFIRMADA': 3, 'FINALIZADA': 4, 'CANCELADA': 5,
    };
    const reservas = this.getReservations().filter((reservation) => {
      const room = habitaciones.find((item) => item.id_habitacion === reservation.id_habitacion);
      return !['FINALIZADA', 'CANCELADA'].includes(reservation.estado_reserva) &&
        huespedes.some((guest) => guest.id_huesped === reservation.id_huesped) &&
        !!room && tipologias.some((typology) => typology.id_tipologia === room.id_tipologia);
    }).sort((a, b) =>
      statusPriority[a.estado_reserva] - statusPriority[b.estado_reserva] ||
      a.fecha_llegada.localeCompare(b.fecha_llegada)
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const colors: ('blue' | 'green' | 'orange' | 'purple')[] = ['purple', 'orange', 'green', 'blue'];

    const reservationCards: GuestCardView[] = reservas.map((res) => {
      const huesped = huespedes.find(h => h.id_huesped === res.id_huesped);
      const habitacion = habitaciones.find(hab => hab.id_habitacion === res.id_habitacion);
      const tipologia = tipologias.find(t => t.id_tipologia === habitacion?.id_tipologia);

      const fLlegada = new Date(res.fecha_llegada + 'T00:00:00');
      const fSalida = new Date(res.fecha_salida + 'T00:00:00');

      const totalNoches = Math.round((fSalida.getTime() - fLlegada.getTime()) / (1000 * 3600 * 24));
      const nochesTranscurridas = Math.max(0, Math.round((today.getTime() - fLlegada.getTime()) / (1000 * 3600 * 24)));
      const nochesRestantes = Math.max(0, Math.round((fSalida.getTime() - today.getTime()) / (1000 * 3600 * 24)));

      let statusType: 'hospedado' | 'checkin_hoy' | 'checkout_hoy' | 'confirmada' = 'hospedado';
      let m1Label = 'Lleva';
      let m1Value = `${nochesTranscurridas} ${nochesTranscurridas === 1 ? 'noche' : 'noches'}`;
      let m2Label = 'Sale en';
      let m2Value = `${nochesRestantes} ${nochesRestantes === 1 ? 'noche' : 'noches'}`;

      if (res.estado_reserva === 'CONFIRMADA') {
        statusType = 'confirmada';
        m1Label = 'Llegada programada';
        m1Value = `${String(fLlegada.getDate()).padStart(2, '0')}/${String(fLlegada.getMonth() + 1).padStart(2, '0')}`;
        m2Label = 'Horario';
        m2Value = res.hora_llegada ?? 'Por confirmar';
      } else if (res.estado_reserva === 'CHECK-IN HOY') {
        statusType = 'checkin_hoy';
        m1Label = 'Duración';
        m1Value = `${totalNoches} noches`;
        m2Label = 'Sale el';
        m2Value = `${String(fSalida.getMonth() + 1).padStart(2, '0')}/${String(fSalida.getDate()).padStart(2, '0')}`;
      } else if (res.estado_reserva === 'CHECK-OUT HOY') {
        statusType = 'checkout_hoy';
        m1Label = 'Total estadía';
        m1Value = `${totalNoches} noches`;
        m2Label = 'Entró el';
        m2Value = `${String(fLlegada.getMonth() + 1).padStart(2, '0')}/${String(fLlegada.getDate()).padStart(2, '0')}`;
      }

      const recNote = huesped?.dias_ultimo_registro
        ? `Recurrente · último hace ${huesped.dias_ultimo_registro} días`
        : (huesped?.es_recurrente && statusType === 'checkout_hoy' ? 'Huésped recurrente' : undefined);

      return {
        id_reserva: res.id_reserva,
        id_huesped: huesped?.id_huesped ?? res.id_huesped,
        hasReservation: true,
        initials: huesped ? `${huesped.nombre[0]}${huesped.apellido[0]}`.toUpperCase() : 'NA',
        guestName: huesped ? `${huesped.nombre} ${huesped.apellido}` : 'Desconocido',
        country: huesped?.nacionalidad || '',
        roomNumber: habitacion?.numero_habitacion || '',
        roomType: tipologia?.nombre_tipologia || '',
        dateRange: `${String(fLlegada.getMonth() + 1).padStart(2, '0')}/${String(fLlegada.getDate()).padStart(2, '0')} → ${String(fSalida.getMonth() + 1).padStart(2, '0')}/${String(fSalida.getDate()).padStart(2, '0')}`,
        status: statusType,
        statusBadge: res.estado_reserva,
        cardColor: 'blue',
        metric1Label: m1Label,
        metric1Value: m1Value,
        metric2Label: m2Label,
        metric2Value: m2Value,
        recurrentNote: recNote,
        isVip: huesped?.es_recurrente,
        phone: huesped?.telefono
      };
    });

    // One card per guest: keep the first (most relevant) reservation and count the rest.
    const cardsByGuest = new Map<number, GuestCardView>();
    reservationCards.forEach((card) => {
      const existing = cardsByGuest.get(card.id_huesped);
      if (existing) {
        existing.extraReservations = (existing.extraReservations ?? 0) + 1;
        existing.statuses = [...(existing.statuses ?? []), card.status];
      } else {
        cardsByGuest.set(card.id_huesped, { ...card, extraReservations: 0, statuses: [card.status] });
      }
    });
    const joinedData = [...cardsByGuest.values()].map((card, index) => ({
      ...card,
      cardColor: colors[index % colors.length],
    }));

    const guestsWithoutReservations: GuestCardView[] = huespedes
      .filter(huesped => !reservas.some(reserva => reserva.id_huesped === huesped.id_huesped))
      .map((huesped, index) => ({
        id_huesped: huesped.id_huesped,
        hasReservation: false,
        initials: `${huesped.nombre[0]}${huesped.apellido[0]}`.toUpperCase(),
        guestName: `${huesped.nombre} ${huesped.apellido}`,
        country: huesped.nacionalidad,
        roomNumber: '',
        roomType: 'Sin habitación asignada',
        dateRange: 'Sin reserva asignada',
        status: 'inactivo',
        statusBadge: 'INACTIVO',
        cardColor: colors[(joinedData.length + index) % colors.length],
        metric1Label: 'Reserva',
        metric1Value: 'No asignada',
        metric2Label: 'Estado',
        metric2Value: 'Inactivo',
        recurrentNote: huesped.dias_ultimo_registro
          ? `Recurrente · último hace ${huesped.dias_ultimo_registro} días`
          : undefined,
        isVip: huesped.es_recurrente,
        phone: huesped.telefono
      }));

    this.guestsViewSubject.next([...joinedData, ...guestsWithoutReservations]);
  }

  /** All reservations of a guest (active and past), sorted by arrival date. */
  getGuestReservationDetails(guestId: number): GuestReservationDetail[] {
    const rooms = this.getManagedRooms();
    const typologies = this.getManagedTypologies();
    return this.getReservations()
      .filter((reservation) => reservation.id_huesped === guestId)
      .sort((a, b) => a.fecha_llegada.localeCompare(b.fecha_llegada))
      .map((reservation) => {
        const room = rooms.find((item) => item.id_habitacion === reservation.id_habitacion);
        const typology = typologies.find((item) => item.id_tipologia === room?.id_tipologia);
        const arrival = new Date(reservation.fecha_llegada + 'T00:00:00');
        const departure = new Date(reservation.fecha_salida + 'T00:00:00');
        return {
          reservation,
          roomNumber: room?.numero_habitacion ?? '',
          roomType: typology?.nombre_tipologia ?? '',
          nights: Math.max(0, Math.round((departure.getTime() - arrival.getTime()) / (1000 * 3600 * 24))),
        };
      });
  }

  // ── Guest CRUD (scoped to active sede) ─────────────────────────────────────

  getGuests(): Huesped[] {
    return this.guests;
  }

  getReservations(): Reserva[] {
    return this.reservations;
  }

  getReservationCalendarData(): ReservationCalendarEntry[] {
    const guests = this.getGuests();
    const rooms = this.getManagedRooms();
    const typologies = this.getManagedTypologies();

    const entries: ReservationCalendarEntry[] = [];
    this.getReservations().forEach((reservation) => {
      const guest = guests.find((item) => item.id_huesped === reservation.id_huesped);
      const room = rooms.find((item) => item.id_habitacion === reservation.id_habitacion);
      if (!guest || !room || !this.isValidDate(reservation.fecha_llegada) ||
        !this.isValidDate(reservation.fecha_salida) ||
        reservation.fecha_llegada >= reservation.fecha_salida) {
        return;
      }

      const typology = typologies.find((item) => item.id_tipologia === room.id_tipologia);
      if (!typology) return;
      entries.push({
        id: reservation.id_reserva,
        guestName: `${guest.nombre} ${guest.apellido}`,
        country: guest.nacionalidad,
        phone: guest.telefono,
        email: guest.email,
        isVip: guest.es_recurrente ?? false,
        roomNumber: room.numero_habitacion,
        roomType: typology?.nombre_tipologia ?? '',
        arrivalDate: reservation.fecha_llegada,
        departureDate: reservation.fecha_salida,
        arrivalTime: reservation.hora_llegada ?? '14:00',
        departureTime: reservation.hora_salida ?? '12:00',
        status: reservation.estado_reserva,
        totalAmount: reservation.precio_total ?? 0,
        amountPaid: reservation.monto_pagado ?? 0,
        hasPaymentRecord: reservation.precio_total !== undefined,
      });
    });

    return entries;
  }

  async updateGuest(guestId: number, changes: Omit<Huesped, 'id_huesped' | 'id_sede'>): Promise<Huesped> {
    const guests = this.getGuests();
    const existingGuest = guests.find((guest) => guest.id_huesped === guestId);
    if (!existingGuest) {
      throw new Error('El huésped ya no está registrado. Actualiza la lista e inténtalo otra vez.');
    }

    const updatedGuest: Huesped = {
      ...existingGuest,
      ...changes,
      id_sede: existingGuest.id_sede,
      documento: changes.documento?.trim().toUpperCase(),
      nombre: changes.nombre.trim(),
      apellido: changes.apellido.trim(),
      telefono: changes.telefono.trim(),
      email: changes.email.trim(),
      nacionalidad: changes.nacionalidad.trim(),
    };
    if (!updatedGuest.nombre || !updatedGuest.apellido ||
      !updatedGuest.telefono || !updatedGuest.email || !updatedGuest.nacionalidad) {
      throw new Error('Completa todos los datos del huésped.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatedGuest.email)) {
      throw new Error('Ingresa un email válido.');
    }
    if (updatedGuest.documento && guests.some((guest) =>
      guest.id_huesped !== guestId &&
      this.normalizeDocument(guest.documento ?? '') === this.normalizeDocument(updatedGuest.documento ?? '')
    )) {
      throw new Error('Ya existe un huésped registrado con ese RUT o número de pasaporte.');
    }

    const response = await firstValueFrom(this.huespedRepository.update(
      guestId, this.toDomainHuespedInput(updatedGuest), this.sedeId
    ));
    const savedGuest = this.fromDomainHuesped(response, existingGuest.id_sede);
    this.guests = guests.map((guest) => guest.id_huesped === guestId ? savedGuest : guest);
    this.refreshView();
    return savedGuest;
  }

  async deleteGuest(guestId: number): Promise<void> {
    const guests = this.getGuests();
    if (!guests.some((guest) => guest.id_huesped === guestId)) {
      throw new Error('El huésped ya no está registrado. Actualiza la lista e inténtalo otra vez.');
    }

    await firstValueFrom(this.huespedRepository.remove(guestId, this.sedeId));
    this.guests = guests.filter((guest) => guest.id_huesped !== guestId);
    this.reservations = this.getReservations().filter((reservation) => reservation.id_huesped !== guestId);
    this.refreshView();
  }

  async registerGuest(input: Omit<Huesped, 'id_huesped' | 'id_sede'>): Promise<Huesped> {
    const document = input.documento?.trim().toUpperCase();
    const guestDetails = {
      ...input,
      documento: document,
      nombre: input.nombre.trim(),
      apellido: input.apellido.trim(),
      telefono: input.telefono.trim(),
      email: input.email.trim(),
      nacionalidad: input.nacionalidad.trim(),
    };
    if (!guestDetails.documento || !guestDetails.nombre || !guestDetails.apellido ||
      !guestDetails.telefono || !guestDetails.email || !guestDetails.nacionalidad) {
      throw new Error('Completa todos los datos del huésped antes de registrarlo.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestDetails.email)) {
      throw new Error('Ingresa un email válido.');
    }

    const guests = this.getGuests();
    if (guests.some((item) =>
      this.normalizeDocument(item.documento ?? '') === this.normalizeDocument(guestDetails.documento ?? '')
    )) {
      throw new Error('Ya existe un huésped registrado con ese RUT o número de pasaporte.');
    }

    const response = await firstValueFrom(this.huespedRepository.create(this.toDomainHuespedInput(guestDetails)));
    const guest = this.fromDomainHuesped(response, this.sedeId);
    this.guests = [...guests, guest];
    this.refreshView();
    return guest;
  }

  // ── Reservation CRUD (scoped to active sede) ──────────────────────────────

  async updateReservation(
    reservationId: number,
    changes: Pick<Reserva, 'id_habitacion' | 'fecha_llegada' | 'fecha_salida' | 'hora_llegada' | 'cantidad_personas'> & { hora_salida?: string }
  ): Promise<Reserva> {
    const reservations = this.getReservations();
    const existingReservation = reservations.find((reservation) => reservation.id_reserva === reservationId);
    if (!existingReservation) {
      throw new Error('La reserva ya no existe. Actualiza la lista e inténtalo otra vez.');
    }
    if (!Number.isInteger(changes.cantidad_personas) || (changes.cantidad_personas ?? 0) < 1) {
      throw new Error('La cantidad de personas debe ser al menos 1.');
    }
    if (!this.isValidDate(changes.fecha_llegada) || !this.isValidDate(changes.fecha_salida) ||
      changes.fecha_llegada >= changes.fecha_salida) {
      throw new Error('La fecha de salida debe ser posterior a la fecha de llegada.');
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(changes.hora_llegada ?? '')) {
      throw new Error('Ingresa un horario de llegada válido.');
    }
    if (changes.hora_salida && !/^([01]\d|2[0-3]):[0-5]\d$/.test(changes.hora_salida)) {
      throw new Error('Ingresa un horario de salida válido.');
    }

    const rooms = this.getManagedRooms();
    const room = rooms.find((item) => item.id_habitacion === changes.id_habitacion);
    if (!room || !this.getAvailableRooms(
      changes.fecha_llegada,
      changes.fecha_salida,
      undefined,
      reservationId
    ).some((available) => available.id_habitacion === changes.id_habitacion)) {
      throw new Error('La habitación seleccionada no está disponible para esas fechas.');
    }

    const tipologias = this.getManagedTypologies();
    const roomCapacity = tipologias.find((tipologia) => tipologia.id_tipologia === room.id_tipologia)?.capacidad ?? 0;
    if ((changes.cantidad_personas ?? 0) > roomCapacity) {
      throw new Error('La cantidad de personas supera la capacidad de la habitación seleccionada.');
    }

    const updatedReservation = await firstValueFrom(this.reservasRepository.update(reservationId, changes, this.sedeId));
    this.reservations = reservations.map((reservation) =>
      reservation.id_reserva === reservationId ? this.normalizeReservation(updatedReservation) : reservation
    );
    this.refreshView();
    return this.normalizeReservation(updatedReservation);
  }

  async cancelReservation(reservationId: number): Promise<void> {
    const reservations = this.getReservations();
    const reservation = reservations.find((item) => item.id_reserva === reservationId);
    if (!reservation) {
      throw new Error('La reserva ya no existe. Actualiza la lista e inténtalo otra vez.');
    }
    if (reservation.estado_reserva === 'FINALIZADA') {
      throw new Error('Una reserva finalizada no puede cancelarse.');
    }
    if (reservation.estado_reserva === 'CANCELADA') {
      return;
    }

    const saved = await firstValueFrom(this.reservasRepository.update(
      reservationId,
      { ...reservation, estado_reserva: 'CANCELADA' } as UpdateReserva,
      this.sedeId,
    ));
    this.reservations = reservations.map((item) =>
      item.id_reserva === reservationId ? this.normalizeReservation(saved) : item
    );
    this.refreshView();
  }

  async processCheckIn(
    reservationId: number,
    paymentMethod?: 'transferencia' | 'efectivo'
  ): Promise<Reserva> {
    const reservations = this.getReservations();
    const reservation = reservations.find((item) => item.id_reserva === reservationId);
    if (!reservation) {
      throw new Error('La reserva ya no existe. Actualiza la lista e inténtalo otra vez.');
    }
    if (!['CONFIRMADA', 'CHECK-IN HOY'].includes(reservation.estado_reserva)) {
      throw new Error('Esta reserva ya no está pendiente de check-in.');
    }

    const balance = Math.max(0, (reservation.precio_total ?? 0) - (reservation.monto_pagado ?? 0));
    if (balance > 0 && paymentMethod !== 'transferencia' && paymentMethod !== 'efectivo') {
      throw new Error('Selecciona transferencia o efectivo para cobrar el saldo pendiente.');
    }

    return this.persistReservationUpdate(reservations, {
      ...reservation,
      estado_reserva: 'HOSPEDADO',
      ...(balance > 0 ? {
        monto_pagado: (reservation.monto_pagado ?? 0) + balance,
        metodo_pago: paymentMethod,
        pago_completo: true,
      } : {}),
    });
  }

  async processCheckOut(reservationId: number): Promise<Reserva> {
    const reservations = this.getReservations();
    const reservation = reservations.find((item) => item.id_reserva === reservationId);
    if (!reservation) {
      throw new Error('La reserva ya no existe. Actualiza la lista e inténtalo otra vez.');
    }
    if (!['HOSPEDADO', 'CHECK-OUT HOY'].includes(reservation.estado_reserva)) {
      throw new Error('Esta reserva no está pendiente de check-out.');
    }

    return this.persistReservationUpdate(reservations, { ...reservation, estado_reserva: 'FINALIZADA' });
  }

  private async persistReservationUpdate(reservations: Reserva[], updatedReservation: Reserva): Promise<Reserva> {
    const saved = await firstValueFrom(this.reservasRepository.update(
      updatedReservation.id_reserva, updatedReservation as UpdateReserva, this.sedeId
    ));
    const normalized = this.normalizeReservation(saved);
    this.reservations = reservations.map((reservation) =>
      reservation.id_reserva === normalized.id_reserva ? normalized : reservation
    );
    this.refreshView();
    return normalized;
  }

  getAvailableRooms(
    arrivalDate: string,
    departureDate: string,
    personCount?: number,
    excludeReservationId?: number
  ): Habitacion[] {
    if (!this.isValidDate(arrivalDate) || !this.isValidDate(departureDate) || arrivalDate >= departureDate) {
      return [];
    }

    const tipologias = this.getManagedTypologies();
    const habitacionesCandidatas = this.getManagedRooms().filter((habitacion) =>
      personCount === undefined ||
      (tipologias.find((tipologia) => tipologia.id_tipologia === habitacion.id_tipologia)?.capacidad ?? 0) >= personCount
    );
    const reservas = this.getReservations();

      return habitacionesCandidatas.filter((habitacion) =>
      !reservas.some((reserva) =>
        reserva.id_reserva !== excludeReservationId &&
        !['FINALIZADA', 'CANCELADA'].includes(reserva.estado_reserva) &&
        reserva.id_habitacion === habitacion.id_habitacion &&
        arrivalDate < reserva.fecha_salida &&
        departureDate > reserva.fecha_llegada
      )
    );
  }

  async registerEntry(input: RegisterEntryInput): Promise<{ guest: Huesped; reservation: Reserva }> {
    if (!Number.isInteger(input.personCount) || input.personCount < 1) {
      throw new Error('La cantidad de personas debe ser al menos 1.');
    }
    if (input.payment && (
      !Number.isFinite(input.payment.totalAmount) ||
      input.payment.totalAmount < 0 ||
      !Number.isFinite(input.payment.paidAmount) ||
      input.payment.paidAmount < 0 ||
      input.payment.paidAmount > input.payment.totalAmount ||
      !Number.isFinite(input.payment.depositPercentage) ||
      input.payment.depositPercentage < 1 ||
      input.payment.depositPercentage > 100 ||
      !['transferencia', 'efectivo'].includes(input.payment.method) ||
      (input.payment.paidInFull && input.payment.paidAmount !== input.payment.totalAmount) ||
      (!input.payment.paidInFull &&
        input.payment.paidAmount !== Math.round(input.payment.totalAmount * input.payment.depositPercentage / 100))
    )) {
      throw new Error('Los datos del pago no son válidos.');
    }
    if (!this.isValidDate(input.arrivalDate) || !this.isValidDate(input.departureDate) ||
      input.arrivalDate >= input.departureDate) {
      throw new Error('La fecha de salida debe ser posterior a la fecha de llegada.');
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.arrivalTime)) {
      throw new Error('Ingresa un horario de llegada válido.');
    }

    const guests = this.getGuests();
    const rooms = this.getManagedRooms();
    const tipologias = this.getManagedTypologies();
    const reservations = this.getReservations();
    let guest: Huesped;
    let updatedGuests = guests;

    if (input.guestId !== undefined) {
      const registeredGuest = guests.find((item) => item.id_huesped === input.guestId);
      if (!registeredGuest) {
        throw new Error('El huésped seleccionado ya no está registrado. Actualiza la lista e inténtalo otra vez.');
      }
      guest = registeredGuest;
    } else if (input.newGuest) {
      const document = input.newGuest.documento?.trim().toUpperCase();
      const guestDetails = {
        ...input.newGuest,
        documento: document,
        nombre: input.newGuest.nombre.trim(),
        apellido: input.newGuest.apellido.trim(),
        telefono: input.newGuest.telefono.trim(),
        email: input.newGuest.email.trim(),
        nacionalidad: input.newGuest.nacionalidad.trim(),
      };
      if (!guestDetails.documento || !guestDetails.nombre || !guestDetails.apellido ||
        !guestDetails.telefono || !guestDetails.email || !guestDetails.nacionalidad) {
        throw new Error('Completa todos los datos del huésped antes de registrar el ingreso.');
      }
      if (document && guests.some((item) =>
        this.normalizeDocument(item.documento ?? '') === this.normalizeDocument(document)
      )) {
        throw new Error('Ya existe un huésped registrado con ese RUT o número de pasaporte.');
      }
      guest = { ...guestDetails, id_huesped: 0, id_sede: this.sedeId };
      updatedGuests = [...guests, guest];
    } else {
      throw new Error('Selecciona un huésped o ingresa sus datos.');
    }

    const room = rooms.find((item) => item.id_habitacion === input.roomId);
    if (!room || !this.getAvailableRooms(input.arrivalDate, input.departureDate)
      .some((available) => available.id_habitacion === input.roomId)) {
      throw new Error('La habitación seleccionada no está disponible para esas fechas.');
    }
    const roomCapacity = tipologias.find((tipologia) => tipologia.id_tipologia === room.id_tipologia)?.capacidad ?? 0;
    if (input.personCount > roomCapacity) {
      throw new Error('La cantidad de personas supera la capacidad de la habitación seleccionada.');
    }

    if (input.newGuest) {
      const response = await firstValueFrom(this.huespedRepository.create(this.toDomainHuespedInput(guest)));
      guest = this.fromDomainHuesped(response, this.sedeId);
      updatedGuests = [...guests, guest];
    }

    const reservationInput: CreateReserva = {
      id_huesped: guest.id_huesped,
      id_habitacion: room.id_habitacion,
      fecha_llegada: input.arrivalDate,
      fecha_salida: input.departureDate,
      hora_llegada: input.arrivalTime,
      hora_salida: input.departureTime ?? '12:00',
      cantidad_personas: input.personCount,
      estado_reserva: 'CONFIRMADA',
      ...(input.payment ? {
        precio_total: input.payment.totalAmount,
        porcentaje_abono: input.payment.depositPercentage,
        monto_pagado: input.payment.paidAmount,
        metodo_pago: input.payment.method,
        pago_completo: input.payment.paidInFull,
      } : {}),
    };
    let savedReservation: Reserva;
    try {
      savedReservation = await firstValueFrom(this.reservasRepository.create(reservationInput));
    } catch (error) {
      if (!input.newGuest) throw error;
      this.guests = updatedGuests;
      this.refreshView();
      throw new EntryReservationError(
        `${getApiErrorMessage(error, 'No se pudo registrar la reserva.')} ` +
        `El huésped ${guest.nombre} ${guest.apellido} ya quedó registrado: corrige los datos y vuelve a confirmar.`,
        guest,
      );
    }
    const reservation = this.normalizeReservation(savedReservation);
    this.guests = updatedGuests;
    this.reservations = [...reservations, reservation];
    this.refreshView();

    return { guest, reservation };
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  /**
   * Clears all old (non-sede-scoped) test data from localStorage.
   * Call once to migrate away from the legacy global storage.
   */
  clearLegacyData(): void {
    const legacyKeys = ['huespedes', 'habitaciones', 'reservas', 'tipologias'];
    for (const key of legacyKeys) {
      localStorage.removeItem(`${this.BASE_PREFIX}${key}`);
    }
  }

  private fromDomainHuesped(guest: HuespedDomain, sedeId: number): Huesped {
    return {
      id_huesped: guest.id,
      id_sede: sedeId,
      documento: guest.rutPasaporte,
      nombre: guest.nombres,
      apellido: guest.apellidos,
      nacionalidad: guest.paisResidencia,
      telefono: guest.telefono,
      email: guest.email,
      es_recurrente: guest.esRecurrente,
      dias_ultimo_registro: guest.diasUltimoRegistro,
    };
  }

  private toDomainHuespedInput(guest: Partial<Huesped>): CreateHuesped {
    return {
      sedeId: guest.id_sede ?? this.sedeId,
      rutPasaporte: guest.documento?.trim().toUpperCase() ?? '',
      nombres: guest.nombre?.trim() ?? '',
      apellidos: guest.apellido?.trim() ?? '',
      paisResidencia: guest.nacionalidad?.trim() ?? '',
      telefono: guest.telefono?.trim() ?? '',
      email: guest.email?.trim() ?? '',
      esRecurrente: guest.es_recurrente,
      diasUltimoRegistro: guest.dias_ultimo_registro,
    };
  }

  private isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00`);
    const [year, month, day] = value.split('-').map(Number);
    return !Number.isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() + 1 === month &&
      date.getDate() === day;
  }

  private normalizeDocument(value: string): string {
    return value.replace(/[.\s-]/g, '').toUpperCase();
  }

  private getManagedTypologies(): Tipologia[] {
    return this.sedeService.tipologias().map((typology) => ({
      id_tipologia: typology.id,
      nombre_tipologia: typology.nombre,
      capacidad: typology.capacidad,
      precio_noche: typology.precioBase,
    }));
  }

  private getManagedRooms(): Habitacion[] {
    const sede = this.sedeService.selectedSede();
    if (!sede) return [];

    const typologies = this.getManagedTypologies();
    const rooms: Habitacion[] = [];
    this.sedeService.habitaciones().forEach((room) => {
      const typology = typologies.find((item) => item.id_tipologia === room.tipologiaId) ??
        typologies.find((item) =>
          item.nombre_tipologia.toLocaleLowerCase() === room.tipo.toLocaleLowerCase()
        );
      if (!typology) return;
      rooms.push({
        id_habitacion: room.id,
        numero_habitacion: room.numero,
        id_hostal: sede.id,
        id_tipologia: typology.id_tipologia,
        estado: room.estado,
      });
    });
    return rooms;
  }
}