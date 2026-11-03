// The teachers' curriculum (data/curriculum.json, imported from the Excel template).
// The learning plan only ever contains stages from here, chosen by rules (path below). Claude never chooses or writes them.
const fs = require("fs");
const nodePath = require("path");

const CURRICULUM_PATH = process.env.CURRICULUM_PATH || nodePath.join(__dirname, "..", "data", "curriculum.json");
const DIAG_LEVELS = ["R1", "R2", "R3", "R4", "R5", "R6"];
const GOAL_IDS = require("../public/js/options").GOALS.map((g) => g.id);

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

// The plan is written only from an approved curriculum; a draft can be used only when explicitly allowed (local demo).
function usable(c, allowDraft = process.env.ALLOW_DRAFT_CURRICULUM === "1") {
  return problems(c).length === 0 && (c.status === "approved" || allowDraft);
}

// The child's path, by rules only (no model):
// - starts at the stage the diagnosis map gives for the child's level (the first stage not yet mastered);
// - walks the curriculum in order up to the goal's end stage;
// - keeps the foundation stages (the program of the R1 start stage) and the stages of the goal's own program;
// - keeps only stages for the child's track (or both tracks).
// A goal mapped to "" ends with the last foundation stage. Returns { stages, reached }: reached = the child is already past the goal.
function path(c, diagLevel, goal, track) {
  const at = (id) => c.stages.findIndex((s) => s.id === id);
  const start = at(c.diagnosis_map[diagLevel]);
  if (start < 0) return { stages: [], reached: false };
  const foundation = c.stages[at(c.diagnosis_map.R1)].program;
  const endId = c.goal_map && c.goal_map[goal];
  const end = endId ? at(endId) : c.stages.map((s) => s.program).lastIndexOf(foundation);
  if (end < start) return { stages: [], reached: true };
  const goalProgram = c.stages[end].program;
  const okTrack = (s) => !s.track || s.track === "both" || s.track === track;
  const stages = c.stages.slice(start, end + 1).filter((s) => (s.program === foundation || s.program === goalProgram) && okTrack(s));
  return { stages, reached: false };
}

// Lessons and weeks for a path, from the curriculum's own numbers.
function totals(stages, perWeek) {
  const sessions = stages.reduce((n, s) => n + s.sessions, 0);
  return { sessions, per_week: perWeek, weeks: Math.ceil(sessions / perWeek) };
}

module.exports = { load, problems, usable, path, totals, DIAG_LEVELS, GOAL_IDS, CURRICULUM_PATH };
