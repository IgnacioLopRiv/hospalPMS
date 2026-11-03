export const PORCENTAJE_ABONO_POR_DEFECTO = 20;

/**
 * Entidad de dominio: TarifaAbono
 *
 * Configuración del abono de reserva de una sede. Agrupa todas las tarifas
 * de la sede que se cobran con ese porcentaje de abono.
 */
export class TarifaAbono {
  constructor(
    public readonly id: number,
    public readonly sedeId: number,
    public porcentajeAbono: number,
  ) {}
}
