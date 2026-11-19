import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, cardOutline, cashOutline, closeOutline, swapHorizontalOutline } from 'ionicons/icons';
import { EscapeCloseDirective } from '../../../../../../shared/presentation/modal-portal/escape-close.directive';
import { ModalPortalDirective } from '../../../../../../shared/presentation/modal-portal/modal-portal.directive';
import { RoomPickerComponent } from '../../../../../../shared/presentation/room-picker/room-picker.component';
import { getApiErrorMessage } from '../../../../../../shared/domain/api-error-message';
import { Habitacion, Reserva, SedeTipologia } from '../../../../../../shared/domain/hostal.model';
import { SedeService } from '../../../../../locations/application/sede.service';
import { HostalService } from '../../../../../huespedes/application/hostal.service';
import { PosCobroService, PosDisponible } from '../../../../../payments-pos/application/pos-cobro.service';
import { PosCobroEstadoComponent } from '../../../../../payments-pos/presentation/pos-cobro-estado/pos-cobro-estado.component';
import { TarifaPricingService } from '../tarifa-pricing.service';
import { addDays, chargedNights, daysBetween, formatDayMonth, todayKey } from '../check-dates';
import {
  chargeWithPos,
  CheckItemPlaceholder,
  CheckModalResult,
  isCardMethod,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  roomBlockedReason,
} from '../check-page.models';

