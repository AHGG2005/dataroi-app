"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  EVENTO_DATOS_ACTUALIZADOS,
  COSTOS_ROI_DEFAULT,
  CostosEscenarioROI
} from '@/lib/dataroiEngine';
import {
  UploadCloud,
  Database,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  FileJson,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  KeyRound,
  Trash2,
  Loader2,
  SlidersHorizontal,
  GraduationCap
} from 'lucide-react';

function parsearCSV(textoRaw: string): { headers: string[]; rows: Record<string, string>[] } {
  const texto = textoRaw.replace(/^\uFEFF/, '');
  const filasMatriz: string[][] = [];
  let filaActual: string[] = [];
  let campo = '';
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    const sig = texto[i + 1];

    if (enComillas) {
      if (ch === '"' && sig === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') {
        enComillas = false;
      } else {
        campo += ch;
      }
    } else {
      if (ch === '"') {
        enComillas = true;
      } else if (ch === ',') {
        filaActual.push(campo.trim());
        campo = '';
      } else if (ch === '\r' && sig === '\n') {
        filaActual.push(campo.trim());
        if (filaActual.some(c => c !== '')) filasMatriz.push(filaActual);
        filaActual = [];
        campo = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        filaActual.push(campo.trim());
        if (filaActual.some(c => c !== '')) filasMatriz.push(filaActual);
        filaActual = [];
        campo = '';
      } else {
        campo += ch;
      }
    }
  }
  filaActual.push(campo.trim());
  if (filaActual.some(c => c !== '')) filasMatriz.push(filaActual);

  if (filasMatriz.length < 2) return { headers: [], rows: [] };

  const headers = filasMatriz[0].map(h => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < filasMatriz.length; r++) {
    const vals = filasMatriz[r];
    if (vals.length === 0 || vals.every(v => v === '')) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? '';
    });
    rows.push(obj);
  }

  return { headers, rows };
}

interface ArchivoCargado {
  nombre: string;
  filas: Record<string, string>[];
  resumen: string;
  error?: string;
}

