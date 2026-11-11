import {
  agrupacionPara,
  agruparSerie,
  Agrupacion,
  EstadisticasPeriodo,
  Periodo,
  PuntoSerie,
  sumarDias,
  variacion,
} from './reporte-estadisticas';

/* pdfmake no publica tipos para la API 0.3; usamos una forma laxa. */
type Nodo = Record<string, unknown>;

export interface TransaccionReporte {
  fecha: Date;
  reserva: string;
  huesped: string;
  habitacion: string;
  sede: string;
  metodoPago: string;
  tipoOperacion: string;
  /** Con signo: los reembolsos son negativos. */
  monto: number;
}

export interface InsumoBajoMinimo {
  sede: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
}

export interface DatosReportePdf {
  empresa: { nombre: string; razonSocial: string; rut: string };
  alcance: string;
  esGlobal: boolean;
  periodo: Periodo;
  periodoAnterior: Periodo;
  actual: EstadisticasPeriodo;
  anterior: EstadisticasPeriodo;
  saldoPorCobrar: number;
  reservasConSaldo: number;
  transacciones: TransaccionReporte[];
  inventarioBajoMinimo: InsumoBajoMinimo[];
  generadoEn: Date;
}

const COLOR = {
  primario: '#1e50d8',
  primarioSuave: '#dbe5fb',
  texto: '#0f172a',
  secundario: '#64748b',
  borde: '#e2e8f0',
  fondo: '#f8fafc',
  positivo: '#15803d',
  negativo: '#b91c1c',
  ocupacion: '#0d9488',
};

const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const ANCHO_UTIL = 515; // A4 (595pt) menos márgenes de 40pt.
const ALTO_GRAFICO = 120;

const numero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const formatoDinero = (valor: number) =>
  `${valor < 0 ? '-' : ''}$${numero.format(Math.abs(Math.round(valor)))}`;
const formatoPorcentaje = (valor: number) => `${decimal.format(valor)}%`;
const fechaCorta = (fecha: Date) =>
  `${String(fecha.getDate()).padStart(2, '0')} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
const fechaHora = (fecha: Date) =>
  `${String(fecha.getDate()).padStart(2, '0')}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${fecha.getFullYear()} ` +
  `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;

/** Rango legible; `hasta` es exclusivo, por eso se muestra el día anterior. */
export function rangoLegible(periodo: Periodo): string {
  return `${fechaCorta(periodo.desde)} – ${fechaCorta(sumarDias(periodo.hasta, -1))}`;
}

// ----- KPIs -----

interface Kpi {
  etiqueta: string;
  valor: string;
  /** Variación %; `undefined` si el KPI no se compara. */
  delta?: number | null;
  /** true cuando subir es malo (p. ej. cancelaciones). */
  invertido?: boolean;
  nota?: string;
}

function tarjetaKpi(kpi: Kpi): Nodo {
  let detalle: Nodo;
  if (kpi.delta === undefined) {
    detalle = { text: kpi.nota ?? '', color: COLOR.secundario, fontSize: 7 };
  } else if (kpi.delta === null) {
    detalle = {
      text: 'Sin datos del periodo anterior',
      color: COLOR.secundario,
      fontSize: 7,
    };
  } else {
    const sube = kpi.delta > 0.05;
    const baja = kpi.delta < -0.05;
    const bueno = kpi.invertido ? baja : sube;
    const malo = kpi.invertido ? sube : baja;
    detalle = {
      text: [
        // Roboto no incluye flechas (▲/▼): se usan los signos + y -.
        {
          text: `${sube ? '+' : baja ? '-' : ''}${decimal.format(Math.abs(kpi.delta))}%`,
          bold: true,
        },
        { text: ' vs periodo anterior', color: COLOR.secundario },
      ],
      color: bueno ? COLOR.positivo : malo ? COLOR.negativo : COLOR.secundario,
      fontSize: 7,
    };
  }
  return {
    stack: [
      {
        text: kpi.etiqueta.toUpperCase(),
        fontSize: 6.5,
        color: COLOR.secundario,
        bold: true,
        characterSpacing: 0.4,
      },
      {
        text: kpi.valor,
        fontSize: 15,
        bold: true,
        color: COLOR.texto,
        margin: [0, 4, 0, 3],
      },
      detalle,
    ],
    margin: [8, 8, 8, 8],
  };
}

