// src/lib/excelReportGenerator.ts
// Motor Nativo OpenXML (.xlsx Multi-Hoja) + Exportador CSV RFC 4180 + Score DataROI Universal + Nombres Ejecutivos y Estado Global Versus

export type EstiloCeldaExcel =
  | 'default'
  | 'header'
  | 'winner'
  | 'warning'
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'section'
  | 'zebra'
  | 'bold'
  | 'bold_zebra';

export interface CeldaExcelObj {
  v: string | number | null | undefined;
  s?: EstiloCeldaExcel;
}

export type ValorCeldaExcel = string | number | null | undefined | CeldaExcelObj;

export interface HojaExcelConfig {
  nombre: string;
  cabeceras: string[];
  filas: ValorCeldaExcel[][];
}

// ============================================================================
// 0. DICCIONARIO DE NOMBRES EJECUTIVOS (EVITA TÍTULOS BUROCRÁTICOS DE 6 LÍNEAS)
// ============================================================================
export const NOMBRES_EJECUTIVOS_CARRERAS: Record<string, string> = {
  '061000': 'Innovación en TIC y Sistemas Digitales',
  '042000': 'Administración y Gestión Empresarial',
  '071300': 'Ingeniería Electrónica y Automatización',
  '042400': 'Administración en Ingeniería y Construcción',
  '012100': 'Docencia en Educación Preescolar',
  '012300': 'Docencia en Educación Secundaria',
  '012200': 'Docencia en Educación Primaria',
  '021400': 'Producción y Tecnologías Audiovisuales',
  '071100': 'Ingeniería Mecánica y Metalmecánica',
  '071600': 'Ingeniería y Tecnología Ambiental',
  '072400': 'Ingeniería en Minería y Metalurgia',
  '081100': 'Ingeniería Agronómica y Zootecnia',
  '042200': 'Administración Turística y Restaurantera',
  '071500': 'Ingeniería Automotriz y Aeronáutica',
  '021500': 'Diseño Gráfico y Comunicación Editorial',
  '012702': 'Docencia en Educación Especial',
  '021600': 'Diseño Industrial, de Moda e Interiores',
  '012601': 'Docencia en Cultura Física y Deporte',
  '093100': 'Odontología y Estomatología General',
  '022200': 'Enseñanza y Lenguas Extranjeras',
  '092100': 'Enfermería y Obstetricia',
  '073200': 'Ingeniería Civil y Construcción'
};

export function formatearNombreCarreraEjecutivo(cve: string, nombreOficial: string): string {
  const cvePad = String(cve || '').trim().padStart(6, '0');
  return NOMBRES_EJECUTIVOS_CARRERAS[cvePad] || nombreOficial;
}

// ============================================================================
// 0.1 SINCRONIZACIÓN GLOBAL DEL COMPARADOR CARA A CARA (VERSUS) ENTRE PÁGINAS
// ============================================================================
export const STORAGE_KEY_DESCUBRIDOR = 'dataroi_descubridor_state_v2';
export const EVENTO_VERSUS_SYNC = 'dataroi-versus-sync';

export function leerEstadoDescubridorGlobal(): {
  regionActiva: string;
  generoActivo: 0 | 1 | 2;
  sueldoMinimo: number;
  modoEvaluacion: 'calificacion' | 'afinidad';
  activos: string[];
  carrerasCompararCves: string[];
} {
  const fallback = {
    regionActiva: 'nacional',
    generoActivo: 0 as 0 | 1 | 2,
    sueldoMinimo: 10500,
    modoEvaluacion: 'calificacion' as 'calificacion' | 'afinidad',
    activos: [] as string[],
    carrerasCompararCves: [] as string[]
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_DESCUBRIDOR);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      regionActiva: parsed.regionActiva || 'nacional',
      generoActivo: parsed.generoActivo === 1 || parsed.generoActivo === 2 ? parsed.generoActivo : 0,
      sueldoMinimo: typeof parsed.sueldoMinimo === 'number' ? parsed.sueldoMinimo : 10500,
      modoEvaluacion: parsed.modoEvaluacion === 'afinidad' ? 'afinidad' : 'calificacion',
      activos: Array.isArray(parsed.activos) ? parsed.activos.slice(0, 5) : [],
      carrerasCompararCves: Array.isArray(parsed.carrerasCompararCves)
        ? parsed.carrerasCompararCves.map((c: any) => String(c).padStart(6, '0')).slice(0, 3)
        : []
    };
  } catch {
    return fallback;
  }
}

