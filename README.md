# DataROI México

Plataforma web de auditoría salarial, empleabilidad, calidad laboral y retorno de inversión (ROI) universitario en México, construida con microdatos oficiales de la **ENOE (INEGI)**, el **INPC (INEGI)** y los **Anuarios Estadísticos de ANUIES**.

El sistema opera bajo una arquitectura **100% dinámica y sin valores congelados**: las series temporales, ventanas de análisis, benchmarks y satélites de Preparatoria, medias regionales, escalas gráficas, conteo de licenciaturas certificadas y reportes exportables se recalculan en vivo desde **Supabase (PostgreSQL)** y pueden actualizarse en tiempo real desde la propia aplicación web sin modificar código ni redesplegar.

---

## Arquitectura y Módulos

| Ruta | Módulo | Descripción |
| :--- | :--- | :--- |
| `/` | **Catálogo Nacional** | Directorio interactivo de todas las licenciaturas que superan el umbral estadístico nacional, con búsqueda por nombre o clave CMPE, filtros STEM / Blindaje IA, ordenamiento multicriterio y medallón entero del **Score DataROI (0–100)**. |
| `/descubrir` | **Descubridor y Ranking Regional** | Mapa cartográfico interactivo de las 5 macro-regiones económicas de México, selector de perspectiva de género (`Total`, `Mujeres`, `Hombres`) y dos modos de evaluación: **Calificación Integral DataROI (0–100)** y **Afinidad Personal (% Match)** con hasta 5 prioridades jerarquizadas. |
| `/carrera/[id]` | **Auditoría Ejecutiva Individual** | Ficha completa por licenciatura: Simulador de ROI (Bolsillo + Costo de Oportunidad Mincer con 3 escenarios + ajuste personalizado), Evolución Salarial Real vs. Preparatoria, Huella Estructural de 6 Pilares, Termómetros Regionales, Calidad de Ocupación OIT con contraste directo vs. Solo Preparatoria, Mosaico de Empleadores, Escalera de Prestaciones (con switch `vs. Media Lic.` / `vs. Solo Prepa`) y Rieles Divergentes de Barreras y Fricción Laboral. |
| `/laboratorio` | **Laboratorio de Datos Crudos** | Estación bivariada de cruce libre sobre 24 variables puras con regresión lineal OLS (Pearson $r$, $R^2$ y pendiente interpretada), cuadrantes interactivos, Radar de Correlaciones, Censo Demográfico reactivo y tabla univariada con percentiles (`P10`, `P50`, `P90`). |
| `/actualizar` + `/api/ingesta` | **Ingesta en Tiempo Real por Lotes** | Módulo protegido por `INGESTA_ADMIN_TOKEN` (oculto automáticamente en la barra de navegación en producción, accesible por URL directa `/actualizar`). Divide los CSVs en paquetes `<350 KB` compatibles con Vercel, ejecuta validación y simulación *Dry-Run*, realiza `UPSERT` en Supabase vía `SUPABASE_SERVICE_ROLE_KEY`, revalida todas las rutas (incluido `/carrera/[id]`) y genera el reporte de impacto **Antes vs. Después**. |
| Global (`NavbarGlobal`) | **Comparador Cara a Cara (*Versus*)** | Accesible desde cualquier ruta con barra *Smart Auto-Hide*, sincronización automática con `?region=` y `?genero=` de la URL y selección persistente de 2 a 3 carreras: Radar superpuesto de 6 pilares, comparativa salarial en 5 macro-regiones, matriz de liderazgo y exportación a **PDF vectorial nativo**, **Excel (`.xlsx` multi-hoja)** y **CSV (RFC 4180)**. |

---

## Fuentes Oficiales y Metodología Estadística

