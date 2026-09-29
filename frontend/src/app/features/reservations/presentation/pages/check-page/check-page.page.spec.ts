import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckPagePage } from './check-page.page';

describe('CheckPagePage', () => {
  let component: CheckPagePage;
  let fixture: ComponentFixture<CheckPagePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CheckPagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have pending check-ins and check-outs initialized', () => {
    expect(component.pendingCheckIns.length).toBeGreaterThan(0);
    expect(component.pendingCheckOuts.length).toBeGreaterThan(0);
  });

  it('validates Chilean RUT check digits', () => {
    expect(component.isValidRut('12.345.678-5')).toBeTrue();
    expect(component.isValidRut('12.345.678-9')).toBeFalse();
    expect(component.isValidRut('1-9')).toBeFalse();
  });

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
