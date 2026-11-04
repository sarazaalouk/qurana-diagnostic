// The skills a reader's assessment measures, their names (Arabic / English), how hard each one is, and the per-skill
// report built from the answered items. Fixed rules, no model. Works in the browser (window.QuranaSkills) and in Node
// (lib/validate.js, lib/plan.js, tests).
//
// An item in a stage: { skill, ref, word?, d?, result } — result is "right", "wrong", "unsure", "partial" (recitation
// with a few mistakes) or "not_memorized" (memorization: the reader said they do not know that surah).
(function (root) {
  // A skill id is the rule, or kind_rule for ra and the name of Allah (whose rules share the names tafkhim / tarqiq).
  const SKILLS = {
    izhar: { ar: "الإظهار الحلقي", en: "Izhar (clear noon)", level: 2 },
    idgham_ghunnah: { ar: "الإدغام بغنة", en: "Idgham with ghunnah", level: 2 },
    idgham_no_ghunnah: { ar: "الإدغام بلا غنة", en: "Idgham without ghunnah", level: 3 },
    iqlab: { ar: "الإقلاب", en: "Iqlab", level: 3 },
    ikhfa: { ar: "الإخفاء", en: "Ikhfa (hiding the noon)", level: 3 },
    izhar_shafawi: { ar: "الإظهار الشفوي", en: "Izhar shafawi", level: 2 },
    idgham_shafawi: { ar: "الإدغام الشفوي", en: "Idgham shafawi", level: 3 },
    ikhfa_shafawi: { ar: "الإخفاء الشفوي", en: "Ikhfa shafawi", level: 3 },
    shamsiyah: { ar: "اللام الشمسية", en: "Sun lam (shamsiyah)", level: 1 },
    qamariyah: { ar: "اللام القمرية", en: "Moon lam (qamariyah)", level: 1 },
    madd_tabii: { ar: "المدّ الطبيعي", en: "Natural madd", level: 1 },
    madd_muttasil: { ar: "المدّ المتصل", en: "Connected madd (muttasil)", level: 2 },
    madd_munfasil: { ar: "المدّ المنفصل", en: "Separated madd (munfasil)", level: 2 },
    madd_lazim: { ar: "المدّ اللازم", en: "Necessary madd (lazim)", level: 3 },
    qalqalah: { ar: "القلقلة", en: "Qalqalah", level: 1 },
    ra_tafkhim: { ar: "تفخيم الراء", en: "Heavy ra", level: 1 },
    ra_tarqiq: { ar: "ترقيق الراء", en: "Light ra", level: 2 },
    allah_tafkhim: { ar: "تفخيم لام لفظ الجلالة", en: "Heavy lam in the name of Allah", level: 2 },
    allah_tarqiq: { ar: "ترقيق لام لفظ الجلالة", en: "Light lam in the name of Allah", level: 2 },
    hamzat_wasl: { ar: "همزة الوصل", en: "Hamzat al-wasl", level: 1 },
    hamzat_qat: { ar: "همزة القطع", en: "Hamzat al-qat'", level: 1 },
    // Not Tajweed rules: reading whole ayat, and memorization.
    recite_1: { ar: "تلاوة آية قصيرة", en: "Reciting a short ayah", level: 1 },
    recite_2: { ar: "تلاوة آية متوسطة", en: "Reciting a medium ayah", level: 2 },
    recite_3: { ar: "تلاوة آية طويلة كثيرة الأحكام", en: "Reciting a long ayah with many rules", level: 3 },
    hifz: { ar: "الحفظ", en: "Memorization", level: 2 },
  };
  const skillOf = (r) => (r.kind === "ra" || r.kind === "allah" ? `${r.kind}_${r.rule}` : r.rule);
  const label = (id, lang) => (SKILLS[id] ? SKILLS[id][lang === "en" ? "en" : "ar"] : id);

  // The questions: one marked place, and the choices for its kind. Qalqalah asks which word has it.
  const CHOICES = {
    noon: ["izhar", "idgham_ghunnah", "idgham_no_ghunnah", "iqlab", "ikhfa"],
    meem: ["izhar_shafawi", "idgham_shafawi", "ikhfa_shafawi"],
    lam: ["shamsiyah", "qamariyah"],
    madd: ["madd_tabii", "madd_muttasil", "madd_munfasil", "madd_lazim"],
    ra: ["ra_tafkhim", "ra_tarqiq"],
    allah: ["allah_tafkhim", "allah_tarqiq"],
    wasl: ["hamzat_wasl", "hamzat_qat"],
  };
  // The rules a listener can hear while the reader recites (application): ghunnah and hiding, madd lengths, qalqalah.
  const APPLY = new Set(["idgham_ghunnah", "iqlab", "ikhfa", "ikhfa_shafawi", "idgham_shafawi", "madd_muttasil", "madd_munfasil", "madd_lazim", "qalqalah", "ra_tarqiq"]);
  const ITEM_RESULTS = ["right", "wrong", "unsure", "partial", "not_memorized"];

  // The report: for each skill, how many places were right, and the words. Mastered: every answered place right;
  // needs work: at least one wrong. Recognition (rules) and application (apply) are kept apart, as are recitation and
  // memorization.
  const PARTS = ["rules", "reasons", "apply"];
  function report(stages, lang = "ar") {
    const by = {};
    for (const part of PARTS) {
      for (const it of ((stages || {})[part] || {}).items || []) {
        if (!SKILLS[it.skill] || it.result === "unsure") continue;
        const k = `${part}:${it.skill}`;
        const b = (by[k] = by[k] || { part, skill: it.skill, label: label(it.skill, lang), right: 0, total: 0, right_words: [], wrong_words: [] });
        b.total++;
        if (it.result === "right") { b.right++; if (it.word) b.right_words.push(it.word); }
        else if (it.word) b.wrong_words.push(it.word);
      }
    }
    const all = Object.values(by);
    const mastered = all.filter((b) => b.right === b.total);
    const needs = all.filter((b) => b.right < b.total);
    const unsure = [];
    for (const part of PARTS) for (const it of ((stages || {})[part] || {}).items || []) if (it.result === "unsure" && SKILLS[it.skill]) unsure.push({ part, skill: it.skill, label: label(it.skill, lang), word: it.word });
    // Recitation: the hardest passage read without mistakes, and the passages with mistakes.
    const passages = [...(((stages || {}).check || {}).items || []), ...(((stages || {}).recite || {}).items || [])];
    const clean = passages.filter((x) => x.result === "right").map((x) => x.d || 1);
    const recite = { top: clean.length ? Math.max(...clean) : 0, passages: passages.map((x) => ({ ref: x.ref, d: x.d || 1, result: x.result })) };
    const hifz = ((((stages || {}).hifz || {}).items) || []).map((x) => ({ ref: x.ref, result: x.result }));
    return { mastered, needs, unsure, recite, hifz };
  }

  // One line per finding, for the result page and the model's facts: «يضبط المدّ الطبيعي (يَوْمَ)، لكن لا يطبّق الإخفاء (عَنكَ)».
  function lines(rep, lang = "ar", adult = false) {
    const en = lang === "en";
    const words = (l) => (l.length ? ` (${l.slice(0, 2).join(en ? ", " : "، ")})` : "");
    const say = {
      rules_ok: en ? (adult ? "You recognize" : "Recognizes") : adult ? "تميّز" : "يميّز",
      rules_no: en ? (adult ? "You confuse" : "Confuses") : adult ? "تخلط في" : "يخلط في",
      apply_ok: en ? (adult ? "You apply" : "Applies") : adult ? "تطبّق" : "يطبّق",
      apply_no: en ? (adult ? "You do not yet apply" : "Does not yet apply") : adult ? "لا تطبّق بعد" : "لا يطبّق بعد",
      reasons_ok: en ? (adult ? "You know the reason for" : "Knows the reason for") : adult ? "تعرف سبب" : "يعرف سبب",
      reasons_no: en ? (adult ? "You do not yet know the reason for" : "Does not yet know the reason for") : adult ? "لا تعرف بعد سبب" : "لا يعرف بعد سبب",
    };
    const out = { mastered: [], needs: [] };
    for (const b of rep.mastered) out.mastered.push(`${say[`${b.part}_ok`]} ${b.label}${words(b.right_words)}`);
    for (const b of rep.needs) out.needs.push(`${say[`${b.part}_no`]} ${b.label}${words(b.wrong_words)}`);
    return out;
  }

  // ---------- «ولماذا؟»: the reason of a rule (the adult's Tajweed test) ----------
  // Fixed texts. Where the reason is a letter (noon / tanween, lam, qalqalah), the deciding letter is read from the
  // ayah's marks (public/js/adaptive.js) and shown in every choice, so the question is about what the letter is, not
  // which letter it is. A place whose letter does not match its rule is not asked.
  const THROAT = "ءأإؤئهعحغخ";
  const SUN = "تثدذرزسشصضطظلن";
  const noonCategory = (L) => (THROAT.includes(L) ? "izhar" : "ينمو".includes(L) ? "idgham_ghunnah" : "لر".includes(L) ? "idgham_no_ghunnah" : L === "ب" ? "iqlab" : "ikhfa");
  const lamCategory = (L) => (SUN.includes(L) ? "shamsiyah" : "qamariyah");
  const R = {
    ar: {
      noon: (L, c) => `لأن الحرف الذي بعدها «${L}» ${{ izhar: "من حروف الحلق", idgham_ghunnah: "من حروف «ينمو»", idgham_no_ghunnah: "لام أو راء", iqlab: "باء", ikhfa: "من حروف الإخفاء" }[c]}`,
      lam: (L, c) => `لأن الحرف الذي بعدها «${L}» ${c === "shamsiyah" ? "حرف شمسي، فتُدغم فيه اللام" : "حرف قمري، فتظهر معه اللام"}`,
      madd: { madd_tabii: "لأن حرف المدّ لم يأتِ بعده همزة ولا سكون", madd_muttasil: "لأن بعد حرف المدّ همزة في الكلمة نفسها", madd_munfasil: "لأن حرف المدّ في آخر الكلمة والهمزة في أول الكلمة التالية", madd_lazim: "لأن بعد حرف المدّ سكونًا أصليًا أو شدّة" },
      qalqalah: (L) => [`لأن «${L}» من حروف «قطب جد» وعليها سكون`, `لأن «${L}» من حروف «قطب جد» وهي متحركة`, `لأن «${L}» حرف مشدّد`, `لأن «${L}» من حروف الحلق وعليها سكون`],
      ra: { ra_tafkhim: "لأن الراء مفتوحة أو مضمومة", ra_tarqiq: "لأن الراء مكسورة", other: "لأن الراء ساكنة وقبلها كسر" },
      allah: { allah_tafkhim: "لأن قبل لفظ الجلالة فتحًا أو ضمًّا", allah_tarqiq: "لأن قبل لفظ الجلالة كسرًا", other: "لأن لفظ الجلالة في أول الكلام" },
      wasl: { hamzat_wasl: "لأنها تُنطق عند البدء بالكلمة وتسقط عند وصلها بما قبلها", hamzat_qat: "لأنها تُنطق في البدء وفي الوصل", other: "لأنها تسقط في البدء وتُنطق في الوصل" },
    },
    en: {
      noon: (L, c) => `Because the letter after it, «${L}», is ${{ izhar: "a throat letter", idgham_ghunnah: "one of «ينمو»", idgham_no_ghunnah: "lam or ra", iqlab: "ba", ikhfa: "one of the ikhfa letters" }[c]}`,
      lam: (L, c) => `Because the letter after it, «${L}», is ${c === "shamsiyah" ? "a sun letter, so the lam merges into it" : "a moon letter, so the lam is pronounced"}`,
      madd: { madd_tabii: "Because no hamza and no sukun come after the madd letter", madd_muttasil: "Because a hamza comes after the madd letter in the same word", madd_munfasil: "Because the madd letter ends the word and the next word starts with a hamza", madd_lazim: "Because a fixed sukun or a shaddah comes after the madd letter" },
      qalqalah: (L) => [`Because «${L}» is one of «قطب جد» and has a sukun`, `Because «${L}» is one of «قطب جد» and has a vowel`, `Because «${L}» has a shaddah`, `Because «${L}» is a throat letter with a sukun`],
      ra: { ra_tafkhim: "Because the ra has a fatha or a damma", ra_tarqiq: "Because the ra has a kasra", other: "Because the ra has a sukun after a kasra" },
      allah: { allah_tafkhim: "Because a fatha or a damma comes before the name of Allah", allah_tarqiq: "Because a kasra comes before the name of Allah", other: "Because the name of Allah starts the sentence" },
      wasl: { hamzat_wasl: "Because it is said when starting with the word and dropped when joining it to what comes before", hamzat_qat: "Because it is said both when starting and when joining", other: "Because it is dropped when starting and said when joining" },
    },
  };
  // { answer, choices } (texts) for a question { kind, skill, letter }, or null when there is no fair reason question.
  function reasonQuestion(q, lang = "ar") {
    const T = R[lang === "en" ? "en" : "ar"];
    const L = q.letter;
    if (q.kind === "noon") {
      if (!L || noonCategory(L) !== q.skill) return null;
      const cats = [...new Set([q.skill, "izhar", "idgham_ghunnah", "ikhfa"])];
      return { answer: T.noon(L, q.skill), choices: cats.map((c) => T.noon(L, c)) };
    }
    if (q.kind === "lam") {
      if (!L || lamCategory(L) !== q.skill) return null;
      return { answer: T.lam(L, q.skill), choices: ["shamsiyah", "qamariyah"].map((c) => T.lam(L, c)) };
    }
    if (q.kind === "qalqalah") {
      if (!L || !"قطبجد".includes(L)) return null;
      const c = T.qalqalah(L);
      return { answer: c[0], choices: c };
    }
    if (q.kind === "madd") return { answer: T.madd[q.skill], choices: Object.values(T.madd) };
    for (const k of ["ra", "allah", "wasl"]) if (q.kind === k) return { answer: T[k][q.skill], choices: Object.values(T[k]) };
    return null; // meem: the reason is the next letter itself (meem / ba / another) — not a question
  }

  const api = { reasonQuestion, noonCategory, lamCategory, SKILLS, CHOICES, APPLY, ITEM_RESULTS, skillOf, label, report, lines };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuranaSkills = api;
})(typeof window !== "undefined" ? window : globalThis);
