import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  padCve,
  numSeguro,
  normalizarRegion,
  descargarTodoPaginado,
  esCeldaSateliteValida,
  calcularVentanasTemporales,
  calcularSueldoConsolidadoCelda,
  construirBenchmarksPrepaMap,
  cargarMetaPipeline,
  cargarBenchmarksPrepaRows,
  cargarSatelitesPrepaRows
} from '@/lib/dataroiEngine';

export const maxDuration = 60;

const REGIONES_VALIDAS = new Set(['nacional', 'norte', 'noroeste', 'bajio', 'centro', 'sur']);

function crearSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Faltan variables de entorno en el servidor: configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

interface SnapshotMercado {
  etiqueta_corte: string;
  rango_anios: string;
  ultimo_anio: number;
  total_carreras_certificadas: number;
  carreras_cves: string[];
  media_salarial_nacional: number;
  sueldo_prepa_nacional: number;
  calidad_oit_prepa_nacional: number | null;
  desempleo_prepa_nacional: number | null;
  total_filas_predicciones: number;
  total_filas_satelites: number;
  total_filas_prepa: number;
  total_filas_satelites_prepa: number;
  sueldo_por_carrera: Record<string, number>;
}

async function capturarSnapshotActual(admin: SupabaseClient): Promise<SnapshotMercado> {
  const [meta, prepaRows, satPrepaRows, satNac, predNac, cntPred, cntSat, cntPrepa] = await Promise.all([
    cargarMetaPipeline(admin),
    cargarBenchmarksPrepaRows(admin),
    cargarSatelitesPrepaRows(admin),
    descargarTodoPaginado(() =>
      admin
        .from('satelites_cultura')
        .select('cve_carrera, region, sexo, n_encuestados_reales, n_efectivo_kish')
        .eq('region', 'nacional')
        .eq('sexo', 0)
        .order('cve_carrera', { ascending: true })
    ),
    descargarTodoPaginado(() =>
      admin
        .from('predicciones_roi')
        .select('cve_carrera, anio, sexo, poblacion_activa_total, sueldo_promedio_mensual')
        .eq('tipo_dato', 'Real')
        .in('cve_ent', ['nacional', '0', '00'])
        .eq('sexo', 0)
        .order('cve_carrera', { ascending: true })
        .order('anio', { ascending: true })
    ),
    admin.from('predicciones_roi').select('anio', { count: 'exact', head: true }),
    admin.from('satelites_cultura').select('cve_carrera', { count: 'exact', head: true }),
    admin.from('benchmarks_prepa').select('anio', { count: 'exact', head: true })
  ]);

  const ventanas = calcularVentanasTemporales(
    predNac.map((r: any) => Number(r.anio)),
    meta
  );
  const prepaMap = construirBenchmarksPrepaMap(prepaRows, ventanas, satPrepaRows);

  const cvesCertificadas = satNac
    .filter((s: any) => padCve(s.cve_carrera) !== '999999' && esCeldaSateliteValida(s, 'nacional', 0))
    .map((s: any) => padCve(s.cve_carrera));
  const setCert = new Set(cvesCertificadas);

  const seriesPorCar: Record<string, any[]> = {};
  predNac.forEach((r: any) => {
    const cve = padCve(r.cve_carrera);
    if (!setCert.has(cve)) return;
    if (!seriesPorCar[cve]) seriesPorCar[cve] = [];
    seriesPorCar[cve].push(r);
  });

  const sueldoPorCarrera: Record<string, number> = {};
  let sumaProd = 0;
  let sumaPea = 0;

  Object.entries(seriesPorCar).forEach(([cve, filas]) => {
    const sueldo = calcularSueldoConsolidadoCelda(filas, ventanas);
    if (sueldo <= 0) return;
    sueldoPorCarrera[cve] = sueldo;
    const fEmp = filas.filter(f => ventanas.aniosEmpleo.includes(Number(f.anio)));
    const lote = fEmp.length > 0 ? fEmp : filas;
    const pea = lote.reduce((a, b) => a + numSeguro(b.poblacion_activa_total, 0), 0) / lote.length;
    sumaProd += sueldo * Math.max(1, pea);
    sumaPea += Math.max(1, pea);
  });

  return {
    etiqueta_corte: meta.etiqueta_corte,
    rango_anios: ventanas.rangoTexto,
    ultimo_anio: ventanas.anioMax,
    total_carreras_certificadas: cvesCertificadas.length,
    carreras_cves: cvesCertificadas,
    media_salarial_nacional: sumaPea > 0 ? Math.round(sumaProd / sumaPea) : 0,
    sueldo_prepa_nacional: prepaMap.nacional.sueldo_prepa[0],
    calidad_oit_prepa_nacional: prepaMap.nacional.calidad_oit_prepa_pct[0],
    desempleo_prepa_nacional: prepaMap.nacional.desempleo_prepa_pct[0],
    total_filas_predicciones: cntPred.count ?? 0,
    total_filas_satelites: cntSat.count ?? 0,
    total_filas_prepa: cntPrepa.count ?? 0,
    total_filas_satelites_prepa: satPrepaRows.length,
    sueldo_por_carrera: sueldoPorCarrera
  };
}

