import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Huesped, Habitacion, Tipologia, Reserva, GuestCardView } from '../../../shared/domain/hostal.model';

export interface RegisterEntryInput {
  guestId?: number;
  newGuest?: Omit<Huesped, 'id_huesped'>;
  roomId: number;
  personCount: number;
  arrivalDate: string;
  departureDate: string;
  arrivalTime: string;
}

@Injectable({
  providedIn: 'root'
})
export class HostalService {
  private readonly PREFIX = 'hospal_db_';
  private guestsViewSubject = new BehaviorSubject<GuestCardView[]>([]);
  public guestsView$: Observable<GuestCardView[]> = this.guestsViewSubject.asObservable();

  private readonly TODAY = new Date('2026-06-16T00:00:00');

  constructor() {
    this.initDatabase();
  }

  private initDatabase(): void {
    if (!localStorage.getItem(this.PREFIX + 'huespedes')) {
      const tipologias: Tipologia[] = [
        { id_tipologia: 1, nombre_tipologia: 'Habitación Privada', capacidad: 2 },
        { id_tipologia: 2, nombre_tipologia: 'Dorm 4-camas', capacidad: 4 },
        { id_tipologia: 3, nombre_tipologia: 'Dorm 6-camas', capacidad: 6 },
        { id_tipologia: 4, nombre_tipologia: 'Dorm 8-camas', capacidad: 8 },
      ];

      const habitaciones: Habitacion[] = [
        { id_habitacion: 1, numero_habitacion: '101', id_hostal: 1, id_tipologia: 1 },
        { id_habitacion: 2, numero_habitacion: '102', id_hostal: 1, id_tipologia: 1 },
        { id_habitacion: 3, numero_habitacion: '104', id_hostal: 1, id_tipologia: 1 },
        { id_habitacion: 4, numero_habitacion: '204', id_hostal: 1, id_tipologia: 3 },
        { id_habitacion: 5, numero_habitacion: '205', id_hostal: 1, id_tipologia: 3 },
        { id_habitacion: 6, numero_habitacion: '207', id_hostal: 1, id_tipologia: 4 },
        { id_habitacion: 7, numero_habitacion: '306', id_hostal: 1, id_tipologia: 2 },
        { id_habitacion: 8, numero_habitacion: '308', id_hostal: 1, id_tipologia: 2 },
      ];

      const huespedes: Huesped[] = [
        { id_huesped: 1, nombre: 'Valentin', apellido: 'Torres', nacionalidad: 'Argentina', telefono: '+549110000', email: 'v@test.com', es_recurrente: true },
        { id_huesped: 2, nombre: 'Marco', apellido: 'Diaz', nacionalidad: 'Colombia', telefono: '+573000000', email: 'm@test.com' },
        { id_huesped: 3, nombre: 'Alejandro', apellido: 'Schmidt', nacionalidad: 'Alemania', telefono: '+491500000', email: 'a@test.com', es_recurrente: true },
        { id_huesped: 4, nombre: 'Luca', apellido: 'Ferrari', nacionalidad: 'Italia', telefono: '+393300000', email: 'l@test.com' },
        { id_huesped: 5, nombre: 'Priya', apellido: 'Nair', nacionalidad: 'India', telefono: '+919800000', email: 'p@test.com', es_recurrente: true, dias_ultimo_registro: 45 },
        { id_huesped: 6, nombre: 'James', apellido: 'Okonkwo', nacionalidad: 'Nigeria', telefono: '+234800000', email: 'j@test.com' },
        { id_huesped: 7, nombre: 'Sofia', apellido: 'Martínez', nacionalidad: 'México', telefono: '+525500000', email: 's@test.com' },
        { id_huesped: 8, nombre: 'Ethan', apellido: 'Brown', nacionalidad: 'EE.UU.', telefono: '+155500000', email: 'e@test.com', es_recurrente: true, dias_ultimo_registro: 120 },
      ];

      const reservas: Reserva[] = [
        { id_reserva: 1, id_huesped: 1, id_habitacion: 4, fecha_llegada: '2026-06-14', fecha_salida: '2026-06-19', estado_reserva: 'HOSPEDADO' },
        { id_reserva: 2, id_huesped: 2, id_habitacion: 1, fecha_llegada: '2026-06-16', fecha_salida: '2026-06-20', estado_reserva: 'CHECK-IN HOY' },
        { id_reserva: 3, id_huesped: 3, id_habitacion: 8, fecha_llegada: '2026-06-12', fecha_salida: '2026-06-16', estado_reserva: 'CHECK-OUT HOY' },
        { id_reserva: 4, id_huesped: 4, id_habitacion: 5, fecha_llegada: '2026-06-15', fecha_salida: '2026-06-22', estado_reserva: 'HOSPEDADO' },
        { id_reserva: 5, id_huesped: 5, id_habitacion: 2, fecha_llegada: '2026-06-16', fecha_salida: '2026-06-18', estado_reserva: 'CHECK-IN HOY' },
        { id_reserva: 6, id_huesped: 6, id_habitacion: 6, fecha_llegada: '2026-06-13', fecha_salida: '2026-06-16', estado_reserva: 'CHECK-OUT HOY' },
        { id_reserva: 7, id_huesped: 7, id_habitacion: 7, fecha_llegada: '2026-06-11', fecha_salida: '2026-06-18', estado_reserva: 'HOSPEDADO' },
        { id_reserva: 8, id_huesped: 8, id_habitacion: 3, fecha_llegada: '2026-06-16', fecha_salida: '2026-06-21', estado_reserva: 'CHECK-IN HOY' },
      ];

      localStorage.setItem(this.PREFIX + 'tipologias', JSON.stringify(tipologias));
      localStorage.setItem(this.PREFIX + 'habitaciones', JSON.stringify(habitaciones));
      localStorage.setItem(this.PREFIX + 'huespedes', JSON.stringify(huespedes));
      localStorage.setItem(this.PREFIX + 'reservas', JSON.stringify(reservas));
    }

    this.refreshView();
  }

