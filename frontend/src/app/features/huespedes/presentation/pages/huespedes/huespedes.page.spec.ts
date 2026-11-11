import { PosRepository } from '../../../../payments-pos/domain/pos.repository';
import { createPosRepositoryStub } from '../../../../payments-pos/domain/testing/pos.repository.stub';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { HostalService } from '../../../application/hostal.service';
import { SedeService } from '../../../../locations/application/sede.service';
import { CheckPagePage } from '../../../../reservations/presentation/pages/check-page/check-page.page';
import { InventarioRepository } from '../../../../inventory/domain/inventario.repository';
import { createEmptyInventarioRepositoryStub } from '../../../../inventory/domain/testing/inventario.repository.stub';
import { TarifasRepository } from '../../../../locations/domain/tarifas.repository';
import { FotoHabitacionRepository } from '../../../../locations/domain/foto-habitacion.repository';
import { HuespedesPage } from './huespedes.page';
import { GuestCardView, GuestReservationDetail, Huesped } from '../../../../../shared/domain/hostal.model';

describe('HuespedesPage', () => {
  let component: HuespedesPage;
  let fixture: ComponentFixture<HuespedesPage>;

  beforeEach(() => {
    const hostalServiceStub = {
      guestsView$: of([]),
      getGuests: () => [],
      getGuestReservationDetails: () => [],
      getReservations: () => [],
      getReservationCalendarData: () => [],
      getAvailableRooms: () => [],
      onSedeChanged: () => undefined,
    };
    const sedeServiceStub = {
      ready: Promise.resolve(),
      selectedSede: signal(null),
      habitaciones: signal([]),
      tipologias: signal([]),
      marcarOcupada: () => undefined,
      marcarEnAseo: () => undefined,
    };

    TestBed.configureTestingModule({
      imports: [HuespedesPage],
      providers: [
        provideRouter([]),
        { provide: HostalService, useValue: hostalServiceStub },
        { provide: SedeService, useValue: sedeServiceStub },
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
            getAbono: (sedeId: number) => of({ sedeId, porcentajeAbono: 20 }),
            listTarifas: () => of([]),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(HuespedesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.classList.remove('entry-modal-open');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('filters active and inactive guests by reservation assignment', () => {
    const activeGuest = createGuestCard(1, true);
    const inactiveGuest = createGuestCard(2, false);
    component.guests = [activeGuest, inactiveGuest];

    component.setFilter('activos');
    expect(component.filteredGuests).toEqual([activeGuest]);
    expect(component.getCount('activos')).toBe(1);

    component.setFilter('inactivos');
    expect(component.filteredGuests).toEqual([inactiveGuest]);
    expect(component.getCount('inactivos')).toBe(1);
  });

  it('shows a matching status stripe and details panel for each guest state', () => {
    component.guests = [
      createGuestCard(1, true, 'confirmada'),
      createGuestCard(2, true, 'checkin_hoy'),
      createGuestCard(3, true, 'checkout_hoy'),
      createGuestCard(4, true, 'hospedado'),
      createGuestCard(5, false, 'inactivo'),
    ];
    component.applyFilters();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.guest-card') as NodeListOf<HTMLElement>;
    expect(cards.length).toBe(5);
    cards.forEach((card, index) => {
      const state = ['confirmada', 'checkin_hoy', 'checkout_hoy', 'hospedado', 'inactivo'][index];
      expect(card.classList).toContain(`status-${state}`);
      expect(card.querySelector('.guest-status-line')).toBeTruthy();
      expect(card.querySelector('.status-box')?.classList).toContain(state);
    });
  });

  it('switches from guest cards to a filtered guest list and back', () => {
    component.guests = [createGuestCard(1, true)];
    component.applyFilters();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.cards-grid')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.guest-list')).toBeNull();

    const button = fixture.nativeElement.querySelector('.huespedes-view-toggle') as HTMLButtonElement;
    expect(button.textContent).toContain('Ver');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.cards-grid')).toBeNull();
    expect(fixture.nativeElement.querySelector('.guest-list')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.guest-list tbody').textContent).toContain('Guest 1');

    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cards-grid')).toBeTruthy();
  });

  it('matches status filters against any of the guest active reservations', () => {
    const guest = { ...createGuestCard(1, true, 'hospedado'), statuses: ['hospedado', 'confirmada'] as GuestCardView['status'][], extraReservations: 1 };
    component.guests = [guest];

    component.setFilter('hospedados');
    expect(component.filteredGuests).toEqual([guest]);
    component.setFilter('checkin');
    expect(component.filteredGuests).toEqual([]);
    expect(component.getCount('hospedado')).toBe(1);
  });

  it('shows the extra reservation count and a single WhatsApp button on the card', () => {
    component.guests = [{ ...createGuestCard(1, true), phone: '+56 9 1234 5678', extraReservations: 2 }];
    component.applyFilters();
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.guest-card') as HTMLElement;
    expect(card.querySelector('.extra-reservations-badge')?.textContent?.trim()).toBe('+2');
    const actions = card.querySelectorAll('.card-actions > *');
    expect(actions.length).toBe(1);
    expect((actions[0] as HTMLAnchorElement).href).toBe('https://web.whatsapp.com/send?phone=56912345678');
    expect((actions[0] as HTMLAnchorElement).target).toBe('_blank');
  });

  it('disables the WhatsApp button when the guest has no phone', () => {
    component.guests = [createGuestCard(1, false)];
    component.applyFilters();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.card-actions .whatsapp-button') as HTMLButtonElement;
    expect(button.tagName).toBe('BUTTON');
    expect(button.disabled).toBeTrue();
  });

  it('opens the guest detail modal with active reservations and history when a card is clicked', () => {
    const guest: Huesped = {
      id_huesped: 1, id_sede: 1, documento: '12.345.678-5', nombre: 'Ana', apellido: 'Pérez',
      nacionalidad: 'Chile', telefono: '+56 912345678', email: 'ana@example.com',
    };
    const hostalService = TestBed.inject(HostalService);
    spyOn(hostalService, 'getGuests').and.returnValue([guest]);
    (hostalService as unknown as { getGuestReservationDetails: () => GuestReservationDetail[] })
      .getGuestReservationDetails = () => [
        { reservation: { id_reserva: 5, id_huesped: 1, id_habitacion: 1, fecha_llegada: '2020-01-01', fecha_salida: '2020-01-03', estado_reserva: 'FINALIZADA' }, roomNumber: '101', roomType: 'Doble', nights: 2 },
        { reservation: { id_reserva: 6, id_huesped: 1, id_habitacion: 1, fecha_llegada: '2099-01-01', fecha_salida: '2099-01-03', estado_reserva: 'CONFIRMADA' }, roomNumber: '102', roomType: 'Doble', nights: 2 },
      ];
    component.guests = [createGuestCard(1, true)];
    component.applyFilters();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.guest-card') as HTMLElement).click();
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('.guest-detail-modal') as HTMLElement;
    expect(modal).toBeTruthy();
    expect(modal.querySelector('#guest-detail-title')?.textContent).toContain('Ana Pérez');
    expect(modal.querySelectorAll('.guest-reservation-item:not(.is-past)').length).toBe(1);
    expect(modal.querySelectorAll('.guest-reservation-item.is-past').length).toBe(1);
    expect(modal.textContent).toContain('01/01/2099');
    expect(document.body.classList).toContain('entry-modal-open');

    component.closeGuestDetail();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.guest-detail-modal')).toBeNull();
    expect(document.body.classList).not.toContain('entry-modal-open');
  });

  it('has no options menu on cards and deletes the guest from the detail modal', () => {
    spyOn(TestBed.inject(HostalService), 'getGuests').and.returnValue([{
      id_huesped: 1, id_sede: 1, documento: '12.345.678-5', nombre: 'Ana', apellido: 'Pérez',
      nacionalidad: 'Chile', telefono: '+56 912345678', email: 'ana@example.com',
    }]);
    component.guests = [createGuestCard(1, true)];
    component.applyFilters();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.guest-card .menu-icon')).toBeNull();
    (fixture.nativeElement.querySelector('.guest-card') as HTMLElement).click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.guest-detail-delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.guestDetail).toBeNull();
    expect(component.deletingGuestId).toBe(1);
    component.cancelGuestDeletion();
  });

  it('opens the new-entry modal without leaving the guest page and keeps the guest draft', () => {
    const router = TestBed.inject(Router);
    const navigation = spyOn(router, 'navigate');
    component.openNewGuestForm();
    component.guestForm = {
      documentType: 'rut',
      documento: '12.345.678-5',
      nombre: 'Ana',
      apellido: 'Pérez',
      telefono: '912345678',
      phoneCountry: 'cl',
      email: 'ana@example.com',
      nacionalidad: 'Chile',
    };
    fixture.detectChanges();

    const assignButton = fixture.nativeElement.querySelector('.assign-reservation-button') as HTMLButtonElement;
    assignButton.click();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(navigation).not.toHaveBeenCalled();
    expect(component.showReservationAssignment).toBeTrue();
    const entryPage = fixture.debugElement.query(By.directive(CheckPagePage)).componentInstance as CheckPagePage;
    expect(fixture.nativeElement.querySelector('.entry-modal-backdrop #entry-modal-title')?.textContent).toContain('Nuevo ingreso');
    expect(fixture.nativeElement.querySelector('.check-page-container .page-title')).toBeNull();
    expect(entryPage.entryForm.nombre).toBe('Ana');
    expect(entryPage.entryForm.apellido).toBe('Pérez');

    const cancelButton = fixture.nativeElement.querySelector('app-check-page .entry-cancel-button') as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.showReservationAssignment).toBeFalse();
    expect(fixture.nativeElement.querySelector('#guest-modal-title')).toBeTruthy();
    expect(component.guestForm.nombre).toBe('Ana');
    expect(component.guestForm.apellido).toBe('Pérez');
  });

  it('opens reservation assignment for a registered guest at the reservation details step', () => {
    const guest: Huesped = {
      id_huesped: 77,
      id_sede: 1,
      documento: 'GUEST-77',
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chile',
      telefono: '+56 9 1234 5678',
      email: 'ana@example.com',
    };
    component.guests = [createGuestCard(guest.id_huesped, false)];
    component.applyFilters();
    spyOn(TestBed.inject(HostalService), 'getGuests').and.returnValue([guest]);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.guest-card') as HTMLElement).click();
    fixture.detectChanges();
    const assignButton = Array.from(
      fixture.nativeElement.querySelectorAll('.guest-detail-modal .entry-form-actions button') as NodeListOf<HTMLButtonElement>
    ).find((button) => button.textContent?.includes('Asignar reserva'));
    expect(assignButton).toBeDefined();
    assignButton!.click();
    fixture.detectChanges();
    fixture.detectChanges();

    const entryPage = fixture.debugElement.query(By.directive(CheckPagePage)).componentInstance as CheckPagePage;
    expect(component.showReservationAssignment).toBeTrue();
    expect(entryPage.showNewEntryForm).toBeTrue();
    expect(entryPage.entryStep).toBe(2);
    expect(entryPage.guestMode).toBe('existing');
    expect(entryPage.selectedGuestId).toBe(String(guest.id_huesped));

    entryPage.closeNewEntryForm();
  });
});

function createGuestCard(
  id: number,
  hasReservation: boolean,
  status: GuestCardView['status'] = hasReservation ? 'hospedado' : 'inactivo'
): GuestCardView {
  return {
    id_huesped: id,
    hasReservation,
    initials: 'AG',
    guestName: `Guest ${id}`,
    country: 'Chile',
    roomNumber: hasReservation ? '101' : '',
    roomType: hasReservation ? 'Tipo gestionado' : 'Sin habitación asignada',
    dateRange: hasReservation ? '06/16 → 06/20' : 'Sin reserva asignada',
    status,
    statusBadge: status.toUpperCase(),
    cardColor: 'blue',
    metric1Label: hasReservation ? 'Lleva' : 'Reserva',
    metric1Value: hasReservation ? '1 noche' : 'No asignada',
    metric2Label: hasReservation ? 'Sale en' : 'Estado',
    metric2Value: hasReservation ? '4 noches' : 'Inactivo',
  };
}