async function upsertEnLotes(
  admin: SupabaseClient,
  tabla: string,
  filas: Record<string, any>[],
  onConflict: string,
  batchSize = 500
): Promise<number> {
  let procesadas = 0;
  for (let i = 0; i < filas.length; i += batchSize) {
    const lote = filas.slice(i, i + batchSize);
    const { error } = await admin.from(tabla).upsert(lote, { onConflict });
    if (error) {
      throw new Error(`Error en UPSERT de ${tabla} (lote ${Math.floor(i / batchSize) + 1}): ${error.message}`);
    }
    procesadas += lote.length;
  }
  return procesadas;
}

function sanitizarPredicciones(rows: any[]): Record<string, any>[] {
  const mapaDedup = new Map<string, Record<string, any>>();

  rows.forEach((raw, idx) => {
    const anio = Math.round(numSeguro(raw.anio, NaN));
    const cve_ent = normalizarRegion(raw.cve_ent);
    const sexo = Math.round(numSeguro(raw.sexo, NaN));
    const cve_carrera = padCve(raw.cve_carrera);
    const tipo_dato = String(raw.tipo_dato || 'Real').trim() || 'Real';

    if (!Number.isFinite(anio) || anio < 2015 || anio > 2050) {
      throw new Error(`predicciones_roi fila ${idx + 1}: 'anio' inválido (${raw.anio}).`);
    }
    if (!REGIONES_VALIDAS.has(cve_ent)) {
      throw new Error(`predicciones_roi fila ${idx + 1}: 'cve_ent' inválido (${raw.cve_ent}).`);
    }
    if (![0, 1, 2].includes(sexo)) {
      throw new Error(`predicciones_roi fila ${idx + 1}: 'sexo' debe ser 0, 1 o 2 (recibido: ${raw.sexo}).`);
    }
    if (!cve_carrera || cve_carrera === '000000' || cve_carrera === '999999') return;

    const sueldo = Number(numSeguro(raw.sueldo_promedio_mensual, 0).toFixed(2));
    const isStemVal =
      raw.is_stem === true || String(raw.is_stem).toLowerCase() === 'true' || Number(raw.is_stem) === 1 ? 1 : 0;

    const key = `${anio}|${cve_ent}|${sexo}|${cve_carrera}|${tipo_dato}`;
    mapaDedup.set(key, {
      anio,
      cve_ent,
      sexo,
      cve_carrera,
      is_stem: isStemVal,
      poblacion_activa_total: Math.max(0, Math.round(numSeguro(raw.poblacion_activa_total, 0))),
      desempleados_reales: Math.max(0, Math.round(numSeguro(raw.desempleados_reales, 0))),
      tasa_desempleo: Number(numSeguro(raw.tasa_desempleo, 0).toFixed(4)),
      sueldo_promedio_mensual: sueldo,
      sueldo_peor_escenario: Number(numSeguro(raw.sueldo_peor_escenario, sueldo * 0.9).toFixed(2)),
      sueldo_mejor_escenario: Number(numSeguro(raw.sueldo_mejor_escenario, sueldo * 1.1).toFixed(2)),
      tipo_dato,
      indice_saturacion_pct: Number(numSeguro(raw.indice_saturacion_pct, 92).toFixed(2))
    });
  });

  return Array.from(mapaDedup.values());
}

