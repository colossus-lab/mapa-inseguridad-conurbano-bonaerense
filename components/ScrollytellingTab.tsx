"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, ReferenceArea, Cell, LabelList,
} from "recharts";
import { useDashboard } from "@/lib/store";
import { loadGeoJSON } from "@/lib/data";
import { buildStoryData, type StorySceneKey } from "@/lib/scrollytellingData";

const Choropleth = dynamic(() => import("./Choropleth"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-ink-3">Cargando mapa…</div>,
});

const SCENES: {
  key: StorySceneKey;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
}[] = [
  {
    key: "escala",
    eyebrow: "§ 1 · La escala",
    title: "Más de 300.000 hechos al año en 24 partidos",
    body: (
      <>
        <p>
          El <strong>Conurbano Bonaerense</strong> concentra cerca de <strong>10 millones</strong> de
          habitantes distribuidos en 24 partidos que rodean a la Ciudad de Buenos Aires. En el último
          año disponible del Sistema Nacional de Información Criminal (SNIC), se registraron
          <strong> más de 318 mil hechos</strong> delictivos en toda su superficie.
        </p>
        <p>
          Esta cifra reúne 32 categorías oficiales: desde homicidios dolosos y robos hasta delitos
          contra la administración pública y contravenciones. El mapa a la derecha muestra el peso
          absoluto de cada partido en ese universo.
        </p>
      </>
    ),
  },
  {
    key: "veinticincoAnios",
    eyebrow: "§ 2 · Un cuarto de siglo",
    title: "La serie larga: subas, caídas y un pico pre-pandemia",
    body: (
      <>
        <p>
          Entre <strong>2000 y 2024</strong> la inseguridad en el Conurbano creció un 44% en volumen
          total, pero no en línea recta. La serie muestra un valle entre 2005 y 2010, una
          recuperación hasta 2014, y una <strong>aceleración sostenida</strong> desde 2016 que alcanzó
          su punto máximo en <strong>2019</strong> con 324 mil hechos.
        </p>
        <p>
          La pandemia produjo una caída transitoria del 17% en 2020, pero los registros volvieron
          rápidamente al rango alto. Desde 2021, el Conurbano se estabilizó cerca del <strong>máximo
          histórico</strong> — sin superarlo, pero sin retroceder.
        </p>
      </>
    ),
  },
  {
    key: "concentracion",
    eyebrow: "§ 3 · Concentración territorial",
    title: "La Matanza explica 1 de cada 6 delitos del Conurbano",
    body: (
      <>
        <p>
          La carga delictiva no se distribuye de forma uniforme. <strong>La Matanza</strong> —el
          partido más poblado de la Argentina— concentra por sí sola el <strong>16% del total</strong>,
          con más de 50 mil hechos registrados en el último año.
        </p>
        <p>
          Si sumamos los tres partidos con mayor volumen (La Matanza, Quilmes y Lomas de Zamora),
          llegan al <strong>27,5% del Conurbano</strong>. En el extremo opuesto, los cinco partidos
          con menor volumen absoluto aportan en conjunto menos del 10%. La distribución muestra una
          amplia dispersión entre municipios vecinos.
        </p>
      </>
    ),
  },
  {
    key: "paradoja",
    eyebrow: "§ 4 · Homicidios vs. total",
    title: "Los homicidios dolosos cayeron mientras los delitos totales subían",
    body: (
      <>
        <p>
          Los <strong>homicidios dolosos</strong> mostraron una tendencia descendente a lo largo de
          estos 25 años. La tasa promedio del Conurbano pasó de <strong>14,4 por cada 100.000
          habitantes</strong> en 2001 a valores entre <strong>3,8 y 4,5</strong> en el último lustro.
        </p>
        <p>
          En términos absolutos, los homicidios cayeron un 43% respecto al año 2000. El descenso no es
          homogéneo: coexiste con <strong>picos locales</strong> —como el ciclo 2012-2014— y con
          partidos que mantienen tasas entre 5 y 8 /100k (José C. Paz, General San Martín, Moreno).
          La serie de homicidios dibuja así una trayectoria opuesta a la del volumen total de delitos
          que se muestra en la escena anterior.
        </p>
      </>
    ),
  },
  {
    key: "composicion",
    eyebrow: "§ 5 · La composición cambió",
    title: "Lesiones, amenazas y ciberdelitos ganaron peso en la matriz delictiva",
    body: (
      <>
        <p>
          El mix delictivo del Conurbano se transformó desde 2000. Los <strong>robos</strong> —la
          categoría con mayor volumen— crecieron un 26%, pero perdieron peso relativo: representan
          hoy el 27% del total, frente al 31% de entonces.
        </p>
        <p>
          En paralelo, crecieron categorías antes más marginales: <strong>lesiones dolosas</strong>
          {" "}(+94%), <strong>amenazas</strong> (+77%), <strong>hurtos</strong> (+61%) y, sobre todo,
          la canasta <strong>otros delitos contra la propiedad</strong> (+160%), donde el SNIC agrupa
          las estafas virtuales. Una parte del aumento en estas categorías puede deberse a mayor
          registro y denuncia (ver notas metodológicas al pie).
        </p>
      </>
    ),
  },
  {
    key: "ganadoresPerdedores",
    eyebrow: "§ 6 · Heterogeneidad territorial",
    title: "Berazategui, Hurlingham y Quilmes lideran la reducción de homicidios",
    body: (
      <>
        <p>
          Si tomamos <strong>2015 como línea de base</strong> —último pico relevante de homicidios—
          y miramos hasta el último año disponible, aparecen patrones muy distintos entre partidos
          vecinos.
        </p>
        <p>
          <strong>Berazategui</strong> (-60%), <strong>Hurlingham</strong> (-59%),{" "}
          <strong>Quilmes</strong> (-54%), <strong>San Fernando</strong> (-52%) y{" "}
          <strong>Lanús</strong> (-52%) registran las mayores caídas. En el otro extremo,{" "}
          <strong>San Isidro</strong> muestra un aumento del <strong>+51%</strong>. El resto de los
          partidos presenta descensos más moderados.
        </p>
        <p>
          A nivel agregado, los hechos delictivos totales del Conurbano siguen cerca del máximo
          histórico alcanzado en 2019, mientras que la tasa promedio de homicidios permanece por
          debajo del promedio de las dos décadas previas. Los partidos no se mueven al unísono: los
          promedios a escala del Conurbano ocultan trayectorias locales muy diversas.
        </p>
      </>
    ),
  },
];

