// Checks a submitted diagnostic against the allowed answers. Returns { error } or { value } (cleaned).
const levels = require("../public/js/levels");
const opt = require("../public/js/options");
const signals = require("../public/js/signals");
const skills = require("../public/js/skills");
const content = require("./content");

const str = (v, max) => typeof v === "string" && v.trim().length <= max;

// The three Tajweed answers (a missing one counts as "not sure").
function tajweedOf(t) {
  if (!t || typeof t !== "object") return { error: "tajweed must be an object" };
  const out = {};
  for (const q of opt.TAJWEED_QS) {
    const a = t[q.id] === undefined ? "unsure" : t[q.id];
    if (!opt.TAJWEED_ANSWERS.some((x) => x.id === a)) return { error: `tajweed.${q.id} is not one of the answers` };
    out[q.id] = a;
  }
  return { value: out };
}

// The answered items of an assessment stage (for the per-skill report): a known skill, surah:ayah, the word as it is in
// the verified Quran text, the difficulty 1–3 and the result. Anything else is refused.
const MAX_ITEMS = 20;
const ZERO_TOTAL_OK = new Set(["apply", "hifz"]); // every place "not sure", or no surah memorized
function itemsOf(list, key) {
  if (list === undefined) return { value: undefined };
  if (!Array.isArray(list) || list.length > MAX_ITEMS) return { error: `stages.${key}.items must be a list of at most ${MAX_ITEMS}` };
  const out = [];
  for (const it of list) {
    if (!it || typeof it !== "object") return { error: `stages.${key}.items must be objects` };
    if (!skills.SKILLS[it.skill]) return { error: `stages.${key}.items: unknown skill` };
    if (!/^\d{1,3}:\d{1,3}$/.test(String(it.ref))) return { error: `stages.${key}.items: ref must look like 79:40` };
    if (!skills.ITEM_RESULTS.includes(it.result)) return { error: `stages.${key}.items: unknown result` };
    if (it.d !== undefined && ![1, 2, 3].includes(it.d)) return { error: `stages.${key}.items: d must be 1, 2 or 3` };
    if (it.word !== undefined) {
      if (typeof it.word !== "string" || it.word.length > 60 || content.unknownArabicWords({ w: it.word }).length) return { error: `stages.${key}.items: the word is not in the verified text` };
    }
    // The rule chosen instead of the right one (a Tajweed question answered wrong), for «خلط بين … و…».
    if (it.picked !== undefined && !skills.SKILLS[it.picked]) return { error: `stages.${key}.items: picked must be a known skill` };
    out.push({ skill: it.skill, ref: String(it.ref), ...(it.word && { word: it.word }), ...(it.d && { d: it.d }), result: it.result, ...(it.picked && it.result === "wrong" && { picked: it.picked }) });
  }
  return { value: out };
}

// Stage results from the browser: only the given keys, whole-number scores; the pass is decided here from the score.
function stagesOf(st, keys) {
  const stages = {};
  for (const key of keys) {
    const s = (st || {})[key];
    if (s === undefined) continue;
    if (!s || typeof s.passed !== "boolean") return { error: `stages.${key}.passed must be true or false` };
    if (s.inferred === true) { stages[key] = { passed: true, inferred: true }; continue; }
    if (!Number.isInteger(s.score) || !Number.isInteger(s.total) || s.score < 0 || s.total < (ZERO_TOTAL_OK.has(key) ? 0 : 1) || s.score > s.total) {
      return { error: `stages.${key} needs whole-number score and total` };
    }
    const items = itemsOf(s.items, key);
    if (items.error) return items;
    stages[key] = { score: s.score, total: s.total, passed: levels.passed(key, s.score, s.total), ...(items.value && { items: items.value }) };
  }
  return { value: stages };
}

