// Génère data/n5/*.json, data/n4/*.json, data/focus/*.json et data/manifest.json depuis data/sources/.
// Usage : node tools/generer-kanji.mjs
// Les identifiants dépendent du contenu (leçon + kanji ou mot + type), pas de l'ordre : ne pas renommer une leçon publiée.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const src = f => JSON.parse(readFileSync(new URL(`../data/sources/${f}`, import.meta.url), 'utf8'));
// Furigana sur le mot entier : {日|に}{本|ほん} → {日本|にほん}. Toucher le mot affiche toute sa lecture.
const motEntier = s => { let t; while ((t = s.replace(/\{([^|{}]+)\|([^{}]+)\}\{([^|{}]+)\|([^{}]+)\}/g, '{$1$3|$2$4}')) !== s) s = t; return s; };
function out(f, o) {
  mkdirSync(new URL(`../data/${f.replace(/[^/]+$/, '')}`, import.meta.url), { recursive: true });
  writeFileSync(new URL(`../data/${f}`, import.meta.url), JSON.stringify(o, (k, v) => (typeof v === 'string' ? motEntier(v) : v), 1) + '\n');
}

const LECONS5 = src('kanji-n5.json');
const LECONS4 = existsSync(new URL('../data/sources/kanji-n4.json', import.meta.url)) ? src('kanji-n4.json') : [];
const LECONS = [...LECONS5, ...LECONS4];
const VOC = src('mots-vocab.json');
// Phrases N5 (reprises des deux autres applis) puis phrases N4 (écrites pour cette appli, réservées au N4).
const PHRASES = [...src('phrases.json'), ...(LECONS4.length ? src('phrases-n4.json').map(p => ({ ...p, n4: true })) : [])];

// Blocs de nouveaux kanji : 5 leçons chacun.
const LECON_MAX = 16;
const BLOCS = [
  'Les kanji de tous les jours', 'École, positions et nombres',
  'Le temps, les directions, la nature', 'Famille, maison, corps, adjectifs',
];
const BLOCS4 = [
  'La ville et les lieux', 'Bouger et agir', 'Études et travail',
  'Couleurs, saisons, nature', 'Le corps, la santé, la famille', 'Penser, dire, ressentir',
];

// Lectures valables (ou trop proches d'un vrai mot) à ne jamais proposer comme erreur.
const JAMAIS = new Set(['にっぽん', 'にっぽんご', 'にっぽんじん', 'なんじん', 'なにじん', 'なながつ', 'さんぶん', 'ごぶん', 'なんぶん', 'いちにち', 'がくしょう', 'いる', 'はいれる']);
// Mots seuls à plusieurs lectures selon le contexte : pas de question de lecture hors phrase.
const AMBIGUS = new Set(['何', '後', '間', '市', '町', '方', '文', '字', '図', '門', '夜', '心', '力', '楽', '用', '元']);
// Kanji de sens voisins : jamais face à face dans une question de sens.
const VOISINS = ['天空', '話言語', '金円', '家社', '前先', '時間分', '日曜', '学校', '大高', '今昨', '国外', '後午'];
const voisins = (a, b) => a === b || VOISINS.some(g => g.includes(a) && g.includes(b));

// ---------- Outils ----------
const plain = s => s.replace(/\{([^|{}]+)\|[^{}]+\}/g, '$1');
const reading = s => s.replace(/\{[^|{}]+\|([^{}]+)\}/g, '$1');
const hira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKanji = c => /\p{Script=Han}/u.test(c);
const tokens = s => [...s.matchAll(/\{([^|{}]+)\|([^{}]+)\}|([\s\S])/g)].map(m => (m[1] ? { p: m[1], r: m[2] } : { p: m[3], r: m[3] }));
const unmark = t => t.map(x => (x.p === x.r ? x.p : `{${x.p}|${x.r}}`)).join('');