function sanitizarSatelites(rows: any[]): Record<string, any>[] {
  const mapaDedup = new Map<string, Record<string, any>>();

  rows.forEach((raw, idx) => {
    const cve_carrera = padCve(raw.cve_carrera);
    const region = normalizarRegion(raw.region);
    const sexo = Math.round(numSeguro(raw.sexo, NaN));

    if (!REGIONES_VALIDAS.has(region)) {
      throw new Error(`satelites_cultura fila ${idx + 1}: 'region' inválida (${raw.region}).`);
    }
    if (![0, 1, 2].includes(sexo)) {
      throw new Error(`satelites_cultura fila ${idx + 1}: 'sexo' inválido (${raw.sexo}).`);
    }
    if (!cve_carrera || cve_carrera === '000000' || cve_carrera === '999999') return;

    const key = `${cve_carrera}|${region}|${sexo}`;
    mapaDedup.set(key, {
      cve_carrera,
      region,
      sexo,
      n_encuestados_reales: Math.max(0, Math.round(numSeguro(raw.n_encuestados_reales, 0))),
      n_efectivo_kish: Number(numSeguro(raw.n_efectivo_kish, 0).toFixed(1)),
      volumen_muestra_nacional: Math.max(0, Math.round(numSeguro(raw.volumen_muestra_nacional, 0))),
      pct_micro: Number(numSeguro(raw.pct_micro, 0).toFixed(1)),
      pct_pyme: Number(numSeguro(raw.pct_pyme, 0).toFixed(1)),
      pct_corp: Number(numSeguro(raw.pct_corp, 0).toFixed(1)),
      pct_gobierno: Number(numSeguro(raw.pct_gobierno, 0).toFixed(1)),
      pct_home_office: Number(numSeguro(raw.pct_home_office, 0).toFixed(1)),
      pct_nepotismo: Number(numSeguro(raw.pct_nepotismo, 0).toFixed(1)),
      pct_pluriempleo: Number(numSeguro(raw.pct_pluriempleo, 0).toFixed(1)),
      pct_medio_tiempo: Number(numSeguro(raw.pct_medio_tiempo, 0).toFixed(1)),
      pct_desarraigo: Number(numSeguro(raw.pct_desarraigo, 0).toFixed(1)),
      pct_contrato: Number(numSeguro(raw.pct_contrato, 0).toFixed(1)),
      pct_sindicato: Number(numSeguro(raw.pct_sindicato, 0).toFixed(1)),
      pct_aguinaldo: Number(numSeguro(raw.pct_aguinaldo, 0).toFixed(1)),
      pct_afore: Number(numSeguro(raw.pct_afore, 0).toFixed(1)),
      pct_sgmm: Number(numSeguro(raw.pct_sgmm, 0).toFixed(1)),
      pct_materno: Number(numSeguro(raw.pct_materno, 0).toFixed(1)),
      indice_privilegio: Number(numSeguro(raw.indice_privilegio, 2.8).toFixed(2)),
      hrs_doble_jornada_hombres: Number(numSeguro(raw.hrs_doble_jornada_hombres, 0).toFixed(1)),
      hrs_doble_jornada_mujeres: Number(numSeguro(raw.hrs_doble_jornada_mujeres, 0).toFixed(1)),
      brecha_genero_hogar_hrs: Number(numSeguro(raw.brecha_genero_hogar_hrs, 0).toFixed(1)),
      riesgo_ia_score: Math.round(numSeguro(raw.riesgo_ia_score, 40))
    });
  });

  return Array.from(mapaDedup.values());
}

