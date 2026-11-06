"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Microscope, ShieldCheck, ChevronRight, Briefcase, SlidersHorizontal } from 'lucide-react';

type CarreraAumentada = {
  cve_carrera: string;
  nombre_carrera: string;
  is_stem: boolean;
  riesgo_ia_score: number;
};

export default function DirectorioClient({ directorio }: { directorio: CarreraAumentada[] }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroStem, setFiltroStem] = useState(false);
  const [filtroRiesgo, setFiltroRiesgo] = useState(false);

  // Motor de filtrado en tiempo real (Client-Side)
  const carrerasFiltradas = useMemo(() => {
    return directorio.filter((carrera) => {
      const coincideTexto = carrera.nombre_carrera.toLowerCase().includes(busqueda.toLowerCase()) || 
                            carrera.cve_carrera.includes(busqueda);
      
      const pasaFiltroStem = filtroStem ? carrera.is_stem : true;
      const pasaFiltroRiesgo = filtroRiesgo ? carrera.riesgo_ia_score <= 40 : true; // Considero Bajo Riesgo un score <= 40

      return coincideTexto && pasaFiltroStem && pasaFiltroRiesgo;
    });
  }, [busqueda, filtroStem, filtroRiesgo, directorio]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      
      {/* Hero del Home */}
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">
          DataROI México
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl">
          Descubre el retorno de inversión, proyección salarial y radiografía sociológica de tu futura carrera profesional.
        </p>
      </div>

      {/* Panel de Controles (Buscador y Filtros) */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Barra de Búsqueda */}
        <div className="relative w-full md:w-96 flex-shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
            placeholder="Buscar por nombre o código CVE..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {/* Filtros Rápidos y Ranking */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-start">
          
          {/* NUEVO BOTÓN PARA IR AL RANKING */}
          <Link 
            href="/descubrir"
            className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Ranking Personalizado
          </Link>

          <button
            onClick={() => setFiltroStem(!filtroStem)}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border ${
              filtroStem 
                ? 'bg-indigo-100 border-indigo-200 text-indigo-700' 
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Microscope className="w-4 h-4" /> 
            Solo STEM
          </button>

          <button
            onClick={() => setFiltroRiesgo(!filtroRiesgo)}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border ${
              filtroRiesgo 
                ? 'bg-green-100 border-green-200 text-green-700' 
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> 
            Blindadas vs IA
          </button>
        </div>
      </div>

      {/* Resultados y Cuadrícula de Tarjetas */}
      <div className="mb-6 flex items-center justify-between text-sm text-gray-500 font-medium">
        <span>Mostrando {carrerasFiltradas.length} carreras</span>
      </div>

      {carrerasFiltradas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {carrerasFiltradas.map((carrera) => (
            <Link 
              key={carrera.cve_carrera} 
              href={`/carrera/${carrera.cve_carrera}`}
              className="group bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-1 rounded-md border border-gray-200">
                    {carrera.cve_carrera}
                  </span>
                  {carrera.is_stem && (
                    <Microscope className="w-4 h-4 text-indigo-500" />
                  )}
                </div>
                <h2 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {carrera.nombre_carrera}
                </h2>
              </div>
              
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1">
                  <Briefcase className="w-4 h-4" /> Ver radiografía
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <p className="text-gray-500 font-medium">No se encontraron carreras con estos filtros.</p>
          <button 
            onClick={() => { setBusqueda(''); setFiltroStem(false); setFiltroRiesgo(false); }}
            className="mt-4 text-blue-600 font-bold hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}