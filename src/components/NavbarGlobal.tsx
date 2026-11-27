"use client";

import React, { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { descargarComparativaVersusPDF } from '@/lib/pdfReportGenerator';
import {
  descargarLibroExcelXLSX,
  descargarCSVEstilizado,
  calcularScoreDataROIUniversal,
  obtenerSemaforoScoreDataROI,
  leerEstadoDescubridorGlobal,
  toggleCarreraComparadorGlobal,
  limpiarComparadorGlobal,
  formatearNombreCarreraEjecutivo,
  STORAGE_KEY_DESCUBRIDOR,
  EVENTO_VERSUS_SYNC,
  ValorCeldaExcel,
  EstiloCeldaExcel
} from '@/lib/excelReportGenerator';
import {
  REGIONES_ORDEN,
  MACRO_REGIONES_5,
  REGIONES_META,
  EVENTO_DATOS_ACTUALIZADOS,
  META_PIPELINE_FALLBACK,
  CodigoGenero,
  RegionClave,
  DimCarreraRow,
  BenchmarkPrepaRow,
  SatelitePrepaRow,
  MetaPipelineInfo,
  cargarCatalogoCarreras,
  cargarBenchmarksPrepaRows,
  cargarSatelitesPrepaRows,
  cargarMetaPipeline,
  construirBenchmarksPrepaMap,
  calcularVentanasTemporales,
  calcularSueldoConsolidadoCelda,
  clasificarTendenciaRealDinamica,
  calcularIndicadoresSatelite,
  calcularAniosRetornoDinamico,
  obtenerCapExDinamico,
  calcularPercentil,
  normalizarSalarioRadarDinamico,
  descargarTodoPaginado,
  esCeldaSateliteValida,
  normalizarRegion,
  padCve,
  numSeguro
} from '@/lib/dataroiEngine';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import {
  Compass,
  FlaskConical,
  LayoutGrid,
  Scale,
  X,
  Trash2,
  Zap,
  Info,
  Share2,
  FileSpreadsheet,
  Download,
  Printer,
  BarChart3,
  Trophy,
  Check,
  Loader2,
  MapPin,
  Users,
  ExternalLink,
  UploadCloud
} from 'lucide-react';

export const EVENTO_ABRIR_MODAL_VERSUS = 'dataroi-open-versus-modal';

const COLORES_DOTS = ['#2563EB', '#9333EA', '#EA580C'];

const COLORES_VERSUS = [
  {
    hex: '#2563EB',
    bg: 'bg-blue-600',
    text: 'text-blue-700',
    light: 'bg-blue-50/70 border-blue-200'
  },
  {
    hex: '#9333EA',
    bg: 'bg-purple-600',
    text: 'text-purple-700',
    light: 'bg-purple-50/70 border-purple-200'
  },
  {
    hex: '#EA580C',
    bg: 'bg-orange-600',
    text: 'text-orange-800',
    light: 'bg-orange-50/70 border-orange-200'
  }
];

const formatoMoneda = (valor: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor || 0);

function obtenerSectorDominante(p: any): string {
  const sectores = [
    { label: 'PYME', val: numSeguro(p?.pct_pyme, 0) },
    { label: 'Independiente / Micro', val: numSeguro(p?.pct_micro, 0) },
    { label: 'Gran Corporativo', val: numSeguro(p?.pct_corp, 0) },
    { label: 'Gobierno', val: numSeguro(p?.pct_gobierno, 0) }
  ].sort((a, b) => b.val - a.val);
  return `${sectores[0].val.toFixed(1)}% ${sectores[0].label}`;
}

function AnilloScoreCompactoModal({ score }: { score: number }) {
  const sem = obtenerSemaforoScoreDataROI(score);
  const scoreEntero = Math.round(score);
  const r = 17;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.max(0, Math.min(100, scoreEntero)) / 100) * circ;

  return (
    <div
      role="img"
      aria-label={`Calificación DataROI: ${scoreEntero} de 100, Grado ${sem.grado}`}
      title={`Calificación DataROI: ${scoreEntero}/100 (Grado ${sem.grado} · ${sem.etiqueta})`}
      className="relative w-11 h-11 flex items-center justify-center shrink-0"
    >
      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r={r} fill={sem.fillTintHex} stroke={sem.trackHex} strokeWidth="3.8" />
        <circle
          cx="21"
          cy="21"
          r={r}
          fill="none"
          stroke={sem.colorHex}
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-xs font-black text-slate-900 leading-none">{scoreEntero}</span>
    </div>
  );
}

