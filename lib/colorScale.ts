import { scaleQuantile } from "d3-scale";

/**
 * Paleta sequential institucional Colossus: cream → amber → red.
 * Asegura legibilidad sobre fondo papel y armoniza con el theme.
 */
const PALETTE = ["#f3f0ea", "#f2e1b8", "#edb200", "#e66a00", "#ef4444"];

export function buildChoroplethScale(values: number[]) {
  const positive = values.filter((v) => Number.isFinite(v) && v > 0);
  if (positive.length === 0) {
    return {
      stops: [[0, "#f3f0ea"] as [number, string]],
      legend: [["sin datos", "#f3f0ea"] as [string, string]],
      max: 0,
    };
  }
  const N_BINS = 5;
  const scale = scaleQuantile<string>().domain(positive).range(PALETTE);
  const quantiles = [0, ...scale.quantiles()];
  const stops: [number, string][] = quantiles.map((q, i) => [
    q,
    PALETTE[Math.min(i, N_BINS - 1)],
  ]);
  const legend: [string, string][] = [];
  for (let i = 0; i < N_BINS; i++) {
    const lo = quantiles[i];
    const hi = i + 1 < quantiles.length ? quantiles[i + 1] : Math.max(...positive);
    legend.push([`${fmt(lo)} – ${fmt(hi)}`, PALETTE[i]]);
  }
  return { stops, legend, max: Math.max(...positive) };
}

function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(0);
  return n.toFixed(1);
}
