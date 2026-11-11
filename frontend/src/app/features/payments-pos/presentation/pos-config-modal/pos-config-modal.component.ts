import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { IonIcon, IonModal } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  cardOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  closeOutline,
  flashOutline,
  informationCircleOutline,
  refreshOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';

import { SedeService } from '../../../locations/application/sede.service';
import { POS_LOCAL_DRIVERS } from '../../domain/pos-local-driver';
import { PosProviderPickerComponent } from '../pos-provider-picker/pos-provider-picker.component';
import {
  PosConfig,
  PosConfigField,
  PosConfigInput,
  PosDevice,
  PosProviderInfo,
  PosRepository,
  PosTestResult,
} from '../../domain/pos.repository';

type FieldValue = string | boolean;

@Component({
  selector: 'app-pos-config-modal',
  templateUrl: './pos-config-modal.component.html',
  styleUrls: ['./pos-config-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonModal, IonIcon, PosProviderPickerComponent],
})
export class PosConfigModalComponent {
  private readonly repository = inject(PosRepository);
  private readonly sedeService = inject(SedeService);
  private readonly localDrivers = inject(POS_LOCAL_DRIVERS, { optional: true }) ?? [];

  readonly isOpen = input(false);
  readonly closed = output<void>();

  readonly sedes = this.sedeService.sedes;
  readonly sedeId = signal<number | null>(null);

  readonly providers = signal<PosProviderInfo[]>([]);
  readonly savedConfig = signal<PosConfig | null>(null);
  readonly proveedor = signal<string | null>(null);
  readonly activo = signal(false);
  readonly values = signal<Record<string, FieldValue>>({});

  readonly devices = signal<PosDevice[] | null>(null);
  readonly devicesLoading = signal(false);
  readonly devicesError = signal('');

  readonly testResult = signal<PosTestResult | null>(null);
  readonly testing = signal(false);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly selectedProvider = computed(
    () => this.providers().find((provider) => provider.code === this.proveedor()) ?? null,
  );
  readonly fields = computed(() => this.selectedProvider()?.campos ?? []);
  /** Proveedor cuyo terminal se conecta a este PC mediante un agente local. */
  readonly isLocal = computed(() => this.selectedProvider()?.modo === 'local');
  private readonly localDriver = computed(() => {
    const code = this.proveedor();
    return this.localDrivers.find((driver) => driver.code === code) ?? null;
  });
  readonly hasDeviceField = computed(() => this.fields().some((field) => field.type === 'device'));
  /** Las credenciales enmascaradas solo valen si el proveedor guardado es el elegido. */
  readonly savedSecrets = computed(() => {
    const config = this.savedConfig();
    return config && config.proveedor === this.proveedor() ? config.credenciales : {};
  });

  constructor() {
    addIcons({
      alertCircleOutline,
      cardOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      closeOutline,
      flashOutline,
      informationCircleOutline,
      refreshOutline,
    });
  }

  async onWillPresent(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    const sedeId = this.sedeService.selectedSede()?.id ?? this.sedes()[0]?.id ?? null;
    this.sedeId.set(sedeId);
    this.loading.set(true);
    try {
      if (this.providers().length === 0) {
        this.providers.set(await firstValueFrom(this.repository.listProviders()));
      }
      await this.loadConfig();
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'No se pudo cargar la configuración del POS.'));
    } finally {
      this.loading.set(false);
    }
  }

  async changeSede(value: string): Promise<void> {
    this.sedeId.set(Number(value));
    this.errorMessage.set('');
    this.successMessage.set('');
    this.loading.set(true);
    try {
      await this.loadConfig();
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'No se pudo cargar la configuración del POS.'));
    } finally {
      this.loading.set(false);
    }
  }

  selectProvider(code: string): void {
    if (code === this.proveedor()) return;
    this.proveedor.set(code);
    const config = this.savedConfig();
    this.values.set(config?.proveedor === code ? this.valuesFrom(config) : {});
    this.resetChecks();
  }

  setValue(key: string, value: FieldValue): void {
    this.values.update((current) => ({ ...current, [key]: value }));
    // Un cambio de credenciales invalida la prueba anterior.
    const field = this.fields().find((item) => item.key === key);
    if (field?.type === 'secret') this.resetChecks();
  }

  stringValue(key: string): string {
    const value = this.values()[key];
    return typeof value === 'string' ? value : '';
  }

  boolValue(key: string): boolean {
    return this.values()[key] === true;
  }

  secretPlaceholder(field: PosConfigField): string {
    const saved = this.savedSecrets()[field.key];
    return saved ? `Guardado (${saved}). Déjalo vacío para mantenerlo.` : field.placeholder ?? '';
  }

  async testConnection(): Promise<void> {
    const sedeId = this.sedeId();
    const input = this.buildInput();
    if (sedeId === null || !input) return;
    this.testing.set(true);
    this.testResult.set(null);
    try {
      if (this.isLocal()) {
        const driver = this.localDriver();
        this.testResult.set(
          driver
            ? await driver.testConnection(input.parametros ?? {})
            : { ok: false, mensaje: 'Esta versión de HosPal no tiene conector para este proveedor.' },
        );
        return;
      }
      this.testResult.set(await firstValueFrom(this.repository.testConnection(sedeId, input)));
    } catch (error) {
      this.testResult.set({ ok: false, mensaje: this.errorText(error, 'No se pudo probar la conexión.') });
    } finally {
      this.testing.set(false);
    }
  }

  async loadDevices(): Promise<void> {
    const sedeId = this.sedeId();
    const input = this.buildInput();
    if (sedeId === null || !input) return;
    this.devicesLoading.set(true);
    this.devicesError.set('');
    try {
      const driver = this.localDriver();
      if (this.isLocal() && !driver) {
        throw new Error('Esta versión de HosPal no tiene conector para este proveedor.');
      }
      const devices = driver && this.isLocal()
        ? await driver.listDevices()
        : await firstValueFrom(this.repository.listDevices(sedeId, input));
      this.devices.set(devices);
      if (devices.length === 0) {
        this.devicesError.set(
          this.isLocal()
            ? 'No se encontraron puertos con dispositivos en este equipo.'
            : 'No se encontraron terminales vinculados a esta cuenta.',
        );
      }
    } catch (error) {
      this.devices.set(null);
      this.devicesError.set(
        error instanceof Error && !(error instanceof HttpErrorResponse)
          ? error.message
          : this.errorText(error, 'No se pudieron obtener los terminales.'),
      );
    } finally {
      this.devicesLoading.set(false);
    }
  }

  async save(): Promise<void> {
    const sedeId = this.sedeId();
    const input = this.buildInput();
    if (sedeId === null || !input) return;
    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      const saved = await firstValueFrom(this.repository.saveConfig(sedeId, input));
      this.applyConfig(saved);
      this.successMessage.set(
        saved.activo ? 'Configuración guardada. El POS quedó activo.' : 'Configuración guardada (POS inactivo).',
      );
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'No se pudo guardar la configuración.'));
    } finally {
      this.saving.set(false);
    }
  }

  dismiss(): void {
    this.closed.emit();
  }

  private async loadConfig(): Promise<void> {
    const sedeId = this.sedeId();
    if (sedeId === null) return;
    this.applyConfig(await firstValueFrom(this.repository.getConfig(sedeId)));
  }

  private applyConfig(config: PosConfig): void {
    this.savedConfig.set(config);
    this.proveedor.set(config.proveedor ?? this.providers()[0]?.code ?? null);
    this.activo.set(config.activo);
    this.values.set(this.valuesFrom(config));
    this.resetChecks();
  }

  private valuesFrom(config: PosConfig): Record<string, FieldValue> {
    const values: Record<string, FieldValue> = {};
    for (const [key, value] of Object.entries(config.parametros)) {
      if (typeof value === 'string' || typeof value === 'boolean') values[key] = value;
    }
    return values;
  }

  private resetChecks(): void {
    this.testResult.set(null);
    this.devices.set(null);
    this.devicesError.set('');
  }

  private buildInput(): PosConfigInput | null {
    const proveedor = this.proveedor();
    if (!proveedor) return null;
    const credenciales: Record<string, string> = {};
    const parametros: Record<string, unknown> = {};
    for (const field of this.fields()) {
      const value = this.values()[field.key];
      if (field.type === 'secret') {
        if (typeof value === 'string' && value.trim()) credenciales[field.key] = value.trim();
      } else if (field.type === 'boolean') {
        parametros[field.key] = value === true;
      } else if (typeof value === 'string' && value.trim()) {
        parametros[field.key] = value.trim();
      }
    }
    return { proveedor, activo: this.activo(), credenciales, parametros };
  }

  private errorText(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { message?: unknown } | null)?.message;
      if (Array.isArray(message)) return message.join(' ');
      if (typeof message === 'string') return message;
      if (error.status === 0) return 'No se pudo conectar con el servidor.';
    }
    return fallback;
  }
}
