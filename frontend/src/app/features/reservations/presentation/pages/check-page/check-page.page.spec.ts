import { TarifaPricingService } from './tarifa-pricing.service';
import { PosRepository } from '../../../../payments-pos/domain/pos.repository';
import { createPosRepositoryStub } from '../../../../payments-pos/domain/testing/pos.repository.stub';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import { HostalService } from '../../../../huespedes/application/hostal.service';
import { SedeService } from '../../../../locations/application/sede.service';
import { LocationsRepository } from '../../../../locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../../locations/domain/testing/locations.repository.stub';
import { HuespedRepository } from '../../../../huespedes/domain/huesped.repository';
import { createHostalRepositoryStubs } from '../../../../huespedes/domain/testing/hostal-repositories.stub';
import { ReservasRepository } from '../../../domain/reservas.repository';
import { InventarioRepository } from '../../../../inventory/domain/inventario.repository';
import { createEmptyInventarioRepositoryStub } from '../../../../inventory/domain/testing/inventario.repository.stub';
import { InventarioService } from '../../../../inventory/application/inventario.service';
import { Tarifa, TarifasRepository } from '../../../../locations/domain/tarifas.repository';
import { FotoHabitacionRepository } from '../../../../locations/domain/foto-habitacion.repository';
import { Huesped } from '../../../../../shared/domain/hostal.model';
import { of } from 'rxjs';
import { CheckPagePage } from './check-page.page';

