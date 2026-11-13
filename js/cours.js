// Chargement du cours : manifeste, blocs, leçons, tests, examens et points clés.

import { CONFIG } from './config.js';

async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url} : ${r.status}`);
  return r.json();
}

export async function loadCourse() {
  const manifest = await fetchJSON('data/manifest.json');
  const [blocks, focus] = await Promise.all([
    Promise.all(manifest.blocks.map(fetchJSON)),
    Promise.all((manifest.focus || []).map(fetchJSON)),
  ]);
  const c = buildCourse(blocks, manifest.examEvery || 4, manifest.miniExamEvery || 0);
  addFocus(c, focus);
  return c;
}

// Points clés : notions à marteler (antisèche + questions surprises partout).
function addFocus(c, focus) {
  c.focus = [];
  c.focusById = {};
  for (const f of focus) {
    const fp = { ...f, itemIds: [] };
    for (const ex of f.exercises || []) {
      c.items[ex.id] = { ...ex, focus: f.id, uses: unique(ex.uses?.length ? ex.uses : [f.unlockAfter]) };
      fp.itemIds.push(ex.id);
    }
    c.focus.push(fp);
    c.focusById[f.id] = fp;
  }
}

const unique = a => [...new Set(a)];

function buildCourse(blocks, examEvery, miniEvery) {
  const c = { blocks: [], blockById: {}, lessons: [], lessonById: {}, items: {}, exams: [], examById: {}, steps: [] };
  let num = 0;
  blocks.forEach((b, bi) => {
    const block = { ...b, index: bi, lessonIds: [], testIds: [], examPoolIds: [] };
    for (const l of b.lessons) {
      const lesson = { ...l, num: ++num, blockId: b.id, itemIds: [] };
      c.lessons.push(lesson);
      c.lessonById[l.id] = lesson;
      block.lessonIds.push(l.id);
      for (const ex of l.exercises || []) {
        c.items[ex.id] = { ...ex, blockId: b.id, uses: unique([l.id, ...(ex.uses || [])]) };
        lesson.itemIds.push(ex.id);
      }
    }
    for (const ex of b.test || []) {
      c.items[ex.id] = { ...ex, blockId: b.id, fromTest: true, uses: unique(ex.uses?.length ? ex.uses : block.lessonIds) };
      block.testIds.push(ex.id);
    }
    // Questions de réflexion réservées à l'examen qui suit ce bloc (première apparition).
    for (const ex of b.examTest || []) {
      c.items[ex.id] = { ...ex, blockId: b.id, examOnly: true, uses: unique(ex.uses?.length ? ex.uses : block.lessonIds) };
      block.examPoolIds.push(ex.id);
    }
    c.blocks.push(block);
    c.blockById[b.id] = block;
  });
  let bigNum = 0;
  let miniNum = 0;
  c.blocks.forEach((block, bi) => {
    block.lessonIds.forEach(id => c.steps.push({ type: 'lesson', id, level: block.level }));
    c.steps.push({ type: 'test', id: block.id, level: block.level });
    // Un grand examen tous les `examEvery` blocs, un examen intermédiaire entre deux.
    let kind = null;
    let span = 0;
    if ((bi + 1) % examEvery === 0) { kind = 'big'; span = examEvery; }
    else if (miniEvery && (bi + 1) % miniEvery === 0) { kind = 'mini'; span = miniEvery; }
    if (!kind) return;
    const group = c.blocks.slice(bi + 1 - span, bi + 1);
    const exam = {
      id: kind === 'big' ? `exam-${block.id}` : `mini-${block.id}`,
      kind,
      num: kind === 'big' ? ++bigNum : ++miniNum,
      lessonIds: group.flatMap(g => g.lessonIds),
      poolIds: block.examPoolIds,
      size: kind === 'big' ? CONFIG.examSize : CONFIG.miniExamSize,
    };
    for (const id of exam.poolIds) c.items[id].examId = exam.id;
    c.exams.push(exam);
    c.examById[exam.id] = exam;
    block.exam = exam;
    c.steps.push({ type: 'exam', id: exam.id, level: block.level });
  });
  return c;
}
