// Interface text in Arabic and English. The language comes from ?lang=en / ?lang=ar, then the last choice, then Arabic.
// Arabic letters and words the child reads stay Arabic in both languages.
(function (root) {
  const T = {
    ar: {
      brand_sub: "تشخيص المستوى",
      switch: "English",
      footer: "قرآنا — الفرع العربي من كُتّاب · الكلمات من كتاب «نور البيان» ومن نص المصحف المعتمد",
      w_eyebrow: "مجاني · 3–5 دقائق · مع وليّ الأمر",
      w_title: "اعرف مستوى طفلك في قراءة القرآن",
      w_text: "ألعاب قصيرة يلعبها طفلك وأنت بجانبه: الحروف، ثم الكلمات، ثم كلمات من سورة الفاتحة. نبدأ من المستوى الذي تختاره، وننزل فقط إذا احتاج الطفل.",
      fact1: "بلا تسجيل", fact2: "بلا رقم هاتف", fact3: "نتيجة برابط ثابت", fact4: "خطة تعليمية مقترحة",
      w_after: "في النهاية تظهر نتيجة طفلك وخطة تعليمية مقترحة من منهج قرآنا، ويمكنك حجز حصة تجريبية مجانية أو إرسال النتيجة لنا على واتساب. المعلمة تراجع النتيجة معك في الحصة التجريبية.",
      consent: "أنا وليّ أمر الطفل، وسأجلس بجانبه أثناء التشخيص.",
      consent_err: "من فضلك أكّد أنك وليّ الأمر وأنك بجانب الطفل.",
      load_err: "تعذّر تحميل الألعاب. تأكد من الاتصال وحاول مرة أخرى.",
      start: "ابدأ",
      a_eyebrow: "لوليّ الأمر · دقيقة واحدة",
      a_title: "عن طفلك",
      nickname: "اسم الطفل أو اسم الدلع (اختياري)", nickname_ph: "مثلًا: سارة",
      age: "العمر", age_unit: "سنوات",
      country: "الدولة", choose_country: "اختر الدولة",
      lang_home: "لغة البيت",
      goal: "ما أهم شيء تريده لطفلك الآن؟",
      surahs: "السور التي يحفظها (اختر كل ما يحفظه)", more: "يحفظ أكثر من ذلك",
      teacher: "تفضّل أن يدرّسه",
      estimate: "برأيك، طفلك الآن…",
      go_games: "نبدأ الألعاب",
      missing: "من فضلك اختر: ",
      m_age: "العمر", m_country: "الدولة", m_lang: "لغة البيت", m_goal: "الهدف", m_teacher: "المعلم أو المعلمة", m_estimate: "مستوى الطفل برأيك", m_per_week: "عدد الحصص في الأسبوع", m_mem_from: "كيف حفظ السور",
      mem_from: "كيف حفظ هذه السور؟", per_week_q: "كم حصة في الأسبوع تناسبكم؟ (الحصة 30 دقيقة)",
      tajweed_q: "أسئلة عن التجويد (اختر الأقرب)", tajweed_note: "إجاباتكم تساعد المعلمة فقط ولا تغيّر خطة الطفل.",
      r_mem_from: "طريقة الحفظ:", r_tajweed: "التجويد حسب وليّ الأمر:",
      p_totals: "مجموع الحصص في الخطة: حوالي {sessions} · عدد الأسابيع التقريبي: {weeks} (بمعدل {per_week} في الأسبوع). تقدير من أرقام منهج قرآنا تراجعه المعلمة، وليس وعدًا بمدة.",
      p_reached: "حسب التشخيص، طفلك تجاوز مراحل هذا الهدف في المنهج. المعلمة تقترح الخطوة التالية معكم في الحصة التجريبية.",
      hero: "يا بطل",
      s1_label: "المرحلة 1 · الأصوات", s1_title: "أي حرف تسمع؟",
      s1_prompt: "{name}، استمع لوليّ أمرك ثم اضغط على الحرف.",
      s1_cue_sum: "وليّ الأمر: اضغط لترى ما تقوله",
      s1_cue: "قل صوت حرف {letter} بوضوح مرتين، دون أن تشير إلى الشاشة.",
      skip: "وليّ الأمر: تخطَّ هذا الحرف",
      s2_label: "المرحلة 2 · الأشكال", s2_title: "ابحث عن الحرف نفسه",
      s2_prompt: "هذا الحرف يتغيّر شكله قليلًا عندما يتصل بكلمة. أين هو؟",
      s3_label: "المرحلة 3 · الفتح", s3_title: "اقرأ الكلمة", s3_prompt: "اقرأ هذه الكلمة بصوت عالٍ لوليّ أمرك.",
      s4_label: "المرحلة 4 · الحركات", s4_title: "اقرأ الكلمة", s4_prompt: "انتبه للحركات: فتحة وكسرة وضمة.",
      s5_label: "المرحلة 5 · من الفاتحة", s5_title: "اقرأ كلمة من سورة الفاتحة", s5_prompt: "اقرأ هذه الكلمة من المصحف بصوت عالٍ.",
      s6_label: "المرحلة 6 · آية كاملة", s6_title: "اقرأ الآية كلها", s6_prompt: "اقرأ الآية الأولى من سورة الفاتحة من أولها لآخرها.",
      read_q: "وليّ الأمر: هل قرأها صحيحة؟", read_yes: "قرأها", read_no: "ليس بعد",
      saving: "أحسنت! نجهّز النتيجة…", saving_wait: "لحظات.",
      save_err: "تعذّر حفظ النتيجة. تأكد من الاتصال واضغط «حاول مرة أخرى» — إجاباتك ما زالت محفوظة في الصفحة.",
      retry: "حاول مرة أخرى",
      // result page
      r_sub: "نتيجة التشخيص",
      r_loading: "نحمّل النتيجة…",
      r_missing: "لم نجد هذه النتيجة", r_missing_text: "ربما الرابط ناقص. يمكنك إعادة التشخيص في دقائق.", r_restart: "ابدأ التشخيص",
      r_date: "تشخيص {date}",
      r_title_named: "نقطة بداية {name}", r_title: "نقطة بداية طفلك",
      r_focus: "التركيز الآن: {focus}",
      r_note: "هذه نتيجة ألعاب قصيرة مع وليّ الأمر. المعلمة تراجعها معكم في الحصة التجريبية المجانية وتؤكد نقطة البداية.",
      r_done: "ما فعله في التشخيص",
      st_sound: "أصوات الحروف", st_shape: "أشكال الحروف في الكلمة", st_fatha: "القراءة بالفتح", st_harakat: "القراءة بالحركات الثلاث", st_fatiha: "كلمات من سورة الفاتحة", st_ayah: "قراءة آية كاملة",
      r_not_needed: "لم يحتجها", r_of: "{a} من {b}",
      r_memorizes: "يحفظ:", r_and_more: "، وأكثر", r_no_mem: "لم يُذكر حفظ سابق.",
      r_suggest: "نقترح أن يبدأ بـ",
      k_program: "البرنامج", k_track: "المسار", k_plan: "الباقة", k_teacher: "المعلم",
      then: "ثم", track_ar: "المسار العربي (التدريس بالفصحى)", track_en: "المسار الإنجليزي (المعلم يشرح بالإنجليزية)",
      per_week: "عدد الحصص في الأسبوع: {n}", any_teacher: "معلمة أو معلم",
      p_title: "الخطة التعليمية المقترحة",
      p_loading: "نكتب خطة طفلك من منهج قرآنا… قد يستغرق ذلك دقيقة تقريبًا.",
      p_unavailable: "الخطة التعليمية التفصيلية تُبنى من منهج قرآنا المعتمد، وتراجعها المعلمة معكم في الحصة التجريبية.",
      p_draft: "مثال تجريبي: منهج غير معتمد بعد",
      p_sessions: "عدد الحصص: حوالي {n} (الحصة 30 دقيقة)", p_goals: "الأهداف", p_content: "المحتوى", p_exit: "ينتقل بعدها عندما",
      p_tip: "نصيحة للبيت",
      p_footer: "خطة مقترحة من مراحل منهج قرآنا المعتمد، كُتبت ملاحظاتها بمساعدة الذكاء الاصطناعي، وتراجعها المعلمة في الحصة التجريبية.",
      p_footer_cur: "خطة مقترحة من مراحل منهج قرآنا المعتمد، وتراجعها المعلمة في الحصة التجريبية.",
      r_next: "الخطوة التالية",
      cta_book: "احجز الحصة التجريبية المجانية", cta_wa: "أرسل النتيجة لنا على واتساب", cta_prices: "شاهد الباقات والأسعار",
      r_link: "رابط النتيجة ثابت، احفظه أو أرسله لنفسك:", copy: "نسخ الرابط", copied: "تم النسخ",
      wa_hello_named: "السلام عليكم، عملت تشخيص قرآنا لـ {name}.", wa_hello: "السلام عليكم، عملت تشخيص قرآنا لطفلي.",
      wa_level: "المستوى: {level}.", wa_suggest: "المقترح: {program}، باقة {plan}.", wa_link: "رابط النتيجة: {link}", wa_book: "أودّ حجز الحصة التجريبية المجانية.",
      r_doc_title: "{level} · نتيجة تشخيص قرآنا",
    },
    en: {
      brand_sub: "Level check",
      switch: "العربية",
      footer: "Qurana — the Arabic branch of Kottab · Words from the Noor Al-Bayan book and the verified Mushaf text",
      w_eyebrow: "Free · 3–5 minutes · with a parent",
      w_title: "Find your child's Quran reading level",
      w_text: "Short games your child plays with you beside them: letters, then words, then words from Surah Al-Fatiha. We start from the level you choose and only go down if your child needs it.",
      fact1: "No sign-up", fact2: "No phone number", fact3: "A result link to keep", fact4: "A suggested learning plan",
      w_after: "At the end you see your child's result and a suggested learning plan from Qurana's curriculum. You can book a free trial lesson or send us the result on WhatsApp. The teacher goes through the result with you in the trial lesson.",
      consent: "I am the child's parent or guardian, and I will sit with them during the check.",
      consent_err: "Please confirm that you are the parent and that you are with the child.",
      load_err: "We couldn't load the games. Check the connection and try again.",
      start: "Start",
      a_eyebrow: "For the parent · one minute",
      a_title: "About your child",
      nickname: "Child's name or nickname (optional)", nickname_ph: "e.g. Sara",
      age: "Age", age_unit: "years",
      country: "Country", choose_country: "Choose country",
      lang_home: "Language at home",
      goal: "What matters most for your child right now?",
      surahs: "Surahs (chapters) your child knows by heart (choose all)", more: "Knows more than these",
      teacher: "You would prefer",
      estimate: "In your view, your child…",
      go_games: "Start the games",
      missing: "Please choose: ",
      m_age: "age", m_country: "country", m_lang: "language at home", m_goal: "goal", m_teacher: "teacher", m_estimate: "your child's level", m_per_week: "lessons a week", m_mem_from: "how the surahs were memorized",
      mem_from: "How did your child memorize these surahs?", per_week_q: "How many lessons a week suit you? (30 minutes each)",
      tajweed_q: "Questions about Tajweed (choose the closest)", tajweed_note: "Your answers only help the teacher; they do not change your child's plan.",
      r_mem_from: "Memorized:", r_tajweed: "Tajweed, as the parent sees it:",
      p_totals: "Lessons in this plan: about {sessions} · Weeks: about {weeks} (at {per_week} a week). An estimate from Qurana's curriculum numbers that the teacher reviews — not a promise of time.",
      p_reached: "From the diagnostic, your child is already past the stages of this goal in the curriculum. The teacher suggests the next step with you in the free trial lesson.",
      hero: "Superstar",
      s1_label: "Stage 1 · Sounds", s1_title: "Which letter do you hear?",
      s1_prompt: "{name}, listen to your grown-up, then tap the letter.",
      s1_cue_sum: "Grown-up: tap to see what to say",
      s1_cue: "Say the sound of the letter {letter} clearly, twice, without pointing at the screen.",
      skip: "Grown-up: skip this letter",
      s2_label: "Stage 2 · Shapes", s2_title: "Find the same letter",
      s2_prompt: "This letter changes shape a little when it joins a word. Which one is it?",
      s3_label: "Stage 3 · Fatha", s3_title: "Read the word", s3_prompt: "Read this word out loud to your grown-up.",
      s4_label: "Stage 4 · Short vowels", s4_title: "Read the word", s4_prompt: "Watch the vowels: fatha, kasra and damma.",
      s5_label: "Stage 5 · From Al-Fatiha", s5_title: "Read a word from Surah Al-Fatiha", s5_prompt: "Read this word from the Mushaf out loud.",
      s6_label: "Stage 6 · A whole ayah", s6_title: "Read the whole ayah", s6_prompt: "Read the first ayah (verse) of Surah Al-Fatiha from start to end.",
      read_q: "Grown-up: did they read it correctly?", read_yes: "Read it", read_no: "Not yet",
      saving: "Well done! Getting the result ready…", saving_wait: "One moment.",
      save_err: "We couldn't save the result. Check the connection and tap \"Try again\" — your answers are still on the page.",
      retry: "Try again",
      r_sub: "Result",
      r_loading: "Loading the result…",
      r_missing: "We couldn't find this result", r_missing_text: "The link may be incomplete. You can take the check again in a few minutes.", r_restart: "Start the check",
      r_date: "Checked on {date}",
      r_title_named: "{name}'s starting point", r_title: "Your child's starting point",
      r_focus: "Focus now: {focus}",
      r_note: "This comes from short games with the parent. The teacher goes through it with you in the free trial lesson and confirms the starting point.",
      r_done: "What your child did",
      st_sound: "Letter sounds", st_shape: "Letter shapes in a word", st_fatha: "Reading with fatha", st_harakat: "Reading with all three short vowels", st_fatiha: "Words from Surah Al-Fatiha", st_ayah: "Reading a whole ayah",
      r_not_needed: "not needed", r_of: "{a} of {b}",
      r_memorizes: "Knows by heart:", r_and_more: ", and more", r_no_mem: "No memorized surahs mentioned.",
      r_suggest: "We suggest starting with",
      k_program: "Program", k_track: "Track", k_plan: "Plan", k_teacher: "Teacher",
      then: "then", track_ar: "Arabic track (taught in standard Arabic)", track_en: "English track (the teacher explains in English)",
      per_week: "{n} lessons a week", any_teacher: "A female or male teacher",
      p_title: "Suggested learning plan",
      p_loading: "Writing your child's plan from Qurana's curriculum… this takes about a minute.",
      p_unavailable: "The detailed learning plan is built from Qurana's approved curriculum; the teacher goes through it with you in the trial lesson.",
      p_draft: "Test example: curriculum not yet approved",
      p_sessions: "About {n} lessons (30 min)", p_goals: "Goals", p_content: "Content", p_exit: "Moves on when",
      p_tip: "A tip for home",
      p_footer: "A suggested plan built from the stages of Qurana's approved curriculum, with notes written with AI help; the teacher reviews it in the trial lesson.",
      p_footer_cur: "A suggested plan built from the stages of Qurana's approved curriculum; the teacher reviews it in the trial lesson.",
      r_next: "Next step",
      cta_book: "Book the free trial lesson", cta_wa: "Send us the result on WhatsApp", cta_prices: "See plans and prices",
      r_link: "This result link stays the same — save it or send it to yourself:", copy: "Copy link", copied: "Copied",
      wa_hello_named: "Assalamu alaikum, I did the Qurana level check for {name}.", wa_hello: "Assalamu alaikum, I did the Qurana level check for my child.",
      wa_level: "Level: {level}.", wa_suggest: "Suggested: {program}, {plan} plan.", wa_link: "Result link: {link}", wa_book: "I would like to book the free trial lesson.",
      r_doc_title: "{level} · Qurana level check",
    },
  };

  function detect() {
    try {
      const q = new URLSearchParams(location.search).get("lang");
      if (q === "en" || q === "ar") { localStorage.setItem("qurana.lang", q); return q; }
      const saved = localStorage.getItem("qurana.lang");
      if (saved === "en" || saved === "ar") return saved;
    } catch { /* storage blocked */ }
    return "ar";
  }

  const lang = typeof location !== "undefined" ? detect() : "ar";
  function t(key, vars = {}, l = lang) {
    const s = (T[l] && T[l][key]) ?? T.ar[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
  }
  // Fills [data-i18n] (text) and [data-i18n-ph] (placeholder), sets direction, and wires the language switch.
  function apply() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    const sw = document.getElementById("lang-switch");
    if (sw) {
      const other = lang === "en" ? "ar" : "en";
      const url = new URL(location.href);
      url.searchParams.set("lang", other);
      sw.href = url.pathname + url.search;
      sw.textContent = t("switch");
      sw.lang = other;
    }
  }
  // Picks the label for the current language from an option object.
  const label = (o, key = "label") => (lang === "en" && o[`${key}_en`] ? o[`${key}_en`] : o[key]);

  const api = { T, lang, t, apply, label };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuranaI18n = api;
})(typeof window !== "undefined" ? window : globalThis);
