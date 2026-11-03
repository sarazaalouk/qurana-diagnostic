// Imports the teachers' curriculum Excel (built by tools/curriculum-template.js) into data/curriculum.json.
// Nothing is written when any row has a problem; the problems name the sheet and the row so the teachers can fix them.
// Run: npm run import-curriculum -- <file.xlsx> [--check]   (--check reads and reports without writing)
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const T = require("./curriculum-template");
const curriculum = require("../lib/curriculum");
const { looksLikeQuran } = require("../lib/plan");
const options = require("../public/js/options");

const ARABIC_RE = /[؀-ۿ]/;

// The text of a cell, whatever Excel stored (rich text, formula result, number, date).
function text(cell) {
  let v = cell && cell.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if (Array.isArray(v.richText)) v = v.richText.map((p) => p.text).join("");
    else if ("result" in v) v = v.result;
    else if ("text" in v) v = v.text;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v === null || v === undefined ? "" : String(v).trim();
}

const isExample = (name) => name.startsWith("مثال");

async function readWorkbook(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return fromWorkbook(wb, path.basename(file));
}

// Returns { curriculum, problems, warnings }. `curriculum` is null when there are problems.
function fromWorkbook(wb, sourceName = "") {
  const problems = [];
  const warnings = [];
  const ws = (key) => {
    const s = wb.getWorksheet(T.SHEETS[key]);
    if (!s) problems.push(`تبويب «${T.SHEETS[key]}» مش موجود`);
    return s;
  };
  const where = (key, r) => `«${T.SHEETS[key]}» سطر ${r}`;
  const englishCheck = (key, r, label, v) => {
    if (v && ARABIC_RE.test(v)) problems.push(`${where(key, r)}: عمود «${label}» فيه حروف عربية — العمود ده للإنجليزي بس`);
  };

  // Programs the teachers listed in the lists tab (column A); known ones get their short id.
  const programs = new Map();
  const ls = ws("lists");
  if (ls) for (let r = 2; r <= 60; r++) { const p = text(ls.getRow(r).getCell(1)); if (p) programs.set(p, T.PROGRAMS[p] || p); }

  // ---- levels ----
  const levels = [];
  const lv = ws("levels");
  if (lv) {
    for (let r = T.FIRST_ROW; r < T.FIRST_ROW + T.LEVEL_ROWS + 50; r++) {
      const row = lv.getRow(r);
      const [code, name, description, signs, age] = [1, 2, 3, 4, 5].map((c) => text(row.getCell(c)));
      const nameEn = text(row.getCell(7));
      if (!code && !name) continue;
      if (isExample(name)) continue;
      if (!/^[A-Za-z0-9]{1,10}$/.test(code)) { problems.push(`${where("levels", r)}: كود المستوى لازم حروف وأرقام إنجليزي بس (مثلًا L1)`); continue; }
      if (!name) problems.push(`${where("levels", r)}: اسم المستوى فاضي`);
      if (levels.some((l) => l.code === code)) problems.push(`${where("levels", r)}: الكود ${code} متكرر`);
      englishCheck("levels", r, "اسم المستوى بالإنجليزي", nameEn);
      levels.push({ code, name, ...(nameEn && { name_en: nameEn }), description, diagnosis_signs: signs, age });
    }
    if (!levels.length) problems.push(`«${T.SHEETS.levels}»: ما فيش ولا مستوى`);
  }

  // ---- stages ----
  const stages = [];
  let missingEnglish = 0;
  const st = ws("stages");
  if (st) {
    for (let r = T.FIRST_ROW; r < T.FIRST_ROW + T.STAGE_ROWS + 200; r++) {
      const row = st.getRow(r);
      const c = (i) => text(row.getCell(i));
      const s = {
        level: c(1), n: c(2), name: c(3), program: c(4), track: c(5), goals: c(6), content: c(7), sessions: c(8), exit_sign: c(9),
        teacher_note: c(10), name_en: c(11), goals_en: c(12), content_en: c(13), exit_sign_en: c(14),
        entry: c(16), entry_en: c(17), surahs: c(18), focus: c(19),
      };
      if (![s.level, s.n, s.name, s.goals, s.content, s.exit_sign].some(Boolean)) continue;
      if (isExample(s.name)) continue;
      const at = where("stages", r);
      if (!levels.some((l) => l.code === s.level)) problems.push(`${at}: كود المستوى «${s.level}» مش موجود في تبويب المستويات`);
      const n = Number(s.n);
      if (!Number.isInteger(n) || n < 1) problems.push(`${at}: رقم المرحلة لازم رقم صحيح من 1`);
      for (const [f, label] of [["name", "اسم المرحلة"], ["goals", "الأهداف"], ["content", "المحتوى"], ["exit_sign", "علامة الانتقال"]]) {
        if (!s[f]) problems.push(`${at}: «${label}» فاضي`);
        else if (looksLikeQuran(s[f])) problems.push(`${at}: «${label}» فيه نص شبه الآيات — نكتب اسم السورة وأرقام الآيات بس`);
      }
      const sessions = Number(s.sessions);
      if (!Number.isInteger(sessions) || sessions < 1 || sessions > 200) problems.push(`${at}: عدد الحصص لازم رقم من 1 لـ 200`);
      const program = programs.get(s.program);
      if (!program) problems.push(`${at}: البرنامج «${s.program}» مش في تبويب القوائم`);
      const track = s.track ? T.TRACKS[s.track] : "both";
      if (!track) problems.push(`${at}: المسار «${s.track}» مش من القائمة`);
      const english = { name_en: "اسم المرحلة بالإنجليزي", goals_en: "الأهداف بالإنجليزي", content_en: "المحتوى بالإنجليزي", exit_sign_en: "علامة الانتقال بالإنجليزي" };
      for (const [f, label] of Object.entries(english)) englishCheck("stages", r, label, s[f]);
      englishCheck("stages", r, "شرط الدخول بالإنجليزي", s.entry_en);
      if (Object.keys(english).some((f) => !s[f])) missingEnglish++;
      // Memorization stages: the surah names, and the Tajweed points that may go alongside (by name → id).
      const list = (v) => v.split(/[،,]/).map((x) => x.trim()).filter(Boolean);
      const surahs = list(s.surahs);
      const focusNames = list(s.focus);
      const focus = focusNames.map((nm) => (options.FOCUS.find((f) => f.name === nm) || {}).id);
      if (focus.some((x) => !x)) problems.push(`${at}: «تركيز مصاحب» يقبل فقط: ${options.FOCUS.map((f) => f.name).join("، ")}`);
      const id = `${s.level}-S${n}`;
      if (stages.some((x) => x.id === id)) problems.push(`${at}: المرحلة ${id} متكررة (نفس المستوى ونفس الرقم)`);
      stages.push({
        id, level: s.level, n, program, track, sessions,
        name: s.name, goals: s.goals, content: s.content, exit_sign: s.exit_sign,
        ...Object.fromEntries(Object.keys(english).filter((f) => s[f]).map((f) => [f, s[f]])),
        ...(s.entry && { entry: s.entry }),
        ...(s.entry_en && { entry_en: s.entry_en }),
        ...(surahs.length && { surahs }),
        ...(focus.length && { focus }),
        ...(s.teacher_note && { teacher_note: s.teacher_note }),
      });
    }
    if (!stages.length) problems.push(`«${T.SHEETS.stages}»: ما فيش ولا مرحلة`);
  }
  // Curriculum order: levels in their sheet order, then stage number.
  const levelOrder = new Map(levels.map((l, i) => [l.code, i]));
  stages.sort((a, b) => (levelOrder.get(a.level) ?? 99) - (levelOrder.get(b.level) ?? 99) || a.n - b.n);
  if (missingEnglish) warnings.push(`${missingEnglish} مرحلة ناقصها عمود إنجليزي أو أكتر: الأهل اللي بيستخدموا الصفحة بالإنجليزي هيشوفوا النص العربي للمراحل دي`);

  // ---- diagnosis → start stage ----
  const diagnosis_map = {};
  const mp = ws("map");
  if (mp) {
    for (let r = T.FIRST_ROW; r < T.FIRST_ROW + 6; r++) {
      const code = text(mp.getRow(r).getCell(1));
      const start = text(mp.getRow(r).getCell(4));
      if (!curriculum.DIAG_LEVELS.includes(code)) { problems.push(`${where("map", r)}: نتيجة التشخيص ${code || "(فاضية)"} مش من R1–R6 — ما تغيّروش العمود الأول`); continue; }
      if (!start) problems.push(`${where("map", r)}: اختاروا المرحلة اللي يبدأ منها ${code}`);
      else if (!stages.some((s) => s.id === start)) problems.push(`${where("map", r)}: المرحلة ${start} مش موجودة في تبويب المراحل`);
      diagnosis_map[code] = start;
    }
  }

  // ---- goal → last stage ----
  const goal_map = {};
  const gm = ws("goals");
  if (gm) {
    for (let r = T.FIRST_ROW; r < T.FIRST_ROW + curriculum.GOAL_IDS.length; r++) {
      const goal = text(gm.getRow(r).getCell(1));
      const end = text(gm.getRow(r).getCell(3));
      if (!curriculum.GOAL_IDS.includes(goal)) { problems.push(`${where("goals", r)}: كود الهدف «${goal}» اتغيّر — ما تغيّروش العمود الأول`); continue; }
      if (end && !stages.some((s) => s.id === end)) problems.push(`${where("goals", r)}: المرحلة ${end} مش موجودة في تبويب المراحل`);
      goal_map[goal] = end;
    }
  }

  // ---- plan rules ----
  const rules = [];
  const ru = ws("rules");
  if (ru) {
    for (let r = T.FIRST_ROW; r < T.FIRST_ROW + T.RULE_ROWS + 50; r++) {
      const type = text(ru.getRow(r).getCell(1));
      const rule = text(ru.getRow(r).getCell(2));
      const example = text(ru.getRow(r).getCell(3));
      if (!type && !rule) continue;
      if (!T.RULE_TYPES[type]) { problems.push(`${where("rules", r)}: النوع لازم يكون ${Object.keys(T.RULE_TYPES).join(" أو ")}`); continue; }
      if (!rule) { problems.push(`${where("rules", r)}: القاعدة فاضية`); continue; }
      rules.push({ type: T.RULE_TYPES[type], rule, ...(example && { example }) });
    }
  }

  // ---- approval ----
  let status = "draft", approved_by = "", approved_at = "", owner = "";
  const ap = ws("approval");
  if (ap) {
    owner = text(ap.getCell("B4"));
    approved_by = text(ap.getCell("B5"));
    approved_at = text(ap.getCell("B6"));
    const s = text(ap.getCell("B7"));
    status = T.STATUSES[s];
    if (!status) { problems.push(`«${T.SHEETS.approval}»: حالة المنهج لازم «مسودة» أو «معتمد»`); status = "draft"; }
    if (status === "approved" && (!approved_by || !approved_at)) problems.push(`«${T.SHEETS.approval}»: المنهج «معتمد» من غير اسم اللي راجعت أو تاريخ الاعتماد`);
  }

  const out = {
    status,
    note: `Imported from ${sourceName || "the curriculum Excel"} by tools/import-curriculum.js. Edit the Excel and import again; do not edit this file by hand.`,
    owner, approved_by, approved_at,
    source_file: sourceName,
    imported_at: new Date().toISOString(),
    levels, stages, diagnosis_map, goal_map, rules,
  };
  if (!problems.length) problems.push(...curriculum.problems(out));
  return { curriculum: problems.length ? null : out, problems, warnings };
}

