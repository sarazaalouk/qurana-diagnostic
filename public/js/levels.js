// Qurana diagnostic: the stage order, where to start, and the level from the stages.
// Fixed rules, no model. Works in the browser (globals) and in Node (tests).
(function (root) {
  // The games, easiest first. Each opens only if the one below it was passed (or counted as passed).
  const STAGES = ["sound", "shape", "fatha", "harakat", "fatiha", "ayah"];

  // Harder games for a child who reads words from Al-Fatiha: find a word inside an ayah, and which word has madd.
  // They do not change the level; they tell the teacher more, and their response signals are recorded like the others.
  const READER_STAGES = ["find", "madd"];
  const ALL_STAGES = [...STAGES, ...READER_STAGES];

  // Pass marks (out of the number of items in each stage).
  const PASS = { sound: 4, shape: 3, fatha: 2, harakat: 3, fatiha: 2, ayah: 1, find: 3, madd: 3 };

  // The parent's estimate of the child's reading, and the stage to start from.
  const ESTIMATES = [
    { id: "none", label: "لا يعرف الحروف بعد", label_en: "Does not know the letters yet", start: "sound" },
    { id: "some_letters", label: "يعرف بعض الحروف", label_en: "Knows some letters", start: "sound" },
    { id: "letters", label: "يعرف الحروف", label_en: "Knows the letters", start: "shape" },
    { id: "words", label: "يقرأ كلمات بالحركات", label_en: "Reads words with short vowels", start: "fatha" },
    { id: "mushaf", label: "يقرأ من المصحف", label_en: "Reads from the Mushaf", start: "fatiha" },
  ];

  function startStage(estimateId) {
    const e = ESTIMATES.find((x) => x.id === estimateId);
    return e ? e.start : "sound";
  }

  // Plays the stages from the starting point. play(key) resolves with { passed, ... }.
  // Failing the start goes down one stage at a time until one is passed or stage 1 is reached;
  // passing goes up, each stage opening only if the one before was passed.
  // Stages below the lowest passed one are counted as passed: { passed: true, inferred: true }.
  async function runStages(start, play) {
    const stages = {};
    const shown = [];
    const startAt = Math.max(0, STAGES.indexOf(start));
    let at = startAt;
    for (;;) {
      const key = STAGES[at];
      stages[key] = await play(key);
      shown.push(key);
      if (stages[key].passed || at === 0) break;
      at--;
    }
    if (stages[STAGES[at]].passed) {
      for (let k = 0; k < at; k++) stages[STAGES[k]] = { passed: true, inferred: true };
      if (at === startAt) {
        for (let j = startAt + 1; j < STAGES.length && stages[STAGES[j - 1]].passed; j++) {
          stages[STAGES[j]] = await play(STAGES[j]);
          shown.push(STAGES[j]);
        }
      }
    }
    return { stages, shown };
  }

  // Provisional levels until the teachers' curriculum maps them.
  const LEVELS = {
    R1: { name: "تأسيس الحروف", focus: "التعرّف على أصوات الحروف العربية وأشكالها.", name_en: "Letter foundations", focus_en: "Learning the sounds and shapes of the Arabic letters." },
    R2: { name: "أشكال الحروف", focus: "تمييز شكل الحرف حين يتصل بغيره داخل الكلمة.", name_en: "Letter shapes", focus_en: "Recognizing a letter when it joins others inside a word." },
    R3: { name: "القراءة بالفتح", focus: "قراءة كلمات قصيرة بحركة الفتح.", name_en: "Reading with fatha", focus_en: "Reading short words with the fatha vowel." },
    R4: { name: "الحركات الثلاث", focus: "القراءة بالفتح والكسر والضم.", name_en: "All three short vowels", focus_en: "Reading with fatha, kasra and damma." },
    R5: { name: "القراءة من المصحف", focus: "قراءة كلمات وآيات من المصحف قراءة صحيحة.", name_en: "Reading from the Mushaf", focus_en: "Reading words and ayahs from the Mushaf correctly." },
    R6: { name: "التلاوة والتجويد", focus: "تحسين التلاوة وتطبيق أحكام التجويد والحفظ.", name_en: "Recitation and Tajweed", focus_en: "Improving recitation, applying Tajweed rules, and memorization." },
  };

  function levelFrom(stages) {
    const ok = (k) => Boolean(stages[k] && stages[k].passed);
    if (!ok("sound")) return "R1";
    if (!ok("shape")) return "R2";
    if (!ok("fatha")) return "R3";
    if (!ok("harakat")) return "R4";
    if (!ok("fatiha") || !ok("ayah")) return "R5";
    return "R6";
  }

  // Adult levels (from the self-assessment and the ayah read aloud; see adultLevel in options.js).
  const ADULT_LEVELS = {
    A1: { name: "تقوية القراءة", focus: "إتقان الحركات والمد والسكون والشدة، ثم القراءة من المصحف بثقة.", name_en: "Strengthening reading", focus_en: "Mastering the vowels, madd, sukun and shaddah, then reading the Mushaf with confidence." },
    A2: { name: "القراءة من المصحف", focus: "قراءة المصحف قراءة صحيحة بثقة.", name_en: "Reading from the Mushaf", focus_en: "Reading the Mushaf correctly and with confidence." },
    A3: { name: "التلاوة والحفظ", focus: "تحسين التلاوة وتطبيق التجويد والحفظ.", name_en: "Recitation and memorization", focus_en: "Improving recitation, applying Tajweed, and memorizing." },
  };

  const api = { STAGES, READER_STAGES, ALL_STAGES, PASS, ESTIMATES, LEVELS, ADULT_LEVELS, startStage, runStages, levelFrom };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuranaLevels = api;
})(typeof window !== "undefined" ? window : globalThis);
