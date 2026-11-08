"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { descargarComparativaVersusPDF } from '@/lib/pdfReportGenerator';
import {
  descargarLibroExcelXLSX,
  descargarCSVEstilizado,
  ValorCeldaExcel,
  EstiloCeldaExcel
} from '@/lib/excelReportGenerator';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import {
  Home, ShieldAlert, Scale, ChevronRight, ChevronLeft, Trophy,
  ShieldCheck, Sparkles, Building, CheckCircle2,
  Briefcase, Medal, Banknote, AlertCircle,
  TrendingUp, TrendingDown, Minus, Activity,
  ArrowUpDown, ChevronDown, ChevronUp, AlertTriangle,
  MapPin, Users, Landmark, RotateCcw, Info, Anchor,
  SlidersHorizontal, Wand2, X, Check, BarChart3, Compass,
  Share2, Download, Printer, FlaskConical, FileSpreadsheet
} from 'lucide-react';

type CriterioOrden = 'afinidad_desc' | 'afinidad_asc' | 'salario_desc' | 'salario_asc';
type CodigoGenero = 0 | 1 | 2; // 0 = Total, 1 = Hombres, 2 = Mujeres
type ModoVistaFiltros = 'wizard' | 'colapsado' | 'expandido';

const MAX_PRIORIDADES = 5;
const MAX_COMPARAR = 3;
const STORAGE_KEY_DESCUBRIDOR = 'dataroi_descubridor_state_v1';

const TABLA_PESOS_EXACTOS: Record<number, number[]> = {
  1: [100],
  2: [60, 40],
  3: [50, 30, 20],
  4: [42, 26, 18, 14],
  5: [36, 24, 18, 12, 10]
};

const COLORES_VERSUS = [
  { hex: '#2563EB', bg: 'bg-blue-600', text: 'text-blue-700', light: 'bg-blue-50/70 border-blue-200' },
  { hex: '#9333EA', bg: 'bg-purple-600', text: 'text-purple-700', light: 'bg-purple-50/70 border-purple-200' },
  { hex: '#EA580C', bg: 'bg-orange-600', text: 'text-orange-800', light: 'bg-orange-50/70 border-orange-200' }
];

const BENCHMARK_REGIONES_BASE: Record<string, {
  nombre: string;
  corto: string;
  estados: string;
  colorHex: string;
  badgeActivo: string;
  sueldo_prepa: Record<CodigoGenero, number>;
  sueldo_lic: number;
  formalidad_prepa: number;
  formalidad_lic: number;
  estrato_medio: number;
  nepotismo_medio: number;
}> = {
  nacional: {
    nombre: 'Nacional (Todo México)',
    corto: 'Todo México',
    estados: 'Promedio de las 32 entidades federativas',
    colorHex: '#2563EB',
    badgeActivo: 'bg-blue-600 text-white border-blue-600',
    sueldo_prepa: { 0: 10608, 1: 11832, 2: 8762 },
    sueldo_lic: 15534,
    formalidad_prepa: 50.1,
    formalidad_lic: 70.3,
    estrato_medio: 2.80,
    nepotismo_medio: 37.2
  },
  norte: {
    nombre: 'Norte / Frontera Industrial',
    corto: 'Norte',
    estados: 'Baja California, Sonora, Chihuahua, Coahuila, Nuevo León, Tamaulipas',
    colorHex: '#4F46E5',
    badgeActivo: 'bg-indigo-600 text-white border-indigo-600',
    sueldo_prepa: { 0: 12816, 1: 14113, 2: 10775 },
    sueldo_lic: 17917,
    formalidad_prepa: 66.3,
    formalidad_lic: 78.2,
    estrato_medio: 3.08,
    nepotismo_medio: 37.6
  },
  noroeste: {
    nombre: 'Noroeste / Corredor Pacífico',
    corto: 'Noroeste',
    estados: 'Baja California Sur, Sinaloa, Durango, Nayarit',
    colorHex: '#0891B2',
    badgeActivo: 'bg-cyan-600 text-white border-cyan-600',
    sueldo_prepa: { 0: 11858, 1: 13365, 2: 9748 },
    sueldo_lic: 15495,
    formalidad_prepa: 54.0,
    formalidad_lic: 71.4,
    estrato_medio: 2.83,
    nepotismo_medio: 43.3
  },
  bajio: {
    nombre: 'Occidente - Bajío',
    corto: 'Bajío-Occ.',
    estados: 'Jalisco, Guanajuato, Querétaro, Aguascalientes, SLP, Michoacán, Colima, Zacatecas',
    colorHex: '#D97706',
    badgeActivo: 'bg-amber-600 text-white border-amber-600',
    sueldo_prepa: { 0: 10478, 1: 11731, 2: 8707 },
    sueldo_lic: 14742,
    formalidad_prepa: 53.2,
    formalidad_lic: 72.3,
    estrato_medio: 2.93,
    nepotismo_medio: 38.8
  },
  centro: {
    nombre: 'Centro / Valle de México',
    corto: 'Centro',
    estados: 'CDMX, Estado de México, Puebla, Hidalgo, Morelos, Tlaxcala',
    colorHex: '#7C3AED',
    badgeActivo: 'bg-purple-600 text-white border-purple-600',
    sueldo_prepa: { 0: 9889, 1: 11119, 2: 8069 },
    sueldo_lic: 16000,
    formalidad_prepa: 45.3,
    formalidad_lic: 68.3,
    estrato_medio: 2.73,
    nepotismo_medio: 33.5
  },
  sur: {
    nombre: 'Sur - Sureste / Golfo',
    corto: 'Sur-Sureste',
    estados: 'Veracruz, Tabasco, Campeche, Yucatán, Quintana Roo, Chiapas, Oaxaca, Guerrero',
    colorHex: '#059669',
    badgeActivo: 'bg-emerald-600 text-white border-emerald-600',
    sueldo_prepa: { 0: 9150, 1: 10195, 2: 7469 },
    sueldo_lic: 13023,
    formalidad_prepa: 37.9,
    formalidad_lic: 61.9,
    estrato_medio: 2.31,
    nepotismo_medio: 38.6
  }
};

const ESTILOS_GENERO: Record<CodigoGenero, {
  activoBtn: string;
  activoCard: string;
  iconoActivo: string;
  badgeActivo: string;
}> = {
  0: {
    activoBtn: 'bg-slate-900 text-white shadow-xs',
    activoCard: 'border-slate-800 bg-slate-50/80 ring-2 ring-slate-900/10',
    iconoActivo: 'text-slate-900',
    badgeActivo: 'bg-slate-900 text-white'
  },
  2: {
    activoBtn: 'bg-violet-600 text-white shadow-xs',
    activoCard: 'border-violet-600 bg-violet-50/45 ring-2 ring-violet-600/15',
    iconoActivo: 'text-violet-600',
    badgeActivo: 'bg-violet-600 text-white'
  },
  1: {
    activoBtn: 'bg-blue-600 text-white shadow-xs',
    activoCard: 'border-blue-600 bg-blue-50/45 ring-2 ring-blue-600/15',
    iconoActivo: 'text-blue-600',
    badgeActivo: 'bg-blue-600 text-white'
  }
};

const PATHS_CARTOGRAFICOS_MEXICO: Record<string, string> = {
  norte: "M 44.1,22.1 L 66.5,20.0 L 64.8,23.8 L 91.5,33.1 L 131.8,46.7 L 166.9,46.5 L 180.9,46.5 L 180.9,38.6 L 211.5,38.6 L 217.9,45.4 L 226.9,51.5 L 237.4,60.0 L 243.3,70.0 L 247.7,80.6 L 256.8,86.4 L 271.4,92.2 L 282.6,77.0 L 297.0,76.6 L 309.4,84.3 L 318.3,97.5 L 324.4,108.8 L 334.8,119.7 L 338.7,133.2 L 343.6,142.3 L 357.4,148.2 L 369.9,152.5 L 376.8,151.9 L 370.0,168.8 L 366.9,182.6 L 365.6,208.4 L 363.9,217.8 L 365.2,222.2 L 344.0,218.7 L 317.5,203.3 L 305.2,180.2 L 266.3,172.5 L 255.7,135.9 L 216.9,157.1 L 176.3,130.1 L 162.0,142.2 L 162.3,140.8 L 153.3,136.4 L 142.9,127.0 L 138.5,113.6 L 129.0,112.0 L 118.8,101.9 L 110.5,92.5 L 109.7,86.5 L 100.2,72.0 L 94.0,57.2 L 94.2,49.8 L 81.5,42.2 L 75.6,43.0 L 65.5,37.7 L 62.7,45.6 L 65.6,54.8 L 67.3,69.2 L 73.4,77.2 L 86.5,90.4 L 89.4,95.0 L 92.1,96.3 L 94.4,103.0 L 97.5,102.7 L 99.9,110.9 L 73.7,110.9 L 75.7,108.7 L 76.4,100.0 L 62.8,86.2 L 52.4,80.9 L 45.9,68.9 L 39.3,56.3 L 31.2,40.9 L 24.0,23.6 L 44.1,22.1 Z",
  noroeste: "M 225.2,256.5 L 231.1,254.6 L 229.2,249.1 L 233.3,244.2 L 233.4,237.5 L 227.4,228.9 L 225.8,221.2 L 219.9,211.5 L 204.4,192.3 L 186.6,177.3 L 178.0,165.3 L 162.9,157.4 L 159.6,152.7 L 162.0,142.2 L 176.3,130.1 L 216.9,157.1 L 255.7,135.9 L 266.3,172.5 L 276.9,184.0 L 259.3,197.5 L 254.0,218.7 L 255.7,245.6 L 227.5,257.2 L 225.5,257.2 L 225.2,256.5 Z M 101.1,115.1 L 106.4,120.0 L 110.2,126.8 L 121.3,136.6 L 127.1,154.5 L 132.4,163.0 L 137.3,172.0 L 138.3,182.1 L 146.8,182.8 L 153.8,191.5 L 160.3,200.1 L 159.8,203.6 L 152.4,210.6 L 149.3,210.5 L 144.6,198.8 L 133.1,187.9 L 120.3,178.5 L 111.3,173.7 L 111.9,159.6 L 109.2,149.1 L 100.8,143.2 L 88.7,134.6 L 86.3,137.1 L 81.9,132.0 L 71.0,127.4 L 60.6,116.2 L 61.9,114.8 L 69.1,115.9 L 73.7,110.9 L 99.9,110.9 L 101.1,115.1 Z",
  bajio: "M 282.6,303.8 L 264.5,297.7 L 257.2,289.0 L 238.2,278.0 L 229.4,265.9 L 225.5,257.2 L 227.5,257.2 L 255.7,245.6 L 254.0,218.7 L 259.3,197.5 L 276.9,184.0 L 266.3,172.5 L 305.2,180.2 L 317.5,203.3 L 344.0,218.7 L 356.3,226.4 L 356.3,239.8 L 333.4,243.7 L 324.6,261.0 L 319.3,278.3 L 317.5,295.7 L 289.5,304.6 L 282.6,303.8 Z",
  centro: "M 356.3,239.8 L 366.9,255.2 L 377.5,272.6 L 379.3,299.5 L 361.6,305.3 L 351.1,303.4 L 336.9,295.7 L 317.5,295.7 L 319.3,278.3 L 324.6,261.0 L 333.4,243.7 L 356.3,239.8 Z",
  sur: "M 367.0,228.3 L 372.4,237.7 L 376.0,252.6 L 387.7,267.0 L 391.8,278.0 L 398.7,287.4 L 417.4,292.5 L 424.7,300.6 L 440.2,295.2 L 453.7,293.3 L 466.9,289.8 L 478.0,286.5 L 489.2,278.7 L 493.4,267.4 L 494.9,251.3 L 497.9,245.6 L 509.9,240.6 L 528.6,236.1 L 544.2,236.8 L 554.9,235.2 L 559.1,239.2 L 558.5,248.5 L 549.1,260.0 L 544.9,271.7 L 548.1,275.0 L 545.5,283.4 L 541.0,298.4 L 536.6,293.4 L 532.9,293.7 L 529.5,294.0 L 523.2,305.6 L 520.0,303.3 L 517.8,304.2 L 518.0,307.1 L 501.7,306.9 L 485.2,306.9 L 485.2,317.7 L 477.2,317.8 L 483.8,324.2 L 490.3,328.6 L 492.3,332.8 L 495.1,334.0 L 494.7,340.5 L 472.0,340.6 L 463.5,356.3 L 466.0,359.9 L 464.0,364.4 L 463.5,370.0 L 443.6,349.3 L 434.5,343.0 L 420.0,338.0 L 410.2,339.4 L 396.0,346.6 L 387.1,348.5 L 374.6,343.5 L 361.4,339.8 L 344.9,331.0 L 331.7,328.3 L 311.7,319.3 L 296.9,310.1 L 292.5,305.0 L 289.5,304.6 L 317.5,295.7 L 336.9,295.7 L 351.1,303.4 L 361.6,305.3 L 379.3,299.5 L 377.5,272.6 L 366.9,255.2 L 356.3,239.8 L 356.3,226.4 L 344.0,218.7 L 365.2,222.2 L 367.0,228.3 Z"
};

const ETIQUETAS_MAPA: { id: string; label: string; x: number; y: number; w: number }[] = [
  { id: 'norte', label: 'NORTE', x: 238, y: 107, w: 58 },
  { id: 'noroeste', label: 'NOROESTE', x: 222, y: 185, w: 76 },
  { id: 'bajio', label: 'BAJÍO-OCC.', x: 294, y: 242, w: 78 },
  { id: 'centro', label: 'CENTRO', x: 350, y: 277, w: 62 },
  { id: 'sur', label: 'SUR-SURESTE', x: 432, y: 318, w: 92 }
];

function obtenerEstiloJerarquiaPrioridad(orden?: number) {
  if (!orden) {
    return {
      btn: 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70',
      icono: 'bg-slate-100 text-slate-500',
      badge: ''
    };
  }
  if (orden === 1) {
    return {
      btn: 'border-blue-600 bg-blue-50/55 ring-2 ring-blue-600/15 shadow-2xs',
      icono: 'bg-blue-600 text-white',
      badge: 'bg-blue-600 text-white'
    };
  }
  if (orden === 2) {
    return {
      btn: 'border-indigo-600 bg-indigo-50/45 ring-1 ring-indigo-600/15',
      icono: 'bg-indigo-600 text-white',
      badge: 'bg-indigo-600 text-white'
    };
  }
  if (orden === 3) {
    return {
      btn: 'border-teal-600 bg-teal-50/45 ring-1 ring-teal-600/15',
      icono: 'bg-teal-600 text-white',
      badge: 'bg-teal-600 text-white'
    };
  }
  if (orden === 4) {
    return {
      btn: 'border-sky-600 bg-sky-50/45',
      icono: 'bg-sky-600 text-white',
      badge: 'bg-sky-700 text-white'
    };
  }
  return {
    btn: 'border-slate-600 bg-slate-100/75',
    icono: 'bg-slate-800 text-white',
    badge: 'bg-slate-800 text-white'
  };
}

