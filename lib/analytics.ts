import type { Dataset } from "./types";

/** Suma los hechos de todos los delitos para un (partido, año). */
export function totalHechos(ds: Dataset, partidoIdx: number, anioIdx: number): number {
  if (anioIdx < 0 || partidoIdx < 0) return 0;
  let s = 0;
  for (let d = 0; d < ds.delitos.length; d++) s += ds.hechos[partidoIdx][d][anioIdx] ?? 0;
  return s;
}

/** Total de hechos por partido (array alineado con ds.partidos). */
export function totalesPorPartido(ds: Dataset, anioIdx: number): number[] {
  return ds.partidos.map((_, pi) => totalHechos(ds, pi, anioIdx));
}

/** Hechos para un delito puntual. */
export function hechosDelito(ds: Dataset, partidoIdx: number, delitoIdx: number, anioIdx: number): number {
  if (anioIdx < 0 || delitoIdx < 0) return 0;
  return ds.hechos[partidoIdx][delitoIdx][anioIdx] ?? 0;
}

/** Tasa para un delito puntual. */
export function tasaDelito(ds: Dataset, partidoIdx: number, delitoIdx: number, anioIdx: number): number {
  if (anioIdx < 0 || delitoIdx < 0) return 0;
  return ds.tasa[partidoIdx][delitoIdx][anioIdx] ?? 0;
}

/** Variación interanual (%). Devuelve null si no hay base comparable. */
export function yoyChange(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  if (prev <= 0) return null;
  return ((curr - prev) / prev) * 100;
}

/** Variación contra promedio de los `windowYears` años previos. */
export function changeVsWindow(
  series: number[],
  anioIdx: number,
  windowYears = 5
): { pct: number | null; base: number; curr: number } {
  const curr = series[anioIdx] ?? 0;
  const from = Math.max(0, anioIdx - windowYears);
  const slice = series.slice(from, anioIdx);
  const nz = slice.filter((v) => v > 0);
  if (nz.length === 0) return { pct: null, base: 0, curr };
  const base = nz.reduce((a, b) => a + b, 0) / nz.length;
  if (base <= 0) return { pct: null, base, curr };
  return { pct: ((curr - base) / base) * 100, base, curr };
}

/** Serie temporal de totales para un partido. */
export function serieTotales(ds: Dataset, partidoIdx: number): number[] {
  return ds.anios.map((_, ai) => totalHechos(ds, partidoIdx, ai));
}

/**
 * Desglose de víctimas por género del Conurbano para (delito, año).
 * Si `delitoId === "total"`: agrega todos los delitos.
 * Retorna valores absolutos; `coverage` indica si la categoría tiene datos
 * de género registrados en el SNIC (robos/hurtos/amenazas no los tienen).
 */
export function generoVictimas(
  ds: Dataset,
  delitoId: string | "total",
  anioIdx: number
): { masc: number; fem: number; sd: number; total: number; coverage: boolean } {
  if (anioIdx < 0) return { masc: 0, fem: 0, sd: 0, total: 0, coverage: false };
  let m = 0, f = 0, sd = 0;
  const agg = (di: number) => {
    for (let pi = 0; pi < ds.partidos.length; pi++) {
      m += ds.victimas_masc[pi][di][anioIdx] ?? 0;
      f += ds.victimas_fem[pi][di][anioIdx] ?? 0;
      sd += ds.victimas_sd[pi][di][anioIdx] ?? 0;
    }
  };
  if (delitoId === "total") {
    for (let di = 0; di < ds.delitos.length; di++) agg(di);
  } else {
    const di = ds.delitos.findIndex((d) => d.id === delitoId);
    if (di < 0) return { masc: 0, fem: 0, sd: 0, total: 0, coverage: false };
    agg(di);
  }
  const total = m + f + sd;
  return { masc: m, fem: f, sd, total, coverage: total > 0 };
}

/**
 * Serie anual del Conurbano para un delito específico (o total).
 * Suma los hechos de los 24 partidos por año.
 */
export function serieConurbanoDelito(
  ds: Dataset,
  delitoId: string | "total",
  fromYear = 2014
): { anio: number; valor: number }[] {
  const out: { anio: number; valor: number }[] = [];
  const di = delitoId === "total" ? -1 : ds.delitos.findIndex((d) => d.id === delitoId);
  if (delitoId !== "total" && di < 0) return [];
  ds.anios.forEach((a, ai) => {
    if (a < fromYear) return;
    let s = 0;
    for (let pi = 0; pi < ds.partidos.length; pi++) {
      if (di < 0) {
        for (let d = 0; d < ds.delitos.length; d++) s += ds.hechos[pi][d][ai] ?? 0;
      } else {
        s += ds.hechos[pi][di][ai] ?? 0;
      }
    }
    out.push({ anio: a, valor: s });
  });
  return out;
}

