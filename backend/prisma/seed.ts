import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed inicial de HospalPMS
 *
 * Crea datos de ejemplo para desarrollo local.
 * Ejecutar con: npm run prisma:seed
 */
async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpiar datos anteriores (orden inverso de dependencias)
  await prisma.reserva.deleteMany();
  await prisma.inventarioItem.deleteMany();
  await prisma.habitacion.deleteMany();
  await prisma.tipologia.deleteMany();
  await prisma.huesped.deleteMany();
  await prisma.sede.deleteMany();

  // ── Sedes ────────────────────────────────────────────────────────────────
  const sedeCentro = await prisma.sede.create({
    data: { nombre: 'Hotel Centro', ciudad: 'Santiago' },
  });
  const sedePlaya = await prisma.sede.create({
    data: { nombre: 'Hotel Playa', ciudad: 'Viña del Mar' },
  });

  console.log(`✅ Sedes creadas: ${sedeCentro.nombre}, ${sedePlaya.nombre}`);

  // ── Tipologías ────────────────────────────────────────────────────────────
  const tipStandard = await prisma.tipologia.create({
    data: {
      sedeId: sedeCentro.id,
      nombre: 'Standard',
      capacidad: 2,
      color: '#4A90D9',
      precioBase: 75000,
      descripcion: 'Habitación estándar con cama matrimonial',
    },
  });
  const tipSuite = await prisma.tipologia.create({
    data: {
      sedeId: sedeCentro.id,
      nombre: 'Suite',
      capacidad: 4,
      color: '#E8A838',
      precioBase: 150000,
      descripcion: 'Suite de lujo con vista a la ciudad',
    },
  });

  console.log(`✅ Tipologías creadas: ${tipStandard.nombre}, ${tipSuite.nombre}`);

  // ── Habitaciones ──────────────────────────────────────────────────────────
  const hab101 = await prisma.habitacion.create({
    data: {
      sedeId: sedeCentro.id,
      tipologiaId: tipStandard.id,
      numero: '101',
      tamanoM2: 25,
      disposicionMuebles: 'Cama matrimonial, escritorio, sillón',
      estado: 'libre',
    },
  });
  const hab201 = await prisma.habitacion.create({
    data: {
      sedeId: sedeCentro.id,
      tipologiaId: tipSuite.id,
      numero: '201',
      tamanoM2: 50,
      disposicionMuebles: 'Cama king, sala de estar, jacuzzi',
      estado: 'libre',
    },
  });

  console.log(`✅ Habitaciones creadas: ${hab101.numero}, ${hab201.numero}`);

  // ── Inventario ────────────────────────────────────────────────────────────
  await prisma.inventarioItem.createMany({
    data: [
      { habitacionId: hab101.id, nombre: 'Toallas', cantidad: 4 },
      { habitacionId: hab101.id, nombre: 'Amenities', cantidad: 2 },
      { habitacionId: hab201.id, nombre: 'Toallas', cantidad: 6 },
      { habitacionId: hab201.id, nombre: 'Albornoz', cantidad: 2 },
    ],
  });

  // ── Huéspedes ─────────────────────────────────────────────────────────────
  const huesped1 = await prisma.huesped.create({
    data: {
      nombre: 'María',
      apellido: 'González',
      email: 'maria.gonzalez@example.com',
      nacionalidad: 'Chile',
      telefono: '+56912345678',
      documento: '12345678-9',
    },
  });

  console.log(`✅ Huésped creado: ${huesped1.nombre} ${huesped1.apellido}`);

  // ── Reservas ──────────────────────────────────────────────────────────────
  await prisma.reserva.create({
    data: {
      huespedId: huesped1.id,
      habitacionId: hab101.id,
      fechaLlegada: new Date('2026-10-10'),
      fechaSalida: new Date('2026-10-15'),
      cantidadPersonas: 2,
      estado: 'CONFIRMADA',
    },
  });

  console.log('✅ Seed completado con éxito 🎉');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