const PREFERENCIAS = [
  { id: 'empleabilidad', label: 'Alta Empleabilidad', corto: 'Empleabilidad', icon: <Briefcase className="w-4 h-4" />, desc: 'Bajo desempleo abierto y baja saturación de egresados ANUIES.' },
  { id: 'formalidad', label: 'Empleo de Calidad (OIT)', corto: 'Calidad OIT', icon: <ShieldCheck className="w-4 h-4" />, desc: 'Salir de la informalidad: contrato escrito y fondo de retiro AFORE.' },
  { id: 'corporativo', label: 'Mundo Corporativo', corto: 'Corporativo', icon: <Building className="w-4 h-4" />, desc: 'Alta inserción en grandes empresas y corporativos transnacionales.' },
  { id: 'emprendimiento', label: 'Independencia y PYME', corto: 'Independiente', icon: <Sparkles className="w-4 h-4" />, desc: 'Ideal para consultorio propio, despacho, agencia o autoempleo.' },
  { id: 'remoto', label: 'Trabajo Remoto', corto: 'Home Office', icon: <Home className="w-4 h-4" />, desc: 'Alta tasa comprobada de teletrabajo profesional y digital.' },
  { id: 'movilidad', label: 'Movilidad Social', corto: 'Meritocracia', icon: <Scale className="w-4 h-4" />, desc: 'Contratación sin nepotismo, apertura socioeconómica y salto salarial.' },
  { id: 'equidad', label: 'Equidad Laboral', corto: 'Equidad', icon: <CheckCircle2 className="w-4 h-4" />, desc: 'Paridad salarial de género y cobertura de licencia parental.' },
  { id: 'ia', label: 'Blindaje ante IA', corto: 'Blindaje IA', icon: <ShieldAlert className="w-4 h-4" />, desc: 'Baja exposición al reemplazo por Inteligencia Artificial.' },
  { id: 'balance', label: 'Estabilidad y Arraigo', corto: 'Estabilidad', icon: <Anchor className="w-4 h-4" />, desc: 'Ejercer en tu estado sin migrar y vivir de un solo empleo estable.' },
  { id: 'publico', label: 'Sector Público y Gremial', corto: 'Sector Público', icon: <Landmark className="w-4 h-4" />, desc: 'Plazas en gobierno, educación/salud pública y respaldo sindical.' }
];

const IDS_PREFERENCIAS_VALIDAS = new Set(PREFERENCIAS.map(p => p.id));

const formatoMoneda = (valor: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor || 0);

const num = (val: any, fallback: number) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

function obtenerCapExCorto(cve: string) {
  const pref3 = cve.slice(0, 3);
  const pref4 = cve.slice(0, 4);
  if (
    pref4 === '0911' || pref4 === '0931' || pref3 === '073' || pref3 === '021' ||
    pref4 === '0821' || pref4 === '1014' || pref4 === '1013' || pref4 === '1015'
  ) {
    return { nivel: 3, costoEquipo: 85000, etiqueta: 'Equipo Alto ($85k)', corto: 'Equipo Alto', clase: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  if (
    pref3 === '061' || pref3 === '062' || pref3 === '071' || pref3 === '072' ||
    pref3 === '051' || pref3 === '052' || pref3 === '053' || pref3 === '081' ||
    pref3 === '091' || pref3 === '092' || pref3 === '094' || pref3 === '095'
  ) {
    return { nivel: 2, costoEquipo: 42000, etiqueta: 'Equipo Medio ($42k)', corto: 'Equipo Medio', clase: 'bg-amber-50 text-amber-800 border-amber-200' };
  }
  return { nivel: 1, costoEquipo: 18000, etiqueta: 'Equipo Básico ($18k)', corto: 'Equipo Básico', clase: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function calcularAniosRetornoRapido(sueldoCarrera: number, sueldoPrepa: number, cve: string, esPrivada: boolean) {
  const capex = obtenerCapExCorto(cve);
  const inversionTotal = (esPrivada ? 340000 : 32000) + capex.costoEquipo;
  const bonoAnual = (sueldoCarrera - sueldoPrepa) * 12;
  if (bonoAnual <= 0) return null;
  return Number((inversionTotal / bonoAnual).toFixed(1));
}

function obtenerSectorDominante(p: any) {
  const sectores = [
    { label: 'PYME', val: num(p?.pct_pyme, 0) },
    { label: 'Independiente / Micro', val: num(p?.pct_micro, 0) },
    { label: 'Gran Corporativo', val: num(p?.pct_corp, 0) },
    { label: 'Gobierno', val: num(p?.pct_gobierno, 0) }
  ].sort((a, b) => b.val - a.val);
  return `${sectores[0].val.toFixed(1)}% ${sectores[0].label}`;
}

function BadgeTendencia({ codigo, etiqueta }: { codigo?: string; etiqueta?: string }) {
  if (codigo === 'crecimiento') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <TrendingUp className="w-3.5 h-3.5" /> {etiqueta || 'En crecimiento'}
      </span>
    );
  }
  if (codigo === 'ajuste') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <TrendingDown className="w-3.5 h-3.5" /> {etiqueta || 'En ajuste'}
      </span>
    );
  }
  if (codigo === 'volatil') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <Activity className="w-3.5 h-3.5" /> {etiqueta || 'Volátil'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
      <Minus className="w-3.5 h-3.5" /> {etiqueta || 'Estable'}
    </span>
  );
}

