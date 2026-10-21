import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HostalService } from './hostal.service';
import { Huesped, Reserva, Sede, SedeHabitacion, SedeTipologia } from '../../../shared/domain/hostal.model';
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

    await service.deleteGuest(guest.id_huesped);
    expect(huespedRepository.remove).toHaveBeenCalledWith(guest.id_huesped);
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