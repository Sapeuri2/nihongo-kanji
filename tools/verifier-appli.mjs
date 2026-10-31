// Contrôles propres à l'appli de kanji, lancés automatiquement par tools/verifier.mjs (moteur).
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const errors = [];
const err = (where, msg) => errors.push(`${where} : ${msg}`);

const plain = s => s.replace(/\{([^|{}]+)\|[^{}]+\}/g, '$1');
const reading = s => s.replace(/\{[^|{}]+\|([^{}]+)\}/g, '$1');

// Fiches : lectures bien écrites, 1 à 5 mots qui contiennent le kanji, lecture identique à l'appli vocabulaire.
const voc = new Map();
for (const w of read('data/sources/mots-vocab.json')) (voc.get(plain(w.jp)) ?? voc.set(plain(w.jp), new Set()).get(plain(w.jp))).add(w.kana);
const lecons = read('data/sources/kanji-n5.json');
const fiches = lecons.flatMap(l => l.kanji);
if (new Set(fiches.map(k => k.k)).size !== fiches.length) err('fiches', 'kanji en double');
for (const l of lecons) if (l.kanji.length < 5 || l.kanji.length > 8) err(l.id, 'il faut 5 à 8 kanji');
for (const k of fiches) {
  if (!k.fr || !k.memo) err(k.k, 'sens ou mémo manquant');
  if (k.on.some(r => !/^[ァ-ヶー]+$/.test(r))) err(k.k, 'on pas en katakana');
  if (k.kun.some(r => !/^[ぁ-ん()]+$/.test(r))) err(k.k, 'kun pas en hiragana');
  if (k.mots.length < 1 || k.mots.length > 5) err(k.k, 'il faut 1 à 5 mots');
  for (const [jp] of k.mots) {
    if (!plain(jp).includes(k.k)) err(k.k, `le mot ${jp} ne contient pas le kanji`);
    const v = voc.get(plain(jp));
    if (v && !v.has(reading(jp))) err(k.k, `${jp} : lecture différente du vocabulaire (${[...v]})`);
  }
}

// Exercices : la réponse ne doit pas être affichée dans la question.
function check(where, ex) {
  if (ex.type !== 'choice') return;
  const bonne = plain(ex.choices[ex.a]);
  if (/^[ぁ-ん]+$/.test(bonne) && /\*\*[^*]+\*\*/.test(ex.q || '') && !ex.q.includes(`**${bonne}**`) && ex.q.includes(`|${bonne}}`)) err(`${where} ${ex.id}`, 'réponse visible');
  if (/\*\*\{/.test(ex.q || '') || /\*\*\{/.test(ex.jp || '')) err(`${where} ${ex.id}`, 'mot en gras avec furigana');
  if (ex.choices.some(c => c === 'undefined' || !c)) err(`${where} ${ex.id}`, 'choix vide');
  if (ex.choices.length < 2 || (ex.choices.length < 4 && !/on|kun/.test(ex.choices[0]))) err(`${where} ${ex.id}`, `seulement ${ex.choices.length} choix`);
}
const manifest = read('data/manifest.json');
for (const file of manifest.blocks) {
  const b = read(file);
  for (const l of b.lessons) l.exercises.forEach(e => check(l.id, e));
  [...b.test, ...b.examTest].forEach(e => check(b.id, e));
}
for (const file of manifest.focus) read(file).exercises.forEach(e => check(file, e));

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problème(s).`);
  process.exit(1);
}
console.log(`OK (kanji) : ${fiches.length} kanji.`);
