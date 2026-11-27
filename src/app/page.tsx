import { Suspense } from 'react';
import { connection } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  calcularScoreDataROIUniversal,
  formatearNombreCarreraEjecutivo
} from '@/lib/excelReportGenerator';
import {
  cargarCatalogoCarreras,
  cargarBenchmarksPrepaRows,
  cargarMetaPipeline,
  construirBenchmarksPrepaMap,
  calcularVentanasTemporales,
  calcularSueldoConsolidadoCelda,
  clasificarTendenciaRealDinamica,
  calcularIndicadoresSatelite,
  obtenerCapExDinamico,
  calcularAniosRetornoDinamico,
  descargarTodoPaginado,
  esCeldaSateliteValida,
  padCve,
  numSeguro
} from '@/lib/dataroiEngine';
import DirectorioClient, { CarreraDirectorioItem } from '@/components/DirectorioClient';
import { Loader2 } from 'lucide-react';

function obtenerSectorLider(sat: any): string {
  const sectores = [
    { label: 'PYME', val: Number(sat?.pct_pyme || 0) },
    { label: 'Independiente / Micro', val: Number(sat?.pct_micro || 0) },
    { label: 'Gran Corporativo', val: Number(sat?.pct_corp || 0) },
    { label: 'Gobierno', val: Number(sat?.pct_gobierno || 0) }
  ].sort((a, b) => b.val - a.val);
  return `${sectores[0].val.toFixed(1)}% ${sectores[0].label}`;
}

