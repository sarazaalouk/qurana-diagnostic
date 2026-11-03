// The teachers' curriculum (data/curriculum.json, imported from the Excel template).
// The learning plan only ever contains stages from here, chosen by rules (path below). Claude never chooses or writes them.
const fs = require("fs");
const nodePath = require("path");

const CURRICULUM_PATH = process.env.CURRICULUM_PATH || nodePath.join(__dirname, "..", "data", "curriculum.json");
const DIAG_LEVELS = ["R1", "R2", "R3", "R4", "R5", "R6"];
const options = require("../public/js/options");
const GOAL_IDS = options.GOALS.map((g) => g.id);
const FOCUS_IDS = options.FOCUS.map((f) => f.id);

function load(file = CURRICULUM_PATH) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Returns a list of problems (empty when the curriculum can be used).
function problems(c) {
  const out = [];
  if (!c || !Array.isArray(c.levels) || !Array.isArray(c.stages)) return ["levels and stages are required"];
  if (!["draft", "approved"].includes(c.status)) out.push('status must be "draft" or "approved"');
  const levelCodes = new Set(c.levels.map((l) => l.code));
  const ids = new Set();
  c.stages.forEach((s, i) => {
    const at = `stage ${s.id || i + 1}`;
    if (!s.id || ids.has(s.id)) out.push(`${at}: id missing or repeated`);
    ids.add(s.id);
    if (!levelCodes.has(s.level)) out.push(`${at}: level ${s.level} is not in levels`);
    for (const f of ["name", "goals", "content", "exit_sign"]) if (!s[f] || !String(s[f]).trim()) out.push(`${at}: ${f} is empty`);
    if (!Number.isInteger(s.sessions) || s.sessions < 1) out.push(`${at}: sessions must be a whole number`);
    if (s.surahs !== undefined && (!Array.isArray(s.surahs) || !s.surahs.every((x) => typeof x === "string" && x.trim()))) out.push(`${at}: surahs must be a list of surah names`);
    if (s.focus !== undefined && (!Array.isArray(s.focus) || !s.focus.every((x) => FOCUS_IDS.includes(x)))) out.push(`${at}: focus must list ${FOCUS_IDS.join(", ")}`);
  });
  for (const r of DIAG_LEVELS) {
    if (!c.diagnosis_map || !ids.has(c.diagnosis_map[r])) out.push(`diagnosis_map.${r} must name a stage id`);
  }
  // Every goal names the stage the plan ends at, or "" for "foundation stages only".
  for (const g of GOAL_IDS) {
    if (!c.goal_map || typeof c.goal_map[g] !== "string") out.push(`goal_map.${g} must be a stage id or ""`);
    else if (c.goal_map[g] && !ids.has(c.goal_map[g])) out.push(`goal_map.${g} names a stage that does not exist`);
  }
  return out;
}

// The curriculum can build plans when its structure is sound. Who may see them is decided by isPublic (server.js gate).
function usable(c) {
  return problems(c).length === 0;
}

// The whole app is open to parents only when the curriculum is approved with a reviewer's name and a date
// (the «الاعتماد» tab). Until then it is an internal preview behind ADMIN_PIN.
function isPublic(c) {
  return !!c && usable(c) && c.status === "approved" && !!String(c.approved_by || "").trim() && !!String(c.approved_at || "").trim();
}

// Identifies a curriculum version, so a plan kept from an earlier version is built again.
function fingerprint(c) {
  return require("crypto").createHash("sha256").update(JSON.stringify(c)).digest("hex").slice(0, 16);
}

