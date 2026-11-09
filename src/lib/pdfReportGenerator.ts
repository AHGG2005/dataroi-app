// src/lib/pdfReportGenerator.ts
// Motor Vectorial Nativo PDF 1.4 de Alta Fidelidad (Con Curvas de Bézier, Opacidad /ExtGState, Mosaico Bento y Rieles Divergentes)

const CP1252_EXTRA_MAP: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f
};

function sanitizePdfText(str: string): string {
  return String(str || '')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, '');
}

function encodeWinAnsiLiteral(str: string): string {
  const clean = sanitizePdfText(str);
  let out = '(';
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    let byte = 32;
    if (code >= 0x20 && code <= 0x7e) {
      byte = code;
    } else if (code >= 0xa0 && code <= 0xff) {
      byte = code;
    } else if (CP1252_EXTRA_MAP[code] !== undefined) {
      byte = CP1252_EXTRA_MAP[code];
    }
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out += '\\' + String.fromCharCode(byte);
    } else if (byte < 0x20 || byte > 0x7e) {
      out += '\\' + byte.toString(8).padStart(3, '0');
    } else {
      out += String.fromCharCode(byte);
    }
  }
  out += ')';
  return out;
}

function wrapTextByChars(text: string, maxCharsPerLine: number): string[] {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
    } else if ((current + ' ' + w).length <= maxCharsPerLine) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

type RGB = [number, number, number];

class VectorPageCanvas {
  public ops: string[] = [];
  public readonly W = 841.89; // A4 Landscape width (pt)
  public readonly H = 595.28; // A4 Landscape height (pt)

  private toPdfY(topY: number, h = 0): number {
    return Number((this.H - topY - h).toFixed(2));
  }

