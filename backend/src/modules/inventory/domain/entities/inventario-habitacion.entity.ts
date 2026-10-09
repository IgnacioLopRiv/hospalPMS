export class InventarioHabitacion {
  constructor(
    public readonly id: number,
    public readonly insumoId: number,
    public readonly habitacionId: number,
    public cantidad: number,
    public estado: string,
    public readonly fechaAsignacion: Date,
  ) {}
}