function validateSubmission(body) {
  if (!body || typeof body !== "object") return { error: "body must be an object" };
  const p = body.profile || {};
  if (p.who === "adult") return validateAdult(p, body);
  if (p.who !== undefined && p.who !== "child") return { error: "who must be child or adult" };
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
    const t = tajweedOf(p.tajweed);
    if (t.error) return t;
    tajweed = t.value;
  }
  // What the child responds to: the parent's four answers (optional) and the signs from the games (optional).
  let likes;
  if (p.likes !== undefined) {
    if (!p.likes || typeof p.likes !== "object") return { error: "likes must be an object" };
    likes = {};
    for (const q of opt.LIKES_QS) {
      if (p.likes[q.id] === undefined) continue;
      if (!opt.LIKES_ANSWERS.some((x) => x.id === p.likes[q.id])) return { error: `likes.${q.id} is not one of the answers` };
      likes[q.id] = p.likes[q.id];
    }
  }
  if (p.motivation !== undefined && !opt.MOTIVATION.some((x) => x.id === p.motivation)) return { error: "motivation is not one of the options" };
  // Where the adaptive test started (public/js/adaptive.js), kept for the teacher.
  if (p.start_stage !== undefined && !levels.STAGES.includes(p.start_stage)) return { error: "start_stage is not one of the games" };
  let sig = null;
  if (body.signals !== undefined) {
    sig = signals.clean(body.signals);
    if (!sig) return { error: "signals are not in the expected form" };
  }

  // The level games (and a reader's two harder ones), or the reader's assessment (recite, rules, hifz).
  const parsed = stagesOf(body.stages, levels.ALL_STAGES);
  if (parsed.error) return parsed;
  const stages = parsed.value;
  if (!stages.sound && !stages.recite) return { error: "the result needs the first game (or an inferred one) or the recitation" };
  if (stages.recite && !stages.check) return { error: "the recitation needs the reading check before it" };

  const level = levels.levelFrom(stages);
  const profile = {
    who: "child",
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
    ...(likes && { likes }),
    ...(p.motivation && { motivation: p.motivation }),
    ...(p.start_stage && { start_stage: p.start_stage }),
    lang: p.lang === "en" ? "en" : "ar",
  };
  return { value: { profile, stages, level, suggestion: opt.suggestion(profile, level), ...(sig && { signals: sig }) } };
}

// The adult track (Arabic readers): fluency, an ayah read aloud, Tajweed answers, memorization by juz', goals, time.
// The level (A1–A3) maps to the child level whose start stage it shares, so the same curriculum and rules build the path.
function validateAdult(p, body = {}) {
  if (!opt.ADULT_AGE_BANDS.includes(p.age_band)) return { error: "age_band is not one of the options" };
  if (!opt.COUNTRIES.some((c) => c.code === p.country)) return { error: "country is not one of the options" };
  if (!opt.ADULT_JUZ.some((x) => x.id === p.juz)) return { error: "juz is not one of the options" };
  if (!Array.isArray(p.goals) || !p.goals.length || !p.goals.every((g) => opt.ADULT_GOALS.some((x) => x.id === g))) return { error: "goals must list one or more goals from the options" };
  if (!opt.TEACHER.some((x) => x.id === p.teacher)) return { error: "teacher is not one of the options" };
  if (!opt.ADULT_SELF.some((x) => x.id === p.self)) return { error: "self is not one of the options" };
  if (p.ayah !== undefined && !opt.AYAH_SELF.some((x) => x.id === p.ayah)) return { error: "ayah is not one of the options" };
  if (!opt.LESSONS_PER_WEEK.some((x) => x.id === p.lessons_per_week)) return { error: "lessons_per_week is not one of the options" };
  if (p.lang !== undefined && !["ar", "en"].includes(p.lang)) return { error: "lang must be ar or en" };
  // Which ayah was read (shown from the verified files): surah:ayah.
  if (p.ayah_ref !== undefined && !/^\d{1,3}:\d{1,3}$/.test(String(p.ayah_ref))) return { error: "ayah_ref must look like 67:3" };
  let tajweed;
  if (p.tajweed !== undefined) {
    const t = tajweedOf(p.tajweed);
    if (t.error) return t;
    tajweed = t.value;
  }
  // The adult's assessment: reading check, recitation, applying the rules, Tajweed rules, memorization.
  const parsed = stagesOf(body.stages, levels.ASSESS_STAGES);
  if (parsed.error) return parsed;
  // The Tajweed test: naming the rule and its reason together.
  const st = parsed.value;
  const tj = ["rules", "reasons"].filter((k) => st[k]);
  const tajweedTest = tj.length ? { passed: levels.passed("rules", tj.reduce((n, k) => n + st[k].score, 0), tj.reduce((n, k) => n + st[k].total, 0)) } : undefined;
  const adultLevel = opt.adultLevel(p.self, p.ayah, tajweedTest);
  const level = opt.ADULT_TO_LEVEL[adultLevel];
  const profile = {
    who: "adult",
    age_band: p.age_band,
    country: p.country,
    goals: opt.ADULT_GOALS.map((g) => g.id).filter((id) => p.goals.includes(id)),
    teacher: p.teacher,
    self: p.self,
    ...(p.ayah && { ayah: p.ayah }),
    ...(p.ayah_ref && { ayah_ref: String(p.ayah_ref) }),
    adult_level: adultLevel,
    juz: p.juz,
    memorized: [],
    lessons_per_week: p.lessons_per_week,
    ...(tajweed && { tajweed }),
    lang: p.lang === "en" ? "en" : "ar",
  };
  let sig = null;
  if (body.signals !== undefined) {
    sig = signals.clean(body.signals);
    if (!sig) return { error: "signals are not in the expected form" };
  }
  return { value: { profile, stages: parsed.value, level, suggestion: opt.suggestion(profile, level), ...(sig && { signals: sig }) } };
}

module.exports = { validateSubmission };
