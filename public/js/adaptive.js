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
    const topUp = (items, defaults, n) => [...items, ...defaults].slice(0, n);
    const c = JSON.parse(JSON.stringify(content));

    // Reading words from the Quran: one word from each of four short ayat (other surahs than Al-Fatiha).
    const wordItems = choose(tier(2).length ? tier(2) : main, 4, known, rng).map((x) => {
      const ok = x.words.filter((w) => letters(w) >= 3 && !/ٱللَّه|لِلَّه/.test(w));
      const w = ok.length ? ok[Math.floor(rng() * ok.length)] : x.words[0];
      return { ref: x.ref, surah_name: x.surah_name, text: w };
    });
    c.fatiha.items = topUp(wordItems, content.fatiha.items, 4);

    // A whole ayah: from a medium surah for an advanced reader, a short ayah otherwise.
    const ayahPick = choose(main, 1, known, rng)[0];
    if (ayahPick) c.ayah.items = [{ ref: ayahPick.ref, surah_name: ayahPick.surah_name, text: ayahPick.text }];

    // Find the word inside the ayah.
    const findItems = choose(main.length ? main : bank, 4, known, rng).map((x) => {
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

  const api = { startFor, isAdvanced, pickContent, memorizedCount };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuranaAdaptive = api;
})(typeof window !== "undefined" ? window : globalThis);
