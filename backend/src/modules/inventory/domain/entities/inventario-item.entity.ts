/**
 * Entidad de dominio: InventarioItem
 *
 * Representa un ítem de inventario dentro de una habitación.
 */
export class InventarioItem {
  constructor(
    public readonly id: number,
    public readonly habitacionId: number,
    public nombre: string,
    public cantidad: number,
    public observaciones: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
