// Calcule l'ordre d'apprentissage des kanji à partir des deux autres applis.
// Usage : node tools/ordre-kanji.mjs <dossier nihongo-vocabulaire> <dossier nihongo-grammaire>
// Écrit data/sources/ordre-n5.json. Score = fréquence (vocabulaire compté double) + précocité d'apparition.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [voc, gram] = process.argv.slice(2);
if (!voc || !gram) { console.error('Usage : node tools/ordre-kanji.mjs <vocabulaire> <grammaire>'); process.exit(1); }

const LISTE = `一二三四五六七八九十百千万円日月火水木金土年時分半今何午前後毎週先生学校人男女子父母友名
上下中外右左東西南北山川天気雨電車道駅社会国語本見行来食飲聞読書話買休入出立言
大小高安新古長白間花空目耳口手足魚私曜家朝帰飯昨`;
const KANJI = [...new Set(LISTE.match(/\p{Script=Han}/gu))];

function compter(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, 'data/manifest.json'), 'utf8'));
  const lessons = manifest.blocks.flatMap(f => JSON.parse(readFileSync(join(dir, f), 'utf8')).lessons);
  const n = {}, first = {};
  lessons.forEach((l, i) => {
    for (const k of JSON.stringify(l).match(/\p{Script=Han}/gu) || []) {
      n[k] = (n[k] || 0) + 1;
      first[k] ??= i / lessons.length;
    }
  });
  return { n, first };
}

const v = compter(voc), g = compter(gram);
const lignes = KANJI.map(k => {
  const freq = 2 * Math.log1p(v.n[k] || 0) + Math.log1p(g.n[k] || 0);
  const tot = Math.min(v.first[k] ?? 1, g.first[k] ?? 1);
  return { k, voc: v.n[k] || 0, gram: g.n[k] || 0, debut: +tot.toFixed(2), score: +(freq - 4 * tot).toFixed(2) };
}).sort((a, b) => b.score - a.score);

writeFileSync(new URL('../data/sources/ordre-n5.json', import.meta.url),
  '[\n' + lignes.map(l => ' ' + JSON.stringify(l)).join(',\n') + '\n]\n');
console.log(`${lignes.length} kanji :`, lignes.map(l => l.k).join(''));

// Mots de l'appli vocabulaire (pour relier les exemples) et phrases des deux applis (réutilisées telles quelles).
const lire = (d, f) => JSON.parse(readFileSync(join(d, f), 'utf8'));
const lecons = d => lire(d, 'data/manifest.json').blocks.flatMap(f => lire(d, f).lessons);
const mots = [], phrases = [];
for (const l of lecons(voc)) for (const w of l.words || []) {
  mots.push({ jp: w.jp, kana: w.kana, fr: w.fr, l: l.id });
  if (w.ex && w.exFr) phrases.push({ jp: w.ex, fr: w.exFr, src: l.id });
}
for (const l of lecons(gram)) for (const s of l.sections || []) for (const e of s.ex || [])
  if (e.jp && e.fr && !/[—＿\/〜]/.test(e.jp)) phrases.push({ jp: e.jp, fr: e.fr, src: l.id });
const ecrire = (f, a) => writeFileSync(new URL(`../data/sources/${f}`, import.meta.url), '[\n' + a.map(x => ' ' + JSON.stringify(x)).join(',\n') + '\n]\n');
ecrire('mots-vocab.json', mots);
ecrire('phrases.json', phrases);
console.log(`${mots.length} mots, ${phrases.length} phrases.`);
