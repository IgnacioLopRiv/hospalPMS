import { Component, computed, effect, HostListener, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  analyticsOutline,
  barChartOutline,
  bedOutline,
  businessOutline,
  calendarOutline,
  cashOutline,
  closeCircleOutline,
  closeOutline,
  downloadOutline,
  funnelOutline,
  informationCircleOutline,
  layersOutline,
  pricetagOutline,
  receiptOutline,
  refreshOutline,
  searchOutline,
  sparklesOutline,
  trendingDownOutline,
  trendingUpOutline,
  walletOutline,
} from 'ionicons/icons';
import { SedeService } from '../../../../locations/application/sede.service';
import { Tarifa, TarifasRepository } from '../../../../locations/domain/tarifas.repository';
import { HuespedRepository } from '../../../../huespedes/domain/huesped.repository';
import { ReservasRepository } from '../../../../reservations/domain/reservas.repository';
import { Reserva, Sede } from '../../../../../shared/domain/hostal.model';
import {
  buildTransacciones,
  calcularKpis,
  ClienteTransaccion,
  DATE_PRESETS,
  DatePreset,
  daysInclusive,
  EMPTY_KPIS,
  ESTADO_PAGO_LABELS,
  EstadoPagoTransaccion,
  filtrarTransacciones,
  METODO_PAGO_LABELS,
  MetodoPagoFiltro,
  presetRange,
  rankingMetodosPago,
  rankingTarifas,
  rankingTipologias,
  shiftDateKey,
  TIPO_TARIFA_LABELS,
  TipoTarifaAplicada,
  TipoTarifaFiltro,
  TransaccionTarifa,
  transaccionesToCsv,
} from '../../../domain/reporte-transacciones';

const PAGE_SIZE = 15;
const DEFAULT_ABONO_PORCENTAJE = 20;
type AlcanceReporte = 'sede' | 'global';

interface DatosSede {
  sedeId: number;
  reservas: Reserva[];
  clientes: ClienteTransaccion[];
  tarifas: Tarifa[];
  abonoPorcentaje: number;
}

type VistaRanking = 'tipologias' | 'tarifas' | 'pagos';
const ESTADOS_PAGO: EstadoPagoTransaccion[] = ['PAGADO', 'ABONADO', 'PENDIENTE', 'ANULADO'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonIcon]
})
export class ReportesPage {
  private readonly sedeService = inject(SedeService);
  private readonly reservasRepository = inject(ReservasRepository);
  private readonly huespedRepository = inject(HuespedRepository);
  private readonly tarifasRepository = inject(TarifasRepository);
  private cargaActual = '';

  readonly sede = this.sedeService.selectedSede;
  readonly sedes = this.sedeService.sedes;

  // ----- Alcance: sede actual o todas las sedes -----
  readonly alcance = signal<AlcanceReporte>('sede');
  readonly esGlobal = computed(() => this.alcance() === 'global');
  /** Sedes incluidas en el reporte según el alcance elegido. */
  readonly sedesReporte = computed<Sede[]>(() => {
    if (this.esGlobal()) return this.sedes();
    const actual = this.sede();
    return actual ? [actual] : [];
  });

  // ----- Datos operacionales -----
  readonly datosSedes = signal<DatosSede[]>([]);
  readonly operacionesLoading = signal(false);
  readonly operacionesError = signal('');

  // ----- Filtros -----
  readonly datePresets = DATE_PRESETS;
  readonly preset = signal<DatePreset>('mes-actual');
  readonly fechaInicio = signal(presetRange('mes-actual').inicio);
  readonly fechaFin = signal(presetRange('mes-actual').fin);
  readonly tipoTarifaFiltro = signal<TipoTarifaFiltro>('TODAS');
  readonly metodoPagoFiltro = signal<MetodoPagoFiltro>('TODOS');
  readonly busqueda = signal('');
  readonly limiteFilas = signal(PAGE_SIZE);
  readonly transaccionSeleccionada = signal<TransaccionTarifa | null>(null);

  readonly rangoValido = computed(() => !!this.fechaInicio() && !!this.fechaFin() && this.fechaInicio() <= this.fechaFin());
  readonly diasPeriodo = computed(() => this.rangoValido() ? daysInclusive(this.fechaInicio(), this.fechaFin()) : 0);

  readonly transacciones = computed(() => {
    const sedes = new Map(this.sedesReporte().map((sede) => [sede.id, sede]));
    return this.datosSedes().flatMap((datos) => {
      const sede = sedes.get(datos.sedeId);
      if (!sede) return [];
      return buildTransacciones(datos.reservas, {
        tarifas: datos.tarifas,
        tipologias: sede.tipologias ?? [],
        habitaciones: sede.habitaciones ?? [],
        clientes: datos.clientes,
        abonoPorDefecto: datos.abonoPorcentaje,
      }).map((trx) => ({ ...trx, sede: sede.nombre }));
    });
  });

