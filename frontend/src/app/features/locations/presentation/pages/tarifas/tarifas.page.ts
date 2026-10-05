import {
  Component,
  OnInit,
  OnDestroy,
  DestroyRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  sunnyOutline,
  snowOutline,
  calendarOutline,
  timeOutline,
  pricetagOutline,
  cashOutline,
  settingsOutline,
  closeOutline,
  checkmarkOutline,
  informationCircleOutline,
  sparklesOutline,
  trendingUpOutline,
  trendingDownOutline,
} from 'ionicons/icons';
import { SedeService, SedeTipologia } from '../../../application/sede.service';
import { useEffect } from '../../../../../shared/presentation/clock/clock.component';

/** Meses del año (índice 0 = Enero) */
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Tarifa por tipología para una temporada */
export interface TarifaTipologia {
  tipologiaId: number;
  nombre: string;
  color: string;
  capacidad: number;
  precioBase: number;
}

/** Configuración completa de tarifas de temporada */
export interface ConfigTarifas {
  /** Meses de temporada alta (0-indexed: 0=Enero, 11=Diciembre) */
  mesesAlta: number[];
  tarifasAlta: Record<number, number>;   // tipologiaId → precio noche
  abonoPctAlta: number;                  // 1-100
  tarifasBaja: Record<number, number>;
  abonoPctBaja: number;
}

const TARIFAS_STORAGE_KEY = 'hospal.tarifas';

const DEFAULT_CONFIG: ConfigTarifas = {
  mesesAlta: [0, 1, 6, 7, 11],   // Enero, Febrero, Julio, Agosto, Diciembre
  tarifasAlta: {},
  abonoPctAlta: 30,
  tarifasBaja: {},
  abonoPctBaja: 20,
};

