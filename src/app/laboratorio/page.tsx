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
import { BENCHMARK_PREPA, ESTADOS_POR_REGION } from '@/components/GraficaPredictiva';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import {
  FlaskConical, Search, Microscope, ArrowUpDown, Download,
  FileSpreadsheet, MapPin, Users, Scale, Check, ChevronRight,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Sparkles, Filter
} from 'lucide-react';

type CodigoGenero = 0 | 1 | 2;
type FiltroCuadrante = 'todos' | 'q1_sup_izq' | 'q2_sup_der' | 'q3_inf_izq' | 'q4_inf_der';

const REGIONES_ORDEN = ['nacional', 'norte', 'noroeste', 'bajio', 'centro', 'sur'] as const;

const REGIONES_INFO: Record<string, { nombre: string; corto: string; estados: string }> = {
  nacional: { nombre: 'Nacional (Todo México)', corto: 'Nacional', estados: 'Promedio de las 32 entidades' },
  norte: { nombre: 'Norte Industrial', corto: 'Norte', estados: 'BC, Coah, Chih, NL, Son, Tamps' },
  noroeste: { nombre: 'Noroeste / Pacífico', corto: 'Noroeste', estados: 'BCS, Dgo, Nay, Sin' },
  bajio: { nombre: 'Occidente - Bajío', corto: 'Bajío-Occ.', estados: 'Ags, Col, Gto, Jal, Mich, Qro, SLP, Zac' },
  centro: { nombre: 'Centro / Valle de México', corto: 'Centro', estados: 'CDMX, Edomex, Hgo, Mor, Pue, Tlax' },
  sur: { nombre: 'Sur - Sureste / Golfo', corto: 'Sur-Sureste', estados: 'Camp, Chis, Gro, Oax, Q.Roo, Tab, Ver, Yuc' }
};

const PARIDAD_REGIONAL_LIC: Record<string, number> = {
  nacional: 1.0,
  norte: 17917 / 15534,
  noroeste: 15495 / 15534,
  bajio: 14742 / 15534,
  centro: 16000 / 15534,
  sur: 13023 / 15534
};

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
  { id: 'sueldo_mensual', nombre: 'Salario Mensual Consolidado (MXN)', corto: 'Salario Mensual', unidad: 'MXN', mejorAlto: true, pasoInterpretacion: 1000, descripcion: 'Ingreso mensual promedio observado en microdatos ENOE (pesos constantes 2026).' },
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
  { label: '🎓 Estrato Origen vs. Salario', x: 'indice_privilegio', y: 'sueldo_mensual' },
  { label: '🤖 Riesgo IA vs. Salario', x: 'riesgo_ia_score', y: 'sueldo_mensual' },
  { label: '🏥 Seguro SGMM vs. Salario', x: 'pct_sgmm', y: 'sueldo_mensual' },
  { label: '🤝 Nepotismo vs. Calidad OIT', x: 'pct_nepotismo', y: 'calidad_oit_pct' },
  { label: '📈 Saturación vs. Desempleo', x: 'saturacion_pct', y: 'tasa_desempleo' },
  { label: '🏠 Home Office vs. Salario', x: 'pct_home_office', y: 'sueldo_mensual' }
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

function calcularPercentil(valoresOrdenadosAsc: number[], p: number): number {
  if (valoresOrdenadosAsc.length === 0) return 0;
  const idx = (valoresOrdenadosAsc.length - 1) * p;
  const base = Math.floor(idx);
  const rest = idx - base;
  if (valoresOrdenadosAsc[base + 1] !== undefined) {
    return valoresOrdenadosAsc[base] + rest * (valoresOrdenadosAsc[base + 1] - valoresOrdenadosAsc[base]);
  }
  return valoresOrdenadosAsc[base];
}

