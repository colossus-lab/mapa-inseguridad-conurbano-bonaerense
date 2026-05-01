"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import { useDashboard } from "@/lib/store";
import { hechosDelito, tasaDelito } from "@/lib/analytics";
import type { Dataset, Metric } from "@/lib/types";

// Estilo CARTO dark-matter: ofrece hint sutil de calles + ríos sobre base oscura.
// Lo armamos inline para tener control total de colores.
const BASE_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";

type HexProps = {
  departamento_id: string;
  weight: number;
  row: number;
  col: number;
};

export default function Vista3DTab() {
  const { dataset, municipioSel, setMunicipio } = useDashboard();

  // Filtros locales al tab.
  const [delitoId, setDelitoId] = useState<string>("1");
  const [metric, setMetric] = useState<Metric>("tasa");
  const [anio, setAnio] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [geoPartidos, setGeoPartidos] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hexGrid, setHexGrid] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hoverPid, setHoverPid] = useState<string | null>(null);
  const mapRef = useRef<MapRef | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const focusPid = municipioSel ?? hoverPid;

  useEffect(() => {
    if (!dataset) return;
    setAnio(dataset.anios[dataset.anios.length - 1]);
    if (!dataset.delitos.find((d) => d.id === delitoId)) setDelitoId(dataset.delitos[0].id);
  }, [dataset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/data/conurbano.geojson").then((r) => r.json()).then(setGeoPartidos).catch(console.error);
    fetch("/data/conurbano-hexgrid.geojson").then((r) => r.json()).then(setHexGrid).catch(console.error);
  }, []);

  // Resize defensivo para el canvas.
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const tick = () => mapRef.current?.getMap()?.resize();
    const obs = new ResizeObserver(tick);
    obs.observe(el);
    const iv = setInterval(tick, 300);
    const stop = setTimeout(() => clearInterval(iv), 3000);
    return () => { obs.disconnect(); clearInterval(iv); clearTimeout(stop); };
  }, [hexGrid]);

  // Enriquecemos el hexgrid con `value`, `intensity` y `height` basado en el filtro actual.
  // Aplicamos transformación raíz cuadrada sobre intensidad/altura para que los valores
  // medios (la mayoría de los hexes) no queden todos "verdes claros" — evita el sesgo
  // visual típico cuando la distribución de densidad es fuerte.
  // Índice espacial row,col → feature index (para smoothing 3×3 en bordes).
  const gridIndex = useMemo<Record<string, number> | null>(() => {
    if (!hexGrid) return null;
    const m: Record<string, number> = {};
    hexGrid.features.forEach((f, i) => {
      const p = f.properties as HexProps;
      m[`${p.row},${p.col}`] = i;
    });
    return m;
  }, [hexGrid]);

  const hexWithHeights = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!dataset || !hexGrid || !gridIndex) return null;
    const ai = dataset.anios.indexOf(anio);
    if (ai < 0) return null;

    // "all" → suma de todos los delitos SNIC (universo completo).
    const isAll = delitoId === "all";
    const di = isAll ? -1 : dataset.delitos.findIndex((d) => d.id === delitoId);
    if (!isAll && di < 0) return null;

    const byPartido: Record<string, number> = {};
    dataset.partidos.forEach((p, pi) => {
      if (isAll) {
        let s = 0;
        for (let d = 0; d < dataset.delitos.length; d++) {
          s += metric === "tasa"
            ? tasaDelito(dataset, pi, d, ai)
            : hechosDelito(dataset, pi, d, ai);
        }
        byPartido[p.id] = s;
      } else {
        byPartido[p.id] =
          metric === "tasa" ? tasaDelito(dataset, pi, di, ai) : hechosDelito(dataset, pi, di, ai);
      }
    });

    // 1) Valores crudos por celda.
    const rawValues = hexGrid.features.map((f) => {
      const p = f.properties as HexProps;
      return (byPartido[p.departamento_id] ?? 0) * (p.weight ?? 0);
    });

    // 2) Suavizado gaussiano 5×5 (sigma ≈ 1.2 celdas) para obtener un campo
    //    continuo tipo "superficie de agua". Pesos normalizados que suman 1.
    //    El pico central se mantiene (peso central ≈ 0.15) pero la distribución
    //    extendida a 24 vecinos genera transiciones muy graduales.
    const KERNEL = [
      [1,  4,  7,  4, 1],
      [4, 16, 26, 16, 4],
      [7, 26, 41, 26, 7],
      [4, 16, 26, 16, 4],
      [1,  4,  7,  4, 1],
    ];
    const KERNEL_SUM = 273; // suma total
    const smoothed = hexGrid.features.map((f, i) => {
      const p = f.properties as HexProps;
      let sum = 0;
      let totalWeight = 0;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const w = KERNEL[dr + 2][dc + 2];
          if (dr === 0 && dc === 0) {
            sum += rawValues[i] * w;
            totalWeight += w;
          } else {
            const nIdx = gridIndex[`${p.row + dr},${p.col + dc}`];
            if (nIdx != null) {
              sum += rawValues[nIdx] * w;
              totalWeight += w;
            }
          }
        }
      }
      // Normalizar por el peso efectivo (maneja bordes donde faltan vecinos).
      return totalWeight > 0 ? sum / totalWeight : rawValues[i];
    });
    void KERNEL_SUM;

    let globalMax = 0;
    for (const v of smoothed) if (v > globalMax) globalMax = v;

    // Para color: rank por percentiles globales sobre valores positivos.
    // Garantiza contraste cromático parejo aun con métricas sesgadas
    // (un partido outlier ya no aplasta toda la paleta a verde).
    const positives = smoothed.filter((v) => v > 0).slice().sort((a, b) => a - b);
    const N = positives.length;
    const percentileOf = (v: number): number => {
      if (v <= 0 || N === 0) return 0;
      let lo = 0, hi = N;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (positives[mid] < v) lo = mid + 1;
        else hi = mid;
      }
      return lo / N;
    };

    const MAX_HEIGHT = 6500;
    const features: GeoJSON.Feature[] = hexGrid.features.map((f, i) => {
      const value = smoothed[i];
      const linear = globalMax > 0 ? value / globalMax : 0;
      // pow 0.4 — empuja valores medios al rango visible; pico intacto.
      // (sólo lo usamos para la altura física; el color va por percentil)
      const visualHeight = Math.pow(linear, 0.4);
      const intensity = percentileOf(value);
      const p = f.properties as HexProps;
      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          departamento_id: p.departamento_id,
          weight: p.weight,
          value,
          intensity,
          height: value > 0 ? Math.max(30, visualHeight * MAX_HEIGHT) : 0,
        },
      };
    });

    return { type: "FeatureCollection", features };
  }, [dataset, hexGrid, gridIndex, delitoId, anio, metric]);

  // Points con centroides de los 24 partidos para etiquetas flotantes.
  const labelPoints = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!geoPartidos) return null;
    const features: GeoJSON.Feature[] = [];
    geoPartidos.features.forEach((f) => {
      const c = (f.properties as { centroid?: [number, number] })?.centroid;
      if (!c) return;
      features.push({
        type: "Feature",
        properties: { nombre: f.properties?.nombre, departamento_id: f.properties?.departamento_id },
        geometry: { type: "Point", coordinates: c },
      });
    });
    return { type: "FeatureCollection", features };
  }, [geoPartidos]);

  const resetView = () => {
    mapRef.current?.getMap()?.easeTo({
      center: [-58.55, -34.65],
      zoom: 9.3,
      pitch: viewMode === "3d" ? 55 : 0,
      bearing: viewMode === "3d" ? -18 : 0,
      duration: 800,
    });
  };

  // Animar cambio de modo: en 2D aplanamos pitch/bearing; en 3D restauramos.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.easeTo({
      pitch: viewMode === "3d" ? 55 : 0,
      bearing: viewMode === "3d" ? -18 : 0,
      duration: 600,
    });
  }, [viewMode]);

  const delitoNombre = delitoId === "all"
    ? "Todos los delitos (suma SNIC)"
    : (dataset?.delitos.find((d) => d.id === delitoId)?.nombre ?? "");
  const totalAllDelitos = useMemoTotalAllDelitos(dataset, anio);
  const totalDelitoSel = useMemoTotal(dataset, delitoId, anio);
  const totalConurbano = delitoId === "all" ? totalAllDelitos : totalDelitoSel;

  if (!dataset) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de control */}
      <section className="rounded-xl border border-line bg-white p-5 shadow-card">
        {/* Fila superior: contador total Conurbano (contexto del año) */}
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-line-subtle pb-3">
          <div className="flex items-baseline gap-5">
            <div>
              <div className="eyebrow">Total Conurbano · {anio}</div>
              <div className="mt-0.5 text-[22px] font-semibold leading-none tracking-tight text-ink num">
                {totalAllDelitos.toLocaleString("es-AR")}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-3">hechos agregados de todas las categorías</div>
            </div>
            <div className="h-10 w-px bg-line" />
            <div>
              <div className="eyebrow">Tipos de delito</div>
              <div className="mt-0.5 text-[22px] font-semibold leading-none tracking-tight text-ink num">
                {dataset.delitos.length}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-3">categorías registradas en SNIC</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-ink-3">
              Categoría seleccionada: <span className="font-semibold text-ink">{totalConurbano.toLocaleString("es-AR")}</span> hechos
            </div>
            <div className="inline-flex overflow-hidden rounded-md border border-line bg-paper">
              {(["2d", "3d"] as const).map((m, i) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={[
                    "px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-wider transition",
                    i === 0 ? "border-r border-line" : "",
                    viewMode === m ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
                  ].join(" ")}
                  title={m === "2d" ? "Vista plana · zoom y análisis detallado" : "Vista volumétrica · relieve por delito"}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <label className="flex min-w-0 flex-col gap-2">
          <span className="eyebrow">Tipo de delito</span>
          <select
            value={delitoId}
            onChange={(e) => setDelitoId(e.target.value)}
            className="rounded-md border border-line bg-paper px-3 py-2.5 text-[14px] text-ink outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">— Todos los delitos (suma SNIC) —</option>
            {dataset.delitos.map((d) => (
              <option key={d.id} value={d.id}>{d.nombre}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="eyebrow">Métrica</span>
          <div className="inline-flex overflow-hidden rounded-md border border-line bg-paper">
            {(["tasa", "hechos"] as const).map((m, i) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={[
                  "px-4 py-2.5 text-[13px] font-medium transition",
                  i === 0 ? "border-r border-line" : "",
                  metric === m ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
                ].join(" ")}
              >
                {m === "tasa" ? "Tasa /100k" : "Hechos"}
              </button>
            ))}
          </div>
        </label>

        <label className="flex min-w-0 flex-col gap-2">
          <span className="flex items-baseline justify-between">
            <span className="eyebrow">Año</span>
            <span className="mono num text-[14px] font-semibold text-ink">{anio}</span>
          </span>
          <input
            type="range"
            min={dataset.anios[0]}
            max={dataset.anios[dataset.anios.length - 1]}
            step={1}
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10.5px] text-ink-4 mono num">
            <span>{dataset.anios[0]}</span>
            <span>{dataset.anios[dataset.anios.length - 1]}</span>
          </div>
        </label>
        </div>
      </section>

      {/* Mapa 3D blueprint */}
      <div ref={wrapperRef} className="relative h-[640px] overflow-hidden rounded-xl border border-line shadow-card">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: -58.55,
            latitude: -34.65,
            zoom: 9.3,
            pitch: 55,
            bearing: -18,
          }}
          mapStyle={BASE_STYLE}
          maxBounds={[[-59.3, -35.25], [-57.6, -34.0]]}
          minZoom={8.5}
          maxZoom={13}
          maxPitch={viewMode === "3d" ? 70 : 0}
          onMouseMove={(e) => {
            const f = e.features?.[0];
            setHoverPid(f ? ((f.properties?.departamento_id as string) ?? null) : null);
          }}
          onMouseLeave={() => setHoverPid(null)}
          onClick={(e) => {
            const f = e.features?.[0];
            const pid = (f?.properties?.departamento_id as string) ?? null;
            if (!pid) {
              if (municipioSel) setMunicipio(null);
              return;
            }
            // Toggle: click sobre el seleccionado lo libera.
            setMunicipio(pid === municipioSel ? null : pid);
          }}
          interactiveLayerIds={[viewMode === "3d" ? "hex-3d" : "hex-2d"]}
          style={{ height: "100%", width: "100%", background: "#0a1220" }}
        >
          {/* Capa base con fondo muy oscuro sobre la ya existente (pinta las zonas sin tile) */}
          <NavigationControl position="top-right" visualizePitch showCompass showZoom />

          {/* Grilla técnica tenue cada 0.05 grado (~5.5 km) */}
          <Source id="tech-grid" type="geojson" data={buildTechGrid()}>
            <Layer
              id="tech-grid-line"
              type="line"
              paint={{
                "line-color": "#00bb7f",
                "line-opacity": 0.08,
                "line-width": 0.8,
              }}
            />
          </Source>

          {/* Contornos de los partidos, en emerald blueprint — doble stroke para reconocibilidad */}
          {geoPartidos && (
            <Source id="partidos-outline" type="geojson" data={geoPartidos}>
              <Layer
                id="partidos-fill-bg"
                type="fill"
                paint={{
                  "fill-color": "#0f1a2a",
                  "fill-opacity": 0.6,
                }}
              />
              {/* Glow externo: banda ancha semi-transparente */}
              <Layer
                id="partidos-line-glow"
                type="line"
                paint={{
                  "line-color": "#00bb7f",
                  "line-width": 5,
                  "line-opacity": 0.18,
                  "line-blur": 2,
                }}
              />
              {/* Borde principal bien marcado */}
              <Layer
                id="partidos-line-3d"
                type="line"
                paint={{
                  "line-color": [
                    "case",
                    ["==", ["get", "departamento_id"], municipioSel ?? "__none__"], "#00ffaa",
                    ["==", ["get", "departamento_id"], hoverPid ?? "__none__"], "#00d294",
                    "#00bb7f",
                  ],
                  "line-width": [
                    "case",
                    ["==", ["get", "departamento_id"], municipioSel ?? "__none__"], 4,
                    ["==", ["get", "departamento_id"], hoverPid ?? "__none__"], 3.2,
                    2,
                  ],
                  "line-opacity": 0.95,
                }}
              />
            </Source>
          )}

          {/* Hexes — extruidos en 3D, planos en 2D */}
          {hexWithHeights && (
            <Source id="hexgrid" type="geojson" data={hexWithHeights}>
              {viewMode === "3d" ? (
                <Layer
                  id="hex-3d"
                  type="fill-extrusion"
                  paint={{
                    "fill-extrusion-height": ["get", "height"],
                    "fill-extrusion-base": 0,
                    "fill-extrusion-color": [
                      "interpolate", ["linear"], ["get", "intensity"],
                      0, "#062a1f",
                      0.15, "#007956",
                      0.35, "#00bb7f",
                      0.55, "#edb200",
                      0.75, "#f97316",
                      0.9, "#dc2626",
                      1, "#7f1d1d",
                    ],
                    "fill-extrusion-opacity": municipioSel
                      ? [
                          "case",
                          ["==", ["get", "departamento_id"], municipioSel], 0.9,
                          0.22,
                        ]
                      : 0.78,
                    "fill-extrusion-vertical-gradient": true,
                  }}
                />
              ) : (
                <Layer
                  id="hex-2d"
                  type="fill"
                  paint={{
                    "fill-color": [
                      "interpolate", ["linear"], ["get", "intensity"],
                      0, "#062a1f",
                      0.15, "#007956",
                      0.35, "#00bb7f",
                      0.55, "#edb200",
                      0.75, "#f97316",
                      0.9, "#dc2626",
                      1, "#7f1d1d",
                    ],
                    "fill-opacity": municipioSel
                      ? [
                          "case",
                          ["==", ["get", "departamento_id"], municipioSel], 0.92,
                          0.18,
                        ]
                      : 0.85,
                  }}
                />
              )}
            </Source>
          )}

          {/* Etiquetas flotantes de partidos — añadidas ÚLTIMAS para quedar por encima */}
          {labelPoints && (
            <Source id="partido-labels" type="geojson" data={labelPoints}>
              <Layer
                id="partido-label-text"
                type="symbol"
                layout={{
                  "text-field": ["get", "nombre"],
                  "text-font": ["Noto Sans Bold"],
                  "text-size": [
                    "interpolate", ["linear"], ["zoom"],
                    8, 10,
                    10, 13,
                    12, 16,
                  ],
                  "text-anchor": "center",
                  "text-allow-overlap": true,
                  "text-ignore-placement": true,
                  "text-letter-spacing": 0.05,
                  "text-padding": 2,
                }}
                paint={{
                  "text-color": "#ffffff",
                  "text-halo-color": "#0a1220",
                  "text-halo-width": 2.2,
                  "text-halo-blur": 0.5,
                  "text-opacity": [
                    "case",
                    ["==", ["get", "departamento_id"], hoverPid ?? ""], 1,
                    0.92,
                  ],
                }}
              />
            </Source>
          )}
        </Map>

        {/* Leyenda */}
        <div className="pointer-events-none absolute left-4 top-4 w-[280px] rounded-lg border border-emerald-900/40 bg-[#0a1220]/90 p-3 shadow-float backdrop-blur">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
            Vista {viewMode.toUpperCase()} · {anio}
          </div>
          <div className="mt-1 truncate text-[13px] font-semibold text-white" title={delitoNombre}>
            {delitoNombre}
          </div>
          <div className="mt-1 text-[11.5px] text-emerald-300/80 num">
            {totalConurbano.toLocaleString("es-AR")} {metric === "tasa" ? "(total hechos)" : "hechos totales"}
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{
            background: "linear-gradient(90deg, #004e3b 0%, #009767 20%, #00bb7f 50%, #edb200 80%, #ef4444 100%)",
          }} />
          <div className="mt-1 flex justify-between text-[10px] text-emerald-300/70 num">
            <span>bajo</span>
            <span>medio</span>
            <span>alto</span>
          </div>
          <div className="mt-3 border-t border-emerald-900/40 pt-2 text-[10.5px] leading-snug text-emerald-300/70">
            Altura = valor del partido × peso urbano (gradiente de densidad GBA).
            Suma de hexes por partido = total SNIC.
          </div>
        </div>

        {/* HoverCard — persistente si hay partido seleccionado */}
        {focusPid && dataset && (
          <HoverInfo
            pid={focusPid}
            pinned={!!municipioSel && focusPid === municipioSel}
            dataset={dataset}
            delitoId={delitoId}
            anio={anio}
            metric={metric}
          />
        )}

        {/* Botones inferior derecha */}
        <div className="absolute bottom-4 right-4 flex gap-2">
          {municipioSel && (
            <button
              onClick={() => setMunicipio(null)}
              className="rounded-md border border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-500/30 hover:text-white"
            >
              ✕ Limpiar selección
            </button>
          )}
          <button
            onClick={resetView}
            className="rounded-md border border-emerald-900/40 bg-[#0a1220]/90 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-900/50 hover:text-white"
          >
            ↺ Reset vista
          </button>
        </div>

        {/* Instructivo */}
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-[420px] rounded-md border border-emerald-900/40 bg-[#0a1220]/90 px-3 py-1.5 text-[10.5px] leading-relaxed text-emerald-300/80">
          <strong className="text-emerald-200">Click</strong>: fijar partido · <strong className="text-emerald-200">Pan</strong>: arrastrar · <strong className="text-emerald-200">Zoom</strong>: rueda · <strong className="text-emerald-200">Rotar</strong>: click derecho · <strong className="text-emerald-200">Inclinar</strong>: Ctrl + arrastrar
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-3">
        <strong>Lectura:</strong> cada bloque cubre ~2,5 km² del territorio y se recorta exactamente
        al límite municipal. La <strong>altura</strong> es proporcional al valor del delito en el
        partido, <em> ponderada</em> por un gradiente de densidad urbana del GBA (decaimiento
        exponencial con la distancia a CABA). El bloque-pico de cada partido (su núcleo urbano)
        alcanza el <strong>valor total del partido</strong>; los bloques periféricos se reducen
        proporcionalmente. Así los partidos con más delitos se elevan claramente en rojo.
      </p>
    </div>
  );
}

