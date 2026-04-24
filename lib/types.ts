export type Partido = { id: string; nombre: string };
export type Delito = { id: string; nombre: string };

export type Dataset = {
  meta: {
    generado: string;
    fuente: string;
    unidad_tasa: string;
    filas_totales: number;
    filas_usadas: number;
    nota_genero?: string;
  };
  partidos: Partido[];
  delitos: Delito[];
  anios: number[];
  /** hechos[partidoIdx][delitoIdx][anioIdx] */
  hechos: number[][][];
  /** tasa[partidoIdx][delitoIdx][anioIdx] — por 100.000 hab */
  tasa: number[][][];
  /** víctimas masc [partidoIdx][delitoIdx][anioIdx] — sólo para delitos con desglose */
  victimas_masc: number[][][];
  /** víctimas fem */
  victimas_fem: number[][][];
  /** víctimas sin dato de género */
  victimas_sd: number[][][];
};

export type Metric = "hechos" | "tasa";
