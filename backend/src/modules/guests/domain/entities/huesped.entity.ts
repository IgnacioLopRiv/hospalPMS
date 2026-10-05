/**
 * Entidad de dominio: Huesped
 */
export class Huesped {
  constructor(
    public readonly id: number,
    public documento: string | null,
    public nombre: string,
    public apellido: string,
    public nacionalidad: string,
    public telefono: string,
    public email: string,
    public esRecurrente: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get nombreCompleto(): string {
    return `${this.nombre} ${this.apellido}`.trim();
  }
}
