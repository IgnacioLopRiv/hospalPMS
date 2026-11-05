import {
  Component,
  OnInit,
  DestroyRef,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { timeOutline, calendarOutline } from 'ionicons/icons';

export function useEffect(
  effectCallback: () => void | (() => void),
  destroyRef?: DestroyRef
): void {
  const ref = destroyRef ?? inject(DestroyRef);
  const cleanup = effectCallback();
  if (typeof cleanup === 'function') {
    ref.onDestroy(cleanup);
  }
}

@Component({
  selector: 'app-clock',
  templateUrl: './clock.component.html',
  styleUrls: ['./clock.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon],
})
export class ClockComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Señal reactiva que almacena la instancia actual de Date.
   */
  readonly now = signal<Date>(new Date());

  /**
   * Hora actual formateada en vivo (HH:mm:ss).
   */
  readonly formattedTime = computed(() => {
    const d = this.now();
    return d.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  });

  /**
   * Fecha actual formateada (ej. "Lun, 28 Sep 2026").
   */
  readonly formattedDate = computed(() => {
    const d = this.now();
    const weekday = d.toLocaleDateString('es-CL', { weekday: 'short' });
    const day = d.getDate();
    const month = d.toLocaleDateString('es-CL', { month: 'short' });
    const year = d.getFullYear();

    const capitalize = (text: string) => {
      if (!text) return '';
      const clean = text.replace('.', '');
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    };

    return `${capitalize(weekday)}, ${day} ${capitalize(month)} ${year}`;
  });

  constructor() {
    addIcons({ timeOutline, calendarOutline });

    // Uso de hook useEffect con setInterval y objeto Date
    useEffect(() => {
      const intervalId = setInterval(() => {
        this.now.set(new Date());
      }, 1000);

      return () => {
        clearInterval(intervalId);
      };
    }, this.destroyRef);
  }

  ngOnInit(): void {
    // Sincronización inicial con la fecha/hora en vivo
    this.now.set(new Date());
  }
}
