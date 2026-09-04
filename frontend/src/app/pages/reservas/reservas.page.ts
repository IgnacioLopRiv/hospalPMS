import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  chevronDownOutline,
  calendarOutline,
  logInOutline,
  logOutOutline,
  bedOutline
} from 'ionicons/icons';
import { SedeService } from '../../services/sede.service';

export interface ReservationBlock {
  id: string;
  roomNumero: string;
  guestName: string;
  startDay: number;
  durationDays: number;
  category: 'suite' | 'junior' | 'doble' | 'single';
  isPending?: boolean;
}

export interface DayColumn {
  dayName: string;
  dayNumber: number;
  monthName: string;
  isCurrent?: boolean;
}

const STORAGE_KEY_RESERVAS = 'hospal_reservas_data';

@Component({
  selector: 'app-reservas',
  templateUrl: './reservas.page.html',
  styleUrls: ['./reservas.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon]
})
export class ReservasPage implements OnInit {
  private readonly sedeService = inject(SedeService);

  readonly sede = this.sedeService.selectedSede;
  readonly dbHabitaciones = this.sedeService.habitaciones;

  readonly reservations = signal<ReservationBlock[]>([]);

  // Set reactivo para controlar qué categorías están contraídas
  readonly collapsedCategories = signal<Set<string>>(new Set<string>());

  readonly days: DayColumn[] = [
    { dayName: 'MAR', dayNumber: 9, monthName: 'Jun' },
    { dayName: 'MIÉ', dayNumber: 10, monthName: 'Jun' },
    { dayName: 'JUE', dayNumber: 11, monthName: 'Jun' },
    { dayName: 'VIE', dayNumber: 12, monthName: 'Jun' },
    { dayName: 'SÁB', dayNumber: 13, monthName: 'Jun' },
    { dayName: 'DOM', dayNumber: 14, monthName: 'Jun' },
    { dayName: 'LUN', dayNumber: 15, monthName: 'Jun' },
    { dayName: 'MAR', dayNumber: 16, monthName: 'Jun', isCurrent: true },
    { dayName: 'MIÉ', dayNumber: 17, monthName: 'Jun' },
    { dayName: 'JUE', dayNumber: 18, monthName: 'Jun' },
    { dayName: 'VIE', dayNumber: 19, monthName: 'Jun' },
    { dayName: 'SÁB', dayNumber: 20, monthName: 'Jun' },
    { dayName: 'DOM', dayNumber: 21, monthName: 'Jun' },
    { dayName: 'LUN', dayNumber: 22, monthName: 'Jun' }
  ];

  readonly categories = computed(() => {
    const habs = this.dbHabitaciones();

    if (!habs || habs.length === 0) {
      return this.getDefaultCategories();
    }

    const map = new Map<string, any[]>();
    habs.forEach((h: any) => {
      const tipo = (h.tipo || 'DOBLE').toUpperCase();
      if (!map.has(tipo)) map.set(tipo, []);
      map.get(tipo)!.push({
        id: String(h.id),
        numero: String(h.numero),
        name: `Habitación ${h.numero}`,
        beds: h.camas || (tipo.includes('SINGLE') ? 1 : 2)
      });
    });

    return Array.from(map.entries()).map(([tipo, rooms]) => ({
      name: tipo,
      count: rooms.length,
      colorClass: this.resolveColorClass(tipo),
      rooms
    }));
  });

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      chevronDownOutline,
      calendarOutline,
      logInOutline,
      logOutOutline,
      bedOutline
    });
  }

  ngOnInit(): void {
    this.loadReservationsFromStorage();
  }

  // Alterna la categoría en el Set
  toggleCategory(categoryName: string): void {
    this.collapsedCategories.update((set) => {
      const updated = new Set(set);
      if (updated.has(categoryName)) {
        updated.delete(categoryName);
      } else {
        updated.add(categoryName);
      }
      return updated;
    });
  }

  // Comprueba si una categoría está contraída
  isCategoryCollapsed(categoryName: string): boolean {
    return this.collapsedCategories().has(categoryName);
  }

  private loadReservationsFromStorage(): void {
    const rawData = localStorage.getItem(STORAGE_KEY_RESERVAS);
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        this.reservations.set(parsed);
        return;
      } catch (e) {
        console.error('Error al parsear reservas de localStorage', e);
      }
    }

    const defaultData: ReservationBlock[] = [
      { id: 'r1', roomNumero: '101', guestName: 'Ana Martínez', startDay: 13, durationDays: 4, category: 'suite' },
      { id: 'r2', roomNumero: '101', guestName: 'Carlos Ruiz', startDay: 19, durationDays: 3, category: 'suite' },
      { id: 'r3', roomNumero: '102', guestName: 'María González', startDay: 10, durationDays: 6, category: 'suite' },
      { id: 'r4', roomNumero: '102', guestName: 'David López', startDay: 17, durationDays: 4, category: 'suite' },
      { id: 'r5', roomNumero: '201', guestName: 'Laura García', startDay: 12, durationDays: 7, category: 'junior' },
      { id: 'r6', roomNumero: '201', guestName: 'Pedro Sánchez', startDay: 20, durationDays: 2, category: 'junior', isPending: true },
      { id: 'r7', roomNumero: '202', guestName: 'Isabel Torres', startDay: 9, durationDays: 3, category: 'junior' },
      { id: 'r8', roomNumero: '202', guestName: 'Roberto Chen', startDay: 15, durationDays: 5, category: 'junior' },
      { id: 'r9', roomNumero: '301', guestName: 'Lucía Flores', startDay: 9, durationDays: 5, category: 'doble' },
      { id: 'r10', roomNumero: '301', guestName: 'Tomás Rivera', startDay: 16, durationDays: 3, category: 'doble' },
      { id: 'r11', roomNumero: '301', guestName: 'Emma Wilson', startDay: 20, durationDays: 2, category: 'doble', isPending: true },
      { id: 'r12', roomNumero: '302', guestName: 'M. Á. Costa', startDay: 10, durationDays: 7, category: 'doble' },
      { id: 'r13', roomNumero: '302', guestName: 'Sofia Müller', startDay: 18, durationDays: 4, category: 'doble' },
      { id: 'r14', roomNumero: '303', guestName: 'Ana Pérez', startDay: 9, durationDays: 2, category: 'doble' },
      { id: 'r15', roomNumero: '303', guestName: 'Juan Díaz', startDay: 12, durationDays: 3, category: 'doble' },
      { id: 'r16', roomNumero: '303', guestName: 'Rachel Green', startDay: 16, durationDays: 5, category: 'doble' },
      { id: 'r17', roomNumero: '304', guestName: 'F. Nakamura', startDay: 13, durationDays: 7, category: 'doble' },
      { id: 'r18', roomNumero: '401', guestName: 'Alejandro Kim', startDay: 9, durationDays: 11, category: 'single' }
    ];

    this.saveReservationsToStorage(defaultData);
  }

  saveReservationsToStorage(data: ReservationBlock[]): void {
    localStorage.setItem(STORAGE_KEY_RESERVAS, JSON.stringify(data));
    this.reservations.set(data);
  }

  getReservationsForRoom(roomNumero: string): ReservationBlock[] {
    return this.reservations().filter((res) => String(res.roomNumero) === String(roomNumero));
  }

  getGridColumnStart(startDay: number): number {
    const idx = this.days.findIndex((d) => d.dayNumber === startDay);
    return idx !== -1 ? idx + 1 : 1;
  }

  private resolveColorClass(tipo: string): string {
    const t = tipo.toLowerCase();
    if (t.includes('junior')) return 'junior';
    if (t.includes('suite')) return 'suite';
    if (t.includes('single')) return 'single';
    return 'doble';
  }

  private getDefaultCategories() {
    return [
      {
        name: 'SUITE',
        count: 2,
        colorClass: 'suite',
        rooms: [
          { id: '1', numero: '101', name: 'Suite 101', beds: 2 },
          { id: '2', numero: '102', name: 'Suite 102', beds: 2 }
        ]
      },
      {
        name: 'JUNIOR SUITE',
        count: 2,
        colorClass: 'junior',
        rooms: [
          { id: '3', numero: '201', name: 'Junior Suite 201', beds: 2 },
          { id: '4', numero: '202', name: 'Junior Suite 202', beds: 2 }
        ]
      },
      {
        name: 'DOBLE',
        count: 4,
        colorClass: 'doble',
        rooms: [
          { id: '5', numero: '301', name: 'Doble 301', beds: 2 },
          { id: '6', numero: '302', name: 'Doble 302', beds: 2 },
          { id: '7', numero: '303', name: 'Doble 303', beds: 2 },
          { id: '8', numero: '304', name: 'Doble 304', beds: 2 }
        ]
      },
      {
        name: 'SINGLE',
        count: 1,
        colorClass: 'single',
        rooms: [
          { id: '9', numero: '401', name: 'Single 401', beds: 1 }
        ]
      }
    ];
  }
}