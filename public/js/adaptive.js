// The adaptive diagnostic: where a child starts and which content they get, from the parent's answers. Fixed rules, no
// model. Works in the browser (window.QuranaAdaptive) and in Node (tests).
//
// Start (one of the level games, public/js/levels.js), mainly from «برأيك، طفلك الآن…»:
//   does not know the letters / knows some → letter sounds;  knows the letters → letter shapes (joining) and short words;
//   reads words with vowels → reading words (fatha);  reads from the Mushaf → words from the Quran;
//   reads from the Mushaf and memorizes (4+ surahs, or memorization / Tajweed as a goal) → whole ayat straight away,
//   with no letter games and no single beginner words.
// Then: «يتعلم من البداية» starts one game lower; «يحسّن التلاوة والتجويد» and 6+ memorized surahs one higher (for a
// child who already reads words); age 4–5 one lower. Failing the start still goes down one game at a time (runStages).
//
// Content: from the graded bank (data/quran_samples.json, verified ayat only — tier 2 short ayat, tier 3 whole ayat
// from medium surahs), from several surahs, one ayah per surah, preferring surahs the child has NOT memorized so that
// reading is measured rather than recitation. Until enough ayat are verified, Al-Fatiha (the verified file) fills in.
(function (root) {
  const L = root.QuranaLevels || (typeof require !== "undefined" ? require("./levels") : null);
  const START = { none: 0, some_letters: 0, letters: 1, words: 2, mushaf: 4 };
  const WHOLE_AYAH = 5; // index of "ayah" in L.STAGES

  const memorizedCount = (p) => (p.memorized || []).length + (p.memorized_more ? 6 : 0);
  const goalsOf = (p) => (Array.isArray(p.goals) ? p.goals : [p.goal]).filter(Boolean);

  // A child who reads from the Mushaf and memorizes: whole ayat from medium surahs, Tajweed words.
  function isAdvanced(p) {
    const g = goalsOf(p);
    return p.estimate === "mushaf" && (memorizedCount(p) >= 4 || g.includes("hifz") || g.includes("tajweed"));
  }

  function startFor(p) {
    let i = START[p.estimate] !== undefined ? START[p.estimate] : 0;
    if (isAdvanced(p)) i = WHOLE_AYAH;
    const g = goalsOf(p);
    if (g.includes("read")) i -= 1;
    if (i >= 2 && i < WHOLE_AYAH && g.includes("tajweed")) i += 1;
    if (i >= 2 && i < WHOLE_AYAH && memorizedCount(p) >= 6) i += 1;
    if (p.age_band === "4–5") i -= 1;
    return L.STAGES[Math.max(0, Math.min(WHOLE_AYAH, i))];
  }

  function shuffle(list, rng) {
    return list.map((v) => [rng(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  }

  // One ayah per surah, surahs the child has not memorized first.
  function choose(list, n, known, rng) {
    const ordered = [...shuffle(list.filter((x) => !known.has(x.surah_name)), rng), ...shuffle(list.filter((x) => known.has(x.surah_name)), rng)];
    const out = [];
    const seen = new Set();
    for (const x of ordered) {
      if (out.length >= n) break;
      if (seen.has(x.surah)) continue;
      seen.add(x.surah);
      out.push(x);
    }
    return out;
  }

  const letters = (w) => w.replace(/[^ء-يٱ]/g, "").length;
  const once = (words, w) => words.filter((x) => x === w).length === 1;

  // Returns a copy of the content with the four Quran games filled from the bank for this child.
  function pickContent(content, p, rng = Math.random) {
    const known = new Set(p.memorized || []);
    const bank = content.bank || [];
    const advanced = isAdvanced(p);
    const tier = (t) => bank.filter((x) => x.tier === t);
    const main = advanced ? tier(3) : tier(2);
    // Once the bank has verified ayat, the games never fall back on Al-Fatiha: a game short of items repeats the
    // bank's own instead. Al-Fatiha (the verified file) is used only while the bank is empty.
    const topUp = (items, defaults, n) => (bank.length ? Array.from({ length: Math.min(n, items.length ? n : 0) }, (_, i) => items[i % items.length]) : [...items, ...defaults].slice(0, n));
    const c = JSON.parse(JSON.stringify(content));

    // Reading words from the Quran: one word from each of four short ayat (other surahs than Al-Fatiha).
    const wordItems = choose(tier(2).length ? tier(2) : main.length ? main : bank, 4, known, rng).map((x) => {
      const ok = x.words.filter((w) => letters(w) >= 3 && !/ٱللَّه|لِلَّه/.test(w));
      const w = ok.length ? ok[Math.floor(rng() * ok.length)] : x.words[0];
      return { ref: x.ref, surah_name: x.surah_name, text: w };
    });
    c.fatiha.items = topUp(wordItems, content.fatiha.items, 4);

    // A whole ayah: from a medium surah for an advanced reader, a short ayah otherwise.
    const ayahPick = choose(main.length ? main : bank, 1, known, rng)[0];
    if (ayahPick) c.ayah.items = [{ ref: ayahPick.ref, surah_name: ayahPick.surah_name, text: ayahPick.text }];

    // Find the word inside the ayah.
    // (Ayat of four words or more: finding the only word of an ayah is not a question.)
    const longEnough = (l) => l.filter((x) => x.words.length >= 4);
    const findItems = choose(longEnough(main).length >= 4 ? longEnough(main) : longEnough(bank), 4, known, rng).map((x) => {
      const targets = x.words.filter((w) => letters(w) >= 2 && once(x.words, w));
      return targets.length ? { ref: x.ref, surah_name: x.surah_name, words: x.words, answer: targets[Math.floor(rng() * targets.length)] } : null;
    }).filter(Boolean);
    c.find.items = topUp(findItems, content.find.items, 4);

    // Which word has madd: a madd word and two words without madd from the same ayah (Sara's verified lists).
    // Whole ayat from medium surahs first, then short ayat, before falling back to Al-Fatiha.
    const usable = (l) => l.filter((x) => x.tajweed && x.tajweed.madd.length && x.tajweed.plain.length >= 2);
    const fromMedium = choose(usable(tier(3)), 4, known, rng);
    const used = new Set(fromMedium.map((x) => x.surah));
    const maddPicks = [...fromMedium, ...choose(usable(tier(2)).filter((x) => !used.has(x.surah)), 4 - fromMedium.length, known, rng)];
    const maddItems = maddPicks.map((x) => {
      const answer = x.words[x.tajweed.madd[Math.floor(rng() * x.tajweed.madd.length)] - 1];
      const plain = shuffle(x.tajweed.plain, rng).slice(0, 2).map((i) => x.words[i - 1]);
      return { ref: x.ref, surah_name: x.surah_name, answer, choices: [answer, ...plain] };
    });
    c.madd.items = topUp(maddItems, content.madd.items, 4);

    c.adaptive = { start: startFor(p), advanced, from_bank: { words: wordItems.length, ayah: !!ayahPick, find: findItems.length, madd: maddItems.length } };
    return c;
  }

  // ---------- someone who already reads: the assessment instead of the games ----------
  // An adult, or a child whose parent says they read words with vowels or read from the Mushaf. They start with one
  // short passage (the reading check); a child who reads it with many mistakes goes to the games above instead.
  // The test items are ayat most readers have not memorized (use = "assess": the longer surahs of Juz' Amma and medium
  // surahs). Al-Fatiha and the famous short surahs are never test items; they are used only to check memorization.
  // Until ayat are verified, Al-Fatiha (the verified file) fills in, marked as a fallback.
  const isReader = (p) => p.who === "adult" || ["words", "mushaf"].includes(p.estimate);
  const isArabicReader = isReader;
  const SK = root.QuranaSkills || (typeof require !== "undefined" ? require("./skills") : null);

  // The Tajweed questions, in order: each slot asks one kind (or one of two), its difficulty adapting as it goes.
  const SLOTS = [["noon"], ["madd"], ["qalqalah"], ["ra", "allah"], ["noon"], ["madd"], ["lam", "wasl"], ["meem"]];
  const RECITE_COUNT = 3; // passages after the reading check
  const START_LEVEL = 2; // medium
  const step = (level, result) => (result === "right" ? Math.min(3, level + 1) : result === "wrong" ? Math.max(1, level - 1) : level);

  // Juz' Amma surahs in the bank count as memorized for an adult who said Juz' Amma or more.
  function knownSurahs(p, bank) {
    if (p.who === "adult") return ["amma", "upto5", "more"].includes(p.juz) ? bank.filter((x) => x.surah >= 78).map((x) => x.surah_name) : [];
    return p.memorized || [];
  }
  const wordsAt = (x, idx) => idx.map((i) => x.words[i - 1]).join(" ");

  // One question from one marked place of an ayah, or null when it cannot be asked fairly.
  function question(x, r, rng) {
    const base = { ref: x.ref, surah: x.surah, surah_name: x.surah_name, tokens: x.tokens, kind: r.kind, word: wordsAt(x, r.words) };
    if (r.kind === "qalqalah") {
      const q = new Set((x.tajweed && x.tajweed.qalqalah) || []);
      const others = shuffle(x.words.map((w, i) => ({ w, i: i + 1 })).filter((o) => !q.has(o.i) && !/[قطبجد]ْ/.test(o.w) && letters(o.w) >= 3 && o.w !== base.word), rng).slice(0, 2);
      if (others.length < 2) return null;
      return { ...base, words: [], answer: base.word, choices: shuffle([base.word, ...others.map((o) => o.w)], rng), skill: "qalqalah", d: SK.SKILLS.qalqalah.level };
    }
    const skill = SK.skillOf(r);
    if (!SK.CHOICES[r.kind] || !SK.SKILLS[skill]) return null;
    return { ...base, words: r.words, answer: skill, choices: SK.CHOICES[r.kind], skill, d: SK.SKILLS[skill].level };
  }

  // Everything the assessment can use for this reader; the page then picks item by item (nextPassage / nextRule).
  function assessmentPool(content, p, rng = Math.random) {
    const bank = content.bank || [];
    const known = new Set(knownSurahs(p, bank));
    const assess = bank.filter((x) => x.use === "assess");
    const fallback = !assess.length;
    const passages = fallback ? (content.fatiha_ayat || []).filter((x) => x.ref !== "1:1") : assess;
    // Recitation measures reading, so surahs the reader memorized go last.
    const ordered = [...shuffle(passages.filter((x) => !known.has(x.surah_name)), rng), ...shuffle(passages.filter((x) => known.has(x.surah_name)), rng)];
    const questions = [];
    for (const x of passages) for (const r of x.rules || []) { const q = question(x, r, rng); if (q) questions.push(q); }
    const short = bank.filter((x) => x.use === "warmup" && x.surah !== 1 && known.has(x.surah_name) && x.words.length >= 3);
    const beyond = p.who === "adult"
      ? (["upto5", "more"].includes(p.juz) ? assess : p.juz === "amma" ? assess.filter((x) => x.surah >= 78) : [])
      : p.memorized_more ? assess.filter((x) => x.surah >= 78) : [];
    return { passages: ordered, questions: shuffle(questions, rng), hifz: { short: shuffle(short, rng), beyond: shuffle(beyond.filter((x) => x.words.length >= 4), rng) }, fallback, start: START_LEVEL };
  }

  // Up to three places in the passage where the listener can hear whether a rule was applied, of different skills.
  function applySpots(x) {
    const out = [], seen = new Set();
    for (const r of x.rules || []) {
      const skill = SK.skillOf(r);
      if (!SK.APPLY.has(skill) || seen.has(skill) || out.length >= 3) continue;
      seen.add(skill);
      out.push({ skill, words: r.words, word: wordsAt(x, r.words) });
    }
    return out;
  }
  // The passage nearest to the level, from a surah not used yet (the reading check asks for level 1).
  function nextPassage(pool, level, usedSurahs) {
    // (An ayah is never shown twice; with only Al-Fatiha to fall back on, the surah repeats.)
    pool.shown = pool.shown || new Set();
    const unseen = pool.passages.filter((x) => !pool.shown.has(x.ref));
    const free = unseen.filter((x) => !usedSurahs.has(x.surah));
    const list = free.length ? free : unseen;
    if (!list.length) return null;
    const best = Math.min(...list.map((x) => Math.abs((x.difficulty || 2) - level)));
    const x = list.find((y) => Math.abs((y.difficulty || 2) - level) === best);
    pool.shown.add(x.ref);
    return { ref: x.ref, surah: x.surah, surah_name: x.surah_name, text: x.text, tokens: x.tokens, d: x.difficulty || 2, apply: applySpots(x) };
  }
  // The next Tajweed question for slot i: the kind of the slot, the difficulty nearest to the level, a new ayah and a
  // new rule when possible.
  function nextRule(pool, i, level, used) {
    const kinds = SLOTS[i % SLOTS.length];
    let list = pool.questions.filter((q) => kinds.includes(q.kind) && !used.items.has(q));
    if (!list.length) list = pool.questions.filter((q) => !used.items.has(q));
    if (!list.length) return null;
    const fresh = list.filter((q) => !used.refs.has(q.ref));
    if (fresh.length) list = fresh;
    const newRule = list.filter((q) => !used.skills.has(q.skill));
    if (newRule.length) list = newRule;
    const best = Math.min(...list.map((q) => Math.abs(q.d - level)));
    return list.find((q) => Math.abs(q.d - level) === best);
  }
  // Memorization: one place beyond the short surahs when the reader says they memorize more, and one short surah.
  function pickHifz(pool, usedSurahs) {
    const one = (l) => l.find((x) => !usedSurahs.has(x.surah));
    const item = (x, beyond) => x && { ref: x.ref, surah: x.surah, surah_name: x.surah_name, opening: x.words.slice(0, 2).join(" "), text: x.text, beyond };
    return [item(one(pool.hifz.beyond), true), item(one(pool.hifz.short), false)].filter(Boolean);
  }

  // The whole run with fixed answers (for the tests): answer(part, item) returns "right" / "wrong" / "partial" / "unsure".
  // The page runs the same steps one screen at a time.
  function simulate(pool, answer) {
    pool.shown = new Set(); // a fresh run
    const usedSurahs = new Set(), out = { recite: [], rules: [] };
    let level = pool.start;
    for (let i = 0; i < RECITE_COUNT; i++) {
      const x = nextPassage(pool, level, usedSurahs);
      if (!x) break;
      usedSurahs.add(x.surah);
      const res = answer("recite", x);
      out.recite.push({ ref: x.ref, d: x.d, level, result: res });
      level = step(level, res);
    }
    level = pool.start;
    const used = { items: new Set(), refs: new Set(), skills: new Set() };
    for (let i = 0; i < SLOTS.length; i++) {
      const q = nextRule(pool, i, level, used);
      if (!q) break;
      used.items.add(q); used.refs.add(q.ref); used.skills.add(q.skill);
      const res = answer("rules", q);
      out.rules.push({ ref: q.ref, kind: q.kind, skill: q.skill, d: q.d, level, result: res, choices: q.choices, answer: q.answer });
      level = step(level, res);
    }
    return out;
  }

  const api = { startFor, isAdvanced, pickContent, memorizedCount, isReader, isArabicReader, assessmentPool, nextPassage, nextRule, pickHifz, simulate, step, SLOTS, RECITE_COUNT, START_LEVEL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuranaAdaptive = api;
})(typeof window !== "undefined" ? window : globalThis);
