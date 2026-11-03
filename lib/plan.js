// The learning plan on the result page.
// The path is worked out by rules from the approved curriculum (lib/curriculum.js: start stage → goal, lessons, weeks).
// Claude only writes the words for the parent: an intro, one note per stage of that path, and a tip for home.
// Stage names, goals, content, exit signs and every number are inserted here from the curriculum, word for word.
// A validator checks every reply (stages exactly the path, no number outside the path, no promises, no Quran text);
// a rejected reply is written once more with the problems listed, and if it fails again the plan is shown without notes.
const Anthropic = require("@anthropic-ai/sdk");
const curriculum = require("./curriculum");
const opt = require("../public/js/options");
const levels = require("../public/js/levels");

const MODEL = "claude-opus-5-5";
const LIMITS = { intro: 420, note: 220, tip: 260 };
const ATTEMPTS = 2;

// Promises of results in a fixed time, or guarantees — never allowed in a plan.
const PROMISE_PATTERNS = [
  /خلال\s*\d+/, /في\s*غضون/, /سيحفظ/, /سيتقن/, /نضمن/, /مضمون/, /بالتأكيد سي/,
  /\bguarantee/i, /\bwill (memorize|master|be able to read)\b/i, /\bwithin \d+/i, /\bin \d+ (weeks?|months?)\b/i,
];
const ARABIC_RE = /[؀-ۿ]/;
const HARAKAT_RE = /[ً-ْٰ]/g;
const toLatinDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const numbersIn = (s) => toLatinDigits(s).match(/\d+/g) || [];

// Text that looks like vocalized Quran: three or more words carrying two or more vowel marks each.
function looksLikeQuran(text) {
  return String(text).split(/\s+/).filter((w) => (w.match(HARAKAT_RE) || []).length >= 2).length >= 3;
}

function localize(stage, lang) {
  const pick = (f) => (lang === "en" && stage[`${f}_en`] ? stage[`${f}_en`] : stage[f]);
  return { id: stage.id, level: stage.level, name: pick("name"), goals: pick("goals"), content: pick("content"), exit_sign: pick("exit_sign"), sessions: stage.sessions, program: stage.program };
}

const perWeekOf = (record) => record.profile.lessons_per_week || opt.PLANS[record.suggestion.plan].per_week;

function factsFor(record, lang) {
  const p = record.profile;
  const en = lang === "en";
  const goal = opt.GOALS.find((g) => g.id === p.goal);
  const lvl = levels.LEVELS[record.level];
  const lbl = (list, id) => { const x = list.find((o) => o.id === id); return x ? (en ? x.label_en : x.label) : id; };
  return {
    language_of_the_plan: en ? "English" : "Arabic (Modern Standard, simple, warm)",
    child_age_band: p.age_band,
    language_at_home: p.home_language,
    parent_goal: goal ? (en ? goal.label_en : goal.label) : p.goal,
    diagnosis_level: en ? lvl.name_en : lvl.name,
    stages_done_in_diagnosis: Object.fromEntries(Object.entries(record.stages).map(([k, s]) => [k, s.inferred ? "not needed (a higher stage was passed)" : `${s.score}/${s.total}${s.passed ? " passed" : ""}`])),
    surahs_memorized_according_to_parent: p.memorized,
    memorizes_more: p.memorized_more,
    how_the_surahs_were_memorized: p.memorized_from ? lbl(opt.MEM_SOURCES, p.memorized_from) : "not asked (no surahs listed)",
    tajweed_as_the_parent_sees_it: p.tajweed
      ? Object.fromEntries(opt.TAJWEED_QS.map((q) => [en ? q.label_en : q.label, lbl(opt.TAJWEED_ANSWERS, p.tajweed[q.id])]))
      : "not asked",
    lessons_per_week_chosen_by_parent: perWeekOf(record),
    suggested_track: record.suggestion.track,
    teacher_preference: p.teacher,
  };
}

