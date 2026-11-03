-- configuracion_tarifa pasa a llamarse tarifa_abono (se conservan ids y porcentajes).
-- Las tarifas dejan de guardarse como JSON dentro de ella y pasan a la tabla tarifa,
-- que ahora pertenece a una sede y a un tarifa_abono. El precio por tipología
-- se guarda en la nueva tabla tarifa_tipologia.

-- 1. Renombrar configuracion_tarifa -> tarifa_abono
ALTER TABLE `configuracion_tarifa` DROP FOREIGN KEY `configuracion_tarifa_sedeId_fkey`;
RENAME TABLE `configuracion_tarifa` TO `tarifa_abono`;
ALTER TABLE `tarifa_abono` RENAME INDEX `configuracion_tarifa_sedeId_key` TO `tarifa_abono_sedeId_key`;

-- 2. Apartar la tabla tarifa anterior (FK a tipología) para migrar sus filas
ALTER TABLE `tarifa` DROP FOREIGN KEY `tarifa_tipologiaId_fkey`;
RENAME TABLE `tarifa` TO `_tarifa_legacy`;

-- 3. Nuevas tablas
CREATE TABLE `tarifa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sedeId` INTEGER NOT NULL,
    `tarifaAbonoId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `precioBase` INTEGER NULL,
    `fechaInicio` DATE NULL,
    `fechaFin` DATE NULL,
    `tipoTemporada` ENUM('ALTA', 'BAJA') NOT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `periodos` JSON NOT NULL,
    `_legacyId` VARCHAR(64) NULL,

    INDEX `tarifa_sedeId_fechaInicio_fechaFin_idx`(`sedeId`, `fechaInicio`, `fechaFin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tarifa_tipologia` (
    `tarifaId` INTEGER NOT NULL,
    `tipologiaId` INTEGER NOT NULL,
    `precio` INTEGER NOT NULL,

    PRIMARY KEY (`tarifaId`, `tipologiaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Tarifas guardadas como JSON en tarifa_abono.tarifas -> filas de tarifa
INSERT INTO `tarifa` (`sedeId`, `tarifaAbonoId`, `nombre`, `tipoTemporada`, `activa`, `periodos`, `_legacyId`)
SELECT ta.`sedeId`, ta.`id`, COALESCE(jt.`nombre`, 'Tarifa'), 'ALTA', true, COALESCE(jt.`periodos`, JSON_ARRAY()), jt.`legacyId`
FROM `tarifa_abono` ta
CROSS JOIN JSON_TABLE(ta.`tarifas`, '$[*]' COLUMNS (
    `legacyId` VARCHAR(64) PATH '$.id',
    `nombre` VARCHAR(191) PATH '$.nombre',
    `periodos` JSON PATH '$.periodos'
)) jt;

INSERT INTO `tarifa_tipologia` (`tarifaId`, `tipologiaId`, `precio`)
SELECT t.`id`, tp.`id`, ROUND(CAST(JSON_UNQUOTE(JSON_EXTRACT(jt.`precios`, CONCAT('$."', k.`tipologiaId`, '"'))) AS DECIMAL(12, 2)))
FROM `tarifa_abono` ta
CROSS JOIN JSON_TABLE(ta.`tarifas`, '$[*]' COLUMNS (
    `legacyId` VARCHAR(64) PATH '$.id',
    `precios` JSON PATH '$.precios'
)) jt
-- JSON_TABLE usa la collation de la conexión; se fuerza la de la tabla para comparar.
JOIN `tarifa` t ON t.`tarifaAbonoId` = ta.`id` AND t.`_legacyId` = CONVERT(jt.`legacyId` USING utf8mb4) COLLATE utf8mb4_unicode_ci
CROSS JOIN JSON_TABLE(JSON_KEYS(jt.`precios`), '$[*]' COLUMNS (`tipologiaId` VARCHAR(20) PATH '$')) k
JOIN `tipologia` tp ON tp.`id` = CAST(k.`tipologiaId` AS UNSIGNED) AND tp.`sedeId` = ta.`sedeId`;

