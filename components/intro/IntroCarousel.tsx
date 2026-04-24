"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import AnimatedCounter from "./AnimatedCounter";
import Pictogram, { type Breakdown } from "./Pictogram";
import SignedLineChart, { type Point } from "./SignedLineChart";
import TypingTitle from "./TypingTitle";

export type SceneSerie = {
  kind: "serie";
  titulo: string;
  subtitulo?: string;
  caption?: string;
  data: Point[];
  format?: (n: number) => string;
};

export type SceneToggle = {
  nombre: string;
  id: string;
  valor: number;
  sublabel?: string;
  breakdown?: Breakdown;
};

export type ScenePictograma = {
  kind: "pictograma";
  titulo: string;
  subtitulo?: string;
  caption?: string;
  toggles: SceneToggle[];
};

export type Scene = SceneSerie | ScenePictograma;

type Props = {
  scenes: Scene[];
  onFinishExplore?: () => void;
  /** Toma toda la pantalla (modo bienvenida). */
  fullscreen?: boolean;
};

export default function IntroCarousel({ scenes, onFinishExplore, fullscreen = false }: Props) {
  const [active, setActive] = useState(0);
  const [titleDone, setTitleDone] = useState(false);
  const [visualDone, setVisualDone] = useState(false);
  const scene = scenes[active];

  // Reset estado cuando cambia de escena.
  useEffect(() => {
    setTitleDone(false);
    setVisualDone(false);
  }, [active]);

  const prev = useCallback(() => setActive((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setActive((i) => Math.min(scenes.length - 1, i + 1)), [scenes.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onFinishExplore?.();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev, onFinishExplore]);

  const canAdvance = titleDone && visualDone;
  const isLast = active === scenes.length - 1;

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Bienvenida · Mapa de inseguridad del Conurbano"
      className={
        fullscreen
          ? "relative flex min-h-screen w-full flex-col overflow-hidden bg-paper"
          : "relative flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-card"
      }
      style={fullscreen ? { height: "100vh" } : undefined}
    >
      {/* Marca de fondo sutil */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]">
        <div className="paper-grid h-full w-full" />
      </div>

      {/* Botón "saltar intro" */}
      <button
        onClick={onFinishExplore}
        className="absolute right-5 top-4 z-20 text-[11.5px] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
      >
        {fullscreen ? "Saltar bienvenida →" : "Saltar intro ↓"}
      </button>

      {/* Contador de escena */}
      <div className="absolute left-5 top-4 z-20 mono text-[11px] text-ink-3">
        {String(active + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-14 pt-10 md:px-10">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, position: "absolute" }}
            transition={{ duration: 0.25 }}
            className="flex w-full max-w-[880px] flex-col items-center gap-4"
          >
            {/* Subtitulo/eyebrow */}
            {scene.subtitulo && (
              <div className="eyebrow text-center">{scene.subtitulo}</div>
            )}

            {/* Title */}
            <h2 className="text-center text-[22px] font-semibold leading-tight tracking-tight text-ink md:text-[30px]">
              <TypingTitle
                text={scene.titulo}
                resetKey={active}
                delayPerChar={18}
                startDelay={80}
                onDone={() => setTitleDone(true)}
              />
            </h2>

            {/* Visual */}
            <div className="mt-1 w-full">
              {scene.kind === "serie" ? (
                <SerieScene scene={scene} onDone={() => setVisualDone(true)} />
              ) : (
                <PictogramaScene scene={scene} onDone={() => setVisualDone(true)} titleDone={titleDone} />
              )}
            </div>

            {/* Caption */}
            {scene.caption && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: visualDone ? 1 : 0 }}
                transition={{ duration: 0.4 }}
                className="text-center text-[13px] text-ink-3"
              >
                {scene.caption}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Flecha izquierda */}
      {active > 0 && (
        <button
          onClick={prev}
          aria-label="Anterior"
          className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-line bg-white/90 p-2 text-ink shadow-card transition hover:bg-white md:left-6"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}

      {/* Flecha derecha / CTA final */}
      <AnimatePresence>
        {canAdvance && !isLast && (
          <motion.button
            key="right"
            onClick={next}
            aria-label="Siguiente"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.25 }}
            className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 items-center gap-2 rounded-full border border-line bg-white/90 py-2 pl-3 pr-3 text-ink shadow-card transition hover:bg-white md:right-6"
          >
            <span className="hidden text-[12px] text-ink-2 md:inline">Siguiente</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </motion.button>
        )}
        {canAdvance && isLast && onFinishExplore && (
          <motion.button
            key="explore"
            onClick={onFinishExplore}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-6 py-3 text-[13px] font-medium text-paper shadow-float transition hover:bg-emerald-600"
          >
            {fullscreen ? "Entrar al dashboard →" : "Explorar a fondo ↓"}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
        {scenes.map((_, i) => (
          <button
            key={i}
            aria-label={`Ir a escena ${i + 1}`}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-ink" : "w-1.5 bg-line-strong hover:bg-ink-3"}`}
          />
        ))}
      </div>
    </section>
  );
}

/* ========================  Escenas  ======================== */

function SerieScene({ scene, onDone }: { scene: SceneSerie; onDone: () => void }) {
  const ultimo = scene.data[scene.data.length - 1]?.valor ?? 0;
  const primero = scene.data[0]?.valor ?? 0;
  const delta = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full">
        <SignedLineChart
          data={scene.data}
          height={260}
          startDelay={100}
          totalDuration={500}
          onDone={onDone}
          format={scene.format}
        />
      </div>
      <div className="flex items-baseline gap-6">
        <div className="text-center">
          <div className="eyebrow">{scene.data[scene.data.length - 1]?.anio ?? ""}</div>
          <div className="mt-0.5 text-[24px] font-semibold text-ink num md:text-[28px]">
            <AnimatedCounter
              value={ultimo}
              startDelay={100 + 500}
              format={scene.format ? (n) => scene.format!(Math.round(n)) : undefined}
            />
          </div>
        </div>
        <div className="text-center">
          <div className="eyebrow">{scene.data[0]?.anio ?? ""} → {scene.data[scene.data.length - 1]?.anio ?? ""}</div>
          <div className={`mt-0.5 text-[16px] font-semibold num md:text-[18px] ${delta >= 0 ? "text-danger" : "text-emerald-600"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function PictogramaScene({
  scene,
  onDone,
  titleDone,
}: {
  scene: ScenePictograma;
  onDone: () => void;
  titleDone: boolean;
}) {
  const [sel, setSel] = useState(scene.toggles[0]?.id ?? "");
  const current = useMemo(
    () => scene.toggles.find((t) => t.id === sel) ?? scene.toggles[0],
    [scene.toggles, sel]
  );

  // Marcamos "visualDone" un tiempo después de que aparece el título.
  useEffect(() => {
    if (!titleDone) return;
    const t = setTimeout(onDone, 250);
    return () => clearTimeout(t);
  }, [titleDone, onDone]);

  if (!current) return null;

  const hasGender = current.breakdown?.coverage === true;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Toggle chips */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {scene.toggles.map((t) => (
          <button
            key={t.id}
            onClick={() => setSel(t.id)}
            className={[
              "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition",
              t.id === sel
                ? "border-ink bg-ink text-paper"
                : "border-line bg-white text-ink-2 hover:border-line-strong hover:text-ink",
            ].join(" ")}
          >
            {t.nombre}
          </button>
        ))}
      </div>

      {hasGender ? (
        <>
          {/* Contador grande + pictograma coloreado por género */}
          <div className="text-center">
            <div className="text-[30px] font-semibold leading-none text-ink num md:text-[38px]">
              <AnimatedCounter value={current.valor} duration={900} />
            </div>
            <div className="mt-1 text-[12px] text-ink-3">{current.nombre} — último año</div>
          </div>

          <Pictogram
            count={current.valor}
            label={current.nombre}
            sublabel={current.sublabel}
            breakdown={current.breakdown}
            targetFigures={100}
            maxFigures={140}
          />
        </>
      ) : (
        /* Delito sin desglose de género: solo un número grande subiendo. */
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 py-6">
          <div className="text-[56px] font-semibold leading-none text-ink num md:text-[76px]">
            <AnimatedCounter value={current.valor} duration={1400} />
          </div>
          <div className="text-[13px] text-ink-2">
            {current.nombre} — <span className="font-semibold text-ink">último año</span>
          </div>
          {current.sublabel && (
            <div className="max-w-md text-center text-[12px] italic text-ink-3">{current.sublabel}</div>
          )}
        </div>
      )}
    </div>
  );
}
