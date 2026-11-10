// Tirage des exercices : hasard pondéré (ce qui a été raté revient plus souvent), composition des tests.

import * as S from './state.js';
import { ctx } from './contexte.js';

export function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Plus un exercice a été raté (récemment ou un jour), plus il a de chances de sortir.
// Un exercice réussi garde toujours une petite chance de revenir.
function weight(id) {
  const r = S.get().items[id];
  if (!r) return 2;
  let w = r.box === 0 ? 5 : r.box < 3 ? 2 : 1;
  w += Math.min(r.ko, 3);
  if (r.due <= Date.now()) w += 1;
  return w;
}

export function weightedSample(ids, n) {
  const pool = [...ids];
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, id) => s + weight(id), 0);
    let x = Math.random() * total;
    let k = 0;
    while ((x -= weight(pool[k])) > 0) k++;
    out.push(pool.splice(Math.min(k, pool.length - 1), 1)[0]);
  }
  return out;
}

// Exercices utilisables jusqu'à la leçon n° maxNum. Les questions réservées à un examen
// n'apparaissent ailleurs qu'une fois vues dans cet examen.
export function available(maxNum, examId = null) {
  const seen = S.get().items;
  return Object.values(ctx.C.items)
    .filter(it => !it.focus && !it.liste && it.uses.every(u => ctx.C.lessonById[u].num <= maxNum))
    .filter(it => !it.examOnly || it.examId === examId || seen[it.id])
    .map(it => it.id);
}

// Tire `n` questions : d'abord `forced`, puis environ `recallShare` de rappels,
// le reste dans `main`. Si une réserve manque, l'autre complète.
export function compose(n, { forced = [], main = [], recall = [], recallShare = 0 }) {
  const picked = new Set(forced.slice(0, n));
  const take = (pool, k) => weightedSample(pool.filter(id => !picked.has(id)), k).forEach(id => picked.add(id));
  take(recall, Math.round(n * recallShare));
  take(main, n - picked.size);
  take(recall, n - picked.size);
  return shuffle([...picked]);
}
