/**
 * Entidad de dominio: Huesped
 */
export class Huesped {
  constructor(
    public readonly id: number,
    public rutPasaporte: string,
    public nombres: string,
    public apellidos: string,
    public paisResidencia: string,
    public telefono: string,
    public email: string,
  ) {}

  get nombreCompleto(): string {
    return `${this.nombres} ${this.apellidos}`.trim();
  }
}
