// Candidate Tajweed words in a vocalized Uthmani ayah, by fixed rules on its marks (no model). Used to prepare
// data/quran_samples.json for Sara's review: the words are stored in the file and shown only once she has checked the
// ayah (verified_by, verified_on), so her corrections are what the games use.
// Text is expected in NFC (vowel before shadda), as in data/quran_fatiha.json.
const VOWEL = "[ً-ِ]"; // tanween and short vowels
const MARK_AFTER = "[ً-ْ۟]"; // a vowel, sukun or the "silent letter" mark after a letter

// A word is a token with at least one letter (pause marks such as ۖ stand alone and are not words).
const isWord = (t) => /[ء-يٱ]/.test(t);
const wordsOf = (text) => String(text).normalize("NFC").trim().split(/\s+/).filter(isWord);

// Natural or other madd: alif after fatha, waw after damma, ya after kasra (with no mark of their own), the small
// (dagger) alif, the alif with madda, the small waw / ya of linking (silah), and alif maqsura after a fatha or kasra.
// (In NFC a shaddah comes after the vowel: «دِّي» is دـِـّـي, so a shaddah may sit between the vowel and the letter.)
const MADD = new RegExp(`َّ?ا(?!${MARK_AFTER})|ٰ|آ|ۥ|ۦ|ُّ?و(?!${MARK_AFTER})|ِّ?ي(?!${MARK_AFTER})|[َِ]ّ?ى`);
// Ghunnah: noon or meem with shaddah.
const GHUNNAH = new RegExp(`[نم]${VOWEL}?ّ`);
// Qalqalah: ق ط ب ج د with sukun.
const QALQALAH = /[قطبجد]ْ/;
// Soft letter (lin): waw or ya with sukun after a fatha — left out of the "no madd" choices to avoid ambiguity.
const LIN = /َ[وي]ْ/;
// The name of Allah has a madd that the script does not write; left out of the "no madd" choices.
const ALLAH = /للّ?َ?ه/;

function marks(word) {
  return { madd: MADD.test(word), ghunnah: GHUNNAH.test(word), qalqalah: QALQALAH.test(word), lin: LIN.test(word), allah: ALLAH.test(word.replace(/ّ/g, "")) || /ٱللَّه|لِلَّه|ٱللَّـه/.test(word) };
}

// For one ayah: the word positions (1-based, among words) for each feature, and the words safe to use as "no madd".
function tajweedWords(text) {
  const words = wordsOf(text);
  const out = { madd: [], ghunnah: [], qalqalah: [], plain: [] };
  words.forEach((w, i) => {
    const m = marks(w);
    if (m.madd) out.madd.push(i + 1);
    if (m.ghunnah) out.ghunnah.push(i + 1);
    if (m.qalqalah) out.qalqalah.push(i + 1);
    if (!m.madd && !m.lin && !m.allah && w.replace(/[^ء-يٱ]/g, "").length >= 3) out.plain.push(i + 1);
  });
  return out;
}

module.exports = { wordsOf, isWord, marks, tajweedWords };