  readonly totalHabitaciones = computed(() => this.sedesReporte()
    .reduce((sum, sede) => sum + (sede.habitaciones?.length ?? 0), 0));
  readonly tipologiasReporte = computed(() => this.sedesReporte().flatMap((sede) => sede.tipologias ?? []));

  readonly transaccionesPeriodo = computed(() => {
    if (!this.rangoValido()) return [];
    const inicio = this.fechaInicio();
    const fin = this.fechaFin();
    return this.transacciones().filter((trx) => trx.llegada >= inicio && trx.llegada <= fin);
  });

  // ----- Indicadores del período -----
  readonly kpis = computed(() => this.rangoValido()
    ? calcularKpis(this.transacciones(), this.fechaInicio(), this.fechaFin(), this.totalHabitaciones())
    : EMPTY_KPIS);

  readonly kpisAnteriores = computed(() => {
    if (!this.rangoValido()) return EMPTY_KPIS;
    const fin = shiftDateKey(this.fechaInicio(), -1);
    const inicio = shiftDateKey(fin, -(this.diasPeriodo() - 1));
    return calcularKpis(this.transacciones(), inicio, fin, this.totalHabitaciones());
  });

  // ----- Demanda por habitación y tarifa -----
  readonly vistasRanking: { value: VistaRanking; label: string; icon: string }[] = [
    { value: 'tipologias', label: 'Tipologías', icon: 'bed-outline' },
    { value: 'tarifas', label: 'Tarifas', icon: 'layers-outline' },
    { value: 'pagos', label: 'Medios de pago', icon: 'wallet-outline' },
  ];
  readonly vistaRanking = signal<VistaRanking>('tipologias');
  readonly tipologiasPopulares = computed(() => rankingTipologias(this.transaccionesPeriodo(), this.tipologiasReporte(), { agruparPorNombre: this.esGlobal() }));
  readonly tarifasMasAplicadas = computed(() => rankingTarifas(this.transaccionesPeriodo()));
  readonly metodosPagoRanking = computed(() => rankingMetodosPago(this.transaccionesPeriodo()));

  // ----- Historial -----
  readonly transaccionesFiltradas = computed(() => filtrarTransacciones(this.transaccionesPeriodo(), {
    tipo: this.tipoTarifaFiltro(),
    metodo: this.metodoPagoFiltro(),
    busqueda: this.busqueda(),
  }));
  readonly transaccionesVisibles = computed(() => this.transaccionesFiltradas().slice(0, this.limiteFilas()));
  readonly totalFiltrado = computed(() => this.transaccionesFiltradas()
    .filter((trx) => trx.estadoReserva !== 'CANCELADA')
    .reduce((sum, trx) => sum + trx.total, 0));
  readonly resumenEstados = computed(() => ESTADOS_PAGO.map((estado) => {
    const items = this.transaccionesFiltradas().filter((trx) => trx.estadoPago === estado);
    return { estado, cantidad: items.length, monto: items.reduce((sum, trx) => sum + trx.total, 0) };
  }));
  readonly filtrosActivos = computed(() =>
    (this.tipoTarifaFiltro() !== 'TODAS' ? 1 : 0)
    + (this.metodoPagoFiltro() !== 'TODOS' ? 1 : 0)
    + (this.busqueda().trim() ? 1 : 0));

  constructor() {
    addIcons({
      alertCircleOutline,
      analyticsOutline,
      barChartOutline,
      bedOutline,
      businessOutline,
      calendarOutline,
      cashOutline,
      closeCircleOutline,
      closeOutline,
      downloadOutline,
      funnelOutline,
      informationCircleOutline,
      layersOutline,
      pricetagOutline,
      receiptOutline,
      refreshOutline,
      searchOutline,
      sparklesOutline,
      trendingDownOutline,
      trendingUpOutline,
      walletOutline,
    });

    effect(() => {
      const alcance = this.alcance();
      const sedeIds = this.sedesReporte().map((sede) => sede.id);
      untracked(() => this.cargarOperaciones(alcance, sedeIds));
    });
  }

  reloadOperaciones(): void {
    this.cargarOperaciones(this.alcance(), this.sedesReporte().map((sede) => sede.id), true);
  }

  setAlcance(alcance: AlcanceReporte): void {
    this.alcance.set(alcance);
    this.limiteFilas.set(PAGE_SIZE);
  }

  // ----- Filtros -----

  applyPreset(preset: DatePreset): void {
    this.preset.set(preset);
    if (preset === 'personalizado') return;
    const range = presetRange(preset);
    this.fechaInicio.set(range.inicio);
    this.fechaFin.set(range.fin);
    this.limiteFilas.set(PAGE_SIZE);
  }

  setFechaInicio(value: string): void {
    this.preset.set('personalizado');
    this.fechaInicio.set(value);
    this.limiteFilas.set(PAGE_SIZE);
  }

  setFechaFin(value: string): void {
    this.preset.set('personalizado');
    this.fechaFin.set(value);
    this.limiteFilas.set(PAGE_SIZE);
  }