@Component({
  selector: 'app-tarifas',
  templateUrl: './tarifas.page.html',
  styleUrls: ['./tarifas.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon],
})
export class TarifasPage implements OnInit, OnDestroy {
  private readonly sedeService = inject(SedeService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Señales de datos ────────────────────────────────────────────────────────
  readonly sede = this.sedeService.selectedSede;
  readonly tipologias = this.sedeService.tipologias;

  /** Reloj en vivo (se actualiza cada segundo) */
  readonly now = signal<Date>(new Date());

  /** Configuración de tarifas */
  readonly config = signal<ConfigTarifas>(this.loadConfig());

  /** Modal de configuración abierto */
  readonly configOpen = signal(false);

  /** Copia editable de la configuración (dentro del modal) */
  editConfig: ConfigTarifas = { ...DEFAULT_CONFIG };

  // ── Computados ──────────────────────────────────────────────────────────────

  /** Mes actual (0-indexed) */
  readonly currentMonth = computed(() => this.now().getMonth());

  /** ¿Es temporada alta ahora? */
  readonly isHighSeason = computed(() =>
    this.config().mesesAlta.includes(this.currentMonth())
  );

  /** Tarifas de temporada alta con datos de tipología */
  readonly tarifasAlta = computed<TarifaTipologia[]>(() => {
    const cfg = this.config();
    return this.tipologias().map((t) => ({
      tipologiaId: t.id,
      nombre: t.nombre,
      color: t.color ?? '#6366f1',
      capacidad: t.capacidad,
      precioBase: cfg.tarifasAlta[t.id] ?? t.precioBase ?? 0,
    }));
  });

  /** Tarifas de temporada baja con datos de tipología */
  readonly tarifasBaja = computed<TarifaTipologia[]>(() => {
    const cfg = this.config();
    return this.tipologias().map((t) => ({
      tipologiaId: t.id,
      nombre: t.nombre,
      color: t.color ?? '#6366f1',
      capacidad: t.capacidad,
      precioBase: cfg.tarifasBaja[t.id] ?? t.precioBase ?? 0,
    }));
  });

  /** Meses de temporada baja (complemento de alta) */
  readonly mesesBaja = computed(() =>
    Array.from({ length: 12 }, (_, i) => i).filter(
      (m) => !this.config().mesesAlta.includes(m)
    )
  );

  /** Nombres de meses para la UI */
  readonly monthNames = MONTH_NAMES;

  constructor() {
    addIcons({
      sunnyOutline,
      snowOutline,
      calendarOutline,
      timeOutline,
      pricetagOutline,
      cashOutline,
      settingsOutline,
      closeOutline,
      checkmarkOutline,
      informationCircleOutline,
      sparklesOutline,
      trendingUpOutline,
      trendingDownOutline,
    });

    // Reloj en vivo — se actualiza cada segundo
    useEffect(() => {
      const id = setInterval(() => this.now.set(new Date()), 1000);
      return () => clearInterval(id);
    }, this.destroyRef);
  }

  ngOnInit(): void {
    this.now.set(new Date());
  }

  ngOnDestroy(): void {}

  // ── Modal de configuración ──────────────────────────────────────────────────

  openConfig(): void {
    const cfg = this.config();
    this.editConfig = {
      mesesAlta: [...cfg.mesesAlta],
      tarifasAlta: { ...cfg.tarifasAlta },
      abonoPctAlta: cfg.abonoPctAlta,
      tarifasBaja: { ...cfg.tarifasBaja },
      abonoPctBaja: cfg.abonoPctBaja,
    };
    this.configOpen.set(true);
  }

  closeConfig(): void {
    this.configOpen.set(false);
  }

  saveConfig(): void {
    const saved: ConfigTarifas = {
      mesesAlta: [...this.editConfig.mesesAlta],
      tarifasAlta: { ...this.editConfig.tarifasAlta },
      abonoPctAlta: Math.max(1, Math.min(100, this.editConfig.abonoPctAlta)),
      tarifasBaja: { ...this.editConfig.tarifasBaja },
      abonoPctBaja: Math.max(1, Math.min(100, this.editConfig.abonoPctBaja)),
    };
    this.config.set(saved);
    this.persistConfig(saved);
    this.configOpen.set(false);
  }

  toggleMesAlta(mes: number): void {
    const idx = this.editConfig.mesesAlta.indexOf(mes);
    if (idx >= 0) {
      this.editConfig.mesesAlta = this.editConfig.mesesAlta.filter((m) => m !== mes);
    } else {
      this.editConfig.mesesAlta = [...this.editConfig.mesesAlta, mes].sort((a, b) => a - b);
    }
  }

  isMesAlta(mes: number): boolean {
    return this.editConfig.mesesAlta.includes(mes);
  }

  getEditPrecioAlta(tipologiaId: number): number {
    const tipologia = this.tipologias().find((t) => t.id === tipologiaId);
    return this.editConfig.tarifasAlta[tipologiaId] ?? tipologia?.precioBase ?? 0;
  }

  setEditPrecioAlta(tipologiaId: number, valor: number): void {
    this.editConfig.tarifasAlta = { ...this.editConfig.tarifasAlta, [tipologiaId]: Math.max(0, valor) };
  }

  getEditPrecioBaja(tipologiaId: number): number {
    const tipologia = this.tipologias().find((t) => t.id === tipologiaId);
    return this.editConfig.tarifasBaja[tipologiaId] ?? tipologia?.precioBase ?? 0;
  }

  setEditPrecioBaja(tipologiaId: number, valor: number): void {
    this.editConfig.tarifasBaja = { ...this.editConfig.tarifasBaja, [tipologiaId]: Math.max(0, valor) };
  }

  monthName(idx: number): string {
    return MONTH_NAMES[idx] ?? '';
  }

  // ── Persistencia ────────────────────────────────────────────────────────────

  private loadConfig(): ConfigTarifas {
    try {
      const raw = localStorage.getItem(TARIFAS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConfigTarifas;
        return {
          mesesAlta: Array.isArray(parsed.mesesAlta) ? parsed.mesesAlta : DEFAULT_CONFIG.mesesAlta,
          tarifasAlta: parsed.tarifasAlta ?? {},
          abonoPctAlta: Number(parsed.abonoPctAlta) || DEFAULT_CONFIG.abonoPctAlta,
          tarifasBaja: parsed.tarifasBaja ?? {},
          abonoPctBaja: Number(parsed.abonoPctBaja) || DEFAULT_CONFIG.abonoPctBaja,
        };
      }
    } catch {
      // fallback al default
    }
    return { ...DEFAULT_CONFIG };
  }

  private persistConfig(cfg: ConfigTarifas): void {
    try {
      localStorage.setItem(TARIFAS_STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      // ignorar error de almacenamiento
    }
  }
}
