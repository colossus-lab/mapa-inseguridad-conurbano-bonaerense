"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Source,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import { buildChoroplethScale } from "@/lib/colorScale";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

export type ChoroplethProps = {
  geo: GeoJSON.FeatureCollection | null;
  /** Valor por partido, indexado por `departamento_id`. */
  values: Record<string, number>;
  /** Selección simple (se usa si `selectedIds` no está presente). */
  selectedId?: string | null;
  /** Selección múltiple; cuando se provee reemplaza a `selectedId`. */
  selectedIds?: string[];
  onSelect?: (id: string | null) => void;
  /** Render custom del hover card (sobre el mapa). Si se omite usa el default. */
  renderHover?: (partidoId: string, nombre: string, value: number) => React.ReactNode;
  legendTitle: string;
  legendSubtitle?: string;
  /** Formateador del valor numérico en la leyenda. */
  valueFormat?: (n: number) => string;
  /** Clase extra para el wrapper (default: full height). */
  className?: string;
};

export default function Choropleth({
  geo,
  values,
  selectedId,
  selectedIds,
  onSelect,
  renderHover,
  legendTitle,
  legendSubtitle,
  valueFormat,
  className = "h-full w-full",
}: ChoroplethProps) {
  const selSet = useMemo(() => {
    const arr = selectedIds ?? (selectedId ? [selectedId] : []);
    return arr.filter(Boolean);
  }, [selectedIds, selectedId]);
  const mapRef = useRef<MapRef | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Resize defensivo — el contenedor puede cambiar de tamaño tras el mount.
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const tick = () => {
      const map = mapRef.current?.getMap();
      const canvas = el.querySelector("canvas") as HTMLCanvasElement | null;
      const parentW = el.clientWidth;
      if (map && canvas && parentW > 0 && Math.abs(canvas.clientWidth - parentW) > 2) {
        map.resize();
      }
    };
    const obs = new ResizeObserver(tick);
    obs.observe(el);
    const iv = setInterval(tick, 250);
    const stop = setTimeout(() => clearInterval(iv), 4000);
    return () => { obs.disconnect(); clearInterval(iv); clearTimeout(stop); };
  }, [geo]);

  const { geoWithValue, scale } = useMemo(() => {
    if (!geo) return { geoWithValue: null, scale: null };
    const nums: number[] = [];
    const features = geo.features.map((f) => {
      const id = (f.properties?.departamento_id as string) ?? "";
      const v = values[id] ?? 0;
      nums.push(v);
      return { ...f, id, properties: { ...f.properties, value: v } };
    });
    return {
      geoWithValue: { type: "FeatureCollection", features } as GeoJSON.FeatureCollection,
      scale: buildChoroplethScale(nums),
    };
  }, [geo, values]);

  const fillColor = useMemo(() => {
    if (!scale) return "#f3f0ea";
    if (scale.stops.length === 1) return scale.stops[0][1];
    const expr: (string | number | unknown[])[] = ["interpolate", ["linear"], ["get", "value"]];
    scale.stops.forEach(([v, c]) => { expr.push(v, c); });
    return expr as unknown as string;
  }, [scale]);

  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) { onSelect?.(null); return; }
    onSelect?.((f.properties?.departamento_id as string) ?? null);
  };

  const onHover = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    setHoverId(f ? ((f.properties?.departamento_id as string) ?? null) : null);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -58.55, latitude: -34.65, zoom: 9.1 }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={["partidos-fill"]}
        onClick={onClick}
        onMouseMove={onHover}
        onMouseLeave={() => setHoverId(null)}
        // Acotamos la navegación al Conurbano: no hay razón para dejar panear
        // al usuario a otras regiones del mundo (y así evitamos también la etiqueta
        // "Falkland Islands" del basemap de OpenFreeMap).
        maxBounds={[[-59.3, -35.25], [-57.6, -34.0]]}
        minZoom={8.5}
        maxZoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        {geoWithValue && (
          <Source id="partidos" type="geojson" data={geoWithValue} promoteId="departamento_id">
            <Layer
              id="partidos-fill"
              type="fill"
              paint={{ "fill-color": fillColor as never, "fill-opacity": 0.82 }}
            />
            <Layer
              id="partidos-line"
              type="line"
              paint={{
                "line-color": [
                  "case",
                  ["in", ["get", "departamento_id"], ["literal", selSet]], "#00bb7f",
                  "#101215",
                ],
                "line-width": [
                  "case",
                  ["in", ["get", "departamento_id"], ["literal", selSet]], 2.5,
                  ["==", ["get", "departamento_id"], hoverId ?? ""], 1.6,
                  0.6,
                ],
              }}
            />
          </Source>
        )}

      </Map>

      <HoverCard
        geo={geoWithValue}
        id={hoverId}
        render={renderHover}
        fallbackFormat={valueFormat}
      />
      <Leyenda scale={scale} title={legendTitle} subtitle={legendSubtitle} />
    </div>
  );
}

function Leyenda({
  scale,
  title,
  subtitle,
}: {
  scale: ReturnType<typeof buildChoroplethScale> | null;
  title: string;
  subtitle?: string;
}) {
  if (!scale || scale.legend.length === 0) return null;
  return (
    <div className="absolute bottom-3 left-3 w-[230px] rounded-lg border border-line bg-white/95 p-3 shadow-float backdrop-blur">
      <div className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {title}
      </div>
      {subtitle && (
        <div className="mb-2 truncate text-[12px] font-semibold text-ink" title={subtitle}>
          {subtitle}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {scale.legend.map(([label, color]) => (
          <div key={label} className="flex items-center gap-2 text-[11.5px] text-ink-2 num">
            <span className="inline-block h-3 w-6 rounded-sm" style={{ background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoverCard({
  geo,
  id,
  render,
  fallbackFormat,
}: {
  geo: GeoJSON.FeatureCollection | null;
  id: string | null;
  render?: (partidoId: string, nombre: string, value: number) => React.ReactNode;
  fallbackFormat?: (n: number) => string;
}) {
  if (!geo || !id) return null;
  const f = geo.features.find((x) => x.properties?.departamento_id === id);
  if (!f) return null;
  const nombre = (f.properties?.nombre as string) ?? "";
  const value = Number(f.properties?.value ?? 0);

  const content = render ? render(id, nombre, value) : (
    <>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">Partido</div>
      <div className="mt-0.5 text-[14px] font-semibold text-ink">{nombre}</div>
      <div className="mt-1.5 text-[12px] text-ink-3">
        <span className="text-[14px] font-semibold text-ink num">
          {fallbackFormat ? fallbackFormat(value) : value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
        </span>
      </div>
    </>
  );

  return (
    <div className="pointer-events-none absolute right-3 top-3 w-[290px] max-w-[calc(100%-1.5rem)] rounded-lg border border-line bg-white/96 p-3.5 shadow-float backdrop-blur">
      {content}
    </div>
  );
}
