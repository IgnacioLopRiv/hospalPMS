import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PosDevice,
  PosProvider,
  PosProviderConfig,
  PosProviderError,
  PosTestResult,
} from '../domain/pos-provider';
import {
  PosConfigRecord,
  PosConfigRepository,
} from '../domain/pos-config.repository';
import { PosCryptoService } from './pos-crypto.service';
import { PosProviderRegistry } from './pos-provider.registry';

export interface PosConfigInput {
  proveedor: string;
  activo?: boolean;
  credenciales?: Record<string, unknown>;
  parametros?: Record<string, unknown>;
}

export interface PosConfigView {
  sedeId: number;
  configurado: boolean;
  proveedor: string | null;
  activo: boolean;
  parametros: Record<string, unknown>;
  /** Secretos guardados, enmascarados (nunca se devuelven completos). */
  credenciales: Record<string, string>;
  actualizadoAt: Date | null;
  advertencia?: string;
}

@Injectable()
export class PosConfigService {
  constructor(
    private readonly repository: PosConfigRepository,
    private readonly registry: PosProviderRegistry,
    private readonly crypto: PosCryptoService,
  ) {}

  async getConfig(sedeId: number): Promise<PosConfigView> {
    await this.ensureSede(sedeId);
    const record = await this.repository.findBySede(sedeId);
    if (!record) {
      return {
        sedeId,
        configurado: false,
        proveedor: null,
        activo: false,
        parametros: {},
        credenciales: {},
        actualizadoAt: null,
      };
    }
    return this.toView(record);
  }

  async saveConfig(
    sedeId: number,
    input: PosConfigInput,
  ): Promise<PosConfigView> {
    await this.ensureSede(sedeId);
    const selected = this.registry.get(input.proveedor);
    if (!selected.disponible) {
      throw new BadRequestException(
        `${selected.nombre} aún no está disponible. ${selected.nota ?? ''}`.trim(),
      );
    }
    const activo = input.activo ?? false;
    const { provider, config } = await this.resolve(sedeId, input, activo);
    const hasSecrets = Object.keys(config.credenciales).length > 0;
    const record = await this.repository.upsert(sedeId, {
      proveedor: provider.code,
      activo,
      credenciales: hasSecrets
        ? this.crypto.encrypt(config.credenciales)
        : null,
      parametros: config.parametros,
    });
    return this.toView(record);
  }

  async testConnection(
    sedeId: number,
    input: PosConfigInput,
  ): Promise<PosTestResult> {
    await this.ensureSede(sedeId);
    const { provider, config } = await this.resolve(sedeId, input, false);
    try {
      return await provider.testConnection(config);
    } catch (error) {
      if (error instanceof PosProviderError) {
        return { ok: false, mensaje: error.message };
      }
      throw error;
    }
  }

  async listDevices(
    sedeId: number,
    input: PosConfigInput,
  ): Promise<PosDevice[]> {
    await this.ensureSede(sedeId);
    const { provider, config } = await this.resolve(sedeId, input, false);
    try {
      return await provider.listDevices(config);
    } catch (error) {
      if (error instanceof PosProviderError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /** Configuración guardada y descifrada de la sede, lista para el proveedor. */
  async loadStored(sedeId: number): Promise<{
    provider: PosProvider;
    config: PosProviderConfig;
    activo: boolean;
  } | null> {
    const record = await this.repository.findBySede(sedeId);
    if (!record) return null;
    return {
      provider: this.registry.get(record.proveedor),
      config: {
        credenciales: this.crypto.decrypt(record.credenciales),
        parametros: record.parametros,
      },
      activo: record.activo,
    };
  }

  /**
   * Combina lo recibido con lo guardado: los secretos vacíos conservan el
   * valor anterior (solo si el proveedor no cambió) y se descartan las claves
   * que el proveedor no declara.
   */
  private async resolve(
    sedeId: number,
    input: PosConfigInput,
    requireComplete: boolean,
  ): Promise<{ provider: PosProvider; config: PosProviderConfig }> {
    const provider = this.registry.get(input.proveedor);
    const existing = await this.repository.findBySede(sedeId);
    const previous =
      existing && existing.proveedor === provider.code
        ? this.crypto.decrypt(existing.credenciales)
        : {};

    const credenciales: Record<string, string> = {};
    const parametros: Record<string, unknown> = {};
    const missing: string[] = [];

    for (const field of provider.campos) {
      if (field.type === 'secret') {
        const value = this.asString(input.credenciales?.[field.key]);
        const finalValue = value || previous[field.key];
        if (finalValue) credenciales[field.key] = finalValue;
        else if (field.required) missing.push(field.label);
        continue;
      }

      const raw = input.parametros?.[field.key];
      if (field.type === 'boolean') {
        parametros[field.key] = raw === true;
        continue;
      }

      const value = this.asString(raw);
      if (!value) {
        if (field.required) missing.push(field.label);
        continue;
      }
      if (
        field.type === 'select' &&
        !field.opciones?.some((option) => option.value === value)
      ) {
        throw new BadRequestException(`Valor inválido para "${field.label}".`);
      }
      parametros[field.key] = value;
    }

    if (requireComplete && missing.length > 0) {
      throw new BadRequestException(
        `Para activar el POS completa: ${missing.join(', ')}.`,
      );
    }

    return { provider, config: { credenciales, parametros } };
  }

  private toView(record: PosConfigRecord): PosConfigView {
    let credenciales: Record<string, string> = {};
    let advertencia: string | undefined;
    try {
      const plain = this.crypto.decrypt(record.credenciales);
      credenciales = Object.fromEntries(
        Object.entries(plain).map(([key, value]) => [key, this.mask(value)]),
      );
    } catch {
      advertencia =
        'No se pudieron leer las credenciales guardadas. Vuelve a ingresarlas.';
    }
    return {
      sedeId: record.sedeId,
      configurado: true,
      proveedor: record.proveedor,
      activo: record.activo,
      parametros: record.parametros,
      credenciales,
      actualizadoAt: record.actualizadoAt,
      advertencia,
    };
  }

  private mask(value: string): string {
    return value.length <= 4 ? '••••' : `••••••••${value.slice(-4)}`;
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private async ensureSede(sedeId: number): Promise<void> {
    if (!(await this.repository.sedeExists(sedeId))) {
      throw new NotFoundException(`No existe la sede ${sedeId}.`);
    }
  }
}
