import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import DirectorioClient, { CarreraDirectorioItem } from '@/components/DirectorioClient';
import { Loader2 } from 'lucide-react';

async function descargarTodoSupabase(construirQuery: () => any): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let acumulado: any[] = [];
  let desde = 0;

  while (true) {
    const { data, error } = await construirQuery().range(desde, desde + PAGE_SIZE - 1);
    if (error) {
      console.error('Error descargando bloque en Directorio:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    acumulado = acumulado.concat(data);
    if (data.length < PAGE_SIZE) break;
    desde += PAGE_SIZE;
  }

  return acumulado;
}

function obtenerCostoCapEx(cve: string): number {
  const pref3 = cve.slice(0, 3);
  const pref4 = cve.slice(0, 4);
  if (
    pref4 === '0911' || pref4 === '0931' || pref3 === '073' || pref3 === '021' ||
    pref4 === '0821' || pref4 === '1014' || pref4 === '1013' || pref4 === '1015'
  ) {
    return 85000;
  }
  if (
    pref3 === '061' || pref3 === '062' || pref3 === '071' || pref3 === '072' ||
    pref3 === '051' || pref3 === '052' || pref3 === '053' || pref3 === '081' ||
    pref3 === '091' || pref3 === '092' || pref3 === '094' || pref3 === '095'
  ) {
    return 42000;
  }
  return 18000;
}

function obtenerSectorLider(sat: any): string {
  const sectores = [
    { label: 'PYME', val: Number(sat?.pct_pyme || 0) },
    { label: 'Independiente / Micro', val: Number(sat?.pct_micro || 0) },
    { label: 'Gran Corporativo', val: Number(sat?.pct_corp || 0) },
    { label: 'Gobierno', val: Number(sat?.pct_gobierno || 0) }
  ].sort((a, b) => b.val - a.val);
  return `${sectores[0].val.toFixed(1)}% ${sectores[0].label}`;
}

function clasificarTendenciaNacional(filasReales: any[]) {
  const ordenadas = filasReales
    .filter(r => Number(r.sueldo_promedio_mensual) > 0)
    .sort((a, b) => Number(a.anio) - Number(b.anio));

  if (ordenadas.length < 4) {
    const sUnico = ordenadas.length > 0 ? Math.round(Number(ordenadas[ordenadas.length - 1].sueldo_promedio_mensual)) : 0;
    return {
      etiqueta: 'Estable',
      codigo: 'estable' as const,
      sueldoBase22_23: sUnico,
      sueldoRec25_26: sUnico,
      cambioRealPct: 0,
      pendienteAnualPct: 0
    };
  }

  const sueldos = ordenadas.map(r => Number(r.sueldo_promedio_mensual));
  let maxSalto = 0;
  for (let i = 1; i < sueldos.length; i++) {
    const salto = Math.abs(sueldos[i] - sueldos[i - 1]) / sueldos[i - 1];
    if (salto > maxSalto) maxSalto = salto;
  }

  const media = sueldos.reduce((a, b) => a + b, 0) / sueldos.length;
  const varianza = sueldos.reduce((a, b) => a + Math.pow(b - media, 2), 0) / sueldos.length;
  const cv = Math.sqrt(varianza) / (media || 1);

  const fBase = ordenadas.filter(r => r.anio === 2022 || r.anio === 2023);
  const fRec = ordenadas.filter(r => r.anio === 2025 || r.anio === 2026);

  const sueldoBase = fBase.length > 0
    ? fBase.reduce((a, c) => a + Number(c.sueldo_promedio_mensual), 0) / fBase.length
    : sueldos[0];
  const sueldoRec = fRec.length > 0
    ? fRec.reduce((a, c) => a + Number(c.sueldo_promedio_mensual), 0) / fRec.length
    : sueldos[sueldos.length - 1];

  const crecRealAcum = sueldoBase > 0 ? (sueldoRec - sueldoBase) / sueldoBase : 0;
  const cambioPctRedondeado = Number((crecRealAcum * 100).toFixed(1));

  const post = ordenadas.filter(r => Number(r.anio) >= 2022);
  const loteEval = post.length >= 3 ? post : ordenadas;
  const aniosEval = loteEval.map(r => Number(r.anio));
  const sueldosEval = loteEval.map(r => Number(r.sueldo_promedio_mensual));
  const mediaEval = sueldosEval.reduce((a, b) => a + b, 0) / sueldosEval.length;

  const meanX = aniosEval.reduce((a, b) => a + b, 0) / aniosEval.length;
  const num = aniosEval.reduce((acc, x, idx) => acc + (x - meanX) * (sueldosEval[idx] - mediaEval), 0);
  const den = aniosEval.reduce((acc, x) => acc + Math.pow(x - meanX, 2), 0) || 1;
  const pendientePct = (num / den) / (mediaEval || 1);
  const pendAnualRed = Number((pendientePct * 100).toFixed(1));

  if (maxSalto > 0.22 || cv > 0.16) {
    return {
      etiqueta: 'Volátil',
      codigo: 'volatil' as const,
      sueldoBase22_23: Math.round(sueldoBase),
      sueldoRec25_26: Math.round(sueldoRec),
      cambioRealPct: cambioPctRedondeado,
      pendienteAnualPct: pendAnualRed
    };
  }

  if (crecRealAcum >= 0.040 && pendientePct >= 0.008) {
    return {
      etiqueta: 'En crecimiento',
      codigo: 'crecimiento' as const,
      sueldoBase22_23: Math.round(sueldoBase),
      sueldoRec25_26: Math.round(sueldoRec),
      cambioRealPct: cambioPctRedondeado,
      pendienteAnualPct: pendAnualRed
    };
  }
  if (crecRealAcum <= -0.040 && pendientePct <= -0.008) {
    return {
      etiqueta: 'En ajuste',
      codigo: 'ajuste' as const,
      sueldoBase22_23: Math.round(sueldoBase),
      sueldoRec25_26: Math.round(sueldoRec),
      cambioRealPct: cambioPctRedondeado,
      pendienteAnualPct: pendAnualRed
    };
  }
  return {
    etiqueta: 'Estable',
    codigo: 'estable' as const,
    sueldoBase22_23: Math.round(sueldoBase),
    sueldoRec25_26: Math.round(sueldoRec),
    cambioRealPct: cambioPctRedondeado,
    pendienteAnualPct: pendAnualRed
  };
}

async function DirectorioCargador() {
  const padCve = (cve: any) => String(cve).padStart(6, '0');

  const [resCarreras, satelitesNac, seriesNac] = await Promise.all([
    supabase.from('dim_carreras').select('cve_carrera, nombre_carrera').order('nombre_carrera', { ascending: true }),
    descargarTodoSupabase(() =>
      supabase
        .from('satelites_cultura')
        .select('*')
        .eq('region', 'nacional')
        .eq('sexo', 0)
    ),
    descargarTodoSupabase(() =>
      supabase
        .from('predicciones_roi')
        .select('cve_carrera, cve_ent, anio, sexo, poblacion_activa_total, desempleados_reales, sueldo_promedio_mensual, indice_saturacion_pct, is_stem, tipo_dato')
        .eq('tipo_dato', 'Real')
        .in('cve_ent', ['nacional', '0', '00'])
        .order('anio', { ascending: true })
    )
  ]);

  const carreras = (resCarreras.data || []).filter(c => padCve(c.cve_carrera) !== '999999');

  const mapaSatNac: Record<string, any> = {};
  satelitesNac.forEach(s => {
    mapaSatNac[padCve(s.cve_carrera)] = s;
  });

  const mapaSeriesNac0: Record<string, any[]> = {};
  const mapaSeriesNac12: Record<string, any[]> = {};

  seriesNac.forEach(r => {
    const cve = padCve(r.cve_carrera);
    const sx = Number(r.sexo ?? 0);
    if (sx === 0) {
      if (!mapaSeriesNac0[cve]) mapaSeriesNac0[cve] = [];
      mapaSeriesNac0[cve].push(r);
    } else {
      if (!mapaSeriesNac12[cve]) mapaSeriesNac12[cve] = [];
      mapaSeriesNac12[cve].push(r);
    }
  });

  const SUELDO_PREPA_NAC = 10608;
  const directorioAumentado: CarreraDirectorioItem[] = [];

  carreras.forEach((carrera) => {
    const cve = padCve(carrera.cve_carrera);
    const sat = mapaSatNac[cve];
    if (!sat || Number(sat.n_encuestados_reales || 0) < 180) return;

    const filas = (mapaSeriesNac0[cve] && mapaSeriesNac0[cve].length > 0)
      ? mapaSeriesNac0[cve]
      : (mapaSeriesNac12[cve] || []);

    if (filas.length === 0) return;

    const f25_26 = filas.filter(r => (r.anio === 2025 || r.anio === 2026) && Number(r.sueldo_promedio_mensual) > 0);
    const loteSueldo = f25_26.length > 0 ? f25_26 : filas.filter(r => Number(r.sueldo_promedio_mensual) > 0);
    if (loteSueldo.length === 0) return;

    const sumaPobSueldo = loteSueldo.reduce((acc, r) => acc + Math.max(1, Number(r.poblacion_activa_total || 1)), 0);
    const sueldoMensual = Math.round(
      loteSueldo.reduce((acc, r) => acc + Number(r.sueldo_promedio_mensual) * Math.max(1, Number(r.poblacion_activa_total || 1)), 0) / sumaPobSueldo
    );

    const f22_26 = filas.filter(r => r.anio >= 2022 && r.anio <= 2026);
    const loteEmpleo = f22_26.length > 0 ? f22_26 : filas;
    const peaActiva = Math.round(
      loteEmpleo.reduce((acc, r) => acc + Number(r.poblacion_activa_total || 0), 0) / loteEmpleo.length
    );
    const sumaPea5a = loteEmpleo.reduce((acc, r) => acc + Number(r.poblacion_activa_total || 0), 0);
    const sumaDes5a = loteEmpleo.reduce((acc, r) => acc + Number(r.desempleados_reales || 0), 0);
    const desempleoPct = sumaPea5a > 0 ? Number(Math.max(0.8, (sumaDes5a / sumaPea5a) * 100).toFixed(1)) : 3.2;

    const filaReciente = filas.find(r => r.anio === 2026) || filas[filas.length - 1];
    const saturacionPct = Math.round(Number(filaReciente?.indice_saturacion_pct || 92));
    const isStem = Boolean(filaReciente?.is_stem) || cve.startsWith('05') || cve.startsWith('06') || cve.startsWith('07');

    const pCont = Number(sat.pct_contrato || 65);
    const pAgui = Number(sat.pct_aguinaldo || 63);
    const pAfor = Number(sat.pct_afore || 55);
    const pPlur = Number(sat.pct_pluriempleo || 5.6);
    const pDesa = Number(sat.pct_desarraigo || 2.7);
    const pHo = Number(sat.pct_home_office || 3.7);
    const pMicr = Number(sat.pct_micro || 28);
    const pPyme = Number(sat.pct_pyme || 30);
    const pCorp = Number(sat.pct_corp || 12);
    const pMt = Number(sat.pct_medio_tiempo || 14);
    const pSind = Number(sat.pct_sindicato || 15);
    const pNep = Number(sat.pct_nepotismo || 37.2);
    const priv = Number(sat.indice_privilegio || 2.80);

    const calidadOitPct = Number((((Math.min(pCont, pAfor) * 0.70 + pCont * 0.30) * (1 - pPlur / 200))).toFixed(1));
    const formalidadTotalPct = Number((pCont * 0.45 + pAgui * 0.30 + pAfor * 0.25).toFixed(1));

    // Cálculo de los 6 Pilares Estructurales y del Score de Balance General (0-100)
    const p1Sal = Math.round(Math.max(15, Math.min(100, ((sueldoMensual - 9500) / (22000 - 9500)) * 100)));
    const p2Form = Math.round(formalidadTotalPct);
    const p3Emp = Math.round(Math.max(10, Math.min(100, 100 - desempleoPct * 8.0)) * 0.60 + Math.max(10, Math.min(100, 168 - saturacionPct)) * 0.40);

    const diffEst = priv - 2.80;
    const penElit = diffEst > 0.05 ? (diffEst - 0.05) * 110 : diffEst * 35;
    const incOrig = Math.max(15, Math.min(92, 70 - penElit));
    const apContr = Math.max(10, Math.min(95, 100 - (pNep + pSind * 0.22)));
    const saltoSc = Math.max(0, Math.min(100, ((sueldoMensual - SUELDO_PREPA_NAC) / SUELDO_PREPA_NAC) * 100));
    const impAsc = saltoSc * 0.45 + calidadOitPct * 0.35 + Math.min(100, pCorp * 2.2 + pPyme * 0.6) * 0.20;
    const rawMov = Math.max(12, Math.min(96, apContr * 0.40 + impAsc * 0.35 + incOrig * 0.25));
    const p4Mer = Math.round(rawMov);

    const p5Aut = Math.round(Math.max(15, Math.min(100, Math.min(100, pHo * 5.0) * 0.40 + Math.min(100, pMicr * 1.5) * 0.35 + Math.min(100, pMt * 2.0) * 0.25)));
    const p6Est = Math.round(Math.max(10, Math.min(100, 100 - pPlur * 5.0)) * 0.35 + Math.max(10, Math.min(100, 100 - pDesa * 6.5)) * 0.30 + pCont * 0.35);

    const scoreBalance = Number((p1Sal * 0.22 + p2Form * 0.18 + p3Emp * 0.22 + p4Mer * 0.16 + p5Aut * 0.10 + p6Est * 0.12).toFixed(1));

    const tendencia = clasificarTendenciaNacional(filas);
    const premioVsPrepaPct = Number((((sueldoMensual - SUELDO_PREPA_NAC) / SUELDO_PREPA_NAC) * 100).toFixed(1));

    const capex = obtenerCostoCapEx(cve);
    const bonoAnual = (sueldoMensual - SUELDO_PREPA_NAC) * 12;
    const roiPub = bonoAnual > 0 ? Number(((32000 + capex) / bonoAnual).toFixed(1)) : 99.9;
    const roiPriv = bonoAnual > 0 ? Number(((340000 + capex) / bonoAnual).toFixed(1)) : 99.9;

    directorioAumentado.push({
      cve_carrera: cve,
      nombre_carrera: carrera.nombre_carrera,
      is_stem: isStem,
      riesgo_ia_score: Number(sat.riesgo_ia_score ?? 40),
      sueldo_mensual: sueldoMensual,
      premio_prepa_pct: premioVsPrepaPct,
      sueldo_2022_2023: tendencia.sueldoBase22_23,
      sueldo_2025_2026: tendencia.sueldoRec25_26,
      cambio_real_pct: tendencia.cambioRealPct,
      crecimiento_anual_pct: tendencia.pendienteAnualPct,
      calidad_oit_pct: calidadOitPct,
      formalidad_total_pct: formalidadTotalPct,
      desempleo_pct: desempleoPct,
      saturacion_pct: saturacionPct,
      meritocracia_pct: Number(rawMov.toFixed(1)),
      score_balance: scoreBalance,
      pea_activa: peaActiva,
      n_encuestados: Number(sat.n_encuestados_reales || 0),
      costo_capex: capex,
      roi_publica_anios: roiPub,
      roi_privada_anios: roiPriv,
      sector_lider: obtenerSectorLider(sat),
      tendencia_etiqueta: tendencia.etiqueta,
      tendencia_codigo: tendencia.codigo
    });
  });

  return <DirectorioClient directorio={directorioAumentado} />;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Suspense fallback={
        <div className="min-h-screen flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
          <p className="text-slate-500 text-sm font-medium animate-pulse">
            Cargando catálogo nacional de 64 carreras certificadas...
          </p>
        </div>
      }>
        <DirectorioCargador />
      </Suspense>
    </main>
  );
}