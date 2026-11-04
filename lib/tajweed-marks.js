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

// ---------- Tajweed rules on a marked place in the ayah (for the rules questions) ----------
// Read from the Uthmani marks: a noon or meem with sukun is shown (izhar), a bare one (no mark) is merged or hidden
// (idgham / ikhfa), «ۢ» marks iqlab; lam of «ٱل» with sukun is qamariyah, a bare lam before a shaddah is shamsiyah.
// A place is skipped when a pause mark stands between the two words, or the next word starts with hamzat al-wasl.
const BASE = /[ء-يٱـ]/;
const THROAT = "ءأإؤئهعحغخ";
function clusters(word) {
  const out = [];
  for (const ch of word) {
    if (BASE.test(ch)) out.push({ b: ch, m: "" });
    else if (out.length) out[out.length - 1].m += ch;
  }
  return out;
}
const firstLetter = (word) => (clusters(word).find((c) => c.b !== "ـ") || {}).b;
function noonRule(next) {
  if (!next) return null;
  if (THROAT.includes(next)) return "izhar";
  if ("ينمو".includes(next)) return "idgham_ghunnah";
  if ("لر".includes(next)) return "idgham_no_ghunnah";
  if (next === "ب") return "iqlab";
  return "ikhfa";
}

function rulesOf(text) {
  const tokens = String(text).normalize("NFC").trim().split(/\s+/);
  const out = [];
  let wi = 0;
  tokens.forEach((tok, ti) => {
    if (!isWord(tok)) return;
    wi++;
    const cs = clusters(tok);
    const nextTok = tokens[ti + 1];
    const pauseNext = nextTok && !isWord(nextTok);
    const nextWord = !pauseNext ? nextTok : null;
    const nextStartsWasl = nextWord && nextWord.startsWith("ٱ");
    const nextL = nextWord && !nextStartsWasl ? firstLetter(nextWord) : null;
    // Lam of «ٱل» (after an optional و / ف / ب / ل / ك with its vowel).
    // (The lam of the name of Allah — «ٱللَّه» — is its own rule, not lam shamsiyah: left out.)
    const lamAt = cs.findIndex((c, i) => c.b === "ل" && i > 0 && cs[i - 1].b === "ٱ");
    const allahName = lamAt > 0 && cs[lamAt + 1] && cs[lamAt + 1].b === "ل" && cs[lamAt + 2] && cs[lamAt + 2].b === "ه";
    if (lamAt > 0 && cs[lamAt + 1] && !allahName) {
      if (cs[lamAt].m.includes("ْ")) out.push({ word: wi, words: [wi], kind: "lam", rule: "qamariyah" });
      else if (!cs[lamAt].m && cs[lamAt + 1].m.includes("ّ")) out.push({ word: wi, words: [wi], kind: "lam", rule: "shamsiyah" });
    }
    cs.forEach((c, i) => {
      const last = i === cs.length - 1 || (i === cs.length - 2 && "اى".includes(cs[i + 1].b) && !cs[i + 1].m);
      const after = last ? nextL : cs[i + 1] && cs[i + 1].b;
      const span = last ? [wi, wi + 1] : [wi];
      // Noon sakinah: a noon with sukun (izhar) or with no mark at all (idgham / ikhfa), or «ۢ» (iqlab).
      if (c.b === "ن" && (c.m === "ْ" || c.m === "" || c.m === "ۢ")) {
        if (last && !nextL) return;
        if (!last && "ينمو".includes(after)) return; // inside one word: izhar mutlaq, left out
        const rule = c.m === "ۢ" ? "iqlab" : noonRule(after);
        if (rule === "izhar" && c.m !== "ْ") return; // marks disagree: leave it out
        if (rule !== "izhar" && c.m === "ْ") return;
        out.push({ word: wi, words: span, kind: "noon", rule });
      }
      // Tanween at the end of the word (followed by a word that does not start with hamzat al-wasl).
      if (last && /[ً-ٍ]/.test(c.m) && nextL) {
        const rule = c.m.includes("ۢ") || (cs[i + 1] && cs[i + 1].m.includes("ۢ")) ? "iqlab" : noonRule(nextL);
        out.push({ word: wi, words: span, kind: "noon", rule });
      }
      // Meem sakinah at the end of a word.
      if (c.b === "م" && last && nextL && (c.m === "ْ" || c.m === "")) {
        const rule = nextL === "م" ? "idgham_shafawi" : nextL === "ب" ? "ikhfa_shafawi" : "izhar_shafawi";
        if (rule === "izhar_shafawi" && c.m !== "ْ") return;
        out.push({ word: wi, words: span, kind: "meem", rule });
      }
    });
  });
  return out;
}