function grillaKpis(kpis: Kpi[]): Nodo {
  const filas: Nodo[][] = [];
  for (let i = 0; i < kpis.length; i += 4) {
    const fila = kpis.slice(i, i + 4).map(tarjetaKpi);
    while (fila.length < 4) fila.push({ text: '' });
    filas.push(fila);
  }
  return {
    table: { widths: ['*', '*', '*', '*'], body: filas },
    layout: {
      hLineColor: () => COLOR.borde,
      vLineColor: () => COLOR.borde,
      hLineWidth: () => 0.75,
      vLineWidth: () => 0.75,
      fillColor: () => COLOR.fondo,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

// ----- Gráficos (vectoriales, sin dependencias nativas) -----

function etiquetaTramo(fecha: Date, agrupacion: Agrupacion): string {
  if (agrupacion === 'mes')
    return `${MESES[fecha.getMonth()]} ${String(fecha.getFullYear()).slice(2)}`;
  return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
}

function graficoBarras(
  titulo: string,
  serie: PuntoSerie[],
  agrupacion: Agrupacion,
  opciones: {
    color: string;
    formato: (v: number) => string;
    maximoFijo?: number;
  },
): Nodo {
  const n = Math.max(1, serie.length);
  const slot = ANCHO_UTIL / n;
  const anchoBarra = Math.max(1.5, slot * 0.68);
  const maximoDatos = Math.max(0, ...serie.map((p) => p.valor));
  const maximo = opciones.maximoFijo ?? (maximoDatos || 1);
  const total = serie.reduce((suma, p) => suma + p.valor, 0);

  const formas: Nodo[] = [];
  for (const fraccion of [0.5, 1]) {
    const y = ALTO_GRAFICO - ALTO_GRAFICO * fraccion;
    formas.push({
      type: 'line',
      x1: 0,
      y1: y,
      x2: ANCHO_UTIL,
      y2: y,
      lineWidth: 0.5,
      lineColor: COLOR.borde,
      dash: { length: 2 },
    });
  }
  serie.forEach((punto, i) => {
    const alto = Math.max(
      0,
      (Math.max(0, punto.valor) / maximo) * ALTO_GRAFICO,
    );
    if (alto <= 0) return;
    formas.push({
      type: 'rect',
      x: i * slot + (slot - anchoBarra) / 2,
      y: ALTO_GRAFICO - alto,
      w: anchoBarra,
      h: alto,
      r: Math.min(1.5, anchoBarra / 2),
      color: opciones.color,
    });
  });
  formas.push({
    type: 'line',
    x1: 0,
    y1: ALTO_GRAFICO,
    x2: ANCHO_UTIL,
    y2: ALTO_GRAFICO,
    lineWidth: 0.75,
    lineColor: COLOR.secundario,
  });

  const paso = Math.ceil(n / 16);
  const etiquetas = serie.map((punto, i) => ({
    text: i % paso === 0 ? etiquetaTramo(punto.fecha, agrupacion) : '',
    fontSize: 6,
    color: COLOR.secundario,
    alignment: 'center',
  }));

  const agrupadoPor = { dia: 'por día', semana: 'por semana', mes: 'por mes' }[
    agrupacion
  ];
  return {
    unbreakable: true,
    margin: [0, 0, 0, 16],
    stack: [
      {
        columns: [
          { text: `${titulo} ${agrupadoPor}`, style: 'subtitulo' },
          {
            text: `Escala: ${opciones.formato(maximo)}`,
            alignment: 'right',
            fontSize: 7,
            color: COLOR.secundario,
            margin: [0, 3, 0, 0],
          },
        ],
      },
      { canvas: formas, margin: [0, 6, 0, 2] },
      { columns: etiquetas.map((e) => ({ ...e, width: slot })), columnGap: 0 },
      serie.length && opciones.maximoFijo === undefined
        ? {
            text: `Total del periodo: ${opciones.formato(total)}`,
            fontSize: 7,
            color: COLOR.secundario,
            margin: [0, 4, 0, 0],
          }
        : { text: '' },
    ],
  };
}

// ----- Tablas -----

const layoutTabla = {
  hLineColor: () => COLOR.borde,
  vLineWidth: () => 0,
  hLineWidth: (i: number) => (i === 1 ? 1 : 0.5),
  fillColor: (fila: number) =>
    fila === 0 ? COLOR.primarioSuave : fila % 2 === 0 ? COLOR.fondo : null,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

function tablaTransacciones(datos: DatosReportePdf): Nodo {
  const columnas = [
    { titulo: 'Fecha', ancho: 66 },
    { titulo: 'Reserva', ancho: 52 },
    { titulo: 'Huésped', ancho: '*' },
    { titulo: 'Hab.', ancho: 26 },
    ...(datos.esGlobal ? [{ titulo: 'Sede', ancho: 56 }] : []),
    { titulo: 'Método', ancho: 58 },
    { titulo: 'Operación', ancho: 60 },
    { titulo: 'Monto', ancho: 56, derecha: true },
  ];
  const cabecera = columnas.map((c) => ({
    text: c.titulo,
    bold: true,
    color: COLOR.primario,
    alignment: 'derecha' in c && c.derecha ? 'right' : 'left',
  }));
  const filas = datos.transacciones.map((t) => [
    fechaHora(t.fecha),
    t.reserva,
    t.huesped,
    t.habitacion,
    ...(datos.esGlobal ? [t.sede] : []),
    t.metodoPago,
    t.tipoOperacion,
    {
      text: formatoDinero(t.monto),
      alignment: 'right',
      color: t.monto < 0 ? COLOR.negativo : COLOR.texto,
    },
  ]);
  const total = datos.transacciones.reduce((suma, t) => suma + t.monto, 0);
  const pie = [
    {
      text: `Total neto (${datos.transacciones.length} movimientos)`,
      bold: true,
      colSpan: columnas.length - 1,
    },
    ...Array.from({ length: columnas.length - 2 }, () => ({ text: '' })),
    { text: formatoDinero(total), bold: true, alignment: 'right' },
  ];
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: columnas.map((c) => c.ancho),
      body: [cabecera, ...filas, pie],
    },
    layout: layoutTabla,
    fontSize: 7.5,
  };
}

function tablaInventario(datos: DatosReportePdf): Nodo {
  if (datos.inventarioBajoMinimo.length === 0) {
    return {
      text: 'No hay insumos bajo el stock mínimo.',
      color: COLOR.positivo,
      fontSize: 8.5,
    };
  }
  const cabecera = [
    ...(datos.esGlobal ? ['Sede'] : []),
    'Insumo',
    'Stock actual',
    'Stock mínimo',
  ].map((t, i, arr) => ({
    text: t,
    bold: true,
    color: COLOR.primario,
    alignment: i >= arr.length - 2 ? 'right' : 'left',
  }));
  const filas = datos.inventarioBajoMinimo.map((i) => [
    ...(datos.esGlobal ? [i.sede] : []),
    i.nombre,
    {
      text: numero.format(i.stockActual),
      alignment: 'right',
      color: COLOR.negativo,
      bold: true,
    },
    { text: numero.format(i.stockMinimo), alignment: 'right' },
  ]);
  return {
    table: {
      headerRows: 1,
      widths: [...(datos.esGlobal ? [110] : []), '*', 70, 70],
      body: [cabecera, ...filas],
    },
    layout: layoutTabla,
    fontSize: 8,
  };
}

// ----- Documento -----

export function construirReportePdf(datos: DatosReportePdf): Nodo {
  const { actual, anterior } = datos;
  const agrupacion = agrupacionPara(actual.dias);

  const kpis: Kpi[] = [
    {
      etiqueta: 'Ingresos netos',
      valor: formatoDinero(actual.ingresosNetos),
      delta: variacion(actual.ingresosNetos, anterior.ingresosNetos),
    },
    {
      etiqueta: 'Ocupación promedio',
      valor: formatoPorcentaje(actual.ocupacion),
      delta: variacion(actual.ocupacion, anterior.ocupacion),
    },
    {
      etiqueta: 'Tarifa prom. noche (ADR)',
      valor: formatoDinero(actual.adr),
      delta: variacion(actual.adr, anterior.adr),
    },
    {
      etiqueta: 'Ingreso por hab. (RevPAR)',
      valor: formatoDinero(actual.revpar),
      delta: variacion(actual.revpar, anterior.revpar),
    },
    {
      etiqueta: 'Reservas (llegadas)',
      valor: numero.format(actual.reservas),
      delta: variacion(actual.reservas, anterior.reservas),
    },
    {
      etiqueta: 'Cancelaciones',
      valor: `${numero.format(actual.cancelaciones)} (${formatoPorcentaje(actual.tasaCancelacion)})`,
      delta: variacion(actual.cancelaciones, anterior.cancelaciones),
      invertido: true,
    },
    {
      etiqueta: 'Estadía promedio',
      valor: `${decimal.format(actual.estadiaPromedio)} noches`,
      delta: variacion(actual.estadiaPromedio, anterior.estadiaPromedio),
    },
    {
      etiqueta: 'Saldo por cobrar',
      valor: formatoDinero(datos.saldoPorCobrar),
      nota: `${numero.format(datos.reservasConSaldo)} reservas activas, al ${fechaCorta(datos.generadoEn)}`,
    },
  ];

  const resumen = [
    `Pagos recibidos: ${formatoDinero(actual.ingresosBrutos)} (${numero.format(actual.cantidadPagos)} movimientos)`,
    `Reembolsos: ${formatoDinero(actual.reembolsos)}`,
    `Noches vendidas: ${numero.format(actual.nochesVendidas)} de ${numero.format(actual.nochesDisponibles)} disponibles`,
    `Habitaciones activas: ${numero.format(actual.habitaciones)}`,
  ];

  return {
    pageSize: 'A4',
    pageMargins: [40, 56, 40, 48],
    // Evita títulos de sección huérfanos al final de una página.
    pageBreakBefore: (nodo: {
      headlineLevel?: number;
      startPosition: { top: number };
    }) => nodo.headlineLevel === 1 && nodo.startPosition.top > 841.89 - 48 - 90,
    info: {
      title: `Reporte de gestión – ${datos.alcance} – ${rangoLegible(datos.periodo)}`,
      author: datos.empresa.nombre,
      creator: 'Hospal PMS',
    },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: COLOR.texto },
    styles: {
      titulo: { fontSize: 20, bold: true, color: COLOR.texto },
      seccion: {
        fontSize: 12,
        bold: true,
        color: COLOR.primario,
        margin: [0, 18, 0, 8],
      },
      subtitulo: { fontSize: 9, bold: true, color: COLOR.texto },
    },
    header: () => ({
      margin: [40, 22, 40, 0],
      columns: [
        {
          text: datos.empresa.nombre,
          bold: true,
          fontSize: 8,
          color: COLOR.primario,
        },
        {
          text: `Reporte de gestión · ${datos.alcance}`,
          alignment: 'right',
          fontSize: 8,
          color: COLOR.secundario,
        },
      ],
    }),
    footer: (pagina: number, total: number) => ({
      margin: [40, 16, 40, 0],
      columns: [
        {
          text: `Generado el ${fechaHora(datos.generadoEn)}`,
          fontSize: 7,
          color: COLOR.secundario,
        },
        {
          text: `Página ${pagina} de ${total}`,
          alignment: 'right',
          fontSize: 7,
          color: COLOR.secundario,
        },
      ],
    }),
    content: [
      {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 36, h: 4, color: COLOR.primario },
        ],
        margin: [0, 0, 0, 10],
      },
      { text: 'Reporte de gestión', style: 'titulo' },
      {
        text: datos.alcance,
        fontSize: 12,
        color: COLOR.secundario,
        margin: [0, 2, 0, 8],
      },
      {
        columns: [
          {
            width: 'auto',
            stack: [
              {
                text: 'PERIODO',
                fontSize: 6.5,
                bold: true,
                color: COLOR.secundario,
              },
              {
                text: `${rangoLegible(datos.periodo)} (${actual.dias} días)`,
                bold: true,
              },
            ],
          },
          {
            width: 'auto',
            margin: [24, 0, 0, 0],
            stack: [
              {
                text: 'COMPARADO CON',
                fontSize: 6.5,
                bold: true,
                color: COLOR.secundario,
              },
              { text: rangoLegible(datos.periodoAnterior) },
            ],
          },
          {
            width: '*',
            alignment: 'right',
            stack: [
              { text: datos.empresa.razonSocial, fontSize: 8 },
              {
                text: `RUT ${datos.empresa.rut}`,
                fontSize: 8,
                color: COLOR.secundario,
              },
            ],
          },
        ],
      },

      { text: 'Indicadores principales', style: 'seccion' },
      grillaKpis(kpis),
      {
        ul: resumen,
        fontSize: 8,
        color: COLOR.secundario,
        margin: [0, 8, 0, 0],
      },
      {
        text:
          'Ingresos netos = pagos registrados en el periodo menos reembolsos. ADR y RevPAR usan el precio de las reservas ' +
          'prorrateado por noche ocupada. Ocupación = noches vendidas / (habitaciones activas × días).',
        fontSize: 6.5,
        italics: true,
        color: COLOR.secundario,
        margin: [0, 6, 0, 0],
      },

      { text: 'Evolución del periodo', style: 'seccion', headlineLevel: 1 },
      graficoBarras(
        'Ingresos netos',
        agruparSerie(actual.ingresosDiarios, agrupacion, 'suma'),
        agrupacion,
        {
          color: COLOR.primario,
          formato: formatoDinero,
        },
      ),
      graficoBarras(
        'Ocupación',
        agruparSerie(actual.ocupacionDiaria, agrupacion, 'promedio'),
        agrupacion,
        {
          color: COLOR.ocupacion,
          formato: formatoPorcentaje,
          maximoFijo: 100,
        },
      ),

      { text: 'Alertas de inventario', style: 'seccion', headlineLevel: 1 },
      tablaInventario(datos),

      {
        text: 'Anexo: transacciones del periodo',
        style: 'seccion',
        headlineLevel: 1,
      },
      datos.transacciones.length
        ? tablaTransacciones(datos)
        : {
            text: 'No se registraron pagos en el periodo.',
            color: COLOR.secundario,
          },
    ],
  };
}