// The learner's path, by rules only (no model):
// - starts at the stage the diagnosis map gives for the level (the first stage not yet mastered);
// - walks the curriculum in order up to the end stage of the furthest goal chosen;
// - keeps the foundation stages (the program of the R1 start stage) and the stages of the chosen goals' programs;
// - keeps only stages for the learner's track (or both tracks);
// - memorization stages: surahs the parent said are memorized count as done — a stage whose surahs are all memorized is
//   left out; a stage with some memorized keeps the rest, with fewer lessons in proportion, and lists the memorized ones
//   for review;
// - a learner who reads from the Mushaf and memorizes takes Tajweed alongside, not after: the Tajweed stages are left
//   out and each memorization stage gets one Tajweed point ("focus"), from the answers ("no" first, then "sometimes"),
//   among the points the stage allows.
// A goal mapped to "" ends with the last foundation stage. Returns { stages, reached }: reached = already past every goal.
function path(c, diagLevel, goals, track, { memorized = [], tajweed, reads = false } = {}) {
  const at = (id) => c.stages.findIndex((s) => s.id === id);
  const start = at(c.diagnosis_map[diagLevel]);
  if (start < 0) return { stages: [], reached: false };
  const foundation = c.stages[at(c.diagnosis_map.R1)].program;
  const lastFoundation = c.stages.map((s) => s.program).lastIndexOf(foundation);
  const ends = [].concat(goals).map((g) => (c.goal_map && c.goal_map[g] ? at(c.goal_map[g]) : lastFoundation));
  if (!ends.length) return { stages: [], reached: false };
  const end = Math.max(...ends);
  if (end < start) return { stages: [], reached: true };
  const programs = new Set([foundation, ...ends.map((e) => c.stages[e].program)]);
  const okTrack = (s) => !s.track || s.track === "both" || s.track === track;
  let stages = c.stages.slice(start, end + 1).filter((s) => programs.has(s.program) && okTrack(s)).map((s) => ({ ...s }));

  // Memorized surahs.
  const known = new Set(memorized);
  stages = stages.flatMap((s) => {
    if (!Array.isArray(s.surahs) || !s.surahs.length) return [s];
    const review = s.surahs.filter((x) => known.has(x));
    if (review.length === s.surahs.length) return [];
    if (!review.length) return [s];
    const left = s.surahs.length - review.length;
    return [{ ...s, review, sessions: Math.max(1, Math.ceil((s.sessions * left) / s.surahs.length)) }];
  });
  if (!stages.length) return { stages: [], reached: true };

  // Tajweed alongside memorization.
  const hifz = stages.filter((s) => Array.isArray(s.focus) && s.focus.length);
  const order = options.focusOrder(tajweed);
  if (reads && hifz.length && order.length) {
    stages = stages.filter((s) => !isTajweedStage(s));
    let next = 0;
    for (const s of stages) {
      if (!Array.isArray(s.focus) || !s.focus.length) continue;
      const allowed = order.filter((f) => s.focus.includes(f));
      if (!allowed.length) continue;
      s.with_focus = allowed[next % allowed.length];
      next++;
    }
  }
  return { stages, reached: false };
}

// A Tajweed stage: one whose program is the Tajweed program (it can go alongside memorization instead).
const isTajweedStage = (s) => s.program === "tajweed";

// The goals a profile's path follows (child goals, or an adult's goals mapped to them).
const goalsOf = (profile) => options.pathGoals(profile);

// Lessons and weeks for a path, from the curriculum's own numbers, at the chosen rate and at 2 and 3 a week.
function totals(stages, perWeek) {
  const sessions = stages.reduce((n, s) => n + s.sessions, 0);
  return { sessions, per_week: perWeek, weeks: Math.ceil(sessions / perWeek), weeks_at: { 2: Math.ceil(sessions / 2), 3: Math.ceil(sessions / 3) } };
}

// The three time windows, by rules: the stages begun in the first month (4 weeks), the stage expected around three
// months (13 weeks), and the last stage (the goal). Ids only; the page shows the names.
function windows(stages, perWeek) {
  let from = 0;
  const span = stages.map((s) => { const r = { id: s.id, from, to: from + s.sessions }; from += s.sessions; return r; });
  const month1 = span.filter((x) => x.from < 4 * perWeek).map((x) => x.id);
  const at13 = 13 * perWeek;
  const m3 = span.find((x) => x.from <= at13 && at13 < x.to) || span[span.length - 1];
  return { month1, month3: m3.id, longer: span[span.length - 1].id, done_by_month3: from <= at13 };
}

module.exports = { load, problems, usable, isPublic, fingerprint, path, goalsOf, totals, windows, DIAG_LEVELS, GOAL_IDS, FOCUS_IDS, CURRICULUM_PATH };