export function toggleCarreraComparadorGlobal(cve: string): string[] {
  if (typeof window === 'undefined') return [];
  const cvePad = String(cve).trim().padStart(6, '0');
  try {
    const actual = leerEstadoDescubridorGlobal();
    let nuevaLista = [...actual.carrerasCompararCves];
    if (nuevaLista.includes(cvePad)) {
      nuevaLista = nuevaLista.filter(item => item !== cvePad);
    } else if (nuevaLista.length < 3) {
      nuevaLista.push(cvePad);
    }
    const nuevoEstado = { ...actual, carrerasCompararCves: nuevaLista };
    sessionStorage.setItem(STORAGE_KEY_DESCUBRIDOR, JSON.stringify(nuevoEstado));
    window.dispatchEvent(new CustomEvent(EVENTO_VERSUS_SYNC, { detail: nuevaLista }));
    return nuevaLista;
  } catch {
    return [];
  }
}

export function limpiarComparadorGlobal(): void {
  if (typeof window === 'undefined') return;
  try {
    const actual = leerEstadoDescubridorGlobal();
    const nuevoEstado = { ...actual, carrerasCompararCves: [] };
    sessionStorage.setItem(STORAGE_KEY_DESCUBRIDOR, JSON.stringify(nuevoEstado));
    window.dispatchEvent(new CustomEvent(EVENTO_VERSUS_SYNC, { detail: [] }));
  } catch {
    // Ignorar errores en modo privado
  }
}

// ============================================================================
// 0.2 MOTOR MATEMÁTICO UNIFICADO: CALIFICACIÓN INTEGRAL DATAROI (0 A 100)
// ============================================================================
export interface ParametrosScoreDataROI {
  Prima_vs_Prepa_Pct: number;
  Desempleo_Abierto_Pct: number;
  Saturacion_ANUIES_Pct: number;
  Empleo_Calidad_OIT_Pct: number;
  Formalidad_Total_Pct: number;
  Meritocracia_Pct: number;
  Blindaje_IA_Pct: number;
  Cambio_Real_PostPandemia_Pct?: number;
  Tendencia_Codigo?: string;
  Empleo_Unico_Pct?: number;
  Arraigo_Local_Pct?: number;
}

export interface ResultadoScoreDataROI {
  score: number;
  scoreEntero: number;
  pilares: {
    retornoSalarial: number;
    empleabilidad: number;
    calidadOIT: number;
    meritocracia: number;
    blindajeFuturo: number;
    estabilidadVida: number;
  };
}

