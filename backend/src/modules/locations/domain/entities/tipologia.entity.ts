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
    public capacidad: number,
    public color: string | null,
    public precioBase: number | null,
    public descripcion: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
