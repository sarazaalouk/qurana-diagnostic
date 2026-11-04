// The words and letters the child sees in the games, and the ayah the adult reads. Fixed rules, no model:
// every Arabic word comes exactly from data/noor_albayan.json, data/quran_fatiha.json, or a verified ayah in
// data/quran_samples.json (an ayah there is used only once Sara has checked it: text_ar, verified_by, verified_on).
const fs = require("fs");
const path = require("path");

const NOOR_PATH = path.join(__dirname, "..", "data", "noor_albayan.json");
const QURAN_PATH = path.join(__dirname, "..", "data", "quran_fatiha.json");
const SAMPLES_PATH = path.join(__dirname, "..", "data", "quran_samples.json");
// Read at each call, so a test (or a review copy) can point at another file.
const samplesPath = () => process.env.QURAN_SAMPLES_PATH || SAMPLES_PATH;
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const tajweed = require("./tajweed-marks");

// Removes vowel marks and tatweel only (hamza forms are kept).
function stripMarks(s) {
  return String(s).replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "").replace(/ٱ/g, "ا");
}
function lettersOf(text) {
  return new Set([...stripMarks(text)].filter((c) => /[ء-ي]/.test(c)));
}

// Stage 1: letters of the Bismillah, each with three choices (the letter and two that look or sound alike).
const SOUND = {
  "ب": ["ب", "ن", "ت"], "س": ["ص", "س", "ي"], "م": ["ن", "ب", "م"],
  "ل": ["ر", "ك", "ل"], "ر": ["ر", "د", "ذ"], "ح": ["ه", "ح", "ع"],
  "ن": ["ب", "ت", "ن"], "ي": ["ي", "ت", "ن"],
};
const SOUND_ORDER = ["ب", "س", "م", "ل", "ر", "ح"];
const SOUND_RESERVE = ["ن", "ي"];

// Stage 2: a letter and its shape when joined in a word (forms from the book).
const SHAPE_LETTERS = [
  { letter: "ر", form: "final", others: ["ـد", "ـن"] },
  { letter: "ح", form: "initial", others: ["عـ", "هـ"] },
  { letter: "م", form: "medial", others: ["ـنـ", "ـيـ"] },
  { letter: "ك", form: "final", others: ["ـل", "ـن"] },
];

// Stage 5: words from Al-Fatiha by [ayah, word number].
const FATIHA_REFS = [[1, 1], [1, 2], [2, 3], [4, 2]];

// Reader games (for a child who reads words from Al-Fatiha), by position in the verified file — never typed by hand.
// "Find the word": an ayah, and the word to tap inside it (a word that comes once in that ayah).
const FIND_REFS = [[2, 3], [4, 2], [5, 2], [7, 3]];
// "Which word has madd?": [ayah, word] with a natural madd (alif, waw or ya after its vowel), and two without.
// Words with a soft letter (lin: يَوْمِ، غَيْرِ، عَلَيْهِمْ) and the name of Allah are left out on purpose.
const MADD_ROUNDS = [
  { madd: [2, 4], other: [[2, 1], [2, 3]] },
  { madd: [4, 3], other: [[1, 1], [5, 2]] },
  { madd: [5, 4], other: [[7, 3], [2, 3]] },
  { madd: [1, 4], other: [[2, 1], [5, 2]] },
];
// The adult's ayah until a sample is verified: Al-Fatiha 1:7, the longest ayah (madd and ghunnah).
const ADULT_FALLBACK = 7;

// Verified samples only: text, reviewer and date all filled in.
function verifiedSamples() {
  try {
    return readJson(samplesPath()).samples.filter((x) => String(x.text_ar || "").trim() && String(x.verified_by || "").trim() && String(x.verified_on || "").trim());
  } catch { return []; }
}

