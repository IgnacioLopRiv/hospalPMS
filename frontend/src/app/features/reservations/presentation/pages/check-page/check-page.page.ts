import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  enterOutline,
  exitOutline,
  bedOutline,
  calendarOutline,
  timeOutline,
  peopleOutline,
  star,
  callOutline,
  mailOutline,
  logInOutline,
  logOutOutline,
  ellipsisVerticalOutline,
  informationCircleOutline,
  checkmarkCircleOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';
import { SedeService } from '../../../../locations/application/sede.service';

export interface CheckItemPlaceholder {
  id: number;
  guestName: string;
  initials: string;
  country: string;
  phone?: string;
  email?: string;
  roomNumber: string;
  roomType: string;
  dateRange: string;
  nights: number;
  scheduledTime: string;
  timeWindowLabel: string;
  statusBadge: string;
  avatarColor: 'green' | 'orange' | 'blue' | 'purple';
  notes?: string;
  isVip?: boolean;
}

@Component({
  selector: 'app-check-page',
  templateUrl: './check-page.page.html',
  styleUrls: ['./check-page.page.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon],
})
export class CheckPagePage {
  private readonly sedeService = inject(SedeService);

  readonly sede = this.sedeService.selectedSede;

  readonly currentDateFormatted = 'Martes, 16 de junio de 2026';

  /** Check-ins pendientes para hoy (placeholder de diseño) */
  readonly pendingCheckIns: CheckItemPlaceholder[] = [
    {
      id: 1,
      guestName: 'Marco Diaz',
      initials: 'MD',
      country: 'Colombia',
      phone: '+57 300 123 4567',
      email: 'm.diaz@email.com',
      roomNumber: '101',
      roomType: 'Habitación Privada',
      dateRange: '16/06 → 20/06',
      nights: 4,
      scheduledTime: '14:30 hrs',
      timeWindowLabel: 'Llegada estimada',
      statusBadge: 'Pendiente',
      avatarColor: 'green',
      notes: 'Solicitó check-in anticipado',
      isVip: true,
    },
    {
      id: 2,
      guestName: 'Priya Nair',
      initials: 'PN',
      country: 'India',
      phone: '+91 980 000 1122',
      email: 'p.nair@email.com',
      roomNumber: '102',
      roomType: 'Habitación Privada',
      dateRange: '16/06 → 18/06',
      nights: 2,
      scheduledTime: '16:00 hrs',
      timeWindowLabel: 'Llegada estimada',
      statusBadge: 'Confirmado',
      avatarColor: 'purple',
      notes: 'Huésped recurrente',
    },
    {
      id: 3,
      guestName: 'Ethan Brown',
      initials: 'EB',
      country: 'EE.UU.',
      phone: '+1 555 234 5678',
      email: 'e.brown@email.com',
      roomNumber: '104',
      roomType: 'Habitación Privada',
      dateRange: '16/06 → 21/06',
      nights: 5,
      scheduledTime: '18:15 hrs',
      timeWindowLabel: 'Llegada estimada',
      statusBadge: 'En camino',
      avatarColor: 'blue',
      notes: 'Vuelo con retraso estimado 30 min',
    },
  ];

  /** Check-outs pendientes para hoy (placeholder de diseño) */
  readonly pendingCheckOuts: CheckItemPlaceholder[] = [
    {
      id: 4,
      guestName: 'Alejandro Schmidt',
      initials: 'AS',
      country: 'Alemania',
      phone: '+49 150 789 0123',
      email: 'a.schmidt@email.com',
      roomNumber: '308',
      roomType: 'Dorm 2-camas',
      dateRange: '12/06 → 16/06',
      nights: 4,
      scheduledTime: '11:00 hrs',
      timeWindowLabel: 'Salida límite',
      statusBadge: 'Por salir',
      avatarColor: 'orange',
      notes: 'Debe entregar llaves en recepción',
      isVip: true,
    },
    {
      id: 5,
      guestName: 'James Okonkwo',
      initials: 'JO',
      country: 'Nigeria',
      phone: '+234 800 456 7890',
      email: 'j.okonkwo@email.com',
      roomNumber: '207',
      roomType: 'Dorm 4-camas',
      dateRange: '13/06 → 16/06',
      nights: 3,
      scheduledTime: '12:00 hrs',
      timeWindowLabel: 'Late check-out',
      statusBadge: 'Autorizado',
      avatarColor: 'purple',
      notes: 'Late check-out acordado con recepción',
    },
  ];

  readonly totalRoomsInvolved = computed(() => {
    const rooms = new Set<string>();
    this.pendingCheckIns.forEach((c) => rooms.add(c.roomNumber));
    this.pendingCheckOuts.forEach((c) => rooms.add(c.roomNumber));
    return rooms.size;
  });

  constructor() {
    addIcons({
      enterOutline,
      exitOutline,
      bedOutline,
      calendarOutline,
      timeOutline,
      peopleOutline,
      star,
      callOutline,
      mailOutline,
      logInOutline,
      logOutOutline,
      ellipsisVerticalOutline,
      informationCircleOutline,
      checkmarkCircleOutline,
      swapHorizontalOutline,
    });
  }
}