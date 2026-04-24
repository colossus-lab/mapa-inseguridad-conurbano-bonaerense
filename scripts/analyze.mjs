// Research: extrae insights del dataset conurbano.json para el scrollytelling.
import fs from "node:fs";
import path from "node:path";

const p = path.join(process.cwd(), "public", "data", "conurbano.json");
const ds = JSON.parse(fs.readFileSync(p, "utf8"));
const { partidos, delitos, anios, hechos, tasa } = ds;
const nP = partidos.length, nD = delitos.length, nA = anios.length;

const totalHechos = (pi, ai) => {
  let s = 0;
  for (let d = 0; d < nD; d++) s += hechos[pi][d][ai] ?? 0;
  return s;
};
const totalConurbanoAnio = (ai) => {
  let s = 0;
  for (let p = 0; p < nP; p++) s += totalHechos(p, ai);
  return s;
};
const pct = (a, b) => (b === 0 ? null : ((a - b) / b) * 100);

console.log("\n=== ESCALA GENERAL ===");
console.log(`Partidos: ${nP} · Delitos: ${nD} · Años: ${anios[0]}-${anios[nA-1]}`);
const serieTotales = anios.map((_, ai) => totalConurbanoAnio(ai));
console.log("\nTotal de hechos por año (Conurbano):");
anios.forEach((a, i) => console.log(`  ${a}: ${serieTotales[i].toLocaleString("es-AR")}`));

console.log("\n=== HITOS DE LA SERIE ===");
const maxT = Math.max(...serieTotales), minT = Math.min(...serieTotales.filter(v=>v>0));
console.log(`Máximo: ${maxT.toLocaleString("es-AR")} en ${anios[serieTotales.indexOf(maxT)]}`);
console.log(`Mínimo (no-cero): ${minT.toLocaleString("es-AR")} en ${anios[serieTotales.indexOf(minT)]}`);
// Delta 2000 vs último
console.log(`Cambio 2000 vs ${anios[nA-1]}: ${pct(serieTotales[nA-1], serieTotales[0])?.toFixed(1)}%`);
// Pre vs post pandemia: 2019 vs 2021
const i19 = anios.indexOf(2019), i21 = anios.indexOf(2021), i24 = anios.indexOf(2024);
if (i19>=0 && i21>=0) console.log(`Pandemia (2019→2021): ${pct(serieTotales[i21], serieTotales[i19])?.toFixed(1)}%`);
if (i21>=0 && i24>=0) console.log(`Post-pandemia (2021→2024): ${pct(serieTotales[i24], serieTotales[i21])?.toFixed(1)}%`);

console.log("\n=== CONCENTRACIÓN TERRITORIAL 2024 ===");
const rows24 = partidos.map((p, pi) => ({ nombre: p.nombre, t: totalHechos(pi, i24) }))
  .sort((a,b) => b.t - a.t);
const total24 = rows24.reduce((a,r)=>a+r.t, 0);
console.log("Top 5 partidos por volumen:");
rows24.slice(0,5).forEach(r => console.log(`  ${r.nombre}: ${r.t.toLocaleString("es-AR")} (${(r.t/total24*100).toFixed(1)}%)`));
const top3pct = rows24.slice(0,3).reduce((a,r)=>a+r.t,0) / total24 * 100;
console.log(`Los 3 partidos más afectados concentran ${top3pct.toFixed(1)}% de los hechos del Conurbano.`);

console.log("\n=== DELITOS: COMPOSICIÓN 2024 ===");
const porDelito24 = delitos.map((d, di) => {
  let s = 0; for (let pi=0; pi<nP; pi++) s += hechos[pi][di][i24] ?? 0;
  return { nombre: d.nombre, id: d.id, t: s };
}).sort((a,b)=>b.t-a.t);
porDelito24.slice(0,8).forEach(d => console.log(`  ${d.nombre}: ${d.t.toLocaleString("es-AR")} (${(d.t/total24*100).toFixed(1)}%)`));

console.log("\n=== EVOLUCIÓN POR TIPO DE DELITO (2000 vs 2024) ===");
delitos.forEach((d, di) => {
  let s00=0, s24=0;
  for (let pi=0; pi<nP; pi++) { s00 += hechos[pi][di][0] ?? 0; s24 += hechos[pi][di][i24] ?? 0; }
  if (s00 < 50 && s24 < 50) return;
  const chg = pct(s24, s00);
  console.log(`  ${d.nombre.padEnd(45)} 2000: ${String(s00).padStart(7)}  2024: ${String(s24).padStart(7)}  ${chg===null?"—":chg.toFixed(0).padStart(5)+"%"}`);
});

