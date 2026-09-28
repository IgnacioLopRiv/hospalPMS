import { TestBed } from '@angular/core/testing';
import { HostalService } from './hostal.service';
import { GuestCardView } from '../../../shared/domain/hostal.model';

describe('HostalService entry registration', () => {
  let service: HostalService;

  beforeEach(() => {
    ['huespedes', 'habitaciones', 'reservas', 'tipologias'].forEach((key) =>
      localStorage.removeItem(`hospal_db_${key}`)
    );
    localStorage.setItem('hospal.sedes', JSON.stringify([{
      id: 1,
      nombre: 'Sede de prueba',
      ciudad: 'Santiago',
      tipologias: [
        { id: 1, nombre: 'Doble gestionada', capacidad: 2 },
        { id: 2, nombre: 'Suite gestionada', capacidad: 8 }
      ],
      habitaciones: [
        { id: 1, numero: '101', tipo: 'Doble gestionada', tipologiaId: 1, tamanoM2: 22, disposicionMuebles: '' },
        { id: 4, numero: '204', tipo: 'Suite gestionada', tipologiaId: 2, tamanoM2: 36, disposicionMuebles: '' },
        { id: 6, numero: '207', tipo: 'Suite gestionada', tipologiaId: 2, tamanoM2: 36, disposicionMuebles: '' },
        { id: 8, numero: '308', tipo: 'Doble gestionada', tipologiaId: 1, tamanoM2: 22, disposicionMuebles: '' }
      ]
    }]));
    localStorage.setItem('hospal.selectedSede', JSON.stringify({ id: 1 }));
    localStorage.setItem('hospal_db_huespedes', JSON.stringify([
      { id_huesped: 1, nombre: 'Valentin', apellido: 'Torres', nacionalidad: 'Argentina', telefono: '+549110000', email: 'v@test.com', es_recurrente: true },
      { id_huesped: 2, nombre: 'Marco', apellido: 'Diaz', nacionalidad: 'Colombia', telefono: '+573000000', email: 'm@test.com' },
      { id_huesped: 3, nombre: 'Alejandro', apellido: 'Schmidt', nacionalidad: 'Alemania', telefono: '+491500000', email: 'a@test.com', es_recurrente: true }
    ]));
    localStorage.setItem('hospal_db_reservas', JSON.stringify([
      { id_reserva: 1, id_huesped: 1, id_habitacion: 4, fecha_llegada: '2026-06-14', fecha_salida: '2026-06-19', estado_reserva: 'HOSPEDADO' },
      { id_reserva: 2, id_huesped: 2, id_habitacion: 1, fecha_llegada: '2026-06-16', fecha_salida: '2026-06-20', estado_reserva: 'CHECK-IN HOY' },
      { id_reserva: 3, id_huesped: 3, id_habitacion: 8, fecha_llegada: '2026-06-12', fecha_salida: '2026-06-16', estado_reserva: 'CHECK-OUT HOY' }
    ]));
    TestBed.configureTestingModule({});
    service = TestBed.inject(HostalService);
  });

  afterEach(() => {
    ['huespedes', 'habitaciones', 'reservas', 'tipologias'].forEach((key) =>
      localStorage.removeItem(`hospal_db_${key}`)
    );
    localStorage.removeItem('hospal.sedes');
    localStorage.removeItem('hospal.selectedSede');
    TestBed.resetTestingModule();
  });

  it('returns only rooms without overlapping reservations', () => {
    const availableRooms = service.getAvailableRooms('2026-06-16', '2026-06-17');
    expect(availableRooms.map((room) => room.numero_habitacion)).toEqual(['207', '308']);
  });

  it('filters available rooms by the number of people', () => {
    const availableRooms = service.getAvailableRooms('2026-06-16', '2026-06-17', 5);
    expect(availableRooms.map((room) => room.numero_habitacion)).toEqual(['207']);
  });

  it('includes guests without a reservation in the guests view', () => {
    const unreservedGuest = {
      id_huesped: 9,
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chilena',
      telefono: '+56912345678',
      email: 'ana@example.com',
    };
    const guests = [...service.getGuests(), unreservedGuest];
    localStorage.setItem('hospal_db_huespedes', JSON.stringify(guests));

    service.refreshView();

    let unreservedCard: GuestCardView | undefined;
    const subscription = service.guestsView$.subscribe((cards) => {
      unreservedCard = cards.find((card) => card.id_huesped === unreservedGuest.id_huesped);
    });

    expect(unreservedCard).toEqual(jasmine.objectContaining({
      guestName: 'Ana Pérez',
      hasReservation: false,
      status: 'inactivo',
      statusBadge: 'INACTIVO',
    }));
    subscription.unsubscribe();
  });

  it('shows the complete name of a guest with a reservation', () => {
    let guestCard: GuestCardView | undefined;
    const subscription = service.guestsView$.subscribe((cards) => {
      guestCard = cards.find((card) => card.id_huesped === 1);
    });

    expect(guestCard?.guestName).toBe('Valentin Torres');
    subscription.unsubscribe();
  });

  it('provides calendar reservations joined to registered guests and rooms', () => {
    const guest = service.registerGuest({
      documento: 'CALENDAR123',
      nombre: 'Camila',
      apellido: 'Gómez',
      nacionalidad: 'Chile',
      telefono: '+56912345678',
      email: 'camila@example.com',
    });
    const guestWithoutReservation = service.registerGuest({
      documento: 'CALENDAR456',
      nombre: 'Huésped',
      apellido: 'SinReserva',
      nacionalidad: 'Chile',
      telefono: '+56987654321',
      email: 'sinreserva@example.com',
    });
    service.registerEntry({
      guestId: guest.id_huesped,
      roomId: 6,
      personCount: 1,
      arrivalDate: '2026-09-27',
      departureDate: '2026-09-29',
      arrivalTime: '14:00',
    });

    expect(service.getReservationCalendarData()).toContain(jasmine.objectContaining({
      guestName: 'Camila Gómez',
      roomNumber: '207',
      roomType: 'Suite gestionada',
      arrivalDate: '2026-09-27',
      departureDate: '2026-09-29',
    }));
    expect(service.getReservationCalendarData().some((entry) => entry.guestName === 'Valentin Torres')).toBeTrue();
    expect(service.getReservationCalendarData().some((entry) =>
      entry.guestName === `${guestWithoutReservation.nombre} ${guestWithoutReservation.apellido}`
    )).toBeFalse();
  });

  it('registers a guest without creating a reservation', () => {
    const reservationCount = JSON.parse(localStorage.getItem('hospal_db_reservas') || '[]').length;
    const guest = service.registerGuest({
      documento: 'XK12345',
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chilena',
      telefono: '+56 912345678',
      email: 'ana@example.com',
    });
    let guestCard: GuestCardView | undefined;
    const subscription = service.guestsView$.subscribe((cards) => {
      guestCard = cards.find((card) => card.id_huesped === guest.id_huesped);
    });

    expect(service.getGuests()).toContain(jasmine.objectContaining({ id_huesped: guest.id_huesped }));
    expect(JSON.parse(localStorage.getItem('hospal_db_reservas') || '[]').length).toBe(reservationCount);
    expect(guestCard).toEqual(jasmine.objectContaining({
      hasReservation: false,
      status: 'inactivo',
    }));
    subscription.unsubscribe();
  });

  it('rejects registering a guest with an already registered document', () => {
    const registeredGuest = service.registerGuest({
      documento: 'DUPLICATE123',
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chilena',
      telefono: '+56 912345678',
      email: 'ana@example.com',
    });
    expect(() => service.registerGuest({
      documento: registeredGuest.documento,
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chilena',
      telefono: '+56 912345678',
      email: 'ana@example.com',
    })).toThrowError('Ya existe un huésped registrado con ese RUT o número de pasaporte.');
  });

  it('updates guest details and rejects a document assigned to another guest', () => {
    service.updateGuest(2, {
      documento: 'DOC-2',
      nombre: 'Marco',
      apellido: 'Díaz',
      nacionalidad: 'Colombia',
      telefono: '+57 3000000',
      email: 'marco@example.com',
    });
    const guest = service.updateGuest(1, {
      documento: 'DOC-1',
      nombre: 'Valentín',
      apellido: 'Torres',
      nacionalidad: 'Argentina',
      telefono: '+54 9110000',
      email: 'valentin@example.com',
    });
    expect(guest.nombre).toBe('Valentín');
    expect(service.getGuests()).toContain(jasmine.objectContaining({ id_huesped: 1, email: 'valentin@example.com' }));

    expect(() => service.updateGuest(1, {
      documento: 'DOC-2',
      nombre: 'Valentín',
      apellido: 'Torres',
      nacionalidad: 'Argentina',
      telefono: '+54 9110000',
      email: 'valentin@example.com',
    })).toThrowError('Ya existe un huésped registrado con ese RUT o número de pasaporte.');
  });

  it('deletes the guest and all reservations assigned to them', () => {
    service.deleteGuest(1);

    expect(service.getGuests().some((guest) => guest.id_huesped === 1)).toBeFalse();
    expect(service.getReservations().some((reservation) => reservation.id_huesped === 1)).toBeFalse();
  });

  it('updates a reservation while allowing it to retain its currently assigned room', () => {
    const updated = service.updateReservation(1, {
      id_habitacion: 4,
      fecha_llegada: '2026-06-14',
      fecha_salida: '2026-06-20',
      hora_llegada: '15:00',
      cantidad_personas: 2,
    });

    expect(updated.hora_llegada).toBe('15:00');
    expect(service.getReservations()).toContain(jasmine.objectContaining({
      id_reserva: 1,
      fecha_salida: '2026-06-20',
    }));
  });

  it('cancels a reservation and keeps the guest registered', () => {
    service.cancelReservation(1);

    expect(service.getReservations().some((reservation) => reservation.id_reserva === 1)).toBeFalse();
    expect(service.getGuests().some((guest) => guest.id_huesped === 1)).toBeTrue();
    expect(service.getAvailableRooms('2026-06-14', '2026-06-19')
      .some((room) => room.id_habitacion === 4)).toBeTrue();
  });

  it('saves a new guest and reservation and prevents assigning the occupied room again', () => {
    const entry = {
      newGuest: {
        documento: '12.345.678-9',
        nombre: 'Ana',
        apellido: 'Pérez',
        telefono: '+56912345678',
        email: 'ana@example.com',
        nacionalidad: 'Chilena',
      },
      roomId: 1,
      personCount: 2,
      arrivalDate: '2026-09-26',
      departureDate: '2026-09-28',
      arrivalTime: '14:00',
    };

    const registered = service.registerEntry(entry);
    expect(registered.reservation.cantidad_personas).toBe(2);
    expect(service.getGuests()).toContain(jasmine.objectContaining({ documento: '12.345.678-9' }));
    expect(service.getAvailableRooms(entry.arrivalDate, entry.departureDate)
      .some((room) => room.id_habitacion === entry.roomId)).toBeFalse();
    expect(() => service.registerEntry({
      ...entry,
      newGuest: { ...entry.newGuest, documento: 'otro-rut' },
    })).toThrowError('La habitación seleccionada no está disponible para esas fechas.');
  });

  it('rejects a duplicate identity document', () => {
    const entry = {
      newGuest: {
        documento: 'ABC123',
        nombre: 'Ana',
        apellido: 'Pérez',
        telefono: '+56912345678',
        email: 'ana@example.com',
        nacionalidad: 'Chilena',
      },
      roomId: 1,
      personCount: 2,
      arrivalDate: '2026-09-26',
      departureDate: '2026-09-28',
      arrivalTime: '14:00',
    };

    service.registerEntry(entry);
    expect(() => service.registerEntry({
      ...entry,
      roomId: 2,
      newGuest: { ...entry.newGuest, documento: ' abc-123 ' },
    })).toThrowError('Ya existe un huésped registrado con ese RUT o número de pasaporte.');
  });

  it('rejects a reservation that exceeds the room capacity', () => {
    const entry = {
      newGuest: {
        documento: 'CAPACITY123',
        nombre: 'Ana',
        apellido: 'Pérez',
        telefono: '+56912345678',
        email: 'ana@example.com',
        nacionalidad: 'Chilena',
      },
      roomId: 1,
      personCount: 3,
      arrivalDate: '2026-09-26',
      departureDate: '2026-09-28',
      arrivalTime: '14:00',
    };

    expect(() => service.registerEntry(entry))
      .toThrowError('La cantidad de personas supera la capacidad de la habitación seleccionada.');
  });
});