module.exports = { readWorkbook, fromWorkbook, text };

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const checkOnly = args.includes("--check");
  if (!file) { console.error("usage: npm run import-curriculum -- <file.xlsx> [--check]"); process.exit(1); }
  readWorkbook(file).then(({ curriculum: c, problems, warnings }) => {
    warnings.forEach((w) => console.log(`تنبيه: ${w}`));
    if (problems.length) {
      console.log(`\nما اتكتبش حاجة. لازم يتصلح في الملف (عدد المشاكل: ${problems.length}):`);
      problems.forEach((p) => console.log(`- ${p}`));
      process.exit(1);
    }
    const summary = `المستويات: ${c.levels.length}، المراحل: ${c.stages.length}، القواعد: ${c.rules.length}، الحالة: ${c.status === "approved" ? "معتمد" : "مسودة"}`;
    if (checkOnly) { console.log(`الملف سليم (${summary}). ما اتكتبش حاجة لأنه --check.`); return; }
    fs.writeFileSync(curriculum.CURRICULUM_PATH, JSON.stringify(c, null, 2) + "\n", "utf8");
    console.log(`اتكتب ${curriculum.CURRICULUM_PATH} (${summary}).`);
    if (c.status !== "approved") console.log("المنهج مسودة: الخطط مش هتظهر للأهل إلا لما يتعلّم «معتمد» في تبويب الاعتماد ويتستورد تاني.");
  }).catch((err) => { console.error(`تعذّر قراءة الملف: ${err.message}`); process.exit(1); });
}