function LaboratorioContenido() {
  const [regionActiva, setRegionActiva] = useState<string>('nacional');
  const [generoActivo, setGeneroActivo] = useState<CodigoGenero>(0);
  const [busqueda, setBusqueda] = useState<string>('');
  const [soloStem, setSoloStem] = useState<boolean>(false);
  const [filtroCuadrante, setFiltroCuadrante] = useState<FiltroCuadrante>('todos');

  const [varRankingId, setVarRankingId] = useState<string>('sueldo_mensual');
  const [ordenDesc, setOrdenDesc] = useState<boolean>(true);
  const [mostrarTodasTabla, setMostrarTodasTabla] = useState<boolean>(false);

  const [ejeXId, setEjeXId] = useState<string>('indice_privilegio');
  const [ejeYId, setEjeYId] = useState<string>('sueldo_mensual');

  const [carrerasRaw, setCarrerasRaw] = useState<any[]>([]);
  const [satelitesRaw, setSatelitesRaw] = useState<any[]>([]);
  const [seriesRaw, setSeriesRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cvesVersus, setCvesVersus] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      const nueva = leerEstadoDescubridorGlobal().carrerasCompararCves || [];
      setCvesVersus(prev => (prev.join(',') === nueva.join(',') ? prev : nueva));
    };
    sync();
    window.addEventListener(EVENTO_VERSUS_SYNC, sync);
    return () => window.removeEventListener(EVENTO_VERSUS_SYNC, sync);
  }, []);

  const handleToggleComparar = (cve: string) => {
    const nueva = toggleCarreraComparadorGlobal(cve);
    setCvesVersus(nueva);
  };

  useEffect(() => {
    async function cargarDatosCrudos() {
      setLoading(true);
      const descargarPaginado = async (tabla: string, columnas: string, filtroTipoReal = false) => {
        const PAGE = 1000;
        let acum: any[] = [];
        let desde = 0;
        while (true) {
          let q = supabase.from(tabla).select(columnas).range(desde, desde + PAGE - 1);
          if (filtroTipoReal) {
            q = q.eq('tipo_dato', 'Real');
          }
          const { data, error } = await q;
          if (error || !data || data.length === 0) break;
          acum = acum.concat(data);
          if (data.length < PAGE) break;
          desde += PAGE;
        }
        return acum;
      };

      const [resCar, resSat, resSer] = await Promise.all([
        supabase.from('dim_carreras').select('cve_carrera, nombre_carrera'),
        descargarPaginado('satelites_cultura', '*'),
        descargarPaginado(
          'predicciones_roi',
          'cve_carrera, cve_ent, anio, sexo, poblacion_activa_total, desempleados_reales, sueldo_promedio_mensual, indice_saturacion_pct, is_stem, tipo_dato',
          true
        )
      ]);

      setCarrerasRaw((resCar.data || []).filter(c => String(c.cve_carrera).padStart(6, '0') !== '999999'));
      setSatelitesRaw(resSat);
      setSeriesRaw(resSer);
      setLoading(false);
    }

    cargarDatosCrudos();
  }, []);

  // Resetear el filtro de cuadrante cuando cambian los ejes o la región
  useEffect(() => {
    setFiltroCuadrante('todos');
  }, [ejeXId, ejeYId, regionActiva, generoActivo]);

  const { filasActivas, mediaVariables, censoDemografico } = useMemo(() => {
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
      return { filasActivas: [], mediaVariables: {} as Record<string, number>, censoDemografico: censoVacio };
    }

    const padCve = (c: any) => String(c).padStart(6, '0');
    const benchReg = BENCHMARK_PREPA[regionActiva] || BENCHMARK_PREPA.nacional;
    const sueldoPrepaRef =
      generoActivo === 1 ? benchReg.sueldo_hombres :
      generoActivo === 2 ? benchReg.sueldo_mujeres :
      benchReg.sueldo_general;

    const mapaSat: Record<string, any> = {};
    satelitesRaw.forEach(s => {
      const k = `${padCve(s.cve_carrera)}_${String(s.region || 'nacional').toLowerCase().trim()}_${Number(s.sexo ?? 0)}`;
      mapaSat[k] = s;
    });

    const mapaSeries: Record<string, any[]> = {};
    seriesRaw.forEach(r => {
      const cve = padCve(r.cve_carrera);
      const entRaw = String(r.cve_ent || 'nacional').toLowerCase().trim();
      const sx = Number(r.sexo ?? 0);
      let regDest = entRaw;
      if (entRaw === '0' || entRaw === '00' || entRaw === 'nacional') {
        regDest = 'nacional';
      } else if (!REGIONES_ORDEN.includes(entRaw as any)) {
        const entPad = entRaw.padStart(2, '0');
        const enc = Object.entries(ESTADOS_POR_REGION).find(([, l]) => l.includes(entPad));
        if (enc) regDest = enc[0];
      }
      const k = `${cve}_${regDest}_${sx}`;
      if (!mapaSeries[k]) mapaSeries[k] = [];
      mapaSeries[k].push(r);
    });

    const obtenerSerie = (cve: string, reg: string, sx: number) => {
      const dir = mapaSeries[`${cve}_${reg}_${sx}`];
      if (dir && dir.length > 0) return dir;
      if (sx === 0) {
        return [...(mapaSeries[`${cve}_${reg}_1`] || []), ...(mapaSeries[`${cve}_${reg}_2`] || [])];
      }
      return [];
    };

    const calcPond = (filas: any[]) => {
      const val = filas.filter(r => Number(r.sueldo_promedio_mensual || 0) > 0);
      if (val.length === 0) return 0;
      const pob = val.reduce((a, b) => a + Math.max(1, Number(b.poblacion_activa_total || 1)), 0);
      return pob > 0
        ? val.reduce((a, b) => a + Number(b.sueldo_promedio_mensual) * Math.max(1, Number(b.poblacion_activa_total || 1)), 0) / pob
        : 0;
    };

    // Cálculo de composición de género regional (Hombres vs Mujeres) en la región activa
    let peaAcumHombres = 0;
    let prodSueldoHombres = 0;
    let peaAcumMujeres = 0;
    let prodSueldoMujeres = 0;

    carrerasRaw.forEach(c => {
      const cve = padCve(c.cve_carrera);
      const esStemCve = cve.startsWith('05') || cve.startsWith('06') || cve.startsWith('07');
      if (soloStem && !esStemCve) return;

      const sH = obtenerSerie(cve, regionActiva, 1).filter(r => r.anio >= 2022 && r.anio <= 2026);
      const sM = obtenerSerie(cve, regionActiva, 2).filter(r => r.anio >= 2022 && r.anio <= 2026);

      if (sH.length > 0) {
        const pH = sH.reduce((a, b) => a + Number(b.poblacion_activa_total || 0), 0) / sH.length;
        const salH = calcPond(sH);
        if (pH > 0 && salH > 0) {
          peaAcumHombres += pH;
          prodSueldoHombres += salH * pH;
        }
      }
      if (sM.length > 0) {
        const pM = sM.reduce((a, b) => a + Number(b.poblacion_activa_total || 0), 0) / sM.length;
        const salM = calcPond(sM);
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
      if (!satNac0 || Number(satNac0.n_encuestados_reales || 0) < 180) return;

      const satCelda = mapaSat[`${cve}_${regionActiva}_${generoActivo}`];
      if (!satCelda) return;

      const nEnc = Number(satCelda.n_encuestados_reales || 0);
      const minRequerido = regionActiva === 'nacional' ? (generoActivo === 0 ? 180 : 25) : (generoActivo === 0 ? 30 : 25);
      if (nEnc < minRequerido) return;

      const serieNacSx = obtenerSerie(cve, 'nacional', generoActivo);
      const fNac25_26 = serieNacSx.filter(r => r.anio === 2025 || r.anio === 2026);
      const sueldoNacRef = Math.round(calcPond(fNac25_26.length > 0 ? fNac25_26 : serieNacSx));

      const serieCelda = obtenerSerie(cve, regionActiva, generoActivo);
      const f25_26 = serieCelda.filter(r => r.anio === 2025 || r.anio === 2026);
      const f22_26 = serieCelda.filter(r => r.anio >= 2022 && r.anio <= 2026);
      const loteEmp = f22_26.length > 0 ? f22_26 : serieCelda;

      const sueldoCrudo = calcPond(f25_26.length > 0 ? f25_26 : loteEmp);
      const nKish = Number(satCelda.n_efectivo_kish || 0);
      const sueldoMensual = regionActiva === 'nacional'
        ? Math.round(sueldoCrudo || sueldoNacRef)
        : (sueldoCrudo > 0
            ? (nKish > 0 ? calcularSueldoRegionalBuhlmann(sueldoCrudo, sueldoNacRef, regionActiva, nKish) : Math.round(sueldoCrudo))
            : sueldoNacRef);

      if (sueldoMensual <= 0) return;

      const peaActiva = loteEmp.length > 0
        ? Math.round(loteEmp.reduce((a, b) => a + Number(b.poblacion_activa_total || 0), 0) / loteEmp.length)
        : Number(satCelda.volumen_muestra_nacional || 1000);

      const sumaPea = loteEmp.reduce((a, b) => a + Number(b.poblacion_activa_total || 0), 0);
      const sumaDes = loteEmp.reduce((a, b) => a + Number(b.desempleados_reales || 0), 0);
      const tasaDesempleo = sumaPea > 0 ? Number(Math.max(0.8, (sumaDes / sumaPea) * 100).toFixed(1)) : 3.2;

      const filaRec = serieCelda.find(r => r.anio === 2026) || serieCelda[serieCelda.length - 1] || serieNacSx[serieNacSx.length - 1];
      const saturacionPct = Math.round(Number(filaRec?.indice_saturacion_pct || 92));
      const isStem = Boolean(filaRec?.is_stem) || cve.startsWith('05') || cve.startsWith('06') || cve.startsWith('07');

      const pCont = Number(satCelda.pct_contrato || 65);
      const pAgui = Number(satCelda.pct_aguinaldo || 63);
      const pAfor = Number(satCelda.pct_afore || 55);
      const pPlur = Number(satCelda.pct_pluriempleo || 5.6);
      const pDesa = Number(satCelda.pct_desarraigo || 2.7);
      const pPyme = Number(satCelda.pct_pyme || 30);
      const pCorp = Number(satCelda.pct_corp || 12);
      const pMicro = Number(satCelda.pct_micro || 25);
      const pGob = Number(satCelda.pct_gobierno || 18);
      const pSind = Number(satCelda.pct_sindicato || 15);
      const pSgmm = Number(satCelda.pct_sgmm || 8);
      const pMat = Number(satCelda.pct_materno ?? satNac0.pct_materno ?? 23);
      const pHo = Number(satCelda.pct_home_office || 3.5);
      const pNep = Number(satCelda.pct_nepotismo || 37.2);
      const priv = Number(satCelda.indice_privilegio || 2.80);
      const riesgoIA = Number(satCelda.riesgo_ia_score ?? 40);

      const hrsH = Number(satCelda.hrs_doble_jornada_hombres || 9.6);
      const hrsM = Number(satCelda.hrs_doble_jornada_mujeres || 21.1);
      const hrsHogar = generoActivo === 1 ? hrsH : generoActivo === 2 ? hrsM : Number(((hrsH + hrsM) / 2).toFixed(1));

      const calidadOitPct = Number((((Math.min(pCont, pAfor) * 0.70 + pCont * 0.30) * (1 - pPlur / 200))).toFixed(1));
      const formalidadPct = Number((pCont * 0.45 + pAgui * 0.30 + pAfor * 0.25).toFixed(1));
      const primaPrepaPct = Number((((sueldoMensual - sueldoPrepaRef) / sueldoPrepaRef) * 100).toFixed(1));

      const diffEst = priv - 2.80;
      const penElit = diffEst > 0.05 ? (diffEst - 0.05) * 110 : diffEst * 35;
      const incOrig = Math.max(15, Math.min(92, 70 - penElit));
      const apContr = Math.max(10, Math.min(95, 100 - (pNep + pSind * 0.22)));
      const saltoSc = Math.max(0, Math.min(100, primaPrepaPct));
      const impAsc = saltoSc * 0.45 + calidadOitPct * 0.35 + Math.min(100, pCorp * 2.2 + pPyme * 0.6) * 0.20;
      const meritoPct = Number(Math.max(12, Math.min(96, apContr * 0.40 + impAsc * 0.35 + incOrig * 0.25)).toFixed(1));

      const evalScore = calcularScoreDataROIUniversal({
        Prima_vs_Prepa_Pct: primaPrepaPct,
        Desempleo_Abierto_Pct: tasaDesempleo,
        Saturacion_ANUIES_Pct: saturacionPct,
        Empleo_Calidad_OIT_Pct: calidadOitPct,
        Formalidad_Total_Pct: formalidadPct,
        Meritocracia_Pct: meritoPct,
        Blindaje_IA_Pct: 100 - riesgoIA,
        Tendencia_Codigo: 'estable',
        Empleo_Unico_Pct: Math.max(0, 100 - pPlur),
        Arraigo_Local_Pct: Math.max(0, 100 - pDesa)
      });

      listaProcesada.push({
        cve_carrera: cve,
        nombre_carrera: formatearNombreCarreraEjecutivo(cve, c.nombre_carrera),
        nombre_oficial: c.nombre_carrera,
        is_stem: isStem,
        n_encuestados: nEnc,
        pea_activa: peaActiva,
        score_dataroi: Math.round(evalScore.score),
        sueldo_mensual: sueldoMensual,
        prima_prepa_pct: primaPrepaPct,
        calidad_oit_pct: calidadOitPct,
        formalidad_pct: formalidadPct,
        tasa_desempleo: tasaDesempleo,
        saturacion_pct: saturacionPct,
        riesgo_ia_score: riesgoIA,
        blindaje_ia_pct: 100 - riesgoIA,
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
  }, [carrerasRaw, satelitesRaw, seriesRaw, regionActiva, generoActivo, soloStem]);

  const metaVarRanking = CATALOGO_VARIABLES_CRUDAS.find(v => v.id === varRankingId) || CATALOGO_VARIABLES_CRUDAS[0];
  const metaEjeX = CATALOGO_VARIABLES_CRUDAS.find(v => v.id === ejeXId) || CATALOGO_VARIABLES_CRUDAS[8];
  const metaEjeY = CATALOGO_VARIABLES_CRUDAS.find(v => v.id === ejeYId) || CATALOGO_VARIABLES_CRUDAS[0];

  const filasBaseSinCuadrante = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return filasActivas.filter(f => {
      const pasaTexto = !q || f.nombre_carrera.toLowerCase().includes(q) || f.nombre_oficial.toLowerCase().includes(q) || f.cve_carrera.includes(q);
      const pasaStem = soloStem ? f.is_stem : true;
      return pasaTexto && pasaStem;
    });
  }, [filasActivas, busqueda, soloStem]);

  const mediaXActual = mediaVariables[ejeXId] ?? 0;
  const mediaYActual = mediaVariables[ejeYId] ?? 0;

  // Conteo de carreras en cada uno de los 4 cuadrantes del plano cartesiano
  const conteoCuadrantes = useMemo(() => {
    let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
    filasBaseSinCuadrante.forEach(f => {
      const vx = Number(f[ejeXId] || 0);
      const vy = Number(f[ejeYId] || 0);
      if (vx < mediaXActual && vy >= mediaYActual) q1++;
      else if (vx >= mediaXActual && vy >= mediaYActual) q2++;
      else if (vx < mediaXActual && vy < mediaYActual) q3++;
      else q4++;
    });
    return { q1, q2, q3, q4 };
  }, [filasBaseSinCuadrante, ejeXId, ejeYId, mediaXActual, mediaYActual]);

  const filasFiltradasYOrdenadas = useMemo(() => {
    const filtradasPorCuadrante = filasBaseSinCuadrante.filter(f => {
      if (filtroCuadrante === 'todos') return true;
      const vx = Number(f[ejeXId] || 0);
      const vy = Number(f[ejeYId] || 0);
      if (filtroCuadrante === 'q1_sup_izq') return vx < mediaXActual && vy >= mediaYActual;
      if (filtroCuadrante === 'q2_sup_der') return vx >= mediaXActual && vy >= mediaYActual;
      if (filtroCuadrante === 'q3_inf_izq') return vx < mediaXActual && vy < mediaYActual;
      if (filtroCuadrante === 'q4_inf_der') return vx >= mediaXActual && vy < mediaYActual;
      return true;
    });

    return [...filtradasPorCuadrante].sort((a, b) => {
      const va = Number(a[varRankingId] || 0);
      const vb = Number(b[varRankingId] || 0);
      if (va !== vb) return ordenDesc ? vb - va : va - vb;
      return b.sueldo_mensual - a.sueldo_mensual;
    });
  }, [filasBaseSinCuadrante, filtroCuadrante, ejeXId, ejeYId, mediaXActual, mediaYActual, varRankingId, ordenDesc]);

  // Regresión Lineal OLS (r, R², Pendiente y Puntos para la Recta Diagonal)
  const regresionOLS = useMemo(() => {
    const xs = filasBaseSinCuadrante.map(f => Number(f[ejeXId] || 0));
    const ys = filasBaseSinCuadrante.map(f => Number(f[ejeYId] || 0));
    return calcularRegresionLinealOLS(xs, ys);
  }, [filasBaseSinCuadrante, ejeXId, ejeYId]);

  const puntosLineaOLS = useMemo(() => {
    if (filasBaseSinCuadrante.length < 3 || regresionOLS.minX === regresionOLS.maxX) return [];
    return [
      { [ejeXId]: regresionOLS.minX, [ejeYId]: Number((regresionOLS.intercept + regresionOLS.slope * regresionOLS.minX).toFixed(2)) },
      { [ejeXId]: regresionOLS.maxX, [ejeYId]: Number((regresionOLS.intercept + regresionOLS.slope * regresionOLS.maxX).toFixed(2)) }
    ];
  }, [filasBaseSinCuadrante.length, regresionOLS, ejeXId, ejeYId]);

  // Identificación de los 6 casos extremos (outliers) para etiquetarlos directamente en el gráfico
  const cvesOutliersEtiquetados = useMemo(() => {
    if (filasBaseSinCuadrante.length === 0) return new Set<string>();
    const porY = [...filasBaseSinCuadrante].sort((a, b) => Number(b[ejeYId] || 0) - Number(a[ejeYId] || 0));
    const porX = [...filasBaseSinCuadrante].sort((a, b) => Number(b[ejeXId] || 0) - Number(a[ejeXId] || 0));
    const seleccionados = new Set<string>();
    if (porY[0]) seleccionados.add(porY[0].cve_carrera);
    if (porY[1]) seleccionados.add(porY[1].cve_carrera);
    if (porY[porY.length - 1]) seleccionados.add(porY[porY.length - 1].cve_carrera);
    if (porX[0]) seleccionados.add(porX[0].cve_carrera);
    if (porX[porX.length - 1]) seleccionados.add(porX[porX.length - 1].cve_carrera);
    return seleccionados;
  }, [filasBaseSinCuadrante, ejeXId, ejeYId]);

  // Radar Automático de Correlaciones (Variable Y actual contra todas las demás 23 variables)
  const radarCorrelacionesContraY = useMemo(() => {
    if (filasBaseSinCuadrante.length < 4) return { positivas: [], negativas: [] };
    const ys = filasBaseSinCuadrante.map(f => Number(f[ejeYId] || 0));
    const lista = CATALOGO_VARIABLES_CRUDAS
      .filter(v => v.id !== ejeYId)
      .map(v => {
        const xs = filasBaseSinCuadrante.map(f => Number(f[v.id] || 0));
        const { r } = calcularRegresionLinealOLS(xs, ys);
        return { ...v, r };
      });

    const positivas = [...lista].filter(x => x.r > 0.05).sort((a, b) => b.r - a.r).slice(0, 4);
    const negativas = [...lista].filter(x => x.r < -0.05).sort((a, b) => a.r - b.r).slice(0, 4);
    return { positivas, negativas };
  }, [filasBaseSinCuadrante, ejeYId]);

  // Estadísticos de Distribución (P10, Mediana P50, P90 y Brecha STEM) para la variable de la tabla
  const estadisticosTabla = useMemo(() => {
    if (filasFiltradasYOrdenadas.length === 0) {
      return { p10: 0, p50: 0, p90: 0, min: 0, max: 0, mediaStem: 0, mediaNoStem: 0 };
    }
    const valsAsc = filasFiltradasYOrdenadas.map(f => Number(f[varRankingId] || 0)).sort((a, b) => a - b);
    const stemRows = filasFiltradasYOrdenadas.filter(f => f.is_stem);
    const noStemRows = filasFiltradasYOrdenadas.filter(f => !f.is_stem);

    const mediaStem = stemRows.length > 0
      ? stemRows.reduce((a, b) => a + Number(b[varRankingId] || 0), 0) / stemRows.length
      : 0;
    const mediaNoStem = noStemRows.length > 0
      ? noStemRows.reduce((a, b) => a + Number(b[varRankingId] || 0), 0) / noStemRows.length
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
  }, [filasFiltradasYOrdenadas, varRankingId]);

  const maxValorVariableRanking = useMemo(() => {
    if (filasFiltradasYOrdenadas.length === 0) return 100;
    return Math.max(...filasFiltradasYOrdenadas.map(f => Math.abs(Number(f[varRankingId] || 0))), 1);
  }, [filasFiltradasYOrdenadas, varRankingId]);

  const filasTablaVisibles = mostrarTodasTabla ? filasFiltradasYOrdenadas : filasFiltradasYOrdenadas.slice(0, 12);
  const queryGeneroParam = generoActivo === 2 ? 'mujeres' : generoActivo === 1 ? 'hombres' : 'total';
  const etiquetaGeneroCorto = generoActivo === 2 ? 'Solo Mujeres' : generoActivo === 1 ? 'Solo Hombres' : 'Total General';

  // Texto de traducción humana de la pendiente OLS
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

  // Columnas secundarias dinámicas para la tabla (evita repetir Salario Mensual o Calidad OIT si ya están elegidas)
  const colSecundaria1 = varRankingId === 'sueldo_mensual'
    ? { id: 'prima_prepa_pct', label: 'Prima vs. Prepa', unidad: '%' as const }
    : { id: 'sueldo_mensual', label: 'Salario Mensual', unidad: 'MXN' as const };

  const colSecundaria2 = varRankingId === 'calidad_oit_pct'
    ? { id: 'saturacion_pct', label: 'Saturación ANUIES', unidad: '%' as const }
    : { id: 'calidad_oit_pct', label: 'Calidad OIT', unidad: '%' as const };

  const exportarBaseCrudaExcel = () => {
    if (filasFiltradasYOrdenadas.length === 0) return;
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

    const filas: ValorCeldaExcel[][] = filasFiltradasYOrdenadas.map((f, idx) => [
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
      `DataROI_Laboratorio_Crudo_${regionActiva}_${queryGeneroParam}.xlsx`,
      [
        {
          nombre: '1_Matriz_24_Variables_Crudas',
          cabeceras,
          filas
        },
        {
          nombre: '2_Diccionario_Variables',
          cabeceras: ['Clave_Variable', 'Nombre_Indicador', 'Media_Regional_Ponderada', 'Descripcion_Metodologica_INEGI_ANUIES'],
          filas: CATALOGO_VARIABLES_CRUDAS.map(v => [
            v.id,
            { v: v.nombre, s: 'bold' },
            formatearValorVariable(mediaVariables[v.id] ?? 0, v.unidad),
            v.descripcion
          ])
        }
      ]
    );
  };

  const exportarBaseCrudaCSV = () => {
    if (filasFiltradasYOrdenadas.length === 0) return;
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
    const filas: ValorCeldaExcel[][] = filasFiltradasYOrdenadas.map((f, idx) => [
      idx + 1,
      f.cve_carrera,
      f.nombre_carrera,
      f.is_stem ? 'Sí' : 'No',
      f.n_encuestados,
      f.pea_activa,
      f.score_dataroi,
      ...CATALOGO_VARIABLES_CRUDAS.map(v => Number(f[v.id] ?? 0))
    ]);
    descargarCSVEstilizado(`DataROI_Laboratorio_Crudo_${regionActiva}_${queryGeneroParam}.csv`, cabeceras, filas);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:px-8 md:py-4 space-y-5 pb-16">
      
      {/* CABECERA COMPACTA + CENSO DEMOGRÁFICO REACTIVO DEL FILTRO ACTUAL */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white rounded-3xl p-5 md:p-6 shadow-lg border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider">
                <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" /> Auditoría de Variables Puras · Cero Fórmulas Compuestas
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {REGIONES_INFO[regionActiva]?.nombre} · {etiquetaGeneroCorto}
              </span>
            </div>
            <h1 className="text-xl md:text-3xl font-black tracking-tight">
              Laboratorio de Datos Crudos, Censo y Correlaciones
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={exportarBaseCrudaExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs transition-all cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" /> Descargar Base Excel (24 Vars)
            </button>
            <button
              onClick={exportarBaseCrudaCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-400" aria-hidden="true" /> CSV Crudo
            </button>
          </div>
        </div>

        {/* CINTA DE CENSO DEMOGRÁFICO Y BRECHAS ESTRUCTURALES EN VIVO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/90 text-xs">
          
          {/* Tarjeta 1: Muestra Física INEGI */}
          <div className="bg-slate-800/85 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Muestra Física Auditada (Filtro Activo)
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <strong className="text-xl font-black text-white">
                {censoDemografico.encuestadosTotalFiltro.toLocaleString('es-MX')} enc.
              </strong>
              <span className="text-[11px] font-bold text-emerald-400">
                {filasBaseSinCuadrante.length} carreras
              </span>
            </div>
            <span className="text-[10.5px] text-slate-400 mt-1">
              Profesionistas encuestados en microdatos ENOE
            </span>
          </div>

          {/* Tarjeta 2: Fuerza Laboral (PEA Activa) */}
          <div className="bg-slate-800/85 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Fuerza Laboral Representada (PEA)
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <strong className="text-xl font-black text-sky-400">
                {censoDemografico.peaTotalFiltro.toLocaleString('es-MX')}
              </strong>
              <span className="text-[11px] font-bold text-slate-300">
                profesionistas
              </span>
            </div>
            <span className="text-[10.5px] text-slate-400 mt-1">
              Población Económicamente Activa en {REGIONES_INFO[regionActiva]?.corto}
            </span>
          </div>

          {/* Tarjeta 3: Distribución Demográfica por Género en la Región */}
          <div className="bg-slate-800/85 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Distribución de Género ({REGIONES_INFO[regionActiva]?.corto})</span>
              <span className="text-violet-300 font-black">{censoDemografico.pctMujeresReg}% M · {censoDemografico.pctHombresReg}% H</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden flex my-1.5 border border-slate-700">
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
            <div className="flex items-center justify-between text-[10.5px] text-slate-300">
              <span>M: {formatoMoneda(censoDemografico.sueldoMedioMujeres)} vs H: {formatoMoneda(censoDemografico.sueldoMedioHombres)}</span>
              <strong className="text-amber-300 font-black">Brecha: {censoDemografico.brechaGeneroPct}%</strong>
            </div>
          </div>

          {/* Tarjeta 4: Efecto STEM vs. No-STEM */}
          <div className="bg-slate-800/85 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Efecto Salarial STEM vs. No-STEM
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <strong className="text-xl font-black text-emerald-400">
                {censoDemografico.premioStemPct >= 0 ? `+${censoDemografico.premioStemPct}%` : `${censoDemografico.premioStemPct}%`}
              </strong>
              <span className="text-[11px] font-bold text-indigo-300">
                Prima STEM
              </span>
            </div>
            <span className="text-[10.5px] text-slate-400 mt-1">
              STEM: {formatoMoneda(censoDemografico.sueldoMedioStem)} vs Otras: {formatoMoneda(censoDemografico.sueldoMedioNoStem)}
            </span>
          </div>

        </div>
      </div>

      {/* BARRA DE FILTROS DEMOGRÁFICOS (REGIÓN, GÉNERO Y STEM) */}
      <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 mr-1">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                    act ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  {REGIONES_INFO[reg]?.corto}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3">
          <button
            type="button"
            aria-pressed={soloStem}
            onClick={() => setSoloStem(prev => !prev)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 inline-flex items-center gap-1.5 cursor-pointer ${
              soloStem ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Microscope className="w-3.5 h-3.5" aria-hidden="true" />
            Solo STEM ({filasActivas.filter(f => f.is_stem).length})
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
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

      {/* MÓDULO 1: ESTACIÓN BIVARIADA TODO-EN-UNO (100% VISIBLE SIN HACER SCROLL) */}
      <div className="bg-gradient-to-b from-white via-white to-slate-50/70 rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-xs">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 mb-4 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">
              Explorador Bivariado en Tiempo Real + Regresión Lineal (OLS)
            </span>
            <h2 className="text-lg md:text-xl font-black text-slate-900">
              Matriz de Cruce Libre (Eje X vs. Eje Y) y Cuadrantes Regionales
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
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
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
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

        {/* FILA INTEGRADA: SELECTOR X (4 COLS) + SELECTOR Y (4 COLS) + CABEZAL DE CORRELACIÓN EN VIVO (4 COLS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 mb-4 items-stretch">
          
          <div className="lg:col-span-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <label className="text-[10.5px] font-black uppercase tracking-wider text-blue-600 block mb-1">
                Variable Horizontal (Eje X) · Media: {formatearValorVariable(mediaXActual, metaEjeX.unidad)}
              </label>
              <select
                value={ejeXId}
                onChange={(e) => setEjeXId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {CATALOGO_VARIABLES_CRUDAS.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1.5 leading-snug">{metaEjeX.descripcion}</span>
          </div>

          <div className="lg:col-span-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <div>
              <label className="text-[10.5px] font-black uppercase tracking-wider text-emerald-600 block mb-1">
                Variable Vertical (Eje Y) · Media: {formatearValorVariable(mediaYActual, metaEjeY.unidad)}
              </label>
              <select
                value={ejeYId}
                onChange={(e) => setEjeYId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {CATALOGO_VARIABLES_CRUDAS.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1.5 leading-snug">{metaEjeY.descripcion}</span>
          </div>

          {/* Cabezal de Correlación e Inferencia OLS Integrado a la Vista (Sin necesidad de hacer scroll arriba) */}
          <div className="lg:col-span-4 bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Correlación de Pearson (r)
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <strong className={`text-2xl font-black ${
                    regresionOLS.r >= 0.25 ? 'text-emerald-400' : regresionOLS.r <= -0.25 ? 'text-amber-400' : 'text-sky-400'
                  }`}>
                    {regresionOLS.r > 0 ? `+${regresionOLS.r}` : regresionOLS.r}
                  </strong>
                  <span className="text-xs font-bold text-slate-400">
                    (R² = {regresionOLS.r2Pct}%)
                  </span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black border ${etiquetaFuerzaCorrelacion.clase}`}>
                {etiquetaFuerzaCorrelacion.texto}
              </span>
            </div>

            <p className="text-[11px] text-slate-200 font-semibold pt-2 mt-2 border-t border-slate-800 leading-snug">
              📐 <strong>Pendiente OLS:</strong> {textoPendienteOLS}.
            </p>
          </div>

        </div>

        {/* CUERPO PRINCIPAL: GRÁFICO DE DISPERSIÓN CON RECTA OLS (8 COLS) + RADAR DE CORRELACIONES AUTOMÁTICO (4 COLS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          <div className="lg:col-span-8 flex flex-col justify-between bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
            
            {/* Filtros Interactivos de los 4 Cuadrantes */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-3 pb-2.5 border-b border-slate-100 text-[11px]">
              <span className="font-black text-slate-700 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" /> Filtrar por Cuadrante:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {([
                  { id: 'todos' as FiltroCuadrante, label: `Todos (${filasBaseSinCuadrante.length})` },
                  { id: 'q1_sup_izq' as FiltroCuadrante, label: `↖ X Bajo · Y Alto (${conteoCuadrantes.q1})` },
                  { id: 'q2_sup_der' as FiltroCuadrante, label: `↗ X Alto · Y Alto (${conteoCuadrantes.q2})` },
                  { id: 'q3_inf_izq' as FiltroCuadrante, label: `↙ X Bajo · Y Bajo (${conteoCuadrantes.q3})` },
                  { id: 'q4_inf_der' as FiltroCuadrante, label: `↘ X Alto · Y Bajo (${conteoCuadrantes.q4})` }
                ]).map(qItem => {
                  const act = filtroCuadrante === qItem.id;
                  return (
                    <button
                      key={qItem.id}
                      type="button"
                      onClick={() => setFiltroCuadrante(qItem.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition-all active:scale-95 cursor-pointer ${
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
            </div>

            <div className="h-80 md:h-88 w-full">
              {!loading && filasFiltradasYOrdenadas.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 22, right: 28, bottom: 12, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      type="number"
                      dataKey={ejeXId}
                      name={metaEjeX.corto}
                      domain={['auto', 'auto']}
                      tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                    />
                    <YAxis
                      type="number"
                      dataKey={ejeYId}
                      name={metaEjeY.corto}
                      domain={['auto', 'auto']}
                      tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={{ stroke: '#CBD5E1' }}
                    />
                    <ZAxis type="number" dataKey="pea_activa" range={[65, 340]} name="PEA Activa" />

                    {Number.isFinite(mediaXActual) && (
                      <ReferenceLine
                        x={mediaXActual}
                        stroke="#64748B"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                      />
                    )}
                    {Number.isFinite(mediaYActual) && (
                      <ReferenceLine
                        y={mediaYActual}
                        stroke="#64748B"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
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
                                  <span className="text-slate-400">Muestra física INEGI:</span>
                                  <strong className="text-slate-200">{d.n_encuestados.toLocaleString('es-MX')} enc.</strong>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {/* Recta Diagonal de Regresión Lineal OLS */}
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

                    {/* Nube de Licenciaturas con Etiquetas Automáticas en Nodos Extremos */}
                    <Scatter
                      name="Licenciaturas"
                      data={filasFiltradasYOrdenadas}
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (!Number.isFinite(cx) || !Number.isFinite(cy) || !payload) return <g />;
                        const sem = obtenerSemaforoScoreDataROI(payload.score_dataroi);
                        const esOutlier = cvesOutliersEtiquetados.has(payload.cve_carrera);
                        const coincideBusqueda = busqueda.trim().length > 1 && (
                          payload.nombre_carrera.toLowerCase().includes(busqueda.toLowerCase().trim()) ||
                          payload.cve_carrera.includes(busqueda.trim())
                        );
                        const mostrarEtiqueta = esOutlier || coincideBusqueda;
                        const rDot = coincideBusqueda ? 8 : esOutlier ? 6.5 : 5.5;
                        const labelCorto = payload.nombre_carrera.length > 20
                          ? payload.nombre_carrera.slice(0, 18) + '…'
                          : payload.nombre_carrera;

                        return (
                          <g>
                            {coincideBusqueda && (
                              <circle cx={cx} cy={cy} r={13} fill="none" stroke="#2563EB" strokeWidth={2} opacity={0.6} />
                            )}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={rDot}
                              fill={sem.colorHex}
                              fillOpacity={0.85}
                              stroke="#FFFFFF"
                              strokeWidth={1.6}
                            />
                            {mostrarEtiqueta && (
                              <text
                                x={cx}
                                y={cy - 9}
                                textAnchor="middle"
                                fill="#0F172A"
                                fontSize={9.5}
                                fontWeight={800}
                                style={{ paintOrder: 'stroke', stroke: '#FFFFFF', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }}
                              >
                                {labelCorto}
                              </text>
                            )}
                          </g>
                        );
                      }}
                    >
                      {filasFiltradasYOrdenadas.map((entry, index) => {
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

            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-500">
              <span>
                <strong>Línea diagonal negra punteada:</strong> Tendencia lineal por Mínimos Cuadrados Ordinarios (OLS).
              </span>
              <span>
                <strong>Ejes grises punteados:</strong> Promedios ponderados regionales ({metaEjeX.corto} y {metaEjeY.corto}).
              </span>
            </div>
          </div>

          {/* PANEL DERECHO: DESCUBRIDOR AUTOMÁTICO DE CORRELACIONES (1 VARIABLE CONTRA LAS OTRAS 23) */}
          <div className="lg:col-span-4 bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-blue-600 mb-1">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Radar Automático de Correlaciones
              </div>
              <h3 className="text-sm font-black text-slate-900 leading-snug mb-1">
                ¿Qué variables se asocian más con {metaEjeY.corto}?
              </h3>
              <p className="text-[11px] text-slate-500 mb-3">
                Haz clic en cualquier variable para cargarla en el <strong>Eje X</strong> y ver su gráfico de dispersión.
              </p>

              {/* Top Correlaciones Positivas */}
              <div className="mb-3.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1 mb-1.5">
                  <TrendingUp className="w-3 h-3" aria-hidden="true" /> Mayor Asociación Positiva (+r)
                </span>
                <div className="space-y-1.5">
                  {radarCorrelacionesContraY.positivas.length > 0 ? (
                    radarCorrelacionesContraY.positivas.map(item => {
                      const act = ejeXId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setEjeXId(item.id)}
                          className={`w-full text-left p-2 rounded-xl border transition-all active:scale-98 cursor-pointer ${
                            act
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-slate-800 border-slate-200/80 hover:border-emerald-400'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold truncate pr-2">{item.corto}</span>
                            <strong className={`font-black text-[11px] shrink-0 ${act ? 'text-white' : 'text-emerald-700'}`}>
                              r = +{item.r.toFixed(2)}
                            </strong>
                          </div>
                          <div className={`w-full h-1.5 rounded-full overflow-hidden ${act ? 'bg-emerald-800' : 'bg-slate-100'}`}>
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

              {/* Top Correlaciones Inversas / Negativas */}
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1 mb-1.5">
                  <TrendingDown className="w-3 h-3" aria-hidden="true" /> Mayor Asociación Inversa (-r)
                </span>
                <div className="space-y-1.5">
                  {radarCorrelacionesContraY.negativas.length > 0 ? (
                    radarCorrelacionesContraY.negativas.map(item => {
                      const act = ejeXId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setEjeXId(item.id)}
                          className={`w-full text-left p-2 rounded-xl border transition-all active:scale-98 cursor-pointer ${
                            act
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-white text-slate-800 border-slate-200/80 hover:border-amber-400'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold truncate pr-2">{item.corto}</span>
                            <strong className={`font-black text-[11px] shrink-0 ${act ? 'text-white' : 'text-amber-700'}`}>
                              r = {item.r.toFixed(2)}
                            </strong>
                          </div>
                          <div className={`w-full h-1.5 rounded-full overflow-hidden ${act ? 'bg-amber-800' : 'bg-slate-100'}`}>
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

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-[10.5px] text-slate-500">
              Calculado en vivo sobre las <strong>{filasBaseSinCuadrante.length} carreras</strong> activas en {REGIONES_INFO[regionActiva]?.corto}.
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
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar carrera (resalta en gráfico)..."
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

        {/* CINTA DE DISTRIBUCIÓN ESTADÍSTICA (P10, MEDIANA P50, MEDIA, P90 Y STEM VS NO-STEM) */}
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
              Promedio STEM vs. No-STEM
            </span>
            <strong className="text-xs font-black text-indigo-900 mt-1 block">
              STEM: {formatearValorVariable(estadisticosTabla.mediaStem, metaVarRanking.unidad)}
            </strong>
            <span className="text-[10.5px] font-semibold text-indigo-700 block mt-0.5">
              Otras: {formatearValorVariable(estadisticosTabla.mediaNoStem, metaVarRanking.unidad)}
            </span>
          </div>
        </div>

        {/* Tabla Ejecutiva de Ranking Crudo (Sin Columnas Duplicadas) */}
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
                const diffMedia = Number((valorActual - mediaRef).toFixed(metaVarRanking.unidad === 'MXN' ? 0 : 1));
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
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          esFavorable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {diffMedia > 0 ? `+${diffMedia}` : diffMedia} vs. Media
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

        {filasFiltradasYOrdenadas.length > 12 && (
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
                  Ver las {filasFiltradasYOrdenadas.length} carreras completas en la tabla
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