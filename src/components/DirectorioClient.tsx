"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  descargarLibroExcelXLSX,
  descargarCSVEstilizado,
  ValorCeldaExcel,
  EstiloCeldaExcel
} from '@/lib/excelReportGenerator';
import {
  Search, Microscope, ShieldCheck, ChevronRight, SlidersHorizontal,
  TrendingUp, TrendingDown, Minus, Activity, Download, Share2, Check,
  ArrowUpDown, FlaskConical, Users, Sparkles, FileSpreadsheet
} from 'lucide-react';

export type CarreraDirectorioItem = {
  cve_carrera: string;
  nombre_carrera: string;
  is_stem: boolean;
  riesgo_ia_score: number;
  sueldo_mensual: number;
  premio_prepa_pct: number;
  sueldo_2022_2023: number;
  sueldo_2025_2026: number;
  cambio_real_pct: number;
  crecimiento_anual_pct: number;
  calidad_oit_pct: number;
  formalidad_total_pct: number;
  desempleo_pct: number;
  saturacion_pct: number;
  pea_activa: number;
  n_encuestados: number;
  costo_capex: number;
  roi_publica_anios: number;
  roi_privada_anios: number;
  sector_lider: string;
  tendencia_etiqueta: string;
  tendencia_codigo: 'crecimiento' | 'estable' | 'ajuste' | 'volatil';
};

type OrdenDirectorio = 'salario_desc' | 'salario_asc' | 'saturacion_asc' | 'ia_asc' | 'alfabetico';

const formatoMoneda = (valor: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor || 0);

function BadgeTendenciaMini({ codigo, etiqueta }: { codigo: string; etiqueta: string }) {
  if (codigo === 'crecimiento') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <TrendingUp className="w-3 h-3" /> {etiqueta}
      </span>
    );
  }
  if (codigo === 'ajuste') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <TrendingDown className="w-3 h-3" /> {etiqueta}
      </span>
    );
  }
  if (codigo === 'volatil') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        <Activity className="w-3 h-3" /> {etiqueta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
      <Minus className="w-3.5 h-3.5" /> {etiqueta}
    </span>
  );
}

