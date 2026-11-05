-- AlterTable Sede default checkout
ALTER TABLE `sede` MODIFY COLUMN `horaCheckOut` VARCHAR(10) NULL DEFAULT '12:00';

-- AlterTable Reserva add horaSalida
ALTER TABLE `reserva` ADD COLUMN `horaSalida` VARCHAR(5) NULL DEFAULT '12:00';
UPDATE `reserva` SET `horaSalida` = '12:00' WHERE `horaSalida` IS NULL;

-- AlterTable Huesped: drop global unique rutPasaporte
DROP INDEX `huesped_rutPasaporte_key` ON `huesped`;

-- AlterTable Huesped: add nullable sedeId
ALTER TABLE `huesped` ADD COLUMN `sedeId` INTEGER NULL;

-- Backfill sedeId from first reservation
UPDATE `huesped` h
JOIN (
    SELECT r.`huespedId`, MIN(hab.`sedeId`) AS `sedeId`
    FROM `reserva` r
    JOIN `habitacion` hab ON r.`habitacionId` = hab.`id`
    GROUP BY r.`huespedId`
) first_res ON h.`id` = first_res.`huespedId`
SET h.`sedeId` = first_res.`sedeId`
WHERE h.`sedeId` IS NULL;

-- Backfill remaining guests to first existing sede
UPDATE `huesped` h
SET h.`sedeId` = (SELECT `id` FROM `sede` ORDER BY `id` ASC LIMIT 1)
WHERE h.`sedeId` IS NULL;

-- AlterTable Huesped: make sedeId NOT NULL
ALTER TABLE `huesped` MODIFY COLUMN `sedeId` INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `huesped_sedeId_rutPasaporte_key` ON `huesped`(`sedeId`, `rutPasaporte`);
CREATE INDEX `huesped_sedeId_idx` ON `huesped`(`sedeId`);

-- AddForeignKey
ALTER TABLE `huesped` ADD CONSTRAINT `huesped_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sede`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
