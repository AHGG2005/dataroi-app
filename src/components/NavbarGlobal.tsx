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
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import {
  Compass,
  FlaskConical,
  LayoutGrid,
  Scale,
  Sparkles,
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
  ExternalLink
} from 'lucide-react';

export const EVENTO_ABRIR_MODAL_VERSUS = 'dataroi-open-versus-modal';

type CodigoGenero = 0 | 1 | 2;

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

const REGIONES_LISTA = ['nacional', 'norte', 'noroeste', 'bajio', 'centro', 'sur'] as const;

const ESTADOS_POR_REGION: Record<string, string[]> = {
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

const BENCHMARK_REGIONES_VERSUS: Record<string, {
  nombre: string;
  corto: string;
  sueldo_prepa: Record<CodigoGenero, number>;
  estrato_medio: number;
  nepotismo_medio: number;
}> = {
  nacional: {
    nombre: 'Nacional (Todo México)',
    corto: 'Nacional',
    sueldo_prepa: { 0: 10608, 1: 11832, 2: 8762 },
    estrato_medio: 2.80,
    nepotismo_medio: 37.2
  },
  norte: {
    nombre: 'Norte / Frontera Industrial',
    corto: 'Norte',
    sueldo_prepa: { 0: 12816, 1: 14113, 2: 10775 },
    estrato_medio: 3.08,
    nepotismo_medio: 37.6
  },
  noroeste: {
    nombre: 'Noroeste / Corredor Pacífico',
    corto: 'Noroeste',
    sueldo_prepa: { 0: 11858, 1: 13365, 2: 9748 },
    estrato_medio: 2.83,
    nepotismo_medio: 43.3
  },
  bajio: {
    nombre: 'Occidente - Bajío',
    corto: 'Bajío-Occ.',
    sueldo_prepa: { 0: 10478, 1: 11731, 2: 8707 },
    estrato_medio: 2.93,
    nepotismo_medio: 38.8
  },
  centro: {
    nombre: 'Centro / Valle de México',
    corto: 'Centro',
    sueldo_prepa: { 0: 9889, 1: 11119, 2: 8069 },
    estrato_medio: 2.73,
    nepotismo_medio: 33.5
  },
  sur: {
    nombre: 'Sur - Sureste / Golfo',
    corto: 'Sur-Sureste',
    sueldo_prepa: { 0: 9150, 1: 10195, 2: 7469 },
    estrato_medio: 2.31,
    nepotismo_medio: 38.6
  }
};

const CATALOGO_64_NOMBRES: Record<string, string> = {
  '011100': 'Diseño curricular y pedagogía',
  '011300': 'Orientación e intervención educativa',
  '011500': 'Ciencias de la educación',
  '012100': 'Docencia en Educación Preescolar',
  '012200': 'Docencia en Educación Primaria',
  '012300': 'Docencia en Educación Secundaria',
  '012601': 'Docencia en Cultura Física y Deporte',
  '012702': 'Docencia en Educación Especial',
  '021100': 'Bellas artes',
  '021300': 'Música',
  '021400': 'Producción y Tecnologías Audiovisuales',
  '021500': 'Diseño Gráfico y Comunicación Editorial',
  '021600': 'Diseño Industrial, de Moda e Interiores',
  '022200': 'Enseñanza y Lenguas Extranjeras',
  '022300': 'Literatura',
  '022500': 'Historia y arqueología',
  '031100': 'Psicología',
  '031200': 'Sociología y antropología',
  '031300': 'Ciencias políticas',
  '031400': 'Economía',
  '031500': 'Trabajo y atención social',
  '032100': 'Comunicación y periodismo',
  '033100': 'Derecho',
  '033200': 'Criminología y criminalística',
  '041100': 'Negocios y comercio',
  '041200': 'Mercadotecnia y publicidad',
  '041300': 'Finanzas, banca y seguros',
  '041400': 'Contabilidad y fiscalización',
  '042000': 'Administración y Gestión Empresarial',
  '042100': 'Administración de empresas',
  '042200': 'Administración Turística y Restaurantera',
  '042300': 'Administración pública',
  '042400': 'Administración en Ingeniería y Construcción',
  '051100': 'Biología',
  '051200': 'Bioquímica y biofísica',
  '052200': 'Química',
  '053100': 'Matemáticas',
  '061000': 'Innovación en TIC y Sistemas Digitales',
  '061100': 'Ciencias computacionales',
  '061300': 'Desarrollo de software',
  '062100': 'Telecomunicaciones',
  '062200': 'Informática',
  '071100': 'Ingeniería Mecánica y Metalmecánica',
  '071200': 'Electricidad y generación de energía',
  '071300': 'Ingeniería Electrónica y Automatización',
  '071400': 'Ingeniería de procesos químicos',
  '071500': 'Ingeniería Automotriz y Aeronáutica',
  '071600': 'Ingeniería y Tecnología Ambiental',
  '071700': 'Ingeniería industrial',
  '072100': 'Industria de la alimentación',
  '072400': 'Ingeniería en Minería y Metalurgia',
  '073100': 'Arquitectura y urbanismo',
  '073200': 'Ingeniería Civil y Construcción',
  '081100': 'Ingeniería Agronómica y Zootecnia',
  '082100': 'Veterinaria',
  '091100': 'Medicina general',
  '092100': 'Enfermería y Obstetricia',
  '093100': 'Odontología y Estomatología General',
  '094100': 'Terapia y rehabilitación',
  '094200': 'Nutrición',
  '095400': 'Farmacia',
  '101100': 'Deportes',
  '101500': 'Gastronomía y servicios de alimentos',
  '101600': 'Hospitalidad y turismo'
};

function obtenerNombreCortoPorCve(cve: string): string {
  const pad = String(cve || '').trim().padStart(6, '0');
  return CATALOGO_64_NOMBRES[pad] || formatearNombreCarreraEjecutivo(pad, `Carrera ${pad}`);
}

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
    return { nivel: 3, costoEquipo: 85000, etiqueta: 'Equipo Alto ($85k)' };
  }
  if (
    pref3 === '061' || pref3 === '062' || pref3 === '071' || pref3 === '072' ||
    pref3 === '051' || pref3 === '052' || pref3 === '053' || pref3 === '081' ||
    pref3 === '091' || pref3 === '092' || pref3 === '094' || pref3 === '095'
  ) {
    return { nivel: 2, costoEquipo: 42000, etiqueta: 'Equipo Medio ($42k)' };
  }
  return { nivel: 1, costoEquipo: 18000, etiqueta: 'Equipo Básico ($18k)' };
}