export default function DirectorioClient({ directorio }: { directorio: CarreraDirectorioItem[] }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroStem, setFiltroStem] = useState(false);
  const [filtroRiesgo, setFiltroRiesgo] = useState(false);
  const [orden, setOrden] = useState<OrdenDirectorio>('salario_desc');
  const [copiado, setCopiado] = useState(false);

  const mediaSalarialCatalogo = useMemo(() => {
    if (directorio.length === 0) return 15534;
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
        carrera.cve_carrera.includes(q);

      const pasaFiltroStem = filtroStem ? carrera.is_stem : true;
      const pasaFiltroRiesgo = filtroRiesgo ? carrera.riesgo_ia_score <= 40 : true;

      return coincideTexto && pasaFiltroStem && pasaFiltroRiesgo;
    });

    return [...filtradas].sort((a, b) => {
      if (orden === 'salario_desc') return b.sueldo_mensual - a.sueldo_mensual;
      if (orden === 'salario_asc') return a.sueldo_mensual - b.sueldo_mensual;
      if (orden === 'saturacion_asc') return a.saturacion_pct - b.saturacion_pct;
      if (orden === 'ia_asc') return a.riesgo_ia_score - b.riesgo_ia_score;
      return a.nombre_carrera.localeCompare(b.nombre_carrera, 'es');
    });
  }, [busqueda, filtroStem, filtroRiesgo, orden, directorio]);

  const construirDatosExportacionCatalogo = () => {
    const cabeceras = [
      'Posicion',
      'CVE_Carrera',
      'Nombre_Carrera',
      'Es_STEM',
      'Salario_Mensual_MXN',
      'Prima_vs_Prepa_Pct',
      'Tendencia_2021_2026',
      'Salario_Base_2022_2023_MXN',
      'Salario_Reciente_2025_2026_MXN',
      'Cambio_Real_PostPandemia_Pct',
      'Crecimiento_Anual_Pct',
      'Empleo_Calidad_OIT_Pct',
      'Formalidad_Total_Pct',
      'Desempleo_Abierto_Pct',
      'Saturacion_ANUIES_Pct',
      'Blindaje_IA_Pct',
      'Inversion_Equipo_CapEx_MXN',
      'ROI_Univ_Publica_Anios',
      'ROI_Univ_Privada_Anios',
      'Sector_Empleador_Lider',
      'PEA_Activa_Nacional',
      'Muestra_Encuestados_INEGI'
    ];

    const filas: ValorCeldaExcel[][] = carrerasFiltradas.map((c, idx) => {
      const pos = idx + 1;
      const estiloPodio: EstiloCeldaExcel | undefined =
        pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : undefined;

      const celda = (v: string | number): ValorCeldaExcel =>
        estiloPodio ? { v, s: estiloPodio } : v;

      return [
        celda(pos),
        celda(c.cve_carrera),
        celda(c.nombre_carrera),
        celda(c.is_stem ? 'Sí' : 'No'),
        celda(c.sueldo_mensual),
        celda(c.premio_prepa_pct),
        celda(c.tendencia_etiqueta),
        celda(c.sueldo_2022_2023),
        celda(c.sueldo_2025_2026),
        celda(c.cambio_real_pct),
        celda(c.crecimiento_anual_pct),
        celda(c.calidad_oit_pct),
        celda(c.formalidad_total_pct),
        celda(c.desempleo_pct),
        celda(c.saturacion_pct),
        celda(100 - c.riesgo_ia_score),
        celda(c.costo_capex),
        celda(c.roi_publica_anios),
        celda(c.roi_privada_anios),
        celda(c.sector_lider),
        celda(c.pea_activa),
        celda(c.n_encuestados)
      ];
    });

    return { cabeceras, filas };
  };

  const exportarCatalogoExcel = () => {
    const { cabeceras, filas } = construirDatosExportacionCatalogo();
    descargarLibroExcelXLSX(
      `DataROI_Catalogo_Nacional_${carrerasFiltradas.length}_Carreras.xlsx`,
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
            ['Total de Carreras Exportadas', carrerasFiltradas.length, 'Filtradas según los criterios activos en el Directorio Nacional'],
            ['Media Salarial Licenciatura Nacional', mediaSalarialCatalogo, 'MXN / mes (Pesos constantes de 2026 deflactados con INPC)'],
            ['Salario Base Preparatoria Nacional', 10608, 'MXN / mes (Benchmark de referencia para cálculo de Prima y ROI)'],
            ['Muestra Física Total Auditada', totalEncuestadosCatalogo, 'Profesionistas encuestados físicamente en microdatos ENOE INEGI'],
            ['Criterio de Ordenamiento Aplicado', orden, 'Orden activo al momento de la exportación']
          ]
        }
      ]
    );
  };

  const exportarCatalogoCSV = () => {
    const { cabeceras, filas } = construirDatosExportacionCatalogo();
    descargarCSVEstilizado(
      `DataROI_Catalogo_Nacional_${carrerasFiltradas.length}_Carreras.csv`,
      cabeceras,
      filas
    );
  };

  const compartirDirectorio = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'DataROI México — Directorio Nacional de Carreras',
          text: 'Consulta el retorno de inversión, salarios reales INEGI y riesgo IA de las 64 licenciaturas en México.',
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
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      
      {/* CABECERA EJECUTIVA */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 md:p-8 mb-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Microdatos ENOE INEGI (2021–2026) + ANUIES
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-2">
              DataROI México
            </h1>
            <p className="text-sm md:text-base text-slate-600 max-w-2xl leading-relaxed">
              Sistema de apoyo a la decisión vocacional y auditoría de retorno de inversión universitaria en las 5 macro-regiones económicas del país.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/descubrir"
              className="px-5 py-3 rounded-2xl text-xs md:text-sm font-black flex items-center gap-2 transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Descubridor y Comparador
            </Link>

            <Link
              href="/laboratorio"
              className="px-4 py-3 rounded-2xl text-xs md:text-sm font-bold flex items-center gap-2 transition-all bg-slate-900 text-white hover:bg-slate-800 shadow-xs"
            >
              <FlaskConical className="w-4 h-4 text-emerald-400" />
              Laboratorio de Datos Crudos
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Catálogo Auditado</span>
            <strong className="text-lg font-black text-slate-900">{directorio.length} Licenciaturas</strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Media Salarial Licenciatura</span>
            <strong className="text-lg font-black text-emerald-600">{formatoMoneda(mediaSalarialCatalogo)} / mes</strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Muestra Física Auditada</span>
            <strong className="text-lg font-black text-slate-900">{totalEncuestadosCatalogo.toLocaleString('es-MX')} prof.</strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px] block">Exportar / Compartir</span>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <button
                  onClick={exportarCatalogoExcel}
                  title="Descargar libro de Excel (.xlsx) con colores de podio y columnas auto-ajustadas"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                >
                  <FileSpreadsheet className="w-3 h-3" /> Excel
                </button>
                <button
                  onClick={exportarCatalogoCSV}
                  title="Descargar archivo plano CSV compatible con Python/pandas"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-blue-400 text-slate-700 font-bold text-[11px] cursor-pointer"
                >
                  <Download className="w-3 h-3 text-blue-600" /> CSV
                </button>
                <button
                  onClick={compartirDirectorio}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-blue-400 text-slate-700 font-bold text-[11px] cursor-pointer"
                >
                  {copiado ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3 text-blue-600" />}
                  {copiado ? 'Copiado' : 'Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DE BÚSQUEDA, FILTROS RÁPIDOS Y ORDENAMIENTO */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs mb-6 flex flex-col lg:flex-row gap-3 items-center justify-between">
        
        <div className="relative w-full lg:w-96 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs md:text-sm bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder="Buscar carrera por nombre o clave CVE (ej. 061300)..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFiltroStem(!filtroStem)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                filtroStem
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Microscope className="w-3.5 h-3.5" />
              Solo STEM
            </button>

            <button
              onClick={() => setFiltroRiesgo(!filtroRiesgo)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                filtroRiesgo
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Blindadas vs IA (≤40% riesgo)
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenDirectorio)}
              className="bg-transparent border-none text-xs font-bold text-slate-800 focus:ring-0 cursor-pointer outline-none"
            >
              <option value="salario_desc">Mayor Salario ($ a $)</option>
              <option value="salario_asc">Menor Salario ($ a $)</option>
              <option value="saturacion_asc">Menor Saturación ANUIES</option>
              <option value="ia_asc">Mayor Blindaje ante IA</option>
              <option value="alfabetico">Orden Alfabético (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* CONTADOR */}
      <div className="mb-4 flex items-center justify-between text-xs text-slate-500 font-bold px-1">
        <span>Mostrando {carrerasFiltradas.length} de {directorio.length} carreras certificadas</span>
        <span>Referencia Nacional Base Preparatoria: $10,608 / mes</span>
      </div>

      {/* CUADRÍCULA DE TARJETAS */}
      {carrerasFiltradas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {carrerasFiltradas.map((carrera) => {
            const blindajeIA = 100 - carrera.riesgo_ia_score;
            return (
              <Link
                key={carrera.cve_carrera}
                href={`/carrera/${carrera.cve_carrera}`}
                className="group bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-slate-100 text-slate-700 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border border-slate-200">
                        CVE: {carrera.cve_carrera}
                      </span>
                      {carrera.is_stem && (
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Microscope className="w-3 h-3" /> STEM
                        </span>
                      )}
                    </div>

                    <BadgeTendenciaMini
                      codigo={carrera.tendencia_codigo}
                      etiqueta={carrera.tendencia_etiqueta}
                    />
                  </div>

                  <h2 className="text-base md:text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-snug mb-3">
                    {carrera.nombre_carrera}
                  </h2>

                  <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Salario Consolidado
                      </span>
                      <span className="text-2xl font-black text-slate-900">
                        {formatoMoneda(carrera.sueldo_mensual)}
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold ml-1">/mes</span>
                    </div>

                    <span className={`text-xs font-black px-2 py-0.5 rounded-md border ${
                      carrera.premio_prepa_pct >= 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {carrera.premio_prepa_pct >= 0 ? `+${carrera.premio_prepa_pct}%` : `${carrera.premio_prepa_pct}%`} vs. Prepa
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Calidad OIT</span>
                      <strong className="text-slate-800 font-black">{carrera.calidad_oit_pct}%</strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Saturación</span>
                      <strong className="text-slate-800 font-black">{carrera.saturacion_pct}%</strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Blindaje IA</span>
                      <strong className="text-slate-800 font-black">{blindajeIA}%</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 group-hover:text-blue-600">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      PEA: {carrera.pea_activa.toLocaleString('es-MX')} ocup.
                    </span>
                    <span className="inline-flex items-center gap-1">
                      Abrir dashboard <ChevronRight className="w-4 h-4" />
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