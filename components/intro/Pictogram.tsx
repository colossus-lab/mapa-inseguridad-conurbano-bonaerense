"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

/** Ratio 1-2-5 redondeado para que `count / ratio` caiga cerca de `target`. */
function niceRatio(count: number, target = 150): number {
  if (count <= 0) return 1;
  const raw = Math.max(1, count / target);
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const base = raw / exp;
  let m = 1;
  if (base <= 1.5) m = 1;
  else if (base <= 3) m = 2;
  else if (base <= 7) m = 5;
  else m = 10;
  return m * exp;
}

export type Breakdown = {
  masc: number;
  fem: number;
  sd: number;
  /** Si el delito no tiene desglose de género registrado. */
  coverage: boolean;
};

type Props = {
  count: number;
  label?: string;
  sublabel?: string;
  targetFigures?: number;
  maxFigures?: number;
  columns?: number;
  /** Desglose de víctimas por género. Si `coverage=false`, todas las figuras van en gris. */
  breakdown?: Breakdown;
};

const COLOR_MASC = "#2563eb"; // brand blue
const COLOR_FEM = "#db2777";  // pink-600
const COLOR_SD = "#9ca3af";   // gray-400
const COLOR_DEFAULT = "#101215"; // ink (fallback cuando no hay breakdown)

/**
 * Aparta `total` figuras en 3 grupos (M, F, SD) usando el algoritmo de
 * mayor-resto (Hamilton) para que las proporciones queden redondeadas
 * sin perder ni sumar figuras.
 */
function repartoFiguras(total: number, parts: { key: "m" | "f" | "sd"; value: number }[]) {
  const sum = parts.reduce((a, p) => a + p.value, 0);
  if (sum <= 0) return parts.map((p) => ({ ...p, n: 0 }));
  const raw = parts.map((p) => ({ ...p, ideal: (p.value / sum) * total, n: Math.floor((p.value / sum) * total) }));
  let assigned = raw.reduce((a, p) => a + p.n, 0);
  const leftover = total - assigned;
  // Orden por mayor resto
  raw.sort((a, b) => (b.ideal - b.n) - (a.ideal - a.n));
  for (let i = 0; i < leftover; i++) raw[i].n += 1;
  return raw;
}

export default function Pictogram({
  count,
  label,
  sublabel,
  targetFigures = 150,
  maxFigures = 220,
  columns = 18,
  breakdown,
}: Props) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const { perFigure, nFigures, coloredOrder, pct } = useMemo(() => {
    const per = niceRatio(count, targetFigures);
    const n = Math.min(maxFigures, Math.max(1, Math.round(count / per)));

    // Si no hay coverage o no hay breakdown, todas negras (o grises si querés).
    if (!breakdown || !breakdown.coverage) {
      return { perFigure: per, nFigures: n, coloredOrder: Array(n).fill(COLOR_DEFAULT), pct: null };
    }

    const parts = [
      { key: "m" as const, value: breakdown.masc },
      { key: "f" as const, value: breakdown.fem },
      { key: "sd" as const, value: breakdown.sd },
    ];
    const reparto = repartoFiguras(n, parts);
    // Orden estable: primero M, luego F, luego SD.
    const order: string[] = [];
    const rm = reparto.find((x) => x.key === "m")?.n ?? 0;
    const rf = reparto.find((x) => x.key === "f")?.n ?? 0;
    const rsd = reparto.find((x) => x.key === "sd")?.n ?? 0;
    for (let i = 0; i < rm; i++) order.push(COLOR_MASC);
    for (let i = 0; i < rf; i++) order.push(COLOR_FEM);
    for (let i = 0; i < rsd; i++) order.push(COLOR_SD);

    const sum = breakdown.masc + breakdown.fem + breakdown.sd || 1;
    return {
      perFigure: per,
      nFigures: n,
      coloredOrder: order,
      pct: {
        masc: (breakdown.masc / sum) * 100,
        fem: (breakdown.fem / sum) * 100,
        sd: (breakdown.sd / sum) * 100,
      },
    };
  }, [count, targetFigures, maxFigures, breakdown]);

  const figs = Array.from({ length: nFigures }, (_, i) => i);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Symbol unisex */}
      <svg width="0" height="0" aria-hidden>
        <defs>
          <symbol id="fig-u" viewBox="0 0 22 36">
            <circle cx="11" cy="5.6" r="3.6" fill="currentColor" />
            <path
              d="M11 10.5 c-3.5 0 -6 1.8 -6.8 5.2 l-1.2 5.5 c-0.15 0.7 0.35 1.3 1.05 1.3 h1.65 l-0.35 10.5 c-0.03 0.85 0.6 1.55 1.45 1.55 h2.4 c0.8 0 1.45 -0.65 1.45 -1.45 v-7.9 h1.6 v7.9 c0 0.8 0.65 1.45 1.45 1.45 h2.4 c0.85 0 1.48 -0.7 1.45 -1.55 l-0.35 -10.5 h1.65 c0.7 0 1.2 -0.6 1.05 -1.3 l-1.2 -5.5 c-0.8 -3.4 -3.3 -5.2 -6.8 -5.2 z"
              fill="currentColor"
            />
          </symbol>
        </defs>
      </svg>

      <div
        className="grid w-full max-w-[640px] gap-x-[4px] gap-y-[5px]"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        aria-label={`Pictograma: ${count.toLocaleString("es-AR")} hechos`}
      >
        <AnimatePresence initial={!reduced}>
          {figs.map((i) => (
            <motion.svg
              key={i}
              layout
              initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{
                duration: reduced ? 0 : 0.25,
                delay: reduced ? 0 : Math.min(i * 0.003, 0.7),
              }}
              viewBox="0 0 22 36"
              className="h-[26px] w-full"
              style={{ color: coloredOrder[i] ?? COLOR_DEFAULT }}
            >
              <use href="#fig-u" />
            </motion.svg>
          ))}
        </AnimatePresence>
      </div>

      {/* Leyenda de colores (solo si hay breakdown con coverage) */}
      {pct && (
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11.5px] text-ink-2 num">
          <LegendItem color={COLOR_MASC} label="Víctimas masculinas" pct={pct.masc} />
          <LegendItem color={COLOR_FEM} label="Víctimas femeninas" pct={pct.fem} />
          {pct.sd >= 0.5 && <LegendItem color={COLOR_SD} label="Sin datos" pct={pct.sd} />}
        </div>
      )}

      {/* Nota cuando el delito no tiene desglose de género */}
      {breakdown && !breakdown.coverage && (
        <div className="text-[11px] italic text-ink-3">
          El SNIC no registra género de víctima en esta categoría.
        </div>
      )}

      <div className="text-center">
        {label && <div className="text-[12.5px] font-semibold text-ink">{label}</div>}
        <div className="mt-0.5 text-[11.5px] text-ink-3 num">
          1 figura ={" "}
          <span className="font-semibold text-ink">{perFigure.toLocaleString("es-AR")}</span> hechos ·{" "}
          <span className="font-semibold text-ink">{count.toLocaleString("es-AR")}</span> en total
        </div>
        {sublabel && <div className="mt-1 text-[11.5px] italic text-ink-3">{sublabel}</div>}
      </div>
    </div>
  );
}

function LegendItem({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span>
        {label} <span className="font-semibold text-ink">{pct.toFixed(1)}%</span>
      </span>
    </span>
  );
}
