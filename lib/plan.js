// The learning plan on the result page.
// The path is worked out by rules from the curriculum (lib/curriculum.js: start stage → the goals, memorized surahs,
// Tajweed alongside, lessons, weeks, the three time windows). Claude only writes the words: two or three sentences for each
// window ("in the first month", "after about three months", "further on") and a tip for home, in the voice of
// prompts/voice.md. Stage names, goals, content, exit signs and every number are inserted here from the curriculum.
// A validator checks every reply (no number outside the path, no promises, no Quran text, none of voice.md's banned
// phrases); a rejected reply is written once more with the problems listed; if it fails again the page shows the path
// without the words.
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const curriculum = require("./curriculum");
const opt = require("../public/js/options");
const levels = require("../public/js/levels");
const signals = require("../public/js/signals");

const MODEL = "claude-opus-5-5";
const LIMITS = { window: 360, tip: 260, sentences: 2, words: 38 };
const ATTEMPTS = 2;
const VOICE_PATH = path.join(__dirname, "..", "prompts", "voice.md");

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

// prompts/voice.md: the whole file goes to the model; the bullets under «عبارات ممنوعة» are refused by the validator,
// and the sample paragraphs (lines starting with ">") are a reference for tone, never to be copied.
function voice() {
  const text = fs.readFileSync(VOICE_PATH, "utf8");
  const part = text.split(/^## عبارات ممنوعة\s*$/m)[1] || "";
  const banned = part.split(/^## /m)[0].split("\n").map((l) => l.match(/^\s*-\s+(.+?)\s*$/)).filter(Boolean).map((m) => m[1]);
  const samples = text.split("\n").filter((l) => /^\s*>/.test(l)).map((l) => l.replace(/^\s*>\s*/, ""));
  return { text, banned, samples };
}

// Words for comparing texts: no vowel marks, tatweel or punctuation.
const wordsOf = (s) => String(s).replace(/[ً-ْٰـ]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
const ngrams = (words, n) => { const out = new Set(); for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" ")); return out; };
const sentencesOf = (s) => String(s).split(/[.!?؟]+/).map((x) => x.trim()).filter((x) => wordsOf(x).length > 0);

// Said once on the whole page, in the footer — never inside the windows or the tip.
// (Whole words only: «موعد» is not «وعد», and «تراجع معه ما حفظه» — reviewing surahs — is not «تراجعها», the plan.)
const ONCE_ON_PAGE = [
  [/(^|[\s،,.؛])و?(تقدير|وعد)\S{0,2}(?=[\s،,.؛]|$)/, "«تقدير لا وعد»"],
  [/(^|[\s،,.؛])(ت|ي|ست|سي)?راجع(ها|ه)(?=[\s،,.؛]|$)|راجع\S*\s+(\S+\s+)?الخطة/, "«تراجعها المعلمة»"],
  [/\bestimate|\bpromise/i, "\"an estimate, not a promise\""],
  [/\b(review|go(es)?\s+(over|through))\s+(it|this|the plan)\b/i, "\"the teacher reviews it\""],
];
// Speaking to the child instead of the parent (children's plans only).
const TO_CHILD = /(^|[\s،,.])(تقرأ|تحفظ|تقرئين|تحفظين)([\s،,.]|$)/;

function localize(stage, lang) {
  const en = lang === "en";
  const pick = (f) => (en && stage[`${f}_en`] ? stage[`${f}_en`] : stage[f]);
  const focus = stage.with_focus && opt.FOCUS.find((f) => f.id === stage.with_focus);
  const surahName = (ar) => (en ? (opt.SURAHS.find((s) => s.ar === ar) || { en: ar }).en : ar);
  return {
    id: stage.id, level: stage.level, name: pick("name"), goals: pick("goals"), content: pick("content"), exit_sign: pick("exit_sign"),
    sessions: stage.sessions, program: stage.program,
    ...(stage.review && { review: stage.review.map(surahName) }),
    ...(focus && { focus: en ? focus.name_en : focus.name }),
  };
}

const perWeekOf = (record) => record.profile.lessons_per_week || opt.PLANS[record.suggestion.plan].per_week;
const isAdult = (record) => record.profile.who === "adult";

function levelInfo(record) {
  return isAdult(record) ? levels.ADULT_LEVELS[record.profile.adult_level] : levels.LEVELS[record.level];
}

// The surahs counted as memorized: the child's list from the parent; for an adult, by juz' — Juz' Amma or more means every
// surah in the curriculum's memorization stages (which go up to Juz' Amma).
function memorizedOf(record, c) {
  const p = record.profile;
  if (p.who !== "adult") return p.memorized || [];
  if (!["amma", "upto5", "more"].includes(p.juz)) return [];
  return c.stages.filter((s) => Array.isArray(s.surahs)).flatMap((s) => s.surahs);
}

// The path, by rules only — instant, no model. Shown straight away.
function pathFor(record, lang, c = curriculum.load()) {
  if (!curriculum.usable(c)) return { status: "unavailable" };
  const goals = curriculum.goalsOf(record.profile);
  if (!goals.length) return { status: "teacher" }; // e.g. an adult who chose only the Ijazah: the teacher decides after a test
  const reads = opt.readsMushaf(record.level);
  const route = curriculum.path(c, record.level, goals, record.suggestion.track, { memorized: memorizedOf(record, c), tajweed: reads ? record.profile.tajweed : undefined, reads });
  if (route.reached) return { status: "reached" };
  if (!route.stages.length) return { status: "unavailable" };
  const per = perWeekOf(record);
  const out = {
    status: "ready",
    stages: route.stages.map((s) => localize(s, lang)),
    totals: curriculum.totals(route.stages, per),
    windows: curriculum.windows(route.stages, per),
  };
  out.chips = chipsFor(out);
  return out;
}

function factsFor(record, lang) {
  const p = record.profile;
  const en = lang === "en";
  const lbl = (list, id) => { const x = list.find((o) => o.id === id); return x ? (en ? x.label_en : x.label) : id; };
  const lvl = levelInfo(record);
  const focusName = (id) => { const f = opt.FOCUS.find((x) => x.id === id); return en ? f.name_en : f.name; };
  const common = {
    language_of_the_plan: en ? "English" : "Arabic (simple, plain, understood across the Gulf and North Africa)",
    level_from_the_diagnostic: en ? lvl.name_en : lvl.name,
    lessons_per_week_chosen: perWeekOf(record),
    teacher_preference: p.teacher,
    tajweed_answers: p.tajweed ? Object.fromEntries(opt.TAJWEED_QS.map((q) => [focusName(q.id), lbl(opt.TAJWEED_ANSWERS, p.tajweed[q.id])])) : "not asked",
  };
  if (isAdult(record)) {
    return {
      ...common,
      who: "an adult learner (write to them directly, as «أنت» / «you»)",
      age_band: p.age_band,
      goals: opt.ADULT_GOALS.filter((g) => p.goals.includes(g.id)).map((g) => (en ? g.label_en : g.label)),
      own_reading: lbl(opt.ADULT_SELF, p.self),
      reading_an_ayah_aloud: `${lbl(opt.AYAH_SELF, p.ayah)}${p.ayah_ref ? ` (${p.ayah_ref})` : ""}`,
      memorized_by_juz: lbl(opt.ADULT_JUZ, p.juz),
    };
  }
  const goals = opt.GOALS.filter((g) => curriculum.goalsOf(p).includes(g.id));
  return {
    ...common,
    who: "a child (write to the parents about «طفلكم» / «your child»)",
    child_age_band: p.age_band,
    language_at_home: p.home_language,
    parent_goals: goals.map((g) => (en ? g.label_en : g.label)),
    stages_done_in_diagnosis: Object.fromEntries(Object.entries(record.stages || {}).map(([k, s]) => [k, s.inferred ? "not needed (a higher stage was passed)" : `${s.score}/${s.total}${s.passed ? " passed" : ""}`])),
    surahs_memorized_according_to_parent: p.memorized,
    memorizes_more: p.memorized_more,
    how_the_surahs_were_memorized: p.memorized_from ? lbl(opt.MEM_SOURCES, p.memorized_from) : "not asked (no surahs listed)",
    what_we_noticed_in_the_games: signals.observe(record.signals, p.likes, p.motivation, lang).parent,
  };
}

function system(lang, rules, voiceText) {
  return [
    "You write the words of a learning plan after a Quran reading diagnostic at Qurana, an online Quran school (the Arabic-speaking branch of Kottab).",
    "The school has already worked out the PATH from its curriculum: the stages in order, the lessons, the weeks, what is reviewed, the Tajweed point that goes alongside each memorization stage, and three TIME WINDOWS. You do not choose, add, drop or reorder anything, and you do not write stage names, goals or content: the school shows those itself.",
    `Write at most two short sentences for each window (about ${LIMITS.words - 3} words) — month1 (what we will do in the first month), month3 (where we expect the learner to be after about three months), longer (the goal further on) — saying only what we will do, and one practical tip for home under ${LIMITS.tip - 60} characters. Do not repeat the stage names: the page shows them above each window. Say each idea once in the whole plan: the same Tajweed point or the same surah goes in one window only. Longer texts are rejected.`,
    "When a memorization stage has a Tajweed point alongside it, say plainly that Tajweed is not postponed: it goes with the memorization.",
    "Do not give the total lessons or weeks: the page states them once, under the windows. Numbers: use only numbers that appear in the PATH, or none at all. Any other number is rejected.",
    "Do not write that the plan is an estimate or not a promise, and do not write that the teacher reviews it: the page says both once, in its footer. Write to the parent about the child («طفلكم يقرأ», never «تقرأ» or «تحفظ»), except in the adult track. The voice guide's two samples are for tone only: never copy six words in a row from them.",
    "Rules: never promise results or durations; never quote Quran text — name surahs only; never describe the learner negatively, compare with others, or label them; no religious rulings; do not add facts that are not in the facts given.",
    lang === "en"
      ? "Write in plain English. Use transliterated terms the first time with a short explanation (Surah, Tajweed, Hifz (memorization), Mushaf). Do not write any Arabic script. Follow the tone of the voice guide below (it is in Arabic; keep its spirit in English)."
      : "سمِّ المعلّم حسب teacher_preference: «المعلمة» إذا كانت female، و«المعلم» إذا كانت male، وإلا «المعلم أو المعلمة».",
    `The school's voice guide (follow it closely):\n${voiceText}`,
    rules.length ? `The school's own rules for plans:\n${rules.map((r) => `- (${r.type}) ${r.rule}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["month1", "month3", "longer", "tip"],
  properties: { month1: { type: "string" }, month3: { type: "string" }, longer: { type: "string" }, tip: { type: "string" } },
};

// The numbers a reply may use: everything in the path's stages, the lessons a week, the age band and the diagnostic
// scores. Not the totals: the page states them once itself.
function allowedNumbers(stages, totals, record) {
  const out = new Set([totals.per_week, 2, 3, 4, stages.length, 30].map(String));
  for (const s of stages) for (const v of Object.values(s)) numbersIn(Array.isArray(v) ? v.join(" ") : v).forEach((n) => out.add(n));
  numbersIn(record.profile.age_band).forEach((n) => out.add(n));
  for (const s of Object.values(record.stages || {})) if (!s.inferred) [s.score, s.total].forEach((n) => out.add(String(n)));
  return out;
}

// Checks Claude's reply. Returns a list of problems (empty = accepted).
// opts: banned phrases and samples (from voice.md), chips (the stage names shown above each window), adult (the adult
// track speaks to the learner), terms (Tajweed points and surah names, each allowed in one window only).
function validateReply(reply, lang, allowed, opts = {}) {
  const v = opts.banned && opts.samples ? opts : { ...voice(), ...opts };
  const out = [];
  if (!reply || typeof reply !== "object") return ["reply is not an object"];
  const windows = ["month1", "month3", "longer"];
  const texts = [...windows.map((k) => [k, reply[k], LIMITS.window]), ["tip", reply.tip, LIMITS.tip]];
  const sampleGrams = new Set(v.samples.flatMap((x) => [...ngrams(wordsOf(x), 6)]));
  for (const [where, t, max] of texts) {
    if (typeof t !== "string" || !t.trim()) { out.push(`${where} is empty`); continue; }
    if (t.length > max) out.push(`${where} is longer than ${max} characters`);
    if (windows.includes(where)) {
      if (sentencesOf(t).length > LIMITS.sentences) out.push(`${where} has more than ${LIMITS.sentences} sentences`);
      if (wordsOf(t).length > LIMITS.words) out.push(`${where} has more than ${LIMITS.words} words`);
      const shown = [...new Set(((opts.chips || {})[where] || []).filter((n) => wordsOf(n).length >= 2 && t.includes(n)))];
      if (shown.length) out.push(`${where} repeats the stage names shown above it: ${shown.join("، ")}`);
    }
    if (PROMISE_PATTERNS.some((re) => re.test(t))) out.push(`${where} promises a result or a duration`);
    if (looksLikeQuran(t)) out.push(`${where} looks like quoted Quran text`);
    if (lang === "en" && ARABIC_RE.test(t)) out.push(`${where} has Arabic script in the English plan`);
    const stray = numbersIn(t).filter((n) => !allowed.has(n));
    if (stray.length) out.push(`${where} uses numbers that are not in the path: ${[...new Set(stray)].join(", ")}`);
    const phrases = v.banned.filter((x) => t.toLowerCase().includes(x.toLowerCase()));
    if (phrases.length) out.push(`${where} uses phrases the voice guide forbids: ${phrases.join("، ")}`);
    if (signals.BANNED_TERMS.some((re) => re.test(t))) out.push(`${where} labels the learner (types of intelligence or learning styles)`);
    for (const [re, label] of ONCE_ON_PAGE) if (re.test(t)) out.push(`${where} says ${label}: the page says it once, in the footer`);
    if (!opts.adult && lang !== "en" && TO_CHILD.test(t)) out.push(`${where} speaks to the child («تقرأ / تحفظ»): write to the parent about «طفلكم»`);
    const copied = [...ngrams(wordsOf(t), 6)].filter((g) => sampleGrams.has(g));
    if (copied.length) out.push(`${where} copies the voice guide's sample (six words in a row: «${copied[0]}»)`);
  }
  // The same idea in two windows: the same Tajweed point or surah, or five words in a row.
  const terms = opts.terms || [];
  const tokens = windows.map((k) => new Set(wordsOf(reply[k] || "")));
  for (const term of terms) {
    const tw = wordsOf(term);
    const inWindows = windows.filter((k, i) => (tw.length === 1 ? tokens[i].has(tw[0]) : String(reply[k] || "").includes(term)));
    if (inWindows.length > 1) out.push(`«${term}» comes in more than one window (${inWindows.join(", ")}): say it once`);
  }
  for (let i = 0; i < windows.length; i++) for (let j = i + 1; j < windows.length; j++) {
    const other = ngrams(wordsOf(reply[windows[j]] || ""), 5);
    const g = [...ngrams(wordsOf(reply[windows[i]] || ""), 5)].find((x) => other.has(x));
    if (g) out.push(`${windows[i]} and ${windows[j]} repeat the same words («${g}»)`);
  }
  const all = texts.map(([, t]) => (typeof t === "string" ? t : "")).join(" ");
  if ((all.match(/ذكرتم|أخبرتمونا|كما ذكر/g) || []).length > 1) out.push("repeats what the parent told us (ذكرتم / أخبرتمونا) more than once");
  return out;
}

// The short name of a stage for the chip above a window: the part before a colon.
const shortName = (name) => String(name).split(/[:：]/)[0].trim();

// What the page shows above each window: short stage names, and the Tajweed point alongside.
function chipsFor(p) {
  const byId = new Map(p.stages.map((x) => [x.id, x]));
  const of = (id) => { const st = byId.get(id); return [shortName(st.name), ...(st.focus ? [st.focus] : [])]; };
  const uniq = (l) => [...new Set(l)];
  return {
    month1: uniq(p.windows.month1.flatMap(of)),
    month3: p.windows.done_by_month3 ? [] : uniq(of(p.windows.month3)),
    longer: [shortName(byId.get(p.windows.longer).name)],
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
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: req.system,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return { stopped: response.stop_reason };
  return { reply: JSON.parse(response.content.filter((b) => b.type === "text").map((b) => b.text).join("")) };
}

// The words for the windows and the home tip, by Claude. Two attempts; a validation problem is sent back with the second.
// Returns { status: "ready", windows: { month1, month3, longer }, tip } or { status: "failed", problems }.
// `client` can be replaced in tests.
async function writeNotes(record, lang, { client, curriculumData } = {}) {
  const c = curriculumData || curriculum.load();
  const p = pathFor(record, lang, c);
  if (p.status !== "ready") return { status: p.status, problems: [] };
  const v = voice();
  const allowed = allowedNumbers(p.stages, p.totals, record);
  const byId = new Map(p.stages.map((s) => [s.id, s]));
  const name = (id) => byId.get(id).name;
  const req = {
    system: system(lang, c.rules || [], v.text),
    input: JSON.stringify({
      facts: factsFor(record, lang),
      path: p.stages.map((s) => ({ name: s.name, goals: s.goals, content: s.content, lessons: s.sessions, ...(s.review && { review_of_memorized: s.review }), ...(s.focus && { tajweed_alongside: s.focus }) })),
      windows: {
        month1: p.windows.month1.map(name),
        month3: p.windows.done_by_month3 ? "the path is expected to be finished by then" : name(p.windows.month3),
        longer: name(p.windows.longer),
      },
      lessons_per_week: p.totals.per_week,
    }),
  };

  let reply = null;
  let problems = [];
  let feedback = [];
  const api = client || new Anthropic();
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const got = await askClaude(api, req, feedback);
      if (got.stopped) { problems = [`model stopped: ${got.stopped}`]; reply = null; break; }
      reply = got.reply;
      problems = validateReply(reply, lang, allowed, {
        banned: v.banned, samples: v.samples, adult: isAdult(record),
        // Each window's chip names, and the full names of its stages.
        chips: Object.fromEntries(Object.entries(p.chips).map(([k, l]) => [k, [...l, ...(k === "month1" ? p.windows.month1 : [p.windows[k]]).map((id) => (byId.get(id) || {}).name).filter(Boolean)]])),
        terms: [...new Set([...opt.FOCUS.map((x) => (lang === "en" ? x.name_en.split(" ")[0] : x.name)), ...opt.SURAHS.map((x) => (lang === "en" ? x.en : x.ar))])],
      });
      feedback = problems;
    } catch (err) {
      // An API error is tried once more, without telling the model anything.
      problems = [err instanceof Anthropic.APIError ? `model API error ${err.status}` : `notes failed: ${err.message}`];
      reply = null;
      feedback = [];
    }
    if (!problems.length) break;
  }
  if (problems.length) return { status: "failed", problems };
  return {
    status: "ready",
    model: MODEL,
    windows: { month1: reply.month1.trim(), month3: reply.month3.trim(), longer: reply.longer.trim() },
    tip: reply.tip.trim(),
    problems: [],
  };
}

module.exports = { pathFor, writeNotes, validateReply, chipsFor, shortName, allowedNumbers, looksLikeQuran, voice, SCHEMA, MODEL };
