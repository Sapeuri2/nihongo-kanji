// « Ma liste » côté interface : étoile, page #/liste, révision des mots mis de côté.

import { esc, plain, rich } from './text.js';
import * as L from './liste.js';
import { CONFIG } from './config.js';
import { ctx, go } from './contexte.js';
import { shuffle } from './tirage.js';
import { startSession } from './seance.js';
import { bar } from './ui.js';

export const listeOn = () => CONFIG.listeEnabled !== false;

export const kanaOf = jp => String(jp ?? '').replace(/\{[^|{}]+\|([^{}]+)\}/g, '$1').replace(/\*\*|==/g, '');

export const appId = () => CONFIG.appId || location.pathname.split('/').filter(Boolean)[0]?.replace(/^nihongo-/, '') || 'app';

// Mot principal d'une question : la phrase japonaise (sans trou), sinon la bonne réponse.
const hasJp = s => /[\u3040-\u30ff\u3400-\u9fff]/.test(s || '');

export function entryOf(it) {
  if (it.liste) return null;
  // Le contenu peut dire lui-même quel mot garder : champ `star` ({ jp, kana, fr }) ; `star: null` = pas d'épingle.
  if ('star' in it) return it.star?.jp ? { jp: it.star.jp, kana: it.star.kana || kanaOf(it.star.jp), fr: plain(it.star.fr || ''), src: it.id } : null;
  let jp, fr;
  if (it.type === 'order') { jp = `${it.tokens.join('')}。`; fr = it.fr; }
  else if (it.jp && !it.jp.includes('＿')) { jp = it.jp; fr = it.fr || it.explain; }
  else {
    const ans = it.choices[it.a];
    if (hasJp(ans)) { jp = ans; fr = it.fr || it.explain; }
    else {
      // La réponse est en français (« Que signifie : … ») : le mot principal est le japonais de la consigne.
      jp = (it.q?.match(/[{}|\u3040-\u30ff\u3400-\u9fff\u30fc。、！？〜…]+/g) || []).sort((a, b) => b.length - a.length).find(hasJp);
      fr = /^Que (signifie|veut dire)/.test(it.q) ? ans : it.explain;
    }
  }
  if (!hasJp(jp)) return null;
  // Mot présent dans un tableau de mots de l'appli : on garde sa lecture et son sens
  // (et non la traduction de toute la phrase ou l'explication de la question).
  const w = motConnu(jp);
  if (w) return { ...w, src: it.id };
  return { jp, kana: kanaOf(jp), fr: plain(fr || ''), src: it.id };
}

// Index des mots des tableaux `words` et `vocab` des leçons, par japonais sans furigana.
let motsIndex = null;

function motConnu(jp) {
  if (!motsIndex) {
    motsIndex = new Map();
    const add = (wjp, kana, fr) => {
      const id = L.idOf(wjp);
      if (id && fr && !motsIndex.has(id)) motsIndex.set(id, { jp: wjp, kana: kana || kanaOf(wjp), fr: plain(fr) });
    };
    for (const l of ctx.C.lessons) {
      for (const w of l.words || []) add(w.jp, w.kana, w.fr);
      for (const sec of l.sections || []) for (const v of sec.vocab || []) add(v.jp, '', v.fr);
    }
  }
  return motsIndex.get(L.idOf(jp)) || null;
}

// 📌 : grisé si le mot n'est pas dans Ma liste, en couleur s'il y est (⭐ est réservé aux leçons).
export function starBtn(w) {
  if (!listeOn() || !w?.jp) return '';
  const on = L.has(L.idOf(w.jp));
  const lbl = on ? 'Dans ma liste' : 'Épingler dans ma liste';
  return `<button class="star${on ? ' on' : ''}" data-act="star" data-w="${esc(JSON.stringify(w))}" title="${lbl}" aria-label="${lbl}">📌</button>`;
}

let listeSort = 'due';