export default function ScrollytellingTab() {
  const { dataset } = useDashboard();
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [active, setActive] = useState<StorySceneKey>("escala");
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => { loadGeoJSON().then(setGeo).catch(console.error); }, []);

  useEffect(() => {
    const tick = () => {
      const pivot = window.innerHeight * 0.4;
      let closest: StorySceneKey | null = null;
      let min = Infinity;
      (Object.keys(refs.current) as StorySceneKey[]).forEach((k) => {
        const el = refs.current[k];
        if (!el) return;
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const dist = Math.abs(center - pivot);
        if (dist < min) { min = dist; closest = k; }
      });
      if (closest) setActive(closest);
    };
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, [dataset]);

  const story = useMemo(() => (dataset ? buildStoryData(dataset) : null), [dataset]);
  if (!dataset || !story) return null;

  return (
    <div className="flex flex-col gap-10">
      <ExecutiveSummary story={story} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,45%)_minmax(0,55%)]">
        <div className="flex flex-col gap-[55vh] pt-[18vh] pb-[35vh]">
          {SCENES.map((s) => (
            <section
              key={s.key}
              data-scene={s.key}
              ref={(el) => { refs.current[s.key] = el; }}
              className="max-w-xl"
            >
              <div className={`eyebrow mb-2 ${active === s.key ? "text-emerald-600" : ""}`}>{s.eyebrow}</div>
              <h3 className="mb-4 text-[26px] font-semibold leading-tight tracking-tight text-ink">
                {s.title}
              </h3>
              <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink-2">
                {s.body}
              </div>
              {/* Visual inline para mobile */}
              <div className="mt-6 h-[380px] rounded-xl border border-line bg-white p-2 shadow-card lg:hidden">
                <SceneVisual sceneKey={s.key} geo={geo} story={story} />
              </div>
            </section>
          ))}
        </div>

        {/* Sticky visual — desktop */}
        <div className="hidden lg:block">
          <div className="sticky top-[12vh] h-[76vh] rounded-xl border border-line bg-white p-4 shadow-card">
            <SceneVisual sceneKey={active} geo={geo} story={story} />
          </div>
        </div>
      </div>

      <Footnote />
    </div>
  );
}

