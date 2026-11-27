"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  descargarLibroExcelXLSX,
  descargarCSVEstilizado,
  obtenerSemaforoScoreDataROI,
  leerEstadoDescubridorGlobal,
  toggleCarreraComparadorGlobal,
  EVENTO_VERSUS_SYNC,
  ValorCeldaExcel
} from '@/lib/excelReportGenerator';
import {
  Search, Microscope, ShieldCheck, ChevronRight,
  TrendingUp, TrendingDown, Minus, Activity, Download, Share2, Check,
  ArrowUpDown, FileSpreadsheet, Scale
} from 'lucide-react';

export type CarreraDirectorioItem = {
  cve_carrera: string;
  nombre_carrera: string;
  nombre_oficial_inegi?: string;
  is_stem: boolean;
  riesgo_ia_score: number;
  sueldo_mensual: number;
  premio_prepa_pct: number;
  sueldo_base_tendencia: number;
  sueldo_reciente_cierre: number;
  cambio_real_pct: number;
  crecimiento_anual_pct: number;
  calidad_oit_pct: number;
  formalidad_total_pct: number;
  desempleo_pct: number;
  saturacion_pct: number;
  meritocracia_pct: number;
  score_dataroi: number;
  pea_activa: number;
  n_encuestados: number;
  costo_capex: number;
  roi_publica_anios: number;
  roi_privada_anios: number;
  sector_lider: string;
  tendencia_etiqueta: string;
  tendencia_codigo: 'crecimiento' | 'estable' | 'ajuste' | 'volatil';
};

type OrdenDirectorio = 'score_desc' | 'salario_desc' | 'salario_asc' | 'saturacion_asc' | 'ia_asc' | 'alfabetico';

const ETIQUETAS_ORDEN_HUMANO: Record<OrdenDirectorio, string> = {
  score_desc: 'Mayor Calificación DataROI (0–100)',
  salario_desc: 'Mayor Salario Mensual ($ a $)',
  salario_asc: 'Menor Salario Mensual ($ a $)',
  saturacion_asc: 'Menor Saturación de Egresados ANUIES',
  ia_asc: 'Mayor Blindaje Humano ante IA',
  alfabetico: 'Orden Alfabético (A–Z)'
};

const COLORES_SLOTS_VERSUS = [
  { hex: '#2563EB', btnClass: 'bg-blue-600 text-white border-blue-600 shadow-xs' },
  { hex: '#9333EA', btnClass: 'bg-purple-600 text-white border-purple-600 shadow-xs' },
  { hex: '#EA580C', btnClass: 'bg-orange-600 text-white border-orange-600 shadow-xs' }
];

const formatoMoneda = (valor: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor || 0);

function MedallonScoreEntero({ score }: { score: number }) {
  const sem = obtenerSemaforoScoreDataROI(score);
  const scoreEntero = Math.round(score);
  const r = 23;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, scoreEntero));
  const offset = circ - (pct / 100) * circ;

  return (
    <div
      role="img"
      aria-label={`Calificación Integral DataROI: ${scoreEntero} de 100 puntos, Grado ${sem.grado}, ${sem.etiqueta}`}
      title={`Calificación Integral DataROI: ${scoreEntero} / 100 (Grado ${sem.grado} · ${sem.etiqueta})`}
      className="flex flex-col items-center shrink-0"
    >
      <div className="relative w-14 h-14 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
        <svg className="w-14 h-14 -rotate-90 drop-shadow-2xs" viewBox="0 0 56 56" aria-hidden="true">
          <circle
            cx="28"
            cy="28"
            r={r}
            fill={sem.fillTintHex}
            stroke={sem.trackHex}
            strokeWidth="4.8"
          />
          <circle
            cx="28"
            cy="28"
            r={r}
            fill="none"
            stroke={sem.colorHex}
            strokeWidth="4.8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-xl font-black text-slate-900 tracking-tight">{scoreEntero}</span>
        </div>
      </div>
      <span className={`text-[10px] font-black uppercase tracking-wider mt-1 ${sem.textClass}`}>
        Grado {sem.grado}
      </span>
    </div>
  );
}

function BadgeTendenciaMini({ codigo, etiqueta }: { codigo: string; etiqueta: string }) {
  if (codigo === 'crecimiento') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <TrendingUp className="w-3 h-3" aria-hidden="true" /> {etiqueta}
      </span>
    );
  }
  if (codigo === 'ajuste') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <TrendingDown className="w-3 h-3" aria-hidden="true" /> {etiqueta}
      </span>
    );
  }
  if (codigo === 'volatil') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        <Activity className="w-3 h-3" aria-hidden="true" /> {etiqueta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
      <Minus className="w-3 h-3" aria-hidden="true" /> {etiqueta}
    </span>
  );
}

