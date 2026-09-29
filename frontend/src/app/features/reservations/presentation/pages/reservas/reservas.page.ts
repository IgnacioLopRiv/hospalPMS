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
import { SedeService } from '../../../../locations/application/sede.service';

export interface CategoryTheme {
  primary: string;    // Color principal (puntos, bordes principales)
  background: string; // Fondo suave para las tarjetas de reserva
  border: string;     // Borde de la tarjeta de reserva
  text: string;       // Color de la tipografía dentro del bloque
}

export interface ReservationBlock {
  id: string;
  roomNumero: string;
  guestName: string;
  startDay: number;
  durationDays: number;
  categoryName: string; // Nombre dinámico de la tipología
  isPending?: boolean;
}

export interface DayColumn {
  dayName: string;
  dayNumber: number;
  monthName: string;
  isCurrent?: boolean;
}

const STORAGE_KEY_RESERVAS = 'hospal_reservas_data';

// Paleta institucional dinámica armonizada para tarjetas y tags
const COLOR_PALETTE: CategoryTheme[] = [
  { primary: '#d97706', background: '#fffbeb', border: '#fde68a', text: '#92400e' }, // Ámbar / Dorado
  { primary: '#ea580c', background: '#fff7ed', border: '#fed7aa', text: '#9a3412' }, // Naranja
  { primary: '#059669', background: '#ecfdf5', border: '#a7f3d0', text: '#065f46' }, // Esmeralda / Verde
  { primary: '#7c3aed', background: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' }, // Violeta
  { primary: '#2563eb', background: '#eff6ff', border: '#bfdbfe', text: '#1e40af' }, // Azul
  { primary: '#db2777', background: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' }, // Rosa / Fucsia
  { primary: '#0891b2', background: '#ecfeff', border: '#a5f3fc', text: '#155e75' }, // Cian / Teal
  { primary: '#4f46e5', background: '#eef2ff', border: '#c7d2fe', text: '#3730a3' }  // Índigo
];

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

  // Genera grupos de categorías asignándoles una paleta de colores fija y determinista
  readonly categories = computed(() => {
    const habs = this.dbHabitaciones();

    if (!habs || habs.length === 0) {
      return this.getDefaultCategories();
    }

    const map = new Map<string, any[]>();
    habs.forEach((h: any) => {
      const tipo = (h.tipo || 'General').trim();
      if (!map.has(tipo)) map.set(tipo, []);
      map.get(tipo)!.push({
        id: String(h.id),
        numero: String(h.numero),
        name: `Habitación ${h.numero}`,
        tipo: tipo,
        beds: h.camas || 2
      });
    });

    return Array.from(map.entries()).map(([tipo, rooms], index) => {
      const theme = this.getThemeForName(tipo, index);
      return {
        name: tipo,
        count: rooms.length,
        theme,
        rooms
      };
    });
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

  isCategoryCollapsed(categoryName: string): boolean {
    return this.collapsedCategories().has(categoryName);
  }

  // Obtiene el tema de color para una tipología
  getThemeForName(name: string, fallbackIndex: number = 0): CategoryTheme {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLOR_PALETTE.length;
    return COLOR_PALETTE[index] || COLOR_PALETTE[fallbackIndex % COLOR_PALETTE.length];
  }

  getReservationsForRoom(roomNumero: string): ReservationBlock[] {
    return this.reservations().filter((res) => String(res.roomNumero) === String(roomNumero));
  }

  getGridColumnStart(startDay: number): number {
    const idx = this.days.findIndex((d) => d.dayNumber === startDay);
    return idx !== -1 ? idx + 1 : 1;
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
      { id: 'r1', roomNumero: '101', guestName: 'Ana Martínez', startDay: 13, durationDays: 4, categoryName: 'Suite' },
      { id: 'r2', roomNumero: '101', guestName: 'Carlos Ruiz', startDay: 19, durationDays: 3, categoryName: 'Suite' },
      { id: 'r3', roomNumero: '102', guestName: 'María González', startDay: 10, durationDays: 6, categoryName: 'Suite' },
      { id: 'r4', roomNumero: '102', guestName: 'David López', startDay: 17, durationDays: 4, categoryName: 'Suite' },
      { id: 'r5', roomNumero: '201', guestName: 'Laura García', startDay: 12, durationDays: 7, categoryName: 'Junior Suite' },
      { id: 'r6', roomNumero: '201', guestName: 'Pedro Sánchez', startDay: 20, durationDays: 2, categoryName: 'Junior Suite', isPending: true },
      { id: 'r7', roomNumero: '202', guestName: 'Isabel Torres', startDay: 9, durationDays: 3, categoryName: 'Junior Suite' },
      { id: 'r8', roomNumero: '202', guestName: 'Roberto Chen', startDay: 15, durationDays: 5, categoryName: 'Junior Suite' },
      { id: 'r9', roomNumero: '301', guestName: 'Lucía Flores', startDay: 9, durationDays: 5, categoryName: 'Doble' },
      { id: 'r10', roomNumero: '301', guestName: 'Tomás Rivera', startDay: 16, durationDays: 3, categoryName: 'Doble' },
      { id: 'r11', roomNumero: '301', guestName: 'Emma Wilson', startDay: 20, durationDays: 2, categoryName: 'Doble', isPending: true },
      { id: 'r12', roomNumero: '302', guestName: 'M. Á. Costa', startDay: 10, durationDays: 7, categoryName: 'Doble' },
      { id: 'r13', roomNumero: '302', guestName: 'Sofia Müller', startDay: 18, durationDays: 4, categoryName: 'Doble' },
      { id: 'r14', roomNumero: '303', guestName: 'Ana Pérez', startDay: 9, durationDays: 2, categoryName: 'Doble' },
      { id: 'r15', roomNumero: '303', guestName: 'Juan Díaz', startDay: 12, durationDays: 3, categoryName: 'Doble' },
      { id: 'r16', roomNumero: '303', guestName: 'Rachel Green', startDay: 16, durationDays: 5, categoryName: 'Doble' },
      { id: 'r17', roomNumero: '304', guestName: 'F. Nakamura', startDay: 13, durationDays: 7, categoryName: 'Doble' },
      { id: 'r18', roomNumero: '401', guestName: 'Alejandro Kim', startDay: 9, durationDays: 11, categoryName: 'Single' }
    ];

    this.saveReservationsToStorage(defaultData);
  }

  saveReservationsToStorage(data: ReservationBlock[]): void {
    localStorage.setItem(STORAGE_KEY_RESERVAS, JSON.stringify(data));
    this.reservations.set(data);
  }

  private getDefaultCategories() {
    const list = [
      {
        name: 'Suite',
        count: 2,
        rooms: [
          { id: '1', numero: '101', name: 'Suite 101', tipo: 'Suite', beds: 2 },
          { id: '2', numero: '102', name: 'Suite 102', tipo: 'Suite', beds: 2 }
        ]
      },
      {
        name: 'Junior Suite',
        count: 2,
        rooms: [
          { id: '3', numero: '201', name: 'Junior Suite 201', tipo: 'Junior Suite', beds: 2 },
          { id: '4', numero: '202', name: 'Junior Suite 202', tipo: 'Junior Suite', beds: 2 }
        ]
      },
      {
        name: 'Doble',
        count: 4,
        rooms: [
          { id: '5', numero: '301', name: 'Doble 301', tipo: 'Doble', beds: 2 },
          { id: '6', numero: '302', name: 'Doble 302', tipo: 'Doble', beds: 2 },
          { id: '7', numero: '303', name: 'Doble 303', tipo: 'Doble', beds: 2 },
          { id: '8', numero: '304', name: 'Doble 304', tipo: 'Doble', beds: 2 }
        ]
      },
      {
        name: 'Single',
        count: 1,
        rooms: [
          { id: '9', numero: '401', name: 'Single 401', tipo: 'Single', beds: 1 }
        ]
      }
    ];

    return list.map((cat, idx) => ({
      ...cat,
      theme: this.getThemeForName(cat.name, idx)
    }));
  }
}