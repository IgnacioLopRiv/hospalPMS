export class InsumoInventario {
  constructor(
    public readonly id: number,
    public readonly sedeId: number,
    public nombre: string,
    public descripcion: string | null,
    public costoCompra: number,
    public stockActual: number,
    public stockMinimo: number,
    public activo: boolean,
  ) {}
}
