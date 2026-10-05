import { Injectable, NotFoundException } from '@nestjs/common';
import { SedeRepository } from '../../domain/repositories/sede.repository';
import { Sede } from '../../domain/entities/sede.entity';

export interface UpdateSedeDto {
  nombre?: string;
  ciudad?: string;
}

/**
 * Use Case: Actualizar datos de una sede
 */
@Injectable()
export class UpdateSedeUseCase {
  constructor(private readonly sedeRepository: SedeRepository) {}

  async execute(id: number, dto: UpdateSedeDto): Promise<Sede> {
    const exists = await this.sedeRepository.findById(id);
    if (!exists) {
      throw new NotFoundException(`Sede con id ${id} no encontrada`);
    }
    return this.sedeRepository.update(id, dto);
  }
}
