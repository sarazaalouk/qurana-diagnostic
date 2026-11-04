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
  function report(stages, lang = "ar") {
    const by = {};
    for (const part of ["rules", "apply"]) {
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
    for (const part of ["rules", "apply"]) for (const it of ((stages || {})[part] || {}).items || []) if (it.result === "unsure" && SKILLS[it.skill]) unsure.push({ part, skill: it.skill, label: label(it.skill, lang), word: it.word });
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
    };
    const out = { mastered: [], needs: [] };
    for (const b of rep.mastered) out.mastered.push(`${say[`${b.part}_ok`]} ${b.label}${words(b.right_words)}`);
    for (const b of rep.needs) out.needs.push(`${say[`${b.part}_no`]} ${b.label}${words(b.wrong_words)}`);
    return out;
  }

  const api = { SKILLS, CHOICES, APPLY, ITEM_RESULTS, skillOf, label, report, lines };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuranaSkills = api;
})(typeof window !== "undefined" ? window : globalThis);
