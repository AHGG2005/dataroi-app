"use client";

import React, { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { descargarReporteCarreraPDF } from '@/lib/pdfReportGenerator';
import {
  descargarLibroExcelXLSX,
  descargarCSVEstilizado,
  calcularScoreDataROIUniversal,
  obtenerSemaforoScoreDataROI,
  formatearNombreCarreraEjecutivo,
  leerEstadoDescubridorGlobal,
  toggleCarreraComparadorGlobal,
  STORAGE_KEY_DESCUBRIDOR,
  EVENTO_VERSUS_SYNC,
  ValorCeldaExcel,
  EstiloCeldaExcel
} from '@/lib/excelReportGenerator';
import GraficaPredictiva, {
  BENCHMARK_PREPA,
  ESTADOS_POR_REGION,
  ResumenMercadoRegion,
  SueldoRegionalItem,
  ModoGeneroEstricto
} from '@/components/GraficaPredictiva';
import {
  Tooltip as RechartsTooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import {
  ArrowLeft, Building2, ShieldAlert, ShieldCheck,
  Scale, Award, Loader2, AlertCircle,
  MapPin, Sparkles, CheckCircle2, Compass, Users, Home, Clock, Lock,
  Calculator, ThumbsUp, AlertTriangle, Share2, Download, Printer, Check,
  FileSpreadsheet, SlidersHorizontal, Briefcase, Landmark, GraduationCap, Crown
} from 'lucide-react';

const REGIONES_ORDEN = ['nacional', 'norte', 'noroeste', 'bajio', 'centro', 'sur'] as const;
const MACRO_REGIONES_5 = ['norte', 'noroeste', 'bajio', 'centro', 'sur'] as const;

type TipoUniversidadROI = 'publica' | 'privada_media' | 'privada_elite' | 'personalizada';
type NivelTrabajoEstudio = 0 | 0.5 | 1; // 0 = Sin trabajar, 0.5 = Medio tiempo, 1 = Tiempo completo
type SegmentoOITHover = 'calidad' | 'basico' | 'informal' | null;

const COLORES_SLOTS_VERSUS = [
  { hex: '#2563EB', btnClass: 'bg-blue-600 text-white border-blue-600 shadow-xs' },
  { hex: '#9333EA', btnClass: 'bg-purple-600 text-white border-purple-600 shadow-xs' },
  { hex: '#EA580C', btnClass: 'bg-orange-600 text-white border-orange-600 shadow-xs' }
];

const REGIONES_INFO: Record<string, { nombre: string; corto: string; estados: string }> = {
  nacional: { nombre: 'Nacional (Todo México)', corto: 'Nacional', estados: 'Promedio de las 32 entidades' },
  norte: { nombre: 'Norte Industrial', corto: 'Norte', estados: 'BC, Coah, Chih, NL, Son, Tamps' },
  noroeste: { nombre: 'Noroeste / Pacífico', corto: 'Noroeste', estados: 'BCS, Dgo, Nay, Sin' },
  bajio: { nombre: 'Occidente - Bajío', corto: 'Bajío-Occ.', estados: 'Ags, Col, Gto, Jal, Mich, Qro, SLP, Zac' },
  centro: { nombre: 'Centro / Valle de México', corto: 'Centro', estados: 'CDMX, Edomex, Hgo, Mor, Pue, Tlax' },
  sur: { nombre: 'Sur - Sureste / Golfo', corto: 'Sur-Sureste', estados: 'Camp, Chis, Gro, Oax, Q.Roo, Tab, Ver, Yuc' }
};

interface BenchmarkSateliteItem {
  pct_contrato: number;
  pct_aguinaldo: number;
  pct_afore: number;
  pct_materno: number;
  pct_sindicato: number;
  pct_sgmm: number;
  pct_home_office: number;
  pct_medio_tiempo: number;
  pct_pluriempleo: number;
  pct_desarraigo: number;
  pct_nepotismo: number;
  indice_privilegio: number;
  pct_micro: number;
  pct_pyme: number;
  pct_corp: number;
  pct_gobierno: number;
  hrs_hogar: number;
}

const BENCHMARK_FALLBACK_NACIONAL: BenchmarkSateliteItem = {
  pct_contrato: 65.3, pct_aguinaldo: 63.6, pct_afore: 55.2, pct_materno: 23.5,
  pct_sindicato: 15.7, pct_sgmm: 7.9, pct_home_office: 3.7, pct_medio_tiempo: 13.8,
  pct_pluriempleo: 5.6, pct_desarraigo: 2.7, pct_nepotismo: 37.2, indice_privilegio: 2.80,
  pct_micro: 28.0, pct_pyme: 30.6, pct_corp: 12.5, pct_gobierno: 19.0, hrs_hogar: 15.4
};

function clasificarTendenciaSerieReal(puntosAnuales: { anio: number; sueldo: number | null }[]) {
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
  const ptsRec = validos.filter(p => p.anio === 2025 || p.anio === 2026).map(p => p.sueldo);

  const sueldoBase = ptsBase.length > 0 ? ptsBase.reduce((a, b) => a + b, 0) / ptsBase.length : sueldos[0];
  const sueldoRec = ptsRec.length > 0 ? ptsRec.reduce((a, b) => a + b, 0) / ptsRec.length : sueldos[sueldos.length - 1];

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

function calcularBenchmarkDinamicoSatelites(
  todasFilas: any[],
  reg: string,
  sx: number
): BenchmarkSateliteItem {
  const sub = todasFilas.filter(
    r => String(r.region || 'nacional').toLowerCase() === reg && Number(r.sexo ?? 0) === sx
  );
  const lote = sub.length > 0
    ? sub
    : todasFilas.filter(r => String(r.region || 'nacional').toLowerCase() === 'nacional' && Number(r.sexo ?? 0) === 0);

  if (lote.length === 0) return BENCHMARK_FALLBACK_NACIONAL;

  const sumaPeso = lote.reduce((acc, r) => acc + Math.max(1, Number(r.volumen_muestra_nacional || 1)), 0);
  const mediaPond = (campo: string, dec = 1) => {
    const prod = lote.reduce((acc, r) => acc + Number(r[campo] || 0) * Math.max(1, Number(r.volumen_muestra_nacional || 1)), 0);
    return Number((prod / sumaPeso).toFixed(dec));
  };

  const sub0 = todasFilas.filter(
    r => String(r.region || 'nacional').toLowerCase() === reg && Number(r.sexo ?? 0) === 0
  );
  const lote0 = sub0.length > 0 ? sub0 : lote;
  const peso0 = lote0.reduce((acc, r) => acc + Math.max(1, Number(r.volumen_muestra_nacional || 1)), 0);
  const hMed = lote0.reduce((acc, r) => acc + Number(r.hrs_doble_jornada_hombres || 0) * Math.max(1, Number(r.volumen_muestra_nacional || 1)), 0) / peso0;
  const mMed = lote0.reduce((acc, r) => acc + Number(r.hrs_doble_jornada_mujeres || 0) * Math.max(1, Number(r.volumen_muestra_nacional || 1)), 0) / peso0;
  const hrsHogar = sx === 0 ? Number(((hMed + mMed) / 2).toFixed(1)) : sx === 1 ? Number(hMed.toFixed(1)) : Number(mMed.toFixed(1));

  return {
    pct_contrato: mediaPond('pct_contrato', 1),
    pct_aguinaldo: mediaPond('pct_aguinaldo', 1),
    pct_afore: mediaPond('pct_afore', 1),
    pct_materno: mediaPond('pct_materno', 1),
    pct_sindicato: mediaPond('pct_sindicato', 1),
    pct_sgmm: mediaPond('pct_sgmm', 1),
    pct_home_office: mediaPond('pct_home_office', 1),
    pct_medio_tiempo: mediaPond('pct_medio_tiempo', 1),
    pct_pluriempleo: mediaPond('pct_pluriempleo', 1),
    pct_desarraigo: mediaPond('pct_desarraigo', 1),
    pct_nepotismo: mediaPond('pct_nepotismo', 1),
    indice_privilegio: mediaPond('indice_privilegio', 2),
    pct_micro: mediaPond('pct_micro', 1),
    pct_pyme: mediaPond('pct_pyme', 1),
    pct_corp: mediaPond('pct_corp', 1),
    pct_gobierno: mediaPond('pct_gobierno', 1),
    hrs_hogar: hrsHogar
  };
}

const ESTILOS_MOSAICO_EMPLEADORES = [
  {
    bg: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-700 shadow-xs',
    sub: 'text-blue-100',
    track: 'bg-blue-950/35',
    bar: 'bg-white'
  },
  {
    bg: 'bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-900 shadow-xs',
    sub: 'text-slate-300',
    track: 'bg-slate-700/60',
    bar: 'bg-emerald-400'
  },
  {
    bg: 'bg-gradient-to-br from-blue-50/90 to-indigo-50/60 text-slate-900 border-blue-200',
    sub: 'text-blue-700',
    track: 'bg-blue-200/70',
    bar: 'bg-blue-600'
  },
  {
    bg: 'bg-gradient-to-br from-slate-100 to-slate-50 text-slate-800 border-slate-200',
    sub: 'text-slate-500',
    track: 'bg-slate-200',
    bar: 'bg-slate-700'
  },
  {
    bg: 'bg-slate-50 text-slate-700 border-slate-200',
    sub: 'text-slate-400',
    track: 'bg-slate-200',
    bar: 'bg-slate-500'
  }
];

const formatoMoneda = (valor: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor || 0);

const formatoMonedaCorta = (valor: number) => {
  if (valor >= 1000) return `$${(valor / 1000).toFixed(1)}k`;
  return `$${valor}`;
};

function formatearAniosROI(anios: number | null): string {
  if (anios === null) return 'No amortizable';
  if (anios === 1) return '1 año';
  return `${anios} años`;
}

function obtenerSectorDominanteCorto(sat: any): string {
  const sectores = [
    { label: 'PYME', val: Number(sat?.pct_pyme || 0) },
    { label: 'Independiente / Micro', val: Number(sat?.pct_micro || 0) },
    { label: 'Gran Corporativo', val: Number(sat?.pct_corp || 0) },
    { label: 'Gobierno', val: Number(sat?.pct_gobierno || 0) }
  ].sort((a, b) => b.val - a.val);
  return `${sectores[0].val.toFixed(1)}% ${sectores[0].label}`;
}

function obtenerCapExCarrera(cve: string) {
  const pref2 = cve.slice(0, 2);
  const pref3 = cve.slice(0, 3);
  const pref4 = cve.slice(0, 4);

  if (pref4 === '0911' || pref4 === '0931') {
    return {
      nivel: 3,
      costoEquipo: 85000,
      etiqueta: 'Inversión Alta en Equipo',
      badge: 'text-rose-700 bg-rose-50 border-rose-200',
      badgeDark: 'text-rose-200 bg-rose-500/25 border-rose-400/50 shadow-2xs',
      detalle: 'Exige instrumental clínico/odontológico propio, uniformes quirúrgicos e insumos continuos de práctica hospitalaria.'
    };
  }
  if (pref4 === '0821') {
    return {
      nivel: 3,
      costoEquipo: 85000,
      etiqueta: 'Inversión Alta en Equipo',
      badge: 'text-rose-700 bg-rose-50 border-rose-200',
      badgeDark: 'text-rose-200 bg-rose-500/25 border-rose-400/50 shadow-2xs',
      detalle: 'Exige instrumental clínico veterinario, equipo de diagnóstico y materiales continuos de práctica zootécnica.'
    };
  }
  if (pref3 === '073') {
    return {
      nivel: 3,
      costoEquipo: 85000,
      etiqueta: 'Inversión Alta en Equipo',
      badge: 'text-rose-700 bg-rose-50 border-rose-200',
      badgeDark: 'text-rose-200 bg-rose-500/25 border-rose-400/50 shadow-2xs',
      detalle: 'Exige estación gráfica de alto rendimiento para modelado CAD/BIM, impresión de planos y materiales de maquetación.'
    };
  }
  if (pref3 === '021') {
    return {
      nivel: 3,
      costoEquipo: 85000,
      etiqueta: 'Inversión Alta en Equipo',
      badge: 'text-rose-700 bg-rose-50 border-rose-200',
      badgeDark: 'text-rose-200 bg-rose-500/25 border-rose-400/50 shadow-2xs',
      detalle: 'Exige equipo de producción audiovisual/fotográfica, materiales de taller creativo o estación de diseño de alto rendimiento.'
    };
  }
  if (pref4 === '1014' || pref4 === '1013' || pref4 === '1015') {
    return {
      nivel: 3,
      costoEquipo: 85000,
      etiqueta: 'Inversión Alta en Equipo',
      badge: 'text-rose-700 bg-rose-50 border-rose-200',
      badgeDark: 'text-rose-200 bg-rose-500/25 border-rose-400/50 shadow-2xs',
      detalle: 'Exige cuchillería profesional, uniformes técnicos e insumos continuos para prácticas de laboratorio gastronómico.'
    };
  }

  if (pref2 === '06') {
    return {
      nivel: 2,
      costoEquipo: 42000,
      etiqueta: 'Inversión Media en Equipo',
      badge: 'text-amber-700 bg-amber-50 border-amber-200',
      badgeDark: 'text-amber-200 bg-amber-500/25 border-amber-400/50 shadow-2xs',
      detalle: 'Requiere equipo de cómputo de gama media-alta para programación, compilación de software, redes y virtualización.'
    };
  }

  if (
    pref3 === '071' || pref3 === '072' ||
    pref3 === '051' || pref3 === '052' || pref3 === '053' || pref3 === '081' ||
    pref3 === '091' || pref3 === '092' || pref3 === '094' || pref3 === '095'
  ) {
    return {
      nivel: 2,
      costoEquipo: 42000,
      etiqueta: 'Inversión Media en Equipo',
      badge: 'text-amber-700 bg-amber-50 border-amber-200',
      badgeDark: 'text-amber-200 bg-amber-500/25 border-amber-400/50 shadow-2xs',
      detalle: 'Requiere equipo de cómputo para simulación/modelado especializado e insumos periódicos de prácticas de laboratorio.'
    };
  }

  return {
    nivel: 1,
    costoEquipo: 18000,
    etiqueta: 'Inversión Básica',
    badge: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badgeDark: 'text-emerald-200 bg-emerald-500/25 border-emerald-400/50 shadow-2xs',
    detalle: 'Se cursa con equipo de cómputo estándar de ofimática y bibliografía académica.'
  };
}

function obtenerTextoIndependenciaPorArea(cve: string, pMicro: number, diffMicro: number): string {
  const pref2 = cve.slice(0, 2);
  const pref3 = cve.slice(0, 3);
  const signo = diffMicro >= 0 ? `+${diffMicro.toFixed(1)}%` : `${diffMicro.toFixed(1)}%`;

  if (pref2 === '09' || pref3 === '082' || cve === '031100') {
    return `Alta viabilidad para abrir consultorio o clínica propia (${pMicro.toFixed(1)}% ejerce de forma independiente, ${signo} vs. media).`;
  }
  if (pref2 === '06') {
    return `Fuerte ecosistema para consultoría de software, desarrollo freelance o agencia TI (${pMicro.toFixed(1)}% independiente).`;
  }
  if (pref2 === '07') {
    return `Amplia salida como contratista independiente, firma de ingeniería o despacho de proyectos (${pMicro.toFixed(1)}% en microempresa).`;
  }
  if (pref2 === '02') {
    return `Alta viabilidad para estudio creativo propio, producción independiente o diseño freelance (${pMicro.toFixed(1)}% por cuenta propia).`;
  }
  if (pref2 === '03' || pref2 === '04') {
    return `Sólida salida para despacho propio, asesoría independiente o consultoría especializada (${pMicro.toFixed(1)}% en práctica libre).`;
  }
  return `Amplia viabilidad de emprendimiento o práctica profesional independiente (${pMicro.toFixed(1)}% en microempresa).`;
}

function diagnosticarSaturacion(sat: number) {
  if (sat <= 85) {
    return {
      texto: 'Alta Demanda (Baja saturación)',
      clase: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      claseDark: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/45'
    };
  }
  if (sat <= 110) {
    return {
      texto: 'Mercado Equilibrado',
      clase: 'bg-blue-50 text-blue-700 border-blue-200',
      claseDark: 'bg-blue-500/25 text-blue-200 border-blue-400/45'
    };
  }
  if (sat <= 135) {
    return {
      texto: 'Mercado Competido',
      clase: 'bg-amber-50 text-amber-800 border-amber-200',
      claseDark: 'bg-amber-500/25 text-amber-200 border-amber-400/45'
    };
  }
  return {
    texto: 'Alta Saturación de Egresados',
    clase: 'bg-rose-50 text-rose-700 border-rose-200',
    claseDark: 'bg-rose-500/25 text-rose-200 border-rose-400/45'
  };
}

function calcularMetricasSocialesContextual({
  indicePrivilegioRaw,
  pctNepotismoRaw,
  pctSindicatoRaw,
  pctCorpRaw,
  pctPymeRaw,
  tasaCalidadOIT,
  sueldoActivo,
  sueldoPrepaActivo,
  mediaEstratoContexto,
  mediaNepotismoContexto
}: {
  indicePrivilegioRaw: any;
  pctNepotismoRaw: any;
  pctSindicatoRaw: any;
  pctCorpRaw: any;
  pctPymeRaw: any;
  tasaCalidadOIT: number;
  sueldoActivo: number;
  sueldoPrepaActivo: number;
  mediaEstratoContexto: number;
  mediaNepotismoContexto: number;
}) {
  const estrato = Number.isFinite(Number(indicePrivilegioRaw)) && Number(indicePrivilegioRaw) > 0
    ? Number(indicePrivilegioRaw)
    : mediaEstratoContexto;
  const nepotismo = Number.isFinite(Number(pctNepotismoRaw)) ? Number(pctNepotismoRaw) : mediaNepotismoContexto;
  const sindicato = Number.isFinite(Number(pctSindicatoRaw)) ? Number(pctSindicatoRaw) : 15;
  const pCorp = Number.isFinite(Number(pctCorpRaw)) ? Number(pctCorpRaw) : 10;
  const pPyme = Number.isFinite(Number(pctPymeRaw)) ? Number(pctPymeRaw) : 30;

  const diffEst = estrato - mediaEstratoContexto;
  const penalizacionElitismo = diffEst > 0.05 ? (diffEst - 0.05) * 110 : diffEst * 35;
  const inclusionOrigen = Math.max(15, Math.min(92, 70 - penalizacionElitismo));
  const aperturaContratacion = Math.max(10, Math.min(95, 100 - (nepotismo + sindicato * 0.22)));
  const saltoSalarialScore = sueldoPrepaActivo > 0
    ? Math.max(0, Math.min(100, ((sueldoActivo - sueldoPrepaActivo) / sueldoPrepaActivo) * 100))
    : 40;
  const impulsoAscenso = saltoSalarialScore * 0.45 + tasaCalidadOIT * 0.35 + Math.min(100, pCorp * 2.2 + pPyme * 0.6) * 0.20;
  const scoreMovilidad = Math.max(12, Math.min(96, aperturaContratacion * 0.40 + impulsoAscenso * 0.35 + inclusionOrigen * 0.25));

  const esBajoNepotismo = nepotismo <= (mediaNepotismoContexto + 0.3);
  const esAltoEstrato = estrato > (mediaEstratoContexto + 0.03);

  let cuadrante = {
    nombre: 'Ascensor Meritocrático',
    desc: 'Menor nepotismo y mayor apertura socioeconómica que el promedio de esta región.',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };

  if (esBajoNepotismo && esAltoEstrato) {
    cuadrante = {
      nombre: 'Élite Competitiva',
      desc: 'Se ingresa por mérito académico (bajo nepotismo), con concentración de estrato superior a la media regional.',
      badge: 'bg-blue-50 text-blue-700 border-blue-200'
    };
  } else if (!esBajoNepotismo && !esAltoEstrato) {
    cuadrante = {
      nombre: 'Red Gremial / Familiar',
      desc: 'Alta apertura a estratos populares de la región, pero el ingreso depende fuertemente de contactos o sindicatos.',
      badge: 'bg-amber-50 text-amber-800 border-amber-200'
    };
  } else if (!esBajoNepotismo && esAltoEstrato) {
    cuadrante = {
      nombre: 'Cúpula de Contactos',
      desc: 'Concentración de estrato alto local combinada con fuerte contratación por redes familiares.',
      badge: 'bg-rose-50 text-rose-700 border-rose-200'
    };
  }

  return {
    estrato: Number(estrato.toFixed(2)),
    nepotismo: Number(nepotismo.toFixed(1)),
    scoreMovilidad: Number(scoreMovilidad.toFixed(1)),
    cuadrante
  };
}

function generarDiagnosticoEjecutivoV2({
  cve_carrera,
  sueldoActivo,
  sueldoPrepaActivo,
  sueldoLicMediaReg,
  premioVsPrepaPct,
  tasaDesempleo,
  saturacion,
  riesgoIA,
  tasaFormalidadPct,
  tasaInformalidadPct,
  tasaEmpleoCalidadPct,
  mediaCalidadOITContexto,
  estrato,
  nepotismo,
  pSindicato,
  pSgmm,
  pMicro,
  pPyme,
  pCorp,
  pDesarraigo,
  pPluriempleo,
  pHomeOffice,
  nivelCapEx,
  benchContextual
}: {
  cve_carrera: string;
  sueldoActivo: number;
  sueldoPrepaActivo: number;
  sueldoLicMediaReg: number;
  premioVsPrepaPct: number;
  tasaDesempleo: number;
  saturacion: number;
  riesgoIA: number;
  tasaFormalidadPct: number;
  tasaInformalidadPct: number;
  tasaEmpleoCalidadPct: number;
  mediaCalidadOITContexto: number;
  estrato: number;
  nepotismo: number;
  pSindicato: number;
  pSgmm: number;
  pMicro: number;
  pPyme: number;
  pCorp: number;
  pDesarraigo: number;
  pPluriempleo: number;
  pHomeOffice: number;
  nivelCapEx: number;
  benchContextual: BenchmarkSateliteItem;
}) {
  const pros: { score: number; texto: string }[] = [];
  const contras: { score: number; texto: string }[] = [];

  const diffSueldoLicPct = sueldoLicMediaReg > 0
    ? Number((((sueldoActivo - sueldoLicMediaReg) / sueldoLicMediaReg) * 100).toFixed(1))
    : 0;
  const bonoMensual = sueldoActivo - sueldoPrepaActivo;

  if (diffSueldoLicPct >= 2.0) {
    pros.push({
      score: 25 + Math.abs(diffSueldoLicPct) * 1.5,
      texto: `Sueldo competitivo: supera en +${diffSueldoLicPct}% al promedio universitario regional (+${premioVsPrepaPct}% vs. Prepa).`
    });
  } else if (premioVsPrepaPct >= 12.0) {
    pros.push({
      score: 15 + premioVsPrepaPct * 0.5,
      texto: `Prima salarial positiva sobre bachillerato (+${premioVsPrepaPct}%, equivalente a +${formatoMoneda(bonoMensual)}/mes adicionales).`
    });
  } else {
    contras.push({
      score: 35 + (20 - premioVsPrepaPct) * 1.8,
      texto: `Baja prima salarial frente a Preparatoria (${premioVsPrepaPct >= 0 ? `+${premioVsPrepaPct}%` : `${premioVsPrepaPct}%`}, diferencia de ${formatoMoneda(bonoMensual)}/mes).`
    });
  }

  if (diffSueldoLicPct < 0 && premioVsPrepaPct >= 12.0) {
    contras.push({
      score: 14 + Math.abs(diffSueldoLicPct) * 1.2,
      texto: `Remuneración por debajo del promedio de otras licenciaturas en la región (${diffSueldoLicPct}% vs. Media Lic.).`
    });
  }

  if (tasaDesempleo <= 3.6) {
    pros.push({
      score: 20 + (4.0 - tasaDesempleo) * 8,
      texto: `Rápida absorción laboral: tasa de desempleo abierto baja (${tasaDesempleo.toFixed(1)}%).`
    });
  } else {
    contras.push({
      score: 20 + (tasaDesempleo - 3.5) * 9,
      texto: `Fricción de colocación: tasa de desempleo abierto del ${tasaDesempleo.toFixed(1)}% en la PEA activa.`
    });
  }

  if (saturacion <= 98) {
    pros.push({
      score: 18 + (100 - saturacion) * 0.6,
      texto: `Demanda favorable de egresados (${saturacion.toFixed(0)}% de índice de saturación en el balance ANUIES).`
    });
  } else {
    contras.push({
      score: 18 + (saturacion - 98) * 0.45,
      texto: `Alta competencia de egresados: índice de saturación del ${saturacion.toFixed(0)}% frente a las plazas disponibles.`
    });
  }

  const diffPriv = Number((estrato - benchContextual.indice_privilegio).toFixed(2));
  if (diffPriv <= 0) {
    pros.push({
      score: 18 + Math.abs(diffPriv) * 65,
      texto: `Apertura socioeconómica: accesible a estudiantes de estratos medios y populares (estrato ${estrato.toFixed(2)}/4).`
    });
  } else {
    contras.push({
      score: 16 + diffPriv * 65,
      texto: `Concentración socioeconómica: predomina alumnado de estrato superior al promedio regional (${estrato.toFixed(2)}/4, +${diffPriv} vs. media).`
    });
  }

  const diffNep = Number((nepotismo - benchContextual.pct_nepotismo).toFixed(1));
  if (diffNep <= 0 && nepotismo < 38.0) {
    pros.push({
      score: 18 + Math.abs(diffNep) * 2.5,
      texto: `Ingreso meritocrático: menor dependencia de redes familiares (${nepotismo.toFixed(1)}% vs. ${benchContextual.pct_nepotismo}% regional).`
    });
  } else {
    contras.push({
      score: 17 + Math.max(1, diffNep) * 2.5,
      texto: `Barrera de contactos: el ${nepotismo.toFixed(1)}% del acceso laboral depende de redes familiares o conocidos.`
    });
  }

  if (riesgoIA <= 35) {
    pros.push({
      score: 20 + (45 - riesgoIA) * 1.1,
      texto: `Blindaje humano sólido (${100 - riesgoIA}% de resiliencia frente al reemplazo por Inteligencia Artificial).`
    });
  } else {
    contras.push({
      score: 18 + (riesgoIA - 34) * 1.1,
      texto: `Exposición tecnológica a IA (${riesgoIA}% de tareas susceptibles de automatización algorítmica).`
    });
  }

  const diffCalidad = Number((tasaEmpleoCalidadPct - mediaCalidadOITContexto).toFixed(1));
  if (diffCalidad >= 1.5 && tasaInformalidadPct < 36.0) {
    pros.push({
      score: 20 + diffCalidad * 2.0,
      texto: `Sólida cobertura de Empleo de Calidad OIT (${tasaEmpleoCalidadPct}% con contrato y retiro pleno; ${tasaFormalidadPct}% formalidad total).`
    });
    if (tasaInformalidadPct >= 22.0) {
      contras.push({
        score: 9 + tasaInformalidadPct * 0.2,
        texto: `Sector informal residual: el ${tasaInformalidadPct}% aún ejerce por honorarios o sin cobertura completa de prestaciones.`
      });
    }
  } else {
    contras.push({
      score: 19 + tasaInformalidadPct * 0.5,
      texto: `Incidencia de informalidad laboral (${tasaInformalidadPct}% ejerce por honorarios o sin cobertura completa de prestaciones de ley).`
    });
  }

  const diffMicro = Number((pMicro - benchContextual.pct_micro).toFixed(1));
  if (pMicro >= benchContextual.pct_micro) {
    pros.push({
      score: 15 + pMicro * 0.4,
      texto: obtenerTextoIndependenciaPorArea(cve_carrera, pMicro, diffMicro)
    });
  } else {
    contras.push({
      score: 10 + Math.abs(diffMicro) * 0.5,
      texto: `Menor salida hacia práctica independiente (${pMicro.toFixed(1)}% vs. ${benchContextual.pct_micro}% regional), dependiendo de contratación institucional.`
    });
  }

  if (pCorp >= benchContextual.pct_corp) {
    pros.push({
      score: 15 + pCorp * 0.6,
      texto: `Inserción destacada en grandes corporativos y empresas transnacionales (${pCorp.toFixed(1)}% de los ocupados).`
    });
  } else {
    contras.push({
      score: 13 + (benchContextual.pct_corp - pCorp),
      texto: `Menor absorción en grandes corporativos (${pCorp.toFixed(1)}% vs. ${benchContextual.pct_corp}% regional), predominando PYMEs o microempresas.`
    });
  }

  if (pPyme >= benchContextual.pct_pyme) {
    pros.push({
      score: 11 + (pPyme - benchContextual.pct_pyme),
      texto: `Amplia absorción laboral en empresas medianas y pequeñas (${pPyme.toFixed(1)}% en sector PYME).`
    });
  }

  const diffSind = Number((pSindicato - benchContextual.pct_sindicato).toFixed(1));
  if (diffSind >= 0) {
    pros.push({
      score: 14 + diffSind * 1.4,
      texto: `Respaldo gremial y sindical activo (${pSindicato.toFixed(1)}% de afiliación frente a ${benchContextual.pct_sindicato}% regional).`
    });
  } else {
    contras.push({
      score: 11 + Math.abs(diffSind),
      texto: `Menor cobertura sindical o gremial (${pSindicato.toFixed(1)}% vs. ${benchContextual.pct_sindicato}% del promedio regional).`
    });
  }

  const diffSgmm = Number((pSgmm - benchContextual.pct_sgmm).toFixed(1));
  if (diffSgmm >= 0) {
    pros.push({
      score: 13 + diffSgmm * 2.0,
      texto: `Cobertura superior de Seguro de Gastos Médicos Mayores (${pSgmm.toFixed(1)}% vs. ${benchContextual.pct_sgmm}% regional).`
    });
  } else {
    contras.push({
      score: 12 + Math.abs(diffSgmm) * 1.5,
      texto: `Limitada prestación de Seguro Médico Privado SGMM (${pSgmm.toFixed(1)}% vs. ${benchContextual.pct_sgmm}% de la media regional).`
    });
  }

  const arraigoLocal = Number((100 - pDesarraigo).toFixed(1));
  if (pDesarraigo <= benchContextual.pct_desarraigo) {
    pros.push({
      score: 13,
      texto: `Alto arraigo regional (${arraigoLocal}% logra ejercer su profesión sin emigrar de su estado).`
    });
  } else {
    contras.push({
      score: 14 + pDesarraigo * 2.5,
      texto: `Presión de migración laboral (${pDesarraigo.toFixed(1)}% tuvo que cambiar de entidad federativa para ejercer).`
    });
  }

  const empleoUnico = Number((100 - pPluriempleo).toFixed(1));
  if (pPluriempleo <= benchContextual.pct_pluriempleo) {
    pros.push({
      score: 12,
      texto: `Estabilidad de jornada única (${empleoUnico}% vive de un solo empleo sin requerir segundo trabajo).`
    });
  } else {
    contras.push({
      score: 14 + (pPluriempleo - benchContextual.pct_pluriempleo) * 3.0,
      texto: `Mayor necesidad de pluriempleo (${pPluriempleo.toFixed(1)}% requiere dos o más trabajos simultáneos).`
    });
  }

  if (pHomeOffice >= benchContextual.pct_home_office) {
    pros.push({
      score: 12 + pHomeOffice,
      texto: `Mayor flexibilidad de ubicación (${pHomeOffice.toFixed(1)}% en modalidad Home Office vs. ${benchContextual.pct_home_office}% regional).`
    });
  } else {
    contras.push({
      score: 10 + Math.max(0, 8.0 - pHomeOffice),
      texto: `Alta exigencia de presencialidad física (${(100 - pHomeOffice).toFixed(1)}% presencial; solo ${pHomeOffice.toFixed(1)}% en modalidad remota).`
    });
  }

  if (nivelCapEx === 1) {
    pros.push({
      score: 10,
      texto: 'Bajo costo de entrada en equipamiento: se cursa con equipo estándar de cómputo y bibliografía.'
    });
  } else if (nivelCapEx === 2) {
    contras.push({
      score: 9.5,
      texto: 'Exige inversión media en equipamiento de cómputo o laboratorio ($42,000 MXN adicionales durante la carrera).'
    });
  } else if (nivelCapEx === 3) {
    contras.push({
      score: 13,
      texto: 'Exige inversión alta en equipamiento especializado ($85,000 MXN adicionales durante la formación).'
    });
  }

  return {
    topPros: pros.sort((a, b) => b.score - a.score).slice(0, 3).map(p => p.texto),
    topContras: contras.sort((a, b) => b.score - a.score).slice(0, 3).map(c => c.texto)
  };
}

function calcEmpleabilidadRadar(desempleo: number, saturacion: number): number {
  const compOcup = Math.max(10, Math.min(100, 100 - desempleo * 8.0));
  const compSat = Math.max(10, Math.min(100, 168 - saturacion * 1.0));
  return Math.round(compOcup * 0.60 + compSat * 0.40);
}

function calcEstabilidadArraigoRadar(contrato: number, pluriempleo: number, desarraigo: number): number {
  const compPluri = Math.max(10, Math.min(100, 100 - pluriempleo * 5.0));
  const compDesarr = Math.max(10, Math.min(100, 100 - desarraigo * 6.5));
  return Math.round(compPluri * 0.35 + compDesarr * 0.30 + contrato * 0.35);
}

// Marcador Vectorial Monolítico (Rombo + Tallo en un solo eje X=5 para evitar desalineaciones sub-píxel)
function MarcadorMediaVectorial({
  leftPct,
  titulo,
  altura = 24
}: {
  leftPct: number;
  titulo: string;
  altura?: number;
}) {
  return (
    <div
      title={titulo}
      className="absolute -top-2 z-10 -translate-x-1/2 pointer-events-none flex items-center justify-center"
      style={{ left: `${Math.max(0, Math.min(99, leftPct))}%` }}
    >
      <svg
        width="10"
        height={altura}
        viewBox={`0 0 10 ${altura}`}
        className="overflow-visible block"
        shapeRendering="geometricPrecision"
        aria-hidden="true"
      >
        <polygon points="5,0 9.5,4.5 5,9 0.5,4.5" fill="#0F172A" />
        <rect x="4" y="5" width="2" height={altura - 5} rx="1" fill="#0F172A" />
      </svg>
    </div>
  );
}

function RielFriccionDivergente({
  titulo,
  subtitulo,
  valor,
  mediaContextual,
  mediaNacional,
  esVistaRegional,
  maxDesviacionEscala,
  minEscala,
  maxEscala,
  unidad = '%'
}: {
  titulo: string;
  subtitulo: string;
  valor: number;
  mediaContextual: number;
  mediaNacional: number;
  esVistaRegional: boolean;
  maxDesviacionEscala: number;
  minEscala: number;
  maxEscala: number;
  unidad?: string;
}) {
  const esEscalaEstrato = unidad === 'estrato';
  const diff = Number((valor - mediaContextual).toFixed(esEscalaEstrato ? 2 : 1));
  const umbralNeutro = esEscalaEstrato ? 0.05 : 0.3;

  const ratioDesv = Math.max(-1, Math.min(1, (valor - mediaContextual) / Math.max(0.01, maxDesviacionEscala)));
  const posNodo = 50 + ratioDesv * 44;
  const leftTallo = Math.min(50, posNodo);
  const widthTallo = Math.abs(posNodo - 50);

  let colorBadge = 'bg-slate-100 text-slate-600';
  let colorTallo = 'bg-slate-400/60';
  let colorNodo = 'bg-slate-600 ring-slate-200';

  if (Math.abs(diff) >= umbralNeutro) {
    if (diff < 0) {
      colorBadge = 'bg-emerald-50 text-emerald-700 border border-emerald-200/70';
      colorTallo = 'bg-gradient-to-r from-emerald-500/80 to-emerald-400/60';
      colorNodo = 'bg-emerald-600 ring-emerald-500/20';
    } else {
      colorBadge = 'bg-amber-50 text-amber-800 border border-amber-200/70';
      colorTallo = 'bg-gradient-to-r from-amber-400/60 to-amber-500/85';
      colorNodo = 'bg-amber-500 ring-amber-500/25';
    }
  }

  const sufijoDiff = esEscalaEstrato ? ' pts' : unidad;
  const textoValor = esEscalaEstrato ? `${valor.toFixed(2)} / 4` : `${valor.toFixed(1)}${unidad}`;
  const textoMin = esEscalaEstrato ? `${minEscala.toFixed(1)}` : `${minEscala}${unidad}`;
  const textoMediaCtx = esEscalaEstrato ? `${mediaContextual.toFixed(2)}` : `${mediaContextual}${unidad}`;
  const textoMediaNac = esEscalaEstrato ? `${mediaNacional.toFixed(2)}` : `${mediaNacional}${unidad}`;
  const textoMax = esEscalaEstrato ? `${maxEscala.toFixed(1)}` : `${maxEscala}${unidad}`;

  return (
    <div className="py-2.5 border-b border-slate-100 last:border-b-0 group">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="min-w-0">
          <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{titulo}</span>
          <span className="text-[11px] text-slate-400 ml-2 hidden sm:inline">{subtitulo}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${colorBadge}`}>
            {diff > 0 ? `+${diff}${sufijoDiff}` : `${diff}${sufijoDiff}`} vs. Media
          </span>
          <span className="text-sm font-black text-slate-900 w-16 text-right">
            {textoValor}
          </span>
        </div>
      </div>

      <div className="relative h-6 flex items-center my-0.5">
        <div className="w-full h-2.5 rounded-full relative overflow-hidden flex border border-slate-200/70">
          <div className="w-1/2 h-full bg-emerald-500/10" />
          <div className="w-1/2 h-full bg-amber-500/10" />
          <div
            className={`absolute top-0 bottom-0 rounded-full transition-all duration-500 ${colorTallo}`}
            style={{ left: `${leftTallo}%`, width: `${Math.max(1.5, widthTallo)}%` }}
          />
        </div>

        <div
          title={`Media de referencia dinámica: ${textoMediaCtx}`}
          className="absolute left-1/2 -top-0.5 -bottom-0.5 z-10 -translate-x-1/2 pointer-events-none flex items-center justify-center"
        >
          <svg width="4" height="20" viewBox="0 0 4 20" shapeRendering="geometricPrecision" aria-hidden="true">
            <rect x="1" y="0" width="2" height="20" rx="1" fill="#0F172A" />
          </svg>
        </div>

        <div
          title={`Esta carrera: ${textoValor}`}
          className={`absolute w-4 h-4 rounded-full border-2 border-white ring-4 shadow-sm z-20 -translate-x-1/2 transition-all duration-500 ${colorNodo}`}
          style={{ left: `${posNodo}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
        <span className="text-emerald-700 font-bold">{'←'} Menor fricción ({textoMin})</span>
        <span className="text-slate-600 font-semibold">
          {esVistaRegional
            ? `Media Región: ${textoMediaCtx} (Nac: ${textoMediaNac})`
            : `Centro (Media Nac): ${textoMediaNac}`}
        </span>
        <span className="text-amber-800 font-bold">Mayor fricción ({textoMax}) {'→'}</span>
      </div>
    </div>
  );
}

interface FilaComparativaRegionalUI {
  region: string;
  nombreCorto: string;
  estados: string;
  sueldoCarrera: number;
  sueldoPrepa: number;
  premioPct: number;
  formalidadPct: number;
  formalidadPrepaPct: number;
  diffFormalidadPts: number;
  celdaDisponible: boolean;
  scoreDataROIRegional: number;
  roiPublicaReg: number | null;
  roiPrivadaReg: number | null;
  calidadOitReg: number;
  sectorDominanteReg: string;
  nepotismoReg: number;
  estratoReg: number;
}

function CarreraPerfilContenido() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : String(params?.id || '');
  const cve_carrera = rawId.padStart(6, '0');

  const semestresDefaultCarrera = cve_carrera === '091100' ? 12 : 9;

  const regionParam = searchParams.get('region');
  const generoParam = searchParams.get('genero');
  const uniParam = searchParams.get('uni');
  const semParam = searchParams.get('sem');
  const colParam = searchParams.get('col');
  const titParam = searchParams.get('tit');
  const trabParam = searchParams.get('trab');

  const [vinoDeDescubridor, setVinoDeDescubridor] = useState<boolean>(Boolean(regionParam || generoParam));

  const regionInicial = regionParam && REGIONES_ORDEN.includes(regionParam as any) ? regionParam : 'nacional';
  const generoInicial: ModoGeneroEstricto =
    generoParam === 'mujeres' || generoParam === 'hombres' || generoParam === 'total'
      ? generoParam
      : 'total';

  const uniInicial: TipoUniversidadROI =
    uniParam === 'privada_media' || uniParam === 'privada_elite' || uniParam === 'personalizada' || uniParam === 'publica'
      ? uniParam
      : 'publica';

  const [regionActiva, setRegionActiva] = useState<string>(regionInicial);
  const [modoGenero, setModoGenero] = useState<ModoGeneroEstricto>(generoInicial);
  const [metricaRegionalVista, setMetricaRegionalVista] = useState<'sueldo' | 'formalidad'>('sueldo');
  const [segmentoOITHover, setSegmentoOITHover] = useState<SegmentoOITHover>(null);

  const [tipoUniROI, setTipoUniROI] = useState<TipoUniversidadROI>(uniInicial);
  const [gavetaROIAbierta, setGavetaROIAbierta] = useState<boolean>(uniInicial === 'personalizada');
  const [semestresROI, setSemestresROI] = useState<number>(
    semParam && Number(semParam) >= 6 && Number(semParam) <= 14 ? Number(semParam) : semestresDefaultCarrera
  );
  const [colegiaturaMensualROI, setColegiaturaMensualROI] = useState<number>(
    colParam && Number(colParam) >= 0
      ? Number(colParam)
      : uniInicial === 'privada_elite'
        ? 16000
        : uniInicial === 'privada_media'
          ? 6500
          : 300
  );
  const [costoTitulacionROI, setCostoTitulacionROI] = useState<number>(
    titParam && Number(titParam) >= 0 ? Number(titParam) : uniInicial === 'publica' ? 8500 : 22000
  );
  const [nivelTrabajoEstudio, setNivelTrabajoEstudio] = useState<NivelTrabajoEstudio>(
    trabParam === '0.5' ? 0.5 : trabParam === '1' ? 1 : 0
  );

  const [urlRetornoDescubridor, setUrlRetornoDescubridor] = useState<string>(
    `/descubrir?region=${regionInicial}&genero=${generoInicial}`
  );
  const [cvesVersus, setCvesVersus] = useState<string[]>([]);
  const [enlaceCopiado, setEnlaceCopiado] = useState<boolean>(false);
  const [carreraInfo, setCarreraInfo] = useState<any>(null);
  const [todosSatelitesGlobal, setTodosSatelitesGlobal] = useState<any[]>([]);
  const [filasPrediccionesCarrera, setFilasPrediccionesCarrera] = useState<any[]>([]);
  const [statsMercado, setStatsMercado] = useState<ResumenMercadoRegion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.referrer && document.referrer.includes('/descubrir')) {
      setVinoDeDescubridor(true);
    }
    const syncVersus = () => {
      const nueva = leerEstadoDescubridorGlobal().carrerasCompararCves || [];
      setCvesVersus(prev => (prev.join(',') === nueva.join(',') ? prev : nueva));
    };
    syncVersus();
    window.addEventListener(EVENTO_VERSUS_SYNC, syncVersus);
    return () => window.removeEventListener(EVENTO_VERSUS_SYNC, syncVersus);
  }, []);

  const handleToggleCompararActual = () => {
    const nuevaLista = toggleCarreraComparadorGlobal(cve_carrera);
    setCvesVersus(nuevaLista);
  };

  const seleccionarTipoUni = (nuevoTipo: TipoUniversidadROI) => {
    setTipoUniROI(nuevoTipo);
    if (nuevoTipo === 'publica') {
      setColegiaturaMensualROI(300);
      setCostoTitulacionROI(8500);
      setSemestresROI(semestresDefaultCarrera);
      setGavetaROIAbierta(false);
    } else if (nuevoTipo === 'privada_media') {
      setColegiaturaMensualROI(6500);
      setCostoTitulacionROI(22000);
      setSemestresROI(semestresDefaultCarrera);
      setGavetaROIAbierta(false);
    } else if (nuevoTipo === 'privada_elite') {
      setColegiaturaMensualROI(16000);
      setCostoTitulacionROI(28000);
      setSemestresROI(semestresDefaultCarrera);
      setGavetaROIAbierta(false);
    } else {
      setGavetaROIAbierta(true);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('region', regionActiva);
    url.searchParams.set('genero', modoGenero);
    url.searchParams.set('uni', tipoUniROI);
    if (tipoUniROI === 'personalizada' || gavetaROIAbierta) {
      url.searchParams.set('sem', String(semestresROI));
      url.searchParams.set('col', String(colegiaturaMensualROI));
      url.searchParams.set('tit', String(costoTitulacionROI));
      url.searchParams.set('trab', String(nivelTrabajoEstudio));
    } else {
      url.searchParams.delete('sem');
      url.searchParams.delete('col');
      url.searchParams.delete('tit');
      url.searchParams.delete('trab');
    }
    window.history.replaceState({}, '', url.toString());

    try {
      const guardadoRaw = sessionStorage.getItem(STORAGE_KEY_DESCUBRIDOR);
      if (guardadoRaw) {
        const parsed = JSON.parse(guardadoRaw);
        const paramsRet = new URLSearchParams();
        paramsRet.set('region', regionActiva);
        paramsRet.set('genero', modoGenero);
        if (parsed.modoEvaluacion === 'afinidad' && Array.isArray(parsed.activos) && parsed.activos.length > 0) {
          paramsRet.set('modo', 'afinidad');
          if (parsed.sueldoMinimo) paramsRet.set('sueldo', String(parsed.sueldoMinimo));
          paramsRet.set('prio', parsed.activos.join(','));
        } else {
          paramsRet.set('modo', 'calificacion');
        }
        setUrlRetornoDescubridor(`/descubrir?${paramsRet.toString().replace(/%2C/gi, ',')}`);
      } else {
        setUrlRetornoDescubridor(`/descubrir?region=${regionActiva}&genero=${modoGenero}`);
      }
    } catch {
      setUrlRetornoDescubridor(`/descubrir?region=${regionActiva}&genero=${modoGenero}`);
    }
  }, [regionActiva, modoGenero, tipoUniROI, gavetaROIAbierta, semestresROI, colegiaturaMensualROI, costoTitulacionROI, nivelTrabajoEstudio]);

  const handleStatsChange = useCallback((nuevosStats: ResumenMercadoRegion) => {
    setStatsMercado(nuevosStats);
  }, []);

  useEffect(() => {
    async function cargarPerfilYBenchmarks() {
      if (!rawId) return;
      setLoading(true);

      const cveSinCero = String(Number(rawId));

      const [resCarrera, resSat1, resSat2, resPred] = await Promise.all([
        supabase
          .from('dim_carreras')
          .select('cve_carrera, nombre_carrera')
          .in('cve_carrera', [cve_carrera, cveSinCero])
          .limit(1),
        supabase
          .from('satelites_cultura')
          .select('*')
          .order('cve_carrera', { ascending: true })
          .range(0, 999),
        supabase
          .from('satelites_cultura')
          .select('*')
          .order('cve_carrera', { ascending: true })
          .range(1000, 2499),
        supabase
          .from('predicciones_roi')
          .select('anio, cve_ent, sexo, poblacion_activa_total, desempleados_reales, indice_saturacion_pct, sueldo_promedio_mensual, tipo_dato')
          .in('cve_carrera', [cve_carrera, cveSinCero])
          .eq('tipo_dato', 'Real')
          .order('anio', { ascending: true })
          .limit(1000)
      ]);

      const todasFilasSat = [...(resSat1.data || []), ...(resSat2.data || [])];
      const predNormalizadas = (resPred.data || []).map(row => {
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

      setCarreraInfo(resCarrera.data?.[0] || null);
      setTodosSatelitesGlobal(todasFilasSat);
      setFilasPrediccionesCarrera(predNormalizadas);
      setLoading(false);
    }

    cargarPerfilYBenchmarks();
  }, [rawId, cve_carrera]);

  const satelitesCarrera = useMemo(() => {
    const cveSinCero = String(Number(rawId));
    return todosSatelitesGlobal.filter(s => {
      const c = String(s.cve_carrera).padStart(6, '0');
      return c === cve_carrera || String(s.cve_carrera) === cveSinCero;
    });
  }, [todosSatelitesGlobal, cve_carrera, rawId]);

  const codigoSexo = modoGenero === 'hombres' ? 1 : modoGenero === 'mujeres' ? 2 : 0;

  // Diccionario inmutable de métricas de mercado por región (desempleo, saturación y tendencia propias de cada región)
  const metricasMercadoPorRegion = useMemo(() => {
    const extraerSerieZona = (zona: string, sx: number) => {
      const directas = filasPrediccionesCarrera.filter(r => r.cve_ent === zona && r.sexo === sx && r.anio >= 2021 && r.anio <= 2026);
      if (directas.length > 0) return directas;
      if (sx === 0) {
        return filasPrediccionesCarrera.filter(r => r.cve_ent === zona && (r.sexo === 1 || r.sexo === 2) && r.anio >= 2021 && r.anio <= 2026);
      }
      return [];
    };

    const filasNac = extraerSerieZona('nacional', codigoSexo);
    const filasNacConSat = filasNac.filter(r => Number(r.indice_saturacion_pct) > 5);
    const saturacionNacionalBase = filasNacConSat.length > 0
      ? filasNacConSat.reduce((acc, c) => acc + Number(c.indice_saturacion_pct), 0) / filasNacConSat.length
      : 92;

    const mapa: Record<string, { tasaDesempleo: number; saturacion: number; tendenciaCodigo: 'crecimiento' | 'estable' | 'ajuste' | 'volatil' }> = {};

    REGIONES_ORDEN.forEach(zona => {
      let filasCandidatas = extraerSerieZona(zona, codigoSexo);
      if (zona !== 'nacional' && filasCandidatas.filter(r => Number(r.sueldo_promedio_mensual) > 0).length < 3) {
        filasCandidatas = filasNac;
      }

      const porAnio: Record<number, { sueldoProd: number; pobConSueldo: number; pobTotal: number; desTotal: number; satProd: number; pobConSat: number }> = {};
      for (let a = 2021; a <= 2026; a++) {
        porAnio[a] = { sueldoProd: 0, pobConSueldo: 0, pobTotal: 0, desTotal: 0, satProd: 0, pobConSat: 0 };
      }

      filasCandidatas.forEach(row => {
        const a = Number(row.anio);
        if (!porAnio[a]) return;
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

      const puntosAnuales = Object.entries(porAnio).map(([anioStr, d]) => ({
        anio: Number(anioStr),
        sueldo: d.pobConSueldo > 0 ? Math.round(d.sueldoProd / d.pobConSueldo) : null,
        pob: d.pobTotal,
        des: d.desTotal,
        sat: d.pobConSat > 0 ? d.satProd / d.pobConSat : saturacionNacionalBase
      }));

      const ventana5a = puntosAnuales.filter(p => p.anio >= 2022 && p.anio <= 2026 && p.pob > 0);
      const lote = ventana5a.length > 0 ? ventana5a : puntosAnuales.filter(p => p.pob > 0);
      const sumaPea = lote.reduce((acc, d) => acc + d.pob, 0);
      const sumaDes = lote.reduce((acc, d) => acc + d.des, 0);
      const tasaDesempleo = sumaPea > 0 ? Math.max(0.8, (sumaDes / sumaPea) * 100) : 3.2;

      const pt2026 = puntosAnuales.find(d => d.anio === 2026) || puntosAnuales[puntosAnuales.length - 1];
      const saturacion = pt2026 && pt2026.sat > 5 ? pt2026.sat : saturacionNacionalBase;
      const tendencia = clasificarTendenciaSerieReal(puntosAnuales.map(p => ({ anio: p.anio, sueldo: p.sueldo })));

      mapa[zona] = {
        tasaDesempleo: Number(tasaDesempleo.toFixed(1)),
        saturacion: Math.round(saturacion),
        tendenciaCodigo: tendencia.codigo
      };
    });

    return mapa;
  }, [filasPrediccionesCarrera, codigoSexo]);

  const { benchContextual, benchNacionalFijo } = useMemo(() => {
    return {
      benchContextual: calcularBenchmarkDinamicoSatelites(todosSatelitesGlobal, regionActiva, codigoSexo),
      benchNacionalFijo: calcularBenchmarkDinamicoSatelites(todosSatelitesGlobal, 'nacional', codigoSexo)
    };
  }, [todosSatelitesGlobal, regionActiva, codigoSexo]);

  const {
    sateliteActual,
    obtenerSateliteRegion,
    tieneMuestraCelda,
    mapaKishActivo
  } = useMemo(() => {
    const existeCelda = (reg: string, sx: number) => {
      const fila = satelitesCarrera.find(
        s => (s.region || 'nacional') === reg && Number(s.sexo ?? 0) === sx
      );
      if (!fila) return false;
      const nReal = Number(fila.n_encuestados_reales || 0);
      const vol = Number(fila.volumen_muestra_nacional || 0);
      if (reg === 'nacional') return true;
      if (nReal > 0) return sx === 0 ? nReal >= 30 : nReal >= 25;
      return sx === 0 ? vol >= 15000 : vol >= 10000;
    };

    const buscarFilaExactaORespaldo = (regTarget: string, sxTarget: number) => {
      const exacta = satelitesCarrera.find(
        s => (s.region || 'nacional') === regTarget && Number(s.sexo ?? 0) === sxTarget
      );
      if (exacta) return exacta;
      return (
        satelitesCarrera.find(s => (s.region || 'nacional') === regTarget && Number(s.sexo ?? 0) === 0) ||
        satelitesCarrera.find(s => (s.region || 'nacional') === 'nacional' && Number(s.sexo ?? 0) === sxTarget) ||
        satelitesCarrera.find(s => (s.region || 'nacional') === 'nacional' && Number(s.sexo ?? 0) === 0) ||
        satelitesCarrera[0] ||
        null
      );
    };

    const kishMap: Record<string, number> = {};
    REGIONES_ORDEN.forEach(r => {
      const f = satelitesCarrera.find(s => (s.region || 'nacional') === r && Number(s.sexo ?? 0) === codigoSexo);
      kishMap[r] = Number(f?.n_efectivo_kish || 0);
    });

    return {
      sateliteActual: buscarFilaExactaORespaldo(regionActiva, codigoSexo),
      obtenerSateliteRegion: (reg: string) => buscarFilaExactaORespaldo(reg, codigoSexo),
      tieneMuestraCelda: existeCelda,
      mapaKishActivo: kishMap
    };
  }, [satelitesCarrera, regionActiva, codigoSexo]);

  useEffect(() => {
    if (satelitesCarrera.length > 0 && modoGenero !== 'total') {
      const sx = modoGenero === 'hombres' ? 1 : 2;
      if (!tieneMuestraCelda(regionActiva, sx)) {
        setModoGenero('total');
      }
    }
  }, [regionActiva, modoGenero, satelitesCarrera, tieneMuestraCelda]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6">
        <Loader2 className="w-9 h-9 animate-spin text-blue-600 mb-3" />
        <p className="text-slate-500 text-sm font-medium">Cargando reporte ejecutivo y calculando benchmarks dinámicos...</p>
      </div>
    );
  }

  if (!carreraInfo) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs max-w-md">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h1 className="text-xl font-black text-slate-900 mb-2">Carrera no encontrada</h1>
          <p className="text-xs text-slate-500 mb-6">
            La clave <strong>{cve_carrera}</strong> no existe en el catálogo o fue descartada por falta de muestra estadística.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al Catálogo
          </Link>
        </div>
      </div>
    );
  }

  const nombreEjecutivoCarrera = formatearNombreCarreraEjecutivo(cve_carrera, carreraInfo.nombre_carrera);
  const tieneSubtituloOficial = nombreEjecutivoCarrera !== carreraInfo.nombre_carrera;

  const esVistaRegional = regionActiva !== 'nacional';
  const benchReg = BENCHMARK_PREPA[regionActiva] || BENCHMARK_PREPA.nacional;
  const riesgoIA = Number(sateliteActual?.riesgo_ia_score ?? 40);
  const nEncuestadosActivos = Number(sateliteActual?.n_encuestados_reales || 0);
  const capex = obtenerCapExCarrera(cve_carrera);

  const pContrato = Number(sateliteActual?.pct_contrato || 0);
  const pAguinaldo = Number(sateliteActual?.pct_aguinaldo || 0);
  const pAfore = Number(sateliteActual?.pct_afore || 0);
  const pPluriempleo = Number(sateliteActual?.pct_pluriempleo || 0);
  const pDesarraigo = Number(sateliteActual?.pct_desarraigo || 0);
  const pHomeOffice = Number(sateliteActual?.pct_home_office || 0);
  const pMedioTiempo = Number(sateliteActual?.pct_medio_tiempo || 0);
  const pSindicato = Number(sateliteActual?.pct_sindicato || 0);
  const pSgmm = Number(sateliteActual?.pct_sgmm || 0);
  const pMicro = Number(sateliteActual?.pct_micro || 0);
  const pCorp = Number(sateliteActual?.pct_corp || 0);
  const pPyme = Number(sateliteActual?.pct_pyme || 0);
  const pGob = Number(sateliteActual?.pct_gobierno || 0);

  const tasaFormalidadPct = Number((pContrato * 0.45 + pAguinaldo * 0.30 + pAfore * 0.25).toFixed(1));
  const tasaEmpleoCalidadPct = Number(
    (((Math.min(pContrato, pAfore) * 0.70 + pContrato * 0.30) * (1 - pPluriempleo / 200))).toFixed(1)
  );
  const tasaFormalBasicoPct = Number(Math.max(0, tasaFormalidadPct - tasaEmpleoCalidadPct).toFixed(1));
  const tasaInformalidadPct = Number(Math.max(0, 100 - tasaEmpleoCalidadPct - tasaFormalBasicoPct).toFixed(1));

  const mediaCalidadOITContexto = Number(
    (((Math.min(benchContextual.pct_contrato, benchContextual.pct_afore) * 0.70 + benchContextual.pct_contrato * 0.30) * (1 - benchContextual.pct_pluriempleo / 200))).toFixed(1)
  );
  const diffCalidadVsMediaLic = Number((tasaEmpleoCalidadPct - mediaCalidadOITContexto).toFixed(1));

  const peaTotal = statsMercado?.poblacionActiva || 0;
  const desempleadosCount = statsMercado?.desempleadosActivos || 0;
  const ocupadosCount = Math.max(0, peaTotal - desempleadosCount);

  const countCalidad = Math.round(ocupadosCount * (tasaEmpleoCalidadPct / 100));
  const countFormalBasico = Math.round(ocupadosCount * (tasaFormalBasicoPct / 100));
  const countInformal = Math.max(0, ocupadosCount - countCalidad - countFormalBasico);

  const sueldoParaRadar = statsMercado?.sueldoActivo || benchReg.sueldo_lic_promedio;
  const sueldoPrepaParaROI = statsMercado?.sueldoPrepaActivo || benchReg.sueldo_general;
  const premioVsPrepaActivo = statsMercado?.premioVsPrepaPct ?? Number((((sueldoParaRadar - sueldoPrepaParaROI) / sueldoPrepaParaROI) * 100).toFixed(1));

  const metricasRegActiva = metricasMercadoPorRegion[regionActiva];
  const satRaw = metricasRegActiva?.saturacion ?? statsMercado?.saturacion ?? 100;
  const saturacionSegura = satRaw > 5 ? satRaw : 100;
  const desempleoSeguro = metricasRegActiva?.tasaDesempleo ?? statsMercado?.tasaDesempleo ?? 3.5;
  const tendenciaSegura = metricasRegActiva?.tendenciaCodigo ?? statsMercado?.tendenciaCodigo ?? 'estable';

  const social = calcularMetricasSocialesContextual({
    indicePrivilegioRaw: sateliteActual?.indice_privilegio,
    pctNepotismoRaw: sateliteActual?.pct_nepotismo,
    pctSindicatoRaw: pSindicato,
    pctCorpRaw: pCorp,
    pctPymeRaw: pPyme,
    tasaCalidadOIT: tasaEmpleoCalidadPct,
    sueldoActivo: sueldoParaRadar,
    sueldoPrepaActivo: sueldoPrepaParaROI,
    mediaEstratoContexto: benchContextual.indice_privilegio,
    mediaNepotismoContexto: benchContextual.pct_nepotismo
  });

  const evalScoreActual = calcularScoreDataROIUniversal({
    Prima_vs_Prepa_Pct: premioVsPrepaActivo,
    Desempleo_Abierto_Pct: Number(desempleoSeguro.toFixed(1)),
    Saturacion_ANUIES_Pct: Math.round(saturacionSegura),
    Empleo_Calidad_OIT_Pct: tasaEmpleoCalidadPct,
    Formalidad_Total_Pct: tasaFormalidadPct,
    Meritocracia_Pct: social.scoreMovilidad,
    Blindaje_IA_Pct: 100 - riesgoIA,
    Tendencia_Codigo: tendenciaSegura,
    Empleo_Unico_Pct: Number(Math.max(0, 100 - pPluriempleo).toFixed(1)),
    Arraigo_Local_Pct: Number(Math.max(0, 100 - pDesarraigo).toFixed(1))
  });

  const scoreEnteroActual = Math.round(evalScoreActual.score);
  const semaforoScoreActual = obtenerSemaforoScoreDataROI(evalScoreActual.score);

  const diagnosticoEjecutivo = generarDiagnosticoEjecutivoV2({
    cve_carrera,
    sueldoActivo: sueldoParaRadar,
    sueldoPrepaActivo: sueldoPrepaParaROI,
    sueldoLicMediaReg: benchReg.sueldo_lic_promedio,
    premioVsPrepaPct: premioVsPrepaActivo,
    tasaDesempleo: desempleoSeguro,
    saturacion: saturacionSegura,
    riesgoIA,
    tasaFormalidadPct,
    tasaInformalidadPct,
    tasaEmpleoCalidadPct,
    mediaCalidadOITContexto,
    estrato: social.estrato,
    nepotismo: social.nepotismo,
    pSindicato,
    pSgmm,
    pMicro,
    pPyme,
    pCorp,
    pDesarraigo,
    pPluriempleo,
    pHomeOffice,
    nivelCapEx: capex.nivel,
    benchContextual
  });

  const costoAcademicoSemestral = colegiaturaMensualROI * 6;
  const costoColegiaturaTotal = costoAcademicoSemestral * semestresROI;
  const inversionDirectaBolsillo = costoColegiaturaTotal + costoTitulacionROI + capex.costoEquipo;

  const mesesEstudioTotales = semestresROI * 6;
  const costoOportunidadNeto = Math.round(sueldoPrepaParaROI * mesesEstudioTotales * (1 - nivelTrabajoEstudio));
  const inversionEconomicaTotalMincer = inversionDirectaBolsillo + costoOportunidadNeto;

  const bonoAnualROI = (sueldoParaRadar - sueldoPrepaParaROI) * 12;
  const aniosRetornoBolsillo = bonoAnualROI > 0 ? Number((inversionDirectaBolsillo / bonoAnualROI).toFixed(1)) : null;
  const aniosRetornoEconomicoMincer = bonoAnualROI > 0 ? Number((inversionEconomicaTotalMincer / bonoAnualROI).toFixed(1)) : null;
  const gananciaNeta10Anios = bonoAnualROI * 10 - inversionDirectaBolsillo;

  const invArqPublica = semestresDefaultCarrera * 1800 + 8500 + capex.costoEquipo;
  const invArqPrivMedia = semestresDefaultCarrera * (6500 * 6) + 22000 + capex.costoEquipo;
  const invArqPrivElite = semestresDefaultCarrera * (16000 * 6) + 28000 + capex.costoEquipo;

  const aniosArqPublica = bonoAnualROI > 0 ? Number((invArqPublica / bonoAnualROI).toFixed(1)) : null;
  const aniosArqPrivMedia = bonoAnualROI > 0 ? Number((invArqPrivMedia / bonoAnualROI).toFixed(1)) : null;
  const aniosArqPrivElite = bonoAnualROI > 0 ? Number((invArqPrivElite / bonoAnualROI).toFixed(1)) : null;

  const etiquetaColegiaturaReceta =
    colegiaturaMensualROI === 0
      ? 'Colegiatura $0/mes (Beca 100% / Gratuita)'
      : colegiaturaMensualROI <= 600
        ? `Cuota pública ${formatoMoneda(colegiaturaMensualROI)}/mes (${formatoMoneda(costoAcademicoSemestral)}/sem)`
        : `Colegiatura ${formatoMoneda(colegiaturaMensualROI)}/mes`;

  const supuestoROICortoTexto = `${semestresROI} semestres (${(semestresROI / 2).toFixed(1)} años) · ${etiquetaColegiaturaReceta} · Titulación ${formatoMoneda(costoTitulacionROI)} · Equipo ${formatoMoneda(capex.costoEquipo)}`;

  let semaforoROI = {
    etiqueta: 'Retorno Rápido (Alta viabilidad)',
    claseBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    colorBarra: 'bg-gradient-to-r from-emerald-600 to-teal-400'
  };
  if (aniosRetornoBolsillo === null) {
    semaforoROI = {
      etiqueta: 'Retorno Negativo en esta zona',
      claseBadge: 'bg-rose-50 text-rose-700 border-rose-200',
      colorBarra: 'bg-gradient-to-r from-rose-600 to-orange-500'
    };
  } else if (aniosRetornoBolsillo > 14) {
    semaforoROI = {
      etiqueta: 'Riesgo Financiero (Sobrecosto)',
      claseBadge: 'bg-rose-50 text-rose-700 border-rose-200',
      colorBarra: 'bg-gradient-to-r from-rose-600 to-orange-500'
    };
  } else if (aniosRetornoBolsillo > 7.5) {
    semaforoROI = {
      etiqueta: 'Retorno Lento (Exige beca alta)',
      claseBadge: 'bg-amber-50 text-amber-800 border-amber-200',
      colorBarra: 'bg-gradient-to-r from-amber-500 to-yellow-400'
    };
  } else if (aniosRetornoBolsillo > 3.5) {
    semaforoROI = {
      etiqueta: 'Retorno Moderado (Plazo medio)',
      claseBadge: 'bg-blue-50 text-blue-700 border-blue-200',
      colorBarra: 'bg-gradient-to-r from-blue-600 to-indigo-500'
    };
  }

  const scoreSalario = Math.round(Math.max(15, Math.min(100, ((sueldoParaRadar - 9500) / (22000 - 9500)) * 100)));
  const scoreSalarioMedia = Math.round(Math.max(15, Math.min(100, ((benchReg.sueldo_lic_promedio - 9500) / (22000 - 9500)) * 100)));

  const scoreFormalidad = Math.round(tasaFormalidadPct);
  const scoreFormalidadMedia = Math.round(benchContextual.pct_contrato * 0.45 + benchContextual.pct_aguinaldo * 0.30 + benchContextual.pct_afore * 0.25);

  const scoreEmpleabilidad = calcEmpleabilidadRadar(desempleoSeguro, saturacionSegura);
  const scoreEmpleabilidadMedia = calcEmpleabilidadRadar(3.5, 100);

  const scoreMeritocracia = Math.round(social.scoreMovilidad);
  const scoreMeritocraciaMedia = 58;

  const scoreFuturo = evalScoreActual.pilares.blindajeFuturo;
  const scoreFuturoMedia = 60;

  const scoreEstabilidad = calcEstabilidadArraigoRadar(pContrato, pPluriempleo, pDesarraigo);
  const scoreEstabilidadMedia = calcEstabilidadArraigoRadar(benchContextual.pct_contrato, benchContextual.pct_pluriempleo, benchContextual.pct_desarraigo);

  const datosRadar = [
    { eje: `Salario (${scoreSalario})`, nombreCorto: 'Salario', Carrera: scoreSalario, 'Media Contextual': scoreSalarioMedia, diff: scoreSalario - scoreSalarioMedia },
    { eje: `Formalidad (${scoreFormalidad})`, nombreCorto: 'Formalidad', Carrera: scoreFormalidad, 'Media Contextual': scoreFormalidadMedia, diff: scoreFormalidad - scoreFormalidadMedia },
    { eje: `Empleo (${scoreEmpleabilidad})`, nombreCorto: 'Empleabilidad', Carrera: scoreEmpleabilidad, 'Media Contextual': scoreEmpleabilidadMedia, diff: scoreEmpleabilidad - scoreEmpleabilidadMedia },
    { eje: `Mérito (${scoreMeritocracia})`, nombreCorto: 'Meritocracia', Carrera: scoreMeritocracia, 'Media Contextual': scoreMeritocraciaMedia, diff: scoreMeritocracia - scoreMeritocraciaMedia },
    { eje: `Futuro (${scoreFuturo})`, nombreCorto: 'Blindaje IA', Carrera: scoreFuturo, 'Media Contextual': scoreFuturoMedia, diff: scoreFuturo - scoreFuturoMedia },
    { eje: `Estabilidad (${scoreEstabilidad})`, nombreCorto: 'Estabilidad', Carrera: scoreEstabilidad, 'Media Contextual': scoreEstabilidadMedia, diff: scoreEstabilidad - scoreEstabilidadMedia }
  ];

  const desglose6PilaresScore = [
    { label: 'Retorno Salarial (25%)', val: evalScoreActual.pilares.retornoSalarial },
    { label: 'Empleabilidad (20%)', val: evalScoreActual.pilares.empleabilidad },
    { label: 'Calidad OIT (20%)', val: evalScoreActual.pilares.calidadOIT },
    { label: 'Meritocracia (15%)', val: evalScoreActual.pilares.meritocracia },
    { label: 'Blindaje y Futuro (10%)', val: evalScoreActual.pilares.blindajeFuturo },
    { label: 'Estabilidad (10%)', val: evalScoreActual.pilares.estabilidadVida }
  ];

  const pAcademiaOtros = Math.max(0, Number((100 - (pCorp + pPyme + pMicro + pGob)).toFixed(1)));

  const listaEmpleadores = [
    { id: 'pyme', name: 'PYME (Empresas y Planteles 6–100 emp.)', value: pPyme, icon: <Briefcase className="w-3.5 h-3.5" aria-hidden="true" /> },
    { id: 'micro', name: 'Microempresa y Práctica Independiente', value: pMicro, icon: <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> },
    { id: 'corp', name: 'Gran Corporativo y Transnacional', value: pCorp, icon: <Building2 className="w-3.5 h-3.5" aria-hidden="true" /> },
    { id: 'gob', name: 'Administración Pública y Gobierno', value: pGob, icon: <Landmark className="w-3.5 h-3.5" aria-hidden="true" /> },
    ...(pAcademiaOtros > 0.5 ? [{ id: 'acad', name: 'Academia, Investigación y ONGs', value: pAcademiaOtros, icon: <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" /> }] : [])
  ]
    .sort((a, b) => b.value - a.value)
    .map((item, idx) => ({
      ...item,
      estilo: ESTILOS_MOSAICO_EMPLEADORES[idx] || ESTILOS_MOSAICO_EMPLEADORES[4]
    }));

  const listaPrestaciones = [
    { nombre: 'Contrato Escrito Estable', valor: pContrato, mediaCtx: benchContextual.pct_contrato },
    { nombre: 'Aguinaldo de Ley', valor: pAguinaldo, mediaCtx: benchContextual.pct_aguinaldo },
    { nombre: 'Fondo de Retiro (AFORE)', valor: pAfore, mediaCtx: benchContextual.pct_afore },
    { nombre: 'Protección Materna / Paterna', valor: Number(sateliteActual?.pct_materno || 0), mediaCtx: benchContextual.pct_materno },
    { nombre: 'Afiliación Sindical / Gremial', valor: pSindicato, mediaCtx: benchContextual.pct_sindicato },
    { nombre: 'Seguro Médico Privado (SGMM)', valor: pSgmm, mediaCtx: benchContextual.pct_sgmm }
  ];

  const hrsH = Number(sateliteActual?.hrs_doble_jornada_hombres || 0);
  const hrsM = Number(sateliteActual?.hrs_doble_jornada_mujeres || 0);
  const hrsTotalEstandarizado = Number(((hrsH + hrsM) / 2).toFixed(1));

  const hrsHogarActiva =
    modoGenero === 'mujeres' ? hrsM :
    modoGenero === 'hombres' ? hrsH :
    hrsTotalEstandarizado;

  const sueldoBaseNacRef = statsMercado?.sueldoNacionalBase || statsMercado?.sueldoActivo || BENCHMARK_PREPA.nacional.sueldo_lic_promedio;

  // Cada una de las 5 Macro-Regiones utiliza sus propios indicadores regionales inmutables
  const filasComparativaRegional: FilaComparativaRegionalUI[] = MACRO_REGIONES_5.map((regKey) => {
    const bReg = BENCHMARK_PREPA[regKey] || BENCHMARK_PREPA.nacional;
    const itemDesdeStats = statsMercado?.comparativaRegiones?.find((r: SueldoRegionalItem) => r.region === regKey);
    const celdaDisp = tieneMuestraCelda(regKey, codigoSexo);

    const sueldoCarreraReg = (itemDesdeStats && itemDesdeStats.sueldoCarrera > 0)
      ? itemDesdeStats.sueldoCarrera
      : sueldoBaseNacRef;

    const sueldoPrepaReg =
      modoGenero === 'hombres' ? bReg.sueldo_hombres :
      modoGenero === 'mujeres' ? bReg.sueldo_mujeres :
      bReg.sueldo_general;

    const premioPctReg = sueldoPrepaReg > 0
      ? Number((((sueldoCarreraReg - sueldoPrepaReg) / sueldoPrepaReg) * 100).toFixed(1))
      : 0;

    const satR = obtenerSateliteRegion(regKey);
    const pContR = Number(satR?.pct_contrato || pContrato);
    const pAguiR = Number(satR?.pct_aguinaldo || pAguinaldo);
    const pAforR = Number(satR?.pct_afore || pAfore);
    const pPlurR = Number(satR?.pct_pluriempleo || pPluriempleo);
    const pDesaR = Number(satR?.pct_desarraigo || pDesarraigo);
    const pNepR = Number(satR?.pct_nepotismo || social.nepotismo);
    const pEstR = Number(satR?.indice_privilegio || social.estrato);

    const formR = Number((pContR * 0.45 + pAguiR * 0.30 + pAforR * 0.25).toFixed(1));
    const calOitR = Number((((Math.min(pContR, pAforR) * 0.70 + pContR * 0.30) * (1 - pPlurR / 200))).toFixed(1));
    const formPrepaReg = bReg.formalidad_prepa_pct || 50.1;
    const diffFormPts = Number((formR - formPrepaReg).toFixed(1));

    const benchCtxReg = calcularBenchmarkDinamicoSatelites(todosSatelitesGlobal, regKey, codigoSexo);
    const socialReg = calcularMetricasSocialesContextual({
      indicePrivilegioRaw: pEstR,
      pctNepotismoRaw: pNepR,
      pctSindicatoRaw: satR?.pct_sindicato,
      pctCorpRaw: satR?.pct_corp,
      pctPymeRaw: satR?.pct_pyme,
      tasaCalidadOIT: calOitR,
      sueldoActivo: sueldoCarreraReg,
      sueldoPrepaActivo: sueldoPrepaReg,
      mediaEstratoContexto: benchCtxReg.indice_privilegio,
      mediaNepotismoContexto: benchCtxReg.pct_nepotismo
    });

    const metMercadoReg = metricasMercadoPorRegion[regKey];
    const desempleoRegPropio = metMercadoReg?.tasaDesempleo ?? 3.5;
    const saturacionRegPropia = metMercadoReg?.saturacion ?? 92;
    const tendenciaRegPropia = metMercadoReg?.tendenciaCodigo ?? 'estable';

    const evalReg = calcularScoreDataROIUniversal({
      Prima_vs_Prepa_Pct: premioPctReg,
      Desempleo_Abierto_Pct: Number(desempleoRegPropio.toFixed(1)),
      Saturacion_ANUIES_Pct: Math.round(saturacionRegPropia),
      Empleo_Calidad_OIT_Pct: calOitR,
      Formalidad_Total_Pct: formR,
      Meritocracia_Pct: socialReg.scoreMovilidad,
      Blindaje_IA_Pct: 100 - riesgoIA,
      Tendencia_Codigo: tendenciaRegPropia,
      Empleo_Unico_Pct: Number(Math.max(0, 100 - pPlurR).toFixed(1)),
      Arraigo_Local_Pct: Number(Math.max(0, 100 - pDesaR).toFixed(1))
    });

    const bonoAnualReg = (sueldoCarreraReg - sueldoPrepaReg) * 12;
    const invPubBase = semestresDefaultCarrera * 1800 + 8500 + capex.costoEquipo;
    const invPrivBase = semestresDefaultCarrera * (6500 * 6) + 22000 + capex.costoEquipo;

    return {
      region: regKey,
      nombreCorto: REGIONES_INFO[regKey]?.corto || regKey,
      estados: REGIONES_INFO[regKey]?.estados || '',
      sueldoCarrera: sueldoCarreraReg,
      sueldoPrepa: sueldoPrepaReg,
      premioPct: premioPctReg,
      formalidadPct: formR,
      formalidadPrepaPct: formPrepaReg,
      diffFormalidadPts: diffFormPts,
      celdaDisponible: celdaDisp,
      scoreDataROIRegional: Math.round(evalReg.score),
      roiPublicaReg: bonoAnualReg > 0 ? Number((invPubBase / bonoAnualReg).toFixed(1)) : null,
      roiPrivadaReg: bonoAnualReg > 0 ? Number((invPrivBase / bonoAnualReg).toFixed(1)) : null,
      calidadOitReg: calOitR,
      sectorDominanteReg: obtenerSectorDominanteCorto(satR),
      nepotismoReg: Number(pNepR.toFixed(1)),
      estratoReg: Number(pEstR.toFixed(2))
    };
  });

  const regionesConMuestra = filasComparativaRegional.filter(r => r.celdaDisponible);
  const maxSueldoLiderReg = regionesConMuestra.length > 0 ? Math.max(...regionesConMuestra.map(r => r.sueldoCarrera)) : -1;
  const maxFormalidadLiderReg = regionesConMuestra.length > 0 ? Math.max(...regionesConMuestra.map(r => r.formalidadPct)) : -1;

  const maxSueldoCarreraReg = Math.max(...filasComparativaRegional.map((r: FilaComparativaRegionalUI) => Math.max(r.sueldoCarrera, r.sueldoPrepa)));
  const techoDinamicoSueldoRegional = Math.max(14000, Math.ceil((maxSueldoCarreraReg * 1.15) / 1000) * 1000);

  const diagSat = diagnosticarSaturacion(saturacionSegura);
  const diffHomeOffice = Number((pHomeOffice - benchContextual.pct_home_office).toFixed(1));
  const diffMedioTiempo = Number((pMedioTiempo - benchContextual.pct_medio_tiempo).toFixed(1));
  const totalHallazgos = diagnosticoEjecutivo.topPros.length + diagnosticoEjecutivo.topContras.length;

  const etiquetaGeneroActual = modoGenero === 'mujeres' ? 'Solo Mujeres' : modoGenero === 'hombres' ? 'Solo Hombres' : 'Total General';

  const obtenerSerieAnualConfiable = () => {
    if (statsMercado?.serieAnualReal && statsMercado.serieAnualReal.length > 0) {
      return statsMercado.serieAnualReal;
    }
    const ratioPrepaH = benchReg.sueldo_general > 0 ? benchReg.sueldo_hombres / benchReg.sueldo_general : 1;
    const ratioPrepaM = benchReg.sueldo_general > 0 ? benchReg.sueldo_mujeres / benchReg.sueldo_general : 1;
    const factorPrepa = modoGenero === 'hombres' ? ratioPrepaH : modoGenero === 'mujeres' ? ratioPrepaM : 1;
    return [2021, 2022, 2023, 2024, 2025, 2026].map(anio => ({
      anio,
      sueldoLic: sueldoParaRadar,
      sueldoPrepa: Math.round((benchReg.historico_anual[String(anio)] || benchReg.sueldo_general) * factorPrepa),
      pea: peaTotal
    }));
  };

  const compartirAnalisis = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `DataROI — ${nombreEjecutivoCarrera} (${REGIONES_INFO[regionActiva]?.corto})`,
          text: `Calificación DataROI ${scoreEnteroActual}/100 y radiografía salarial de ${nombreEjecutivoCarrera} en ${REGIONES_INFO[regionActiva]?.nombre}.`,
          url
        });
        return;
      } catch {
        // Fallback al portapapeles
      }
    }
    await navigator.clipboard.writeText(url);
    setEnlaceCopiado(true);
    setTimeout(() => setEnlaceCopiado(false), 2200);
  };

  const construirHojasFichaCarrera = () => {
    const cohortRegSx = todosSatelitesGlobal.filter(
      r => String(r.region || 'nacional').toLowerCase() === regionActiva && Number(r.sexo ?? 0) === codigoSexo
    );
    const loteRanking = cohortRegSx.length > 5
      ? cohortRegSx
      : todosSatelitesGlobal.filter(r => String(r.region || 'nacional').toLowerCase() === 'nacional' && Number(r.sexo ?? 0) === 0);

    const calcularLugarEnRegion = (extractor: (row: any) => number, valorActual: number, mejorAlto: boolean): string => {
      if (loteRanking.length === 0) return '#1 de 64';
      const valores = loteRanking.map(extractor).filter(v => Number.isFinite(v));
      if (valores.length === 0) return '#1 de 64';
      const mejores = valores.filter(v => (mejorAlto ? v > valorActual + 0.001 : v < valorActual - 0.001)).length;
      return `#${mejores + 1} de ${valores.length}`;
    };

    const filasHoja1: ValorCeldaExcel[][] = [
      [{ v: 'Nombre de la Licenciatura Auditada', s: 'bold' }, { v: `${nombreEjecutivoCarrera} (CVE: ${cve_carrera})`, s: 'section' }, carreraInfo.nombre_carrera],
      [
        { v: 'Calificación Integral DataROI (0–100)', s: 'bold' },
        { v: `${scoreEnteroActual} / 100 pts (Grado ${semaforoScoreActual.grado} — ${semaforoScoreActual.etiqueta})`, s: semaforoScoreActual.grado === 'A' ? 'winner' : semaforoScoreActual.grado === 'C' ? 'warning' : 'gold' },
        `Ponderación de 6 Pilares: Retorno ${evalScoreActual.pilares.retornoSalarial}, Empleo ${evalScoreActual.pilares.empleabilidad}, Calidad OIT ${evalScoreActual.pilares.calidadOIT}, Mérito ${evalScoreActual.pilares.meritocracia}, Futuro ${evalScoreActual.pilares.blindajeFuturo}, Estabilidad ${evalScoreActual.pilares.estabilidadVida}`
      ],
      ['Macro-Región y Perspectiva de Género', { v: `${REGIONES_INFO[regionActiva]?.nombre} (${etiquetaGeneroActual})`, s: 'bold' }, REGIONES_INFO[regionActiva]?.estados || '32 entidades federativas'],
      ['Muestra Física Certificada INEGI', { v: `${nEncuestadosActivos.toLocaleString('es-MX')} profesionistas encuestados`, s: 'bold' }, `PEA Activa Estimada: ${peaTotal.toLocaleString('es-MX')} profesionistas (${ocupadosCount.toLocaleString('es-MX')} ocupados)`],
      ['Salario Mensual Consolidado (Pesos 2026)', { v: `${formatoMoneda(sueldoParaRadar)} MXN / mes`, s: 'winner' }, `Media de todas las licenciaturas en esta región: ${formatoMoneda(benchReg.sueldo_lic_promedio)} / mes`],
      ['Salario Base Preparatoria Regional', { v: `${formatoMoneda(sueldoPrepaParaROI)} MXN / mes`, s: 'bold' }, 'Costo de oportunidad mensual de un egresado de bachillerato en la misma región y género'],
      ['Prima Salarial Universitaria vs. Prepa', { v: `${premioVsPrepaActivo >= 0 ? `+${premioVsPrepaActivo}%` : `${premioVsPrepaActivo}%`} sobre bachillerato`, s: premioVsPrepaActivo >= 25 ? 'winner' : 'bold' }, `Bono salarial anual extra por tener título: ${formatoMoneda(bonoAnualROI)} MXN / año`],
      ['Tendencia Salarial Real (2021–2026)', { v: statsMercado?.tendenciaEtiqueta || 'Estable', s: 'bold' }, 'Evaluada sobre la trayectoria post-pandemia deflactada con el INPC'],
      ['Inversión Requerida en Equipamiento (CapEx)', { v: `${formatoMoneda(capex.costoEquipo)} MXN (${capex.etiqueta})`, s: 'bold' }, capex.detalle],
      [
        'Escenario ROI 1: Universidad Pública Estándar',
        { v: bonoAnualROI > 0 ? `${(invArqPublica / bonoAnualROI).toFixed(1)} años de trabajo (Inversión: ${formatoMoneda(invArqPublica)})` : 'No amortizable', s: 'winner' },
        `Supuesto: ${semestresDefaultCarrera} semestres · Cuota pública $300/mes ($1,800/sem) + Titulación $8,500 + Equipo ${formatoMoneda(capex.costoEquipo)}`
      ],
      [
        'Escenario ROI 2: Universidad Privada Media',
        { v: bonoAnualROI > 0 ? `${(invArqPrivMedia / bonoAnualROI).toFixed(1)} años de trabajo (Inversión: ${formatoMoneda(invArqPrivMedia)})` : 'No amortizable', s: 'bold' },
        `Supuesto: ${semestresDefaultCarrera} semestres · Colegiatura $6,500/mes (6 pagos/sem) + Titulación $22,000 + Equipo ${formatoMoneda(capex.costoEquipo)}`
      ],
      [
        'Escenario ROI 3: Universidad Privada Élite',
        { v: bonoAnualROI > 0 ? `${(invArqPrivElite / bonoAnualROI).toFixed(1)} años de trabajo (Inversión: ${formatoMoneda(invArqPrivElite)})` : 'No amortizable', s: 'bold' },
        `Supuesto: ${semestresDefaultCarrera} semestres · Colegiatura $16,000/mes (6 pagos/sem) + Titulación $28,000 + Equipo ${formatoMoneda(capex.costoEquipo)}`
      ],
      [
        'Simulación Personalizada Activa (Bolsillo)',
        { v: `${formatearAniosROI(aniosRetornoBolsillo)} — ${semaforoROI.etiqueta}`, s: 'section' },
        `${supuestoROICortoTexto} · Ganancia neta a 10 años: ${formatoMoneda(gananciaNeta10Anios)}`
      ],
      [
        'Simulación Económica Total (Con Costo de Oportunidad Mincer)',
        { v: `${formatearAniosROI(aniosRetornoEconomicoMincer)} (Inversión económica total: ${formatoMoneda(inversionEconomicaTotalMincer)})`, s: 'bold' },
        `Incluye ${formatoMoneda(costoOportunidadNeto)} MXN de sueldos de preparatoria no percibidos durante ${mesesEstudioTotales} meses de estudio (${
          nivelTrabajoEstudio === 0 ? 'Sin trabajar al estudiar' : nivelTrabajoEstudio === 0.5 ? 'Trabajando medio tiempo 50%' : 'Trabajando tiempo completo 100%'
        })`
      ]
    ];

    const filaBench = (
      cat: string,
      ind: string,
      valCar: number,
      valMed: number,
      unidad: string,
      mejorAlto: boolean,
      umbralSignificativo: number,
      lugarReg: string
    ): ValorCeldaExcel[] => {
      const diff = Number((valCar - valMed).toFixed(2));
      const diffFavorable = mejorAlto ? diff : -diff;
      const signo = diff > 0 ? `+${diff}` : `${diff}`;

      let estiloValor: EstiloCeldaExcel = 'bold';
      let veredictoTxt = '= En Rango Promedio Regional';

      if (diffFavorable >= umbralSignificativo) {
        estiloValor = 'winner';
        veredictoTxt = '★ Ventaja Sólida vs. Media';
      } else if (diffFavorable <= -umbralSignificativo) {
        estiloValor = 'warning';
        veredictoTxt = '▲ Rezago / Mayor Fricción';
      }

      return [
        cat,
        ind,
        { v: valCar, s: estiloValor },
        valMed,
        signo,
        lugarReg,
        { v: veredictoTxt, s: estiloValor === 'bold' ? 'default' : estiloValor },
        unidad
      ];
    };

    const colHrsCampo = codigoSexo === 1 ? 'hrs_doble_jornada_hombres' : 'hrs_doble_jornada_mujeres';

    const filasHoja2: ValorCeldaExcel[][] = [
      filaBench('1. Remuneración', 'Salario Mensual Consolidado vs. Media Lic.', sueldoParaRadar, benchReg.sueldo_lic_promedio, 'MXN / mes', true, 800, '#Top Salarial'),
      filaBench(
        '2. Calidad y Mercado',
        'Empleo de Calidad (Estándar OIT)',
        tasaEmpleoCalidadPct,
        mediaCalidadOITContexto,
        '% de ocupados',
        true,
        3.0,
        calcularLugarEnRegion(
          r => ((Math.min(Number(r.pct_contrato || 0), Number(r.pct_afore || 0)) * 0.70 + Number(r.pct_contrato || 0) * 0.30) * (1 - Number(r.pct_pluriempleo || 0) / 200)),
          tasaEmpleoCalidadPct,
          true
        )
      ),
      filaBench(
        '2. Calidad y Mercado',
        'Formalidad Laboral Total',
        tasaFormalidadPct,
        scoreFormalidadMedia,
        '% de ocupados',
        true,
        3.0,
        calcularLugarEnRegion(
          r => Number(r.pct_contrato || 0) * 0.45 + Number(r.pct_aguinaldo || 0) * 0.30 + Number(r.pct_afore || 0) * 0.25,
          tasaFormalidadPct,
          true
        )
      ),
      filaBench('2. Calidad y Mercado', 'Tasa de Desempleo Abierto', Number(desempleoSeguro.toFixed(1)), 3.5, '% de la PEA', false, 1.2, 'Media 5 años ENOE'),
      filaBench('2. Calidad y Mercado', 'Índice de Saturación ANUIES', Number(saturacionSegura.toFixed(0)), 100, `% (${diagSat.texto})`, false, 12, 'Balance Egresados/Plazas'),
      filaBench('3. Ecosistema Empleador', 'PYME (Empresas 6–100 empleados)', pPyme, benchContextual.pct_pyme, '% de ocupados', true, 4.0, calcularLugarEnRegion(r => Number(r.pct_pyme || 0), pPyme, true)),
      filaBench('3. Ecosistema Empleador', 'Microempresa y Práctica Independiente', pMicro, benchContextual.pct_micro, '% de ocupados', true, 4.0, calcularLugarEnRegion(r => Number(r.pct_micro || 0), pMicro, true)),
      filaBench('3. Ecosistema Empleador', 'Gran Corporativo y Transnacional', pCorp, benchContextual.pct_corp, '% de ocupados', true, 3.0, calcularLugarEnRegion(r => Number(r.pct_corp || 0), pCorp, true)),
      filaBench('3. Ecosistema Empleador', 'Administración Pública y Gobierno', pGob, benchContextual.pct_gobierno, '% de ocupados', true, 4.0, calcularLugarEnRegion(r => Number(r.pct_gobierno || 0), pGob, true)),
      filaBench('4. Escalera de Prestaciones', 'Contrato Escrito Estable', pContrato, benchContextual.pct_contrato, '% de cobertura', true, 3.0, calcularLugarEnRegion(r => Number(r.pct_contrato || 0), pContrato, true)),
      filaBench('4. Escalera de Prestaciones', 'Aguinaldo de Ley', pAguinaldo, benchContextual.pct_aguinaldo, '% de cobertura', true, 3.0, calcularLugarEnRegion(r => Number(r.pct_aguinaldo || 0), pAguinaldo, true)),
      filaBench('4. Escalera de Prestaciones', 'Fondo de Retiro (AFORE)', pAfore, benchContextual.pct_afore, '% de cobertura', true, 3.0, calcularLugarEnRegion(r => Number(r.pct_afore || 0), pAfore, true)),
      filaBench('4. Escalera de Prestaciones', 'Protección Materna / Paterna', Number(sateliteActual?.pct_materno || 0), benchContextual.pct_materno, '% de cobertura', true, 3.0, calcularLugarEnRegion(r => Number(r.pct_materno || 0), Number(sateliteActual?.pct_materno || 0), true)),
      filaBench('4. Escalera de Prestaciones', 'Afiliación Sindical / Gremial', pSindicato, benchContextual.pct_sindicato, '% de cobertura', true, 3.0, calcularLugarEnRegion(r => Number(r.pct_sindicato || 0), pSindicato, true)),
      filaBench('4. Escalera de Prestaciones', 'Seguro Médico Privado (SGMM)', pSgmm, benchContextual.pct_sgmm, '% de cobertura', true, 2.0, calcularLugarEnRegion(r => Number(r.pct_sgmm || 0), pSgmm, true)),
      filaBench('5. Barreras y Modalidad', 'Índice de Privilegio (Estrato Origen 1–4)', social.estrato, benchContextual.indice_privilegio, 'Escala INEGI 1 a 4', false, 0.12, calcularLugarEnRegion(r => Number(r.indice_privilegio || 2.8), social.estrato, false)),
      filaBench('5. Barreras y Modalidad', 'Ingreso por Redes Familiares (Nepotismo)', social.nepotismo, benchContextual.pct_nepotismo, '% por contactos', false, 3.0, calcularLugarEnRegion(r => Number(r.pct_nepotismo || 37), social.nepotismo, false)),
      filaBench('5. Barreras y Modalidad', 'Índice de Ascensor Meritocrático', social.scoreMovilidad, 58.0, `% (${social.cuadrante.nombre})`, true, 2.5, 'Modelo Chetty/CEEY'),
      filaBench('5. Barreras y Modalidad', 'Pluriempleo (Segundo Trabajo)', pPluriempleo, benchContextual.pct_pluriempleo, '% con 2+ empleos', false, 2.0, calcularLugarEnRegion(r => Number(r.pct_pluriempleo || 5), pPluriempleo, false)),
      filaBench('5. Barreras y Modalidad', 'Migración Forzada (Desarraigo)', pDesarraigo, benchContextual.pct_desarraigo, '% que emigró de estado', false, 1.5, calcularLugarEnRegion(r => Number(r.pct_desarraigo || 2.5), pDesarraigo, false)),
      filaBench('5. Barreras y Modalidad', 'Trabajo Doméstico No Remunerado', hrsHogarActiva, benchContextual.hrs_hogar, 'Horas / semana', false, 1.8, calcularLugarEnRegion(r => Number(r[colHrsCampo] || 15), hrsHogarActiva, false)),
      filaBench('5. Barreras y Modalidad', 'Trabajo Remoto (Home Office)', pHomeOffice, benchContextual.pct_home_office, '% modalidad remota', true, 2.0, calcularLugarEnRegion(r => Number(r.pct_home_office || 0), pHomeOffice, true)),
      filaBench('5. Barreras y Modalidad', 'Jornada de Medio Tiempo (<30h)', pMedioTiempo, benchContextual.pct_medio_tiempo, '% medio tiempo', false, 3.5, calcularLugarEnRegion(r => Number(r.pct_medio_tiempo || 14), pMedioTiempo, false)),
      filaBench('5. Barreras y Modalidad', 'Riesgo de Automatización IA', riesgoIA, 40, '% de exposición', false, 8.0, calcularLugarEnRegion(r => Number(r.riesgo_ia_score || 40), riesgoIA, false))
    ];

    const dispRegs = filasComparativaRegional.filter(r => r.celdaDisponible);
    const maxScoreReg = dispRegs.length > 0 ? Math.max(...dispRegs.map(r => r.scoreDataROIRegional)) : -1;
    const maxSalReg = dispRegs.length > 0 ? Math.max(...dispRegs.map(r => r.sueldoCarrera)) : -1;
    const maxPrimaReg = dispRegs.length > 0 ? Math.max(...dispRegs.map(r => r.premioPct)) : -999;
    const minRoiPubReg = dispRegs.length > 0 ? Math.min(...dispRegs.map(r => r.roiPublicaReg ?? 999)) : 999;
    const maxCalOitReg = dispRegs.length > 0 ? Math.max(...dispRegs.map(r => r.calidadOitReg)) : -1;
    const maxFormReg = dispRegs.length > 0 ? Math.max(...dispRegs.map(r => r.formalidadPct)) : -1;
    const maxDifFormReg = dispRegs.length > 0 ? Math.max(...dispRegs.map(r => r.diffFormalidadPts)) : -999;
    const minNepReg = dispRegs.length > 0 ? Math.min(...dispRegs.map(r => r.nepotismoReg)) : 999;

    const filasHoja3: ValorCeldaExcel[][] = filasComparativaRegional.map(r => {
      const esAct = r.region === regionActiva;
      return [
        { v: esAct ? `★ ${r.nombreCorto} (Activa)` : r.nombreCorto, s: esAct ? 'section' : 'bold' },
        r.estados,
        r.celdaDisponible ? 'Muestra Certificada' : 'Muestra Insuficiente',
        r.celdaDisponible
          ? { v: r.scoreDataROIRegional, s: r.scoreDataROIRegional === maxScoreReg ? 'winner' : 'bold' }
          : 'Sin muestra',
        r.celdaDisponible
          ? { v: r.sueldoCarrera, s: r.sueldoCarrera === maxSalReg ? 'winner' : 'bold' }
          : 'Sin muestra',
        r.sueldoPrepa,
        r.celdaDisponible
          ? { v: r.premioPct, s: r.premioPct === maxPrimaReg ? 'winner' : 'default' }
          : 'Sin muestra',
        r.celdaDisponible && r.roiPublicaReg != null
          ? { v: `${r.roiPublicaReg} años`, s: r.roiPublicaReg === minRoiPubReg ? 'winner' : 'default' }
          : 'Sin muestra',
        r.celdaDisponible && r.roiPrivadaReg != null
          ? `${r.roiPrivadaReg} años`
          : 'Sin muestra',
        r.celdaDisponible
          ? { v: r.calidadOitReg, s: r.calidadOitReg === maxCalOitReg ? 'winner' : 'default' }
          : 'Sin muestra',
        r.celdaDisponible
          ? { v: r.formalidadPct, s: r.formalidadPct === maxFormReg ? 'winner' : 'default' }
          : 'Sin muestra',
        r.celdaDisponible
          ? { v: r.diffFormalidadPts, s: r.diffFormalidadPts === maxDifFormReg ? 'winner' : 'default' }
          : 'Sin muestra',
        r.celdaDisponible ? r.sectorDominanteReg : 'Sin muestra',
        r.celdaDisponible
          ? { v: r.nepotismoReg, s: r.nepotismoReg === minNepReg ? 'winner' : 'default' }
          : 'Sin muestra',
        r.celdaDisponible ? r.estratoReg : 'Sin muestra'
      ];
    });

    const serieReal = obtenerSerieAnualConfiable();
    const filasHoja4: ValorCeldaExcel[][] = [
      ...serieReal.map(pt => {
        const sLic = pt.sueldoLic ?? 0;
        const sPre = pt.sueldoPrepa ?? 0;
        const prima = sPre > 0 && sLic > 0 ? Number((((sLic - sPre) / sPre) * 100).toFixed(1)) : 0;
        return [
          `Corte Anual ENOE ${pt.anio}`,
          sLic > 0 ? { v: `${formatoMoneda(sLic)} / mes`, s: 'bold' as const } : 'Sin dato',
          sPre > 0 ? `${formatoMoneda(sPre)} / mes` : 'Sin dato',
          `+${formatoMoneda(sLic - sPre)}/mes (${prima >= 0 ? `+${prima}%` : `${prima}%`} vs. Prepa) · PEA: ${(pt.pea || peaTotal).toLocaleString('es-MX')}`
        ];
      }),
      ...diagnosticoEjecutivo.topPros.map((pro, idx) => [
        { v: `Fortaleza Comprobada #${idx + 1}`, s: 'winner' as const },
        'Ventaja Competitiva Auditada',
        `${REGIONES_INFO[regionActiva]?.corto} (${etiquetaGeneroActual})`,
        pro
      ]),
      ...diagnosticoEjecutivo.topContras.map((con, idx) => [
        { v: `Riesgo o Fricción #${idx + 1}`, s: 'warning' as const },
        'Factor de Riesgo a Considerar',
        `${REGIONES_INFO[regionActiva]?.corto} (${etiquetaGeneroActual})`,
        con
      ])
    ];

    return { filasHoja1, filasHoja2, filasHoja3, filasHoja4 };
  };

  const exportarFichaExcel = () => {
    const { filasHoja1, filasHoja2, filasHoja3, filasHoja4 } = construirHojasFichaCarrera();
    descargarLibroExcelXLSX(
      `DataROI_Ficha_${cve_carrera}_${regionActiva}_${modoGenero}.xlsx`,
      [
        {
          nombre: '1_Ficha_Ejecutiva_y_ROI',
          cabeceras: ['Concepto_Ejecutivo', 'Valor_en_Esta_Carrera', 'Contexto_y_Explicacion_Metodologica'],
          filas: filasHoja1
        },
        {
          nombre: '2_Benchmark_vs_Media_Regional',
          cabeceras: [
            'Categoria',
            'Indicador_Auditado',
            'Valor_Carrera',
            'Media_Contextual_Region',
            'Diferencial_vs_Media',
            'Lugar_en_Region',
            'Veredicto_Estadistico',
            'Unidad_o_Detalle'
          ],
          filas: filasHoja2
        },
        {
          nombre: '3_Mejor_Region_para_Ejercer',
          cabeceras: [
            'Macro_Region',
            'Entidades_Incluidas',
            'Estatus_Muestra',
            'Score_DataROI_0_100',
            'Salario_Carrera_MXN',
            'Salario_Prepa_MXN',
            'Prima_Salarial_Pct',
            'ROI_Univ_Publica',
            'ROI_Univ_Privada_Media',
            'Calidad_OIT_Pct',
            'Formalidad_Total_Pct',
            'Dif_Formalidad_vs_Prepa_Pts',
            'Sector_Empleador_Dominante',
            'Nepotismo_Pct',
            'Estrato_Origen_1_4'
          ],
          filas: filasHoja3
        },
        {
          nombre: '4_Serie_2021_2026_y_Hallazgos',
          cabeceras: ['Periodo_o_Clasificacion', 'Salario_Licenciatura_o_Tipo', 'Base_Prepa_o_Contexto', 'Detalle_Ejecutivo_Auditado'],
          filas: filasHoja4
        }
      ]
    );
  };

  const exportarFichaCSV = () => {
    const { filasHoja2 } = construirHojasFichaCarrera();
    descargarCSVEstilizado(
      `DataROI_Ficha_${cve_carrera}_${regionActiva}_${modoGenero}.csv`,
      [
        'Categoria',
        'Indicador_Auditado',
        'Valor_Carrera',
        'Media_Contextual_Region',
        'Diferencial_vs_Media',
        'Lugar_en_Region',
        'Veredicto_Estadistico',
        'Unidad_o_Detalle'
      ],
      filasHoja2
    );
  };

  const descargarPDFEjecutivoCarrera = () => {
    const serieReal = obtenerSerieAnualConfiable();

    descargarReporteCarreraPDF({
      cve_carrera,
      nombre_carrera: nombreEjecutivoCarrera,
      regionNombre: REGIONES_INFO[regionActiva]?.nombre || regionActiva,
      regionCorto: REGIONES_INFO[regionActiva]?.corto || regionActiva,
      perfilEtiqueta: etiquetaGeneroActual,
      nEncuestados: nEncuestadosActivos,
      capexEtiqueta: capex.etiqueta,
      riesgoIA,
      scoreDataROI: scoreEnteroActual,
      etiquetaScoreDataROI: `Grado ${semaforoScoreActual.grado} — ${semaforoScoreActual.etiqueta}`,
      sueldoActivo: sueldoParaRadar,
      sueldoPrepa: sueldoPrepaParaROI,
      premioVsPrepaPct: Math.round(premioVsPrepaActivo),
      bonoAnual: statsMercado?.gananciaAnualExtra ?? bonoAnualROI,
      tasaEmpleoCalidadPct,
      diffCalidadVsMediaLic,
      countCalidad,
      saturacionPct: saturacionSegura,
      diagSatTexto: diagSat.texto,
      peaTotal,
      tasaDesempleo: desempleoSeguro,
      desempleadosCount,
      ocupadosCount,
      tasaFormalidadPct,
      tasaFormalBasicoPct,
      tasaInformalidadPct,
      countFormalBasico,
      countInformal,
      inversionTotalROI: inversionDirectaBolsillo,
      aniosRetornoTexto: formatearAniosROI(aniosRetornoBolsillo),
      semaforoROI: semaforoROI.etiqueta,
      gananciaNeta10Anios,
      supuestoROICorto: `Inv. Bolsillo (${semestresROI} sem): ${formatoMoneda(inversionDirectaBolsillo)} | Neto 10a: ${formatoMoneda(gananciaNeta10Anios)}`,
      topPros: diagnosticoEjecutivo.topPros,
      topContras: diagnosticoEjecutivo.topContras,
      serieAnual: serieReal,
      tendenciaEtiqueta: statsMercado?.tendenciaEtiqueta || 'Estable',
      datosRadar,
      comparativaRegional: filasComparativaRegional,
      empleadores: listaEmpleadores,
      prestaciones: listaPrestaciones,
      barreras: {
        cuadranteNombre: social.cuadrante.nombre,
        scoreMovilidad: social.scoreMovilidad,
        estrato: social.estrato,
        mediaEstrato: benchContextual.indice_privilegio,
        nepotismo: social.nepotismo,
        mediaNepotismo: benchContextual.pct_nepotismo,
        pluriempleo: pPluriempleo,
        mediaPluriempleo: benchContextual.pct_pluriempleo,
        desarraigo: pDesarraigo,
        mediaDesarraigo: benchContextual.pct_desarraigo,
        hrsHogar: hrsHogarActiva,
        mediaHrsHogar: benchContextual.hrs_hogar,
        homeOffice: pHomeOffice,
        mediaHomeOffice: benchContextual.pct_home_office,
        medioTiempo: pMedioTiempo,
        mediaMedioTiempo: benchContextual.pct_medio_tiempo
      },
      nombreArchivo: `DataROI_Reporte_${cve_carrera}_${regionActiva}_${modoGenero}.pdf`
    });
  };

  const rAnillo = 25;
  const circAnillo = 2 * Math.PI * rAnillo;
  const offsetAnillo = circAnillo - (Math.max(0, Math.min(100, scoreEnteroActual)) / 100) * circAnillo;

  const idxVersusActual = cvesVersus.indexOf(cve_carrera);
  const estaEnVersus = idxVersusActual !== -1;
  const topeVersus = !estaEnVersus && cvesVersus.length >= 3;
  const slotVersusEstilo = estaEnVersus ? COLORES_SLOTS_VERSUS[idxVersusActual] || COLORES_SLOTS_VERSUS[0] : null;
  const primaEntero = Math.round(premioVsPrepaActivo);

  const pctSliderColegiatura = Math.min(100, Math.max(0, (colegiaturaMensualROI / 28000) * 100));
  const pctSliderSemestres = Math.min(100, Math.max(0, ((semestresROI - 6) / (14 - 6)) * 100));
  const pctSliderTitulacion = Math.min(100, Math.max(0, (costoTitulacionROI / 45000) * 100));

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-14">
      
      {/* BARRA DE HERRAMIENTAS DEL REPORTE */}
      <nav aria-label="Acciones del reporte de carrera" className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={vinoDeDescubridor ? urlRetornoDescubridor : '/'}
            className="inline-flex items-center px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs md:text-sm font-black text-slate-700 hover:text-slate-900 shadow-2xs active:scale-95 transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 text-blue-600" aria-hidden="true" />
            {vinoDeDescubridor ? 'Volver a mi Ranking' : 'Volver al Catálogo Nacional'}
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={estaEnVersus}
            disabled={topeVersus}
            onClick={handleToggleCompararActual}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border transition-all active:scale-95 ${
              estaEnVersus && slotVersusEstilo
                ? `${slotVersusEstilo.btnClass} cursor-pointer`
                : topeVersus
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-blue-500 hover:text-blue-600 shadow-2xs cursor-pointer'
            }`}
          >
            {estaEnVersus ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>En Versus #{idxVersusActual + 1}</span>
              </>
            ) : (
              <>
                <Scale className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                <span>+ Comparar carrera</span>
              </>
            )}
          </button>

          <button
            onClick={compartirAnalisis}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            {enlaceCopiado ? <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> : <Share2 className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />}
            {enlaceCopiado ? '¡Enlace copiado!' : 'Compartir vista'}
          </button>

          <button
            onClick={exportarFichaExcel}
            title="Descargar Libro de Excel (.xlsx) con 4 Hojas sin celdas vacías, Score DataROI y comparativa regional"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
            Excel (4 Hojas)
          </button>

          <button
            onClick={exportarFichaCSV}
            title="Descargar tabla de benchmarking en formato CSV limpio (RFC 4180)"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            CSV
          </button>

          <button
            onClick={descargarPDFEjecutivoCarrera}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            Descargar PDF
          </button>
        </div>
      </nav>

      {/* PISO 1: CINTA EJECUTIVA OSCURA DE ALTO CONTRASTE CON CRISTAL ESMERILADO */}
      <div className={`print-avoid-break bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white rounded-3xl border border-slate-800 border-t-4 ${semaforoScoreActual.topBorderClass || 'border-t-emerald-500'} shadow-lg p-6 md:p-7`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* Identificación + Medallón Entero Score DataROI (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-800/95 text-slate-100 border border-slate-600/80 font-mono">
                    CVE: {cve_carrera}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${capex.badgeDark}`}>
                    {capex.etiqueta}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border inline-flex items-center gap-1 ${
                    riesgoIA <= 35
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50'
                      : riesgoIA <= 65
                        ? 'bg-amber-500/25 text-amber-200 border-amber-400/50'
                        : 'bg-rose-500/25 text-rose-200 border-rose-400/50'
                  }`}>
                    {riesgoIA <= 35 ? <ShieldCheck className="w-3 h-3" aria-hidden="true" /> : <ShieldAlert className="w-3 h-3" aria-hidden="true" />}
                    Riesgo IA: {riesgoIA}%
                  </span>
                </div>

                <h1 className="text-xl md:text-3xl font-black text-white tracking-tight leading-snug">
                  {nombreEjecutivoCarrera}
                </h1>

                {tieneSubtituloOficial && (
                  <p className="text-[11px] font-medium text-slate-400 mt-1 leading-snug">
                    Catálogo CMPE INEGI: {carreraInfo.nombre_carrera}
                  </p>
                )}
              </div>

              {/* Medallón Grande de Calificación Entera sobre Cristal con Borde de Luz */}
              <div
                role="img"
                aria-label={`Calificación Integral DataROI en ${REGIONES_INFO[regionActiva]?.corto}: ${scoreEnteroActual} de 100 puntos, Grado ${semaforoScoreActual.grado}, ${semaforoScoreActual.etiqueta}`}
                title={`Calificación Integral DataROI en ${REGIONES_INFO[regionActiva]?.corto} (${etiquetaGeneroActual}): ${scoreEnteroActual}/100`}
                className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700 ring-1 ring-white/10 flex items-center gap-3 shrink-0 shadow-md"
              >
                <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 62 62" aria-hidden="true">
                    <circle
                      cx="31"
                      cy="31"
                      r={rAnillo}
                      fill="rgba(15, 23, 42, 0.75)"
                      stroke="rgba(148, 163, 184, 0.22)"
                      strokeWidth="5.2"
                    />
                    <circle
                      cx="31"
                      cy="31"
                      r={rAnillo}
                      fill="none"
                      stroke={semaforoScoreActual.colorHex}
                      strokeWidth="5.2"
                      strokeLinecap="round"
                      strokeDasharray={circAnillo}
                      strokeDashoffset={offsetAnillo}
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span className="text-xl font-black text-white tracking-tight">{scoreEnteroActual}</span>
                    <span className="text-[9px] font-bold text-slate-400">/100</span>
                  </div>
                </div>
                <div className="pr-1">
                  <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-none">
                    Score DataROI
                  </span>
                  <span
                    className="block text-xs font-black mt-1 leading-none"
                    style={{ color: semaforoScoreActual.grado === 'A' ? '#34D399' : semaforoScoreActual.grado === 'B' ? '#FBBF24' : '#FB7185' }}
                  >
                    {semaforoScoreActual.etiqueta}
                  </span>
                  <span className="block text-[10px] font-bold text-slate-300 mt-1 leading-none">
                    Grado {semaforoScoreActual.grado} · {REGIONES_INFO[regionActiva]?.corto}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 pt-3 border-t border-slate-800 leading-relaxed">
              {capex.detalle}
            </p>
          </div>

          {/* 3 Tarjetas de Cristal para los KPIs Principales (7 cols) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            
            {/* KPI 1: Salario Mensual Consolidado */}
            <div className="bg-slate-800/85 border border-slate-700/90 ring-1 ring-white/10 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Salario Mensual Consolidado
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl xl:text-3xl font-black text-white">
                    {statsMercado ? formatoMoneda(statsMercado.sueldoActivo) : '---'}
                  </span>
                  <span className="text-xs font-bold text-slate-400">/mes</span>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-700/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">vs. Prepa ({formatoMonedaCorta(sueldoPrepaParaROI)}):</span>
                  <span className={`font-black px-2 py-0.5 rounded-md border ${
                    primaEntero >= 0
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/45'
                      : 'bg-rose-500/25 text-rose-200 border-rose-400/45'
                  }`}>
                    {primaEntero >= 0 ? `+${primaEntero}%` : `${primaEntero}%`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Bono anual: <strong className="text-emerald-300 font-bold">
                    {bonoAnualROI >= 0
                      ? `+${formatoMoneda(bonoAnualROI)}/año`
                      : `${formatoMoneda(bonoAnualROI)}/año`}
                  </strong>
                </p>
              </div>
            </div>

            {/* KPI 2: Empleo de Calidad OIT */}
            <div className="bg-slate-800/85 border border-slate-700/90 ring-1 ring-white/10 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Empleo de Calidad (OIT)
                </span>
                <span className="text-2xl xl:text-3xl font-black text-sky-400">
                  {Math.round(tasaEmpleoCalidadPct)}%
                </span>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-700/80 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">vs. Media Lic.:</span>
                  <span className={`font-black px-2 py-0.5 rounded-md border text-[11px] ${
                    diffCalidadVsMediaLic >= 0
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/45'
                      : 'bg-amber-500/25 text-amber-200 border-amber-400/45'
                  }`}>
                    {diffCalidadVsMediaLic >= 0 ? `+${diffCalidadVsMediaLic}` : diffCalidadVsMediaLic} pts
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Plenos: <strong className="text-white font-bold">{countCalidad.toLocaleString('es-MX')}</strong> ocup.
                </p>
              </div>
            </div>

            {/* KPI 3: Índice de Saturación ANUIES */}
            <div className="bg-slate-800/85 border border-slate-700/90 ring-1 ring-white/10 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Índice de Saturación
                </span>
                <span className="text-2xl xl:text-3xl font-black text-white block">
                  {statsMercado ? `${saturacionSegura.toFixed(0)}%` : '---'}
                </span>
                <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${diagSat.claseDark}`}>
                  {diagSat.texto}
                </span>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-700/80 text-xs flex items-center justify-between">
                <span className="text-slate-400">PEA Activa:</span>
                <strong className="font-black text-white">{peaTotal.toLocaleString('es-MX')}</strong>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* BARRA DE CONTROL REGIONAL Y DE GÉNERO EN CÁPSULAS SEGMENTADAS */}
      <div className="no-print bg-white px-5 py-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Selector de Macro-Región">
          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 mr-1">
            <MapPin className="w-4 h-4 text-blue-600" aria-hidden="true" /> Macro-Región:
          </span>
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {REGIONES_ORDEN.map((reg) => {
              const activa = regionActiva === reg;
              const habilitada = tieneMuestraCelda(reg, codigoSexo);
              return (
                <button
                  key={reg}
                  disabled={!habilitada}
                  aria-pressed={activa}
                  onClick={() => habilitada && setRegionActiva(reg)}
                  title={!habilitada ? `Muestra INEGI insuficiente en ${REGIONES_INFO[reg]?.corto} para este perfil` : REGIONES_INFO[reg]?.nombre}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 inline-flex items-center gap-1 ${
                    !habilitada
                      ? 'text-slate-400 opacity-50 cursor-not-allowed'
                      : activa
                        ? 'bg-blue-600 text-white shadow-xs cursor-pointer'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 cursor-pointer'
                  }`}
                >
                  {!habilitada && <Lock className="w-3 h-3" aria-hidden="true" />}
                  {REGIONES_INFO[reg]?.corto || reg}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3">
          {nEncuestadosActivos > 0 && (
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/70 inline-flex items-center gap-1.5">
              Muestra INEGI: <strong className="text-slate-900 font-black">{nEncuestadosActivos.toLocaleString('es-MX')} encuestados</strong>
            </span>
          )}

          <div className="flex items-center gap-2" role="group" aria-label="Selector de Perspectiva de Género">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" aria-hidden="true" /> Perfil:
            </span>
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              {([
                { id: 'total' as ModoGeneroEstricto, sx: 0, label: 'Total General' },
                { id: 'mujeres' as ModoGeneroEstricto, sx: 2, label: 'Solo Mujeres' },
                { id: 'hombres' as ModoGeneroEstricto, sx: 1, label: 'Solo Hombres' }
              ]).map((op) => {
                const act = modoGenero === op.id;
                const disp = tieneMuestraCelda(regionActiva, op.sx);
                return (
                  <button
                    key={op.id}
                    disabled={!disp}
                    aria-pressed={act}
                    onClick={() => disp && setModoGenero(op.id)}
                    title={!disp ? `Muestra INEGI insuficiente para ${op.label} en ${REGIONES_INFO[regionActiva]?.corto}` : op.label}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 inline-flex items-center gap-1 ${
                      !disp
                        ? 'text-slate-400 opacity-50 cursor-not-allowed'
                        : act
                          ? 'bg-slate-900 text-white shadow-xs cursor-pointer'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 cursor-pointer'
                    }`}
                  >
                    {!disp && <Lock className="w-3 h-3" aria-hidden="true" />}
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* PISO DE SÍNTESIS EJECUTIVA V2 + SIMULADOR DE ROI CON 3 ESCENARIOS SIMULTÁNEOS */}
      <div className="print-avoid-break grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-7 bg-gradient-to-b from-white via-white to-slate-50/70 rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" aria-hidden="true" />
                  Diagnóstico Ejecutivo en {REGIONES_INFO[regionActiva]?.corto}
                </h2>
                <p className="text-xs text-slate-500">
                  Síntesis automática evaluada contra las medias dinámicas de esta región y perfil.
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                {totalHallazgos} Hallazgos Clave
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-2.5">
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  Fortalezas Comprobadas
                </h3>
                <ul className="space-y-2.5 text-xs text-slate-700">
                  {diagnosticoEjecutivo.topPros.map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-snug">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" aria-hidden="true" />
                      <span className="font-medium">{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5 mb-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                  Riesgos y Fricciones a Considerar
                </h3>
                <ul className="space-y-2.5 text-xs text-slate-700">
                  {diagnosticoEjecutivo.topContras.map((contra, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-snug">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" aria-hidden="true" />
                      <span className="font-medium">{contra}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] mb-2">
              <span className="font-black uppercase tracking-wider text-slate-400">
                Desglose de la Calificación Integral DataROI ({scoreEnteroActual}/100)
              </span>
              <span className={`font-black ${semaforoScoreActual.textClass}`}>
                Grado {semaforoScoreActual.grado} · {semaforoScoreActual.etiqueta}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {desglose6PilaresScore.map((pilar, idx) => (
                <div key={idx} className="bg-white px-2.5 py-2 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between text-[10.5px] mb-1">
                    <span className="font-bold text-slate-700 truncate">{pilar.label}</span>
                    <span className="font-black text-slate-900">{pilar.val}/100</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pilar.val >= 70
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                          : pilar.val >= 55
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-500'
                            : 'bg-gradient-to-r from-amber-500 to-orange-400'
                      }`}
                      style={{ width: `${Math.max(8, Math.min(100, pilar.val))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SIMULADOR DE RETORNO (ROI) CON 3 ARQUETIPOS EN VIVO + SLIDERS COLOREADOS */}
        <div className="lg:col-span-5 bg-gradient-to-b from-white via-white to-slate-50/70 rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" aria-hidden="true" />
                  Simulador de Retorno (ROI)
                </h2>
                <p className="text-xs text-slate-500">
                  Compara de un vistazo los 3 escenarios o personaliza tu beca y colegiatura.
                </p>
              </div>

              <button
                type="button"
                aria-pressed={gavetaROIAbierta || tipoUniROI === 'personalizada'}
                onClick={() => {
                  setTipoUniROI('personalizada');
                  setGavetaROIAbierta(prev => !prev);
                }}
                className={`no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 cursor-pointer shrink-0 ${
                  gavetaROIAbierta || tipoUniROI === 'personalizada'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{gavetaROIAbierta ? 'Ocultar ajuste' : 'Personalizar'}</span>
              </button>
            </div>

            <div className="no-print grid grid-cols-3 gap-2 mb-3.5">
              {([
                {
                  id: 'publica' as TipoUniversidadROI,
                  titulo: 'Univ. Pública',
                  anios: aniosArqPublica,
                  inv: invArqPublica
                },
                {
                  id: 'privada_media' as TipoUniversidadROI,
                  titulo: 'Priv. Media',
                  anios: aniosArqPrivMedia,
                  inv: invArqPrivMedia
                },
                {
                  id: 'privada_elite' as TipoUniversidadROI,
                  titulo: 'Priv. Élite',
                  anios: aniosArqPrivElite,
                  inv: invArqPrivElite
                }
              ]).map((esc) => {
                const activo = tipoUniROI === esc.id && !gavetaROIAbierta;
                return (
                  <button
                    key={esc.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => seleccionarTipoUni(esc.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between ${
                      activo
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/15'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${
                      activo ? 'text-blue-300' : 'text-slate-400'
                    }`}>
                      {esc.titulo}
                    </span>
                    <span className="text-sm font-black block mt-0.5">
                      {esc.anios === null ? 'Negativo' : `${esc.anios} años`}
                    </span>
                    <span className={`text-[10px] font-semibold block mt-0.5 truncate ${
                      activo ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      Inv: {formatoMonedaCorta(esc.inv)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Recuperación Directa de Bolsillo ({tipoUniROI === 'personalizada' ? 'Personalizada' : tipoUniROI === 'publica' ? 'Pública' : tipoUniROI === 'privada_media' ? 'Priv. Media' : 'Priv. Élite'})
                </span>
                <span className="text-3xl font-black text-slate-900">
                  {formatearAniosROI(aniosRetornoBolsillo)}
                </span>
              </div>
              <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border ${semaforoROI.claseBadge}`}>
                {semaforoROI.etiqueta}
              </span>
            </div>

            <p className="text-[11px] text-slate-600 font-medium mb-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
              {supuestoROICortoTexto}
            </p>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden my-2 border border-slate-200/60">
              <div
                className={`h-full rounded-full transition-all duration-500 ${semaforoROI.colorBarra}`}
                style={{
                  width: aniosRetornoBolsillo === null
                    ? '100%'
                    : `${Math.max(10, Math.min(100, (1 - Math.min(15, aniosRetornoBolsillo) / 16) * 100))}%`
                }}
              />
            </div>

            {gavetaROIAbierta && (
              <div className="no-print my-3 p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/80 space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                      <span>Colegiatura / Cuota:</span>
                      <span className="text-blue-700 font-black">{formatoMoneda(colegiaturaMensualROI)}/mes</span>
                    </div>
                    <input
                      type="range"
                      aria-label="Colegiatura o cuota mensual en pesos"
                      min={0}
                      max={28000}
                      step={300}
                      value={colegiaturaMensualROI}
                      onChange={(e) => {
                        setTipoUniROI('personalizada');
                        setColegiaturaMensualROI(Number(e.target.value));
                      }}
                      style={{
                        background: `linear-gradient(to right, #2563EB 0%, #2563EB ${pctSliderColegiatura}%, #E2E8F0 ${pctSliderColegiatura}%, #E2E8F0 100%)`
                      }}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      $0 = Beca 100% · $300/mes = Pública
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                      <span>Duración Carrera:</span>
                      <span className="text-blue-700 font-black">{semestresROI} sem ({(semestresROI / 2).toFixed(1)} años)</span>
                    </div>
                    <input
                      type="range"
                      aria-label="Duración de la carrera en semestres"
                      min={6}
                      max={14}
                      step={1}
                      value={semestresROI}
                      onChange={(e) => {
                        setTipoUniROI('personalizada');
                        setSemestresROI(Number(e.target.value));
                      }}
                      style={{
                        background: `linear-gradient(to right, #2563EB 0%, #2563EB ${pctSliderSemestres}%, #E2E8F0 ${pctSliderSemestres}%, #E2E8F0 100%)`
                      }}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Estándar: 9 sem · Medicina: 12 sem
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-slate-700 mb-1">
                      <span>Titulación y Cédula:</span>
                      <span className="text-blue-700 font-black">{formatoMoneda(costoTitulacionROI)}</span>
                    </div>
                    <input
                      type="range"
                      aria-label="Costo de titulación y cédula profesional"
                      min={0}
                      max={45000}
                      step={500}
                      value={costoTitulacionROI}
                      onChange={(e) => {
                        setTipoUniROI('personalizada');
                        setCostoTitulacionROI(Number(e.target.value));
                      }}
                      style={{
                        background: `linear-gradient(to right, #2563EB 0%, #2563EB ${pctSliderTitulacion}%, #E2E8F0 ${pctSliderTitulacion}%, #E2E8F0 100%)`
                      }}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block mb-1">¿Trabajas mientras estudias?</span>
                    <div className="grid grid-cols-3 gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                      {([
                        { val: 0 as NivelTrabajoEstudio, label: 'No (0%)' },
                        { val: 0.5 as NivelTrabajoEstudio, label: '1/2 Tpo' },
                        { val: 1 as NivelTrabajoEstudio, label: 'Tpo Comp.' }
                      ]).map(op => (
                        <button
                          key={op.val}
                          type="button"
                          aria-pressed={nivelTrabajoEstudio === op.val}
                          onClick={() => {
                            setTipoUniROI('personalizada');
                            setNivelTrabajoEstudio(op.val);
                          }}
                          className={`py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            nivelTrabajoEstudio === op.val ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 mt-2 text-xs bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <div>
                <span className="text-[10.5px] text-slate-400 block">Inversión Directa de Bolsillo:</span>
                <strong className="text-slate-900 font-black">{formatoMoneda(inversionDirectaBolsillo)} MXN</strong>
              </div>
              <div>
                <span className="text-[10.5px] text-slate-400 block">Ganancia Neta a 10 años vs. Prepa:</span>
                <strong className={`font-black ${gananciaNeta10Anios >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {gananciaNeta10Anios >= 0 ? `+${formatoMoneda(gananciaNeta10Anios)}` : formatoMoneda(gananciaNeta10Anios)}
                </strong>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  ROI Económico Total (incl. {formatoMoneda(costoOportunidadNeto)} de costo de oportunidad):
                </span>
                <strong className="text-slate-800 font-black">
                  {formatearAniosROI(aniosRetornoEconomicoMincer)}
                </strong>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* PISO 2: CURVA SALARIAL (65%) + HUELLA ESTRUCTURAL CON GRADIENTE RADIAL Y VÉRTICES (35%) */}
      <div className="print-avoid-break grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-8">
          <GraficaPredictiva
            cve_carrera={cve_carrera}
            regionActiva={regionActiva}
            modoGenero={modoGenero}
            mapaKishPorRegion={mapaKishActivo}
            onModoGeneroChange={setModoGenero}
            onStatsChange={handleStatsChange}
          />
        </div>

        <div className="lg:col-span-4 bg-gradient-to-b from-white via-white to-slate-50/70 rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
          <div>
            <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2 mb-1">
              <Compass className="w-5 h-5 text-blue-600" aria-hidden="true" />
              Huella Estructural (6 Pilares)
            </h2>
            <p className="text-xs text-slate-500 mb-2">
              Silueta de la carrera (<strong className="text-blue-600">azul con nodos</strong>) frente al promedio dinámico de {REGIONES_INFO[regionActiva]?.corto} (<strong className="text-slate-600">gris punteado</strong>).
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={datosRadar}>
                <defs>
                  <radialGradient id="gradienteRadarCarrera" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.42} />
                  </radialGradient>
                </defs>
                <PolarGrid stroke="#CBD5E1" />
                <PolarAngleAxis dataKey="eje" tick={{ fill: '#1E293B', fontSize: 10.5, fontWeight: 800 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Media Contextual"
                  dataKey="Media Contextual"
                  stroke="#64748B"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="#94A3B8"
                  fillOpacity={0.14}
                />
                <Radar
                  name="Esta Carrera"
                  dataKey="Carrera"
                  stroke="#2563EB"
                  strokeWidth={3}
                  fill="url(#gradienteRadarCarrera)"
                  fillOpacity={1}
                  dot={{ r: 4, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 1.8 }}
                />
                <Legend wrapperStyle={{ fontSize: '11.5px', fontWeight: 700 }} />
                <RechartsTooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-[11px]">
            {datosRadar.map((d, idx) => {
              const cardSemClass =
                d.diff >= 3
                  ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-800'
                  : d.diff <= -3
                    ? 'bg-amber-50/70 border-amber-200/80 text-amber-900'
                    : 'bg-slate-50 border-slate-200/70 text-slate-700';
              return (
                <div key={idx} className={`px-2 py-1.5 rounded-xl border transition-colors ${cardSemClass}`}>
                  <span className="opacity-75 font-bold block truncate text-[10px]">{d.nombreCorto}</span>
                  <span className="font-black">
                    {d.diff > 0 ? `+${d.diff}` : d.diff} vs. Media
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* PISO 3: TERMÓMETROS REGIONALES CON SCORE INMUTABLE (50%) + CALIDAD OIT Y MOSAICO BENTO (50%) */}
      <div className="print-avoid-break grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-6 bg-gradient-to-b from-white via-white to-slate-50/70 rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" aria-hidden="true" />
                Comparativa por Macro-Región
              </h3>

              <div className="no-print inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  aria-pressed={metricaRegionalVista === 'sueldo'}
                  onClick={() => setMetricaRegionalVista('sueldo')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all active:scale-95 cursor-pointer ${
                    metricaRegionalVista === 'sueldo'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vista: Salario ($)
                </button>
                <button
                  type="button"
                  aria-pressed={metricaRegionalVista === 'formalidad'}
                  onClick={() => setMetricaRegionalVista('formalidad')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all active:scale-95 cursor-pointer ${
                    metricaRegionalVista === 'formalidad'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vista: Formalidad (%)
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {metricaRegionalVista === 'sueldo'
                ? 'Haz clic en cualquier región para auditarla. Los termómetros azules comparan el sueldo frente a la línea negra de Preparatoria.'
                : 'Haz clic en cualquier región para auditarla. Los termómetros esmeralda comparan la formalidad frente a la base de Preparatoria.'}
            </p>

            <div className="grid grid-cols-5 gap-2.5 sm:gap-3 pt-1">
              {filasComparativaRegional.map((item: FilaComparativaRegionalUI) => {
                const esActiva = regionActiva === item.region;
                const esVistaSueldo = metricaRegionalVista === 'sueldo';
                const disp = item.celdaDisponible;

                const esLiderReg =
                  disp &&
                  (esVistaSueldo
                    ? item.sueldoCarrera === maxSueldoLiderReg
                    : item.formalidadPct === maxFormalidadLiderReg);

                const alturaColumnaPct = esVistaSueldo
                  ? Math.max(8, Math.min(96, (item.sueldoCarrera / techoDinamicoSueldoRegional) * 100))
                  : Math.max(8, Math.min(96, item.formalidadPct));

                const alturaMarcaPrepaPct = esVistaSueldo
                  ? Math.max(6, Math.min(94, (item.sueldoPrepa / techoDinamicoSueldoRegional) * 100))
                  : Math.max(6, Math.min(94, item.formalidadPrepaPct));

                const valorPrincipalTexto = !disp
                  ? 'Sin muestra'
                  : esVistaSueldo
                    ? formatoMoneda(item.sueldoCarrera)
                    : `${Math.round(item.formalidadPct)}%`;

                const diffValor = esVistaSueldo ? Math.round(item.premioPct) : Math.round(item.diffFormalidadPts);
                const textoBadgeDiff = !disp
                  ? 'N/D'
                  : esVistaSueldo
                    ? `${diffValor >= 0 ? `+${diffValor}%` : `${diffValor}%`} vs. Prepa`
                    : `${diffValor >= 0 ? `+${diffValor}` : `${diffValor}`} pts vs. Prepa`;

                const textoRefPrepa = esVistaSueldo
                  ? `Prepa: ${formatoMonedaCorta(item.sueldoPrepa)}`
                  : `Prepa: ${Math.round(item.formalidadPrepaPct)}%`;

                const claseGradienteBarra = esVistaSueldo
                  ? esActiva
                    ? 'bg-gradient-to-t from-blue-800 via-blue-600 to-sky-400 shadow-sm'
                    : 'bg-gradient-to-t from-blue-600/80 via-blue-500/75 to-sky-300/75 group-hover:from-blue-700 group-hover:to-sky-400'
                  : esActiva
                    ? 'bg-gradient-to-t from-emerald-800 via-emerald-600 to-teal-300 shadow-sm'
                    : 'bg-gradient-to-t from-emerald-600/80 via-emerald-500/75 to-teal-300/75 group-hover:from-emerald-700 group-hover:to-teal-400';

                return (
                  <button
                    key={item.region}
                    type="button"
                    disabled={!disp}
                    onClick={() => disp && setRegionActiva(item.region)}
                    title={!disp ? `Muestra insuficiente en ${item.nombreCorto}` : `${item.nombreCorto} (${item.estados}) · Score DataROI: ${item.scoreDataROIRegional}/100`}
                    className={`group flex flex-col items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 ${
                      !disp
                        ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                        : esActiva
                          ? esVistaSueldo
                            ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/15 shadow-xs -translate-y-0.5 cursor-pointer'
                            : 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/15 shadow-xs -translate-y-0.5 cursor-pointer'
                          : 'border-slate-200 hover:border-blue-300 bg-slate-50/40 hover:bg-white hover:-translate-y-0.5 cursor-pointer'
                    }`}
                  >
                    <div className="text-center w-full mb-2">
                      <div className="h-4 flex items-center justify-center mb-0.5">
                        {esLiderReg && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black uppercase tracking-wider">
                            <Crown className="w-2.5 h-2.5 text-amber-600" aria-hidden="true" /> Líder
                          </span>
                        )}
                      </div>
                      <span className="block text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
                        {valorPrincipalTexto}
                      </span>
                      <span className={`inline-block mt-1 text-[9.5px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded leading-none ${
                        !disp
                          ? 'bg-slate-200 text-slate-500'
                          : diffValor >= 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                            : 'bg-amber-50 text-amber-800 border border-amber-200/70'
                      }`}>
                        {textoBadgeDiff}
                      </span>
                    </div>

                    <div className="w-full h-38 bg-slate-100/90 rounded-xl relative p-1.5 border border-slate-200/60">
                      <div className="relative w-full h-full flex items-end justify-center">
                        {disp && (
                          <div
                            className={`w-full rounded-lg transition-all duration-500 ${claseGradienteBarra}`}
                            style={{ height: `${alturaColumnaPct}%` }}
                          />
                        )}

                        <div
                          title={textoRefPrepa}
                          className="absolute -left-1 -right-1 h-1 bg-slate-950 rounded-full z-20 shadow-xs transition-all duration-500"
                          style={{ bottom: `${alturaMarcaPrepaPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-center w-full mt-2.5 pt-2 border-t border-slate-200/70">
                      <span className={`block text-xs font-black truncate ${
                        esActiva ? (esVistaSueldo ? 'text-blue-700' : 'text-emerald-700') : 'text-slate-800'
                      }`}>
                        {item.nombreCorto}
                      </span>
                      <span className="block text-[10px] font-semibold text-slate-500 mt-0.5 truncate">
                        {textoRefPrepa}
                      </span>
                      <span className={`block text-[10px] font-bold mt-0.5 truncate ${
                        esVistaSueldo ? 'text-blue-600' : 'text-emerald-600'
                      }`}>
                        {!disp ? 'Muestra insuf.' : `Score: ${item.scoreDataROIRegional}/100`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600">
              <span className="inline-block w-3.5 h-1 bg-slate-950 rounded-full" aria-hidden="true" />
              Línea negra horizontal = Base Preparatoria en esa región ({metricaRegionalVista === 'sueldo' ? 'Salario' : 'Formalidad'})
            </span>
            {regionActiva !== 'nacional' && (
              <button
                onClick={() => setRegionActiva('nacional')}
                className="no-print font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Restablecer a Nacional
              </button>
            )}
          </div>
        </div>

        {/* PISO 3 DERECHA: CALIDAD OIT CON HOVER LINKING + MOSAICO BENTO */}
        <div className="lg:col-span-6 bg-gradient-to-b from-white via-white to-slate-50/70 rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-6">
          
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" aria-hidden="true" />
                Calidad de Ocupación ({ocupadosCount.toLocaleString('es-MX')} ocupados)
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Desempleo: {desempleoSeguro.toFixed(1)}% ({desempleadosCount.toLocaleString('es-MX')})
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3.5">
              Pasa el cursor sobre la barra o las tarjetas para inspeccionar cada segmento (<strong className="text-slate-800">{tasaFormalidadPct}% formalidad total</strong>).
            </p>

            <div
              className="w-full h-6 rounded-xl overflow-hidden flex bg-slate-100 mb-3 p-0.5 gap-0.5 border border-slate-200/70"
              onMouseLeave={() => setSegmentoOITHover(null)}
            >
              <div
                onMouseEnter={() => setSegmentoOITHover('calidad')}
                style={{ width: `${tasaEmpleoCalidadPct}%` }}
                className={`h-full bg-gradient-to-r from-blue-700 to-blue-500 rounded-l-lg transition-all duration-300 cursor-pointer ${
                  segmentoOITHover && segmentoOITHover !== 'calidad' ? 'opacity-45' : 'opacity-100'
                }`}
              />
              <div
                onMouseEnter={() => setSegmentoOITHover('basico')}
                style={{ width: `${tasaFormalBasicoPct}%` }}
                className={`h-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-all duration-300 cursor-pointer ${
                  segmentoOITHover && segmentoOITHover !== 'basico' ? 'opacity-45' : 'opacity-100'
                }`}
              />
              <div
                onMouseEnter={() => setSegmentoOITHover('informal')}
                style={{ width: `${tasaInformalidadPct}%` }}
                className={`h-full bg-slate-400 rounded-r-lg transition-all duration-300 cursor-pointer ${
                  segmentoOITHover && segmentoOITHover !== 'informal' ? 'opacity-45' : 'opacity-100'
                }`}
              />
            </div>

            <div
              className="grid grid-cols-3 gap-3 text-xs"
              onMouseLeave={() => setSegmentoOITHover(null)}
            >
              <div
                onMouseEnter={() => setSegmentoOITHover('calidad')}
                className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                  segmentoOITHover === 'calidad'
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/15 -translate-y-0.5 shadow-xs'
                    : segmentoOITHover
                      ? 'bg-slate-50 border-slate-200/80 opacity-60'
                      : 'bg-white border-slate-200/80 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
                  Empleo Calidad OIT
                </div>
                <p className="text-lg font-black text-blue-600 mt-0.5">{tasaEmpleoCalidadPct}%</p>
                <p className="text-[11px] text-slate-400">{countCalidad.toLocaleString('es-MX')} ocupados</p>
              </div>

              <div
                onMouseEnter={() => setSegmentoOITHover('basico')}
                className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                  segmentoOITHover === 'basico'
                    ? 'bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/15 -translate-y-0.5 shadow-xs'
                    : segmentoOITHover
                      ? 'bg-slate-50 border-slate-200/80 opacity-60'
                      : 'bg-white border-slate-200/80 hover:border-sky-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" aria-hidden="true" />
                  Formal Básico
                </div>
                <p className="text-lg font-black text-slate-900 mt-0.5">{tasaFormalBasicoPct}%</p>
                <p className="text-[11px] text-slate-400">{countFormalBasico.toLocaleString('es-MX')} ocupados</p>
              </div>

              <div
                onMouseEnter={() => setSegmentoOITHover('informal')}
                className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                  segmentoOITHover === 'informal'
                    ? 'bg-slate-100 border-slate-500 ring-2 ring-slate-500/15 -translate-y-0.5 shadow-xs'
                    : segmentoOITHover
                      ? 'bg-slate-50 border-slate-200/80 opacity-60'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
                  Sector Informal
                </div>
                <p className="text-lg font-black text-slate-900 mt-0.5">{tasaInformalidadPct}%</p>
                <p className="text-[11px] text-slate-400">{countInformal.toLocaleString('es-MX')} ocupados</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-blue-600" aria-hidden="true" />
              Mosaico de Empleadores (Composición 100%)
            </h3>
            <p className="text-xs text-slate-500 mb-3.5">
              Unidades económicas donde ejercen los profesionistas ocupados según el tamaño y naturaleza del establecimiento.
            </p>

            <div className="grid grid-cols-12 gap-2.5">
              {listaEmpleadores.map((item, i) => {
                const primeroDominante = (listaEmpleadores[0]?.value || 0) >= 55;
                let spanClass = 'col-span-6 p-3';
                if (i === 0) {
                  spanClass = primeroDominante ? 'col-span-7 sm:col-span-8 p-3.5' : 'col-span-6 p-3.5';
                } else if (i === 1) {
                  spanClass = primeroDominante ? 'col-span-5 sm:col-span-4 p-3.5' : 'col-span-6 p-3.5';
                } else {
                  spanClass = listaEmpleadores.length === 5 ? 'col-span-4 p-3' : 'col-span-6 p-3';
                }

                const conteoPersonasSector = Math.round(ocupadosCount * (item.value / 100));

                return (
                  <div
                    key={i}
                    className={`rounded-xl border flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${spanClass} ${item.estilo.bg}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 ${item.estilo.sub}`}>
                        {item.icon}
                        <span>#{i + 1} Sector</span>
                      </span>
                      <span className={`text-[10px] font-bold ${item.estilo.sub}`}>
                        {conteoPersonasSector.toLocaleString('es-MX')} prof.
                      </span>
                    </div>

                    <div>
                      <p className="text-xl font-black leading-none mb-1">
                        {item.value.toFixed(1)}%
                      </p>
                      <p className="text-[11px] sm:text-xs font-bold leading-snug mb-2">
                        {item.name}
                      </p>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${item.estilo.track}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.estilo.bar}`}
                          style={{ width: `${Math.max(6, Math.min(100, item.value))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* PISO 4: ESCALERA DE PRESTACIONES CON MARCADOR VECTORIAL SVG EXACTO (50%) + RIELES DIVERGENTES (50%) */}
      <div className="print-avoid-break grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-6 bg-gradient-to-b from-white via-white to-slate-50/70 rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
          <div>
            <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-blue-600" aria-hidden="true" />
              Escalera de Prestaciones vs. Media Contextual Dinámica
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Las barras <strong className="text-emerald-700">esmeralda</strong> superan a la media regional, las <strong className="text-blue-600">azules</strong> están en rango promedio y las <strong className="text-amber-700">ámbar</strong> presentan rezago frente a la marca negra vectorial.
            </p>

            <div className="space-y-5">
              {listaPrestaciones.map((item, idx) => {
                const diff = Number((item.valor - item.mediaCtx).toFixed(1));
                const colorBarraPrestacion =
                  diff >= 2.0
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                    : diff <= -2.0
                      ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-500';

                const badgeDiffClass =
                  diff >= 2.0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                    : diff <= -2.0
                      ? 'bg-amber-50 text-amber-800 border border-amber-200/70'
                      : 'bg-slate-100 text-slate-600';

                return (
                  <div key={idx} className="group">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{item.nombre}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${badgeDiffClass}`}>
                          {diff >= 0 ? `+${diff}% vs. Media` : `${diff}% vs. Media`}
                        </span>
                        <span className="text-sm font-black text-slate-900 w-12 text-right">
                          {item.valor.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 h-3.5 rounded-full relative overflow-visible border border-slate-200/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${colorBarraPrestacion}`}
                        style={{ width: `${Math.max(2, Math.min(100, item.valor))}%` }}
                      />
                      <MarcadorMediaVectorial
                        leftPct={item.mediaCtx}
                        titulo={`Media Universitaria Dinámica (${REGIONES_INFO[regionActiva]?.corto}): ${item.mediaCtx}%`}
                        altura={24}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600">
              <svg width="10" height="14" viewBox="0 0 10 14" shapeRendering="geometricPrecision" aria-hidden="true">
                <polygon points="5,0 9,4 5,8 1,4" fill="#0F172A" />
                <rect x="4" y="4" width="2" height="10" rx="1" fill="#0F172A" />
              </svg>
              Marca negra con diamante = Promedio Dinámico Licenciatura ({REGIONES_INFO[regionActiva]?.corto})
            </span>
            <span>Fuente: Microdatos ENOE INEGI</span>
          </div>
        </div>

        <div className="lg:col-span-6 bg-gradient-to-b from-white via-white to-slate-50/70 rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-blue-600" aria-hidden="true" />
                  Barreras de Entrada y Fricción Laboral
                </h3>
                <p className="text-xs text-slate-500">
                  En las 5 métricas, ubicarse en la <strong className="text-emerald-700">mitad izquierda verde</strong> indica menor barrera o menor fricción que el promedio regional.
                </p>
              </div>

              <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${social.cuadrante.badge}`}>
                {social.cuadrante.nombre} ({Math.round(social.scoreMovilidad)}% Mérito)
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              <RielFriccionDivergente
                titulo="Índice de Privilegio (Estrato Origen)"
                subtitulo="Escala INEGI 1.0 a 4.0"
                valor={social.estrato}
                mediaContextual={benchContextual.indice_privilegio}
                mediaNacional={benchNacionalFijo.indice_privilegio}
                esVistaRegional={esVistaRegional}
                maxDesviacionEscala={0.65}
                minEscala={1.8}
                maxEscala={3.5}
                unidad="estrato"
              />

              <RielFriccionDivergente
                titulo="Ingreso por Redes Familiares (Nepotismo)"
                subtitulo="Contratación por contactos"
                valor={social.nepotismo}
                mediaContextual={benchContextual.pct_nepotismo}
                mediaNacional={benchNacionalFijo.pct_nepotismo}
                esVistaRegional={esVistaRegional}
                maxDesviacionEscala={18}
                minEscala={15}
                maxEscala={56}
                unidad="%"
              />

              <RielFriccionDivergente
                titulo="Pluriempleo (Segundo Trabajo)"
                subtitulo="Dos o más empleos simultáneos"
                valor={pPluriempleo}
                mediaContextual={benchContextual.pct_pluriempleo}
                mediaNacional={benchNacionalFijo.pct_pluriempleo}
                esVistaRegional={esVistaRegional}
                maxDesviacionEscala={14}
                minEscala={0}
                maxEscala={26}
                unidad="%"
              />

              <RielFriccionDivergente
                titulo="Migración Forzada (Desarraigo)"
                subtitulo="Cambio de estado para ejercer"
                valor={pDesarraigo}
                mediaContextual={benchContextual.pct_desarraigo}
                mediaNacional={benchNacionalFijo.pct_desarraigo}
                esVistaRegional={esVistaRegional}
                maxDesviacionEscala={10}
                minEscala={0}
                maxEscala={16}
                unidad="%"
              />

              <RielFriccionDivergente
                titulo="Trabajo Doméstico No Remunerado"
                subtitulo={modoGenero === 'total' ? 'Doble jornada (estandarizado H/M)' : 'Doble jornada en el hogar'}
                valor={hrsHogarActiva}
                mediaContextual={benchContextual.hrs_hogar}
                mediaNacional={benchNacionalFijo.hrs_hogar}
                esVistaRegional={esVistaRegional}
                maxDesviacionEscala={13}
                minEscala={4}
                maxEscala={32}
                unidad=" hrs"
              />
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2.5">
              Modalidad de Ubicación y Jornada vs. Media Contextual Dinámica
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" /> Trabajo Remoto
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      diffHomeOffice >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {diffHomeOffice >= 0 ? `+${diffHomeOffice}%` : `${diffHomeOffice}%`} vs. Media
                    </span>
                    <span className="text-sm font-black text-slate-900">{pHomeOffice.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full relative overflow-visible my-2 border border-slate-200/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (pHomeOffice / 20) * 100)}%` }}
                  />
                  <MarcadorMediaVectorial
                    leftPct={Math.min(98, (benchContextual.pct_home_office / 20) * 100)}
                    titulo={`Media Contextual Dinámica: ${benchContextual.pct_home_office}%`}
                    altura={20}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0%</span>
                  <span>Marca negra (Media): {benchContextual.pct_home_office}%</span>
                  <span>20%+</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" /> Medio Tiempo {'(<30h)'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {diffMedioTiempo >= 0 ? `+${diffMedioTiempo}%` : `${diffMedioTiempo}%`} vs. Media
                    </span>
                    <span className="text-sm font-black text-slate-900">{pMedioTiempo.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full relative overflow-visible my-2 border border-slate-200/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slate-700 to-slate-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (pMedioTiempo / 46) * 100)}%` }}
                  />
                  <MarcadorMediaVectorial
                    leftPct={Math.min(98, (benchContextual.pct_medio_tiempo / 46) * 100)}
                    titulo={`Media Contextual Dinámica: ${benchContextual.pct_medio_tiempo}%`}
                    altura={20}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0%</span>
                  <span>Marca negra (Media): {benchContextual.pct_medio_tiempo}%</span>
                  <span>46%</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default function CarreraPerfilPage() {
  return (
    <main className="font-sans p-4 md:px-8 md:py-5">
      <Suspense
        fallback={
          <div className="min-h-[80vh] flex flex-col items-center justify-center p-6">
            <Loader2 className="w-9 h-9 animate-spin text-blue-600 mb-3" />
            <p className="text-slate-500 text-sm font-medium">Abriendo reporte de la carrera...</p>
          </div>
        }
      >
        <CarreraPerfilContenido />
      </Suspense>
    </main>
  );
}