export function viewListe() {
  if (!listeOn()) return go('#/');
  const now = Date.now();
  const items = L.list();
  const by = {
    due: (a, b) => (L.isDue(b, now) - L.isDue(a, now)) || a.stats.prochain - b.stats.prochain,
    missed: (a, b) => b.stats.faux - a.stats.faux || a.stats.boite - b.stats.boite,
    recent: (a, b) => b.at - a.at,
  };
  let h = `<a class="back" href="${ctx.prevHash}">← Retour</a><h1>📌 Ma liste</h1>`;
  if (!items.length) {
    return h + '<p class="muted">Ta liste est vide. Touche 📌 à côté d’un mot (dans une leçon ou après une question) pour l’épingler : il apparaît ici, dans toutes tes applis, et tu peux le travailler où tu veux.</p>';
  }
  const m = L.dueCount();
  h += `<p class="muted">${items.length} mot${items.length > 1 ? 's' : ''} · ${m} à revoir. Un mot ne sort de la liste que si tu le retires toi-même.</p>
    <div class="actions left"><button class="btn primary" data-act="liste-go">Réviser ma liste<small>${Math.min(20, items.length)} questions</small></button></div>
    <label class="row small">Trier : <select data-act="liste-sort">${[['due', 'à revoir d’abord'], ['missed', 'les plus ratés'], ['recent', 'les plus récents']].map(([v, t]) => `<option value="${v}" ${v === listeSort ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <ul class="liste">`;
  for (const x of [...items].sort(by[listeSort] || by.due)) {
    const st = x.stats;
    // Lecture à part seulement si le mot n'a pas déjà ses furigana (sinon elle s'afficherait deux fois).
    const lecture = L.reading(x) && !/\{[^|{}]+\|[^{}]+\}/.test(x.jp) ? L.reading(x) : '';
    h += `<li class="lw"><div class="lw-main"><span class="jp lw-jp">${rich(x.jp)}</span>${lecture ? ` <span class="jp kana"><span class="reading">${esc(lecture)}</span></span>` : ''}</div>
      ${x.fr ? `<div class="lw-fr">${rich(x.fr)}</div>` : ''}
      <div class="lw-meta">${x.app.map(a => `<span class="tag">${esc(a)}</span>`).join('')}${bar(st.boite / L.MAX_BOX)}
      <span class="muted small">${st.vu ? `${st.juste}/${st.vu} juste${st.juste > 1 ? 's' : ''}` : 'pas encore révisé'}${L.isDue(x, now) ? ' · à revoir' : ''}</span>
      ${st.boite >= L.MAX_BOX ? '<span class="small">maîtrisé ?</span>' : ''}
      <button class="link small" data-act="liste-rm" data-id="${esc(x.id)}">Retirer de ma liste</button></div></li>`;
  }
  h += `</ul><section class="card"><h2>Exporter</h2><p class="muted small">Pour faire des flashcards (Anki : importer le fichier CSV, séparateur « ; »).</p>
    <div class="actions left"><button class="btn" data-act="liste-anki">Exporter pour Anki (CSV)</button><button class="btn" data-act="liste-json">Exporter en JSON</button><button class="btn" data-act="liste-copy">Copier</button></div></section>`;
  return h;
}

// Réserve de réponses plausibles : les mots des leçons de l'appli ouverte.
let vocabPool = null;

function appVocab() {
  if (vocabPool) return vocabPool;
  vocabPool = [];
  const word = (jp, kana, fr) => {
    // Seulement de vrais mots : pas de formules ni de paires de conjugaison (→, /, +, 〜, =…).
    if (jp && fr && L.idOf(jp).length <= 12 && !/[→/／+＋〜~=＝(（]/.test(L.idOf(jp) + fr)) vocabPool.push({ jp, kana: kana || kanaOf(jp), fr: plain(fr) });
  };
  for (const l of ctx.C.lessons) {
    for (const w of l.words || []) word(w.jp, w.kana, w.fr);
    for (const sec of l.sections || []) for (const v of sec.vocab || []) word(v.jp, '', v.fr);
  }
  return vocabPool;
}

// Question générée à partir d'un mot de la liste (aucune donnée propre à une appli).
function listeQuestion(x, others, i) {
  const hasKanji = /[\u3400-\u9fff]/.test(L.idOf(x.jp));
  const kana = L.reading(x);
  const mine = others.map(o => ({ jp: o.jp, kana: L.reading(o) || kanaOf(o.jp), fr: o.fr }));
  // Mauvaises réponses : `show` s'affiche, `key` évite les doublons et les réponses équivalentes à la bonne.
  const pick = (show, key, ok = () => true) => {
    const seen = new Set([key(x)]);
    const out = [];
    // D'abord les autres mots de la liste ; le vocabulaire de l'appli complète si la liste est courte.
    for (const c of [...shuffle(mine), ...(mine.length < 4 ? shuffle(appVocab()) : [])]) {
      const v = show(c);
      const k = key(c);
      if (!v || !k || seen.has(k) || !ok(c)) continue;
      seen.add(k);
      out.push(v);
      if (out.length === 3) break;
    }
    return out.length >= 2 ? out : null;
  };
  const same = c => (c.fr || '').toLowerCase() !== (x.fr || '').toLowerCase();
  const kinds = [];
  if (x.fr) {
    const d = pick(c => c.fr, c => (c.fr || '').toLowerCase());
    if (d) kinds.push({ q: 'Que veut dire ce mot ?', jp: x.jp, ans: x.fr, bad: d });
    const e = pick(c => c.jp, c => L.idOf(c.jp), same);
    if (e) kinds.push({ q: `Comment dit-on « ${x.fr} » ?`, ans: x.jp, bad: e });
  }
  if (hasKanji && kana && L.idOf(x.jp).length <= 8) {
    const d = pick(c => c.kana, c => c.kana);
    if (d) kinds.push({ q: 'Comment se lit ce mot ?', jp: L.idOf(x.jp), ans: kana, bad: d });
  }
  if (!kinds.length) return null;
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  const choices = [k.ans, ...k.bad];
  return {
    id: `liste:${i}`, type: 'choice', uses: [], liste: true, listId: x.id,
    q: k.q, jp: k.jp, choices, a: 0,
    explain: `${x.jp}${kana ? ` (${kana})` : ''}${x.fr ? ` : ${x.fr}` : ''}`,
  };
}

// Révision de la liste : d'abord les mots à revoir, puis les plus ratés.
export function startListeReview() {
  const now = Date.now();
  const items = L.list();
  const due = items.filter(x => L.isDue(x, now)).sort((a, b) => a.stats.boite - b.stats.boite || a.stats.prochain - b.stats.prochain);
  const rest = items.filter(x => !L.isDue(x, now)).sort((a, b) => b.stats.faux - a.stats.faux || a.stats.boite - b.stats.boite);
  const gen = {};
  const ids = [];
  for (const x of [...due, ...rest]) {
    if (ids.length >= 20) break;
    const q = listeQuestion(x, items.filter(o => o.id !== x.id), ids.length);
    if (q) { gen[q.id] = q; ids.push(q.id); }
  }
  if (!ids.length) { alert('Ajoute encore quelques mots à ta liste pour pouvoir la réviser.'); return; }
  for (const id of Object.keys(ctx.C.items)) if (id.startsWith('liste:')) delete ctx.C.items[id];
  Object.assign(ctx.C.items, gen);
  startSession({ kind: 'liste', title: '📌 Ma liste', ids: shuffle(ids), gen });
}

export function setListeSort(v) {
  listeSort = v;
}
