import { defineConfig } from 'prisma/config';

/**
 * Configuración de Prisma 7+
 *
 * La URL de conexión ahora se define aquí en lugar del schema.prisma.
 * Referencia: https://pris.ly/d/config-datasource
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'mysql://root:password@localhost:3306/hospal_pms',
  },
});
