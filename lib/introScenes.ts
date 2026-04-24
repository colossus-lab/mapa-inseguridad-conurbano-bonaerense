import type { Scene } from "@/components/intro/IntroCarousel";
import type { Dataset } from "./types";
import { generoVictimas, serieConurbanoDelito } from "./analytics";

/**
 * Escenas de la intro cinematográfica — bienvenida a la web.
 * Series temporales 2019 → último año disponible.
 */
export function buildIntroScenes(dataset: Dataset): Scene[] {
  const FROM = 2019;
  const iUlt = dataset.anios.length - 1;
  const ultimoAnio = dataset.anios[iUlt];
  const ultTotal = dataset.partidos.reduce((s, _p, pi) => {
    let x = 0;
    for (let d = 0; d < dataset.delitos.length; d++) x += dataset.hechos[pi][d][iUlt] ?? 0;
    return s + x;
  }, 0);
  const valDelito = (id: string) => {
    const di = dataset.delitos.findIndex((d) => d.id === id);
    if (di < 0) return 0;
    return dataset.partidos.reduce((s, _p, pi) => s + (dataset.hechos[pi][di][iUlt] ?? 0), 0);
  };
  const brk = (id: string | "total") => generoVictimas(dataset, id, iUlt);

  return [
    {
      kind: "serie",
      titulo: "Cantidad de delitos — Gran Buenos Aires",
      subtitulo: `Panorama general · ${FROM}–${ultimoAnio}`,
      data: serieConurbanoDelito(dataset, "total", FROM),
    },
    {
      kind: "pictograma",
      titulo: `Cifras del último año · ${ultimoAnio}`,
      toggles: [
        { id: "total", nombre: "Total", valor: ultTotal, sublabel: "Todas las categorías SNIC sumadas.", breakdown: brk("total") },
        { id: "1", nombre: "Homicidios", valor: valDelito("1"), sublabel: "Homicidios dolosos.", breakdown: brk("1") },
        { id: "15", nombre: "Robos", valor: valDelito("15"), sublabel: "Robos con y sin arma.", breakdown: brk("15") },
        { id: "19", nombre: "Hurtos", valor: valDelito("19"), sublabel: "Sustracción sin violencia ni amenaza.", breakdown: brk("19") },
        { id: "5", nombre: "Lesiones dolosas", valor: valDelito("5"), sublabel: "Violencia interpersonal no letal.", breakdown: brk("5") },
        { id: "13", nombre: "Amenazas", valor: valDelito("13"), sublabel: "Coacción psicológica o verbal.", breakdown: brk("13") },
      ],
    },
    {
      kind: "serie",
      titulo: "Homicidios dolosos",
      subtitulo: `${FROM}–${ultimoAnio}`,
      data: serieConurbanoDelito(dataset, "1", FROM),
    },
    {
      kind: "serie",
      titulo: "Robos",
      subtitulo: `${FROM}–${ultimoAnio}`,
      data: serieConurbanoDelito(dataset, "15", FROM),
    },
    {
      kind: "serie",
      titulo: "Lesiones dolosas",
      subtitulo: `${FROM}–${ultimoAnio}`,
      data: serieConurbanoDelito(dataset, "5", FROM),
    },
    {
      kind: "serie",
      titulo: "Amenazas",
      subtitulo: `${FROM}–${ultimoAnio}`,
      data: serieConurbanoDelito(dataset, "13", FROM),
    },
  ];
}