function sanitizarSatelitesPrepa(rows: any[]): Record<string, any>[] {
  const mapaDedup = new Map<string, Record<string, any>>();

  rows.forEach((raw, idx) => {
    const region = normalizarRegion(raw.region);
    const sexo = Math.round(numSeguro(raw.sexo, NaN));

    if (!REGIONES_VALIDAS.has(region)) {
      throw new Error(`satelites_prepa fila ${idx + 1}: 'region' inválida (${raw.region}).`);
    }
    if (![0, 1, 2].includes(sexo)) {
      throw new Error(`satelites_prepa fila ${idx + 1}: 'sexo' inválido (${raw.sexo}).`);
    }

    const key = `${region}|${sexo}`;
    mapaDedup.set(key, {
      region,
      sexo,
      n_encuestados_reales: Math.max(0, Math.round(numSeguro(raw.n_encuestados_reales, 0))),
      n_efectivo_kish: Number(numSeguro(raw.n_efectivo_kish, 0).toFixed(1)),
      volumen_muestra_nacional: Math.max(0, Math.round(numSeguro(raw.volumen_muestra_nacional, 0))),
      pct_micro: Number(numSeguro(raw.pct_micro, 0).toFixed(1)),
      pct_pyme: Number(numSeguro(raw.pct_pyme, 0).toFixed(1)),
      pct_corp: Number(numSeguro(raw.pct_corp, 0).toFixed(1)),
      pct_gobierno: Number(numSeguro(raw.pct_gobierno, 0).toFixed(1)),
      pct_home_office: Number(numSeguro(raw.pct_home_office, 0).toFixed(1)),
      pct_nepotismo: Number(numSeguro(raw.pct_nepotismo, 0).toFixed(1)),
      pct_pluriempleo: Number(numSeguro(raw.pct_pluriempleo, 0).toFixed(1)),
      pct_medio_tiempo: Number(numSeguro(raw.pct_medio_tiempo, 0).toFixed(1)),
      pct_desarraigo: Number(numSeguro(raw.pct_desarraigo, 0).toFixed(1)),
      pct_contrato: Number(numSeguro(raw.pct_contrato, 0).toFixed(1)),
      pct_sindicato: Number(numSeguro(raw.pct_sindicato, 0).toFixed(1)),
      pct_aguinaldo: Number(numSeguro(raw.pct_aguinaldo, 0).toFixed(1)),
      pct_afore: Number(numSeguro(raw.pct_afore, 0).toFixed(1)),
      pct_sgmm: Number(numSeguro(raw.pct_sgmm, 0).toFixed(1)),
      pct_materno: Number(numSeguro(raw.pct_materno, 0).toFixed(1)),
      indice_privilegio: Number(numSeguro(raw.indice_privilegio, 2.3).toFixed(2)),
      hrs_doble_jornada_hombres: Number(numSeguro(raw.hrs_doble_jornada_hombres, 0).toFixed(1)),
      hrs_doble_jornada_mujeres: Number(numSeguro(raw.hrs_doble_jornada_mujeres, 0).toFixed(1)),
      brecha_genero_hogar_hrs: Number(numSeguro(raw.brecha_genero_hogar_hrs, 0).toFixed(1)),
      updated_at: new Date().toISOString()
    });
  });

  return Array.from(mapaDedup.values());
}

function sanitizarBenchmarksPrepa(rows: any[]): Record<string, any>[] {
  const mapaDedup = new Map<string, Record<string, any>>();

  rows.forEach((raw, idx) => {
    const anio = Math.round(numSeguro(raw.anio, NaN));
    const region = normalizarRegion(raw.region);
    const sexo = Math.round(numSeguro(raw.sexo, NaN));
    const sueldo = Number(numSeguro(raw.sueldo_promedio_mensual, NaN).toFixed(2));

    if (!Number.isFinite(anio) || anio < 2015 || anio > 2050) {
      throw new Error(`benchmarks_prepa fila ${idx + 1}: 'anio' inválido (${raw.anio}).`);
    }
    if (!REGIONES_VALIDAS.has(region)) {
      throw new Error(`benchmarks_prepa fila ${idx + 1}: 'region' inválida (${raw.region}).`);
    }
    if (![0, 1, 2].includes(sexo)) {
      throw new Error(`benchmarks_prepa fila ${idx + 1}: 'sexo' inválido (${raw.sexo}).`);
    }
    if (!Number.isFinite(sueldo) || sueldo <= 0) {
      throw new Error(`benchmarks_prepa fila ${idx + 1}: 'sueldo_promedio_mensual' inválido (${raw.sueldo_promedio_mensual}).`);
    }

    const formVal = raw.formalidad_pct != null && raw.formalidad_pct !== '' ? Number(numSeguro(raw.formalidad_pct, 0).toFixed(2)) : null;
    const desempVal = raw.tasa_desempleo_pct != null && raw.tasa_desempleo_pct !== '' ? Number(numSeguro(raw.tasa_desempleo_pct, 0).toFixed(2)) : null;

    const key = `${anio}|${region}|${sexo}`;
    mapaDedup.set(key, {
      anio,
      region,
      sexo,
      sueldo_promedio_mensual: sueldo,
      formalidad_pct: formVal,
      tasa_desempleo_pct: desempVal,
      n_encuestados: Math.max(0, Math.round(numSeguro(raw.n_encuestados, 0))),
      updated_at: new Date().toISOString()
    });
  });

  return Array.from(mapaDedup.values());
}

