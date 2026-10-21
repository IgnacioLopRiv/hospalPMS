import { ConfiguracionTarifa } from '../entities/configuracion-tarifa.entity';

export abstract class ConfiguracionTarifaRepository {
  abstract findBySedeId(sedeId: number): Promise<ConfiguracionTarifa | null>;
  abstract save(data: {
    sedeId: number;
    porcentajeAbono: number;
    tarifas: unknown[];
  }): Promise<ConfiguracionTarifa>;
}