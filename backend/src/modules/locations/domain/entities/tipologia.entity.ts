/**
 * Entidad de dominio: Tipologia
 *
 * Representa el tipo/categoría de habitación en una sede.
 */
export class Tipologia {
  constructor(
    public readonly id: number,
    public readonly sedeId: number,
    public nombre: string,
    public capacidadMax: number,
    public numCamas: number,
    public descripcion: string | null,
    public color: string | null = null,
    public precioBase: number | null = null,
  ) {}
}