function gameContent() {
  const noor = readJson(NOOR_PATH);
  const quran = readJson(QURAN_PATH);
  const letterInfo = (l) => noor.letters.find((x) => x.letter === l) || { letter: l };
  const basmala = quran.ayahs.find((a) => a.ayah === 1).text_ar;
  const basmalaLetters = lettersOf(basmala);

  const sound = [...SOUND_ORDER, ...SOUND_RESERVE].map((l) => ({
    letter: l, name_latin: letterInfo(l).name_latin, name_ar: letterInfo(l).name_ar, choices: SOUND[l],
  }));
  const shape = SHAPE_LETTERS.map((s) => {
    const answer = letterInfo(s.letter).forms[s.form];
    return { letter: s.letter, answer, choices: [answer, ...s.others] };
  });
  const fatha = noor.fatha_words.filter((w) => [...lettersOf(w.word)].every((c) => basmalaLetters.has(c))).slice(0, 3);
  const harakat = [...noor.kasra_words.slice(0, 2), ...noor.damma_words.slice(0, 2)];
  const fatiha = FATIHA_REFS.map(([ayah, n]) => ({
    ref: `1:${ayah}`, surah_name: quran.name_ar, word: n, text: quran.ayahs.find((a) => a.ayah === ayah).text_ar.split(/\s+/)[n - 1],
  }));
  const ayah = { ref: "1:1", surah_name: quran.name_ar, text: basmala };
  const ayahText = (n) => quran.ayahs.find((a) => a.ayah === n).text_ar;
  const wordAt = ([n, w]) => ayahText(n).split(/\s+/)[w - 1];
  const find = FIND_REFS.map(([n, w]) => ({ ref: `1:${n}`, surah_name: quran.name_ar, words: ayahText(n).split(/\s+/), answer: wordAt([n, w]) }));
  const madd = MADD_ROUNDS.map((r) => ({ answer: wordAt(r.madd), choices: [wordAt(r.madd), ...r.other.map(wordAt)] }));
  const samples = verifiedSamples();
  // The adult reads a whole ayah from a medium surah (tier 3).
  const tier3 = samples.filter((x) => x.tier === 3 || x.tier === undefined);
  const pick = tier3.length ? tier3[Math.floor(Math.random() * tier3.length)] : null;
  // The graded bank for the child's adaptive games (verified ayat only); the page chooses from it by the child's
  // answers (public/js/adaptive.js). Words are counted without the pause marks.
  const bank = samples.map((x) => ({
    id: x.id, tier: x.tier || 3, surah: x.surah, surah_name: x.surah_name, ref: `${x.surah}:${x.ayah}`,
    text: x.text_ar.trim(), tokens: x.text_ar.trim().split(/\s+/), words: tajweed.wordsOf(x.text_ar), tajweed: x.tajweed_words || tajweed.tajweedWords(x.text_ar),
    rules: x.rules || tajweed.allRulesOf(x.text_ar),
    difficulty: x.difficulty || 2, use: x.use || (x.tier === 2 ? "warmup" : "assess"),
  }));
  const adultAyah = pick
    ? { ref: `${pick.surah}:${pick.ayah}`, surah_name: pick.surah_name, text: pick.text_ar.trim(), verified: true }
    : { ref: `1:${ADULT_FALLBACK}`, surah_name: quran.name_ar, text: ayahText(ADULT_FALLBACK), verified: true, fallback: true };

  return {
    source: { noor: noor.source.title, quran: quran.source },
    sound: { reserve_count: SOUND_RESERVE.length, items: sound },
    shape: { items: shape },
    fatha: { items: fatha.map((w) => ({ word: w.word, lesson: w.lesson, page: w.page })) },
    harakat: { items: harakat.map((w) => ({ word: w.word, lesson: w.lesson, page: w.page })) },
    fatiha: { items: fatiha },
    ayah: { items: [ayah] },
    find: { items: find },
    madd: { items: madd },
    adult_ayah: adultAyah,
    bank,
    // Until enough ayat are verified, the assessment of a reader falls back to Al-Fatiha (the verified file).
    fatiha_ayat: quran.ayahs.map((a) => ({ id: `f-${a.ayah}`, tier: 3, surah: 1, surah_name: quran.name_ar, ref: `1:${a.ayah}`, text: a.text_ar, tokens: a.text_ar.split(/\s+/), words: tajweed.wordsOf(a.text_ar), tajweed: tajweed.tajweedWords(a.text_ar), rules: tajweed.allRulesOf(a.text_ar), difficulty: a.ayah === 1 ? 1 : 2, use: "fallback" })),
  };
}

// Every Arabic word in the content must be found exactly in one of the two files (letters and letter forms excepted).
function unknownArabicWords(content) {
  const noorText = fs.readFileSync(NOOR_PATH, "utf8");
  const quranText = fs.readFileSync(QURAN_PATH, "utf8") + "\n" + verifiedSamples().map((x) => x.text_ar).join("\n");
  const words = [];
  const walk = (v) => {
    if (typeof v === "string") v.split(/\s+/).forEach((w) => /[ء-ي]/.test(w) && stripMarks(w).replace(/ـ/g, "").length > 1 && words.push(w));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => k !== "source" && k !== "name_ar" && k !== "surah_name" && walk(x));
  };
  walk(content);
  return words.filter((w) => !noorText.includes(w) && !quranText.includes(w));
}

module.exports = { gameContent, unknownArabicWords, verifiedSamples, SAMPLES_PATH };
