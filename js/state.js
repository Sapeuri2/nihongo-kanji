// Progression de l'utilisateur : stockée dans le navigateur, fusionnable entre appareils.

import { CONFIG } from './config.js';

const KEY = CONFIG.storageKey;
const DAY = 86400000;

// Répétition espacée (boîtes de Leitner) : intervalle en jours pour chaque boîte.
export const INTERVALS = [0, 1, 3, 7, 16, 35];

const listeners = new Set();
let state = load();

function empty() {
  return { v: 1, resetAt: 0, lessons: {}, tests: {}, items: {}, settings: { furigana: true, t: 0 }, stats: { streak: 0, best: 0, t: 0 } };
}

function normalize(s) {
  const e = empty();
  if (!s || typeof s !== 'object') return e;
  return {
    v: 1,
    resetAt: s.resetAt || 0,
    lessons: s.lessons || {},
    tests: s.tests || {},
    items: s.items || {},
    settings: { ...e.settings, ...(s.settings || {}) },
    stats: { ...e.stats, ...(s.stats || {}) },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* stockage indisponible : on repart de zéro */ }
  return empty();
}

function persist(meta = {}) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach(f => f(meta));
}

export function get() { return state; }
export function onChange(f) { listeners.add(f); }

// Remplace l'état local (après une fusion avec la synchro).
export function replace(next, meta = {}) {
  state = normalize(next);
  persist(meta);
}

export function recordAnswer(id, ok) {
  const now = Date.now();
  const r = state.items[id] || { box: 0, due: 0, seen: 0, ok: 0, ko: 0 };
  r.seen++;
  if (ok) { r.ok++; r.box = Math.min(r.box + 1, INTERVALS.length - 1); }
  else { r.ko++; r.box = 0; }
  r.due = now + INTERVALS[r.box] * DAY;
  r.t = now;
  state.items[id] = r;
  // Bonnes réponses d'affilée (toutes séries confondues) et record.
  const streak = ok ? state.stats.streak + 1 : 0;
  state.stats = { streak, best: Math.max(state.stats.best, streak), t: now };
  persist();
}

export function finishLesson(id, score, passMark) {
  const r = state.lessons[id] || { done: false, best: 0 };
  r.best = Math.max(r.best, score);
  r.done = r.done || score >= passMark;
  r.t = Date.now();
  state.lessons[id] = r;
  persist();
  return r;
}

export function finishTest(id, score, passMark) {
  const r = state.tests[id] || { passed: false, best: 0, attempts: 0 };
  r.attempts++;
  r.best = Math.max(r.best, score);
  r.passed = r.passed || score >= passMark;
  r.t = Date.now();
  state.tests[id] = r;
  persist();
  return r;
}

export function setSetting(key, value) {
  state.settings = { ...state.settings, [key]: value, t: Date.now() };
  persist();
}

export function reset() {
  const settings = state.settings;
  state = { ...empty(), resetAt: Date.now(), settings };
  persist();
}

// Fusion de deux progressions (appareil local + Gist) :
// une leçon/un test validé le reste, les meilleurs scores sont gardés,
// et pour la répétition espacée la réponse la plus récente gagne.
export function merge(a, b) {
  a = normalize(a); b = normalize(b);
  const resetAt = Math.max(a.resetAt, b.resetAt);
  const keep = r => r && (r.t || 0) >= resetAt;

  const mergeMap = (ma, mb, combine) => {
    const out = {};
    for (const k of new Set([...Object.keys(ma), ...Object.keys(mb)])) {
      const x = keep(ma[k]) ? ma[k] : null;
      const y = keep(mb[k]) ? mb[k] : null;
      if (x && y) out[k] = combine(x, y);
      else if (x || y) out[k] = x || y;
    }
    return out;
  };
  const latest = (x, y) => ((y.t || 0) > (x.t || 0) ? y : x);

  return {
    v: 1,
    resetAt,
    lessons: mergeMap(a.lessons, b.lessons, (x, y) => ({
      done: x.done || y.done,
      best: Math.max(x.best || 0, y.best || 0),
      t: Math.max(x.t || 0, y.t || 0),
    })),
    tests: mergeMap(a.tests, b.tests, (x, y) => ({
      passed: x.passed || y.passed,
      best: Math.max(x.best || 0, y.best || 0),
      attempts: Math.max(x.attempts || 0, y.attempts || 0),
      t: Math.max(x.t || 0, y.t || 0),
    })),
    items: mergeMap(a.items, b.items, latest),
    settings: latest(a.settings, b.settings),
    stats: { ...latest(a.stats, b.stats), best: Math.max(a.stats.best, b.stats.best) },
  };
}
