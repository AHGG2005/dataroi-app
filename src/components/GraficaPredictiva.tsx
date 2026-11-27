"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  REGIONES_ORDEN,
  ESTADOS_POR_REGION,
  EVENTO_DATOS_ACTUALIZADOS,
  META_PIPELINE_FALLBACK,
  BenchmarksPrepaMap,
  MetaPipelineInfo,
  CodigoGenero,
  RegionClave,
  cargarBenchmarksPrepaRows,
  cargarSatelitesPrepaRows,
  cargarMetaPipeline,
  construirBenchmarksPrepaMap,
  calcularVentanasTemporales,
  calcularSueldoConsolidadoCelda,
  clasificarTendenciaRealDinamica,
  descargarTodoPaginado,
  normalizarRegion,
  numSeguro
} from '@/lib/dataroiEngine';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Activity, Loader2, MapPin,
  Microscope, AlertCircle, Info
} from 'lucide-react';

export { ESTADOS_POR_REGION };
export type ModoGeneroEstricto = 'total' | 'mujeres' | 'hombres';

const formatoMoneda = (valor: any) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(valor) || 0);

const formatoTickExacto5k = (valor: any) => {
  const n = Number(valor) || 0;
  if (n === 0) return '$0';
  return `$${Math.round(n / 1000)}k`;
};