function calcularAniosRetornoRapido(sueldoCarrera: number, sueldoPrepa: number, cve: string, esPrivada: boolean) {
  const semestres = cve === '091100' ? 12 : 9;
  const capex = obtenerCapExCorto(cve);
  const inversionTotal = esPrivada
    ? semestres * (6500 * 6) + 22000 + capex.costoEquipo
    : semestres * 1800 + 8500 + capex.costoEquipo;
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

function clasificarTendenciaReal21_26(filasRealesValidas: any[]) {
  const porAnioMap: Record<number, { prod: number; peso: number }> = {};
  filasRealesValidas.forEach(r => {
    const a = Number(r.anio);
    const s = Number(r.sueldo_promedio_mensual || 0);
    const p = Math.max(1, Number(r.poblacion_activa_total || 1));
    if (a >= 2021 && a <= 2026 && s > 0) {
      if (!porAnioMap[a]) porAnioMap[a] = { prod: 0, peso: 0 };
      porAnioMap[a].prod += s * p;
      porAnioMap[a].peso += p;
    }
  });

  const anios = Object.keys(porAnioMap).map(Number).sort((a, b) => a - b);
  if (anios.length < 4) {
    return { etiqueta: 'Estable', codigo: 'estable' as const };
  }

  const sueldos = anios.map(a => porAnioMap[a].prod / porAnioMap[a].peso);
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

  const ptsBase = anios.filter(a => a === 2022 || a === 2023).map(a => porAnioMap[a].prod / porAnioMap[a].peso);
  const ptsRec = anios.filter(a => a === 2025 || a === 2026).map(a => porAnioMap[a].prod / porAnioMap[a].peso);

  const sueldoBase = ptsBase.length > 0 ? ptsBase.reduce((a, b) => a + b, 0) / ptsBase.length : sueldos[0];
  const sueldoRec = ptsRec.length > 0 ? ptsRec.reduce((a, b) => a + b, 0) / ptsRec.length : sueldos[sueldos.length - 1];

  const crecRealAcum = sueldoBase > 0 ? (sueldoRec - sueldoBase) / sueldoBase : 0;

  const aniosPost = anios.filter(a => a >= 2022);
  const aniosEval = aniosPost.length >= 3 ? aniosPost : anios;
  const sueldosEval = aniosEval.map(a => porAnioMap[a].prod / porAnioMap[a].peso);
  const mediaEval = sueldosEval.reduce((a, b) => a + b, 0) / sueldosEval.length;

  const meanX = aniosEval.reduce((a, b) => a + b, 0) / aniosEval.length;
  const numSum = aniosEval.reduce((acc, x, idx) => acc + (x - meanX) * (sueldosEval[idx] - mediaEval), 0);
  const denSum = aniosEval.reduce((acc, x) => acc + Math.pow(x - meanX, 2), 0) || 1;
  const pendientePct = (numSum / denSum) / (mediaEval || 1);

  if (crecRealAcum >= 0.040 && pendientePct >= 0.008) {
    return { etiqueta: 'En crecimiento', codigo: 'crecimiento' as const };
  }
  if (crecRealAcum <= -0.040 && pendientePct <= -0.008) {
    return { etiqueta: 'En ajuste', codigo: 'ajuste' as const };
  }
  return { etiqueta: 'Estable', codigo: 'estable' as const };
}

function AnilloScoreCompactoModal({ score }: { score: number }) {
  const sem = obtenerSemaforoScoreDataROI(score);
  const scoreEntero = Math.round(score);
  const r = 17;
  const dim = 42;
  const strokeW = 4.0;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, scoreEntero));
  const offset = circ - (pct / 100) * circ;

  return (
    <div
      role="img"
      aria-label={`Score DataROI: ${scoreEntero} de 100 puntos, Grado ${sem.grado}, ${sem.etiqueta}`}
      title={`Score DataROI: ${scoreEntero}/100 (Grado ${sem.grado} · ${sem.etiqueta})`}
      className="relative w-11 h-11 flex items-center justify-center shrink-0"
    >
      <svg className="w-11 h-11 -rotate-90" viewBox={`0 0 ${dim} ${dim}`} aria-hidden="true">
        <circle cx={dim / 2} cy={dim / 2} r={r} fill={sem.fillTintHex} stroke={sem.trackHex} strokeWidth={strokeW} />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke={sem.colorHex}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-xs font-black text-slate-900">{scoreEntero}</span>
    </div>
  );
}

