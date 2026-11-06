import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import DirectorioClient from '@/components/DirectorioClient';
import { Loader2 } from 'lucide-react';

function auditarCohorteNacional(filasReales: any[]): boolean {
  const filasValidas = filasReales
    .filter(r => r.sueldo_promedio_mensual && r.sueldo_promedio_mensual > 0)
    .sort((a, b) => a.anio - b.anio);

  const aniosUnicos = new Set(filasValidas.map(r => r.anio));
  if (aniosUnicos.size < 6) return false;

  const pops = filasValidas.map(r => Number(r.poblacion_activa_total || 0));
  if (Math.min(...pops) < 2000 || Math.max(...pops) < 5000) return false;

  for (let i = 1; i < filasValidas.length; i++) {
    const prev = Number(filasValidas[i - 1].sueldo_promedio_mensual);
    const curr = Number(filasValidas[i].sueldo_promedio_mensual);
    if (Math.abs(curr - prev) / prev > 0.50) return false;
  }

  return true;
}

async function DirectorioCargador() {
  const padCve = (cve: any) => String(cve).padStart(6, '0');

  // Descargamos en paralelo evitando el tope de 1,000 filas de Supabase
  const [resCarreras, resSatelites, resHombres, resMujeres] = await Promise.all([
    supabase.from('dim_carreras').select('cve_carrera, nombre_carrera').order('nombre_carrera', { ascending: true }),
    supabase.from('satelites_cultura').select('cve_carrera, riesgo_ia_score'),
    supabase
      .from('predicciones_roi')
      .select('cve_carrera, anio, sexo, poblacion_activa_total, sueldo_promedio_mensual, is_stem')
      .eq('tipo_dato', 'Real')
      .eq('sexo', 1)
      .in('cve_ent', ['0', '00'])
      .limit(1000),
    supabase
      .from('predicciones_roi')
      .select('cve_carrera, anio, sexo, poblacion_activa_total, sueldo_promedio_mensual, is_stem')
      .eq('tipo_dato', 'Real')
      .eq('sexo', 2)
      .in('cve_ent', ['0', '00'])
      .limit(1000)
  ]);

  const carreras = resCarreras.data || [];
  const satelites = resSatelites.data || [];
  const historialNacional = [...(resHombres.data || []), ...(resMujeres.data || [])];

  const directorioAumentado = carreras.map((carrera) => {
    const cve = padCve(carrera.cve_carrera);
    const satelite = satelites.find((s) => padCve(s.cve_carrera) === cve);
    const filasCarrera = historialNacional.filter((p) => padCve(p.cve_carrera) === cve);

    const filasHombres = filasCarrera.filter(r => Number(r.sexo) === 1);
    const filasMujeres = filasCarrera.filter(r => Number(r.sexo) === 2);

    // Cirugía por Cohorte: Evaluamos cada género por separado
    const hombresValido = auditarCohorteNacional(filasHombres);
    const mujeresValido = auditarCohorteNacional(filasMujeres);

    // Calculamos el volumen de 2026 solo de las cohortes que pasaron la auditoría
    const volumen2026 = filasCarrera
      .filter(r => r.anio === 2026 && ((Number(r.sexo) === 1 && hombresValido) || (Number(r.sexo) === 2 && mujeresValido)))
      .reduce((sum, current) => sum + Number(current.poblacion_activa_total || 0), 0);

    const carreraEsStem = filasCarrera.length > 0 ? Boolean(filasCarrera[0].is_stem) : false;

    return {
      ...carrera,
      cve_carrera: cve,
      is_stem: carreraEsStem,
      riesgo_ia_score: satelite?.riesgo_ia_score || 100,
      volumen: volumen2026,
      tieneCohorteSolida: hombresValido || mujeresValido
    };
  });

  // LA GUILLOTINA MULTI-NIVEL: Al menos 1 cohorte sin saltos de >50% en 6 años y >= 15,000 PEA validada en 2026
  const directorioDepurado = directorioAumentado.filter(
    c => c.tieneCohorteSolida && c.volumen >= 15000
  );

  return <DirectorioClient directorio={directorioDepurado} />;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 font-sans">
      <Suspense fallback={
        <div className="min-h-screen flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500 font-medium animate-pulse">Auditando catálogo nacional de carreras...</p>
        </div>
      }>
        <DirectorioCargador />
      </Suspense>
    </main>
  );
}