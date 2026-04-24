# Mapa de Inseguridad · Conurbano Bonaerense

> Dashboard público e interactivo que visualiza las estadísticas criminales del **Sistema Nacional de Información Criminal (SNIC)** para los 24 partidos del Gran Buenos Aires, entre 2000 y el último año publicado.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![MapLibre GL](https://img.shields.io/badge/MapLibre%20GL-4.7-396CB2)](https://maplibre.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald)](LICENSE)
[![Colossus Lab](https://img.shields.io/badge/Colossus%20Lab-observatorio-00bb7f)](https://www.colossuslab.org)

---

## ¿Qué es este dashboard?

Un mapa interactivo construido a partir de **microdatos oficiales** del SNIC — Ministerio de Seguridad de la Nación. Permite explorar, comparar y entender la evolución de los hechos delictivos registrados en los 24 partidos del Conurbano Bonaerense, con herramientas pensadas para periodistas, investigadores, funcionarios públicos y ciudadanía interesada.

Es una iniciativa del **[Colossus Lab](https://www.colossuslab.org)** — laboratorio de participación ciudadana que conecta tecnología emergente con democracia.

## Funcionalidades

El dashboard se organiza en **tres vistas**, accesibles por pestañas:

### 1. Panorama general · Vista 3D blueprint
Visualización **volumétrica tipo sandbox 3D** del Conurbano: una grilla de ~38.000 celdas cuadradas de 300 m se extruye con la cantidad (o tasa) del delito y año seleccionados. La altura de cada bloque representa la densidad local del delito, ponderada por un gradiente urbano del GBA. El bloque-pico del partido con más delitos alcanza el tope del rango (rojo oscuro); el resto escala proporcionalmente formando una marea de columnas continua.

- **Filtros**: tipo de delito (32 categorías SNIC + Todos), métrica (tasa /100k o hechos), año (2000-2024).
- **Contadores**: total Conurbano del año, cantidad de tipos de delito, valor de la categoría seleccionada.
- **Interactividad**: pan, zoom, rotar (click derecho), inclinar (Ctrl+drag), reset vista. Hover muestra partido y valor.
- **Etiquetas de partido flotantes** + contornos resaltados para reconocer jurisdicciones.

### 2. Comparador temporal
Grilla alfabética de los 24 partidos para **seleccionar hasta 8 partidos** y superponer sus series temporales 2000-presente en un solo gráfico. Cada tarjeta muestra valor del año y variación interanual.

- Gráfico temporal comparativo con baseline Conurbano (línea gris punteada).
- **Cuadro comparativo tabular** con Δ absoluto y Δ % entre años consecutivos.
- Colores consistentes entre selección, chart y tabla.

### 3. Informe ejecutivo
**Scrollytelling descriptivo** en 6 escenas con resumen ejecutivo (KPIs), visualizaciones sincronizadas por scroll, y notas metodológicas al pie. Presenta los hallazgos de la serie SNIC 2000-2024 sin formular opiniones de gestión pública.

## Stack técnico

- **[Next.js 16](https://nextjs.org)** (App Router) + **React 19** + TypeScript estricto
- **[MapLibre GL](https://maplibre.org/maplibre-gl-js/)** (via `react-map-gl`) — 3D fill-extrusion + vector tiles CARTO
- **[Recharts](https://recharts.org/)** — line charts, bar charts
- **[Framer Motion](https://www.framer.com/motion/)** — animaciones del intro cinematográfico (typing, transitions)
- **[Tailwind CSS 3](https://tailwindcss.com)** — sistema de diseño institucional (paleta Colossus)
- **[Zustand](https://zustand-demo.pmnd.rs/)** — estado global del dashboard
- **[Turf.js](https://turfjs.org/)** (build-time) — generación de grilla hexagonal/cuadrada + operaciones geoespaciales

## Estructura del proyecto

```
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Layout base + metadata
│   ├── page.tsx                  # Monta DashboardShell
│   └── globals.css               # Tokens Colossus + utilidades
├── components/
│   ├── DashboardShell.tsx        # Header + tabs + footer
│   ├── Vista3DTab.tsx            # Mapa 3D blueprint
│   ├── ComparadorTab.tsx         # Grid + chart + tabla
│   ├── ScrollytellingTab.tsx     # Informe ejecutivo
│   ├── Choropleth.tsx            # (legacy 2D, aún usado en el informe)
│   └── intro/                    # Carrusel de bienvenida
│       ├── IntroCarousel.tsx
│       ├── SignedLineChart.tsx
│       ├── Pictogram.tsx
│       ├── TypingTitle.tsx
│       └── AnimatedCounter.tsx
├── lib/
│   ├── analytics.ts              # Helpers de agregación
│   ├── data.ts                   # Loaders del JSON
│   ├── store.ts                  # Zustand store
│   ├── types.ts                  # Tipos del dataset
│   ├── introScenes.ts            # Escenas del carrusel
│   └── scrollytellingData.ts     # Datos derivados para el informe
├── public/data/
│   ├── conurbano.json            # Dataset SNIC × 24 partidos × año × delito (282 KB)
│   ├── conurbano.geojson         # Polígonos de los 24 partidos (479 KB)
│   └── conurbano-hexgrid.geojson # Grilla 300 m, ~38k celdas (9.4 MB raw, ~820 KB gzip)
└── scripts/
    ├── build-data.mjs            # ETL del CSV SNIC → conurbano.json
    ├── build-geojson.mjs         # Partidos IGN → conurbano.geojson (clip Delta SF)
    ├── build-hexgrid.mjs         # Grilla 300 m clippeada a partidos
    └── analyze.mjs               # Análisis descriptivo para el informe
```

## Desarrollo local

### Requisitos

- **Node.js 20+** (probado con 24.14)
- npm 10+

### Setup

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Rebuilding datos

El dataset comiteado ya está procesado. Para regenerarlo desde los CSVs del SNIC:

```bash
# Fuente original: descargar de https://www.argentina.gob.ar/seguridad/estadisticascriminales
# Ubicar el CSV del SNIC Departamental en la ruta referenciada en scripts/build-data.mjs
# o exportar la variable SNIC_CSV apuntando a otra ubicación.

npm run data:build    # regenera los 3 JSON/GeoJSON en public/data/
```

El script `data:build` ejecuta tres pasos en secuencia:

1. `build-data.mjs` — stream el CSV SNIC, filtra los 24 partidos del GBA, agrega por (partido, año, delito-parent), calcula tasas promedio y desglose de víctimas por género (masc/fem/sd).
2. `build-geojson.mjs` — descarga contornos IGN (requiere red), filtra los 24 partidos, simplifica geometrías, clippea el delta del Paraná de San Fernando, agrega centroides para labels.
3. `build-hexgrid.mjs` — genera grilla cuadrada de 300 m dentro del bbox del Conurbano, asigna cada celda al partido que contiene su centroide, calcula pesos por distancia a CABA.

### Scripts disponibles

| Comando | Uso |
|---|---|
| `npm run dev` | Next.js dev server con Turbopack |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build en local (puerto 3000) |
| `npm run lint` | Linter |
| `npm run data:build` | Regenera datos + geometrías + grilla |

## Despliegue en Vercel

Este proyecto está configurado para **deploy one-click en [Vercel](https://vercel.com/)**.

### Opción A — Deploy automático desde GitHub

1. Fork o clone este repo en tu cuenta.
2. En Vercel, click **New Project** → **Import Git Repository** → seleccioná el repo.
3. Vercel detecta Next.js automáticamente. No se requieren variables de entorno.
4. Click **Deploy**.

Cada `git push` a `main` dispara un deploy de producción; cada PR, un deploy de preview con URL única.

### Opción B — Deploy manual con Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

### Configuración

- `vercel.json` ya incluye headers de cache largo para `/data/*` (inmutable, 1 año), que permite a Vercel servir los 3 archivos de datos desde CDN con compresión Brotli.
- No se requiere ninguna API key. Los tiles base son servidos por **CARTO dark-matter** (sin restricción de cuota razonable para este caso de uso).

## Fuentes de datos

| Dato | Fuente | Licencia |
|---|---|---|
| Microdatos SNIC (hechos, víctimas, tasas) | [Ministerio de Seguridad de la Nación](https://www.argentina.gob.ar/seguridad/estadisticascriminales) | Datos públicos — Ley 25.326 |
| Contornos de partidos (polígonos) | [IGN — Instituto Geográfico Nacional](https://www.ign.gob.ar) via WFS público | [Datos Abiertos Argentina](https://datos.gob.ar/acerca/seccion/licencias) |
| Tiles base del mapa 3D | [CARTO dark-matter](https://carto.com/basemaps/) | Uso gratuito para aplicaciones no comerciales |

## Notas metodológicas

- Los totales por año suman las **32 categorías parent-code** del SNIC (homicidios, robos, hurtos, lesiones, amenazas, etc.), agrupando las subcategorías introducidas en 2023.
- La **tasa** se informa por 100.000 habitantes según la población del departamento en cada año de la serie (cálculo oficial del SNIC).
- Para la Vista 3D, la altura de cada celda es **proporcional al valor del partido × gradiente urbano** (decaimiento exponencial con la distancia a CABA). El SNIC no publica microdatos sub-municipales; el gradiente es una aproximación para visualizar densidad intra-partido, no un dato directo.
- **Quilmes** unifica los códigos INDEC `06058` (2023+) y `06658` (histórico) para mantener la serie continua.
- **San Fernando** se recorta a la franja continental urbana; las islas del Delta del Paraná se excluyen de la representación visual pero los datos SNIC del partido se atribuyen completos.

## Contribuir

Este proyecto es open source bajo licencia MIT. Pull requests bienvenidos:

1. Fork del repo
2. Crear branch: `git checkout -b feat/mi-feature`
3. Commit: `git commit -m "feat: descripción"`
4. Push: `git push origin feat/mi-feature`
5. Abrir Pull Request

Issues también bienvenidos para reportar bugs, sugerir features o discutir decisiones de diseño.

## Licencia

[MIT](LICENSE) © 2025 Colossus Lab

## Créditos

Desarrollado por **[Colossus Lab](https://www.colossuslab.org)** — Laboratorio de participación ciudadana que conecta la tecnología emergente con la democracia. IA, Gobierno Abierto y Análisis de Datos para Argentina.

Datos oficiales del **Ministerio de Seguridad de la Nación** (SNIC).
