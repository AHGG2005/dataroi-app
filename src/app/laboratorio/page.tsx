"use client";

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  descargarLibroExcelXLSX,
  descargarCSVEstilizado,
  calcularScoreDataROIUniversal,
  obtenerSemaforoScoreDataROI,
  formatearNombreCarreraEjecutivo,
  leerEstadoDescubridorGlobal,
  toggleCarreraComparadorGlobal,
  EVENTO_VERSUS_SYNC,
  ValorCeldaExcel
} from '@/lib/excelReportGenerator';
import {
  REGIONES_ORDEN,
  REGIONES_META,
  EVENTO_DATOS_ACTUALIZADOS,
  META_PIPELINE_FALLBACK,
  CodigoGenero,
  RegionClave,
  DimCarreraRow,
  BenchmarkPrepaRow,
  MetaPipelineInfo,
  cargarCatalogoCarreras,
  cargarBenchmarksPrepaRows,
  cargarMetaPipeline,
  construirBenchmarksPrepaMap,
  calcularVentanasTemporales,
  calcularSueldoConsolidadoCelda,
  clasificarTendenciaRealDinamica,
  calcularIndicadoresSatelite,
  calcularPercentil,
  descargarTodoPaginado,
  esCeldaSateliteValida,
  normalizarRegion,
  padCve,
  numSeguro
} from '@/lib/dataroiEngine';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import {
  FlaskConical, Search, Microscope, ArrowUpDown, Download,
  FileSpreadsheet, MapPin, Users, ChevronRight,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Sparkles, Filter,
  Info, Crosshair, X
} from 'lucide-react';

type FiltroCuadrante = 'todos' | 'q1_sup_izq' | 'q2_sup_der' | 'q3_inf_izq' | 'q4_inf_der';

const COLORES_SLOTS_VERSUS = [
  { hex: '#2563EB', btnClass: 'bg-blue-600 text-white border-blue-600 shadow-xs' },
  { hex: '#9333EA', btnClass: 'bg-purple-600 text-white border-purple-600 shadow-xs' },
  { hex: '#EA580C', btnClass: 'bg-orange-600 text-white border-orange-600 shadow-xs' }
];

interface VariableCrudaMeta {
  id: string;
  nombre: string;
  corto: string;
  unidad: 'MXN' | '%' | 'estrato' | 'hrs' | 'personas';
  mejorAlto: boolean;
  pasoInterpretacion: number;
  descripcion: string;
}

