// Séries d'exercices (leçon, test, examen, révision, entraînement, défi éclair) : déroulé, réponses, reprise.

import { plain } from './text.js';
import * as S from './state.js';
import * as L from './liste.js';
import { CONFIG } from './config.js';
import { ctx, go } from './contexte.js';
import { dueItems, examName, seenItems, stepDone } from './progression.js';
import { available, compose, shuffle, weightedSample } from './tirage.js';
import { focusPool, sprinkle, withFocus } from './points-cles.js';
import { toast } from './ui.js';

export function startFocus(fid) {
  const f = ctx.C.focusById[fid];
  startSession({ kind: 'focus', ref: fid, title: `⚡ Défi éclair — ${plain(f.title)}`, ids: weightedSample(focusPool(f), CONFIG.focusChallengeSize) });
}

// La série en cours est gardée sur l'appareil : on peut aller ailleurs (réglages, leçon…) et revenir.
const SESSION_KEY = `${CONFIG.storageKey}:seance`;

export function saveSession() {
  try {
    if (!ctx.session || ctx.session.result) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify({ ...ctx.session, first: [...ctx.session.first], scored: ctx.session.scored ? [...ctx.session.scored] : null }));
  } catch { /* stockage indisponible */ }
}

export function restoreSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!s) return null;
    Object.assign(ctx.C.items, s.gen || {});
    if (!s.queue?.every(q => ctx.C.items[q.id])) return null;
    // Une bonne réponse qui passait seule à la suite : la suite est faite.
    if (s.cur?.auto) { s.idx++; s.cur = null; }
    return { ...s, first: new Map(s.first), scored: s.scored ? new Set(s.scored) : null };
  } catch { return null; }
}

// Relancer une série déjà commencée la reprend au lieu de la recommencer.
function resume(kind, ref) {
  if (ctx.session && !ctx.session.result && ctx.session.kind === kind && ctx.session.ref === ref) {
    go('#/seance');
    return true;
  }
  return false;
}

export function startSession(opts) {
  if (!opts.ids.length) return;
  ctx.session = { requeue: true, ...opts, queue: opts.ids.map(id => ({ id, tries: 0 })), idx: 0, first: new Map(), cur: null, result: null };
  if (location.hash === '#/seance') { ctx.render(); window.scrollTo(0, 0); } else location.hash = '#/seance';
}

export function startLesson(id) {
  if (resume('lesson', id)) return;
  const l = ctx.C.lessonById[id];
  // Les exercices de la leçon, mélangés avec des rappels des leçons précédentes.
  const recall = weightedSample(available(l.num - 1), CONFIG.lessonRecall);
  startSession({
    kind: 'lesson', ref: id, title: `Leçon ${l.num} — exercices`,
    ids: sprinkle(shuffle([...l.itemIds, ...recall])), scored: new Set(l.itemIds),
  });
}

export function startTest(blockId) {
  if (resume('test', blockId)) return;
  const b = ctx.C.blockById[blockId];
  const first = ctx.C.lessonById[b.lessonIds[0]].num;
  const last = ctx.C.lessonById[b.lessonIds.at(-1)].num;
  const pool = available(last);
  const inBlock = new Set(b.lessonIds);
  const ids = compose(CONFIG.testSize, {
    forced: shuffle(b.testIds),
    main: pool.filter(id => ctx.C.items[id].uses.some(u => inBlock.has(u))),
    recall: pool.filter(id => ctx.C.items[id].uses.every(u => ctx.C.lessonById[u].num < first)),
    recallShare: CONFIG.recallShare,
  });
  startSession({ kind: 'test', ref: blockId, title: `Test du bloc ${b.index + 1}`, ids: withFocus(ids), requeue: false });
}

export function startExam(examId) {
  if (resume('exam', examId)) return;
  const e = ctx.C.examById[examId];
  const first = ctx.C.lessonById[e.lessonIds[0]].num;
  const last = ctx.C.lessonById[e.lessonIds.at(-1)].num;
  const pool = available(last, e.id);
  const inExam = new Set(e.lessonIds);
  const main = pool.filter(id => ctx.C.items[id].uses.some(u => inExam.has(u)));
  // Toutes les questions de réflexion de l'examen, au moins une question par leçon, puis le reste.
  const forced = [...shuffle(e.poolIds)];
  for (const lid of e.lessonIds) {
    if (forced.some(id => ctx.C.items[id].uses.includes(lid))) continue;
    forced.push(...weightedSample(main.filter(id => ctx.C.items[id].uses.includes(lid) && !forced.includes(id)), 1));
  }
  const ids = compose(e.size, {
    forced,
    main,
    recall: pool.filter(id => ctx.C.items[id].uses.every(u => ctx.C.lessonById[u].num < first)),
    recallShare: CONFIG.recallShare,
  });
  startSession({ kind: 'exam', ref: examId, title: examName(e), ids: withFocus(ids), requeue: false });
}