const CustomTooltip = ({ active, payload, label, etiquetaPesos }: any) => {
  if (active && payload && payload.length) {
    const itemLic = payload.find((p: any) => !String(p.name).includes('Preparatoria'));
    const itemPrepa = payload.find((p: any) => String(p.name).includes('Preparatoria'));
    const valLic = Number(itemLic?.value || 0);
    const valPrepa = Number(itemPrepa?.value || 0);
    const diffMes = valLic - valPrepa;
    const primaPct = valPrepa > 0 && valLic > 0 ? Math.round((diffMes / valPrepa) * 100) : null;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md p-3.5 border border-slate-700 shadow-2xl rounded-2xl z-50 min-w-[235px] text-white">
        <p className="font-black text-slate-300 mb-2 border-b border-slate-700/80 pb-1.5 text-xs uppercase tracking-wider flex items-center justify-between gap-2">
          <span>Corte ENOE {label}</span>
          <span className="text-[10px] font-bold text-blue-400">{etiquetaPesos}</span>
        </p>
        {payload.map((entry: any, index: number) => {
          if (entry.value == null) return null;
          const esPrepa = String(entry.name).includes('Preparatoria');
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
                  style={{ backgroundColor: entry.color || (esPrepa ? '#F59E0B' : '#2563EB') }}
                />
                {esPrepa ? 'Base Preparatoria:' : 'Salario Licenciatura:'}
              </span>
              <span className="font-black">{formatoMoneda(entry.value)}</span>
            </div>
          );
        })}

        {primaPct !== null && (
          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-semibold">Prima Universitaria:</span>
            <span className={`font-black px-2 py-0.5 rounded-md ${
              diffMes >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {diffMes >= 0 ? `+${formatoMoneda(diffMes)} (+${primaPct}%)` : `${formatoMoneda(diffMes)} (${primaPct}%)`}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export interface SueldoRegionalItem {
  region: string;
  sueldoCarrera: number;
  sueldoPrepa: number;
  formalidadPrepaPct: number;
  premioPct: number;
  pea: number;
  tasaDesempleo: number;
  saturacion: number;
  tendenciaCodigo: 'crecimiento' | 'estable' | 'ajuste' | 'volatil';
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
  rangoAniosTexto?: string;
  cierreTexto?: string;
  etiquetaCorte?: string;
  etiquetaPesosBase?: string;
}

export default function GraficaPredictiva({
  cve_carrera,
  regionActiva = 'nacional',
  modoGenero = 'total',
  benchmarksPrepaExterno,
  metaPipelineExterno,
  onStatsChange
}: {
  cve_carrera: string;
  regionActiva?: string;
  modoGenero?: ModoGeneroEstricto;
  mapaKishPorRegion?: Record<string, number>;
  benchmarksPrepaExterno?: BenchmarksPrepaMap | null;
  metaPipelineExterno?: MetaPipelineInfo | null;
  onStatsChange?: (stats: ResumenMercadoRegion) => void;
}) {
  const [rawData, setRawData] = useState<any[]>([]);
  const [prepaMapLocal, setPrepaMapLocal] = useState<BenchmarksPrepaMap | null>(null);
  const [metaLocal, setMetaLocal] = useState<MetaPipelineInfo>(META_PIPELINE_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const ultimaFirmaEmitidaRef = useRef<string>('');

  useEffect(() => {
    const onDataUpdated = () => setReloadTick(t => t + 1);
    window.addEventListener(EVENTO_DATOS_ACTUALIZADOS, onDataUpdated);
    return () => window.removeEventListener(EVENTO_DATOS_ACTUALIZADOS, onDataUpdated);
  }, []);

  useEffect(() => {
    let cancelado = false;
    async function fetchPredicciones() {
      setLoading(true);
      const cveSinCero = String(Number(cve_carrera));

      const [predRows, prepaRows, satPrepaRows, metaInfo] = await Promise.all([
        descargarTodoPaginado(() =>
          supabase
            .from('predicciones_roi')
            .select(`
              anio, cve_ent, sexo, is_stem, poblacion_activa_total, desempleados_reales,
              indice_saturacion_pct, sueldo_promedio_mensual, tipo_dato
            `)
            .in('cve_carrera', [cve_carrera, cveSinCero])
            .eq('tipo_dato', 'Real')
            .order('anio', { ascending: true })
            .order('cve_ent', { ascending: true })
            .order('sexo', { ascending: true })
        ),
        benchmarksPrepaExterno ? Promise.resolve(null) : cargarBenchmarksPrepaRows(supabase),
        benchmarksPrepaExterno ? Promise.resolve(null) : cargarSatelitesPrepaRows(supabase),
        metaPipelineExterno ? Promise.resolve(metaPipelineExterno) : cargarMetaPipeline(supabase)
      ]);

      if (cancelado) return;

      const datosLimpios = (predRows || []).map((row: any) => ({
        ...row,
        cve_ent: normalizarRegion(row.cve_ent),
        sexo: Number(row.sexo ?? 0),
        anio: Number(row.anio)
      }));

      setRawData(datosLimpios);
      setMetaLocal(metaInfo);

      if (prepaRows) {
        const ventanasPre = calcularVentanasTemporales(
          datosLimpios.map(r => r.anio),
          metaInfo
        );
        setPrepaMapLocal(construirBenchmarksPrepaMap(prepaRows, ventanasPre, satPrepaRows || undefined));
      }

      setLoading(false);
    }
    fetchPredicciones();
    return () => {
      cancelado = true;
    };
  }, [cve_carrera, reloadTick, benchmarksPrepaExterno, metaPipelineExterno]);

  const metaActiva = metaPipelineExterno || metaLocal;
  const benchPrepaMapActivo = benchmarksPrepaExterno || prepaMapLocal;

  const {
    chartData,
    ticksEjeY,
    maxTickY,
    nombreLineaActiva,
    isStem,
    resumen,
    usandoFallbackNacional,
    muestraModeradaAviso,
    ventanas
  } = useMemo(() => {
    const targetSexo: CodigoGenero = modoGenero === 'hombres' ? 1 : modoGenero === 'mujeres' ? 2 : 0;
    const regNorm: RegionClave = normalizarRegion(regionActiva);
    const v = calcularVentanasTemporales(rawData.map(r => r.anio), metaActiva);

    const obtenerPrepaZona = (zona: RegionClave, sx: CodigoGenero) => {
      const regData = benchPrepaMapActivo?.[zona] || benchPrepaMapActivo?.nacional;
      if (regData) {
        return {
          sueldo: regData.sueldo_prepa[sx] || regData.sueldo_prepa[0] || 0,
          formalidad: regData.formalidad_prepa_pct[sx] || regData.formalidad_prepa_pct[0] || 0,
          historico: regData.historico_por_sexo[sx] || regData.historico_por_sexo[0] || {}
        };
      }
      return { sueldo: 0, formalidad: 0, historico: {} as Record<number, number> };
    };

    const extraerSerieZona = (zona: RegionClave, sx: CodigoGenero) => {
      const directas = rawData.filter(r => r.cve_ent === zona && r.sexo === sx);
      if (directas.length > 0) return directas;
      if (sx === 0) {
        return rawData.filter(r => r.cve_ent === zona && (r.sexo === 1 || r.sexo === 2));
      }
      return [];
    };

    const filasNac = extraerSerieZona('nacional', targetSexo);
    const sueldoNacionalBase = calcularSueldoConsolidadoCelda(filasNac, v);

    const filasNacEmp = filasNac.filter(r => v.aniosEmpleo.includes(r.anio));
    const loteNacEmp = filasNacEmp.length > 0 ? filasNacEmp : filasNac;
    const sumaPeaNac = loteNacEmp.reduce((a, b) => a + numSeguro(b.poblacion_activa_total, 0), 0);
    const sumaDesNac = loteNacEmp.reduce((a, b) => a + numSeguro(b.desempleados_reales, 0), 0);
    const desempleoNacionalBase = sumaPeaNac > 0 ? Math.max(0.8, (sumaDesNac / sumaPeaNac) * 100) : 3.2;

    const filasNacConSat = filasNac.filter(r => numSeguro(r.indice_saturacion_pct, 0) > 5);
    const saturacionNacionalBase = filasNacConSat.length > 0
      ? filasNacConSat.reduce((acc, c) => acc + numSeguro(c.indice_saturacion_pct, 92), 0) / filasNacConSat.length
      : 92;

    const tendenciaNacionalBase = clasificarTendenciaRealDinamica(filasNac, v);

    const comparativaRegiones: SueldoRegionalItem[] = REGIONES_ORDEN.map(zona => {
      const serieZ = extraerSerieZona(zona, targetSexo);
      const serieZEmp = serieZ.filter(r => v.aniosEmpleo.includes(r.anio));
      const lotePeaZ = serieZEmp.length > 0 ? serieZEmp : serieZ;

      const peaZ = lotePeaZ.length > 0
        ? Math.round(lotePeaZ.reduce((acc, c) => acc + numSeguro(c.poblacion_activa_total, 0), 0) / lotePeaZ.length)
        : 0;

      const sumaPeaZ = lotePeaZ.reduce((acc, c) => acc + numSeguro(c.poblacion_activa_total, 0), 0);
      const sumaDesZ = lotePeaZ.reduce((acc, c) => acc + numSeguro(c.desempleados_reales, 0), 0);
      const tasaDesempleoZ = sumaPeaZ > 0 ? Math.max(0.8, (sumaDesZ / sumaPeaZ) * 100) : desempleoNacionalBase;

      const filaRecZ = serieZ.find(r => r.anio === v.anioMax) || serieZ[serieZ.length - 1];
      const satRawZ = numSeguro(filaRecZ?.indice_saturacion_pct, 0);
      const saturacionZ = satRawZ > 5 ? satRawZ : saturacionNacionalBase;

      const tendenciaZ = serieZ.length >= 4
        ? clasificarTendenciaRealDinamica(serieZ, v)
        : tendenciaNacionalBase;

      const sueldoObsZ = calcularSueldoConsolidadoCelda(serieZ, v, 0);
      const sinMuestraRegional = zona !== 'nacional' && (sueldoObsZ <= 0 || serieZ.length === 0);
      const sueldoZ = sueldoObsZ > 0 ? sueldoObsZ : sueldoNacionalBase;

      const prepaZObj = obtenerPrepaZona(zona, targetSexo);
      const prepaZ = prepaZObj.sueldo;
      const premioZ = prepaZ > 0 && sueldoZ > 0
        ? Number((((sueldoZ - prepaZ) / prepaZ) * 100).toFixed(1))
        : 0;

      return {
        region: zona,
        sueldoCarrera: sueldoZ,
        sueldoPrepa: prepaZ,
        formalidadPrepaPct: prepaZObj.formalidad,
        premioPct: premioZ,
        pea: peaZ,
        tasaDesempleo: Number(tasaDesempleoZ.toFixed(1)),
        saturacion: Math.round(saturacionZ),
        tendenciaCodigo: tendenciaZ.codigo,
        sinMuestraRegional
      };
    });

    const nacH = extraerSerieZona('nacional', 1).filter(r => v.aniosEmpleo.includes(r.anio));
    const nacM = extraerSerieZona('nacional', 2).filter(r => v.aniosEmpleo.includes(r.anio));
    const pobNacH = nacH.reduce((a, b) => a + numSeguro(b.poblacion_activa_total, 0), 0);
    const pobNacM = nacM.reduce((a, b) => a + numSeguro(b.poblacion_activa_total, 0), 0);
    const proporcionMujeresNacional = (pobNacH + pobNacM) > 0 ? pobNacM / (pobNacH + pobNacM) : 0.5;

    let filasCandidatas = extraerSerieZona(regNorm, targetSexo);
    let fallbackNacional = false;

    if (regNorm !== 'nacional' && filasCandidatas.filter(r => numSeguro(r.sueldo_promedio_mensual, 0) > 0).length < 3) {
      filasCandidatas = filasNac;
      fallbackNacional = true;
    }

    const prepaActivaObj = obtenerPrepaZona(regNorm, targetSexo);
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

    v.aniosOrdenados.forEach(a => {
      porAnio[a] = {
        anio: a,
        sueldoProd: 0, pobConSueldo: 0, pobTotal: 0, desTotal: 0, satProd: 0, pobConSat: 0,
        isStem: false
      };
    });

    filasCandidatas.forEach(row => {
      const a = Number(row.anio);
      if (!porAnio[a]) return;

      if (row.is_stem) porAnio[a].isStem = true;
      const pobReal = numSeguro(row.poblacion_activa_total, 0);
      const des = numSeguro(row.desempleados_reales, 0);
      const sat = numSeguro(row.indice_saturacion_pct, 0);
      const sueldo = numSeguro(row.sueldo_promedio_mensual, 0);

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
        const prepaAnio = prepaActivaObj.historico[item.anio] ?? (prepaActivaObj.sueldo > 0 ? prepaActivaObj.sueldo : null);

        if (sueldoAnio && sueldoAnio > maxValGrafica) maxValGrafica = sueldoAnio;
        if (prepaAnio && prepaAnio > maxValGrafica) maxValGrafica = prepaAnio;

        return {
          anio: item.anio,
          [etiquetaLinea]: sueldoAnio,
          'Base Preparatoria': prepaAnio,
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

    const tendencia = clasificarTendenciaRealDinamica(
      dataArray.map(d => ({ anio: d.anio, sueldo: d[etiquetaLinea] })),
      v
    );

    const techo5k = Math.max(25000, Math.ceil((maxValGrafica + 1500) / 5000) * 5000);
    const ticks5k: number[] = [];
    for (let t = 0; t <= techo5k; t += 5000) {
      ticks5k.push(t);
    }

    const itemRegionActiva = comparativaRegiones.find(c => c.region === regNorm);
    const puntosVentana = dataArray.filter(d => v.aniosEmpleo.includes(d.anio) && d._pob > 0);
    const loteConsolidado = puntosVentana.length > 0 ? puntosVentana : dataArray.filter(d => d._pob > 0);

    const sueldoActivo = itemRegionActiva?.sueldoCarrera || sueldoNacionalBase;
    const sueldoPrepaActivo = itemRegionActiva?.sueldoPrepa || prepaActivaObj.sueldo;
    const premioVsPrepaPct = itemRegionActiva?.premioPct || 0;
    const gananciaAnualExtra = (sueldoActivo - sueldoPrepaActivo) * 12;

    const pobActiva = loteConsolidado.length > 0
      ? Math.round(loteConsolidado.reduce((acc, d) => acc + d._pob, 0) / loteConsolidado.length)
      : 0;
    const sumaPea = loteConsolidado.reduce((acc, d) => acc + d._pob, 0);
    const sumaDes = loteConsolidado.reduce((acc, d) => acc + d._des, 0);
    const tasaDesempleo = sumaPea > 0 ? Math.max(0.8, (sumaDes / sumaPea) * 100) : 3.2;
    const desActivos = Math.round(pobActiva * (tasaDesempleo / 100));

    const puntoReciente = dataArray.find(d => d.anio === v.anioMax) || dataArray[dataArray.length - 1];
    const saturacionActiva = puntoReciente?._sat > 5 ? puntoReciente._sat : saturacionNacionalBase;

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
      serieAnualReal,
      rangoAniosTexto: v.rangoTexto,
      cierreTexto: v.cierreTexto,
      etiquetaCorte: metaActiva.etiqueta_corte,
      etiquetaPesosBase: metaActiva.etiqueta_pesos_base
    };

    return {
      chartData: dataArray,
      ticksEjeY: ticks5k,
      maxTickY: techo5k,
      nombreLineaActiva: etiquetaLinea,
      isStem: carreraEsStem,
      resumen: statsObj,
      usandoFallbackNacional: fallbackNacional,
      muestraModeradaAviso: pobActiva > 0 && pobActiva < 25000,
      ventanas: v
    };
  }, [rawData, regionActiva, modoGenero, benchPrepaMapActivo, metaActiva]);

  useEffect(() => {
    if (!loading && onStatsChange && resumen.sueldoActivo > 0) {
      const firmaActual = JSON.stringify({
        s: resumen.sueldoActivo,
        sn: resumen.sueldoNacionalBase,
        sp: resumen.sueldoPrepaActivo,
        pob: resumen.poblacionActiva,
        des: resumen.desempleadosActivos,
        sat: Math.round(resumen.saturacion),
        corte: resumen.etiquetaCorte,
        reg: resumen.comparativaRegiones.map(r => `${r.sueldoCarrera}_${r.sueldoPrepa}_${r.formalidadPrepaPct}_${r.tasaDesempleo}_${r.saturacion}_${r.tendenciaCodigo}`),
        ser: resumen.serieAnualReal.map(x => `${x.anio}_${x.sueldoLic}_${x.sueldoPrepa}`)
      });
      if (ultimaFirmaEmitidaRef.current !== firmaActual) {
        ultimaFirmaEmitidaRef.current = firmaActual;
        onStatsChange(resumen);
      }
    }
  }, [loading, resumen, onStatsChange]);

  return (
    <div className="bg-gradient-to-b from-white via-white to-slate-50/70 rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 h-full flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4 pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                Evolución Salarial Real vs. Preparatoria ({ventanas.rangoTexto})
              </h2>
              {isStem && (
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                  <Microscope className="w-3 h-3" /> STEM
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              El área sombreada azul representa la prima salarial acumulada sobre el ingreso base de bachillerato ({metaActiva.etiqueta_pesos_base}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {resumen.tendenciaCodigo === 'crecimiento' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
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
            <ComposedChart data={chartData} margin={{ top: 12, right: 18, left: 2, bottom: 5 }}>
              <defs>
                <linearGradient id="gradienteSalarioLic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} />
                  <stop offset="65%" stopColor="#3B82F6" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.0} />
                </linearGradient>
                <filter id="sombraCurvaLic" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2563EB" floodOpacity="0.22" />
                </filter>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="anio"
                minTickGap={15}
                tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
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
              <Tooltip
                content={<CustomTooltip etiquetaPesos={metaActiva.etiqueta_pesos_base} />}
                cursor={{ stroke: '#94A3B8', strokeWidth: 1.5, strokeDasharray: '4 4' }}
              />
              <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px', fontWeight: 700 }} />

              <Area
                type="monotone"
                dataKey={nombreLineaActiva}
                stroke="#2563EB"
                strokeWidth={3.5}
                fillOpacity={1}
                fill="url(#gradienteSalarioLic)"
                filter="url(#sombraCurvaLic)"
                dot={{ r: 4.5, strokeWidth: 2.2, stroke: '#2563EB', fill: '#FFFFFF' }}
                activeDot={{ r: 7, stroke: '#FFFFFF', strokeWidth: 2.5, fill: '#2563EB' }}
                name={nombreLineaActiva}
                connectNulls
              />

              <Line
                type="monotone"
                dataKey="Base Preparatoria"
                stroke="#F59E0B"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 3.5, strokeWidth: 1.8, stroke: '#D97706', fill: '#FEF3C7' }}
                activeDot={{ r: 5.5, stroke: '#FFFFFF', strokeWidth: 2, fill: '#F59E0B' }}
                name={`Base Preparatoria (Real ${ventanas.rangoTexto})`}
                connectNulls={false}
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
            ? 'Nota: Carrera de nicho (< 25,000 ocupados); trayectoria estabilizada actuarialmente desde el ETL.'
            : 'Series deflactadas a pesos constantes mediante el Índice Nacional de Precios al Consumidor (INPC).'}
        </span>
        <span>Consolidado actual: Cierre {ventanas.cierreTexto} ({metaActiva.etiqueta_corte})</span>
      </div>
    </div>
  );
}