// ---------- more rules (one place each, by fixed rules on the marks) ----------
const HAMZA = "ءأإؤئ";
const VOWEL_OF = (m) => (m.includes("َ") || m.includes("ً") ? "a" : m.includes("ُ") || m.includes("ٌ") ? "u" : m.includes("ِ") || m.includes("ٍ") ? "i" : m.includes("ْ") ? "0" : "");
function moreRulesOf(text) {
  const tokens = String(text).normalize("NFC").trim().split(/\s+/);
  const words = [];
  tokens.forEach((tok, ti) => { if (isWord(tok)) words.push({ tok, ti }); });
  const out = [];
  words.forEach(({ tok, ti }, k) => {
    const wi = k + 1;
    const cs = clusters(tok);
    const nextTok = tokens[ti + 1];
    const nextWord = nextTok && isWord(nextTok) ? nextTok : null;
    // Madd with a maddah sign: connected (hamza after it in the word), necessary (shaddah / sukun after it), separated
    // (at the end of the word, the next word starting with a hamza).
    cs.forEach((c, i) => {
      if (!(c.b === "آ" || c.m.includes("ٓ"))) return;
      const n = cs[i + 1];
      let rule = null;
      if (n && HAMZA.includes(n.b)) rule = "madd_muttasil";
      else if (n && (n.m.includes("ّ") || n.m.includes("ْ"))) rule = "madd_lazim";
      else if (!n && nextWord && HAMZA.includes(firstLetter(nextWord))) rule = "madd_munfasil";
      if (rule) out.push({ word: wi, words: rule === "madd_munfasil" ? [wi, wi + 1] : [wi], kind: "madd", rule });
    });
    // Natural madd: a madd letter with no maddah sign, no soft letter, not the name of Allah.
    // (The last word of the ayah is left out for natural madd and ra: stopping there changes the rule — madd 'arid,
    // a ra read heavy at the stop.)
    const lastWord = k === words.length - 1;
    const m = marks(tok);
    // A madd letter at the end of the word is dropped before hamzat al-wasl («مَا ٱلْعَقَبَةُ», «وَنَهَى ٱلنَّفْسَ»).
    const dropsAtEnd = nextWord && nextWord.startsWith("ٱ");
    const maddInside = dropsAtEnd ? MADD.test(tok.replace(/[اىوي]$|ٰ$/u, "")) : m.madd;
    if (!lastWord && maddInside && !m.lin && !m.allah && !/[آٓ]/.test(tok)) out.push({ word: wi, words: [wi], kind: "madd", rule: "madd_tabii" });
    // Qalqalah: ق ط ب ج د with sukun inside the word.
    if (QALQALAH.test(tok)) out.push({ word: wi, words: [wi], kind: "qalqalah", rule: "qalqalah" });
    // Ra: heavy with fatha or damma, light with kasra (ra with sukun is left out: it depends on what comes before).
    const ra = cs.find((c) => c.b === "ر" && /[ًٌٍَُِ]/.test(c.m));
    if (ra && !lastWord) out.push({ word: wi, words: [wi], kind: "ra", rule: VOWEL_OF(ra.m) === "i" ? "tarqiq" : "tafkhim" });
    // The lam of the name of Allah: light after a kasra, heavy after a fatha or damma.
    const at = cs.findIndex((c, i) => c.b === "ل" && cs[i + 1] && cs[i + 1].b === "ل" && cs[i + 1].m.includes("ّ") && cs[i + 2] && cs[i + 2].b === "ه");
    if (at >= 0) {
      let before = "";
      if (at > 0 && cs[at - 1].b !== "ٱ") before = VOWEL_OF(cs[at - 1].m); // لِلَّهِ, بِٱللَّهِ: the prefix's vowel
      else if (at > 0 && cs[at - 1].b === "ٱ" && at > 1) before = VOWEL_OF(cs[at - 2].m); // بِٱللَّهِ
      else if (k > 0) { const prev = clusters(words[k - 1].tok); before = VOWEL_OF(prev[prev.length - 1].m); }
      if (before === "i") out.push({ word: wi, words: [wi], kind: "allah", rule: "tarqiq" });
      else if (before === "a" || before === "u") out.push({ word: wi, words: [wi], kind: "allah", rule: "tafkhim" });
    }
    // Hamzat al-wasl (ٱ) or hamzat al-qat' (أ / إ) at the start of the word.
    if (cs[0] && cs[0].b === "ٱ") out.push({ word: wi, words: [wi], kind: "wasl", rule: "hamzat_wasl" });
    else if (cs[0] && "أإ".includes(cs[0].b)) out.push({ word: wi, words: [wi], kind: "wasl", rule: "hamzat_qat" });
  });
  return out;
}

// All the rules of an ayah: noon / meem / lam (rulesOf) and madd / qalqalah / ra / the name of Allah / hamza (moreRulesOf).
const allRulesOf = (text) => [...rulesOf(text), ...moreRulesOf(text)];

module.exports = { wordsOf, isWord, marks, tajweedWords, rulesOf, moreRulesOf, allRulesOf };
