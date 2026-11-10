// Vues (HTML) : accueil, leçon, question, résultat, réglages.

import { esc, plain, rich, richBlank } from './text.js';
import * as S from './state.js';
import * as Sync from './sync.js';
import * as L from './liste.js';
import { CONFIG } from './config.js';
import { ctx, go } from './contexte.js';
import { dueItems, mastery, nextStep, seenItems, stepLabel, stepStatuses } from './progression.js';
import { shuffle } from './tirage.js';
import { focusMastery, focusUnlocked } from './points-cles.js';
import { finish } from './seance.js';
import { bar, pct } from './ui.js';
import { entryOf, kanaOf, listeOn, starBtn } from './ma-liste.js';

export function viewHome() {
  const statuses = stepStatuses();
  const st = S.get();
  const nx = nextStep();
  const due = dueItems().length;
  let h = '';
  if (ctx.session && !ctx.session.result) {
    h += `<section class="card resume"><div><h2>Série en cours</h2><p class="muted small">${esc(ctx.session.title)} · question ${Math.min(ctx.session.idx + 1, ctx.session.queue.length)}/${ctx.session.queue.length}</p></div>
      <div class="actions left"><button class="btn primary" data-act="resume">Reprendre</button><button class="btn" data-act="quit">Abandonner</button></div></section>`;
  }
  h += '<section class="hero">';
  h += nx
    ? `<button class="btn primary big" data-act="step" data-type="${nx.type}" data-id="${nx.id}">Continuer<small>${esc(stepLabel(nx))}</small></button>`
    : '<p class="muted">Tout le contenu disponible est terminé. Révise en attendant la suite !</p>';
  const seen = seenItems().length;
  h += `<button class="btn" data-act="review" ${seen ? '' : 'disabled'}>Révisions<small>${due ? `${due} à revoir` : seen ? 'révision libre' : 'rien pour l’instant'}</small></button>`;
  h += '</section>';

  if (listeOn()) {
    const n = L.list().length;
    const m = L.dueCount();
    h += `<section class="card liste-card"><div><h2>📌 Ma liste${n ? ` (${n} mot${n > 1 ? 's' : ''}, ${m} à revoir)` : ''}</h2>
      <p class="muted small">${n ? 'Les mots que tu as mis de côté, communs à toutes tes applis.' : 'Touche ☆ à côté d’un mot ou d’une réponse pour le mettre de côté ici.'}</p></div>
      <div class="actions left"><button class="btn primary" data-act="liste-go" ${n ? '' : 'disabled'}>Réviser ma liste</button><a class="btn" href="#/liste">Ouvrir</a></div></section>`;
  }

  for (const f of ctx.C.focus.filter(focusUnlocked)) {
    h += `<section class="card focus"><div class="focus-head"><span class="focus-label jp">${rich(f.label)}</span>
      <div class="focus-txt"><h2>${rich(f.title)}</h2><p class="muted small">Point clé · reviens-y souvent</p></div>${bar(focusMastery(f))}</div>
      <div class="actions left"><button class="btn primary" data-act="focus-go" data-id="${f.id}">⚡ Défi éclair</button>
      <button class="btn" data-act="sheet" data-id="${f.id}">Antisèche</button></div></section>`;
  }

  for (const b of ctx.C.blocks) {
    const ts = statuses[`test:${b.id}`];
    const tr = st.tests[b.id];
    const title = `<h2>Bloc ${b.index + 1} <span class="tag">${esc(b.level)}</span></h2>`;
    // Un bloc terminé est replié pour garder l'accueil court.
    if (ts === 'done') {
      const weak = b.lessonIds.filter(lid => (mastery(lid) ?? 1) < 0.4).length;
      h += `<details class="card"><summary>${title}<span class="muted small">✓ terminé · test ${pct(tr.best)}${weak ? ` · ${weak} point${weak > 1 ? 's' : ''} faible${weak > 1 ? 's' : ''}` : ''}</span></summary>`;
    } else h += `<section class="card">${title}`;
    h += `<p class="muted">${esc(b.title || '')}</p><ul class="steps">`;
    for (const lid of b.lessonIds) {
      const l = ctx.C.lessonById[lid];
      const s = statuses[`lesson:${lid}`];
      h += `<li class="${s}"><button data-act="step" data-type="lesson" data-id="${lid}" ${s === 'locked' ? 'disabled' : ''}>
        <span class="ico">${icon(s)}</span><span class="lbl">${l.num}. ${rich(l.title)}</span>${bar(mastery(lid))}</button></li>`;
    }
    h += `<li class="${ts} test"><button data-act="step" data-type="test" data-id="${b.id}" ${ts === 'locked' ? 'disabled' : ''}>
      <span class="ico">${icon(ts)}</span><span class="lbl">Test du bloc ${b.index + 1}</span>${tr ? `<span class="score">${pct(tr.best)}</span>` : ''}</button></li>`;
    h += ts === 'done' ? '</ul></details>' : '</ul></section>';
    if (b.exam) {
      const es = statuses[`exam:${b.exam.id}`];
      const er = st.tests[b.exam.id];
      h += `<section class="card exam ${b.exam.kind} ${es}"><button data-act="step" data-type="exam" data-id="${b.exam.id}" ${es === 'locked' ? 'disabled' : ''}>
        <span class="ico">${icon(es)}</span><span class="lbl">${esc(stepLabel({ type: 'exam', id: b.exam.id }))}</span>${er ? `<span class="score">${pct(er.best)}</span>` : ''}</button></section>`;
    }
  }
  return h;
}