function system(lang, rules) {
  return [
    "You write the words of a learning plan for a parent after a child's Quran reading diagnostic at Qurana, an online Quran school for children (the Arabic-speaking branch of Kottab).",
    "The school has already worked out the child's PATH from its curriculum: the stages, in order, with lessons and weeks. You do not choose, add, drop or reorder stages, and you do not write stage names, goals or content: the school shows those itself.",
    `Write: a short intro (2–3 sentences, under ${LIMITS.intro - 80} characters); one note per stage of the PATH, in the same order, with its stage_id (1–2 sentences, under ${LIMITS.note - 60} characters each) saying why this stage comes for this child, based only on the facts given; and one practical tip for home (under ${LIMITS.tip - 60} characters). Longer texts are rejected.`,
    "Numbers: use only numbers that appear in the PATH or the TOTALS, or none at all. Any other number is rejected.",
    "Rules: say the plan is a suggestion that the teacher reviews in the free trial lesson; the weeks are an estimate, never a promise (no 'will memorize', no 'within 3 months'); never quote Quran text — name surahs only; never describe the child negatively or compare with other children; no religious rulings; do not add facts about the child that are not in the facts given.",
    lang === "en"
      ? "Write in plain English for parents. Use transliterated terms the first time with a short explanation (Surah, Tajweed, Hifz (memorization), Mushaf). Do not write any Arabic script."
      : "اكتب بالعربية الفصحى البسيطة والدافئة، دون تشكيل إلا للضرورة. سمِّ المعلّم حسب teacher_preference: «المعلمة» إذا كانت female، و«المعلم» إذا كانت male، وإلا «المعلم أو المعلمة».",
    rules.length ? `The school's own rules for plans:\n${rules.map((r) => `- (${r.type}) ${r.rule}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

function schemaFor(ids) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["intro", "notes", "tip"],
    properties: {
      intro: { type: "string" },
      notes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["stage_id", "note"],
          properties: { stage_id: { type: "string", enum: ids }, note: { type: "string" } },
        },
      },
      tip: { type: "string" },
    },
  };
}

// The numbers a reply may use: everything in the path's stages, the totals, the age band and the diagnostic scores.
function allowedNumbers(stages, totals, record) {
  const out = new Set([totals.sessions, totals.weeks, totals.per_week, stages.length, 30].map(String));
  for (const s of stages) for (const v of Object.values(s)) numbersIn(v).forEach((n) => out.add(n));
  numbersIn(record.profile.age_band).forEach((n) => out.add(n));
  for (const s of Object.values(record.stages)) if (!s.inferred) [s.score, s.total].forEach((n) => out.add(String(n)));
  return out;
}

// Checks Claude's reply against the path. Returns a list of problems (empty = accepted).
function validateReply(reply, stages, lang, allowed) {
  const out = [];
  if (!reply || typeof reply !== "object") return ["reply is not an object"];
  const notes = Array.isArray(reply.notes) ? reply.notes : [];
  const want = stages.map((s) => s.id);
  if (notes.map((n) => n.stage_id).join(",") !== want.join(",")) out.push(`notes must be exactly one per path stage, in order: ${want.join(", ")}`);
  const texts = [["intro", reply.intro, LIMITS.intro], ["tip", reply.tip, LIMITS.tip], ...notes.map((n, i) => [`notes[${i}]`, n.note, LIMITS.note])];
  for (const [where, t, max] of texts) {
    if (typeof t !== "string" || !t.trim()) { out.push(`${where} is empty`); continue; }
    if (t.length > max) out.push(`${where} is longer than ${max} characters`);
    if (PROMISE_PATTERNS.some((re) => re.test(t))) out.push(`${where} promises a result or a duration`);
    if (looksLikeQuran(t)) out.push(`${where} looks like quoted Quran text`);
    if (lang === "en" && ARABIC_RE.test(t)) out.push(`${where} has Arabic script in the English plan`);
    const stray = numbersIn(t).filter((n) => !allowed.has(n));
    if (stray.length) out.push(`${where} uses numbers that are not in the path: ${[...new Set(stray)].join(", ")}`);
  }
  return out;
}

