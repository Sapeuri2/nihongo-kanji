// Test de bout en bout dans un vrai navigateur (Chromium + Playwright) : node tools/test-parcours.mjs
// Fait tout le parcours (leçons, tests, examens) comme un utilisateur, en ratant une question sur 6
// dans les leçons, et signale les erreurs JS et les débordements horizontaux (largeur téléphone) :
// accueil, Ma liste, réglages, chaque leçon et la première question de chaque série.
// Ne touche à aucune progression réelle : navigateur neuf, serveur local temporaire.
//
// Options (variables d'environnement) :
//   ETAPES=10   s'arrêter après 10 étapes (par défaut : tout le parcours)
//   PORT=8799   port du serveur local
//   CHROMIUM=…  chemin d'un autre Chromium
// Fichier facultatif propre à l'appli : tools/test-parcours-init.js, script lancé dans la page avant
// l'appli (ex. couper les rappels surprise du vocabulaire, qui cacheraient les boutons).
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const PORT = +(process.env.PORT || 8799);
const MAX_STEPS = +(process.env.ETAPES || 1000);
const URL0 = `http://localhost:${PORT}/`;
const t0 = Date.now();

// Les bonnes réponses, lues dans le contenu.
const read = p => JSON.parse(readFileSync(root + p, 'utf8'));
const man = read('data/manifest.json');
const items = {};
for (const f of man.blocks) {
  const b = read(f);
  for (const l of b.lessons) for (const e of l.exercises || []) items[e.id] = e;
  for (const e of [...(b.test || []), ...(b.examTest || [])]) items[e.id] = e;
}
for (const f of man.focus || []) for (const e of read(f).exercises || []) items[e.id] = e;

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
const init = root + 'tools/test-parcours-init.js';
if (existsSync(init)) await ctx.addInitScript({ content: readFileSync(init, 'utf8') });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

let failed = false;
async function overflow(where) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 0) { failed = true; console.log(`  ⚠ débordement horizontal de ${over}px : ${where}`); }
}

async function answerAll(label, wrongEvery = 0) {
  await page.waitForSelector('.exercise, .result');
  let k = 0;
  while (await page.$('.exercise')) {
    const id = await page.getAttribute('.exercise', 'data-id');
    const it = items[id];
    if (!it) throw new Error(`question inconnue ${id}`);
    if (++k === 1) await overflow(`${label}, 1re question`);
    const wrong = wrongEvery && k % wrongEvery === 0;
    if (it.type === 'choice') await page.click(`[data-act="pick"][data-i="${wrong ? (it.a + 1) % it.choices.length : it.a}"]`);
    else {
      const order = it.tokens.map((_, i) => i);
      for (const i of wrong ? order.reverse() : order) await page.click(`.bank [data-act="place"][data-i="${i}"]`);
      await page.click('[data-act="check"]');
    }
    if (await page.$('[data-act="next"]')) await page.click('[data-act="next"]');
    else {
      // Suite automatique (autoNext) : toucher l'écran passe à la suite. On touche le titre de la série,
      // pas le milieu de la page (un bouton désactivé n'y transmettrait pas le toucher).
      await page.waitForTimeout(200);
      await page.click('.sess-title');
    }
    await page.waitForFunction(prev => !document.querySelector(`.exercise[data-id="${prev}"] [data-act="pick"][disabled], .exercise[data-id="${prev}"] .built.good, .exercise[data-id="${prev}"] .built.bad`), id);
  }
  return k;
}

try {
  for (const h of ['#/liste', '#/reglages']) {
    await page.goto(URL0 + h);
    await page.waitForSelector('h1');
    await overflow(h);
  }
  let step = 0;
  for (; step < MAX_STEPS; step++) {
    await page.goto(`${URL0}#/`);
    await page.waitForSelector('.hero');
    await overflow('accueil');
    const btn = await page.$('.hero [data-act="step"]');
    if (!btn) { console.log('Fin du contenu.'); break; }
    const label = (await btn.textContent()).replace('Continuer', '').trim();
    await btn.click();
    const kind = await page.waitForSelector('.lesson, .exercise', { timeout: 5000 }).then(el => el.getAttribute('class'));
    if (kind === 'lesson') {
      await overflow(label);
      await page.click('[data-act="lesson-ex"]');
    }
    const n = await answerAll(label, label.startsWith('Leçon') ? 6 : 0);
    console.log(`${label} → ${n} questions, ${await page.textContent('.result .big-score')}`);
  }
  if (step >= MAX_STEPS) console.log(`Arrêt après ${MAX_STEPS} étapes (ETAPES).`);
  await page.goto(`${URL0}#/`);
  await page.waitForSelector('.hero');
  console.log('Étapes validées :', await page.$$eval('li.done, .card.exam.done', a => a.length));
} catch (e) {
  failed = true;
  console.log('ÉCHEC :', e.message);
} finally {
  console.log('Erreurs JS :', errs.length ? errs : 'aucune');
  console.log(`Durée : ${Math.round((Date.now() - t0) / 1000)} s`);
  await browser.close();
  server.kill();
}
process.exit(failed || errs.length ? 1 : 0);
