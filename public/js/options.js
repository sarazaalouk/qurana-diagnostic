// Answer options for the parent's questions (Arabic and English), and the suggestion on the result page.
// Shared by the page and the server (the server accepts only these values). No model.
(function (root) {
  const AGE_BANDS = ["4–5", "6–7", "8–9", "10–12", "13+"];

  // Countries shown first; anything else can be chosen as "other".
  const COUNTRIES = [
    { code: "KW", name: "الكويت", name_en: "Kuwait" }, { code: "SA", name: "السعودية", name_en: "Saudi Arabia" },
    { code: "AE", name: "الإمارات", name_en: "UAE" }, { code: "QA", name: "قطر", name_en: "Qatar" },
    { code: "BH", name: "البحرين", name_en: "Bahrain" }, { code: "OM", name: "عُمان", name_en: "Oman" },
    { code: "US", name: "الولايات المتحدة", name_en: "United States" }, { code: "GB", name: "المملكة المتحدة", name_en: "United Kingdom" },
    { code: "CA", name: "كندا", name_en: "Canada" }, { code: "DE", name: "ألمانيا", name_en: "Germany" },
    { code: "ES", name: "إسبانيا", name_en: "Spain" }, { code: "FR", name: "فرنسا", name_en: "France" },
    { code: "NL", name: "هولندا", name_en: "Netherlands" }, { code: "SE", name: "السويد", name_en: "Sweden" },
    { code: "AU", name: "أستراليا", name_en: "Australia" }, { code: "OTHER", name: "دولة أخرى", name_en: "Another country" },
  ];

  // Time zone → country, to pre-select the country.
  const ZONES = {
    "Asia/Kuwait": "KW", "Asia/Riyadh": "SA", "Asia/Dubai": "AE", "Asia/Qatar": "QA", "Asia/Bahrain": "BH",
    "Asia/Muscat": "OM", "Europe/London": "GB", "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Paris": "FR",
    "Europe/Amsterdam": "NL", "Europe/Stockholm": "SE", "America/Toronto": "CA", "America/Vancouver": "CA",
    "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
  };
  function countryFromZone(tz) {
    if (ZONES[tz]) return ZONES[tz];
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Detroit|Anchorage)/.test(tz || "")) return "US";
    return "";
  }

  const HOME_LANGUAGES = [
    { id: "ar", label: "العربية", label_en: "Arabic" },
    { id: "en", label: "الإنجليزية", label_en: "English" },
    { id: "ar_en", label: "العربية والإنجليزية", label_en: "Arabic and English" },
    { id: "other", label: "لغة أخرى", label_en: "Another language" },
  ];

  // Programs (as on the site), by id.
  const PROGRAMS = {
    reading: { name: "تأسيس القراءة (نور البيان)", name_en: "Reading foundations (Noor Al-Bayan)" },
    hifz: { name: "حفظ القرآن الكريم", name_en: "Quran memorization (Hifz)" },
    tajweed: { name: "التجويد", name_en: "Tajweed (rules of recitation)" },
    arabic: { name: "اللغة العربية", name_en: "Arabic language" },
    islamic: { name: "الدراسات الإسلامية", name_en: "Islamic studies" },
  };

  const GOALS = [
    { id: "read", label: "يتعلم القراءة العربية من البداية", label_en: "Learn to read Arabic from the start", program: "reading" },
    { id: "hifz", label: "يحفظ القرآن الكريم", label_en: "Memorize the Quran", program: "hifz" },
    { id: "tajweed", label: "يحسّن التلاوة والتجويد", label_en: "Improve recitation and Tajweed", program: "tajweed" },
    { id: "arabic", label: "يتعلم اللغة العربية", label_en: "Learn the Arabic language", program: "arabic" },
    { id: "islamic", label: "يتعلم أساسيات الدين", label_en: "Learn the basics of Islam", program: "islamic" },
  ];

  const TEACHER = [
    { id: "female", label: "معلمة", label_en: "A female teacher" },
    { id: "male", label: "معلم", label_en: "A male teacher" },
    { id: "any", label: "لا يهم", label_en: "No preference" },
  ];

  // Surah names only (never the text): Al-Fatiha and the last surahs of Juz' Amma, shortest first.
  // The Arabic name is the value that is saved; the English name is for display.
  const SURAHS = [
    ["الفاتحة", "Al-Fatiha"], ["الناس", "An-Nas"], ["الفلق", "Al-Falaq"], ["الإخلاص", "Al-Ikhlas"], ["المسد", "Al-Masad"],
    ["النصر", "An-Nasr"], ["الكافرون", "Al-Kafirun"], ["الكوثر", "Al-Kawthar"], ["الماعون", "Al-Ma'un"], ["قريش", "Quraysh"],
    ["الفيل", "Al-Fil"], ["الهمزة", "Al-Humazah"], ["العصر", "Al-'Asr"], ["التكاثر", "At-Takathur"], ["القارعة", "Al-Qari'ah"],
    ["العاديات", "Al-'Adiyat"], ["الزلزلة", "Az-Zalzalah"], ["البينة", "Al-Bayyinah"], ["القدر", "Al-Qadr"], ["العلق", "Al-'Alaq"],
    ["التين", "At-Tin"], ["الشرح", "Ash-Sharh"], ["الضحى", "Ad-Duha"],
  ].map(([ar, en]) => ({ ar, en }));
  const SURAH_NAMES = SURAHS.map((s) => s.ar);

  // How many lessons a week the family can do. Three is chosen in advance and recommended; two can be chosen.
  const LESSONS_PER_WEEK = [
    { id: 3, label: "3 حصص في الأسبوع", label_en: "3 lessons a week" },
    { id: 2, label: "حصتان في الأسبوع", label_en: "2 lessons a week" },
  ];
  const DEFAULT_LESSONS_PER_WEEK = 3;

  // Where the child's memorization came from (asked only when the parent lists surahs).
  const MEM_SOURCES = [
    { id: "listening", label: "سماعًا (بالتكرار والاستماع)", label_en: "By listening and repeating" },
    { id: "mushaf", label: "قراءةً من المصحف", label_en: "By reading from the Mushaf" },
    { id: "both", label: "الاثنان", label_en: "Both" },
  ];

  // Tajweed basics, asked of the parent only when the child reads from the Mushaf. Information for the teacher; no game.
  // Wording and example words by Sara (teacher-written, not from the two source files); English uses transliteration.
  const TAJWEED_QS = [
    { id: "madd", label: "المد: هل يُطيل طفلكم الصوت عند حروف المد، مثل: قَالَ، قِيلَ، يَقُولُ، ولا يقرؤها قصيرة؟",
      label_en: "Madd: does your child hold the sound longer on the long-vowel letters, as in qāla, qīla, yaqūlu, and not read them short?" },
    { id: "ghunnah", label: "الغنة: هل يُخرج طفلكم صوتًا من الأنف عند النون والميم المشددتين، مثل: إِنَّ، ثُمَّ؟",
      label_en: "Ghunnah: does your child make a sound through the nose on a doubled noon or meem, as in inna, thumma?" },
    { id: "qalqalah", label: "القلقلة: هل يظهر اهتزاز خفيف في الصوت عند الوقف على حروف القلقلة، مثل: أَحَد، الْفَلَق؟",
      label_en: "Qalqalah: is there a slight bounce in the sound when your child stops on a qalqalah letter, as in aḥad, al-falaq?" },
  ];
  const TAJWEED_ANSWERS = [
    { id: "yes", label: "نعم", label_en: "Yes" },
    { id: "sometimes", label: "أحيانًا", label_en: "Sometimes" },
    { id: "no", label: "لا", label_en: "No" },
    { id: "unsure", label: "لست متأكدًا", label_en: "Not sure" },
  ];

  // The same three questions, put to an adult about their own reading.
  const TAJWEED_QS_ADULT = {
    madd: { label: "المد: هل تُطيل الصوت عند حروف المد، مثل: قَالَ، قِيلَ، يَقُولُ، ولا تقرؤها قصيرة؟", label_en: "Madd: do you hold the sound longer on the long-vowel letters, as in qāla, qīla, yaqūlu?" },
    ghunnah: { label: "الغنة: هل تُخرج صوتًا من الأنف عند النون والميم المشددتين، مثل: إِنَّ، ثُمَّ؟", label_en: "Ghunnah: do you make a sound through the nose on a doubled noon or meem, as in inna, thumma?" },
    qalqalah: { label: "القلقلة: هل يظهر اهتزاز خفيف في صوتك عند الوقف على حروف القلقلة، مثل: أَحَد، الْفَلَق؟", label_en: "Qalqalah: is there a slight bounce in your voice when you stop on a qalqalah letter, as in aḥad, al-falaq?" },
  };

  // Tajweed points that can go alongside memorization ("تركيز مصاحب"), one per Tajweed question.
  const FOCUS = [
    { id: "madd", name: "المد", name_en: "Madd (lengthening)" },
    { id: "ghunnah", name: "الغنة", name_en: "Ghunnah (the nasal sound)" },
    { id: "qalqalah", name: "القلقلة", name_en: "Qalqalah (the slight bounce)" },
  ];
  // The order of the focus points from the Tajweed answers: "no" first, then "sometimes", then "not sure"; "yes" needs none.
  // Without answers (not asked), all three in their usual order.
  function focusOrder(tajweed) {
    if (!tajweed) return FOCUS.map((f) => f.id);
    return ["no", "sometimes", "unsure"].flatMap((a) => FOCUS.filter((f) => tajweed[f.id] === a).map((f) => f.id));
  }
  // A learner who reads from the Mushaf: Tajweed goes alongside memorization instead of coming after it.
  const readsMushaf = (level) => level === "R5" || level === "R6";

  // What the child responds to — the parent's four short answers (no labels, no "types").
  const LIKES_QS = [
    { id: "listening", label: "يحب الأناشيد والاستماع؟", label_en: "Enjoys nasheeds and listening?" },
    { id: "drawing", label: "يحب الكتابة والرسم؟", label_en: "Enjoys writing and drawing?" },
    { id: "moving", label: "يحب الحركة؟", label_en: "Enjoys moving about?" },
  ];
  const LIKES_ANSWERS = [
    { id: "yes", label: "نعم", label_en: "Yes" },
    { id: "sometimes", label: "أحيانًا", label_en: "Sometimes" },
    { id: "no", label: "لا", label_en: "No" },
  ];
  const MOTIVATION = [
    { id: "challenge", label: "التحدي", label_en: "A challenge" },
    { id: "praise", label: "المدح", label_en: "Praise" },
    { id: "both", label: "الاثنان", label_en: "Both" },
    { id: "unsure", label: "لست متأكدًا", label_en: "Not sure" },
  ];

  // Who is taking the diagnostic.
  const WHO = [
    { id: "child", label: "طفل", label_en: "A child" },
    { id: "adult", label: "بالغ", label_en: "An adult" },
    { id: "teacher", label: "معلم أو معلمة", label_en: "A teacher" },
  ];

  // The English track (an English-speaking teacher) is kept for Kottab and switched off for Qurana, whose families
  // read Arabic: everyone gets the Arabic track. One setting.
  const ENGLISH_TRACK = false;

  // The adult track (Arabic readers): fluency, an ayah they have probably not memorized, Tajweed, memorization by juz',
  // goals and time. Spoken to in the singular.
  const ADULT_AGE_BANDS = ["18–25", "26–35", "36–50", "51+"];
  const ADULT_SELF = [
    { id: "fluent", label: "أقرأ بطلاقة", label_en: "I read fluently" },
    { id: "slow", label: "أقرأ ببطء", label_en: "I read slowly" },
    { id: "stumble", label: "أتعثّر في القراءة", label_en: "I stumble when I read" },
  ];
  // How much the adult has memorized, by juz'.
  const ADULT_JUZ = [
    { id: "none", label: "لا شيء", label_en: "Nothing yet" },
    { id: "amma", label: "جزء عمّ", label_en: "Juz' Amma" },
    { id: "upto5", label: "حتى 5 أجزاء", label_en: "Up to 5 juz'" },
    { id: "more", label: "أكثر من ذلك", label_en: "More" },
  ];
  const AYAH_SELF = [
    { id: "easy", label: "قرأتها بسهولة", label_en: "I read it easily" },
    { id: "hard", label: "قرأتها بصعوبة", label_en: "I read it with difficulty" },
    { id: "no", label: "لم أستطع قراءتها", label_en: "I couldn't read it" },
  ];
  // Each adult goal and the curriculum goal its path follows (ijaza: the teacher decides after a test).
  const ADULT_GOALS = [
    { id: "tilawa", label: "تصحيح التلاوة", label_en: "Correct my recitation", program: "tilawa", path: "tajweed" },
    { id: "hifz", label: "الحفظ", label_en: "Memorization (Hifz)", program: "hifz", path: "hifz" },
    { id: "tajweed", label: "التجويد", label_en: "Tajweed", program: "tajweed", path: "tajweed" },
    { id: "ijaza", label: "الإجازة", label_en: "Ijazah (certified recitation)", program: "ijaza", path: null },
  ];
  // The adult's level from the self-assessment and the ayah: A1 → strengthening reading (vowels, madd, sukun, shaddah,
  // then the Mushaf), A2 → reading from the Mushaf, A3 → recitation and memorization. Each maps to the child level whose
  // start stage it shares.
  // From how the adult says they read, then the Tajweed test (naming the rule and its reason, marked by the page):
  // failing it brings «التلاوة والحفظ» (A3) down to «القراءة من المصحف» (A2). Reading itself is not in question
  // there, so it never brings an adult down to A1. (Older results also had an ayah read aloud and rated: `ayah`.)
  function adultLevel(self, ayah, tajweed) {
    if (self === "stumble" || ayah === "no") return "A1";
    if (self === "fluent" && (ayah === undefined || ayah === "easy")) return tajweed && tajweed.passed === false ? "A2" : "A3";
    return "A2";
  }
  const ADULT_TO_LEVEL = { A1: "R4", A2: "R5", A3: "R6" };

  PROGRAMS.tilawa = { name: "تصحيح التلاوة", name_en: "Correcting recitation" };
  PROGRAMS.ijaza = { name: "الإجازة", name_en: "Ijazah" };

  const PLANS = {
    seed: { name: "البذرة", name_en: "Seed", per_week: 2 },
    growth: { name: "النماء", name_en: "Growth", per_week: 3 },
  };

  // The goals a profile's path follows (older child results saved a single `goal`; adults map theirs).
  function pathGoals(profile) {
    if (profile.who === "adult") return ADULT_GOALS.filter((g) => profile.goals.includes(g.id) && g.path).map((g) => g.path);
    return Array.isArray(profile.goals) && profile.goals.length ? profile.goals : [profile.goal].filter(Boolean);
  }

  // Suggestion on the result page — fixed rules, shown as a suggestion the teacher reviews in the trial.
  // Track: English track when the child mostly speaks another language at home (an adult: the language they chose).
  // Program: from the goals (in the order of the list), except that a learner still learning to read starts with
  // reading foundations; "then" is the next chosen program after it. A reader who memorizes gets Tajweed alongside
  // ("with_tajweed") instead of after it.
  // Plan: Qurana recommends Growth (3 a week) for steady progress. Seed is never suggested by the rules; it shows only as
  // what the family chose when they chose 2 a week explicitly ("chosen").
  function suggestion(profile, level) {
    const adult = profile.who === "adult";
    const english = ENGLISH_TRACK && (adult ? profile.lang === "en" : profile.home_language === "en" || profile.home_language === "other");
    const track = english ? "english" : "arabic";
    const ids = adult ? profile.goals : Array.isArray(profile.goals) && profile.goals.length ? profile.goals : [profile.goal];
    const chosen = (adult ? ADULT_GOALS : GOALS).filter((g) => ids.includes(g.id)).map((g) => g.program);
    const learningToRead = ["R1", "R2", "R3", "R4"].includes(level);
    let program = learningToRead ? "reading" : chosen.find((p) => p !== "reading") || chosen[0] || "hifz";
    const plan = "growth";
    const chosenPlan = Number(profile.lessons_per_week) === 2 ? "seed" : "growth";
    const withTajweed = readsMushaf(level) && chosen.includes("hifz") && focusOrder(profile.tajweed).length > 0;
    if (withTajweed) program = "hifz";
    const then = withTajweed ? null : chosen.find((p) => p !== program && p !== "reading" && !(learningToRead && p === "tilawa" && program === "reading")) || null;
    return { track, program, plan, chosen: chosenPlan, then, with_tajweed: withTajweed };
  }

  const api = {
    AGE_BANDS, COUNTRIES, countryFromZone, HOME_LANGUAGES, PROGRAMS, GOALS, TEACHER, SURAHS, SURAH_NAMES, LESSONS_PER_WEEK, DEFAULT_LESSONS_PER_WEEK, MEM_SOURCES,
    TAJWEED_QS, TAJWEED_QS_ADULT, TAJWEED_ANSWERS, FOCUS, focusOrder, readsMushaf, LIKES_QS, LIKES_ANSWERS, MOTIVATION, WHO,
    ENGLISH_TRACK, ADULT_AGE_BANDS, ADULT_SELF, ADULT_JUZ, AYAH_SELF, ADULT_GOALS, adultLevel, ADULT_TO_LEVEL, PLANS, pathGoals, suggestion,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuranaOptions = api;
})(typeof window !== "undefined" ? window : globalThis);