/* ====================  Helpers  ==================== */

function useMemoTotal(dataset: Dataset | null, delitoId: string, anio: number) {
  return useMemo(() => {
    if (!dataset) return 0;
    const di = dataset.delitos.findIndex((d) => d.id === delitoId);
    const ai = dataset.anios.indexOf(anio);
    if (di < 0 || ai < 0) return 0;
    return dataset.partidos.reduce((s, _p, pi) => s + (dataset.hechos[pi][di][ai] ?? 0), 0);
  }, [dataset, delitoId, anio]);
}

/** Suma agregada de TODOS los delitos para un año (todas las categorías SNIC × 24 partidos). */
function useMemoTotalAllDelitos(dataset: Dataset | null, anio: number) {
  return useMemo(() => {
    if (!dataset) return 0;
    const ai = dataset.anios.indexOf(anio);
    if (ai < 0) return 0;
    let total = 0;
    for (let pi = 0; pi < dataset.partidos.length; pi++) {
      for (let di = 0; di < dataset.delitos.length; di++) {
        total += dataset.hechos[pi][di][ai] ?? 0;
      }
    }
    return total;
  }, [dataset, anio]);
}

function HoverInfo({
  pid, pinned, dataset, delitoId, anio, metric,
}: {
  pid: string;
  pinned: boolean;
  dataset: Dataset;
  delitoId: string;
  anio: number;
  metric: Metric;
}) {
  const partido = dataset.partidos.find((p) => p.id === pid);
  if (!partido) return null;
  const pi = dataset.partidos.findIndex((p) => p.id === pid);
  const ai = dataset.anios.indexOf(anio);
  if (pi < 0 || ai < 0) return null;

  const isAll = delitoId === "all";
  const di = isAll ? -1 : dataset.delitos.findIndex((d) => d.id === delitoId);
  if (!isAll && di < 0) return null;

  let val = 0;
  if (isAll) {
    for (let d = 0; d < dataset.delitos.length; d++) {
      val += metric === "tasa" ? tasaDelito(dataset, pi, d, ai) : hechosDelito(dataset, pi, d, ai);
    }
  } else {
    val = metric === "tasa" ? tasaDelito(dataset, pi, di, ai) : hechosDelito(dataset, pi, di, ai);
  }

  const labelDelito = isAll ? "Todos los delitos" : dataset.delitos[di]?.nombre;
  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: metric === "tasa" ? 1 : 0 });
  const unidad = metric === "tasa" ? " /100k" : " hechos";

  return (
    <div className={
      "pointer-events-none absolute right-4 top-4 w-[230px] rounded-lg border bg-[#0a1220]/92 p-3 shadow-float backdrop-blur " +
      (pinned ? "border-emerald-400/70 ring-1 ring-emerald-400/30" : "border-emerald-900/40")
    }>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
        {pinned ? "Partido seleccionado" : "Partido"}
      </div>
      <div className="mt-0.5 text-[14px] font-semibold text-white">{partido.nombre}</div>
      <div className="mt-2 text-[11px] text-emerald-300/70">
        {labelDelito} · {anio}
      </div>
      <div className="mt-1 text-[17px] font-semibold text-white num">
        {fmt(val)}<span className="text-[11px] text-emerald-300/70">{unidad}</span>
      </div>
    </div>
  );
}

/** Construye una grilla técnica tenue cada 0.05° (~5.5 km) sobre el bbox del Conurbano. */
function buildTechGrid(): GeoJSON.FeatureCollection {
  const minX = -59.3, maxX = -57.6, minY = -35.25, maxY = -34.0, step = 0.05;
  const features: GeoJSON.Feature[] = [];
  for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [[x, minY], [x, maxY]] },
    });
  }
  for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [[minX, y], [maxX, y]] },
    });
  }
  return { type: "FeatureCollection", features };
}
