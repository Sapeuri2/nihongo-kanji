// Progression dans le parcours : étapes ouvertes ou faites, maîtrise des leçons, exercices à revoir.

import { plain } from './text.js';
import * as S from './state.js';
import { ctx } from './contexte.js';

export function stepDone(step) {
  const st = S.get();
  return step.type === 'lesson' ? !!st.lessons[step.id]?.done : !!st.tests[step.id]?.passed;
}

// Progression linéaire : une étape s'ouvre quand la précédente est validée.
// Un niveau ouvert en avance (ex. le N4 avant la fin du N5) repart de sa première étape ; le niveau d'avant reste
// ouvert là où il en était.
export function stepStatuses() {
  let open = true;
  let niveau = null;
  const out = {};
  for (const s of ctx.C.steps) {
    if (s.level !== niveau) {
      if (niveau !== null && s.level && S.niveauOuvert(s.level)) open = true;
      niveau = s.level;
    }
    const done = stepDone(s);
    out[`${s.type}:${s.id}`] = done ? 'done' : open ? 'current' : 'locked';
    if (!done) open = false;
  }
  return out;
}

export function examName(e) {
  return e.kind === 'big' ? `Grand examen ${e.num}` : `Examen intermédiaire ${e.num}`;
}

export function stepLabel(s) {
  if (s.type === 'lesson') { const l = ctx.C.lessonById[s.id]; return `Leçon ${l.num} — ${plain(l.title)}`; }
  if (s.type === 'test') return `Test du bloc ${ctx.C.blockById[s.id].index + 1}`;
  const e = ctx.C.examById[s.id];
  return `${examName(e)} (leçons ${ctx.C.lessonById[e.lessonIds[0]].num}–${ctx.C.lessonById[e.lessonIds.at(-1)].num})`;
}

// Étape à continuer : celle du niveau le plus avancé (avec un niveau ouvert en avance, c'est lui).
export function nextStep() {
  const st = stepStatuses();
  return ctx.C.steps.findLast(s => st[`${s.type}:${s.id}`] === 'current');
}

// Niveaux qu'on peut ouvrir en avance : ceux après le premier, pas encore commencés ni déjà ouverts.
export function niveauxAOuvrir() {
  const st = stepStatuses();
  const niveaux = [...new Set(ctx.C.blocks.map(b => b.level).filter(Boolean))];
  return niveaux.slice(1).filter(n => {
    const premier = ctx.C.steps.find(s => s.level === n);
    return premier && st[`${premier.type}:${premier.id}`] === 'locked' && !S.niveauOuvert(n);
  });
}

// Niveaux ouverts en avance et pas encore entamés (on peut encore les refermer sans rien perdre).
export function niveauxRefermables() {
  return [...new Set(ctx.C.blocks.map(b => b.level).filter(Boolean))].slice(1).filter(n => S.niveauOuvert(n)
    && !ctx.C.steps.some(s => s.level === n && stepDone(s)));
}

// Maîtrise d'une leçon (0 à 1) d'après la répétition espacée, ou null si rien vu :
// raté récemment = 0, réussi une fois = 0,6, consolidé par les révisions = 1.
export const BOX_MASTERY = [0, 0.6, 0.8, 1];

export function mastery(lessonId) {
  const items = S.get().items;
  const seen = Object.values(ctx.C.items).filter(it => it.uses.includes(lessonId) && items[it.id]);
  if (!seen.length) return null;
  return seen.reduce((sum, it) => sum + BOX_MASTERY[Math.min(items[it.id].box, 3)], 0) / seen.length;
}

export function dueItems() {
  const now = Date.now();
  const items = S.get().items;
  return Object.entries(items)
    .filter(([id, r]) => ctx.C.items[id] && r.due <= now)
    .sort((a, b) => a[1].box - b[1].box || a[1].due - b[1].due)
    .map(([id]) => id);
}

export const lessonDone = id => stepDone({ type: 'lesson', id });

// Révisions : d'abord ce qui est à revoir, complété par d'anciens exercices (même réussis).
export function seenItems() {
  const items = S.get().items;
  return Object.keys(items).filter(id => ctx.C.items[id]);
}
