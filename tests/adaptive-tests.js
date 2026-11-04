// The adaptive diagnostic: the start, the games played and the content follow the parent's answers. Run: npm test
const L = require("../public/js/levels");
const A = require("../public/js/adaptive");
const content = require("../lib/content");
const tajweed = require("../lib/tajweed-marks");

let failed = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
};

// A seeded random source, so the tests are repeatable.
const rng = (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();

// Three profiles: a beginner, a child who reads words with vowels, and an advanced reader who memorizes.
const beginner = { estimate: "none", age_band: "6–7", goals: ["read"], memorized: [] };
const middle = { estimate: "words", age_band: "8–9", goals: ["hifz"], memorized: ["الفاتحة", "الإخلاص"] };
const advanced = { estimate: "mushaf", age_band: "10–12", goals: ["hifz", "tajweed"], memorized: ["الفاتحة", "الناس", "الفلق", "الإخلاص", "المسد", "النصر", "الكوثر", "العصر"] };

// A stand-in for the verified bank (the real one waits for Sara's review): ayat from the samples file, as if verified.
const samples = require("../data/quran_samples.json").samples;
const bank = samples.map((x) => ({ id: x.id, tier: x.tier, surah: x.surah, surah_name: x.surah_name, ref: `${x.surah}:${x.ayah}`, text: x.text_ar, words: tajweed.wordsOf(x.text_ar), tajweed: x.tajweed_words }));
const base = { ...content.gameContent(), bank };

(async () => {
  check("D1. start: a beginner who does not know the letters starts with letter sounds", A.startFor(beginner), "sound");
  check("D2. start: a child who reads words with vowels starts with reading words", A.startFor(middle), "fatha");
  check("D3. start: an advanced reader who memorizes starts with a whole ayah (no letter games, no single words)", A.startFor(advanced), "ayah");
  check("D4. knows the letters → letter shapes (joining), not sounds", A.startFor({ estimate: "letters", goals: ["hifz"] }), "shape");
  check("D5. «يتعلم من البداية» starts one lower", A.startFor({ estimate: "words", goals: ["read"] }), "shape");
  check("D6. «يحسّن التلاوة والتجويد» starts one higher for a child who reads words", A.startFor({ estimate: "words", goals: ["tajweed"] }), "harakat");
  check("D7. many memorized surahs raise the start for a reader", A.startFor({ estimate: "words", goals: ["hifz"], memorized: ["الفاتحة", "الناس", "الفلق", "الإخلاص", "المسد", "النصر"] }), "harakat");
  check("D8. …but memorizing does not push a child who does not know the letters", A.startFor({ estimate: "none", goals: ["hifz"], memorized: ["الفاتحة", "الناس", "الفلق", "الإخلاص", "المسد", "النصر"] }), "sound");
  check("D9. age 4–5 starts one lower", A.startFor({ estimate: "words", goals: ["hifz"], age_band: "4–5" }), "shape");

  // Played paths and levels, with each child passing the games at their own level.
  const run = (p, passes) => L.runStages(A.startFor(p), async (k) => ({ passed: passes.includes(k), score: passes.includes(k) ? 4 : 0, total: 4 }));
  let r = await run(beginner, []);
  check("D10. beginner: one game (letter sounds), level R1", [r.shown, L.levelFrom(r.stages)], [["sound"], "R1"]);
  r = await run(middle, ["fatha", "harakat"]);
  check("D11. middle: words, vowels, then words from the Quran; level R5", [r.shown, L.levelFrom(r.stages)], [["fatha", "harakat", "fatiha"], "R5"]);
  r = await run(advanced, ["ayah"]);
  check("D12. advanced: a whole ayah only, level R6 (then the two reader games)", [r.shown, L.levelFrom(r.stages)], [["ayah"], "R6"]);
  r = await run(advanced, ["fatiha"]);
  check("D13. advanced who cannot read the whole ayah goes down to words, level R5", [r.shown, L.levelFrom(r.stages)], [["ayah", "fatiha"], "R5"]);

  // Content from the bank.
  const cm = A.pickContent(base, middle, rng);
  const ca = A.pickContent(base, advanced, rng);
  const surahsOf = (items) => items.map((x) => x.ref.split(":")[0]);
  check("D14. no Al-Fatiha once the bank is verified: words from four different surahs", [cm.fatiha.items.length, new Set(surahsOf(cm.fatiha.items)).size, cm.fatiha.items.some((x) => x.ref.startsWith("1:"))], [4, 4, false]);
  check("D15. the middle child's whole ayah is a short one (tier 2); the advanced child's a medium surah (tier 3)",
    [bank.find((x) => x.ref === cm.ayah.items[0].ref).tier, bank.find((x) => x.ref === ca.ayah.items[0].ref).tier], [2, 3]);
  const memorizedNames = new Set(advanced.memorized);
  const usedNames = [...ca.fatiha.items, ...ca.find.items, ...ca.madd.items].map((x) => x.surah_name);
  check("D16. surahs the child memorized are avoided (reading, not recitation)", usedNames.filter((n) => memorizedNames.has(n)), []);
  check("D17. «find the word»: four ayat from four surahs, the word comes once in its ayah", [ca.find.items.length, new Set(surahsOf(ca.find.items)).size, ca.find.items.every((x) => x.words.filter((w) => w === x.answer).length === 1)], [4, 4, true]);
  check("D18. «where is the madd»: the answer has madd and the other two do not (by the reviewed lists)",
    ca.madd.items.every((x) => tajweed.marks(x.answer).madd && x.choices.slice(1).every((w) => !tajweed.marks(w).madd)), true);
  check("D19. two runs for the same child vary the surahs", JSON.stringify(A.pickContent(base, advanced, rng).fatiha.items) !== JSON.stringify(A.pickContent(base, advanced, rng).fatiha.items), true);
  const empty = A.pickContent({ ...base, bank: [] }, advanced, rng);
  check("D20. until ayat are verified, Al-Fatiha (the verified file) fills in", empty.fatiha.items.every((x) => x.ref.startsWith("1:")) && empty.ayah.items[0].ref === "1:1", true);
  check("D21. the real bank shows nothing before Sara's review", content.gameContent().bank.length, 0);

  console.log(failed ? `\n${failed} adaptive case(s) failed` : "\nall adaptive cases behaved as expected");
  process.exit(failed ? 1 : 0);
})();