export default function DirectorioClient({
  directorio,
  sueldoPrepaNacional = 10608,
  rangoTexto = '2021–2026',
  cierreTexto = '2025–2026',
  etiquetaCorte = '2026 Q2',
  etiquetaPesosBase = 'Pesos constantes'
}: {
  directorio: CarreraDirectorioItem[];
  sueldoPrepaNacional?: number;
  rangoTexto?: string;
  cierreTexto?: string;
  etiquetaCorte?: string;
  etiquetaPesosBase?: string;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroStem, setFiltroStem] = useState(false);
  const [filtroRiesgo, setFiltroRiesgo] = useState(false);
  const [orden, setOrden] = useState<OrdenDirectorio>('score_desc');
  const [copiado, setCopiado] = useState(false);
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

  const handleToggleComparar = (e: React.MouseEvent, cve: string) => {
    e.preventDefault();
    e.stopPropagation();
    const nuevaLista = toggleCarreraComparadorGlobal(cve);
    setCvesVersus(nuevaLista);
  };

  const mediaSalarialCatalogo = useMemo(() => {
    if (directorio.length === 0) return 0;
    const sumaPob = directorio.reduce((acc, c) => acc + Math.max(1, c.pea_activa), 0);
    const sumaProd = directorio.reduce((acc, c) => acc + c.sueldo_mensual * Math.max(1, c.pea_activa), 0);
    return Math.round(sumaProd / sumaPob);
  }, [directorio]);

  const totalEncuestadosCatalogo = useMemo(() => {
    return directorio.reduce((acc, c) => acc + (c.n_encuestados || 0), 0);
  }, [directorio]);

  const carrerasFiltradas = useMemo(() => {
    const filtradas = directorio.filter((carrera) => {
      const q = busqueda.toLowerCase().trim();
      const coincideTexto =
        carrera.nombre_carrera.toLowerCase().includes(q) ||
        (carrera.nombre_oficial_inegi || '').toLowerCase().includes(q) ||
        carrera.cve_carrera.includes(q);

      const pasaFiltroStem = filtroStem ? carrera.is_stem : true;
      const pasaFiltroRiesgo = filtroRiesgo ? carrera.riesgo_ia_score <= 40 : true;

      return coincideTexto && pasaFiltroStem && pasaFiltroRiesgo;
    });

    return [...filtradas].sort((a, b) => {
      if (orden === 'score_desc') {
        if (b.score_dataroi !== a.score_dataroi) return b.score_dataroi - a.score_dataroi;
        return b.sueldo_mensual - a.sueldo_mensual;
      }
      if (orden === 'salario_desc') return b.sueldo_mensual - a.sueldo_mensual;
      if (orden === 'salario_asc') return a.sueldo_mensual - b.sueldo_mensual;
      if (orden === 'saturacion_asc') return a.saturacion_pct - b.saturacion_pct;
      if (orden === 'ia_asc') return a.riesgo_ia_score - b.riesgo_ia_score;
      return a.nombre_carrera.localeCompare(b.nombre_carrera, 'es');
    });
  }, [busqueda, filtroStem, filtroRiesgo, orden, directorio]);

  const construirDatosExportacionCatalogo = () => {
    const cabeceras = [
      'Orden_Lista',
      'CVE_Carrera',
      'Nombre_Carrera',
      'Es_STEM',
      'Score_DataROI_0_100',
      'Grado_Viabilidad',
      'Salario_Mensual_MXN',
      'Prima_vs_Prepa_Pct',
      `Tendencia_${rangoTexto.replace(/[^0-9]/g, '_')}`,
      'Salario_Base_Inicio_MXN',
      `Salario_Cierre_${cierreTexto.replace(/[^0-9]/g, '_')}_MXN`,
      'Cambio_Real_Acumulado_Pct',
      'Crecimiento_Anual_Pct',
      'Empleo_Calidad_OIT_Pct',
      'Formalidad_Total_Pct',
      'Desempleo_Abierto_Pct',
      'Saturacion_ANUIES_Pct',
      'Meritocracia_Pct',
      'Blindaje_IA_Pct',
      'Inversion_Equipo_CapEx_MXN',
      'ROI_Univ_Publica_Anios',
      'ROI_Univ_Privada_Anios',
      'Sector_Empleador_Lider',
      'PEA_Activa_Nacional',
      'Muestra_Encuestados_INEGI'
    ];

    const filas: ValorCeldaExcel[][] = carrerasFiltradas.map((c, idx) => {
      const sem = obtenerSemaforoScoreDataROI(c.score_dataroi);
      return [
        idx + 1,
        c.cve_carrera,
        { v: c.nombre_carrera, s: 'bold' },
        c.is_stem ? 'Sí' : 'No',
        { v: Math.round(c.score_dataroi), s: sem.grado === 'A' ? 'winner' : sem.grado === 'C' ? 'warning' : 'bold' },
        `Grado ${sem.grado} — ${sem.etiqueta}`,
        { v: c.sueldo_mensual, s: 'bold' },
        c.premio_prepa_pct,
        c.tendencia_etiqueta,
        c.sueldo_base_tendencia,
        c.sueldo_reciente_cierre,
        c.cambio_real_pct,
        c.crecimiento_anual_pct,
        c.calidad_oit_pct,
        c.formalidad_total_pct,
        c.desempleo_pct,
        c.saturacion_pct,
        c.meritocracia_pct,
        100 - c.riesgo_ia_score,
        c.costo_capex,
        c.roi_publica_anios,
        c.roi_privada_anios,
        c.sector_lider,
        c.pea_activa,
        c.n_encuestados
      ];
    });

    return { cabeceras, filas };
  };

  const exportarCatalogoExcel = () => {
    const { cabeceras, filas } = construirDatosExportacionCatalogo();
    descargarLibroExcelXLSX(
      `DataROI_Catalogo_Nacional_${carrerasFiltradas.length}_Carreras_${etiquetaCorte.replace(/\s+/g, '_')}.xlsx`,
      [
        {
          nombre: '1_Catalogo_Nacional',
          cabeceras,
          filas
        },
        {
          nombre: '2_Contexto_Metodologico',
          cabeceras: ['Parametro_Global', 'Valor_Auditado', 'Detalle_Metodologico'],
          filas: [
            ['Último Corte Oficial Cargado', etiquetaCorte, `Serie histórica ENOE ${rangoTexto} (Cierre ${cierreTexto})`],
            ['Total de Carreras Exportadas', `${carrerasFiltradas.length} de ${directorio.length} licenciaturas`, 'Filtradas según los criterios activos en el Catálogo Nacional'],
            ['Criterio de Ordenamiento Aplicado', ETIQUETAS_ORDEN_HUMANO[orden], 'Orden activo en pantalla al momento de exportar el catálogo'],
            ['Media Salarial Licenciatura Nacional', `${formatoMoneda(mediaSalarialCatalogo)} MXN / mes`, `${etiquetaPesosBase} deflactados con el INPC`],
            ['Salario Base Preparatoria Nacional', `${formatoMoneda(sueldoPrepaNacional)} MXN / mes`, 'Benchmark vivo desde Supabase para Prima Salarial y ROI'],
            ['Muestra Física Total Auditada', `${totalEncuestadosCatalogo.toLocaleString('es-MX')} encuestados`, 'Profesionistas encuestados físicamente en microdatos ENOE INEGI']
          ]
        }
      ]
    );
  };

  const exportarCatalogoCSV = () => {
    const { cabeceras, filas } = construirDatosExportacionCatalogo();
    descargarCSVEstilizado(
      `DataROI_Catalogo_Nacional_${carrerasFiltradas.length}_Carreras_${etiquetaCorte.replace(/\s+/g, '_')}.csv`,
      cabeceras,
      filas
    );
  };

  const compartirDirectorio = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'DataROI México — Catálogo Nacional de Carreras',
          text: `Consulta la Calificación Integral DataROI, salarios reales INEGI (${etiquetaCorte}) y riesgo IA de las ${directorio.length} licenciaturas certificadas en México.`,
          url
        });
        return;
      } catch {
        // Fallback al portapapeles
      }
    }
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:px-8 md:py-5">
      
      {/* BLOQUE HERO EJECUTIVO DE ALTO CONTRASTE */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white rounded-3xl p-6 md:p-8 mb-6 shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-extrabold uppercase tracking-wider mb-3">
              Catálogo Nacional Auditado · Microdatos ENOE INEGI ({rangoTexto} · Corte {etiquetaCorte}) + ANUIES
            </span>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight mb-2">
              Explora y Compara las {directorio.length} Licenciaturas de México
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Cada carrera es evaluada del <strong>0 al 100</strong> según sus 6 Pilares Estructurales reales observados en el mercado laboral mexicano. Selecciona hasta 3 carreras con el botón <strong>+ Comparar</strong> para contrastarlas Cara a Cara.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0 text-xs">
            <div className="bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700/80">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">Media Licenciatura</span>
              <strong className="text-lg font-black text-emerald-400 mt-0.5 block">
                {formatoMoneda(mediaSalarialCatalogo)}/mes
              </strong>
              <span className="text-[10px] text-slate-400">vs. {formatoMoneda(sueldoPrepaNacional)} Prepa</span>
            </div>

            <div className="bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700/80">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">Muestra Física</span>
              <strong className="text-lg font-black text-white mt-0.5 block">
                {totalEncuestadosCatalogo.toLocaleString('es-MX')}
              </strong>
              <span className="text-[10px] text-slate-400">encuestados INEGI</span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700/80 flex flex-col justify-between">
              <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1.5">Descargar Catálogo</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={exportarCatalogoExcel}
                  title="Descargar libro de Excel (.xlsx) con 2 hojas"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[11px] transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" /> Excel
                </button>
                <button
                  onClick={exportarCatalogoCSV}
                  title="Descargar archivo CSV"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-[11px] transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" /> CSV
                </button>
                <button
                  onClick={compartirDirectorio}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-[11px] transition-all cursor-pointer"
                >
                  {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Share2 className="w-3.5 h-3.5" aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DE BÚSQUEDA, FILTROS RÁPIDOS Y ORDENAMIENTO */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs mb-5 flex flex-col lg:flex-row gap-3 items-center justify-between">
        
        <div className="relative w-full lg:w-96 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
          <input
            type="search"
            aria-label="Buscar carrera por nombre o clave CVE"
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs md:text-sm bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder="Buscar carrera por nombre o clave CVE (ej. 061300)..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex flex-wrap items-center gap-2">
            <button
              aria-pressed={filtroStem}
              onClick={() => setFiltroStem(!filtroStem)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border cursor-pointer ${
                filtroStem
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Microscope className="w-3.5 h-3.5" aria-hidden="true" />
              Solo STEM
            </button>

            <button
              aria-pressed={filtroRiesgo}
              onClick={() => setFiltroRiesgo(!filtroRiesgo)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border cursor-pointer ${
                filtroRiesgo
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Blindadas vs IA (≤40% riesgo)
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
            <select
              aria-label="Criterio de ordenamiento del catálogo"
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenDirectorio)}
              className="bg-transparent border-none text-xs font-bold text-slate-800 focus:ring-0 cursor-pointer outline-none"
            >
              <option value="score_desc">Mayor Calificación DataROI (0–100)</option>
              <option value="salario_desc">Mayor Salario ($ a $)</option>
              <option value="salario_asc">Menor Salario ($ a $)</option>
              <option value="saturacion_asc">Menor Saturación ANUIES</option>
              <option value="ia_asc">Mayor Blindaje ante IA</option>
              <option value="alfabetico">Orden Alfabético (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* CONTADOR Y LEYENDA DEL SEMÁFORO DATAROI */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-bold px-1">
        <span aria-live="polite">Mostrando {carrerasFiltradas.length} de {directorio.length} carreras certificadas</span>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
            <strong>Grado A (70–100):</strong> Sobresaliente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true" />
            <strong>Grado B (56–69):</strong> Viable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" aria-hidden="true" />
            <strong>Grado C ({'<56'}):</strong> En Riesgo
          </span>
        </div>
      </div>

      {/* CUADRÍCULA DE TARJETAS CON FÍSICA TÁCTIL Y SOMBRA COLOREADA POR GRADO */}
      {carrerasFiltradas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {carrerasFiltradas.map((carrera) => {
            const sem = obtenerSemaforoScoreDataROI(carrera.score_dataroi);
            const blindajeIA = Math.round(100 - carrera.riesgo_ia_score);
            const calOitEntero = Math.round(carrera.calidad_oit_pct);
            const primaEntero = Math.round(carrera.premio_prepa_pct);
            const satEntero = Math.round(carrera.saturacion_pct);

            const idxVersus = cvesVersus.indexOf(carrera.cve_carrera);
            const enComparador = idxVersus !== -1;
            const topeComparador = !enComparador && cvesVersus.length >= 3;
            const slotEstilo = enComparador ? COLORES_SLOTS_VERSUS[idxVersus] || COLORES_SLOTS_VERSUS[0] : null;

            const satEstado =
              satEntero <= 85
                ? { txt: 'Baja', colText: 'text-emerald-700', colBar: 'bg-gradient-to-r from-emerald-600 to-teal-400' }
                : satEntero <= 115
                  ? { txt: 'Media', colText: 'text-blue-700', colBar: 'bg-gradient-to-r from-blue-600 to-sky-400' }
                  : { txt: 'Alta', colText: 'text-rose-700', colBar: 'bg-gradient-to-r from-rose-600 to-orange-500' };

            const hoverShadowPorGrado =
              sem.grado === 'A'
                ? 'hover:shadow-[0_20px_38px_-12px_rgba(5,150,105,0.22)] hover:border-emerald-400'
                : sem.grado === 'B'
                  ? 'hover:shadow-[0_20px_38px_-12px_rgba(217,119,6,0.22)] hover:border-amber-400'
                  : 'hover:shadow-[0_20px_38px_-12px_rgba(225,29,72,0.22)] hover:border-rose-400';

            return (
              <Link
                key={carrera.cve_carrera}
                href={`/carrera/${carrera.cve_carrera}`}
                className={`group bg-gradient-to-b from-white via-white to-slate-50/80 p-5 rounded-2xl border border-slate-200/90 border-t-4 ${sem.topBorderClass} shadow-xs hover:-translate-y-1.5 ${hoverShadowPorGrado} transition-all duration-300 ease-out flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className="bg-slate-100 text-slate-700 text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md border border-slate-200">
                          CVE: {carrera.cve_carrera}
                        </span>
                        {carrera.is_stem && (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            <Microscope className="w-3 h-3" aria-hidden="true" /> STEM
                          </span>
                        )}
                        <BadgeTendenciaMini
                          codigo={carrera.tendencia_codigo}
                          etiqueta={carrera.tendencia_etiqueta}
                        />
                      </div>

                      <h2
                        title={carrera.nombre_oficial_inegi || carrera.nombre_carrera}
                        className="text-base md:text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-snug line-clamp-2"
                      >
                        {carrera.nombre_carrera}
                      </h2>
                    </div>

                    <MedallonScoreEntero score={carrera.score_dataroi} />
                  </div>

                  <div className="flex items-baseline justify-between gap-2 pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Salario Mensual Consolidado
                      </span>
                      <span className="text-2xl font-black text-slate-900">
                        {formatoMoneda(carrera.sueldo_mensual)}
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold ml-1">/mes</span>
                    </div>

                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                      primaEntero >= 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {primaEntero >= 0 ? `+${primaEntero}%` : `${primaEntero}%`} vs. Prepa
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-3 gap-2.5 text-[11px] mb-3.5">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-500 font-bold text-[10px]">Calidad OIT</span>
                        <strong className="text-slate-900 font-black">{calOitEntero}%</strong>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(10, Math.min(100, calOitEntero))}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-500 font-bold text-[10px]">Saturación</span>
                        <strong className={`font-black ${satEstado.colText}`}>{satEntero}%</strong>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${satEstado.colBar}`}
                          style={{ width: `${Math.max(12, Math.min(100, (satEntero / 180) * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-500 font-bold text-[10px]">Blindaje IA</span>
                        <strong className="text-slate-900 font-black">{blindajeIA}%</strong>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            blindajeIA >= 60
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                              : 'bg-gradient-to-r from-indigo-600 to-purple-500'
                          }`}
                          style={{ width: `${Math.max(10, Math.min(100, blindajeIA))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      aria-pressed={enComparador}
                      disabled={topeComparador}
                      onClick={(e) => handleToggleComparar(e, carrera.cve_carrera)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 inline-flex items-center gap-1.5 ${
                        enComparador && slotEstilo
                          ? `${slotEstilo.btnClass} cursor-pointer`
                          : topeComparador
                            ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 shadow-2xs cursor-pointer'
                      }`}
                    >
                      {enComparador ? (
                        <>
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>En Versus #{idxVersus + 1}</span>
                        </>
                      ) : (
                        <>
                          <Scale className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>+ Comparar</span>
                        </>
                      )}
                    </button>

                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-slate-600 group-hover:text-blue-600 transition-colors">
                      <span>PEA: {(carrera.pea_activa / 1000).toFixed(0)}k · Abrir</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="text-slate-600 font-bold text-sm">No se encontraron carreras con esos criterios de búsqueda.</p>
          <button
            onClick={() => { setBusqueda(''); setFiltroStem(false); setFiltroRiesgo(false); }}
            className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer"
          >
            Restablecer filtros
          </button>
        </div>
      )}
    </div>
  );
}