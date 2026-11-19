import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { EscapeCloseDirective } from '../../../../../../shared/presentation/modal-portal/escape-close.directive';
import { ModalPortalDirective } from '../../../../../../shared/presentation/modal-portal/modal-portal.directive';
import { RoomPickerComponent } from '../../../../../../shared/presentation/room-picker/room-picker.component';
import { getApiErrorMessage } from '../../../../../../shared/domain/api-error-message';
import { Habitacion, Reserva } from '../../../../../../shared/domain/hostal.model';
import { SedeService } from '../../../../../locations/application/sede.service';
import { HostalService } from '../../../../../huespedes/application/hostal.service';
import { TarifaPricingService } from '../tarifa-pricing.service';
import { chargedNights } from '../check-dates';
import { CheckItemPlaceholder, CheckModalResult, roomBlockedReason } from '../check-page.models';

/** Modal de Recepción para mover una reserva pendiente de check-in a otra habitación libre. */
@Component({
  selector: 'app-room-change-modal',
  templateUrl: './room-change-modal.component.html',
  styleUrls: ['./room-change-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, EscapeCloseDirective, ModalPortalDirective, RoomPickerComponent],
})
export class RoomChangeModalComponent implements OnInit {
  private readonly sedeService = inject(SedeService);
  private readonly hostalService = inject(HostalService);
  private readonly pricing = inject(TarifaPricingService);

  @Input({ required: true }) roomChangeItem!: CheckItemPlaceholder;
  @Output() closed = new EventEmitter<void>();
  @Output() completed = new EventEmitter<CheckModalResult>();

  readonly sedeTipologias = this.sedeService.tipologias;
  roomChangeOptions: Habitacion[] = [];
  roomChangeRoomId = '';
  roomChangeError = '';
  roomChangeSaving = false;
  roomChangeLoading = false;
  roomChangeReservation: Reserva | null = null;

  constructor() {
    addIcons({ closeOutline });
  }

  async ngOnInit(): Promise<void> {
    const reservation = this.hostalService.getReservations().find((r) => r.id_reserva === this.roomChangeItem.id);
    if (!reservation) {
      this.roomChangeError = 'La reserva ya no existe. Actualiza la lista e inténtalo otra vez.';
      return;
    }
    this.roomChangeReservation = reservation;
    const rooms = this.sedeService.habitaciones();
    this.roomChangeOptions = this.hostalService
      .getAvailableRooms(
        reservation.fecha_llegada,
        reservation.fecha_salida,
        reservation.cantidad_personas,
        reservation.id_reserva,
        { arrivalTime: reservation.hora_llegada, departureTime: reservation.hora_salida },
      )
      .filter((room) => room.id_habitacion !== reservation.id_habitacion && !roomBlockedReason(rooms, room.numero_habitacion));
    // Las tarifas hacen falta para recalcular el total con la nueva tipología.
    this.roomChangeLoading = true;
    try {
      await this.pricing.load();
    } catch (error) {
      this.roomChangeError = getApiErrorMessage(error, 'No se pudieron cargar las tarifas.');
    } finally {
      this.roomChangeLoading = false;
    }
  }

  /**
   * Total y saldo de la reserva si se cambia a la habitación elegida. La diferencia de tarifa
   * entre tipologías se suma al total actual (así se respetan descuentos o ajustes previos).
   * balance < 0 significa saldo a favor del huésped. null si falta un precio.
   */
  get roomChangeQuote(): { delta: number; newTotal: number; paid: number; balance: number } | null {
    const reservation = this.roomChangeReservation;
    const newRoom = this.roomChangeOptions.find((room) => room.id_habitacion === Number(this.roomChangeRoomId));
    if (!reservation || !newRoom) return null;
    const nights = chargedNights(reservation.fecha_llegada, reservation.fecha_salida);
    const delta = this.pricing.roomSwapDelta(reservation.id_habitacion, newRoom.id_tipologia, reservation.fecha_llegada, nights);
    if (delta === null) return null;
    const newTotal = Math.max(0, (reservation.precio_total ?? 0) + delta);
    const paid = reservation.monto_pagado ?? 0;
    return { delta, newTotal, paid, balance: newTotal - paid };
  }

  closeRoomChange(): void {
    if (this.roomChangeSaving) return;
    this.closed.emit();
  }

  async confirmRoomChange(): Promise<void> {
    const item = this.roomChangeItem;
    const roomId = Number(this.roomChangeRoomId);
    if (!roomId) {
      this.roomChangeError = 'Selecciona la nueva habitación.';
      return;
    }
    const reservation = this.hostalService.getReservations().find((r) => r.id_reserva === item.id);
    if (!reservation) {
      this.roomChangeError = 'La reserva ya no existe.';
      return;
    }
    const quote = this.roomChangeQuote;
    if (!quote) {
      this.roomChangeError = 'Configura el precio de la tipología de esa habitación en /tarifas antes de cambiarla.';
      return;
    }
    this.roomChangeSaving = true;
    try {
      await this.hostalService.updateReservation(item.id, {
        id_habitacion: roomId,
        fecha_llegada: reservation.fecha_llegada,
        fecha_salida: reservation.fecha_salida,
        hora_llegada: reservation.hora_llegada ?? item.scheduledTime,
        hora_salida: reservation.hora_salida,
        cantidad_personas: reservation.cantidad_personas ?? 1,
        precio_total: quote.newTotal,
        pago_completo: quote.paid >= quote.newTotal,
      });
      const newRoom = this.roomChangeOptions.find((room) => room.id_habitacion === roomId);
      const money = (value: number) => `$${Math.abs(value).toLocaleString('es-CL')}`;
      const balanceNote = quote.balance > 0
        ? ` Nuevo total ${money(quote.newTotal)}: quedan ${money(quote.balance)} por cobrar en el check-in.`
        : quote.balance < 0
          ? ` Nuevo total ${money(quote.newTotal)}: el huésped tiene ${money(quote.balance)} a favor.`
          : ` Nuevo total ${money(quote.newTotal)}: la reserva queda pagada.`;
      this.roomChangeSaving = false;
      this.completed.emit({
        message: `${item.guestName} ahora está asignado a la habitación ${newRoom?.numero_habitacion ?? roomId}.${balanceNote}`,
      });
    } catch (error) {
      this.roomChangeSaving = false;
      this.roomChangeError = getApiErrorMessage(error, 'No se pudo cambiar la habitación.');
    }
  }
}
