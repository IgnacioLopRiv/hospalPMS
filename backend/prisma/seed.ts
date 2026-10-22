import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // 1. Hostal Matriz (Padre del sistema)
  const hostal = await prisma.hostal.upsert({
    where: { rutEmpresa: '76123456-7' },
    update: {
      razonSocial: 'Hostal Las Palmas SpA',
      nombreFantasia: 'Hostal Las Palmas',
      giro: 'Servicios de Alojamiento y Turismo',
      direccion: 'Av. Costanera 1234, Coquimbo',
    },
    create: {
      rutEmpresa: '76123456-7',
      razonSocial: 'Hostal Las Palmas SpA',
      nombreFantasia: 'Hostal Las Palmas',
      giro: 'Servicios de Alojamiento y Turismo',
      direccion: 'Av. Costanera 1234, Coquimbo',
      logoUrl: null,
    },
  });

  console.log(`✅ Hostal registrado: "${hostal.nombreFantasia}" (ID: ${hostal.id})`);

  // 2. Características / Amenidades comunes por defecto
  const amenidadesBase = [
    { nombre: 'Wi-Fi gratuito', icono: 'wifi' },
    { nombre: 'Baño privado', icono: 'water' },
    { nombre: 'Aire acondicionado', icono: 'snow' },
    { nombre: 'TV Cable / Smart TV', icono: 'tv' },
    { nombre: 'Desayuno incluido', icono: 'restaurant' },
    { nombre: 'Calefacción', icono: 'flame' },
  ];

  for (const amenidad of amenidadesBase) {
    const existe = await prisma.caracteristica.findFirst({
      where: { nombre: amenidad.nombre },
    });
    if (!existe) {
      await prisma.caracteristica.create({
        data: {
          nombre: amenidad.nombre,
          icono: amenidad.icono,
          activo: true,
        },
      });
    }
  }

  console.log(`✅ Características base verificadas/creadas.`);

  // 3. Funcionario Administrador por defecto si existe alguna Sede
  const firstSede = await prisma.sede.findFirst({ orderBy: { id: 'asc' } });
  if (firstSede) {
    const bcrypt = await import('bcryptjs');
    const adminPasswordHash = await bcrypt.hash('Admin123', 10);
    const admin = await prisma.funcionario.upsert({
      where: { email: 'admintest@gmail.com' },
      update: { passwordHash: adminPasswordHash },
      create: {
        sedeId: firstSede.id,
        rut: '12345678-5',
        nombres: 'Juan',
        apellidos: 'Admin',
        email: 'admintest@gmail.com',
        passwordHash: adminPasswordHash,
        rol: 'ADMINISTRADOR',
      },
    });
    console.log(`✅ Funcionario administrador verificado: "${admin.email}" (ID: ${admin.id})`);
  }

  console.log('🎉 Seed finalizado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la ejecución del seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