  setTipoTarifaFiltro(value: TipoTarifaFiltro): void {
    this.tipoTarifaFiltro.set(value);
    this.limiteFilas.set(PAGE_SIZE);
  }

  setMetodoPagoFiltro(value: MetodoPagoFiltro): void {
    this.metodoPagoFiltro.set(value);
    this.limiteFilas.set(PAGE_SIZE);
  }

  setBusqueda(value: string): void {
    this.busqueda.set(value ?? '');
    this.limiteFilas.set(PAGE_SIZE);
  }

  limpiarFiltros(): void {
    this.tipoTarifaFiltro.set('TODAS');
    this.metodoPagoFiltro.set('TODOS');
    this.busqueda.set('');
    this.limiteFilas.set(PAGE_SIZE);
  }

  mostrarMas(): void {
    this.limiteFilas.update((limit) => limit + PAGE_SIZE);
  }

  // ----- Detalle -----

  openDetalle(trx: TransaccionTarifa): void {
    this.transaccionSeleccionada.set(trx);
  }

  closeDetalle(): void {
    this.transaccionSeleccionada.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.transaccionSeleccionada()) this.closeDetalle();
  }

  exportarReporte(): void {
    const csv = transaccionesToCsv(this.transaccionesFiltradas());
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const nombre = this.esGlobal() ? 'todas las sedes' : this.sede()?.nombre ?? 'sede';
    const sedeName = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.href = url;
    link.download = `reporte-${sedeName}-${this.fechaInicio()}_${this.fechaFin()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // ----- Presentación -----

  delta(actual: number, anterior: number): number | null {
    if (!anterior) return actual ? null : 0;
    return ((actual - anterior) / anterior) * 100;
  }

  tipoTarifaLabel(tipo: TipoTarifaAplicada): string {
    return TIPO_TARIFA_LABELS[tipo];
  }

  estadoPagoLabel(estado: EstadoPagoTransaccion): string {
    return ESTADO_PAGO_LABELS[estado];
  }

  metodoPagoLabel(metodo: TransaccionTarifa['metodoPago']): string {
    return METODO_PAGO_LABELS[metodo ?? 'sin-registro'];
  }

  formatFecha(value: string): string {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    return `${String(day).padStart(2, '0')} ${MONTHS_SHORT[month - 1]} ${year}`;
  }

  periodoLabel(): string {
    if (!this.rangoValido()) return 'Rango inválido';
    return `${this.formatFecha(this.fechaInicio())} – ${this.formatFecha(this.fechaFin())}`;
  }

  formatMoney(value: number | null | undefined): string {
    return `$${Math.round(value ?? 0).toLocaleString('es-CL')}`;
  }

  private cargarOperaciones(alcance: AlcanceReporte, sedeIds: number[], forzar = false): void {
    const clave = `${alcance}:${sedeIds.join(',')}`;
    if (!forzar && clave === this.cargaActual) return;
    this.cargaActual = clave;
    if (sedeIds.length === 0) {
      this.datosSedes.set([]);
      this.operacionesLoading.set(false);
      this.operacionesError.set(alcance === 'global'
        ? 'No hay sedes registradas en el sistema.'
        : 'Selecciona una sede para ver los reportes.');
      return;
    }
    void this.loadOperaciones(sedeIds, clave);
  }

  private async loadOperaciones(sedeIds: number[], clave: string): Promise<void> {
    this.operacionesLoading.set(true);
    this.operacionesError.set('');
    try {
      const datos = await Promise.all(sedeIds.map((sedeId) => this.loadDatosSede(sedeId)));
      if (this.cargaActual !== clave) return;
      this.datosSedes.set(datos);
    } catch (error) {
      console.error('No se pudieron cargar las transacciones.', error);
      if (this.cargaActual === clave) {
        this.datosSedes.set([]);
        this.operacionesError.set(sedeIds.length > 1
          ? 'No se pudieron cargar las reservas y cobros de todas las sedes.'
          : 'No se pudieron cargar las reservas y cobros de esta sede.');
      }
    } finally {
      if (this.cargaActual === clave) this.operacionesLoading.set(false);
    }
  }

  private async loadDatosSede(sedeId: number): Promise<DatosSede> {
    const [reservas, clientes, tarifas, abono] = await Promise.all([
      firstValueFrom(this.reservasRepository.listBySede(sedeId)),
      firstValueFrom(this.huespedRepository.list(sedeId)).catch(() => []),
      firstValueFrom(this.tarifasRepository.listTarifas(sedeId)).catch(() => [] as Tarifa[]),
      firstValueFrom(this.tarifasRepository.getAbono(sedeId)).catch(() => null),
    ]);
    return {
      sedeId,
      reservas,
      clientes,
      tarifas,
      abonoPorcentaje: abono?.porcentajeAbono ?? DEFAULT_ABONO_PORCENTAJE,
    };
  }
}
