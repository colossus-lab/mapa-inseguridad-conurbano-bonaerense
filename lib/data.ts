import type { Dataset } from "./types";

/**
 * Cache-buster: cambia en cada rebuild del ETL (según meta.generado del JSON).
 * Fuerza al browser a pedir geojson fresco cuando cambia el shape de datos/geometrías.
 */
let cachedDataset: Dataset | null = null;

export async function loadDataset(): Promise<Dataset> {
  if (cachedDataset) return cachedDataset;
  const res = await fetch("/data/conurbano.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`No pude cargar dataset: ${res.status}`);
  cachedDataset = await res.json();
  return cachedDataset!;
}

export async function loadGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  const ds = await loadDataset();
  const v = encodeURIComponent(ds.meta.generado);
  const res = await fetch(`/data/conurbano.geojson?v=${v}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`No pude cargar geojson: ${res.status}`);
  return res.json();
}
