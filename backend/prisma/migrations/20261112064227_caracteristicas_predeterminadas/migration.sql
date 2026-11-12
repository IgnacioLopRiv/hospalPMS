-- DropForeignKey
ALTER TABLE `tipologia_caracteristica` DROP FOREIGN KEY `tipologia_caracteristica_caracteristicaId_fkey`;

-- DropForeignKey
ALTER TABLE `tipologia_caracteristica` DROP FOREIGN KEY `tipologia_caracteristica_tipologiaId_fkey`;

-- DropIndex
DROP INDEX `tipologia_caracteristica_caracteristicaId_fkey` ON `tipologia_caracteristica`;

-- AlterTable
ALTER TABLE `caracteristica` ADD COLUMN `predeterminada` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `tipologia_caracteristica` ADD CONSTRAINT `tipologia_caracteristica_tipologiaId_fkey` FOREIGN KEY (`tipologiaId`) REFERENCES `tipologia`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tipologia_caracteristica` ADD CONSTRAINT `tipologia_caracteristica_caracteristicaId_fkey` FOREIGN KEY (`caracteristicaId`) REFERENCES `caracteristica`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Marcar las características base (seed) como predeterminadas
UPDATE `caracteristica` SET `predeterminada` = true
WHERE `nombre` IN ('Wi-Fi gratuito', 'Baño privado', 'Aire acondicionado', 'TV Cable / Smart TV', 'Desayuno incluido', 'Calefacción');
