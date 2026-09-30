import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HostalService } from '../../../../guests/application/hostal.service';
import { SedeService } from '../../../../locations/application/sede.service';
import { CheckPagePage } from './check-page.page';

describe('CheckPagePage', () => {
  let component: CheckPagePage;
  let fixture: ComponentFixture<CheckPagePage>;

  beforeEach(() => {
    const sedeId = TestBed.inject(SedeService).selectedSede()?.id;
    if (sedeId !== undefined) {
      ['huespedes', 'reservas', 'habitaciones', 'tipologias'].forEach((entity) => {
        localStorage.removeItem(`hospal_db_sede_${sedeId}_${entity}`);
      });
    }
    fixture = TestBed.createComponent(CheckPagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not show placeholder movements without reservations today', () => {
    expect(component.pendingCheckIns).toEqual([]);
    expect(component.pendingCheckOuts).toEqual([]);
  });

  it('shows check-ins and check-outs from reservations registered for today', () => {
    const hostalService = TestBed.inject(HostalService);
    const today = localDateString(new Date());
    const previousDay = new Date();
    previousDay.setDate(previousDay.getDate() - 1);
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    const todayReservationRooms = hostalService.getAvailableRooms(today, localDateString(nextDay));
    const checkoutReservationRooms = hostalService.getAvailableRooms(localDateString(previousDay), today);

    hostalService.registerEntry({
      newGuest: {
        documento: 'CHECKIN-TEST',
        nombre: 'Ana',
        apellido: 'Pérez',
        nacionalidad: 'Chile',
        telefono: '+56912345678',
        email: 'ana-checkin@example.com',
      },
      roomId: todayReservationRooms[0].id_habitacion,
      personCount: 1,
      arrivalDate: today,
      departureDate: localDateString(nextDay),
      arrivalTime: '15:30',
    });
    hostalService.registerEntry({
      newGuest: {
        documento: 'CHECKOUT-TEST',
        nombre: 'Luis',
        apellido: 'Rojas',
        nacionalidad: 'Argentina',
        telefono: '+5491112345678',
        email: 'luis-checkout@example.com',
      },
      roomId: checkoutReservationRooms[1].id_habitacion,
      personCount: 1,
      arrivalDate: localDateString(previousDay),
      departureDate: today,
      arrivalTime: '14:00',
    });

    expect(component.pendingCheckIns).toContain(jasmine.objectContaining({
      guestName: 'Ana Pérez',
      scheduledTime: '15:30',
      statusBadge: 'CHECK-IN HOY',
    }));
    expect(component.pendingCheckOuts).toContain(jasmine.objectContaining({
      guestName: 'Luis Rojas',
      statusBadge: 'CHECK-OUT HOY',
    }));
  });

  it('shows the current local date and a live 24-hour time value', () => {
    expect(component.currentDateFormatted.toLocaleLowerCase()).toBe(
      new Date().toLocaleDateString('es-CL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    );
    expect(component.currentTimeFormatted).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('validates Chilean RUT check digits', () => {
    expect(component.isValidRut('12.345.678-5')).toBeTrue();
    expect(component.isValidRut('12.345.678-9')).toBeFalse();
    expect(component.isValidRut('1-9')).toBeFalse();
  });

  function localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  it('formats the RUT as it is typed', () => {
    component.formatRut('12345678');
    expect(component.entryForm.documento).toBe('12.345.678');

    component.formatRut('123456785');
    expect(component.entryForm.documento).toBe('12.345.678-5');
  });

  it('keeps only numbers in passport and phone values', () => {
    component.entryForm.documentType = 'passport';
    const passportInput = document.createElement('input');
    passportInput.value = 'AB123-45';
    component.handleDocumentInput({ target: passportInput } as unknown as Event);
    expect(component.entryForm.documento).toBe('12345');
    expect(passportInput.value).toBe('12345');

    const phoneInput = document.createElement('input');
    phoneInput.value = '1234567890a';
    component.handlePhoneInput({ target: phoneInput } as unknown as Event);
    expect(component.entryForm.telefono).toBe('123456789');
    expect(phoneInput.value).toBe('123456789');
  });

  it('keeps K only as the RUT check digit', () => {
    component.entryForm.documentType = 'rut';
    const rutInput = document.createElement('input');
    rutInput.value = '12.345.678-k';
    component.handleDocumentInput({ target: rutInput } as unknown as Event);
    expect(component.entryForm.documento).toBe('12.345.678-K');
    expect(rutInput.value).toBe('12.345.678-K');
  });

  it('accepts only complete email addresses with a domain', () => {
    expect(component.isValidEmail('nombre@dominio.com')).toBeTrue();
    expect(component.isValidEmail('nombre@dominio')).toBeFalse();
    expect(component.isValidEmail('cualquier cosa')).toBeFalse();
  });

  it('finds a registered guest by a formatted or unformatted document', () => {
    component.availableGuests = [{
      id_huesped: 10,
      id_sede: 1,
      documento: '12.345.678-5',
      nombre: 'Ana',
      apellido: 'Pérez',
      telefono: '+56 912345678',
      email: 'ana@example.com',
      nacionalidad: 'Chile',
    }];
    component.entryForm.documento = '123456785';

    expect(component.duplicateGuest?.nombre).toBe('Ana');
  });

  it('provides country names for the residence selector', () => {
    expect(component.countries.find((country) => country.code === 'cl')?.countryName).toBe('Chile');
    expect(component.countries.every((country) => country.code === country.code.toLowerCase())).toBeTrue();
  });
});
