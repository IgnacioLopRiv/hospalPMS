-- CreateTable
CREATE TABLE `transaccion_pos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservaId` INTEGER NOT NULL,
    `sedeId` INTEGER NOT NULL,
    `pagoId` INTEGER NULL,
    `proveedor` VARCHAR(50) NOT NULL,
    `externalId` VARCHAR(100) NULL,
    `externalReference` VARCHAR(64) NULL,
    `deviceId` VARCHAR(100) NULL,
    `monto` INTEGER NOT NULL,
    `tipoOperacion` ENUM('ABONO', 'PAGO_FINAL', 'PAGO_SERVICIO_ADICIONAL', 'REEMBOLSO') NOT NULL,
    `estado` ENUM('PENDIENTE', 'EN_TERMINAL', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'EXPIRADA', 'REEMBOLSADA', 'ERROR') NOT NULL DEFAULT 'PENDIENTE',
    `estadoDetalle` VARCHAR(100) NULL,
    `metodoPago` ENUM('TRANSFERENCIA', 'EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO') NULL,
    `mensaje` VARCHAR(500) NULL,
    `respuestaRaw` JSON NULL,
    `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transaccion_pos_pagoId_key`(`pagoId`),
    UNIQUE INDEX `transaccion_pos_externalReference_key`(`externalReference`),
    INDEX `transaccion_pos_sedeId_estado_idx`(`sedeId`, `estado`),
    UNIQUE INDEX `transaccion_pos_proveedor_externalId_key`(`proveedor`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `transaccion_pos` ADD CONSTRAINT `transaccion_pos_reservaId_fkey` FOREIGN KEY (`reservaId`) REFERENCES `reserva`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaccion_pos` ADD CONSTRAINT `transaccion_pos_pagoId_fkey` FOREIGN KEY (`pagoId`) REFERENCES `pago`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