describe('CheckPagePage', () => {
  let component: CheckPagePage;
  let fixture: ComponentFixture<CheckPagePage>;
  let tarifasConfig: { sedeId: number; porcentajeAbono: number; tarifas: Tarifa[] };

  beforeEach(async () => {
    tarifasConfig = { sedeId: 1, porcentajeAbono: 20, tarifas: [] };
    const initialSede = {
      id: 1,
      nombre: 'Sede de prueba',
      ciudad: 'Santiago',
      tipologias: [{ id: 1, nombre: 'Doble', capacidad: 2, precioBase: 40000 }],
      habitaciones: [{ id: 101, numero: '101', tipo: 'Doble', tipologiaId: 1, tamanoM2: 20, disposicionMuebles: '' }],
    };
    const repositories = createHostalRepositoryStubs();
    await TestBed.configureTestingModule({
      imports: [CheckPagePage],
      providers: [
        provideHttpClient(),
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub([initialSede]) },
        { provide: HuespedRepository, useValue: repositories.huespedRepository },
        { provide: ReservasRepository, useValue: repositories.reservasRepository },
        { provide: InventarioRepository, useValue: createEmptyInventarioRepositoryStub() },
        { provide: PosRepository, useValue: createPosRepositoryStub() },
        {
          provide: FotoHabitacionRepository,
          useValue: {
            listPhotos: () => of([]),
            createPhoto: (_habitacionId: number, data: { url: string; titulo?: string; descripcion?: string }) => of({
              id: 1,
              habitacionId: 1,
              url: data.url,
              titulo: data.titulo,
              descripcion: data.descripcion,
              fechaSubida: new Date().toISOString(),
            }),
            deletePhoto: () => of(undefined),
          },
        },
        {
          provide: TarifasRepository,
          useValue: {
            getAbono: (sedeId: number) => of({ sedeId, porcentajeAbono: tarifasConfig.porcentajeAbono }),
            listTarifas: () => of(tarifasConfig.tarifas),
          },
        },
      ],
    }).compileComponents();
    const sedeService = TestBed.inject(SedeService);
    await sedeService.ready;
    const hostalService = TestBed.inject(HostalService);
    await hostalService.ready;
    await TestBed.inject(InventarioService).ready;
    const sedeId = sedeService.selectedSede()?.id;
    if (sedeId !== undefined) {
      ['huespedes', 'reservas', 'habitaciones', 'tipologias'].forEach((entity) => {
        localStorage.removeItem(`hospal_db_sede_${sedeId}_${entity}`);
      });
    }
    fixture = TestBed.createComponent(CheckPagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens the check-in balance modal and collects the outstanding amount before processing', async () => {
    const sedeService = TestBed.inject(SedeService);
    const hostalService = TestBed.inject(HostalService);
    const sedeId = sedeService.selectedSede()!.id;
    const today = localDateString(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    sedeService.selectedSede.set({
      id: sedeId,
      nombre: 'Sede de prueba',
      ciudad: 'Santiago',
      tipologias: [{ id: 1, nombre: 'Doble', capacidad: 2, precioBase: 40000 }],
      habitaciones: [{
        id: 101,
        numero: '101',
        tipo: 'Doble',
        tipologiaId: 1,
        tamanoM2: 20,
        disposicionMuebles: '',
      }],
    });
    const registered = await hostalService.registerEntry({
      newGuest: {
        documento: 'CHECKIN-BALANCE',
        nombre: 'Ana',
        apellido: 'Pérez',
        nacionalidad: 'Chile',
        telefono: '+56912345678',
        email: 'ana-checkin-balance@example.com',
      },
      roomId: 101,
      personCount: 1,
      arrivalDate: today,
      departureDate: localDateString(tomorrow),
      arrivalTime: '15:00',
      payment: {
        totalAmount: 40000,
        paidAmount: 10000,
        depositPercentage: 25,
        method: 'transferencia',
        paidInFull: false,
      },
    });
    component.refreshPendingChecks();
    const pendingItem = component.pendingCheckIns.find((item) => item.id === registered.reservation.id_reserva);
    expect(pendingItem?.outstandingBalance).toBe(30000);
    if (!pendingItem) throw new Error('La reserva no apareció en los check-ins pendientes.');
    component.realizarCheckIn(pendingItem);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.checkin-payment-modal')).toBeTruthy();
    expect(
      (fixture.nativeElement.querySelector('.checkin-payment-amount strong') as HTMLElement)
        .textContent?.replace(/\D/g, '')
    ).toBe('30000');
    const confirmButton = fixture.nativeElement.querySelector('.checkin-payment-actions .entry-submit-button') as HTMLButtonElement;
    expect(confirmButton.disabled).toBeTrue();

    const methodButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.checkin-payment-methods button') as NodeListOf<HTMLButtonElement>,
    );
    const byLabel = (label: string) => methodButtons.find((button) => button.textContent?.includes(label))!;
    // Sin terminal POS activo, débito y crédito no se pueden elegir.
    // Deja resolver la consulta del POS (el reloj de la página impide usar whenStable).
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    expect(byLabel('Débito').disabled).toBeTrue();
    expect(byLabel('Crédito').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.checkin-payment-methods .pos-payment-hint')).toBeTruthy();

    const cashButton = byLabel('Efectivo');
    cashButton.click();
    fixture.detectChanges();
    expect(confirmButton.disabled).toBeFalse();
    await component.confirmCheckInPayment();
    fixture.detectChanges();

    const updatedReservation = hostalService.getReservations()
      .find((item) => item.id_reserva === registered.reservation.id_reserva);
    expect(updatedReservation).toEqual(jasmine.objectContaining({
      estado_reserva: 'HOSPEDADO',
      monto_pagado: 40000,
      metodo_pago: 'efectivo',
      pago_completo: true,
    }));
    expect(component.pendingCheckIns.some((item) => item.id === registered.reservation.id_reserva)).toBeFalse();
    expect(component.checkInPaymentItem).toBeNull();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows only the new-entry modal when used as a guest-page overlay', async () => {
    component.modalOnly = true;
    component.guestDraft = {
      documentType: 'rut',
      documento: '12.345.678-5',
      nombre: 'Ana',
      apellido: 'Pérez',
      telefono: '961234567',
      phoneCountry: 'cl',
      email: 'ana@example.com',
      nacionalidad: 'Chile',
    };
    component.openNewEntryForm(component.guestDraft);
    fixture.detectChanges();
    const hostalService = TestBed.inject(HostalService);
    const searchRooms = spyOn(hostalService, 'getAvailableRooms').and.callThrough();

    expect(component.showNewEntryForm).toBeTrue();
    expect(fixture.nativeElement.querySelector('.entry-modal-backdrop')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.page-title')).toBeNull();
    expect(component.entryForm.nombre).toBe('Ana');
    expect(component.entryForm.apellido).toBe('Pérez');

    const validForm = {
      valid: true,
      form: { markAllAsTouched: jasmine.createSpy('markAllAsTouched') },
    } as unknown as NgForm;
    component.goToReservationDetailsStep(validForm);
    expect(component.entryStep).toBe(2);
    const roomSearch = component.goToRoomSelectionStep(validForm);
    expect(component.isSearchingRooms).toBeTrue();
    expect(component.entryStep).toBe(3);
    await roomSearch;
    expect(component.isSearchingRooms).toBeFalse();
    expect(searchRooms).toHaveBeenCalledWith(
      component.entryForm.arrivalDate,
      component.entryForm.departureDate,
      component.entryForm.personCount,
      undefined,
      { arrivalTime: component.entryForm.arrivalTime, departureTime: component.entryForm.departureTime || '12:00' },
    );
  });

  it('shows registered guest contact details in the picker and selects the guest', () => {
    const guest: Huesped = {
      id_huesped: 17,
      id_sede: 1,
      documento: '12.345.678-5',
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chile',
      telefono: '+56 9 1234 5678',
      email: 'ana@example.com',
      es_recurrente: true,
    };
    component.availableGuests = [guest];
    component.guestCardColors.set(guest.id_huesped, 'purple');
    component.showNewEntryForm = true;
    component.guestMode = 'existing';
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.registered-guest-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();

    const option = fixture.nativeElement.querySelector('.registered-guest-option') as HTMLButtonElement;
    expect(option.textContent).toContain('AP');
    expect(option.textContent).toContain('ana@example.com');
    expect(option.textContent).toContain('+56 9 1234 5678');
    expect(option.textContent).toContain('12.345.678-5');
    expect(option.textContent).toContain('Chile');
    expect(option.textContent).toContain('Recurrente');
    expect(option.querySelector('.registered-guest-avatar')?.classList).toContain('color-purple');

    option.click();
    fixture.detectChanges();

    expect(component.selectedGuestId).toBe('17');
    expect(fixture.nativeElement.querySelector('.registered-guest-picker')).toBeNull();
    expect(fixture.nativeElement.querySelector('.registered-guest-trigger').textContent).toContain('ana@example.com');
  });

  it('shows a designed confirmation and keeps the form open when cancelled', () => {
    component.openNewEntryForm();
    component.entryForm.nombre = 'Ana';
    component.entryStep = 2;
    fixture.detectChanges();

    const closeButton = fixture.nativeElement.querySelector('.entry-footer-cancel') as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Se perderá toda la información');
    const keepButton = fixture.nativeElement.querySelector('.entry-close-keep-button') as HTMLButtonElement;
    keepButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
    expect(component.showNewEntryForm).toBeTrue();
    expect(component.entryForm.nombre).toBe('Ana');
  });

  it('closes the modal and discards its data after confirmation', () => {
    component.openNewEntryForm();
    component.entryForm.nombre = 'Ana';
    component.entryStep = 2;
    fixture.detectChanges();

    const closeButton = fixture.nativeElement.querySelector('.entry-footer-cancel') as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();
    const discardButton = fixture.nativeElement.querySelector('.entry-close-discard-button') as HTMLButtonElement;
    discardButton.click();

    expect(component.showNewEntryForm).toBeFalse();
  });

  it('opens room details with description, inventory and photo sections', () => {
    const sedeService = TestBed.inject(SedeService);
    sedeService.selectedSede.set({
      id: 1,
      nombre: 'Sede de prueba',
      ciudad: 'Santiago',
      tipologias: [{ id: 1, nombre: 'Doble', capacidad: 2, color: '#2156a7' }],
      habitaciones: [{
        id: 101,
        numero: '101',
        tipo: 'Doble',
        tipologiaId: 1,
        tamanoM2: 20,
        disposicionMuebles: 'Dos camas individuales',
        descripcion: 'Habitación con vista al patio.',
      }],
    });
    component.availableRooms = [{
      id_habitacion: 101,
      numero_habitacion: '101',
      id_hostal: 1,
      id_tipologia: 1,
    }];
    component.showNewEntryForm = true;
    component.entryStep = 3;
    fixture.detectChanges();

    const detailsButton = fixture.nativeElement.querySelector('.room-selection-details-button') as HTMLButtonElement;
    detailsButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#room-selection-detail-title')?.textContent).toContain('101');
    expect(fixture.nativeElement.textContent).toContain('Habitación con vista al patio.');
    expect(fixture.nativeElement.textContent).toContain('Inventario (0)');

    const photosTab = fixture.nativeElement.querySelector('.room-selection-detail-tabs button:last-child') as HTMLButtonElement;
    photosTab.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Esta habitación todavía no tiene fotos.');
  });

  it('calculates the stay total from applicable typology rates and the configured deposit', async () => {
    const sedeService = TestBed.inject(SedeService);
    const hostalService = TestBed.inject(HostalService);
    const sedeId = sedeService.selectedSede()!.id;
    sedeService.selectedSede.set({
      id: sedeId,
      nombre: 'Sede de prueba',
      ciudad: 'Santiago',
      tipologias: [{ id: 1, nombre: 'Doble', capacidad: 2, precioBase: 20000 }],
      habitaciones: [{
        id: 101,
        numero: '101',
        tipo: 'Doble',
        tipologiaId: 1,
        tamanoM2: 20,
        disposicionMuebles: '',
      }],
    });
    const guest = await hostalService.registerGuest({
      documento: 'PAYMENT-TEST',
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chile',
      telefono: '+56912345678',
      email: 'ana-payment@example.com',
    });
    const reservationCount = hostalService.getReservations().length;
    const registerEntry = spyOn(hostalService, 'registerEntry').and.callThrough();
    component.availableGuests = [guest];
    component.guestMode = 'existing';
    component.selectedGuestId = String(guest.id_huesped);
    component.availableRooms = [{
      id_habitacion: 101,
      numero_habitacion: '101',
      id_hostal: sedeId,
      id_tipologia: 1,
    }];
    component.entryForm.roomId = '101';
    component.entryForm.arrivalDate = '2026-10-10';
    component.entryForm.departureDate = '2026-10-12';
    component.entryStep = 3;
    tarifasConfig = { sedeId, porcentajeAbono: 35, tarifas: [{
      id: 1,
      nombre: 'Temporada de prueba',
      activa: true,
      periodos: [{
        id: 'rango-prueba',
        tipo: 'date-range',
        meses: [],
        diasSemana: [],
        diasMes: [],
        fechaInicio: '2026-10-10',
        fechaFin: '2026-10-11',
        fechas: [],
      }],
      precios: { 1: 40000 },
    }] };
    await fixture.debugElement.injector.get(TarifaPricingService).load();
    component.updateAvailableRooms();
    expect(component.availableRooms.length).toBe(1);
    expect(component.roomNightlyPrice(component.availableRooms[0])).toBe(40000);
    component.entryForm.roomId = '101';
    const validForm = {
      valid: true,
      form: { markAllAsTouched: jasmine.createSpy('markAllAsTouched') },
    } as unknown as NgForm;

    component.goToPaymentStep(validForm);

    expect(Number(component.entryStep)).toBe(4);
    expect(component.reservationQuote).toEqual({
      nights: 2,
      total: 80000,
      depositPercentage: 35,
      deposit: 28000,
      typologyName: 'Doble',
      roomNumber: '101',
      guestName: 'Ana Pérez',
    });
    expect(component.paymentAmount).toBe(28000);
    component.paymentOption = 'full';
    expect(component.paymentAmount).toBe(80000);
    expect(hostalService.getReservations().length).toBe(reservationCount);

    component.paymentOption = 'deposit';
    component.paymentMethod = 'transferencia';
    await component.registerEntry();

    expect(registerEntry).toHaveBeenCalled();
    expect(hostalService.getReservations()).toContain(jasmine.objectContaining({
      precio_total: 80000,
      porcentaje_abono: 35,
      monto_pagado: 28000,
      metodo_pago: 'transferencia',
      pago_completo: false,
    }));
  });

  it('does not show placeholder movements without reservations today', () => {
    expect(component.pendingCheckIns).toEqual([]);
    expect(component.pendingCheckOuts).toEqual([]);
  });

  it('shows check-ins and check-outs from reservations registered for today', async () => {
    const hostalService = TestBed.inject(HostalService);
    const sedeService = TestBed.inject(SedeService);
    const sedeId = sedeService.selectedSede()!.id;
    sedeService.selectedSede.set({
      id: sedeId,
      nombre: 'Sede de prueba',
      ciudad: 'Santiago',
      tipologias: [{ id: 1, nombre: 'Doble', capacidad: 2 }],
      habitaciones: ['101', '102'].map((numero, index) => ({
        id: index + 1,
        numero,
        tipo: 'Doble',
        tipologiaId: 1,
        tamanoM2: 20,
        disposicionMuebles: '',
      })),
    });
    const today = localDateString(new Date());
    const previousDay = new Date();
    previousDay.setDate(previousDay.getDate() - 1);
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    const todayReservationRooms = hostalService.getAvailableRooms(today, localDateString(nextDay));
    const checkoutReservationRooms = hostalService.getAvailableRooms(localDateString(previousDay), today);

    await hostalService.registerEntry({
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
    const checkoutReservation = await hostalService.registerEntry({
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
    await hostalService.processCheckIn(checkoutReservation.reservation.id_reserva);

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
    expect(component.entryForm.documento).toBe('1.234.567-8');

    component.formatRut('123456785');
    expect(component.entryForm.documento).toBe('12.345.678-5');

    component.formatRut('11111114');
    expect(component.entryForm.documento).toBe('1.111.111-4');
    expect(component.isValidRut(component.entryForm.documento)).toBeTrue();

    component.formatRut('1.111.111-4');
    expect(component.entryForm.documento).toBe('1.111.111-4');

    component.formatRut('1234567k');
    expect(component.entryForm.documento).toBe('1.234.567-K');

    component.formatRut('1');
    expect(component.entryForm.documento).toBe('1');
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
