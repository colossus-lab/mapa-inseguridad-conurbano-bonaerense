// Filtra el GeoJSON de partidos de Buenos Aires (IGN) a los 24 del Conurbano
// y reduce precisión de coordenadas para achicar tamaño.

import fs from "node:fs";
import path from "node:path";

const IN = path.join(process.cwd(), "scripts", "tmp", "ign_ba.json");
const OUT_DIR = path.join(process.cwd(), "public", "data");
const OUT = path.join(OUT_DIR, "conurbano.geojson");

const IDS_24 = new Set([
  "06028","06035","06091","06260","06270","06274","06371","06408",
  "06410","06412","06427","06434","06490","06515","06539","06560",
  "06568","06658","06749","06756","06760","06805","06840","06861",
]);

// Redondeo a 4 decimales ≈ 11m de precisión, suficiente para coropleta regional.
const DEC = 4;
const round = (n) => +n.toFixed(DEC);
function roundCoords(coords) {
  if (typeof coords[0] === "number") return [round(coords[0]), round(coords[1])];
  return coords.map(roundCoords);
}

/**
 * Algunos partidos del INDEC incluyen jurisdicción sobre las islas del
 * Delta del Paraná, muy al norte del área urbana del Conurbano. Para que
 * el mapa se lea como "mapa del Conurbano", filtramos los polígonos cuya
 * latitud mínima queda al norte de `LAT_CUTOFF`. El dato de SNIC se sigue
 * atribuyendo al partido; solo cambia la representación visual.
 */
const LAT_CUTOFF = -34.4;
const PARTIDOS_CLIP_DELTA = new Set(["06749"]); // San Fernando
function minLat(coords) {
  if (typeof coords[0] === "number") return coords[1];
  return coords.reduce((m, c) => Math.min(m, minLat(c)), Infinity);
}
function clipDeltaMultiPolygon(geometry) {
  if (geometry.type !== "MultiPolygon") return geometry;
  const parts = geometry.coordinates.filter((poly) => minLat(poly[0]) < LAT_CUTOFF);
  if (parts.length === 0) return geometry;
  if (parts.length === 1) {
    return { type: "Polygon", coordinates: parts[0] };
  }
  return { type: "MultiPolygon", coordinates: parts };
}

/**
 * Centroide tipo "polygon of largest ring" aproximado: promedio ponderado por
 * longitud de todos los vértices. Suficiente para anclar un label visual.
 */
function approxCentroid(coords) {
  let sumX = 0, sumY = 0, n = 0;
  const walk = (c) => {
    if (typeof c[0] === "number") { sumX += c[0]; sumY += c[1]; n += 1; return; }
    c.forEach(walk);
  };
  walk(coords);
  return n > 0 ? [+(sumX / n).toFixed(4), +(sumY / n).toFixed(4)] : null;
}

// Ajustes manuales para nombres que caerían en esquinas raras por forma irregular.
const CENTROID_OVERRIDE = {
  "06805": [-58.585, -34.425], // Tigre: mover al núcleo urbano continental
  "06749": [-58.555, -34.455], // San Fernando: centro de la franja
};

function main() {
  const fc = JSON.parse(fs.readFileSync(IN, "utf8"));
  const feats = fc.features
    .filter((f) => IDS_24.has(f.properties.in1))
    .map((f) => {
      let geometry = f.geometry;
      if (PARTIDOS_CLIP_DELTA.has(f.properties.in1)) {
        geometry = clipDeltaMultiPolygon(geometry);
      }
      const rounded = roundCoords(geometry.coordinates);
      const override = CENTROID_OVERRIDE[f.properties.in1];
      const centroid = override ?? approxCentroid(rounded);
      return {
        type: "Feature",
        properties: {
          departamento_id: f.properties.in1,
          nombre: f.properties.nam,
          centroid,
        },
        geometry: {
          type: geometry.type,
          coordinates: rounded,
        },
      };
    });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = { type: "FeatureCollection", features: feats };
  fs.writeFileSync(OUT, JSON.stringify(out));
  const sizeKb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`✓ ${OUT} — ${feats.length} partidos — ${sizeKb} KB`);
  const missing = [...IDS_24].filter((id) => !feats.some((f) => f.properties.departamento_id === id));
  if (missing.length) console.warn("⚠ faltan ids:", missing);
}

main();