/** Composición top N delitos para un (partido, año). */
export function composicionPartido(
  ds: Dataset,
  partidoIdx: number,
  anioIdx: number,
  topN = 6
): { id: string; nombre: string; valor: number; pct: number }[] {
  if (partidoIdx < 0 || anioIdx < 0) return [];
  const total = totalHechos(ds, partidoIdx, anioIdx);
  if (total === 0) return [];
  const rows = ds.delitos.map((d, di) => ({
    id: d.id,
    nombre: d.nombre,
    valor: ds.hechos[partidoIdx][di][anioIdx] ?? 0,
    pct: 0,
  }));
  rows.forEach((r) => { r.pct = (r.valor / total) * 100; });
  return rows
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, topN);
}

/** Distribución estadística (min, max, mediana, p25, p75) de un array. */
export function distribucion(values: number[]): {
  min: number; p25: number; mediana: number; p75: number; max: number; media: number;
} {
  const v = [...values].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return { min: 0, p25: 0, mediana: 0, p75: 0, max: 0, media: 0 };
  const q = (p: number) => {
    const idx = (v.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return v[lo];
    const h = idx - lo;
    return v[lo] * (1 - h) + v[hi] * h;
  };
  return {
    min: v[0],
    p25: q(0.25),
    mediana: q(0.5),
    p75: q(0.75),
    max: v[v.length - 1],
    media: v.reduce((a, b) => a + b, 0) / v.length,
  };
}

/** Cuántos partidos subieron / bajaron respecto al año anterior. */
export function balanceInteranual(
  ds: Dataset,
  anioIdx: number
): { suben: number; bajan: number; estables: number } {
  if (anioIdx <= 0) return { suben: 0, bajan: 0, estables: 0 };
  let suben = 0, bajan = 0, estables = 0;
  ds.partidos.forEach((_, pi) => {
    const c = totalHechos(ds, pi, anioIdx);
    const p = totalHechos(ds, pi, anioIdx - 1);
    if (p === 0) { estables++; return; }
    const d = ((c - p) / p) * 100;
    if (Math.abs(d) < 1) estables++;
    else if (d > 0) suben++;
    else bajan++;
  });
  return { suben, bajan, estables };
}

/** Delito con mayor volumen agregado del Conurbano en un año. */
export function delitoMasFrecuente(
  ds: Dataset,
  anioIdx: number
): { nombre: string; valor: number; pct: number } | null {
  if (anioIdx < 0) return null;
  let mejor: { idx: number; valor: number } | null = null;
  let total = 0;
  for (let di = 0; di < ds.delitos.length; di++) {
    let s = 0;
    for (let pi = 0; pi < ds.partidos.length; pi++) s += ds.hechos[pi][di][anioIdx] ?? 0;
    total += s;
    if (!mejor || s > mejor.valor) mejor = { idx: di, valor: s };
  }
  if (!mejor || total === 0) return null;
  return {
    nombre: ds.delitos[mejor.idx].nombre,
    valor: mejor.valor,
    pct: (mejor.valor / total) * 100,
  };
}

/** Ratio violencia contra personas / delitos contra la propiedad. */
export function ratioViolenciaPropiedad(ds: Dataset, anioIdx: number): {
  violencia: number;
  propiedad: number;
  ratio: number;
} {
  const personas = ["1", "2", "5", "7", "13"]; // homicidios, tentativas, lesiones dolosas, lesiones culposas, amenazas
  const propiedad = ["15", "16", "17", "18", "19", "20", "21"]; // robos, hurtos, otros propiedad
  let v = 0, p = 0;
  ds.delitos.forEach((d, di) => {
    const s = ds.partidos.reduce((a, _pa, pi) => a + (ds.hechos[pi][di][anioIdx] ?? 0), 0);
    if (personas.includes(d.id)) v += s;
    if (propiedad.includes(d.id)) p += s;
  });
  return { violencia: v, propiedad: p, ratio: p > 0 ? v / p : 0 };
}

/** Texto narrativo corto sobre la proyección para un partido. */
export function projeccionTexto(opts: {
  nombre: string;
  yoy: number | null;
  vsPromedio: number | null;
}): string {
  const { nombre, yoy, vsPromedio } = opts;
  if (yoy === null && vsPromedio === null) {
    return `No hay datos suficientes para estimar la variación en ${nombre}.`;
  }
  const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  const verbo = (n: number) => (n >= 0 ? "aumentó" : "se redujo");
  const abs = (n: number) => Math.abs(n).toFixed(1);
  if (yoy !== null && vsPromedio !== null) {
    return `En ${nombre} los delitos ${verbo(yoy)} ${abs(yoy)}% respecto al año anterior (${fmt(
      vsPromedio
    )} vs. el promedio de los últimos 5 años).`;
  }
  if (yoy !== null) {
    return `En ${nombre} los delitos ${verbo(yoy)} ${abs(yoy)}% respecto al año anterior.`;
  }
  return `En ${nombre} la variación contra el promedio 5-años es ${fmt(vsPromedio as number)}.`;
}
