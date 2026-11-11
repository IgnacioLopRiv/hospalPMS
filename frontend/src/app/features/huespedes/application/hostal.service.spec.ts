import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EntryReservationError, HostalService } from './hostal.service';
import { GuestCardView, Huesped, Reserva, Sede, SedeHabitacion, SedeTipologia } from '../../../shared/domain/hostal.model';
import { SedeService } from '../../locations/application/sede.service';
import { CreateHuesped, Huesped as HuespedDomain, HuespedRepository } from '../domain/huesped.repository';
import { CreateReserva, ReservasRepository, UpdateReserva } from '../../reservations/domain/reservas.repository';

const TEST_SEDE_ID = 99;

describe('HostalService HTTP persistence', () => {
  let service: HostalService;
  let guests: Omit<Huesped, 'id_sede'>[];
  let reservations: Reserva[];
  let reservasRepository: {
    listBySede: jasmine.Spy;
    create: jasmine.Spy;
    update: jasmine.Spy;
    remove: jasmine.Spy;
  };
  let huespedRepository: {
    list: jasmine.Spy;
    create: jasmine.Spy;
    update: jasmine.Spy;
    remove: jasmine.Spy;
  };
  let domainGuests: HuespedDomain[];

  const typologies: SedeTipologia[] = [{ id: 1, nombre: 'Doble', capacidad: 2 }];
  const rooms: SedeHabitacion[] = [{
    id: 10,
    numero: '101',
    tipo: 'Doble',
    tipologiaId: 1,
    tamanoM2: 20,
    disposicionMuebles: '',
  }];

  beforeEach(async () => {
    guests = [];
    reservations = [];
    domainGuests = [];
    huespedRepository = {
      list: jasmine.createSpy().and.callFake(() => of(domainGuests)),
      create: jasmine.createSpy().and.callFake((data: CreateHuesped) => {
        const saved: HuespedDomain = { ...data, id: domainGuests.length + 1 };
        domainGuests = [...domainGuests, saved];
        return of(saved);
      }),
      update: jasmine.createSpy().and.callFake((id: number, data: Partial<CreateHuesped>) => {
        domainGuests = domainGuests.map((guest) => guest.id === id ? { ...guest, ...data } : guest);
        return of(domainGuests.find((guest) => guest.id === id));
      }),
      remove: jasmine.createSpy().and.callFake((id: number) => {
        domainGuests = domainGuests.filter((guest) => guest.id !== id);
        return of(undefined);
      }),
    };
    reservasRepository = {
      listBySede: jasmine.createSpy().and.callFake(() => of(reservations)),
      create: jasmine.createSpy().and.callFake((body: CreateReserva) => {
        const saved = { ...body, id_reserva: reservations.length + 1 } as Reserva;
        reservations = [...reservations, saved];
        return of(saved);
      }),
      update: jasmine.createSpy().and.callFake((id: number, body: UpdateReserva) => {
        reservations = reservations.map((reservation) =>
          reservation.id_reserva === id ? { ...reservation, ...body } : reservation
        );
        return of(reservations.find((reservation) => reservation.id_reserva === id));
      }),
      remove: jasmine.createSpy().and.callFake((id: number) => {
        reservations = reservations.filter((reservation) => reservation.id_reserva !== id);
        return of(undefined);
      }),
    };

    const selectedSede = signal<Sede | null>({
      id: TEST_SEDE_ID,
      nombre: 'Sede de prueba',
      ciudad: 'Santiago',
      habitaciones: rooms,
      tipologias: typologies,
    });
    const mockSedeService = {
      ready: Promise.resolve(),
      selectedSede,
      habitaciones: signal(rooms),
      tipologias: signal(typologies),
    };

    TestBed.configureTestingModule({
      providers: [
        HostalService,
        { provide: HuespedRepository, useValue: huespedRepository },
        { provide: ReservasRepository, useValue: reservasRepository },
        { provide: SedeService, useValue: mockSedeService },
      ],
    });
    service = TestBed.inject(HostalService);
    await service.ready;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads guests and reservations from the API for the selected sede', () => {
    expect(huespedRepository.list).toHaveBeenCalled();
    expect(reservasRepository.listBySede).toHaveBeenCalledWith(TEST_SEDE_ID);
    expect(service.getGuests()).toEqual([]);
    expect(service.getReservations()).toEqual([]);
  });

  it('shows one card per guest with the most relevant reservation and counts the rest', () => {
    const guest: Huesped = {
      id_huesped: 1, id_sede: TEST_SEDE_ID, nombre: 'Ana', apellido: 'Pérez',
      nacionalidad: 'Chile', telefono: '+56 912345678', email: 'ana@example.com',
    };
    const base = { id_huesped: 1, id_habitacion: 10, hora_llegada: '14:00' };
    (service as unknown as { guests: Huesped[] }).guests = [guest];
    (service as unknown as { reservations: Reserva[] }).reservations = [
      { ...base, id_reserva: 1, fecha_llegada: '2099-02-01', fecha_salida: '2099-02-03', estado_reserva: 'CONFIRMADA' },
      { ...base, id_reserva: 2, fecha_llegada: '2000-01-01', fecha_salida: '2099-01-05', estado_reserva: 'HOSPEDADO' },
      { ...base, id_reserva: 3, fecha_llegada: '1999-12-01', fecha_salida: '1999-12-02', estado_reserva: 'FINALIZADA' },
    ];

    service.refreshView();

    let cards: GuestCardView[] = [];
    service.guestsView$.subscribe((value) => (cards = value)).unsubscribe();
    expect(cards.length).toBe(1);
    expect(cards[0].id_reserva).toBe(2);
    expect(cards[0].status).toBe('hospedado');
    expect(cards[0].extraReservations).toBe(1);
    expect(cards[0].statuses).toEqual(['hospedado', 'confirmada']);
    expect(cards[0].phone).toBe('+56 912345678');

    const details = service.getGuestReservationDetails(1);
    expect(details.map((item) => item.reservation.id_reserva)).toEqual([3, 2, 1]);
    expect(details[2].roomNumber).toBe('101');
    expect(details[2].nights).toBe(2);
  });

  it('creates, updates, and deletes guests through the API', async () => {
    const guest = await service.registerGuest({
      documento: '12.345.678-9',
      nombre: 'Valentín',
      apellido: 'Torres',
      nacionalidad: 'Chile',
      telefono: '+569111111',
      email: 'valentin@example.com',
    });
    expect(guest.id_sede).toBe(TEST_SEDE_ID);
    expect(huespedRepository.create).toHaveBeenCalledWith(jasmine.objectContaining({ nombres: 'Valentín' }));

    const updated = await service.updateGuest(guest.id_huesped, {
      documento: guest.documento,
      nombre: guest.nombre,
      apellido: guest.apellido,
      nacionalidad: guest.nacionalidad,
      telefono: guest.telefono,
      email: 'nuevo@example.com',
    });
    expect(updated.email).toBe('nuevo@example.com');
    expect(huespedRepository.update).toHaveBeenCalledWith(
      guest.id_huesped,
      jasmine.objectContaining({ sedeId: TEST_SEDE_ID }),
      TEST_SEDE_ID,
    );

    await service.deleteGuest(guest.id_huesped);
    expect(huespedRepository.remove).toHaveBeenCalledWith(guest.id_huesped, TEST_SEDE_ID);
    expect(service.getGuests()).toEqual([]);
  });

  it('rejects invalid guest data before issuing a request', async () => {
    await expectAsync(service.registerGuest({
      documento: '', nombre: '', apellido: '', nacionalidad: '', telefono: '', email: 'invalid',
    })).toBeRejectedWithError('Completa todos los datos del huésped antes de registrarlo.');
    expect(huespedRepository.create).not.toHaveBeenCalled();
  });

  it('registers a guest and reservation in the database', async () => {
    const result = await service.registerEntry({
      newGuest: {
        documento: '22.222.222-2',
        nombre: 'Ana',
        apellido: 'Rojas',
        nacionalidad: 'Chile',
        telefono: '+569222222',
        email: 'ana@example.com',
      },
      roomId: 10,
      personCount: 2,
      arrivalDate: '2026-12-10',
      departureDate: '2026-12-12',
      arrivalTime: '14:00',
      payment: {
        totalAmount: 100000,
        paidAmount: 20000,
        depositPercentage: 20,
        method: 'transferencia',
        paidInFull: false,
      },
    });

    expect(result.guest.id_huesped).toBe(1);
    expect(result.reservation.id_reserva).toBe(1);
    expect(huespedRepository.create).toHaveBeenCalledTimes(1);
    expect(reservasRepository.create).toHaveBeenCalledTimes(1);
    expect(service.getReservations()).toContain(jasmine.objectContaining({ id_reserva: 1 }));
  });

  it('keeps the new guest and returns it when the reservation is rejected by the backend', async () => {
    reservasRepository.create.and.returnValue(throwError(() => ({
      status: 400,
      error: { message: 'La cantidad de personas (2) supera la capacidad de la habitación (1).' },
    })));
    const entry = {
      newGuest: {
        documento: '44.444.444-4', nombre: 'Mauri', apellido: 'Torres', nacionalidad: 'Chile',
        telefono: '+569444444', email: 'mauri@example.com',
      },
      roomId: 10,
      personCount: 2,
      arrivalDate: '2026-12-10',
      departureDate: '2026-12-11',
      arrivalTime: '23:30',
    };

    const error = await service.registerEntry(entry).then(() => null, (reason: unknown) => reason);

    expect(error).toEqual(jasmine.any(EntryReservationError));
    const entryError = error as EntryReservationError;
    expect(entryError.message).toContain('supera la capacidad de la habitación (1)');
    expect(entryError.message).toContain('ya quedó registrado');
    expect(entryError.guest.id_huesped).toBe(1);
    expect(service.getGuests()).toContain(jasmine.objectContaining({ id_huesped: 1, documento: '44.444.444-4' }));

    // Reintento con el huésped ya creado: no se vuelve a crear (evita el 409).
    reservasRepository.create.and.callFake((data: CreateReserva) => of({ ...data, id_reserva: 1 } as Reserva));
    const { newGuest: _newGuest, ...retry } = entry;
    await service.registerEntry({ ...retry, guestId: entryError.guest.id_huesped });
    expect(huespedRepository.create).toHaveBeenCalledTimes(1);
  });

  it('creates a card reservation without payment so the POS registers it', async () => {
    const guest = await service.registerGuest({
      documento: '44.444.444-4', nombre: 'Sol', apellido: 'Vera', nacionalidad: 'Chile',
      telefono: '+569444444', email: 'sol@example.com',
    });
    const { reservation } = await service.registerEntry({
      guestId: guest.id_huesped,
      roomId: 10,
      personCount: 1,
      arrivalDate: '2026-12-10',
      departureDate: '2026-12-12',
      arrivalTime: '15:00',
      payment: { totalAmount: 100000, paidAmount: 20000, depositPercentage: 20, method: 'debito', paidInFull: false },
    });

    const sent = reservasRepository.create.calls.mostRecent().args[0];
    expect(sent).toEqual(jasmine.objectContaining({ precio_total: 100000, porcentaje_abono: 20, pago_completo: false }));
    expect(sent.monto_pagado).toBeUndefined();
    expect(sent.metodo_pago).toBeUndefined();

    // El terminal aprobó el abono: solo se refleja localmente, sin otra llamada.
    const updates = reservasRepository.update.calls.count();
    service.applyPosPayment(reservation.id_reserva, 20000, 'debito');
    expect(reservasRepository.update.calls.count()).toBe(updates);
    expect(service.getReservations().find((item) => item.id_reserva === reservation.id_reserva))
      .toEqual(jasmine.objectContaining({ monto_pagado: 20000, metodo_pago: 'debito', pago_completo: false }));
  });

  it('records a cash payment on a reservation created for a failed card charge', async () => {
    const guest = await service.registerGuest({
      documento: '55.555.555-5', nombre: 'Max', apellido: 'Soto', nacionalidad: 'Chile',
      telefono: '+569555555', email: 'max@example.com',
    });
    const { reservation } = await service.registerEntry({
      guestId: guest.id_huesped,
      roomId: 10,
      personCount: 1,
      arrivalDate: '2026-12-10',
      departureDate: '2026-12-12',
      arrivalTime: '15:00',
      payment: { totalAmount: 100000, paidAmount: 100000, depositPercentage: 20, method: 'credito', paidInFull: true },
    });

    await service.recordReservationPayment(reservation.id_reserva, { amount: 100000, method: 'efectivo', paidInFull: true });

    expect(reservasRepository.update.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({
      monto_pagado: 100000, metodo_pago: 'efectivo', pago_completo: true,
    }));
  });

  it('persists check-in and check-out state changes', async () => {
    const guest = await service.registerGuest({
      documento: '33.333.333-3', nombre: 'Leo', apellido: 'Paz', nacionalidad: 'Chile',
      telefono: '+569333333', email: 'leo@example.com',
    });
    const { reservation } = await service.registerEntry({
      guestId: guest.id_huesped,
      roomId: 10,
      personCount: 1,
      arrivalDate: '2026-12-10',
      departureDate: '2026-12-12',
      arrivalTime: '15:00',
    });

    const checkedIn = await service.processCheckIn(reservation.id_reserva);
    expect(checkedIn.estado_reserva).toBe('HOSPEDADO');
    const checkedOut = await service.processCheckOut(reservation.id_reserva);
    expect(checkedOut.estado_reserva).toBe('FINALIZADA');
    expect(reservasRepository.update).toHaveBeenCalled();
  });
});