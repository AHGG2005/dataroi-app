import React, { Suspense } from 'react';
import { connection } from 'next/server';
import { supabase } from '@/lib/supabase';
import { formatearNombreCarreraEjecutivo } from '@/lib/excelReportGenerator';
import {
  REGIONES_ORDEN,
  CodigoGenero,
  RegionClave,
  cargarCatalogoCarreras,
  cargarBenchmarksPrepaRows,
  cargarSatelitesPrepaRows,
  cargarMetaPipeline,
  construirBenchmarksPrepaMap,
  calcularVentanasTemporales,
  calcularSueldoPonderado,
  calcularSueldoConsolidadoCelda,
  clasificarTendenciaRealDinamica,
  descargarTodoPaginado,
  esCeldaSateliteValida,
  normalizarRegion,
  padCve,
  numSeguro
} from '@/lib/dataroiEngine';
import { Loader2 } from 'lucide-react';
import DescubridorClient from '@/components/DescubridorClient';

function auditarCohorteNacional(filasReales: any[], minAniosRequeridos: number): boolean {
  const filasValidas = filasReales.filter(r => numSeguro(r.sueldo_promedio_mensual, 0) > 0);
  const aniosUnicos = new Set(filasValidas.map(r => Number(r.anio)));
  if (aniosUnicos.size < minAniosRequeridos) return false;

  const pops = filasValidas.map(r => numSeguro(r.poblacion_activa_total, 0));
  if (pops.length === 0 || Math.max(...pops) < 3000) return false;

  return true;
}

