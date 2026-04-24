"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/store";
import { loadDataset } from "@/lib/data";
import ComparadorTab from "./ComparadorTab";
import ScrollytellingTab from "./ScrollytellingTab";
import Vista3DTab from "./Vista3DTab";

type TabKey = "panorama" | "comparador" | "informe";
const TABS: { key: TabKey; label: string; eyebrow: string; description: string }[] = [
  {
    key: "panorama",
    label: "Panorama general",
    eyebrow: "Reporte · Panel N.º 01",
    description:
      "Vista sandbox 3D blueprint del Conurbano Bonaerense — las barras hexagonales se extruyen con la cantidad (o tasa) del delito seleccionado, ponderadas por el gradiente de densidad urbana real del GBA.",
  },
  {
    key: "comparador",
    label: "Comparador temporal",
    eyebrow: "Reporte · Panel N.º 02",
    description:
      "Seleccioná hasta 8 partidos en el mapa para superponer sus series temporales y comparar la evolución del mismo delito a lo largo del tiempo.",
  },
  {
    key: "informe",
    label: "Informe ejecutivo",
    eyebrow: "Reporte · Panel N.º 03",
    description:
      "Lectura narrada en seis escenas sobre la evolución de la inseguridad en el Conurbano Bonaerense entre 2000 y 2024, basada en microdatos del SNIC.",
  },
];

export default function DashboardShell() {
  const { dataset, setDataset } = useDashboard();
  const [tab, setTab] = useState<TabKey>("panorama");

  useEffect(() => {
    if (!dataset) loadDataset().then(setDataset).catch(console.error);
  }, [dataset, setDataset]);

  if (!dataset) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink-3">
        <span className="eyebrow">Cargando datos SNIC…</span>
      </div>
    );
  }

  const rango = `${dataset.anios[0]}–${dataset.anios[dataset.anios.length - 1]}`;
  const meta = TABS.find((t) => t.key === tab)!;

  return (
    <div className="min-h-screen">
      {/* Top bar institucional */}
      <header className="border-b border-line-subtle bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink">
              Colossus Lab
            </span>
            <span className="h-3 w-px bg-line" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-ink-3">
              Observatorio · Seguridad
            </span>
          </div>
          <nav className="flex items-center gap-5 text-[12px] text-ink-2">
            <a href="https://www.colossuslab.org" target="_blank" rel="noreferrer" className="hover:text-ink">colossuslab.org</a>
            <a
              href="https://www.argentina.gob.ar/seguridad/estadisticascriminales"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              Fuente SNIC
            </a>
          </nav>
        </div>
      </header>

      {/* Hero con tabs */}
      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-[1100px] px-6 py-7 md:py-10">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_280px] md:items-end">
            <div>
              <div className="eyebrow mb-2">{meta.eyebrow}</div>
              <h1 className="text-[26px] font-semibold leading-[1.05] tracking-tight md:text-[36px]">
                Mapa de inseguridad
                <span className="block text-ink-3">Conurbano Bonaerense</span>
              </h1>
            </div>
            <dl className="grid grid-cols-3 gap-4 border-l border-line-subtle pl-6 md:grid-cols-1 md:gap-2.5">
              <Meta label="Cobertura" value="24 partidos" />
              <Meta label="Serie temporal" value={rango || "—"} />
              <Meta label="Delitos cubiertos" value={dataset ? `${dataset.delitos.length} categorías` : "—"} />
            </dl>
          </div>

          <TabsBar current={tab} onChange={setTab} />
        </div>
      </section>

      <main className="mx-auto max-w-[1100px] px-6 py-8">
        {!dataset ? (
          <div className="flex h-64 items-center justify-center text-ink-3">Cargando datos…</div>
        ) : tab === "panorama" ? (
          <Vista3DTab />
        ) : tab === "comparador" ? (
          <ComparadorTab />
        ) : (
          <ScrollytellingTab />
        )}
      </main>

      <footer className="mt-10 border-t border-line-subtle">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-6 py-6 text-[12px] text-ink-3">
          <div>
            Elaborado por <span className="font-semibold text-ink">Colossus Lab</span> · Datos oficiales
            del Ministerio de Seguridad de la Nación (SNIC).
          </div>
          <div className="mono">
            {dataset ? new Date(dataset.meta.generado).toISOString().slice(0, 10) : ""}
          </div>
        </div>
      </footer>
    </div>
  );
}

function TabsBar({ current, onChange }: { current: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <div className="mt-7 flex items-end gap-0 border-b border-line">
      {TABS.map((t, i) => {
        const active = t.key === current;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={[
              "relative -mb-px flex items-center gap-2 border-b-2 px-5 py-3 text-[13px] font-medium transition",
              active ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink",
            ].join(" ")}
          >
            <span className="mono text-[10.5px] text-ink-4">{String(i + 1).padStart(2, "0")}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-[15px] font-semibold text-ink num">{value}</div>
    </div>
  );
}
