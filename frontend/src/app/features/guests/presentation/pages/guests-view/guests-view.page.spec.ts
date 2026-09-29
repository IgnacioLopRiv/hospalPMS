import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { GuestsViewPage } from './guests-view.page';
import { GuestCardView } from '../../../../../shared/domain/hostal.model';

describe('GuestsViewPage', () => {
  let component: GuestsViewPage;
  let fixture: ComponentFixture<GuestsViewPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GuestsViewPage],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(GuestsViewPage);
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

  it('switches between guest cards and the guest list', () => {
    component.guests = [createGuestCard(1, true)];
    component.applyFilters();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.cards-grid')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.guest-list')).toBeNull();

    const viewButton = fixture.nativeElement.querySelector('.view-toggle-button') as HTMLButtonElement;
    expect(viewButton.textContent).toContain('Ver');
    viewButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.cards-grid')).toBeNull();
    expect(fixture.nativeElement.querySelector('.guest-list')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.guest-list tbody').textContent).toContain('Guest 1');

    viewButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cards-grid')).toBeTruthy();
  });

  it('shows a status-colored top line on each guest card', () => {
    const statuses: GuestCardView['status'][] = [
      'confirmada',
      'inactivo',
      'checkin_hoy',
      'checkout_hoy',
      'hospedado',
    ];
    component.filteredGuests = statuses.map((status, index) => ({
      ...createGuestCard(index + 1, status !== 'inactivo'),
      status,
    }));
    fixture.detectChanges();

    const lines = fixture.nativeElement.querySelectorAll('.guest-status-line') as NodeListOf<HTMLElement>;
    expect(Array.from(lines).map((line) => statuses.find((status) =>
      line.classList.contains(`status-${status}`)
    ))).toEqual(statuses);

    const cards = fixture.nativeElement.querySelectorAll('.guest-card') as NodeListOf<HTMLElement>;
    expect(Array.from(cards).map((card) => statuses.find((status) =>
      card.classList.contains(`status-${status}`)
    ))).toEqual(statuses);
  });

  it('navigates to check-page with the guest draft for reservation assignment', async () => {
    const router = TestBed.inject(Router);
    const navigation = spyOn(router, 'navigate').and.resolveTo(true);
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
    component.openNewGuestForm();

    await component.assignReservation();

    expect(navigation).toHaveBeenCalledWith(['/check-page'], {
      state: {
        guestDraft: {
          documentType: 'rut',
          documento: '12.345.678-5',
          nombre: 'Ana',
          apellido: 'Pérez',
          telefono: '912345678',
          phoneCountry: 'cl',
          email: 'ana@example.com',
          nacionalidad: 'Chile',
        },
      },
    });
    expect(component.showNewGuestForm).toBeFalse();
    component.ngOnDestroy();
    expect(document.body.classList.contains('entry-modal-open')).toBeTrue();
  });
});

function createGuestCard(id: number, hasReservation: boolean): GuestCardView {
  return {
    id_huesped: id,
    hasReservation,
    initials: 'AG',
    guestName: `Guest ${id}`,
    country: 'Chile',
    roomNumber: hasReservation ? '101' : '',
    roomType: hasReservation ? 'Habitación Privada' : 'Sin habitación asignada',
    dateRange: hasReservation ? '06/16 → 06/20' : 'Sin reserva asignada',
    status: hasReservation ? 'hospedado' : 'inactivo',
    statusBadge: hasReservation ? 'HOSPEDADO' : 'INACTIVO',
    cardColor: 'blue',
    metric1Label: hasReservation ? 'Lleva' : 'Reserva',
    metric1Value: hasReservation ? '1 noche' : 'No asignada',
    metric2Label: hasReservation ? 'Sale en' : 'Estado',
    metric2Value: hasReservation ? '4 noches' : 'Inactivo',
  };
}