-- Vigencia (fechaInicio/fechaFin): envolvente de los periodos acotados.
-- Si algún periodo es recurrente (meses, días de semana, días del mes) queda NULL.
UPDATE `tarifa` t
JOIN (
    SELECT t2.`id`,
        MAX(p.`tipo` NOT IN ('date-range', 'specific-dates', 'specific-month-days')) AS `recurrente`,
        MIN(CASE p.`tipo`
            WHEN 'date-range' THEN STR_TO_DATE(p.`fechaInicio`, '%Y-%m-%d')
            WHEN 'specific-dates' THEN STR_TO_DATE(p.`fecha`, '%Y-%m-%d')
            WHEN 'specific-month-days' THEN MAKEDATE(p.`anio`, 1) + INTERVAL p.`mes` MONTH
        END) AS `inicio`,
        MAX(CASE p.`tipo`
            WHEN 'date-range' THEN STR_TO_DATE(p.`fechaFin`, '%Y-%m-%d')
            WHEN 'specific-dates' THEN STR_TO_DATE(p.`fecha`, '%Y-%m-%d')
            WHEN 'specific-month-days' THEN LAST_DAY(MAKEDATE(p.`anio`, 1) + INTERVAL p.`mes` MONTH)
        END) AS `fin`
    FROM `tarifa` t2
    CROSS JOIN JSON_TABLE(t2.`periodos`, '$[*]' COLUMNS (
        `tipo` VARCHAR(32) PATH '$.tipo',
        `fechaInicio` VARCHAR(10) PATH '$.fechaInicio',
        `fechaFin` VARCHAR(10) PATH '$.fechaFin',
        `anio` INTEGER PATH '$.anio',
        `mes` INTEGER PATH '$.mes',
        NESTED PATH '$.fechas[*]' COLUMNS (`fecha` VARCHAR(10) PATH '$')
    )) p
    GROUP BY t2.`id`
) v ON v.`id` = t.`id`
SET t.`fechaInicio` = IF(v.`recurrente`, NULL, v.`inicio`),
    t.`fechaFin` = IF(v.`recurrente`, NULL, v.`fin`);

-- 5. Filas de la tabla tarifa anterior (una tipología, un rango) -> nuevo modelo
INSERT INTO `tarifa_abono` (`sedeId`, `porcentajeAbono`, `tarifas`)
SELECT DISTINCT tp.`sedeId`, 20, JSON_ARRAY()
FROM `_tarifa_legacy` l
JOIN `tipologia` tp ON tp.`id` = l.`tipologiaId`
WHERE NOT EXISTS (SELECT 1 FROM `tarifa_abono` ta WHERE ta.`sedeId` = tp.`sedeId`);

INSERT INTO `tarifa` (`sedeId`, `tarifaAbonoId`, `nombre`, `fechaInicio`, `fechaFin`, `tipoTemporada`, `activa`, `periodos`, `_legacyId`)
SELECT tp.`sedeId`, ta.`id`, l.`nombre`, l.`fechaInicio`, l.`fechaFin`, l.`tipoTemporada`, l.`activa`,
    JSON_ARRAY(JSON_OBJECT(
        'id', UUID(), 'tipo', 'date-range',
        'meses', JSON_ARRAY(), 'diasSemana', JSON_ARRAY(), 'diasMes', JSON_ARRAY(),
        'fechaInicio', DATE_FORMAT(l.`fechaInicio`, '%Y-%m-%d'),
        'fechaFin', DATE_FORMAT(l.`fechaFin`, '%Y-%m-%d'),
        'fechas', JSON_ARRAY()
    )),
    CONCAT('legacy-', l.`id`)
FROM `_tarifa_legacy` l
JOIN `tipologia` tp ON tp.`id` = l.`tipologiaId`
JOIN `tarifa_abono` ta ON ta.`sedeId` = tp.`sedeId`;

INSERT INTO `tarifa_tipologia` (`tarifaId`, `tipologiaId`, `precio`)
SELECT t.`id`, l.`tipologiaId`, l.`precioBase`
FROM `_tarifa_legacy` l
JOIN `tarifa` t ON t.`_legacyId` = CONCAT('legacy-', l.`id`);

-- 6. Limpieza de columnas/tablas temporales
DROP TABLE `_tarifa_legacy`;
ALTER TABLE `tarifa` DROP COLUMN `_legacyId`;
ALTER TABLE `tarifa_abono` DROP COLUMN `tarifas`;

-- 7. Claves foráneas
ALTER TABLE `tarifa_abono` ADD CONSTRAINT `tarifa_abono_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sede`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tarifa` ADD CONSTRAINT `tarifa_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sede`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tarifa` ADD CONSTRAINT `tarifa_tarifaAbonoId_fkey` FOREIGN KEY (`tarifaAbonoId`) REFERENCES `tarifa_abono`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tarifa_tipologia` ADD CONSTRAINT `tarifa_tipologia_tarifaId_fkey` FOREIGN KEY (`tarifaId`) REFERENCES `tarifa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `tarifa_tipologia` ADD CONSTRAINT `tarifa_tipologia_tipologiaId_fkey` FOREIGN KEY (`tipologiaId`) REFERENCES `tipologia`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