export function calcularScoreDataROIUniversal(p: ParametrosScoreDataROI): ResultadoScoreDataROI {
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  // 1. Retorno Salarial (25%): Basado en Prima Salarial vs Preparatoria (intrínseco al mercado laboral)
  const pRetorno = Math.round(clamp(((p.Prima_vs_Prepa_Pct - 5.0) / (95.0 - 5.0)) * 100, 15, 98));

  // 2. Empleabilidad Real (20%): 55% Bajo Desempleo + 45% Baja Saturación ANUIES
  const subDesemp = clamp(100 - p.Desempleo_Abierto_Pct * 7.5, 15, 98);
  const subSat = clamp(155 - p.Saturacion_ANUIES_Pct * 0.65, 10, 98);
  const pEmpleo = Math.round(subDesemp * 0.55 + subSat * 0.45);

  // 3. Calidad Formal OIT (20%): Tasa de Empleo de Calidad OIT respaldada por Formalidad Total
  const pCalidad = Math.round(clamp((p.Empleo_Calidad_OIT_Pct / 72.0) * 100, 20, 98));

  // 4. Apertura y Meritocracia (15%): Índice Chetty/CEEY (bajo nepotismo + inclusión socioeconómica)
  const pMerito = Math.round(clamp((p.Meritocracia_Pct / 76.0) * 100, 20, 98));

  // 5. Blindaje IA y Tendencia (10%): 65% Resiliencia Humana ante IA + 35% Impulso Salarial Post-Pandemia
  const cambioReal =
    typeof p.Cambio_Real_PostPandemia_Pct === 'number'
      ? p.Cambio_Real_PostPandemia_Pct
      : p.Tendencia_Codigo === 'crecimiento'
        ? 9.0
        : p.Tendencia_Codigo === 'ajuste'
          ? -5.0
          : 2.0;
  const subTend = clamp(50 + cambioReal * 3.0, 20, 98);
  const pFuturo = Math.round(clamp(p.Blindaje_IA_Pct, 10, 98) * 0.65 + subTend * 0.35);

  // 6. Estabilidad de Vida (10%): Empleo Único sin Pluriempleo + Arraigo Local + Cobertura Formal
  const empUnico = typeof p.Empleo_Unico_Pct === 'number' ? p.Empleo_Unico_Pct : 94.0;
  const arraigo = typeof p.Arraigo_Local_Pct === 'number' ? p.Arraigo_Local_Pct : 97.0;
  const pEstabilidad = Math.round(
    clamp(empUnico * 0.35 + arraigo * 0.25 + clamp(p.Formalidad_Total_Pct * 1.15, 25, 96) * 0.40, 25, 98)
  );

  const score = Number(
    (
      pRetorno * 0.25 +
      pEmpleo * 0.20 +
      pCalidad * 0.20 +
      pMerito * 0.15 +
      pFuturo * 0.10 +
      pEstabilidad * 0.10
    ).toFixed(1)
  );

  return {
    score,
    scoreEntero: Math.round(score),
    pilares: {
      retornoSalarial: pRetorno,
      empleabilidad: pEmpleo,
      calidadOIT: pCalidad,
      meritocracia: pMerito,
      blindajeFuturo: pFuturo,
      estabilidadVida: pEstabilidad
    }
  };
}

export function obtenerSemaforoScoreDataROI(score: number) {
  const entero = Math.round(score);
  if (entero >= 70) {
    return {
      grado: 'A',
      etiqueta: 'Sobresaliente',
      colorHex: '#059669',
      trackHex: '#D1FAE5',
      fillTintHex: '#ECFDF5',
      textClass: 'text-emerald-700',
      bgBadgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      ringBgClass: 'bg-emerald-50/70 border-emerald-200',
      topBorderClass: 'border-t-emerald-500'
    };
  }
  if (entero >= 56) {
    return {
      grado: 'B',
      etiqueta: 'Viable',
      colorHex: '#D97706',
      trackHex: '#FEF3C7',
      fillTintHex: '#FFFBEB',
      textClass: 'text-amber-700',
      bgBadgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      ringBgClass: 'bg-amber-50/70 border-amber-200',
      topBorderClass: 'border-t-amber-500'
    };
  }
  return {
    grado: 'C',
    etiqueta: 'En Riesgo',
    colorHex: '#E11D48',
    trackHex: '#FFE4E6',
    fillTintHex: '#FFF1F2',
    textClass: 'text-rose-700',
    bgBadgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    ringBgClass: 'bg-rose-50/70 border-rose-200',
    topBorderClass: 'border-t-rose-500'
  };
}

// ============================================================================
// 1. EXPORTADOR CSV BLINDADO BAJO ESTÁNDAR RFC 4180 (CERO DESFASES DE COLUMNA)
// ============================================================================
export function escaparCeldaCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const raw = typeof val === 'object' && 'v' in val ? val.v : val;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  const str = String(raw ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `"${str.replace(/"/g, '""')}"`;
}

