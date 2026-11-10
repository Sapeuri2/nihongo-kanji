// Bulle et antisèche des points clés.

import { rich } from './text.js';
import * as S from './state.js';
import { ctx } from './contexte.js';
import { focusUnlocked } from './points-cles.js';
import { viewSections } from './vues.js';

let bubble = null;

export let sheet = null;

export function updateBubble() {
  const unlocked = ctx.C.focus.filter(focusUnlocked);
  // Pendant un test ou un examen, pas d'antisèche : c'est à toi de te souvenir.
  const inTest = location.hash === '#/seance' && ['test', 'exam'].includes(ctx.session?.kind) && !ctx.session?.result;
  const show = unlocked.length && S.get().settings.bubble !== false && !inTest;
  bubble.hidden = !show;
  if (show) bubble.innerHTML = unlocked.map(f => rich(f.label)).join('<span class="sep">｜</span>');
  if (inTest) closeSheet();
}

// Antisèche : un point clé à la fois, avec des onglets s'il y en a plusieurs.
let lastSheet = null;

export function openSheet(fid) {
  const unlocked = ctx.C.focus.filter(focusUnlocked);
  const f = ctx.C.focusById[fid] || unlocked.find(x => x.id === lastSheet) || unlocked[0] || ctx.C.focus[0];
  lastSheet = f.id;
  const tabs = unlocked.length > 1
    ? `<div class="sheet-tabs">${unlocked.map(x => `<button class="tab jp${x.id === f.id ? ' on' : ''}" data-act="sheet" data-id="${x.id}">${rich(x.label)}</button>`).join('')}</div>`
    : '';
  sheet.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="link sheet-x" data-act="sheet-close" aria-label="Fermer">✕</button>
    ${tabs}<article class="lesson"><p class="muted">Point clé</p><h1>${rich(f.title)}</h1>${viewSections(f.sheet?.sections, f.sheet?.pieges, f.id)}</article>
    <div class="actions"><button class="btn" data-act="sheet-close">Fermer</button></div></div>`;
  sheet.hidden = false;
  sheet.querySelector('.sheet').scrollTop = 0;
  document.body.classList.add('noscroll');
}

export function closeSheet() {
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  document.body.classList.remove('noscroll');
}

// Crée la bulle et le fond de l'antisèche (au démarrage, après les boutons de la barre du haut).
export function initBulle() {
  bubble = Object.assign(document.createElement('button'), { className: 'bubble jp', hidden: true });
  bubble.dataset.act = 'sheet';
  bubble.setAttribute('aria-label', 'Antisèche des points clés');
  sheet = Object.assign(document.createElement('div'), { className: 'sheet-overlay', hidden: true });
  document.body.append(bubble, sheet);
}
