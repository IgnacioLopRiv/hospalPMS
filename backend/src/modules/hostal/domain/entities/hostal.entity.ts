export class Hostal {
  constructor(
    public readonly id: number,
    public rutEmpresa: string,
    public razonSocial: string,
    public nombreFantasia: string,
    public giro: string,
    public direccion: string,
    public logoUrl: string | null,
  ) {}
}