### 1. Fuentes de Datos
* **ENOE — Sociodemográfico (`SDEM`, trimestral):** ingresos laborales, población económicamente activa (PEA, `clase1 = 1`), ocupación (`clase2 = 1`), desempleo abierto (`clase2 = 2`) y horas trabajadas (`hrsocup >= 24`, edad `>= 20`).
* **ENOE — Cuestionario Ampliado (`COE1` + `COE2`, anual T1):** prestaciones de ley (contrato escrito, aguinaldo, AFORE, SGMM, sindicato, protección parental), ecosistema empleador (`ambito2`), nepotismo, desarraigo, pluriempleo, trabajo remoto, estrato socioeconómico (`est`) y doble jornada doméstica.
* **INPC (INEGI):** deflación de todas las series históricas a **pesos constantes del último corte cargado**.
* **Anuarios Estadísticos ANUIES (anual):** egresados de licenciatura mapeados a claves CMPE de 4 dígitos para el cálculo del índice de saturación estructural.
* **Exposición a Automatización IA y Teletrabajabilidad:** indicadores integrados por campo CMPE en el pipeline de satélites.

### 2. Rigor Muestral y Estabilización Actuarial
* **Certificación de celdas:** una licenciatura entra al catálogo nacional únicamente si alcanza `n_encuestados_reales >= 180` y volumen poblacional anualizado suficiente; las celdas regionales y por género exigen `n >= 30` (Total) o `n >= 25` (Hombres/Mujeres) con tamaño efectivo de **Kish $\ge 18.0$**.
* **Control de atípicos:** winsorización de factores de expansión (`2.8 × mediana`) y recorte salarial `p03–p97` por carrera/región.
* **Credibilidad de Bühlmann (pasada única):** aplicada exclusivamente en el ETL de Python utilizando paridad regional calculada dinámicamente sobre los últimos 2 años observados. El motor frontend (`src/lib/dataroiEngine.ts`) consume los montos consolidados sin aplicar doble encogimiento.
* **Contraste exacto Licenciatura vs. Solo Preparatoria:** `satelites_prepa` y `benchmarks_prepa` procesan población con bachillerato (`cs_p13_1 = 4`, `eda >= 20`) bajo **exactamente las mismas fórmulas** de jornada estándar, formalidad compuesta (`0.45 Contrato + 0.30 Aguinaldo + 0.25 AFORE`), **Empleo de Calidad OIT** (`(0.70 · min(Contrato, AFORE) + 0.30 · Contrato) · (1 - Pluriempleo / 200)`) y desempleo abierto.
* **Índice de Saturación ANUIES:** relación estructural entre egresados anuales promedio de ANUIES y vacantes anuales estimadas en ENOE (reemplazo generacional del 5% + expansión observada de la PEA), acotado a `[22%, 320%]`.
* **Score DataROI Universal (0–100):** índice ponderado de 6 pilares — Retorno Salarial (25%), Empleabilidad (20%), Calidad OIT (20%), Meritocracia (15%), Blindaje IA y Futuro (10%) y Estabilidad de Vida (10%) — clasificado en **Grado A (70–100)**, **Grado B (56–69)** y **Grado C (<56)**.

---

## Stack Tecnológico

* **Frontend & API:** Next.js 16 (App Router, Turbopack, Partial Prerendering), React 19, TypeScript 5, Tailwind CSS v4.
* **Visualización y Exportación:** Recharts 3, Lucide React, generador **PDF 1.4 vectorial nativo** (`src/lib/pdfReportGenerator.ts`) y generador **Excel `.xlsx` / CSV** nativo sin dependencias externas (`src/lib/excelReportGenerator.ts`).
* **Base de Datos:** Supabase (PostgreSQL con Row Level Security de lectura pública y escritura restringida al servidor).
* **Pipeline ETL:** Python 3 (`pandas`, `numpy`, `openpyxl`) en dos scripts desacoplados:
  * `etl_fase6_satelites.py` → genera `DataROI_Satelites_Regional_Final.csv` y `DataROI_Satelites_Prepa.csv`.
  * `etl_mercado_y_saturacion_definitivo.py` → genera `DataROI_Mercado_MacroRegional_Final.csv`, `DataROI_Benchmarks_Prepa.csv` y `DataROI_Meta_Corte.json`.

---

## Esquema de Base de Datos (Supabase)

