// Checks a submitted diagnostic against the allowed answers. Returns { error } or { value } (cleaned).
const levels = require("../public/js/levels");
const opt = require("../public/js/options");

const str = (v, max) => typeof v === "string" && v.trim().length <= max;

function validateSubmission(body) {
  if (!body || typeof body !== "object") return { error: "body must be an object" };
  const p = body.profile || {};
  if (p.nickname !== undefined && p.nickname !== "" && !str(p.nickname, 30)) return { error: "nickname must be at most 30 characters" };
  if (!opt.AGE_BANDS.includes(p.age_band)) return { error: "age_band is not one of the options" };
  if (!opt.COUNTRIES.some((c) => c.code === p.country)) return { error: "country is not one of the options" };
  if (!opt.HOME_LANGUAGES.some((x) => x.id === p.home_language)) return { error: "home_language is not one of the options" };
  if (!Array.isArray(p.goals) || !p.goals.length || !p.goals.every((g) => opt.GOALS.some((x) => x.id === g))) return { error: "goals must list one or more goals from the options" };
  if (!opt.TEACHER.some((x) => x.id === p.teacher)) return { error: "teacher is not one of the options" };
  if (!levels.ESTIMATES.some((x) => x.id === p.estimate)) return { error: "estimate is not one of the options" };
  if (!Array.isArray(p.memorized) || !p.memorized.every((s) => opt.SURAH_NAMES.includes(s))) return { error: "memorized must list surah names from the options" };
  if (p.memorized_more !== undefined && typeof p.memorized_more !== "boolean") return { error: "memorized_more must be true or false" };
  if (p.lang !== undefined && !["ar", "en"].includes(p.lang)) return { error: "lang must be ar or en" };
  if (!opt.LESSONS_PER_WEEK.some((x) => x.id === p.lessons_per_week)) return { error: "lessons_per_week is not one of the options" };
  const memorizes = (Array.isArray(p.memorized) && p.memorized.length > 0) || p.memorized_more === true;
  if (memorizes && !opt.MEM_SOURCES.some((x) => x.id === p.memorized_from)) return { error: "memorized_from is needed when surahs are listed" };
  let tajweed;
  if (p.estimate === "mushaf" && p.tajweed !== undefined) {
    if (!p.tajweed || typeof p.tajweed !== "object") return { error: "tajweed must be an object" };
    tajweed = {};
    for (const q of opt.TAJWEED_QS) {
      const a = p.tajweed[q.id] === undefined ? "unsure" : p.tajweed[q.id];
      if (!opt.TAJWEED_ANSWERS.some((x) => x.id === a)) return { error: `tajweed.${q.id} is not one of the answers` };
      tajweed[q.id] = a;
    }
  }

  const st = body.stages || {};
  const stages = {};
  for (const key of levels.STAGES) {
    const s = st[key];
    if (s === undefined) continue;
    if (!s || typeof s.passed !== "boolean") return { error: `stages.${key}.passed must be true or false` };
    if (s.inferred === true) { stages[key] = { passed: true, inferred: true }; continue; }
    if (!Number.isInteger(s.score) || !Number.isInteger(s.total) || s.score < 0 || s.total < 1 || s.score > s.total) {
      return { error: `stages.${key} needs whole-number score and total` };
    }
    // The pass is decided here from the score, not taken from the browser.
    stages[key] = { score: s.score, total: s.total, passed: s.score >= levels.PASS[key] };
  }
  if (!stages.sound) return { error: "the result needs at least the first stage (or an inferred one)" };

  const level = levels.levelFrom(stages);
  const profile = {
    nickname: (p.nickname || "").trim(),
    age_band: p.age_band,
    country: p.country,
    home_language: p.home_language,
    goals: opt.GOALS.map((g) => g.id).filter((id) => p.goals.includes(id)),
    teacher: p.teacher,
    estimate: p.estimate,
    memorized: [...new Set(p.memorized)],
    memorized_more: p.memorized_more === true,
    ...(memorizes && { memorized_from: p.memorized_from }),
    lessons_per_week: p.lessons_per_week,
    ...(tajweed && { tajweed }),
    lang: p.lang === "en" ? "en" : "ar",
  };
  return { value: { profile, stages, level, suggestion: opt.suggestion(profile, level) } };
}

module.exports = { validateSubmission };
