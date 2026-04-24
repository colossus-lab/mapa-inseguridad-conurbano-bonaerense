import { create } from "zustand";
import type { Dataset, Metric } from "./types";

type State = {
  dataset: Dataset | null;
  delitoId: string;
  anio: number;
  metric: Metric;
  municipioSel: string | null;
  setDataset: (d: Dataset) => void;
  setDelito: (id: string) => void;
  setAnio: (a: number) => void;
  setMetric: (m: Metric) => void;
  setMunicipio: (id: string | null) => void;
};

export const useDashboard = create<State>((set) => ({
  dataset: null,
  delitoId: "1", // Homicidios dolosos por defecto
  anio: 2024,
  metric: "tasa",
  municipioSel: null,
  setDataset: (d) => set((s) => ({
    dataset: d,
    anio: d.anios[d.anios.length - 1] ?? s.anio,
    delitoId: d.delitos.find((x) => x.id === s.delitoId)?.id ?? d.delitos[0].id,
  })),
  setDelito: (id) => set({ delitoId: id }),
  setAnio: (a) => set({ anio: a }),
  setMetric: (m) => set({ metric: m }),
  setMunicipio: (id) => set({ municipioSel: id }),
}));
