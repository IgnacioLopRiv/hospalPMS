export class ConfiguracionTarifa {
  constructor(
    public readonly id: number,
    public readonly sedeId: number,
    public porcentajeAbono: number,
    public tarifas: unknown[],
  ) {}
}