async function DirectorioCargador() {
  await connection();
  const [carreras, metaPipeline, prepaRows, satelitesNac, seriesNac] = await Promise.all([
    cargarCatalogoCarreras(supabase),
    cargarMetaPipeline(supabase),
    cargarBenchmarksPrepaRows(supabase),
    descargarTodoPaginado(() =>
      supabase
        .from('satelites_cultura')
        .select('*')
        .eq('region', 'nacional')
        .eq('sexo', 0)
        .order('cve_carrera', { ascending: true })
    ),
    descargarTodoPaginado(() =>
      supabase
        .from('predicciones_roi')
        .select('cve_carrera, cve_ent, anio, sexo, poblacion_activa_total, desempleados_reales, sueldo_promedio_mensual, indice_saturacion_pct, is_stem, tipo_dato')
        .eq('tipo_dato', 'Real')
        .in('cve_ent', ['nacional', '0', '00'])
        .order('cve_carrera', { ascending: true })
        .order('anio', { ascending: true })
    )
  ]);

  const ventanas = calcularVentanasTemporales(
    seriesNac.map((r: any) => Number(r.anio)),
    metaPipeline
  );
  const benchPrepaMap = construirBenchmarksPrepaMap(prepaRows, ventanas);
  const sueldoPrepaNac = benchPrepaMap.nacional.sueldo_prepa[0];

  const mapaSatNac: Record<string, any> = {};
  satelitesNac.forEach((s: any) => {
    mapaSatNac[padCve(s.cve_carrera)] = s;
  });

  const satsValidos = satelitesNac.filter((s: any) => esCeldaSateliteValida(s, 'nacional', 0));
  const sumaPesoSatNac = satsValidos.reduce((acc, s) => acc + Math.max(1, numSeguro(s.volumen_muestra_nacional, 1)), 0);
  const mediaEstratoNac = sumaPesoSatNac > 0
    ? Number((satsValidos.reduce((acc, s) => acc + numSeguro(s.indice_privilegio, 2.8) * Math.max(1, numSeguro(s.volumen_muestra_nacional, 1)), 0) / sumaPesoSatNac).toFixed(2))
    : 2.80;
  const mediaNepotismoNac = sumaPesoSatNac > 0
    ? Number((satsValidos.reduce((acc, s) => acc + numSeguro(s.pct_nepotismo, 37.2) * Math.max(1, numSeguro(s.volumen_muestra_nacional, 1)), 0) / sumaPesoSatNac).toFixed(1))
    : 37.2;

  const mapaSeriesNac0: Record<string, any[]> = {};
  const mapaSeriesNac12: Record<string, any[]> = {};

  seriesNac.forEach((r: any) => {
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

  const directorioAumentado: CarreraDirectorioItem[] = [];

  carreras.forEach((carrera) => {
    const cve = padCve(carrera.cve_carrera);
    const sat = mapaSatNac[cve];
    if (!esCeldaSateliteValida(sat, 'nacional', 0)) return;

    const filas = (mapaSeriesNac0[cve] && mapaSeriesNac0[cve].length > 0)
      ? mapaSeriesNac0[cve]
      : (mapaSeriesNac12[cve] || []);

    if (filas.length === 0) return;

    const sueldoMensual = calcularSueldoConsolidadoCelda(filas, ventanas);
    if (sueldoMensual <= 0) return;

    const fEmpleo = filas.filter(r => ventanas.aniosEmpleo.includes(Number(r.anio)));
    const loteEmpleo = fEmpleo.length > 0 ? fEmpleo : filas;

    const peaActiva = Math.round(
      loteEmpleo.reduce((acc, r) => acc + numSeguro(r.poblacion_activa_total, 0), 0) / loteEmpleo.length
    );
    const sumaPea = loteEmpleo.reduce((acc, r) => acc + numSeguro(r.poblacion_activa_total, 0), 0);
    const sumaDes = loteEmpleo.reduce((acc, r) => acc + numSeguro(r.desempleados_reales, 0), 0);
    const desempleoPct = sumaPea > 0 ? Number(Math.max(0.8, (sumaDes / sumaPea) * 100).toFixed(1)) : 3.2;

    const filaReciente = filas.find(r => Number(r.anio) === ventanas.anioMax) || filas[filas.length - 1];
    const saturacionPct = Math.round(numSeguro(filaReciente?.indice_saturacion_pct, 92));
    const isStem = Boolean(filaReciente?.is_stem);
    const riesgoIA = numSeguro(sat.riesgo_ia_score, 40);

    const ind = calcularIndicadoresSatelite({
      sat,
      sueldoMensual,
      sueldoPrepa: sueldoPrepaNac,
      mediaEstratoContexto: mediaEstratoNac,
      mediaNepotismoContexto: mediaNepotismoNac
    });

    const tendencia = clasificarTendenciaRealDinamica(filas, ventanas);

    const evalScore = calcularScoreDataROIUniversal({
      Prima_vs_Prepa_Pct: ind.primaPrepaPct,
      Desempleo_Abierto_Pct: desempleoPct,
      Saturacion_ANUIES_Pct: saturacionPct,
      Empleo_Calidad_OIT_Pct: ind.calidadOitPct,
      Formalidad_Total_Pct: ind.formalidadTotalPct,
      Meritocracia_Pct: ind.meritocraciaPct,
      Blindaje_IA_Pct: ind.blindajeIAPct,
      Tendencia_Codigo: tendencia.codigo,
      Empleo_Unico_Pct: ind.pctEmpleoUnico,
      Arraigo_Local_Pct: ind.pctArraigoLocal
    });

    const capexObj = obtenerCapExDinamico(cve, carrera.capex_mxn);
    const roiPub = calcularAniosRetornoDinamico({
      sueldoCarrera: sueldoMensual,
      sueldoPrepa: sueldoPrepaNac,
      cve,
      escenario: 'publica',
      semestres: carrera.semestres_default,
      capexMxn: carrera.capex_mxn,
      costosRoi: metaPipeline.costos_roi
    }) ?? 99.9;
    const roiPriv = calcularAniosRetornoDinamico({
      sueldoCarrera: sueldoMensual,
      sueldoPrepa: sueldoPrepaNac,
      cve,
      escenario: 'privada_media',
      semestres: carrera.semestres_default,
      capexMxn: carrera.capex_mxn,
      costosRoi: metaPipeline.costos_roi
    }) ?? 99.9;

    directorioAumentado.push({
      cve_carrera: cve,
      nombre_carrera: carrera.nombre_ejecutivo || formatearNombreCarreraEjecutivo(cve, carrera.nombre_carrera),
      nombre_oficial_inegi: carrera.nombre_carrera,
      is_stem: isStem,
      riesgo_ia_score: riesgoIA,
      sueldo_mensual: sueldoMensual,
      premio_prepa_pct: ind.primaPrepaPct,
      sueldo_base_tendencia: tendencia.sueldoBase,
      sueldo_reciente_cierre: tendencia.sueldoReciente,
      cambio_real_pct: tendencia.cambioRealPct,
      crecimiento_anual_pct: tendencia.pendienteAnualPct,
      calidad_oit_pct: ind.calidadOitPct,
      formalidad_total_pct: ind.formalidadTotalPct,
      desempleo_pct: desempleoPct,
      saturacion_pct: saturacionPct,
      meritocracia_pct: ind.meritocraciaPct,
      score_dataroi: evalScore.score,
      pea_activa: peaActiva,
      n_encuestados: numSeguro(sat.n_encuestados_reales, 0),
      costo_capex: capexObj.costoEquipo,
      roi_publica_anios: roiPub,
      roi_privada_anios: roiPriv,
      sector_lider: obtenerSectorLider(sat),
      tendencia_etiqueta: tendencia.etiqueta,
      tendencia_codigo: tendencia.codigo
    });
  });

  return (
    <DirectorioClient
      directorio={directorioAumentado}
      sueldoPrepaNacional={sueldoPrepaNac}
      rangoTexto={ventanas.rangoTexto}
      cierreTexto={ventanas.cierreTexto}
      etiquetaCorte={metaPipeline.etiqueta_corte}
      etiquetaPesosBase={metaPipeline.etiqueta_pesos_base}
    />
  );
}

export default function Home() {
  return (
    <main className="font-sans">
      <Suspense fallback={
        <div className="min-h-[80vh] flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
          <p className="text-slate-500 text-sm font-medium animate-pulse">
            Cargando catálogo nacional de carreras certificadas...
          </p>
        </div>
      }>
        <DirectorioCargador />
      </Suspense>
    </main>
  );
}