function icon(s) {
  return s === 'done' ? '✓' : s === 'current' ? '▶' : '🔒';
}

// Tableau de mots (leçons de vocabulaire). La lecture suit le réglage des furigana.
function viewWords(words, src = '') {
  const rows = words.map(w => {
    let r = `<tr><td class="jp">${rich(w.jp)}</td><td class="jp kana"><span class="reading">${esc(w.kana || '')}</span></td><td>${rich(w.fr)}</td><td class="star-cell">${starBtn({ jp: w.jp, kana: w.kana || kanaOf(w.jp), fr: plain(w.fr), src })}</td></tr>`;
    if (w.ex) r += `<tr class="wex"><td colspan="4"><span class="jp">${rich(w.ex)}</span>${w.exFr ? `<span class="fr">${rich(w.exFr)}</span>` : ''}</td></tr>`;
    return r;
  });
  return `<table class="words"><thead><tr><th>Mot</th><th>Lecture</th><th>Sens</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

// Sections d'une leçon ou d'une antisèche : texte, exemples, vocabulaire, tableau (grid), pièges.
export function viewSections(sections = [], pieges = [], src = '') {
  let h = '';
  for (const sec of sections) {
    h += `<section><h2>${rich(sec.h)}</h2>${(sec.p || []).map(p => `<p>${rich(p)}</p>`).join('')}`;
    if (sec.grid) {
      h += `<div class="grid-wrap"><table class="grid"><thead><tr>${sec.grid.head.map(c => `<th>${rich(c)}</th>`).join('')}</tr></thead>`;
      // data-label : sur téléphone, chaque ligne devient une fiche et chaque case garde le titre de sa colonne.
      h += `<tbody>${sec.grid.rows.map(r => `<tr>${r.map((c, i) => i ? `<td class="jp" data-label="${esc(plain(sec.grid.head[i] || ''))}">${rich(c)}</td>` : `<th>${rich(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (sec.ex?.length) h += `<ul class="examples">${sec.ex.map(e => `<li><span class="jp">${rich(e.jp)}</span><span class="fr">${rich(e.fr)}</span></li>`).join('')}</ul>`;
    if (sec.vocab?.length) h += `<table class="vocab">${sec.vocab.map(v => `<tr><td class="jp">${rich(v.jp)}</td><td>${rich(v.fr)}</td><td class="star-cell">${starBtn({ jp: v.jp, kana: kanaOf(v.jp), fr: plain(v.fr), src })}</td></tr>`).join('')}</table>`;
    h += '</section>';
  }
  if (pieges?.length) h += `<section class="pieges"><h2>Pièges</h2><ul>${pieges.map(p => `<li>${rich(p)}</li>`).join('')}</ul></section>`;
  return h;
}

export function viewLesson(id) {
  const l = ctx.C.lessonById[id];
  if (!l || stepStatuses()[`lesson:${id}`] === 'locked') return go('#/');
  const done = S.get().lessons[id]?.done;
  let h = `<a class="back" href="#/">← Accueil</a><article class="lesson"><p class="muted">Leçon ${l.num}</p><h1>${rich(l.title)}</h1>`;
  if (l.formula?.length) h += `<div class="formula">${l.formula.map(f => `<div>${rich(f)}</div>`).join('')}</div>`;
  if (l.words?.length) h += viewWords(l.words, l.id);
  h += viewSections(l.sections, l.pieges, l.id);
  h += `</article><div class="actions"><button class="btn primary" data-act="lesson-ex" data-id="${id}">${done ? 'Refaire les exercices' : 'Passer aux exercices'}</button></div>`;
  return h;
}

export function viewSession() {
  if (!ctx.session) return go('#/');
  if (ctx.session.idx >= ctx.session.queue.length) {
    if (!ctx.session.result) finish();
    return viewResult();
  }
  const q = ctx.session.queue[ctx.session.idx];
  const it = ctx.C.items[q.id];
  if (!ctx.session.cur || ctx.session.cur.id !== q.id) ctx.session.cur = initExercise(it);
  const cur = ctx.session.cur;
  const total = ctx.session.queue.length;
  const streak = S.get().stats.streak;
  let h = `<div class="sess-top"><button class="link" data-act="quit">✕</button><div class="progress"><span style="width:${(ctx.session.idx / total) * 100}%"></span></div>${streak >= 2 ? `<span class="streak" title="Bonnes réponses d'affilée">🔥 ${streak}</span>` : ''}<span class="count">${ctx.session.idx + 1}/${total}</span></div>`;
  const flash = it.focus && ctx.session.kind !== 'focus' ? ` · <span class="flash">⚡ point clé ${rich(ctx.C.focusById[it.focus].label)}</span>` : '';
  h += `<p class="muted sess-title">${esc(ctx.session.title)}${flash}${q.tries ? ' · <em>elle revient !</em>' : ''}</p>`;
  h += `<div class="exercise" data-id="${it.id}">${it.type === 'order' ? viewOrder(it, cur) : viewChoice(it, cur)}</div>`;
  if (cur.answered) h += cur.auto ? viewMini(it) : viewFeedback(it, cur);
  return h;
}

function initExercise(it) {
  if (it.type === 'order') {
    let order = shuffle(it.tokens.map((_, i) => i));
    for (let k = 0; k < 5 && order.every((v, i) => it.tokens[v] === it.tokens[i]); k++) order = shuffle(order);
    return { id: it.id, bank: order, built: [] };
  }
  return { id: it.id, order: shuffle(it.choices.map((_, i) => i)) };
}

function viewChoice(it, cur) {
  const hasBlank = it.jp?.includes('＿');
  let h = `<p class="instr">${rich(it.q || (hasBlank ? 'Complète la phrase.' : 'Choisis la bonne réponse.'))}</p>`;
  if (it.jp) h += `<p class="jp big">${richBlank(it.jp, cur.answered ? it.choices[it.a] : null)}</p>`;
  if (it.fr) {
    // Si la traduction donne la réponse (vocabulaire), elle reste cachée jusqu'à ce qu'on réponde.
    if (CONFIG.hideBlankTranslation && hasBlank && !cur.answered && !cur.showFr) h += '<p class="fr"><button class="link small" data-act="show-fr">Voir la traduction</button></p>';
    else h += `<p class="fr">${rich(it.fr)}</p>`;
  }
  h += '<div class="choices">';
  cur.order.forEach((ci, k) => {
    let cls = 'choice';
    if (cur.answered) cls += ci === it.a ? ' good' : ci === cur.picked ? ' bad' : ' dim';
    h += `<button class="${cls}" data-act="pick" data-i="${ci}" ${cur.answered ? 'disabled' : ''}><span class="key">${k + 1}</span><span class="jp">${rich(it.choices[ci])}</span></button>`;
  });
  return h + '</div>';
}

function sentence(tokens) {
  return tokens.map(rich).join('') + '。';
}

function viewOrder(it, cur) {
  let h = `<p class="instr">${rich(it.q || 'Remets les mots dans l’ordre.')}</p>`;
  if (it.fr) h += `<p class="fr big-fr">${rich(it.fr)}</p>`;
  const cls = cur.answered ? (cur.ok ? ' good' : ' bad') : '';
  h += `<div class="built${cls}">${cur.built.map(i => `<button class="tile" data-act="unplace" data-i="${i}" ${cur.answered ? 'disabled' : ''}>${rich(it.tokens[i])}</button>`).join('') || '<span class="muted">Touche les mots ci-dessous…</span>'}</div>`;
  h += `<div class="bank">${cur.bank.filter(i => !cur.built.includes(i)).map(i => `<button class="tile" data-act="place" data-i="${i}" ${cur.answered ? 'disabled' : ''}>${rich(it.tokens[i])}</button>`).join('')}</div>`;
  if (!cur.answered) h += `<div class="actions"><button class="btn primary" data-act="check" ${cur.built.length === it.tokens.length ? '' : 'disabled'}>Valider</button></div>`;
  return h;
}

function viewFeedback(it, cur) {
  let h = `<div class="fb ${cur.ok ? 'ok' : 'ko'}"><strong>${cur.ok ? '✓ Correct' : '✗ Raté'}</strong>`;
  if (!cur.ok) {
    if (it.type === 'order') h += `<p>Réponse : <span class="jp">${sentence(it.tokens)}</span></p>`;
    else if (!it.jp?.includes('＿')) h += `<p>Réponse : <span class="jp">${rich(it.choices[it.a])}</span></p>`;
  }
  if (it.explain) h += `<p>${rich(it.explain)}</p>`;
  if (it.uses.length) h += `<p class="muted small">Notions : ${it.uses.map(u => `L${ctx.C.lessonById[u].num}`).join(' · ')}</p>`;
  const st = starBtn(entryOf(it));
  if (st) h += `<p class="fb-star">${st} <span class="muted small">Mettre de côté dans ma liste</span></p>`;
  h += '<button class="btn primary" data-act="next">Continuer</button></div>';
  return h;
}

// Bonne réponse qui passe seule à la suite : juste l'étoile (la toucher garde la question à l'écran).
function viewMini(it) {
  const st = starBtn(entryOf(it));
  return st ? `<div class="fb-mini">${st}</div>` : '';
}

function viewResult() {
  const r = ctx.session.result;
  const k = ctx.session.kind;
  let msg = '';
  if (k === 'lesson') msg = r.passed ? 'Leçon validée, la suite est débloquée !' : `Pas encore : il faut ${pct(CONFIG.lessonPass)}. Relis la leçon et recommence.`;
  if (k === 'test') msg = r.passed ? 'Bloc validé, la suite est débloquée !' : `Il faut ${pct(CONFIG.testPass)}. Travaille les points ci-dessous puis retente.`;
  if (k === 'exam') msg = r.passed ? 'Examen réussi, bravo !' : `Il faut ${pct(CONFIG.testPass)}. Travaille les points ci-dessous puis retente.`;
  if (k === 'review' || k === 'drill' || k === 'focus' || k === 'liste') msg = 'Séance terminée.';
  let h = `<section class="result ${r.passed === false ? 'fail' : 'pass'}"><p class="muted">${esc(ctx.session.title)}</p>
    <div class="big-score">${pct(r.score)}</div><p>${r.okCount}/${r.total} du premier coup</p><p><strong>${msg}</strong></p>
    <p class="muted small">🔥 ${S.get().stats.streak} bonne${S.get().stats.streak > 1 ? 's' : ''} réponse${S.get().stats.streak > 1 ? 's' : ''} d'affilée · record : ${S.get().stats.best}</p></section>`;
  const weak = Object.entries(r.byLesson).sort((a, b) => b[1] - a[1]);
  if (weak.length) {
    h += '<section class="card"><h2>Points à retravailler</h2><ul class="weak">';
    for (const [lid, n] of weak) {
      const l = ctx.C.lessonById[lid];
      h += `<li><a href="#/lecon/${lid}">L${l.num}. ${rich(l.title)}</a><span class="muted">${n} erreur${n > 1 ? 's' : ''}</span></li>`;
    }
    h += `</ul><button class="btn" data-act="drill" data-ids="${weak.map(w => w[0]).join(',')}">Entraînement ciblé sur ces points</button></section>`;
  }
  h += '<div class="actions">';
  if (r.passed === false || k === 'review' || k === 'drill' || k === 'focus' || k === 'liste') h += '<button class="btn" data-act="retry">Recommencer</button>';
  const nx = nextStep();
  if (nx && r.passed) h += `<button class="btn primary" data-act="step" data-type="${nx.type}" data-id="${nx.id}">Suite : ${esc(stepLabel(nx))}</button>`;
  h += '<a class="btn" href="#/">Accueil</a></div>';
  return h;
}

export function viewSettings() {
  const st = S.get();
  const cfg = Sync.getConfig();
  const status = Sync.getStatus();
  let h = `<a class="back" href="${ctx.prevHash}">← Retour</a><h1>Réglages</h1>`;
  h += `<section class="card"><h2>Affichage</h2><label class="row"><input type="checkbox" data-act="furigana" ${st.settings.furigana ? 'checked' : ''}> Afficher les furigana</label>
    <p class="muted small">Masqués, tu peux toucher un kanji pour voir sa lecture.</p>
    <label class="row"><input type="checkbox" data-act="bubble" ${st.settings.bubble !== false ? 'checked' : ''}> Afficher la bulle des points clés</label></section>`;
  h += '<section class="card"><h2>Synchronisation PC ↔ téléphone</h2>';
  if (cfg) {
    h += `<p>Connecté au compte GitHub <strong>${esc(cfg.login)}</strong>.</p><p class="muted small">${esc(syncText(status))}${status.msg ? ` — ${esc(status.msg)}` : ''}</p>
      <div class="actions left"><button class="btn" data-act="sync-now">Synchroniser maintenant</button><button class="btn" data-act="sync-off">Déconnecter cet appareil</button></div>`;
  } else {
    h += `<p>Ta progression est enregistrée sur cet appareil. Pour la retrouver sur ton autre appareil, connecte une clé GitHub (à faire une fois sur chaque appareil, avec la même clé) :</p>
      <ol class="small"><li><a href="https://github.com/settings/tokens/new?scopes=gist&description=${encodeURIComponent(CONFIG.tokenName)}" target="_blank" rel="noopener">Crée une clé GitHub</a> : seule la case <strong>gist</strong> doit être cochée. Choisis la durée (« No expiration » pour ne plus y penser), puis <em>Generate token</em>.</li>
      <li>Copie la clé (elle commence par <code>ghp_</code>) et colle-la ici.</li></ol>
      <div class="row"><input type="password" id="token" placeholder="ghp_…" autocomplete="off"><button class="btn primary" data-act="sync-on">Connecter</button></div>
      <p class="muted small" id="sync-err">${status.state === 'error' ? esc(status.msg) : ''}</p>`;
  }
  h += '</section>';
  h += `<section class="card"><h2>Sauvegarde</h2><div class="actions left"><button class="btn" data-act="export">Exporter ma progression</button>
    <label class="btn">Importer…<input type="file" accept="application/json" data-act="import" hidden></label></div></section>`;
  h += '<section class="card danger"><h2>Remise à zéro</h2><button class="btn" data-act="reset">Effacer toute ma progression</button></section>';
  return h;
}

function syncText(s) {
  if (s.state === 'off') return 'Synchro non configurée';
  if (s.state === 'busy') return 'Synchro en cours…';
  if (s.state === 'offline') return 'Hors ligne (synchro au retour du réseau)';
  if (s.state === 'error') return 'Erreur de synchro';
  if (s.at) return `Synchronisé à ${s.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return 'Synchro prête';
}

export function renderSyncBadge() {
  const el = document.getElementById('sync');
  const s = Sync.getStatus();
  el.textContent = s.state === 'off' ? '' : s.state === 'ok' ? '☁ ✓' : s.state === 'busy' ? '☁ …' : s.state === 'offline' ? '☁ hors ligne' : '☁ ⚠';
  el.title = syncText(s);
  el.className = `sync ${s.state}`;
}
