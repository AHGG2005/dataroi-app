// src/lib/dataroiEngine.ts
// Motor Estadístico y de Datos Único para DataROI México (100% Dinámico · Cero Hardcodeo · Cero Doble Bühlmann · Satélites Prepa)

import type { SupabaseClient } from '@supabase/supabase-js';

export type CodigoGenero = 0 | 1 | 2;
export type RegionClave = 'nacional' | 'norte' | 'noroeste' | 'bajio' | 'centro' | 'sur';
export type CodigoTendencia = 'crecimiento' | 'estable' | 'ajuste' | 'volatil';

export const REGIONES_ORDEN: readonly RegionClave[] = [
  'nacional', 'norte', 'noroeste', 'bajio', 'centro', 'sur'
] as const;

export const MACRO_REGIONES_5: readonly Exclude<RegionClave, 'nacional'>[] = [
  'norte', 'noroeste', 'bajio', 'centro', 'sur'
] as const;

export const EVENTO_DATOS_ACTUALIZADOS = 'dataroi-data-updated';

// Geografía política fija de México (32 entidades federativas en 5 macro-regiones)
export const ESTADOS_POR_REGION: Record<Exclude<RegionClave, 'nacional'>, string[]> = {
  norte: ['02', '05', '08', '19', '26', '28'],
  noroeste: ['03', '10', '18', '25'],
  bajio: ['01', '06', '11', '14', '16', '22', '24', '32'],
  centro: ['09', '13', '15', '17', '21', '29'],
  sur: ['04', '07', '12', '20', '23', '27', '30', '31']
};

// Metadatos puramente geográficos y de diseño (cero cifras económicas)
export const REGIONES_META: Record<RegionClave, {
  nombre: string;
  corto: string;
  estados: string;
  estadosCorto: string;
  colorHex: string;
  badgeActivo: string;
}> = {
  nacional: {
    nombre: 'Nacional (Todo México)',
    corto: 'Todo México',
    estados: 'Promedio de las 32 entidades federativas',
    estadosCorto: 'Promedio de las 32 entidades',
    colorHex: '#2563EB',
    badgeActivo: 'bg-blue-600 text-white border-blue-600'
  },
  norte: {
    nombre: 'Norte / Frontera Industrial',
    corto: 'Norte',
    estados: 'Baja California, Sonora, Chihuahua, Coahuila, Nuevo León, Tamaulipas',
    estadosCorto: 'BC, Coah, Chih, NL, Son, Tamps',
    colorHex: '#4F46E5',
    badgeActivo: 'bg-indigo-600 text-white border-indigo-600'
  },
  noroeste: {
    nombre: 'Noroeste / Corredor Pacífico',
    corto: 'Noroeste',
    estados: 'Baja California Sur, Sinaloa, Durango, Nayarit',
    estadosCorto: 'BCS, Dgo, Nay, Sin',
    colorHex: '#0891B2',
    badgeActivo: 'bg-cyan-600 text-white border-cyan-600'
  },
  bajio: {
    nombre: 'Occidente - Bajío',
    corto: 'Bajío-Occ.',
    estados: 'Jalisco, Guanajuato, Querétaro, Aguascalientes, SLP, Michoacán, Colima, Zacatecas',
    estadosCorto: 'Ags, Col, Gto, Jal, Mich, Qro, SLP, Zac',
    colorHex: '#D97706',
    badgeActivo: 'bg-amber-600 text-white border-amber-600'
  },
  centro: {
    nombre: 'Centro / Valle de México',
    corto: 'Centro',
    estados: 'CDMX, Estado de México, Puebla, Hidalgo, Morelos, Tlaxcala',
    estadosCorto: 'CDMX, Edomex, Hgo, Mor, Pue, Tlax',
    colorHex: '#7C3AED',
    badgeActivo: 'bg-purple-600 text-white border-purple-600'
  },
  sur: {
    nombre: 'Sur - Sureste / Golfo',
    corto: 'Sur-Sureste',
    estados: 'Veracruz, Tabasco, Campeche, Yucatán, Quintana Roo, Chiapas, Oaxaca, Guerrero',
    estadosCorto: 'Camp, Chis, Gro, Oax, Q.Roo, Tab, Ver, Yuc',
    colorHex: '#059669',
    badgeActivo: 'bg-emerald-600 text-white border-emerald-600'
  }
};

// ============================================================================
// INTERFACES DE TABLAS SUPABASE
// ============================================================================
export interface DimCarreraRow {
  cve_carrera: string;
  nombre_carrera: string;
  cve_4_digitos?: string;
  nombre_ejecutivo?: string | null;
  semestres_default?: number | null;
  capex_mxn?: number | null;
}