async function RankingCargador() {
  await connection();

  const colsPred =
    'cve_carrera, cve_ent, anio, sexo, tipo_dato, is_stem, poblacion_activa_total, desempleados_reales, sueldo_promedio_mensual, indice_saturacion_pct';

  const [carreras, metaPipeline, prepaRows, satPrepaRows, todosSatelites, todasSeries] = await Promise.all([
    cargarCatalogoCarreras(supabase),
    cargarMetaPipeline(supabase),
    cargarBenchmarksPrepaRows(supabase),
    cargarSatelitesPrepaRows(supabase),
    descargarTodoPaginado(() =>
      supabase
        .from('satelites_cultura')
        .select('*')
        .order('cve_carrera', { ascending: true })
        .order('region', { ascending: true })
        .order('sexo', { ascending: true })
    ),
    descargarTodoPaginado(() =>
      supabase
        .from('predicciones_roi')
        .select(colsPred)
        .eq('tipo_dato', 'Real')
        .order('cve_carrera', { ascending: true })
        .order('cve_ent', { ascending: true })
        .order('sexo', { ascending: true })
        .order('anio', { ascending: true })
    )
  ]);

  const ventanas = calcularVentanasTemporales(
    todasSeries.map((r: any) => Number(r.anio)),
    metaPipeline
  );
  const benchmarksPrepa = construirBenchmarksPrepaMap(prepaRows, ventanas, satPrepaRows);
  const minAniosCohorte = Math.min(4, Math.max(1, ventanas.aniosOrdenados.length));

  const mapaSat: Record<string, any> = {};
  todosSatelites.forEach((s: any) => {
    const key = `${padCve(s.cve_carrera)}_${normalizarRegion(s.region)}_${Number(s.sexo ?? 0)}`;
    mapaSat[key] = s;
  });

  const mapaSeriesDirectas: Record<string, any[]> = {};
  todasSeries.forEach((r: any) => {
    const cve = padCve(r.cve_carrera);
    const regDestino = normalizarRegion(r.cve_ent);
    const sx = Number(r.sexo ?? 0);
    const key = `${cve}_${regDestino}_${sx}`;
    if (!mapaSeriesDirectas[key]) mapaSeriesDirectas[key] = [];
    mapaSeriesDirectas[key].push(r);
  });

  const obtenerSerieCelda = (cve: string, reg: RegionClave, sx: CodigoGenero): any[] => {
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
    const cumpleSateliteNacional = esCeldaSateliteValida(satNacTotal, 'nacional', 0);

    const serieNac0 = obtenerSerieCelda(cve, 'nacional', 0);
    const serieNac1 = obtenerSerieCelda(cve, 'nacional', 1);
    const serieNac2 = obtenerSerieCelda(cve, 'nacional', 2);

    const cohorteValida =
      auditarCohorteNacional(serieNac0, minAniosCohorte) ||
      auditarCohorteNacional(serieNac1, minAniosCohorte) ||
      auditarCohorteNacional(serieNac2, minAniosCohorte);

    const tendenciaNac = clasificarTendenciaRealDinamica(serieNac0, ventanas);

    const filasNacEmp = serieNac0.filter(r => ventanas.aniosEmpleo.includes(Number(r.anio)));
    const loteVolNac = filasNacEmp.length > 0 ? filasNacEmp : serieNac0;
    const volumenConsolidadoNac = loteVolNac.length > 0
      ? Math.round(loteVolNac.reduce((s, curr) => s + numSeguro(curr.poblacion_activa_total, 0), 0) / loteVolNac.length)
      : 0;

    const sueldoNacTotal = calcularSueldoConsolidadoCelda(serieNac0, ventanas);
    const sueldoNacH = calcularSueldoConsolidadoCelda(serieNac1, ventanas, sueldoNacTotal);
    const sueldoNacM = calcularSueldoConsolidadoCelda(serieNac2, ventanas, sueldoNacTotal);

    const brechaSalarialNacPct = (sueldoNacH > 0 && sueldoNacM > 0)
      ? Math.min(38, Math.abs(((sueldoNacH - sueldoNacM) / Math.max(sueldoNacH, sueldoNacM)) * 100))
      : 10.0;

    const perfiles: Record<string, Record<number, any>> = {};

    REGIONES_ORDEN.forEach((reg) => {
      perfiles[reg] = {};

      const serieRegH = obtenerSerieCelda(cve, reg, 1).filter(r => ventanas.aniosEmpleo.includes(Number(r.anio)));
      const serieRegM = obtenerSerieCelda(cve, reg, 2).filter(r => ventanas.aniosEmpleo.includes(Number(r.anio)));

      const pobRegH = serieRegH.length > 0
        ? serieRegH.reduce((s, curr) => s + numSeguro(curr.poblacion_activa_total, 0), 0) / serieRegH.length
        : 0;
      const pobRegM = serieRegM.length > 0
        ? serieRegM.reduce((s, curr) => s + numSeguro(curr.poblacion_activa_total, 0), 0) / serieRegM.length
        : 0;

      const sueldoRegH = calcularSueldoPonderado(serieRegH);
      const sueldoRegM = calcularSueldoPonderado(serieRegM);

      const brechaSalarialPct = (pobRegH >= 1500 && pobRegM >= 1500 && sueldoRegH > 0 && sueldoRegM > 0)
        ? Math.min(38, Math.abs(((sueldoRegH - sueldoRegM) / Math.max(sueldoRegH, sueldoRegM)) * 100))
        : brechaSalarialNacPct;

      const satEstructural = mapaSat[`${cve}_${reg}_0`] || satNacTotal || {};

      ([0, 1, 2] as CodigoGenero[]).forEach((sx) => {
        const satExacto = mapaSat[`${cve}_${reg}_${sx}`];
        const satEsSolido = esCeldaSateliteValida(satExacto, reg, sx);

        const serieCelda = obtenerSerieCelda(cve, reg, sx);
        const tendenciaCelda = serieCelda.length >= 4
          ? clasificarTendenciaRealDinamica(serieCelda, ventanas)
          : tendenciaNac;

        const filasVentanaEmp = serieCelda.filter(r => ventanas.aniosEmpleo.includes(Number(r.anio)));
        const loteEmpleo = filasVentanaEmp.length > 0 ? filasVentanaEmp : serieCelda;

        const refNacSx = sx === 1 ? (sueldoNacH || sueldoNacTotal) : sx === 2 ? (sueldoNacM || sueldoNacTotal) : sueldoNacTotal;

        const sueldoConsolidado = calcularSueldoConsolidadoCelda(serieCelda, ventanas, refNacSx);

        const pobActivaConsolidada = loteEmpleo.length > 0
          ? Math.round(loteEmpleo.reduce((acc, r) => acc + numSeguro(r.poblacion_activa_total, 0), 0) / loteEmpleo.length)
          : 0;
        const sumaPea = loteEmpleo.reduce((acc, r) => acc + numSeguro(r.poblacion_activa_total, 0), 0);
        const sumaDes = loteEmpleo.reduce((acc, r) => acc + numSeguro(r.desempleados_reales, 0), 0);
        const tasaDesempleo = sumaPea > 0 ? Math.max(0.8, (sumaDes / sumaPea) * 100) : 3.2;

        const filaReciente = serieCelda.find(r => Number(r.anio) === ventanas.anioMax) || serieCelda[serieCelda.length - 1];
        const saturacion = numSeguro(filaReciente?.indice_saturacion_pct, 92);

        const celdaValida = satEsSolido && sueldoConsolidado > 0 && pobActivaConsolidada >= 100;
        const satUsar = satExacto || {};

        perfiles[reg][sx] = {
          celdaValida,
          n_encuestados_reales: numSeguro(satUsar.n_encuestados_reales, 0),
          n_efectivo_kish: numSeguro(satUsar.n_efectivo_kish, 0),
          volumen_muestra_nacional: numSeguro(satUsar.volumen_muestra_nacional, 0),
          sueldo_esperado: sueldoConsolidado,
          tendencia_salarial: tendenciaCelda.etiqueta,
          tendencia_codigo: tendenciaCelda.codigo,
          tasa_desempleo: Number(tasaDesempleo.toFixed(1)),
          indice_saturacion_pct: Number(saturacion.toFixed(0)),
          volumen_validado: reg === 'nacional' ? volumenConsolidadoNac : pobActivaConsolidada,
          brecha_salarial_pct: Number(brechaSalarialPct.toFixed(1)),
          pct_micro: numSeguro(satUsar.pct_micro, 0),
          pct_pyme: numSeguro(satUsar.pct_pyme, 0),
          pct_corp: numSeguro(satUsar.pct_corp, 0),
          pct_gobierno: numSeguro(satUsar.pct_gobierno, 0),
          pct_home_office: numSeguro(satUsar.pct_home_office, 0),
          pct_nepotismo: numSeguro(satUsar.pct_nepotismo, 37),
          pct_pluriempleo: numSeguro(satUsar.pct_pluriempleo, 5.6),
          pct_medio_tiempo: numSeguro(satUsar.pct_medio_tiempo, 14),
          pct_desarraigo: numSeguro(satUsar.pct_desarraigo, 2.7),
          pct_contrato: numSeguro(satUsar.pct_contrato, 65),
          pct_sindicato: numSeguro(satUsar.pct_sindicato, 15),
          pct_aguinaldo: numSeguro(satUsar.pct_aguinaldo, 63),
          pct_afore: numSeguro(satUsar.pct_afore, 55),
          pct_sgmm: numSeguro(satUsar.pct_sgmm, 8),
          pct_materno: numSeguro(satUsar.pct_materno ?? satEstructural.pct_materno, 23),
          pct_materno_estructural: numSeguro(satEstructural.pct_materno, 23),
          indice_privilegio: numSeguro(satUsar.indice_privilegio, 2.80),
          hrs_doble_jornada_hombres: numSeguro(satUsar.hrs_doble_jornada_hombres, 9.6),
          hrs_doble_jornada_mujeres: numSeguro(satUsar.hrs_doble_jornada_mujeres, 21.1),
          brecha_genero_hogar_hrs: numSeguro(satUsar.brecha_genero_hogar_hrs, 11.5),
          riesgo_ia_score: numSeguro(satUsar.riesgo_ia_score, 40)
        };
      });
    });

    return {
      cve_carrera: cve,
      nombre_carrera: c.nombre_ejecutivo || formatearNombreCarreraEjecutivo(cve, c.nombre_carrera),
      nombre_oficial_inegi: c.nombre_carrera,
      semestres_default: c.semestres_default ?? (cve === '091100' ? 12 : 9),
      capex_mxn: c.capex_mxn ?? null,
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

  return (
    <DescubridorClient
      datos={datosDepurados}
      benchmarksPrepa={benchmarksPrepa}
      metaPipeline={metaPipeline}
      ventanas={ventanas}
    />
  );
}

export default function DescubrirPage() {
  return (
    <main className="font-sans p-4 md:px-8 md:py-5">
      <Suspense fallback={
        <div className="min-h-[80vh] flex flex-col items-center justify-center">
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