/* ==========================  Resumen ejecutivo  ========================== */

function ExecutiveSummary({ story }: { story: ReturnType<typeof buildStoryData> }) {
  const hom = story.homicidios;
  const items = [
    { label: "Hechos totales registrados", value: story.escala.totalUltimo.toLocaleString("es-AR"), foot: `24 partidos · ${story.escala.anioUltimo}` },
    { label: "Partidos que explican ¼ del total", value: "3", foot: `La Matanza, Quilmes y Lomas de Zamora (${story.concentracion.top3Pct.toFixed(1)}%)` },
    { label: "Homicidios dolosos (tasa /100k)", value: hom.tasaUltimo.toFixed(1), foot: `${hom.deltaPct >= 0 ? "+" : ""}${hom.deltaPct.toFixed(0)}% vs 2000` },
    { label: "Cambio total de hechos", value: `+44%`, foot: `2000 → ${story.escala.anioUltimo}` },
  ];
  return (
    <section className="rounded-xl border border-line bg-white p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-line-subtle pb-3">
        <div>
          <div className="eyebrow">Resumen ejecutivo</div>
          <h2 className="mt-1 text-[17px] font-semibold text-ink">Cuatro cifras que ordenan la lectura</h2>
        </div>
        <span className="text-[11px] text-ink-3">Fuente: SNIC · elaboración propia</span>
      </div>
      <dl className="grid gap-5 md:grid-cols-4">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="eyebrow">{it.label}</dt>
            <dd className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink num">{it.value}</dd>
            <dd className="mt-0.5 text-[12px] text-ink-3 num">{it.foot}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Footnote() {
  return (
    <section className="rounded-xl border border-line-subtle bg-surface-1/50 p-6">
      <div className="eyebrow mb-2">Notas metodológicas</div>
      <ul className="list-inside list-disc flex flex-col gap-1 text-[12.5px] leading-relaxed text-ink-2">
        <li>Los totales suman las 32 categorías del SNIC a nivel parent-code (homicidios, robos, hurtos, amenazas, etc.), agrupando las subcategorías introducidas en 2023.</li>
        <li>La tasa se informa por 100.000 habitantes según la población del departamento en cada año de la serie SNIC.</li>
        <li>Un volumen creciente puede deberse tanto a más hechos como a mejor registro (especialmente en ciberdelitos y delitos sexuales, donde la denuncia fue históricamente baja).</li>
        <li>Quilmes unifica los códigos INDEC 06058 (2023+) y 06658 (histórico) para mantener la serie continua.</li>
      </ul>
    </section>
  );
}

/* ==========================  Visuales  ========================== */

function SceneVisual({
  sceneKey, geo, story,
}: {
  sceneKey: StorySceneKey;
  geo: GeoJSON.FeatureCollection | null;
  story: ReturnType<typeof buildStoryData>;
}) {
  switch (sceneKey) {
    case "escala": return <VizEscala geo={geo} story={story} />;
    case "veinticincoAnios": return <VizSerie story={story} />;
    case "concentracion": return <VizConcentracion story={story} />;
    case "paradoja": return <VizParadoja story={story} />;
    case "composicion": return <VizComposicion story={story} />;
    case "ganadoresPerdedores": return <VizGanadoresPerdedores story={story} />;
  }
}

function VizEscala({ geo, story }: { geo: GeoJSON.FeatureCollection | null; story: ReturnType<typeof buildStoryData> }) {
  return (
    <div className="flex h-full flex-col">
      <VizTitle title={`Hechos totales · ${story.escala.anioUltimo}`} subtitle="Suma de todas las categorías SNIC" />
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg">
        <Choropleth
          geo={geo}
          values={story.escala.valoresPorPartido}
          legendTitle={`Hechos · ${story.escala.anioUltimo}`}
          legendSubtitle="Todas las categorías SNIC"
          valueFormat={(n) => n.toLocaleString("es-AR")}
        />
      </div>
    </div>
  );
}

function VizSerie({ story }: { story: ReturnType<typeof buildStoryData> }) {
  return (
    <div className="flex h-full flex-col">
      <VizTitle title="Hechos totales · Conurbano" subtitle="Serie anual 2000–presente" />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer>
          <LineChart data={story.serieTotales} margin={{ top: 10, right: 24, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00bb7f" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#00bb7f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#0303031a" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="anio" tick={{ fill: "#66696f", fontSize: 11 }} axisLine={{ stroke: "#0303031a" }} tickLine={false} />
            <YAxis tick={{ fill: "#66696f", fontSize: 11 }} axisLine={false} tickLine={false} width={52}
              tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <Tooltip
              contentStyle={{ background: "#ffffff", border: "1px solid #0303031a", borderRadius: 6, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              formatter={(v: unknown) => [Number(v).toLocaleString("es-AR"), "Hechos"]}
            />
            <ReferenceArea x1={2020} x2={2021} fill="#0303031a" />
            <ReferenceLine x={2019} stroke="#00bb7f" strokeDasharray="3 3"
              label={{ value: "Pico 2019", position: "top", fill: "#00bb7f", fontSize: 10 }} />
            <Line type="monotone" dataKey="valor" stroke="#00bb7f" strokeWidth={2.5} dot={{ r: 2.5, fill: "#00bb7f", stroke: "#fff", strokeWidth: 1.5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-[11px] text-ink-3">Zona sombreada: año de pandemia (2020).</div>
    </div>
  );
}

function VizConcentracion({ story }: { story: ReturnType<typeof buildStoryData> }) {
  const data = story.concentracion.rows;
  return (
    <div className="flex h-full flex-col">
      <VizTitle title={`Ranking por volumen · ${story.concentracion.anio}`} subtitle="Partidos del Conurbano" />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 0 }}>
            <XAxis type="number" tick={{ fill: "#66696f", fontSize: 10 }} axisLine={{ stroke: "#0303031a" }} tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <YAxis type="category" dataKey="nombre" tick={{ fill: "#101215", fontSize: 10.5 }} width={130} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#ffffff", border: "1px solid #0303031a", borderRadius: 6, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              formatter={(v: unknown) => [Number(v).toLocaleString("es-AR"), "Hechos"]}
            />
            <Bar dataKey="valor" radius={[0, 3, 3, 0]} maxBarSize={13}>
              {data.map((d) => (
                <Cell key={d.id} fill={d.nombre === "La Matanza" ? "#00bb7f" : "#101215"} />
              ))}
              <LabelList dataKey="pct" position="right" fontSize={10} fill="#66696f"
                formatter={(v: number) => `${v.toFixed(1)}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function VizParadoja({ story }: { story: ReturnType<typeof buildStoryData> }) {
  return (
    <div className="flex h-full flex-col">
      <VizTitle title="Homicidios dolosos — tasa promedio Conurbano" subtitle="Por 100.000 habitantes" />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer>
          <LineChart data={story.homicidios.tasaConurbano} margin={{ top: 10, right: 24, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#0303031a" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="anio" tick={{ fill: "#66696f", fontSize: 11 }} axisLine={{ stroke: "#0303031a" }} tickLine={false} />
            <YAxis tick={{ fill: "#66696f", fontSize: 11 }} axisLine={false} tickLine={false} width={38}
              domain={[0, 'dataMax + 2']} />
            <Tooltip
              contentStyle={{ background: "#ffffff", border: "1px solid #0303031a", borderRadius: 6, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              formatter={(v: unknown) => [Number(v).toFixed(2), "Tasa /100k"]}
            />
            <ReferenceLine y={story.homicidios.tasa2000} stroke="#ef4444" strokeDasharray="3 3"
              label={{ value: `${story.homicidios.tasa2000.toFixed(1)} en 2000`, position: "insideTopLeft", fill: "#ef4444", fontSize: 10 }} />
            <Line type="monotone" dataKey="valor" stroke="#101215" strokeWidth={2.5} dot={{ r: 2.5, fill: "#101215", stroke: "#fff", strokeWidth: 1.5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function VizComposicion({ story }: { story: ReturnType<typeof buildStoryData> }) {
  const data = [...story.composicion.delitosTop]
    .filter((d) => d.deltaPct !== null)
    .sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0));
  return (
    <div className="flex h-full flex-col">
      <VizTitle title="Variación por categoría" subtitle={`2000 → ${story.escala.anioUltimo}`} />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
            <XAxis type="number" tick={{ fill: "#66696f", fontSize: 10 }} axisLine={{ stroke: "#0303031a" }} tickLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
            <YAxis type="category" dataKey="nombre" tick={{ fill: "#101215", fontSize: 10.5 }} width={170} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#ffffff", border: "1px solid #0303031a", borderRadius: 6, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              formatter={(v: unknown) => [`${Number(v).toFixed(0)}%`, "Cambio"]}
            />
            <ReferenceLine x={0} stroke="#0303033d" />
            <Bar dataKey="deltaPct" radius={[0, 3, 3, 0]} maxBarSize={15}>
              {data.map((d) => (
                <Cell key={d.id} fill={(d.deltaPct ?? 0) >= 0 ? "#ef4444" : "#00bb7f"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function VizGanadoresPerdedores({ story }: { story: ReturnType<typeof buildStoryData> }) {
  const data = story.cambioHomicidios.rows.filter((r) => r.deltaPct !== null);
  return (
    <div className="flex h-full flex-col">
      <VizTitle
        title={`Cambio en homicidios · ${story.cambioHomicidios.anioBase} → ${story.cambioHomicidios.anioUltimo}`}
        subtitle="Variación porcentual de la tasa /100k por partido"
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
            <XAxis type="number" tick={{ fill: "#66696f", fontSize: 10 }} axisLine={{ stroke: "#0303031a" }} tickLine={false}
              tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`} />
            <YAxis type="category" dataKey="nombre" tick={{ fill: "#101215", fontSize: 10.5 }} width={140} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#ffffff", border: "1px solid #0303031a", borderRadius: 6, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`, "Variación"]}
            />
            <ReferenceLine x={0} stroke="#0303033d" />
            <Bar dataKey="deltaPct" radius={[0, 3, 3, 0]} maxBarSize={14}>
              {data.map((d) => (
                <Cell key={d.id} fill={(d.deltaPct ?? 0) >= 0 ? "#ef4444" : "#00bb7f"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function VizTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-2">
      <div className="eyebrow">{subtitle}</div>
      <h4 className="mt-0.5 text-[14.5px] font-semibold text-ink">{title}</h4>
    </div>
  );
}