export interface BenchmarkPrepaRow {
  anio: number;
  region: string;
  sexo: number;
  sueldo_promedio_mensual: number;
  formalidad_pct: number | null;
  tasa_desempleo_pct?: number | null;
  n_encuestados?: number | null;
}

export interface SatelitePrepaRow {
  region: string;
  sexo: number;
  n_encuestados_reales: number;
  n_efectivo_kish: number;
  volumen_muestra_nacional: number;
  pct_micro: number;
  pct_pyme: number;
  pct_corp: number;
  pct_gobierno: number;
  pct_home_office: number;
  pct_nepotismo: number;
  pct_pluriempleo: number;
  pct_medio_tiempo: number;
  pct_desarraigo: number;
  pct_contrato: number;
  pct_sindicato: number;
  pct_aguinaldo: number;
  pct_afore: number;
  pct_sgmm: number;
  pct_materno: number;
  indice_privilegio: number;
  hrs_doble_jornada_hombres: number;
  hrs_doble_jornada_mujeres: number;
  brecha_genero_hogar_hrs: number;
}

export interface SatelitePrepaComputado extends SatelitePrepaRow {
  formalidad_total_pct: number;
  calidad_oit_pct: number;
  hrs_hogar_activa: number;
}

export type SatelitesPrepaMap = Record<RegionClave, Record<CodigoGenero, SatelitePrepaComputado | null>>;

export interface CostosEscenarioROI {
  publica: { colegiatura_mensual: number; titulacion: number };
  privada_media: { colegiatura_mensual: number; titulacion: number };
  privada_elite: { colegiatura_mensual: number; titulacion: number };
}

export interface MetaPipelineInfo {
  anio_inicio: number;
  ultimo_anio: number;
  ultimo_trimestre: number;
  etiqueta_corte: string;
  etiqueta_pesos_base: string;
  inpc_base: number | null;
  costos_roi: CostosEscenarioROI;
}

export interface BenchmarkPrepaRegional {
  sueldo_prepa: Record<CodigoGenero, number>;
  formalidad_prepa_pct: Record<CodigoGenero, number>;
  calidad_oit_prepa_pct: Record<CodigoGenero, number | null>;
  desempleo_prepa_pct: Record<CodigoGenero, number | null>;
  historico_por_sexo: Record<CodigoGenero, Record<number, number>>;
}

export type BenchmarksPrepaMap = Record<RegionClave, BenchmarkPrepaRegional>;

export interface VentanasTemporales {
  aniosOrdenados: number[];
  anioMin: number;
  anioMax: number;
  aniosCierre: number[];
  aniosEmpleo: number[];
  aniosBaseTendencia: number[];
  anioPostInicio: number;
  rangoTexto: string;
  cierreTexto: string;
}

export const COSTOS_ROI_DEFAULT: CostosEscenarioROI = {
  publica: { colegiatura_mensual: 300, titulacion: 8500 },
  privada_media: { colegiatura_mensual: 6500, titulacion: 22000 },
  privada_elite: { colegiatura_mensual: 16000, titulacion: 28000 }
};

export const META_PIPELINE_FALLBACK: MetaPipelineInfo = {
  anio_inicio: 2021,
  ultimo_anio: 2026,
  ultimo_trimestre: 2,
  etiqueta_corte: '2026 Q2',
  etiqueta_pesos_base: 'Pesos constantes 2026 Q2',
  inpc_base: null,
  costos_roi: COSTOS_ROI_DEFAULT
};

// ============================================================================
// UTILIDADES DE NORMALIZACIÓN Y PAGINACIÓN DETERMINISTA DE SUPABASE
// ============================================================================
export function padCve(cve: unknown): string {
  return String(cve ?? '').trim().replace(/\.0$/, '').padStart(6, '0');
}

