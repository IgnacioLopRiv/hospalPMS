import { HostalService } from './hostal.service';

describe('HostalService entry registration', () => {
  let service: HostalService;

  beforeEach(() => {
    ['huespedes', 'habitaciones', 'reservas', 'tipologias'].forEach((key) =>
      localStorage.removeItem(`hospal_db_${key}`)
    );
    service = new HostalService();
  });

  afterEach(() => {
    ['huespedes', 'habitaciones', 'reservas', 'tipologias'].forEach((key) =>
      localStorage.removeItem(`hospal_db_${key}`)
    );
  });

  it('returns only rooms without overlapping reservations', () => {
    const availableRooms = service.getAvailableRooms('2026-06-16', '2026-06-17');
    expect(availableRooms.map((room) => room.numero_habitacion)).toEqual(['207', '308']);
  });

  it('filters available rooms by the number of people', () => {
    const availableRooms = service.getAvailableRooms('2026-06-16', '2026-06-17', 5);
    expect(availableRooms.map((room) => room.numero_habitacion)).toEqual(['207']);
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
