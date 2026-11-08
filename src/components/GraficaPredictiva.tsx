"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Activity, Loader2, MapPin,
  Microscope, AlertCircle, Info
} from 'lucide-react';

export type ModoGeneroEstricto = 'total' | 'mujeres' | 'hombres';

const MAPA_KISH_VACIO: Record<string, number> = {};

export const BENCHMARK_PREPA: Record<string, {
  sueldo_general: number;
  sueldo_hombres: number;
  sueldo_mujeres: number;
  formalidad_prepa_pct: number;
  formalidad_lic_pct: number;
  sueldo_lic_promedio: number;
  historico_anual: Record<string, number>;
}> = {
  nacional: {
    sueldo_general: 10608, sueldo_hombres: 11832, sueldo_mujeres: 8762,
    formalidad_prepa_pct: 50.1, formalidad_lic_pct: 70.3, sueldo_lic_promedio: 15534,
    historico_anual: { "2021": 8850, "2022": 9111, "2023": 9528, "2024": 9960, "2025": 10393, "2026": 10787 }
  },
  norte: {
    sueldo_general: 12816, sueldo_hombres: 14113, sueldo_mujeres: 10775,
    formalidad_prepa_pct: 66.3, formalidad_lic_pct: 78.2, sueldo_lic_promedio: 17917,
    historico_anual: { "2021": 10700, "2022": 11018, "2023": 11741, "2024": 12199, "2025": 12705, "2026": 12920 }
  },
  noroeste: {
    sueldo_general: 11858, sueldo_hombres: 13365, sueldo_mujeres: 9748,
    formalidad_prepa_pct: 54.0, formalidad_lic_pct: 71.4, sueldo_lic_promedio: 15495,
    historico_anual: { "2021": 9800, "2022": 10106, "2023": 11079, "2024": 11026, "2025": 11750, "2026": 11965 }
  },
  bajio: {
    sueldo_general: 10478, sueldo_hombres: 11731, sueldo_mujeres: 8707,
    formalidad_prepa_pct: 53.2, formalidad_lic_pct: 72.3, sueldo_lic_promedio: 14742,
    historico_anual: { "2021": 9000, "2022": 9275, "2023": 9454, "2024": 10077, "2025": 10228, "2026": 10684 }
  },
  centro: {
    sueldo_general: 9889, sueldo_hombres: 11119, sueldo_mujeres: 8069,
    formalidad_prepa_pct: 45.3, formalidad_lic_pct: 68.3, sueldo_lic_promedio: 16000,
    historico_anual: { "2021": 8050, "2022": 8234, "2023": 8431, "2024": 8663, "2025": 9295, "2026": 10289 }
  },
  sur: {
    sueldo_general: 9150, sueldo_hombres: 10195, sueldo_mujeres: 7469,
    formalidad_prepa_pct: 37.9, formalidad_lic_pct: 61.9, sueldo_lic_promedio: 13023,
    historico_anual: { "2021": 7550, "2022": 7802, "2023": 8270, "2024": 8924, "2025": 9036, "2026": 9255 }
  }
};

export const ESTADOS_POR_REGION: Record<string, string[]> = {
  norte: ['02', '05', '08', '19', '26', '28'],
  noroeste: ['03', '10', '18', '25'],
  bajio: ['01', '06', '11', '14', '16', '22', '24', '32'],
  centro: ['09', '13', '15', '17', '21', '29'],
  sur: ['04', '07', '12', '20', '23', '27', '30', '31']
};

const PARIDAD_REGIONAL_LIC: Record<string, number> = {
  nacional: 1.0,
  norte: 17917 / 15534,
  noroeste: 15495 / 15534,
  bajio: 14742 / 15534,
  centro: 16000 / 15534,
  sur: 13023 / 15534
};

const formatoMoneda = (valor: any) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(valor) || 0);

