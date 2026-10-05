import { Injectable } from '@nestjs/common';
import { SedeRepository } from '../../domain/repositories/sede.repository';
import { Sede } from '../../domain/entities/sede.entity';

export interface CreateSedeDto {
  nombre: string;
  ciudad: string;
}

/**
 * Use Case: Crear una sede
 */
@Injectable()
export class CreateSedeUseCase {
  constructor(private readonly sedeRepository: SedeRepository) {}

  execute(dto: CreateSedeDto): Promise<Sede> {
    return this.sedeRepository.create(dto);
  }
}
