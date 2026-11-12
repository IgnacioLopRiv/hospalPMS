import {
  Tarifa,
  TarifaPeriodo,
} from '../entities/tarifa.entity';

export interface TarifaData {
  sedeId: number;
  tarifaAbonoId: number;
  nombre: string;
  precioBase: number | null;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  activa: boolean;
  periodos: TarifaPeriodo[];
  precios: Record<number, number>;
}

/**
 * Puerto de repositorio para Tarifa (dominio → infraestructura)
 */
export abstract class TarifaRepository {
  abstract findBySedeId(sedeId: number): Promise<Tarifa[]>;
  abstract findById(id: number): Promise<Tarifa | null>;
  abstract create(data: TarifaData): Promise<Tarifa>;
  abstract update(
    id: number,
    data: Partial<Omit<TarifaData, 'sedeId'>>,
  ): Promise<Tarifa>;
  abstract delete(id: number): Promise<void>;
}