const formatoMoneda = (valor: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(valor || 0);

const COLS_REQ_PRED = ['anio', 'cve_ent', 'sexo', 'cve_carrera', 'sueldo_promedio_mensual', 'poblacion_activa_total'];
const COLS_REQ_PREPA = ['anio', 'region', 'sexo', 'sueldo_promedio_mensual'];
const COLS_REQ_SAT = ['cve_carrera', 'region', 'sexo', 'n_encuestados_reales', 'pct_contrato', 'riesgo_ia_score'];
const COLS_REQ_SAT_PREPA = ['region', 'sexo', 'n_encuestados_reales', 'pct_contrato', 'pct_aguinaldo', 'pct_afore'];

export default function ActualizarDatosPage() {
  const router = useRouter();

  const [estadoActual, setEstadoActual] = useState<any>(null);
  const [cargandoEstado, setCargandoEstado] = useState(true);

  const [adminToken, setAdminToken] = useState('');
  const [modoDryRun, setModoDryRun] = useState(false);

  const [archivoPred, setArchivoPred] = useState<ArchivoCargado | null>(null);
  const [archivoPrepa, setArchivoPrepa] = useState<ArchivoCargado | null>(null);
  const [archivoSat, setArchivoSat] = useState<ArchivoCargado | null>(null);
  const [archivoSatPrepa, setArchivoSatPrepa] = useState<ArchivoCargado | null>(null);
  const [nombreJsonMeta, setNombreJsonMeta] = useState<string | null>(null);

  const [editarMetaActivo, setEditarMetaActivo] = useState(false);
  const [metaAnioInicio, setMetaAnioInicio] = useState(2021);
  const [metaUltimoAnio, setMetaUltimoAnio] = useState(2026);
  const [metaUltimoTrim, setMetaUltimoTrim] = useState(2);
  const [metaInpcBase, setMetaInpcBase] = useState<string>('');
  const [costosRoi, setCostosRoi] = useState<CostosEscenarioROI>(COSTOS_ROI_DEFAULT);

  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [resultadoIngesta, setResultadoIngesta] = useState<any>(null);

  const cargarEstadoBD = useCallback(async () => {
    setCargandoEstado(true);
    try {
      const res = await fetch('/api/ingesta', { cache: 'no-store' });
      const data = await res.json();
      if (data?.ok) {
        setEstadoActual(data);
        if (data.meta) {
          setMetaAnioInicio(data.meta.anio_inicio ?? 2021);
          setMetaUltimoAnio(data.meta.ultimo_anio ?? 2026);
          setMetaUltimoTrim(data.meta.ultimo_trimestre ?? 2);
          setMetaInpcBase(data.meta.inpc_base != null ? String(data.meta.inpc_base) : '');
          if (data.meta.costos_roi) setCostosRoi(data.meta.costos_roi);
        }
      }
    } catch {
      // Sin impacto crítico
    } finally {
      setCargandoEstado(false);
    }
  }, []);

  useEffect(() => {
    cargarEstadoBD();
    try {
      const guardado = sessionStorage.getItem('dataroi_ingesta_token');
      if (guardado) setAdminToken(guardado);
    } catch {
      // Sin impacto
    }
  }, [cargarEstadoBD]);

  const manejarCSV = async (
    file: File,
    colsRequeridas: string[],
    setter: React.Dispatch<React.SetStateAction<ArchivoCargado | null>>,
    tipo: 'pred' | 'prepa' | 'sat' | 'sat_prepa'
  ) => {
    const texto = await file.text();
    const { headers, rows } = parsearCSV(texto);
    const faltantes = colsRequeridas.filter(c => !headers.includes(c));

    if (faltantes.length > 0) {
      setter({
        nombre: file.name,
        filas: [],
        resumen: '',
        error: `Faltan columnas obligatorias: ${faltantes.join(', ')}`
      });
      return;
    }

    if (rows.length === 0) {
      setter({
        nombre: file.name,
        filas: [],
        resumen: '',
        error: 'El archivo CSV no contiene filas de datos.'
      });
      return;
    }

    let resumen = `${rows.length.toLocaleString('es-MX')} filas listas`;
    if (tipo === 'pred') {
      const anios = Array.from(new Set(rows.map(r => Number(r.anio)).filter(Number.isFinite))).sort((a, b) => a - b);
      const carreras = new Set(rows.map(r => String(r.cve_carrera || '').padStart(6, '0'))).size;
      resumen = `${rows.length.toLocaleString('es-MX')} filas · ${carreras} carreras · Años ${anios[0]}–${anios[anios.length - 1]}`;
      if (anios.length > 0) {
        setMetaAnioInicio(anios[0]);
        setMetaUltimoAnio(anios[anios.length - 1]);
      }
    } else if (tipo === 'prepa') {
      const anios = Array.from(new Set(rows.map(r => Number(r.anio)).filter(Number.isFinite))).sort((a, b) => a - b);
      const conDesemp = headers.includes('tasa_desempleo_pct');
      resumen = `${rows.length.toLocaleString('es-MX')} filas · Años ${anios[0]}–${anios[anios.length - 1]}${conDesemp ? ' · Con desempleo' : ''}`;
    } else if (tipo === 'sat_prepa') {
      const regs = new Set(rows.map(r => String(r.region || '').toLowerCase())).size;
      resumen = `${rows.length} celdas de Preparatoria · ${regs} zonas`;
    } else {
      const carreras = new Set(rows.map(r => String(r.cve_carrera || '').padStart(6, '0'))).size;
      resumen = `${rows.length.toLocaleString('es-MX')} celdas certificadas · ${carreras} carreras`;
    }

    setter({ nombre: file.name, filas: rows, resumen });
  };

  const manejarJsonMeta = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      if (json.anio_inicio) setMetaAnioInicio(Number(json.anio_inicio));
      if (json.ultimo_anio) setMetaUltimoAnio(Number(json.ultimo_anio));
      if (json.ultimo_trimestre) setMetaUltimoTrim(Number(json.ultimo_trimestre));
      if (json.inpc_base != null) setMetaInpcBase(String(json.inpc_base));
      if (json.costos_roi) setCostosRoi(json.costos_roi);
      setNombreJsonMeta(file.name);
      setEditarMetaActivo(true);
      setErrorEnvio(null);
    } catch {
      setErrorEnvio('El archivo JSON de metadatos no tiene un formato válido.');
    }
  };

  const hayAlgoParaSubir = Boolean(
    (archivoPred && archivoPred.filas.length > 0) ||
    (archivoPrepa && archivoPrepa.filas.length > 0) ||
    (archivoSat && archivoSat.filas.length > 0) ||
    (archivoSatPrepa && archivoSatPrepa.filas.length > 0) ||
    editarMetaActivo ||
    nombreJsonMeta
  );

  const hayErroresArchivos = Boolean(
    archivoPred?.error || archivoPrepa?.error || archivoSat?.error || archivoSatPrepa?.error
  );

  const ejecutarIngesta = async () => {
    if (!adminToken.trim()) {
      setErrorEnvio('Ingresa tu clave de administrador (INGESTA_ADMIN_TOKEN) para autorizar la actualización.');
      return;
    }
    if (!hayAlgoParaSubir || hayErroresArchivos) return;

    setEnviando(true);
    setErrorEnvio(null);
    setResultadoIngesta(null);

    try {
      try {
        sessionStorage.setItem('dataroi_ingesta_token', adminToken.trim());
      } catch {
        // Sin impacto
      }

      const etiquetaCorte = `${metaUltimoAnio} Q${metaUltimoTrim}`;
      const payload: Record<string, any> = { dryRun: modoDryRun };

      if (archivoPred && archivoPred.filas.length > 0) payload.predicciones_roi = archivoPred.filas;
      if (archivoPrepa && archivoPrepa.filas.length > 0) payload.benchmarks_prepa = archivoPrepa.filas;
      if (archivoSat && archivoSat.filas.length > 0) payload.satelites_cultura = archivoSat.filas;
      if (archivoSatPrepa && archivoSatPrepa.filas.length > 0) payload.satelites_prepa = archivoSatPrepa.filas;

      if (editarMetaActivo || nombreJsonMeta || (archivoPred && archivoPred.filas.length > 0)) {
        payload.meta_pipeline = {
          anio_inicio: metaAnioInicio,
          ultimo_anio: metaUltimoAnio,
          ultimo_trimestre: metaUltimoTrim,
          etiqueta_corte: etiquetaCorte,
          etiqueta_pesos_base: `Pesos constantes ${etiquetaCorte}`,
          inpc_base: metaInpcBase.trim() !== '' ? Number(metaInpcBase) : null,
          costos_roi: costosRoi
        };
      }

      const res = await fetch('/api/ingesta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ingesta-token': adminToken.trim()
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Error HTTP ${res.status} al procesar la ingesta.`);
      }

      setResultadoIngesta(data);

      if (!modoDryRun) {
        window.dispatchEvent(new CustomEvent(EVENTO_DATOS_ACTUALIZADOS));
        router.refresh();
        await cargarEstadoBD();
      }
    } catch (err: any) {
      setErrorEnvio(err?.message || 'Ocurrió un error inesperado durante la carga.');
    } finally {
      setEnviando(false);
    }
  };

  const snap = estadoActual?.snapshot;

  return (
    <main className="max-w-6xl mx-auto p-4 md:px-8 md:py-6 space-y-6 pb-20 font-sans">
      
      {/* HERO OSCURO + ESTADO VIVO DE LA BASE DE DATOS */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white rounded-3xl p-6 md:p-8 shadow-lg border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/35 text-blue-300 text-[11px] font-extrabold uppercase tracking-wider mb-2.5">
              <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" /> Ingesta en Tiempo Real · Cero Hardcodeo
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              Centro de Actualización de Cortes ENOE / ANUIES
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl">
              Sube los archivos procesados por tu pipeline de Python (Licenciatura + Preparatoria). El servidor valida esquemas, ejecuta <code className="text-emerald-300">UPSERT</code> en Supabase, limpia la caché y actualiza toda la plataforma en segundos.
            </p>
          </div>

          <button
            type="button"
            onClick={cargarEstadoBD}
            disabled={cargandoEstado}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-black text-white self-start lg:self-center cursor-pointer active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${cargandoEstado ? 'animate-spin' : ''}`} />
            Refrescar Estado BD
          </button>
        </div>

        {/* KPIs VIVOS ACTUALES */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-5 text-xs">
          <div className="bg-slate-800/85 border border-slate-700/80 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Corte Activo en BD</span>
            <strong className="text-lg font-black text-blue-400 block mt-0.5">
              {snap ? snap.etiqueta_corte : '—'}
            </strong>
            <span className="text-[10.5px] text-slate-400">Serie: {snap ? snap.rango_anios : '—'}</span>
          </div>

          <div className="bg-slate-800/85 border border-slate-700/80 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Carreras Certificadas</span>
            <strong className="text-lg font-black text-white block mt-0.5">
              {snap ? `${snap.total_carreras_certificadas} carreras` : '—'}
            </strong>
            <span className="text-[10.5px] text-slate-400">{snap ? `${snap.total_filas_satelites.toLocaleString('es-MX')} celdas satélite` : ''}</span>
          </div>

          <div className="bg-slate-800/85 border border-slate-700/80 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Media Lic. Nacional</span>
            <strong className="text-lg font-black text-emerald-400 block mt-0.5">
              {snap ? `${formatoMoneda(snap.media_salarial_nacional)}/mes` : '—'}
            </strong>
            <span className="text-[10.5px] text-slate-400">
              {snap ? `${snap.total_filas_predicciones.toLocaleString('es-MX')} filas mercado` : ''}
            </span>
          </div>

          <div className="bg-slate-800/85 border border-slate-700/80 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Base Prepa Nacional</span>
            <strong className="text-lg font-black text-amber-300 block mt-0.5">
              {snap ? `${formatoMoneda(snap.sueldo_prepa_nacional)}/mes` : '—'}
            </strong>
            <span className="text-[10.5px] text-slate-400">
              {snap
                ? `${snap.total_filas_prepa} filas${snap.desempleo_prepa_nacional != null ? ` · Desemp ${snap.desempleo_prepa_nacional}%` : ''}`
                : ''}
            </span>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-slate-800/85 border border-slate-700/80 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Satélites Prepa</span>
            <strong className="text-lg font-black text-sky-300 block mt-0.5">
              {snap ? `${snap.total_filas_satelites_prepa}/18 celdas` : '—'}
            </strong>
            <span className="text-[10.5px] text-slate-400">
              {snap?.calidad_oit_prepa_nacional != null
                ? `Calidad OIT Prepa: ${snap.calidad_oit_prepa_nacional}%`
                : 'Pendiente de subir CSV'}
            </span>
          </div>
        </div>

        {estadoActual && (!estadoActual.serviceRoleConfigurado || !estadoActual.adminTokenConfigurado) && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-black block">Faltan variables de servidor en tu archivo .env.local:</strong>
              <span>
                {!estadoActual.serviceRoleConfigurado && '• Agrega SUPABASE_SERVICE_ROLE_KEY '}
                {!estadoActual.adminTokenConfigurado && '• Agrega INGESTA_ADMIN_TOKEN '}
                y reinicia el servidor (<code className="text-white font-mono">npm run dev</code>).
              </span>
            </div>
          </div>
        )}
      </div>

      {/* PASO 1: CARGA DE ARCHIVOS + PASO 2: AUTORIZACIÓN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                1. Selecciona los archivos del nuevo corte (processed_data/)
              </h2>
              <p className="text-xs text-slate-500">
                Puedes subir los 5 archivos a la vez o solo los que se actualizaron en este corte.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* 1. predicciones_roi */}
            <div className={`p-4 rounded-2xl border-2 border-dashed transition-all ${
              archivoPred?.error
                ? 'border-rose-300 bg-rose-50/40'
                : archivoPred
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-200 hover:border-blue-400 bg-slate-50/60'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900">Mercado y Saturación</h3>
                    <span className="text-[10px] font-mono text-slate-400">predicciones_roi</span>
                  </div>
                </div>
                {archivoPred && (
                  <button type="button" onClick={() => setArchivoPred(null)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="Quitar archivo">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) manejarCSV(f, COLS_REQ_PRED, setArchivoPred, 'pred');
                    e.target.value = '';
                  }}
                />
                <div className="mt-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-center text-xs font-bold text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-colors">
                  {archivoPred ? archivoPred.nombre : 'Elegir DataROI_Mercado_...csv'}
                </div>
              </label>

              {archivoPred && (
                <p className={`text-[11px] font-bold mt-2 ${archivoPred.error ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {archivoPred.error || `✓ ${archivoPred.resumen}`}
                </p>
              )}
            </div>

            {/* 2. benchmarks_prepa */}
            <div className={`p-4 rounded-2xl border-2 border-dashed transition-all ${
              archivoPrepa?.error
                ? 'border-rose-300 bg-rose-50/40'
                : archivoPrepa
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-200 hover:border-blue-400 bg-slate-50/60'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900">Benchmarks Preparatoria</h3>
                    <span className="text-[10px] font-mono text-slate-400">benchmarks_prepa (salario + desempleo)</span>
                  </div>
                </div>
                {archivoPrepa && (
                  <button type="button" onClick={() => setArchivoPrepa(null)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="Quitar archivo">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) manejarCSV(f, COLS_REQ_PREPA, setArchivoPrepa, 'prepa');
                    e.target.value = '';
                  }}
                />
                <div className="mt-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-center text-xs font-bold text-slate-700 hover:border-amber-500 hover:text-amber-700 transition-colors">
                  {archivoPrepa ? archivoPrepa.nombre : 'Elegir DataROI_Benchmarks_Prepa.csv'}
                </div>
              </label>

              {archivoPrepa && (
                <p className={`text-[11px] font-bold mt-2 ${archivoPrepa.error ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {archivoPrepa.error || `✓ ${archivoPrepa.resumen}`}
                </p>
              )}
            </div>

            {/* 3. satelites_cultura */}
            <div className={`p-4 rounded-2xl border-2 border-dashed transition-all ${
              archivoSat?.error
                ? 'border-rose-300 bg-rose-50/40'
                : archivoSat
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-200 hover:border-blue-400 bg-slate-50/60'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900">Satélites Licenciatura (T1)</h3>
                    <span className="text-[10px] font-mono text-slate-400">satelites_cultura</span>
                  </div>
                </div>
                {archivoSat && (
                  <button type="button" onClick={() => setArchivoSat(null)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="Quitar archivo">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) manejarCSV(f, COLS_REQ_SAT, setArchivoSat, 'sat');
                    e.target.value = '';
                  }}
                />
                <div className="mt-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-center text-xs font-bold text-slate-700 hover:border-purple-500 hover:text-purple-700 transition-colors">
                  {archivoSat ? archivoSat.nombre : 'Elegir DataROI_Satelites_Regional_...csv'}
                </div>
              </label>

              {archivoSat && (
                <p className={`text-[11px] font-bold mt-2 ${archivoSat.error ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {archivoSat.error || `✓ ${archivoSat.resumen}`}
                </p>
              )}
            </div>

            {/* 4. satelites_prepa (NUEVO) */}
            <div className={`p-4 rounded-2xl border-2 border-dashed transition-all ${
              archivoSatPrepa?.error
                ? 'border-rose-300 bg-rose-50/40'
                : archivoSatPrepa
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-200 hover:border-sky-400 bg-slate-50/60'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-sky-600 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900">Satélites Preparatoria (T1)</h3>
                    <span className="text-[10px] font-mono text-slate-400">satelites_prepa (18 celdas OIT)</span>
                  </div>
                </div>
                {archivoSatPrepa && (
                  <button type="button" onClick={() => setArchivoSatPrepa(null)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="Quitar archivo">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) manejarCSV(f, COLS_REQ_SAT_PREPA, setArchivoSatPrepa, 'sat_prepa');
                    e.target.value = '';
                  }}
                />
                <div className="mt-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-center text-xs font-bold text-slate-700 hover:border-sky-500 hover:text-sky-700 transition-colors">
                  {archivoSatPrepa ? archivoSatPrepa.nombre : 'Elegir DataROI_Satelites_Prepa.csv'}
                </div>
              </label>

              {archivoSatPrepa && (
                <p className={`text-[11px] font-bold mt-2 ${archivoSatPrepa.error ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {archivoSatPrepa.error || `✓ ${archivoSatPrepa.resumen}`}
                </p>
              )}
            </div>

            {/* 5. meta_pipeline JSON */}
            <div className={`sm:col-span-2 p-4 rounded-2xl border-2 border-dashed transition-all ${
              nombreJsonMeta
                ? 'border-emerald-400 bg-emerald-50/40'
                : 'border-slate-200 hover:border-blue-400 bg-slate-50/60'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900">Metadatos del Corte (JSON o edición manual)</h3>
                    <span className="text-[10px] font-mono text-slate-400">
                      {nombreJsonMeta
                        ? `✓ ${nombreJsonMeta} · Corte ${metaUltimoAnio} Q${metaUltimoTrim}`
                        : 'meta_pipeline (DataROI_Meta_Corte.json)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) manejarJsonMeta(f);
                        e.target.value = '';
                      }}
                    />
                    <span className="inline-block px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors">
                      {nombreJsonMeta ? 'Cambiar JSON' : 'Elegir DataROI_Meta_Corte.json'}
                    </span>
                  </label>
                  {nombreJsonMeta && (
                    <button type="button" onClick={() => setNombreJsonMeta(null)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="Quitar JSON">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* EDITOR MANUAL DE CORTE Y PARÁMETROS ROI */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditarMetaActivo(v => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {editarMetaActivo ? 'Ocultar configuración de corte y costos ROI' : 'Configurar manualmente etiqueta del corte (ej. 2026 Q3) y costos ROI'}
            </button>

            {editarMetaActivo && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-500 mb-1">Año Inicio Serie</label>
                    <input
                      type="number"
                      value={metaAnioInicio}
                      onChange={e => setMetaAnioInicio(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-black text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-500 mb-1">Último Año</label>
                    <input
                      type="number"
                      value={metaUltimoAnio}
                      onChange={e => setMetaUltimoAnio(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-black text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-500 mb-1">Último Trimestre</label>
                    <select
                      value={metaUltimoTrim}
                      onChange={e => setMetaUltimoTrim(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-black text-slate-900"
                    >
                      <option value={1}>Q1 (Ene–Mar)</option>
                      <option value={2}>Q2 (Abr–Jun)</option>
                      <option value={3}>Q3 (Jul–Sep)</option>
                      <option value={4}>Q4 (Oct–Dic)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-500 mb-1">INPC Base (Opcional)</label>
                    <input
                      type="text"
                      placeholder="ej. 145.3155"
                      value={metaInpcBase}
                      onChange={e => setMetaInpcBase(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['publica', 'privada_media', 'privada_elite'] as const).map(tipo => (
                    <div key={tipo} className="bg-white p-2.5 rounded-xl border border-slate-200/70 space-y-2">
                      <span className="font-black text-[11px] text-slate-800 uppercase block">
                        {tipo === 'publica' ? 'Univ. Pública' : tipo === 'privada_media' ? 'Privada Media' : 'Privada Élite'}
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-slate-400 block">Mensual ($)</label>
                          <input
                            type="number"
                            value={costosRoi[tipo].colegiatura_mensual}
                            onChange={e =>
                              setCostosRoi(prev => ({
                                ...prev,
                                [tipo]: { ...prev[tipo], colegiatura_mensual: Number(e.target.value) }
                              }))
                            }
                            className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block">Titulación ($)</label>
                          <input
                            type="number"
                            value={costosRoi[tipo].titulacion}
                            onChange={e =>
                              setCostosRoi(prev => ({
                                ...prev,
                                [tipo]: { ...prev[tipo], titulacion: Number(e.target.value) }
                              }))
                            }
                            className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: SEGURIDAD Y DISPARO */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              2. Autorizar y Publicar
            </h2>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                Clave de Administrador (INGESTA_ADMIN_TOKEN)
              </label>
              <input
                type="password"
                value={adminToken}
                onChange={e => setAdminToken(e.target.value)}
                placeholder="Ingresa tu clave secreta..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
              <input
                type="checkbox"
                checked={modoDryRun}
                onChange={e => setModoDryRun(e.target.checked)}
                className="mt-0.5 rounded accent-blue-600 cursor-pointer"
              />
              <span className="text-xs text-slate-700 leading-snug">
                <strong className="block font-black text-slate-900">Modo Simulación (Dry-Run)</strong>
                Valida columnas, llaves y tipos en el servidor sin modificar Supabase.
              </span>
            </label>

            {errorEnvio && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorEnvio}</span>
              </div>
            )}
          </div>

          <div className="space-y-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={enviando || !hayAlgoParaSubir || hayErroresArchivos}
              onClick={ejecutarIngesta}
              className={`w-full py-3 px-4 rounded-xl font-black text-xs md:text-sm inline-flex items-center justify-center gap-2 transition-all active:scale-95 ${
                enviando || !hayAlgoParaSubir || hayErroresArchivos
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : modoDryRun
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm cursor-pointer'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer'
              }`}
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando UPSERT y revalidando...
                </>
              ) : modoDryRun ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Validar Archivos (Sin Escribir)
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Publicar Corte en Tiempo Real
                </>
              )}
            </button>

            <p className="text-[10.5px] text-slate-400 text-center">
              Los índices <code className="font-mono">UNIQUE</code> garantizan que ningún registro se duplique al re-subir un periodo.
            </p>
          </div>
        </div>

      </div>

      {/* REPORTE DE IMPACTO EN VIVO: ANTES VS. DESPUÉS */}
      {resultadoIngesta && (
        <div className="bg-white rounded-3xl p-6 border-2 border-emerald-300 shadow-md space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {resultadoIngesta.dryRun ? 'Validación Simulada Exitosa' : '¡Plataforma Actualizada en Tiempo Real!'}
                </h2>
                <p className="text-xs text-slate-600 font-medium">{resultadoIngesta.mensaje}</p>
              </div>
            </div>

            {!resultadoIngesta.dryRun && (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-black transition-colors"
                >
                  Ver Catálogo Actualizado <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/descubrir"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-black transition-colors"
                >
                  Ver Ranking Regional
                </Link>
                <Link
                  href="/laboratorio"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-black transition-colors"
                >
                  Ver Laboratorio
                </Link>
              </div>
            )}
          </div>

          {resultadoIngesta.dryRun ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 font-bold block">predicciones_roi</span>
                <strong className="text-base font-black text-slate-900">{resultadoIngesta.resumenValidacion.predicciones_validas} válidas</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 font-bold block">benchmarks_prepa</span>
                <strong className="text-base font-black text-slate-900">{resultadoIngesta.resumenValidacion.benchmarks_prepa_validos} válidas</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 font-bold block">satelites_cultura</span>
                <strong className="text-base font-black text-slate-900">{resultadoIngesta.resumenValidacion.satelites_validos} válidas</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 font-bold block">satelites_prepa</span>
                <strong className="text-base font-black text-sky-700">{resultadoIngesta.resumenValidacion.satelites_prepa_validos} válidas</strong>
              </div>
              <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 font-bold block">meta_pipeline</span>
                <strong className="text-base font-black text-emerald-700">
                  {resultadoIngesta.resumenValidacion.actualiza_meta ? 'Listo' : 'Sin cambios'}
                </strong>
              </div>
            </div>
          ) : (
            resultadoIngesta.impacto && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Corte Oficial</span>
                    <div className="flex items-center gap-1.5 mt-1 font-black text-sm">
                      <span className="text-slate-500">{resultadoIngesta.impacto.antes.etiqueta_corte}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-blue-700">{resultadoIngesta.impacto.despues.etiqueta_corte}</span>
                    </div>
                    <span className="text-[10.5px] text-slate-500 block mt-0.5">
                      Rango: {resultadoIngesta.impacto.despues.rango_anios}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Carreras Certificadas</span>
                    <div className="flex items-center gap-1.5 mt-1 font-black text-sm">
                      <span className="text-slate-500">{resultadoIngesta.impacto.antes.total_carreras_certificadas}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-slate-900">{resultadoIngesta.impacto.despues.total_carreras_certificadas}</span>
                    </div>
                    <span className="text-[10.5px] font-bold text-emerald-700 block mt-0.5">
                      {resultadoIngesta.impacto.carreras_nuevas.length > 0
                        ? `+${resultadoIngesta.impacto.carreras_nuevas.length} carreras nuevas`
                        : 'Mismo padrón certificado'}
                    </span>
                  </div>

                  {(() => {
                    const a = resultadoIngesta.impacto.antes.media_salarial_nacional;
                    const d = resultadoIngesta.impacto.despues.media_salarial_nacional;
                    const diff = d - a;
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Media Lic. Nacional</span>
                        <div className="flex items-center gap-1.5 mt-1 font-black text-sm">
                          <span className="text-slate-500">{formatoMoneda(a)}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-slate-900">{formatoMoneda(d)}</span>
                        </div>
                        <span className={`text-[10.5px] font-black block mt-0.5 ${diff >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {diff >= 0 ? `+${formatoMoneda(diff)}` : formatoMoneda(diff)} / mes
                        </span>
                      </div>
                    );
                  })()}

                  {(() => {
                    const a = resultadoIngesta.impacto.antes.sueldo_prepa_nacional;
                    const d = resultadoIngesta.impacto.despues.sueldo_prepa_nacional;
                    const diff = d - a;
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Base Prepa Nacional</span>
                        <div className="flex items-center gap-1.5 mt-1 font-black text-sm">
                          <span className="text-slate-500">{formatoMoneda(a)}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-slate-900">{formatoMoneda(d)}</span>
                        </div>
                        <span className={`text-[10.5px] font-black block mt-0.5 ${diff >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {diff >= 0 ? `+${formatoMoneda(diff)}` : formatoMoneda(diff)} / mes
                        </span>
                      </div>
                    );
                  })()}

                  <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200">
                    <span className="text-[10.5px] font-bold uppercase text-sky-700 block">Satélites Prepa</span>
                    <div className="flex items-center gap-1.5 mt-1 font-black text-sm">
                      <span className="text-slate-500">{resultadoIngesta.impacto.antes.total_filas_satelites_prepa}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
                      <span className="text-sky-900">{resultadoIngesta.impacto.despues.total_filas_satelites_prepa}/18</span>
                    </div>
                    <span className="text-[10.5px] font-bold text-sky-800 block mt-0.5">
                      {resultadoIngesta.impacto.despues.calidad_oit_prepa_nacional != null
                        ? `OIT Prepa: ${resultadoIngesta.impacto.despues.calidad_oit_prepa_nacional}%`
                        : 'Sin satélites Prepa'}
                    </span>
                  </div>
                </div>

                {resultadoIngesta.impacto.carreras_nuevas.length > 0 && (
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs">
                    <span className="font-black text-emerald-900 flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Nuevas licenciaturas incorporadas automáticamente al Catálogo:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {resultadoIngesta.impacto.carreras_nuevas.map((c: any) => (
                        <span key={c.cve_carrera} className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 font-bold text-slate-800">
                          {c.nombre} ({c.cve_carrera})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(resultadoIngesta.impacto.topAlzas.length > 0 || resultadoIngesta.impacto.topBajas.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <h3 className="font-black text-emerald-800 flex items-center gap-1.5 mb-2.5">
                        <TrendingUp className="w-4 h-4 text-emerald-600" /> Mayores Alzas Salariales (Nacional)
                      </h3>
                      <div className="space-y-1.5">
                        {resultadoIngesta.impacto.topAlzas.map((v: any) => (
                          <div key={v.cve_carrera} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/70">
                            <span className="font-bold text-slate-800 truncate pr-2">{v.nombre}</span>
                            <span className="font-black text-emerald-700 whitespace-nowrap">
                              +{formatoMoneda(v.diff_mxn)} (+{v.diff_pct}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <h3 className="font-black text-amber-900 flex items-center gap-1.5 mb-2.5">
                        <TrendingDown className="w-4 h-4 text-amber-600" /> Mayores Ajustes Salariales (Nacional)
                      </h3>
                      <div className="space-y-1.5">
                        {resultadoIngesta.impacto.topBajas.map((v: any) => (
                          <div key={v.cve_carrera} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/70">
                            <span className="font-bold text-slate-800 truncate pr-2">{v.nombre}</span>
                            <span className="font-black text-rose-700 whitespace-nowrap">
                              {formatoMoneda(v.diff_mxn)} ({v.diff_pct}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </div>
      )}

    </main>
  );
}