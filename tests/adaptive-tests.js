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
const bank = samples.map((x) => ({ id: x.id, tier: x.tier, surah: x.surah, surah_name: x.surah_name, ref: `${x.surah}:${x.ayah}`, text: x.text_ar, tokens: x.text_ar.split(" "), words: tajweed.wordsOf(x.text_ar), tajweed: x.tajweed_words, rules: x.rules, difficulty: x.difficulty, use: x.use }));
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
  // Sara verified the 80 ayat on 2026-11-04 (70, then the 10 long ones): the real bank is used, and Al-Fatiha is never a test item or a fallback.
  const real = content.gameContent();
  const realReaders = [{ who: "child", estimate: "mushaf", memorized: ["الفاتحة"], memorized_more: true }, { who: "child", estimate: "words", memorized: [] }, { who: "adult", juz: "more" }];
  const fatihaSeen = realReaders.some((p) => {
    const pool = A.assessmentPool(real, p, rng);
    for (const ans of ["right", "wrong", "partial"]) {
      const run = A.simulate(pool, () => ans);
      pool.shown = new Set();
      const first = A.nextPassage(pool, 1, new Set());
      if (pool.fallback || first.ref.startsWith("1:") || first.d !== 1 || run.recite.some((x) => x.ref.startsWith("1:")) || run.rules.some((x) => x.ref.startsWith("1:"))) return true;
      if (A.pickHifz(pool, new Set()).some((x) => x.ref.startsWith("1:"))) return true;
    }
    return false;
  });
  // The foundational games too: with the real bank, no item comes from Al-Fatiha, for any child, in many runs.
  const kids = [beginner, middle, advanced, { estimate: "letters", goals: ["read"], memorized: [] }, { estimate: "words", goals: ["tajweed"], age_band: "4–5", memorized: ["الفاتحة"] }];
  let gameItems = 0, fromFatiha = 0;
  for (const kid of kids) for (let i = 0; i < 20; i++) {
    const c = A.pickContent(real, kid, rng);
    for (const key of ["fatiha", "ayah", "find", "madd"]) for (const it of c[key].items) {
      gameItems++;
      if (it.ref.startsWith("1:") || it.surah_name === "الفاتحة") fromFatiha++;
      if (key === "find" && it.words.length < 4) fromFatiha++; // and «find the word» needs a real choice
    }
    if (c.fatiha.items.length !== 4 || c.find.items.length !== 4 || c.madd.items.length !== 4 || c.ayah.items.length !== 1) fromFatiha++;
  }
  check("D21b. the foundational games with the real bank: full rounds, no word or ayah from Al-Fatiha, «find the word» in ayat of 4+ words", [gameItems, fromFatiha], [kids.length * 20 * 13, 0]);
  check("D21. the real bank: 80 verified ayat; no Al-Fatiha in the reading check, recitation, rules or memorization", [real.bank.length, fatihaSeen], [80, false]);

  // ---- Tajweed rules on the Uthmani marks ----
  const ruleAt = (text) => { const w = tajweed.wordsOf(text); return tajweed.rulesOf(text).map((r) => `${r.words.map((i) => w[i - 1]).join(" ")}=${r.rule}`); };
  const text = (id) => samples.find((x) => x.id === id).text_ar;
  const r194 = ruleAt(text("t3-19-4"));
  check("D22. rules from the marks: idgham with ghunnah, izhar shafawi, iqlab (Maryam 19:4)",
    ["شَيْبًا وَلَمْ=idgham_ghunnah", "وَلَمْ أَكُنۢ=izhar_shafawi", "أَكُنۢ بِدُعَآئِكَ=iqlab"].every((x) => r194.includes(x)), true);
  check("D23. idgham without ghunnah and ikhfa (Al-Ikhlas 112:4, Ash-Sharh 94:2)",
    [ruleAt(text("t2-112-4")).includes("يَكُن لَّهُۥ=idgham_no_ghunnah"), ruleAt(text("t3-94-2")).includes("عَنكَ=ikhfa")], [true, true]);
  const fatiha = require("../data/quran_fatiha.json").ayahs;
  check("D24. lam shamsiyah / qamariyah, and the name of Allah is left out", [ruleAt(fatiha[0].text_ar), ruleAt(fatiha[1].text_ar)],
    [["ٱلرَّحْمَـٰنِ=shamsiyah", "ٱلرَّحِيمِ=shamsiyah"], ["ٱلْحَمْدُ=qamariyah", "ٱلْعَـٰلَمِينَ=qamariyah"]]);
  check("D25. no rule across a pause mark or before hamzat al-wasl («نَصْرُ ٱللَّهِ»)", ruleAt(text("t2-110-1")).some((x) => x.startsWith("نَصْرُ")), false);

  // ---- who takes the reader's assessment ----
  const arabChild = { who: "child", home_language: "ar", estimate: "mushaf", age_band: "8–9", goals: ["tajweed"], memorized: ["الفاتحة", "الإخلاص", "الفلق", "الناس"], memorized_more: true };
  const foreignBeginner = { who: "child", home_language: "en", estimate: "none", age_band: "6–7", goals: ["read"], memorized: [] };
  check("D26. a child who reads words or the Mushaf takes the assessment (any home language); an adult too",
    [A.isReader(arabChild), A.isReader({ who: "child", home_language: "en", estimate: "words" }), A.isReader({ who: "adult" })], [true, true, true]);
  check("D27. a child who does not read yet takes the foundational games", [A.isReader(foreignBeginner), A.isReader({ who: "child", home_language: "ar", estimate: "letters" })], [false, false]);

  const pool = A.assessmentPool(base, arabChild, rng);
  const famous = new Set(samples.filter((x) => x.use === "warmup").map((x) => `${x.surah}:${x.ayah}`));
  check("D28. test items never come from Al-Fatiha or the famous short surahs (warm-up only)",
    [pool.passages.some((x) => famous.has(x.ref) || x.ref.startsWith("1:")), pool.questions.some((q) => famous.has(q.ref) || q.ref.startsWith("1:"))], [false, false]);
  const first = A.nextPassage(pool, 1, new Set());
  check("D29. the reading check is a short ayah (difficulty 1)", first.d, 1);
  const up = A.simulate(pool, () => "right"), down = A.simulate(pool, () => "wrong");
  check("D30. recitation starts at medium, goes up after clean readings and down after many mistakes",
    [up.recite.map((x) => x.d), down.recite.map((x) => x.d)], [[2, 3, 3], [2, 1, 1]]);
  check("D31. recitation: three passages from three different surahs", new Set(up.recite.map((x) => x.ref.split(":")[0])).size, 3);
  const hard = up.rules.slice(1).map((x) => x.d), easy = down.rules.slice(1).map((x) => x.d);
  check("D32. rules adapt too: after right answers the questions are harder than after wrong ones",
    hard.reduce((a, b) => a + b, 0) > easy.reduce((a, b) => a + b, 0), true);
  const kinds = new Set(up.rules.map((x) => x.kind));
  check("D33. eight rule questions across noon, madd, qalqalah and meem (and ra / Allah, lam / wasl); the answer is among the choices",
    [up.rules.length, ["noon", "madd", "qalqalah", "meem"].every((k) => kinds.has(k)), up.rules.every((x) => x.choices.includes(x.answer))], [8, true, true]);
  check("D34. each rule question from a different ayah, and no rule asked twice", [new Set(up.rules.map((x) => x.ref)).size, new Set(up.rules.map((x) => x.skill)).size], [8, 8]);
  const madds = pool.questions.filter((q) => q.kind === "madd").map((q) => q.answer);
  check("D35. the madd types are asked (natural, connected, separated, necessary)", ["madd_tabii", "madd_muttasil", "madd_munfasil", "madd_lazim"].every((m) => madds.includes(m)), true);
  const x40 = A.nextPassage({ ...pool, passages: pool.passages.filter((x) => x.ref === "89:23") }, 3, new Set());
  check("D36. rules a listener can hear in a passage, of different kinds (Al-Fajr 89:23)", x40.apply.map((s) => `${s.word}=${s.skill}`),
    ["يَوْمَئِذٍۭ بِجَهَنَّمَ=iqlab", "يَوْمَئِذٍ يَتَذَكَّرُ=idgham_ghunnah", "ٱلْإِنسَـٰنُ=ikhfa"]);
  const memo = A.pickHifz(pool, new Set());
  check("D37. memorization: one place beyond the short surahs (the parent says the child knows more) and one short surah, never Al-Fatiha",
    [memo.length, memo[0].beyond, memo[0].surah >= 78 && !famous.has(memo[0].ref), memo[1].beyond, arabChild.memorized.includes(memo[1].surah_name) && memo[1].surah !== 1], [2, true, true, false, true]);
  const adultPool = A.assessmentPool(base, { who: "adult", juz: "none" }, rng);
  check("D38. an adult who has not memorized Juz' Amma: no memorization question beyond it", A.pickHifz(adultPool, new Set()).filter((x) => x.beyond).length, 0);
  const emptyPool = A.assessmentPool({ ...base, bank: [] }, arabChild, rng);
  const fb = A.simulate(A.assessmentPool({ ...base, bank: [] }, arabChild, rng), () => "right");
  check("D39b. with only Al-Fatiha to fall back on, no ayah is shown twice", new Set(fb.recite.map((x) => x.ref)).size, fb.recite.length);
  check("D39. until ayat are verified: Al-Fatiha fills in (marked fallback), not 1:1", [emptyPool.fallback, emptyPool.passages.every((x) => x.ref.startsWith("1:") && x.ref !== "1:1"), emptyPool.questions.length > 0], [true, true, true]);

  // ---- Tajweed rules on the marks (madd, qalqalah, ra, hamza) ----
  const all = (tx) => { const w = tajweed.wordsOf(tx); return tajweed.allRulesOf(tx).map((r) => `${r.words.map((i) => w[i - 1]).join(" ")}=${r.rule}`); };
  const a90 = all(text("t4-90-12"));
  check("D40. madd munfasil, qalqalah, heavy ra and hamzat al-qat' (Al-Balad 90:12)",
    ["وَمَآ أَدْرَىٰكَ=madd_munfasil", "أَدْرَىٰكَ=qalqalah", "أَدْرَىٰكَ=tafkhim", "أَدْرَىٰكَ=hamzat_qat"].every((x) => a90.includes(x)), true);
  check("D41. a madd letter before hamzat al-wasl is not a madd («مَا ٱلْعَقَبَةُ», «وَنَهَى ٱلنَّفْسَ»)",
    [a90.includes("مَا=madd_tabii"), all(text("t4-79-40")).includes("وَنَهَى=madd_tabii")], [false, false]);
  check("D42. madd muttasil (Al-Fajr 89:23); the last word of an ayah is left out for natural madd and ra (stopping changes them)",
    [all(text("t4-89-23")).includes("وَجِا۟ىٓءَ=madd_muttasil"), all(text("t4-89-23")).some((x) => x.startsWith("ٱلذِّكْرَىٰ=madd") || x.startsWith("ٱلذِّكْرَىٰ=taf"))], [true, false]);

  // ---- levels, saving and the report ----
  check("D43. the reader's level: recites well and knows the rules → R6; recites well → R5; otherwise → R4",
    [L.levelFrom({ recite: { passed: true }, rules: { passed: true } }), L.levelFrom({ recite: { passed: true }, rules: { passed: false } }), L.levelFrom({ recite: { passed: false } })], ["R6", "R5", "R4"]);
  const allGames = Object.fromEntries(L.STAGES.map((k) => [k, { passed: true }]));
  check("D49. many mistakes on the first short ayah, then every game passed: at most R5, not R6",
    [L.levelFrom({ check: { passed: false }, ...allGames }), L.levelFrom(allGames)], ["R5", "R6"]);
  // The saved items must use words of the verified text: the test points the server at the samples file as if verified.
  const fs = require("fs"), os = require("os"), path = require("path");
  const tmp = path.join(os.tmpdir(), `qurana-samples-${process.pid}.json`);
  const d = require("../data/quran_samples.json");
  fs.writeFileSync(tmp, JSON.stringify({ ...d, samples: d.samples.map((x) => ({ ...x, verified_by: "test", verified_on: "2026-11-04" })) }));
  process.env.QURAN_SAMPLES_PATH = tmp;
  const validate = require("../lib/validate").validateSubmission;
  const sim = A.simulate(pool, (part, it) => (part === "rules" && it.kind === "noon" ? "wrong" : "right"));
  const wordOf = (x) => pool.questions.find((q) => q.ref === x.ref && q.skill === x.skill).word;
  const spot = (s, result) => ({ skill: s.skill, ref: "89:23", word: s.word, d: 3, result });
  const st = {
    check: { score: 2, total: 2, passed: true, items: [{ skill: "recite_1", ref: first.ref, d: 1, result: "right" }] },
    recite: { score: 6, total: 6, passed: true, items: sim.recite.map((x) => ({ skill: `recite_${x.d}`, ref: x.ref, d: x.d, result: "right" })) },
    apply: { score: 1, total: 2, passed: false, items: [spot(x40.apply[0], "right"), spot(x40.apply[1], "wrong"), spot(x40.apply[2], "unsure")] },
    rules: { score: sim.rules.filter((x) => x.result === "right").length, total: sim.rules.length, passed: true, items: sim.rules.map((x) => ({ skill: x.skill, ref: x.ref, word: wordOf(x), d: x.d, result: x.result })) },
    hifz: { score: 0, total: 0, passed: false, items: [{ skill: "hifz", ref: memo[0].ref, result: "not_memorized" }] },
  };
  const body = (stg) => ({ profile: { ...arabChild, country: "KW", teacher: "any", lessons_per_week: 3, memorized_from: "mushaf", tajweed: { madd: "yes" } }, stages: stg });
  const v = validate(body(st));
  check("D44. a reader's result with its items is accepted without any letter game; the level comes from the assessment",
    [v.error || "", v.value && v.value.level, v.value && !("sound" in v.value.stages), v.value && v.value.stages.rules.items.length], ["", "R6", true, 8]);
  const forged = JSON.parse(JSON.stringify(st));
  forged.rules.items[0].word = "كَلِمَةٌمُخْتَرَعَة";
  check("D45. a word that is not in the verified text is refused", /verified text/.test(validate(body(forged)).error || ""), true);
  check("D46. a recitation without the reading check is refused", /reading check/.test(validate(body({ recite: st.recite })).error || ""), true);
  const SKL = require("../public/js/skills");
  const rep = SKL.report(v.value.stages, "ar");
  const lines = SKL.lines(rep, "ar");
  check("D47. the report: noon rules answered wrong are «needs work»; iqlab applied is mastered, with its words; one place not sure",
    [rep.needs.some((b) => b.part === "rules") && rep.needs.filter((b) => b.part === "rules").every((b) => ["izhar", "idgham_ghunnah", "idgham_no_ghunnah", "iqlab", "ikhfa"].includes(b.skill)),
      lines.mastered.some((l) => l.startsWith("يطبّق الإقلاب (يَوْمَئِذٍۭ بِجَهَنَّمَ)")), lines.needs.some((l) => l.startsWith("لا يطبّق بعد الإدغام بغنة")), rep.unsure.length, rep.recite.top], [true, true, true, 1, 3]);
  check("D48. an adult's report speaks to them", SKL.lines(rep, "ar", true).mastered.some((l) => l.startsWith("تطبّق")), true);
  const O = require("../public/js/options");
  const adultBody = (rules) => ({ profile: { who: "adult", age_band: O.ADULT_AGE_BANDS[1], country: O.COUNTRIES[0].code, juz: "amma", goals: [O.ADULT_GOALS[0].id], teacher: O.TEACHER[0].id, self: "fluent", ayah: "easy", lessons_per_week: 3 },
    stages: { check: st.check, recite: st.recite, rules: { ...st.rules, score: rules, passed: true } } });
  const low = validate(adultBody(2)).value, high = validate(adultBody(8)).value;
  check("D50. an adult who reads fluently but gets 2 of 8 rules: «القراءة من المصحف» (A2 / R5); 8 of 8: «التلاوة والحفظ» (A3 / R6)",
    [low.profile.adult_level, low.level, high.profile.adult_level, high.level], ["A2", "R5", "A3", "R6"]);
  // ---- the adult's Tajweed test: the rule, then «ولماذا؟» ----
  const adultQs = A.assessmentPool(real, { who: "adult", juz: "none" }, rng).questions;
  const withWhy = adultQs.map((q) => [q, SKL.reasonQuestion(q, "ar")]);
  check("D51. «ولماذا؟»: every noon / lam / qalqalah place has its deciding letter, matching the rule; the answer is among the choices; meem has none",
    [withWhy.filter(([q, w]) => ["noon", "lam", "qalqalah"].includes(q.kind) && !w).length, withWhy.every(([q, w]) => !w || w.choices.includes(w.answer)), withWhy.some(([q, w]) => q.kind === "meem" && w)], [0, true, false]);
  const ikhfa = adultQs.find((q) => q.skill === "ikhfa" && q.letter === "ت");
  check("D52. the reason names the letter after the noon: «لأن الحرف الذي بعدها «ت» من حروف الإخفاء», with throat letters and «ينمو» as the wrong choices",
    ikhfa ? SKL.reasonQuestion(ikhfa, "ar").choices : "no ikhfa before ت", ["لأن الحرف الذي بعدها «ت» من حروف الإخفاء", "لأن الحرف الذي بعدها «ت» من حروف الحلق", "لأن الحرف الذي بعدها «ت» من حروف «ينمو»"]);
  const tq = sim.rules.map((x) => ({ skill: x.skill, ref: x.ref, word: wordOf(x), d: x.d, result: "right" }));
  const adultTest = (rulesRight, reasonsRight) => validate({ profile: { who: "adult", age_band: O.ADULT_AGE_BANDS[1], country: O.COUNTRIES[0].code, juz: "none", goals: [O.ADULT_GOALS[0].id], teacher: O.TEACHER[0].id, self: "fluent", lessons_per_week: 3 },
    stages: { rules: { score: rulesRight, total: 8, passed: true, items: tq }, reasons: { score: reasonsRight, total: 6, passed: true, items: tq.slice(0, 6) } } });
  const strong = adultTest(8, 6), weak = adultTest(7, 1);
  check("D53. an adult needs no recitation they rate themselves: the Tajweed test (rules + reasons) decides; 14/14 → A3, 8/14 → A2",
    [strong.error || "", strong.value && strong.value.profile.adult_level, weak.value && weak.value.profile.adult_level, strong.value && "ayah" in strong.value.profile], ["", "A3", "A2", false]);
  check("D54. the adult's report: «تعرف سبب …»", SKL.lines(SKL.report(strong.value.stages, "ar"), "ar", true).mastered.some((l) => l.startsWith("تعرف سبب")), true);
  const rec5 = { level: "R5", profile: { who: "child" }, stages: { recite: { passed: true }, rules: { passed: false } } };
  check("D55. the level in one sentence with its reason, from the saved record or from the page's { code } form",
    [SKL.levelReason(rec5, "القراءة من المصحف"), SKL.levelReason({ ...rec5, level: { code: "R5" } }, "القراءة من المصحف")],
    Array(2).fill("مستوى طفلكم: القراءة من المصحف — لأن قراءة الآيات صحيحة، لكن أحكام التجويد ما زالت تحتاج إلى تثبيت."));
  check("D56. «ما رصده الاختبار»: two sentences, with the rule chosen instead («خلط بين … و…»)",
    SKL.findings({ rules: { items: [{ skill: "ikhfa", result: "right" }, { skill: "madd_muttasil", result: "right" }, { skill: "idgham_ghunnah", result: "wrong", picked: "idgham_no_ghunnah" }, { skill: "qalqalah", result: "wrong" }] } }, "ar"),
    ["أتقن الإخفاء والمدّ المتصل.", "لكنه خلط بين الإدغام بغنة والإدغام بلا غنة، وأخطأ في القلقلة."]);
  // ---- the Tajweed questions built from the first page ----
  const tpLow = A.testPlan({ who: "adult", self: "fluent", tajweed: { madd: "no", ghunnah: "unsure", qalqalah: "no" } });
  const tpMid = A.testPlan({ who: "adult", self: "fluent", tajweed: { madd: "sometimes", ghunnah: "yes", qalqalah: "no" } });
  const tpHigh = A.testPlan({ who: "adult", self: "fluent", tajweed: { madd: "yes", ghunnah: "yes", qalqalah: "yes" } });
  check("D57. «I don't apply most rules» → a basic test (6 questions, 3 choices); «yes» to all → starts high; a stumbling reader → basic",
    [tpLow.tier, tpLow.slots.length, tpLow.narrow, tpMid.tier, tpHigh.tier, tpHigh.start, A.testPlan({ who: "adult", self: "stumble", tajweed: tpHigh.base }).tier], ["basic", 6, true, "medium", "advanced", 3, "basic"]);
  const adultPool2 = A.assessmentPool(real, { who: "adult", juz: "none" }, rng);
  const lowRun = A.simulate(adultPool2, () => "wrong", tpLow), highRun = A.simulate(adultPool2, () => "right", tpHigh);
  check("D58. the basic test starts with basic rules (difficulty 1); each kind starts where its answer put it («yes» to ghunnah → the hardest noon rules)",
    [lowRun.rules[0].d, lowRun.rules.every((x) => x.d <= 2), A.simulate(adultPool2, () => "right", tpMid).rules[0].d], [1, true, 3]);
  const dk = SKL.findings({ rules: { items: [{ skill: "shamsiyah", result: "right" }, { skill: "ikhfa", result: "dont_know" }, { skill: "qalqalah", result: "wrong" }] } }, "ar", true);
  const dkLines = SKL.lines(SKL.report({ rules: { items: [{ skill: "ikhfa", ref: "1:1", result: "dont_know" }] } }, "ar"), "ar", true);
  check("D59. «لا أعرف» is said as «لم تعرف بعد», not as a mistake", [dk[1], dkLines.needs[0]], ["لكنك أخطأتَ في القلقلة، ولم تعرف بعد الإخفاء.", "لم تعرف بعد الإخفاء"]);
  fs.unlinkSync(tmp);

  console.log(failed ? `\n${failed} adaptive case(s) failed` : "\nall adaptive cases behaved as expected");
  process.exit(failed ? 1 : 0);
})();