function NavbarGlobalContenido() {
  const pathname = usePathname();
  const [cvesVersus, setCvesVersus] = useState<string[]>([]);
  const [popoverAbierto, setPopoverAbierto] = useState<boolean>(false);
  const [navbarVisible, setNavbarVisible] = useState<boolean>(true);
  const [enTope, setEnTope] = useState<boolean>(true);

  // Estados del Modal Global Independiente de Versus
  const [modalVersusAbierto, setModalVersusAbierto] = useState<boolean>(false);
  const [regionVersus, setRegionVersus] = useState<string>('nacional');
  const [generoVersus, setGeneroVersus] = useState<CodigoGenero>(0);
  const [vistaGraficoVersus, setVistaGraficoVersus] = useState<'radar' | 'regiones'>('radar');
  const [copiadoVersus, setCopiadoVersus] = useState<boolean>(false);
  const [cargandoVersus, setCargandoVersus] = useState<boolean>(false);
  const [versionCacheVersus, setVersionCacheVersus] = useState<number>(0);

  const cacheVersusRef = useRef<Record<string, { satelites: any[]; series: any[] }>>({});
  const lastScrollYRef = useRef<number>(0);
  const contenedorPopoverRef = useRef<HTMLDivElement>(null);

  const sincronizarContextoRegional = () => {
    const estado = leerEstadoDescubridorGlobal();
    let reg = estado.regionActiva || 'nacional';
    let gen: CodigoGenero = estado.generoActivo || 0;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const regUrl = params.get('region');
      const genUrl = params.get('genero');
      if (regUrl && BENCHMARK_REGIONES_VERSUS[regUrl]) reg = regUrl;
      if (genUrl === 'mujeres' || genUrl === '2') gen = 2;
      else if (genUrl === 'hombres' || genUrl === '1') gen = 1;
      else if (genUrl === 'total' || genUrl === '0') gen = 0;
    }

    setRegionVersus(reg);
    setGeneroVersus(gen);
  };

  useEffect(() => {
    const sincronizar = () => {
      const estado = leerEstadoDescubridorGlobal();
      const nueva = estado.carrerasCompararCves || [];
      setCvesVersus(prev => (prev.join(',') === nueva.join(',') ? prev : nueva));
    };

    sincronizar();
    window.addEventListener(EVENTO_VERSUS_SYNC, sincronizar);
    window.addEventListener('storage', sincronizar);
    return () => {
      window.removeEventListener(EVENTO_VERSUS_SYNC, sincronizar);
      window.removeEventListener('storage', sincronizar);
    };
  }, [pathname]);

  // Escuchar evento global para abrir el Modal Versus desde cualquier vista
  useEffect(() => {
    const handleAbrirModalGlobal = () => {
      sincronizarContextoRegional();
      setPopoverAbierto(false);
      setModalVersusAbierto(true);
    };

    window.addEventListener(EVENTO_ABRIR_MODAL_VERSUS, handleAbrirModalGlobal);
    return () => window.removeEventListener(EVENTO_ABRIR_MODAL_VERSUS, handleAbrirModalGlobal);
  }, []);

  // Cerrar el modal con Escape
  useEffect(() => {
    if (!modalVersusAbierto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalVersusAbierto(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalVersusAbierto]);

  // Carga quirúrgica bajo demanda en memoria cuando el modal se abre
  useEffect(() => {
    if (!modalVersusAbierto || cvesVersus.length === 0) return;

    const faltantes = cvesVersus.filter(cve => !cacheVersusRef.current[cve]);
    if (faltantes.length === 0) return;

    let cancelado = false;
    async function descargarDatosVersusFaltantes() {
      setCargandoVersus(true);
      const variantesCve = Array.from(
        new Set(faltantes.flatMap(c => [c, String(Number(c))]))
      );

      const [resSat, resSer] = await Promise.all([
        supabase
          .from('satelites_cultura')
          .select('*')
          .in('cve_carrera', variantesCve),
        supabase
          .from('predicciones_roi')
          .select('cve_carrera, cve_ent, anio, sexo, tipo_dato, poblacion_activa_total, desempleados_reales, sueldo_promedio_mensual, indice_saturacion_pct')
          .eq('tipo_dato', 'Real')
          .in('cve_carrera', variantesCve)
          .order('anio', { ascending: true })
      ]);

      if (cancelado) return;

      const sats = resSat.data || [];
      const sers = (resSer.data || []).map(r => {
        const entRaw = String(r.cve_ent || 'nacional').toLowerCase().trim();
        let regDestino = entRaw;
        if (entRaw === '0' || entRaw === '00' || entRaw === 'nacional') {
          regDestino = 'nacional';
        } else if (!REGIONES_LISTA.includes(entRaw as any)) {
          const entPad = entRaw.padStart(2, '0');
          const encontrada = Object.entries(ESTADOS_POR_REGION).find(([, lista]) => lista.includes(entPad));
          if (encontrada) regDestino = encontrada[0];
        }
        return {
          ...r,
          cve_ent: regDestino,
          sexo: Number(r.sexo ?? 0)
        };
      });

      faltantes.forEach(cve => {
        const cvePad = cve.padStart(6, '0');
        cacheVersusRef.current[cvePad] = {
          satelites: sats.filter(s => String(s.cve_carrera).padStart(6, '0') === cvePad),
          series: sers.filter(r => String(r.cve_carrera).padStart(6, '0') === cvePad)
        };
      });

      setVersionCacheVersus(v => v + 1);
      setCargandoVersus(false);
    }

    descargarDatosVersusFaltantes();
    return () => {
      cancelado = true;
    };
  }, [modalVersusAbierto, cvesVersus]);

  // Patrón Smart Auto-Hide (Headroom)
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setEnTope(currentY < 16);

      if (currentY < 45) {
        setNavbarVisible(true);
      } else if (currentY > lastScrollYRef.current + 10 && !popoverAbierto) {
        setNavbarVisible(false);
      } else if (currentY < lastScrollYRef.current - 6) {
        setNavbarVisible(true);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [popoverAbierto]);

  useEffect(() => {
    if (!popoverAbierto) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contenedorPopoverRef.current && !contenedorPopoverRef.current.contains(e.target as Node)) {
        setPopoverAbierto(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverAbierto(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [popoverAbierto]);

  const esCatalogo = pathname === '/';
  const esDescubridor = pathname?.startsWith('/descubrir');
  const esLaboratorio = pathname?.startsWith('/laboratorio');
  const esCarrera = pathname?.startsWith('/carrera');

  const quitarCarreraDesdeNavbar = (cve: string) => {
    const nueva = toggleCarreraComparadorGlobal(cve);
    setCvesVersus(nueva);
    if (nueva.length < 2) {
      setModalVersusAbierto(false);
    }
  };

  const limpiarTodasDesdeNavbar = () => {
    limpiarComparadorGlobal();
    setCvesVersus([]);
    setModalVersusAbierto(false);
  };

  // Abre el Modal Global en la página actual sin redirigir a /descubrir
  const ejecutarComparativaCaraACara = () => {
    if (cvesVersus.length < 2) return;
    sincronizarContextoRegional();
    setPopoverAbierto(false);
    setModalVersusAbierto(true);
  };

  const actualizarRegionVersus = (nuevaReg: string) => {
    setRegionVersus(nuevaReg);
    try {
      const actual = leerEstadoDescubridorGlobal();
      sessionStorage.setItem(STORAGE_KEY_DESCUBRIDOR, JSON.stringify({ ...actual, regionActiva: nuevaReg }));
    } catch {
      // Ignorar errores en modo privado
    }
  };

  const actualizarGeneroVersus = (nuevoGen: CodigoGenero) => {
    setGeneroVersus(nuevoGen);
    try {
      const actual = leerEstadoDescubridorGlobal();
      sessionStorage.setItem(STORAGE_KEY_DESCUBRIDOR, JSON.stringify({ ...actual, generoActivo: nuevoGen }));
    } catch {
      // Ignorar errores en modo privado
    }
  };

  // Procesamiento en vivo de las carreras seleccionadas para el Modal Global
  const carrerasEnVersus = useMemo(() => {
    const infoReg = BENCHMARK_REGIONES_VERSUS[regionVersus] || BENCHMARK_REGIONES_VERSUS.nacional;
    const sueldoPrepaBase = infoReg.sueldo_prepa[generoVersus] || infoReg.sueldo_prepa[0];
    const mediaEstratoReg = infoReg.estrato_medio || 2.80;
    const mediaNepotismoReg = infoReg.nepotismo_medio || 37.2;

    const calcularPonderado = (filas: any[]) => {
      const validas = filas.filter(r => Number(r.sueldo_promedio_mensual || 0) > 0);
      if (validas.length === 0) return 0;
      const pob = validas.reduce((acc, c) => acc + Math.max(1, Number(c.poblacion_activa_total || 1)), 0);
      return pob > 0
        ? validas.reduce((acc, c) => acc + Number(c.sueldo_promedio_mensual) * Math.max(1, Number(c.poblacion_activa_total || 1)), 0) / pob
        : 0;
    };

    return cvesVersus.map(cve => {
      const cvePad = cve.padStart(6, '0');
      const nombreCorto = obtenerNombreCortoPorCve(cvePad);
      const cached = cacheVersusRef.current[cvePad];

      if (!cached) {
        return {
          cve_carrera: cvePad,
          nombre_carrera: nombreCorto,
          cargando: true,
          sueldo_esperado: 15000,
          premioVsPrepaPct: 35,
          tasaCalidadOIT: 60,
          tasaFormalidadTotal: 68,
          pctEmpleoUnico: 94,
          pctArraigoLocal: 97,
          scoreDataROI: 70,
          perfilActivo: {},
          perfiles: {},
          pilaresRadar: { Salario: 60, Formalidad: 65, Empleabilidad: 65, Meritocracia: 60, 'Blindaje IA': 60, Estabilidad: 65 },
          crudos: { movilidad: 60 }
        };
      }

      const { satelites, series } = cached;
      const obtenerSat = (reg: string, sx: number) =>
        satelites.find(s => String(s.region || 'nacional').toLowerCase() === reg && Number(s.sexo ?? 0) === sx) ||
        satelites.find(s => String(s.region || 'nacional').toLowerCase() === reg && Number(s.sexo ?? 0) === 0) ||
        satelites.find(s => String(s.region || 'nacional').toLowerCase() === 'nacional' && Number(s.sexo ?? 0) === sx) ||
        satelites.find(s => String(s.region || 'nacional').toLowerCase() === 'nacional' && Number(s.sexo ?? 0) === 0) ||
        satelites[0] ||
        {};

      const obtenerSer = (reg: string, sx: number) => {
        const dir = series.filter(r => r.cve_ent === reg && r.sexo === sx);
        if (dir.length > 0) return dir;
        if (sx === 0) return series.filter(r => r.cve_ent === reg && (r.sexo === 1 || r.sexo === 2));
        return [];
      };

      const serieNacSx = obtenerSer('nacional', generoVersus);
      const fNac25_26 = serieNacSx.filter(r => r.anio === 2025 || r.anio === 2026);
      const sueldoNacRef = Math.round(calcularPonderado(fNac25_26.length > 0 ? fNac25_26 : serieNacSx));

      const perfilesReg: Record<string, Record<number, any>> = {};
      REGIONES_LISTA.forEach(rk => {
        perfilesReg[rk] = {};
        const satRk = satelites.find(s => String(s.region || 'nacional').toLowerCase() === rk && Number(s.sexo ?? 0) === generoVersus);
        const nRealRk = Number(satRk?.n_encuestados_reales || 0);
        const minReq = rk === 'nacional' ? (generoVersus === 0 ? 180 : 25) : (generoVersus === 0 ? 30 : 25);
        const celdaValida = rk === 'nacional' ? true : nRealRk >= minReq;

        const serRk = obtenerSer(rk, generoVersus);
        const fRk25_26 = serRk.filter(r => r.anio === 2025 || r.anio === 2026);
        const fRk22_26 = serRk.filter(r => r.anio >= 2022 && r.anio <= 2026);
        const sueldoObsRk = calcularPonderado(fRk25_26.length > 0 ? fRk25_26 : fRk22_26);
        const nKishRk = Number(satRk?.n_efectivo_kish || 0);

        const sueldoRk = rk === 'nacional'
          ? sueldoNacRef
          : (sueldoObsRk > 0
              ? (nKishRk > 0 ? calcularSueldoRegionalBuhlmann(sueldoObsRk, sueldoNacRef, rk, nKishRk) : Math.round(sueldoObsRk))
              : sueldoNacRef);

        perfilesReg[rk][generoVersus] = {
          celdaValida,
          sueldo_esperado: sueldoRk
        };
      });

      const satAct = obtenerSat(regionVersus, generoVersus);
      const serAct = obtenerSer(regionVersus, generoVersus);
      const loteAct = serAct.length >= 3 ? serAct : serieNacSx;
      const fAct22_26 = loteAct.filter(r => r.anio >= 2022 && r.anio <= 2026);
      const loteEmp = fAct22_26.length > 0 ? fAct22_26 : loteAct;

      const sumaPea = loteEmp.reduce((a, b) => a + Number(b.poblacion_activa_total || 0), 0);
      const sumaDes = loteEmp.reduce((a, b) => a + Number(b.desempleados_reales || 0), 0);
      const desempleo = sumaPea > 0 ? Math.max(0.8, (sumaDes / sumaPea) * 100) : 3.2;

      const filaRec = loteAct.find(r => r.anio === 2026) || loteAct[loteAct.length - 1];
      const saturacion = Math.round(Number(filaRec?.indice_saturacion_pct || 92));
      const tendencia = clasificarTendenciaReal21_26(loteAct);

      const sueldoEsp = perfilesReg[regionVersus]?.[generoVersus]?.sueldo_esperado || sueldoNacRef;
      const pContrato = num(satAct.pct_contrato, 65);
      const pAguinaldo = num(satAct.pct_aguinaldo, 63);
      const pAfore = num(satAct.pct_afore, 55);
      const pPluri = num(satAct.pct_pluriempleo, 5.6);
      const pDesarr = num(satAct.pct_desarraigo, 2.7);
      const pCorp = num(satAct.pct_corp, 12);
      const pPyme = num(satAct.pct_pyme, 30);
      const pSind = num(satAct.pct_sindicato, 15);
      const nep = num(satAct.pct_nepotismo, mediaNepotismoReg);
      const privRaw = num(satAct.indice_privilegio, mediaEstratoReg);
      const riesgoIA = num(satAct.riesgo_ia_score, 40);

      const tasaCalidadOIT = Number((((Math.min(pContrato, pAfore) * 0.70 + pContrato * 0.30) * (1 - pPluri / 200))).toFixed(1));
      const tasaFormalidadTotal = Number((pContrato * 0.45 + pAguinaldo * 0.30 + pAfore * 0.25).toFixed(1));

      const diffEst = privRaw - mediaEstratoReg;
      const penalizacionElitismo = diffEst > 0.05 ? (diffEst - 0.05) * 110 : diffEst * 35;
      const inclusionOrigen = Math.max(15, Math.min(92, 70 - penalizacionElitismo));
      const aperturaContratacion = Math.max(10, Math.min(95, 100 - (nep + pSind * 0.22)));
      const saltoSalarialScore = sueldoPrepaBase > 0
        ? Math.max(0, Math.min(100, ((sueldoEsp - sueldoPrepaBase) / sueldoPrepaBase) * 100))
        : 40;
      const impulsoAscenso = saltoSalarialScore * 0.45 + tasaCalidadOIT * 0.35 + Math.min(100, pCorp * 2.2 + pPyme * 0.6) * 0.20;
      const rawMovilidad = Math.max(12, Math.min(96, aperturaContratacion * 0.40 + impulsoAscenso * 0.35 + inclusionOrigen * 0.25));

      const premioVsPrepaPct = sueldoPrepaBase > 0 && sueldoEsp > 0
        ? Number((((sueldoEsp - sueldoPrepaBase) / sueldoPrepaBase) * 100).toFixed(1))
        : 0;

      const pctEmpleoUnico = Number(Math.max(0, 100 - pPluri).toFixed(1));
      const pctArraigoLocal = Number(Math.max(0, 100 - pDesarr).toFixed(1));

      const evalUniversal = calcularScoreDataROIUniversal({
        Prima_vs_Prepa_Pct: premioVsPrepaPct,
        Desempleo_Abierto_Pct: Number(desempleo.toFixed(1)),
        Saturacion_ANUIES_Pct: saturacion,
        Empleo_Calidad_OIT_Pct: tasaCalidadOIT,
        Formalidad_Total_Pct: tasaFormalidadTotal,
        Meritocracia_Pct: Number(rawMovilidad.toFixed(1)),
        Blindaje_IA_Pct: 100 - riesgoIA,
        Tendencia_Codigo: tendencia.codigo,
        Empleo_Unico_Pct: pctEmpleoUnico,
        Arraigo_Local_Pct: pctArraigoLocal
      });

      const radarSalario = Math.round(Math.max(15, Math.min(100, ((sueldoEsp - 9500) / (22000 - 9500)) * 100)));
      const radarFormalidad = Math.round(tasaFormalidadTotal);
      const radarEmpleo = Math.round(Math.max(10, Math.min(100, 100 - desempleo * 8.0)) * 0.60 + Math.max(10, Math.min(100, 168 - saturacion)) * 0.40);
      const radarMerito = Math.round(rawMovilidad);
      const radarEstabilidad = Math.round(
        Math.max(10, Math.min(100, 100 - pPluri * 5.0)) * 0.35 +
        Math.max(10, Math.min(100, 100 - pDesarr * 6.5)) * 0.30 +
        pContrato * 0.35
      );

      return {
        cve_carrera: cvePad,
        nombre_carrera: nombreCorto,
        cargando: false,
        sueldo_esperado: sueldoEsp,
        premioVsPrepaPct,
        tasaCalidadOIT,
        tasaFormalidadTotal,
        pctEmpleoUnico,
        pctArraigoLocal,
        scoreDataROI: evalUniversal.score,
        tendencia_salarial: tendencia.etiqueta,
        perfiles: perfilesReg,
        perfilActivo: {
          ...satAct,
          tasa_desempleo: Number(desempleo.toFixed(1)),
          indice_saturacion_pct: saturacion,
          tendencia_salarial: tendencia.etiqueta
        },
        pilaresRadar: {
          Salario: radarSalario,
          Formalidad: radarFormalidad,
          Empleabilidad: radarEmpleo,
          Meritocracia: radarMerito,
          'Blindaje IA': evalUniversal.pilares.blindajeFuturo,
          Estabilidad: radarEstabilidad
        },
        crudos: {
          movilidad: rawMovilidad
        }
      };
    });
  }, [cvesVersus, regionVersus, generoVersus, versionCacheVersus]);

  const infoRegVersus = BENCHMARK_REGIONES_VERSUS[regionVersus] || BENCHMARK_REGIONES_VERSUS.nacional;
  const sueldoPrepaVersus = infoRegVersus.sueldo_prepa[generoVersus];
  const queryGeneroVersus = generoVersus === 2 ? 'mujeres' : generoVersus === 1 ? 'hombres' : 'total';
  const etiquetaGeneroVersus = generoVersus === 2 ? 'Solo Mujeres' : generoVersus === 1 ? 'Solo Hombres' : 'Total General';

  const datosRadarVersus = useMemo(() => {
    const ejes = ['Salario', 'Formalidad', 'Empleabilidad', 'Meritocracia', 'Blindaje IA', 'Estabilidad'] as const;
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
        region: BENCHMARK_REGIONES_VERSUS[rKey]?.corto || rKey
      };
      carrerasEnVersus.forEach((c: any) => {
        const perfReg = c.perfiles?.[rKey]?.[generoVersus];
        fila[c.cve_carrera] = perfReg && perfReg.celdaValida !== false && Number(perfReg.sueldo_esperado) > 0
          ? Number(perfReg.sueldo_esperado)
          : null;
      });
      return fila;
    });
  }, [carrerasEnVersus, generoVersus]);

  const compartirVersusLink = async () => {
    const url = new URL('/descubrir', window.location.origin);
    url.searchParams.set('region', regionVersus);
    url.searchParams.set('genero', queryGeneroVersus);
    url.searchParams.set('comparar', cvesVersus.join(','));
    const linkFinal = url.toString().replace(/%2C/gi, ',');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `DataROI Versus — ${carrerasEnVersus.map((c: any) => c.nombre_carrera).join(' vs. ')}`,
          text: `Comparativa ejecutiva Cara a Cara en ${infoRegVersus.nombre} (${etiquetaGeneroVersus}).`,
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

    const ejesRadar = ['Salario', 'Formalidad', 'Empleabilidad', 'Meritocracia', 'Blindaje IA', 'Estabilidad'] as const;
    const filasRadar: ValorCeldaExcel[][] = ejesRadar.map(eje => {
      const vals = carrerasEnVersus.map((c: any) => Number(c.pilaresRadar?.[eje] ?? 50));
      return registrarFilaNumerica('2. Huella de 6 Pilares (0-100)', `Pilar ${eje} (Score 0-100)`, vals, v => `${v} / 100`, true);
    });

    const fmtAnios = (v: number) => (v >= 900 ? 'Retorno negativo' : v === 1 ? '1 año' : `${v} años`);

    const filasHoja1: ValorCeldaExcel[][] = [
      ['1. Contexto y Trazabilidad', 'Macro-Región y Perfil Evaluado', ...carrerasEnVersus.map(() => `${infoRegVersus.nombre} (${etiquetaGeneroVersus})`), 'Contexto Activo'],
      ['1. Contexto y Trazabilidad', 'Sueldo Base Preparatoria de Referencia', ...carrerasEnVersus.map(() => `${formatoMoneda(sueldoPrepaVersus)} / mes`), 'Referencia Regional'],
      registrarFilaNumerica('1. Contexto y Trazabilidad', 'Muestra Física Certificada INEGI', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.n_encuestados_reales, 0)), v => `${v} encuestados`, true),
      registrarFilaNumerica('1. Calificación Global', 'Calificación Integral DataROI (0 a 100)', carrerasEnVersus.map((c: any) => Math.round(Number(c.scoreDataROI ?? 60))), v => `${v} / 100 pts`, true),
      ...filasRadar,
      registrarFilaNumerica('3. Salario y Retorno (ROI)', 'Salario Mensual Consolidado', carrerasEnVersus.map((c: any) => c.sueldo_esperado), v => `${formatoMoneda(v)} / mes`, true),
      registrarFilaNumerica('3. Salario y Retorno (ROI)', 'Prima Salarial vs. Preparatoria', carrerasEnVersus.map((c: any) => c.premioVsPrepaPct), v => `${v >= 0 ? `+${v}%` : `${v}%`} vs. Prepa`, true),
      ['3. Salario y Retorno (ROI)', 'Tendencia Salarial Real (2021–2026)', ...carrerasEnVersus.map((c: any) => c.perfilActivo?.tendencia_salarial || c.tendencia_salarial || 'Estable'), 'Trayectoria INPC'],
      registrarFilaNumerica('3. Salario y Retorno (ROI)', 'Retorno Inversión Univ. Pública', carrerasEnVersus.map((c: any) => calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaVersus, c.cve_carrera, false) ?? 999), fmtAnios, false, 900),
      registrarFilaNumerica('3. Salario y Retorno (ROI)', 'Retorno Inversión Univ. Privada Media', carrerasEnVersus.map((c: any) => calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaVersus, c.cve_carrera, true) ?? 999), fmtAnios, false, 900),
      registrarFilaNumerica('3. Salario y Retorno (ROI)', 'Inversión Requerida en Equipo (CapEx)', carrerasEnVersus.map((c: any) => obtenerCapExCorto(c.cve_carrera).costoEquipo), v => formatoMoneda(v), false),
      registrarFilaNumerica('4. Calidad y Mercado Laboral', 'Empleo de Calidad (Estándar OIT)', carrerasEnVersus.map((c: any) => c.tasaCalidadOIT), v => `${v}%`, true),
      registrarFilaNumerica('4. Calidad y Mercado Laboral', 'Formalidad Laboral Total', carrerasEnVersus.map((c: any) => c.tasaFormalidadTotal), v => `${v}%`, true),
      registrarFilaNumerica('4. Calidad y Mercado Laboral', 'Tasa de Desempleo Abierto', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.tasa_desempleo, 3.5)), v => `${v.toFixed(1)}%`, false),
      registrarFilaNumerica('4. Calidad y Mercado Laboral', 'Índice de Saturación ANUIES', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.indice_saturacion_pct, 100)), v => `${v}%`, false),
      ['4. Calidad y Mercado Laboral', 'Sector Empleador Dominante', ...carrerasEnVersus.map((c: any) => obtenerSectorDominante(c.perfilActivo)), 'Composición INEGI'],
      registrarFilaNumerica('5. Movilidad, Barreras y Futuro', 'Apertura y Movilidad Social (% Mérito)', carrerasEnVersus.map((c: any) => Number((c.crudos?.movilidad ?? 50).toFixed(1))), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('5. Movilidad, Barreras y Futuro', 'Estrato Socioeconómico de Origen (1 a 4)', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.indice_privilegio, 2.8)), v => `${v.toFixed(2)} / 4`, false),
      registrarFilaNumerica('5. Movilidad, Barreras y Futuro', 'Contratación por Contactos / Nepotismo', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_nepotismo, 37)), v => `${v.toFixed(1)}%`, false),
      registrarFilaNumerica('5. Movilidad, Barreras y Futuro', 'Blindaje Humano ante IA', carrerasEnVersus.map((c: any) => 100 - num(c.perfilActivo?.riesgo_ia_score, 40)), v => `${v}%`, true),
      registrarFilaNumerica('5. Movilidad, Barreras y Futuro', 'Trabajo Remoto / Home Office', carrerasEnVersus.map((c: any) => num(c.perfilActivo?.pct_home_office, 0)), v => `${v.toFixed(1)}%`, true),
      registrarFilaNumerica('5. Movilidad, Barreras y Futuro', 'Empleo Único sin Pluriempleo', carrerasEnVersus.map((c: any) => c.pctEmpleoUnico), v => `${v}%`, true),
      registrarFilaNumerica('5. Movilidad, Barreras y Futuro', 'Arraigo Local sin Migrar de Estado', carrerasEnVersus.map((c: any) => c.pctArraigoLocal), v => `${v}%`, true)
    ];

    const victoriasUnicas = Array.from(new Set(conteoVictorias)).sort((a, b) => b - a);
    const celdasPodioFinal: ValorCeldaExcel[] = conteoVictorias.map(v => {
      const posPodio = victoriasUnicas.indexOf(v) + 1;
      const medalla = posPodio === 1 ? '🥇 1° LUGAR (ORO)' : posPodio === 2 ? '🥈 2° LUGAR (PLATA)' : '🥉 3° LUGAR (BRONCE)';
      const estilo: EstiloCeldaExcel = posPodio === 1 ? 'gold' : posPodio === 2 ? 'silver' : 'bronze';
      return { v: `${medalla} — ${v} rubros ganados`, s: estilo };
    });

    filasHoja1.push([
      { v: '6. Veredicto y Podio Global', s: 'section' },
      { v: 'Podio por Total de Indicadores Liderados', s: 'section' },
      ...celdasPodioFinal,
      encontrarLider(conteoVictorias, true)
    ]);

    const regs = ['nacional', 'norte', 'noroeste', 'bajio', 'centro', 'sur'] as const;
    const filasHoja2: ValorCeldaExcel[][] = regs.map(rKey => {
      const metaR = BENCHMARK_REGIONES_VERSUS[rKey];
      const prepaR = metaR.sueldo_prepa[generoVersus];
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

  const exportarVersusExcel = () => {
    if (carrerasEnVersus.length < 2) return;
    const { cabecerasMatriz, filasHoja1, filasHoja2 } = construirHojasVersus();
    descargarLibroExcelXLSX(
      `DataROI_Versus_${regionVersus}_${queryGeneroVersus}_${cvesVersus.join('_')}.xlsx`,
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
      `DataROI_Versus_${regionVersus}_${queryGeneroVersus}_${cvesVersus.join('_')}.csv`,
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
        const sueldosRegMap: Record<string, number | null> = {};
        (['norte', 'noroeste', 'bajio', 'centro', 'sur'] as const).forEach(rk => {
          const pr = c.perfiles?.[rk]?.[generoVersus];
          sueldosRegMap[rk] = pr && pr.celdaValida !== false && Number(pr.sueldo_esperado) > 0
            ? Number(pr.sueldo_esperado)
            : null;
        });
        return {
          cve_carrera: c.cve_carrera,
          nombre_carrera: c.nombre_carrera,
          scoreDataROI: Math.round(c.scoreDataROI),
          sueldo_esperado: c.sueldo_esperado,
          premioVsPrepaPct: Math.round(c.premioVsPrepaPct),
          roiPublica: calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaVersus, c.cve_carrera, false),
          roiPrivada: calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaVersus, c.cve_carrera, true),
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
      nombreArchivo: `DataROI_Comparativa_Versus_${regionVersus}_${queryGeneroVersus}_${cvesVersus.join('_')}.pdf`
    });
  };

  const mostrarBarra = navbarVisible || popoverAbierto;

  return (
    <>
      <header className="no-print sticky top-0 z-40 mb-1">
        <div
          className={`w-full transition-all duration-300 ease-out ${
            mostrarBarra ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
          } ${
            enTope
              ? 'bg-white/85 backdrop-blur-md border-b border-slate-200/80'
              : 'bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-md'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
            
            {/* IDENTIDAD PROPIA DATAROI MÉXICO */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-2xs group-hover:bg-blue-600 group-hover:scale-105 transition-all">
                  DR
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm md:text-base text-slate-900 tracking-tight leading-none group-hover:text-blue-600 transition-colors">
                      DataROI México
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Sparkles className="w-2.5 h-2.5" aria-hidden="true" /> ENOE · ANUIES
                    </span>
                  </div>
                  <span className="block text-[10.5px] font-medium text-slate-400 leading-none mt-1">
                    Auditoría de Retorno y Empleabilidad Universitaria
                  </span>
                </div>
              </Link>
            </div>

            {/* CÁPSULA CENTRAL DE NAVEGACIÓN GLOBAL PERSISTENTE */}
            <nav
              aria-label="Navegación global de la plataforma"
              className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80"
            >
              <Link
                href="/"
                aria-current={esCatalogo ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 ${
                  esCatalogo
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Catálogo (64)</span>
              </Link>

              <Link
                href="/descubrir"
                aria-current={esDescubridor ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 ${
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 ${
                  esLaboratorio
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span>Laboratorio Crudo</span>
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

              {/* POPOVER FLOTANTE DE SELECCIÓN VERSUS */}
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
                                CVE: {cve}
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

      {/* ========================================================================= */}
      {/* MODAL GLOBAL INDEPENDIENTE DE COMPARACIÓN CARA A CARA (SIN REDIRECCIÓN)   */}
      {/* ========================================================================= */}
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
            
            {/* Cabecera del Modal Global */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-blue-600 block mb-0.5">
                  Comparador Ejecutivo Global Cara a Cara · {infoRegVersus.corto} ({etiquetaGeneroVersus})
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

            {/* BARRA INTERACTIVA DE MACRO-REGIÓN Y PERFIL DENTRO DEL PROPIO MODAL */}
            <div className="no-print my-4 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1 mr-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" /> Región de contraste:
                </span>
                {REGIONES_LISTA.map(rKey => {
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
                      {BENCHMARK_REGIONES_VERSUS[rKey]?.corto}
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

            {/* BLOQUE VISUAL: TARJETAS DE CARRERAS + RADAR O BARRAS REGIONALES */}
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

            {/* TABLA COMPARATIVA DE 13 INDICADORES */}
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
                        calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaVersus, c.cve_carrera, false) ?? 999
                      ),
                      formato: (v: number) =>
                        v >= 900 ? 'Retorno negativo' : v === 1 ? '1 año de trabajo' : `${v} años de trabajo`,
                      mejorAlto: false,
                      invalidoSiMayorIgualA: 900
                    },
                    {
                      label: 'Retorno de Inversión (Univ. Privada Media)',
                      valores: carrerasEnVersus.map((c: any) =>
                        calcularAniosRetornoRapido(c.sueldo_esperado, sueldoPrepaVersus, c.cve_carrera, true) ?? 999
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
                        v === 18000 ? 'Básica ($18,000 MXN)' : v === 42000 ? 'Media ($42,000 MXN)' : 'Alta ($85,000 MXN)',
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
                      valores: carrerasEnVersus.map((c: any) => Math.round(Number(c.crudos?.movilidad ?? 50))),
                      formato: (v: number) => `${v}% Mérito`,
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
            <span className="px-3.5 py-1.5">Catálogo (64)</span>
            <span className="px-3.5 py-1.5">Descubridor y Ranking</span>
            <span className="px-3.5 py-1.5">Laboratorio Crudo</span>
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