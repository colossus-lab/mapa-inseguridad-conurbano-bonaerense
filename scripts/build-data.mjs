// ETL: SNIC departamental CSV → public/data/conurbano.json
// Filtra los 24 partidos del Conurbano Bonaerense, agrupa por (partido, año, delito-parent),
// y emite un payload columnar compacto listo para el dashboard.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const CSV_PATH =
  process.env.SNIC_CSV ??
  "C:/Users/dante/Desktop/Laboratorio Colossus/Pipeline OpenArg/datos_abiertos/datasets/seguridad/seguridad-snic-departamental-estadisticas-criminales-republica-argentina-por-departamentos/estadísticas-criminales-en-la-república-argentina-por-departamentos-(panel)-(.csv).csv";

const OUT_DIR = path.join(process.cwd(), "public", "data");
const OUT_JSON = path.join(OUT_DIR, "conurbano.json");

// Los 24 partidos del GBA — IDs canónicos INDEC.
// Nota: SNIC tiene 06058 (Quilmes 2023+) y 06658 (Quilmes histórico). Se unifican en 06658.
const PARTIDOS = [
  { id: "06028", nombre: "Almirante Brown" },
  { id: "06035", nombre: "Avellaneda" },
  { id: "06091", nombre: "Berazategui" },
  { id: "06260", nombre: "Esteban Echeverría" },
  { id: "06270", nombre: "Ezeiza" },
  { id: "06274", nombre: "Florencio Varela" },
  { id: "06371", nombre: "General San Martín" },
  { id: "06408", nombre: "Hurlingham" },
  { id: "06410", nombre: "Ituzaingó" },
  { id: "06412", nombre: "José C. Paz" },
  { id: "06427", nombre: "La Matanza" },
  { id: "06434", nombre: "Lanús" },
  { id: "06490", nombre: "Lomas de Zamora" },
  { id: "06515", nombre: "Malvinas Argentinas" },
  { id: "06539", nombre: "Merlo" },
  { id: "06560", nombre: "Moreno" },
  { id: "06568", nombre: "Morón" },
  { id: "06658", nombre: "Quilmes" },
  { id: "06749", nombre: "San Fernando" },
  { id: "06756", nombre: "San Isidro" },
  { id: "06760", nombre: "San Miguel" },
  { id: "06805", nombre: "Tigre" },
  { id: "06840", nombre: "Tres de Febrero" },
  { id: "06861", nombre: "Vicente López" },
];

const PARTIDO_ID_SET = new Set(PARTIDOS.map((p) => p.id));
// Alias: Quilmes 06058 (rows 2023+) → 06658.
const ID_ALIAS = { "06058": "06658" };

// Nombres "lindos" curados por parent code (SNIC). Si no está en el mapa, usa el nombre del CSV.
const DELITO_NAMES = {
  "1": "Homicidios dolosos",
  "2": "Homicidios dolosos (tentativa)",
  "3": "Muertes en accidentes viales",
  "4": "Homicidios culposos (otros)",
  "5": "Lesiones dolosas",
  "6": "Lesiones culposas viales",
  "7": "Lesiones culposas (otras)",
  "8": "Otros delitos contra las personas",
  "9": "Delitos contra el honor",
  "10": "Abusos sexuales con acceso carnal",
  "11": "Otros delitos contra la integridad sexual",
  "12": "Delitos contra el estado civil",
  "13": "Amenazas",
  "14": "Delitos contra la libertad",
  "15": "Robos",
  "16": "Tentativas de robo",
  "17": "Robos agravados (con lesiones/muertes)",
  "18": "Tentativas de robo agravado",
  "19": "Hurtos",
  "20": "Tentativas de hurto",
  "21": "Otros delitos contra la propiedad",
  "22": "Delitos contra la seguridad pública",
  "23": "Delitos contra el orden público",
  "24": "Delitos contra la seguridad de la nación",
  "25": "Delitos contra poderes públicos",
  "26": "Delitos contra la administración pública",
  "27": "Delitos contra la fe pública",
  "28": "Estupefacientes (Ley 23.737)",
  "29": "Otros delitos (leyes especiales)",
  "30": "Contravenciones",
  "31": "Suicidios (consumados)",
  "32": "Delitos contra el orden económico",
};

function parseCsvLine(line) {
  // CSV delimitado por ';' sin comillas según inspección → split directo.
  return line.split(";");
}

function parentDelitoId(snicId) {
  if (!snicId) return null;
  const s = String(snicId).trim();
  const idx = s.indexOf("_");
  return idx === -1 ? s : s.slice(0, idx);
}

