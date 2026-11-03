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

  // How many lessons a week the family can do; it decides the plan (Seed = 2, Growth = 3).
  const LESSONS_PER_WEEK = [
    { id: 2, label: "حصتان في الأسبوع", label_en: "2 lessons a week" },
    { id: 3, label: "3 حصص في الأسبوع", label_en: "3 lessons a week" },
  ];

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

  const PLANS = {
    seed: { name: "البذرة", name_en: "Seed", per_week: 2 },
    growth: { name: "النماء", name_en: "Growth", per_week: 3 },
  };

  // Suggestion on the result page — fixed rules, shown as a suggestion the teacher reviews in the trial.
  // Track: English track when the child mostly speaks another language at home.
  // Program: from the goal, except that a child still learning to read starts with reading foundations.
  // Plan: from the lessons a week the parent chose (Seed = 2, Growth = 3).
  function suggestion(profile, level) {
    const track = profile.home_language === "en" || profile.home_language === "other" ? "english" : "arabic";
    const goal = GOALS.find((g) => g.id === profile.goal);
    const learningToRead = ["R1", "R2", "R3", "R4"].includes(level);
    const program = learningToRead ? "reading" : goal ? goal.program : "hifz";
    const plan = Number(profile.lessons_per_week) === 2 ? "seed" : "growth";
    const then = learningToRead && goal && goal.program !== "reading" ? goal.program : null;
    return { track, program, plan, then };
  }

  const api = { AGE_BANDS, COUNTRIES, countryFromZone, HOME_LANGUAGES, PROGRAMS, GOALS, TEACHER, SURAHS, SURAH_NAMES, LESSONS_PER_WEEK, MEM_SOURCES, TAJWEED_QS, TAJWEED_ANSWERS, PLANS, suggestion };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuranaOptions = api;
})(typeof window !== "undefined" ? window : globalThis);
