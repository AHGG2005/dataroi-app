"use client";

import { useState } from 'react';
import GraficaPredictiva from './GraficaPredictiva';
import { 
  TrendingUp, Building2, HeartHandshake, ShieldAlert, 
  Building, Factory, Landmark, Map, Home, 
  FileText, Users, Gift, PiggyBank, HeartPulse, Baby, 
  Scale, Network, Crown, Clock
} from 'lucide-react';

export default function PerfilTabs({ id, sociologia }: { id: string, sociologia: any }) {
  const [activeTab, setActiveTab] = useState('finanzas');

  if (!sociologia) return null;

  // Función auxiliar para dar formato a los porcentajes de forma segura
  const formatPct = (val: any) => val ? `${Number(val).toFixed(1)}%` : '0%';

  return (
    <div className="mt-8">
      {/* 1. Menú de Pestañas (Tabs) */}
      <div className="flex overflow-x-auto border-b border-gray-200 hide-scrollbar mb-6">
        <nav className="flex space-x-8 min-w-max px-2" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('finanzas')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'finanzas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Mercado y Finanzas
          </button>
          
          <button
            onClick={() => setActiveTab('ecosistema')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'ecosistema' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-4 h-4" /> Ecosistema Corporativo
          </button>

          <button
            onClick={() => setActiveTab('calidad')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'calidad' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <HeartHandshake className="w-4 h-4" /> Calidad del Empleo
          </button>

          <button
            onClick={() => setActiveTab('social')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'social' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Radiografía Social
          </button>
        </nav>
      </div>

      {/* 2. Contenido de las Pestañas */}
      <div className="pt-2">
        
        {/* PESTAÑA 1: FINANZAS */}
        {activeTab === 'finanzas' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <GraficaPredictiva cve_carrera={id} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-xl border border-gray-200 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-indigo-50 p-3 rounded-lg"><Clock className="w-6 h-6 text-indigo-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">Trabajo a Medio Tiempo</p>
                  <p className="text-xl font-bold text-gray-900">{formatPct(sociologia.pct_medio_tiempo)}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-cyan-50 p-3 rounded-lg"><Network className="w-6 h-6 text-cyan-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">Tasa de Pluriempleo (2+ Trabajos)</p>
                  <p className="text-xl font-bold text-gray-900">{formatPct(sociologia.pct_pluriempleo)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: ECOSISTEMA CORPORATIVO */}
        {activeTab === 'ecosistema' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">Distribución del Empleador (Nacional)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <Building className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                  <p className="text-2xl font-black text-gray-900">{formatPct(sociologia.pct_micro)}</p>
                  <p className="text-xs text-gray-500 font-medium">Microempresas</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <Factory className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-2xl font-black text-gray-900">{formatPct(sociologia.pct_pyme)}</p>
                  <p className="text-xs text-gray-500 font-medium">PYMES</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <Building2 className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-black text-gray-900">{formatPct(sociologia.pct_corp)}</p>
                  <p className="text-xs text-gray-500 font-medium">Corporativos</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <Landmark className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                  <p className="text-2xl font-black text-gray-900">{formatPct(sociologia.pct_gobierno)}</p>
                  <p className="text-xs text-gray-500 font-medium">Gobierno</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-xl border border-gray-200 flex items-center justify-between shadow-sm">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Adopción de Home Office</h3>
                  <p className="text-xs text-gray-500">Profesionistas en formato remoto o híbrido.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-blue-600">{formatPct(sociologia.pct_home_office)}</span>
                  <div className="bg-blue-50 p-2 rounded-lg"><Home className="w-5 h-5 text-blue-600" /></div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 flex items-center justify-between shadow-sm">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Tasa de Desarraigo</h3>
                  <p className="text-xs text-gray-500">Tuvieron que migrar a otro estado para ejercer.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-orange-600">{formatPct(sociologia.pct_desarraigo)}</span>

<Map className="w-5 h-5 text-orange-600" />
<div className="bg-orange-50 p-2 rounded-lg"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: CALIDAD DEL EMPLEO */}
        {activeTab === 'calidad' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
             <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">Prestaciones y Formalidad Legal</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                
                <div className="flex gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg h-fit"><FileText className="w-5 h-5 text-gray-700" /></div>
                  <div><p className="text-xl font-bold text-gray-900">{formatPct(sociologia.pct_contrato)}</p><p className="text-xs text-gray-500">Contrato Escrito</p></div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg h-fit"><Gift className="w-5 h-5 text-gray-700" /></div>
                  <div><p className="text-xl font-bold text-gray-900">{formatPct(sociologia.pct_aguinaldo)}</p><p className="text-xs text-gray-500">Reciben Aguinaldo</p></div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg h-fit"><PiggyBank className="w-5 h-5 text-gray-700" /></div>
                  <div><p className="text-xl font-bold text-gray-900">{formatPct(sociologia.pct_afore)}</p><p className="text-xs text-gray-500">Aportación a AFORE</p></div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg h-fit"><Users className="w-5 h-5 text-gray-700" /></div>
                  <div><p className="text-xl font-bold text-gray-900">{formatPct(sociologia.pct_sindicato)}</p><p className="text-xs text-gray-500">Sindicalizados</p></div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg h-fit"><HeartPulse className="w-5 h-5 text-gray-700" /></div>
                  <div><p className="text-xl font-bold text-gray-900">{formatPct(sociologia.pct_sgmm)}</p><p className="text-xs text-gray-500">Seguro Médico (SGMM)</p></div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg h-fit"><Baby className="w-5 h-5 text-gray-700" /></div>
                  <div><p className="text-xl font-bold text-gray-900">{formatPct(sociologia.pct_materno)}</p><p className="text-xs text-gray-500">Licencia Materna/Paterna</p></div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 4: RADIOGRAFÍA SOCIAL */}
        {activeTab === 'social' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-4">
            
            {/* Row 1: Brecha de Género y Riesgo IA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-purple-50 p-2 rounded-lg"><Scale className="w-5 h-5 text-purple-600" /></div>
                  <span className="text-2xl font-black text-gray-900">+{sociologia.brecha_genero_hogar_hrs} hrs</span>
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">Brecha de Doble Jornada</h3>
                <p className="text-xs text-gray-500 mt-2">
                  Hombres: <span className="font-bold text-gray-700">{sociologia.hrs_doble_jornada_hombres} hrs</span> de labores no remuneradas a la semana.<br/>
                  Mujeres: <span className="font-bold text-purple-700">{sociologia.hrs_doble_jornada_mujeres} hrs</span> a la semana.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className={`${sociologia.riesgo_ia_score > 60 ? 'bg-red-50' : 'bg-green-50'} p-2 rounded-lg`}>
                    <ShieldAlert className={`w-5 h-5 ${sociologia.riesgo_ia_score > 60 ? 'text-red-600' : 'text-green-600'}`} />
                  </div>
                  <span className="text-2xl font-black text-gray-900">{sociologia.riesgo_ia_score} / 100</span>
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">Riesgo de Automatización (IA)</h3>
                <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
                  <div className={`h-2 rounded-full ${sociologia.riesgo_ia_score > 60 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${sociologia.riesgo_ia_score}%` }}></div>
                </div>
              </div>
            </div>

            {/* Row 2: Privilegio y Nepotismo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Índice de Nepotismo</h3>
                  <p className="text-xs text-gray-500">Obtuvieron su empleo actual por familiares o amigos.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-rose-600">{formatPct(sociologia.pct_nepotismo)}</span>
                  <div className="bg-rose-50 p-2 rounded-lg"><Network className="w-5 h-5 text-rose-600" /></div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Índice de Privilegio</h3>
                  <p className="text-xs text-gray-500">Correlación entre el perfil demográfico y la posición ocupada.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-amber-600">{sociologia.indice_privilegio} <span className="text-sm font-normal text-gray-500">/ 100</span></span>
                  <div className="bg-amber-50 p-2 rounded-lg"><Crown className="w-5 h-5 text-amber-600" /></div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}