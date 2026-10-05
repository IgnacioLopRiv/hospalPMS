import { Injectable, NotFoundException } from '@nestjs/common';
import { SedeRepository } from '../../domain/repositories/sede.repository';

/**
 * Use Case: Eliminar una sede
 */
@Injectable()
export class DeleteSedeUseCase {
  constructor(private readonly sedeRepository: SedeRepository) {}

  async execute(id: number): Promise<void> {
    const exists = await this.sedeRepository.findById(id);
    if (!exists) {
      throw new NotFoundException(`Sede con id ${id} no encontrada`);
    }
    return this.sedeRepository.delete(id);
  }
}
