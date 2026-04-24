import type { Dataset } from "./types";
import { hechosDelito, tasaDelito, totalHechos } from "./analytics";

/**
 * Payload precomputado para las escenas del scrollytelling.
 * Todo se deriva del dataset SNIC ya cargado en el cliente — sin fetches extra.
 */
export type StorySceneKey =
  | "escala"
  | "veinticincoAnios"
  | "concentracion"
  | "paradoja"
  | "composicion"
  | "ganadoresPerdedores";

export type StoryData = {
  escala: {
    totalUltimo: number;
    anioUltimo: number;
    partidos: number;
    delitos: number;
    valoresPorPartido: Record<string, number>;
  };
  serieTotales: { anio: number; valor: number }[];
  concentracion: {
    anio: number;
    rows: { id: string; nombre: string; valor: number; pct: number }[];
    top3Pct: number;
    total: number;
  };
  homicidios: {
    tasaConurbano: { anio: number; valor: number }[];
    tasa2000: number;
    tasaUltimo: number;
    deltaPct: number;
    totalUltimo: number;
    delta2000vsUltimo: number;
  };
  composicion: {
    delitosTop: {
      nombre: string;
      id: string;
      total2000: number;
      totalUltimo: number;
      deltaPct: number | null;
    }[];
  };
  cambioHomicidios: {
    anioBase: number;
    anioUltimo: number;
    rows: { id: string; nombre: string; tBase: number; tUltimo: number; deltaPct: number | null }[];
    valoresPorPartido: Record<string, number>; // delta %, 0 si null — para colorear mapa
  };
};

export function buildStoryData(ds: Dataset): StoryData {
  const nA = ds.anios.length;
  const iUltimo = nA - 1;
  const anioUltimo = ds.anios[iUltimo];
  const i15 = ds.anios.indexOf(2015);
  const iHom = ds.delitos.findIndex((d) => d.id === "1");

  // Escala — totales por partido último año
  const valoresPorPartido: Record<string, number> = {};
  let totalUltimo = 0;
  ds.partidos.forEach((p, pi) => {
    const t = totalHechos(ds, pi, iUltimo);
    valoresPorPartido[p.id] = t;
    totalUltimo += t;
  });

  // Serie total Conurbano
  const serieTotales = ds.anios.map((a, ai) => {
    let s = 0;
    for (let pi = 0; pi < ds.partidos.length; pi++) s += totalHechos(ds, pi, ai);
    return { anio: a, valor: s };
  });

  // Concentración territorial último año
  const rowsConc = ds.partidos
    .map((p, pi) => ({ id: p.id, nombre: p.nombre, valor: totalHechos(ds, pi, iUltimo), pct: 0 }))
    .sort((a, b) => b.valor - a.valor);
  const sumConc = rowsConc.reduce((a, r) => a + r.valor, 0);
  rowsConc.forEach((r) => { r.pct = (r.valor / sumConc) * 100; });
  const top3Pct = rowsConc.slice(0, 3).reduce((a, r) => a + r.pct, 0);

  // Homicidios — tasa Conurbano
  const tasaConurbano = ds.anios.map((a, ai) => {
    const vals = ds.partidos.map((_, pi) => tasaDelito(ds, pi, iHom, ai)).filter((v) => v > 0);
    return { anio: a, valor: vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0 };
  });
  const totalUltimoHom = ds.partidos.reduce((s, _p, pi) => s + hechosDelito(ds, pi, iHom, iUltimo), 0);
  const total2000Hom = ds.partidos.reduce((s, _p, pi) => s + hechosDelito(ds, pi, iHom, 0), 0);
  const deltaPct =
    tasaConurbano[0].valor > 0
      ? ((tasaConurbano[iUltimo].valor - tasaConurbano[0].valor) / tasaConurbano[0].valor) * 100
      : 0;

  // Composición: top categorías por cambio relativo (con mínimos de escala).
  const delitosCalc = ds.delitos.map((d, di) => {
    const t00 = ds.partidos.reduce((s, _p, pi) => s + hechosDelito(ds, pi, di, 0), 0);
    const tU = ds.partidos.reduce((s, _p, pi) => s + hechosDelito(ds, pi, di, iUltimo), 0);
    const chg = t00 > 0 ? ((tU - t00) / t00) * 100 : null;
    return { nombre: d.nombre, id: d.id, total2000: t00, totalUltimo: tU, deltaPct: chg };
  });
  // Tomamos 8 categorías con mayor relevancia: combina volumen último año + cambio significativo.
  const delitosTop = delitosCalc
    .filter((d) => d.totalUltimo >= 500 && d.deltaPct !== null)
    .sort((a, b) => (b.totalUltimo ?? 0) - (a.totalUltimo ?? 0))
    .slice(0, 8);

  // Cambio homicidios por partido 2015 → último
  const anioBase = i15 >= 0 ? ds.anios[i15] : ds.anios[0];
  const iBase = i15 >= 0 ? i15 : 0;
  const cambioRows = ds.partidos
    .map((p, pi) => {
      const tB = tasaDelito(ds, pi, iHom, iBase);
      const tU = tasaDelito(ds, pi, iHom, iUltimo);
      const d = tB > 0 ? ((tU - tB) / tB) * 100 : null;
      return { id: p.id, nombre: p.nombre, tBase: tB, tUltimo: tU, deltaPct: d };
    })
    .sort((a, b) => (a.deltaPct ?? 0) - (b.deltaPct ?? 0));
  const valoresCambio: Record<string, number> = {};
  cambioRows.forEach((r) => { valoresCambio[r.id] = r.deltaPct ?? 0; });

  return {
    escala: {
      totalUltimo,
      anioUltimo,
      partidos: ds.partidos.length,
      delitos: ds.delitos.length,
      valoresPorPartido,
    },
    serieTotales,
    concentracion: { anio: anioUltimo, rows: rowsConc, top3Pct, total: sumConc },
    homicidios: {
      tasaConurbano,
      tasa2000: tasaConurbano[0].valor,
      tasaUltimo: tasaConurbano[iUltimo].valor,
      deltaPct,
      totalUltimo: totalUltimoHom,
      delta2000vsUltimo: total2000Hom > 0 ? ((totalUltimoHom - total2000Hom) / total2000Hom) * 100 : 0,
    },
    composicion: { delitosTop },
    cambioHomicidios: {
      anioBase,
      anioUltimo,
      rows: cambioRows,
      valoresPorPartido: valoresCambio,
    },
  };
}