/** Modal de Recepción para extender la estadía de un huésped (con cambio de habitación opcional). */
@Component({
  selector: 'app-extend-stay-modal',
  templateUrl: './extend-stay-modal.component.html',
  styleUrls: ['./extend-stay-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, EscapeCloseDirective, ModalPortalDirective, RoomPickerComponent, PosCobroEstadoComponent],
})
export class ExtendStayModalComponent implements OnInit {
  private readonly sedeService = inject(SedeService);
  private readonly hostalService = inject(HostalService);
  private readonly pricing = inject(TarifaPricingService);
  readonly posCobro = inject(PosCobroService);

  @Input({ required: true }) extendItem!: CheckItemPlaceholder;
  @Output() closed = new EventEmitter<void>();
  @Output() completed = new EventEmitter<CheckModalResult>();

  readonly sedeTipologias = this.sedeService.tipologias;
  /** Opciones rápidas de extensión, en noches. */
  readonly extendNightOptions = [1, 2, 3, 7];
  extendReservation: Reserva | null = null;
  extendTypology: SedeTipologia | null = null;
  extendNights = 0;
  extendCustomDate = '';
  extendPaymentMethod: PaymentMethod | '' = '';
  extendError = '';
  extendSaving = false;
  extendLoading = false;
  /** Mantener la habitación actual (por defecto) o mudar al huésped a otra para la extensión. */
  extendKeepRoom = true;
  extendRoomId = '';
  posDisponible: PosDisponible | null = null;
  posLoading = false;
  private extendPaidByPos: number | null = null;

  constructor() {
    addIcons({ calendarOutline, cardOutline, cashOutline, closeOutline, swapHorizontalOutline });
  }

  async ngOnInit(): Promise<void> {
    const reservation = this.hostalService.getReservations().find((r) => r.id_reserva === this.extendItem.id) ?? null;
    const room = this.sedeService.habitaciones().find((h) => h.id === reservation?.id_habitacion);
    this.extendTypology = this.sedeService.tipologias().find((t) => t.id === room?.tipologiaId) ?? null;
    this.extendReservation = reservation;
    this.posCobro.reset();
    if (!reservation) {
      this.extendError = 'La reserva ya no existe. Actualiza la lista e inténtalo otra vez.';
      return;
    }
    this.extendLoading = true;
    try {
      await Promise.all([this.pricing.load(), this.loadPosDisponible()]);
    } catch (error) {
      this.extendError = getApiErrorMessage(error, 'No se pudieron cargar las tarifas.');
    } finally {
      this.extendLoading = false;
    }
  }

  isCardMethod(method: PaymentMethod | ''): boolean {
    return isCardMethod(method);
  }

  /** Habitaciones libres para toda la estadía extendida (sin la actual), listas para recibir al huésped. */
  get extendRoomOptions(): Habitacion[] {
    const reservation = this.extendReservation;
    if (!reservation || this.extendNights < 1) return [];
    const rooms = this.sedeService.habitaciones();
    return this.hostalService
      .getAvailableRooms(
        reservation.fecha_llegada,
        addDays(reservation.fecha_salida, this.extendNights),
        reservation.cantidad_personas,
        reservation.id_reserva,
        { arrivalTime: reservation.hora_llegada, departureTime: reservation.hora_salida },
      )
      .filter((room) => room.id_habitacion !== reservation.id_habitacion && !roomBlockedReason(rooms, room.numero_habitacion));
  }

  /** Habitación nueva elegida (solo si se desmarcó "mantener la habitación"). */
  get extendNewRoom(): Habitacion | null {
    if (this.extendKeepRoom || !this.extendRoomId) return null;
    return this.extendRoomOptions.find((room) => room.id_habitacion === Number(this.extendRoomId)) ?? null;
  }

  /** Tipología con la que se cobran las noches extra: la de la habitación nueva, si se cambia. */
  private get extendPricingTypology(): SedeTipologia | null {
    const newRoom = this.extendNewRoom;
    if (!newRoom) return this.extendTypology;
    return this.sedeService.tipologias().find((t) => t.id === newRoom.id_tipologia) ?? null;
  }

  setExtendKeepRoom(keep: boolean): void {
    this.extendKeepRoom = keep;
    this.extendRoomId = '';
    if (this.extendNights > 0) this.extendError = this.extendBlockedReason(this.extendNights) ?? '';
  }

  /** Si la habitación elegida deja de estar libre con las nuevas noches, se limpia la selección. */
  private syncExtendRoomSelection(): void {
    if (this.extendRoomId && !this.extendNewRoom) this.extendRoomId = '';
  }

  /** Nueva fecha de salida según las noches elegidas (o la fecha personalizada). */
  get extendNewDeparture(): string {
    if (!this.extendReservation || this.extendNights < 1) return '';
    return addDays(this.extendReservation.fecha_salida, this.extendNights);
  }

  /** Costo de las noches extra según las tarifas vigentes; null si falta precio. */
  get extendCost(): number | null {
    const reservation = this.extendReservation;
    const typology = this.extendPricingTypology;
    if (!reservation || !typology || this.extendNights < 1) return null;
    return this.pricing.priceNights(typology, reservation.fecha_salida, this.extendNights);
  }

  /**
   * Si se cambia de habitación a mitad de estadía, las noches que quedan (desde hoy hasta la
   * salida actual) se recalculan con la tipología nueva: puede sumar o restar. 0 si no hay cambio.
   */
  get extendRoomChangeDelta(): number | null {
    const reservation = this.extendReservation;
    const newRoom = this.extendNewRoom;
    if (!reservation || !newRoom) return 0;
    const today = todayKey();
    const from = reservation.fecha_llegada > today ? reservation.fecha_llegada : today;
    const remaining = Math.max(0, daysBetween(from, reservation.fecha_salida));
    return this.pricing.roomSwapDelta(reservation.id_habitacion, newRoom.id_tipologia, from, remaining);
  }

  /** Nuevo total de la estadía con la extensión (y el ajuste por cambio de habitación). */
  get extendNewTotal(): number {
    return Math.max(0, (this.extendReservation?.precio_total ?? 0) + (this.extendCost ?? 0) + (this.extendRoomChangeDelta ?? 0));
  }

  /** Lo que se cobra ahora: nuevo total menos lo ya pagado (incluye saldo previo, si lo hubiera). */
  get extendAmountDue(): number {
    return Math.max(0, this.extendNewTotal - (this.extendReservation?.monto_pagado ?? 0));
  }

  closeExtendStay(): void {
    if (this.extendSaving || this.posCobro.enCurso()) return;
    this.posCobro.reset();
    this.closed.emit();
  }

  /** La habitación sigue libre si se extiende la salida esa cantidad de noches. */
  canExtendBy(nights: number): boolean {
    return this.extendBlockedReason(nights) === null;
  }

  /** Motivo por el que no se puede extender esa cantidad de noches, o null si se puede. */
  extendBlockedReason(nights: number): string | null {
    const reservation = this.extendReservation;
    if (!reservation || nights < 1) return 'Elige cuántas noches quieres extender.';
    // Estadía atrasada: la nueva salida no puede quedar en el pasado.
    if (addDays(reservation.fecha_salida, nights) < todayKey()) {
      return 'La nueva salida no puede quedar en el pasado.';
    }
    // Si se cambia de habitación, la actual puede estar tomada: la disponibilidad se valida con la nueva.
    if (!this.extendKeepRoom) return null;
    const free = this.hostalService
      .getAvailableRooms(
        reservation.fecha_llegada,
        addDays(reservation.fecha_salida, nights),
        reservation.cantidad_personas,
        reservation.id_reserva,
        { arrivalTime: reservation.hora_llegada, departureTime: reservation.hora_salida },
      )
      .some((room) => room.id_habitacion === reservation.id_habitacion);
    return free ? null : `La habitación ${this.extendItem.roomNumber} tiene otra reserva en esas fechas. Desmarca "Mantener la habitación" para elegir otra.`;
  }

  selectExtendNights(nights: number): void {
    if (this.extendSaving || this.posCobro.enCurso()) return;
    this.extendNights = nights;
    this.extendCustomDate = '';
    this.extendError = this.extendBlockedReason(nights) ?? '';
    this.syncExtendRoomSelection();
  }

  onExtendCustomDate(value: string): void {
    this.extendCustomDate = value;
    const reservation = this.extendReservation;
    if (!reservation || !value) {
      this.extendNights = 0;
      return;
    }
    const nights = daysBetween(reservation.fecha_salida, value);
    if (nights < 1) {
      this.extendNights = 0;
      this.extendError = 'La nueva salida debe ser posterior a la salida actual.';
      return;
    }
    this.extendNights = nights;
    this.extendError = this.extendBlockedReason(nights) ?? '';
    this.syncExtendRoomSelection();
  }

  get extendMinCustomDate(): string {
    if (!this.extendReservation) return '';
    const next = addDays(this.extendReservation.fecha_salida, 1);
    const today = todayKey();
    return next > today ? next : today;
  }

  async confirmExtendStay(): Promise<void> {
    const item = this.extendItem;
    const reservation = this.extendReservation;
    if (!reservation || this.extendNights < 1) {
      this.extendError = 'Elige cuántas noches quieres extender.';
      return;
    }
    const blocked = this.extendBlockedReason(this.extendNights);
    if (blocked) {
      this.extendError = blocked;
      return;
    }
    const newRoom = this.extendNewRoom;
    if (!this.extendKeepRoom && !newRoom) {
      this.extendError = 'Elige la nueva habitación.';
      return;
    }
    const cost = this.extendCost;
    if (cost === null || this.extendRoomChangeDelta === null) {
      this.extendError = `Configura un precio para la tipología ${this.extendPricingTypology?.nombre ?? 'de la habitación'} en /tarifas antes de extender.`;
      return;
    }
    const amount = this.extendAmountDue;
    if (amount > 0 && this.extendPaymentMethod === '') {
      this.extendError = 'Selecciona el medio de pago de la extensión.';
      return;
    }
    if (this.posCobro.enCurso()) return;
    this.extendError = '';
    this.extendSaving = true;

    let method = this.extendPaymentMethod;
    // Con tarjeta se cobra primero en el terminal (registra el pago); luego se guarda la nueva salida.
    if (amount > 0 && isCardMethod(method) && this.extendPaidByPos !== reservation.id_reserva) {
      const used = await chargeWithPos(this.posCobro, this.posDisponible, reservation.id_reserva, amount, 'PAGO_FINAL', method);
      if (!used) {
        this.extendSaving = false;
        this.extendError = 'La extensión no se cobró. Reintenta o elige otro medio de pago.';
        return;
      }
      method = used;
      this.extendPaidByPos = reservation.id_reserva;
    }

    const newDeparture = this.extendNewDeparture;
    const previouslyPaid = reservation.monto_pagado ?? 0;
    const newTotal = this.extendNewTotal;
    const nightsLabel = `${this.extendNights} ${this.extendNights === 1 ? 'noche' : 'noches'}`;
    try {
      const saved = await this.hostalService.extendStay(reservation.id_reserva, {
        newDeparture,
        newTotal,
        amount,
        method: method || undefined,
        roomId: newRoom?.id_habitacion,
      });
      // Cambio de habitación: la anterior queda en aseo y la nueva pasa a ocupada.
      if (newRoom) {
        await this.sedeService.marcarEnAseo(item.roomNumber);
        await this.sedeService.marcarOcupada(newRoom.numero_habitacion, item.guestName);
      }
      const roomNumber = newRoom?.numero_habitacion ?? item.roomNumber;
      const typologyName = newRoom ? (this.extendPricingTypology?.nombre ?? item.roomType) : item.roomType;
      const message = `Estadía de ${item.guestName} extendida ${nightsLabel}: nueva salida ${formatDayMonth(newDeparture)}.`
        + (newRoom ? ` Se cambió a la habitación ${roomNumber}; la ${item.roomNumber} quedó en aseo.` : '');
      const result: CheckModalResult = { message };
      if (amount > 0 && method) {
        result.receipt = {
          subtitle: `Extensión de estadía · ${nightsLabel} más`,
          guestName: item.guestName,
          roomNumber,
          typologyName,
          arrivalDate: saved.fecha_llegada,
          arrivalTime: saved.hora_llegada ?? '',
          departureDate: saved.fecha_salida,
          departureTime: saved.hora_salida ?? '',
          nights: chargedNights(saved.fecha_llegada, saved.fecha_salida),
          personCount: saved.cantidad_personas ?? 1,
          total: newTotal,
          previouslyPaid,
          paid: amount,
          pending: 0,
          methodLabel: PAYMENT_METHOD_LABELS[method],
          reference: (isCardMethod(method) ? this.posCobro.transaccion()?.externalReference : null) || `Reserva #${reservation.id_reserva}`,
          paidAt: new Date(),
        };
      }
      this.extendPaidByPos = null;
      this.extendSaving = false;
      this.posCobro.reset();
      this.completed.emit(result);
    } catch (error) {
      this.extendSaving = false;
      this.extendError = getApiErrorMessage(error, 'No se pudo extender la estadía.')
        + (this.extendPaidByPos === reservation.id_reserva ? ' El cobro con tarjeta ya quedó registrado: reintenta sin volver a cobrar.' : '');
    }
  }

  private async loadPosDisponible(): Promise<void> {
    const sedeId = this.sedeService.selectedSede()?.id;
    this.posDisponible = null;
    if (!sedeId) return;
    this.posLoading = true;
    try {
      this.posDisponible = await this.posCobro.posDisponible(sedeId);
    } finally {
      this.posLoading = false;
    }
  }
}