function NavbarGlobalContenido() {
  const pathname = usePathname() || '/';

  const [cvesVersus, setCvesVersus] = useState<string[]>([]);
  const [popoverAbierto, setPopoverAbierto] = useState(false);

  // Smart Auto-Hide al hacer scroll
  const [navbarVisible, setNavbarVisible] = useState(true);
  const ultimoScrollYRef = useRef(0);

  // Metadatos globales vivos desde Supabase
  const [catalogoCarreras, setCatalogoCarreras] = useState<DimCarreraRow[]>([]);
  const [totalCarrerasCertificadas, setTotalCarrerasCertificadas] = useState<number | null>(null);
  const [prepaRows, setPrepaRows] = useState<BenchmarkPrepaRow[]>([]);
  const [satPrepaRows, setSatPrepaRows] = useState<SatelitePrepaRow[]>([]);
  const [metaPipeline, setMetaPipeline] = useState<MetaPipelineInfo>(META_PIPELINE_FALLBACK);
  const [mediasSatPorRegSexo, setMediasSatPorRegSexo] = useState<Record<string, { estrato: number; nepotismo: number }>>({});
  const [percentilesSalarioGlobal, setPercentilesSalarioGlobal] = useState<{ p05: number; p95: number }>({ p05: 9500, p95: 22000 });
  const [reloadMetaTick, setReloadMetaTick] = useState(0);

  // Estado del Modal Global Independiente
  const [modalVersusAbierto, setModalVersusAbierto] = useState(false);
  const [regionVersus, setRegionVersus] = useState<RegionClave>('nacional');
  const [generoVersus, setGeneroVersus] = useState<CodigoGenero>(0);
  const [vistaGraficoVersus, setVistaGraficoVersus] = useState<'radar' | 'regiones'>('radar');
  const [cargandoVersus, setCargandoVersus] = useState(false);
  const [copiadoVersus, setCopiadoVersus] = useState(false);
  const [versionCache, setVersionCache] = useState(0);

  const cacheVersusRef = useRef<Record<string, { satelites: any[]; series: any[] }>>({});
  const contenedorPopoverRef = useRef<HTMLDivElement>(null);

  // Smart Auto-Hide: oculta al bajar, reaparece al subir; siempre visible arriba o con menús abiertos
  useEffect(() => {
    if (popoverAbierto || modalVersusAbierto) {
      setNavbarVisible(true);
      return;
    }

    const onScroll = () => {
      const y = window.scrollY;
      if (y <= 64) {
        setNavbarVisible(true);
      } else if (y > ultimoScrollYRef.current + 8) {
        setNavbarVisible(false);
      } else if (y < ultimoScrollYRef.current - 6) {
        setNavbarVisible(true);
      }
      ultimoScrollYRef.current = y;
    };

    ultimoScrollYRef.current = window.scrollY;
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [popoverAbierto, modalVersusAbierto]);

  // Cargar metadatos vivos (dim_carreras, conteo certificado, benchmarks_prepa, satelites_prepa, meta_pipeline y medias)
  useEffect(() => {
    let cancelado = false;
    async function cargarMetadatosGlobales() {
      const [catRows, metaInfo, benchRows, satPrepaData, satRes] = await Promise.all([
        cargarCatalogoCarreras(supabase),
        cargarMetaPipeline(supabase),
        cargarBenchmarksPrepaRows(supabase),
        cargarSatelitesPrepaRows(supabase),
        descargarTodoPaginado(() =>
          supabase
            .from('satelites_cultura')
            .select('cve_carrera, region, sexo, n_encuestados_reales, n_efectivo_kish, volumen_muestra_nacional, indice_privilegio, pct_nepotismo')
            .order('cve_carrera', { ascending: true })
            .order('region', { ascending: true })
            .order('sexo', { ascending: true })
        )
      ]);

      if (cancelado) return;

      setCatalogoCarreras(catRows);
      setMetaPipeline(metaInfo);
      setPrepaRows(benchRows);
      setSatPrepaRows(satPrepaData);

      const certificadasNac = satRes.filter(
        (s: any) =>
          padCve(s.cve_carrera) !== '999999' &&
          normalizarRegion(s.region) === 'nacional' &&
          Number(s.sexo ?? 0) === 0 &&
          esCeldaSateliteValida(s, 'nacional', 0)
      );
      setTotalCarrerasCertificadas(certificadasNac.length);

      const acum: Record<string, { w: number; est: number; nep: number }> = {};
      satRes.forEach((s: any) => {
        const reg = normalizarRegion(s.region);
        const sx = Number(s.sexo ?? 0) as CodigoGenero;
        if (!esCeldaSateliteValida(s, reg, sx)) return;
        const k = `${reg}_${sx}`;
        const w = Math.max(1, numSeguro(s.volumen_muestra_nacional, 1));
        if (!acum[k]) acum[k] = { w: 0, est: 0, nep: 0 };
        acum[k].w += w;
        acum[k].est += numSeguro(s.indice_privilegio, 2.8) * w;
        acum[k].nep += numSeguro(s.pct_nepotismo, 37.2) * w;
      });

      const mapaMedias: Record<string, { estrato: number; nepotismo: number }> = {};
      Object.entries(acum).forEach(([k, val]) => {
        if (val.w > 0) {
          mapaMedias[k] = {
            estrato: Number((val.est / val.w).toFixed(2)),
            nepotismo: Number((val.nep / val.w).toFixed(1))
          };
        }
      });
      setMediasSatPorRegSexo(mapaMedias);

      const { data: ultSueldos } = await supabase
        .from('predicciones_roi')
        .select('sueldo_promedio_mensual')
        .eq('tipo_dato', 'Real')
        .eq('anio', metaInfo.ultimo_anio)
        .in('cve_ent', ['nacional', '0', '00'])
        .eq('sexo', 0);

      if (!cancelado && ultSueldos && ultSueldos.length >= 4) {
        const vals = ultSueldos.map((r: any) => numSeguro(r.sueldo_promedio_mensual, 0)).filter(v => v > 0);
        if (vals.length >= 4) {
          setPercentilesSalarioGlobal({
            p05: Math.round(calcularPercentil(vals, 0.05)),
            p95: Math.round(calcularPercentil(vals, 0.95))
          });
        }
      }
    }

    cargarMetadatosGlobales();
    return () => {
      cancelado = true;
    };
  }, [reloadMetaTick]);

  // Limpiar caché de Versus y recargar metadatos si llega una actualización desde /actualizar
  useEffect(() => {
    const onDataUpdated = () => {
      cacheVersusRef.current = {};
      setVersionCache(v => v + 1);
      setReloadMetaTick(t => t + 1);
    };
    window.addEventListener(EVENTO_DATOS_ACTUALIZADOS, onDataUpdated);
    return () => window.removeEventListener(EVENTO_DATOS_ACTUALIZADOS, onDataUpdated);
  }, []);

  const mapaCatalogo = useMemo(() => {
    const m: Record<string, DimCarreraRow> = {};
    catalogoCarreras.forEach(c => {
      m[padCve(c.cve_carrera)] = c;
    });
    return m;
  }, [catalogoCarreras]);

  const obtenerNombreCortoPorCve = (cve: string): string => {
    const pad = padCve(cve);
    const row = mapaCatalogo[pad];
    if (row) {
      return row.nombre_ejecutivo || formatearNombreCarreraEjecutivo(pad, row.nombre_carrera);
    }
    return formatearNombreCarreraEjecutivo(pad, `Carrera ${pad}`);
  };

  // Sincronización global con el estado del comparador
  useEffect(() => {
    const sincronizar = () => {
      const est = leerEstadoDescubridorGlobal();
      setCvesVersus(est.carrerasCompararCves || []);
      if (est.regionActiva && (REGIONES_ORDEN as readonly string[]).includes(est.regionActiva)) {
        setRegionVersus(est.regionActiva as RegionClave);
      }
      if (est.generoActivo === 0 || est.generoActivo === 1 || est.generoActivo === 2) {
        setGeneroVersus(est.generoActivo);
      }
    };

    const abrirModalPorEvento = () => {
      sincronizar();
      const est = leerEstadoDescubridorGlobal();
      if ((est.carrerasCompararCves || []).length >= 2) {
        setPopoverAbierto(false);
        setModalVersusAbierto(true);
      }
    };

    sincronizar();
    window.addEventListener(EVENTO_VERSUS_SYNC, sincronizar);
    window.addEventListener(EVENTO_ABRIR_MODAL_VERSUS, abrirModalPorEvento);
    window.addEventListener('storage', sincronizar);
    return () => {
      window.removeEventListener(EVENTO_VERSUS_SYNC, sincronizar);
      window.removeEventListener(EVENTO_ABRIR_MODAL_VERSUS, abrirModalPorEvento);
      window.removeEventListener('storage', sincronizar);
    };
  }, [pathname]);

  useEffect(() => {
    setPopoverAbierto(false);
    setNavbarVisible(true);
  }, [pathname]);

  useEffect(() => {
    if (cvesVersus.length < 2 && modalVersusAbierto) {
      setModalVersusAbierto(false);
    }
  }, [cvesVersus.length, modalVersusAbierto]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contenedorPopoverRef.current && !contenedorPopoverRef.current.contains(e.target as Node)) {
        setPopoverAbierto(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalVersusAbierto) setModalVersusAbierto(false);
        else if (popoverAbierto) setPopoverAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [popoverAbierto, modalVersusAbierto]);

  // Carga bajo demanda de las 2 o 3 carreras del Modal Global
  useEffect(() => {
    if (!modalVersusAbierto || cvesVersus.length < 2) return;

    const faltantes = cvesVersus.filter(cve => !cacheVersusRef.current[padCve(cve)]);
    if (faltantes.length === 0) return;

    let cancelado = false;
    async function cargarDatosVersus() {
      setCargandoVersus(true);
      const variantes = Array.from(
        new Set(faltantes.flatMap(cve => [padCve(cve), String(Number(cve))]))
      );

      const [sats, sers] = await Promise.all([
        descargarTodoPaginado(() =>
          supabase
            .from('satelites_cultura')
            .select('*')
            .in('cve_carrera', variantes)
            .order('cve_carrera', { ascending: true })
            .order('region', { ascending: true })
            .order('sexo', { ascending: true })
        ),
        descargarTodoPaginado(() =>
          supabase
            .from('predicciones_roi')
            .select('cve_carrera, cve_ent, anio, sexo, tipo_dato, poblacion_activa_total, desempleados_reales, sueldo_promedio_mensual, indice_saturacion_pct')
            .eq('tipo_dato', 'Real')
            .in('cve_carrera', variantes)
            .order('cve_carrera', { ascending: true })
            .order('cve_ent', { ascending: true })
            .order('sexo', { ascending: true })
            .order('anio', { ascending: true })
        )
      ]);

      if (cancelado) return;

      faltantes.forEach(cveRaw => {
        const cvePad = padCve(cveRaw);
        const satsC = (sats || []).filter((r: any) => padCve(r.cve_carrera) === cvePad);
        const sersC = (sers || [])
          .filter((r: any) => padCve(r.cve_carrera) === cvePad)
          .map((r: any) => ({
            ...r,
            cve_carrera: cvePad,
            cve_ent: normalizarRegion(r.cve_ent),
            sexo: Number(r.sexo ?? 0),
            anio: Number(r.anio)
          }));

        cacheVersusRef.current[cvePad] = {
          satelites: satsC,
          series: sersC
        };
      });

      setCargandoVersus(false);
      setVersionCache(v => v + 1);
    }

    cargarDatosVersus();
    return () => {
      cancelado = true;
    };
  }, [modalVersusAbierto, cvesVersus, reloadMetaTick]);

  const esCatalogo = pathname === '/';
  const esDescubridor = pathname.startsWith('/descubrir');
  const esLaboratorio = pathname.startsWith('/laboratorio');
  const esActualizar = pathname.startsWith('/actualizar');
  const esCarrera = pathname.startsWith('/carrera');

  const quitarCarreraDesdeNavbar = (cve: string) => {
    const nueva = toggleCarreraComparadorGlobal(cve);
    setCvesVersus(nueva);
  };

  const limpiarTodasDesdeNavbar = () => {
    limpiarComparadorGlobal();
    setCvesVersus([]);
    setPopoverAbierto(false);
    setModalVersusAbierto(false);
  };

  const ejecutarComparativaCaraACara = () => {
    if (cvesVersus.length < 2) return;
    const est = leerEstadoDescubridorGlobal();
    if (est.regionActiva && (REGIONES_ORDEN as readonly string[]).includes(est.regionActiva)) {
      setRegionVersus(est.regionActiva as RegionClave);
    }
    if (est.generoActivo === 0 || est.generoActivo === 1 || est.generoActivo === 2) {
      setGeneroVersus(est.generoActivo);
    }
    setPopoverAbierto(false);
    setModalVersusAbierto(true);
  };

  const actualizarRegionVersus = (nuevaReg: RegionClave) => {
    setRegionVersus(nuevaReg);
    try {
      const actual = leerEstadoDescubridorGlobal();
      sessionStorage.setItem(STORAGE_KEY_DESCUBRIDOR, JSON.stringify({ ...actual, regionActiva: nuevaReg }));
    } catch {
      // Sin impacto
    }
  };

  const actualizarGeneroVersus = (nuevoGen: CodigoGenero) => {
    setGeneroVersus(nuevoGen);
    try {
      const actual = leerEstadoDescubridorGlobal();
      sessionStorage.setItem(STORAGE_KEY_DESCUBRIDOR, JSON.stringify({ ...actual, generoActivo: nuevoGen }));
    } catch {
      // Sin impacto
    }
  };

  const { ventanasVersus, benchPrepaMap } = useMemo(() => {
    const aniosCache: number[] = [];
    cvesVersus.forEach(cve => {
      const cached = cacheVersusRef.current[padCve(cve)];
      if (cached) {
        cached.series.forEach(s => aniosCache.push(Number(s.anio)));
      }
    });
    const v = calcularVentanasTemporales(aniosCache, metaPipeline);
    return {
      ventanasVersus: v,
      benchPrepaMap: construirBenchmarksPrepaMap(prepaRows, v, satPrepaRows)
    };
  }, [cvesVersus, versionCache, metaPipeline, prepaRows, satPrepaRows]);

  const infoRegVersus = REGIONES_META[regionVersus] || REGIONES_META.nacional;
  const sueldoPrepaVersus =
    benchPrepaMap[regionVersus]?.sueldo_prepa[generoVersus] ??
    benchPrepaMap.nacional.sueldo_prepa[0];
  const calidadOitPrepaVersus =
    benchPrepaMap[regionVersus]?.calidad_oit_prepa_pct[generoVersus] ?? null;
  const mediasCtxVersus =
    mediasSatPorRegSexo[`${regionVersus}_${generoVersus}`] ||
    mediasSatPorRegSexo['nacional_0'] ||
    { estrato: 2.80, nepotismo: 37.2 };

  const etiquetaGeneroVersus =
    generoVersus === 2 ? 'Solo Mujeres' : generoVersus === 1 ? 'Solo Hombres' : 'Total General';
  const queryGeneroVersus =
    generoVersus === 2 ? 'mujeres' : generoVersus === 1 ? 'hombres' : 'total';

  const carrerasEnVersus = useMemo(() => {
    if (!modalVersusAbierto || cvesVersus.length < 2) return [];

    return cvesVersus.map(cveRaw => {
      const cvePad = padCve(cveRaw);
      const cached = cacheVersusRef.current[cvePad];
      const metaCar = mapaCatalogo[cvePad];
      const nombre = obtenerNombreCortoPorCve(cvePad);
      const semestresDefault = metaCar?.semestres_default ?? (cvePad === '091100' ? 12 : 9);
      const capexMxn = metaCar?.capex_mxn ?? null;

      if (!cached) {
        return {
          cve_carrera: cvePad,
          nombre_carrera: nombre,
          semestres_default: semestresDefault,
          capex_mxn: capexMxn,
          sueldo_esperado: 0,
          premioVsPrepaPct: 0,
          tasaCalidadOIT: 0,
          tasaFormalidadTotal: 0,
          pctEmpleoUnico: 0,
          pctArraigoLocal: 0,
          scoreDataROI: 0,
          perfilActivo: {},
          crudos: { movilidad: 50 },
          pilaresRadar: { Salario: 50, Formalidad: 50, Empleabilidad: 50, Meritocracia: 50, 'Blindaje IA': 50, Estabilidad: 50 },
          perfiles: {}
        };
      }

      const sats = cached.satelites;
      const sers = cached.series;

      const buscarSat = (reg: RegionClave, sx: CodigoGenero) =>
        sats.find((r: any) => normalizarRegion(r.region) === reg && Number(r.sexo ?? 0) === sx);

      const obtenerSer = (reg: RegionClave, sx: CodigoGenero) => {
        const dir = sers.filter((r: any) => r.cve_ent === reg && r.sexo === sx);
        if (dir.length > 0) return dir;
        if (sx === 0) return sers.filter((r: any) => r.cve_ent === reg && (r.sexo === 1 || r.sexo === 2));
        return [];
      };

      const serieNacSx = obtenerSer('nacional', generoVersus);
      const sueldoNacRef = calcularSueldoConsolidadoCelda(serieNacSx, ventanasVersus);
      const tendenciaNac = clasificarTendenciaRealDinamica(serieNacSx, ventanasVersus);

      const perfilesPorRegion: Record<string, Record<number, any>> = {};
      REGIONES_ORDEN.forEach(rKey => {
        const satRk = buscarSat(rKey, generoVersus);
        const celdaValida = esCeldaSateliteValida(satRk, rKey, generoVersus);
        const serRk = obtenerSer(rKey, generoVersus);
        const fRkEmp = serRk.filter((r: any) => ventanasVersus.aniosEmpleo.includes(r.anio));
        const loteEmp = fRkEmp.length > 0 ? fRkEmp : serRk;

        const sueldoRk = calcularSueldoConsolidadoCelda(serRk, ventanasVersus, sueldoNacRef);

        const pea = loteEmp.length > 0
          ? Math.round(loteEmp.reduce((a: number, b: any) => a + numSeguro(b.poblacion_activa_total, 0), 0) / loteEmp.length)
          : 0;

        perfilesPorRegion[rKey] = {
          [generoVersus]: {
            celdaValida: celdaValida && sueldoRk > 0 && pea >= 100,
            sueldo_esperado: sueldoRk
          }
        };
      });

      const satExacto = buscarSat(regionVersus, generoVersus);
      const satActivo = satExacto || buscarSat(regionVersus, 0) || buscarSat('nacional', generoVersus) || buscarSat('nacional', 0) || {};
      const serieAct = obtenerSer(regionVersus, generoVersus);
      const loteAct = serieAct.length > 0 ? serieAct : serieNacSx;
      const fActEmp = loteAct.filter((r: any) => ventanasVersus.aniosEmpleo.includes(r.anio));
      const loteEmpAct = fActEmp.length > 0 ? fActEmp : loteAct;

      const sumaPea = loteEmpAct.reduce((a: number, b: any) => a + numSeguro(b.poblacion_activa_total, 0), 0);
      const sumaDes = loteEmpAct.reduce((a: number, b: any) => a + numSeguro(b.desempleados_reales, 0), 0);
      const tasaDesempleo = sumaPea > 0 ? Number(Math.max(0.8, (sumaDes / sumaPea) * 100).toFixed(1)) : 3.2;

      const filaRec = loteAct.find((r: any) => r.anio === ventanasVersus.anioMax) || loteAct[loteAct.length - 1];
      const satRaw = numSeguro(filaRec?.indice_saturacion_pct, 92);
      const saturacion = satRaw > 5 ? Math.round(satRaw) : 92;

      const tendAct = loteAct.length >= 4 ? clasificarTendenciaRealDinamica(loteAct, ventanasVersus) : tendenciaNac;
      const sueldoEsp = perfilesPorRegion[regionVersus]?.[generoVersus]?.sueldo_esperado || sueldoNacRef;

      const ind = calcularIndicadoresSatelite({
        sat: satActivo,
        sueldoMensual: sueldoEsp,
        sueldoPrepa: sueldoPrepaVersus,
        mediaEstratoContexto: mediasCtxVersus.estrato,
        mediaNepotismoContexto: mediasCtxVersus.nepotismo
      });

      const pContrato = numSeguro(satActivo.pct_contrato, 65);
      const pPluri = numSeguro(satActivo.pct_pluriempleo, 5.5);
      const pDesarr = numSeguro(satActivo.pct_desarraigo, 2.7);
      const hrsH = numSeguro(satActivo.hrs_doble_jornada_hombres, 9.6);
      const hrsM = numSeguro(satActivo.hrs_doble_jornada_mujeres, 21.1);
      const hrsHogar = generoVersus === 1 ? hrsH : generoVersus === 2 ? hrsM : Number(((hrsH + hrsM) / 2).toFixed(1));

      const evalUniversal = calcularScoreDataROIUniversal({
        Prima_vs_Prepa_Pct: ind.primaPrepaPct,
        Desempleo_Abierto_Pct: tasaDesempleo,
        Saturacion_ANUIES_Pct: saturacion,
        Empleo_Calidad_OIT_Pct: ind.calidadOitPct,
        Formalidad_Total_Pct: ind.formalidadTotalPct,
        Meritocracia_Pct: ind.meritocraciaPct,
        Blindaje_IA_Pct: ind.blindajeIAPct,
        Tendencia_Codigo: tendAct.codigo,
        Empleo_Unico_Pct: ind.pctEmpleoUnico,
        Arraigo_Local_Pct: ind.pctArraigoLocal
      });

      const radarSalario = normalizarSalarioRadarDinamico(sueldoEsp, percentilesSalarioGlobal.p05, percentilesSalarioGlobal.p95);
      const radarEmpleo = Math.round(
        Math.max(10, Math.min(100, 100 - tasaDesempleo * 8)) * 0.60 +
        Math.max(10, Math.min(100, 168 - saturacion)) * 0.40
      );
      const radarEstabilidad = Math.round(
        Math.max(10, Math.min(100, 100 - pPluri * 5)) * 0.35 +
        Math.max(10, Math.min(100, 100 - pDesarr * 6.5)) * 0.30 +
        pContrato * 0.35
      );

      return {
        cve_carrera: cvePad,
        nombre_carrera: nombre,
        semestres_default: semestresDefault,
        capex_mxn: capexMxn,
        sueldo_esperado: sueldoEsp,
        premioVsPrepaPct: ind.primaPrepaPct,
        tasaCalidadOIT: ind.calidadOitPct,
        tasaFormalidadTotal: ind.formalidadTotalPct,
        pctEmpleoUnico: ind.pctEmpleoUnico,
        pctArraigoLocal: ind.pctArraigoLocal,
        scoreDataROI: evalUniversal.score,
        perfilActivo: {
          ...satActivo,
          tasa_desempleo: tasaDesempleo,
          indice_saturacion_pct: saturacion,
          tendencia_salarial: tendAct.etiqueta,
          tendencia_codigo: tendAct.codigo,
          hrs_hogar_activa: hrsHogar
        },
        crudos: { movilidad: ind.meritocraciaPct },
        pilaresRadar: {
          Salario: radarSalario,
          Formalidad: Math.round(ind.formalidadTotalPct),
          Empleabilidad: radarEmpleo,
          Meritocracia: Math.round(ind.meritocraciaPct),
          'Blindaje IA': evalUniversal.pilares.blindajeFuturo,
          Estabilidad: radarEstabilidad
        },
        perfiles: perfilesPorRegion
      };
    });
  }, [
    modalVersusAbierto,
    cvesVersus,
    versionCache,
    regionVersus,
    generoVersus,
    sueldoPrepaVersus,
    mediasCtxVersus,
    ventanasVersus,
    percentilesSalarioGlobal,
    mapaCatalogo
  ]);

  const datosRadarVersus = useMemo(() => {
    if (carrerasEnVersus.length < 2) return [];
    const ejes = ['Salario', 'Formalidad', 'Empleabilidad', 'Meritocracia', 'Blindaje IA', 'Estabilidad'] as const;
    return ejes.map(eje => {
      const punto: Record<string, any> = { eje };
      carrerasEnVersus.forEach((c: any) => {
        punto[c.cve_carrera] = c.pilaresRadar?.[eje] ?? 50;
      });
      return punto;
    });
  }, [carrerasEnVersus]);

  const datosRegionesVersus = useMemo(() => {
    if (carrerasEnVersus.length < 2) return [];
    return MACRO_REGIONES_5.map(rKey => {
      const punto: Record<string, any> = {
        region: REGIONES_META[rKey].corto
      };
      carrerasEnVersus.forEach((c: any) => {
        const perfilR = c.perfiles?.[rKey]?.[generoVersus];
        punto[c.cve_carrera] =
          perfilR && perfilR.celdaValida !== false && Number(perfilR.sueldo_esperado) > 0
            ? Number(perfilR.sueldo_esperado)
            : null;
      });
      return punto;
    });
  }, [carrerasEnVersus, generoVersus]);

  const compartirVersusLink = async () => {
    const params = new URLSearchParams();
    params.set('region', regionVersus);
    params.set('genero', queryGeneroVersus);
    params.set('comparar', cvesVersus.join(','));
    const url = `${window.location.origin}/descubrir?${params.toString().replace(/%2C/gi, ',')}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Comparativa DataROI (${metaPipeline.etiqueta_corte}) en ${infoRegVersus.corto} (${etiquetaGeneroVersus})`,
          text: `Contraste directo de ${carrerasEnVersus.map((c: any) => c.nombre_carrera).join(' vs. ')}`,
          url
        });
        return;
      } catch {
        // Fallback al portapapeles
      }
    }
    await navigator.clipboard.writeText(url);
    setCopiadoVersus(true);
    setTimeout(() => setCopiadoVersus(false), 2200);
  };

  const construirHojasVersus = () => {
    const conteoVictorias = carrerasEnVersus.map(() => 0);

    const encontrarLider = (valores: number[], mejorAlto: boolean, invalido = Infinity) => {
      const validos = valores.filter(v => v < invalido && v > -900);
      if (validos.length === 0) return 'N/D';
      const mejor = mejorAlto ? Math.max(...validos) : Math.min(...validos);
      const ganadores = carrerasEnVersus
        .filter((_: any, i: number) => valores[i] === mejor && valores[i] < invalido)
        .map((c: any) => c.nombre_carrera);
      return ganadores.length === carrerasEnVersus.length ? 'Empate técnico' : ganadores.join(' / ');
    };

    const registrarFilaNumerica = (
      cat: string,
      ind: string,
      vals: number[],
      fmt: (v: number) => string,
      mejorAlto: boolean,
      invalido = Infinity
    ): ValorCeldaExcel[] => {
      const validos = vals.filter(v => v < invalido && v > -900);
      const mejor = validos.length > 0 ? (mejorAlto ? Math.max(...validos) : Math.min(...validos)) : null;

      const celdasCarreras: ValorCeldaExcel[] = vals.map((v, idx) => {
        const esGanador = mejor !== null && v === mejor && v < invalido;
        if (esGanador) conteoVictorias[idx] += 1;
        const txt = fmt(v);
        return esGanador ? { v: `★ ${txt}`, s: 'winner' } : txt;
      });

      return [cat, ind, ...celdasCarreras, encontrarLider(vals, mejorAlto, invalido)];
    };

    // Fila descriptiva (ej. Ecosistema Empleador): muestra quién tiene mayor inserción sin alterar el Podio Global objetivo
    const filaDescriptiva = (
      cat: string,
      ind: string,
      vals: number[],
      fmt: (v: number) => string
    ): ValorCeldaExcel[] => {
      const mayor = encontrarLider(vals, true);
      return [cat, ind, ...vals.map(v => fmt(v)), `Mayor inserción: ${mayor}`];
    };

    const cabecerasMatriz = [
      'Categoria',
      'Indicador_Auditado',
      ...carrerasEnVersus.map((c: any) => `${c.nombre_carrera} (${c.cve_carrera})`),
      'Carrera_Lider_del_Rubro'
    ];

    const ejesRadar = ['Salario', 'Formalidad', 'Empleabilidad', 'Meritocracia', 'Blindaje IA', 'Estabilidad'] as const;
    const filasRadar: ValorCeldaExcel[][] = ejesRadar.map(eje => {
      const vals = carrerasEnVersus.map((c: any) => Number(c.pilaresRadar?.[eje] ?? 50));
      return registrarFilaNumerica('2. Huella de 6 Pilares (0-100)', `Pilar ${eje} (Score 0-100)`, vals, v => `${v} / 100`, true);
    });

    const fmtAnios = (v: number) => (v >= 900 ? 'Retorno negativo' : v === 1 ? '1 año' : `${v} años`);

    const filasHoja1: ValorCeldaExcel[][] = [
      ['1. Contexto y Trazabilidad', 'Último Corte Oficial Cargado', ...carrerasEnVersus.map(() => `${metaPipeline.etiqueta_corte} (${ventanasVersus.rangoTexto})`), metaPipeline.etiqueta_pesos_base],
      ['1. Contexto y Trazabilidad', 'Macro-Región y Perfil Evaluado', ...carrerasEnVersus.map(() => `${infoRegVersus.nombre} (${etiquetaGeneroVersus})`), 'Contexto Activo'],
      [
        '1. Contexto y Trazabilidad',
        'Base Preparatoria de Referencia',
        ...carrerasEnVersus.map(() =>
          calidadOitPrepaVersus != null
            ? `${formatoMoneda(sueldoPrepaVersus)} / mes · OIT ${calidadOitPrepaVersus}%`
            : `${formatoMoneda(sueldoPrepaVersus)} / mes`
        ),
        'Benchmark Vivo Supabase'
      ],
      registrarFilaNumerica('1. Contexto y Trazabilidad', 'Muestra Física Certificada INEGI', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.n_encuestados_reales, 0)), v => `${v} encuestados`, true),
      registrarFilaNumerica('1. Calificación Global', 'Calificación Integral DataROI (0 a 100)', carrerasEnVersus.map((c: any) => Math.round(Number(c.scoreDataROI ?? 60))), v => `${v} / 100 pts`, true),
      ...filasRadar,
      registrarFilaNumerica('3. Salario y Retorno (ROI)', 'Salario Mensual Consolidado', carrerasEnVersus.map((c: any) => c.sueldo_esperado), v => `${formatoMoneda(v)} / mes`, true),
      registrarFilaNumerica('3. Salario y Retorno (ROI)', 'Prima Salarial vs. Preparatoria', carrerasEnVersus.map((c: any) => c.premioVsPrepaPct), v => `${v >= 0 ? `+${v}%` : `${v}%`} vs. Prepa`, true),
      ['3. Salario y Retorno (ROI)', `Tendencia Salarial Real (${ventanasVersus.rangoTexto})`, ...carrerasEnVersus.map((c: any) => c.perfilActivo?.tendencia_salarial || 'Estable'), 'Trayectoria INPC'],
      registrarFilaNumerica(
        '3. Salario y Retorno (ROI)',
        'Retorno Inversión Univ. Pública',
        carrerasEnVersus.map((c: any) =>
          calcularAniosRetornoDinamico({
            sueldoCarrera: c.sueldo_esperado,
            sueldoPrepa: sueldoPrepaVersus,
            cve: c.cve_carrera,
            escenario: 'publica',
            semestres: c.semestres_default,
            capexMxn: c.capex_mxn,
            costosRoi: metaPipeline.costos_roi
          }) ?? 999
        ),
        fmtAnios,
        false,
        900
      ),
      registrarFilaNumerica(
        '3. Salario y Retorno (ROI)',
        'Retorno Inversión Univ. Privada Media',
        carrerasEnVersus.map((c: any) =>
          calcularAniosRetornoDinamico({
            sueldoCarrera: c.sueldo_esperado,
            sueldoPrepa: sueldoPrepaVersus,
            cve: c.cve_carrera,
            escenario: 'privada_media',
            semestres: c.semestres_default,
            capexMxn: c.capex_mxn,
            costosRoi: metaPipeline.costos_roi
          }) ?? 999
        ),
        fmtAnios,
        false,
        900
      ),
      registrarFilaNumerica('3. Salario y Retorno (ROI)', 'Inversión Requerida en Equipo (CapEx)', carrerasEnVersus.map((c: any) => obtenerCapExDinamico(c.cve_carrera, c.capex_mxn).costoEquipo), v => formatoMoneda(v), false),
      registrarFilaNumerica('4. Calidad y Mercado Laboral', 'Empleo de Calidad (Estándar OIT)', carrerasEnVersus.map((c: any) => c.tasaCalidadOIT), v => `${v}%`, true),
      registrarFilaNumerica('4. Calidad y Mercado Laboral', 'Formalidad Laboral Total', carrerasEnVersus.map((c: any) => c.tasaFormalidadTotal), v => `${v}%`, true),
      registrarFilaNumerica('4. Calidad y Mercado Laboral', 'Tasa de Desempleo Abierto', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.tasa_desempleo, 3.5)), v => `${v.toFixed(1)}%`, false),
      registrarFilaNumerica('4. Calidad y Mercado Laboral', 'Índice de Saturación ANUIES', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.indice_saturacion_pct, 100)), v => `${v}%`, false),
      ['4. Calidad y Mercado Laboral', 'Sector Empleador Dominante', ...carrerasEnVersus.map((c: any) => obtenerSectorDominante(c.perfilActivo)), 'Composición INEGI'],
      // 4 filas restauradas de Ecosistema Empleador
      filaDescriptiva('5. Ecosistema Empleador', 'Gran Corporativo y Transnacional (>100 emp.)', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_corp, 0)), v => `${v.toFixed(1)}%`),
      filaDescriptiva('5. Ecosistema Empleador', 'Sector PYME (Empresas 6–100 empleados)', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_pyme, 0)), v => `${v.toFixed(1)}%`),
      filaDescriptiva('5. Ecosistema Empleador', 'Microempresa y Práctica Independiente', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_micro, 0)), v => `${v.toFixed(1)}%`),
      filaDescriptiva('5. Ecosistema Empleador', 'Administración Pública y Gobierno', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_gobierno, 0)), v => `${v.toFixed(1)}%`),
      // 6 filas restauradas de Escalera de Prestaciones
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Contrato Escrito Estable', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_contrato, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Aguinaldo de Ley', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_aguinaldo, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Fondo de Retiro (AFORE)', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_afore, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Seguro Médico Privado (SGMM)', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_sgmm, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Afiliación Sindical / Gremial', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_sindicato, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('6. Escalera de Prestaciones', 'Protección Materna / Paterna', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_materno, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Apertura y Movilidad Social (% Mérito)', carrerasEnVersus.map((c: any) => Number((c.crudos?.movilidad ?? 50).toFixed(1))), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Estrato Socioeconómico de Origen (1 a 4)', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.indice_privilegio, 2.8)), v => `${v.toFixed(2)} / 4`, false),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Contratación por Contactos / Nepotismo', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_nepotismo, 37)), v => `${v.toFixed(1)}%`, false),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Blindaje Humano ante IA', carrerasEnVersus.map((c: any) => 100 - numSeguro(c.perfilActivo?.riesgo_ia_score, 40)), v => `${v}%`, true),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Trabajo Remoto / Home Office', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_home_office, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Jornada de Medio Tiempo (<30h)', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.pct_medio_tiempo, 14)), v => `${v.toFixed(1)}%`, false),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Trabajo Doméstico No Remunerado (Hrs/sem)', carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.hrs_hogar_activa, 15)), v => `${v.toFixed(1)} hrs`, false),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Empleo Único sin Pluriempleo', carrerasEnVersus.map((c: any) => c.pctEmpleoUnico), v => `${v}%`, true),
      registrarFilaNumerica('7. Movilidad, Barreras y Futuro', 'Arraigo Local sin Migrar de Estado', carrerasEnVersus.map((c: any) => c.pctArraigoLocal), v => `${v}%`, true)
    ];

    const victoriasUnicas = Array.from(new Set(conteoVictorias)).sort((a, b) => b - a);
    const celdasPodioFinal: ValorCeldaExcel[] = conteoVictorias.map(v => {
      const posPodio = victoriasUnicas.indexOf(v) + 1;
      const medalla = posPodio === 1 ? '🥇 1° LUGAR (ORO)' : posPodio === 2 ? '🥈 2° LUGAR (PLATA)' : '🥉 3° LUGAR (BRONCE)';
      const estilo: EstiloCeldaExcel = posPodio === 1 ? 'gold' : posPodio === 2 ? 'silver' : 'bronze';
      return { v: `${medalla} — ${v} rubros ganados`, s: estilo };
    });

    filasHoja1.push([
      { v: '8. Veredicto y Podio Global', s: 'section' },
      { v: 'Podio por Total de Indicadores Liderados', s: 'section' },
      ...celdasPodioFinal,
      encontrarLider(conteoVictorias, true)
    ]);

    const filasHoja2: ValorCeldaExcel[][] = REGIONES_ORDEN.map(rKey => {
      const metaR = REGIONES_META[rKey];
      const prepaR = benchPrepaMap[rKey]?.sueldo_prepa[generoVersus] ?? sueldoPrepaVersus;
      const vals = carrerasEnVersus.map((c: any) => {
        const pr = c.perfiles?.[rKey]?.[generoVersus];
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

  const corteSlug = metaPipeline.etiqueta_corte.replace(/\s+/g, '_');

  const exportarVersusExcel = () => {
    if (carrerasEnVersus.length < 2) return;
    const { cabecerasMatriz, filasHoja1, filasHoja2 } = construirHojasVersus();
    descargarLibroExcelXLSX(
      `DataROI_Versus_${regionVersus}_${queryGeneroVersus}_${cvesVersus.join('_')}_${corteSlug}.xlsx`,
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
      `DataROI_Versus_${regionVersus}_${queryGeneroVersus}_${cvesVersus.join('_')}_${corteSlug}.csv`,
      cabecerasMatriz,
      filasHoja1
    );
  };

  const descargarPDFVersusDirecto = () => {
    if (carrerasEnVersus.length < 2) return;
    descargarComparativaVersusPDF({
      regionNombre: infoRegVersus.nombre,
      regionCorto: infoRegVersus.corto,
      perfilEtiqueta: etiquetaGeneroVersus,
      sueldoPrepa: sueldoPrepaVersus,
      carreras: carrerasEnVersus.map((c: any) => {
        const sueldosPorRegion: Record<string, number | null> = {};
        MACRO_REGIONES_5.forEach(rk => {
          const pr = c.perfiles?.[rk]?.[generoVersus];
          sueldosPorRegion[rk] = pr && pr.celdaValida !== false && Number(pr.sueldo_esperado) > 0 ? Number(pr.sueldo_esperado) : null;
        });

        return {
          cve_carrera: c.cve_carrera,
          nombre_carrera: c.nombre_carrera,
          scoreDataROI: Math.round(Number(c.scoreDataROI ?? 60)),
          sueldo_esperado: c.sueldo_esperado,
          premioVsPrepaPct: c.premioVsPrepaPct,
          roiPublica: calcularAniosRetornoDinamico({
            sueldoCarrera: c.sueldo_esperado,
            sueldoPrepa: sueldoPrepaVersus,
            cve: c.cve_carrera,
            escenario: 'publica',
            semestres: c.semestres_default,
            capexMxn: c.capex_mxn,
            costosRoi: metaPipeline.costos_roi
          }),
          roiPrivada: calcularAniosRetornoDinamico({
            sueldoCarrera: c.sueldo_esperado,
            sueldoPrepa: sueldoPrepaVersus,
            cve: c.cve_carrera,
            escenario: 'privada_media',
            semestres: c.semestres_default,
            capexMxn: c.capex_mxn,
            costosRoi: metaPipeline.costos_roi
          }),
          costoEquipo: obtenerCapExDinamico(c.cve_carrera, c.capex_mxn).costoEquipo,
          tasaCalidadOIT: c.tasaCalidadOIT,
          tasaDesempleo: numSeguro(c.perfilActivo?.tasa_desempleo, 3.5),
          saturacionPct: numSeguro(c.perfilActivo?.indice_saturacion_pct, 100),
          meritoPct: Number(c.crudos?.movilidad ?? 50),
          blindajeIA: 100 - numSeguro(c.perfilActivo?.riesgo_ia_score, 40),
          empleoUnicoPct: c.pctEmpleoUnico,
          sectorPrincipal: obtenerSectorDominante(c.perfilActivo),
          pilaresRadar: c.pilaresRadar || {},
          sueldosPorRegion
        };
      }),
      nombreArchivo: `DataROI_Versus_${regionVersus}_${queryGeneroVersus}_${cvesVersus.join('_')}_${corteSlug}.pdf`
    });
  };

  return (
    <>
      <header
        className={`no-print sticky top-0 z-40 mb-1 transition-transform duration-300 ease-out ${
          navbarVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
            
            {/* IDENTIDAD DE MARCA + CORTE VIVO */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 group focus:outline-none">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white flex items-center justify-center font-black text-sm shadow-sm ring-1 ring-slate-900/10 group-hover:scale-105 transition-transform">
                  DR
                </div>
                <div>
                  <span className="font-black text-sm md:text-base text-slate-900 tracking-tight flex items-center gap-1.5 leading-none">
                    DataROI México
                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 text-[9.5px] font-extrabold uppercase tracking-wider">
                      {metaPipeline.etiqueta_corte}
                    </span>
                  </span>
                  <span className="block text-[10.5px] font-medium text-slate-400 leading-none mt-1">
                    Auditoría de Retorno y Empleabilidad Universitaria
                  </span>
                </div>
              </Link>
            </div>

            {/* CÁPSULA CENTRAL DE NAVEGACIÓN GLOBAL PERSISTENTE */}
            <nav
              aria-label="Navegación global de la plataforma"
              className="flex flex-wrap items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80"
            >
              <Link
                href="/"
                aria-current={esCatalogo ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 ${
                  esCatalogo
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{totalCarrerasCertificadas !== null ? `Catálogo (${totalCarrerasCertificadas})` : 'Catálogo'}</span>
              </Link>

              <Link
                href="/descubrir"
                aria-current={esDescubridor ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 ${
                  esDescubridor
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Descubridor y Ranking</span>
              </Link>

              <Link
                href="/laboratorio"
                aria-current={esLaboratorio ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 ${
                  esLaboratorio
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span>Laboratorio Crudo</span>
              </Link>

              <Link
                href="/actualizar"
                aria-current={esActualizar ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 ${
                  esActualizar
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-blue-700 hover:bg-white/70'
                }`}
              >
                <UploadCloud className={`w-3.5 h-3.5 ${esActualizar ? 'text-white' : 'text-blue-600'}`} aria-hidden="true" />
                <span>Subir Corte</span>
              </Link>
            </nav>

            {/* ACCIÓN DERECHA: BOTÓN CON POPOVER DEL COMPARADOR VERSUS */}
            <div ref={contenedorPopoverRef} className="relative flex items-center gap-2">
              {esCarrera && (
                <span className="hidden xl:inline-block text-[11px] font-bold text-slate-400 mr-1">
                  Auditoría Individual
                </span>
              )}

              <button
                type="button"
                aria-expanded={popoverAbierto}
                onClick={() => setPopoverAbierto(prev => !prev)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all active:scale-95 cursor-pointer ${
                  cvesVersus.length >= 2
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs'
                    : cvesVersus.length === 1
                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Scale className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Versus</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none ${
                    cvesVersus.length >= 2
                      ? 'bg-white text-blue-700'
                      : cvesVersus.length === 1
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {cvesVersus.length}/3
                </span>
              </button>

              {popoverAbierto && (
                <div className="absolute right-0 top-full mt-2.5 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                      Comparador Cara a Cara ({cvesVersus.length}/3)
                    </span>
                    <button
                      type="button"
                      onClick={() => setPopoverAbierto(false)}
                      aria-label="Cerrar menú del comparador"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  {cvesVersus.length === 0 ? (
                    <div className="py-4 px-2 text-center">
                      <Info className="w-7 h-7 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                      <p className="text-xs font-bold text-slate-700 mb-1">
                        Aún no has seleccionado carreras
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Pulsa el botón <strong>+ Comparar</strong> en cualquier tarjeta del Catálogo, del Ranking, del Laboratorio o dentro de un reporte para elegir de <strong>2 a 3 licenciaturas</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-3.5">
                      {cvesVersus.map((cve, idx) => (
                        <div
                          key={cve}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-5 h-5 rounded-full text-[10px] font-black text-white flex items-center justify-center shrink-0"
                              style={{ backgroundColor: COLORES_DOTS[idx] || '#2563EB' }}
                            >
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <span className="font-black text-slate-900 block truncate">
                                {obtenerNombreCortoPorCve(cve)}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                CVE: {padCve(cve)}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => quitarCarreraDesdeNavbar(cve)}
                            aria-label={`Quitar ${obtenerNombreCortoPorCve(cve)}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {cvesVersus.length === 1 && (
                    <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
                      Selecciona <strong>al menos 1 carrera más</strong> (mínimo 2) en cualquier vista para abrir la comparativa Cara a Cara.
                    </div>
                  )}

                  {cvesVersus.length > 0 && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={limpiarTodasDesdeNavbar}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-600 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Vaciar
                      </button>

                      <button
                        type="button"
                        disabled={cvesVersus.length < 2}
                        onClick={ejecutarComparativaCaraACara}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 ${
                          cvesVersus.length >= 2
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                        Abrir Comparativa ({cvesVersus.length}/3)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* MODAL GLOBAL INDEPENDIENTE DE COMPARACIÓN CARA A CARA */}
      {modalVersusAbierto && cvesVersus.length >= 2 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Comparador ejecutivo cara a cara de licenciaturas"
          className="versus-print-modal fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalVersusAbierto(false);
          }}
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 md:p-8 animate-in zoom-in-95 duration-200">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-blue-600 block mb-0.5">
                  Comparador Ejecutivo Global Cara a Cara · {infoRegVersus.corto} ({etiquetaGeneroVersus}) · Corte {metaPipeline.etiqueta_corte}
                </span>
                <h2 className="text-xl md:text-2xl font-black text-slate-900">
                  Contraste Directo de Calificación DataROI, Indicadores y Retorno
                </h2>
              </div>

              <div className="no-print flex flex-wrap items-center gap-2 self-end lg:self-center">
                <button
                  onClick={compartirVersusLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  {copiadoVersus ? <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> : <Share2 className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />}
                  {copiadoVersus ? '¡Link copiado!' : 'Compartir Versus'}
                </button>

                <button
                  onClick={exportarVersusExcel}
                  title="Descargar Libro de Excel (.xlsx) con 2 Hojas"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                  Excel (2 Hojas)
                </button>

                <button
                  onClick={exportarVersusCSV}
                  title="Descargar comparativa en formato CSV limpio"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                  CSV
                </button>

                <button
                  onClick={descargarPDFVersusDirecto}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                  Descargar PDF
                </button>

                <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setVistaGraficoVersus('radar')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      vistaGraficoVersus === 'radar' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" aria-hidden="true" /> 6 Pilares
                  </button>
                  <button
                    onClick={() => setVistaGraficoVersus('regiones')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      vistaGraficoVersus === 'regiones' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> Sueldos por Región
                  </button>
                </div>

                <button
                  onClick={() => setModalVersusAbierto(false)}
                  aria-label="Cerrar comparador (Escape)"
                  title="Cerrar comparador (Tecla Escape)"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="no-print my-4 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1 mr-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" /> Región de contraste:
                </span>
                {REGIONES_ORDEN.map(rKey => {
                  const act = regionVersus === rKey;
                  return (
                    <button
                      key={rKey}
                      type="button"
                      onClick={() => actualizarRegionVersus(rKey)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                        act ? 'bg-blue-600 text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {REGIONES_META[rKey].corto}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" /> Perfil:
                </span>
                <div className="inline-flex bg-white p-0.5 rounded-xl border border-slate-200">
                  {([
                    { id: 0 as CodigoGenero, label: 'Total General' },
                    { id: 2 as CodigoGenero, label: 'Solo Mujeres' },
                    { id: 1 as CodigoGenero, label: 'Solo Hombres' }
                  ]).map(op => {
                    const act = generoVersus === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => actualizarGeneroVersus(op.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                          act ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {op.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="print-avoid-break grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 items-center bg-slate-50 p-5 rounded-2xl border border-slate-200/80 relative">
              {cargandoVersus && (
                <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] z-20 rounded-2xl flex items-center justify-center gap-2 text-xs font-black text-slate-700">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span>Sincronizando microdatos INEGI de las carreras seleccionadas...</span>
                </div>
              )}

              <div className="lg:col-span-5 space-y-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  {vistaGraficoVersus === 'radar' ? (
                    <>
                      <Compass className="w-4 h-4 text-blue-600" aria-hidden="true" />
                      Superposición de los 6 Pilares
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-4 h-4 text-blue-600" aria-hidden="true" />
                      Comparativa Salarial en las 5 Regiones
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {vistaGraficoVersus === 'radar'
                    ? `Las líneas de alto contraste y el medallón entero de calificación muestran qué carrera envuelve a las demás en ${infoRegVersus.nombre}.`
                    : 'Contrasta cuánto paga cada una de las carreras seleccionadas a lo largo de las 5 macro-regiones económicas del país.'}
                </p>

                <div className="space-y-2.5 pt-1">
                  {carrerasEnVersus.map((c: any, idx: number) => {
                    const primaEnt = Math.round(c.premioVsPrepaPct);
                    return (
                      <div
                        key={c.cve_carrera}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${COLORES_VERSUS[idx]?.light}`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className="w-5 h-5 rounded-full text-[10px] font-black text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs"
                            style={{ backgroundColor: COLORES_VERSUS[idx]?.hex }}
                          >
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/carrera/${c.cve_carrera}?region=${regionVersus}&genero=${queryGeneroVersus}`}
                              onClick={() => setModalVersusAbierto(false)}
                              className="text-xs font-black text-slate-900 hover:text-blue-600 leading-snug inline-flex items-center gap-1 transition-colors"
                            >
                              <span className="truncate">{c.nombre_carrera}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
                            </Link>
                            <span className="text-[11px] font-black text-emerald-700 block">
                              {formatoMoneda(c.sueldo_esperado)}/mes ({primaEnt >= 0 ? `+${primaEnt}%` : `${primaEnt}%`} vs. Prepa)
                            </span>
                          </div>
                        </div>
                        <AnilloScoreCompactoModal score={c.scoreDataROI ?? 60} />
                      </div>
                    );
                  })}
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
                          fillOpacity={0.12}
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
                      label: 'Calificación Integral DataROI (0–100)',
                      valores: carrerasEnVersus.map((c: any) => Math.round(Number(c.scoreDataROI ?? 60))),
                      formato: (v: number) => {
                        const s = obtenerSemaforoScoreDataROI(v);
                        return `${v} / 100 (Grado ${s.grado} · ${s.etiqueta})`;
                      },
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Salario Mensual Consolidado',
                      valores: carrerasEnVersus.map((c: any) => c.sueldo_esperado),
                      formato: (v: number) => `${formatoMoneda(v)} / mes`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Prima Salarial vs. Preparatoria',
                      valores: carrerasEnVersus.map((c: any) => Math.round(c.premioVsPrepaPct)),
                      formato: (v: number) => `${v >= 0 ? `+${v}%` : `${v}%`} vs. Prepa`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Retorno de Inversión (Univ. Pública)',
                      valores: carrerasEnVersus.map((c: any) =>
                        calcularAniosRetornoDinamico({
                          sueldoCarrera: c.sueldo_esperado,
                          sueldoPrepa: sueldoPrepaVersus,
                          cve: c.cve_carrera,
                          escenario: 'publica',
                          semestres: c.semestres_default,
                          capexMxn: c.capex_mxn,
                          costosRoi: metaPipeline.costos_roi
                        }) ?? 999
                      ),
                      formato: (v: number) =>
                        v >= 900 ? 'Retorno negativo' : v === 1 ? '1 año de trabajo' : `${v} años de trabajo`,
                      mejorAlto: false,
                      invalidoSiMayorIgualA: 900
                    },
                    {
                      label: 'Retorno de Inversión (Univ. Privada Media)',
                      valores: carrerasEnVersus.map((c: any) =>
                        calcularAniosRetornoDinamico({
                          sueldoCarrera: c.sueldo_esperado,
                          sueldoPrepa: sueldoPrepaVersus,
                          cve: c.cve_carrera,
                          escenario: 'privada_media',
                          semestres: c.semestres_default,
                          capexMxn: c.capex_mxn,
                          costosRoi: metaPipeline.costos_roi
                        }) ?? 999
                      ),
                      formato: (v: number) =>
                        v >= 900 ? 'Retorno negativo' : v === 1 ? '1 año de trabajo' : `${v} años de trabajo`,
                      mejorAlto: false,
                      invalidoSiMayorIgualA: 900
                    },
                    {
                      label: 'Inversión Requerida en Equipo (CapEx)',
                      valores: carrerasEnVersus.map((c: any) => obtenerCapExDinamico(c.cve_carrera, c.capex_mxn).costoEquipo),
                      formato: (v: number) =>
                        `${v >= 70000 ? 'Alta' : v >= 30000 ? 'Media' : 'Básica'} (${formatoMoneda(v)} MXN)`,
                      mejorAlto: false,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Empleo de Calidad (Estándar OIT)',
                      valores: carrerasEnVersus.map((c: any) => Math.round(c.tasaCalidadOIT)),
                      formato: (v: number) => `${v}% de ocupados`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Tasa de Desempleo Abierto',
                      valores: carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.tasa_desempleo, 3.5)),
                      formato: (v: number) => `${v.toFixed(1)}%`,
                      mejorAlto: false,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Índice de Saturación ANUIES',
                      valores: carrerasEnVersus.map((c: any) => numSeguro(c.perfilActivo?.indice_saturacion_pct, 100)),
                      formato: (v: number) => `${v}%`,
                      mejorAlto: false,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Apertura y Movilidad Social (Mérito)',
                      valores: carrerasEnVersus.map((c: any) => Math.round(Number(c.crudos?.movilidad ?? 50))),
                      formato: (v: number) => `${v}% Mérito`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Blindaje Humano ante IA',
                      valores: carrerasEnVersus.map((c: any) => 100 - numSeguro(c.perfilActivo?.riesgo_ia_score, 40)),
                      formato: (v: number) => `${v}% blindaje`,
                      mejorAlto: true,
                      invalidoSiMayorIgualA: Infinity
                    },
                    {
                      label: 'Empleo Único (Sin Pluriempleo)',
                      valores: carrerasEnVersus.map((c: any) => Math.round(c.pctEmpleoUnico)),
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
                                    <Trophy className="w-2.5 h-2.5 text-emerald-700" aria-hidden="true" /> Líder
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
                Cerrar comparador (Esc)
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

function NavbarGlobalFallback() {
  return (
    <header className="no-print sticky top-0 z-40 mb-1">
      <div className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
              DR
            </div>
            <div>
              <span className="font-black text-sm md:text-base text-slate-900 tracking-tight block leading-none">
                DataROI México
              </span>
              <span className="block text-[10.5px] font-medium text-slate-400 leading-none mt-1">
                Auditoría de Retorno y Empleabilidad Universitaria
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs font-black text-slate-600">
            <span className="px-3 py-1.5">Catálogo</span>
            <span className="px-3 py-1.5">Descubridor y Ranking</span>
            <span className="px-3 py-1.5">Laboratorio Crudo</span>
            <span className="px-3 py-1.5">Subir Corte</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-slate-50 text-slate-600 border border-slate-200">
            Versus 0/3
          </div>
        </div>
      </div>
    </header>
  );
}

export default function NavbarGlobal() {
  return (
    <Suspense fallback={<NavbarGlobalFallback />}>
      <NavbarGlobalContenido />
    </Suspense>
  );
}