  public refreshView(): void {
    const huespedes: Huesped[] = JSON.parse(localStorage.getItem(this.PREFIX + 'huespedes') || '[]');
    const habitaciones: Habitacion[] = JSON.parse(localStorage.getItem(this.PREFIX + 'habitaciones') || '[]');
    const tipologias: Tipologia[] = JSON.parse(localStorage.getItem(this.PREFIX + 'tipologias') || '[]');
    const reservas = this.getReservations();

    const colors: ('blue' | 'green' | 'orange' | 'purple')[] = ['purple', 'orange', 'green', 'blue'];

    const joinedData: GuestCardView[] = reservas.map((res, index) => {
      const huesped = huespedes.find(h => h.id_huesped === res.id_huesped);
      const habitacion = habitaciones.find(hab => hab.id_habitacion === res.id_habitacion);
      const tipologia = tipologias.find(t => t.id_tipologia === habitacion?.id_tipologia);

      const fLlegada = new Date(res.fecha_llegada + 'T00:00:00');
      const fSalida = new Date(res.fecha_salida + 'T00:00:00');

      const totalNoches = Math.round((fSalida.getTime() - fLlegada.getTime()) / (1000 * 3600 * 24));
      const nochesTranscurridas = Math.max(0, Math.round((this.TODAY.getTime() - fLlegada.getTime()) / (1000 * 3600 * 24)));
      const nochesRestantes = Math.max(0, Math.round((fSalida.getTime() - this.TODAY.getTime()) / (1000 * 3600 * 24)));

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

  getGuests(): Huesped[] {
    return JSON.parse(localStorage.getItem(this.PREFIX + 'huespedes') || '[]') as Huesped[];
  }

  getReservations(): Reserva[] {
    return JSON.parse(localStorage.getItem(this.PREFIX + 'reservas') || '[]') as Reserva[];
  }

  updateGuest(guestId: number, changes: Omit<Huesped, 'id_huesped'>): Huesped {
    const guests = this.getGuests();
    const existingGuest = guests.find((guest) => guest.id_huesped === guestId);
    if (!existingGuest) {
      throw new Error('El huésped ya no está registrado. Actualiza la lista e inténtalo otra vez.');
    }

    const updatedGuest: Huesped = {
      ...existingGuest,
      ...changes,
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
    localStorage.setItem(this.PREFIX + 'huespedes', JSON.stringify(updatedGuests));
    this.refreshView();
    return updatedGuest;
  }

  deleteGuest(guestId: number): void {
    const guests = this.getGuests();
    if (!guests.some((guest) => guest.id_huesped === guestId)) {
      throw new Error('El huésped ya no está registrado. Actualiza la lista e inténtalo otra vez.');
    }

    const reservations = this.getReservations().filter((reservation) => reservation.id_huesped !== guestId);
    localStorage.setItem(this.PREFIX + 'huespedes', JSON.stringify(guests.filter((guest) => guest.id_huesped !== guestId)));
    localStorage.setItem(this.PREFIX + 'reservas', JSON.stringify(reservations));
    this.refreshView();
  }

  registerGuest(input: Omit<Huesped, 'id_huesped'>): Huesped {
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
    const guest: Huesped = { ...guestDetails, id_huesped: nextGuestId };
    localStorage.setItem(this.PREFIX + 'huespedes', JSON.stringify([...guests, guest]));
    this.refreshView();
    return guest;
  }

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

    const rooms: Habitacion[] = JSON.parse(localStorage.getItem(this.PREFIX + 'habitaciones') || '[]');
    const room = rooms.find((item) => item.id_habitacion === changes.id_habitacion);
    if (!room || !this.getAvailableRooms(
      changes.fecha_llegada,
      changes.fecha_salida,
      undefined,
      reservationId
    ).some((available) => available.id_habitacion === changes.id_habitacion)) {
      throw new Error('La habitación seleccionada no está disponible para esas fechas.');
    }

    const tipologias: Tipologia[] = JSON.parse(localStorage.getItem(this.PREFIX + 'tipologias') || '[]');
    const roomCapacity = tipologias.find((tipologia) => tipologia.id_tipologia === room.id_tipologia)?.capacidad ?? 0;
    if ((changes.cantidad_personas ?? 0) > roomCapacity) {
      throw new Error('La cantidad de personas supera la capacidad de la habitación seleccionada.');
    }

    const updatedReservation: Reserva = { ...existingReservation, ...changes };
    localStorage.setItem(this.PREFIX + 'reservas', JSON.stringify(
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

    localStorage.setItem(this.PREFIX + 'reservas', JSON.stringify(
      reservations.filter((reservation) => reservation.id_reserva !== reservationId)
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

    const habitaciones: Habitacion[] = JSON.parse(localStorage.getItem(this.PREFIX + 'habitaciones') || '[]');
    const reservas: Reserva[] = JSON.parse(localStorage.getItem(this.PREFIX + 'reservas') || '[]');
    const tipologias: Tipologia[] = JSON.parse(localStorage.getItem(this.PREFIX + 'tipologias') || '[]');

    return habitaciones.filter((habitacion) =>
      !reservas.some((reserva) =>
        reserva.id_reserva !== excludeReservationId &&
        reserva.id_habitacion === habitacion.id_habitacion &&
        arrivalDate < reserva.fecha_salida &&
        departureDate > reserva.fecha_llegada
      ) &&
      (personCount === undefined ||
        (tipologias.find((tipologia) => tipologia.id_tipologia === habitacion.id_tipologia)?.capacidad ?? 0) >= personCount)
    );
  }

  registerEntry(input: RegisterEntryInput): { guest: Huesped; reservation: Reserva } {
    if (!Number.isInteger(input.personCount) || input.personCount < 1) {
      throw new Error('La cantidad de personas debe ser al menos 1.');
    }
    if (!this.isValidDate(input.arrivalDate) || !this.isValidDate(input.departureDate) ||
      input.arrivalDate >= input.departureDate) {
      throw new Error('La fecha de salida debe ser posterior a la fecha de llegada.');
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.arrivalTime)) {
      throw new Error('Ingresa un horario de llegada válido.');
    }

    const guests = this.getGuests();
    const rooms: Habitacion[] = JSON.parse(localStorage.getItem(this.PREFIX + 'habitaciones') || '[]');
    const tipologias: Tipologia[] = JSON.parse(localStorage.getItem(this.PREFIX + 'tipologias') || '[]');
    const reservations: Reserva[] = JSON.parse(localStorage.getItem(this.PREFIX + 'reservas') || '[]');
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
      guest = { ...guestDetails, id_huesped: nextGuestId };
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
    };

    localStorage.setItem(this.PREFIX + 'huespedes', JSON.stringify(updatedGuests));
    localStorage.setItem(this.PREFIX + 'reservas', JSON.stringify([...reservations, reservation]));
    this.refreshView();

    return { guest, reservation };
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
}