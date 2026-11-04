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

  // ---------- the result in words: the level and its reason, and «ما رصده الاختبار» ----------
  // Fixed rules on the saved result (no model), for the result page and for the model's facts.
  const andList = (l, en) => (l.length <= 1 ? l.join("") : en ? `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}` : l.join(" و"));
  const GAMES = {
    sound: { ar: "أصوات الحروف", en: "letter sounds" }, shape: { ar: "أشكال الحروف داخل الكلمة", en: "letter shapes inside a word" },
    fatha: { ar: "قراءة كلمات بالفتح", en: "reading words with fatha" }, harakat: { ar: "القراءة بالحركات الثلاث", en: "reading with all three vowels" },
    fatiha: { ar: "قراءة كلمات من المصحف", en: "reading words from the Mushaf" }, ayah: { ar: "قراءة آية كاملة", en: "reading a whole ayah" },
    find: { ar: "إيجاد الكلمة داخل الآية", en: "finding a word inside an ayah" }, madd: { ar: "تمييز الكلمة التي فيها مدّ", en: "spotting the word with madd" },
  };
  const LEVEL_GAMES = ["sound", "shape", "fatha", "harakat", "fatiha", "ayah", "find", "madd"];

  // «مستوى طفلكم: القراءة من المصحف — لأن قراءة الآيات صحيحة، لكن أحكام التجويد ما زالت تحتاج إلى تثبيت.»
  // (No pronoun for a child: the name the parent gives says nothing about whether it is a boy or a girl.)
  function levelReason(record, levelName, lang = "ar") {
    const en = lang === "en";
    const p = record.profile || {}, st = record.stages || {};
    const ok = (k) => Boolean(st[k] && st[k].passed);
    let why;
    if (p.who === "adult") {
      const tj = ["rules", "reasons"].filter((k) => st[k]);
      const tjPassed = tj.length && tj.reduce((n, k) => n + st[k].score, 0) >= Math.ceil(tj.reduce((n, k) => n + st[k].total, 0) * 0.6);
      why = p.adult_level === "A1" ? (en ? "because you stumble when you read, so we first make the vowels and madd steady" : "لأنك تتعثّر في القراءة، فنبدأ بتثبيت الحركات والمدّ")
        : p.adult_level === "A3" ? (tj.length ? (en ? "because you read fluently and answered most of the Tajweed questions and their reasons" : "لأنك تقرأ بطلاقة وأجبت عن أغلب أسئلة التجويد وأسبابها") : (en ? "because you read fluently" : "لأنك تقرأ بطلاقة"))
        : p.self === "fluent" && tj.length && !tjPassed ? (en ? "because you read fluently, but the Tajweed rules still need to be made steady" : "لأنك تقرأ بطلاقة، لكن أحكام التجويد ما زالت تحتاج إلى تثبيت")
        : (en ? "because you read slowly, so we build fluency in reading the Mushaf" : "لأنك تقرأ ببطء، فنبني الطلاقة في القراءة من المصحف");
      return en ? `Your level: ${levelName} — ${why}.` : `مستواك: ${levelName} — ${why}.`;
    }
    // (The saved record has the level code; the result page gets it as { code, name, … }.)
    const lvl = record.level && typeof record.level === "object" ? record.level.code : record.level;
    if (st.recite) {
      why = lvl === "R6" ? (en ? "because they read the ayat correctly and answered most of the Tajweed questions" : "لأن قراءة الآيات جاءت صحيحة، والإجابات صحيحة في أغلب أسئلة أحكام التجويد")
        : lvl === "R5" ? (en ? "because they read the ayat correctly, but the Tajweed rules still need to be made steady" : "لأن قراءة الآيات صحيحة، لكن أحكام التجويد ما زالت تحتاج إلى تثبيت")
        : (en ? "because the longer ayat still have mistakes, so we make the vowels and madd steady before the Tajweed rules" : "لأن الآيات الأطول ما زالت فيها أخطاء، فنثبّت الحركات والمدّ قبل أحكام التجويد");
    } else if (st.check && !st.check.passed && lvl === "R5" && ok("ayah")) {
      why = en ? "because the short ayah at the start had many mistakes, although the reading games went well" : "لأن الآية القصيرة في البداية قُرئت بأخطاء كثيرة، مع النجاح في ألعاب القراءة";
    } else {
      why = {
        R1: en ? "because the letter sounds still need to be learned" : "لأن أصوات الحروف ما زالت تحتاج إلى تعلّم",
        R2: en ? "because they know the letter sounds, but the shapes inside a word still need work" : "لأن أصوات الحروف معروفة، لكن أشكالها داخل الكلمة ما زالت تحتاج إلى عمل",
        R3: en ? "because they know the letters, but reading words with fatha still needs work" : "لأن الحروف معروفة، لكن قراءة الكلمات بالفتح ما زالت تحتاج إلى عمل",
        R4: en ? "because they read with fatha, but kasra and damma still need work" : "لأن القراءة بالفتح صحيحة، لكن الكسر والضم ما زالا يحتاجان إلى عمل",
        R5: en ? "because they read words with vowels, but words and ayat from the Mushaf still need to be made steady" : "لأن قراءة الكلمات بالحركات صحيحة، لكن قراءة كلمات المصحف وآياته ما زالت تحتاج إلى تثبيت",
        R6: en ? "because they read words and a whole ayah from the Mushaf correctly" : "لأن قراءة كلمات وآية كاملة من المصحف جاءت صحيحة",
      }[lvl];
    }
    const who = p.nickname ? p.nickname : en ? "your child" : "طفلكم";
    return en ? `${who === "your child" ? "Your child's" : `${who}'s`} level: ${levelName} — ${why}.` : `مستوى ${who}: ${levelName} — ${why}.`;
  }

  // Two sentences from the answers: what was right, and what was wrong (with the rule chosen instead, when known).
  // From the Tajweed questions («ما الحكم؟», and «ولماذا؟» for an adult); from the games for a child who played them.
  function findings(stages, lang = "ar", adult = false) {
    const en = lang === "en";
    const st = stages || {};
    const lab = (id) => label(id, lang);
    if (st.rules && (st.rules.items || []).length) {
      const items = st.rules.items;
      const right = [...new Set(items.filter((x) => x.result === "right").map((x) => x.skill))];
      const wrong = items.filter((x) => x.result === "wrong" && !right.includes(x.skill));
      const mixed = [...new Map(wrong.filter((x) => x.picked && x.picked !== x.skill && SKILLS[x.picked]).map((x) => [`${x.skill}|${x.picked}`, [x.skill, x.picked]])).values()];
      const plain = [...new Set(wrong.filter((x) => !mixed.some(([s]) => s === x.skill)).map((x) => x.skill))];
      const whyWrong = adult ? [...new Set(((st.reasons || {}).items || []).filter((x) => x.result === "wrong").map((x) => x.skill))] : [];
      const s1 = right.length
        ? (en ? `${adult ? "You got right" : "Got right"}: ${andList(right.slice(0, 4).map(lab), true)}.` : `${adult ? "أتقنتَ" : "أتقن"} ${andList(right.slice(0, 4).map(lab))}.`)
        : (en ? `${adult ? "You did not" : "Did not"} get any of the rules asked right yet.` : adult ? "لم تُصب بعد في أيّ حكم سُئلت عنه." : "لم يُصب بعد في أيّ حكم سُئل عنه.");
      const parts = [
        ...mixed.slice(0, 2).map(([a, b]) => (en ? `${adult ? "you mixed up" : "mixed up"} ${lab(a)} and ${lab(b)}` : `${adult ? "خلطتَ" : "خلط"} بين ${lab(a)} و${lab(b)}`)),
        ...(plain.length ? [en ? `${adult ? "you missed" : "missed"} ${andList(plain.slice(0, 3).map(lab), true)}` : `${adult ? "أخطأتَ" : "أخطأ"} في ${andList(plain.slice(0, 3).map(lab))}`] : []),
        ...(whyWrong.length ? [en ? `you do not yet know the reason for ${andList(whyWrong.slice(0, 2).map(lab), true)}` : `لا تعرف بعد سبب ${andList(whyWrong.slice(0, 2).map(lab))}`] : []),
      ];
      const s2 = parts.length
        ? (en ? `${right.length ? "But " : ""}${parts.join("; ")}.`.replace(/^But y/, "But y").replace(/^([a-z])/, (c) => c.toUpperCase())
          : `${right.length ? (adult ? "لكنك " : "لكنه ") : ""}${parts.join("، و")}.`)
        : (en ? `${adult ? "You made" : "Made"} no mistake in the rules asked.` : adult ? "ولم تخطئ في أيّ حكم سُئلت عنه." : "ولم يخطئ في أيّ حكم سُئل عنه.");
      return [s1, s2];
    }
    const played = LEVEL_GAMES.filter((k) => st[k] && !st[k].inferred);
    if (!played.length) return null;
    const g = (k) => GAMES[k][en ? "en" : "ar"];
    const passed = played.filter((k) => st[k].passed).map(g), failed = played.filter((k) => !st[k].passed).map(g);
    return [
      passed.length ? (en ? `Did well in: ${andList(passed, true)}.` : `نجح في: ${andList(passed)}.`) : (en ? "The first game still needs work." : "اللعبة الأولى ما زالت تحتاج إلى عمل."),
      failed.length ? (en ? `Still needs work in: ${andList(failed, true)}.` : `ويحتاج إلى عمل في: ${andList(failed)}.`) : (en ? "And did well in every game played." : "ونجح في كل لعبة لعبها."),
    ];
  }

  const api = { GAMES, levelReason, findings, reasonQuestion, noonCategory, lamCategory, SKILLS, CHOICES, APPLY, ITEM_RESULTS, skillOf, label, report, lines };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuranaSkills = api;
})(typeof window !== "undefined" ? window : globalThis);
