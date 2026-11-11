// Point d'entrée : routage, événements (clics, clavier) et démarrage. Le reste est dans les modules importés.

import { esc, plain } from './text.js';
import * as S from './state.js';
import * as Sync from './sync.js';
import * as L from './liste.js';
import { ctx, go } from './contexte.js';
import { loadCourse } from './cours.js';
import { dueItems } from './progression.js';
import { shuffle } from './tirage.js';
import { advance, answer, checkOrder, next, restoreSession, saveSession, startDrill, startExam, startFocus, startLesson, startReview, startSession, startTest, stopAuto } from './seance.js';
import { toast } from './ui.js';
import { renderSyncBadge, viewHome, viewLesson, viewSession, viewSettings } from './vues.js';
import { appId, listeOn, setListeSort, startListeReview, viewListe } from './ma-liste.js';
import { closeSheet, initBulle, openSheet, sheet, updateBubble } from './bulle.js';

const app = document.getElementById('app');

function onStar(btn) {
  const w = JSON.parse(btn.dataset.w);
  if (L.has(L.idOf(w.jp))) {
    if (confirm('Déjà dans ta liste — l’ouvrir ?')) { closeSheet(); go('#/liste'); }
    return;
  }
  L.add({ ...w, app: appId() });
  // Toucher l'épingle d'une bonne réponse garde la question à l'écran (avec « Continuer »).
  if (btn.closest('.fb-mini') && ctx.session?.cur?.auto) { ctx.session.cur.auto = false; stopAuto(); render(); }
  document.querySelectorAll('[data-act="star"]').forEach(b => {
    if (b.dataset.w === btn.dataset.w) { b.classList.add('on'); b.title = 'Dans ma liste'; b.setAttribute('aria-label', 'Dans ma liste'); }
  });
  toast('📌 Épinglé dans ma liste');
}

// ⭐ sur une leçon : on la met d'un toucher ; seul l'utilisateur l'enlève (avec confirmation).
function onEtoile(id) {
  const l = ctx.C.lessonById[id];
  if (!l) return;
  if (S.lessonStarred(id)) {
    if (!confirm(`Enlever l’étoile de la leçon ${l.num} ?`)) return;
    S.setLessonStar(id, false);
    toast(`Étoile enlevée (leçon ${l.num})`);
  } else {
    S.setLessonStar(id, true);
    toast(`⭐ Leçon ${l.num} étoilée`);
  }
  render();
}

// ---------- Défilement ----------
// Une page s'ouvre en haut. En revenant à l'accueil, on retrouve l'étape touchée (au même endroit de l'écran)
// et les blocs qu'on avait dépliés.
const estAccueil = h => !h || h === '#/' || h === '#';
let route = null; // page affichée (pour savoir si on change de page)
let retourAccueil = null; // { y, ouverts, ancre: { type, id, top } } noté en quittant l'accueil
let clicAccueil = null;

function noterClic(e) {
  if (!estAccueil(location.hash)) return;
  const b = e.target.closest('#app [data-act="step"]');
  clicAccueil = b && !b.closest('.hero') ? { type: b.dataset.type, id: b.dataset.id, top: b.getBoundingClientRect().top } : null;
}

function quitterAccueil() {
  retourAccueil = { y: window.scrollY, ouverts: blocsOuverts(), ancre: clicAccueil };
  clicAccueil = null;
}

const blocsOuverts = () => [...app.querySelectorAll('details[open][data-bloc]')].map(d => d.dataset.bloc);
function rouvrir(ids) {
  for (const id of ids || []) {
    const d = app.querySelector(`details[data-bloc="${CSS.escape(id)}"]`);
    if (d) d.open = true;
  }
}

function placer(hash) {
  if (!estAccueil(hash) || !retourAccueil) { window.scrollTo(0, 0); return; }
  rouvrir(retourAccueil.ouverts);
  const a = retourAccueil.ancre;
  const el = a && app.querySelector(`.steps [data-act="step"][data-type="${a.type}"][data-id="${CSS.escape(a.id)}"], .card.exam [data-act="step"][data-type="${a.type}"][data-id="${CSS.escape(a.id)}"]`);
  if (el) {
    const d = el.closest('details');
    if (d) d.open = true;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - a.top);
  } else window.scrollTo(0, retourAccueil.y);
}