export function descargarCSVEstilizado(
  nombreArchivo: string,
  cabeceras: string[],
  filas: ValorCeldaExcel[][]
) {
  const lineaCabecera = cabeceras.map(c => escaparCeldaCSV(c)).join(',');
  const lineasFilas = filas.map(fila => fila.map(celda => escaparCeldaCSV(celda)).join(','));
  const contenido = '\uFEFF' + [lineaCabecera, ...lineasFilas].join('\r\n');

  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ============================================================================
// 2. GENERADOR NATIVO DE LIBROS DE EXCEL (.XLSX MULTI-HOJA CON ALINEACIÓN UNIFORME)
// ============================================================================
const STYLE_INDEX_MAP: Record<EstiloCeldaExcel, number> = {
  default: 1,
  header: 2,
  winner: 3,
  gold: 4,
  silver: 5,
  bronze: 6,
  section: 7,
  zebra: 8,
  bold: 9,
  bold_zebra: 10,
  warning: 11
};

const AMP = String.fromCharCode(38);

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, AMP + 'amp;')
    .replace(/</g, AMP + 'lt;')
    .replace(/>/g, AMP + 'gt;')
    .replace(/"/g, AMP + 'quot;')
    .replace(/'/g, AMP + 'apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function colIndexToLetter(colIdx: number): string {
  let n = colIdx + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

function construirStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="8">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="10.5"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF065F46"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF92400E"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF9A3412"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF1E3A8A"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF9F1239"/><name val="Calibri"/></font>
  </fonts>
  <fills count="11">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFE4E6"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function construirSheetXml(hoja: HojaExcelConfig): string {
  const numCols = Math.max(
    hoja.cabeceras.length,
    ...hoja.filas.map(f => f.length)
  );

  const anchos = new Array(numCols).fill(13);
  hoja.cabeceras.forEach((cab, cIdx) => {
    anchos[cIdx] = Math.max(anchos[cIdx], String(cab || '').length + 5);
  });

  hoja.filas.forEach(fila => {
    fila.forEach((celda, cIdx) => {
      const rawVal = celda && typeof celda === 'object' && 'v' in celda ? celda.v : celda;
      const len = String(rawVal ?? '').length;
      if (len + 4 > anchos[cIdx]) {
        anchos[cIdx] = Math.min(58, len + 4);
      }
    });
  });

  const colsXml = anchos
    .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const rowsXml: string[] = [];

  const celdasHeader = hoja.cabeceras
    .map((cab, cIdx) => {
      const ref = `${colIndexToLetter(cIdx)}1`;
      return `<c r="${ref}" t="inlineStr" s="${STYLE_INDEX_MAP.header}"><is><t>${escapeXml(cab)}</t></is></c>`;
    })
    .join('');
  rowsXml.push(`<row r="1" ht="23" customHeight="1">${celdasHeader}</row>`);

  hoja.filas.forEach((fila, rIdx) => {
    const numFila = rIdx + 2;
    const esFilaCebra = rIdx % 2 === 1;
    const estiloDefaultFila: EstiloCeldaExcel = esFilaCebra ? 'zebra' : 'default';

    const celdasFila = fila
      .map((celda, cIdx) => {
        const ref = `${colIndexToLetter(cIdx)}${numFila}`;
        const esObj = celda !== null && typeof celda === 'object' && 'v' in celda;
        const rawVal = esObj ? (celda as CeldaExcelObj).v : celda;
        let estilo: EstiloCeldaExcel =
          esObj && (celda as CeldaExcelObj).s ? (celda as CeldaExcelObj).s! : estiloDefaultFila;

        if (estilo === 'default' && esFilaCebra) {
          estilo = 'zebra';
        } else if (estilo === 'bold' && esFilaCebra) {
          estilo = 'bold_zebra';
        }

        const sIdx = STYLE_INDEX_MAP[estilo] ?? STYLE_INDEX_MAP.default;

        if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
          return `<c r="${ref}" t="n" s="${sIdx}"><v>${rawVal}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr" s="${sIdx}"><is><t>${escapeXml(String(rawVal ?? ''))}</t></is></c>`;
      })
      .join('');

    rowsXml.push(`<row r="${numFila}" ht="20" customHeight="1">${celdasFila}</row>`);
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml.join('')}</sheetData>
</worksheet>`;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Bytes(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crearZipStored(archivos: { path: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const entries = archivos.map(a => {
    const nameBytes = encoder.encode(a.path);
    const dataBytes = encoder.encode(a.content);
    const crc = crc32Bytes(dataBytes);
    return { nameBytes, dataBytes, crc, offset: 0 };
  });

  let totalLocalSize = 0;
  entries.forEach(e => {
    e.offset = totalLocalSize;
    totalLocalSize += 30 + e.nameBytes.length + e.dataBytes.length;
  });

  let centralDirSize = 0;
  entries.forEach(e => {
    centralDirSize += 46 + e.nameBytes.length;
  });

  const buffer = new ArrayBuffer(totalLocalSize + centralDirSize + 22);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let pos = 0;
  entries.forEach(e => {
    view.setUint32(pos, 0x04034b50, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 0, true);
    view.setUint16(pos + 8, 0, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, 0, true);
    view.setUint32(pos + 14, e.crc, true);
    view.setUint32(pos + 18, e.dataBytes.length, true);
    view.setUint32(pos + 22, e.dataBytes.length, true);
    view.setUint16(pos + 26, e.nameBytes.length, true);
    view.setUint16(pos + 28, 0, true);
    pos += 30;
    bytes.set(e.nameBytes, pos);
    pos += e.nameBytes.length;
    bytes.set(e.dataBytes, pos);
    pos += e.dataBytes.length;
  });

  const centralDirStart = pos;
  entries.forEach(e => {
    view.setUint32(pos, 0x02014b50, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 20, true);
    view.setUint16(pos + 8, 0, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, 0, true);
    view.setUint16(pos + 14, 0, true);
    view.setUint32(pos + 16, e.crc, true);
    view.setUint32(pos + 20, e.dataBytes.length, true);
    view.setUint32(pos + 24, e.dataBytes.length, true);
    view.setUint16(pos + 28, e.nameBytes.length, true);
    view.setUint16(pos + 30, 0, true);
    view.setUint16(pos + 32, 0, true);
    view.setUint16(pos + 34, 0, true);
    view.setUint16(pos + 36, 0, true);
    view.setUint32(pos + 38, 0, true);
    view.setUint32(pos + 42, e.offset, true);
    pos += 46;
    bytes.set(e.nameBytes, pos);
    pos += e.nameBytes.length;
  });

  view.setUint32(pos, 0x06054b50, true);
  view.setUint16(pos + 4, 0, true);
  view.setUint16(pos + 6, 0, true);
  view.setUint16(pos + 8, entries.length, true);
  view.setUint16(pos + 10, entries.length, true);
  view.setUint32(pos + 12, centralDirSize, true);
  view.setUint32(pos + 16, centralDirStart, true);
  view.setUint16(pos + 20, 0, true);

  return bytes;
}

export function descargarLibroExcelXLSX(
  nombreArchivo: string,
  hojas: HojaExcelConfig[]
) {
  if (!hojas || hojas.length === 0) return;

  const overridesSheets = hojas
    .map(
      (_, idx) =>
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ');

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${overridesSheets}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const wbRelsItems = hojas
    .map(
      (_, idx) =>
        `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`
    )
    .join('\n  ');

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${wbRelsItems}
  <Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const sheetsEntries = hojas
    .map((h, idx) => {
      const cleanName = escapeXml(h.nombre.replace(/[\\/?*[\]:]/g, '').slice(0, 31)) || `Hoja_${idx + 1}`;
      return `<sheet name="${cleanName}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`;
    })
    .join('\n    ');

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetsEntries}
  </sheets>
</workbook>`;

  const files: { path: string; content: string }[] = [
    { path: '[Content_Types].xml', content: contentTypes },
    { path: '_rels/.rels', content: rootRels },
    { path: 'xl/_rels/workbook.xml.rels', content: wbRels },
    { path: 'xl/workbook.xml', content: workbookXml },
    { path: 'xl/styles.xml', content: construirStylesXml() }
  ];

  hojas.forEach((h, idx) => {
    files.push({
      path: `xl/worksheets/sheet${idx + 1}.xml`,
      content: construirSheetXml(h)
    });
  });

  const zipBytes = crearZipStored(files);
  const blob = new Blob([zipBytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}