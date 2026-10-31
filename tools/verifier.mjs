// Vérifie le contenu du cours : node tools/verifier.mjs
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

const errors = [];
const err = (where, msg) => errors.push(`${where} : ${msg}`);

const manifest = read('data/manifest.json');
const lessonOrder = new Map(); // id → numéro
const ids = new Set();
let n = 0;
let count = 0;

const plain = s => s.replace(/\{([^|{}]+)\|[^{}]+\}/g, '$1');

function checkText(where, s) {
  if (typeof s !== 'string') return;
  const stripped = s.replace(/\{[^|{}]+\|[^{}]+\}/g, '');
  if (/[{}|]/.test(stripped)) err(where, `balisage furigana mal formé : ${s}`);
}

function checkExercise(where, ex, maxLesson) {
  if (!ex.id) return err(where, 'exercice sans id');
  where = `${where} ${ex.id}`;
  if (ids.has(ex.id)) err(where, 'id en double');
  ids.add(ex.id);
  count++;
  for (const k of ['q', 'jp', 'fr', 'explain']) checkText(where, ex[k]);
  for (const u of ex.uses || []) {
    if (!lessonOrder.has(u)) err(where, `uses : leçon inconnue ou pas encore vue ${u}`);
    else if (lessonOrder.get(u) > maxLesson) err(where, `uses : ${u} vient après cet exercice`);
  }
  if (ex.type === 'choice') {
    if (!Array.isArray(ex.choices) || ex.choices.length < 2) err(where, 'il faut au moins 2 choix');
    else {
      if (!(ex.a >= 0 && ex.a < ex.choices.length)) err(where, `réponse a=${ex.a} hors limites`);
      if (new Set(ex.choices).size !== ex.choices.length) err(where, 'choix en double');
      // Furigana masqués : deux choix ne doivent pas s'afficher pareil (ex. {来|き}て / {来|く}て).
      if (new Set(ex.choices.map(plain)).size !== ex.choices.length) err(where, 'choix identiques sans furigana : écrire en kana');
      ex.choices.forEach(c => checkText(where, c));
    }
    const blanks = (ex.jp || '').split('＿').length - 1;
    if (blanks > 1) err(where, 'un seul trou ＿ par phrase');
    if (!ex.jp && !ex.q) err(where, 'ni jp ni q');
  } else if (ex.type === 'order') {
    if (!Array.isArray(ex.tokens) || ex.tokens.length < 2) err(where, 'il faut au moins 2 mots');
    else {
      ex.tokens.forEach(t => checkText(where, t));
      const key = a => [...a].sort().join('\u0000');
      for (const alt of ex.alt || []) if (key(alt) !== key(ex.tokens)) err(where, 'une variante (alt) n’a pas les mêmes mots');
    }
    if (!ex.fr) err(where, 'traduction fr manquante');
  } else err(where, `type inconnu ${ex.type}`);
}

for (const file of manifest.blocks) {
  const b = read(file);
  for (const l of b.lessons) {
    if (lessonOrder.has(l.id)) err(file, `leçon en double ${l.id}`);
    lessonOrder.set(l.id, ++n);
    checkText(l.id, l.title);
    for (const s of l.sections || []) {
      checkText(l.id, s.h);
      (s.p || []).forEach(p => checkText(l.id, p));
      (s.ex || []).forEach(e => { checkText(l.id, e.jp); checkText(l.id, e.fr); });
      (s.vocab || []).forEach(v => checkText(l.id, v.jp));
    }
    (l.pieges || []).forEach(p => checkText(l.id, p));
    for (const w of l.words || []) {
      if (!w.jp || !w.kana || !w.fr) err(l.id, `mot incomplet (jp, kana et fr obligatoires) : ${JSON.stringify(w)}`);
      ['jp', 'fr', 'ex', 'exFr'].forEach(k => checkText(l.id, w[k]));
    }
    for (const ex of l.exercises || []) checkExercise(l.id, ex, n);
    if ((l.exercises || []).length < 5) err(l.id, 'moins de 5 exercices');
  }
  // Un test peut aussi réutiliser des leçons des blocs précédents.
  for (const ex of b.test || []) checkExercise(`${b.id} test`, ex, n);
  // Questions de réflexion de l'examen qui suit ce bloc.
  for (const ex of b.examTest || []) checkExercise(`${b.id} examen`, ex, n);
}

// Points clés (manifest.focus) : antisèche + exercices.
for (const file of manifest.focus || []) {
  const f = read(file);
  if (!f.id || !f.label || !f.title) err(file, 'point clé : id, label et title obligatoires');
  if (f.unlockAfter && !lessonOrder.has(f.unlockAfter)) err(file, `unlockAfter : leçon inconnue ${f.unlockAfter}`);
  for (const s of f.sheet?.sections || []) {
    checkText(file, s.h);
    (s.p || []).forEach(p => checkText(file, p));
    (s.grid?.rows || []).flat().concat(s.grid?.head || []).forEach(c => checkText(file, c));
  }
  (f.sheet?.pieges || []).forEach(p => checkText(file, p));
  for (const ex of f.exercises || []) checkExercise(`${f.id}`, ex, n);
}

// Contrôles propres à l'appli (facultatif) : tools/verifier-appli.mjs, lancé à la suite.
const extra = new URL('verifier-appli.mjs', import.meta.url);
if (existsSync(extra)) {
  const r = spawnSync(process.execPath, [fileURLToPath(extra)], { stdio: 'inherit' });
  if (r.status !== 0) errors.push('tools/verifier-appli.mjs : contrôles propres à l’appli en échec (voir ci-dessus)');
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problème(s).`);
  process.exit(1);
}
console.log(`OK : ${n} leçons, ${count} exercices.`);
