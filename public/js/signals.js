// What the child responds to: signs recorded during the games, and fixed rules that turn them into
// "ما لاحظناه" (three gentle sentences for the parent) and "كيف نبدأ معه" (practical points for the teacher).
// No model, no labels: never "types of intelligence" or "learning styles" (tests check the words).
// Works in the browser (window.QuranaSignals) and in Node (server and tests).
(function (root) {
  // The kind of each game: hearing a letter, seeing a letter's shape, or reading (confirmed by the grown-up).
  const KIND = { sound: "sound", shape: "shape", fatha: "read", harakat: "read", fatiha: "read", ayah: "read" };

  // ---------- recording (browser) ----------
  function recorder() {
    const items = [];
    let shownAt = 0, current = null, lastWrong = false;
    const startedAt = Date.now();
    return {
      shown(stage) { shownAt = Date.now(); current = { kind: KIND[stage] || "read", hints: 0, afterError: lastWrong }; },
      hint() { if (current) current.hints++; },
      answered(correct) {
        if (!current) return;
        items.push({ ...current, ms: Math.min(Date.now() - shownAt, 120000), correct: !!correct });
        lastWrong = !correct;
        current = null;
      },
      skipped() { if (current) { items.push({ ...current, ms: Math.min(Date.now() - shownAt, 120000), skipped: true }); current = null; } },
      summary() { return summarize(items, Date.now() - startedAt); },
    };
  }

  // A short summary, the only thing sent to the server: per kind the count, correct answers and median time.
  function summarize(items, totalMs) {
    const kinds = {};
    for (const k of ["sound", "shape", "read"]) {
      const list = items.filter((i) => i.kind === k && !i.skipped);
      if (!list.length) continue;
      const times = list.map((i) => i.ms).sort((a, b) => a - b);
      kinds[k] = { n: list.length, correct: list.filter((i) => i.correct).length, median_ms: times[Math.floor(times.length / 2)] };
    }
    const after = items.filter((i) => i.afterError && !i.skipped);
    const half = Math.floor(items.length / 2);
    const med = (l) => { const t = l.map((i) => i.ms).sort((a, b) => a - b); return t.length ? t[Math.floor(t.length / 2)] : 0; };
    return {
      kinds,
      hints: items.reduce((n, i) => n + i.hints, 0),
      skips: items.filter((i) => i.skipped).length,
      after_error: { n: after.length, correct: after.filter((i) => i.correct).length },
      // Slower in the second half than the first (by half again or more): a sign of tiring.
      slower_later: items.length >= 6 && med(items.slice(half)) > 1.5 * med(items.slice(0, half)),
      total_ms: Math.min(Math.round(totalMs), 60 * 60 * 1000),
    };
  }

  // Checks a summary from the browser; returns a clean copy or null.
  function clean(s) {
    if (!s || typeof s !== "object") return null;
    const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);
    const kinds = {};
    for (const k of ["sound", "shape", "read"]) {
      const x = s.kinds && s.kinds[k];
      if (!x) continue;
      const n = int(x.n, 50), c = int(x.correct, 50), m = int(x.median_ms, 120000);
      if (n === null || c === null || m === null || c > n) return null;
      kinds[k] = { n, correct: c, median_ms: m };
    }
    const hints = int(s.hints, 200), skips = int(s.skips, 50), total = int(s.total_ms, 3600000);
    const an = int(s.after_error && s.after_error.n, 50), ac = int(s.after_error && s.after_error.correct, 50);
    if ([hints, skips, total, an, ac].includes(null) || ac > an || typeof s.slower_later !== "boolean") return null;
    return { kinds, hints, skips, after_error: { n: an, correct: ac }, slower_later: s.slower_later, total_ms: total };
  }

  // ---------- reading the signs (fixed rules) ----------
  const rate = (k) => (k && k.n ? k.correct / k.n : null);

  // Returns { parent: [up to 3 sentences], teacher: [points] } in the page's language.
  function observe(signals, likes, motivation, lang) {
    const en = lang === "en";
    const s = signals || { kinds: {}, hints: 0, skips: 0, after_error: { n: 0, correct: 0 }, slower_later: false };
    const L = likes || {};
    const parent = [], teacher = [];
    const sound = s.kinds.sound, shape = s.kinds.shape, read = s.kinds.read;

    // 1. Hearing or seeing.
    const rs = rate(sound), rv = rate(shape);
    if (rs !== null && rv !== null && (rs - rv >= 0.25 || (rs >= rv && sound.median_ms * 1.5 < shape.median_ms))) {
      parent.push(en ? "We noticed your child answers quickly on hearing a letter, and hesitates more when seeing it written." : "لاحظنا أنه يجيب بسرعة عندما يسمع الحرف، ويتردد أكثر عندما يراه مكتوبًا.");
      teacher.push(en ? "Start with listening, then reading." : "ابدئي بالسمع ثم القراءة.");
    } else if (rs !== null && rv !== null && (rv - rs >= 0.25 || (rv >= rs && shape.median_ms * 1.5 < sound.median_ms))) {
      parent.push(en ? "We noticed your child recognises written letters more easily than letters heard aloud." : "لاحظنا أنه يميّز الحرف المكتوب بسهولة أكثر من تمييزه بالسمع.");
      teacher.push(en ? "Start with the written letter, then link it to its sound." : "ابدئي بالحرف المكتوب ثم اربطيه بصوته.");
    } else if (read && rate(read) >= 0.75) {
      parent.push(en ? "Your child read the words steadily, with few stops." : "قرأ طفلكم الكلمات بثبات، وتوقف قليلًا.");
      teacher.push(en ? "Reading is steady: move on at a normal pace and check accuracy." : "القراءة ثابتة: تقدّمي بالسرعة المعتادة وراجعي الدقة.");
    } else if (read) {
      parent.push(en ? "Your child tried every word, and some still need practice." : "حاول طفلكم قراءة كل الكلمات، وبعضها يحتاج تدريبًا.");
      teacher.push(en ? "Short words, read together, then alone." : "كلمات قصيرة، تُقرأ معه أولًا ثم وحده.");
    }

    // 2. After a mistake, hints and repetition.
    if (s.after_error.n >= 2 && s.after_error.correct / s.after_error.n >= 0.6) {
      parent.push(en ? "When a mistake happens, your child comes back and tries again calmly." : "وعندما يخطئ يعود ويحاول بهدوء.");
      teacher.push(en ? "Recovers well after a mistake: correct gently and keep going." : "يتجاوز الخطأ بسهولة: صحّحي بلطف وتابعي.");
    } else if (s.after_error.n >= 2) {
      parent.push(en ? "After a mistake your child needs a moment before going on, which is normal at the start." : "وبعد الخطأ يحتاج لحظة قبل أن يكمل، وهذا طبيعي في البداية.");
      teacher.push(en ? "Needs repetition: go back over the same point calmly before adding a new one." : "يحتاج تكرارًا: أعيدي النقطة نفسها بهدوء قبل إضافة جديد.");
    } else if (s.hints >= 2) {
      parent.push(en ? "Your child used the hint now and then, so repetition will help." : "واستعان بالتلميح أحيانًا، فالتكرار يفيده.");
      teacher.push(en ? "Needs repetition." : "يحتاج تكرارًا.");
    }

    // 3. What the child enjoys and what keeps them going (the parent's answers), and tiring.
    if (motivation === "praise") { parent.push(en ? "Your child enjoys praise, so we will encourage every try." : "ويفرح بالمدح، فسنشجّعه على كل محاولة."); teacher.push(en ? "Responds to praise." : "يستجيب للمدح."); }
    else if (motivation === "challenge") { parent.push(en ? "Your child likes a challenge, so each lesson will have a small target." : "ويتحمس للتحدي، فسنضع له هدفًا صغيرًا في كل حصة."); teacher.push(en ? "Responds to a challenge: a small target each lesson." : "يستجيب للتحدي: هدف صغير في كل حصة."); }
    else if (motivation === "both") teacher.push(en ? "Responds to praise and to a small challenge." : "يستجيب للمدح وللتحدي الصغير.");
    if (L.listening === "yes") { if (parent.length < 3) parent.push(en ? "Your child enjoys listening, so we will repeat with the voice." : "ويحب الاستماع، فسنكرر معه بالصوت."); teacher.push(en ? "Enjoys listening: use repetition aloud." : "يحب الاستماع: استخدمي التكرار بالصوت."); }
    if (L.drawing === "yes") teacher.push(en ? "Enjoys writing and drawing: let them write the letter with you." : "يحب الكتابة والرسم: دعيه يكتب الحرف معك.");
    if (L.moving === "yes" || s.slower_later) {
      teacher.push(en ? "Short attention span: break the lesson into short parts." : "مدة انتباهه قصيرة: قسّمي الحصة إلى فقرات قصيرة.");
      if (parent.length < 3) parent.push(en ? "Lessons will come in short parts, with a pause between them." : "ستكون الحصة فقرات قصيرة بينها استراحة.");
    }
    return { parent: parent.slice(0, 3), teacher };
  }

  // Words that must never describe a child here.
  const BANNED_TERMS = [/ذكاء/, /نمط/, /سمعي/, /بصري/, /حركي/, /intelligen/i, /learning style/i, /auditory/i, /visual learner/i, /kinesthetic/i];

  const api = { KIND, recorder, summarize, clean, observe, BANNED_TERMS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuranaSignals = api;
})(typeof window !== "undefined" ? window : globalThis);