function MapaMexicoMacroRegiones({
  regionActiva,
  regionHover,
  onSelectRegion,
  onHoverRegion
}: {
  regionActiva: string;
  regionHover: string | null;
  onSelectRegion: (r: string) => void;
  onHoverRegion: (r: string | null) => void;
}) {
  const obtenerEstiloPoligono = (idReg: string) => {
    const info = BENCHMARK_REGIONES_BASE[idReg];
    const esNacional = regionActiva === 'nacional';
    const esActiva = regionActiva === idReg;
    const esHover = regionHover === idReg;

    if (esActiva) {
      return {
        fill: info.colorHex,
        stroke: '#FFFFFF',
        strokeWidth: 2.3,
        opacity: 1
      };
    }
    if (esHover) {
      return {
        fill: info.colorHex,
        stroke: '#FFFFFF',
        strokeWidth: 2.1,
        opacity: 0.92
      };
    }
    if (esNacional) {
      return {
        fill: '#CBD5E1',
        stroke: '#FFFFFF',
        strokeWidth: 1.6,
        opacity: 0.85
      };
    }
    return {
      fill: '#E2E8F0',
      stroke: '#FFFFFF',
      strokeWidth: 1.5,
      opacity: 0.75
    };
  };

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox="15 10 560 368"
        className="w-full h-auto drop-shadow-xs"
        onMouseLeave={() => onHoverRegion(null)}
      >
        {(['norte', 'noroeste', 'bajio', 'centro', 'sur'] as const).map((idReg) => (
          <path
            key={idReg}
            d={PATHS_CARTOGRAFICOS_MEXICO[idReg]}
            style={obtenerEstiloPoligono(idReg)}
            className="cursor-pointer transition-all duration-200"
            onClick={() => onSelectRegion(idReg)}
            onMouseEnter={() => onHoverRegion(idReg)}
          />
        ))}

        {ETIQUETAS_MAPA.map((et) => {
          const activa = regionActiva === et.id || regionHover === et.id;
          return (
            <g
              key={et.id}
              className="pointer-events-none"
              transform={`translate(${et.x}, ${et.y})`}
            >
              <rect
                x={-et.w / 2}
                y={-10}
                width={et.w}
                height={20}
                rx={6}
                fill={activa ? '#0F172A' : '#FFFFFF'}
                fillOpacity={activa ? 0.96 : 0.92}
                stroke={activa ? '#FFFFFF' : '#94A3B8'}
                strokeWidth={1}
              />
              <text
                x={0}
                y={3.5}
                textAnchor="middle"
                className={`font-black text-[10px] tracking-wider ${
                  activa ? 'fill-white' : 'fill-slate-700'
                }`}
              >
                {et.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function DescubridorClient({ datos }: { datos: any[] }) {
  const [regionActiva, setRegionActiva] = useState<string>('nacional');
  const [regionHover, setRegionHover] = useState<string | null>(null);
  const [generoActivo, setGeneroActivo] = useState<CodigoGenero>(0);

  const [activos, setActivos] = useState<string[]>([]);
  const [orden, setOrden] = useState<CriterioOrden>('afinidad_desc');
  const [mostrarTodas, setMostrarTodas] = useState(false);

  const [modoVistaFiltros, setModoVistaFiltros] = useState<ModoVistaFiltros>('wizard');
  const [pasoWizard, setPasoWizard] = useState<number>(1);
  const [hidratado, setHidratado] = useState<boolean>(false);

  const [carrerasCompararCves, setCarrerasCompararCves] = useState<string[]>([]);
  const [modalVersusAbierto, setModalVersusAbierto] = useState<boolean>(false);
  const [vistaGraficoVersus, setVistaGraficoVersus] = useState<'radar' | 'regiones'>('radar');
  const [copiadoRanking, setCopiadoRanking] = useState<boolean>(false);
  const [copiadoVersus, setCopiadoVersus] = useState<boolean>(false);

  // Cálculo 100% Dinámico de Benchmarks Regionales desde el arreglo `datos`
  const benchmarksDinamicosPorRegion = useMemo(() => {
    const mapa: Record<string, typeof BENCHMARK_REGIONES_BASE['nacional']> = {};

    Object.entries(BENCHMARK_REGIONES_BASE).forEach(([regKey, metaBase]) => {
      const celdasValidas = datos
        .map(d => d.perfiles?.[regKey]?.[generoActivo])
        .filter(p => p && p.celdaValida !== false && Number(p.sueldo_esperado) > 0);

      if (celdasValidas.length === 0) {
        mapa[regKey] = metaBase;
        return;
      }

      const sumaPesoSueldo = celdasValidas.reduce((acc, p) => acc + Math.max(1, Number(p.volumen_validado || 1)), 0);
      const sumaPesoSat = celdasValidas.reduce((acc, p) => acc + Math.max(1, Number(p.volumen_muestra_nacional || p.volumen_validado || 1)), 0);

      const sueldoLicDin = Math.round(
        celdasValidas.reduce((acc, p) => acc + Number(p.sueldo_esperado) * Math.max(1, Number(p.volumen_validado || 1)), 0) / sumaPesoSueldo
      );

      const formLicDin = Number(
        (
          celdasValidas.reduce((acc, p) => {
            const f = Number(p.pct_contrato || 60) * 0.45 + Number(p.pct_aguinaldo || 60) * 0.30 + Number(p.pct_afore || 50) * 0.25;
            return acc + f * Math.max(1, Number(p.volumen_muestra_nacional || p.volumen_validado || 1));
          }, 0) / sumaPesoSat
        ).toFixed(1)
      );

      const estratoDin = Number(
        (
          celdasValidas.reduce((acc, p) => acc + Number(p.indice_privilegio || 2.8) * Math.max(1, Number(p.volumen_muestra_nacional || p.volumen_validado || 1)), 0) / sumaPesoSat
        ).toFixed(2)
      );

      const nepotismoDin = Number(
        (
          celdasValidas.reduce((acc, p) => acc + Number(p.pct_nepotismo || 37) * Math.max(1, Number(p.volumen_muestra_nacional || p.volumen_validado || 1)), 0) / sumaPesoSat
        ).toFixed(1)
      );

      mapa[regKey] = {
        ...metaBase,
        sueldo_lic: sueldoLicDin > 0 ? sueldoLicDin : metaBase.sueldo_lic,
        formalidad_lic: formLicDin > 0 ? formLicDin : metaBase.formalidad_lic,
        estrato_medio: estratoDin > 0 ? estratoDin : metaBase.estrato_medio,
        nepotismo_medio: nepotismoDin > 0 ? nepotismoDin : metaBase.nepotismo_medio
      };
    });

    return mapa;
  }, [datos, generoActivo]);

  const { minSueldoCatalogo, maxSueldoCatalogo, sueldoSugerido } = useMemo(() => {
    const prepaRef = benchmarksDinamicosPorRegion[regionActiva]?.sueldo_prepa[generoActivo] || 10500;
    const pisoPrepaFloor = Math.floor(prepaRef / 500) * 500;

    const sueldos = datos
      .filter(d => d.perfiles?.[regionActiva]?.[generoActivo]?.celdaValida !== false)
      .map(d => Number(d.perfiles?.[regionActiva]?.[generoActivo]?.sueldo_esperado || 0))
      .filter(s => s > 0);

    if (sueldos.length === 0) {
      return { minSueldoCatalogo: pisoPrepaFloor, maxSueldoCatalogo: 21000, sueldoSugerido: pisoPrepaFloor + 500 };
    }

    const minReal = Math.min(...sueldos);
    const maxReal = Math.max(...sueldos);
    const minFloor = Math.min(pisoPrepaFloor, Math.floor(minReal / 500) * 500);
    const maxFloor = Math.floor(maxReal / 500) * 500;
    const sugerido = Math.max(minFloor, Math.min(maxFloor - 1500, Math.ceil(prepaRef / 500) * 500));

    return {
      minSueldoCatalogo: minFloor,
      maxSueldoCatalogo: maxFloor > minFloor ? maxFloor : minFloor + 1000,
      sueldoSugerido: sugerido
    };
  }, [datos, regionActiva, generoActivo, benchmarksDinamicosPorRegion]);

  const [sueldoMinimo, setSueldoMinimo] = useState<number>(11500);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const regUrl = params.get('region');
      const genUrl = params.get('genero');
      const sueldoUrl = params.get('sueldo');
      const prioUrl = params.get('prio');
      const compUrl = params.get('comparar');

      const tieneParamsUrl = Boolean(regUrl || genUrl || sueldoUrl || prioUrl || compUrl);

      if (tieneParamsUrl) {
        let regInicial = 'nacional';
        if (regUrl && BENCHMARK_REGIONES_BASE[regUrl]) {
          regInicial = regUrl;
          setRegionActiva(regUrl);
        }

        let genInicial: CodigoGenero = 0;
        if (genUrl === 'mujeres' || genUrl === '2') genInicial = 2;
        else if (genUrl === 'hombres' || genUrl === '1') genInicial = 1;
        setGeneroActivo(genInicial);

        if (sueldoUrl && Number(sueldoUrl) >= 7000) {
          setSueldoMinimo(Number(sueldoUrl));
        } else {
          const prepaRef = BENCHMARK_REGIONES_BASE[regInicial]?.sueldo_prepa[genInicial] || 10500;
          setSueldoMinimo(Math.ceil(prepaRef / 500) * 500);
        }

        if (prioUrl) {
          const listaPrio = prioUrl
            .split(',')
            .map(s => s.trim())
            .filter(id => IDS_PREFERENCIAS_VALIDAS.has(id))
            .slice(0, MAX_PRIORIDADES);
          if (listaPrio.length > 0) {
            setActivos(listaPrio);
            setModoVistaFiltros('colapsado');
          }
        }

        if (compUrl) {
          const cvesDisponibles = new Set(datos.map(d => String(d.cve_carrera).padStart(6, '0')));
          const listaComp = compUrl
            .split(',')
            .map(s => s.trim().padStart(6, '0'))
            .filter(cve => cvesDisponibles.has(cve))
            .slice(0, MAX_COMPARAR);

          if (listaComp.length > 0) {
            setCarrerasCompararCves(listaComp);
            if (!prioUrl) {
              setActivos(['empleabilidad', 'formalidad', 'ia']);
            }
            setModoVistaFiltros('colapsado');
            if (listaComp.length >= 2) {
              setModalVersusAbierto(true);
            }
          }
        }
      } else {
        const guardado = sessionStorage.getItem(STORAGE_KEY_DESCUBRIDOR);
        if (guardado) {
          const parsed = JSON.parse(guardado);
          if (parsed.regionActiva && BENCHMARK_REGIONES_BASE[parsed.regionActiva]) {
            setRegionActiva(parsed.regionActiva);
          }
          if (parsed.generoActivo === 0 || parsed.generoActivo === 1 || parsed.generoActivo === 2) {
            setGeneroActivo(parsed.generoActivo);
          }
          if (typeof parsed.sueldoMinimo === 'number' && parsed.sueldoMinimo >= 7000) {
            setSueldoMinimo(parsed.sueldoMinimo);
          }
          if (Array.isArray(parsed.activos) && parsed.activos.length > 0) {
            setActivos(parsed.activos.slice(0, MAX_PRIORIDADES));
            setModoVistaFiltros(parsed.modoVistaFiltros === 'expandido' ? 'expandido' : 'colapsado');
          } else if (parsed.modoVistaFiltros === 'expandido') {
            setModoVistaFiltros('expandido');
          }
        } else {
          setSueldoMinimo(sueldoSugerido);
        }
      }
    } catch {
      setSueldoMinimo(sueldoSugerido);
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY_DESCUBRIDOR,
        JSON.stringify({
          regionActiva,
          generoActivo,
          sueldoMinimo,
          activos,
          modoVistaFiltros
        })
      );

      const url = new URL(window.location.href);
      url.searchParams.set('region', regionActiva);
      url.searchParams.set('genero', generoActivo === 2 ? 'mujeres' : generoActivo === 1 ? 'hombres' : 'total');
      url.searchParams.set('sueldo', String(sueldoMinimo));
      if (activos.length > 0) {
        url.searchParams.set('prio', activos.join(','));
      } else {
        url.searchParams.delete('prio');
      }
      if (carrerasCompararCves.length > 0) {
        url.searchParams.set('comparar', carrerasCompararCves.join(','));
      } else {
        url.searchParams.delete('comparar');
      }
      window.history.replaceState({}, '', url.toString().replace(/%2C/gi, ','));
    } catch {
      // Ignorar errores en modo privado
    }
  }, [hidratado, regionActiva, generoActivo, sueldoMinimo, activos, modoVistaFiltros, carrerasCompararCves]);

  const cambiarRegionConCalibracion = (nuevaReg: string) => {
    setRegionActiva(nuevaReg);
    const prepaRef = BENCHMARK_REGIONES_BASE[nuevaReg]?.sueldo_prepa[generoActivo] || 10500;
    setSueldoMinimo(Math.ceil(prepaRef / 500) * 500);
  };

  const cambiarGeneroConCalibracion = (nuevoGen: CodigoGenero) => {
    setGeneroActivo(nuevoGen);
    const prepaRef = BENCHMARK_REGIONES_BASE[regionActiva]?.sueldo_prepa[nuevoGen] || 10500;
    setSueldoMinimo(Math.ceil(prepaRef / 500) * 500);
  };

  useEffect(() => {
    setMostrarTodas(false);
  }, [activos, sueldoMinimo, orden, regionActiva, generoActivo]);

  const togglePreferencia = (id: string) => {
    setActivos(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= MAX_PRIORIDADES) return prev;
      return [...prev, id];
    });
  };

  const toggleCarreraComparar = (e: React.MouseEvent, cve: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCarrerasCompararCves(prev => {
      if (prev.includes(cve)) return prev.filter(c => c !== cve);
      if (prev.length >= MAX_COMPARAR) return prev;
      return [...prev, cve];
    });
  };

  const pesosPrioridad = useMemo(() => {
    const k = activos.length;
    if (k === 0) return {};
    const listaPct = TABLA_PESOS_EXACTOS[k] || TABLA_PESOS_EXACTOS[5];
    const mapa: Record<string, { orden: number; pesoNorm: number; pesoPct: number }> = {};
    activos.forEach((id, idx) => {
      const pct = listaPct[idx] ?? Math.round(100 / k);
      mapa[id] = {
        orden: idx + 1,
        pesoNorm: pct / 100,
        pesoPct: pct
      };
    });
    return mapa;
  }, [activos]);

  const alertaConflictoEcosistema = useMemo(() => {
    const tieneCorp = activos.includes('corporativo');
    const tieneIndep = activos.includes('emprendimiento');
    const tienePub = activos.includes('publico');
    return (tieneCorp && tieneIndep) || (tieneCorp && tienePub) || (tieneIndep && tienePub);
  }, [activos]);

  const { rankingVisible, rankingCompleto, listaOrdenadaCompleta, totalFiltradas, totalEnRegion } = useMemo(() => {
    const infoReg = benchmarksDinamicosPorRegion[regionActiva] || BENCHMARK_REGIONES_BASE.nacional;
    const sueldoPrepaBase = infoReg.sueldo_prepa[generoActivo] || infoReg.sueldo_prepa[0];
    const mediaEstratoReg = infoReg.estrato_medio || 2.80;
    const mediaNepotismoReg = infoReg.nepotismo_medio || 37.2;

    const carrerasValidasEnCelda = datos.filter(
      c => c.perfiles?.[regionActiva]?.[generoActivo]?.celdaValida !== false &&
           Number(c.perfiles?.[regionActiva]?.[generoActivo]?.sueldo_esperado || 0) > 0
    );

    const listaConPerfil = carrerasValidasEnCelda.map(carrera => {
      const p = carrera.perfiles?.[regionActiva]?.[generoActivo] || {};

      const desempleo = num(p.tasa_desempleo, 3.8);
      const ocupacionScore = Math.max(0, 100 - desempleo * 11);
      const satRaw = num(p.indice_saturacion_pct, 100);
      const saturacion = satRaw > 5 ? satRaw : num(carrera.perfiles?.nacional?.[0]?.indice_saturacion_pct, 100);
      const saturacionScore = Math.max(0, Math.min(100, 145 - saturacion));
      const rawEmpleabilidad = ocupacionScore * 0.55 + saturacionScore * 0.45;

      const pContrato = num(p.pct_contrato, 55);
      const pAfore = num(p.pct_afore, 45);
      const pAguinaldo = num(p.pct_aguinaldo, 60);
      const pSgmm = num(p.pct_sgmm, 7);
      const pPluri = num(p.pct_pluriempleo, 5.5);
      const pDesarr = num(p.pct_desarraigo, 2.6);
      const pMicro = num(p.pct_micro, 0);
      const pPyme = num(p.pct_pyme, 0);
      const pCorp = num(p.pct_corp, 0);
      const pHomeOffice = num(p.pct_home_office, 0);
      const pMedioTiempo = num(p.pct_medio_tiempo, 15);

      const tasaCalidadOIT = Number((((Math.min(pContrato, pAfore) * 0.70 + pContrato * 0.30) * (1 - pPluri / 200))).toFixed(1));
      const rawFormalidad = tasaCalidadOIT + pSgmm * 0.001;
      const tasaFormalidadTotal = Number((pContrato * 0.45 + pAguinaldo * 0.30 + pAfore * 0.25).toFixed(1));

      const rawCorporativo = pCorp + pSgmm * 0.001;
      const sumaIndepPyme = Number((pMicro + pPyme).toFixed(1));
      const rawEmprendimiento = sumaIndepPyme + pMicro * 0.001;

      const rawRemoto = pHomeOffice;

      const nep = num(p.pct_nepotismo, mediaNepotismoReg);
      const privRaw = num(p.indice_privilegio, mediaEstratoReg);
      const diffEst = privRaw - mediaEstratoReg;
      const penalizacionElitismo = diffEst > 0.05 ? (diffEst - 0.05) * 110 : diffEst * 35;
      const inclusionOrigen = Math.max(15, Math.min(92, 70 - penalizacionElitismo));
      const aperturaContratacion = Math.max(10, Math.min(95, 100 - (nep + num(p.pct_sindicato, 15) * 0.22)));
      const sueldoEsp = num(p.sueldo_esperado, 0);
      const saltoSalarialScore = sueldoPrepaBase > 0
        ? Math.max(0, Math.min(100, ((sueldoEsp - sueldoPrepaBase) / sueldoPrepaBase) * 100))
        : 40;
      const impulsoAscenso = saltoSalarialScore * 0.45 + tasaCalidadOIT * 0.35 + Math.min(100, pCorp * 2.2 + pPyme * 0.6) * 0.20;
      const rawMovilidad = Math.max(12, Math.min(96, aperturaContratacion * 0.40 + impulsoAscenso * 0.35 + inclusionOrigen * 0.25));

      const materno = num(p.pct_materno ?? p.pct_materno_estructural, 23);
      const brechaSal = num(p.brecha_salarial_pct, 12);
      const paridadSalarialPct = Math.max(60, Math.round(100 - brechaSal));
      const rawEquidad = materno * 0.50 + paridadSalarialPct * 0.50;

      const rawIA = Math.max(0, 100 - num(p.riesgo_ia_score, 40));

      const pctEmpleoUnico = Number(Math.max(0, 100 - pPluri).toFixed(1));
      const pctArraigoLocal = Number(Math.max(0, 100 - pDesarr).toFixed(1));
      const rawBalance = Math.max(0, 100 - pPluri * 5.0) * 0.55 + Math.max(0, 100 - pDesarr * 6.5) * 0.45;

      const rawPublico = num(p.pct_gobierno, 0) * 0.65 + num(p.pct_sindicato, 0) * 0.35;

      const premioVsPrepaPct = sueldoPrepaBase > 0 && sueldoEsp > 0
        ? Number((((sueldoEsp - sueldoPrepaBase) / sueldoPrepaBase) * 100).toFixed(1))
        : 0;

      const radarSalario = Math.round(Math.max(15, Math.min(100, ((sueldoEsp - 9500) / (22000 - 9500)) * 100)));
      const radarFormalidad = Math.round(tasaFormalidadTotal);
      const radarEmpleo = Math.round(Math.max(10, Math.min(100, 100 - desempleo * 8.0)) * 0.60 + Math.max(10, Math.min(100, 168 - saturacion)) * 0.40);
      const radarMerito = Math.round(rawMovilidad);
      const radarAutonomia = Math.round(Math.max(15, Math.min(100, Math.min(100, pHomeOffice * 5.0) * 0.40 + Math.min(100, pMicro * 1.5) * 0.35 + Math.min(100, pMedioTiempo * 2.0) * 0.25)));
      const radarEstabilidad = Math.round(
        Math.max(10, Math.min(100, 100 - pPluri * 5.0)) * 0.35 +
        Math.max(10, Math.min(100, 100 - pDesarr * 6.5)) * 0.30 +
        pContrato * 0.35
      );

      return {
        ...carrera,
        perfilActivo: { ...p, indice_saturacion_pct: saturacion },
        sueldo_esperado: sueldoEsp,
        premioVsPrepaPct,
        tasaCalidadOIT,
        tasaFormalidadTotal,
        paridadSalarialPct,
        pctEmpleoUnico,
        pctArraigoLocal,
        pilaresRadar: {
          Salario: radarSalario,
          Formalidad: radarFormalidad,
          Empleabilidad: radarEmpleo,
          Meritocracia: radarMerito,
          Autonomía: radarAutonomia,
          Estabilidad: radarEstabilidad
        },
        crudos: {
          empleabilidad: rawEmpleabilidad,
          formalidad: rawFormalidad,
          corporativo: rawCorporativo,
          emprendimiento: rawEmprendimiento,
          remoto: rawRemoto,
          movilidad: rawMovilidad,
          equidad: rawEquidad,
          ia: rawIA,
          balance: rawBalance,
          publico: rawPublico
        }
      };
    });

    const filtroSueldo = listaConPerfil.filter(c => c.sueldo_esperado >= sueldoMinimo);
    const totalViables = filtroSueldo.length;

    if (activos.length === 0 || totalViables === 0) {
      return {
        rankingVisible: [],
        rankingCompleto: listaConPerfil,
        listaOrdenadaCompleta: [],
        totalFiltradas: totalViables,
        totalEnRegion: listaConPerfil.length
      };
    }

    const dims = ['empleabilidad', 'formalidad', 'corporativo', 'emprendimiento', 'remoto', 'movilidad', 'equidad', 'ia', 'balance', 'publico'] as const;
    const scoresPorDim: Record<string, Record<string, number>> = {};
    const rankPorDim: Record<string, Record<string, number>> = {};

    dims.forEach(dim => {
      scoresPorDim[dim] = {};
      rankPorDim[dim] = {};

      const ordenadosPorRubro = [...filtroSueldo].sort((a, b) => {
        const diff = b.crudos[dim] - a.crudos[dim];
        if (Math.abs(diff) > 0.0001) return diff;
        return b.sueldo_esperado - a.sueldo_esperado;
      });

      const valores = filtroSueldo.map(c => c.crudos[dim]);
      const minV = Math.min(...valores);
      const maxV = Math.max(...valores);
      const rango = maxV > minV ? maxV - minV : 1;

      ordenadosPorRubro.forEach((item, index) => {
        const posRank = index + 1;
        rankPorDim[dim][item.cve_carrera] = posRank;

        const val = item.crudos[dim];
        const minMaxScore = ((val - minV) / rango) * 100;
        const pctRankScore = totalViables > 1 ? ((totalViables - posRank) / (totalViables - 1)) * 100 : 80;

        const hibrido = (minMaxScore * 0.65 + pctRankScore * 0.35) * 0.996;
        scoresPorDim[dim][item.cve_carrera] = Math.max(10, hibrido);
      });
    });

    const calculados = filtroSueldo.map((carrera) => {
      const p = carrera.perfilActivo;
      let matchScoreExacto = 0;
      const desglosePrioridades: {
        idPref: string;
        orden: number;
        label: string;
        datoReal: string;
        datoCorto: string;
        score: number;
        rankRubro: number;
        totalViables: number;
      }[] = [];

      const sinContactosPct = Math.max(10, Math.round(100 - num(p.pct_nepotismo, 37)));

      const datoRealPorDim: Record<string, string> = {
        empleabilidad: `Desempleo ${num(p.tasa_desempleo, 0).toFixed(1)}% · Saturación ${num(p.indice_saturacion_pct, 100)}%`,
        formalidad: `${carrera.tasaCalidadOIT}% con Empleo de Calidad OIT`,
        corporativo: `${num(p.pct_corp, 0).toFixed(1)}% en Grandes Corporativos`,
        emprendimiento: `${(num(p.pct_micro, 0) + num(p.pct_pyme, 0)).toFixed(1)}% en Independiente y PYME`,
        remoto: `${num(p.pct_home_office, 0).toFixed(1)}% en modalidad Home Office`,
        movilidad: `${carrera.crudos.movilidad.toFixed(1)}% Mérito (${sinContactosPct}% Sin Contactos · Estrato ${num(p.indice_privilegio, 2.80).toFixed(2)})`,
        equidad: `${carrera.paridadSalarialPct}% Paridad Salarial · ${num(p.pct_materno ?? p.pct_materno_estructural, 23).toFixed(0)}% Lic. Parental`,
        ia: `${(100 - num(p.riesgo_ia_score, 40)).toFixed(0)}% Blindaje Humano ante IA`,
        balance: `${carrera.pctEmpleoUnico}% Empleo Único · ${carrera.pctArraigoLocal}% Arraigo Local`,
        publico: `${num(p.pct_gobierno, 0).toFixed(1)}% Gobierno · ${num(p.pct_sindicato, 0).toFixed(1)}% Sindicato`
      };

      const datoCortoPorDim: Record<string, string> = {
        empleabilidad: `Desemp ${num(p.tasa_desempleo, 0).toFixed(1)}% / Sat ${num(p.indice_saturacion_pct, 100)}%`,
        formalidad: `${carrera.tasaCalidadOIT}% Calidad OIT`,
        corporativo: `${num(p.pct_corp, 0).toFixed(1)}% Corp`,
        emprendimiento: `${(num(p.pct_micro, 0) + num(p.pct_pyme, 0)).toFixed(1)}% Indep+PYME`,
        remoto: `${num(p.pct_home_office, 0).toFixed(1)}% Home Office`,
        movilidad: `${carrera.crudos.movilidad.toFixed(1)}% Mérito`,
        equidad: `${carrera.paridadSalarialPct}% Paridad / ${num(p.pct_materno ?? p.pct_materno_estructural, 23).toFixed(0)}% Parental`,
        ia: `${(100 - num(p.riesgo_ia_score, 40)).toFixed(0)}% Blindaje IA`,
        balance: `${carrera.pctEmpleoUnico}% Único / ${carrera.pctArraigoLocal}% Arraigo`,
        publico: `${num(p.pct_gobierno, 0).toFixed(1)}% Gob / ${num(p.pct_sindicato, 0).toFixed(1)}% Sind`
      };

      activos.forEach((idPref) => {
        const infoPeso = pesosPrioridad[idPref];
        const scoreDim = scoresPorDim[idPref]?.[carrera.cve_carrera] ?? 50;
        const posRubro = rankPorDim[idPref]?.[carrera.cve_carrera] ?? totalViables;
        matchScoreExacto += scoreDim * (infoPeso?.pesoNorm || 1 / activos.length);

        const prefMeta = PREFERENCIAS.find(pr => pr.id === idPref);
        desglosePrioridades.push({
          idPref,
          orden: infoPeso?.orden || 1,
          label: prefMeta?.corto || idPref,
          datoReal: datoRealPorDim[idPref] || '',
          datoCorto: datoCortoPorDim[idPref] || '',
          score: Math.round(scoreDim),
          rankRubro: posRubro,
          totalViables
        });
      });

      return {
        ...carrera,
        matchScoreExacto,
        desglosePrioridades
      };
    });

    const ordenadosPorExactitud = [...calculados].sort((a, b) => {
      if (Math.abs(b.matchScoreExacto - a.matchScoreExacto) > 0.001) {
        return b.matchScoreExacto - a.matchScoreExacto;
      }
      return b.sueldo_esperado - a.sueldo_esperado;
    });

    let ultimoMostrado = 100.1;
    const rankingMaestro = ordenadosPorExactitud.map((item, idx) => {
      let redondeado = Number(item.matchScoreExacto.toFixed(1));
      if (redondeado >= ultimoMostrado) {
        redondeado = Number(Math.max(5.0, ultimoMostrado - 0.1).toFixed(1));
      }
      ultimoMostrado = redondeado;
      return {
        ...item,
        matchScore: redondeado,
        rankAfinidad: idx + 1
      };
    });

    const listaOrdenada = [...rankingMaestro].sort((a, b) => {
      if (orden === 'afinidad_desc') return a.rankAfinidad - b.rankAfinidad;
      if (orden === 'afinidad_asc') return b.rankAfinidad - a.rankAfinidad;
      if (orden === 'salario_desc') {
        if (b.sueldo_esperado !== a.sueldo_esperado) return b.sueldo_esperado - a.sueldo_esperado;
        return a.rankAfinidad - b.rankAfinidad;
      }
      if (orden === 'salario_asc') {
        if (a.sueldo_esperado !== b.sueldo_esperado) return a.sueldo_esperado - b.sueldo_esperado;
        return a.rankAfinidad - b.rankAfinidad;
      }
      return 0;
    });

    const visibles = mostrarTodas ? listaOrdenada : listaOrdenada.slice(0, 10);

    return {
      rankingVisible: visibles,
      rankingCompleto: rankingMaestro,
      listaOrdenadaCompleta: listaOrdenada,
      totalFiltradas: rankingMaestro.length,
      totalEnRegion: listaConPerfil.length
    };
  }, [datos, activos, pesosPrioridad, sueldoMinimo, orden, mostrarTodas, regionActiva, generoActivo, benchmarksDinamicosPorRegion]);

  const carrerasRestantes = Math.max(0, totalFiltradas - 10);
  const regionMostradaEnTarjeta = regionHover || regionActiva;
  const infoRegionTarjeta = benchmarksDinamicosPorRegion[regionMostradaEnTarjeta] || BENCHMARK_REGIONES_BASE.nacional;
  const infoRegActiva = benchmarksDinamicosPorRegion[regionActiva] || BENCHMARK_REGIONES_BASE.nacional;
  const sueldoPrepaActual = infoRegActiva.sueldo_prepa[generoActivo];
  const diferenciaSliderVsPrepaPct = sueldoPrepaActual > 0
    ? Math.round(((sueldoMinimo - sueldoPrepaActual) / sueldoPrepaActual) * 100)
    : 0;

  const queryGeneroParam = generoActivo === 2 ? 'mujeres' : generoActivo === 1 ? 'hombres' : 'total';
  const etiquetaGeneroCorto = generoActivo === 2 ? 'Solo Mujeres' : generoActivo === 1 ? 'Solo Hombres' : 'Total General';

  const carrerasEnVersus = useMemo(() => {
    return carrerasCompararCves
      .map(cve => rankingCompleto.find((c: any) => c.cve_carrera === cve) || datos.find((d: any) => d.cve_carrera === cve))
      .filter(Boolean);
  }, [carrerasCompararCves, rankingCompleto, datos]);

  const datosRadarVersus = useMemo(() => {
    const ejes = ['Salario', 'Formalidad', 'Empleabilidad', 'Meritocracia', 'Autonomía', 'Estabilidad'] as const;
    return ejes.map(eje => {
      const fila: Record<string, any> = { eje };
      carrerasEnVersus.forEach((c: any) => {
        fila[c.cve_carrera] = c.pilaresRadar?.[eje] ?? 50;
      });
      return fila;
    });
  }, [carrerasEnVersus]);

  const datosRegionesVersus = useMemo(() => {
    const regs = ['norte', 'noroeste', 'bajio', 'centro', 'sur'] as const;
    return regs.map(rKey => {
      const fila: Record<string, any> = {
        region: BENCHMARK_REGIONES_BASE[rKey]?.corto || rKey
      };
      carrerasEnVersus.forEach((c: any) => {
        const perfReg = c.perfiles?.[rKey]?.[generoActivo];
        fila[c.cve_carrera] = perfReg && perfReg.celdaValida !== false && Number(perfReg.sueldo_esperado) > 0
          ? Number(perfReg.sueldo_esperado)
          : null;
      });
      return fila;
    });
  }, [carrerasEnVersus, generoActivo]);

  const compartirRankingLink = async () => {
    const url = window.location.href.replace(/%2C/gi, ',');
    if (navigator.share) {
      try {
        await navigator.share({
          title: `DataROI — Ranking en ${infoRegActiva.corto} (${etiquetaGeneroCorto})`,
          text: `Mira mi ranking personalizado de carreras en ${infoRegActiva.nombre} con DataROI.`,
          url
        });
        return;
      } catch {
        // Fallback al portapapeles
      }
    }
    await navigator.clipboard.writeText(url);
    setCopiadoRanking(true);
    setTimeout(() => setCopiadoRanking(false), 2200);
  };

  // Construcción de Tablas del Ranking con Columnas Separadas por cada Prioridad (Cero textos largos con |)
  const construirTablasRanking = () => {
    const colsPrioCabeceras: string[] = [];
    activos.forEach((idPref, idx) => {
      const prefMeta = PREFERENCIAS.find(pr => pr.id === idPref);
      const nomLimpio = (prefMeta?.corto || idPref).replace(/\s+/g, '_');
      colsPrioCabeceras.push(`Prio${idx + 1}_${nomLimpio}_Lugar`);
      colsPrioCabeceras.push(`Prio${idx + 1}_${nomLimpio}_Dato`);
    });

    const cabeceras = [
      'Lugar_Afinidad',
      'CVE_Carrera',
      'Nombre_Carrera',
      'Afinidad_Global_Pct',
      'Salario_Mensual_MXN',
      'Prima_vs_Prepa_Pct',
      'Tendencia_Real',
      'ROI_Univ_Publica_Anios',
      'ROI_Univ_Privada_Anios',
      'Empleo_Calidad_OIT_Pct',
      'Desempleo_Abierto_Pct',
      'Saturacion_ANUIES_Pct',
      'Meritocracia_Pct',
      'Blindaje_IA_Pct',
      ...colsPrioCabeceras
    ];

    const filas: ValorCeldaExcel[][] = listaOrdenadaCompleta.map((c: any) => {
      const pos = c.rankAfinidad;
      const estiloPodio: EstiloCeldaExcel | undefined =
        pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : undefined;

      const celda = (v: string | number): ValorCeldaExcel =>
        estiloPodio ? { v, s: estiloPodio } : v;

      const roiPub = calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaActual, c.cve_carrera, false);
      const roiPriv = calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaActual, c.cve_carrera, true);

      const celdasPrioridades: ValorCeldaExcel[] = [];
      activos.forEach((_, idx) => {
        const itemP = (c.desglosePrioridades || []).find((d: any) => d.orden === idx + 1);
        if (itemP) {
          const esLiderRubro = itemP.rankRubro === 1;
          celdasPrioridades.push({
            v: `#${itemP.rankRubro} de ${itemP.totalViables}`,
            s: esLiderRubro ? 'winner' : estiloPodio
          });
          celdasPrioridades.push(celda(itemP.datoCorto || itemP.datoReal));
        } else {
          celdasPrioridades.push(celda('-'), celda('-'));
        }
      });

      return [
        celda(pos),
        celda(c.cve_carrera),
        celda(c.nombre_carrera),
        celda(Number(c.matchScore.toFixed(1))),
        celda(c.sueldo_esperado),
        celda(c.premioVsPrepaPct),
        celda(c.perfilActivo?.tendencia_salarial || c.tendencia_salarial || 'Estable'),
        celda(roiPub ?? 'Negativo'),
        celda(roiPriv ?? 'Negativo'),
        celda(c.tasaCalidadOIT),
        celda(Number(num(c.perfilActivo?.tasa_desempleo, 3.2).toFixed(1))),
        celda(num(c.perfilActivo?.indice_saturacion_pct, 92)),
        celda(Number((c.crudos?.movilidad ?? 50).toFixed(1))),
        celda(100 - num(c.perfilActivo?.riesgo_ia_score, 40)),
        ...celdasPrioridades
      ];
    });

    return { cabeceras, filas };
  };

  const exportarRankingExcel = () => {
    if (listaOrdenadaCompleta.length === 0) return;
    const { cabeceras, filas } = construirTablasRanking();

    const filasParametros: ValorCeldaExcel[][] = [
      ['Macro-Región Económica', infoRegActiva.nombre, infoRegActiva.estados],
      ['Perspectiva de Género', etiquetaGeneroCorto, `Sueldo Base Preparatoria: ${formatoMoneda(sueldoPrepaActual)}/mes`],
      ['Piso Salarial Mensual Mínimo', sueldoMinimo, `${diferenciaSliderVsPrepaPct >= 0 ? `+${diferenciaSliderVsPrepaPct}%` : `${diferenciaSliderVsPrepaPct}%`} respecto a Preparatoria`],
      ['Carreras que Cumplen el Filtro', totalFiltradas, `De ${totalEnRegion} carreras con muestra certificada en la región`],
      ...activos.map((idPref, idx) => {
        const prefMeta = PREFERENCIAS.find(pr => pr.id === idPref);
        const infoPeso = pesosPrioridad[idPref];
        return [
          `Prioridad #${idx + 1} (${infoPeso?.pesoPct || 0}% de peso)`,
          prefMeta?.label || idPref,
          prefMeta?.desc || ''
        ];
      })
    ];

    descargarLibroExcelXLSX(
      `DataROI_Ranking_${regionActiva}_${queryGeneroParam}.xlsx`,
      [
        {
          nombre: '1_Ranking_Personalizado',
          cabeceras,
          filas
        },
        {
          nombre: '2_Parametros_Simulacion',
          cabeceras: ['Parametro_de_Decision', 'Valor_Seleccionado', 'Explicacion_y_Referencia'],
          filas: filasParametros
        }
      ]
    );
  };

  const exportarRankingCSV = () => {
    if (listaOrdenadaCompleta.length === 0) return;
    const { cabeceras, filas } = construirTablasRanking();
    descargarCSVEstilizado(
      `DataROI_Ranking_${regionActiva}_${queryGeneroParam}.csv`,
      cabeceras,
      filas
    );
  };

  const compartirVersusLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('region', regionActiva);
    url.searchParams.set('genero', queryGeneroParam);
    url.searchParams.set('comparar', carrerasCompararCves.join(','));
    const linkFinal = url.toString().replace(/%2C/gi, ',');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `DataROI Versus — ${carrerasEnVersus.map((c: any) => c.nombre_carrera).join(' vs. ')}`,
          text: `Comparativa ejecutiva Cara a Cara en ${infoRegActiva.nombre} (${etiquetaGeneroCorto}).`,
          url: linkFinal
        });
        return;
      } catch {
        // Fallback al portapapeles
      }
    }
    await navigator.clipboard.writeText(linkFinal);
    setCopiadoVersus(true);
    setTimeout(() => setCopiadoVersus(false), 2200);
  };

  // Construcción de Hojas para el Comparador Cara a Cara (Con celdas ganadoras en Verde ★ y Podio Oro/Plata/Bronce)
  const construirHojasVersus = () => {
    const conteoVictorias = new Array(carrerasEnVersus.length).fill(0);

    const encontrarLider = (valores: number[], mejorAlto: boolean, invalido = Infinity): ValorCeldaExcel => {
      const validos = valores.filter(v => Number.isFinite(v) && v < invalido);
      if (validos.length === 0) return 'Sin muestra';
      const mejor = mejorAlto ? Math.max(...validos) : Math.min(...validos);
      const ganadores = carrerasEnVersus
        .filter((_, idx) => valores[idx] === mejor && valores[idx] < invalido)
        .map((c: any) => c.nombre_carrera);
      return ganadores.length > 0 ? { v: `★ ${ganadores.join(' / ')}`, s: 'winner' } : '-';
    };

    const registrarFilaNumerica = (
      cat: string,
      ind: string,
      vals: number[],
      fmt: (v: number) => string,
      mejorAlto: boolean,
      invalido = Infinity
    ): ValorCeldaExcel[] => {
      const validos = vals.filter(v => Number.isFinite(v) && v < invalido);
      const mejor = validos.length > 0 ? (mejorAlto ? Math.max(...validos) : Math.min(...validos)) : null;

      const celdasCarreras: ValorCeldaExcel[] = vals.map((v, idx) => {
        const esGanador = mejor !== null && v === mejor && v < invalido;
        if (esGanador) conteoVictorias[idx] += 1;
        const txt = fmt(v);
        return esGanador ? { v: `★ ${txt}`, s: 'winner' } : txt;
      });

      return [
        cat,
        ind,
        ...celdasCarreras,
        encontrarLider(vals, mejorAlto, invalido)
      ];
    };

    const cabecerasMatriz = [
      'Categoria',
      'Indicador_Auditado',
      ...carrerasEnVersus.map((c: any) => `${c.nombre_carrera} (${c.cve_carrera})`),
      'Carrera_Lider_del_Rubro'
    ];

    const filasPrioridadesActivas: ValorCeldaExcel[][] = activos.map((idPref, idx) => {
      const prefMeta = PREFERENCIAS.find(pr => pr.id === idPref);
      const valsRank = carrerasEnVersus.map((c: any) => {
        const itemP = (c.desglosePrioridades || []).find((d: any) => d.orden === idx + 1);
        return itemP ? itemP.rankRubro : 999;
      });
      const mejorRank = Math.min(...valsRank);

      const celdasPrio: ValorCeldaExcel[] = carrerasEnVersus.map((c: any, cIdx) => {
        const itemP = (c.desglosePrioridades || []).find((d: any) => d.orden === idx + 1);
        if (!itemP) return '-';
        const gana = valsRank[cIdx] === mejorRank && mejorRank < 900;
        if (gana) conteoVictorias[cIdx] += 1;
        const txt = `#${itemP.rankRubro} de ${itemP.totalViables} (${itemP.datoCorto || itemP.datoReal})`;
        return gana ? { v: `★ ${txt}`, s: 'winner' } : txt;
      });

      return [
        '2. Prioridades Seleccionadas',
        `Prioridad #${idx + 1}: ${prefMeta?.label || idPref}`,
        ...celdasPrio,
        encontrarLider(valsRank, false, 900)
      ];
    });

    const ejesRadar = ['Salario', 'Formalidad', 'Empleabilidad', 'Meritocracia', 'Autonomía', 'Estabilidad'] as const;
    const filasRadar: ValorCeldaExcel[][] = ejesRadar.map(eje => {
      const vals = carrerasEnVersus.map((c: any) => Number(c.pilaresRadar?.[eje] ?? 50));
      return registrarFilaNumerica('3. Huella de 6 Pilares (0-100)', `Pilar ${eje} (Score 0-100)`, vals, v => `${v} / 100`, true);
    });

    const fmtAnios = (v: number) => (v >= 900 ? 'Retorno negativo' : v === 1 ? '1 año' : `${v} años`);

    const filasHoja1: ValorCeldaExcel[][] = [
      ['1. Contexto y Trazabilidad', 'Macro-Región y Perfil Evaluado', ...carrerasEnVersus.map(() => `${infoRegActiva.nombre} (${etiquetaGeneroCorto})`), '-'],
      ['1. Contexto y Trazabilidad', 'Sueldo Base Preparatoria de Referencia', ...carrerasEnVersus.map(() => `${formatoMoneda(sueldoPrepaActual)} / mes`), '-'],
      registrarFilaNumerica('1. Contexto y Trazabilidad', 'Muestra Física Certificada INEGI', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.n_encuestados_reales, 0)), v => `${v} encuestados`, true),
      registrarFilaNumerica('2. Ranking Global', 'Afinidad Global con tus Prioridades', carrerasEnVersus.map((c: any) => Number((c.matchScore ?? 50).toFixed(1))), v => `${v}%`, true),
      ...filasPrioridadesActivas,
      ...filasRadar,
      registrarFilaNumerica('4. Salario y Retorno (ROI)', 'Salario Mensual Consolidado', carrerasEnVersus.map((c: any) => c.sueldo_esperado), v => `${formatoMoneda(v)} / mes`, true),
      registrarFilaNumerica('4. Salario y Retorno (ROI)', 'Prima Salarial vs. Preparatoria', carrerasEnVersus.map((c: any) => c.premioVsPrepaPct), v => `${v >= 0 ? `+${v}%` : `${v}%`} vs. Prepa`, true),
      ['4. Salario y Retorno (ROI)', 'Tendencia Salarial Real (2021–2026)', ...carrerasEnVersus.map((c: any) => c.perfilActivo?.tendencia_salarial || c.tendencia_salarial || 'Estable'), '-'],
      registrarFilaNumerica('4. Salario y Retorno (ROI)', 'Retorno Inversión Univ. Pública', carrerasEnVersus.map((c: any) => calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaActual, c.cve_carrera, false) ?? 999), fmtAnios, false, 900),
      registrarFilaNumerica('4. Salario y Retorno (ROI)', 'Retorno Inversión Univ. Privada Media', carrerasEnVersus.map((c: any) => calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaActual, c.cve_carrera, true) ?? 999), fmtAnios, false, 900),
      registrarFilaNumerica('4. Salario y Retorno (ROI)', 'Inversión Requerida en Equipo (CapEx)', carrerasEnVersus.map((c: any) => obtenerCapExCorto(c.cve_carrera).costoEquipo), v => formatoMoneda(v), false),
      registrarFilaNumerica('5. Calidad y Mercado Laboral', 'Empleo de Calidad (Estándar OIT)', carrerasEnVersus.map((c: any) => c.tasaCalidadOIT), v => `${v}%`, true),
      registrarFilaNumerica('5. Calidad y Mercado Laboral', 'Formalidad Laboral Total', carrerasEnVersus.map((c: any) => c.tasaFormalidadTotal), v => `${v}%`, true),
      registrarFilaNumerica('5. Calidad y Mercado Laboral', 'Tasa de Desempleo Abierto', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.tasa_desempleo, 3.5)), v => `${v.toFixed(1)}%`, false),
      registrarFilaNumerica('5. Calidad y Mercado Laboral', 'Índice de Saturación ANUIES', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.indice_saturacion_pct, 100)), v => `${v}%`, false),
      ['5. Calidad y Mercado Laboral', 'Sector Empleador Dominante', ...carrerasEnVersus.map((c: any) => obtenerSectorDominante(c.perfilActivo)), '-'],
      registrarFilaNumerica('5. Ecosistema Empleador', 'Inserción en Grandes Corporativos', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_corp, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('5. Ecosistema Empleador', 'Inserción en PYMEs', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_pyme, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('5. Ecosistema Empleador', 'Práctica Independiente / Microempresa', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_micro, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('5. Ecosistema Empleador', 'Sector Público y Gobierno', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_gobierno, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Contrato Escrito Estable', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_contrato, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Aguinaldo de Ley', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_aguinaldo, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Fondo de Retiro (AFORE)', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_afore, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Protección Materna / Paterna', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_materno, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Afiliación Sindical / Gremial', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_sindicato, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Seguro Médico Privado (SGMM)', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_sgmm, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Apertura y Movilidad Social (% Mérito)', carrerasEnVersus.map((c: any) => Number((c.crudos?.movilidad ?? 50).toFixed(1))), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Estrato Socioeconómico de Origen (1 a 4)', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.indice_privilegio, 2.8)), v => `${v.toFixed(2)} / 4`, false),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Contratación por Contactos / Nepotismo', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_nepotismo, 37)), v => `${v.toFixed(1)}%`, false),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Blindaje Humano ante IA', carrerasEnVersus.map((c: any) => 100 - num(c.perfilActivo?.riesgo_ia_score, 40)), v => `${v}%`, true),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Trabajo Remoto / Home Office', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_home_office, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Empleo Único sin Pluriempleo', carrerasEnVersus.map((c: any) => c.pctEmpleoUnico), v => `${v}%`, true),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Arraigo Local sin Migrar de Estado', carrerasEnVersus.map((c: any) => c.pctArraigoLocal), v => `${v}%`, true)
    ];

    // Calcular Podio Final por Conteo de Victorias (Oro, Plata y Bronce)
    const victoriasUnicas = Array.from(new Set(conteoVictorias)).sort((a, b) => b - a);
    const celdasPodioFinal: ValorCeldaExcel[] = conteoVictorias.map(v => {
      const posPodio = victoriasUnicas.indexOf(v) + 1;
      const medalla = posPodio === 1 ? '1° LUGAR (ORO)' : posPodio === 2 ? '2° LUGAR (PLATA)' : '3° LUGAR (BRONCE)';
      const estilo: EstiloCeldaExcel = posPodio === 1 ? 'gold' : posPodio === 2 ? 'silver' : 'bronze';
      return { v: `${medalla} — ${v} rubros ganados`, s: estilo };
    });

    filasHoja1.push([
      { v: '8. Veredicto y Podio Global', s: 'section' },
      { v: 'Podio por Total de Indicadores Liderados', s: 'section' },
      ...celdasPodioFinal,
      encontrarLider(conteoVictorias, true)
    ]);

    // Hoja 2: Comparativa Salarial en las 5 Macro-Regiones
    const regs = ['nacional', 'norte', 'noroeste', 'bajio', 'centro', 'sur'] as const;
    const filasHoja2: ValorCeldaExcel[][] = regs.map(rKey => {
      const metaR = BENCHMARK_REGIONES_BASE[rKey];
      const prepaR = metaR.sueldo_prepa[generoActivo];
      const vals = carrerasEnVersus.map((c: any) => {
        const pr = c.perfiles?.[rKey]?.[generoActivo];
        return pr && pr.celdaValida !== false && Number(pr.sueldo_esperado) > 0 ? Number(pr.sueldo_esperado) : -1;
      });
      const validos = vals.filter(v => v > 0);
      const mejor = validos.length > 0 ? Math.max(...validos) : null;

      const celdasReg: ValorCeldaExcel[] = vals.map(v => {
        if (v <= 0) return 'Sin muestra';
        const prima = prepaR > 0 ? Number((((v - prepaR) / prepaR) * 100).toFixed(1)) : 0;
        const txt = `${formatoMoneda(v)} (${prima >= 0 ? `+${prima}%` : `${prima}%`} vs Prepa)`;
        return mejor !== null && v === mejor ? { v: `★ ${txt}`, s: 'winner' } : txt;
      });

      return [
        metaR.nombre,
        formatoMoneda(prepaR),
        ...celdasReg,
        encontrarLider(vals.map(v => (v > 0 ? v : -999)), true, 9999999)
      ];
    });

    return { cabecerasMatriz, filasHoja1, filasHoja2 };
  };

  const exportarVersusExcel = () => {
    if (carrerasEnVersus.length < 2) return;
    const { cabecerasMatriz, filasHoja1, filasHoja2 } = construirHojasVersus();
    descargarLibroExcelXLSX(
      `DataROI_Versus_${regionActiva}_${queryGeneroParam}_${carrerasCompararCves.join('_')}.xlsx`,
      [
        {
          nombre: '1_Matriz_Cara_a_Cara',
          cabeceras: cabecerasMatriz,
          filas: filasHoja1
        },
        {
          nombre: '2_Sueldos_5_MacroRegiones',
          cabeceras: [
            'Macro_Region',
            'Base_Prepa_MXN',
            ...carrerasEnVersus.map((c: any) => `${c.nombre_carrera} (${c.cve_carrera})`),
            'Lider_Regional'
          ],
          filas: filasHoja2
        }
      ]
    );
  };

  const exportarVersusCSV = () => {
    if (carrerasEnVersus.length < 2) return;
    const { cabecerasMatriz, filasHoja1 } = construirHojasVersus();
    descargarCSVEstilizado(
      `DataROI_Versus_${regionActiva}_${queryGeneroParam}_${carrerasCompararCves.join('_')}.csv`,
      cabecerasMatriz,
      filasHoja1
    );
  };

  const descargarPDFVersusDirecto = () => {
    if (carrerasEnVersus.length < 2) return;
    descargarComparativaVersusPDF({
      regionNombre: infoRegActiva.nombre,
      regionCorto: infoRegActiva.corto,
      perfilEtiqueta: etiquetaGeneroCorto,
      sueldoPrepa: sueldoPrepaActual,
      carreras: carrerasEnVersus.map((c: any) => {
        const sueldosRegMap: Record<string, number | null> = {};
        (['norte', 'noroeste', 'bajio', 'centro', 'sur'] as const).forEach(rk => {
          const pr = c.perfiles?.[rk]?.[generoActivo];
          sueldosRegMap[rk] = pr && pr.celdaValida !== false && Number(pr.sueldo_esperado) > 0
            ? Number(pr.sueldo_esperado)
            : null;
        });
        return {
          cve_carrera: c.cve_carrera,
          nombre_carrera: c.nombre_carrera,
          sueldo_esperado: c.sueldo_esperado,
          premioVsPrepaPct: c.premioVsPrepaPct,
          roiPublica: calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaActual, c.cve_carrera, false),
          roiPrivada: calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaActual, c.cve_carrera, true),
          costoEquipo: obtenerCapExCorto(c.cve_carrera).costoEquipo,
          tasaCalidadOIT: c.tasaCalidadOIT,
          tasaDesempleo: num(c.perfilActivo?.tasa_desempleo, 3.5),
          saturacionPct: num(c.perfilActivo?.indice_saturacion_pct, 100),
          meritoPct: Number((c.crudos?.movilidad ?? 50).toFixed(1)),
          blindajeIA: 100 - num(c.perfilActivo?.riesgo_ia_score, 40),
          empleoUnicoPct: c.pctEmpleoUnico,
          sectorPrincipal: obtenerSectorDominante(c.perfilActivo),
          pilaresRadar: c.pilaresRadar || {},
          sueldosPorRegion: sueldosRegMap
        };
      }),
      nombreArchivo: `DataROI_Comparativa_Versus_${regionActiva}_${queryGeneroParam}_${carrerasCompararCves.join('_')}.pdf`
    });
  };

  return (
    <div className="max-w-6xl mx-auto pb-24">
      
      {/* CABECERA */}
      <div className="no-print mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">
            Descubridor de Carreras
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Encuentra las licenciaturas con mayor retorno y afinidad según tu región, perfil y prioridades.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/laboratorio"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 text-xs font-bold text-slate-700 shadow-2xs transition-all"
          >
            <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />
            Laboratorio Crudo
          </Link>

          {modoVistaFiltros !== 'wizard' && (
            <>
              <button
                onClick={() => {
                  setPasoWizard(1);
                  setModoVistaFiltros('wizard');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5 text-blue-600" />
                Guía paso a paso
              </button>

              <button
                onClick={() => setModoVistaFiltros(prev => (prev === 'colapsado' ? 'expandido' : 'colapsado'))}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  modoVistaFiltros === 'expandido'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {modoVistaFiltros === 'expandido' ? 'Contraer filtros' : 'Editar filtros'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODO 1: ASISTENTE PASO A PASO (WIZARD PROGRESIVO CON FADE-IN)              */}
      {/* ========================================================================= */}
      {modoVistaFiltros === 'wizard' && (
        <div className="no-print bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 max-w-3xl mx-auto mb-8 animate-in fade-in duration-200">
          
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-xs font-black uppercase tracking-wider text-blue-600">
              Paso {pasoWizard} de 4
            </span>
            <button
              onClick={() => setModoVistaFiltros(activos.length > 0 ? 'colapsado' : 'expandido')}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Saltar guía y ver panel completo {'→'}
            </button>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${(pasoWizard / 4) * 100}%` }}
            />
          </div>

          {/* PASO 1: MACRO-REGIÓN */}
          {pasoWizard === 1 && (
            <div key="paso1" className="animate-in fade-in slide-in-from-right-4 duration-200">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1">
                1. ¿En qué región de México planeas ejercer?
              </h2>
              <p className="text-xs md:text-sm text-slate-500 mb-4">
                Haz clic directamente sobre cualquier zona del mapa para explorar tu región o mantén <strong>Todo México</strong> para el promedio nacional.
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(benchmarksDinamicosPorRegion).map(([idReg, meta]) => {
                  const activa = regionActiva === idReg;
                  return (
                    <button
                      key={idReg}
                      onClick={() => cambiarRegionConCalibracion(idReg)}
                      onMouseEnter={() => setRegionHover(idReg)}
                      onMouseLeave={() => setRegionHover(null)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        activa
                          ? meta.badgeActivo
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {meta.corto}
                    </button>
                  );
                })}
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 max-w-lg mx-auto">
                <MapaMexicoMacroRegiones
                  regionActiva={regionActiva}
                  regionHover={regionHover}
                  onSelectRegion={cambiarRegionConCalibracion}
                  onHoverRegion={setRegionHover}
                />
              </div>

              <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-black text-sm text-slate-900 block">{infoRegionTarjeta.nombre}</span>
                    <span className="text-slate-500 text-[11px]">{infoRegionTarjeta.estados}</span>
                  </div>
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-black">
                    Media Licenciatura: {formatoMoneda(infoRegionTarjeta.sueldo_lic)}/mes
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/70">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-[11px] text-slate-400 block">Sueldo Base Preparatoria Regional:</span>
                    <strong className="text-slate-900 font-black">{formatoMoneda(infoRegionTarjeta.sueldo_prepa[generoActivo])} / mes</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                    <span className="text-[11px] text-slate-400 block">Salto de Formalidad Laboral:</span>
                    <strong className="text-slate-900 font-black">{infoRegionTarjeta.formalidad_prepa}% Prepa {'→'} {infoRegionTarjeta.formalidad_lic}% Licenciatura</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: PERSPECTIVA DE GÉNERO */}
          {pasoWizard === 2 && (
            <div key="paso2" className="animate-in fade-in slide-in-from-right-4 duration-200">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1">
                2. ¿Bajo qué perspectiva deseas analizar los datos?
              </h2>
              <p className="text-xs md:text-sm text-slate-500 mb-5">
                Puedes consultar el mercado general o filtrar las muestras exclusivas de mujeres u hombres profesionistas en {infoRegActiva.corto}.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {([
                  {
                    id: 0 as CodigoGenero,
                    titulo: 'Total General',
                    sub: 'Muestra consolidada de hombres y mujeres en la región.',
                    prepa: infoRegActiva.sueldo_prepa[0]
                  },
                  {
                    id: 2 as CodigoGenero,
                    titulo: 'Solo Mujeres',
                    sub: 'Sueldos, formalidad y brechas reales observadas en mujeres.',
                    prepa: infoRegActiva.sueldo_prepa[2]
                  },
                  {
                    id: 1 as CodigoGenero,
                    titulo: 'Solo Hombres',
                    sub: 'Sueldos, formalidad e inserción observada en hombres.',
                    prepa: infoRegActiva.sueldo_prepa[1]
                  }
                ]).map((op) => {
                  const act = generoActivo === op.id;
                  const estGen = ESTILOS_GENERO[op.id];
                  return (
                    <button
                      key={op.id}
                      onClick={() => cambiarGeneroConCalibracion(op.id)}
                      className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        act
                          ? estGen.activoCard
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Users className={`w-5 h-5 ${act ? estGen.iconoActivo : 'text-slate-400'}`} />
                          {act && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${estGen.badgeActivo}`}>
                              Seleccionado
                            </span>
                          )}
                        </div>
                        <h3 className="font-black text-base text-slate-900 mb-1">{op.titulo}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{op.sub}</p>
                      </div>
                      <div className="mt-4 pt-2.5 border-t border-slate-200/70 text-[11px] text-slate-500">
                        Base Prepa aquí: <strong className="text-slate-900">{formatoMoneda(op.prepa)}/mes</strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PASO 3: META SALARIAL MENSUAL */}
          {pasoWizard === 3 && (
            <div key="paso3" className="animate-in fade-in slide-in-from-right-4 duration-200">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1">
                3. ¿Cuál es tu piso salarial mensual esperado?
              </h2>
              <p className="text-xs md:text-sm text-slate-500 mb-6">
                Descartaremos del ranking cualquier carrera cuyo sueldo consolidado en {infoRegActiva.corto} esté por debajo de tu meta.
              </p>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 text-center mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Sueldo Mensual Mínimo
                </span>
                <div className="text-4xl md:text-5xl font-black text-emerald-600 my-2">
                  {formatoMoneda(sueldoMinimo)}
                  <span className="text-sm font-bold text-slate-400 ml-1">/ mes</span>
                </div>

                <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-5 ${
                  diferenciaSliderVsPrepaPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {diferenciaSliderVsPrepaPct >= 0
                    ? `+${diferenciaSliderVsPrepaPct}% por encima del sueldo de Preparatoria (${formatoMoneda(sueldoPrepaActual)})`
                    : `${diferenciaSliderVsPrepaPct}% respecto al sueldo de Preparatoria (${formatoMoneda(sueldoPrepaActual)})`}
                </span>

                <input
                  type="range"
                  min={minSueldoCatalogo}
                  max={maxSueldoCatalogo}
                  step="500"
                  value={sueldoMinimo}
                  onChange={(e) => setSueldoMinimo(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2 font-mono">
                  <span>Mín: {formatoMoneda(minSueldoCatalogo)}</span>
                  <span>Ref. Prepa: {formatoMoneda(sueldoPrepaActual)}</span>
                  <span>Máx: {formatoMoneda(maxSueldoCatalogo)}+</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs text-blue-950">
                <span className="font-medium">Carreras con muestra certificada que cumplen este piso salarial:</span>
                <span className="font-black text-sm text-blue-700">{totalFiltradas} de {totalEnRegion} carreras</span>
              </div>
            </div>
          )}

          {/* PASO 4: SELECCIÓN DE HASTA 5 PRIORIDADES */}
          {pasoWizard === 4 && (
            <div key="paso4" className="animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1">
                    4. Elige hasta {MAX_PRIORIDADES} prioridades en orden de importancia ({activos.length}/{MAX_PRIORIDADES})
                  </h2>
                  <p className="text-xs md:text-sm text-slate-500">
                    La primera que elijas tendrá el mayor peso en tu ecuación de afinidad; todas suman exactamente 100%.
                  </p>
                </div>
                {activos.length > 0 && (
                  <button
                    onClick={() => setActivos([])}
                    className="text-xs font-bold text-slate-500 hover:text-rose-600 px-2.5 py-1 rounded-lg bg-slate-100 cursor-pointer shrink-0"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {alertaConflictoEcosistema && (
                <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 px-3.5 py-2.5 rounded-xl text-xs text-amber-900 animate-in fade-in duration-150">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Nota de balance:</strong> Seleccionaste sectores empleadores opuestos (ej. <em>Corporativo</em> e <em>Independiente/Gobierno</em>). El ranking buscará carreras híbridas.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-4">
                {PREFERENCIAS.map((pref) => {
                  const isActive = activos.includes(pref.id);
                  const infoPeso = pesosPrioridad[pref.id];
                  const bloqueadaPorTope = !isActive && activos.length >= MAX_PRIORIDADES;
                  const estilo = obtenerEstiloJerarquiaPrioridad(infoPeso?.orden);

                  return (
                    <button
                      key={pref.id}
                      onClick={() => togglePreferencia(pref.id)}
                      disabled={bloqueadaPorTope}
                      className={`text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3 ${
                        bloqueadaPorTope
                          ? 'border-slate-100 bg-slate-50/50 opacity-45 cursor-not-allowed'
                          : `${estilo.btn} cursor-pointer`
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${estilo.icono}`}>
                        {pref.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="font-black text-xs md:text-sm text-slate-900 truncate">{pref.label}</h3>
                          {isActive && infoPeso && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${estilo.badge}`}>
                              #{infoPeso.orden} · {infoPeso.pesoPct}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-tight mt-0.5">{pref.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CONTROLES DE NAVEGACIÓN DEL WIZARD */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            {pasoWizard > 1 ? (
              <button
                onClick={() => setPasoWizard(p => p - 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
            ) : (
              <div />
            )}

            {pasoWizard < 4 ? (
              <button
                onClick={() => setPasoWizard(p => p + 1)}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs md:text-sm font-black text-white shadow-xs transition-all cursor-pointer"
              >
                Siguiente paso <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                disabled={activos.length === 0}
                onClick={() => setModoVistaFiltros('colapsado')}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all ${
                  activos.length > 0
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {activos.length > 0 ? `Ver mis ${totalFiltradas} carreras recomendadas` : 'Elige al menos 1 prioridad'}
              </button>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 2: CINTA COMPACTA COLAPSADA                                          */}
      {/* ========================================================================= */}
      {modoVistaFiltros === 'colapsado' && (
        <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 mb-6 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setModoVistaFiltros('expandido')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-xs font-bold text-slate-800 border border-slate-200/80 transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>{infoRegActiva.corto}</span>
            </button>

            <button
              onClick={() => setModoVistaFiltros('expandido')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${ESTILOS_GENERO[generoActivo].activoBtn}`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{etiquetaGeneroCorto}</span>
            </button>

            <button
              onClick={() => setModoVistaFiltros('expandido')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-xs font-black text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
            >
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mín. {formatoMoneda(sueldoMinimo)}/mes</span>
            </button>

            <div className="flex flex-wrap items-center gap-1.5 pl-1 border-l border-slate-200">
              {activos.map(idPref => {
                const meta = PREFERENCIAS.find(p => p.id === idPref);
                const peso = pesosPrioridad[idPref];
                const estP = obtenerEstiloJerarquiaPrioridad(peso?.orden);
                return (
                  <button
                    key={idPref}
                    onClick={() => setModoVistaFiltros('expandido')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${estP.badge}`}
                  >
                    <span className="font-black">#{peso?.orden}</span> {meta?.corto} ({peso?.pesoPct}%)
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setModoVistaFiltros('expandido')}
            className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer ml-auto"
          >
            Modificar criterios <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 3: PANEL EXPANDIDO DE 2 COLUMNAS PARA EDICIÓN RÁPIDA                 */}
      {/* ========================================================================= */}
      {modoVistaFiltros === 'expandido' && (
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-5 mb-7 animate-in fade-in duration-200">
          
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h2 className="font-black text-sm text-slate-900">1. Macro-Región Económica</h2>
                </div>
                <span className="text-[11px] font-bold text-slate-400">Clic en mapa o botones</span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {Object.entries(benchmarksDinamicosPorRegion).map(([idReg, meta]) => {
                  const activa = regionActiva === idReg;
                  return (
                    <button
                      key={idReg}
                      onClick={() => cambiarRegionConCalibracion(idReg)}
                      onMouseEnter={() => setRegionHover(idReg)}
                      onMouseLeave={() => setRegionHover(null)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        activa
                          ? meta.badgeActivo
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {meta.corto}
                    </button>
                  );
                })}
              </div>

              <div className="bg-slate-50/80 rounded-xl p-1.5 border border-slate-100">
                <MapaMexicoMacroRegiones
                  regionActiva={regionActiva}
                  regionHover={regionHover}
                  onSelectRegion={cambiarRegionConCalibracion}
                  onHoverRegion={setRegionHover}
                />
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900 mb-0.5">
                  <span>{infoRegionTarjeta.nombre}</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-black text-[11px]">
                    Media Lic: {formatoMoneda(infoRegionTarjeta.sueldo_lic)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug mb-2">{infoRegionTarjeta.estados}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block">Base Prepa Regional:</span>
                    <strong className="text-slate-800">{formatoMoneda(infoRegionTarjeta.sueldo_prepa[generoActivo])} / mes</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Salto de Formalidad:</span>
                    <strong className="text-slate-800">{infoRegionTarjeta.formalidad_prepa}% Prepa {'→'} {infoRegionTarjeta.formalidad_lic}% Lic.</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <span className="font-black text-sm text-slate-900 flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  2. Perspectiva del Ranking
                </span>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {([
                    { id: 0 as CodigoGenero, label: 'Total General' },
                    { id: 2 as CodigoGenero, label: 'Solo Mujeres' },
                    { id: 1 as CodigoGenero, label: 'Solo Hombres' }
                  ]).map((op) => {
                    const act = generoActivo === op.id;
                    return (
                      <button
                        key={op.id}
                        onClick={() => cambiarGeneroConCalibracion(op.id)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          act ? ESTILOS_GENERO[op.id].activoBtn : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {op.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-black text-sm text-slate-900 flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    3. Piso Salarial Mensual
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    diferenciaSliderVsPrepaPct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {diferenciaSliderVsPrepaPct >= 0
                      ? `Piso: +${diferenciaSliderVsPrepaPct}% sobre Prepa`
                      : `Piso: ${diferenciaSliderVsPrepaPct}% vs. Prepa`}
                  </span>
                </div>

                <div className="text-2xl font-black text-emerald-600 my-1.5">
                  {formatoMoneda(sueldoMinimo)}
                  <span className="text-xs font-bold text-slate-400 ml-1">/ mes mínimo</span>
                </div>

                <input
                  type="range"
                  min={minSueldoCatalogo}
                  max={maxSueldoCatalogo}
                  step="500"
                  value={sueldoMinimo}
                  onChange={(e) => setSueldoMinimo(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
                  <span>{formatoMoneda(minSueldoCatalogo)}</span>
                  <span>Ref. Prepa: {formatoMoneda(sueldoPrepaActual)}</span>
                  <span>{formatoMoneda(maxSueldoCatalogo)}+</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <h2 className="font-black text-base text-slate-900">
                    4. Elige hasta {MAX_PRIORIDADES} Prioridades en Orden de Importancia ({activos.length}/{MAX_PRIORIDADES})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Acotar tu elección a máximo {MAX_PRIORIDADES} valores evita diluir el puntaje y encuentra carreras verdaderamente especializadas.
                  </p>
                </div>

                {activos.length > 0 && (
                  <button
                    onClick={() => setActivos([])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-rose-600 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
                  </button>
                )}
              </div>

              {alertaConflictoEcosistema && (
                <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-xs text-amber-900">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Nota de balance:</strong> Seleccionaste sectores empleadores opuestos (ej. <em>Corporativo</em> e <em>Independiente/Gobierno</em>). El ranking buscará carreras híbridas.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 mt-3">
                {PREFERENCIAS.map((pref) => {
                  const isActive = activos.includes(pref.id);
                  const infoPeso = pesosPrioridad[pref.id];
                  const bloqueadaPorTope = !isActive && activos.length >= MAX_PRIORIDADES;
                  const estilo = obtenerEstiloJerarquiaPrioridad(infoPeso?.orden);

                  return (
                    <button
                      key={pref.id}
                      onClick={() => togglePreferencia(pref.id)}
                      disabled={bloqueadaPorTope}
                      className={`text-left p-3.5 rounded-xl border-2 transition-all duration-150 flex flex-col justify-between relative ${
                        bloqueadaPorTope
                          ? 'border-slate-100 bg-slate-50/50 opacity-45 cursor-not-allowed'
                          : `${estilo.btn} cursor-pointer`
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full mb-1.5">
                        <div className={`p-2 rounded-lg shrink-0 transition-colors ${estilo.icono}`}>
                          {pref.icon}
                        </div>

                        {isActive && infoPeso && (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide shrink-0 ${estilo.badge}`}>
                            Prioridad #{infoPeso.orden} · {infoPeso.pesoPct}%
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="font-black text-xs md:text-sm text-slate-900 mb-0.5 leading-snug">
                          {pref.label}
                        </h3>
                        <p className="text-[11px] text-slate-600 leading-tight hidden sm:block">
                          {pref.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400">
                {activos.length === 0
                  ? 'Selecciona tu Prioridad #1 arriba para desplegar el Ranking.'
                  : `Ponderación exacta del 100% distribuida en ${activos.length} ${activos.length === 1 ? 'criterio' : 'criterios'}.`}
              </span>
              {activos.length > 0 && (
                <button
                  onClick={() => setModoVistaFiltros('colapsado')}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
                >
                  Listo · Ver Ranking {'↑'}
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* ZONA DE RESULTADOS DEL RANKING                                            */}
      {/* ========================================================================= */}
      {activos.length > 0 && modoVistaFiltros !== 'wizard' && (
        <div className="animate-in fade-in duration-200">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                Ranking en {infoRegActiva.corto} ({etiquetaGeneroCorto})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Posición competitiva exacta (<strong>#Lugar / {totalFiltradas}</strong>) y opción para comparar hasta <strong>{MAX_COMPARAR} carreras Cara a Cara</strong>.
              </p>
            </div>

            <div className="no-print flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={compartirRankingLink}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
              >
                {copiadoRanking ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-blue-600" />}
                {copiadoRanking ? '¡Link copiado!' : 'Compartir'}
              </button>

              <button
                onClick={exportarRankingExcel}
                title="Descargar Libro de Excel (.xlsx) con 2 Hojas, colores de podio y columnas separadas por prioridad"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-2xs transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel (2 Hojas)
              </button>

              <button
                onClick={exportarRankingCSV}
                title="Descargar tabla en formato CSV limpio con columnas separadas por prioridad"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                CSV
              </button>

              <span className="text-xs font-bold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
                Evaluando <strong>{totalFiltradas}</strong> carreras
              </span>

              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <ArrowUpDown className="w-4 h-4 text-blue-600 shrink-0" />
                <select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value as CriterioOrden)}
                  className="bg-transparent border-none text-xs md:text-sm font-bold text-slate-800 focus:ring-0 cursor-pointer outline-none pr-2"
                >
                  <option value="afinidad_desc">Mayor Afinidad (Top)</option>
                  <option value="afinidad_asc">Menor Afinidad (Peores)</option>
                  <option value="salario_desc">Mayor Salario ($ a $)</option>
                  <option value="salario_asc">Menor Salario ($ a $)</option>
                </select>
              </div>
            </div>
          </div>

          {rankingVisible.length === 0 ? (
            <div className="text-center py-14 bg-rose-50/60 rounded-2xl border-2 border-dashed border-rose-200">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
              <h3 className="text-lg font-black text-rose-900">Ninguna carrera supera ese piso salarial en esta región</h3>
              <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">
                En <strong>{infoRegActiva.nombre}</strong> ninguna carrera con muestra sólida para este perfil supera los <strong>{formatoMoneda(sueldoMinimo)}</strong>.
              </p>
              <button
                onClick={() => setModoVistaFiltros('expandido')}
                className="mt-4 px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Ajustar piso salarial
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {rankingVisible.map((carrera) => {
                const isGold = carrera.rankAfinidad === 1;
                const isSilver = carrera.rankAfinidad === 2;
                const isBronze = carrera.rankAfinidad === 3;
                const isPodium = isGold || isSilver || isBronze;
                const isBottom3 = orden === 'afinidad_asc' && totalFiltradas > 5 && carrera.rankAfinidad > totalFiltradas - 3;

                const enComparador = carrerasCompararCves.includes(carrera.cve_carrera);
                const topeComparador = !enComparador && carrerasCompararCves.length >= MAX_COMPARAR;
                const capexInfo = obtenerCapExCorto(carrera.cve_carrera);

                let borderClass = "border-slate-200 hover:border-blue-400";
                let badgeColor = "bg-slate-100 text-slate-700";
                let badgeContent = <span className="font-black text-base">#{carrera.rankAfinidad}</span>;

                if (isGold) {
                  borderClass = "border-amber-400 shadow-sm ring-2 ring-amber-400/20";
                  badgeColor = "bg-amber-100 text-amber-800";
                  badgeContent = (
                    <div className="flex flex-col items-center leading-none">
                      <Trophy className="w-5 h-5 text-amber-600 mb-0.5" />
                      <span className="text-[11px] font-black">#1</span>
                    </div>
                  );
                } else if (isSilver) {
                  borderClass = "border-slate-300 shadow-xs ring-2 ring-slate-300/30";
                  badgeColor = "bg-slate-200 text-slate-800";
                  badgeContent = (
                    <div className="flex flex-col items-center leading-none">
                      <Medal className="w-5 h-5 text-slate-600 mb-0.5" />
                      <span className="text-[11px] font-black">#2</span>
                    </div>
                  );
                } else if (isBronze) {
                  borderClass = "border-orange-300 shadow-xs ring-2 ring-orange-300/20";
                  badgeColor = "bg-orange-100 text-orange-900";
                  badgeContent = (
                    <div className="flex flex-col items-center leading-none">
                      <Medal className="w-5 h-5 text-orange-600 mb-0.5" />
                      <span className="text-[11px] font-black">#3</span>
                    </div>
                  );
                } else if (isBottom3) {
                  borderClass = "border-rose-200 hover:border-rose-400 bg-rose-50/10";
                  badgeColor = "bg-rose-50 text-rose-700 border border-rose-200";
                  badgeContent = (
                    <div className="flex flex-col items-center leading-none">
                      <AlertTriangle className="w-4 h-4 text-rose-500 mb-0.5" />
                      <span className="text-[11px] font-black">#{carrera.rankAfinidad}</span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={carrera.cve_carrera}
                    href={`/carrera/${carrera.cve_carrera}?region=${regionActiva}&genero=${queryGeneroParam}`}
                    className={`print-avoid-break block bg-white p-5 rounded-2xl border-2 transition-all group relative overflow-hidden ${borderClass}`}
                  >
                    <div
                      className={`absolute bottom-0 left-0 h-1 opacity-25 ${
                        isGold ? 'bg-amber-500' : isBottom3 ? 'bg-rose-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${carrera.matchScore}%` }}
                    />

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`flex items-center justify-center w-13 h-13 shrink-0 rounded-xl font-black ${badgeColor}`}>
                          {badgeContent}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className={`font-black tracking-tight ${isPodium ? 'text-lg md:text-xl text-slate-900' : 'text-base md:text-lg text-slate-800'}`}>
                              {carrera.nombre_carrera}
                            </h3>
                            {isPodium && orden !== 'afinidad_desc' && (
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                Top #{carrera.rankAfinidad} Match
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-1 mb-3">
                            <span className={`text-sm font-black ${
                              orden === 'salario_desc' || orden === 'salario_asc'
                                ? 'bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-lg border border-emerald-200'
                                : 'text-emerald-600'
                            }`}>
                              {formatoMoneda(carrera.sueldo_esperado)} / mes
                            </span>

                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                              carrera.premioVsPrepaPct >= 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {carrera.premioVsPrepaPct >= 0 ? `+${carrera.premioVsPrepaPct}%` : `${carrera.premioVsPrepaPct}%`} vs. Prepa
                            </span>

                            <BadgeTendencia
                              codigo={carrera.perfilActivo?.tendencia_codigo || carrera.tendencia_codigo}
                              etiqueta={carrera.perfilActivo?.tendencia_salarial || carrera.tendencia_salarial}
                            />

                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${capexInfo.clase}`}>
                              {capexInfo.corto}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                            {carrera.desglosePrioridades.map((item: any) => {
                              const esOroRubro = item.rankRubro === 1;
                              const esPlataRubro = item.rankRubro === 2;
                              const esBronceRubro = item.rankRubro === 3;
                              const esFondo3Rubro = item.totalViables > 6 && item.rankRubro > item.totalViables - 3;

                              let cardStyle = 'bg-slate-50/90 border-slate-200/80';
                              let barColor = 'bg-blue-600';
                              let rankBadgeStyle = 'bg-slate-200/80 text-slate-700';
                              let rankIcon = null;

                              if (esOroRubro) {
                                cardStyle = 'bg-amber-50/45 border-amber-300 shadow-2xs';
                                barColor = 'bg-amber-500';
                                rankBadgeStyle = 'bg-amber-100 text-amber-900 border border-amber-300';
                                rankIcon = <Trophy className="w-3 h-3 text-amber-600 shrink-0" />;
                              } else if (esPlataRubro) {
                                cardStyle = 'bg-slate-100/80 border-slate-300';
                                barColor = 'bg-slate-600';
                                rankBadgeStyle = 'bg-slate-200 text-slate-900 border border-slate-300';
                                rankIcon = <Medal className="w-3 h-3 text-slate-600 shrink-0" />;
                              } else if (esBronceRubro) {
                                cardStyle = 'bg-orange-50/40 border-orange-300';
                                barColor = 'bg-orange-500';
                                rankBadgeStyle = 'bg-orange-100 text-orange-900 border border-orange-300';
                                rankIcon = <Medal className="w-3 h-3 text-orange-600 shrink-0" />;
                              } else if (esFondo3Rubro) {
                                cardStyle = 'bg-rose-50/40 border-rose-200';
                                barColor = 'bg-rose-500';
                                rankBadgeStyle = 'bg-rose-100 text-rose-800 border border-rose-200';
                                rankIcon = <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />;
                              }

                              return (
                                <div
                                  key={item.orden}
                                  className={`p-2.5 rounded-xl border flex flex-col justify-between transition-colors ${cardStyle}`}
                                >
                                  <div className="flex items-center justify-between gap-1.5 text-[11px] mb-1.5">
                                    <span className="font-black text-slate-800 truncate">
                                      Prioridad #{item.orden} · {item.label}
                                    </span>
                                    <span
                                      title={`Posición #${item.rankRubro} de ${item.totalViables} carreras en ${item.label}`}
                                      className={`inline-flex items-center gap-1 font-black px-1.5 py-0.5 rounded text-[10px] shrink-0 ${rankBadgeStyle}`}
                                    >
                                      {rankIcon}
                                      <span>#{item.rankRubro}/{item.totalViables}</span>
                                    </span>
                                  </div>

                                  <div className="w-full h-1.5 bg-slate-200/90 rounded-full overflow-hidden mb-1.5">
                                    <div
                                      className={`h-full rounded-full ${barColor}`}
                                      style={{ width: `${Math.max(8, Math.min(100, item.score))}%` }}
                                    />
                                  </div>

                                  <span className="text-[10.5px] text-slate-600 font-semibold truncate">
                                    {item.datoReal}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between lg:flex-col lg:items-end lg:justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                        <div className="text-left lg:text-right">
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                            Afinidad (#{carrera.rankAfinidad})
                          </p>
                          <p className={`font-black ${isPodium ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'} ${
                            isBottom3 ? 'text-rose-600' : 'text-blue-600'
                          }`}>
                            {carrera.matchScore.toFixed(1)}%
                          </p>
                        </div>

                        <div className="no-print flex items-center gap-2">
                          <button
                            onClick={(e) => toggleCarreraComparar(e, carrera.cve_carrera)}
                            disabled={topeComparador}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all inline-flex items-center gap-1.5 ${
                              enComparador
                                ? 'bg-slate-900 text-white border-slate-900 cursor-pointer'
                                : topeComparador
                                  ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-500 hover:text-blue-600 cursor-pointer'
                            }`}
                          >
                            {enComparador ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Scale className="w-3.5 h-3.5" />}
                            {enComparador ? 'Comparando' : 'Comparar'}
                          </button>

                          <div className="bg-slate-100 p-2 rounded-full group-hover:bg-blue-600 transition-colors">
                            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white" />
                          </div>
                        </div>
                      </div>

                    </div>
                  </Link>
                );
              })}

              {carrerasRestantes > 0 && (
                <div className="no-print pt-5 text-center">
                  <button
                    onClick={() => setMostrarTodas(prev => !prev)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 font-bold text-xs md:text-sm text-slate-700 shadow-2xs transition-all cursor-pointer"
                  >
                    {mostrarTodas ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Contraer lista y volver al Top 10
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Mostrar las {carrerasRestantes} carreras restantes
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* BANDEJA FLOTANTE INFERIOR DEL COMPARADOR CARA A CARA (DOCK)               */}
      {/* ========================================================================= */}
      {carrerasEnVersus.length > 0 && (
        <div className="no-print fixed bottom-4 left-4 right-4 z-40 max-w-4xl mx-auto bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-blue-400 mr-1 flex items-center gap-1.5">
              <Scale className="w-4 h-4" /> Versus ({carrerasEnVersus.length}/{MAX_COMPARAR}):
            </span>
            {carrerasEnVersus.map((c: any, idx: number) => (
              <span
                key={c.cve_carrera}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORES_VERSUS[idx]?.hex }} />
                <span className="max-w-[170px] truncate">{c.nombre_carrera}</span>
                <button
                  onClick={() => setCarrerasCompararCves(prev => prev.filter(id => id !== c.cve_carrera))}
                  className="text-slate-400 hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={() => setCarrerasCompararCves([])}
              className="text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1.5 cursor-pointer"
            >
              Limpiar
            </button>
            <button
              disabled={carrerasEnVersus.length < 2}
              onClick={() => setModalVersusAbierto(true)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                carrerasEnVersus.length >= 2
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {carrerasEnVersus.length >= 2 ? '⚡ Comparar Cara a Cara' : 'Elige al menos 2 carreras'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL EJECUTIVO DE COMPARACIÓN CARA A CARA (CON EXCEL, CSV Y PDF)         */}
      {/* ========================================================================= */}
      {modalVersusAbierto && carrerasEnVersus.length >= 2 && (
        <div className="versus-print-modal fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 md:p-8 animate-in zoom-in-95 duration-200">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-blue-600 block mb-0.5">
                  Comparador Ejecutivo Cara a Cara · {infoRegActiva.corto} ({etiquetaGeneroCorto})
                </span>
                <h2 className="text-xl md:text-2xl font-black text-slate-900">
                  Contraste Directo de Indicadores y Retorno de Inversión
                </h2>
              </div>

              <div className="no-print flex flex-wrap items-center gap-2 self-end lg:self-center">
                <button
                  onClick={compartirVersusLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  {copiadoVersus ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-blue-600" />}
                  {copiadoVersus ? '¡Link copiado!' : 'Compartir Versus'}
                </button>

                <button
                  onClick={exportarVersusExcel}
                  title="Descargar Libro de Excel (.xlsx) con 2 Hojas, celdas ganadoras en verde y podio Oro/Plata/Bronce"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel (2 Hojas)
                </button>

                <button
                  onClick={exportarVersusCSV}
                  title="Descargar comparativa en formato CSV limpio"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  CSV
                </button>

                <button
                  onClick={descargarPDFVersusDirecto}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  Descargar PDF
                </button>

                <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setVistaGraficoVersus('radar')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      vistaGraficoVersus === 'radar' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" /> 6 Pilares
                  </button>
                  <button
                    onClick={() => setVistaGraficoVersus('regiones')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      vistaGraficoVersus === 'regiones' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Sueldos por Región
                  </button>
                </div>

                <button
                  onClick={() => setModalVersusAbierto(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* BLOQUE VISUAL SUPERIOR */}
            <div className="print-avoid-break grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 items-center bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
              <div className="lg:col-span-5 space-y-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  {vistaGraficoVersus === 'radar' ? (
                    <>
                      <Compass className="w-4 h-4 text-blue-600" />
                      Superposición de los 6 Pilares
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      Comparativa Salarial en las 5 Regiones
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {vistaGraficoVersus === 'radar'
                    ? `Las líneas de alto contraste y los vértices marcados muestran qué carrera envuelve a las demás en ${infoRegActiva.nombre}.`
                    : 'Contrasta cuánto paga cada una de las carreras seleccionadas a lo largo de las 5 macro-regiones económicas del país.'}
                </p>

                <div className="space-y-2.5 pt-1">
                  {carrerasEnVersus.map((c: any, idx: number) => (
                    <div
                      key={c.cve_carrera}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${COLORES_VERSUS[idx]?.light}`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 shadow-2xs"
                          style={{ backgroundColor: COLORES_VERSUS[idx]?.hex }}
                        />
                        <span className="text-xs font-black text-slate-900 leading-snug">
                          {c.nombre_carrera}
                        </span>
                      </div>
                      <span className="text-xs font-black text-slate-900 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60 shrink-0">
                        {formatoMoneda(c.sueldo_esperado)}/mes
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7 h-72 w-full bg-white rounded-2xl p-4 border border-slate-200/70 shadow-2xs">
                <ResponsiveContainer width="100%" height="100%">
                  {vistaGraficoVersus === 'radar' ? (
                    <RadarChart cx="50%" cy="50%" outerRadius="78%" data={datosRadarVersus}>
                      <PolarGrid stroke="#CBD5E1" />
                      <PolarAngleAxis dataKey="eje" tick={{ fill: '#0F172A', fontSize: 11.5, fontWeight: 800 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      {carrerasEnVersus.map((c: any, idx: number) => (
                        <Radar
                          key={c.cve_carrera}
                          name={c.nombre_carrera}
                          dataKey={c.cve_carrera}
                          stroke={COLORES_VERSUS[idx]?.hex}
                          strokeWidth={3}
                          strokeDasharray={idx === 2 ? '5 3' : undefined}
                          fill={COLORES_VERSUS[idx]?.hex}
                          fillOpacity={0.09}
                          dot={{ r: 4, fill: COLORES_VERSUS[idx]?.hex, strokeWidth: 1.5, stroke: '#FFFFFF' }}
                        />
                      ))}
                      <RechartsTooltip />
                    </RadarChart>
                  ) : (
                    <BarChart data={datosRegionesVersus} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="region" tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
                        width={44}
                        tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip formatter={(value: any) => (value ? formatoMoneda(Number(value)) : 'Sin muestra')} />
                      {carrerasEnVersus.map((c: any, idx: number) => (
                        <Bar
                          key={c.cve_carrera}
                          name={c.nombre_carrera}
                          dataKey={c.cve_carrera}
                          fill={COLORES_VERSUS[idx]?.hex}
                          radius={[6, 6, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* TABLA COMPARATIVA */}
            <div className="print-avoid-break overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs">
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider w-1/4">Indicador Auditado</th>
                    {carrerasEnVersus.map((c: any, idx: number) => (
                      <th key={c.cve_carrera} className="py-3.5 px-4 font-black min-w-[200px] align-top">
                        <div className="flex items-start gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 mt-0.5 border border-white/50"
                            style={{ backgroundColor: COLORES_VERSUS[idx]?.hex }}
                          />
                          <span className="leading-snug">{c.nombre_carrera}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {([
                    {
                      label: 'Salario Mensual Consolidado',
                      valores: carrerasEnVersus.map((c: any) => c.sueldo_esperado),
                      formato: (v: number) => `${formatoMoneda(v)} / mes`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Prima Salarial vs. Preparatoria',
                      valores: carrerasEnVersus.map((c: any) => c.premioVsPrepaPct),
                      formato: (v: number) => `${v >= 0 ? `+${v}%` : `${v}%`} vs. Prepa`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Retorno de Inversión (Univ. Pública)',
                      valores: carrerasEnVersus.map((c: any) =>
                        calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaActual, c.cve_carrera, false) ?? 999
                      ),
                      formato: (v: number) =>
                        v >= 900 ? 'Retorno negativo' : v === 1 ? '1 año de trabajo' : `${v} años de trabajo`,
                      mejorAlto: false,
                      invalidoSiMayorIgualA: 900
                    },
                    {
                      label: 'Retorno de Inversión (Univ. Privada Media)',
                      valores: carrerasEnVersus.map((c: any) =>
                        calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaActual, c.cve_carrera, true) ?? 999
                      ),
                      formato: (v: number) =>
                        v >= 900 ? 'Retorno negativo' : v === 1 ? '1 año de trabajo' : `${v} años de trabajo`,
                      mejorAlto: false,
                      invalidoSiMayorIgualA: 900
                    },
                    {
                      label: 'Inversión Requerida en Equipo (CapEx)',
                      valores: carrerasEnVersus.map((c: any) => obtenerCapExCorto(c.cve_carrera).costoEquipo),
                      formato: (v: number) =>
                        v === 18000 ? 'Básica (~$18,000 MXN)' : v === 42000 ? 'Media (~$42,000 MXN)' : 'Alta (~$85,000 MXN)',
                      mejorAlto: false,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Empleo de Calidad (Estándar OIT)',
                      valores: carrerasEnVersus.map((c: any) => c.tasaCalidadOIT),
                      formato: (v: number) => `${v}% de ocupados`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Tasa de Desempleo Abierto',
                      valores: carrerasEnVersus.map((c: any) => num(c.perfilActivo?.tasa_desempleo, 3.5)),
                      formato: (v: number) => `${v.toFixed(1)}%`,
                      mejorAlto: false,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Índice de Saturación ANUIES',
                      valores: carrerasEnVersus.map((c: any) => num(c.perfilActivo?.indice_saturacion_pct, 100)),
                      formato: (v: number) => `${v}%`,
                      mejorAlto: false,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Apertura y Movilidad Social (Mérito)',
                      valores: carrerasEnVersus.map((c: any) => Number((c.crudos?.movilidad ?? 50).toFixed(1))),
                      formato: (v: number) => `${v.toFixed(1)}% Mérito`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Blindaje Humano ante IA',
                      valores: carrerasEnVersus.map((c: any) => 100 - num(c.perfilActivo?.riesgo_ia_score, 40)),
                      formato: (v: number) => `${v}% blindaje`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Empleo Único (Sin Pluriempleo)',
                      valores: carrerasEnVersus.map((c: any) => c.pctEmpleoUnico),
                      formato: (v: number) => `${v}% un solo empleo`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    }
                  ]).map((fila, rIdx) => {
                    const valoresValidos = fila.valores.filter((v: number) => v < fila.invalidoSiMayorIgualA);
                    const mejorValor = valoresValidos.length > 0
                      ? (fila.mejorAlto ? Math.max(...valoresValidos) : Math.min(...valoresValidos))
                      : null;

                    return (
                      <tr key={rIdx} className="even:bg-slate-50/60 hover:bg-slate-100/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-700">{fila.label}</td>
                        {fila.valores.map((val: number, cIdx: number) => {
                          const esGanador = mejorValor !== null && val === mejorValor && val < fila.invalidoSiMayorIgualA;
                          return (
                            <td
                              key={cIdx}
                              className={`py-3 px-4 transition-colors ${
                                esGanador ? 'bg-emerald-50/70' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`whitespace-nowrap ${
                                  esGanador ? 'font-black text-slate-950 text-xs sm:text-sm' : 'font-semibold text-slate-600'
                                }`}>
                                  {fila.formato(val)}
                                </span>
                                {esGanador && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[10px] shrink-0">
                                    <Trophy className="w-2.5 h-2.5 text-emerald-700" /> Líder
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  <tr className="bg-slate-50/90">
                    <td className="py-3 px-4 font-bold text-slate-700">Sector Empleador Principal</td>
                    {carrerasEnVersus.map((c: any) => (
                      <td key={c.cve_carrera} className="py-3 px-4 font-bold text-slate-800">
                        {obtenerSectorDominante(c.perfilActivo)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="no-print mt-6 pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setModalVersusAbierto(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Cerrar comparador
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}