const CATALOGO_VARIABLES_CRUDAS: VariableCrudaMeta[] = [
  { id: 'sueldo_mensual', nombre: 'Salario Mensual Consolidado (MXN)', corto: 'Salario Mensual', unidad: 'MXN', mejorAlto: true, pasoInterpretacion: 1000, descripcion: 'Ingreso mensual promedio observado en microdatos ENOE (pesos constantes del corte activo).' },
  { id: 'prima_prepa_pct', nombre: 'Prima Salarial vs. Preparatoria (%)', corto: 'Prima vs. Prepa', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Diferencial porcentual del salario universitario sobre el sueldo base de bachillerato en la región.' },
  { id: 'calidad_oit_pct', nombre: 'Empleo de Calidad Estándar OIT (%)', corto: 'Calidad OIT', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Porcentaje de ocupados con contrato escrito y fondo de retiro AFORE sin pluriempleo.' },
  { id: 'formalidad_pct', nombre: 'Formalidad Laboral Total (%)', corto: 'Formalidad Total', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Índice compuesto de cobertura formal (contrato escrito, aguinaldo de ley y AFORE).' },
  { id: 'tasa_desempleo', nombre: 'Tasa de Desempleo Abierto (%)', corto: 'Desempleo Abierto', unidad: '%', mejorAlto: false, pasoInterpretacion: 1, descripcion: 'Porcentaje de la PEA universitaria activa que se encuentra desocupada buscando trabajo.' },
  { id: 'saturacion_pct', nombre: 'Índice de Saturación ANUIES (%)', corto: 'Saturación ANUIES', unidad: '%', mejorAlto: false, pasoInterpretacion: 20, descripcion: 'Presión de egresados frente a las plazas laborales disponibles en el mercado.' },
  { id: 'riesgo_ia_score', nombre: 'Riesgo de Automatización por IA (%)', corto: 'Riesgo IA', unidad: '%', mejorAlto: false, pasoInterpretacion: 10, descripcion: 'Porcentaje de tareas de la profesión susceptibles de reemplazo algorítmico.' },
  { id: 'blindaje_ia_pct', nombre: 'Blindaje Humano ante IA (%)', corto: 'Blindaje IA', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Nivel de resiliencia humana frente a la automatización por Inteligencia Artificial.' },
  { id: 'indice_privilegio', nombre: 'Índice de Privilegio / Estrato Origen (1–4)', corto: 'Estrato Origen', unidad: 'estrato', mejorAlto: false, pasoInterpretacion: 0.5, descripcion: 'Estrato socioeconómico promedio del hogar de origen en escala INEGI de 1.0 a 4.0.' },
  { id: 'pct_nepotismo', nombre: 'Ingreso por Redes Familiares / Nepotismo (%)', corto: 'Nepotismo', unidad: '%', mejorAlto: false, pasoInterpretacion: 10, descripcion: 'Porcentaje de profesionistas que consiguieron su empleo mediante familiares o conocidos.' },
  { id: 'pct_contrato', nombre: 'Cobertura de Contrato Escrito (%)', corto: 'Contrato Escrito', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Porcentaje de ocupados subordinados que cuentan con contrato escrito estable.' },
  { id: 'pct_aguinaldo', nombre: 'Cobertura de Aguinaldo de Ley (%)', corto: 'Aguinaldo', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Porcentaje de ocupados que reciben aguinaldo anual conforme a la ley.' },
  { id: 'pct_afore', nombre: 'Cobertura de Fondo de Retiro AFORE (%)', corto: 'Fondo AFORE', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Porcentaje de ocupados con cotización activa para pensión o retiro (SAR/AFORE).' },
  { id: 'pct_sgmm', nombre: 'Seguro de Gastos Médicos Mayores (%)', corto: 'Seguro SGMM', unidad: '%', mejorAlto: true, pasoInterpretacion: 5, descripcion: 'Porcentaje de ocupados con prestación de seguro médico privado pagado por el empleador.' },
  { id: 'pct_sindicato', nombre: 'Afiliación Sindical o Gremial (%)', corto: 'Sindicalización', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Porcentaje de profesionistas afiliados a un sindicato o colegio gremial.' },
  { id: 'pct_materno', nombre: 'Protección Materna / Paterna (%)', corto: 'Lic. Parental', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Porcentaje con acceso efectivo a incapacidad y licencia por maternidad o paternidad.' },
  { id: 'pct_corp', nombre: 'Inserción en Grandes Corporativos (%)', corto: 'Gran Corporativo', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Porcentaje que labora en empresas grandes y corporativos (>100 empleados).' },
  { id: 'pct_pyme', nombre: 'Inserción en Sector PYME (%)', corto: 'Sector PYME', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Porcentaje que ejerce en pequeñas y medianas empresas (6 a 100 empleados).' },
  { id: 'pct_micro', nombre: 'Práctica Independiente y Microempresa (%)', corto: 'Independiente / Micro', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Porcentaje en consultorio propio, despacho independiente, freelance o microempresa.' },
  { id: 'pct_gobierno', nombre: 'Administración Pública y Gobierno (%)', corto: 'Sector Gobierno', unidad: '%', mejorAlto: true, pasoInterpretacion: 10, descripcion: 'Porcentaje que labora en instituciones gubernamentales y sector público.' },
  { id: 'pct_home_office', nombre: 'Trabajo Remoto / Home Office (%)', corto: 'Home Office', unidad: '%', mejorAlto: true, pasoInterpretacion: 5, descripcion: 'Porcentaje comprobado que ejerce en modalidad remota o teletrabajo.' },
  { id: 'pct_pluriempleo', nombre: 'Tasa de Pluriempleo / Segundo Trabajo (%)', corto: 'Pluriempleo', unidad: '%', mejorAlto: false, pasoInterpretacion: 5, descripcion: 'Porcentaje que requiere tener dos o más empleos simultáneos.' },
  { id: 'pct_desarraigo', nombre: 'Migración Forzada / Desarraigo (%)', corto: 'Desarraigo', unidad: '%', mejorAlto: false, pasoInterpretacion: 5, descripcion: 'Porcentaje que tuvo que emigrar de su entidad federativa para poder ejercer.' },
  { id: 'hrs_hogar', nombre: 'Trabajo Doméstico No Remunerado (Hrs/sem)', corto: 'Hrs. Hogar', unidad: 'hrs', mejorAlto: false, pasoInterpretacion: 5, descripcion: 'Horas semanales dedicadas a labores domésticas y de cuidado no remuneradas.' }
];

const PRESETS_CORRELACION = [
  { label: '🎓 Estrato vs. Salario', x: 'indice_privilegio', y: 'sueldo_mensual' },
  { label: '🤖 IA vs. Salario', x: 'riesgo_ia_score', y: 'sueldo_mensual' },
  { label: '🏥 SGMM vs. Salario', x: 'pct_sgmm', y: 'sueldo_mensual' },
  { label: '🤝 Nepotismo vs. OIT', x: 'pct_nepotismo', y: 'calidad_oit_pct' },
  { label: '📈 Saturación vs. Desemp.', x: 'saturacion_pct', y: 'tasa_desempleo' },
  { label: '🏠 Remoto vs. Salario', x: 'pct_home_office', y: 'sueldo_mensual' }
];

const formatoMoneda = (valor: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor || 0);

function formatearValorVariable(val: number, unidad: VariableCrudaMeta['unidad']): string {
  if (!Number.isFinite(val)) return 'N/D';
  if (unidad === 'MXN') return formatoMoneda(val);
  if (unidad === 'estrato') return `${val.toFixed(2)} / 4`;
  if (unidad === 'hrs') return `${val.toFixed(1)} hrs`;
  if (unidad === 'personas') return Math.round(val).toLocaleString('es-MX');
  return `${val.toFixed(1)}%`;
}

function formatearTickEje(val: number, unidad: VariableCrudaMeta['unidad']): string {
  if (!Number.isFinite(val)) return '';
  if (unidad === 'MXN') {
    if (Math.abs(val) >= 1000) {
      const k = val / 1000;
      return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
    }
    return `$${Math.round(val)}`;
  }
  if (unidad === 'estrato') return val.toFixed(1);
  if (unidad === 'hrs') return `${Math.round(val)}h`;
  if (unidad === 'personas') return `${Math.round(val / 1000)}k`;
  return `${Math.round(val)}%`;
}

function formatearDiferencialMedia(diff: number, unidad: VariableCrudaMeta['unidad']): string {
  if (!Number.isFinite(diff)) return '0';
  const signo = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const absVal = Math.abs(diff);
  if (unidad === 'MXN') return `${signo}${formatoMoneda(absVal)}`;
  if (unidad === 'estrato') return `${signo}${absVal.toFixed(2)} pts`;
  if (unidad === 'hrs') return `${signo}${absVal.toFixed(1)} hrs`;
  if (unidad === 'personas') return `${signo}${Math.round(absVal).toLocaleString('es-MX')}`;
  return `${signo}${absVal.toFixed(1)}%`;
}

function calcularRegresionLinealOLS(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) {
    return { r: 0, r2Pct: 0, slope: 0, intercept: 0, minX: 0, maxX: 1 };
  }
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  const r = den > 0 ? Number((num / den).toFixed(2)) : 0;
  const slope = denX > 0 ? num / denX : 0;
  const intercept = meanY - slope * meanX;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  return {
    r,
    r2Pct: Math.round(r * r * 100),
    slope,
    intercept,
    minX,
    maxX
  };
}

function LaboratorioContenido() {
  const [regionActiva, setRegionActiva] = useState<RegionClave>('nacional');
  const [generoActivo, setGeneroActivo] = useState<CodigoGenero>(0);
  const [busquedaTabla, setBusquedaTabla] = useState<string>('');
  const [carreraDestacadaCve, setCarreraDestacadaCve] = useState<string>('');
  const [soloStem, setSoloStem] = useState<boolean>(false);
  const [filtroCuadrante, setFiltroCuadrante] = useState<FiltroCuadrante>('todos');

  const [varRankingId, setVarRankingId] = useState<string>('sueldo_mensual');
  const [ordenDesc, setOrdenDesc] = useState<boolean>(true);
  const [mostrarTodasTabla, setMostrarTodasTabla] = useState<boolean>(false);

  const [ejeXId, setEjeXId] = useState<string>('indice_privilegio');
  const [ejeYId, setEjeYId] = useState<string>('sueldo_mensual');

  const [carrerasRaw, setCarrerasRaw] = useState<DimCarreraRow[]>([]);
  const [satelitesRaw, setSatelitesRaw] = useState<any[]>([]);
  const [seriesRaw, setSeriesRaw] = useState<any[]>([]);
  const [prepaRows, setPrepaRows] = useState<BenchmarkPrepaRow[]>([]);
  const [metaPipeline, setMetaPipeline] = useState<MetaPipelineInfo>(META_PIPELINE_FALLBACK);
  const [loading, setLoading] = useState<boolean>(true);
  const [reloadTick, setReloadTick] = useState<number>(0);
  const [cvesVersus, setCvesVersus] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      const nueva = leerEstadoDescubridorGlobal().carrerasCompararCves || [];
      setCvesVersus(prev => (prev.join(',') === nueva.join(',') ? prev : nueva));
    };
    const onDataUpdated = () => setReloadTick(t => t + 1);
    sync();
    window.addEventListener(EVENTO_VERSUS_SYNC, sync);
    window.addEventListener(EVENTO_DATOS_ACTUALIZADOS, onDataUpdated);
    return () => {
      window.removeEventListener(EVENTO_VERSUS_SYNC, sync);
      window.removeEventListener(EVENTO_DATOS_ACTUALIZADOS, onDataUpdated);
    };
  }, []);

  const handleToggleComparar = (cve: string) => {
    const nueva = toggleCarreraComparadorGlobal(cve);
    setCvesVersus(nueva);
  };

  useEffect(() => {
    let cancelado = false;
    async function cargarDatosCrudos() {
      setLoading(true);
      const [resCar, resMeta, resPrepa, resSat, resSer] = await Promise.all([
        cargarCatalogoCarreras(supabase),
        cargarMetaPipeline(supabase),
        cargarBenchmarksPrepaRows(supabase),
        descargarTodoPaginado(() =>
          supabase
            .from('satelites_cultura')
            .select('*')
            .order('cve_carrera', { ascending: true })
            .order('region', { ascending: true })
            .order('sexo', { ascending: true })
        ),
        descargarTodoPaginado(() =>
          supabase
            .from('predicciones_roi')
            .select('cve_carrera, cve_ent, anio, sexo, poblacion_activa_total, desempleados_reales, sueldo_promedio_mensual, indice_saturacion_pct, is_stem, tipo_dato')
            .eq('tipo_dato', 'Real')
            .order('cve_carrera', { ascending: true })
            .order('cve_ent', { ascending: true })
            .order('sexo', { ascending: true })
            .order('anio', { ascending: true })
        )
      ]);

      if (cancelado) return;
      setCarrerasRaw(resCar);
      setMetaPipeline(resMeta);
      setPrepaRows(resPrepa);
      setSatelitesRaw(resSat);
      setSeriesRaw(resSer);
      setLoading(false);
    }

    cargarDatosCrudos();
    return () => {
      cancelado = true;
    };
  }, [reloadTick]);

  useEffect(() => {
    setFiltroCuadrante('todos');
  }, [ejeXId, ejeYId, regionActiva, generoActivo]);

  const { filasActivas, mediaVariables, censoDemografico, ventanas } = useMemo(() => {
    const vDefault = calcularVentanasTemporales(
      seriesRaw.map(r => Number(r.anio)),
      metaPipeline
    );
    const censoVacio = {
      encuestadosTotalFiltro: 0,
      peaTotalFiltro: 0,
      pctMujeresReg: 50,
      pctHombresReg: 50,
      sueldoMedioHombres: 0,
      sueldoMedioMujeres: 0,
      brechaGeneroPct: 0,
      sueldoMedioStem: 0,
      sueldoMedioNoStem: 0,
      premioStemPct: 0
    };

    if (carrerasRaw.length === 0 || satelitesRaw.length === 0) {
      return {
        filasActivas: [],
        mediaVariables: {} as Record<string, number>,
        censoDemografico: censoVacio,
        ventanas: vDefault
      };
    }

    const benchPrepaMap = construirBenchmarksPrepaMap(prepaRows, vDefault);
    const sueldoPrepaRef =
      benchPrepaMap[regionActiva]?.sueldo_prepa[generoActivo] ??
      benchPrepaMap.nacional.sueldo_prepa[0];

    const mapaSat: Record<string, any> = {};
    satelitesRaw.forEach(s => {
      const k = `${padCve(s.cve_carrera)}_${normalizarRegion(s.region)}_${Number(s.sexo ?? 0)}`;
      mapaSat[k] = s;
    });

    const mapaSeries: Record<string, any[]> = {};
    seriesRaw.forEach(r => {
      const cve = padCve(r.cve_carrera);
      const regDest = normalizarRegion(r.cve_ent);
      const sx = Number(r.sexo ?? 0);
      const k = `${cve}_${regDest}_${sx}`;
      if (!mapaSeries[k]) mapaSeries[k] = [];
      mapaSeries[k].push(r);
    });

    const obtenerSerie = (cve: string, reg: RegionClave, sx: CodigoGenero) => {
      const dir = mapaSeries[`${cve}_${reg}_${sx}`];
      if (dir && dir.length > 0) return dir;
      if (sx === 0) {
        return [...(mapaSeries[`${cve}_${reg}_1`] || []), ...(mapaSeries[`${cve}_${reg}_2`] || [])];
      }
      return [];
    };

    // Medias dinámicas reales de estrato y nepotismo para esta región y género (cero 2.80 hardcodeado)
    const satsValidosCelda = carrerasRaw
      .map(c => {
        const cve = padCve(c.cve_carrera);
        const satNac0 = mapaSat[`${cve}_nacional_0`];
        const satC = mapaSat[`${cve}_${regionActiva}_${generoActivo}`];
        if (!esCeldaSateliteValida(satNac0, 'nacional', 0)) return null;
        if (!esCeldaSateliteValida(satC, regionActiva, generoActivo)) return null;
        return satC;
      })
      .filter(Boolean);

    const pesoSatCelda = satsValidosCelda.reduce((a, s) => a + Math.max(1, numSeguro(s.volumen_muestra_nacional, 1)), 0);
    const mediaEstratoCelda = pesoSatCelda > 0
      ? Number((satsValidosCelda.reduce((a, s) => a + numSeguro(s.indice_privilegio, 2.8) * Math.max(1, numSeguro(s.volumen_muestra_nacional, 1)), 0) / pesoSatCelda).toFixed(2))
      : 2.80;
    const mediaNepotismoCelda = pesoSatCelda > 0
      ? Number((satsValidosCelda.reduce((a, s) => a + numSeguro(s.pct_nepotismo, 37.2) * Math.max(1, numSeguro(s.volumen_muestra_nacional, 1)), 0) / pesoSatCelda).toFixed(1))
      : 37.2;

    // Composición demográfica y salarial Hombres vs Mujeres en la región activa
    let peaAcumHombres = 0;
    let prodSueldoHombres = 0;
    let peaAcumMujeres = 0;
    let prodSueldoMujeres = 0;

    carrerasRaw.forEach(c => {
      const cve = padCve(c.cve_carrera);
      const satNac0 = mapaSat[`${cve}_nacional_0`];
      if (!esCeldaSateliteValida(satNac0, 'nacional', 0)) return;

      const sRef0 = obtenerSerie(cve, regionActiva, 0);
      const filaRefStem = sRef0[sRef0.length - 1];
      const esStemCve = filaRefStem?.is_stem != null
        ? Boolean(filaRefStem.is_stem)
        : (cve.startsWith('05') || cve.startsWith('06') || cve.startsWith('07'));
      if (soloStem && !esStemCve) return;

      const sH = obtenerSerie(cve, regionActiva, 1);
      const sM = obtenerSerie(cve, regionActiva, 2);

      const sHEmp = sH.filter(r => vDefault.aniosEmpleo.includes(Number(r.anio)));
      const sMEmp = sM.filter(r => vDefault.aniosEmpleo.includes(Number(r.anio)));

      if (sHEmp.length > 0) {
        const pH = sHEmp.reduce((a, b) => a + numSeguro(b.poblacion_activa_total, 0), 0) / sHEmp.length;
        const salH = calcularSueldoConsolidadoCelda(sH, vDefault);
        if (pH > 0 && salH > 0) {
          peaAcumHombres += pH;
          prodSueldoHombres += salH * pH;
        }
      }
      if (sMEmp.length > 0) {
        const pM = sMEmp.reduce((a, b) => a + numSeguro(b.poblacion_activa_total, 0), 0) / sMEmp.length;
        const salM = calcularSueldoConsolidadoCelda(sM, vDefault);
        if (pM > 0 && salM > 0) {
          peaAcumMujeres += pM;
          prodSueldoMujeres += salM * pM;
        }
      }
    });

    const sumaGeneroPea = peaAcumHombres + peaAcumMujeres;
    const pctMujeresReg = sumaGeneroPea > 0 ? Math.round((peaAcumMujeres / sumaGeneroPea) * 100) : 50;
    const pctHombresReg = 100 - pctMujeresReg;
    const sueldoMedioHombres = peaAcumHombres > 0 ? Math.round(prodSueldoHombres / peaAcumHombres) : 0;
    const sueldoMedioMujeres = peaAcumMujeres > 0 ? Math.round(prodSueldoMujeres / peaAcumMujeres) : 0;
    const brechaGeneroPct = sueldoMedioHombres > 0 && sueldoMedioMujeres > 0
      ? Number((((sueldoMedioHombres - sueldoMedioMujeres) / sueldoMedioHombres) * 100).toFixed(1))
      : 0;

    const listaProcesada: any[] = [];

    carrerasRaw.forEach(c => {
      const cve = padCve(c.cve_carrera);
      const satNac0 = mapaSat[`${cve}_nacional_0`];
      if (!esCeldaSateliteValida(satNac0, 'nacional', 0)) return;

      const satCelda = mapaSat[`${cve}_${regionActiva}_${generoActivo}`];
      if (!esCeldaSateliteValida(satCelda, regionActiva, generoActivo)) return;

      const nEnc = numSeguro(satCelda.n_encuestados_reales, 0);

      const serieNacSx = obtenerSerie(cve, 'nacional', generoActivo);
      const sueldoNacRef = calcularSueldoConsolidadoCelda(serieNacSx, vDefault);

      const serieCelda = obtenerSerie(cve, regionActiva, generoActivo);
      const fEmp = serieCelda.filter(r => vDefault.aniosEmpleo.includes(Number(r.anio)));
      const loteEmp = fEmp.length > 0 ? fEmp : serieCelda;

      // Cero Doble Bühlmann: promedio ponderado directo de predicciones_roi
      const sueldoMensual = calcularSueldoConsolidadoCelda(serieCelda, vDefault, sueldoNacRef);
      if (sueldoMensual <= 0) return;

      const peaActiva = loteEmp.length > 0
        ? Math.round(loteEmp.reduce((a, b) => a + numSeguro(b.poblacion_activa_total, 0), 0) / loteEmp.length)
        : numSeguro(satCelda.volumen_muestra_nacional, 1000);

      const sumaPea = loteEmp.reduce((a, b) => a + numSeguro(b.poblacion_activa_total, 0), 0);
      const sumaDes = loteEmp.reduce((a, b) => a + numSeguro(b.desempleados_reales, 0), 0);
      const tasaDesempleo = sumaPea > 0 ? Number(Math.max(0.8, (sumaDes / sumaPea) * 100).toFixed(1)) : 3.2;

      const filaRec =
        serieCelda.find(r => Number(r.anio) === vDefault.anioMax) ||
        serieCelda[serieCelda.length - 1] ||
        serieNacSx[serieNacSx.length - 1];
      const saturacionPct = Math.round(numSeguro(filaRec?.indice_saturacion_pct, 92));
      const isStem = filaRec?.is_stem != null
        ? Boolean(filaRec.is_stem)
        : (cve.startsWith('05') || cve.startsWith('06') || cve.startsWith('07'));

      const pCont = numSeguro(satCelda.pct_contrato, 65);
      const pAgui = numSeguro(satCelda.pct_aguinaldo, 63);
      const pAfor = numSeguro(satCelda.pct_afore, 55);
      const pPlur = numSeguro(satCelda.pct_pluriempleo, 5.6);
      const pDesa = numSeguro(satCelda.pct_desarraigo, 2.7);
      const pPyme = numSeguro(satCelda.pct_pyme, 30);
      const pCorp = numSeguro(satCelda.pct_corp, 12);
      const pMicro = numSeguro(satCelda.pct_micro, 25);
      const pGob = numSeguro(satCelda.pct_gobierno, 18);
      const pSind = numSeguro(satCelda.pct_sindicato, 15);
      const pSgmm = numSeguro(satCelda.pct_sgmm, 8);
      const pMat = numSeguro(satCelda.pct_materno ?? satNac0.pct_materno, 23);
      const pHo = numSeguro(satCelda.pct_home_office, 3.5);
      const pNep = numSeguro(satCelda.pct_nepotismo, mediaNepotismoCelda);
      const priv = numSeguro(satCelda.indice_privilegio, mediaEstratoCelda);
      const riesgoIA = numSeguro(satCelda.riesgo_ia_score, 40);

      const hrsH = numSeguro(satCelda.hrs_doble_jornada_hombres, 9.6);
      const hrsM = numSeguro(satCelda.hrs_doble_jornada_mujeres, 21.1);
      const hrsHogar = generoActivo === 1 ? hrsH : generoActivo === 2 ? hrsM : Number(((hrsH + hrsM) / 2).toFixed(1));

      const ind = calcularIndicadoresSatelite({
        sat: satCelda,
        sueldoMensual,
        sueldoPrepa: sueldoPrepaRef,
        mediaEstratoContexto: mediaEstratoCelda,
        mediaNepotismoContexto: mediaNepotismoCelda
      });

      const tendencia = clasificarTendenciaRealDinamica(
        serieCelda.length >= 4 ? serieCelda : serieNacSx,
        vDefault
      );

      const evalScore = calcularScoreDataROIUniversal({
        Prima_vs_Prepa_Pct: ind.primaPrepaPct,
        Desempleo_Abierto_Pct: tasaDesempleo,
        Saturacion_ANUIES_Pct: saturacionPct,
        Empleo_Calidad_OIT_Pct: ind.calidadOitPct,
        Formalidad_Total_Pct: ind.formalidadTotalPct,
        Meritocracia_Pct: ind.meritocraciaPct,
        Blindaje_IA_Pct: ind.blindajeIAPct,
        Tendencia_Codigo: tendencia.codigo,
        Empleo_Unico_Pct: ind.pctEmpleoUnico,
        Arraigo_Local_Pct: ind.pctArraigoLocal
      });

      listaProcesada.push({
        cve_carrera: cve,
        nombre_carrera: c.nombre_ejecutivo || formatearNombreCarreraEjecutivo(cve, c.nombre_carrera),
        nombre_oficial: c.nombre_carrera,
        is_stem: isStem,
        n_encuestados: nEnc,
        pea_activa: peaActiva,
        score_dataroi: Math.round(evalScore.score),
        sueldo_mensual: sueldoMensual,
        prima_prepa_pct: ind.primaPrepaPct,
        calidad_oit_pct: ind.calidadOitPct,
        formalidad_pct: ind.formalidadTotalPct,
        tasa_desempleo: tasaDesempleo,
        saturacion_pct: saturacionPct,
        riesgo_ia_score: riesgoIA,
        blindaje_ia_pct: ind.blindajeIAPct,
        indice_privilegio: Number(priv.toFixed(2)),
        pct_nepotismo: Number(pNep.toFixed(1)),
        pct_contrato: Number(pCont.toFixed(1)),
        pct_aguinaldo: Number(pAgui.toFixed(1)),
        pct_afore: Number(pAfor.toFixed(1)),
        pct_sgmm: Number(pSgmm.toFixed(1)),
        pct_sindicato: Number(pSind.toFixed(1)),
        pct_materno: Number(pMat.toFixed(1)),
        pct_corp: Number(pCorp.toFixed(1)),
        pct_pyme: Number(pPyme.toFixed(1)),
        pct_micro: Number(pMicro.toFixed(1)),
        pct_gobierno: Number(pGob.toFixed(1)),
        pct_home_office: Number(pHo.toFixed(1)),
        pct_pluriempleo: Number(pPlur.toFixed(1)),
        pct_desarraigo: Number(pDesa.toFixed(1)),
        hrs_hogar: hrsHogar
      });
    });

    const medias: Record<string, number> = {};
    if (listaProcesada.length > 0) {
      const sumaPesos = listaProcesada.reduce((a, b) => a + Math.max(1, b.pea_activa), 0);
      CATALOGO_VARIABLES_CRUDAS.forEach(v => {
        const prod = listaProcesada.reduce((a, b) => a + Number(b[v.id] || 0) * Math.max(1, b.pea_activa), 0);
        medias[v.id] = Number((prod / sumaPesos).toFixed(v.unidad === 'MXN' ? 0 : 2));
      });
    }

    const loteFiltroStem = soloStem ? listaProcesada.filter(f => f.is_stem) : listaProcesada;
    const encuestadosTotalFiltro = loteFiltroStem.reduce((a, b) => a + b.n_encuestados, 0);
    const peaTotalFiltro = loteFiltroStem.reduce((a, b) => a + b.pea_activa, 0);

    const carrerasStem = listaProcesada.filter(f => f.is_stem);
    const carrerasNoStem = listaProcesada.filter(f => !f.is_stem);
    const peaStem = carrerasStem.reduce((a, b) => a + Math.max(1, b.pea_activa), 0);
    const peaNoStem = carrerasNoStem.reduce((a, b) => a + Math.max(1, b.pea_activa), 0);
    const sueldoMedioStem = peaStem > 0 ? Math.round(carrerasStem.reduce((a, b) => a + b.sueldo_mensual * Math.max(1, b.pea_activa), 0) / peaStem) : 0;
    const sueldoMedioNoStem = peaNoStem > 0 ? Math.round(carrerasNoStem.reduce((a, b) => a + b.sueldo_mensual * Math.max(1, b.pea_activa), 0) / peaNoStem) : 0;
    const premioStemPct = sueldoMedioNoStem > 0 ? Number((((sueldoMedioStem - sueldoMedioNoStem) / sueldoMedioNoStem) * 100).toFixed(1)) : 0;

    return {
      filasActivas: listaProcesada,
      mediaVariables: medias,
      ventanas: vDefault,
      censoDemografico: {
        encuestadosTotalFiltro,
        peaTotalFiltro,
        pctMujeresReg,
        pctHombresReg,
        sueldoMedioHombres,
        sueldoMedioMujeres,
        brechaGeneroPct,
        sueldoMedioStem,
        sueldoMedioNoStem,
        premioStemPct
      }
    };
  }, [carrerasRaw, satelitesRaw, seriesRaw, prepaRows, metaPipeline, regionActiva, generoActivo, soloStem]);

  const metaVarRanking = CATALOGO_VARIABLES_CRUDAS.find(v => v.id === varRankingId) || CATALOGO_VARIABLES_CRUDAS[0];
  const metaEjeX = CATALOGO_VARIABLES_CRUDAS.find(v => v.id === ejeXId) || CATALOGO_VARIABLES_CRUDAS[8];
  const metaEjeY = CATALOGO_VARIABLES_CRUDAS.find(v => v.id === ejeYId) || CATALOGO_VARIABLES_CRUDAS[0];

  const filasUniversoPlano = useMemo(() => {
    return soloStem ? filasActivas.filter(f => f.is_stem) : filasActivas;
  }, [filasActivas, soloStem]);

  const mediaXActual = mediaVariables[ejeXId] ?? 0;
  const mediaYActual = mediaVariables[ejeYId] ?? 0;

  const conteoCuadrantes = useMemo(() => {
    let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
    filasUniversoPlano.forEach(f => {
      const vx = Number(f[ejeXId] || 0);
      const vy = Number(f[ejeYId] || 0);
      if (vx < mediaXActual && vy >= mediaYActual) q1++;
      else if (vx >= mediaXActual && vy >= mediaYActual) q2++;
      else if (vx < mediaXActual && vy < mediaYActual) q3++;
      else q4++;
    });
    return { q1, q2, q3, q4 };
  }, [filasUniversoPlano, ejeXId, ejeYId, mediaXActual, mediaYActual]);

  const filasPlanoVisibles = useMemo(() => {
    return filasUniversoPlano.filter(f => {
      if (filtroCuadrante === 'todos') return true;
      const vx = Number(f[ejeXId] || 0);
      const vy = Number(f[ejeYId] || 0);
      if (filtroCuadrante === 'q1_sup_izq') return vx < mediaXActual && vy >= mediaYActual;
      if (filtroCuadrante === 'q2_sup_der') return vx >= mediaXActual && vy >= mediaYActual;
      if (filtroCuadrante === 'q3_inf_izq') return vx < mediaXActual && vy < mediaYActual;
      if (filtroCuadrante === 'q4_inf_der') return vx >= mediaXActual && vy < mediaYActual;
      return true;
    });
  }, [filasUniversoPlano, filtroCuadrante, ejeXId, ejeYId, mediaXActual, mediaYActual]);

  const filasTablaFiltradasYOrdenadas = useMemo(() => {
    const q = busquedaTabla.toLowerCase().trim();
    const filtradas = filasPlanoVisibles.filter(f => {
      return !q || f.nombre_carrera.toLowerCase().includes(q) || f.nombre_oficial.toLowerCase().includes(q) || f.cve_carrera.includes(q);
    });

    return [...filtradas].sort((a, b) => {
      const va = Number(a[varRankingId] || 0);
      const vb = Number(b[varRankingId] || 0);
      if (va !== vb) return ordenDesc ? vb - va : va - vb;
      return b.sueldo_mensual - a.sueldo_mensual;
    });
  }, [filasPlanoVisibles, busquedaTabla, varRankingId, ordenDesc]);

  const carrerasOrdenAlfabetico = useMemo(() => {
    return [...filasUniversoPlano].sort((a, b) => a.nombre_carrera.localeCompare(b.nombre_carrera, 'es'));
  }, [filasUniversoPlano]);

  const regresionOLS = useMemo(() => {
    const xs = filasUniversoPlano.map(f => Number(f[ejeXId] || 0));
    const ys = filasUniversoPlano.map(f => Number(f[ejeYId] || 0));
    return calcularRegresionLinealOLS(xs, ys);
  }, [filasUniversoPlano, ejeXId, ejeYId]);

  const puntosLineaOLS = useMemo(() => {
    if (filasUniversoPlano.length < 3 || regresionOLS.minX === regresionOLS.maxX) return [];
    return [
      { [ejeXId]: regresionOLS.minX, [ejeYId]: Number((regresionOLS.intercept + regresionOLS.slope * regresionOLS.minX).toFixed(2)) },
      { [ejeXId]: regresionOLS.maxX, [ejeYId]: Number((regresionOLS.intercept + regresionOLS.slope * regresionOLS.maxX).toFixed(2)) }
    ];
  }, [filasUniversoPlano.length, regresionOLS, ejeXId, ejeYId]);

  const { dominioX, dominioY } = useMemo(() => {
    if (filasPlanoVisibles.length === 0) {
      return { dominioX: [0, 100] as [number, number], dominioY: [0, 100] as [number, number] };
    }
    const xs = filasPlanoVisibles.map(f => Number(f[ejeXId] || 0));
    const ys = filasPlanoVisibles.map(f => Number(f[ejeYId] || 0));

    let minX = Math.min(...xs, mediaXActual);
    let maxX = Math.max(...xs, mediaXActual);
    let minY = Math.min(...ys, mediaYActual);
    let maxY = Math.max(...ys, mediaYActual);

    const spanX = Math.max(0.2, maxX - minX);
    const spanY = Math.max(0.2, maxY - minY);

    const padX = spanX * 0.11;
    const padY = spanY * 0.14;

    minX = metaEjeX.unidad === 'estrato' ? Number(Math.max(1, minX - padX).toFixed(2)) : Math.max(0, Math.floor(minX - padX));
    maxX = metaEjeX.unidad === 'estrato' ? Number(Math.min(4, maxX + padX).toFixed(2)) : Math.ceil(maxX + padX);
    minY = metaEjeY.unidad === 'estrato' ? Number(Math.max(1, minY - padY).toFixed(2)) : Math.max(0, Math.floor(minY - padY));
    maxY = metaEjeY.unidad === 'estrato' ? Number(Math.min(4, maxY + padY).toFixed(2)) : Math.ceil(maxY + padY);

    return {
      dominioX: [minX, maxX] as [number, number],
      dominioY: [minY, maxY] as [number, number]
    };
  }, [filasPlanoVisibles, ejeXId, ejeYId, mediaXActual, mediaYActual, metaEjeX.unidad, metaEjeY.unidad]);

  const mapaEtiquetasPlano = useMemo(() => {
    const mapa = new Map<string, { dx: number; dy: number; anchor: 'middle' | 'start' | 'end'; texto: string; destacada: boolean }>();
    if (filasPlanoVisibles.length === 0) return mapa;

    const spanX = Math.max(0.001, dominioX[1] - dominioX[0]);
    const spanY = Math.max(0.001, dominioY[1] - dominioY[0]);

    const porY = [...filasPlanoVisibles].sort((a, b) => Number(b[ejeYId] || 0) - Number(a[ejeYId] || 0));
    const porX = [...filasPlanoVisibles].sort((a, b) => Number(b[ejeXId] || 0) - Number(a[ejeXId] || 0));

    const candidatosOrdenados: any[] = [];
    const seen = new Set<string>();
    const agregar = (item: any) => {
      if (item && !seen.has(item.cve_carrera)) {
        seen.add(item.cve_carrera);
        candidatosOrdenados.push(item);
      }
    };

    if (carreraDestacadaCve) {
      agregar(filasPlanoVisibles.find(f => f.cve_carrera === carreraDestacadaCve));
    }
    agregar(porY[0]);
    agregar(porX[0]);
    agregar(porY[porY.length - 1]);
    agregar(porX[porX.length - 1]);
    agregar(porY[1]);

    const colocadas: { nx: number; ny: number }[] = [];

    candidatosOrdenados.forEach(item => {
      const vx = Number(item[ejeXId] || 0);
      const vy = Number(item[ejeYId] || 0);
      const nx = (vx - dominioX[0]) / spanX;
      const ny = (vy - dominioY[0]) / spanY;
      const esDestacada = item.cve_carrera === carreraDestacadaCve;

      const choca = !esDestacada && colocadas.some(prev => Math.abs(nx - prev.nx) < 0.18 && Math.abs(ny - prev.ny) < 0.15);
      if (choca) return;

      colocadas.push({ nx, ny });

      let anchor: 'middle' | 'start' | 'end' = 'middle';
      let dx = 0;
      let dy = -10;

      if (nx < 0.17) {
        anchor = 'start';
        dx = 9;
        dy = 3;
      } else if (nx > 0.83) {
        anchor = 'end';
        dx = -9;
        dy = 3;
      } else if (ny > 0.84) {
        anchor = 'middle';
        dx = 0;
        dy = 16;
      }

      const texto = item.nombre_carrera.length > 22
        ? item.nombre_carrera.slice(0, 20) + '…'
        : item.nombre_carrera;

      mapa.set(item.cve_carrera, { dx, dy, anchor, texto, destacada: esDestacada });
    });

    return mapa;
  }, [filasPlanoVisibles, ejeXId, ejeYId, dominioX, dominioY, carreraDestacadaCve]);

  const radarCorrelacionesContraY = useMemo(() => {
    if (filasUniversoPlano.length < 4) return { positivas: [], negativas: [] };
    const ys = filasUniversoPlano.map(f => Number(f[ejeYId] || 0));
    const lista = CATALOGO_VARIABLES_CRUDAS
      .filter(v => v.id !== ejeYId)
      .map(v => {
        const xs = filasUniversoPlano.map(f => Number(f[v.id] || 0));
        const { r } = calcularRegresionLinealOLS(xs, ys);
        return { ...v, r };
      });

    const positivas = [...lista].filter(x => x.r > 0.05).sort((a, b) => b.r - a.r).slice(0, 4);
    const negativas = [...lista].filter(x => x.r < -0.05).sort((a, b) => a.r - b.r).slice(0, 4);
    return { positivas, negativas };
  }, [filasUniversoPlano, ejeYId]);

  const estadisticosTabla = useMemo(() => {
    if (filasTablaFiltradasYOrdenadas.length === 0) {
      return { p10: 0, p50: 0, p90: 0, min: 0, max: 0, mediaStem: 0, mediaNoStem: 0 };
    }
    const valsAsc = filasTablaFiltradasYOrdenadas.map(f => Number(f[varRankingId] || 0)).sort((a, b) => a - b);

    const stemRows = filasActivas.filter(f => f.is_stem);
    const noStemRows = filasActivas.filter(f => !f.is_stem);
    const peaStem = stemRows.reduce((a, b) => a + Math.max(1, b.pea_activa), 0);
    const peaNoStem = noStemRows.reduce((a, b) => a + Math.max(1, b.pea_activa), 0);

    const mediaStem = peaStem > 0
      ? stemRows.reduce((a, b) => a + Number(b[varRankingId] || 0) * Math.max(1, b.pea_activa), 0) / peaStem
      : 0;
    const mediaNoStem = peaNoStem > 0
      ? noStemRows.reduce((a, b) => a + Number(b[varRankingId] || 0) * Math.max(1, b.pea_activa), 0) / peaNoStem
      : 0;

    return {
      p10: calcularPercentil(valsAsc, 0.10),
      p50: calcularPercentil(valsAsc, 0.50),
      p90: calcularPercentil(valsAsc, 0.90),
      min: valsAsc[0],
      max: valsAsc[valsAsc.length - 1],
      mediaStem,
      mediaNoStem
    };
  }, [filasTablaFiltradasYOrdenadas, filasActivas, varRankingId]);

  const maxValorVariableRanking = useMemo(() => {
    if (filasTablaFiltradasYOrdenadas.length === 0) return 100;
    return Math.max(...filasTablaFiltradasYOrdenadas.map(f => Math.abs(Number(f[varRankingId] || 0))), 1);
  }, [filasTablaFiltradasYOrdenadas, varRankingId]);

  const filasTablaVisibles = mostrarTodasTabla ? filasTablaFiltradasYOrdenadas : filasTablaFiltradasYOrdenadas.slice(0, 12);
  const queryGeneroParam = generoActivo === 2 ? 'mujeres' : generoActivo === 1 ? 'hombres' : 'total';
  const etiquetaGeneroCorto = generoActivo === 2 ? 'Solo Mujeres' : generoActivo === 1 ? 'Solo Hombres' : 'Total General';

  const textoPendienteOLS = useMemo(() => {
    const deltaY = regresionOLS.slope * metaEjeX.pasoInterpretacion;
    const signo = deltaY >= 0 ? '+' : '-';
    const magnitudY = formatearValorVariable(Math.abs(deltaY), metaEjeY.unidad);
    const pasoXTexto =
      metaEjeX.unidad === 'MXN'
        ? `+$${metaEjeX.pasoInterpretacion.toLocaleString('es-MX')}`
        : metaEjeX.unidad === 'estrato'
          ? `+${metaEjeX.pasoInterpretacion} pts`
          : metaEjeX.unidad === 'hrs'
            ? `+${metaEjeX.pasoInterpretacion} hrs`
            : `+${metaEjeX.pasoInterpretacion}%`;
    return `Cada ${pasoXTexto} en ${metaEjeX.corto} se asocia con ${signo}${magnitudY} en ${metaEjeY.corto}`;
  }, [regresionOLS.slope, metaEjeX, metaEjeY]);

  const etiquetaFuerzaCorrelacion = useMemo(() => {
    const abs = Math.abs(regresionOLS.r);
    const dir = regresionOLS.r >= 0 ? 'Positiva' : 'Inversa';
    if (abs >= 0.55) return { texto: `Fuerte ${dir}`, clase: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' };
    if (abs >= 0.30) return { texto: `Moderada ${dir}`, clase: 'bg-blue-500/20 text-blue-300 border-blue-400/40' };
    if (abs >= 0.15) return { texto: `Débil ${dir}`, clase: 'bg-amber-500/20 text-amber-300 border-amber-400/40' };
    return { texto: 'Sin relación lineal', clase: 'bg-slate-700 text-slate-300 border-slate-600' };
  }, [regresionOLS.r]);

  const colSecundaria1 = varRankingId === 'sueldo_mensual'
    ? { id: 'prima_prepa_pct', label: 'Prima vs. Prepa', unidad: '%' as const }
    : { id: 'sueldo_mensual', label: 'Salario Mensual', unidad: 'MXN' as const };

  const colSecundaria2 = varRankingId === 'calidad_oit_pct'
    ? { id: 'saturacion_pct', label: 'Saturación ANUIES', unidad: '%' as const }
    : { id: 'calidad_oit_pct', label: 'Calidad OIT', unidad: '%' as const };

  const corteSlug = metaPipeline.etiqueta_corte.replace(/\s+/g, '_');

  const exportarBaseCrudaExcel = () => {
    if (filasTablaFiltradasYOrdenadas.length === 0) return;
    const cabeceras = [
      'Posicion',
      'CVE_Carrera',
      'Nombre_Ejecutivo',
      'Es_STEM',
      'Muestra_Fisica_INEGI',
      'PEA_Activa',
      'Score_DataROI_0_100',
      ...CATALOGO_VARIABLES_CRUDAS.map(v => v.corto.replace(/\s+/g, '_'))
    ];

    const filas: ValorCeldaExcel[][] = filasTablaFiltradasYOrdenadas.map((f, idx) => [
      idx + 1,
      f.cve_carrera,
      { v: f.nombre_carrera, s: 'bold' },
      f.is_stem ? 'Sí' : 'No',
      f.n_encuestados,
      f.pea_activa,
      { v: f.score_dataroi, s: f.score_dataroi >= 70 ? 'winner' : f.score_dataroi < 56 ? 'warning' : 'bold' },
      ...CATALOGO_VARIABLES_CRUDAS.map(v => Number(f[v.id] ?? 0))
    ]);

    descargarLibroExcelXLSX(
      `DataROI_Laboratorio_Crudo_${regionActiva}_${queryGeneroParam}_${corteSlug}.xlsx`,
      [
        {
          nombre: '1_Matriz_24_Variables_Crudas',
          cabeceras,
          filas
        },
        {
          nombre: '2_Diccionario_Variables',
          cabeceras: ['Clave_Variable', 'Nombre_Indicador', 'Media_Regional_Ponderada', 'Descripcion_Metodologica_INEGI_ANUIES'],
          filas: [
            ['corte_activo', { v: `Corte Oficial ${metaPipeline.etiqueta_corte}`, s: 'section' }, ventanas.rangoTexto, metaPipeline.etiqueta_pesos_base],
            ...CATALOGO_VARIABLES_CRUDAS.map(v => [
              v.id,
              { v: v.nombre, s: 'bold' as const },
              formatearValorVariable(mediaVariables[v.id] ?? 0, v.unidad),
              v.descripcion
            ])
          ]
        }
      ]
    );
  };

  const exportarBaseCrudaCSV = () => {
    if (filasTablaFiltradasYOrdenadas.length === 0) return;
    const cabeceras = [
      'Posicion',
      'CVE_Carrera',
      'Nombre_Ejecutivo',
      'Es_STEM',
      'Muestra_Fisica_INEGI',
      'PEA_Activa',
      'Score_DataROI_0_100',
      ...CATALOGO_VARIABLES_CRUDAS.map(v => v.id)
    ];
    const filas: ValorCeldaExcel[][] = filasTablaFiltradasYOrdenadas.map((f, idx) => [
      idx + 1,
      f.cve_carrera,
      f.nombre_carrera,
      f.is_stem ? 'Sí' : 'No',
      f.n_encuestados,
      f.pea_activa,
      f.score_dataroi,
      ...CATALOGO_VARIABLES_CRUDAS.map(v => Number(f[v.id] ?? 0))
    ]);
    descargarCSVEstilizado(`DataROI_Laboratorio_Crudo_${regionActiva}_${queryGeneroParam}_${corteSlug}.csv`, cabeceras, filas);
  };

  const rFormateado = `${regresionOLS.r > 0 ? '+' : ''}${regresionOLS.r.toFixed(2)}`;
  const regionLabelCorto = regionActiva === 'nacional' ? 'Nacional' : REGIONES_META[regionActiva].corto;

  return (
    <div className="max-w-7xl mx-auto p-4 md:px-8 md:py-4 space-y-4 pb-16">
      
      {/* CABECERA COMPACTA + CENSO DEMOGRÁFICO REACTIVO */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white rounded-3xl p-4 md:p-5 shadow-lg border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10.5px] font-extrabold uppercase tracking-wider">
                <FlaskConical className="w-3 h-3" aria-hidden="true" /> Auditoría de Variables Puras · Corte {metaPipeline.etiqueta_corte}
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {REGIONES_META[regionActiva].nombre} · {etiquetaGeneroCorto}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              Laboratorio de Datos Crudos, Censo y Correlaciones
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={exportarBaseCrudaExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs transition-all cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" /> Base Excel (24 Vars)
            </button>
            <button
              onClick={exportarBaseCrudaCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" /> CSV Crudo
            </button>
          </div>
        </div>

        {/* CINTA DE CENSO DEMOGRÁFICO Y BRECHAS ESTRUCTURALES EN VIVO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3.5 pt-3.5 border-t border-slate-800/90 text-xs">
          
          <div className="bg-slate-800/85 border border-slate-700/80 ring-1 ring-white/5 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Muestra Física Auditada
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <strong className="text-lg font-black text-white">
                {censoDemografico.encuestadosTotalFiltro.toLocaleString('es-MX')} enc.
              </strong>
              <span className="text-[11px] font-bold text-emerald-400 whitespace-nowrap">
                {filasUniversoPlano.length} carreras
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Microdatos físicos ENOE INEGI ({ventanas.rangoTexto})
            </span>
          </div>

          <div className="bg-slate-800/85 border border-slate-700/80 ring-1 ring-white/5 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Fuerza Laboral (PEA Activa)
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <strong className="text-lg font-black text-sky-400">
                {censoDemografico.peaTotalFiltro.toLocaleString('es-MX')}
              </strong>
              <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">
                profesionistas
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Población activa en {regionLabelCorto}
            </span>
          </div>

          <div className="bg-slate-800/85 border border-slate-700/80 ring-1 ring-white/5 rounded-2xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="truncate">Género ({regionLabelCorto})</span>
              <span className="text-violet-300 font-black whitespace-nowrap shrink-0">
                {censoDemografico.pctMujeresReg}% M · {censoDemografico.pctHombresReg}% H
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden flex my-1.5 border border-slate-700">
              <div
                style={{ width: `${censoDemografico.pctMujeresReg}%` }}
                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                title={`Mujeres: ${censoDemografico.pctMujeresReg}%`}
              />
              <div
                style={{ width: `${censoDemografico.pctHombresReg}%` }}
                className="h-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-500"
                title={`Hombres: ${censoDemografico.pctHombresReg}%`}
              />
            </div>
            <div className="flex items-center justify-between gap-1 text-[10px] text-slate-300">
              <span className="truncate">M: {formatoMoneda(censoDemografico.sueldoMedioMujeres)} · H: {formatoMoneda(censoDemografico.sueldoMedioHombres)}</span>
              <strong className="text-amber-300 font-black whitespace-nowrap shrink-0">Brecha: {censoDemografico.brechaGeneroPct}%</strong>
            </div>
          </div>

          <div className="bg-slate-800/85 border border-slate-700/80 ring-1 ring-white/5 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Efecto Salarial STEM vs. Otras
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <strong className="text-lg font-black text-emerald-400">
                {censoDemografico.premioStemPct >= 0 ? `+${censoDemografico.premioStemPct}%` : `${censoDemografico.premioStemPct}%`}
              </strong>
              <span className="text-[11px] font-bold text-indigo-300 whitespace-nowrap">
                Prima STEM
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 truncate">
              STEM: {formatoMoneda(censoDemografico.sueldoMedioStem)} vs Otras: {formatoMoneda(censoDemografico.sueldoMedioNoStem)}
            </span>
          </div>

        </div>
      </div>

      {/* BARRA DE FILTROS DEMOGRÁFICOS */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-800 flex items-center gap-1 mr-0.5">
            <MapPin className="w-4 h-4 text-blue-600" aria-hidden="true" /> Macro-Región:
          </span>
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {REGIONES_ORDEN.map((reg) => {
              const act = regionActiva === reg;
              return (
                <button
                  key={reg}
                  type="button"
                  aria-pressed={act}
                  onClick={() => setRegionActiva(reg)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                    act ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  {reg === 'nacional' ? 'Nacional' : REGIONES_META[reg].corto}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5">
          <button
            type="button"
            aria-pressed={soloStem}
            onClick={() => setSoloStem(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 inline-flex items-center gap-1.5 cursor-pointer ${
              soloStem ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Microscope className="w-3.5 h-3.5" aria-hidden="true" />
            Solo STEM ({filasActivas.filter(f => f.is_stem).length})
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1">
              <Users className="w-4 h-4 text-blue-600" aria-hidden="true" /> Perfil:
            </span>
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              {([
                { id: 0 as CodigoGenero, label: 'Total General' },
                { id: 2 as CodigoGenero, label: 'Solo Mujeres' },
                { id: 1 as CodigoGenero, label: 'Solo Hombres' }
              ]).map((op) => {
                const act = generoActivo === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    aria-pressed={act}
                    onClick={() => setGeneroActivo(op.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                      act ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* MÓDULO 1: ESTACIÓN BIVARIADA COMPACTA */}
      <div className="bg-gradient-to-b from-white via-white to-slate-50/70 rounded-3xl p-4 md:p-5 border border-slate-200/90 shadow-xs">
        
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h2 className="text-base md:text-lg font-black text-slate-900">
              Matriz de Cruce Libre (Eje X vs. Eje Y)
            </h2>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600">
              · Regresión OLS y Cuadrantes
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {PRESETS_CORRELACION.map((pr, idx) => {
              const activo = ejeXId === pr.x && ejeYId === pr.y;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setEjeXId(pr.x);
                    setEjeYId(pr.y);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                    activo
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-white'
                  }`}
                >
                  {pr.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* FILA COMPACTA: SELECTOR X + SELECTOR Y + CORRELACIÓN OLS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3.5 items-stretch">
          
          <div className="lg:col-span-4 bg-slate-50 px-3 py-2.5 rounded-2xl border border-slate-200/80 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-1 mb-1">
              <label className="text-[10.5px] font-black uppercase tracking-wider text-blue-600 truncate">
                Eje X · Media: {formatearValorVariable(mediaXActual, metaEjeX.unidad)}
              </label>
              <span title={metaEjeX.descripcion} className="text-slate-400 hover:text-blue-600 cursor-help shrink-0">
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </div>
            <select
              value={ejeXId}
              onChange={(e) => setEjeXId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {CATALOGO_VARIABLES_CRUDAS.map(v => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4 bg-slate-50 px-3 py-2.5 rounded-2xl border border-slate-200/80 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-1 mb-1">
              <label className="text-[10.5px] font-black uppercase tracking-wider text-emerald-600 truncate">
                Eje Y · Media: {formatearValorVariable(mediaYActual, metaEjeY.unidad)}
              </label>
              <span title={metaEjeY.descripcion} className="text-slate-400 hover:text-emerald-600 cursor-help shrink-0">
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </div>
            <select
              value={ejeYId}
              onChange={(e) => setEjeYId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {CATALOGO_VARIABLES_CRUDAS.map(v => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4 bg-slate-900 text-white px-3.5 py-2.5 rounded-2xl border border-slate-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pearson (r):</span>
                <strong className={`text-xl font-black leading-none ${
                  regresionOLS.r >= 0.25 ? 'text-emerald-400' : regresionOLS.r <= -0.25 ? 'text-amber-400' : 'text-sky-400'
                }`}>
                  {rFormateado}
                </strong>
                <span className="text-[11px] font-bold text-slate-400">(R²={regresionOLS.r2Pct}%)</span>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border whitespace-nowrap ${etiquetaFuerzaCorrelacion.clase}`}>
                {etiquetaFuerzaCorrelacion.texto}
              </span>
            </div>

            <p className="text-[10.5px] text-slate-200 font-semibold pt-1.5 mt-1.5 border-t border-slate-800 leading-tight truncate" title={textoPendienteOLS}>
              📐 {textoPendienteOLS}.
            </p>
          </div>

        </div>

        {/* CUERPO PRINCIPAL: SCATTER PLOT + RADAR DE CORRELACIONES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
          
          <div className="lg:col-span-8 flex flex-col justify-between bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs">
            
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 text-[10.5px]">
              <div className="flex flex-wrap items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-blue-600 mr-0.5" aria-hidden="true" />
                {([
                  { id: 'todos' as FiltroCuadrante, label: `Todos (${filasUniversoPlano.length})` },
                  { id: 'q1_sup_izq' as FiltroCuadrante, label: `↖ X- Y+ (${conteoCuadrantes.q1})` },
                  { id: 'q2_sup_der' as FiltroCuadrante, label: `↗ X+ Y+ (${conteoCuadrantes.q2})` },
                  { id: 'q3_inf_izq' as FiltroCuadrante, label: `↙ X- Y- (${conteoCuadrantes.q3})` },
                  { id: 'q4_inf_der' as FiltroCuadrante, label: `↘ X+ Y- (${conteoCuadrantes.q4})` }
                ]).map(qItem => {
                  const act = filtroCuadrante === qItem.id;
                  return (
                    <button
                      key={qItem.id}
                      type="button"
                      onClick={() => setFiltroCuadrante(qItem.id)}
                      className={`px-2 py-1 rounded-lg font-bold border transition-all active:scale-95 cursor-pointer ${
                        act
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {qItem.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                <Crosshair className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                <select
                  aria-label="Resaltar una carrera en el gráfico"
                  value={carreraDestacadaCve}
                  onChange={(e) => setCarreraDestacadaCve(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-slate-800 focus:outline-none max-w-[175px] cursor-pointer"
                >
                  <option value="">Resaltar carrera en plano...</option>
                  {carrerasOrdenAlfabetico.map(c => (
                    <option key={c.cve_carrera} value={c.cve_carrera}>{c.nombre_carrera}</option>
                  ))}
                </select>
                {carreraDestacadaCve && (
                  <button
                    type="button"
                    onClick={() => setCarreraDestacadaCve('')}
                    aria-label="Quitar resaltado"
                    className="p-0.5 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="h-[315px] md:h-[340px] w-full">
              {!loading && filasPlanoVisibles.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 18, right: 24, bottom: 18, left: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      type="number"
                      dataKey={ejeXId}
                      name={metaEjeX.corto}
                      domain={dominioX}
                      tickFormatter={(v) => formatearTickEje(Number(v), metaEjeX.unidad)}
                      tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                    />
                    <YAxis
                      type="number"
                      dataKey={ejeYId}
                      name={metaEjeY.corto}
                      domain={dominioY}
                      width={52}
                      tickFormatter={(v) => formatearTickEje(Number(v), metaEjeY.unidad)}
                      tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                    />
                    <ZAxis type="number" dataKey="pea_activa" range={[55, 310]} name="PEA Activa" />

                    {Number.isFinite(mediaXActual) && (
                      <ReferenceLine
                        x={mediaXActual}
                        stroke="#64748B"
                        strokeDasharray="4 4"
                        strokeWidth={1.3}
                      />
                    )}
                    {Number.isFinite(mediaYActual) && (
                      <ReferenceLine
                        y={mediaYActual}
                        stroke="#64748B"
                        strokeDasharray="4 4"
                        strokeWidth={1.3}
                      />
                    )}

                    <RechartsTooltip
                      cursor={{ strokeDasharray: '3 3', stroke: '#64748B' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length > 0) {
                          const d = payload[0].payload;
                          if (!d || !d.cve_carrera) return null;
                          const sem = obtenerSemaforoScoreDataROI(d.score_dataroi);
                          return (
                            <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl border border-slate-700 shadow-2xl text-xs min-w-[235px]">
                              <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-slate-700">
                                <span className="font-mono text-[10px] text-slate-400">CVE: {d.cve_carrera}</span>
                                <span className="font-black text-emerald-400">Score: {d.score_dataroi}/100 (Grado {sem.grado})</span>
                              </div>
                              <p className="font-black text-sm text-white mb-2 leading-snug">{d.nombre_carrera}</p>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-3">
                                  <span className="text-slate-300">{metaEjeX.corto}:</span>
                                  <strong className="font-black text-blue-300">{formatearValorVariable(d[ejeXId], metaEjeX.unidad)}</strong>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-slate-300">{metaEjeY.corto}:</span>
                                  <strong className="font-black text-emerald-300">{formatearValorVariable(d[ejeYId], metaEjeY.unidad)}</strong>
                                </div>
                                <div className="flex justify-between gap-3 pt-1 border-t border-slate-800 text-[11px]">
                                  <span className="text-slate-400">Muestra física / PEA:</span>
                                  <strong className="text-slate-200">{d.n_encuestados.toLocaleString('es-MX')} enc. · {(d.pea_activa / 1000).toFixed(0)}k</strong>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {puntosLineaOLS.length === 2 && (
                      <Scatter
                        name="Tendencia Lineal OLS"
                        data={puntosLineaOLS}
                        line={{ stroke: '#0F172A', strokeWidth: 2, strokeDasharray: '6 4' }}
                        shape={() => <g />}
                        legendType="none"
                        isAnimationActive={false}
                      />
                    )}

                    <Scatter
                      name="Licenciaturas"
                      data={filasPlanoVisibles}
                      shape={(props: any) => {
                        const { cx, cy, payload, size } = props;
                        if (!Number.isFinite(cx) || !Number.isFinite(cy) || !payload) return <g />;
                        const sem = obtenerSemaforoScoreDataROI(payload.score_dataroi);
                        const etiq = mapaEtiquetasPlano.get(payload.cve_carrera);
                        const esDestacada = payload.cve_carrera === carreraDestacadaCve;
                        const radioBase = Math.max(4.5, Math.min(10.5, Math.sqrt(Number(size || 90) / Math.PI)));
                        const rDot = esDestacada ? Math.max(8, radioBase + 2) : radioBase;
                        const atenuarOtros = Boolean(carreraDestacadaCve) && !esDestacada;

                        return (
                          <g>
                            {esDestacada && (
                              <circle cx={cx} cy={cy} r={rDot + 5} fill="none" stroke="#2563EB" strokeWidth={2.5} opacity={0.85} />
                            )}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={rDot}
                              fill={sem.colorHex}
                              fillOpacity={atenuarOtros ? 0.32 : 0.85}
                              stroke={esDestacada ? '#1E3A8A' : '#FFFFFF'}
                              strokeWidth={esDestacada ? 2.2 : 1.5}
                            />
                            {etiq && (
                              <text
                                x={cx + etiq.dx}
                                y={cy + etiq.dy}
                                textAnchor={etiq.anchor}
                                fill={esDestacada ? '#1D4ED8' : '#0F172A'}
                                fontSize={esDestacada ? 10.5 : 9.5}
                                fontWeight={800}
                                style={{ paintOrder: 'stroke', stroke: '#FFFFFF', strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}
                              >
                                {etiq.texto}
                              </text>
                            )}
                          </g>
                        );
                      }}
                    >
                      {filasPlanoVisibles.map((entry, index) => {
                        const sem = obtenerSemaforoScoreDataROI(entry.score_dataroi);
                        return <Cell key={`cell-${index}`} fill={sem.colorHex} />;
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                  {loading ? 'Cargando microdatos del laboratorio...' : 'Sin carreras en este cuadrante o filtro'}
                </div>
              )}
            </div>

            <div className="mt-1.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-500">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Grado A
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Grado B
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Grado C
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full border-2 border-slate-400 inline-block" /> Tamaño = PEA Activa
                </span>
              </div>
              <span className="font-semibold text-slate-600">
                <span className="inline-block w-4 border-t-2 border-dashed border-slate-900 align-middle mr-1" />
                Línea OLS · Ejes: {metaEjeX.corto} (X) vs {metaEjeY.corto} (Y)
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" aria-hidden="true" /> Radar de Correlaciones
                </span>
                <span className="text-[10px] font-bold text-slate-400">Clic = cargar Eje X</span>
              </div>
              <h3 className="text-xs md:text-sm font-black text-slate-900 leading-tight mb-2.5">
                Asociaciones más fuertes con {metaEjeY.corto}
              </h3>

              <div className="mb-2.5">
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3" aria-hidden="true" /> Mayor Asociación Positiva (+r)
                </span>
                <div className="space-y-1">
                  {radarCorrelacionesContraY.positivas.length > 0 ? (
                    radarCorrelacionesContraY.positivas.map(item => {
                      const act = ejeXId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setEjeXId(item.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl border transition-all active:scale-98 cursor-pointer ${
                            act
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-slate-800 border-slate-200/80 hover:border-emerald-400'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11.5px] mb-1">
                            <span className="font-bold truncate pr-2">{item.corto}</span>
                            <strong className={`font-black text-[11px] shrink-0 ${act ? 'text-white' : 'text-emerald-700'}`}>
                              r = +{item.r.toFixed(2)}
                            </strong>
                          </div>
                          <div className={`w-full h-1 rounded-full overflow-hidden ${act ? 'bg-emerald-800' : 'bg-slate-100'}`}>
                            <div
                              className={`h-full rounded-full ${act ? 'bg-white' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, Math.abs(item.r) * 100)}%` }}
                            />
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Sin correlaciones positivas fuertes.</p>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1 mb-1">
                  <TrendingDown className="w-3 h-3" aria-hidden="true" /> Mayor Asociación Inversa (-r)
                </span>
                <div className="space-y-1">
                  {radarCorrelacionesContraY.negativas.length > 0 ? (
                    radarCorrelacionesContraY.negativas.map(item => {
                      const act = ejeXId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setEjeXId(item.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl border transition-all active:scale-98 cursor-pointer ${
                            act
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-white text-slate-800 border-slate-200/80 hover:border-amber-400'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11.5px] mb-1">
                            <span className="font-bold truncate pr-2">{item.corto}</span>
                            <strong className={`font-black text-[11px] shrink-0 ${act ? 'text-white' : 'text-amber-700'}`}>
                              r = {item.r.toFixed(2)}
                            </strong>
                          </div>
                          <div className={`w-full h-1 rounded-full overflow-hidden ${act ? 'bg-amber-800' : 'bg-slate-100'}`}>
                            <div
                              className={`h-full rounded-full ${act ? 'bg-white' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(100, Math.abs(item.r) * 100)}%` }}
                            />
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Sin correlaciones inversas fuertes.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200/80 text-[10px] text-slate-500">
              Universo: <strong>{filasUniversoPlano.length} carreras</strong> en {regionLabelCorto} ({etiquetaGeneroCorto}).
            </div>
          </div>

        </div>
      </div>

      {/* MÓDULO 2: EXPLORADOR DE RANKING PURO POR VARIABLE INDIVIDUAL + CINTA DE PERCENTILES */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 block mb-0.5">
              Ranking Univariado Puro · Las 10 Más y Catálogo Completo
            </span>
            <h2 className="text-lg md:text-xl font-black text-slate-900">
              Clasificación Directa por: {metaVarRanking.nombre}
            </h2>
            <p className="text-xs text-slate-500">
              {metaVarRanking.descripcion}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                value={busquedaTabla}
                onChange={(e) => setBusquedaTabla(e.target.value)}
                placeholder="Filtrar tabla por carrera o CVE..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              aria-label="Seleccionar variable cruda para ordenar el ranking"
              value={varRankingId}
              onChange={(e) => {
                const nuevaId = e.target.value;
                setVarRankingId(nuevaId);
                const meta = CATALOGO_VARIABLES_CRUDAS.find(v => v.id === nuevaId);
                if (meta) setOrdenDesc(meta.mejorAlto);
              }}
              className="bg-slate-900 text-white rounded-xl px-3.5 py-2 text-xs font-black cursor-pointer focus:outline-none"
            >
              {CATALOGO_VARIABLES_CRUDAS.map(v => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setOrdenDesc(prev => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-black text-slate-800 border border-slate-200 active:scale-95 transition-all cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
              {ordenDesc ? 'Mayor a Menor (Top)' : 'Menor a Mayor'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5 text-xs">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Percentil 10 (P10 · Piso)
            </span>
            <strong className="text-base font-black text-slate-800 mt-0.5 block">
              {formatearValorVariable(estadisticosTabla.p10, metaVarRanking.unidad)}
            </strong>
            <span className="text-[10px] text-slate-400">Mín: {formatearValorVariable(estadisticosTabla.min, metaVarRanking.unidad)}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Mediana (P50 · Carrera Típica)
            </span>
            <strong className="text-base font-black text-slate-900 mt-0.5 block">
              {formatearValorVariable(estadisticosTabla.p50, metaVarRanking.unidad)}
            </strong>
            <span className="text-[10px] text-slate-400">Mitad exacta de la distribución</span>
          </div>

          <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
              Media Ponderada Regional
            </span>
            <strong className="text-base font-black text-blue-700 mt-0.5 block">
              {formatearValorVariable(mediaVariables[varRankingId] ?? 0, metaVarRanking.unidad)}
            </strong>
            <span className="text-[10px] text-blue-600/80">Ponderada por volumen PEA</span>
          </div>

          <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
              Percentil 90 (P90 · Élite)
            </span>
            <strong className="text-base font-black text-emerald-700 mt-0.5 block">
              {formatearValorVariable(estadisticosTabla.p90, metaVarRanking.unidad)}
            </strong>
            <span className="text-[10px] text-emerald-700/80">Máx: {formatearValorVariable(estadisticosTabla.max, metaVarRanking.unidad)}</span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block">
              Media Pond. STEM vs. Otras
            </span>
            <strong className="text-xs font-black text-indigo-900 mt-1 block">
              STEM: {formatearValorVariable(estadisticosTabla.mediaStem, metaVarRanking.unidad)}
            </strong>
            <span className="text-[10.5px] font-semibold text-indigo-700 block mt-0.5">
              Otras: {formatearValorVariable(estadisticosTabla.mediaNoStem, metaVarRanking.unidad)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="py-3 px-3.5 font-black w-14">#</th>
                <th className="py-3 px-4 font-black">Licenciatura Auditada</th>
                <th className="py-3 px-4 font-black min-w-[240px]">
                  {metaVarRanking.corto} (Media: {formatearValorVariable(mediaVariables[varRankingId] ?? 0, metaVarRanking.unidad)})
                </th>
                <th className="py-3 px-3.5 font-black text-right">{colSecundaria1.label}</th>
                <th className="py-3 px-3.5 font-black text-right">{colSecundaria2.label}</th>
                <th className="py-3 px-3.5 font-black text-center">Score DataROI</th>
                <th className="py-3 px-3.5 font-black text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filasTablaVisibles.map((f, idx) => {
                const valorActual = Number(f[varRankingId] || 0);
                const mediaRef = Number(mediaVariables[varRankingId] || 0);
                const diffMedia = valorActual - mediaRef;
                const pctBarra = Math.max(8, Math.min(100, (Math.abs(valorActual) / maxValorVariableRanking) * 100));

                const esFavorable = metaVarRanking.mejorAlto ? valorActual >= mediaRef : valorActual <= mediaRef;
                const sem = obtenerSemaforoScoreDataROI(f.score_dataroi);

                const idxVersus = cvesVersus.indexOf(f.cve_carrera);
                const enComparador = idxVersus !== -1;
                const topeComp = !enComparador && cvesVersus.length >= 3;
                const slotEstilo = enComparador ? COLORES_SLOTS_VERSUS[idxVersus] || COLORES_SLOTS_VERSUS[0] : null;

                return (
                  <tr key={f.cve_carrera} className="even:bg-slate-50/60 hover:bg-blue-50/40 transition-colors">
                    <td className="py-3 px-3.5 font-black text-slate-700">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {f.cve_carrera}
                        </span>
                        <Link
                          href={`/carrera/${f.cve_carrera}?region=${regionActiva}&genero=${queryGeneroParam}`}
                          className="font-black text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {f.nombre_carrera}
                        </Link>
                      </div>
                      <span className="text-[10.5px] text-slate-400 block mt-0.5">
                        Muestra: {f.n_encuestados.toLocaleString('es-MX')} enc. · PEA: {f.pea_activa.toLocaleString('es-MX')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between mb-1">
                        <strong className="text-sm font-black text-slate-900">
                          {formatearValorVariable(valorActual, metaVarRanking.unidad)}
                        </strong>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                          esFavorable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {formatearDiferencialMedia(diffMedia, metaVarRanking.unidad)} vs. Media
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                        <div
                          className={`h-full rounded-full ${
                            esFavorable
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                              : 'bg-gradient-to-r from-amber-500 to-orange-400'
                          }`}
                          style={{ width: `${pctBarra}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-right font-black text-slate-800 whitespace-nowrap">
                      {formatearValorVariable(Number(f[colSecundaria1.id] || 0), colSecundaria1.unidad)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-blue-600 whitespace-nowrap">
                      {formatearValorVariable(Number(f[colSecundaria2.id] || 0), colSecundaria2.unidad)}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-xs border ${sem.bgBadgeClass}`}>
                        {f.score_dataroi} · Grado {sem.grado}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={topeComp}
                          onClick={() => handleToggleComparar(f.cve_carrera)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all active:scale-95 ${
                            enComparador && slotEstilo
                              ? `${slotEstilo.btnClass} cursor-pointer`
                              : topeComp
                                ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-500 hover:text-blue-600 cursor-pointer'
                          }`}
                        >
                          {enComparador ? `Versus #${idxVersus + 1}` : '+ Comparar'}
                        </button>
                        <Link
                          href={`/carrera/${f.cve_carrera}?region=${regionActiva}&genero=${queryGeneroParam}`}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition-colors"
                          title="Abrir auditoría completa de la carrera"
                        >
                          <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filasTablaFiltradasYOrdenadas.length > 12 && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setMostrarTodasTabla(prev => !prev)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all active:scale-95 cursor-pointer"
            >
              {mostrarTodasTabla ? (
                <>
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  Contraer a las Top 12 carreras
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  Ver las {filasTablaFiltradasYOrdenadas.length} carreras completas en la tabla
                </>
              )}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

export default function LaboratorioPage() {
  return (
    <main className="font-sans">
      <Suspense
        fallback={
          <div className="min-h-[80vh] flex flex-col items-center justify-center p-6">
            <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-slate-500 text-sm font-medium">Cargando Laboratorio de Datos Crudos INEGI...</p>
          </div>
        }
      >
        <LaboratorioContenido />
      </Suspense>
    </main>
  );
}