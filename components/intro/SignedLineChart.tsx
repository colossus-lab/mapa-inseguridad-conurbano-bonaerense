"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export type Point = { anio: number; valor: number };

type Props = {
  data: Point[];
  width?: number;
  height?: number;
  /** Duración TOTAL de la línea (ms). El lápiz avanza continuo a lo largo de todos los tramos. */
  totalDuration?: number;
  startDelay?: number;
  onDone?: () => void;
  format?: (n: number) => string;
};

const M = { top: 56, right: 24, bottom: 36, left: 56 };

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
  }, []);
  return r;
}

export default function SignedLineChart({
  data,
  width = 760,
  height = 400,
  totalDuration = 2600,
  startDelay = 300,
  onDone,
  format = (n) => n.toLocaleString("es-AR"),
}: Props) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const { xs, ys, yMin, yMax, segments, cumStart, cumEnd, yTicks } = useMemo(() => {
    if (!data.length) {
      return { xs: [], ys: [], yMin: 0, yMax: 0, segments: [], cumStart: [], cumEnd: [], yTicks: [0] };
    }
    const innerW = width - M.left - M.right;
    const innerH = height - M.top - M.bottom;
    const vals = data.map((d) => d.valor);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const pad = (maxV - minV) * 0.12 || maxV * 0.1 || 1;
    const yMin = Math.max(0, minV - pad);
    const yMax = maxV + pad;
    const anios = data.map((d) => d.anio);
    const aMin = Math.min(...anios);
    const aMax = Math.max(...anios);
    const xScale = (a: number) => M.left + ((a - aMin) / (aMax - aMin || 1)) * innerW;
    const yScale = (v: number) => M.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
    const xs = data.map((d) => xScale(d.anio));
    const ys = data.map((d) => yScale(d.valor));

    // Segmentos + longitudes para progreso continuo.
    const segs = data.slice(1).map((d, i) => {
      const dx = xs[i + 1] - xs[i];
      const dy = ys[i + 1] - ys[i];
      return {
        from: { x: xs[i], y: ys[i] },
        to: { x: xs[i + 1], y: ys[i + 1] },
        length: Math.hypot(dx, dy),
        color: d.valor > data[i].valor ? "#ef4444" : "#00bb7f",
        deltaPct: data[i].valor > 0 ? ((d.valor - data[i].valor) / data[i].valor) * 100 : null,
      };
    });
    const total = segs.reduce((s, sg) => s + sg.length, 0) || 1;
    const cumStart: number[] = [];
    const cumEnd: number[] = [];
    let acc = 0;
    segs.forEach((sg) => {
      cumStart.push(acc / total);
      acc += sg.length;
      cumEnd.push(acc / total);
    });

    const yTicks = [yMin, (yMin + yMax) / 2, yMax];
    return { xs, ys, yMin, yMax, segments: segs, cumStart, cumEnd, yTicks };
  }, [data, width, height]);

  // Disparamos onDone al finalizar la duración total.
  useEffect(() => {
    if (reduced) { onDoneRef.current?.(); return; }
    const t = setTimeout(() => onDoneRef.current?.(), startDelay + totalDuration);
    return () => clearTimeout(t);
  }, [reduced, startDelay, totalDuration, data]);

  if (!data.length) return null;

  const innerH = height - M.top - M.bottom;
  const yScaleFn = (v: number) => M.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="h-auto w-full">
        {/* Gridlines Y */}
        {yTicks.map((v, i) => {
          const y = yScaleFn(v);
          return (
            <g key={i}>
              <line x1={M.left} x2={width - M.right} y1={y} y2={y} stroke="#0303031a" strokeDasharray="2 3" />
              <text x={M.left - 8} y={y + 3} textAnchor="end" fontSize="10.5" fill="#66696f" className="num">
                {format(v)}
              </text>
            </g>
          );
        })}

        {/* Eje X */}
        {data.map((d, i) => (
          <text
            key={d.anio}
            x={xs[i]}
            y={height - M.bottom + 18}
            textAnchor="middle"
            fontSize="10.5"
            fill="#66696f"
            className="num"
          >
            {d.anio}
          </text>
        ))}
        <line x1={M.left} x2={width - M.right} y1={height - M.bottom} y2={height - M.bottom} stroke="#0303031a" />

        {/* Línea continua — cada segmento anima pathLength con delay=cumStart·total, duration=length·total. */}
        {segments.map((s, i) => {
          const segDelayMs = reduced ? 0 : startDelay + cumStart[i] * totalDuration;
          const segDurMs = reduced ? 0 : (cumEnd[i] - cumStart[i]) * totalDuration;
          return (
            <motion.line
              key={i}
              x1={s.from.x}
              y1={s.from.y}
              x2={s.to.x}
              y2={s.to.y}
              stroke={s.color}
              strokeWidth={3}
              strokeLinecap="butt"
              initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: segDurMs / 1000,
                delay: segDelayMs / 1000,
                ease: "linear",
              }}
            />
          );
        })}

        {/* Puntos — aparecen justo cuando el lápiz los alcanza. */}
        {data.map((d, i) => {
          const delayMs = reduced ? 0 : startDelay + (i === 0 ? 0 : cumEnd[i - 1] * totalDuration);
          return (
            <motion.circle
              key={d.anio}
              cx={xs[i]}
              cy={ys[i]}
              r={hover === i ? 6.5 : 4.5}
              fill="#ffffff"
              stroke={i === 0 ? "#101215" : segments[i - 1]?.color ?? "#101215"}
              strokeWidth={2}
              initial={reduced ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: delayMs / 1000, duration: 0.22 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            />
          );
        })}

        {/* Etiquetas en extremos */}
        {[0, data.length - 1].map((i) => {
          const d = data[i];
          const delayMs = reduced ? 0 : startDelay + (i === 0 ? 0 : cumEnd[i - 1] * totalDuration) + 80;
          return (
            <motion.text
              key={`l-${i}`}
              x={xs[i]}
              y={ys[i] - 12}
              textAnchor={i === 0 ? "start" : "end"}
              fontSize="11.5"
              fontWeight={600}
              fill="#101215"
              className="num"
              initial={reduced ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delayMs / 1000, duration: 0.35 }}
            >
              {format(d.valor)}
            </motion.text>
          );
        })}
      </svg>

      {/* Tooltip hover */}
      <AnimatePresence>
        {hover !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute rounded-md border border-line bg-white px-3 py-2 text-[12px] shadow-float"
            style={{
              left: `${(xs[hover] / width) * 100}%`,
              top: `${(ys[hover] / height) * 100}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">{data[hover].anio}</div>
            <div className="mt-0.5 text-[14px] font-semibold text-ink num">{format(data[hover].valor)}</div>
            {hover > 0 && segments[hover - 1].deltaPct !== null && (
              <div
                className={`mt-0.5 text-[11px] font-semibold num ${
                  segments[hover - 1].deltaPct! >= 0 ? "text-danger" : "text-emerald-600"
                }`}
              >
                {segments[hover - 1].deltaPct! >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(segments[hover - 1].deltaPct!).toFixed(1)}% vs {data[hover - 1].anio}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