const formatoTickExacto5k = (valor: any) => {
  const n = Number(valor) || 0;
  if (n === 0) return '$0';
  return `$${Math.round(n / 1000)}k`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md p-3.5 border border-slate-700 shadow-xl rounded-xl z-50 min-w-[220px] text-white">
        <p className="font-bold text-slate-300 mb-2 border-b border-slate-700/80 pb-1.5 text-xs uppercase tracking-wider">
          Año {label} · Observado INEGI (Pesos Reales)
        </p>
        {payload.map((entry: any, index: number) => {
          if (entry.value == null) return null;
          const esPrepa = entry.name.includes('Preparatoria');
          return (
            <div
              key={index}
              className={`text-xs font-medium mb-1.5 flex items-center justify-between gap-4 ${
                esPrepa ? 'pt-1.5 mt-1.5 border-t border-dashed border-slate-700 text-amber-300' : 'text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-black">{formatoMoneda(entry.value)}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export interface SueldoRegionalItem {
  region: string;
  sueldoCarrera: number;
  sueldoPrepa: number;
  premioPct: number;
  pea: number;
  sinMuestraRegional: boolean;
}

export interface PuntoAnualRealItem {
  anio: number;
  sueldoLic: number | null;
  sueldoPrepa: number | null;
  pea: number;
}

export interface ResumenMercadoRegion {
  sueldoActivo: number;
  sueldoNacionalBase: number;
  sueldoPrepaActivo: number;
  premioVsPrepaPct: number;
  gananciaAnualExtra: number;
  poblacionActiva: number;
  desempleadosActivos: number;
  tasaDesempleo: number;
  saturacion: number;
  proporcionMujeresNacional: number;
  tendenciaEtiqueta: string;
  tendenciaCodigo: 'crecimiento' | 'estable' | 'ajuste' | 'volatil';
  isStem: boolean;
  usandoFallbackNacional: boolean;
  comparativaRegiones: SueldoRegionalItem[];
  serieAnualReal: PuntoAnualRealItem[];
}

function calcularSueldoRegionalBuhlmann(
  sueldoObsCrudo: number,
  sueldoNac: number,
  reg: string,
  nEfectivoKish: number
): number {
  if (reg === 'nacional' || sueldoNac <= 0) {
    return Math.round(sueldoObsCrudo);
  }
  const anclaParidad = sueldoNac * (PARIDAD_REGIONAL_LIC[reg] || 1.0);
  if (sueldoObsCrudo <= 0) {
    return Math.round(anclaParidad);
  }
  const obsAcotado = Math.max(anclaParidad * 0.78, Math.min(anclaParidad * 1.18, sueldoObsCrudo));
  const K = 140.0;
  const z = nEfectivoKish > 0 ? nEfectivoKish / (nEfectivoKish + K) : 0.50;
  return Math.round(z * obsAcotado + (1.0 - z) * anclaParidad);
}

function clasificarTendenciaReal21_26(puntosAnuales: { anio: number; sueldo: number | null }[]) {
  const validos = puntosAnuales
    .filter(p => p.sueldo != null && p.sueldo > 0)
    .sort((a, b) => a.anio - b.anio) as { anio: number; sueldo: number }[];

  if (validos.length < 4) {
    return { etiqueta: 'Estable', codigo: 'estable' as const };
  }

  const sueldos = validos.map(p => p.sueldo);

  let maxSalto = 0;
  for (let i = 1; i < sueldos.length; i++) {
    const salto = Math.abs(sueldos[i] - sueldos[i - 1]) / sueldos[i - 1];
    if (salto > maxSalto) maxSalto = salto;
  }

  const media = sueldos.reduce((a, b) => a + b, 0) / sueldos.length;
  const varianza = sueldos.reduce((a, b) => a + Math.pow(b - media, 2), 0) / sueldos.length;
  const cv = Math.sqrt(varianza) / (media || 1);

  if (maxSalto > 0.22 || cv > 0.16) {
    return { etiqueta: 'Volátil', codigo: 'volatil' as const };
  }

  const ptsBase = validos.filter(p => p.anio === 2022 || p.anio === 2023).map(p => p.sueldo);
  const ptsRec  = validos.filter(p => p.anio === 2025 || p.anio === 2026).map(p => p.sueldo);

  const sueldoBase = ptsBase.length > 0 ? ptsBase.reduce((a, b) => a + b, 0) / ptsBase.length : sueldos[0];
  const sueldoRec  = ptsRec.length > 0 ? ptsRec.reduce((a, b) => a + b, 0) / ptsRec.length : sueldos[sueldos.length - 1];

  const crecRealAcum = sueldoBase > 0 ? (sueldoRec - sueldoBase) / sueldoBase : 0;

  const postPandemia = validos.filter(p => p.anio >= 2022);
  const loteEval = postPandemia.length >= 3 ? postPandemia : validos;
  const aniosEval = loteEval.map(p => p.anio);
  const sueldosEval = loteEval.map(p => p.sueldo);
  const mediaEval = sueldosEval.reduce((a, b) => a + b, 0) / sueldosEval.length;

  const meanX = aniosEval.reduce((a, b) => a + b, 0) / aniosEval.length;
  const num = aniosEval.reduce((acc, x, idx) => acc + (x - meanX) * (sueldosEval[idx] - mediaEval), 0);
  const den = aniosEval.reduce((acc, x) => acc + Math.pow(x - meanX, 2), 0) || 1;
  const pendientePct = (num / den) / (mediaEval || 1);

  if (crecRealAcum >= 0.040 && pendientePct >= 0.008) {
    return { etiqueta: 'En crecimiento', codigo: 'crecimiento' as const };
  }
  if (crecRealAcum <= -0.040 && pendientePct <= -0.008) {
    return { etiqueta: 'En ajuste', codigo: 'ajuste' as const };
  }
  return { etiqueta: 'Estable', codigo: 'estable' as const };
}

export default function GraficaPredictiva({
  cve_carrera,
  regionActiva = 'nacional',
  modoGenero = 'total',
  mapaKishPorRegion,
  onModoGeneroChange,
  onStatsChange
}: {
  cve_carrera: string;
  regionActiva?: string;
  modoGenero?: ModoGeneroEstricto;
  mapaKishPorRegion?: Record<string, number>;
  onModoGeneroChange?: (nuevoModo: ModoGeneroEstricto) => void;
  onStatsChange?: (stats: ResumenMercadoRegion) => void;
}) {
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const ultimaFirmaEmitidaRef = useRef<string>('');

  const kishSeguro = mapaKishPorRegion || MAPA_KISH_VACIO;
  const firmaKish = `${kishSeguro.nacional || 0}_${kishSeguro.norte || 0}_${kishSeguro.noroeste || 0}_${kishSeguro.bajio || 0}_${kishSeguro.centro || 0}_${kishSeguro.sur || 0}`;

  useEffect(() => {
    async function fetchPredicciones() {
      setLoading(true);
      const cveSinCero = String(Number(cve_carrera));
      const { data, error } = await supabase
        .from('predicciones_roi')
        .select(`
          anio, cve_ent, sexo, is_stem, poblacion_activa_total, desempleados_reales, 
          indice_saturacion_pct, sueldo_promedio_mensual, tipo_dato
        `)
        .in('cve_carrera', [cve_carrera, cveSinCero])
        .eq('tipo_dato', 'Real')
        .order('anio', { ascending: true })
        .limit(1000);

      if (data) {
        const datosLimpios = data.map(row => {
          const entRaw = String(row.cve_ent || 'nacional').toLowerCase().trim();
          let regNorm = entRaw;
          if (entRaw === '0' || entRaw === '00' || entRaw === 'nacional') {
            regNorm = 'nacional';
          } else if (!['norte', 'noroeste', 'bajio', 'centro', 'sur'].includes(entRaw)) {
            const entPad = entRaw.padStart(2, '0');
            const encontrada = Object.entries(ESTADOS_POR_REGION).find(([, lista]) => lista.includes(entPad));
            if (encontrada) regNorm = encontrada[0];
          }
          return {
            ...row,
            cve_ent: regNorm,
            sexo: Number(row.sexo ?? 0)
          };
        });
        setRawData(datosLimpios);
      }

      if (error) console.error("Error de Supabase:", error.message);
      setLoading(false);
    }
    fetchPredicciones();
  }, [cve_carrera]);

  const {
    chartData,
    ticksEjeY,
    maxTickY,
    nombreLineaActiva,
    isStem,
    resumen,
    usandoFallbackNacional,
    muestraModeradaAviso
  } = useMemo(() => {
    const benchRegion = BENCHMARK_PREPA[regionActiva] || BENCHMARK_PREPA.nacional;
    const targetSexo = modoGenero === 'hombres' ? 1 : modoGenero === 'mujeres' ? 2 : 0;

    const extraerSerieZona = (zona: string, sx: number) => {
      const directas = rawData.filter(r => r.cve_ent === zona && r.sexo === sx && r.anio >= 2021 && r.anio <= 2026);
      if (directas.length > 0) return directas;
      if (sx === 0) {
        return rawData.filter(r => r.cve_ent === zona && (r.sexo === 1 || r.sexo === 2) && r.anio >= 2021 && r.anio <= 2026);
      }
      return [];
    };

    const calcularPonderado = (filas: any[]) => {
      const validas = filas.filter(r => Number(r.sueldo_promedio_mensual || 0) > 0);
      if (validas.length === 0) return 0;
      const pob = validas.reduce((acc, c) => acc + Math.max(1, Number(c.poblacion_activa_total || 1)), 0);
      if (pob <= 0) return 0;
      return validas.reduce((acc, c) => acc + Number(c.sueldo_promedio_mensual) * Math.max(1, Number(c.poblacion_activa_total || 1)), 0) / pob;
    };

    const filasNac = extraerSerieZona('nacional', targetSexo);
    const filasNac25_26 = filasNac.filter(r => r.anio === 2025 || r.anio === 2026);
    const sueldoNacionalBase = Math.round(
      calcularPonderado(filasNac25_26.length > 0 ? filasNac25_26 : filasNac)
    );

    const filasNacConSat = filasNac.filter(r => Number(r.indice_saturacion_pct) > 5);
    const saturacionNacionalBase = filasNacConSat.length > 0
      ? filasNacConSat.reduce((acc, c) => acc + Number(c.indice_saturacion_pct), 0) / filasNacConSat.length
      : 92;

    const ordenZonas = ['nacional', 'norte', 'noroeste', 'bajio', 'centro', 'sur'];

    const comparativaRegiones: SueldoRegionalItem[] = ordenZonas.map(zona => {
      const serieZ = extraerSerieZona(zona, targetSexo);
      const serieZ22_26 = serieZ.filter(r => r.anio >= 2022 && r.anio <= 2026);
      const serieZ25_26 = serieZ.filter(r => r.anio === 2025 || r.anio === 2026);

      const lotePeaZ = serieZ22_26.length > 0 ? serieZ22_26 : serieZ;
      const peaZ = lotePeaZ.length > 0
        ? Math.round(lotePeaZ.reduce((acc, c) => acc + Number(c.poblacion_activa_total || 0), 0) / lotePeaZ.length)
        : 0;

      const sueldoObsCrudo = calcularPonderado(serieZ25_26.length > 0 ? serieZ25_26 : serieZ22_26);
      const nKishZ = kishSeguro[zona] || 0;

      const sueldoZ = zona === 'nacional'
        ? sueldoNacionalBase
        : (sueldoObsCrudo > 0
            ? (nKishZ > 0 ? calcularSueldoRegionalBuhlmann(sueldoObsCrudo, sueldoNacionalBase, zona, nKishZ) : Math.round(sueldoObsCrudo))
            : sueldoNacionalBase);

      const sinMuestraRegional = zona !== 'nacional' && (sueldoObsCrudo <= 0 || serieZ.length === 0);

      const bZ = BENCHMARK_PREPA[zona] || BENCHMARK_PREPA.nacional;
      const prepaZ =
        modoGenero === 'hombres' ? bZ.sueldo_hombres :
        modoGenero === 'mujeres' ? bZ.sueldo_mujeres :
        bZ.sueldo_general;

      const premioZ = prepaZ > 0 && sueldoZ > 0
        ? Number((((sueldoZ - prepaZ) / prepaZ) * 100).toFixed(1))
        : 0;

      return {
        region: zona,
        sueldoCarrera: sueldoZ,
        sueldoPrepa: prepaZ,
        premioPct: premioZ,
        pea: peaZ,
        sinMuestraRegional
      };
    });

    const nacH = extraerSerieZona('nacional', 1).filter(r => r.anio >= 2022);
    const nacM = extraerSerieZona('nacional', 2).filter(r => r.anio >= 2022);
    const pobNacH = nacH.reduce((a, b) => a + Number(b.poblacion_activa_total || 0), 0);
    const pobNacM = nacM.reduce((a, b) => a + Number(b.poblacion_activa_total || 0), 0);
    const proporcionMujeresNacional = (pobNacH + pobNacM) > 0 ? pobNacM / (pobNacH + pobNacM) : 0.5;

    let filasCandidatas = extraerSerieZona(regionActiva, targetSexo);
    let fallbackNacional = false;

    if (regionActiva !== 'nacional' && filasCandidatas.filter(r => Number(r.sueldo_promedio_mensual) > 0).length < 3) {
      filasCandidatas = filasNac;
      fallbackNacional = true;
    }

    const ratioPrepaH = benchRegion.sueldo_general > 0 ? benchRegion.sueldo_hombres / benchRegion.sueldo_general : 1;
    const ratioPrepaM = benchRegion.sueldo_general > 0 ? benchRegion.sueldo_mujeres / benchRegion.sueldo_general : 1;
    const factorPrepa = modoGenero === 'hombres' ? ratioPrepaH : modoGenero === 'mujeres' ? ratioPrepaM : 1;

    const etiquetaLinea = 'Salario Licenciatura';

    const porAnio: Record<number, {
      anio: number;
      sueldoProd: number;
      pobConSueldo: number;
      pobTotal: number;
      desTotal: number;
      satProd: number;
      pobConSat: number;
      isStem: boolean;
    }> = {};

    for (let a = 2021; a <= 2026; a++) {
      porAnio[a] = {
        anio: a,
        sueldoProd: 0, pobConSueldo: 0, pobTotal: 0, desTotal: 0, satProd: 0, pobConSat: 0,
        isStem: false
      };
    }

    filasCandidatas.forEach(row => {
      const a = Number(row.anio);
      if (!porAnio[a]) return;

      if (row.is_stem) porAnio[a].isStem = true;
      const pobReal = Number(row.poblacion_activa_total || 0);
      const des = Number(row.desempleados_reales || 0);
      const sat = Number(row.indice_saturacion_pct || 0);
      const sueldo = Number(row.sueldo_promedio_mensual || 0);

      porAnio[a].pobTotal += pobReal;
      porAnio[a].desTotal += des;

      if (sat > 5 && pobReal > 0) {
        porAnio[a].satProd += sat * pobReal;
        porAnio[a].pobConSat += pobReal;
      }

      if (sueldo > 0) {
        const pobPeso = Math.max(1, pobReal);
        porAnio[a].sueldoProd += sueldo * pobPeso;
        porAnio[a].pobConSueldo += pobPeso;
      }
    });

    let carreraEsStem = false;
    let maxValGrafica = 20000;

    const dataArray = Object.values(porAnio)
      .sort((a, b) => a.anio - b.anio)
      .map(item => {
        if (item.isStem) carreraEsStem = true;
        const sueldoAnio = item.pobConSueldo > 0 ? Math.round(item.sueldoProd / item.pobConSueldo) : null;

        const prepaHistorica = benchRegion.historico_anual[String(item.anio)];
        const prepaAjustada = prepaHistorica != null ? Math.round(prepaHistorica * factorPrepa) : null;

        if (sueldoAnio && sueldoAnio > maxValGrafica) maxValGrafica = sueldoAnio;
        if (prepaAjustada && prepaAjustada > maxValGrafica) maxValGrafica = prepaAjustada;

        return {
          anio: item.anio,
          [etiquetaLinea]: sueldoAnio,
          'Base Preparatoria': prepaAjustada,
          _pob: item.pobTotal,
          _des: item.desTotal,
          _sat: item.pobConSat > 0 ? item.satProd / item.pobConSat : saturacionNacionalBase
        };
      });

    const serieAnualReal: PuntoAnualRealItem[] = dataArray.map(d => ({
      anio: Number(d.anio),
      sueldoLic: d[etiquetaLinea] != null ? Number(d[etiquetaLinea]) : null,
      sueldoPrepa: d['Base Preparatoria'] != null ? Number(d['Base Preparatoria']) : null,
      pea: Math.round(Number(d._pob || 0))
    }));

    const tendencia = clasificarTendenciaReal21_26(
      dataArray.map(d => ({ anio: d.anio, sueldo: d[etiquetaLinea] }))
    );

    const techo5k = Math.max(25000, Math.ceil((maxValGrafica + 1500) / 5000) * 5000);
    const ticks5k: number[] = [];
    for (let t = 0; t <= techo5k; t += 5000) {
      ticks5k.push(t);
    }

    const itemRegionActiva = comparativaRegiones.find(c => c.region === regionActiva);
    const puntosVentana5a = dataArray.filter(d => d.anio >= 2022 && d.anio <= 2026 && d._pob > 0);
    const loteConsolidado = puntosVentana5a.length > 0 ? puntosVentana5a : dataArray.filter(d => d._pob > 0);

    const sueldoActivo = itemRegionActiva?.sueldoCarrera || sueldoNacionalBase;
    const sueldoPrepaActivo = itemRegionActiva?.sueldoPrepa || benchRegion.sueldo_general;
    const premioVsPrepaPct = itemRegionActiva?.premioPct || 0;
    const gananciaAnualExtra = (sueldoActivo - sueldoPrepaActivo) * 12;

    const pobActiva = loteConsolidado.length > 0
      ? Math.round(loteConsolidado.reduce((acc, d) => acc + d._pob, 0) / loteConsolidado.length)
      : 0;
    const sumaPea5a = loteConsolidado.reduce((acc, d) => acc + d._pob, 0);
    const sumaDes5a = loteConsolidado.reduce((acc, d) => acc + d._des, 0);
    const tasaDesempleo = sumaPea5a > 0 ? Math.max(0.8, (sumaDes5a / sumaPea5a) * 100) : 3.2;
    const desActivos = Math.round(pobActiva * (tasaDesempleo / 100));

    const punto2026 = dataArray.find(d => d.anio === 2026) || dataArray[dataArray.length - 1];
    const saturacionActiva = punto2026?._sat > 5 ? punto2026._sat : saturacionNacionalBase;

    const statsObj: ResumenMercadoRegion = {
      sueldoActivo,
      sueldoNacionalBase,
      sueldoPrepaActivo,
      premioVsPrepaPct,
      gananciaAnualExtra,
      poblacionActiva: pobActiva,
      desempleadosActivos: desActivos,
      tasaDesempleo,
      saturacion: saturacionActiva,
      proporcionMujeresNacional,
      tendenciaEtiqueta: tendencia.etiqueta,
      tendenciaCodigo: tendencia.codigo,
      isStem: carreraEsStem,
      usandoFallbackNacional: fallbackNacional,
      comparativaRegiones,
      serieAnualReal
    };

    return {
      chartData: dataArray,
      ticksEjeY: ticks5k,
      maxTickY: techo5k,
      nombreLineaActiva: etiquetaLinea,
      isStem: carreraEsStem,
      resumen: statsObj,
      usandoFallbackNacional: fallbackNacional,
      muestraModeradaAviso: pobActiva > 0 && pobActiva < 25000
    };
  }, [rawData, regionActiva, modoGenero, firmaKish]);

  useEffect(() => {
    if (!loading && onStatsChange && resumen.sueldoActivo > 0) {
      const firmaActual = JSON.stringify({
        s: resumen.sueldoActivo,
        sn: resumen.sueldoNacionalBase,
        sp: resumen.sueldoPrepaActivo,
        pob: resumen.poblacionActiva,
        des: resumen.desempleadosActivos,
        sat: Math.round(resumen.saturacion),
        reg: resumen.comparativaRegiones.map(r => r.sueldoCarrera),
        ser: resumen.serieAnualReal.map(x => x.sueldoLic)
      });
      if (ultimaFirmaEmitidaRef.current !== firmaActual) {
        ultimaFirmaEmitidaRef.current = firmaActual;
        onStatsChange(resumen);
      }
    }
  }, [loading, resumen, onStatsChange]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4 pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                Evolución Salarial Real vs. Preparatoria (2021–2026)
              </h2>
              {isStem && (
                <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                  <Microscope className="w-3 h-3" /> STEM
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ingreso mensual en pesos constantes de 2026 frente al salario base observado de bachillerato en la misma zona y perfil.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {resumen.tendenciaCodigo === 'crecimiento' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <TrendingUp className="w-3.5 h-3.5" /> Tendencia Real: En crecimiento
              </span>
            )}
            {resumen.tendenciaCodigo === 'estable' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Minus className="w-3.5 h-3.5" /> Tendencia Real: Estable
              </span>
            )}
            {resumen.tendenciaCodigo === 'ajuste' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <TrendingDown className="w-3.5 h-3.5" /> Tendencia Real: En ajuste
              </span>
            )}
            {resumen.tendenciaCodigo === 'volatil' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Activity className="w-3.5 h-3.5" /> Tendencia Real: Volátil
              </span>
            )}
          </div>
        </div>

        {usandoFallbackNacional && !loading && (
          <div className="mb-3 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              <strong>Serie estabilizada:</strong> Muestra regional anual acotada; se muestra la trayectoria consolidada Nacional.
            </span>
          </div>
        )}
      </div>

      <div className="h-72 md:h-80 w-full relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600 mb-2" />
            <p className="text-xs text-slate-500 font-medium">Procesando serie histórica...</p>
          </div>
        )}

        {chartData.length > 0 && !loading ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="anio"
                minTickGap={15}
                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <YAxis
                domain={[0, maxTickY]}
                ticks={ticksEjeY}
                tickFormatter={formatoTickExacto5k}
                width={46}
                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px', fontWeight: 700 }} />

              <Line
                type="monotone"
                dataKey="Base Preparatoria"
                stroke="#F59E0B"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 3, strokeWidth: 1.5, fill: '#FEF3C7' }}
                name="Base Preparatoria (Real 2021–2026)"
                connectNulls={false}
              />

              <Line
                type="monotone"
                dataKey={nombreLineaActiva}
                stroke="#2563EB"
                strokeWidth={3.5}
                dot={{ r: 4, strokeWidth: 2, fill: '#FFFFFF' }}
                activeDot={{ r: 6, stroke: '#2563EB', strokeWidth: 2 }}
                name={nombreLineaActiva}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          !loading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300 p-6 text-center">
              <AlertCircle className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Sin registros salariales para este filtro</p>
            </div>
          )
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {muestraModeradaAviso
            ? 'Nota: Carrera de nicho (< 25,000 ocupados); trayectoria estabilizada mediante credibilidad actuarial.'
            : 'Series deflactadas a pesos constantes mediante el Índice Nacional de Precios al Consumidor (INPC).'}
        </span>
        <span>Consolidado actual: Cierre 2025–2026</span>
      </div>
    </div>
  );
}