console.log("\n=== HOMICIDIOS DOLOSOS — TASA /100K ===");
const iHom = delitos.findIndex(d => d.id === "1");
const tasaNacional = anios.map((_,ai) => {
  const vals = partidos.map((_, pi) => tasa[pi][iHom][ai]).filter(v=>v>0);
  return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0;
});
console.log("Año → Tasa promedio Conurbano:");
anios.forEach((a, i) => { if (a%3===0 || i===nA-1) console.log(`  ${a}: ${tasaNacional[i].toFixed(1)}`); });

console.log("\n=== PARTIDOS CON MAYOR TASA HOMICIDIOS 2024 ===");
const homs24 = partidos.map((p, pi) => ({ nombre: p.nombre, t: tasa[pi][iHom][i24] ?? 0 }))
  .sort((a,b)=>b.t-a.t);
homs24.slice(0,8).forEach(r => console.log(`  ${r.nombre}: ${r.t.toFixed(1)} /100k`));

console.log("\n=== ROBOS Y HURTOS ===");
const iRobos = delitos.findIndex(d => d.id === "15");
const iHurtos = delitos.findIndex(d => d.id === "19");
if (iRobos >= 0 && iHurtos >= 0) {
  const rTotal00 = partidos.reduce((s,_,pi) => s + (hechos[pi][iRobos][0] ?? 0), 0);
  const rTotal24 = partidos.reduce((s,_,pi) => s + (hechos[pi][iRobos][i24] ?? 0), 0);
  const hTotal00 = partidos.reduce((s,_,pi) => s + (hechos[pi][iHurtos][0] ?? 0), 0);
  const hTotal24 = partidos.reduce((s,_,pi) => s + (hechos[pi][iHurtos][i24] ?? 0), 0);
  console.log(`Robos 2000: ${rTotal00.toLocaleString("es-AR")}  2024: ${rTotal24.toLocaleString("es-AR")}  ${pct(rTotal24, rTotal00)?.toFixed(0)}%`);
  console.log(`Hurtos 2000: ${hTotal00.toLocaleString("es-AR")}  2024: ${hTotal24.toLocaleString("es-AR")}  ${pct(hTotal24, hTotal00)?.toFixed(0)}%`);
}

console.log("\n=== CAMBIO ESTRUCTURAL: CIBER/VIRTUAL (21_4 ya agrupado en 21) ===");
// No útil: como agrupamos parents, no tenemos subcategorías en JSON.
// Pero podemos ver "Otros delitos contra la propiedad" que incluye estafas virtuales.
const iOtros = delitos.findIndex(d => d.id === "21");
if (iOtros >= 0) {
  const t17 = anios.indexOf(2017);
  const s17 = partidos.reduce((s,_,pi) => s + (hechos[pi][iOtros][t17] ?? 0), 0);
  const s24 = partidos.reduce((s,_,pi) => s + (hechos[pi][iOtros][i24] ?? 0), 0);
  console.log(`"Otros propiedad" 2017: ${s17.toLocaleString("es-AR")}  2024: ${s24.toLocaleString("es-AR")}  ${pct(s24, s17)?.toFixed(0)}%`);
}

console.log("\n=== PARTIDOS QUE MÁS REDUJERON HOMICIDIOS (2015→2024) ===");
const i15 = anios.indexOf(2015);
const deltaHom = partidos.map((p, pi) => ({
  nombre: p.nombre,
  t15: tasa[pi][iHom][i15] ?? 0,
  t24: tasa[pi][iHom][i24] ?? 0,
})).map(r => ({ ...r, delta: r.t15 > 0 ? pct(r.t24, r.t15) : null }))
  .filter(r => r.delta !== null)
  .sort((a,b) => a.delta - b.delta);
console.log("Top 5 reducciones:");
deltaHom.slice(0,5).forEach(r => console.log(`  ${r.nombre}: ${r.t15.toFixed(1)} → ${r.t24.toFixed(1)} (${r.delta.toFixed(0)}%)`));
console.log("Top 5 aumentos:");
deltaHom.slice(-5).reverse().forEach(r => console.log(`  ${r.nombre}: ${r.t15.toFixed(1)} → ${r.t24.toFixed(1)} (${r.delta.toFixed(0)}%)`));
