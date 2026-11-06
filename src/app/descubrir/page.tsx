import React, { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import DescubridorClient from '@/components/DescubridorClient';

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

const REGIONES_LISTA = ['nacional', 'norte', 'noroeste', 'bajio', 'centro', 'sur'] as const;

async function descargarTodoSupabase(construirQuery: () => any): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let acumulado: any[] = [];
  let desde = 0;

  while (true) {
    const { data, error } = await construirQuery().range(desde, desde + PAGE_SIZE - 1);
    if (error) {
      console.error('Error descargando bloque de Supabase:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    acumulado = acumulado.concat(data);
    if (data.length < PAGE_SIZE) break;
    desde += PAGE_SIZE;
  }

  return acumulado;
}

function auditarCohorteNacional(filasReales: any[]): boolean {
  const filasValidas = filasReales
    .filter(r => r.sueldo_promedio_mensual && Number(r.sueldo_promedio_mensual) > 0)
    .sort((a, b) => Number(a.anio) - Number(b.anio));

  const aniosUnicos = new Set(filasValidas.map(r => Number(r.anio)));
  if (aniosUnicos.size < 4) return false;

  const pops = filasValidas.map(r => Number(r.poblacion_activa_total || 0));
  if (Math.max(...pops) < 3000) return false;

  return true;
}

function calcularSueldoPonderadoRobusto(filas: any[], sueldoRefNacional = 0): number {
  const validas = filas.filter(r => Number(r.sueldo_promedio_mensual || 0) > 0);
  if (validas.length === 0) return 0;

  const sumaPob = validas.reduce((acc, curr) => acc + Math.max(1, Number(curr.poblacion_activa_total || 1)), 0);
  if (sumaPob <= 0) return 0;

  const sumaProducto = validas.reduce((acc, curr) => {
    let s = Number(curr.sueldo_promedio_mensual);
    if (sueldoRefNacional > 0) {
      s = Math.max(sueldoRefNacional * 0.72, Math.min(sueldoRefNacional * 1.22, s));
    }
    return acc + s * Math.max(1, Number(curr.poblacion_activa_total || 1));
  }, 0);

  return sumaProducto / sumaPob;
}

function calcularSueldoNacionalConsolidado(filasRealesNacSx: any[]): number {
  const base22_24 = calcularSueldoPonderadoRobusto(
    filasRealesNacSx.filter(r => r.anio >= 2022 && r.anio <= 2024)
  );
  const filas25_26 = filasRealesNacSx.filter(r => r.anio === 2025 || r.anio === 2026);
  if (filas25_26.length === 0) return Math.round(base22_24);

  const filasSuavizadas = filas25_26.map(r => {
    let s = Number(r.sueldo_promedio_mensual || 0);
    if (base22_24 > 0 && s > 0) {
      if (s > base22_24 * 1.12) s = Math.round(base22_24 * 1.10);
      if (s < base22_24 * 0.88) s = Math.round(base22_24 * 0.90);
    }
    return { ...r, sueldo_promedio_mensual: s };
  });

  return Math.round(calcularSueldoPonderadoRobusto(filasSuavizadas));
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

// Evalúa la pendiente sobre el periodo post-pandemia (2022–2026) para no distorsionar con el rebote de 2021
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
  const ptsRec  = anios.filter(a => a === 2025 || a === 2026).map(a => porAnioMap[a].prod / porAnioMap[a].peso);

  const sueldoBase = ptsBase.length > 0 ? ptsBase.reduce((a, b) => a + b, 0) / ptsBase.length : sueldos[0];
  const sueldoRec  = ptsRec.length > 0 ? ptsRec.reduce((a, b) => a + b, 0) / ptsRec.length : sueldos[sueldos.length - 1];

  const crecRealAcum = sueldoBase > 0 ? (sueldoRec - sueldoBase) / sueldoBase : 0;

  // Pendiente lineal evaluada en el tramo post-pandemia (2022-2026)
  const aniosPost = anios.filter(a => a >= 2022);
  const aniosEval = aniosPost.length >= 3 ? aniosPost : anios;
  const sueldosEval = aniosEval.map(a => porAnioMap[a].prod / porAnioMap[a].peso);
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

function esSateliteCeldaSolida(sat: any, region: string, sx: number): boolean {
  if (!sat) return false;
  const nReal = Number(sat.n_encuestados_reales || 0);
  const nKish = Number(sat.n_efectivo_kish || 0);
  const vol = Number(sat.volumen_muestra_nacional || 0);

  if (region === 'nacional') {
    if (nReal > 0) return sx === 0 ? nReal >= 180 : nReal >= 25;
    return sx === 0 ? vol >= 120000 : vol >= 15000;
  }

  if (nReal > 0) {
    const minN = sx === 0 ? 30 : 25;
    return nReal >= minN && (nKish === 0 || nKish >= 18);
  }
  return sx === 0 ? vol >= 15000 : vol >= 10000;
}

async function RankingCargador() {
  const padCve = (cve: any) => String(cve).padStart(6, '0');

  const colsPred = 'cve_carrera, cve_ent, anio, sexo, tipo_dato, poblacion_activa_total, desempleados_reales, sueldo_promedio_mensual, indice_saturacion_pct';

  const [resCarreras, todosSatelites, todasSeries] = await Promise.all([
    supabase.from('dim_carreras').select('cve_carrera, nombre_carrera'),
    descargarTodoSupabase(() =>
      supabase.from('satelites_cultura').select('*').order('cve_carrera', { ascending: true })
    ),
    descargarTodoSupabase(() =>
      supabase
        .from('predicciones_roi')
        .select(colsPred)
        .eq('tipo_dato', 'Real')
        .order('cve_carrera', { ascending: true })
        .order('anio', { ascending: true })
    )
  ]);

  const carreras = (resCarreras.data || []).filter(c => padCve(c.cve_carrera) !== '999999');

  const mapaSat: Record<string, any> = {};
  todosSatelites.forEach(s => {
    const key = `${padCve(s.cve_carrera)}_${String(s.region || 'nacional').toLowerCase().trim()}_${Number(s.sexo ?? 0)}`;
    mapaSat[key] = s;
  });

  const mapaSeriesDirectas: Record<string, any[]> = {};
  todasSeries.forEach(r => {
    const cve = padCve(r.cve_carrera);
    const entRaw = String(r.cve_ent || 'nacional').toLowerCase().trim();
    const sx = Number(r.sexo ?? 0);

    let regDestino = entRaw;
    if (entRaw === '0' || entRaw === '00' || entRaw === 'nacional') {
      regDestino = 'nacional';
    } else if (!REGIONES_LISTA.includes(entRaw as any)) {
      const entPad = entRaw.padStart(2, '0');
      const encontrada = Object.entries(ESTADOS_POR_REGION).find(([, lista]) => lista.includes(entPad));
      if (encontrada) regDestino = encontrada[0];
    }

    const key = `${cve}_${regDestino}_${sx}`;
    if (!mapaSeriesDirectas[key]) mapaSeriesDirectas[key] = [];
    mapaSeriesDirectas[key].push(r);
  });

  const obtenerSerieCelda = (cve: string, reg: string, sx: number): any[] => {
    const directa = mapaSeriesDirectas[`${cve}_${reg}_${sx}`];
    if (directa && directa.length > 0) return directa;
    if (sx === 0) {
      return [
        ...(mapaSeriesDirectas[`${cve}_${reg}_1`] || []),
        ...(mapaSeriesDirectas[`${cve}_${reg}_2`] || [])
      ];
    }
    return [];
  };

  const datosCrudos = carreras.map((c) => {
    const cve = padCve(c.cve_carrera);
    const satNacTotal = mapaSat[`${cve}_nacional_0`];
    const cumpleSateliteNacional = esSateliteCeldaSolida(satNacTotal, 'nacional', 0);

    const serieNac0 = obtenerSerieCelda(cve, 'nacional', 0);
    const serieNac1 = obtenerSerieCelda(cve, 'nacional', 1);
    const serieNac2 = obtenerSerieCelda(cve, 'nacional', 2);

    const cohorteValida = auditarCohorteNacional(serieNac0) || auditarCohorteNacional(serieNac1) || auditarCohorteNacional(serieNac2);
    const tendenciaNac = clasificarTendenciaReal21_26(serieNac0);

    const filasNac22_26 = serieNac0.filter(r => r.anio >= 2022 && r.anio <= 2026);
    const volumenConsolidadoNac = filasNac22_26.length > 0
      ? Math.round(filasNac22_26.reduce((s, curr) => s + Number(curr.poblacion_activa_total || 0), 0) / filasNac22_26.length)
      : 0;

    const sueldoNacTotal = calcularSueldoNacionalConsolidado(serieNac0);
    const sueldoNacH = calcularSueldoNacionalConsolidado(serieNac1);
    const sueldoNacM = calcularSueldoNacionalConsolidado(serieNac2);

    const brechaSalarialNacPct = (sueldoNacH > 0 && sueldoNacM > 0)
      ? Math.min(38, Math.abs(((sueldoNacH - sueldoNacM) / Math.max(sueldoNacH, sueldoNacM)) * 100))
      : 10.0;

    const perfiles: Record<string, Record<number, any>> = {};

    REGIONES_LISTA.forEach(reg => {
      perfiles[reg] = {};

      const serieRegH = obtenerSerieCelda(cve, reg, 1).filter(r => r.anio >= 2022 && r.anio <= 2026);
      const serieRegM = obtenerSerieCelda(cve, reg, 2).filter(r => r.anio >= 2022 && r.anio <= 2026);

      const pobRegH = serieRegH.length > 0
        ? serieRegH.reduce((s, curr) => s + Number(curr.poblacion_activa_total || 0), 0) / serieRegH.length
        : 0;
      const pobRegM = serieRegM.length > 0
        ? serieRegM.reduce((s, curr) => s + Number(curr.poblacion_activa_total || 0), 0) / serieRegM.length
        : 0;

      const sueldoRegH = calcularSueldoPonderadoRobusto(serieRegH, sueldoNacH || sueldoNacTotal);
      const sueldoRegM = calcularSueldoPonderadoRobusto(serieRegM, sueldoNacM || sueldoNacTotal);

      const brechaSalarialPct = (pobRegH >= 1500 && pobRegM >= 1500 && sueldoRegH > 0 && sueldoRegM > 0)
        ? Math.min(38, Math.abs(((sueldoRegH - sueldoRegM) / Math.max(sueldoRegH, sueldoRegM)) * 100))
        : brechaSalarialNacPct;

      const satEstructural = mapaSat[`${cve}_${reg}_0`] || satNacTotal || {};

      [0, 1, 2].forEach(sx => {
        const satExacto = mapaSat[`${cve}_${reg}_${sx}`];
        const satEsSolido = esSateliteCeldaSolida(satExacto, reg, sx);
        const nKishCelda = Number(satExacto?.n_efectivo_kish || 0);

        const serieCelda = obtenerSerieCelda(cve, reg, sx);
        const tendenciaCelda = serieCelda.length >= 4
          ? clasificarTendenciaReal21_26(serieCelda)
          : tendenciaNac;

        const filasVentana22_26 = serieCelda.filter(r => r.anio >= 2022 && r.anio <= 2026);
        const filas25_26 = serieCelda.filter(r => r.anio === 2025 || r.anio === 2026);
        const loteEmpleo = filasVentana22_26.length > 0 ? filasVentana22_26 : serieCelda;

        const refNacSx = sx === 1 ? (sueldoNacH || sueldoNacTotal) : sx === 2 ? (sueldoNacM || sueldoNacTotal) : sueldoNacTotal;

        const sueldoObsCrudo = calcularSueldoPonderadoRobusto(
          filas25_26.length > 0 ? filas25_26 : loteEmpleo,
          reg === 'nacional' ? 0 : refNacSx
        );

        const sueldoConsolidado = reg === 'nacional'
          ? Math.round(sueldoObsCrudo || refNacSx)
          : calcularSueldoRegionalBuhlmann(sueldoObsCrudo, refNacSx, reg, nKishCelda);

        const pobActivaConsolidada = loteEmpleo.length > 0
          ? Math.round(loteEmpleo.reduce((acc, r) => acc + Number(r.poblacion_activa_total || 0), 0) / loteEmpleo.length)
          : 0;
        const sumaPea5a = loteEmpleo.reduce((acc, r) => acc + Number(r.poblacion_activa_total || 0), 0);
        const sumaDes5a = loteEmpleo.reduce((acc, r) => acc + Number(r.desempleados_reales || 0), 0);
        const tasaDesempleo = sumaPea5a > 0 ? Math.max(0.8, (sumaDes5a / sumaPea5a) * 100) : 3.2;

        const filaReciente = serieCelda.find(r => r.anio === 2026) || serieCelda[serieCelda.length - 1];
        const saturacion = Number(filaReciente?.indice_saturacion_pct || 92);

        const celdaValida = satEsSolido && sueldoConsolidado > 0 && pobActivaConsolidada >= 100;
        const satUsar = satExacto || {};

        perfiles[reg][sx] = {
          celdaValida,
          n_encuestados_reales: Number(satUsar.n_encuestados_reales ?? 0),
          sueldo_esperado: sueldoConsolidado,
          tendencia_salarial: tendenciaCelda.etiqueta,
          tendencia_codigo: tendenciaCelda.codigo,
          tasa_desempleo: Number(tasaDesempleo.toFixed(1)),
          indice_saturacion_pct: Number(saturacion.toFixed(0)),
          volumen_validado: reg === 'nacional' ? volumenConsolidadoNac : pobActivaConsolidada,
          brecha_salarial_pct: Number(brechaSalarialPct.toFixed(1)),
          pct_micro: Number(satUsar.pct_micro ?? 0),
          pct_pyme: Number(satUsar.pct_pyme ?? 0),
          pct_corp: Number(satUsar.pct_corp ?? 0),
          pct_gobierno: Number(satUsar.pct_gobierno ?? 0),
          pct_home_office: Number(satUsar.pct_home_office ?? 0),
          pct_nepotismo: Number(satUsar.pct_nepotismo ?? 37),
          pct_pluriempleo: Number(satUsar.pct_pluriempleo ?? 5.6),
          pct_medio_tiempo: Number(satUsar.pct_medio_tiempo ?? 14),
          pct_desarraigo: Number(satUsar.pct_desarraigo ?? 2.7),
          pct_contrato: Number(satUsar.pct_contrato ?? 65),
          pct_sindicato: Number(satUsar.pct_sindicato ?? 15),
          pct_aguinaldo: Number(satUsar.pct_aguinaldo ?? 63),
          pct_afore: Number(satUsar.pct_afore ?? 55),
          pct_sgmm: Number(satUsar.pct_sgmm ?? 8),
          pct_materno: Number(satUsar.pct_materno ?? satEstructural.pct_materno ?? 23),
          pct_materno_estructural: Number(satEstructural.pct_materno ?? 23),
          indice_privilegio: Number(satUsar.indice_privilegio ?? 2.80),
          hrs_doble_jornada_hombres: Number(satUsar.hrs_doble_jornada_hombres ?? 9.6),
          hrs_doble_jornada_mujeres: Number(satUsar.hrs_doble_jornada_mujeres ?? 21.1),
          brecha_genero_hogar_hrs: Number(satUsar.brecha_genero_hogar_hrs ?? 11.5),
          riesgo_ia_score: Number(satUsar.riesgo_ia_score ?? 40)
        };
      });
    });

    return {
      cve_carrera: cve,
      nombre_carrera: c.nombre_carrera,
      tendencia_salarial: tendenciaNac.etiqueta,
      tendencia_codigo: tendenciaNac.codigo,
      volumen_nacional_2026: volumenConsolidadoNac,
      cumpleFiltroNacional: cumpleSateliteNacional && cohorteValida,
      perfiles
    };
  });

  const datosDepurados = datosCrudos.filter((carrera) => {
    const sueldoNac = carrera.perfiles?.nacional?.[0]?.sueldo_esperado || 0;
    return carrera.cumpleFiltroNacional && sueldoNac > 0;
  });

  return <DescubridorClient datos={datosDepurados} />;
}

export default function DescubrirPage() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans p-4 md:p-6">
      <div className="max-w-6xl mx-auto mb-4">
        <Link href="/" className="inline-flex items-center text-xs md:text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Directorio Nacional
        </Link>
      </div>

      <Suspense fallback={
        <div className="min-h-screen flex flex-col items-center justify-center">
          <Loader2 className="w-9 h-9 animate-spin text-blue-600 mb-3" />
          <p className="text-slate-500 text-sm font-medium animate-pulse">
            Auditando muestras regionales y cargando motor de decisión...
          </p>
        </div>
      }>
        <RankingCargador />
      </Suspense>
    </main>
  );
}