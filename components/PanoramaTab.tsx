"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { useDashboard } from "@/lib/store";
import { loadGeoJSON } from "@/lib/data";
import { buildIntroScenes } from "@/lib/introScenes";
import {
  totalesPorPartido,
  totalHechos,
  serieTotales,
  yoyChange,
  changeVsWindow,
  projeccionTexto,
  composicionPartido,
  distribucion,
  balanceInteranual,
  delitoMasFrecuente,
  ratioViolenciaPropiedad,
  hechosDelito,
  tasaDelito,
} from "@/lib/analytics";
import type { Metric } from "@/lib/types";

const Choropleth = dynamic(() => import("./Choropleth"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-ink-3">Cargando mapa…</div>,
});

const IntroCarousel = dynamic(() => import("./intro/IntroCarousel"), { ssr: false });

export default function PanoramaTab() {
  const { dataset, anio, setAnio, municipioSel, setMunicipio } = useDashboard();
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);

  // Categoría para el widget "Explorar por categoría".
  const [expDelitoId, setExpDelitoId] = useState<string>("1");
  const [expMetric, setExpMetric] = useState<Metric>("tasa");

  useEffect(() => { loadGeoJSON().then(setGeo).catch(console.error); }, []);

  const ai = dataset ? dataset.anios.indexOf(anio) : -1;

  /* ========= Datos principales (mapa) ========= */
  const valuesMap = useMemo(() => {
    if (!dataset || ai < 0) return {};
    const totals = totalesPorPartido(dataset, ai);
    const m: Record<string, number> = {};
    dataset.partidos.forEach((p, pi) => { m[p.id] = totals[pi]; });
    return m;
  }, [dataset, ai]);

  const renderHover = useMemo(() => {
    if (!dataset || ai < 0) return undefined;
    return (id: string, nombre: string, value: number) => {
      const pi = dataset.partidos.findIndex((p) => p.id === id);
      if (pi < 0) return null;
      const series = serieTotales(dataset, pi);
      const yoy = yoyChange(series[ai], series[ai - 1] ?? 0);
      const { pct: vsAvg } = changeVsWindow(series, ai, 5);
      const narrativa = projeccionTexto({ nombre, yoy, vsPromedio: vsAvg });
      return (
        <HoverContent nombre={nombre} total={value} yoy={yoy} vsAvg={vsAvg} narrativa={narrativa} anio={dataset.anios[ai]} />
      );
    };
  }, [dataset, ai]);

  const rankingDelta = useMemo(() => {
    if (!dataset || ai < 0) return { top: [], bottom: [], totalConurbano: 0, promYoy: null as number | null };
    const rows = dataset.partidos.map((p, pi) => {
      const series = serieTotales(dataset, pi);
      const yoy = yoyChange(series[ai], series[ai - 1] ?? 0);
      return { id: p.id, nombre: p.nombre, total: series[ai], yoy };
    });
    const withYoy = rows.filter((r) => r.yoy !== null) as { id: string; nombre: string; total: number; yoy: number }[];
    const top = [...withYoy].sort((a, b) => b.yoy - a.yoy).slice(0, 5);
    const bottom = [...withYoy].sort((a, b) => a.yoy - b.yoy).slice(0, 5);
    const totalConurbano = rows.reduce((a, r) => a + r.total, 0);
    const promYoy = withYoy.length ? withYoy.reduce((a, r) => a + r.yoy, 0) / withYoy.length : null;
    return { top, bottom, totalConurbano, promYoy };
  }, [dataset, ai]);

  /* ========= Estadísticas compuestas ========= */
  const stats = useMemo(() => {
    if (!dataset || ai < 0) return null;
    const totales = totalesPorPartido(dataset, ai);
    const dist = distribucion(totales);
    const bal = balanceInteranual(dataset, ai);
    const top = delitoMasFrecuente(dataset, ai);
    const ratio = ratioViolenciaPropiedad(dataset, ai);
    const iHom = dataset.delitos.findIndex((d) => d.id === "1");
    const tasaHomArr = dataset.partidos.map((_, pi) => tasaDelito(dataset, pi, iHom, ai)).filter((v) => v > 0);
    const tasaHomProm = tasaHomArr.length ? tasaHomArr.reduce((a, b) => a + b, 0) / tasaHomArr.length : 0;
    return { dist, bal, top, ratio, tasaHomProm };
  }, [dataset, ai]);

  if (!dataset || !stats) return null;

  const introScenes = buildIntroScenes(dataset);
  const scrollToDashboard = () => {
    document.getElementById("panorama-dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Intro cinematográfica al tope del Panorama */}
      {introScenes.length > 0 && (
        <IntroCarousel scenes={introScenes} onFinishExplore={scrollToDashboard} />
      )}

      <div id="panorama-dashboard" className="scroll-mt-16 flex flex-col gap-6">
      {/* Bloque unificado: KPIs arriba, slider de año abajo */}
      <section className="rounded-xl border border-line bg-white p-6 shadow-card">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <KPICompact label="Hechos totales" value={rankingDelta.totalConurbano.toLocaleString("es-AR")} />
          <KPICompact
            label="Var. interanual promedio"
            value={rankingDelta.promYoy !== null ? `${rankingDelta.promYoy >= 0 ? "+" : ""}${rankingDelta.promYoy.toFixed(1)}%` : "—"}
            accent={rankingDelta.promYoy !== null ? (rankingDelta.promYoy >= 0 ? "danger" : "success") : undefined}
          />
          <KPICompact label="Tasa promedio homicidios" value={`${stats.tasaHomProm.toFixed(1)} /100k`} />
          <KPICompact
            label="Ratio violencia / propiedad"
            value={stats.ratio.ratio ? `${stats.ratio.ratio.toFixed(2)}×` : "—"}
            sub={`${stats.ratio.violencia.toLocaleString("es-AR")} vs ${stats.ratio.propiedad.toLocaleString("es-AR")}`}
          />
        </div>
        <div className="mt-6 border-t border-line-subtle pt-5">
          <AnioSlider
            anio={anio}
            min={dataset.anios[0]}
            max={dataset.anios[dataset.anios.length - 1]}
            onChange={setAnio}
          />
        </div>
      </section>

      {/* Insights strip */}
      <section className="grid gap-3 rounded-xl border border-line bg-surface-1/40 p-5 md:grid-cols-3">
        <Insight
          dot="bg-danger"
          heading={`${stats.bal.suben} partidos ↑ / ${stats.bal.bajan} ↓`}
          body={`Variación interanual ${anio - 1}→${anio} · ${stats.bal.estables} estables.`}
        />
        <Insight
          dot="bg-emerald-500"
          heading={stats.top?.nombre ?? "—"}
          body={
            stats.top
              ? `Delito más frecuente del año — ${stats.top.valor.toLocaleString("es-AR")} hechos (${stats.top.pct.toFixed(1)}% del total).`
              : "Sin datos."
          }
        />
        <Insight
          dot="bg-ink"
          heading={`Mediana por partido: ${Math.round(stats.dist.mediana).toLocaleString("es-AR")}`}
          body={`Rango: ${Math.round(stats.dist.min).toLocaleString("es-AR")} – ${Math.round(stats.dist.max).toLocaleString("es-AR")} · p25 ${Math.round(stats.dist.p25).toLocaleString("es-AR")} · p75 ${Math.round(stats.dist.p75).toLocaleString("es-AR")}.`}
        />
      </section>

      {/* Mapa + sidebar rankings */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[460px] overflow-hidden rounded-xl border border-line bg-white shadow-card">
          <Choropleth
            geo={geo}
            values={valuesMap}
            selectedId={municipioSel}
            onSelect={setMunicipio}
            renderHover={renderHover}
            legendTitle={`Hechos totales · ${anio}`}
            legendSubtitle="Suma de todas las categorías SNIC"
            valueFormat={(n) => n.toLocaleString("es-AR")}
          />
        </div>
        <div className="flex flex-col gap-4">
          <RankingCard title="Mayores aumentos" subtitle="Variación interanual" rows={rankingDelta.top} tone="danger"
            onSelect={setMunicipio} selectedId={municipioSel} />
          <RankingCard title="Mayores reducciones" subtitle="Variación interanual" rows={rankingDelta.bottom} tone="success"
            onSelect={setMunicipio} selectedId={municipioSel} />
        </div>
      </section>

      {/* Radiografía del partido seleccionado */}
      <RadiografiaPartido />

      {/* Explorar por categoría */}
      <ExplorarCategoria
        expDelitoId={expDelitoId}
        setExpDelitoId={setExpDelitoId}
        expMetric={expMetric}
        setExpMetric={setExpMetric}
      />

      <p className="text-[12px] leading-relaxed text-ink-3">
        Pasá el mouse sobre un partido para ver su proyección. Al seleccionarlo se habilita la
        <strong> radiografía</strong> (composición + serie histórica). El widget <strong>Explorar por
        categoría</strong> permite ordenar los 24 partidos por cualquier tipo de delito y destaca el
        seleccionado actualmente.
      </p>
      </div>
    </div>
  );
}

/* ==========================  Radiografía del partido  ========================== */

function RadiografiaPartido() {
  const { dataset, anio, municipioSel, setMunicipio } = useDashboard();
  if (!dataset) return null;
  const ai = dataset.anios.indexOf(anio);
  const pi = municipioSel ? dataset.partidos.findIndex((p) => p.id === municipioSel) : -1;

  if (pi < 0) {
    return (
      <section className="rounded-xl border border-dashed border-line bg-surface-1/40 p-8 text-center">
        <div className="eyebrow mb-1.5">Radiografía del partido</div>
        <div className="text-[14px] text-ink-2">
          Seleccioná un partido en el mapa o en los rankings para ver su composición de delitos y su
          serie histórica.
        </div>
      </section>
    );
  }

  const partido = dataset.partidos[pi];
  const composicion = composicionPartido(dataset, pi, ai, 8);
  const serie = dataset.anios.map((a, aIdx) => ({ anio: a, total: totalHechos(dataset, pi, aIdx) }));
  const totalPartido = serie[ai]?.total ?? 0;
  const yoy = yoyChange(serie[ai].total, serie[ai - 1]?.total ?? 0);

  return (
    <section className="rounded-xl border border-line bg-white shadow-card">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-subtle px-5 py-4">
        <div>
          <div className="eyebrow">Radiografía</div>
          <h3 className="mt-0.5 text-[17px] font-semibold text-ink">{partido.nombre}</h3>
        </div>
        <div className="flex items-baseline gap-5">
          <div className="text-right">
            <div className="eyebrow">Hechos {anio}</div>
            <div className="text-[18px] font-semibold text-ink num">{totalPartido.toLocaleString("es-AR")}</div>
          </div>
          <div className="text-right">
            <div className="eyebrow">Variación interanual</div>
            <div className={`text-[18px] font-semibold num ${yoy === null ? "text-ink-3" : yoy >= 0 ? "text-danger" : "text-emerald-600"}`}>
              {yoy === null ? "—" : `${yoy >= 0 ? "▲" : "▼"} ${Math.abs(yoy).toFixed(1)}%`}
            </div>
          </div>
          <button
            onClick={() => setMunicipio(null)}
            className="text-[11.5px] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            cerrar
          </button>
        </div>
      </header>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Composición */}
        <div>
          <div className="mb-2">
            <div className="eyebrow">Composición</div>
            <h4 className="mt-0.5 text-[14px] font-semibold text-ink">Delitos por año</h4>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={composicion} layout="vertical" margin={{ top: 2, right: 50, bottom: 2, left: 0 }}>
                <XAxis type="number" tick={{ fill: "#66696f", fontSize: 10 }} axisLine={{ stroke: "#0303031a" }} tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
                <YAxis type="category" dataKey="nombre" tick={{ fill: "#101215", fontSize: 10.5 }} width={150} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #0303031a", borderRadius: 6, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  formatter={(v: unknown, _n, p) => {
                    const row = p.payload as { valor: number; pct: number };
                    return [`${row.valor.toLocaleString("es-AR")} (${row.pct.toFixed(1)}%)`, "Hechos"];
                  }}
                />
                <Bar dataKey="valor" fill="#00bb7f" radius={[0, 3, 3, 0]} maxBarSize={13} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Serie temporal */}
        <div>
          <div className="mb-2">
            <div className="eyebrow">Serie histórica</div>
            <h4 className="mt-0.5 text-[14px] font-semibold text-ink">Total de hechos · {dataset.anios[0]}–{dataset.anios[dataset.anios.length - 1]}</h4>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 2, left: 4 }}>
                <CartesianGrid stroke="#0303031a" strokeDasharray="2 3" vertical={false} />
                <XAxis dataKey="anio" tick={{ fill: "#66696f", fontSize: 10 }} axisLine={{ stroke: "#0303031a" }} tickLine={false} />
                <YAxis tick={{ fill: "#66696f", fontSize: 10 }} axisLine={false} tickLine={false} width={42}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #0303031a", borderRadius: 6, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  formatter={(v: unknown) => [Number(v).toLocaleString("es-AR"), "Hechos"]}
                />
                <ReferenceLine x={anio} stroke="#00bb7f" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="total" stroke="#101215" strokeWidth={2} dot={{ r: 2, fill: "#101215", stroke: "#fff", strokeWidth: 1.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================  Explorar por categoría  ========================== */

function ExplorarCategoria({
  expDelitoId, setExpDelitoId, expMetric, setExpMetric,
}: {
  expDelitoId: string;
  setExpDelitoId: (id: string) => void;
  expMetric: Metric;
  setExpMetric: (m: Metric) => void;
}) {
  const { dataset, anio, municipioSel, setMunicipio } = useDashboard();
  if (!dataset) return null;
  const ai = dataset.anios.indexOf(anio);
  const di = dataset.delitos.findIndex((d) => d.id === expDelitoId);

  const rows = useMemo(() => {
    if (di < 0 || ai < 0) return [];
    return dataset.partidos
      .map((p, pi) => ({
        id: p.id,
        nombre: p.nombre,
        valor: expMetric === "tasa" ? tasaDelito(dataset, pi, di, ai) : hechosDelito(dataset, pi, di, ai),
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [dataset, di, ai, expMetric]);

  const unidad = expMetric === "tasa" ? " /100k" : "";

  // Posición del partido seleccionado en el ranking.
  const posSel = municipioSel ? rows.findIndex((r) => r.id === municipioSel) : -1;
  const selRow = posSel >= 0 ? rows[posSel] : null;

  return (
    <section className="rounded-xl border border-line bg-white shadow-card">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line-subtle px-5 py-4">
        <div>
          <div className="eyebrow">Explorar por categoría</div>
          <h3 className="mt-0.5 text-[15px] font-semibold text-ink">
            Ranking de 24 partidos por tipo de delito
          </h3>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-col gap-1">
            <span className="eyebrow">Tipo de delito</span>
            <select
              value={expDelitoId}
              onChange={(e) => setExpDelitoId(e.target.value)}
              className="rounded-md border border-line bg-paper px-3 py-2 text-[13px] text-ink outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              {dataset.delitos.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="eyebrow">Métrica</span>
            <div className="inline-flex overflow-hidden rounded-md border border-line bg-paper">
              {(["tasa", "hechos"] as const).map((m, i) => (
                <button
                  key={m}
                  onClick={() => setExpMetric(m)}
                  className={[
                    "px-3 py-2 text-[12px] font-medium transition",
                    i === 0 ? "border-r border-line" : "",
                    expMetric === m ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
                  ].join(" ")}
                >
                  {m === "tasa" ? "Tasa /100k" : "Hechos"}
                </button>
              ))}
            </div>
          </label>
        </div>
      </header>

      {selRow && (
        <div className="flex items-center justify-between border-b border-line-subtle bg-emerald-500/5 px-5 py-2.5 text-[12.5px]">
          <span className="text-ink-2">
            Partido seleccionado: <strong className="text-ink">{selRow.nombre}</strong>
          </span>
          <span className="num text-ink-2">
            posición <span className="font-semibold text-ink">#{posSel + 1}</span> de {rows.length} ·{" "}
            <span className="font-semibold text-ink">{selRow.valor.toLocaleString("es-AR", { maximumFractionDigits: expMetric === "tasa" ? 1 : 0 })}{unidad}</span>
          </span>
        </div>
      )}

      <div className="p-4">
        <div className="h-[520px]">
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 16, bottom: 2, left: 0 }}>
              <XAxis type="number" tick={{ fill: "#66696f", fontSize: 10.5 }} axisLine={{ stroke: "#0303031a" }} tickLine={false} />
              <YAxis type="category" dataKey="nombre" tick={{ fill: "#101215", fontSize: 10.5 }} width={140} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "#0303030a" }}
                contentStyle={{ background: "#ffffff", border: "1px solid #0303031a", borderRadius: 6, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                formatter={(v: unknown) => [
                  `${Number(v).toLocaleString("es-AR", { maximumFractionDigits: expMetric === "tasa" ? 2 : 0 })}${unidad}`,
                  expMetric === "tasa" ? "Tasa" : "Hechos",
                ]}
              />
              <Bar
                dataKey="valor"
                onClick={(d: { id?: string }) => d?.id && setMunicipio(d.id === municipioSel ? null : d.id)}
                radius={[0, 3, 3, 0]}
                maxBarSize={13}
              >
                {rows.map((d) => (
                  <Cell
                    key={d.id}
                    fill={d.id === municipioSel ? "#00bb7f" : "#101215"}
                    cursor="pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

/* ==========================  Pequeños componentes  ========================== */

function AnioSlider({
  anio, min, max, onChange,
}: { anio: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="flex items-baseline justify-between">
        <span className="eyebrow">Año de referencia</span>
        <span className="mono num text-[14px] font-semibold text-ink">{anio}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={anio}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-[10.5px] text-ink-4 mono num">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </label>
  );
}

function KPICompact({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "danger" | "success" }) {
  const dot =
    accent === "danger" ? "bg-danger" :
    accent === "success" ? "bg-emerald-500" :
    "bg-ink";
  return (
    <div className="min-w-[150px]">
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="eyebrow">{label}</span>
      </div>
      <div className="mt-1 text-[20px] font-semibold leading-tight tracking-tight text-ink num">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-3 num">{sub}</div>}
    </div>
  );
}

function Insight({ dot, heading, body }: { dot: string; heading: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold leading-tight text-ink">{heading}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-ink-2">{body}</div>
      </div>
    </div>
  );
}

function HoverContent({
  nombre, total, yoy, vsAvg, narrativa, anio,
}: {
  nombre: string; total: number; yoy: number | null; vsAvg: number | null; narrativa: string; anio: number;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">Partido</div>
          <div className="mt-0.5 text-[15px] font-semibold text-ink">{nombre}</div>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">{anio}</div>
          <div className="mt-0.5 text-[18px] font-semibold text-ink num">{total.toLocaleString("es-AR")}</div>
          <div className="text-[10.5px] text-ink-3">hechos totales</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line-subtle pt-3">
        <DeltaPill label="vs. año anterior" pct={yoy} />
        <DeltaPill label="vs. prom. 5 años" pct={vsAvg} />
      </div>
      <div className="mt-3 text-[12px] leading-snug text-ink-2">{narrativa}</div>
    </>
  );
}

function DeltaPill({ label, pct }: { label: string; pct: number | null }) {
  const up = pct !== null && pct >= 0;
  const color = pct === null ? "text-ink-3" : up ? "text-danger" : "text-emerald-600";
  const bg = pct === null ? "bg-surface-1" : up ? "bg-danger/10" : "bg-emerald-500/10";
  return (
    <div className={`rounded-md ${bg} px-2 py-1.5`}>
      <div className="text-[10px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className={`mt-0.5 text-[14px] font-semibold num ${color}`}>
        {pct === null ? "—" : `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`}
      </div>
    </div>
  );
}

function RankingCard({
  title, subtitle, rows, tone, onSelect, selectedId,
}: {
  title: string;
  subtitle: string;
  rows: { id: string; nombre: string; total: number; yoy: number }[];
  tone: "danger" | "success";
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="mb-3">
        <div className={`eyebrow ${tone === "danger" ? "text-danger" : "text-emerald-600"}`}>{title}</div>
        <h3 className="mt-0.5 text-[14px] font-semibold text-ink">{subtitle}</h3>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.length === 0 && <li className="text-[12px] text-ink-3">Sin datos suficientes.</li>}
        {rows.map((r) => {
          const up = r.yoy >= 0;
          const active = r.id === selectedId;
          return (
            <li key={r.id}>
              <button
                onClick={() => onSelect(active ? null : r.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition ${
                  active ? "bg-emerald-500/10" : "hover:bg-surface-1"
                }`}
              >
                <span className="min-w-0 truncate text-[12.5px] text-ink">{r.nombre}</span>
                <span className={`num text-[12.5px] font-semibold ${up ? "text-danger" : "text-emerald-600"}`}>
                  {up ? "▲" : "▼"} {Math.abs(r.yoy).toFixed(1)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
