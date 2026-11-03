// The words and letters the child sees in the games. Fixed rules, no model:
// every Arabic word comes exactly from data/noor_albayan.json or data/quran_fatiha.json.
const fs = require("fs");
const path = require("path");

const NOOR_PATH = path.join(__dirname, "..", "data", "noor_albayan.json");
const QURAN_PATH = path.join(__dirname, "..", "data", "quran_fatiha.json");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

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
    ref: `1:${ayah}`, word: n, text: quran.ayahs.find((a) => a.ayah === ayah).text_ar.split(/\s+/)[n - 1],
  }));
  const ayah = { ref: "1:1", text: basmala };

  return {
    source: { noor: noor.source.title, quran: quran.source },
    sound: { reserve_count: SOUND_RESERVE.length, items: sound },
    shape: { items: shape },
    fatha: { items: fatha.map((w) => ({ word: w.word, lesson: w.lesson, page: w.page })) },
    harakat: { items: harakat.map((w) => ({ word: w.word, lesson: w.lesson, page: w.page })) },
    fatiha: { items: fatiha },
    ayah: { items: [ayah] },
  };
}

// Every Arabic word in the content must be found exactly in one of the two files (letters and letter forms excepted).
function unknownArabicWords(content) {
  const noorText = fs.readFileSync(NOOR_PATH, "utf8");
  const quranText = fs.readFileSync(QURAN_PATH, "utf8");
  const words = [];
  const walk = (v) => {
    if (typeof v === "string") v.split(/\s+/).forEach((w) => /[ء-ي]/.test(w) && stripMarks(w).replace(/ـ/g, "").length > 1 && words.push(w));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => k !== "source" && k !== "name_ar" && walk(x));
  };
  walk(content);
  return words.filter((w) => !noorText.includes(w) && !quranText.includes(w));
}

module.exports = { gameContent, unknownArabicWords };
