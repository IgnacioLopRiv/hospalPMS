import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HostalService } from './hostal.service';
import { GuestCardView, Huesped, Sede, SedeHabitacion, SedeTipologia } from '../../../shared/domain/hostal.model';
import { SedeService } from '../../locations/application/sede.service';

/**
 * Tests for HostalService with sede-scoped CRUD operations.
 *
 * The service now requires a SedeService with a selectedSede signal.
 * We mock SedeService so each test operates within a specific sede,
 * validating that data is isolated per sede.
 */

const TEST_SEDE_ID = 99;
const STORAGE_PREFIX = `hospal_db_sede_${TEST_SEDE_ID}_`;

function clearTestStorage(): void {
  ['huespedes', 'reservas'].forEach((key) =>
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`)
  );
}

function seedManagedInventory(): { typologies: SedeTipologia[]; rooms: SedeHabitacion[] } {
  const typologies: SedeTipologia[] = [
    { id: 1, nombre: 'Tipología 1', capacidad: 2, color: '#2156A7' },
    { id: 2, nombre: 'Tipología 2', capacidad: 4, color: '#1A9C5B' },
    { id: 3, nombre: 'Tipología 3', capacidad: 6, color: '#D07825' },
    { id: 4, nombre: 'Tipología 4', capacidad: 8, color: '#7736A6' },
  ];
  const rooms: SedeHabitacion[] = [
    ['101', 1], ['102', 1], ['104', 1], ['204', 3],
    ['205', 3], ['207', 4], ['306', 2], ['308', 2],
  ].map(([number, typeId], index) => ({
    id: index + 1,
    numero: String(number),
    tipo: typologies.find((typology) => typology.id === typeId)!.nombre,
    tipologiaId: Number(typeId),
    tamanoM2: 22,
    disposicionMuebles: '',
  }));
  return { typologies, rooms };
}

function seedStoredData(): void {
  const huespedes: Huesped[] = [
    { id_huesped: 1, id_sede: TEST_SEDE_ID, nombre: 'Valentin', apellido: 'Torres', nacionalidad: 'Argentina', telefono: '+549110000', email: 'v@test.com', es_recurrente: true },
    { id_huesped: 2, id_sede: TEST_SEDE_ID, nombre: 'Marco', apellido: 'Diaz', nacionalidad: 'Colombia', telefono: '+573000000', email: 'm@test.com' },
  ];
  const reservas = [
    { id_reserva: 1, id_huesped: 1, id_habitacion: 4, fecha_llegada: '2026-06-14', fecha_salida: '2026-06-19', estado_reserva: 'HOSPEDADO' },
    { id_reserva: 2, id_huesped: 2, id_habitacion: 1, fecha_llegada: '2026-06-16', fecha_salida: '2026-06-20', estado_reserva: 'CHECK-IN HOY' },
  ];

  localStorage.setItem(`${STORAGE_PREFIX}huespedes`, JSON.stringify(huespedes));
  localStorage.setItem(`${STORAGE_PREFIX}reservas`, JSON.stringify(reservas));
}

describe('HostalService (sede-scoped)', () => {
  let service: HostalService;
  let selectedSede: ReturnType<typeof signal<Sede | null>>;
  let managedRooms: ReturnType<typeof signal<SedeHabitacion[]>>;
  let managedTypologies: ReturnType<typeof signal<SedeTipologia[]>>;

  beforeEach(() => {
    clearTestStorage();

    const inventory = seedManagedInventory();
    selectedSede = signal<Sede | null>({
      id: TEST_SEDE_ID,
      nombre: 'Test Sede',
      ciudad: 'Test City',
      habitaciones: inventory.rooms,
      tipologias: inventory.typologies,
    });
    managedRooms = signal(inventory.rooms);
    managedTypologies = signal(inventory.typologies);
    const mockSedeService = {
      selectedSede,
      habitaciones: managedRooms,
      tipologias: managedTypologies,
    };

    TestBed.configureTestingModule({
      providers: [
        HostalService,
        { provide: SedeService, useValue: mockSedeService },
      ],
    });
    service = TestBed.inject(HostalService);

    // Seed test data for the scoped sede
    seedStoredData();
    service.refreshView();
  });

  afterEach(() => {
    clearTestStorage();
    TestBed.resetTestingModule();
  });

  it('starts with an empty sede when no data is seeded', () => {
    clearTestStorage();
    service.ensureSedeStorage();
    expect(service.getGuests()).toEqual([]);
    expect(service.getReservations()).toEqual([]);
  });

  it('returns only rooms without overlapping reservations', () => {
    const availableRooms = service.getAvailableRooms('2026-06-16', '2026-06-17');
    const roomNumbers = availableRooms.map((room) => room.numero_habitacion);
    expect(roomNumbers).toContain('102');
    expect(roomNumbers).toContain('104');
    expect(roomNumbers).toContain('205');
    expect(roomNumbers).toContain('207');
    expect(roomNumbers).toContain('306');
    expect(roomNumbers).toContain('308');
    expect(roomNumbers).not.toContain('101');
    expect(roomNumbers).not.toContain('204');
  });

  it('filters available rooms by the number of people', () => {
    const availableRooms = service.getAvailableRooms('2026-06-16', '2026-06-17', 5);
    const roomNumbers = availableRooms.map((room) => room.numero_habitacion);
    expect(roomNumbers).toContain('205');
    expect(roomNumbers).toContain('207');
    expect(roomNumbers).not.toContain('101');
    expect(roomNumbers).not.toContain('204');
  });

  it('matches a managed room by type name when its saved type ID is stale', () => {
    const room = managedRooms()[0];
    managedRooms.set([{ ...room, tipologiaId: 999 }]);

    expect(service.getReservationCalendarData().map((entry) => entry.id)).toContain(2);
  });

  it('includes guests without a reservation in the guests view', () => {
    const unreservedGuest: Huesped = {
      id_huesped: 9,
      id_sede: TEST_SEDE_ID,
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chilena',
      telefono: '+56912345678',
      email: 'ana@example.com',
    };
    const guests = [...service.getGuests(), unreservedGuest];
    localStorage.setItem(`${STORAGE_PREFIX}huespedes`, JSON.stringify(guests));

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

  it('registers a guest scoped to the active sede', () => {
    const guest = service.registerGuest({
      documento: 'XK12345',
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chilena',
      telefono: '+56 912345678',
      email: 'ana@example.com',
    });

    expect(guest.id_sede).toBe(TEST_SEDE_ID);
    expect(service.getGuests()).toContain(jasmine.objectContaining({ id_huesped: guest.id_huesped }));
  });

  it('registers a guest without creating a reservation', () => {
    const reservationCount = service.getReservations().length;
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
    expect(service.getReservations().length).toBe(reservationCount);
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
      roomId: 2,
      personCount: 2,
      arrivalDate: '2026-09-26',
      departureDate: '2026-09-28',
      arrivalTime: '14:00',
      payment: {
        totalAmount: 80000,
        paidAmount: 28000,
        depositPercentage: 35,
        method: 'transferencia' as const,
        paidInFull: false,
      },
    };

    const registered = service.registerEntry(entry);
    expect(registered.reservation.cantidad_personas).toBe(2);
    expect(registered.reservation).toEqual(jasmine.objectContaining({
      precio_total: 80000,
      porcentaje_abono: 35,
      monto_pagado: 28000,
      metodo_pago: 'transferencia',
      pago_completo: false,
    }));
    expect(registered.guest.id_sede).toBe(TEST_SEDE_ID);
    expect(service.getGuests()).toContain(jasmine.objectContaining({ documento: '12.345.678-9' }));
    expect(service.getAvailableRooms(entry.arrivalDate, entry.departureDate)
      .some((room) => room.id_habitacion === entry.roomId)).toBeFalse();
    expect(() => service.registerEntry({
      ...entry,
      newGuest: { ...entry.newGuest, documento: 'otro-rut' },
    })).toThrowError('La habitación seleccionada no está disponible para esas fechas.');
  });

  it('collects a reservation balance during check-in and finalizes the reservation on check-out', () => {
    const room = service.getAvailableRooms('2026-09-26', '2026-09-28')[0];
    const registered = service.registerEntry({
      newGuest: {
        documento: 'BALANCE-TEST',
        nombre: 'Ana',
        apellido: 'Pérez',
        telefono: '+56912345678',
        email: 'balance@example.com',
        nacionalidad: 'Chile',
      },
      roomId: room.id_habitacion,
      personCount: 1,
      arrivalDate: '2026-09-26',
      departureDate: '2026-09-28',
      arrivalTime: '14:00',
      payment: {
        totalAmount: 80000,
        paidAmount: 28000,
        depositPercentage: 35,
        method: 'transferencia',
        paidInFull: false,
      },
    });

    expect(() => service.processCheckIn(registered.reservation.id_reserva))
      .toThrowError('Selecciona transferencia o efectivo para cobrar el saldo pendiente.');
    const checkedIn = service.processCheckIn(registered.reservation.id_reserva, 'efectivo');
    expect(checkedIn).toEqual(jasmine.objectContaining({
      estado_reserva: 'HOSPEDADO',
      precio_total: 80000,
      monto_pagado: 80000,
      metodo_pago: 'efectivo',
      pago_completo: true,
    }));
    expect(service.getReservationCalendarData())
      .toContain(jasmine.objectContaining({ id: checkedIn.id_reserva, status: 'HOSPEDADO' }));

    const checkedOut = service.processCheckOut(checkedIn.id_reserva);
    expect(checkedOut.estado_reserva).toBe('FINALIZADA');
    expect(service.getReservationCalendarData())
      .toContain(jasmine.objectContaining({ id: checkedOut.id_reserva, status: 'FINALIZADA' }));
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
      roomId: 2,
      personCount: 2,
      arrivalDate: '2026-09-26',
      departureDate: '2026-09-28',
      arrivalTime: '14:00',
    };

    service.registerEntry(entry);
    expect(() => service.registerEntry({
      ...entry,
      roomId: 3,
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
      roomId: 2,
      personCount: 3,
      arrivalDate: '2026-09-26',
      departureDate: '2026-09-28',
      arrivalTime: '14:00',
    };

    expect(() => service.registerEntry(entry))
      .toThrowError('La cantidad de personas supera la capacidad de la habitación seleccionada.');
  });

  it('isolates data between different sedes', () => {
    // Register a guest in sede 99
    service.registerGuest({
      documento: 'SEDE99-DOC',
      nombre: 'Carlos',
      apellido: 'Luna',
      nacionalidad: 'Chile',
      telefono: '+56 900000001',
      email: 'carlos@test.com',
    });
    expect(service.getGuests().some((g) => g.documento === 'SEDE99-DOC')).toBeTrue();

    // Switch to a different sede (mock returns sede 100 now)
    const SEDE_100 = 100;
    selectedSede.set({
      id: SEDE_100,
      nombre: 'Otra Sede',
      ciudad: 'Otra Ciudad',
      habitaciones: [],
    });
    managedRooms.set([]);
    managedTypologies.set([]);
    service.ensureSedeStorage();

    // Data from sede 99 should not be visible in sede 100
    expect(service.getGuests().some((g) => g.documento === 'SEDE99-DOC')).toBeFalse();

    // Clean up sede 100 storage
    ['huespedes', 'reservas'].forEach((key) =>
      localStorage.removeItem(`hospal_db_sede_${SEDE_100}_${key}`)
    );
  });
});
