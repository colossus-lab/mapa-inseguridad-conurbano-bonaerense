"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { useDashboard } from "@/lib/store";
import { hechosDelito, tasaDelito, yoyChange } from "@/lib/analytics";
import type { Metric } from "@/lib/types";

// Paleta para series comparativas (hasta 8 partidos).
const PALETA = ["#00bb7f", "#2563eb", "#edb200", "#ef4444", "#7c3aed", "#0891b2", "#ec4899", "#f97316"];

export default function ComparadorTab() {
  const { dataset } = useDashboard();

  const [delitoId, setDelitoId] = useState<string>("1");
  const [metric, setMetric] = useState<Metric>("tasa");
  const [anio, setAnio] = useState<number>(0);
  // Selección ordenada de partidos (hasta 8).
  const [seleccion, setSeleccion] = useState<string[]>([]);

  useEffect(() => {
    if (!dataset) return;
    setAnio(dataset.anios[dataset.anios.length - 1]);
    if (!dataset.delitos.find((d) => d.id === delitoId)) setDelitoId(dataset.delitos[0].id);
  }, [dataset]); // eslint-disable-line react-hooks/exhaustive-deps

  const di = dataset ? dataset.delitos.findIndex((d) => d.id === delitoId) : -1;
  const ai = dataset ? dataset.anios.indexOf(anio) : -1;
  const delitoNombre = di >= 0 && dataset ? dataset.delitos[di].nombre : "";

  const togglePartido = (id: string | null) => {
    if (!id) return;
    setSeleccion((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 8) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  // Partidos ordenados alfabéticamente con su valor y variación interanual.
  const partidosOrdenados = useMemo(() => {
    if (!dataset || di < 0 || ai < 0) return [];
    return dataset.partidos
      .map((p, pi) => {
        const val = metric === "tasa" ? tasaDelito(dataset, pi, di, ai) : hechosDelito(dataset, pi, di, ai);
        const valPrev =
          ai > 0
            ? metric === "tasa"
              ? tasaDelito(dataset, pi, di, ai - 1)
              : hechosDelito(dataset, pi, di, ai - 1)
            : 0;
        const yoy = yoyChange(val, valPrev);
        return { id: p.id, nombre: p.nombre, valor: val, yoy };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [dataset, di, ai, metric]);

  // Datos de la serie temporal: una columna por partido seleccionado + conurbano baseline.
  const chartData = useMemo(() => {
    if (!dataset || di < 0) return [];
    return dataset.anios.map((a, aIdx) => {
      const row: Record<string, number | string> = { anio: a };
      const allVals = dataset.partidos.map((_, pi) =>
        metric === "tasa" ? tasaDelito(dataset, pi, di, aIdx) : hechosDelito(dataset, pi, di, aIdx)
      );
      if (metric === "tasa") {
        const nz = allVals.filter((v) => v > 0);
        row._conurbano = nz.length ? nz.reduce((x, y) => x + y, 0) / nz.length : 0;
      } else {
        row._conurbano = allVals.reduce((x, y) => x + y, 0);
      }
      seleccion.forEach((id) => {
        const pi = dataset.partidos.findIndex((p) => p.id === id);
        if (pi < 0) return;
        row[id] = metric === "tasa"
          ? tasaDelito(dataset, pi, di, aIdx)
          : hechosDelito(dataset, pi, di, aIdx);
      });
      return row;
    });
  }, [dataset, di, metric, seleccion]);

  if (!dataset) return null;

  const unidad = metric === "tasa" ? " /100k" : "";
  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: metric === "tasa" ? 1 : 0 });

  return (
    <div className="flex flex-col gap-8">
      {/* Filtros + año de referencia */}
      <section className="grid gap-6 rounded-xl border border-line bg-white p-6 shadow-card md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <label className="flex min-w-0 flex-col gap-2">
          <span className="eyebrow">Tipo de delito</span>
          <select
            value={delitoId}
            onChange={(e) => setDelitoId(e.target.value)}
            className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-[14px] text-ink outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
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
            <span className="eyebrow">Año de referencia</span>
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
      </section>

      {/* Chips de selección */}
      <section className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">En comparación</span>
        {seleccion.length === 0 && (
          <span className="text-[12.5px] text-ink-3">
            Tocá las tarjetas de los partidos para agregarlos al comparador (hasta 8).
          </span>
        )}
        {seleccion.map((id, i) => {
          const p = dataset.partidos.find((x) => x.id === id);
          if (!p) return null;
          const color = PALETA[i % PALETA.length];
          return (
            <button
              key={id}
              onClick={() => togglePartido(id)}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-[12.5px] text-ink shadow-card transition hover:border-line-strong"
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              <span>{p.nombre}</span>
              <span className="text-ink-3">✕</span>
            </button>
          );
        })}
        {seleccion.length > 0 && (
          <button
            onClick={() => setSeleccion([])}
            className="ml-2 text-[12px] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            limpiar
          </button>
        )}
      </section>

      {/* Grid alfabético de partidos */}
      <section className="rounded-xl border border-line bg-white p-5 shadow-card">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-line-subtle pb-3">
          <div>
            <div className="eyebrow">Partidos del Conurbano</div>
            <h3 className="mt-0.5 text-[15px] font-semibold text-ink">
              24 jurisdicciones · orden alfabético
            </h3>
          </div>
          <span className="text-[11px] text-ink-3">
            {delitoNombre} · {metric === "tasa" ? "Tasa /100k" : "Hechos"} · {anio}
          </span>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {partidosOrdenados.map((p) => {
            const idx = seleccion.indexOf(p.id);
            const seleccionado = idx >= 0;
            const color = seleccionado ? PALETA[idx % PALETA.length] : null;
            const up = p.yoy !== null && p.yoy >= 0;
            return (
              <button
                key={p.id}
                onClick={() => togglePartido(p.id)}
                className={[
                  "group flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition",
                  seleccionado
                    ? "border-transparent shadow-card"
                    : "border-line bg-paper hover:border-line-strong hover:bg-surface-1/40",
                ].join(" ")}
                style={seleccionado && color ? { borderColor: color, background: `${color}14` } : undefined}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="truncate text-[12.5px] font-semibold text-ink">{p.nombre}</span>
                  {seleccionado && color && (
                    <span className="ml-2 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                  )}
                </div>
                <div className="text-[15px] font-semibold text-ink num">
                  {fmt(p.valor)}
                  <span className="ml-1 text-[10px] font-normal text-ink-3">{metric === "tasa" ? "/100k" : ""}</span>
                </div>
                {p.yoy !== null ? (
                  <div className={`text-[10.5px] font-medium num ${up ? "text-danger" : "text-emerald-600"}`}>
                    {up ? "▲" : "▼"} {Math.abs(p.yoy).toFixed(1)}% vs {anio - 1}
                  </div>
                ) : (
                  <div className="text-[10.5px] text-ink-4">sin comparable</div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Gráfico temporal comparativo */}
      <section className="rounded-xl border border-line bg-white shadow-card">
        <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-subtle px-5 py-4">
          <div>
            <div className="eyebrow">Serie histórica</div>
            <h3 className="mt-0.5 text-[15px] font-semibold text-ink">
              Evolución comparada · {delitoNombre}
            </h3>
          </div>
          <span className="text-[11px] text-ink-3">
            {metric === "tasa" ? "Tasa /100k hab" : "Hechos"} · {dataset.anios[0]}–{dataset.anios[dataset.anios.length - 1]}
          </span>
        </header>
        <div className="h-[340px] p-4">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="#0303031a" strokeDasharray="2 3" vertical={false} />
              <XAxis
                dataKey="anio"
                tick={{ fill: "#66696f", fontSize: 11 }}
                axisLine={{ stroke: "#0303031a" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#66696f", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid #0303031a", borderRadius: 6, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                labelStyle={{ color: "#101215", fontWeight: 600 }}
                formatter={(v: unknown, name: string) => {
                  const n = typeof v === "number" ? v : Number(v);
                  const etiqueta = name === "_conurbano"
                    ? (metric === "tasa" ? "Promedio Conurbano" : "Total Conurbano")
                    : (dataset.partidos.find((p) => p.id === name)?.nombre ?? name);
                  return [Number.isFinite(n) ? `${fmt(n)}${unidad}` : "—", etiqueta];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#66696f", paddingTop: 8 }}
                iconType="plainline"
                formatter={(value: string) => value === "_conurbano"
                  ? (metric === "tasa" ? "Promedio Conurbano" : "Total Conurbano")
                  : (dataset.partidos.find((p) => p.id === value)?.nombre ?? value)}
              />
              <Line
                type="monotone"
                dataKey="_conurbano"
                stroke="#83868e"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
              />
              {seleccion.map((id, i) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  stroke={PALETA[i % PALETA.length]}
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: PALETA[i % PALETA.length], stroke: "#fff", strokeWidth: 1.5 }}
                  activeDot={{ r: 4.5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tabla comparativa de partidos seleccionados */}
      {seleccion.length > 0 && (
        <section className="rounded-xl border border-line bg-white shadow-card">
          <header className="flex items-baseline justify-between gap-3 border-b border-line-subtle px-5 py-4">
            <div>
              <div className="eyebrow">Cuadro comparativo · {anio}</div>
              <h3 className="mt-0.5 text-[15px] font-semibold text-ink">
                {seleccion.length} partidos en comparación
              </h3>
            </div>
            <span className="text-[11px] text-ink-3">
              Variación interanual vs {anio - 1}
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-surface-1/40 text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
                <tr>
                  <th className="px-5 py-2.5 text-left font-semibold">Partido</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{anio}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{anio - 1}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Δ absoluto</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {seleccion.map((id, i) => {
                  const pi = dataset.partidos.findIndex((p) => p.id === id);
                  if (pi < 0) return null;
                  const p = dataset.partidos[pi];
                  const color = PALETA[i % PALETA.length];
                  const vNow = metric === "tasa" ? tasaDelito(dataset, pi, di, ai) : hechosDelito(dataset, pi, di, ai);
                  const vPrev = ai > 0
                    ? (metric === "tasa" ? tasaDelito(dataset, pi, di, ai - 1) : hechosDelito(dataset, pi, di, ai - 1))
                    : 0;
                  const absDelta = vNow - vPrev;
                  const pct = yoyChange(vNow, vPrev);
                  const up = (pct ?? 0) >= 0;
                  return (
                    <tr key={id} className="border-t border-line-subtle hover:bg-surface-1/30">
                      <td className="px-5 py-2.5 text-ink">
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                          {p.nombre}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right num text-ink">{fmt(vNow)}{unidad}</td>
                      <td className="px-3 py-2.5 text-right num text-ink-2">{fmt(vPrev)}{unidad}</td>
                      <td className={`px-3 py-2.5 text-right num ${absDelta >= 0 ? "text-danger" : "text-emerald-600"}`}>
                        {absDelta >= 0 ? "+" : ""}{fmt(absDelta)}
                      </td>
                      <td className={`px-5 py-2.5 text-right num font-semibold ${pct === null ? "text-ink-3" : up ? "text-danger" : "text-emerald-600"}`}>
                        {pct === null ? "—" : `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-[12px] leading-relaxed text-ink-3">
        Seleccioná hasta 8 partidos desde la <strong>grilla alfabética</strong> para superponerlos en
        la serie temporal y verlos en el cuadro comparativo. La línea gris punteada representa el
        {" "}{metric === "tasa" ? "promedio" : "total"} del Conurbano como baseline.
      </p>
    </div>
  );
}
