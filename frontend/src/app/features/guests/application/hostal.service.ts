import { effect, Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Huesped, Habitacion, Tipologia, Reserva, GuestCardView } from '../../../shared/domain/hostal.model';
import { SedeService } from '../../locations/application/sede.service';

export interface RegisterEntryInput {
  guestId?: number;
  newGuest?: Omit<Huesped, 'id_huesped' | 'id_sede'>;
  roomId: number;
  personCount: number;
  arrivalDate: string;
  departureDate: string;
  arrivalTime: string;
  payment?: {
    totalAmount: number;
    paidAmount: number;
    depositPercentage: number;
    method: 'transferencia' | 'efectivo';
    paidInFull: boolean;
  };
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
  private guestsViewSubject = new BehaviorSubject<GuestCardView[]>([]);
  public guestsView$: Observable<GuestCardView[]> = this.guestsViewSubject.asObservable();

  private readonly sedeService = inject(SedeService);

  constructor() {
    this.initDatabase();
    effect(() => {
      const sede = this.sedeService.selectedSede();
      if (sede) this.onSedeChanged();
      else this.guestsViewSubject.next([]);
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

  private storageKey(entity: string): string {
    return `${this.BASE_PREFIX}sede_${this.sedeId}_${entity}`;
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  private initDatabase(): void {
    this.ensureSedeStorage();
    this.refreshView();
  }

  /**
   * Ensures the current sede has its storage entries initialized.
   * Called when sede changes to set up empty collections if needed.
   */
  ensureSedeStorage(): void {
    const sede = this.sedeService.selectedSede();
    if (!sede) return;

    for (const entity of ['huespedes', 'reservas']) {
      const key = `${this.BASE_PREFIX}sede_${sede.id}_${entity}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '[]');
      }
    }
  }

  /**
   * Called when the selected sede changes so the view
   * refreshes with the new sede's data.
   */
  onSedeChanged(): void {
    this.ensureSedeStorage();
    this.refreshView();
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
    const reservas = this.getReservations().filter((reservation) => {
      const room = habitaciones.find((item) => item.id_habitacion === reservation.id_habitacion);
      return reservation.estado_reserva !== 'FINALIZADA' &&
        huespedes.some((guest) => guest.id_huesped === reservation.id_huesped) &&
        !!room && tipologias.some((typology) => typology.id_tipologia === room.id_tipologia);
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const colors: ('blue' | 'green' | 'orange' | 'purple')[] = ['purple', 'orange', 'green', 'blue'];

    const joinedData: GuestCardView[] = reservas.map((res, index) => {
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
        cardColor: colors[index % colors.length],
        metric1Label: m1Label,
        metric1Value: m1Value,
        metric2Label: m2Label,
        metric2Value: m2Value,
        recurrentNote: recNote,
        isVip: huesped?.es_recurrente
      };
    });

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
        isVip: huesped.es_recurrente
      }));

    this.guestsViewSubject.next([...joinedData, ...guestsWithoutReservations]);
  }

  // ── Guest CRUD (scoped to active sede) ─────────────────────────────────────

  getGuests(): Huesped[] {
    return JSON.parse(localStorage.getItem(this.storageKey('huespedes')) || '[]') as Huesped[];
  }

  getReservations(): Reserva[] {
    return JSON.parse(localStorage.getItem(this.storageKey('reservas')) || '[]') as Reserva[];
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
        arrivalTime: reservation.hora_llegada ?? '',
        status: reservation.estado_reserva,
        totalAmount: reservation.precio_total ?? 0,
        amountPaid: reservation.monto_pagado ?? 0,
        hasPaymentRecord: reservation.precio_total !== undefined,
      });
    });

    return entries;
  }

  updateGuest(guestId: number, changes: Omit<Huesped, 'id_huesped' | 'id_sede'>): Huesped {
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

    const updatedGuests = guests.map((guest) => guest.id_huesped === guestId ? updatedGuest : guest);
    localStorage.setItem(this.storageKey('huespedes'), JSON.stringify(updatedGuests));
    this.refreshView();
    return updatedGuest;
  }

  deleteGuest(guestId: number): void {
    const guests = this.getGuests();
    if (!guests.some((guest) => guest.id_huesped === guestId)) {
      throw new Error('El huésped ya no está registrado. Actualiza la lista e inténtalo otra vez.');
    }

    const reservations = this.getReservations().filter((reservation) => reservation.id_huesped !== guestId);
    localStorage.setItem(this.storageKey('huespedes'), JSON.stringify(guests.filter((guest) => guest.id_huesped !== guestId)));
    localStorage.setItem(this.storageKey('reservas'), JSON.stringify(reservations));
    this.refreshView();
  }

  registerGuest(input: Omit<Huesped, 'id_huesped' | 'id_sede'>): Huesped {
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

    const nextGuestId = guests.reduce((max, item) => Math.max(max, item.id_huesped), 0) + 1;
    const guest: Huesped = { ...guestDetails, id_huesped: nextGuestId, id_sede: this.sedeId };
    localStorage.setItem(this.storageKey('huespedes'), JSON.stringify([...guests, guest]));
    this.refreshView();
    return guest;
  }

  // ── Reservation CRUD (scoped to active sede) ──────────────────────────────

  updateReservation(
    reservationId: number,
    changes: Pick<Reserva, 'id_habitacion' | 'fecha_llegada' | 'fecha_salida' | 'hora_llegada' | 'cantidad_personas'>
  ): Reserva {
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

    const updatedReservation: Reserva = { ...existingReservation, ...changes };
    localStorage.setItem(this.storageKey('reservas'), JSON.stringify(
      reservations.map((reservation) => reservation.id_reserva === reservationId ? updatedReservation : reservation)
    ));
    this.refreshView();
    return updatedReservation;
  }

  cancelReservation(reservationId: number): void {
    const reservations = this.getReservations();
    if (!reservations.some((reservation) => reservation.id_reserva === reservationId)) {
      throw new Error('La reserva ya no existe. Actualiza la lista e inténtalo otra vez.');
    }

    localStorage.setItem(this.storageKey('reservas'), JSON.stringify(
      reservations.filter((reservation) => reservation.id_reserva !== reservationId)
    ));
    this.refreshView();
  }

  processCheckIn(
    reservationId: number,
    paymentMethod?: 'transferencia' | 'efectivo'
  ): Reserva {
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

    const updatedReservation: Reserva = {
      ...reservation,
      estado_reserva: 'HOSPEDADO',
      ...(balance > 0 ? {
        monto_pagado: (reservation.monto_pagado ?? 0) + balance,
        metodo_pago: paymentMethod,
        pago_completo: true,
      } : {}),
    };
    this.persistReservationUpdate(reservations, updatedReservation);
    return updatedReservation;
  }

  processCheckOut(reservationId: number): Reserva {
    const reservations = this.getReservations();
    const reservation = reservations.find((item) => item.id_reserva === reservationId);
    if (!reservation) {
      throw new Error('La reserva ya no existe. Actualiza la lista e inténtalo otra vez.');
    }
    if (!['HOSPEDADO', 'CHECK-OUT HOY'].includes(reservation.estado_reserva)) {
      throw new Error('Esta reserva no está pendiente de check-out.');
    }

    const updatedReservation: Reserva = { ...reservation, estado_reserva: 'FINALIZADA' };
    this.persistReservationUpdate(reservations, updatedReservation);
    return updatedReservation;
  }

  private persistReservationUpdate(reservations: Reserva[], updatedReservation: Reserva): void {
    localStorage.setItem(this.storageKey('reservas'), JSON.stringify(
      reservations.map((reservation) =>
        reservation.id_reserva === updatedReservation.id_reserva ? updatedReservation : reservation
      )
    ));
    this.refreshView();
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
    const reservas: Reserva[] = JSON.parse(localStorage.getItem(this.storageKey('reservas')) || '[]');

    return habitacionesCandidatas.filter((habitacion) =>
      !reservas.some((reserva) =>
        reserva.id_reserva !== excludeReservationId &&
        reserva.estado_reserva !== 'FINALIZADA' &&
        reserva.id_habitacion === habitacion.id_habitacion &&
        arrivalDate < reserva.fecha_salida &&
        departureDate > reserva.fecha_llegada
      )
    );
  }

  registerEntry(input: RegisterEntryInput): { guest: Huesped; reservation: Reserva } {
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
    const reservations: Reserva[] = JSON.parse(localStorage.getItem(this.storageKey('reservas')) || '[]');
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
      const nextGuestId = guests.reduce((max, item) => Math.max(max, item.id_huesped), 0) + 1;
      guest = { ...guestDetails, id_huesped: nextGuestId, id_sede: this.sedeId };
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

    const nextReservationId = reservations.reduce((max, item) => Math.max(max, item.id_reserva), 0) + 1;
    const reservation: Reserva = {
      id_reserva: nextReservationId,
      id_huesped: guest.id_huesped,
      id_habitacion: room.id_habitacion,
      fecha_llegada: input.arrivalDate,
      fecha_salida: input.departureDate,
      hora_llegada: input.arrivalTime,
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

    localStorage.setItem(this.storageKey('huespedes'), JSON.stringify(updatedGuests));
    localStorage.setItem(this.storageKey('reservas'), JSON.stringify([...reservations, reservation]));
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