/**
 * Entidad de dominio: Sede
 *
 * Representa una propiedad/hostal dentro del sistema.
 * No depende de Prisma ni de ninguna tecnología de infraestructura.
 */
export class Sede {
  constructor(
    public readonly id: number,
    public nombre: string,
    public ciudad: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