  public rect(x: number, topY: number, w: number, h: number, fill?: RGB, stroke?: RGB, lineWidth = 0.8) {
    const py = this.toPdfY(topY, h);
    this.ops.push('q');
    if (fill) {
      this.ops.push(`${fill[0].toFixed(3)} ${fill[1].toFixed(3)} ${fill[2].toFixed(3)} rg`);
    }
    if (stroke) {
      this.ops.push(`${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG`);
      this.ops.push(`${lineWidth.toFixed(2)} w`);
    }
    const mode = fill && stroke ? 'B' : fill ? 'f' : 'S';
    this.ops.push(`${x.toFixed(2)} ${py.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
    this.ops.push('Q');
  }

  public roundedRect(
    x: number,
    topY: number,
    w: number,
    h: number,
    r = 6,
    fill?: RGB,
    stroke?: RGB,
    lineWidth = 0.8
  ) {
    if (w <= 0 || h <= 0) return;
    const py = this.toPdfY(topY, h);
    const radius = Math.min(r, w / 2, h / 2);
    const k = 0.55228475 * radius;
    const x0 = x;
    const y0 = py;
    const x1 = x + w;
    const y1 = py + h;

    this.ops.push('q');
    if (fill) {
      this.ops.push(`${fill[0].toFixed(3)} ${fill[1].toFixed(3)} ${fill[2].toFixed(3)} rg`);
    }
    if (stroke) {
      this.ops.push(`${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG`);
      this.ops.push(`${lineWidth.toFixed(2)} w`);
    }
    const mode = fill && stroke ? 'B' : fill ? 'f' : 'S';
    this.ops.push(
      `${(x0 + radius).toFixed(2)} ${y0.toFixed(2)} m`,
      `${(x1 - radius).toFixed(2)} ${y0.toFixed(2)} l`,
      `${(x1 - radius + k).toFixed(2)} ${y0.toFixed(2)} ${x1.toFixed(2)} ${(y0 + radius - k).toFixed(2)} ${x1.toFixed(2)} ${(y0 + radius).toFixed(2)} c`,
      `${x1.toFixed(2)} ${(y1 - radius).toFixed(2)} l`,
      `${x1.toFixed(2)} ${(y1 - radius + k).toFixed(2)} ${(x1 - radius + k).toFixed(2)} ${y1.toFixed(2)} ${(x1 - radius).toFixed(2)} ${y1.toFixed(2)} c`,
      `${(x0 + radius).toFixed(2)} ${y1.toFixed(2)} l`,
      `${(x0 + radius - k).toFixed(2)} ${y1.toFixed(2)} ${x0.toFixed(2)} ${(y1 - radius + k).toFixed(2)} ${x0.toFixed(2)} ${(y1 - radius).toFixed(2)} c`,
      `${x0.toFixed(2)} ${(y0 + radius).toFixed(2)} l`,
      `${x0.toFixed(2)} ${(y0 + radius - k).toFixed(2)} ${(x0 + radius - k).toFixed(2)} ${y0.toFixed(2)} ${(x0 + radius).toFixed(2)} ${y0.toFixed(2)} c`,
      `h ${mode}`
    );
    this.ops.push('Q');
  }

  public circle(cx: number, topCy: number, r: number, fill?: RGB, stroke?: RGB, lineWidth = 1.2) {
    const cy = this.toPdfY(topCy);
    const k = 0.55228475 * r;
    this.ops.push('q');
    if (fill) {
      this.ops.push(`${fill[0].toFixed(3)} ${fill[1].toFixed(3)} ${fill[2].toFixed(3)} rg`);
    }
    if (stroke) {
      this.ops.push(`${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG`);
      this.ops.push(`${lineWidth.toFixed(2)} w`);
    }
    const mode = fill && stroke ? 'B' : fill ? 'f' : 'S';
    this.ops.push(
      `${cx.toFixed(2)} ${(cy + r).toFixed(2)} m`,
      `${(cx + k).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c`,
      `${(cx + r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + k).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c`,
      `${(cx - k).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c`,
      `${(cx - r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - k).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c`,
      `h ${mode}`
    );
    this.ops.push('Q');
  }

  public line(x1: number, topY1: number, x2: number, topY2: number, stroke: RGB, lineWidth = 1.0, dashed = false) {
    const py1 = this.toPdfY(topY1);
    const py2 = this.toPdfY(topY2);
    this.ops.push('q');
    this.ops.push(`${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG`);
    this.ops.push(`${lineWidth.toFixed(2)} w`);
    if (dashed) {
      this.ops.push('[3 2] 0 d');
    }
    this.ops.push(`${x1.toFixed(2)} ${py1.toFixed(2)} m ${x2.toFixed(2)} ${py2.toFixed(2)} l S`);
    this.ops.push('Q');
  }

  public polygon(
    points: { x: number; y: number }[],
    stroke?: RGB,
    lineWidth = 1.2,
    dashed = false,
    fill?: RGB,
    alphaState: 'GS_Alpha15' | 'GS_Alpha25' | null = null
  ) {
    if (points.length < 2) return;
    const p0 = points[0];

    if (fill) {
      this.ops.push('q');
      if (alphaState) {
        this.ops.push(`/${alphaState} gs`);
      }
      this.ops.push(`${fill[0].toFixed(3)} ${fill[1].toFixed(3)} ${fill[2].toFixed(3)} rg`);
      this.ops.push(`${p0.x.toFixed(2)} ${this.toPdfY(p0.y).toFixed(2)} m`);
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        this.ops.push(`${p.x.toFixed(2)} ${this.toPdfY(p.y).toFixed(2)} l`);
      }
      this.ops.push('h f');
      this.ops.push('Q');
    }

    if (stroke) {
      this.ops.push('q');
      this.ops.push(`${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG`);
      this.ops.push(`${lineWidth.toFixed(2)} w`);
      if (dashed) {
        this.ops.push('[3 2] 0 d');
      }
      this.ops.push(`${p0.x.toFixed(2)} ${this.toPdfY(p0.y).toFixed(2)} m`);
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        this.ops.push(`${p.x.toFixed(2)} ${this.toPdfY(p.y).toFixed(2)} l`);
      }
      this.ops.push('h S');
      this.ops.push('Q');
    }
  }

  public text(
    str: string,
    x: number,
    topY: number,
    size = 9,
    bold = false,
    color: RGB = [0.06, 0.09, 0.16],
    align: 'left' | 'center' | 'right' = 'left'
  ) {
    const clean = sanitizePdfText(str);
    if (!clean) return;
    const approxWidth = clean.length * size * (bold ? 0.52 : 0.48);
    let drawX = x;
    if (align === 'center') drawX = x - approxWidth / 2;
    if (align === 'right') drawX = x - approxWidth;
    const py = this.toPdfY(topY, size * 0.78);
    const fontKey = bold ? '/F2' : '/F1';
    this.ops.push('q');
    this.ops.push(
      `BT ${fontKey} ${size.toFixed(1)} Tf ${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg ${drawX.toFixed(2)} ${py.toFixed(2)} Td ${encodeWinAnsiLiteral(clean)} Tj ET`
    );
    this.ops.push('Q');
  }

  public getStream(): string {
    return this.ops.join('\n');
  }
}

function buildAndDownloadPdfDocument(pages: VectorPageCanvas[], filename: string) {
  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const pageObjIds: number[] = [];
  const fontRegularId = 3;
  const fontBoldId = 4;
  const gsAlpha15Id = 5;
  const gsAlpha25Id = 6;

  let nextId = 7;
  const pageObjects: string[] = [];

  for (const p of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageObjIds.push(pageId);
    const stream = p.getStream();
    pageObjects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.W.toFixed(2)} ${p.H.toFixed(2)}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> /ExtGState << /GS_Alpha15 ${gsAlpha15Id} 0 R /GS_Alpha25 ${gsAlpha25Id} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );
    pageObjects.push(
      `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
  }

  const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pages.length} >>\nendobj\n`);
  objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`);
  objects.push(`5 0 obj\n<< /Type /ExtGState /ca 0.14 /CA 1.0 >>\nendobj\n`);
  objects.push(`6 0 obj\n<< /Type /ExtGState /ca 0.25 /CA 1.0 >>\nendobj\n`);
  objects.push(...pageObjects);

  let pdfContent = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(pdfContent.length);
    pdfContent += obj;
  }

  const xrefPos = pdfContent.length;
  pdfContent += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdfContent += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdfContent += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  const bytes = new Uint8Array(pdfContent.length);
  for (let i = 0; i < pdfContent.length; i++) {
    bytes[i] = pdfContent.charCodeAt(i) & 0xff;
  }

  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const C_BG: RGB = [0.973, 0.980, 0.988];
const C_WHITE: RGB = [1, 1, 1];
const C_DARK: RGB = [0.059, 0.090, 0.165];
const C_SLATE: RGB = [0.392, 0.455, 0.545];
const C_SLATE_LIGHT: RGB = [0.945, 0.961, 0.976];
const C_BORDER: RGB = [0.855, 0.882, 0.918];
const C_BLUE: RGB = [0.145, 0.388, 0.922];
const C_BLUE_SOFT: RGB = [0.376, 0.647, 0.980];
const C_BLUE_LIGHT: RGB = [0.937, 0.965, 1.0];
const C_SKY: RGB = [0.220, 0.741, 0.973];
const C_EMERALD: RGB = [0.020, 0.588, 0.412];
const C_EMERALD_LIGHT: RGB = [0.925, 0.992, 0.961];
const C_AMBER: RGB = [0.851, 0.467, 0.024];
const C_AMBER_LIGHT: RGB = [1.0, 0.984, 0.922];
const C_ROSE: RGB = [0.882, 0.114, 0.282];
const C_PURPLE: RGB = [0.576, 0.200, 0.918];
const C_ORANGE: RGB = [0.918, 0.345, 0.047];

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v || 0);

export interface ReporteCarreraPDFPayload {
  cve_carrera: string;
  nombre_carrera: string;
  regionNombre: string;
  regionCorto: string;
  perfilEtiqueta: string;
  nEncuestados: number;
  capexEtiqueta: string;
  riesgoIA: number;
  sueldoActivo: number;
  sueldoPrepa: number;
  premioVsPrepaPct: number;
  bonoAnual: number;
  tasaEmpleoCalidadPct: number;
  diffCalidadVsMediaLic: number;
  countCalidad: number;
  saturacionPct: number;
  diagSatTexto: string;
  peaTotal: number;
  tasaDesempleo: number;
  desempleadosCount: number;
  ocupadosCount: number;
  tasaFormalidadPct: number;
  tasaFormalBasicoPct: number;
  tasaInformalidadPct: number;
  countFormalBasico: number;
  countInformal: number;
  inversionTotalROI: number;
  aniosRetornoTexto: string;
  semaforoROI: string;
  gananciaNeta10Anios: number;
  topPros: string[];
  topContras: string[];
  serieAnual: { anio: number; sueldoLic: number | null; sueldoPrepa: number | null }[];
  tendenciaEtiqueta: string;
  datosRadar: { nombreCorto: string; Carrera: number; 'Media Contextual': number; diff: number }[];
  comparativaRegional: {
    nombreCorto: string;
    sueldoCarrera: number;
    sueldoPrepa: number;
    premioPct: number;
    formalidadPct: number;
    formalidadPrepaPct: number;
    diffFormalidadPts: number;
    celdaDisponible: boolean;
  }[];
  empleadores: { name: string; value: number }[];
  prestaciones: { nombre: string; valor: number; mediaCtx: number }[];
  barreras: {
    cuadranteNombre: string;
    scoreMovilidad: number;
    estrato: number;
    mediaEstrato: number;
    nepotismo: number;
    mediaNepotismo: number;
    pluriempleo: number;
    mediaPluriempleo: number;
    desarraigo: number;
    mediaDesarraigo: number;
    hrsHogar: number;
    mediaHrsHogar: number;
    homeOffice: number;
    mediaHomeOffice: number;
    medioTiempo: number;
    mediaMedioTiempo: number;
  };
  nombreArchivo: string;
}

export function descargarReporteCarreraPDF(d: ReporteCarreraPDFPayload) {
  const p1 = new VectorPageCanvas();
  const p2 = new VectorPageCanvas();

  // =========================================================================
  // PÁGINA 1: KPIS REDONDEADOS + DIAGNÓSTICO + CURVA REAL + RADAR CON RELLENO
  // =========================================================================
  p1.rect(0, 0, p1.W, p1.H, C_BG);

  p1.roundedRect(24, 16, 794, 52, 10, C_DARK);
  p1.text('DATAROI MÉXICO · REPORTE EJECUTIVO DE AUDITORÍA UNIVERSITARIA (ENOE INEGI + ANUIES)', 38, 25, 8.2, true, [0.58, 0.77, 0.99]);
  p1.text(`${d.nombre_carrera} (CVE: ${d.cve_carrera})`, 38, 39, 13.8, true, C_WHITE);
  p1.text(`Región: ${d.regionNombre}  |  Perfil: ${d.perfilEtiqueta}  |  Muestra INEGI: ${d.nEncuestados} encuestados  |  ${d.capexEtiqueta}  |  Riesgo IA: ${d.riesgoIA}%`, 38, 54, 8.2, false, [0.82, 0.86, 0.92]);
  p1.text('PÁGINA 1 / 2', 804, 26, 8.5, true, [0.58, 0.77, 0.99], 'right');

  const kpiW = 192;
  const kpiGap = 8.6;
  p1.roundedRect(24, 76, kpiW, 68, 8, C_WHITE, C_BORDER);
  p1.text('SALARIO MENSUAL CONSOLIDADO', 34, 84, 7.3, true, C_SLATE);
  p1.text(`${fmtMoney(d.sueldoActivo)} / mes`, 34, 98, 15, true, C_DARK);
  p1.text(`Prima vs. Prepa (${fmtMoney(d.sueldoPrepa)}): ${d.premioVsPrepaPct >= 0 ? `+${d.premioVsPrepaPct}%` : `${d.premioVsPrepaPct}%`}`, 34, 119, 8, true, d.premioVsPrepaPct >= 0 ? C_EMERALD : C_ROSE);
  p1.text(`Bono anual extra: ${d.bonoAnual >= 0 ? `+${fmtMoney(d.bonoAnual)}` : fmtMoney(d.bonoAnual)}/año`, 34, 131, 7.4, false, C_SLATE);

  const xK2 = 24 + (kpiW + kpiGap);
  p1.roundedRect(xK2, 76, kpiW, 68, 8, C_WHITE, C_BORDER);
  p1.text('EMPLEO DE CALIDAD (ESTÁNDAR OIT)', xK2 + 10, 84, 7.3, true, C_SLATE);
  p1.text(`${d.tasaEmpleoCalidadPct}%`, xK2 + 10, 98, 15, true, C_BLUE);
  p1.text(`Diferencial vs. Media Lic.: ${d.diffCalidadVsMediaLic >= 0 ? `+${d.diffCalidadVsMediaLic}` : d.diffCalidadVsMediaLic} pts`, xK2 + 10, 119, 8, true, d.diffCalidadVsMediaLic >= 0 ? C_EMERALD : C_AMBER);
  p1.text(`Ocupados plenos: ${d.countCalidad.toLocaleString('es-MX')} profesionistas`, xK2 + 10, 131, 7.4, false, C_SLATE);

  const xK3 = 24 + (kpiW + kpiGap) * 2;
  p1.roundedRect(xK3, 76, kpiW, 68, 8, C_WHITE, C_BORDER);
  p1.text('ÍNDICE DE SATURACIÓN ANUIES', xK3 + 10, 84, 7.3, true, C_SLATE);
  p1.text(`${d.saturacionPct.toFixed(0)}%`, xK3 + 10, 98, 15, true, C_DARK);
  p1.text(d.diagSatTexto, xK3 + 10, 119, 8, true, d.saturacionPct <= 110 ? C_EMERALD : C_ROSE);
  p1.text(`PEA Activa: ${d.peaTotal.toLocaleString('es-MX')} (Desemp: ${d.tasaDesempleo.toFixed(1)}%)`, xK3 + 10, 131, 7.4, false, C_SLATE);

  const xK4 = 24 + (kpiW + kpiGap) * 3;
  p1.roundedRect(xK4, 76, kpiW, 68, 8, C_WHITE, C_BORDER);
  p1.text('TIEMPO DE RECUPERACIÓN (ROI)', xK4 + 10, 84, 7.3, true, C_SLATE);
  p1.text(d.aniosRetornoTexto, xK4 + 10, 98, 15, true, C_DARK);
  p1.text(d.semaforoROI, xK4 + 10, 119, 8, true, d.gananciaNeta10Anios >= 0 ? C_EMERALD : C_ROSE);
  p1.text(`Inversión: ${fmtMoney(d.inversionTotalROI)} | Neto 10a: ${fmtMoney(d.gananciaNeta10Anios)}`, xK4 + 10, 131, 7.1, false, C_SLATE);

  // FILA 2: Diagnóstico Ejecutivo Redondeado
  p1.roundedRect(24, 152, 794, 134, 10, C_WHITE, C_BORDER);
  p1.text(`DIAGNÓSTICO EJECUTIVO EN ${d.regionCorto.toUpperCase()} (6 HALLAZGOS CLAVE AUDITADOS)`, 36, 161, 9.2, true, C_DARK);

  p1.roundedRect(36, 176, 380, 100, 8, C_EMERALD_LIGHT, C_EMERALD, 0.8);
  p1.text('FORTALEZAS COMPROBADAS DEL PERFIL', 46, 184, 8.2, true, C_EMERALD);
  let yPro = 198;
  d.topPros.slice(0, 3).forEach((pro, i) => {
    const lines = wrapTextByChars(`${i + 1}. ${pro}`, 66);
    lines.forEach(ln => {
      p1.text(ln, 46, yPro, 7.7, false, C_DARK);
      yPro += 10.2;
    });
    yPro += 2.5;
  });

  p1.roundedRect(426, 176, 380, 100, 8, C_AMBER_LIGHT, C_AMBER, 0.8);
  p1.text('RIESGOS Y FRICCIONES A CONSIDERAR', 436, 184, 8.2, true, C_AMBER);
  let yCon = 198;
  d.topContras.slice(0, 3).forEach((con, i) => {
    const lines = wrapTextByChars(`${i + 1}. ${con}`, 66);
    lines.forEach(ln => {
      p1.text(ln, 436, yCon, 7.7, false, C_DARK);
      yCon += 10.2;
    });
    yCon += 2.5;
  });

  // FILA 3: Curva Salarial Real (2021-2026) con Padding Interno para separar 2021 del Eje Y
  p1.roundedRect(24, 294, 470, 278, 10, C_WHITE, C_BORDER);
  p1.text('EVOLUCIÓN SALARIAL REAL VS. PREPARATORIA (2021–2026)', 36, 304, 9.5, true, C_DARK);
  p1.text(`Tendencia Real: ${d.tendenciaEtiqueta} (Pesos constantes de 2026 deflactados con INPC)`, 36, 317, 7.6, false, C_SLATE);

  const gridLeft = 64;
  const gridRight = 476;
  const plotLeft = 86;
  const plotRight = 462;
  const chartTop = 342;
  const chartBottom = 528;
  const plotW = plotRight - plotLeft;
  const chartH = chartBottom - chartTop;

  const valsCurva = d.serieAnual.flatMap(s => [s.sueldoLic || 0, s.sueldoPrepa || 0]);
  const maxCurva = Math.max(25000, Math.ceil((Math.max(...valsCurva) + 2000) / 5000) * 5000);

  for (let v = 0; v <= maxCurva; v += 5000) {
    const yTick = chartBottom - (v / maxCurva) * chartH;
    p1.line(gridLeft, yTick, gridRight, yTick, C_BORDER, 0.5, true);
    p1.text(`$${Math.round(v / 1000)}k`, gridLeft - 6, yTick - 3, 7.2, false, C_SLATE, 'right');
  }

  const ptsLic: { x: number; y: number; val: number; anio: number }[] = [];
  const ptsPrepa: { x: number; y: number; val: number; anio: number }[] = [];

  d.serieAnual.forEach((item, idx) => {
    const xPt = plotLeft + (idx / Math.max(1, d.serieAnual.length - 1)) * plotW;
    p1.text(String(item.anio), xPt, chartBottom + 8, 7.5, true, C_SLATE, 'center');
    if (item.sueldoLic && item.sueldoLic > 0) {
      const yPt = chartBottom - (item.sueldoLic / maxCurva) * chartH;
      ptsLic.push({ x: xPt, y: yPt, val: item.sueldoLic, anio: item.anio });
    }
    if (item.sueldoPrepa && item.sueldoPrepa > 0) {
      const yPt = chartBottom - (item.sueldoPrepa / maxCurva) * chartH;
      ptsPrepa.push({ x: xPt, y: yPt, val: item.sueldoPrepa, anio: item.anio });
    }
  });

  for (let i = 1; i < ptsPrepa.length; i++) {
    p1.line(ptsPrepa[i - 1].x, ptsPrepa[i - 1].y, ptsPrepa[i].x, ptsPrepa[i].y, C_AMBER, 1.8, true);
  }
  ptsPrepa.forEach(pt => {
    p1.circle(pt.x, pt.y, 2.3, C_AMBER_LIGHT, C_AMBER, 1.2);
  });

  for (let i = 1; i < ptsLic.length; i++) {
    p1.line(ptsLic[i - 1].x, ptsLic[i - 1].y, ptsLic[i].x, ptsLic[i].y, C_BLUE, 2.6, false);
  }
  ptsLic.forEach(pt => {
    p1.circle(pt.x, pt.y, 3.2, C_WHITE, C_BLUE, 1.8);
    p1.text(fmtMoney(pt.val), pt.x, pt.y - 12, 6.8, true, C_BLUE, 'center');
  });

  p1.roundedRect(128, 549, 10, 4, 1.5, C_BLUE);
  p1.text('Salario Licenciatura (Observado INEGI)', 142, 546, 7.4, true, C_BLUE);
  p1.roundedRect(302, 549, 10, 4, 1.5, C_AMBER);
  p1.text('Base Preparatoria Regional', 316, 546, 7.4, true, C_AMBER);

  // 3B: Radar Hexagonal con Relleno Translúcido (/GS_Alpha25)
  p1.roundedRect(504, 294, 314, 278, 10, C_WHITE, C_BORDER);
  p1.text('HUELLA ESTRUCTURAL (6 PILARES VS. MEDIA)', 516, 304, 9.5, true, C_DARK);
  p1.text('Azul = Esta Carrera  |  Gris punteado = Media Contextual', 516, 317, 7.4, false, C_SLATE);

  const cx = 661;
  const cy = 406;
  const maxR = 60;

  [0.33, 0.66, 1.0].forEach(level => {
    const ringPts = Array.from({ length: 6 }, (_, i) => {
      const ang = -Math.PI / 2 + i * (Math.PI / 3);
      return { x: cx + maxR * level * Math.cos(ang), y: cy + maxR * level * Math.sin(ang) };
    });
    p1.polygon(ringPts, C_BORDER, 0.6, false);
  });

  const radarMediaPts: { x: number; y: number }[] = [];
  const radarCarreraPts: { x: number; y: number }[] = [];

  d.datosRadar.slice(0, 6).forEach((item, i) => {
    const ang = -Math.PI / 2 + i * (Math.PI / 3);
    const xEnd = cx + maxR * Math.cos(ang);
    const yEnd = cy + maxR * Math.sin(ang);
    p1.line(cx, cy, xEnd, yEnd, C_BORDER, 0.6, false);

    const rM = (Math.max(10, Math.min(100, item['Media Contextual'])) / 100) * maxR;
    const rC = (Math.max(10, Math.min(100, item.Carrera)) / 100) * maxR;
    radarMediaPts.push({ x: cx + rM * Math.cos(ang), y: cy + rM * Math.sin(ang) });
    radarCarreraPts.push({ x: cx + rC * Math.cos(ang), y: cy + rC * Math.sin(ang) });

    const lx = cx + (maxR + 14) * Math.cos(ang);
    const ly = cy + (maxR + 12) * Math.sin(ang) - 4;
    const al = Math.abs(Math.cos(ang)) < 0.2 ? 'center' : Math.cos(ang) > 0 ? 'left' : 'right';
    p1.text(`${item.nombreCorto} (${item.Carrera})`, lx, ly, 7.1, true, C_DARK, al);
  });

  p1.polygon(radarMediaPts, C_SLATE, 1.3, true, C_SLATE, 'GS_Alpha15');
  p1.polygon(radarCarreraPts, C_BLUE, 2.3, false, C_BLUE, 'GS_Alpha25');

  d.datosRadar.slice(0, 6).forEach((item, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const bx = 516 + col * 98;
    const by = 496 + row * 33;
    p1.roundedRect(bx, by, 92, 28, 6, C_BG, C_BORDER);
    p1.text(item.nombreCorto, bx + 46, by + 4, 6.9, false, C_SLATE, 'center');
    const diffTxt = `${item.diff > 0 ? `+${item.diff}` : item.diff} vs. Media`;
    p1.text(diffTxt, bx + 46, by + 14.5, 7.8, true, item.diff >= 3 ? C_EMERALD : item.diff <= -3 ? C_AMBER : C_DARK, 'center');
  });

  // =========================================================================
  // PÁGINA 2: TERMÓMETROS REGIONALES DOBLES + BENTO EMPLEADORES + PRESTACIONES + RIELES DIVERGENTES
  // =========================================================================
  p2.rect(0, 0, p2.W, p2.H, C_BG);

  p2.roundedRect(24, 16, 794, 40, 9, C_DARK);
  p2.text(`${d.nombre_carrera} (CVE: ${d.cve_carrera}) · Radiografía Regional, Empleadores, Prestaciones y Barreras`, 36, 25, 11, true, C_WHITE);
  p2.text(`Región Activa: ${d.regionNombre} (${d.perfilEtiqueta})`, 36, 40, 8, false, [0.75, 0.82, 0.92]);
  p2.text('PÁGINA 2 / 2', 804, 26, 8.5, true, [0.58, 0.77, 0.99], 'right');

  p2.roundedRect(24, 64, 400, 226, 10, C_WHITE, C_BORDER);
  p2.text('COMPARATIVA POR MACRO-REGIÓN (SALARIO Y FORMALIDAD)', 36, 74, 9.2, true, C_DARK);
  p2.text('Cada región muestra su termómetro de Salario (izq.) y Formalidad (der.) con marca negra de Prepa.', 36, 86, 7.1, false, C_SLATE);

  const maxSueldoReg = Math.max(
    22000,
    ...d.comparativaRegional.map(r => Math.max(r.sueldoCarrera || 0, r.sueldoPrepa || 0) * 1.15)
  );

  const cardW = 72;
  d.comparativaRegional.slice(0, 5).forEach((item, idx) => {
    const cxR = 34 + idx * 76;
    const esAct = item.nombreCorto === d.regionCorto;
    p2.roundedRect(cxR, 99, cardW, 182, 8, esAct ? C_BLUE_LIGHT : C_BG, esAct ? C_BLUE : C_BORDER, esAct ? 1.3 : 0.7);

    if (!item.celdaDisponible) {
      p2.text('Sin muestra', cxR + cardW / 2, 168, 7.5, true, C_SLATE, 'center');
      p2.text(item.nombreCorto, cxR + cardW / 2, 260, 7.8, true, C_SLATE, 'center');
    } else {
      p2.text(fmtMoney(item.sueldoCarrera), cxR + cardW / 2, 105, 8.2, true, C_DARK, 'center');
      p2.text(`${item.premioPct >= 0 ? `+${item.premioPct}%` : `${item.premioPct}%`} vs Prepa`, cxR + cardW / 2, 115, 6.4, true, item.premioPct >= 0 ? C_EMERALD : C_AMBER, 'center');
      p2.text(`${item.formalidadPct}% formal (${item.diffFormalidadPts >= 0 ? `+${item.diffFormalidadPts}` : item.diffFormalidadPts} pts)`, cxR + cardW / 2, 124, 6.2, true, C_BLUE, 'center');

      const trackTop = 136;
      const trackH = 104;
      const trackBottom = trackTop + trackH;

      const xT1 = cxR + 10;
      const wT = 22;
      p2.roundedRect(xT1, trackTop, wT, trackH, 4, C_WHITE, C_BORDER, 0.5);
      const hSal = Math.max(8, Math.min(trackH - 4, (item.sueldoCarrera / maxSueldoReg) * trackH));
      p2.roundedRect(xT1 + 2, trackBottom - hSal, wT - 4, hSal, 3, esAct ? C_BLUE : C_BLUE_SOFT);
      const yPrepaSal = trackBottom - Math.max(6, Math.min(trackH - 4, (item.sueldoPrepa / maxSueldoReg) * trackH));
      p2.rect(xT1 - 1, yPrepaSal - 1, wT + 2, 2.2, C_DARK);

      const xT2 = cxR + 40;
      p2.roundedRect(xT2, trackTop, wT, trackH, 4, C_WHITE, C_BORDER, 0.5);
      const hForm = Math.max(8, Math.min(trackH - 4, (item.formalidadPct / 100) * trackH));
      p2.roundedRect(xT2 + 2, trackBottom - hForm, wT - 4, hForm, 3, C_SKY);
      const yPrepaForm = trackBottom - Math.max(6, Math.min(trackH - 4, (item.formalidadPrepaPct / 100) * trackH));
      p2.rect(xT2 - 1, yPrepaForm - 1, wT + 2, 2.2, C_DARK);

      p2.text('$', xT1 + wT / 2, trackBottom + 2, 6.2, true, C_BLUE, 'center');
      p2.text('F%', xT2 + wT / 2, trackBottom + 2, 6.2, true, C_DARK, 'center');

      p2.text(item.nombreCorto, cxR + cardW / 2, 251, 7.8, true, esAct ? C_BLUE : C_DARK, 'center');
      p2.text(`Prepa: $${(item.sueldoPrepa / 1000).toFixed(1)}k | ${item.formalidadPrepaPct}%`, cxR + cardW / 2, 262, 6.1, false, C_SLATE, 'center');
    }
  });

  // BLOQUE SUPERIOR DER P2: Calidad OIT Redondeada + Mosaico Bento de Cajas de Empleadores
  p2.roundedRect(434, 64, 384, 226, 10, C_WHITE, C_BORDER);
  p2.text(`CALIDAD DE OCUPACIÓN (${d.ocupadosCount.toLocaleString('es-MX')} OCUPADOS)`, 446, 74, 9.2, true, C_DARK);
  p2.text(`Desempleo: ${d.tasaDesempleo.toFixed(1)}% (${d.desempleadosCount})`, 806, 74, 7.4, true, C_SLATE, 'right');

  const xBarOIT = 446;
  const wBarOIT = 360;
  p2.roundedRect(xBarOIT, 88, wBarOIT, 12, 5, C_SLATE_LIGHT, C_BORDER, 0.5);
  const wCal = (wBarOIT * d.tasaEmpleoCalidadPct) / 100;
  const wBas = (wBarOIT * d.tasaFormalBasicoPct) / 100;
  const wInf = Math.max(0, wBarOIT - wCal - wBas);

  p2.roundedRect(xBarOIT + 1, 89, Math.max(4, wCal - 2), 10, 4, C_BLUE);
  if (wBas > 2) {
    p2.rect(xBarOIT + wCal, 89, Math.max(2, wBas - 1), 10, C_SKY);
  }
  if (wInf > 2) {
    p2.roundedRect(xBarOIT + wCal + wBas, 89, Math.max(4, wInf - 1), 10, 4, [0.58, 0.64, 0.72]);
  }

  const miniW = 116;
  [
    { label: 'Empleo Calidad OIT', pct: `${d.tasaEmpleoCalidadPct}%`, count: `${d.countCalidad.toLocaleString('es-MX')} ocup.`, col: C_BLUE },
    { label: 'Formal Básico', pct: `${d.tasaFormalBasicoPct}%`, count: `${d.countFormalBasico.toLocaleString('es-MX')} ocup.`, col: C_SKY },
    { label: 'Sector Informal', pct: `${d.tasaInformalidadPct}%`, count: `${d.countInformal.toLocaleString('es-MX')} ocup.`, col: C_SLATE }
  ].forEach((m, idx) => {
    const mx = 446 + idx * 122;
    p2.roundedRect(mx, 104, miniW, 30, 5, C_BG, C_BORDER, 0.5);
    p2.circle(mx + 8, 111, 2.5, m.col);
    p2.text(m.label, mx + 14, 107, 6.7, true, C_DARK);
    p2.text(m.pct, mx + 8, 118, 9.2, true, idx === 0 ? C_BLUE : C_DARK);
    p2.text(m.count, mx + 110, 120, 6.5, false, C_SLATE, 'right');
  });

  p2.text('MOSAICO DE EMPLEADORES (COMPOSICIÓN 100%)', 446, 141, 8.5, true, C_DARK);

  const empTop2 = d.empleadores.slice(0, 2);
  const empRest = d.empleadores.slice(2, 5);

  empTop2.forEach((emp, i) => {
    const bx = i === 0 ? 446 : 632;
    const bw = i === 0 ? 180 : 174;
    const bgCol = i === 0 ? C_BLUE : C_DARK;
    const subCol: RGB = i === 0 ? [0.82, 0.90, 1.0] : [0.75, 0.82, 0.90];
    const personas = Math.round(d.ocupadosCount * (emp.value / 100));

    p2.roundedRect(bx, 153, bw, 60, 7, bgCol);
    p2.text(`#${i + 1} SECTOR`, bx + 10, 160, 6.8, true, subCol);
    p2.text(`${personas.toLocaleString('es-MX')} prof.`, bx + bw - 10, 160, 6.8, true, subCol, 'right');
    p2.text(`${emp.value.toFixed(1)}%`, bx + 10, 174, 14, true, C_WHITE);
    const nomCorto = emp.name.length > 34 ? emp.name.slice(0, 32) + '...' : emp.name;
    p2.text(nomCorto, bx + 10, 195, 7.2, true, C_WHITE);
  });

  empRest.forEach((emp, i) => {
    const ncol = empRest.length;
    const bw = ncol === 3 ? 116 : 177;
    const gap = 6;
    const bx = 446 + i * (bw + gap);
    const bgCol = i === 0 ? C_BLUE_LIGHT : C_BG;
    const borderCol = i === 0 ? C_BLUE_SOFT : C_BORDER;
    const personas = Math.round(d.ocupadosCount * (emp.value / 100));

    p2.roundedRect(bx, 219, bw, 62, 7, bgCol, borderCol, 0.7);
    p2.text(`#${i + 3} SECTOR`, bx + 8, 226, 6.5, true, i === 0 ? C_BLUE : C_SLATE);
    p2.text(`${personas.toLocaleString('es-MX')} prof.`, bx + bw - 8, 226, 6.4, false, C_SLATE, 'right');
    p2.text(`${emp.value.toFixed(1)}%`, bx + 8, 239, 12, true, C_DARK);
    const lines = wrapTextByChars(emp.name, ncol === 3 ? 21 : 32).slice(0, 2);
    lines.forEach((ln, li) => {
      p2.text(ln, bx + 8, 256 + li * 8.5, 6.8, true, C_DARK);
    });
  });

  // BLOQUE INFERIOR IZQ P2: Escalera de Prestaciones con Barras Redondeadas
  p2.roundedRect(24, 298, 400, 274, 10, C_WHITE, C_BORDER);
  p2.text(`ESCALERA DE PRESTACIONES VS. MEDIA EN ${d.regionCorto.toUpperCase()}`, 36, 308, 9.2, true, C_DARK);
  p2.text('Barra azul = Cobertura en esta carrera  |  Marca negra vertical = Media Licenciatura', 36, 320, 7.2, false, C_SLATE);

  let yPr = 338;
  d.prestaciones.forEach(item => {
    const diff = Number((item.valor - item.mediaCtx).toFixed(1));
    p2.text(item.nombre, 36, yPr, 8, true, C_DARK);
    p2.text(
      `${item.valor.toFixed(1)}% (${diff >= 0 ? `+${diff}%` : `${diff}%`} vs. Media ${item.mediaCtx}%)`,
      412,
      yPr,
      7.4,
      true,
      diff >= 0 ? C_EMERALD : C_SLATE,
      'right'
    );

    const bx = 36;
    const bw = 376;
    p2.roundedRect(bx, yPr + 11, bw, 7.5, 3.5, C_SLATE_LIGHT, C_BORDER, 0.4);
    const wVal = (bw * Math.max(2, Math.min(100, item.valor))) / 100;
    p2.roundedRect(bx, yPr + 11, wVal, 7.5, 3.5, C_BLUE);

    const xMedia = bx + (bw * Math.min(99, item.mediaCtx)) / 100;
    p2.roundedRect(xMedia - 1.2, yPr + 8.5, 2.4, 12.5, 1, C_DARK);
    yPr += 36.5;
  });

  // BLOQUE INFERIOR DER P2: Los 5 Rieles Divergentes con Línea Negra Central y Nodos Circulares
  p2.roundedRect(434, 298, 384, 274, 10, C_WHITE, C_BORDER);
  p2.text('BARRERAS DE ENTRADA Y FRICCIÓN LABORAL', 446, 308, 9.2, true, C_DARK);
  p2.text(
    `Clasificación: ${d.barreras.cuadranteNombre} (${d.barreras.scoreMovilidad}% Mérito) · Izquierda del centro = menor fricción`,
    446,
    320,
    7.2,
    true,
    C_BLUE
  );

  const rielesConfig = [
    {
      label: 'Índice de Privilegio (Estrato Origen 1-4)',
      val: d.barreras.estrato,
      media: d.barreras.mediaEstrato,
      maxDesv: 0.65,
      valTxt: `${d.barreras.estrato.toFixed(2)} / 4`,
      mediaTxt: `${d.barreras.mediaEstrato.toFixed(2)}`,
      diff: Number((d.barreras.estrato - d.barreras.mediaEstrato).toFixed(2)),
      suf: ' pts'
    },
    {
      label: 'Ingreso por Redes Familiares (Nepotismo)',
      val: d.barreras.nepotismo,
      media: d.barreras.mediaNepotismo,
      maxDesv: 18,
      valTxt: `${d.barreras.nepotismo.toFixed(1)}%`,
      mediaTxt: `${d.barreras.mediaNepotismo.toFixed(1)}%`,
      diff: Number((d.barreras.nepotismo - d.barreras.mediaNepotismo).toFixed(1)),
      suf: '%'
    },
    {
      label: 'Pluriempleo (Dos o más empleos simultáneos)',
      val: d.barreras.pluriempleo,
      media: d.barreras.mediaPluriempleo,
      maxDesv: 14,
      valTxt: `${d.barreras.pluriempleo.toFixed(1)}%`,
      mediaTxt: `${d.barreras.mediaPluriempleo.toFixed(1)}%`,
      diff: Number((d.barreras.pluriempleo - d.barreras.mediaPluriempleo).toFixed(1)),
      suf: '%'
    },
    {
      label: 'Migración Forzada (Cambio de estado para ejercer)',
      val: d.barreras.desarraigo,
      media: d.barreras.mediaDesarraigo,
      maxDesv: 10,
      valTxt: `${d.barreras.desarraigo.toFixed(1)}%`,
      mediaTxt: `${d.barreras.mediaDesarraigo.toFixed(1)}%`,
      diff: Number((d.barreras.desarraigo - d.barreras.mediaDesarraigo).toFixed(1)),
      suf: '%'
    },
    {
      label: 'Trabajo Doméstico No Remunerado (Doble Jornada)',
      val: d.barreras.hrsHogar,
      media: d.barreras.mediaHrsHogar,
      maxDesv: 13,
      valTxt: `${d.barreras.hrsHogar.toFixed(1)} hrs`,
      mediaTxt: `${d.barreras.mediaHrsHogar.toFixed(1)} hrs`,
      diff: Number((d.barreras.hrsHogar - d.barreras.mediaHrsHogar).toFixed(1)),
      suf: ' hrs'
    }
  ];

  let yBar = 336;
  const rxLeft = 446;
  const rxW = 360;
  const rxCenter = rxLeft + rxW / 2;

  rielesConfig.forEach(b => {
    p2.text(b.label, rxLeft, yBar, 7.6, true, C_DARK);
    const diffStr = `${b.diff > 0 ? `+${b.diff}` : b.diff}${b.suf} vs. Media (${b.mediaTxt})`;
    p2.text(diffStr, 742, yBar, 7.0, true, b.diff <= 0 ? C_EMERALD : C_AMBER, 'right');
    p2.text(b.valTxt, 806, yBar, 8.0, true, C_DARK, 'right');

    const trackY = yBar + 11;
    p2.roundedRect(rxLeft, trackY, rxW, 5, 2.5, C_SLATE_LIGHT, C_BORDER, 0.4);

    const ratio = Math.max(-1, Math.min(1, (b.val - b.media) / Math.max(0.01, b.maxDesv)));
    const nodeX = rxCenter + ratio * (rxW * 0.44);
    const stemLeft = Math.min(rxCenter, nodeX);
    const stemW = Math.max(2, Math.abs(nodeX - rxCenter));
    const colRiel = b.diff <= 0 ? C_EMERALD : C_AMBER;

    p2.roundedRect(stemLeft, trackY + 0.5, stemW, 4, 2, colRiel);
    p2.rect(rxCenter - 1, trackY - 2.5, 2, 10, C_DARK);
    p2.circle(nodeX, trackY + 2.5, 4.2, colRiel, C_WHITE, 1.3);

    yBar += 34;
  });

  const modW = 175;
  p2.roundedRect(446, 514, modW, 46, 7, C_BG, C_BORDER, 0.6);
  p2.text('TRABAJO REMOTO (HOME OFFICE)', 454, 521, 6.8, true, C_BLUE);
  p2.text(`${d.barreras.homeOffice.toFixed(1)}%`, 613, 520, 8.5, true, C_DARK, 'right');
  p2.roundedRect(454, 533, 159, 6, 3, C_WHITE, C_BORDER, 0.4);
  p2.roundedRect(454, 533, (159 * Math.min(20, d.barreras.homeOffice)) / 20, 6, 3, C_BLUE);
  p2.rect(454 + (159 * Math.min(20, d.barreras.mediaHomeOffice)) / 20 - 1, 531.5, 2, 9, C_DARK);
  p2.text(`Marca negra (Media): ${d.barreras.mediaHomeOffice}%`, 454, 545, 6.3, false, C_SLATE);

  p2.roundedRect(631, 514, modW, 46, 7, C_BG, C_BORDER, 0.6);
  p2.text('MEDIO TIEMPO (<30H SEMANALES)', 639, 521, 6.8, true, C_SLATE);
  p2.text(`${d.barreras.medioTiempo.toFixed(1)}%`, 798, 520, 8.5, true, C_DARK, 'right');
  p2.roundedRect(639, 533, 159, 6, 3, C_WHITE, C_BORDER, 0.4);
  p2.roundedRect(639, 533, (159 * Math.min(46, d.barreras.medioTiempo)) / 46, 6, 3, C_SLATE);
  p2.rect(639 + (159 * Math.min(46, d.barreras.mediaMedioTiempo)) / 46 - 1, 531.5, 2, 9, C_DARK);
  p2.text(`Marca negra (Media): ${d.barreras.mediaMedioTiempo}%`, 639, 545, 6.3, false, C_SLATE);

  buildAndDownloadPdfDocument([p1, p2], d.nombreArchivo);
}

// ============================================================================
// GENERADOR PDF VECTORIAL PARA EL COMPARADOR CARA A CARA (VERSUS)
// ============================================================================
export interface ComparativaVersusPDFPayload {
  regionNombre: string;
  regionCorto: string;
  perfilEtiqueta: string;
  sueldoPrepa: number;
  carreras: {
    cve_carrera: string;
    nombre_carrera: string;
    sueldo_esperado: number;
    premioVsPrepaPct: number;
    roiPublica: number | null;
    roiPrivada: number | null;
    costoEquipo: number;
    tasaCalidadOIT: number;
    tasaDesempleo: number;
    saturacionPct: number;
    meritoPct: number;
    blindajeIA: number;
    empleoUnicoPct: number;
    sectorPrincipal: string;
    pilaresRadar: Record<string, number>;
    sueldosPorRegion: Record<string, number | null>;
  }[];
  nombreArchivo: string;
}

export function descargarComparativaVersusPDF(v: ComparativaVersusPDFPayload) {
  const p = new VectorPageCanvas();
  p.rect(0, 0, p.W, p.H, C_BG);

  p.roundedRect(24, 18, 794, 46, 10, C_DARK);
  p.text(`COMPARADOR EJECUTIVO CARA A CARA · ${v.regionCorto.toUpperCase()} (${v.perfilEtiqueta.toUpperCase()})`, 36, 26, 8.5, true, [0.58, 0.77, 0.99]);
  p.text('Contraste Directo de Indicadores, Huella de 6 Pilares y Retorno de Inversión', 36, 40, 13.5, true, C_WHITE);
  p.text('DATAROI MÉXICO', 804, 34, 9, true, [0.58, 0.77, 0.99], 'right');

  const coloresRGB: RGB[] = [C_BLUE, C_PURPLE, C_ORANGE];

  p.roundedRect(24, 72, 430, 195, 10, C_WHITE, C_BORDER);
  p.text('SUPERPOSICIÓN DE LOS 6 PILARES ESTRUCTURALES', 36, 82, 9, true, C_DARK);

  let yLeg = 98;
  v.carreras.forEach((c, idx) => {
    p.roundedRect(36, yLeg, 184, 46, 6, C_BG, coloresRGB[idx], 1.1);
    p.roundedRect(42, yLeg + 8, 8, 8, 2, coloresRGB[idx]);
    const lines = wrapTextByChars(c.nombre_carrera, 26).slice(0, 2);
    lines.forEach((ln, li) => {
      p.text(ln, 54, yLeg + 7 + li * 9.5, 7.3, true, C_DARK);
    });
    p.text(`${fmtMoney(c.sueldo_esperado)}/mes (${c.premioVsPrepaPct >= 0 ? `+${c.premioVsPrepaPct}%` : `${c.premioVsPrepaPct}%`} vs Prepa)`, 54, yLeg + 30, 7.0, true, coloresRGB[idx]);
    yLeg += 52;
  });

  const cx = 334;
  const cy = 172;
  const maxR = 52;
  const ejes = ['Salario', 'Formalidad', 'Empleabilidad', 'Meritocracia', 'Autonomía', 'Estabilidad'];

  [0.35, 0.7, 1.0].forEach(level => {
    const pts = ejes.map((_, i) => {
      const ang = -Math.PI / 2 + i * (Math.PI / 3);
      return { x: cx + maxR * level * Math.cos(ang), y: cy + maxR * level * Math.sin(ang) };
    });
    p.polygon(pts, C_BORDER, 0.6, false);
  });

  ejes.forEach((eje, i) => {
    const ang = -Math.PI / 2 + i * (Math.PI / 3);
    p.line(cx, cy, cx + maxR * Math.cos(ang), cy + maxR * Math.sin(ang), C_BORDER, 0.6);
    const lx = cx + (maxR + 10) * Math.cos(ang);
    const ly = cy + (maxR + 9) * Math.sin(ang) - 3;
    const al = Math.abs(Math.cos(ang)) < 0.2 ? 'center' : Math.cos(ang) > 0 ? 'left' : 'right';
    p.text(eje, lx, ly, 6.7, true, C_DARK, al);
  });

  v.carreras.forEach((c, idx) => {
    const pts = ejes.map((eje, i) => {
      const ang = -Math.PI / 2 + i * (Math.PI / 3);
      const val = Math.max(12, Math.min(100, Number(c.pilaresRadar?.[eje] ?? 50)));
      const r = (val / 100) * maxR;
      return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
    });
    p.polygon(pts, coloresRGB[idx], 2.0, idx === 2, coloresRGB[idx], 'GS_Alpha15');
  });

  p.roundedRect(462, 72, 356, 195, 10, C_WHITE, C_BORDER);
  p.text('COMPARATIVA SALARIAL EN LAS 5 MACRO-REGIONES', 474, 82, 9, true, C_DARK);
  p.text('Sueldo mensual consolidado (MXN) por región para las carreras comparadas.', 474, 94, 7.2, false, C_SLATE);

  const regs = [
    { key: 'norte', label: 'Norte' },
    { key: 'noroeste', label: 'Noroeste' },
    { key: 'bajio', label: 'Bajío-Occ.' },
    { key: 'centro', label: 'Centro' },
    { key: 'sur', label: 'Sur-Sureste' }
  ];

  const bLeft = 502;
  const bRight = 804;
  const bTop = 114;
  const bBottom = 242;
  const bH = bBottom - bTop;
  const maxSalReg = 25000;

  [0, 10000, 20000].forEach(val => {
    const yG = bBottom - (val / maxSalReg) * bH;
    p.line(bLeft, yG, bRight, yG, C_BORDER, 0.5, true);
    p.text(`$${val / 1000}k`, bLeft - 5, yG - 3, 6.8, false, C_SLATE, 'right');
  });

  const groupW = (bRight - bLeft) / regs.length;
  regs.forEach((rObj, rIdx) => {
    const gx = bLeft + rIdx * groupW + 8;
    const barW = Math.min(14, (groupW - 16) / v.carreras.length);
    v.carreras.forEach((c, cIdx) => {
      const sVal = c.sueldosPorRegion[rObj.key];
      if (sVal && sVal > 0) {
        const hBar = Math.min(bH, (sVal / maxSalReg) * bH);
        const bx = gx + cIdx * (barW + 2);
        p.roundedRect(bx, bBottom - hBar, barW, hBar, 2.5, coloresRGB[cIdx]);
      }
    });
    p.text(rObj.label, gx + (v.carreras.length * barW) / 2, bBottom + 6, 7.0, true, C_DARK, 'center');
  });

  p.roundedRect(24, 275, 794, 298, 8, C_WHITE, C_BORDER);
  p.rect(24, 275, 794, 24, C_DARK);

  const colIndW = 214;
  const colCarW = (794 - colIndW) / v.carreras.length;
  p.text('INDICADOR AUDITADO', 34, 283, 8, true, C_WHITE);

  v.carreras.forEach((c, idx) => {
    const xCol = 24 + colIndW + idx * colCarW;
    p.roundedRect(xCol + 8, 283, 7, 7, 2, coloresRGB[idx]);
    const nomCorto = c.nombre_carrera.length > 34 ? c.nombre_carrera.slice(0, 32) + '...' : c.nombre_carrera;
    p.text(nomCorto, xCol + 19, 283, 7.8, true, C_WHITE);
  });

  const filasTabla = [
    {
      label: 'Salario Mensual Consolidado',
      vals: v.carreras.map(c => c.sueldo_esperado),
      fmt: (n: number) => `${fmtMoney(n)} / mes`,
      mejorAlto: true,
      invalido: Infinity
    },
    {
      label: 'Prima Salarial vs. Preparatoria',
      vals: v.carreras.map(c => c.premioVsPrepaPct),
      fmt: (n: number) => `${n >= 0 ? `+${n}%` : `${n}%`} vs. Prepa`,
      mejorAlto: true,
      invalido: Infinity
    },
    {
      label: 'Retorno de Inversión (Univ. Pública)',
      vals: v.carreras.map(c => c.roiPublica ?? 999),
      fmt: (n: number) => (n >= 900 ? 'Retorno negativo' : n === 1 ? '1 año de trabajo' : `${n} años de trabajo`),
      mejorAlto: false,
      invalido: 900
    },
    {
      label: 'Retorno de Inversión (Univ. Privada Media)',
      vals: v.carreras.map(c => c.roiPrivada ?? 999),
      fmt: (n: number) => (n >= 900 ? 'Retorno negativo' : n === 1 ? '1 año de trabajo' : `${n} años de trabajo`),
      mejorAlto: false,
      invalido: 900
    },
    {
      label: 'Inversión Requerida en Equipo (CapEx)',
      vals: v.carreras.map(c => c.costoEquipo),
      fmt: (n: number) => (n === 18000 ? 'Básica ($18,000 MXN)' : n === 42000 ? 'Media ($42,000 MXN)' : 'Alta ($85,000 MXN)'),
      mejorAlto: false,
      invalido: Infinity
    },
    {
      label: 'Empleo de Calidad (Estándar OIT)',
      vals: v.carreras.map(c => c.tasaCalidadOIT),
      fmt: (n: number) => `${n}% de ocupados`,
      mejorAlto: true,
      invalido: Infinity
    },
    {
      label: 'Tasa de Desempleo Abierto',
      vals: v.carreras.map(c => c.tasaDesempleo),
      fmt: (n: number) => `${n.toFixed(1)}%`,
      mejorAlto: false,
      invalido: Infinity
    },
    {
      label: 'Índice de Saturación ANUIES',
      vals: v.carreras.map(c => c.saturacionPct),
      fmt: (n: number) => `${n}%`,
      mejorAlto: false,
      invalido: Infinity
    },
    {
      label: 'Apertura y Movilidad Social (Mérito)',
      vals: v.carreras.map(c => c.meritoPct),
      fmt: (n: number) => `${n.toFixed(1)}% Mérito`,
      mejorAlto: true,
      invalido: Infinity
    },
    {
      label: 'Blindaje Humano ante IA',
      vals: v.carreras.map(c => c.blindajeIA),
      fmt: (n: number) => `${n}% blindaje`,
      mejorAlto: true,
      invalido: Infinity
    },
    {
      label: 'Empleo Único (Sin Pluriempleo)',
      vals: v.carreras.map(c => c.empleoUnicoPct),
      fmt: (n: number) => `${n}% un solo empleo`,
      mejorAlto: true,
      invalido: Infinity
    }
  ];

  const rowH = 22.5;
  let yRow = 299;

  filasTabla.forEach((f, rIdx) => {
    if (rIdx % 2 === 1) {
      p.rect(24, yRow, 794, rowH, C_BG);
    }
    const validos = f.vals.filter(val => val < f.invalido);
    const mejor = validos.length > 0 ? (f.mejorAlto ? Math.max(...validos) : Math.min(...validos)) : null;

    p.text(f.label, 34, yRow + 6, 7.6, true, C_DARK);

    f.vals.forEach((val, cIdx) => {
      const xCol = 24 + colIndW + cIdx * colCarW;
      const esGanador = mejor !== null && val === mejor && val < f.invalido;
      if (esGanador) {
        p.roundedRect(xCol + 2, yRow + 1.5, colCarW - 4, rowH - 3, 4, C_EMERALD_LIGHT, C_EMERALD, 0.5);
        p.text('[LÍDER]', xCol + colCarW - 10, yRow + 6.5, 6.8, true, C_EMERALD, 'right');
      }
      p.text(f.fmt(val), xCol + 10, yRow + 6, 7.8, esGanador, esGanador ? C_DARK : C_SLATE);
    });

    p.line(24, yRow + rowH, 818, yRow + rowH, C_BORDER, 0.4);
    yRow += rowH;
  });

  p.rect(24, yRow, 794, 24, C_BG);
  p.text('Sector Empleador Principal', 34, yRow + 7, 7.6, true, C_DARK);
  v.carreras.forEach((c, cIdx) => {
    const xCol = 24 + colIndW + cIdx * colCarW;
    p.text(c.sectorPrincipal, xCol + 10, yRow + 7, 7.6, true, C_DARK);
  });

  buildAndDownloadPdfDocument([p], v.nombreArchivo);
}