function render() {
  // Lien venu d'une autre appli (ex. le Challenger) : #/lecon/<id>/etoiler étoile la leçon, puis l'ouvre.
  const lien = (location.hash || '').match(/^#\/lecon\/([^/]+)\/etoiler$/);
  if (lien) {
    const id = decodeURIComponent(lien[1]);
    const l = ctx.C.lessonById[id];
    if (l && !S.lessonStarred(id)) { S.setLessonStar(id, true); toast(`⭐ Leçon ${l.num} étoilée`); }
    history.replaceState(null, '', `#/lecon/${lien[1]}`);
  }
  document.body.classList.toggle('nofuri', !S.get().settings.furigana);
  document.body.classList.toggle('nofr', S.get().settings.traduction === false);
  const hash = location.hash || '#/';
  const change = hash !== route;
  // Accueil redessiné sur place (synchro, étoile…) : les blocs dépliés le restent.
  const ouverts = !change && estAccueil(hash) ? blocsOuverts() : null;
  let html;
  if (hash.startsWith('#/lecon/')) html = viewLesson(decodeURIComponent(hash.slice(8)));
  else if (hash === '#/seance') html = viewSession();
  else if (hash === '#/reglages') html = viewSettings();
  else if (hash === '#/liste') html = viewListe();
  else html = viewHome();
  if (html) app.innerHTML = html;
  if (ouverts) rouvrir(ouverts);
  if (change) { route = hash; placer(hash); }
  updateBubble();
  furiBtn?.classList.toggle('off', !S.get().settings.furigana);
  furiBtn?.setAttribute('aria-pressed', String(!!S.get().settings.furigana));
  frBtn?.classList.toggle('off', S.get().settings.traduction === false);
  frBtn?.setAttribute('aria-pressed', String(S.get().settings.traduction !== false));
  saveSession();
}

let furiBtn = null;
let frBtn = null;

function onGlobalClick(e) {
  const star = e.target.closest('[data-act="star"]');
  if (star) { onStar(star); return; }
  if (e.target.closest('[data-act="furi-toggle"]')) {
    S.setSetting('furigana', !S.get().settings.furigana);
    render();
    return;
  }
  if (e.target.closest('[data-act="fr-toggle"]')) {
    S.setSetting('traduction', S.get().settings.traduction === false);
    render();
    return;
  }
  // Traductions masquées : toucher une phrase montre sa traduction (leçons et antisèche).
  if (document.body.classList.contains('nofr')) e.target.closest('.examples .fr, .wex .fr')?.classList.toggle('reveal');
  const el = e.target.closest('[data-act="sheet"], [data-act="sheet-close"]');
  if (el) {
    if (el.dataset.act === 'sheet') openSheet(el.dataset.id);
    else closeSheet();
  } else if (e.target === sheet) closeSheet();
}

function openStep(type, id) {
  if (type === 'lesson') go(`#/lecon/${id}`);
  else if (type === 'test') startTest(id);
  else startExam(id);
}

function onClick(e) {
  const run = ctx.session?.cur;
  if (run?.auto && run.answered && location.hash === '#/seance' && Date.now() - run.at > 150
    && !e.target.closest('[data-act="star"], [data-act="quit"]')) {
    advance(ctx.session.idx);
    return;
  }
  const ruby = e.target.closest('ruby');
  const reading = e.target.closest('.kana');
  if (document.body.classList.contains('nofuri')) {
    if (ruby && !ruby.closest('button')) ruby.classList.toggle('reveal');
    if (reading) reading.classList.toggle('reveal');
  }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  const cur = ctx.session?.cur;
  const it = cur && ctx.C.items[cur.id];
  switch (act) {
    case 'step': openStep(el.dataset.type, el.dataset.id); break;
    case 'review': startReview(); break;
    case 'lesson-ex': startLesson(el.dataset.id); break;
    case 'drill': startDrill(el.dataset.ids.split(','), el.dataset.titre); break;
    case 'etoile': onEtoile(el.dataset.id); break;
    case 'focus-go': startFocus(el.dataset.id); break;
    case 'resume': go('#/seance'); break;
    case 'pick': if (!cur.answered) { const i = +el.dataset.i; answer(i === it.a, { picked: i }); } break;
    case 'place': cur.built.push(+el.dataset.i); render(); break;
    case 'unplace': cur.built = cur.built.filter(i => i !== +el.dataset.i); render(); break;
    case 'check': answer(checkOrder(it, cur.built)); break;
    case 'next': next(); break;
    case 'show-fr': cur.showFr = true; render(); break;
    case 'quit':
      if (confirm('Quitter la série ? Les réponses déjà données sont gardées.')) {
        ctx.session = null;
        // Déjà sur l'accueil (« Abandonner ») : on le redessine pour retirer la carte de la série.
        if (estAccueil(location.hash)) render(); else go('#/');
      }
      break;
    case 'retry': restart(); break;
    case 'sync-on': connectSync(); break;
    case 'sync-now': Sync.syncNow(); break;
    case 'sync-off': if (confirm('Déconnecter la synchro sur cet appareil ? La progression locale est gardée.')) { Sync.disconnect(); render(); } break;
    case 'export': exportState(); break;
    case 'liste-go': startListeReview(); break;
    case 'liste-rm': {
      const x = L.get().items[el.dataset.id];
      if (x && confirm(`Retirer « ${plain(x.jp)} » de ta liste ? Il n’y reviendra pas tout seul.`)) { L.remove(x.id); render(); }
      break;
    }
    case 'liste-anki': download('ma-liste-anki.csv', L.toAnki(), 'text/csv'); break;
    case 'liste-json': download('ma-liste.json', L.toJSON(), 'application/json'); break;
    case 'liste-copy':
      (navigator.clipboard?.writeText(L.toText()) ?? Promise.reject()).then(() => toast('Liste copiée'), () => toast('Copie impossible'));
      break;
    case 'reset': if (confirm('Effacer toute la progression, sur tous tes appareils synchronisés ?')) { S.reset(); go('#/'); } break;
  }
}

function restart() {
  const s = ctx.session;
  if (s.kind === 'lesson') startLesson(s.ref);
  else if (s.kind === 'test') startTest(s.ref);
  else if (s.kind === 'exam') startExam(s.ref);
  else if (s.kind === 'focus') startFocus(s.ref);
  else if (s.kind === 'liste') startListeReview();
  else if (s.kind === 'review') { if (dueItems().length) startReview(); else go('#/'); }
  else startSession({ ...s, ids: shuffle(s.queue.filter(q => !q.tries).map(q => q.id)) });
}

async function connectSync() {
  const token = document.getElementById('token').value;
  if (!token.trim()) return;
  const err = document.getElementById('sync-err');
  err.textContent = 'Connexion…';
  try {
    await Sync.connect(token);
    render();
  } catch (e) {
    err.textContent = e.message;
  }
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportState() {
  download(`nihongo-progression-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S.get(), null, 1), 'application/json');
}

function onChangeInput(e) {
  const act = e.target.dataset.act;
  if (act === 'furigana') { S.setSetting('furigana', e.target.checked); render(); }
  if (act === 'bubble') { S.setSetting('bubble', e.target.checked); render(); }
  if (act === 'traduction') { S.setSetting('traduction', e.target.checked); render(); }
  if (act === 'liste-sort') { setListeSort(e.target.value); render(); }
  if (act === 'import' && e.target.files[0]) {
    e.target.files[0].text().then(txt => {
      try {
        S.replace(S.merge(S.get(), JSON.parse(txt)));
        alert('Progression importée.');
        go('#/');
      } catch { alert('Fichier illisible.'); }
    });
  }
}

function onKey(e) {
  if (location.hash !== '#/seance' || !ctx.session?.cur || e.target.tagName === 'INPUT') return;
  const cur = ctx.session.cur;
  if (cur.auto && cur.answered && e.key === 'Enter') { e.preventDefault(); advance(ctx.session.idx); return; }
  if (e.key === 'Enter') {
    const btn = app.querySelector(cur.answered ? '[data-act="next"]' : '[data-act="check"]');
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  } else if (!cur.answered && /^[1-9]$/.test(e.key)) {
    app.querySelectorAll('[data-act="pick"]')[+e.key - 1]?.click();
  } else if (!cur.answered && e.key === 'Backspace' && cur.built?.length) {
    cur.built.pop();
    render();
  }
}

async function main() {
  ctx.render = render;
  try {
    ctx.C = await loadCourse();
  } catch (e) {
    app.innerHTML = `<p class="error">Impossible de charger le cours : ${esc(e.message)}</p>`;
    return;
  }
  ctx.session = restoreSession();
  // Bouton ふ dans la barre du haut : afficher / masquer les furigana sans quitter l'exercice.
  furiBtn = Object.assign(document.createElement('button'), { className: 'furi-toggle jp', title: 'Afficher / masquer les furigana' });
  furiBtn.dataset.act = 'furi-toggle';
  furiBtn.innerHTML = '<ruby>漢<rt>かん</rt></ruby>';
  document.querySelector('.top .gear')?.before(furiBtn);
  // Bouton FR : afficher / masquer la traduction des phrases d'exemple dans les leçons.
  frBtn = Object.assign(document.createElement('button'), { className: 'fr-toggle', title: 'Afficher / masquer la traduction des exemples', textContent: 'FR' });
  frBtn.dataset.act = 'fr-toggle';
  furiBtn.after(frBtn);
  if (listeOn()) {
    const pin = Object.assign(document.createElement('a'), { href: '#/liste', className: 'gear pin', title: 'Ma liste', textContent: '📌' });
    pin.setAttribute('aria-label', 'Ma liste');
    furiBtn.before(pin);
  }
  initBulle();
  // Le défilement est géré par l'appli (haut de page, retour à l'endroit touché sur l'accueil).
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  document.addEventListener('click', noterClic, true);
  document.addEventListener('click', onGlobalClick);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  app.addEventListener('click', onClick);
  app.addEventListener('change', onChangeInput);
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', e => {
    const old = new URL(e.oldURL).hash || '#/';
    if (old !== '#/reglages' && old !== '#/liste') ctx.prevHash = old;
    if (estAccueil(old) && !estAccueil(location.hash)) quitterAccueil();
    render();
  });
  S.onChange(meta => {
    if (!meta.fromSync) Sync.schedule();
    // Une synchro ne doit pas interrompre un exercice en cours.
    else if (location.hash !== '#/seance') render();
  });
  L.onChange(meta => {
    if (!meta.fromSync && !meta.fromStorage) Sync.schedule();
    else if (location.hash !== '#/seance') render();
  });
  Sync.onStatus(() => {
    renderSyncBadge();
    if (location.hash === '#/reglages') render();
  });
  renderSyncBadge();
  render();
  Sync.init();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

main();