export function startReview() {
  const due = dueItems().slice(0, CONFIG.reviewSize);
  const rest = seenItems().filter(id => !due.includes(id));
  const ids = [...due, ...weightedSample(rest, CONFIG.reviewSize - due.length)];
  startSession({ kind: 'review', title: due.length ? 'Révisions' : 'Révision libre', ids: sprinkle(shuffle(ids)) });
}

export function startDrill(lessonIds, title = 'Entraînement ciblé') {
  const set = new Set(lessonIds);
  const pool = Object.values(ctx.C.items)
    .filter(it => it.uses.some(u => set.has(u)) && it.uses.every(u => stepDone({ type: 'lesson', id: u })))
    .filter(it => !it.focus && (!it.examOnly || S.get().items[it.id]))
    .map(it => it.id);
  if (!pool.length) { toast('Pas encore d’exercice à revoir pour ces leçons : fais d’abord leurs exercices.'); return; }
  startSession({ kind: 'drill', title, ids: sprinkle(weightedSample(pool, CONFIG.drillSize)) });
}

export function answer(ok, extra = {}) {
  const cur = ctx.session.cur;
  Object.assign(cur, extra, { answered: true, ok });
  const q = ctx.session.queue[ctx.session.idx];
  if (!q.tries) {
    const it = ctx.C.items[q.id];
    if (it.liste) { L.record(it.listId, ok); S.recordStreak(ok); } else S.recordAnswer(q.id, ok);
    ctx.session.first.set(q.id, ok);
  }
  // En leçon et en révision, une question ratée revient plus loin dans la série (plusieurs fois si besoin).
  if (!ok && ctx.session.requeue && q.tries < CONFIG.maxRetries) {
    const at = Math.min(ctx.session.queue.length, ctx.session.idx + 3 + Math.floor(Math.random() * 4));
    ctx.session.queue.splice(at, 0, { id: q.id, tries: q.tries + 1 });
  }
  // Bonne réponse : la suite arrive seule (un toucher accélère).
  clearTimeout(autoTimer);
  if (ok && CONFIG.autoNext > 0) {
    cur.auto = true;
    cur.at = Date.now();
    const idx = ctx.session.idx;
    autoTimer = setTimeout(() => advance(idx), CONFIG.autoNext);
  }
  ctx.render();
}

let autoTimer = null;

// Passe à la question suivante si c'est bien celle de `idx` qui attend (un double toucher ne saute rien).
export function advance(idx) {
  clearTimeout(autoTimer);
  if (!ctx.session || ctx.session.idx !== idx || !ctx.session.cur?.answered || !ctx.session.cur.auto) return;
  next();
}

export function next() {
  clearTimeout(autoTimer);
  ctx.session.idx++;
  ctx.session.cur = null;
  ctx.render();
  window.scrollTo(0, 0);
}

export function finish() {
  const scoredIds = [...ctx.session.first.keys()].filter(id => !ctx.session.scored || ctx.session.scored.has(id));
  const okCount = scoredIds.filter(id => ctx.session.first.get(id)).length;
  const score = scoredIds.length ? okCount / scoredIds.length : 0;
  const missed = [...ctx.session.first].filter(([, ok]) => !ok).map(([id]) => id);
  const byLesson = {};
  for (const id of missed) for (const u of ctx.C.items[id].uses) byLesson[u] = (byLesson[u] || 0) + 1;
  let passed = null;
  if (ctx.session.kind === 'lesson') {
    S.finishLesson(ctx.session.ref, score, CONFIG.lessonPass);
    passed = score >= CONFIG.lessonPass;
  }
  if (ctx.session.kind === 'test' || ctx.session.kind === 'exam') {
    S.finishTest(ctx.session.ref, score, CONFIG.testPass);
    passed = score >= CONFIG.testPass;
  }
  ctx.session.result = { score, okCount, total: scoredIds.length, byLesson, passed };
}

export function checkOrder(it, built) {
  const got = built.map(i => it.tokens[i]);
  return [it.tokens, ...(it.alt || [])].some(sol => sol.length === got.length && sol.every((t, i) => t === got[i]));
}

// Arrête la suite automatique en attente (ex. étoile touchée pendant le délai).
export function stopAuto() {
  clearTimeout(autoTimer);
}
