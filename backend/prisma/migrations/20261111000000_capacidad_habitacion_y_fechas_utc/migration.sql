-- Solo datos, sin cambios de estructura.

-- 1. Las habitaciones se crearon con cantidadPersonas = 1 porque el formulario no envía
--    capacidad. La capacidad real es la de su tipología.
UPDATE `habitacion` h
JOIN `tipologia` t ON t.`id` = h.`tipologiaId`
SET h.`cantidadPersonas` = t.`capacidadMax`;

-- 2. Las fechas de estadía se guardan ahora a medianoche UTC. Las filas creadas con el
--    servidor en hora de Chile quedaron a las 03:00/04:00 UTC del mismo día; se normalizan
--    para que las comparaciones de disponibilidad entre días consecutivos sean exactas.
UPDATE `reserva`
SET `fechaCheckIn` = TIMESTAMP(DATE(`fechaCheckIn`)),
    `fechaCheckOut` = TIMESTAMP(DATE(`fechaCheckOut`));