function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; }
function rng(seed) { let x = hash(seed) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 2 ** 32; }; }
function melange(a, seed) { const r = rng(seed), b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const uniq = a => [...new Set(a)];

// ---------- Index ----------
const FICHE = {}, LECON_DE = {}, ORDRE = [];
LECONS.forEach((l, i) => l.kanji.forEach(k => {
  k.lectures = uniq([...k.on.map(hira), ...k.kun.map(x => x.split('(')[0])]);
  FICHE[k.k] = k; LECON_DE[k.k] = l.id; ORDRE.push(k.k);
  k.rang = i;
}));
const mot = (jp, fr) => ({ jp, fr, plain: plain(jp), kana: reading(jp), t: tokens(jp) });
const MOTS = new Map();
LECONS.forEach((l, li) => l.kanji.forEach(k => { k.w = k.mots.map(([jp, fr]) => { const m = mot(jp, fr); if (!MOTS.has(m.plain)) MOTS.set(m.plain, { ...m, n5: li < LECONS5.length }); return MOTS.get(m.plain); }); }));
const CONNUS = new Set([...MOTS.keys(), ...VOC.map(w => plain(w.jp))]);
const KANAS = new Set([...[...MOTS.values()].map(m => m.kana), ...VOC.map(w => w.kana)]);

// Lectures fausses : on remplace la lecture d'un seul kanji par une autre de ses lectures.
function piegesLecture(m) {
  if (m.t.length === 1 && m.t[0].p.length === 1) return [];
  const res = [];
  m.t.forEach((x, i) => {
    if (x.p.length !== 1 || !FICHE[x.p]) return;
    for (const r of FICHE[x.p].lectures) {
      if (r === x.r || x.r.startsWith(r.slice(0, 2)) && x.r.length !== r.length && r.length > 1 && false) continue;
      const s = m.t.map((y, j) => (j === i ? r : y.r)).join('');
      if (s !== m.kana && !KANAS.has(s) && !JAMAIS.has(s)) res.push(s);
    }
  });
  return uniq(res);
}

// 3 mauvaises lectures pour un mot : d'abord les pièges on/kun, puis des lectures d'autres mots.
function choixLecture(m, seed, avant) {
  const pieges = melange(piegesLecture(m), seed).slice(0, 2);
  const autres = melange(avant.filter(o => o.kana !== m.kana && o.kana[0] !== m.kana[0] && Math.abs(o.kana.length - m.kana.length) < 3).map(o => o.kana), seed + 'a');
  return uniq([...pieges, ...autres]).slice(0, 3);
}

function qcm(ex, bonne, fausses, phrase) {
  const choices = melange([bonne, ...fausses], ex.id);
  const q = { ...ex, type: 'choice', choices, a: choices.indexOf(bonne) };
  // Phrase source : sert seulement au générateur, jamais écrite dans les fichiers.
  if (phrase) Object.defineProperty(q, 'phrase', { value: phrase, enumerable: false });
  return q;
}

// Au N5, seuls les mots du N5 servent de leurres (le N5 ne change pas quand le N4 grandit).
const motsAvant = rang => [...MOTS.values()].filter(m => rangMot(m) <= rang && (m.n5 || rang >= LECONS5.length));
const rangMot = m => Math.min(...[...m.plain].filter(c => FICHE[c]).map(c => FICHE[c].rang), 99);

// Kanji de remplacement : ne partage aucune lecture avec le morceau remplacé (donc pas d'homophone).
function faussesKanji(cible, lecture, seed, rang) {
  const f = FICHE[cible];
  const sosies = (f?.res || []).filter(k => !FICHE[k] || !FICHE[k].lectures.includes(lecture));
  const proches = ORDRE.filter(k => FICHE[k].rang <= rang && k !== cible && !FICHE[k].lectures.includes(lecture) && !voisins(k, cible));
  return uniq([...melange(sosies, seed), ...melange(proches, seed + 'p')]).slice(0, 3);
}

// ---------- Exercices d'un kanji ou d'un mot ----------
const exSens = (lid, k, rang) => {
  const autres = ORDRE.filter(o => FICHE[o].rang <= rang && !voisins(o, k.k) && !FICHE[o].fr.split(/[, ]+/).some(w => w.length > 3 && k.fr.includes(w)));
  return qcm({ id: `${lid}-${k.k}-sens`, q: 'Que veut dire ce kanji ?', jp: k.k, explain: `**${k.k}** : ${k.fr}. ${k.memo}` },
    k.fr, melange(uniq(autres.map(o => FICHE[o].fr)), `${lid}${k.k}s`).slice(0, 3));
};
const exKanji = (lid, k, rang) => {
  const proches = ORDRE.filter(o => FICHE[o].rang <= rang && !voisins(o, k.k));
  return qcm({ id: `${lid}-${k.k}-kanji`, q: `Quel kanji veut dire « ${k.fr} » ?`, explain: `**${k.k}** : ${k.fr}. ${k.memo}` },
    k.k, uniq([...melange(k.res, lid + k.k), ...melange(proches, lid + k.k + 'k')]).slice(0, 3));
};
const exLecture = (lid, m, rang, tag = 'lecture') => qcm(
  { id: `${lid}-${m.plain}-${tag}`, q: `Comment se lit **${m.plain}** ?`, explain: `${m.jp} : ${m.fr}.` },
  m.kana, choixLecture(m, lid + m.plain, motsAvant(rang)));
const exEcrit = (lid, m, rang) => {
  const i = m.t.findIndex(x => x.p.length === 1 && isKanji(x.p));
  if (i < 0) return null;
  const x = m.t[i];
  const f = faussesKanji(x.p, x.r, lid + m.plain, rang).map(k => m.t.map((y, j) => (j === i ? k : y.p)).join('')).filter(s => !CONNUS.has(s));
  if (f.length < 3) return null;
  return qcm({ id: `${lid}-${m.plain}-ecrit`, q: `Quel mot s'écrit **${m.kana}** (${m.fr}) ?`, explain: `${m.jp} : ${m.fr}.` }, m.plain, f);
};
const exTrou = (lid, m, rang) => {
  const i = m.t.findLastIndex(x => x.p.length === 1 && isKanji(x.p));
  if (i < 0 || m.t.filter(x => isKanji(x.p[0])).length < 2) return null;
  const x = m.t[i];
  const f = faussesKanji(x.p, x.r, lid + m.plain + 't', rang).filter(k => !CONNUS.has(m.t.map((y, j) => (j === i ? k : y.p)).join('')));
  if (f.length < 3) return null;
  return qcm({ id: `${lid}-${m.plain}-trou`, q: `Complète le mot **${m.kana}** (${m.fr}) :`, jp: m.t.map((y, j) => (j === i ? '＿' : y.p)).join(''), explain: `${m.jp} : ${m.fr}.` }, x.p, f);
};

// Phrases reprises des deux autres applis : on retire les furigana de ce qui est déjà acquis.
function allege(t, connus) {
  return t.map(x => ([...x.p].every(c => !isKanji(c) || connus.has(c)) ? { p: x.p, r: x.p } : x));
}
function trouver(m, t) {
  // Verbes et adjectifs : le radical suffit (食べ → 食べます).
  const finKana = !isKanji(m.plain.at(-1)) && m.plain.length > 1;
  for (const [p, r] of finKana ? [[m.plain, m.kana], [m.plain.slice(0, -1), m.kana.slice(0, -1)]] : [[m.plain, m.kana]]) {
    for (let i = 0; i < t.length; i++) {
      let j = i, sp = '', sr = '';
      while (j < t.length && sp.length < p.length) { sp += t[j].p; sr += t[j].r; j++; }
      if (sp === p && sr === r && !isKanji(t[i - 1]?.p?.[0] ?? '') && !isKanji(t[j]?.p?.[0] ?? '')) return { i, j, p, r };
    }
  }
  return null;
}
const PHRASES_T = PHRASES.map(s => ({ ...s, t: tokens(s.jp) }));
const dejaPrises = new Set();
function exPhrase(lid, m, connus, rang, q, sansAide = false) {
  if (m.plain === '何' || m.t.length === 1 && m.kana.length < 2) return null;
  for (const s of PHRASES_T) {
    if (dejaPrises.has(s.jp) || s.n4 && lid.startsWith('k5')) continue;
    const pos = trouver(m, s.t);
    if (!pos) continue;
    if (sansAide && s.t.some(x => [...x.p].some(c => isKanji(c) && !connus.has(c)))) continue;
    const m2 = mot(m.jp, m.fr);
    let fausses;
    const coupe = pos.r.length === m.kana.length ? 0 : m.kana.length - pos.r.length;
    const fin = x => (coupe ? x.slice(0, -coupe) : x);
    fausses = uniq(piegesLecture(m2).map(fin)).filter(x => x && x !== pos.r);
    if (fausses.length < 3) {
      // Radical de verbe ou d'adjectif : pas de mot coupé, mais une autre lecture kun à la place du kanji.
      const reste = coupe ? pos.r.slice(m.t[0].r.length) : null;
      const autres = coupe ? ORDRE.filter(k => FICHE[k].rang <= rang).flatMap(k => FICHE[k].kun.map(x => x.split('(')[0])).filter(x => x[0] !== pos.r[0] && x.length === m.t[0].r.length).map(x => x + reste)
        : motsAvant(rang).filter(o => o.kana[0] !== pos.r[0]).map(o => o.kana);
      fausses = uniq([...fausses, ...melange(uniq(autres), lid + m.plain + 'f')]).filter(x => x && x !== pos.r && !KANAS.has(x + 'る'));
    }
    dejaPrises.add(s.jp);
    const cle = s.jp;
    const avant = unmark(allege(s.t.slice(0, pos.i), connus));
    const apres = unmark(allege(s.t.slice(pos.j), connus));
    // La traduction n'apparaît qu'après la réponse (dans l'explication).
    return qcm({ id: `${lid}-${m.plain}-phrase`, q, jp: `${avant}**${pos.p}**${apres}`, explain: `**${pos.p}** se lit ${pos.r} ici (${m.jp} : ${m.fr}). « ${s.fr} »` },
      pos.r, melange(fausses, lid + m.plain).slice(0, 3), cle);
  }
  return null;
}
function exIntrus(lid, ms, rang) {
  const cible = ms.find(m => piegesLecture(m).length);
  if (!cible) return null;
  const faux = melange(piegesLecture(cible), lid)[0];
  const bons = melange(ms.filter(m => m !== cible && !AMBIGUS.has(m.plain)), lid + 'b').slice(0, 3).map(m => `${m.plain} → ${m.kana}`);
  if (bons.length < 3) return null;
  return qcm({ id: `${lid}-${cible.plain}-intrus`, q: 'Un seul de ces mots est mal lu. Lequel ?', explain: `${cible.jp} se lit ${cible.kana}, pas ${faux}.` }, `${cible.plain} → ${faux}`, bons);
}

// ---------- Tableaux à la main (blocs 5 et points clés) ----------
// [mot, lecture, sens, fausses lectures]
const COMPTEURS = [
  ['一人', 'ひとり', 'une personne', ['ひとにん', 'いちじん', 'かずと']], ['二人', 'ふたり', 'deux personnes', ['ふたにん', 'にじん', 'ふつり']],
  ['三人', 'さんにん', 'trois personnes', ['みにん', 'さんじん', 'さんり']], ['四人', 'よにん', 'quatre personnes', ['よんじん', 'よんり', 'しじん']],
  ['何人', 'なんにん', 'combien de personnes', ['なんり', 'なにびと', 'なんひと']],
  ['一本', 'いっぽん', 'un (objet long)', ['いちほん', 'いっほん', 'いちぽん']], ['二本', 'にほん', 'deux (objets longs)', ['にぼん', 'にぽん', 'ふたほん']],
  ['三本', 'さんぼん', 'trois (objets longs)', ['さんほん', 'さんぽん', 'みほん']], ['六本', 'ろっぽん', 'six (objets longs)', ['ろくほん', 'ろくぽん', 'むほん']],
  ['三百', 'さんびゃく', '300', ['さんひゃく', 'さんぴゃく', 'みひゃく']], ['六百', 'ろっぴゃく', '600', ['ろくひゃく', 'ろくびゃく', 'ろっひゃく']], ['八百', 'はっぴゃく', '800', ['はちひゃく', 'はちびゃく', 'はっひゃく']],
  ['三千', 'さんぜん', '3 000', ['さんせん', 'みせん', 'さんちぇん']], ['八千', 'はっせん', '8 000', ['はちぜん', 'はっぜん', 'やせん']],
  ['一分', 'いっぷん', 'une minute', ['いちふん', 'いっふん', 'ひとふん']], ['二分', 'にふん', 'deux minutes', ['にぷん', 'ふたぷん', 'ふたふん']],
  ['三分', 'さんぷん', 'trois minutes', ['さんふん', 'みふん', 'さんぷう']], ['六分', 'ろっぷん', 'six minutes', ['ろくふん', 'ろっふん', 'むふん']],
  ['四時', 'よじ', '4 heures', ['よんじ', 'しじ', 'よっじ']], ['七時', 'しちじ', '7 heures', ['しじ', 'なじ', 'しちどき']], ['九時', 'くじ', '9 heures', ['きゅうじ', 'ここのじ', 'きじ']],
  ['四月', 'しがつ', 'avril', ['よんがつ', 'よがつ', 'よつがつ']], ['七月', 'しちがつ', 'juillet', ['しちげつ', 'なげつ', 'ななげつ']], ['九月', 'くがつ', 'septembre', ['きゅうがつ', 'ここのがつ', 'くげつ']],
  ['一つ', 'ひとつ', 'un objet', ['いちつ', 'いつつ', 'ひとっつ']], ['四つ', 'よっつ', 'quatre objets', ['よんつ', 'しつ', 'よつつ']], ['七つ', 'ななつ', 'sept objets', ['しちつ', 'なつ', 'しちっつ']], ['九つ', 'ここのつ', 'neuf objets', ['きゅうつ', 'くつ', 'きゅっつ']],
];
const JOURS = [
  ['一日', 'ついたち', 'le 1er', ['ひとか', 'いちか', 'ふつか']], ['二日', 'ふつか', 'le 2', ['ににち', 'ふたか', 'はつか']], ['三日', 'みっか', 'le 3', ['さんにち', 'みか', 'むいか']],
  ['四日', 'よっか', 'le 4', ['よんにち', 'しにち', 'ようか']], ['五日', 'いつか', 'le 5', ['ごにち', 'いつにち', 'ごか']], ['六日', 'むいか', 'le 6', ['ろくにち', 'みっか', 'ろっか']],
  ['七日', 'なのか', 'le 7', ['しちか', 'ななか', 'なのにち']], ['八日', 'ようか', 'le 8', ['はちにち', 'よっか', 'やか']], ['九日', 'ここのか', 'le 9', ['くにち', 'きゅうか', 'ここか']],
  ['十日', 'とおか', 'le 10', ['じゅうか', 'とうにち', 'じゅっか']], ['十四日', 'じゅうよっか', 'le 14', ['じゅうよんにち', 'じゅうしか', 'とおよっか']],
  ['二十日', 'はつか', 'le 20', ['にじゅうか', 'ふつか', 'はちか']], ['二十四日', 'にじゅうよっか', 'le 24', ['にじゅうよんにち', 'にじゅうしか', 'はつよっか']],
];
// [mot à trou, lecture, sens, bon kanji, sosies]
const SOSIES = [
  ['＿本', 'にほん', 'Japon', '日', '目白百'], ['一つ＿', 'ひとつめ', 'le premier', '目', '日白自'],
  ['＿学', 'だいがく', 'université', '大', '犬太人'], ['＿人', 'おとな', 'adulte', '大', '太犬入'],
  ['＿曜日', 'どようび', 'samedi', '土', '士上工'], ['富＿山', 'ふじさん', 'mont Fuji', '士', '土上干'],
  ['＿曜日', 'もくようび', 'jeudi', '木', '本末未'], ['週＿', 'しゅうまつ', 'week-end', '末', '未木本'],
  ['＿来', 'みらい', 'avenir', '未', '末木本'], ['＿口', 'いりぐち', 'entrée', '入', '人八大'],
  ['＿百', 'はっぴゃく', '800', '八', '人入六'], ['日本＿', 'にほんじん', 'Japonais(e)', '人', '入八大'],
  ['＿い', 'しろい', 'blanc', '白', '百日自'], ['三＿', 'さんびゃく', '300', '百', '白日目'],
  ['三＿', 'さんぜん', '3 000', '千', '十干午'], ['＿月', 'じゅうがつ', 'octobre', '十', '千七干'],
  ['＿前', 'ごぜん', 'matin', '午', '牛年千'], ['＿肉', 'ぎゅうにく', 'viande de bœuf', '牛', '午年半'],
  ['＿る', 'みる', 'voir', '見', '貝買目'], ['＿う', 'かう', 'acheter', '買', '見貝員'],
  ['時＿', 'じかん', 'temps, durée', '間', '聞門問'], ['新＿', 'しんぶん', 'journal', '聞', '間門問'],
  ['＿', 'みぎ', 'droite', '右', '左石古'], ['＿', 'ひだり', 'gauche', '左', '右石在'],
  ['＿べる', 'たべる', 'manger', '食', '飲飯館'], ['＿む', 'のむ', 'boire', '飲', '食飯欠'], ['ご＿', 'ごはん', 'riz cuit, repas', '飯', '食飲館'],
  ['＿日', 'まいにち', 'tous les jours', '毎', '母海貝'], ['お＿さん', 'おかあさん', 'mère', '母', '毎海父'],
  ['＿さい', 'ちいさい', 'petit', '小', '少水川'], ['＿し', 'すこし', 'un peu', '少', '小水川'],
  ['＿校', 'がっこう', 'école', '学', '字子宇'], ['漢＿', 'かんじ', 'kanji', '字', '学子宇'],
  ['＿週', 'こんしゅう', 'cette semaine', '今', '会合金'], ['＿社', 'かいしゃ', 'entreprise', '会', '今合金'],
  ['＿気', 'てんき', 'temps (météo)', '天', '大夫太'],
];
const PIEGES = ['日', '生', '人', '下', '上', '大', '中', '月', '金', '行', '外', '今', '一', '二', '子', '後', '分', '入', '出', '高'];

const usesDe = s => uniq([...s].filter(c => FICHE[c]).map(c => LECON_DE[c]));
// Tableaux du N5 : seuls les kanji du N5 comptent (un kanji du N4 n'y est qu'un mot connu).
const usesDe5 = s => usesDe(s).filter(id => id.startsWith('k5'));
const exTable = (pre, [w, kana, fr, faux], q) => qcm({ id: `${pre}-${w}`, uses: usesDe5(w), q: q ?? `Comment se lit **${w}** (${fr}) ?`, explain: `**${w}** se lit ${kana}.` }, kana, faux);
const exSosie = (pre, [jp, kana, fr, bon, faux]) => qcm({ id: `${pre}-${kana}`, uses: usesDe5(jp + bon), q: `Quel kanji complète **${kana}** (${fr}) ?`, jp, explain: `Le bon kanji est **${bon}**. Attention à ${[...faux].join(', ')}.` }, bon, [...faux]);
function exOnKun(pre, m, x) {
  const f = FICHE[x.p], on = f.on.map(hira).includes(x.r), kun = f.kun.map(k => k.split('(')[0]).includes(x.r);
  if (on === kun) return null;
  return qcm({ id: `${pre}-${m.plain}-${x.p}`, uses: [LECON_DE[x.p]], q: `Dans **${m.plain}** (${m.kana}), ${x.p} est lu comment ?`, explain: `${x.p} se lit ${x.r} ici : c'est une lecture ${on ? 'on (venue du chinois, kanji en composé)' : 'kun (japonaise)'}.` },
    on ? 'en on' : 'en kun', [on ? 'en kun' : 'en on']);
}
const paires = [...MOTS.values()].filter(m => rangMot(m) < LECONS5.length).flatMap(m => m.t.filter(x => x.p.length === 1 && FICHE[x.p] && FICHE[x.p].rang < LECONS5.length && !x.r.match(/っ$/) && m.t.length > 1).map(x => [m, x]));

const SHEET = {
  onkun: { sections: [{ h: 'La règle de base', p: ['**Kun** : la lecture japonaise. Kanji seul, ou suivi de kana (okurigana) : {食|た}べる, {山|やま}.', '**On** : la lecture venue du chinois. Kanji collés entre eux : {学|がく}{生|せい}, {電|でん}{車|しゃ}.', 'En katakana dans les fiches : on. En hiragana : kun.'], grid: { head: ['Forme', 'Lecture', 'Exemple'], rows: [['Kanji + kana', 'kun', '{高|たか}い, {行|い}く'], ['Kanji seul', 'kun', '{水|みず}, {人|ひと}'], ['Deux kanji ou plus', 'on', '{毎|まい}{日|にち}, {来|らい}{週|しゅう}']] } }], pieges: ['Il y a des exceptions : {今年|ことし}, {大人|おとな}, {今日|きょう} se lisent en bloc.', 'Certains composés sont en kun : {名|な}{前|まえ}, {手|て}{紙|がみ}.'] },
  pieges: { sections: [{ h: 'Un kanji, plusieurs lectures', p: ['Retiens un **mot** par lecture, pas une liste de lectures.'], grid: { head: ['Kanji', 'Mots à retenir'], rows: [['日', '{毎|まい}{日|にち}・{日|に}{本|ほん}・{日|にち}{曜|よう}{日|び}・{二日|ふつか}'], ['生', '{学|がく}{生|せい}・{生|う}まれる'], ['人', '{人|ひと}・{日|に}{本|ほん}{人|じん}・{何|なん}{人|にん}・{一人|ひとり}'], ['下', '{下|した}・{地|ち}{下|か}{鉄|てつ}・{下手|へた}・{下|くだ}さい'], ['大', '{大|おお}きい・{大|だい}{学|がく}・{大|たい}{切|せつ}・{大人|おとな}'], ['月', '{月|つき}・{月|げつ}{曜|よう}{日|び}・{一|いち}{月|がつ}'], ['金', 'お{金|かね}・{金|きん}{曜|よう}{日|び}'], ['行', '{行|い}く・{銀|ぎん}{行|こう}']] } }], pieges: ['何 : なに ou なん selon ce qui suit ({何|なん}ですか、{何|なに}を{食|た}べますか).'] },
  compteurs: { sections: [{ h: 'Les personnes', p: ['**{一人|ひとり}, {二人|ふたり}** sont irréguliers, puis {三人|さんにん}, {四人|よにん} (pas よんにん).'] }, { h: 'Sons qui changent', p: ['Compteur en は/ひ/ふ/ほ : le son change après 1, 3, 6, 8.'], grid: { head: ['', '本', '百', '分'], rows: [['1', 'いっ==ぽん==', 'ひゃく', 'いっ==ぷん=='], ['3', 'さん==ぼん==', 'さん==びゃく==', 'さん==ぷん=='], ['6', 'ろっ==ぽん==', 'ろっ==ぴゃく==', 'ろっ==ぷん=='], ['8', 'はっ==ぽん==', 'はっ==ぴゃく==', 'はっ==ぷん==']] } }, { h: 'Les jours du mois', p: ['1 à 10 et 20 ont une lecture japonaise. 14 et 24 aussi. Les autres sont réguliers : {十一日|じゅういちにち}.'], grid: { head: ['Jour', 'Lecture', 'Jour', 'Lecture'], rows: [['1', 'ついたち', '6', 'むいか'], ['2', 'ふつか', '7', 'なのか'], ['3', 'みっか', '8', 'ようか'], ['4', 'よっか', '9', 'ここのか'], ['5', 'いつか', '10', 'とおか'], ['14', 'じゅうよっか', '20', 'はつか']] } }], pieges: ['{四時|よじ} et {四月|しがつ} : ni よん, ni la même lecture !', '{九時|くじ}, {九月|くがつ}, mais {九|きゅう}.', '{七時|しちじ}, {七月|しちがつ} : on dit しち ici.'] },
  sosies: { sections: [{ h: 'Paires à séparer', p: ['Regarde le détail qui change, et rattache chaque kanji à un mot connu.'], grid: { head: ['Kanji', 'Différence'], rows: [['日 / 目', '目 a deux barres et il est plus haut (un œil).'], ['大 / 犬 / 太', '犬 : point en haut à droite. 太 : point en bas.'], ['土 / 士', '土 : barre du bas plus longue. 士 : barre du haut plus longue.'], ['末 / 未', '末 : barre du haut longue (la fin). 未 : barre du haut courte (pas encore).'], ['人 / 入 / 八', '入 : le trait de droite domine. 八 : traits séparés.'], ['午 / 牛', '牛 a une corne : le trait central dépasse.'], ['聞 / 間', '聞 : une oreille 耳 dans la porte. 間 : un soleil 日.'], ['右 / 左', '右 : bouche 口 (mange). 左 : outil 工.'], ['毎 / 母', '毎 = 母 + un chapeau.'], ['白 / 百', '百 = 白 + un trait au-dessus.']] } }], pieges: ['Les kanji hors N5 de ces paires (犬, 太, 士, 末, 未, 牛…) sont ici seulement pour les distinguer.'] },
};

// ---------- Construction des blocs ----------
const connusJusque = rang => new Set(ORDRE.filter(k => FICHE[k].rang <= rang));
const union = (...ss) => new Set(ss.flatMap(x => [...x]));
const prisLecture = new Set(), prisEcrit = new Set();
const fiche = k => ({ h: `${k.k} · ${k.fr}`, p: [`**On** : ${k.on.join('、') || '—'}　**Kun** : ${k.kun.join('、') || '—'}`, k.memo], vocab: k.mots.map(([jp, fr]) => ({ jp, fr })) });

// Blocs de nouveaux kanji (5 leçons chacun). `offset` = rang de la 1re leçon,
// `base` = kanji déjà acquis (jamais de furigana dans les phrases).
function blocsKanji(lecons, offset, pre, titres, niveau, base) {
  const blocs = [];
  lecons.forEach((l, li) => {
    const i = offset + li, b = Math.floor(li / 5);
    (blocs[b] ??= { id: `${pre}-b0${b + 1}`, level: niveau, title: titres[b], lessons: [], test: [], examTest: [] });
    // Furigana : partout aux blocs 1-2 (sauf kanji déjà acquis), puis retirés sur les kanji des blocs terminés.
    const connus = b < 2 ? base : union(base, connusJusque(offset + b * 5 - 1));
    // Candidats par famille, puis on en garde LECON_MAX (≈ 20 questions avec les 5 rappels, comme les autres applis).
    const r = Math.max(i, offset + 4);
    const sens = [], kanji = [], lect = [], ecrit = [], phr = [];
    for (const k of l.kanji) {
      sens.push(exSens(l.id, k, r)); kanji.push(exKanji(l.id, k, r));
      const m = k.w.find(w => !prisLecture.has(w.plain) && !AMBIGUS.has(w.plain)) ?? k.w.find(w => !AMBIGUS.has(w.plain));
      if (m && !prisLecture.has(m.plain) && !lect.some(x => x[0] === m.plain)) lect.push([m.plain, exLecture(l.id, m, r)]);
      for (const w of k.w) {
        if (prisEcrit.has(w.plain) || ecrit.some(x => x[0] === w.plain)) continue;
        const e = exTrou(l.id, w, r) ?? exEcrit(l.id, w, r);
        if (e) { ecrit.push([w.plain, e]); break; }
      }
    }
    const ms = uniq(l.kanji.flatMap(k => k.w));
    for (const m of ms) { if (phr.length >= 4) break; const e = exPhrase(l.id, m, connus, r, 'Comment se lit le mot en gras ?'); if (e) phr.push(e); }
    const intrus = exIntrus(l.id, ms, i);
    // Priorité : sens et lecture de chaque kanji, puis on alterne écrit / phrase / kanji (+ l'intrus).
    const reste = [];
    for (let j = 0; j < 8; j++) reste.push(ecrit[j]?.[1], phr[j], kanji[j]);
    if (intrus) reste.splice(3, 0, intrus);
    const exercises = [...sens, ...lect.map(x => x[1]), ...reste.filter(Boolean)].slice(0, LECON_MAX);
    // Ce qui n'est pas gardé reste disponible pour les tests (lectures, écritures) et les autres leçons (phrases).
    const pris = new Set(exercises);
    lect.forEach(([w, e]) => pris.has(e) && prisLecture.add(w));
    ecrit.forEach(([w, e]) => pris.has(e) && prisEcrit.add(w));
    phr.forEach(e => { if (!pris.has(e)) dejaPrises.delete(e.phrase); });
    const pieges = l.kanji.filter(k => k.res.some(r => FICHE[r])).map(k => `${k.k} (${k.fr}) : ne le confonds pas avec ${k.res.filter(r => FICHE[r]).map(r => `${r} (${FICHE[r].fr})`).join(', ')}.`);
    blocs[b].lessons.push({ id: l.id, title: `${l.title} : ${l.kanji.map(k => k.k).join(' ')}`, sections: l.kanji.map(fiche), pieges, exercises });
  });

  // Tests : les lectures et écritures pas encore posées en leçon, plus des phrases.
  blocs.forEach((b, bi) => {
    const fin = offset + bi * 5 + 4, connus = bi < 2 ? base : union(base, connusJusque(fin - 5));
    const ms = uniq(lecons.slice(bi * 5, bi * 5 + 5).flatMap(l => l.kanji.flatMap(k => k.w)));
    for (const m of ms) {
      if (b.test.length >= 24) break;
      if (!prisLecture.has(m.plain) && !AMBIGUS.has(m.plain)) { prisLecture.add(m.plain); b.test.push(exLecture(b.id, m, fin)); }
      else if (!prisEcrit.has(m.plain)) { const e = exEcrit(b.id, m, fin); if (e) { prisEcrit.add(m.plain); b.test.push(e); } }
    }
    for (const m of ms) { if (b.test.length >= 30) break; const e = exPhrase(b.id, m, connus, fin, 'Comment se lit le mot en gras ?'); if (e) b.test.push(e); }
    if ((bi + 1) % 2 === 0) for (const m of ms) { if (b.examTest.length >= 12) break; const e = exPhrase(`${b.id}x`, m, union(base, connusJusque(fin)), fin, 'Sans furigana : comment se lit le mot en gras ?', true); if (e) b.examTest.push(e); }
  });
  return blocs;
}

// Bloc « Lire sans aide » : phrases sans furigana sur les kanji acquis. `parts` = [id, titre, 1re leçon, fin exclue].
function blocSansAide(id, niveau, lecons, parts, connus, R, texte) {
  const q = 'Sans furigana : comment se lit le mot en gras ?';
  const bloc = { id, level: niveau, title: 'Lire sans aide', test: [], examTest: [], lessons: parts.map(([lid, title, a, z]) => {
    const ms = uniq(lecons.slice(a, z).flatMap(l => l.kanji.flatMap(k => k.w)));
    const exercises = [];
    for (const m of melange(ms, lid)) { if (exercises.length >= 15) break; const e = exPhrase(lid, m, connus, R, q, true); if (e) exercises.push({ ...e, uses: usesDe(m.plain).slice(0, 1) }); }
    return { id: lid, title, sections: [{ h: 'Plus de filet', p: [texte, 'Le bouton 漢 ne changera rien sur ces mots : ils sont vraiment écrits sans lecture.'] }], exercises };
  }) };
  const ms = uniq(lecons.flatMap(l => l.kanji.flatMap(k => k.w)));
  for (const m of melange(ms, id === 'k5-b06' ? 'b6' : id)) { if (bloc.test.length >= 18) break; const e = exPhrase(id, m, connus, R, q, true); if (e) bloc.test.push(e); }
  for (const m of melange(ms, id === 'k5-b06' ? 'b6x' : id + 'x')) { if (bloc.examTest.length >= 12) break; const e = exPhrase(`${id}x`, m, connus, R, q, true); if (e) bloc.examTest.push(e); }
  return bloc;
}

const blocs = blocsKanji(LECONS5, 0, 'k5', BLOCS, 'N5', new Set());

// Bloc 5 : les pièges (aucun nouveau kanji).
const R = LECONS5.length - 1, tout = connusJusque(R);
const sept = (a, n) => a.filter((_, i) => i % 2 === n);
const lecture5 = (id, title, sheet, exercises) => ({ id, title, sections: sheet.sections.map(({ grid, ...s }) => (grid ? { ...s, vocab: grid.rows.map(r => ({ jp: r[0], fr: r.slice(1).join(' · ') })) } : s)), pieges: sheet.pieges, exercises: exercises.slice(0, LECON_MAX) });
const piegesEx = pre => PIEGES.flatMap(k => FICHE[k].w.filter(m => !AMBIGUS.has(m.plain) && piegesLecture(m).length).slice(0, 2).map(m => ({ ...exLecture(pre, m, R, 'piege'), uses: [LECON_DE[k]] })));
const uniqId = a => [...new Map(a.map(e => [e.id, e])).values()];
const onkunEx = pre => uniqId(paires.map(([m, x]) => exOnKun(pre, m, x)).filter(Boolean));
blocs.push({ id: 'k5-b05', level: 'N5', title: 'Les pièges', test: [], examTest: [], lessons: [
  lecture5('k5-21', 'On ou kun ?', SHEET.onkun, onkunEx('k5-21').filter((_, i) => i % 3 === 0).slice(0, LECON_MAX)),
  lecture5('k5-22', 'Les lectures piégeuses', SHEET.pieges, uniqId(piegesEx('k5-22')).filter((_, i) => i % 2 === 0)),
  lecture5('k5-23', 'Les kanji qui se ressemblent', SHEET.sosies, sept(SOSIES, 0).map(s => exSosie('k5-23', s))),
  lecture5('k5-24', 'Les compteurs', { sections: SHEET.compteurs.sections.slice(0, 2), pieges: SHEET.compteurs.pieges }, sept(COMPTEURS, 0).map(s => exTable('k5-24', s))),
  lecture5('k5-25', 'Les jours du mois', { sections: SHEET.compteurs.sections.slice(2), pieges: [] }, sept(JOURS, 0).map(s => exTable('k5-25', s, `Quel jour du mois : comment se lit **${s[0]}** (${s[2]}) ?`))),
] });
const b5 = blocs[4];
b5.test = [...sept(COMPTEURS, 1).map(s => exTable('k5-b05', s)), ...sept(JOURS, 1).map(s => exTable('k5-b05', s)), ...onkunEx('k5-b05').filter((_, i) => i % 3 === 1).slice(0, 8)];

dejaPrises.clear();
// Bloc 6 : lire sans aide. Seuls les kanji hors programme gardent leurs furigana.
const LECTURES = [['k5-26', 'Sans aide : les kanji du bloc 1', 0, 5], ['k5-27', 'Sans aide : les kanji du bloc 2', 5, 10], ['k5-28', 'Sans aide : les kanji du bloc 3', 10, 15], ['k5-29', 'Sans aide : les kanji du bloc 4', 15, 20], ['k5-30', 'Sans aide : tout le N5', 0, 20]];
blocs.push(blocSansAide('k5-b06', 'N5', LECONS5, LECTURES, tout, R, 'Ici, les kanji du N5 n\'ont plus de furigana : seuls ceux hors programme en gardent. Lis toute la phrase avant de répondre, le contexte t\'aide.'));

// ---------- N4 ----------
// Les kanji du N5 sont acquis : jamais de furigana sur eux dans les phrases du N4.
const blocs4 = [];
if (LECONS4.length) {
  const o = LECONS5.length, n = LECONS4.length, R4 = o + n - 1;
  blocs4.push(...blocsKanji(LECONS4, o, 'k4', BLOCS4, 'N4', tout));
  dejaPrises.clear();
  const L = (k, t, a, z) => [`k4-${String(n + k).padStart(2, '0')}`, t, a, z];
  blocs4.push(blocSansAide(`k4-b0${Math.ceil(n / 5) + 1}`, 'N4', LECONS4, [
    L(1, 'Sans aide : les blocs 1 et 2', 0, 10), L(2, 'Sans aide : les blocs 3 et 4', 10, 20), L(3, 'Sans aide : le bloc 5', 20, 25),
    L(4, 'Sans aide : le bloc 6', 25, n), L(5, 'Sans aide : tout le N4', 0, n),
  ], connusJusque(R4), R4, 'Ici, plus aucun kanji du N5 ni du N4 n\'a de furigana. Lis toute la phrase avant de répondre, le contexte t\'aide.'));
}

// ---------- Écriture ----------
blocs.forEach((b, i) => out(`n5/bloc0${i + 1}.json`, b));
blocs4.forEach((b, i) => out(`n4/bloc0${i + 1}.json`, b));
// La bulle : UNIQUEMENT les kanji que l'utilisateur a choisis (data/sources/bulle.json). Rien d'automatique.
// Chaque question n'apparaît qu'une fois la leçon de son kanji faite.
const BULLE = uniq(src('bulle.json')).filter(k => FICHE[k]);
const FOCUS = BULLE.length ? [{
  file: 'mes-kanji', id: 'mes-kanji', label: BULLE.slice(0, 4).join(''), title: 'Mes kanji à revoir', unlockAfter: LECON_DE[BULLE.reduce((a, k) => (FICHE[k].rang < FICHE[a].rang ? k : a))],
  sheet: { sections: BULLE.map(k => fiche(FICHE[k])), pieges: [] },
  exercises: uniqId(BULLE.flatMap(c => {
    const k = FICHE[c];
    const ms = k.w.filter(m => !AMBIGUS.has(m.plain));
    return [exSens('f-mk', k, R), exKanji('f-mk', k, R), ...ms.map(m => exLecture('f-mk', m, R)), ...ms.map(m => exTrou('f-mk', m, R) ?? exEcrit('f-mk', m, R))]
      .filter(Boolean).map(e => ({ ...e, uses: [LECON_DE[c]] }));
  })),
}] : [];
FOCUS.forEach(({ file, ...f }) => out(`focus/${file}.json`, f));
out('manifest.json', { examEvery: 4, miniExamEvery: 2, focus: FOCUS.map(f => `data/focus/${f.file}.json`), blocks: [...blocs.map((_, i) => `data/n5/bloc0${i + 1}.json`), ...blocs4.map((_, i) => `data/n4/bloc0${i + 1}.json`)] });
const nb = [...blocs, ...blocs4].map(b => `${b.id} ${b.lessons.map(l => l.exercises.length).join('+')} | test ${b.test.length} | exam ${b.examTest.length}`);
console.log(nb.join('\n'));
console.log('focus', FOCUS.map(f => f.exercises.length).join(' '));
const vu = [...MOTS.values()].filter(m => VOC.some(w => plain(w.jp) === m.plain)).length;
console.log(`${MOTS.size} mots, dont ${vu} déjà dans le vocabulaire.`);