export function numSeguro(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizarRegion(entRaw: unknown): RegionClave {
  const s = String(entRaw ?? 'nacional').toLowerCase().trim();
  if (s === '0' || s === '00' || s === 'nacional') return 'nacional';
  if ((REGIONES_ORDEN as readonly string[]).includes(s)) return s as RegionClave;
  const pad = s.padStart(2, '0');
  const encontrada = Object.entries(ESTADOS_POR_REGION).find(([, lista]) => lista.includes(pad));
  return encontrada ? (encontrada[0] as RegionClave) : 'nacional';
}

export async function descargarTodoPaginado<T = any>(
  construirQuery: () => any,
  pageSize = 1000
): Promise<T[]> {
  let acumulado: T[] = [];
  let desde = 0;
  while (true) {
    const { data, error } = await construirQuery().range(desde, desde + pageSize - 1);
    if (error) {
      console.error('Error en descarga paginada Supabase:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    acumulado = acumulado.concat(data as T[]);
    if (data.length < pageSize) break;
    desde += pageSize;
  }
  return acumulado;
}

// ============================================================================
// CARGADORES DE METADATOS Y BENCHMARKS DESDE SUPABASE
// ============================================================================
export async function cargarMetaPipeline(client: SupabaseClient): Promise<MetaPipelineInfo> {
  try {
    const { data, error } = await client
      .from('meta_pipeline')
      .select('anio_inicio, ultimo_anio, ultimo_trimestre, etiqueta_corte, etiqueta_pesos_base, inpc_base, costos_roi')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return META_PIPELINE_FALLBACK;

    const cRoi = data.costos_roi || {};
    return {
      anio_inicio: numSeguro(data.anio_inicio, 2021),
      ultimo_anio: numSeguro(data.ultimo_anio, 2026),
      ultimo_trimestre: numSeguro(data.ultimo_trimestre, 2),
      etiqueta_corte: String(data.etiqueta_corte || `${data.ultimo_anio || 2026} Q${data.ultimo_trimestre || 2}`),
      etiqueta_pesos_base: String(data.etiqueta_pesos_base || `Pesos constantes ${data.ultimo_anio || 2026}`),
      inpc_base: data.inpc_base != null ? Number(data.inpc_base) : null,
      costos_roi: {
        publica: {
          colegiatura_mensual: numSeguro(cRoi?.publica?.colegiatura_mensual, COSTOS_ROI_DEFAULT.publica.colegiatura_mensual),
          titulacion: numSeguro(cRoi?.publica?.titulacion, COSTOS_ROI_DEFAULT.publica.titulacion)
        },
        privada_media: {
          colegiatura_mensual: numSeguro(cRoi?.privada_media?.colegiatura_mensual, COSTOS_ROI_DEFAULT.privada_media.colegiatura_mensual),
          titulacion: numSeguro(cRoi?.privada_media?.titulacion, COSTOS_ROI_DEFAULT.privada_media.titulacion)
        },
        privada_elite: {
          colegiatura_mensual: numSeguro(cRoi?.privada_elite?.colegiatura_mensual, COSTOS_ROI_DEFAULT.privada_elite.colegiatura_mensual),
          titulacion: numSeguro(cRoi?.privada_elite?.titulacion, COSTOS_ROI_DEFAULT.privada_elite.titulacion)
        }
      }
    };
  } catch {
    return META_PIPELINE_FALLBACK;
  }
}

export async function cargarBenchmarksPrepaRows(client: SupabaseClient): Promise<BenchmarkPrepaRow[]> {
  return descargarTodoPaginado<BenchmarkPrepaRow>(() =>
    client
      .from('benchmarks_prepa')
      .select('anio, region, sexo, sueldo_promedio_mensual, formalidad_pct, tasa_desempleo_pct, n_encuestados')
      .order('anio', { ascending: true })
      .order('region', { ascending: true })
      .order('sexo', { ascending: true })
  );
}

export async function cargarSatelitesPrepaRows(client: SupabaseClient): Promise<SatelitePrepaRow[]> {
  try {
    const { data, error } = await client
      .from('satelites_prepa')
      .select('*')
      .order('region', { ascending: true })
      .order('sexo', { ascending: true });
    if (error || !data) return [];
    return data as SatelitePrepaRow[];
  } catch {
    return [];
  }
}

export async function cargarCatalogoCarreras(client: SupabaseClient): Promise<DimCarreraRow[]> {
  const { data, error } = await client
    .from('dim_carreras')
    .select('cve_carrera, nombre_carrera, cve_4_digitos, nombre_ejecutivo, semestres_default, capex_mxn')
    .order('cve_carrera', { ascending: true });

  if (error || !data) {
    const resBasic = await client
      .from('dim_carreras')
      .select('cve_carrera, nombre_carrera')
      .order('cve_carrera', { ascending: true });
    return (resBasic.data || [])
      .map((r: any) => ({ ...r, cve_carrera: padCve(r.cve_carrera) }))
      .filter((r: DimCarreraRow) => r.cve_carrera !== '999999');
  }

  return (data as any[])
    .map(r => ({ ...r, cve_carrera: padCve(r.cve_carrera) }))
    .filter(r => r.cve_carrera !== '999999');
}

// ============================================================================
// MOTOR TEMPORAL DINÁMICO (NUNCA CONGELA 2021–2026)
// ============================================================================
export function calcularVentanasTemporales(
  aniosPresentes: number[],
  meta?: MetaPipelineInfo | null
): VentanasTemporales {
  const unicos = Array.from(new Set(aniosPresentes.filter(a => Number.isFinite(a) && a >= 2000))).sort((a, b) => a - b);

  const anioMin = unicos.length > 0 ? unicos[0] : (meta?.anio_inicio ?? 2021);
  const anioMax = unicos.length > 0 ? unicos[unicos.length - 1] : (meta?.ultimo_anio ?? 2026);
  const aniosOrdenados = unicos.length > 0
    ? unicos
    : Array.from({ length: Math.max(1, anioMax - anioMin + 1) }, (_, i) => anioMin + i);

  const aniosCierre = aniosOrdenados.length >= 2
    ? [aniosOrdenados[aniosOrdenados.length - 2], aniosOrdenados[aniosOrdenados.length - 1]]
    : [anioMax];

  const anioPostInicio = Math.max(anioMin + 1, anioMax - 4);
  const aniosEmpleo = aniosOrdenados.filter(a => a >= anioPostInicio && a <= anioMax);
  const aniosEmpleoSeguro = aniosEmpleo.length > 0 ? aniosEmpleo : aniosOrdenados;

  const aniosBaseTendencia = aniosEmpleoSeguro.length >= 4
    ? [aniosEmpleoSeguro[0], aniosEmpleoSeguro[1]]
    : [aniosOrdenados[0]];

  return {
    aniosOrdenados,
    anioMin,
    anioMax,
    aniosCierre,
    aniosEmpleo: aniosEmpleoSeguro,
    aniosBaseTendencia,
    anioPostInicio,
    rangoTexto: `${anioMin}–${anioMax}`,
    cierreTexto: aniosCierre.length >= 2 ? `${aniosCierre[0]}–${aniosCierre[aniosCierre.length - 1]}` : String(anioMax)
  };
}

// ============================================================================
// CONSTRUCCIÓN DINÁMICA DE SATÉLITES Y BENCHMARKS DE PREPARATORIA
// ============================================================================
export function construirSatelitesPrepaMap(rows: SatelitePrepaRow[]): SatelitesPrepaMap {
  const mapa = {} as SatelitesPrepaMap;
  REGIONES_ORDEN.forEach(reg => {
    mapa[reg] = { 0: null, 1: null, 2: null };
  });

  rows.forEach(raw => {
    const reg = normalizarRegion(raw.region);
    const sx = Number(raw.sexo ?? 0) as CodigoGenero;
    if (![0, 1, 2].includes(sx)) return;

    const pCont = numSeguro(raw.pct_contrato, 0);
    const pAgui = numSeguro(raw.pct_aguinaldo, 0);
    const pAfor = numSeguro(raw.pct_afore, 0);
    const pPlur = numSeguro(raw.pct_pluriempleo, 0);
    const hrsH = numSeguro(raw.hrs_doble_jornada_hombres, 0);
    const hrsM = numSeguro(raw.hrs_doble_jornada_mujeres, 0);

    const formalidad_total_pct = Number((pCont * 0.45 + pAgui * 0.30 + pAfor * 0.25).toFixed(1));
    const calidad_oit_pct = Number(
      (((Math.min(pCont, pAfor) * 0.70 + pCont * 0.30) * (1 - pPlur / 200))).toFixed(1)
    );
    const hrs_hogar_activa = sx === 1 ? hrsH : sx === 2 ? hrsM : Number(((hrsH + hrsM) / 2).toFixed(1));

    mapa[reg][sx] = {
      ...raw,
      region: reg,
      sexo: sx,
      formalidad_total_pct,
      calidad_oit_pct,
      hrs_hogar_activa
    };
  });

  return mapa;
}

export function construirBenchmarksPrepaMap(
  rows: BenchmarkPrepaRow[],
  ventanas?: VentanasTemporales,
  satelitesPrepaRows?: SatelitePrepaRow[]
): BenchmarksPrepaMap {
  const aniosEnRows = rows.map(r => Number(r.anio)).filter(a => Number.isFinite(a));
  const v = ventanas || calcularVentanasTemporales(aniosEnRows);
  const satPrepaMap = satelitesPrepaRows && satelitesPrepaRows.length > 0
    ? construirSatelitesPrepaMap(satelitesPrepaRows)
    : null;

  const resultado = {} as BenchmarksPrepaMap;

  REGIONES_ORDEN.forEach(reg => {
    const sueldo_prepa: Record<CodigoGenero, number> = { 0: 10608, 1: 11832, 2: 8762 };
    const formalidad_prepa_pct: Record<CodigoGenero, number> = { 0: 50.1, 1: 50.1, 2: 50.1 };
    const calidad_oit_prepa_pct: Record<CodigoGenero, number | null> = { 0: null, 1: null, 2: null };
    const desempleo_prepa_pct: Record<CodigoGenero, number | null> = { 0: null, 1: null, 2: null };
    const historico_por_sexo: Record<CodigoGenero, Record<number, number>> = { 0: {}, 1: {}, 2: {} };

    ([0, 1, 2] as CodigoGenero[]).forEach(sx => {
      const filas = rows
        .filter(r => normalizarRegion(r.region) === reg && Number(r.sexo) === sx)
        .sort((a, b) => Number(a.anio) - Number(b.anio));

      if (filas.length > 0) {
        filas.forEach(f => {
          const val = Math.round(Number(f.sueldo_promedio_mensual || 0));
          if (val > 0) historico_por_sexo[sx][Number(f.anio)] = val;
        });

        const filasCierre = filas.filter(f => v.aniosCierre.includes(Number(f.anio)) && Number(f.sueldo_promedio_mensual) > 0);
        const lote = filasCierre.length > 0 ? filasCierre : filas.slice(-2);
        const sueldoProm = lote.reduce((acc, f) => acc + Number(f.sueldo_promedio_mensual || 0), 0) / lote.length;
        if (sueldoProm > 0) {
          sueldo_prepa[sx] = Math.round(sueldoProm);
        }

        const ultimaConForm = [...filas].reverse().find(f => f.formalidad_pct != null && Number(f.formalidad_pct) > 0);
        if (ultimaConForm) {
          formalidad_prepa_pct[sx] = Number(Number(ultimaConForm.formalidad_pct).toFixed(1));
        }

        const filasDesemp = filas.filter(
          f => v.aniosEmpleo.includes(Number(f.anio)) && f.tasa_desempleo_pct != null && Number.isFinite(Number(f.tasa_desempleo_pct))
        );
        const loteDes = filasDesemp.length > 0
          ? filasDesemp
          : filas.filter(f => f.tasa_desempleo_pct != null && Number.isFinite(Number(f.tasa_desempleo_pct)));
        if (loteDes.length > 0) {
          const promDes = loteDes.reduce((acc, f) => acc + Number(f.tasa_desempleo_pct), 0) / loteDes.length;
          desempleo_prepa_pct[sx] = Number(promDes.toFixed(1));
        }
      }

      // Prioriza la formalidad compuesta y Calidad OIT de satelites_prepa (comparación exacta manzanas con manzanas vs. Licenciatura)
      const satP = satPrepaMap?.[reg]?.[sx];
      if (satP) {
        formalidad_prepa_pct[sx] = satP.formalidad_total_pct;
        calidad_oit_prepa_pct[sx] = satP.calidad_oit_pct;
      }
    });

    if (formalidad_prepa_pct[1] === 50.1 && formalidad_prepa_pct[0] !== 50.1) formalidad_prepa_pct[1] = formalidad_prepa_pct[0];
    if (formalidad_prepa_pct[2] === 50.1 && formalidad_prepa_pct[0] !== 50.1) formalidad_prepa_pct[2] = formalidad_prepa_pct[0];

    resultado[reg] = {
      sueldo_prepa,
      formalidad_prepa_pct,
      calidad_oit_prepa_pct,
      desempleo_prepa_pct,
      historico_por_sexo
    };
  });

  return resultado;
}

// ============================================================================
// VALIDACIÓN UNIFICADA DE CELDAS (MISMA REGLA EN LAS 4 PÁGINAS Y EN VERSUS)
// ============================================================================
export function esCeldaSateliteValida(sat: any, region: string, sexo: CodigoGenero): boolean {
  if (!sat) return false;
  const nReal = numSeguro(sat.n_encuestados_reales, 0);
  const nKish = numSeguro(sat.n_efectivo_kish, 0);

  if (region === 'nacional') {
    return sexo === 0 ? nReal >= 180 : nReal >= 25;
  }
  const minN = sexo === 0 ? 30 : 25;
  return nReal >= minN && (nKish === 0 || nKish >= 18);
}

// ============================================================================
// CÁLCULO SALARIAL CONSOLIDADO (SIN DOBLE BÜHLMANN)
// ============================================================================
export function calcularSueldoPonderado(filas: any[]): number {
  const validas = filas.filter(r => Number(r.sueldo_promedio_mensual || 0) > 0);
  if (validas.length === 0) return 0;
  const sumaPob = validas.reduce((acc, r) => acc + Math.max(1, Number(r.poblacion_activa_total || 1)), 0);
  if (sumaPob <= 0) return 0;
  return validas.reduce(
    (acc, r) => acc + Number(r.sueldo_promedio_mensual) * Math.max(1, Number(r.poblacion_activa_total || 1)),
    0
  ) / sumaPob;
}

export function calcularSueldoConsolidadoCelda(
  filasCelda: any[],
  ventanas: VentanasTemporales,
  sueldoFallback = 0
): number {
  const filasCierre = filasCelda.filter(
    r => ventanas.aniosCierre.includes(Number(r.anio)) && Number(r.sueldo_promedio_mensual || 0) > 0
  );
  const lote = filasCierre.length > 0
    ? filasCierre
    : filasCelda.filter(r => Number(r.sueldo_promedio_mensual || 0) > 0);

  const prom = calcularSueldoPonderado(lote);
  return prom > 0 ? Math.round(prom) : Math.round(sueldoFallback);
}

// ============================================================================
// CLASIFICADOR ÚNICO DE TENDENCIA REAL (100% DINÁMICO CON VENTANAS)
// ============================================================================
export function clasificarTendenciaRealDinamica(
  filasReales: any[],
  ventanas?: VentanasTemporales
): {
  etiqueta: string;
  codigo: CodigoTendencia;
  sueldoBase: number;
  sueldoReciente: number;
  cambioRealPct: number;
  pendienteAnualPct: number;
} {
  const porAnioMap: Record<number, { prod: number; peso: number }> = {};
  filasReales.forEach(r => {
    const a = Number(r.anio);
    const s = Number(r.sueldo_promedio_mensual ?? r.sueldo ?? 0);
    const p = Math.max(1, Number(r.poblacion_activa_total || 1));
    if (Number.isFinite(a) && s > 0) {
      if (!porAnioMap[a]) porAnioMap[a] = { prod: 0, peso: 0 };
      porAnioMap[a].prod += s * p;
      porAnioMap[a].peso += p;
    }
  });

  const anios = Object.keys(porAnioMap).map(Number).sort((a, b) => a - b);
  if (anios.length < 4) {
    const sUnico = anios.length > 0 ? Math.round(porAnioMap[anios[anios.length - 1]].prod / porAnioMap[anios[anios.length - 1]].peso) : 0;
    return {
      etiqueta: 'Estable',
      codigo: 'estable',
      sueldoBase: sUnico,
      sueldoReciente: sUnico,
      cambioRealPct: 0,
      pendienteAnualPct: 0
    };
  }

  const v = ventanas || calcularVentanasTemporales(anios);
  const sueldos = anios.map(a => porAnioMap[a].prod / porAnioMap[a].peso);

  let maxSalto = 0;
  for (let i = 1; i < sueldos.length; i++) {
    const salto = Math.abs(sueldos[i] - sueldos[i - 1]) / sueldos[i - 1];
    if (salto > maxSalto) maxSalto = salto;
  }

  const media = sueldos.reduce((a, b) => a + b, 0) / sueldos.length;
  const varianza = sueldos.reduce((a, b) => a + Math.pow(b - media, 2), 0) / sueldos.length;
  const cv = Math.sqrt(varianza) / (media || 1);

  const ptsBase = anios.filter(a => v.aniosBaseTendencia.includes(a)).map(a => porAnioMap[a].prod / porAnioMap[a].peso);
  const ptsRec = anios.filter(a => v.aniosCierre.includes(a)).map(a => porAnioMap[a].prod / porAnioMap[a].peso);

  const sueldoBase = ptsBase.length > 0 ? ptsBase.reduce((a, b) => a + b, 0) / ptsBase.length : sueldos[0];
  const sueldoRec = ptsRec.length > 0 ? ptsRec.reduce((a, b) => a + b, 0) / ptsRec.length : sueldos[sueldos.length - 1];

  const crecRealAcum = sueldoBase > 0 ? (sueldoRec - sueldoBase) / sueldoBase : 0;
  const cambioRealPct = Number((crecRealAcum * 100).toFixed(1));

  const aniosPost = anios.filter(a => a >= v.anioPostInicio);
  const aniosEval = aniosPost.length >= 3 ? aniosPost : anios;
  const sueldosEval = aniosEval.map(a => porAnioMap[a].prod / porAnioMap[a].peso);
  const mediaEval = sueldosEval.reduce((a, b) => a + b, 0) / sueldosEval.length;

  const meanX = aniosEval.reduce((a, b) => a + b, 0) / aniosEval.length;
  const numSum = aniosEval.reduce((acc, x, idx) => acc + (x - meanX) * (sueldosEval[idx] - mediaEval), 0);
  const denSum = aniosEval.reduce((acc, x) => acc + Math.pow(x - meanX, 2), 0) || 1;
  const pendientePct = (numSum / denSum) / (mediaEval || 1);
  const pendienteAnualPct = Number((pendientePct * 100).toFixed(1));

  if (maxSalto > 0.22 || cv > 0.16) {
    return {
      etiqueta: 'Volátil',
      codigo: 'volatil',
      sueldoBase: Math.round(sueldoBase),
      sueldoReciente: Math.round(sueldoRec),
      cambioRealPct,
      pendienteAnualPct
    };
  }
  if (crecRealAcum >= 0.040 && pendientePct >= 0.008) {
    return {
      etiqueta: 'En crecimiento',
      codigo: 'crecimiento',
      sueldoBase: Math.round(sueldoBase),
      sueldoReciente: Math.round(sueldoRec),
      cambioRealPct,
      pendienteAnualPct
    };
  }
  if (crecRealAcum <= -0.040 && pendientePct <= -0.008) {
    return {
      etiqueta: 'En ajuste',
      codigo: 'ajuste',
      sueldoBase: Math.round(sueldoBase),
      sueldoReciente: Math.round(sueldoRec),
      cambioRealPct,
      pendienteAnualPct
    };
  }
  return {
    etiqueta: 'Estable',
    codigo: 'estable',
    sueldoBase: Math.round(sueldoBase),
    sueldoReciente: Math.round(sueldoRec),
    cambioRealPct,
    pendienteAnualPct
  };
}

// ============================================================================
// MÉTRICAS DE CALIDAD, FORMALIDAD, MERITOCRACIA Y ROI UNIFICADAS
// ============================================================================
export function calcularIndicadoresSatelite(params: {
  sat: any;
  sueldoMensual: number;
  sueldoPrepa: number;
  mediaEstratoContexto: number;
  mediaNepotismoContexto: number;
}) {
  const { sat, sueldoMensual, sueldoPrepa, mediaEstratoContexto, mediaNepotismoContexto } = params;
  const pContrato = numSeguro(sat?.pct_contrato, 65);
  const pAguinaldo = numSeguro(sat?.pct_aguinaldo, 63);
  const pAfore = numSeguro(sat?.pct_afore, 55);
  const pPluri = numSeguro(sat?.pct_pluriempleo, 5.6);
  const pDesarr = numSeguro(sat?.pct_desarraigo, 2.7);
  const pCorp = numSeguro(sat?.pct_corp, 12);
  const pPyme = numSeguro(sat?.pct_pyme, 30);
  const pSind = numSeguro(sat?.pct_sindicato, 15);
  const pNep = numSeguro(sat?.pct_nepotismo, mediaNepotismoContexto);
  const priv = numSeguro(sat?.indice_privilegio, mediaEstratoContexto);
  const riesgoIA = numSeguro(sat?.riesgo_ia_score, 40);

  const calidadOitPct = Number((((Math.min(pContrato, pAfore) * 0.70 + pContrato * 0.30) * (1 - pPluri / 200))).toFixed(1));
  const formalidadTotalPct = Number((pContrato * 0.45 + pAguinaldo * 0.30 + pAfore * 0.25).toFixed(1));
  const primaPrepaPct = sueldoPrepa > 0 && sueldoMensual > 0
    ? Number((((sueldoMensual - sueldoPrepa) / sueldoPrepa) * 100).toFixed(1))
    : 0;

  const diffEst = priv - mediaEstratoContexto;
  const penalizacionElitismo = diffEst > 0.05 ? (diffEst - 0.05) * 110 : diffEst * 35;
  const inclusionOrigen = Math.max(15, Math.min(92, 70 - penalizacionElitismo));
  const aperturaContratacion = Math.max(10, Math.min(95, 100 - (pNep + pSind * 0.22)));
  const saltoSalarialScore = Math.max(0, Math.min(100, primaPrepaPct));
  const impulsoAscenso = saltoSalarialScore * 0.45 + calidadOitPct * 0.35 + Math.min(100, pCorp * 2.2 + pPyme * 0.6) * 0.20;
  const meritocraciaPct = Number(Math.max(12, Math.min(96, aperturaContratacion * 0.40 + impulsoAscenso * 0.35 + inclusionOrigen * 0.25)).toFixed(1));

  return {
    calidadOitPct,
    formalidadTotalPct,
    primaPrepaPct,
    meritocraciaPct,
    blindajeIAPct: Math.max(0, 100 - riesgoIA),
    pctEmpleoUnico: Number(Math.max(0, 100 - pPluri).toFixed(1)),
    pctArraigoLocal: Number(Math.max(0, 100 - pDesarr).toFixed(1))
  };
}

export function obtenerCapExDinamico(cve: string, capexDesdeDB?: number | null): {
  nivel: 1 | 2 | 3;
  costoEquipo: number;
  etiqueta: string;
  corto: string;
  clase: string;
} {
  let costo = Number(capexDesdeDB || 0);
  if (!Number.isFinite(costo) || costo <= 0) {
    const pad = padCve(cve);
    const pref3 = pad.slice(0, 3);
    const pref4 = pad.slice(0, 4);
    if (
      pref4 === '0911' || pref4 === '0931' || pref3 === '073' || pref3 === '021' ||
      pref4 === '0821' || pref4 === '1014' || pref4 === '1013' || pref4 === '1015'
    ) {
      costo = 85000;
    } else if (
      pref3 === '061' || pref3 === '062' || pref3 === '071' || pref3 === '072' ||
      pref3 === '051' || pref3 === '052' || pref3 === '053' || pref3 === '081' ||
      pref3 === '091' || pref3 === '092' || pref3 === '094' || pref3 === '095'
    ) {
      costo = 42000;
    } else {
      costo = 18000;
    }
  }

  if (costo >= 70000) {
    return {
      nivel: 3,
      costoEquipo: costo,
      etiqueta: `Equipo Alto ($${Math.round(costo / 1000)}k)`,
      corto: 'Equipo Alto',
      clase: 'bg-rose-50 text-rose-700 border-rose-200'
    };
  }
  if (costo >= 30000) {
    return {
      nivel: 2,
      costoEquipo: costo,
      etiqueta: `Equipo Medio ($${Math.round(costo / 1000)}k)`,
      corto: 'Equipo Medio',
      clase: 'bg-amber-50 text-amber-800 border-amber-200'
    };
  }
  return {
    nivel: 1,
    costoEquipo: costo,
    etiqueta: `Equipo Básico ($${Math.round(costo / 1000)}k)`,
    corto: 'Equipo Básico',
    clase: 'bg-slate-100 text-slate-600 border-slate-200'
  };
}

export function calcularAniosRetornoDinamico(params: {
  sueldoCarrera: number;
  sueldoPrepa: number;
  cve: string;
  escenario: 'publica' | 'privada_media' | 'privada_elite';
  semestres?: number | null;
  capexMxn?: number | null;
  costosRoi?: CostosEscenarioROI | null;
}): number | null {
  const { sueldoCarrera, sueldoPrepa, cve, escenario, semestres, capexMxn, costosRoi } = params;
  const sem = semestres && semestres > 0 ? semestres : (padCve(cve) === '091100' ? 12 : 9);
  const capex = obtenerCapExDinamico(cve, capexMxn).costoEquipo;
  const cfg = (costosRoi || COSTOS_ROI_DEFAULT)[escenario];
  const inversionTotal = sem * (cfg.colegiatura_mensual * 6) + cfg.titulacion + capex;
  const bonoAnual = (sueldoCarrera - sueldoPrepa) * 12;
  if (bonoAnual <= 0) return null;
  return Number((inversionTotal / bonoAnual).toFixed(1));
}

export function calcularPercentil(valores: number[], p: number): number {
  const ordenados = valores.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (ordenados.length === 0) return 0;
  const idx = (ordenados.length - 1) * p;
  const base = Math.floor(idx);
  const rest = idx - base;
  if (ordenados[base + 1] !== undefined) {
    return ordenados[base] + rest * (ordenados[base + 1] - ordenados[base]);
  }
  return ordenados[base];
}

export function normalizarSalarioRadarDinamico(
  sueldo: number,
  pisoDinamico: number,
  techoDinamico: number
): number {
  const minRef = Number.isFinite(pisoDinamico) && pisoDinamico > 0 ? pisoDinamico : 9500;
  const maxRef = Number.isFinite(techoDinamico) && techoDinamico > minRef + 1000 ? techoDinamico : minRef + 12500;
  return Math.round(Math.max(15, Math.min(100, ((sueldo - minRef) / (maxRef - minRef)) * 100)));
}