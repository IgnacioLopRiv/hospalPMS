import { TarifaAbono } from '../entities/tarifa-abono.entity';

/**
 * Puerto de repositorio para TarifaAbono (dominio → infraestructura)
 */
export abstract class TarifaAbonoRepository {
  abstract findBySedeId(sedeId: number): Promise<TarifaAbono | null>;
  /** Devuelve la configuración de la sede, creándola con el abono por defecto si no existe. */
  abstract ensureForSede(sedeId: number): Promise<TarifaAbono>;
  abstract save(data: {
    sedeId: number;
    porcentajeAbono: number;
  }): Promise<TarifaAbono>;
}
