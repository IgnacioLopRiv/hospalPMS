import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { CaracteristicasController } from './caracteristicas.controller';

interface StoredCaracteristica {
  id: number;
  nombre: string;
  icono: string | null;
  activo: boolean;
  predeterminada: boolean;
}

function buildController(initial: StoredCaracteristica[]) {
  let rows = initial.map((row) => ({ ...row }));
  let nextId = Math.max(0, ...rows.map((row) => row.id)) + 1;

  const prisma = {
    caracteristica: {
      findMany: jest.fn(
        ({
          where,
        }: { where?: { activo?: boolean; id?: { not: number } } } = {}) =>
          Promise.resolve(
            rows.filter(
              (row) =>
                (where?.activo === undefined || row.activo === where.activo) &&
                (where?.id?.not === undefined || row.id !== where.id.not),
            ),
          ),
      ),
      findUnique: jest.fn(({ where }: { where: { id: number } }) =>
        Promise.resolve(rows.find((row) => row.id === where.id) ?? null),
      ),
      create: jest.fn(
        ({ data }: { data: Omit<StoredCaracteristica, 'id'> }) => {
          const created = { id: nextId++, ...data };
          rows.push(created);
          return Promise.resolve(created);
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: number };
          data: Partial<StoredCaracteristica>;
        }) => {
          const row = rows.find((item) => item.id === where.id)!;
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
      delete: jest.fn(({ where }: { where: { id: number } }) => {
        rows = rows.filter((row) => row.id !== where.id);
        return Promise.resolve({});
      }),
    },
  };

  const controller = new CaracteristicasController(
    prisma as unknown as PrismaService,
  );
  return { controller, prisma, rows: () => rows };
}

describe('CaracteristicasController', () => {
  const base: StoredCaracteristica[] = [
    {
      id: 1,
      nombre: 'Wi-Fi gratuito',
      icono: 'wifi',
      activo: true,
      predeterminada: true,
    },
    {
      id: 2,
      nombre: 'Jacuzzi',
      icono: null,
      activo: true,
      predeterminada: false,
    },
  ];

  it('creates custom features as non-default', async () => {
    const { controller } = buildController(base);
    const created = await controller.create({
      nombre: '  Balcón ',
      predeterminada: true,
    } as never);
    expect(created).toMatchObject({ nombre: 'Balcón', predeterminada: false });
  });

  it('rejects empty and duplicate names', async () => {
    const { controller } = buildController(base);
    await expect(controller.create({ nombre: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      controller.create({ nombre: 'wi-fi GRATUITO' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not allow editing or deleting default features', async () => {
    const { controller, rows } = buildController(base);
    await expect(
      controller.update(1, { nombre: 'Otro' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.remove(1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(rows().map((row) => row.id)).toEqual([1, 2]);
  });

  it('deletes custom features', async () => {
    const { controller, rows } = buildController(base);
    await expect(controller.remove(2)).resolves.toEqual({ deleted: true });
    expect(rows().map((row) => row.id)).toEqual([1]);
  });

  it('returns 404 for unknown features', async () => {
    const { controller } = buildController(base);
    await expect(controller.remove(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