// GET /api/ingesta -> Devuelve el estado actual vivo de la base de datos
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Variables de Supabase no configuradas.' }, { status: 500 });
    }
    const client = createClient(url, key, { auth: { persistSession: false } });
    const [snapshot, meta] = await Promise.all([
      capturarSnapshotActual(client),
      cargarMetaPipeline(client)
    ]);

    return NextResponse.json({
      ok: true,
      serviceRoleConfigurado: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      adminTokenConfigurado: Boolean(process.env.INGESTA_ADMIN_TOKEN),
      meta,
      snapshot: {
        etiqueta_corte: snapshot.etiqueta_corte,
        rango_anios: snapshot.rango_anios,
        ultimo_anio: snapshot.ultimo_anio,
        total_carreras_certificadas: snapshot.total_carreras_certificadas,
        media_salarial_nacional: snapshot.media_salarial_nacional,
        sueldo_prepa_nacional: snapshot.sueldo_prepa_nacional,
        calidad_oit_prepa_nacional: snapshot.calidad_oit_prepa_nacional,
        desempleo_prepa_nacional: snapshot.desempleo_prepa_nacional,
        total_filas_predicciones: snapshot.total_filas_predicciones,
        total_filas_satelites: snapshot.total_filas_satelites,
        total_filas_prepa: snapshot.total_filas_prepa,
        total_filas_satelites_prepa: snapshot.total_filas_satelites_prepa
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error consultando el estado actual.' }, { status: 500 });
  }
}

// POST /api/ingesta -> Valida token, procesa UPSERTs en lotes, revalida caché de Next.js y devuelve diff Antes vs Después
export async function POST(req: NextRequest) {
  try {
    const tokenEsperado = process.env.INGESTA_ADMIN_TOKEN;
    if (!tokenEsperado) {
      return NextResponse.json(
        { error: 'Falta configurar INGESTA_ADMIN_TOKEN en .env.local del servidor.' },
        { status: 500 }
      );
    }

    const tokenRecibido = req.headers.get('x-ingesta-token') || '';
    if (tokenRecibido !== tokenEsperado) {
      return NextResponse.json(
        { error: 'Clave de administrador incorrecta. Acceso denegado.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const modoDryRun = Boolean(body?.dryRun);

    const predRaw = Array.isArray(body?.predicciones_roi) ? body.predicciones_roi : [];
    const satRaw = Array.isArray(body?.satelites_cultura) ? body.satelites_cultura : [];
    const prepaRaw = Array.isArray(body?.benchmarks_prepa) ? body.benchmarks_prepa : [];
    const satPrepaRaw = Array.isArray(body?.satelites_prepa) ? body.satelites_prepa : [];
    const metaPayload = body?.meta_pipeline && typeof body.meta_pipeline === 'object' ? body.meta_pipeline : null;

    if (
      predRaw.length === 0 &&
      satRaw.length === 0 &&
      prepaRaw.length === 0 &&
      satPrepaRaw.length === 0 &&
      !metaPayload
    ) {
      return NextResponse.json(
        { error: 'No se recibió ningún archivo ni actualización de metadatos para procesar.' },
        { status: 400 }
      );
    }

    // 1. Validación estricta y sanitización ANTES de tocar Supabase
    const predLimpias = predRaw.length > 0 ? sanitizarPredicciones(predRaw) : [];
    const satLimpias = satRaw.length > 0 ? sanitizarSatelites(satRaw) : [];
    const prepaLimpias = prepaRaw.length > 0 ? sanitizarBenchmarksPrepa(prepaRaw) : [];
    const satPrepaLimpias = satPrepaRaw.length > 0 ? sanitizarSatelitesPrepa(satPrepaRaw) : [];

    const admin = crearSupabaseAdmin();
    const metaActual = await cargarMetaPipeline(admin);
    const antes = await capturarSnapshotActual(admin);

    if (modoDryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        mensaje: 'Validación exitosa (Modo Simulación: no se modificó la base de datos).',
        resumenValidacion: {
          predicciones_validas: predLimpias.length,
          satelites_validos: satLimpias.length,
          benchmarks_prepa_validos: prepaLimpias.length,
          satelites_prepa_validos: satPrepaLimpias.length,
          actualiza_meta: Boolean(metaPayload)
        },
        antes: {
          etiqueta_corte: antes.etiqueta_corte,
          rango_anios: antes.rango_anios,
          total_carreras_certificadas: antes.total_carreras_certificadas,
          media_salarial_nacional: antes.media_salarial_nacional,
          sueldo_prepa_nacional: antes.sueldo_prepa_nacional,
          calidad_oit_prepa_nacional: antes.calidad_oit_prepa_nacional
        }
      });
    }

    // 2. Ejecutar UPSERTs en lotes hacia Supabase
    const conteos = {
      predicciones_roi: 0,
      satelites_cultura: 0,
      benchmarks_prepa: 0,
      satelites_prepa: 0,
      meta_pipeline: 0
    };

    if (satLimpias.length > 0) {
      conteos.satelites_cultura = await upsertEnLotes(admin, 'satelites_cultura', satLimpias, 'cve_carrera,region,sexo');
    }
    if (satPrepaLimpias.length > 0) {
      conteos.satelites_prepa = await upsertEnLotes(admin, 'satelites_prepa', satPrepaLimpias, 'region,sexo');
    }
    if (predLimpias.length > 0) {
      conteos.predicciones_roi = await upsertEnLotes(
        admin,
        'predicciones_roi',
        predLimpias,
        'anio,cve_ent,sexo,cve_carrera,tipo_dato'
      );
    }
    if (prepaLimpias.length > 0) {
      conteos.benchmarks_prepa = await upsertEnLotes(admin, 'benchmarks_prepa', prepaLimpias, 'anio,region,sexo');
    }

    if (metaPayload || predLimpias.length > 0) {
      const aniosNuevos = predLimpias.map(r => Number(r.anio)).filter(a => Number.isFinite(a));
      const anioInicioFinal = numSeguro(
        metaPayload?.anio_inicio,
        aniosNuevos.length > 0 ? Math.min(metaActual.anio_inicio, ...aniosNuevos) : metaActual.anio_inicio
      );
      const ultimoAnioFinal = numSeguro(
        metaPayload?.ultimo_anio,
        aniosNuevos.length > 0 ? Math.max(metaActual.ultimo_anio, ...aniosNuevos) : metaActual.ultimo_anio
      );
      const ultimoTrimFinal = Math.min(4, Math.max(1, Math.round(numSeguro(metaPayload?.ultimo_trimestre, metaActual.ultimo_trimestre))));
      const etiquetaCorteFinal = String(metaPayload?.etiqueta_corte || `${ultimoAnioFinal} Q${ultimoTrimFinal}`).trim();
      const etiquetaPesosFinal = String(metaPayload?.etiqueta_pesos_base || `Pesos constantes ${etiquetaCorteFinal}`).trim();
      const inpcBaseFinal =
        metaPayload?.inpc_base != null && metaPayload.inpc_base !== ''
          ? Number(metaPayload.inpc_base)
          : metaActual.inpc_base;
      const costosRoiFinal = metaPayload?.costos_roi || metaActual.costos_roi;

      const { error: errMeta } = await admin.from('meta_pipeline').upsert(
        {
          id: 1,
          anio_inicio: anioInicioFinal,
          ultimo_anio: ultimoAnioFinal,
          ultimo_trimestre: ultimoTrimFinal,
          etiqueta_corte: etiquetaCorteFinal,
          etiqueta_pesos_base: etiquetaPesosFinal,
          inpc_base: inpcBaseFinal,
          costos_roi: costosRoiFinal,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );
      if (errMeta) {
        throw new Error(`Error actualizando meta_pipeline: ${errMeta.message}`);
      }
      conteos.meta_pipeline = 1;
    }

    // 3. Capturar Snapshot "Después" y calcular reporte de impacto
    const despues = await capturarSnapshotActual(admin);

    const setAntes = new Set(antes.carreras_cves);
    const cvesNuevas = despues.carreras_cves.filter(cve => !setAntes.has(cve));

    const { data: dimRows } = await admin
      .from('dim_carreras')
      .select('cve_carrera, nombre_carrera, nombre_ejecutivo');
    const mapaNombres: Record<string, string> = {};
    (dimRows || []).forEach((d: any) => {
      mapaNombres[padCve(d.cve_carrera)] = d.nombre_ejecutivo || d.nombre_carrera;
    });

    const variacionesCarreras: {
      cve_carrera: string;
      nombre: string;
      antes: number;
      despues: number;
      diff_mxn: number;
      diff_pct: number;
    }[] = [];

    Object.entries(despues.sueldo_por_carrera).forEach(([cve, sDesp]) => {
      const sAnt = antes.sueldo_por_carrera[cve];
      if (!sAnt || sAnt <= 0) return;
      const diffMxn = sDesp - sAnt;
      const diffPct = Number(((diffMxn / sAnt) * 100).toFixed(1));
      if (Math.abs(diffMxn) >= 1) {
        variacionesCarreras.push({
          cve_carrera: cve,
          nombre: mapaNombres[cve] || `Carrera ${cve}`,
          antes: sAnt,
          despues: sDesp,
          diff_mxn: diffMxn,
          diff_pct: diffPct
        });
      }
    });

    const topAlzas = [...variacionesCarreras].filter(v => v.diff_mxn > 0).sort((a, b) => b.diff_mxn - a.diff_mxn).slice(0, 5);
    const topBajas = [...variacionesCarreras].filter(v => v.diff_mxn < 0).sort((a, b) => a.diff_mxn - b.diff_mxn).slice(0, 5);

    // 4. Invalidar caché global de Next.js 16 en todas las rutas del proyecto
    revalidatePath('/', 'layout');
    revalidatePath('/');
    revalidatePath('/descubrir');
    revalidatePath('/laboratorio');

    return NextResponse.json({
      ok: true,
      dryRun: false,
      mensaje: `Corte ${despues.etiqueta_corte} publicado en tiempo real y caché global revalidado.`,
      conteos,
      impacto: {
        antes: {
          etiqueta_corte: antes.etiqueta_corte,
          rango_anios: antes.rango_anios,
          total_carreras_certificadas: antes.total_carreras_certificadas,
          media_salarial_nacional: antes.media_salarial_nacional,
          sueldo_prepa_nacional: antes.sueldo_prepa_nacional,
          calidad_oit_prepa_nacional: antes.calidad_oit_prepa_nacional,
          desempleo_prepa_nacional: antes.desempleo_prepa_nacional,
          total_filas_predicciones: antes.total_filas_predicciones,
          total_filas_satelites_prepa: antes.total_filas_satelites_prepa
        },
        despues: {
          etiqueta_corte: despues.etiqueta_corte,
          rango_anios: despues.rango_anios,
          total_carreras_certificadas: despues.total_carreras_certificadas,
          media_salarial_nacional: despues.media_salarial_nacional,
          sueldo_prepa_nacional: despues.sueldo_prepa_nacional,
          calidad_oit_prepa_nacional: despues.calidad_oit_prepa_nacional,
          desempleo_prepa_nacional: despues.desempleo_prepa_nacional,
          total_filas_predicciones: despues.total_filas_predicciones,
          total_filas_satelites_prepa: despues.total_filas_satelites_prepa
        },
        carreras_nuevas: cvesNuevas.map(cve => ({
          cve_carrera: cve,
          nombre: mapaNombres[cve] || `Carrera ${cve}`
        })),
        topAlzas,
        topBajas
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Error interno durante la ingesta de datos.' },
      { status: 500 }
    );
  }
}