function toNum(v) {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error("CSV no encontrado:", CSV_PATH);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Map<partido, Map<delito, Map<anio, {h, v, vM, vF, vSD, tSum, tN}>>>
  const acc = new Map();
  const delitosSeen = new Map(); // parent -> nombre (prioriza DELITO_NAMES)
  const aniosSeen = new Set();

  const stream = fs.createReadStream(CSV_PATH, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let header = null;
  let idx = {};
  let rowCount = 0;
  let keptCount = 0;

  for await (const rawLine of rl) {
    const line = rawLine.replace(/\uFEFF/g, "");
    if (!line) continue;
    if (!header) {
      header = parseCsvLine(line);
      header.forEach((h, i) => (idx[h.trim()] = i));
      continue;
    }
    rowCount++;
    const cols = parseCsvLine(line);
    if (cols[idx.provincia_id] !== "06") continue;
    const rawPartido = cols[idx.departamento_id];
    const partidoId = ID_ALIAS[rawPartido] ?? rawPartido;
    if (!PARTIDO_ID_SET.has(partidoId)) continue;

    const snicId = cols[idx.codigo_delito_snic_id];
    const parent = parentDelitoId(snicId);
    if (!parent) continue;
    const anio = Number(cols[idx.anio]);
    if (!Number.isFinite(anio) || anio < 2000) continue;

    const hechos = toNum(cols[idx.cantidad_hechos]);
    const victimas = toNum(cols[idx.cantidad_victimas]);
    const vMasc = toNum(cols[idx.cantidad_victimas_masc]);
    const vFem = toNum(cols[idx.cantidad_victimas_fem]);
    const vSd = toNum(cols[idx.cantidad_victimas_sd]);
    const tasa = toNum(cols[idx.tasa_hechos]);

    aniosSeen.add(anio);
    if (!delitosSeen.has(parent)) {
      delitosSeen.set(parent, DELITO_NAMES[parent] ?? cols[idx.codigo_delito_snic_nombre] ?? `Delito ${parent}`);
    }

    let byDelito = acc.get(partidoId);
    if (!byDelito) { byDelito = new Map(); acc.set(partidoId, byDelito); }
    let byAnio = byDelito.get(parent);
    if (!byAnio) { byAnio = new Map(); byDelito.set(parent, byAnio); }
    let entry = byAnio.get(anio);
    if (!entry) { entry = { h: 0, v: 0, vM: 0, vF: 0, vSD: 0, tSum: 0, tN: 0 }; byAnio.set(anio, entry); }

    entry.h += hechos;
    entry.v += victimas;
    entry.vM += vMasc;
    entry.vF += vFem;
    entry.vSD += vSd;
    if (tasa > 0) { entry.tSum += tasa; entry.tN += 1; }

    keptCount++;
  }

  // Orden canónico.
  const anios = [...aniosSeen].sort((a, b) => a - b);
  const delitos = [...delitosSeen.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => Number(a.id) - Number(b.id));
  const partidos = PARTIDOS;

  // Estructura columnar [partidoIdx][delitoIdx][anioIdx]
  const nP = partidos.length, nD = delitos.length, nA = anios.length;
  const mkMat = () => Array.from({ length: nP }, () => Array.from({ length: nD }, () => new Array(nA).fill(0)));
  const hechos = mkMat();
  const tasa = mkMat();
  const victimasMasc = mkMat();
  const victimasFem = mkMat();
  const victimasSd = mkMat();

  partidos.forEach((p, pi) => {
    const byDelito = acc.get(p.id);
    if (!byDelito) return;
    delitos.forEach((d, di) => {
      const byAnio = byDelito.get(d.id);
      if (!byAnio) return;
      anios.forEach((a, ai) => {
        const entry = byAnio.get(a);
        if (!entry) return;
        hechos[pi][di][ai] = entry.h;
        tasa[pi][di][ai] = entry.tN > 0 ? +(entry.tSum / entry.tN).toFixed(2) : 0;
        victimasMasc[pi][di][ai] = entry.vM;
        victimasFem[pi][di][ai] = entry.vF;
        victimasSd[pi][di][ai] = entry.vSD;
      });
    });
  });

  const payload = {
    meta: {
      generado: new Date().toISOString(),
      fuente: "SNIC — Sistema Nacional de Información Criminal (Ministerio de Seguridad, Argentina)",
      unidad_tasa: "por 100.000 habitantes",
      filas_totales: rowCount,
      filas_usadas: keptCount,
      nota_genero: "Desglose M/F de víctimas disponible solo para delitos contra las personas. Robos, hurtos y amenazas no registran género de víctima en el SNIC.",
    },
    partidos,
    delitos,
    anios,
    hechos,
    tasa,
    victimas_masc: victimasMasc,
    victimas_fem: victimasFem,
    victimas_sd: victimasSd,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(payload));
  const sizeKb = (fs.statSync(OUT_JSON).size / 1024).toFixed(1);
  console.log(`✓ Escrito ${OUT_JSON} (${sizeKb} KB)`);
  console.log(`  partidos=${nP} delitos=${nD} anios=${nA} (${anios[0]}..${anios[nA - 1]})`);
  console.log(`  filas procesadas=${rowCount} usadas=${keptCount}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
