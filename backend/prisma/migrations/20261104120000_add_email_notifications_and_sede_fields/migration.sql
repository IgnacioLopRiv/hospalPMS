-- AlterTable
ALTER TABLE `hostal` ADD COLUMN `email` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `pago` ADD COLUMN `referencia` VARCHAR(50) NULL;

-- AlterTable
ALTER TABLE `reserva` ADD COLUMN `codigo` VARCHAR(30) NULL;

-- AlterTable
ALTER TABLE `sede` ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `horaCheckIn` VARCHAR(10) NULL DEFAULT '15:00',
    ADD COLUMN `horaCheckOut` VARCHAR(10) NULL DEFAULT '11:00',
    ADD COLUMN `politicaCancelacion` TEXT NULL,
    ADD COLUMN `serviciosIncluidos` TEXT NULL,
    ADD COLUMN `sitioWeb` VARCHAR(500) NULL,
    ADD COLUMN `urlEncuesta` VARCHAR(500) NULL;

-- CreateTable
CREATE TABLE `notificacion_email` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('CONFIRMACION_RESERVA', 'COMPROBANTE_PAGO', 'RECORDATORIO_PRE_LLEGADA', 'RESUMEN_CHECKOUT') NOT NULL,
    `reservaId` INTEGER NOT NULL,
    `pagoId` INTEGER NULL,
    `destinatario` VARCHAR(191) NOT NULL,
    `idioma` VARCHAR(5) NOT NULL DEFAULT 'es',
    `asunto` VARCHAR(255) NOT NULL,
    `estado` ENUM('PENDIENTE', 'ENVIADA', 'FALLIDA') NOT NULL DEFAULT 'PENDIENTE',
    `intentos` INTEGER NOT NULL DEFAULT 0,
    `ultimoError` TEXT NULL,
    `enviadoAt` DATETIME(3) NULL,
    `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoAt` DATETIME(3) NOT NULL,

    INDEX `notificacion_email_reservaId_tipo_idx`(`reservaId`, `tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill códigos de reserva existentes si los hay
UPDATE `reserva` SET `codigo` = CONCAT('HP-', LPAD(id, 6, '0')) WHERE `codigo` IS NULL;

-- Backfill referencias de pago existentes si los hay
UPDATE `pago` SET `referencia` = CONCAT('PAY-', LPAD(id, 6, '0')) WHERE `referencia` IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX `pago_referencia_key` ON `pago`(`referencia`);

-- CreateIndex
CREATE UNIQUE INDEX `reserva_codigo_key` ON `reserva`(`codigo`);

-- AddForeignKey
ALTER TABLE `notificacion_email` ADD CONSTRAINT `notificacion_email_reservaId_fkey` FOREIGN KEY (`reservaId`) REFERENCES `reserva`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificacion_email` ADD CONSTRAINT `notificacion_email_pagoId_fkey` FOREIGN KEY (`pagoId`) REFERENCES `pago`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
