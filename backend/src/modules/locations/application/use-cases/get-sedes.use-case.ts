import { Injectable } from '@nestjs/common';
import { SedeRepository } from '../../domain/repositories/sede.repository';
import { Sede } from '../../domain/entities/sede.entity';

/**
 * Use Case: Obtener todas las sedes
 */
@Injectable()
export class GetSedesUseCase {
  constructor(private readonly sedeRepository: SedeRepository) {}

  execute(): Promise<Sede[]> {
    return this.sedeRepository.findAll();
  }
}