function fixedTexts(lang) {
  return {
    intro: lang === "en"
      ? "This path comes from Qurana's curriculum: it starts where the diagnostic placed your child and goes on to your goal. The teacher reviews it with you in the free trial lesson."
      : "هذا المسار من منهج قرآنا: يبدأ من حيث وضع التشخيص طفلك ويمضي حتى هدفكم. تراجعه المعلمة معكم في الحصة التجريبية المجانية.",
    tip: lang === "en"
      ? "A few calm minutes of practice with a grown-up most days helps more than one long session."
      : "دقائق قليلة هادئة مع وليّ الأمر في أغلب الأيام أنفع من جلسة طويلة واحدة.",
  };
}

async function askClaude(api, req, problems) {
  const content = problems.length
    ? `${req.input}\n\nYour previous reply was rejected for these reasons. Write it again without them:\n- ${problems.join("\n- ")}`
    : req.input;
  const response = await api.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: req.schema } },
    system: req.system,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return { stopped: response.stop_reason };
  return { reply: JSON.parse(response.content.filter((b) => b.type === "text").map((b) => b.text).join("")) };
}

// Builds the plan for a saved result. `client` can be replaced in tests.
async function buildPlan(record, lang, { client, curriculumData } = {}) {
  const c = curriculumData || curriculum.load();
  if (!curriculum.usable(c)) return { status: "unavailable" };
  const draft = c.status !== "approved";
  const route = curriculum.path(c, record.level, record.profile.goal, record.suggestion.track);
  if (route.reached) return { status: "reached", draft, problems: [] };
  if (!route.stages.length) return { status: "unavailable" };
  const totals = curriculum.totals(route.stages, perWeekOf(record));
  const shownStages = route.stages.map((s) => localize(s, lang));
  const allowed = allowedNumbers(shownStages, totals, record);

  const req = {
    system: system(lang, c.rules || []),
    schema: schemaFor(route.stages.map((s) => s.id)),
    input: JSON.stringify({
      facts_about_the_child: factsFor(record, lang),
      path: shownStages.map((s) => ({ stage_id: s.id, name: s.name, goals: s.goals, content: s.content, exit_sign: s.exit_sign, lessons: s.sessions })),
      totals: { lessons: totals.sessions, lessons_per_week: totals.per_week, weeks_estimate: totals.weeks },
    }),
  };

  let reply = null;
  let problems = [];
  const api = client || new Anthropic();
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const got = await askClaude(api, req, problems);
      if (got.stopped) { problems = [`model stopped: ${got.stopped}`]; reply = null; break; }
      reply = got.reply;
      problems = validateReply(reply, route.stages, lang, allowed);
    } catch (err) {
      problems = [err instanceof Anthropic.APIError ? `model API error ${err.status}` : `plan generation failed: ${err.message}`];
      reply = null;
      break;
    }
    if (!problems.length) break;
  }

  if (problems.length) {
    return { status: "ready", draft, plan: { source: "curriculum", ...fixedTexts(lang), totals, stages: shownStages.map((s) => ({ ...s, note: "" })) }, problems };
  }
  const noteOf = new Map(reply.notes.map((n) => [n.stage_id, n.note.trim()]));
  return {
    status: "ready",
    draft,
    plan: { source: "claude", model: MODEL, intro: reply.intro.trim(), tip: reply.tip.trim(), totals, stages: shownStages.map((s) => ({ ...s, note: noteOf.get(s.id) })) },
    problems: [],
  };
}

module.exports = { buildPlan, validateReply, allowedNumbers, looksLikeQuran, schemaFor, MODEL };
