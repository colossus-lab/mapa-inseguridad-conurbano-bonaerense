// Genera una grilla CUADRADA continua sobre el bbox de los 24 partidos del Conurbano.
// Cada celda se mantiene COMPLETA (no se recorta a la jurisdicción) para evitar
// cortes perpendiculares visibles en los bordes municipales. La pertenencia a un
// partido se determina por el centroide de la celda (`booleanPointInPolygon`).
//
// Propiedades por feature: { departamento_id, weight, row, col }
// - weight = exp(-dist_a_CABA_km / DECAY)  [0..1] sin normalizar
//   → refleja gradiente de densidad urbana real del GBA
// - row / col  → posición en la grilla regular (para vecindad 3×3 en runtime)
//
// El suavizado entre partidos se hace en el componente mediante un box-blur
// sobre los valores. Las fronteras municipales siguen siendo visibles gracias
// a la capa de outlines emerald que se dibuja por encima.

import fs from "node:fs";
import path from "node:path";
import * as turf from "@turf/turf";

const IN_GEOJSON = path.join(process.cwd(), "public", "data", "conurbano.geojson");
const OUT = path.join(process.cwd(), "public", "data", "conurbano-hexgrid.geojson");

const CABA_CENTER = [-58.438, -34.605];
const DECAY_KM = 14;
const CELL_KM = 0.3;
const DEC = 4;

function round(n) { return +n.toFixed(DEC); }
function roundCoords(c) {
  if (typeof c[0] === "number") return [round(c[0]), round(c[1])];
  return c.map(roundCoords);
}

function main() {
  const partidosFc = JSON.parse(fs.readFileSync(IN_GEOJSON, "utf8"));
  const partidos = partidosFc.features;
  const cabaPoint = turf.point(CABA_CENTER);

  // bbox global de los 24 partidos
  const bbox = turf.bbox(partidosFc);
  const pad = 0.005;
  const bboxPad = [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad];
  const cells = turf.squareGrid(bboxPad, CELL_KM, { units: "kilometers" });

  // Para calcular row/col estables, necesitamos los centroides redondeados a
  // la resolución de la grilla. Tomamos el origen (minLon, minLat) y paso en grados.
  // Paso de turf.squareGrid es uniforme en km pero varía en grados según latitud.
  // Extraemos la rejilla: primera celda → origen; luego conteo por columnas.
  const originLon = bboxPad[0];
  const originLat = bboxPad[1];
  // Aproximamos paso a partir de las primeras dos celdas consecutivas
  let stepLon = 0, stepLat = 0;
  if (cells.features.length >= 2) {
    const c0 = turf.centroid(cells.features[0]).geometry.coordinates;
    for (let i = 1; i < cells.features.length; i++) {
      const ci = turf.centroid(cells.features[i]).geometry.coordinates;
      const dx = Math.abs(ci[0] - c0[0]);
      const dy = Math.abs(ci[1] - c0[1]);
      if (dx > 1e-5 && stepLon === 0) stepLon = dx;
      if (dy > 1e-5 && stepLat === 0) stepLat = dy;
      if (stepLon && stepLat) break;
    }
  }

  const perPartido = new Map();
  const out = [];

  cells.features.forEach((cell) => {
    const centroid = turf.centroid(cell);
    const [lon, lat] = centroid.geometry.coordinates;
    const partido = partidos.find((p) => turf.booleanPointInPolygon(centroid, p));
    if (!partido) return; // descartar celdas fuera de todos los partidos (río, etc.)
    const pid = partido.properties.departamento_id;

    const distKm = turf.distance(cabaPoint, centroid, { units: "kilometers" });
    const weight = Math.exp(-distKm / DECAY_KM);

    const col = Math.round((lon - (originLon + stepLon / 2)) / stepLon);
    const row = Math.round((lat - (originLat + stepLat / 2)) / stepLat);

    cell.properties = {
      departamento_id: pid,
      weight: +weight.toFixed(5),
      row,
      col,
    };
    cell.geometry.coordinates = roundCoords(cell.geometry.coordinates);
    cell.id = out.length;
    out.push(cell);
    perPartido.set(pid, (perPartido.get(pid) ?? 0) + 1);
  });

  const fc = { type: "FeatureCollection", features: out };
  fs.writeFileSync(OUT, JSON.stringify(fc));
  const sizeKb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`✓ ${OUT} — ${out.length} celdas de ${CELL_KM} km (sin clip) · ${sizeKb} KB`);
  console.log(`  paso grilla: ${stepLon.toFixed(5)}° lon × ${stepLat.toFixed(5)}° lat`);
  perPartido.forEach((count, pid) => {
    const p = partidos.find((x) => x.properties.departamento_id === pid);
    console.log(`  ${pid} ${p.properties.nombre.padEnd(22)} → ${String(count).padStart(4)} celdas`);
  });
}

main();
