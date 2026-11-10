// Points clés : questions à marteler, glissées dans les séries, les tests et le défi éclair.

import * as S from './state.js';
import { CONFIG } from './config.js';
import { ctx } from './contexte.js';
import { BOX_MASTERY, lessonDone } from './progression.js';
import { shuffle, weightedSample } from './tirage.js';

export const focusUnlocked = f => !f.unlockAfter || lessonDone(f.unlockAfter);

// Questions de points clés jouables : point débloqué et leçons nécessaires faites.
export function focusPool(f = null) {
  return (f ? [f] : ctx.C.focus).filter(focusUnlocked)
    .flatMap(x => x.itemIds)
    .filter(id => ctx.C.items[id].uses.every(lessonDone));
}

export function focusMastery(f) {
  const items = S.get().items;
  const seen = f.itemIds.filter(id => items[id]);
  if (!seen.length) return null;
  return seen.reduce((sum, id) => sum + BOX_MASTERY[Math.min(items[id].box, 3)], 0) / seen.length;
}

// Tire `n` questions de points clés en alternant les points (sinon un seul point, plus raté, prend toute la place).
function focusPicks(n, exclude = []) {
  const pools = ctx.C.focus.filter(focusUnlocked).map(f => focusPool(f).filter(id => !exclude.includes(id))).filter(p => p.length);
  const out = [];
  let k = Math.floor(Math.random() * (pools.length || 1));
  while (out.length < n && pools.some(p => p.length)) {
    const pool = pools[k++ % pools.length];
    const [id] = weightedSample(pool, 1);
    if (id) { out.push(id); pool.splice(pool.indexOf(id), 1); }
  }
  return out;
}

// Glisse une question de point clé toutes les `every` questions.
export function sprinkle(ids, every = CONFIG.focusEvery) {
  const picks = every ? focusPicks(Math.floor(ids.length / every), ids) : [];
  if (!picks.length) return ids;
  const out = [];
  ids.forEach((id, i) => {
    out.push(id);
    if ((i + 1) % every === 0 && picks.length) out.push(picks.shift());
  });
  return out;
}

// Tests et examens : quelques questions de points clés en plus, qui comptent.
export function withFocus(ids) {
  return shuffle([...ids, ...focusPicks(CONFIG.focusInTests, ids)]);
}