| Tabla | Llave Única / Primaria | Propósito |
| :--- | :--- | :--- |
| `dim_carreras` | `cve_carrera` | Catálogo CMPE de licenciaturas, títulos ejecutivos (`nombre_ejecutivo`), semestres base (`semestres_default`) y equipo (`capex_mxn`). |
| `predicciones_roi` | `(anio, cve_ent, sexo, cve_carrera, tipo_dato)` | Series anuales reales de salarios deflactados, PEA, desempleo y saturación ANUIES por macro-región y género. |
| `satelites_cultura` | `(cve_carrera, region, sexo)` | 26 variables estructurales de calidad laboral, prestaciones, empleadores, barreras sociales y riesgo IA por licenciatura. |
| `benchmarks_prepa` | `(anio, region, sexo)` | Serie histórica real de salarios, formalidad SDEM y tasa de desempleo (`tasa_desempleo_pct`) de Preparatoria. |
| `satelites_prepa` | `(region, sexo)` | 18 celdas de satélites completos de Solo Preparatoria para contraste directo contra Licenciatura. |
| `meta_pipeline` | `id = 1` | Corte activo (`etiqueta_corte`, `anio_inicio`, `ultimo_anio`, `ultimo_trimestre`), `inpc_base` y costos de referencia del Simulador ROI (`costos_roi`). |

---

## Instalación y Configuración Local

1. **Clonar e instalar dependencias:**
   ```bash
   npm install
   ```

2. **Crear `.env.local` en la raíz (guardado en UTF-8 sin BOM):**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_tu_publishable_o_anon_key
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_tu_secret_key_de_servidor
   INGESTA_ADMIN_TOKEN=tu_clave_secreta_de_administrador
   ```
   * **Seguridad:** `SUPABASE_SERVICE_ROLE_KEY` e `INGESTA_ADMIN_TOKEN` nunca llevan el prefijo `NEXT_PUBLIC_` y se leen únicamente dentro del servidor (`/api/ingesta`).
   * **Navegación de administrador:** El botón `Subir Corte` aparece automáticamente en `npm run dev` y se oculta en producción (`npm run start` / Vercel). Si deseas mostrarlo también en producción, añade `NEXT_PUBLIC_MOSTRAR_NAV_ADMIN=true`.

3. **Ejecutar en desarrollo o compilar para producción:**
   ```bash
   # Desarrollo con Turbopack
   npm run dev

   # Verificación de tipos, compilación y arranque de producción
   npx tsc --noEmit
   npm run build
   npm run start
   ```

---

## Flujo de Actualización de Nuevos Cortes (Q3 2026, 2027+)

| Frecuencia | Archivos oficiales a descargar | Script Python a correr | Archivos a subir en `/actualizar` |
| :--- | :--- | :--- | :--- |
| **Trimestral o Semestral** (ej. Q3 / Q4) | Nuevo `SDEM` de la ENOE + `inpc.CSV` actualizado | `etl_mercado_y_saturacion_definitivo.py` | `DataROI_Mercado_MacroRegional_Final.csv`, `DataROI_Benchmarks_Prepa.csv`, `DataROI_Meta_Corte.json` |
| **Anual (Q1 / T1)** | `SDEM`, `COE1` y `COE2` de T1 + nuevo Anuario `ANUIES` (`.xlsx`) | 1. `etl_fase6_satelites.py`<br>2. `etl_mercado_y_saturacion_definitivo.py` | Los 5 archivos generados en `processed_data/` (incluyendo `DataROI_Satelites_Regional_Final.csv` y `DataROI_Satelites_Prepa.csv`) |

1. Abre `/actualizar` (en local o en tu dominio de producción).
2. Selecciona los archivos generados por Python e ingresa tu `INGESTA_ADMIN_TOKEN`.
3. *(Opcional)* Marca **Modo Simulación (Dry-Run)** para validar todos los lotes sin escribir en Supabase.
4. Desmarca *Dry-Run* y pulsa **Publicar Corte en Tiempo Real**: cada tabla se envía automáticamente en lotes pequeños (`<350 KB`), se actualiza Supabase por `UPSERT`, se revalidan todas las rutas y se muestra el reporte **Antes vs. Después**.

---

## Despliegue en Vercel

1. Conecta el repositorio en Vercel y define las 4 variables de `.env.local` en **Project Settings → Environment Variables**.
2. Despliega normalmente (`next build`). La interfaz pública mostrará solo **Catálogo**, **Descubridor y Ranking**, **Laboratorio Crudo** y **Versus**; para subir cortes futuros entra directo a `[https://tu-dominio.vercel.app/actualizar](https://tu-dominio.vercel.app/actualizar)`.