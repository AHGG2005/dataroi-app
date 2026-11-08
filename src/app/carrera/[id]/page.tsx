"use client";

import React, { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { descargarReporteCarreraPDF } from '@/lib/pdfReportGenerator';
import {
  descargarLibroExcelXLSX,
  descargarCSVEstilizado,
  ValorCeldaExcel
} from '@/lib/excelReportGenerator';
import GraficaPredictiva, {
  BENCHMARK_PREPA,
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
  Calculator, ThumbsUp, AlertTriangle, Share2, Download, Printer, Check, FlaskConical, FileSpreadsheet
} from 'lucide-react';

const REGIONES_ORDEN = ['nacional', 'norte', 'noroeste', 'bajio', 'centro', 'sur'] as const;
const MACRO_REGIONES_5 = ['norte', 'noroeste', 'bajio', 'centro', 'sur'] as const;

type TipoUniversidadROI = 'publica' | 'privada_media' | 'privada_elite' | 'personalizada';

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
  { bg: 'bg-blue-600 text-white border-blue-700', sub: 'text-blue-100' },
  { bg: 'bg-slate-900 text-white border-slate-900', sub: 'text-slate-300' },
  { bg: 'bg-blue-50/90 text-slate-900 border-blue-200', sub: 'text-blue-700' },
  { bg: 'bg-slate-100 text-slate-800 border-slate-200', sub: 'text-slate-500' },
  { bg: 'bg-slate-50 text-slate-700 border-slate-200', sub: 'text-slate-400' }
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
      detalle: 'Exige instrumental clínico/odontológico propio, uniformes quirúrgicos e insumos continuos de práctica hospitalaria.'
    };
  }
  if (pref4 === '0821') {
    return {
      nivel: 3,
      costoEquipo: 85000,
      etiqueta: 'Inversión Alta en Equipo',
      badge: 'text-rose-700 bg-rose-50 border-rose-200',
      detalle: 'Exige instrumental clínico veterinario, equipo de diagnóstico y materiales continuos de práctica zootécnica.'
    };
  }
  if (pref3 === '073') {
    return {
      nivel: 3,
      costoEquipo: 85000,
      etiqueta: 'Inversión Alta en Equipo',
      badge: 'text-rose-700 bg-rose-50 border-rose-200',
      detalle: 'Exige estación gráfica de alto rendimiento para modelado CAD/BIM, impresión de planos y materiales de maquetación.'
    };
  }
  if (pref3 === '021') {
    return {
      nivel: 3,
      costoEquipo: 85000,
      etiqueta: 'Inversión Alta en Equipo',
      badge: 'text-rose-700 bg-rose-50 border-rose-200',
      detalle: 'Exige equipo de producción audiovisual/fotográfica, materiales de taller creativo o estación de diseño de alto rendimiento.'
    };
  }
  if (pref4 === '1014' || pref4 === '1013' || pref4 === '1015') {
    return {
      nivel: 3,
      costoEquipo: 85000,
      etiqueta: 'Inversión Alta en Equipo',
      badge: 'text-rose-700 bg-rose-50 border-rose-200',
      detalle: 'Exige cuchillería profesional, uniformes técnicos e insumos continuos para prácticas de laboratorio gastronómico.'
    };
  }

  if (pref2 === '06') {
    return {
      nivel: 2,
      costoEquipo: 42000,
      etiqueta: 'Inversión Media en Equipo',
      badge: 'text-amber-700 bg-amber-50 border-amber-200',
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
      detalle: 'Requiere equipo de cómputo para simulación/modelado especializado e insumos periódicos de prácticas de laboratorio.'
    };
  }

  return {
    nivel: 1,
    costoEquipo: 18000,
    etiqueta: 'Inversión Básica',
    badge: 'text-emerald-700 bg-emerald-50 border-emerald-200',
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
  if (sat <= 85) return { texto: 'Alta Demanda (Baja saturación)', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (sat <= 110) return { texto: 'Mercado Equilibrado', clase: 'bg-blue-50 text-blue-700 border-blue-200' };
  if (sat <= 135) return { texto: 'Mercado Competido', clase: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { texto: 'Alta Saturación de Egresados', clase: 'bg-rose-50 text-rose-700 border-rose-200' };
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
      texto: 'Exige inversión media en equipamiento de cómputo o laboratorio (~$42,000 MXN adicionales durante la carrera).'
    });
  } else if (nivelCapEx === 3) {
    contras.push({
      score: 13,
      texto: 'Exige inversión alta en equipamiento especializado (~$85,000 MXN adicionales durante la formación).'
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

function calcAutonomiaRadar(homeOffice: number, micro: number, medioTiempo: number): number {
  const compHo = Math.min(100, homeOffice * 5.0);
  const compMic = Math.min(100, micro * 1.5);
  const compMt = Math.min(100, medioTiempo * 2.0);
  return Math.round(Math.max(15, Math.min(100, compHo * 0.40 + compMic * 0.35 + compMt * 0.25)));
}

function calcEstabilidadArraigoRadar(contrato: number, pluriempleo: number, desarraigo: number): number {
  const compPluri = Math.max(10, Math.min(100, 100 - pluriempleo * 5.0));
  const compDesarr = Math.max(10, Math.min(100, 100 - desarraigo * 6.5));
  return Math.round(compPluri * 0.35 + compDesarr * 0.30 + contrato * 0.35);
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
  let colorTallo = 'bg-slate-400/50';
  let colorNodo = 'bg-slate-600';

  if (Math.abs(diff) >= umbralNeutro) {
    if (diff < 0) {
      colorBadge = 'bg-emerald-50 text-emerald-700';
      colorTallo = 'bg-emerald-500/50';
      colorNodo = 'bg-emerald-600';
    } else {
      colorBadge = 'bg-amber-50 text-amber-800';
      colorTallo = 'bg-amber-500/50';
      colorNodo = 'bg-amber-500';
    }
  }

  const sufijoDiff = esEscalaEstrato ? ' pts' : unidad;
  const textoValor = esEscalaEstrato ? `${valor.toFixed(2)} / 4` : `${valor.toFixed(1)}${unidad}`;
  const textoMin = esEscalaEstrato ? `${minEscala.toFixed(1)}` : `${minEscala}${unidad}`;
  const textoMediaCtx = esEscalaEstrato ? `${mediaContextual.toFixed(2)}` : `${mediaContextual}${unidad}`;
  const textoMediaNac = esEscalaEstrato ? `${mediaNacional.toFixed(2)}` : `${mediaNacional}${unidad}`;
  const textoMax = esEscalaEstrato ? `${maxEscala.toFixed(1)}` : `${maxEscala}${unidad}`;

  return (
    <div className="py-2.5 border-b border-slate-100 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="min-w-0">
          <span className="text-xs font-bold text-slate-800">{titulo}</span>
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

      <div className="relative h-5 flex items-center my-0.5">
        <div className="w-full h-1.5 bg-slate-100 rounded-full relative overflow-hidden">
          <div
            className={`absolute top-0 bottom-0 rounded-full transition-all duration-500 ${colorTallo}`}
            style={{ left: `${leftTallo}%`, width: `${Math.max(1, widthTallo)}%` }}
          />
        </div>

        <div
          title={`Media de referencia dinámica: ${textoMediaCtx}`}
          className="absolute left-1/2 -top-0.5 -bottom-0.5 w-0.5 bg-slate-950 z-10 -translate-x-1/2"
        />

        <div
          title={`Esta carrera: ${textoValor}`}
          className={`absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-20 -translate-x-1/2 transition-all duration-500 ${colorNodo}`}
          style={{ left: `${posNodo}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
        <span className="text-emerald-700/80 font-semibold">{'←'} Menor fricción ({textoMin})</span>
        <span className="text-slate-600 font-semibold">
          {esVistaRegional
            ? `Media Región: ${textoMediaCtx} (Nac: ${textoMediaNac})`
            : `Centro (Media Nac): ${textoMediaNac}`}
        </span>
        <span className="text-amber-800/80 font-semibold">Mayor fricción ({textoMax}) {'→'}</span>
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
}

function CarreraPerfilContenido() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : String(params?.id || '');
  const cve_carrera = rawId.padStart(6, '0');

  const regionParam = searchParams.get('region');
  const generoParam = searchParams.get('genero');
  const uniParam = searchParams.get('uni');
  const costoParam = searchParams.get('costo');

  const regionInicial = regionParam && REGIONES_ORDEN.includes(regionParam as any) ? regionParam : 'nacional';
  const generoInicial: ModoGeneroEstricto =
    generoParam === 'mujeres' || generoParam === 'hombres' || generoParam === 'total'
      ? generoParam
      : 'total';

  const uniInicial: TipoUniversidadROI =
    uniParam === 'privada_media' || uniParam === 'privada_elite' || uniParam === 'personalizada' || uniParam === 'publica'
      ? uniParam
      : 'publica';

  const costoInicial = costoParam && Number.isFinite(Number(costoParam)) && Number(costoParam) >= 0
    ? Number(costoParam)
    : 32000;

  const [regionActiva, setRegionActiva] = useState<string>(regionInicial);
  const [modoGenero, setModoGenero] = useState<ModoGeneroEstricto>(generoInicial);
  const [metricaRegionalVista, setMetricaRegionalVista] = useState<'sueldo' | 'formalidad'>('sueldo');
  const [tipoUniROI, setTipoUniROI] = useState<TipoUniversidadROI>(uniInicial);
  const [costoColegiaturaCustom, setCostoColegiaturaCustom] = useState<number>(costoInicial);
  const [enlaceCopiado, setEnlaceCopiado] = useState<boolean>(false);

  const [carreraInfo, setCarreraInfo] = useState<any>(null);
  const [todosSatelitesGlobal, setTodosSatelitesGlobal] = useState<any[]>([]);
  const [statsMercado, setStatsMercado] = useState<ResumenMercadoRegion | null>(null);
  const [loading, setLoading] = useState(true);

  const seleccionarTipoUni = (nuevoTipo: TipoUniversidadROI) => {
    setTipoUniROI(nuevoTipo);
    if (nuevoTipo === 'publica') setCostoColegiaturaCustom(32000);
    if (nuevoTipo === 'privada_media') setCostoColegiaturaCustom(340000);
    if (nuevoTipo === 'privada_elite') setCostoColegiaturaCustom(820000);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('region', regionActiva);
    url.searchParams.set('genero', modoGenero);
    url.searchParams.set('uni', tipoUniROI);
    if (tipoUniROI === 'personalizada') {
      url.searchParams.set('costo', String(costoColegiaturaCustom));
    } else {
      url.searchParams.delete('costo');
    }
    window.history.replaceState({}, '', url.toString());
  }, [regionActiva, modoGenero, tipoUniROI, costoColegiaturaCustom]);

  const handleStatsChange = useCallback((nuevosStats: ResumenMercadoRegion) => {
    setStatsMercado(nuevosStats);
  }, []);

  useEffect(() => {
    async function cargarPerfilYBenchmarks() {
      if (!rawId) return;
      setLoading(true);

      const cveSinCero = String(Number(rawId));

      const [resCarrera, resSat1, resSat2] = await Promise.all([
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
          .range(1000, 2499)
      ]);

      const todasFilasSat = [...(resSat1.data || []), ...(resSat2.data || [])];
      setCarreraInfo(resCarrera.data?.[0] || null);
      setTodosSatelitesGlobal(todasFilasSat);
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-9 h-9 animate-spin text-blue-600 mb-3" />
        <p className="text-slate-500 text-sm font-medium">Cargando reporte ejecutivo y calculando benchmarks dinámicos...</p>
      </div>
    );
  }

  if (!carreraInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
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
            <ArrowLeft className="w-4 h-4" /> Volver al Directorio
          </Link>
        </div>
      </div>
    );
  }

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
  const satRaw = statsMercado?.saturacion ?? 100;
  const saturacionSegura = satRaw > 5 ? satRaw : 100;
  const desempleoSeguro = statsMercado?.tasaDesempleo ?? 3.5;

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

  const diagnosticoEjecutivo = generarDiagnosticoEjecutivoV2({
    cve_carrera,
    sueldoActivo: sueldoParaRadar,
    sueldoPrepaActivo: sueldoPrepaParaROI,
    sueldoLicMediaReg: benchReg.sueldo_lic_promedio,
    premioVsPrepaPct: statsMercado?.premioVsPrepaPct ?? 0,
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

  const costoBaseColegiatura =
    tipoUniROI === 'publica' ? 32000 :
    tipoUniROI === 'privada_media' ? 340000 :
    tipoUniROI === 'privada_elite' ? 820000 :
    costoColegiaturaCustom;

  const inversionTotalROI = costoBaseColegiatura + capex.costoEquipo;
  const bonoAnualROI = (sueldoParaRadar - sueldoPrepaParaROI) * 12;
  const aniosRetornoROI = bonoAnualROI > 0 ? Number((inversionTotalROI / bonoAnualROI).toFixed(1)) : null;
  const gananciaNeta10Anios = bonoAnualROI * 10 - inversionTotalROI;

  let semaforoROI = {
    etiqueta: 'Retorno Rápido (Alta viabilidad)',
    claseBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    colorBarra: 'bg-emerald-500'
  };
  if (aniosRetornoROI === null) {
    semaforoROI = {
      etiqueta: 'Retorno Negativo en esta zona',
      claseBadge: 'bg-rose-50 text-rose-700 border-rose-200',
      colorBarra: 'bg-rose-500'
    };
  } else if (aniosRetornoROI > 14) {
    semaforoROI = {
      etiqueta: 'Riesgo Financiero (Sobrecosto)',
      claseBadge: 'bg-rose-50 text-rose-700 border-rose-200',
      colorBarra: 'bg-rose-500'
    };
  } else if (aniosRetornoROI > 7.5) {
    semaforoROI = {
      etiqueta: 'Retorno Lento (Exige beca alta)',
      claseBadge: 'bg-amber-50 text-amber-800 border-amber-200',
      colorBarra: 'bg-amber-500'
    };
  } else if (aniosRetornoROI > 3.5) {
    semaforoROI = {
      etiqueta: 'Retorno Moderado (Plazo medio)',
      claseBadge: 'bg-blue-50 text-blue-700 border-blue-200',
      colorBarra: 'bg-blue-600'
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

  const scoreAutonomia = calcAutonomiaRadar(pHomeOffice, pMicro, pMedioTiempo);
  const scoreAutonomiaMedia = calcAutonomiaRadar(benchContextual.pct_home_office, benchContextual.pct_micro, benchContextual.pct_medio_tiempo);

  const scoreEstabilidad = calcEstabilidadArraigoRadar(pContrato, pPluriempleo, pDesarraigo);
  const scoreEstabilidadMedia = calcEstabilidadArraigoRadar(benchContextual.pct_contrato, benchContextual.pct_pluriempleo, benchContextual.pct_desarraigo);

  const datosRadar = [
    { eje: `Salario (${scoreSalario})`, nombreCorto: 'Salario', Carrera: scoreSalario, 'Media Contextual': scoreSalarioMedia, diff: scoreSalario - scoreSalarioMedia },
    { eje: `Formalidad (${scoreFormalidad})`, nombreCorto: 'Formalidad', Carrera: scoreFormalidad, 'Media Contextual': scoreFormalidadMedia, diff: scoreFormalidad - scoreFormalidadMedia },
    { eje: `Empleo (${scoreEmpleabilidad})`, nombreCorto: 'Empleabilidad', Carrera: scoreEmpleabilidad, 'Media Contextual': scoreEmpleabilidadMedia, diff: scoreEmpleabilidad - scoreEmpleabilidadMedia },
    { eje: `Mérito (${scoreMeritocracia})`, nombreCorto: 'Meritocracia', Carrera: scoreMeritocracia, 'Media Contextual': scoreMeritocraciaMedia, diff: scoreMeritocracia - scoreMeritocraciaMedia },
    { eje: `Autonomía (${scoreAutonomia})`, nombreCorto: 'Autonomía', Carrera: scoreAutonomia, 'Media Contextual': scoreAutonomiaMedia, diff: scoreAutonomia - scoreAutonomiaMedia },
    { eje: `Estabilidad (${scoreEstabilidad})`, nombreCorto: 'Estabilidad', Carrera: scoreEstabilidad, 'Media Contextual': scoreEstabilidadMedia, diff: scoreEstabilidad - scoreEstabilidadMedia }
  ];

  const pAcademiaOtros = Math.max(0, Number((100 - (pCorp + pPyme + pMicro + pGob)).toFixed(1)));

  const listaEmpleadores = [
    { name: 'PYME (Empresas y Planteles 6–100 emp.)', value: pPyme },
    { name: 'Microempresa y Práctica Independiente', value: pMicro },
    { name: 'Gran Corporativo y Transnacional', value: pCorp },
    { name: 'Administración Pública y Gobierno', value: pGob },
    ...(pAcademiaOtros > 0.5 ? [{ name: 'Academia, Investigación y ONGs', value: pAcademiaOtros }] : [])
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
    const formR = satR
      ? Number((Number(satR.pct_contrato || 0) * 0.45 + Number(satR.pct_aguinaldo || 0) * 0.30 + Number(satR.pct_afore || 0) * 0.25).toFixed(1))
      : tasaFormalidadPct;

    const formPrepaReg = bReg.formalidad_prepa_pct || 50.1;
    const diffFormPts = Number((formR - formPrepaReg).toFixed(1));

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
      celdaDisponible: celdaDisp
    };
  });

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
          title: `DataROI — ${carreraInfo.nombre_carrera} (${REGIONES_INFO[regionActiva]?.corto})`,
          text: `Radiografía salarial y retorno de inversión de ${carreraInfo.nombre_carrera} en ${REGIONES_INFO[regionActiva]?.nombre}.`,
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
    const filaInd = (
      cat: string,
      ind: string,
      valCar: number | string,
      valMed: number | string,
      unidad: string,
      mejorAlto: boolean | null = null
    ): ValorCeldaExcel[] => {
      if (typeof valCar === 'number' && typeof valMed === 'number' && mejorAlto !== null) {
        const diff = Number((valCar - valMed).toFixed(2));
        const gana = mejorAlto ? diff >= 0 : diff <= 0;
        const signo = diff > 0 ? `+${diff}` : `${diff}`;
        return [
          cat,
          ind,
          { v: valCar, s: gana ? 'winner' : 'bold' },
          valMed,
          `${signo} (${gana ? 'Favorable vs. Media' : 'Por debajo / Mayor fricción'})`,
          unidad
        ];
      }
      return [cat, ind, { v: valCar, s: 'bold' }, valMed, '-', unidad];
    };

    const filasHoja1: ValorCeldaExcel[][] = [
      filaInd('1. Identificación', 'Clave CMPE INEGI', cve_carrera, '-', carreraInfo.nombre_carrera),
      filaInd('1. Identificación', 'Macro-Región y Perfil Evaluado', REGIONES_INFO[regionActiva]?.nombre || regionActiva, '-', etiquetaGeneroActual),
      filaInd('1. Identificación', 'Muestra Certificada INEGI', nEncuestadosActivos, '-', 'Encuestados físicos reales'),
      filaInd('2. Salario y ROI', 'Salario Mensual Consolidado', sueldoParaRadar, benchReg.sueldo_lic_promedio, 'MXN / mes', true),
      filaInd('2. Salario y ROI', 'Salario Base Preparatoria Regional', sueldoPrepaParaROI, sueldoPrepaParaROI, 'MXN / mes'),
      filaInd('2. Salario y ROI', 'Prima Salarial vs. Preparatoria', statsMercado?.premioVsPrepaPct ?? 0, '-', '% sobre bachillerato'),
      filaInd('2. Salario y ROI', 'Tendencia Salarial Real (2021–2026)', statsMercado?.tendenciaEtiqueta || 'Estable', '-', 'Pesos constantes 2026'),
      filaInd('2. Salario y ROI', 'Inversión Total Estimada (Carrera + Equipo)', inversionTotalROI, '-', `MXN (${tipoUniROI})`),
      filaInd('2. Salario y ROI', 'Tiempo de Recuperación (ROI)', aniosRetornoROI ?? 'No amortizable', '-', semaforoROI.etiqueta),
      filaInd('2. Salario y ROI', 'Ganancia Neta a 10 Años vs. Prepa', gananciaNeta10Anios, '-', 'MXN acumulados'),
      filaInd('3. Calidad y Mercado', 'Empleo de Calidad (Estándar OIT)', tasaEmpleoCalidadPct, mediaCalidadOITContexto, '% de ocupados', true),
      filaInd('3. Calidad y Mercado', 'Formalidad Laboral Total', tasaFormalidadPct, scoreFormalidadMedia, '% de ocupados', true),
      filaInd('3. Calidad y Mercado', 'Tasa de Desempleo Abierto', Number(desempleoSeguro.toFixed(1)), 3.5, '% de la PEA', false),
      filaInd('3. Calidad y Mercado', 'Índice de Saturación ANUIES', Number(saturacionSegura.toFixed(0)), 100, `% (${diagSat.texto})`, false),
      filaInd('3. Calidad y Mercado', 'PEA Activa Estimada', peaTotal, '-', 'Personas'),
      filaInd('4. Ecosistema Empleador', 'PYME (Empresas 6–100 empleados)', pPyme, benchContextual.pct_pyme, '% de ocupados', true),
      filaInd('4. Ecosistema Empleador', 'Microempresa y Práctica Independiente', pMicro, benchContextual.pct_micro, '% de ocupados', true),
      filaInd('4. Ecosistema Empleador', 'Gran Corporativo y Transnacional', pCorp, benchContextual.pct_corp, '% de ocupados', true),
      filaInd('4. Ecosistema Empleador', 'Administración Pública y Gobierno', pGob, benchContextual.pct_gobierno, '% de ocupados', true),
      filaInd('4. Ecosistema Empleador', 'Academia, Investigación y ONGs', pAcademiaOtros, '-', '% de ocupados'),
      filaInd('5. Escalera de Prestaciones', 'Contrato Escrito Estable', pContrato, benchContextual.pct_contrato, '% de cobertura', true),
      filaInd('5. Escalera de Prestaciones', 'Aguinaldo de Ley', pAguinaldo, benchContextual.pct_aguinaldo, '% de cobertura', true),
      filaInd('5. Escalera de Prestaciones', 'Fondo de Retiro (AFORE)', pAfore, benchContextual.pct_afore, '% de cobertura', true),
      filaInd('5. Escalera de Prestaciones', 'Protección Materna / Paterna', Number(sateliteActual?.pct_materno || 0), benchContextual.pct_materno, '% de cobertura', true),
      filaInd('5. Escalera de Prestaciones', 'Afiliación Sindical / Gremial', pSindicato, benchContextual.pct_sindicato, '% de cobertura', true),
      filaInd('5. Escalera de Prestaciones', 'Seguro Médico Privado (SGMM)', pSgmm, benchContextual.pct_sgmm, '% de cobertura', true),
      filaInd('6. Barreras y Modalidad', 'Índice de Privilegio (Estrato Origen 1–4)', social.estrato, benchContextual.indice_privilegio, 'Escala INEGI 1 a 4', false),
      filaInd('6. Barreras y Modalidad', 'Ingreso por Redes Familiares (Nepotismo)', social.nepotismo, benchContextual.pct_nepotismo, '% por contactos', false),
      filaInd('6. Barreras y Modalidad', 'Índice de Ascensor Meritocrático', social.scoreMovilidad, 58.0, `% (${social.cuadrante.nombre})`, true),
      filaInd('6. Barreras y Modalidad', 'Pluriempleo (Segundo Trabajo)', pPluriempleo, benchContextual.pct_pluriempleo, '% con 2+ empleos', false),
      filaInd('6. Barreras y Modalidad', 'Migración Forzada (Desarraigo)', pDesarraigo, benchContextual.pct_desarraigo, '% que emigró de estado', false),
      filaInd('6. Barreras y Modalidad', 'Trabajo Doméstico No Remunerado', hrsHogarActiva, benchContextual.hrs_hogar, 'Horas / semana', false),
      filaInd('6. Barreras y Modalidad', 'Trabajo Remoto (Home Office)', pHomeOffice, benchContextual.pct_home_office, '% remoto', true),
      filaInd('6. Barreras y Modalidad', 'Jornada de Medio Tiempo (<30h)', pMedioTiempo, benchContextual.pct_medio_tiempo, '% medio tiempo'),
      filaInd('6. Barreras y Modalidad', 'Riesgo de Automatización IA', riesgoIA, 40, '% de exposición', false)
    ];

    const serieReal = obtenerSerieAnualConfiable();
    const filasHoja2: ValorCeldaExcel[][] = serieReal.map(pt => {
      const sLic = pt.sueldoLic ?? 0;
      const sPre = pt.sueldoPrepa ?? 0;
      const prima = sPre > 0 && sLic > 0 ? Number((((sLic - sPre) / sPre) * 100).toFixed(1)) : 0;
      return [
        pt.anio,
        sLic > 0 ? { v: sLic, s: 'bold' } : 'Sin dato',
        sPre > 0 ? sPre : 'Sin dato',
        sLic - sPre,
        prima,
        pt.pea || peaTotal
      ];
    });

    const filasHoja3: ValorCeldaExcel[][] = filasComparativaRegional.map(r => {
      const esAct = r.region === regionActiva;
      return [
        { v: r.nombreCorto, s: esAct ? 'section' : 'bold' },
        r.estados,
        r.celdaDisponible ? 'Muestra Certificada' : 'Muestra Insuficiente',
        r.celdaDisponible ? { v: r.sueldoCarrera, s: esAct ? 'winner' : 'bold' } : 'Sin muestra',
        r.sueldoPrepa,
        r.celdaDisponible ? r.premioPct : 'N/D',
        r.celdaDisponible ? r.formalidadPct : 'Sin muestra',
        r.formalidadPrepaPct,
        r.celdaDisponible ? r.diffFormalidadPts : 'N/D'
      ];
    });

    const filasHoja4: ValorCeldaExcel[][] = [
      ...diagnosticoEjecutivo.topPros.map((pro, idx) => [
        { v: `Fortaleza Comprobada #${idx + 1}`, s: 'winner' as const },
        'Ventaja Competitiva del Perfil',
        pro
      ]),
      ...diagnosticoEjecutivo.topContras.map((con, idx) => [
        { v: `Riesgo o Fricción #${idx + 1}`, s: 'gold' as const },
        'Factor de Riesgo a Considerar',
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
          nombre: '1_Indicadores_y_ROI',
          cabeceras: ['Categoria', 'Indicador_Auditado', 'Valor_Carrera', 'Media_Contextual_Region', 'Diferencial_vs_Media', 'Unidad_o_Detalle'],
          filas: filasHoja1
        },
        {
          nombre: '2_Serie_Salarial_2021_2026',
          cabeceras: ['Anio', 'Salario_Licenciatura_MXN', 'Salario_Base_Prepa_MXN', 'Diferencia_Mensual_MXN', 'Prima_vs_Prepa_Pct', 'PEA_Activa'],
          filas: filasHoja2
        },
        {
          nombre: '3_Comparativa_5_Regiones',
          cabeceras: ['Macro_Region', 'Entidades_Incluidas', 'Estatus_Muestra', 'Salario_Carrera_MXN', 'Salario_Prepa_MXN', 'Prima_Salarial_Pct', 'Formalidad_Carrera_Pct', 'Formalidad_Prepa_Pct', 'Dif_Formalidad_Pts'],
          filas: filasHoja3
        },
        {
          nombre: '4_Diagnostico_Pros_Contras',
          cabeceras: ['Clasificacion_Hallazgo', 'Tipo_Impacto', 'Descripcion_Ejecutiva_Auditada'],
          filas: filasHoja4
        }
      ]
    );
  };

  const exportarFichaCSV = () => {
    const { filasHoja1 } = construirHojasFichaCarrera();
    descargarCSVEstilizado(
      `DataROI_Ficha_${cve_carrera}_${regionActiva}_${modoGenero}.csv`,
      ['Categoria', 'Indicador_Auditado', 'Valor_Carrera', 'Media_Contextual_Region', 'Diferencial_vs_Media', 'Unidad_o_Detalle'],
      filasHoja1
    );
  };

  const descargarPDFEjecutivoCarrera = () => {
    const serieReal = obtenerSerieAnualConfiable();

    descargarReporteCarreraPDF({
      cve_carrera,
      nombre_carrera: carreraInfo.nombre_carrera,
      regionNombre: REGIONES_INFO[regionActiva]?.nombre || regionActiva,
      regionCorto: REGIONES_INFO[regionActiva]?.corto || regionActiva,
      perfilEtiqueta: etiquetaGeneroActual,
      nEncuestados: nEncuestadosActivos,
      capexEtiqueta: capex.etiqueta,
      riesgoIA,
      sueldoActivo: sueldoParaRadar,
      sueldoPrepa: sueldoPrepaParaROI,
      premioVsPrepaPct: statsMercado?.premioVsPrepaPct ?? 0,
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
      inversionTotalROI,
      aniosRetornoTexto: formatearAniosROI(aniosRetornoROI),
      semaforoROI: semaforoROI.etiqueta,
      gananciaNeta10Anios,
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* NAVEGACIÓN SUPERIOR + BARRA DE EXPORTACIÓN Y COMPARTIR */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center text-xs md:text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Directorio Nacional
          </Link>
          <span className="text-slate-300">|</span>
          <Link
            href="/laboratorio"
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors"
          >
            <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />
            Laboratorio Crudo
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={compartirAnalisis}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
          >
            {enlaceCopiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-blue-600" />}
            {enlaceCopiado ? '¡Enlace copiado!' : 'Compartir vista'}
          </button>

          <button
            onClick={exportarFichaExcel}
            title="Descargar Libro de Excel (.xlsx) con 4 Hojas separadas, colores y auto-ancho"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-2xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel (4 Hojas)
          </button>

          <button
            onClick={exportarFichaCSV}
            title="Descargar tabla de indicadores en formato CSV limpio (RFC 4180)"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            CSV
          </button>

          <button
            onClick={descargarPDFEjecutivoCarrera}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            Descargar PDF
          </button>

          <Link
            href={`/descubrir?region=${regionActiva}&genero=${modoGenero}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" /> Ir al Descubridor
          </Link>
        </div>
      </div>

      {/* PISO 1: CINTA EJECUTIVA UNIFICADA */}
      <div className="print-avoid-break bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 items-stretch">
          
          <div className="lg:col-span-5 p-6 flex flex-col justify-center gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 font-mono">
                  CVE: {cve_carrera}
                </span>
                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${capex.badge}`}>
                  {capex.etiqueta}
                </span>
                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border inline-flex items-center gap-1 ${
                  riesgoIA <= 35
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : riesgoIA <= 65
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {riesgoIA <= 35 ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                  Riesgo IA: {riesgoIA}%
                </span>
              </div>

              <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                {carreraInfo.nombre_carrera}
              </h1>
            </div>

            <p className="text-xs text-slate-500 pt-2.5 border-t border-slate-100 leading-relaxed">
              {capex.detalle}
            </p>
          </div>

          <div className="lg:col-span-3 p-6 flex flex-col justify-center gap-3.5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Salario Mensual Consolidado
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {statsMercado ? formatoMoneda(statsMercado.sueldoActivo) : '---'}
                </span>
                <span className="text-xs font-bold text-slate-400">/mes</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Prima vs. Prepa ({formatoMoneda(statsMercado?.sueldoPrepaActivo || 10608)}):</span>
                <span className={`font-black px-2 py-0.5 rounded ${
                  (statsMercado?.premioVsPrepaPct || 0) >= 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}>
                  {statsMercado && statsMercado.premioVsPrepaPct >= 0 ? `+${statsMercado.premioVsPrepaPct}%` : `${statsMercado?.premioVsPrepaPct || 0}%`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Bono anual: <strong className="text-slate-700">
                  {statsMercado && statsMercado.gananciaAnualExtra >= 0
                    ? `+${formatoMoneda(statsMercado.gananciaAnualExtra)}/año`
                    : `${formatoMoneda(statsMercado?.gananciaAnualExtra || 0)}/año`}
                </strong>
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 p-6 flex flex-col justify-center gap-3.5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Empleo de Calidad (OIT)
              </span>
              <span className="text-3xl font-black text-blue-600">
                {tasaEmpleoCalidadPct}%
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">vs. Media Lic.:</span>
                <span className={`font-black px-1.5 py-0.5 rounded text-[11px] ${
                  diffCalidadVsMediaLic >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                }`}>
                  {diffCalidadVsMediaLic >= 0 ? `+${diffCalidadVsMediaLic}` : diffCalidadVsMediaLic} pts
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Plenos: <strong className="text-slate-700">{countCalidad.toLocaleString('es-MX')}</strong> ocup.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 p-6 flex flex-col justify-center gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Índice de Saturación
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {statsMercado ? `${saturacionSegura.toFixed(0)}%` : '---'}
                </span>
              </div>
              <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded border ${diagSat.clase}`}>
                {diagSat.texto}
              </span>
            </div>

            <div className="pt-2.5 border-t border-slate-100 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">PEA Activa:</span>
                <span className="font-bold text-slate-800">{peaTotal.toLocaleString('es-MX')}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* BARRA DE CONTROL GLOBAL STICKY */}
      <div className="no-print sticky top-2 z-30 bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
            <MapPin className="w-4 h-4 text-blue-600" /> Macro-Región:
          </span>
          {REGIONES_ORDEN.map((reg) => {
            const activa = regionActiva === reg;
            const habilitada = tieneMuestraCelda(reg, codigoSexo);
            return (
              <button
                key={reg}
                disabled={!habilitada}
                onClick={() => habilitada && setRegionActiva(reg)}
                title={!habilitada ? `Muestra insuficiente en ${REGIONES_INFO[reg]?.corto} para este perfil` : REGIONES_INFO[reg]?.nombre}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 ${
                  !habilitada
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 opacity-50 cursor-not-allowed'
                    : activa
                      ? 'bg-blue-600 text-white shadow-xs cursor-pointer'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300 cursor-pointer'
                }`}
              >
                {!habilitada && <Lock className="w-3 h-3" />}
                {REGIONES_INFO[reg]?.corto || reg}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3">
          {nEncuestadosActivos > 0 && (
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg hidden xl:inline-flex items-center gap-1.5">
              Muestra INEGI: <strong className="text-slate-800">{nEncuestadosActivos.toLocaleString('es-MX')} encuestados</strong>
            </span>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" /> Perfil:
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
                    onClick={() => disp && setModoGenero(op.id)}
                    title={!disp ? `Muestra insuficiente para ${op.label} en ${REGIONES_INFO[regionActiva]?.corto}` : op.label}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 ${
                      !disp
                        ? 'text-slate-400 opacity-50 cursor-not-allowed'
                        : act
                          ? 'bg-slate-900 text-white shadow-xs cursor-pointer'
                          : 'text-slate-600 hover:text-slate-900 cursor-pointer'
                    }`}
                  >
                    {!disp && <Lock className="w-3 h-3" />}
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* PISO DE SÍNTESIS EJECUTIVA V2 (PROS/CONTRAS) + SIMULADOR DE ROI CON SLIDER DE COLEGIATURA EN VIVO */}
      <div className="print-avoid-break grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
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
              <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-2.5">
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                  Fortalezas Comprobadas
                </h3>
                <ul className="space-y-2.5 text-xs text-slate-700">
                  {diagnosticoEjecutivo.topPros.map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-snug">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <span className="font-medium">{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5 mb-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Riesgos y Fricciones a Considerar
                </h3>
                <ul className="space-y-2.5 text-xs text-slate-700">
                  {diagnosticoEjecutivo.topContras.map((contra, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-snug">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span className="font-medium">{contra}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  Simulador de Retorno (ROI)
                </h2>
                <p className="text-xs text-slate-500">
                  Años de trabajo para amortizar la carrera con el bono sobre Prepa.
                </p>
              </div>

              <div className="no-print inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {([
                  { id: 'publica' as TipoUniversidadROI, label: 'Pública' },
                  { id: 'privada_media' as TipoUniversidadROI, label: 'Priv. Media' },
                  { id: 'privada_elite' as TipoUniversidadROI, label: 'Priv. Élite' }
                ]).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => seleccionarTipoUni(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      tipoUniROI === t.id ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Tiempo de Recuperación
                </span>
                <span className="text-3xl font-black text-slate-900">
                  {formatearAniosROI(aniosRetornoROI)}
                </span>
              </div>
              <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border ${semaforoROI.claseBadge}`}>
                {semaforoROI.etiqueta}
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden my-2">
              <div
                className={`h-full rounded-full transition-all duration-300 ${semaforoROI.colorBarra}`}
                style={{
                  width: aniosRetornoROI === null
                    ? '100%'
                    : `${Math.max(10, Math.min(100, (1 - Math.min(15, aniosRetornoROI) / 16) * 100))}%`
                }}
              />
            </div>

            <div className="no-print my-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-bold text-slate-600">
                  Ajustar Colegiatura Total / Beca (4.5 años):
                </span>
                <span className="font-black text-blue-600">
                  {formatoMoneda(costoBaseColegiatura)} + {formatoMoneda(capex.costoEquipo)} equipo
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1200000}
                step={10000}
                value={costoBaseColegiatura}
                onChange={(e) => {
                  setTipoUniROI('personalizada');
                  setCostoColegiaturaCustom(Number(e.target.value));
                }}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/70">
              <div>
                <span className="text-[11px] text-slate-400 block">Inversión Total (Colegiatura + equipo):</span>
                <strong className="text-slate-800 font-black">{formatoMoneda(inversionTotalROI)} MXN</strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Ganancia Neta a 10 años vs. Prepa:</span>
                <strong className={`font-black ${gananciaNeta10Anios >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {gananciaNeta10Anios >= 0 ? `+${formatoMoneda(gananciaNeta10Anios)}` : formatoMoneda(gananciaNeta10Anios)}
                </strong>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* PISO 2: CURVA SALARIAL (65%) + HUELLA ESTRUCTURAL (35%) */}
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

        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2 mb-1">
              <Compass className="w-5 h-5 text-blue-600" />
              Huella Estructural (6 Pilares)
            </h2>
            <p className="text-xs text-slate-500 mb-2">
              Silueta de la carrera (<strong className="text-blue-600">azul</strong>) frente al promedio dinámico de {REGIONES_INFO[regionActiva]?.corto} (<strong className="text-slate-600">gris punteado</strong>).
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={datosRadar}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="eje" tick={{ fill: '#334155', fontSize: 10.5, fontWeight: 700 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Media Contextual"
                  dataKey="Media Contextual"
                  stroke="#64748B"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="#94A3B8"
                  fillOpacity={0.15}
                />
                <Radar
                  name="Esta Carrera"
                  dataKey="Carrera"
                  stroke="#2563EB"
                  strokeWidth={3}
                  fill="#2563EB"
                  fillOpacity={0.28}
                />
                <Legend wrapperStyle={{ fontSize: '11.5px', fontWeight: 700 }} />
                <RechartsTooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-[11px]">
            {datosRadar.map((d, idx) => (
              <div key={idx} className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-semibold block truncate">{d.nombreCorto}</span>
                <span className={`font-black ${
                  d.diff >= 3 ? 'text-emerald-700' : d.diff <= -3 ? 'text-amber-700' : 'text-slate-700'
                }`}>
                  {d.diff > 0 ? `+${d.diff}` : d.diff} vs. Media
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* PISO 3: COLUMNAS VERTICALES REGIONALES (50%) + CALIDAD Y MOSAICO (50%) */}
      <div className="print-avoid-break grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Comparativa por Macro-Región
              </h3>

              <div className="no-print inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setMetricaRegionalVista('sueldo')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    metricaRegionalVista === 'sueldo' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vista: Salario
                </button>
                <button
                  onClick={() => setMetricaRegionalVista('formalidad')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    metricaRegionalVista === 'formalidad' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vista: Formalidad
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              {metricaRegionalVista === 'sueldo'
                ? 'Haz clic en cualquier región habilitada para filtrar el reporte. La línea negra horizontal señala el sueldo base de Preparatoria.'
                : 'Haz clic en cualquier región habilitada para filtrar el reporte. La línea negra horizontal señala la formalidad base de Preparatoria.'}
            </p>

            <div className="grid grid-cols-5 gap-2.5 sm:gap-3 pt-1">
              {filasComparativaRegional.map((item: FilaComparativaRegionalUI) => {
                const esActiva = regionActiva === item.region;
                const esVistaSueldo = metricaRegionalVista === 'sueldo';
                const disp = item.celdaDisponible;

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
                    : `${item.formalidadPct}%`;

                const diffValor = esVistaSueldo ? item.premioPct : item.diffFormalidadPts;
                const textoBadgeDiff = !disp
                  ? 'N/D'
                  : esVistaSueldo
                    ? `${diffValor >= 0 ? `+${diffValor}%` : `${diffValor}%`} vs. Prepa`
                    : `${diffValor >= 0 ? `+${diffValor}` : `${diffValor}`} pts vs. Prepa`;

                const textoRefPrepa = esVistaSueldo
                  ? `Prepa: ${formatoMonedaCorta(item.sueldoPrepa)}`
                  : `Prepa: ${item.formalidadPrepaPct}%`;

                const textoComplementarioPie = !disp
                  ? 'Muestra insuf.'
                  : esVistaSueldo
                    ? `${item.formalidadPct}% formal`
                    : formatoMoneda(item.sueldoCarrera);

                return (
                  <button
                    key={item.region}
                    disabled={!disp}
                    onClick={() => disp && setRegionActiva(item.region)}
                    title={!disp ? `Muestra insuficiente en ${item.nombreCorto}` : `${item.nombreCorto} (${item.estados})`}
                    className={`group flex flex-col items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all ${
                      !disp
                        ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                        : esActiva
                          ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/15 shadow-2xs cursor-pointer'
                          : 'border-slate-200 hover:border-blue-300 bg-slate-50/40 hover:bg-white cursor-pointer'
                    }`}
                  >
                    <div className="text-center w-full mb-2">
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

                    <div className="w-full h-40 bg-slate-100/90 rounded-xl relative p-1.5 border border-slate-200/50">
                      <div className="relative w-full h-full flex items-end justify-center">
                        {disp && (
                          <div
                            className={`w-full rounded-lg transition-all duration-500 ${
                              esActiva
                                ? 'bg-blue-600 shadow-xs'
                                : 'bg-blue-400/75 group-hover:bg-blue-500/85'
                            }`}
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
                        esActiva ? 'text-blue-700' : 'text-slate-800'
                      }`}>
                        {item.nombreCorto}
                      </span>
                      <span className="block text-[10px] font-semibold text-slate-500 mt-0.5 truncate">
                        {textoRefPrepa}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5 truncate">
                        {textoComplementarioPie}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600">
              <span className="inline-block w-3.5 h-1 bg-slate-950 rounded-full" />
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

        {/* PISO 3 DERECHA: CALIDAD OIT + MOSAICO PROPORCIONAL */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-6">
          
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                Calidad de Ocupación ({ocupadosCount.toLocaleString('es-MX')} ocupados)
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Desempleo abierto: {statsMercado ? `${statsMercado.tasaDesempleo.toFixed(1)}%` : '0%'} ({desempleadosCount.toLocaleString('es-MX')})
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              El estándar de <strong>Empleo de Calidad OIT</strong> exige contar simultáneamente con contrato escrito y fondo de retiro sin necesidad de pluriempleo (<strong className="text-slate-800">{tasaFormalidadPct}% formalidad total</strong>).
            </p>

            <div className="w-full h-5 rounded-xl overflow-hidden flex bg-slate-100 mb-3 p-0.5 gap-0.5">
              <div style={{ width: `${tasaEmpleoCalidadPct}%` }} className="h-full bg-blue-600 rounded-l-lg transition-all duration-500" />
              <div style={{ width: `${tasaFormalBasicoPct}%` }} className="h-full bg-sky-400 transition-all duration-500" />
              <div style={{ width: `${tasaInformalidadPct}%` }} className="h-full bg-slate-400 rounded-r-lg transition-all duration-500" />
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                  Empleo Calidad OIT
                </div>
                <p className="text-lg font-black text-blue-600 mt-0.5">{tasaEmpleoCalidadPct}%</p>
                <p className="text-[11px] text-slate-400">{countCalidad.toLocaleString('es-MX')} ocupados</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
                  Formal Básico
                </div>
                <p className="text-lg font-black text-slate-900 mt-0.5">{tasaFormalBasicoPct}%</p>
                <p className="text-[11px] text-slate-400">{countFormalBasico.toLocaleString('es-MX')} ocupados</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                  Sector Informal
                </div>
                <p className="text-lg font-black text-slate-900 mt-0.5">{tasaInformalidadPct}%</p>
                <p className="text-[11px] text-slate-400">{countInformal.toLocaleString('es-MX')} ocupados</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-blue-600" />
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
                    className={`rounded-xl border flex flex-col justify-between transition-all ${spanClass} ${item.estilo.bg}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${item.estilo.sub}`}>
                        #{i + 1} Sector
                      </span>
                      <span className={`text-[10px] font-semibold ${item.estilo.sub}`}>
                        {conteoPersonasSector.toLocaleString('es-MX')} prof.
                      </span>
                    </div>

                    <div>
                      <p className="text-xl font-black leading-none mb-1">
                        {item.value.toFixed(1)}%
                      </p>
                      <p className="text-[11px] sm:text-xs font-bold leading-snug">
                        {item.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* PISO 4: ESCALERA DE PRESTACIONES (50%) + EJE DIVERGENTE DE FRICCIONES Y MODALIDAD (50%) */}
      <div className="print-avoid-break grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-blue-600" />
              Escalera de Prestaciones vs. Media Contextual Dinámica
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Cobertura en esta carrera (<strong className="text-blue-600">barra azul</strong>) frente a la <strong>marca negra vertical</strong> calculada en vivo sobre las licenciaturas de {REGIONES_INFO[regionActiva]?.corto}.
            </p>

            <div className="space-y-5">
              {listaPrestaciones.map((item, idx) => {
                const diff = Number((item.valor - item.mediaCtx).toFixed(1));
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-800">{item.nombre}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          diff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {diff >= 0 ? `+${diff}% vs. Media` : `${diff}% vs. Media`}
                        </span>
                        <span className="text-sm font-black text-slate-900 w-12 text-right">
                          {item.valor.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 h-3 rounded-full relative overflow-visible">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, item.valor))}%` }}
                      />
                      <div
                        title={`Media Universitaria Dinámica (${REGIONES_INFO[regionActiva]?.corto}): ${item.mediaCtx}%`}
                        className="absolute -top-1 -bottom-1 w-1 bg-slate-950 rounded-full z-10"
                        style={{ left: `${Math.max(0, Math.min(99, item.mediaCtx))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-slate-600">
              <span className="inline-block w-1.5 h-3 bg-slate-950 rounded-full" />
              Marca negra = Promedio Dinámico Licenciatura ({REGIONES_INFO[regionActiva]?.corto})
            </span>
            <span>Fuente: Microdatos ENOE INEGI</span>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-blue-600" />
                  Barreras de Entrada y Fricción Laboral
                </h3>
                <p className="text-xs text-slate-500">
                  En las 5 métricas, ubicarse a la <strong className="text-emerald-700">izquierda de la línea negra central</strong> indica menor barrera o menor fricción que el promedio regional.
                </p>
              </div>

              <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${social.cuadrante.badge}`}>
                {social.cuadrante.nombre} ({social.scoreMovilidad}% Mérito)
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
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-blue-600" /> Trabajo Remoto
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      diffHomeOffice >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200/70 text-slate-600'
                    }`}>
                      {diffHomeOffice >= 0 ? `+${diffHomeOffice}%` : `${diffHomeOffice}%`} vs. Media
                    </span>
                    <span className="text-sm font-black text-slate-900">{pHomeOffice.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-200/80 h-2 rounded-full relative overflow-visible my-1.5">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${Math.min(100, (pHomeOffice / 20) * 100)}%` }}
                  />
                  <div
                    title={`Media Contextual Dinámica: ${benchContextual.pct_home_office}%`}
                    className="absolute -top-0.5 -bottom-0.5 w-1 bg-slate-950 rounded-full z-10"
                    style={{ left: `${Math.min(98, (benchContextual.pct_home_office / 20) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0%</span>
                  <span>Marca negra (Media): {benchContextual.pct_home_office}%</span>
                  <span>20%+</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" /> Medio Tiempo {'(<30h)'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                      {diffMedioTiempo >= 0 ? `+${diffMedioTiempo}%` : `${diffMedioTiempo}%`} vs. Media
                    </span>
                    <span className="text-sm font-black text-slate-900">{pMedioTiempo.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-200/80 h-2 rounded-full relative overflow-visible my-1.5">
                  <div
                    className="h-full rounded-full bg-slate-600"
                    style={{ width: `${Math.min(100, (pMedioTiempo / 46) * 100)}%` }}
                  />
                  <div
                    title={`Media Contextual Dinámica: ${benchContextual.pct_medio_tiempo}%`}
                    className="absolute -top-0.5 -bottom-0.5 w-1 bg-slate-950 rounded-full z-10"
                    style={{ left: `${Math.min(98, (benchContextual.pct_medio_tiempo / 46) * 100)}%` }}
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
    <main className="min-h-screen bg-slate-50 font-sans p-4 md:p-8">
      <Suspense
        fallback={
          <div className="min-h-screen flex flex-col items-center justify-center p-6">
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