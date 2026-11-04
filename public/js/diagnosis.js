// Qurana diagnostic page: consent and who it is for →
//   child: about the child → adaptive games (with response signals) → save → result page;
//   adult: own reading, ayah 1:1, Tajweed, goals, time → save → result page;
//   teacher: "coming soon" with an email.
(function () {
  const L = window.QuranaLevels;
  const O = window.QuranaOptions;
  const I = window.QuranaI18n;
  const S = window.QuranaSignals;
  const A = window.QuranaAdaptive;
  const t = I.t;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const show = (id) => ["welcome", "about", "adult", "teacher-soon", "game", "saving"].forEach((s) => ($(s).hidden = s !== id));

  I.apply();
  let content = null;
  let profile = null;
  let stages = null;
  let rec = null;

  function chips(id, name, items, type = "radio") {
    $(id).innerHTML = items
      .map((it) => `<label${it.ar ? ' lang="ar"' : ""}><input type="${type}" name="${name}" value="${esc(it.value)}"> ${esc(it.label)}</label>`)
      .join("");
  }
  const picked = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;
  const checked = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);
  const fillCountries = (id) => {
    $(id).innerHTML = `<option value="">${esc(t("choose_country"))}</option>` + O.COUNTRIES.map((c) => `<option value="${c.code}">${esc(I.label(c, "name"))}</option>`).join("");
    try { $(id).value = O.countryFromZone(Intl.DateTimeFormat().resolvedOptions().timeZone) || ""; } catch { /* no time zone */ }
  };
  const missingText = (missing) => t("missing") + missing.join(I.lang === "en" ? ", " : "، ") + ".";

  // ---------- welcome: who is it for ----------
  chips("who", "who", O.WHO.map((x) => ({ value: x.id, label: I.label(x) })));
  document.querySelector('input[name="who"][value="child"]').checked = true;
  // The welcome text follows the choice: a child (with the parent beside them, and the parent's consent), an adult
  // (no parent's box), or a teacher (the "coming soon" text).
  function welcomeFor(who) {
    const k = (key) => (who === "child" ? key : `${key}_${who}`);
    $("w-eyebrow").textContent = t(k("w_eyebrow"));
    $("w-title").textContent = t(k("w_title"));
    $("w-text").textContent = t(k("w_text"));
    $("w-after").textContent = t(k("w_after"));
    $("w-facts").hidden = who === "teacher";
    $("consent-row").hidden = who !== "child";
    $("consent-error").hidden = true;
    $("start").textContent = t(who === "teacher" ? "start_teacher" : "start");
  }
  welcomeFor("child");
  $("who").addEventListener("change", () => welcomeFor(picked("who") || "child"));

  $("start").addEventListener("click", async () => {
    const who = picked("who") || "child";
    if (who === "child" && !$("consent").checked) { $("consent-error").textContent = t("consent_err"); $("consent-error").hidden = false; return; }
    $("consent-error").hidden = true;
    if (who === "teacher") { show("teacher-soon"); window.scrollTo({ top: 0 }); return; }
    $("start").disabled = true;
    try {
      const res = await fetch("/api/content");
      if (!res.ok) throw new Error();
      content = await res.json();
    } catch {
      $("start").disabled = false;
      $("consent-error").textContent = t("load_err");
      $("consent-error").hidden = false;
      return;
    }
    if (who === "adult") { buildAdult(); show("adult"); } else { buildAbout(); show("about"); }
    window.scrollTo({ top: 0 });
  });

  // ---------- about the child ----------
  function buildAbout() {
    // Age ranges are isolated left-to-right (U+2066…U+2069), or "4–5" shows as "5–4" inside Arabic text.
    chips("age", "age", O.AGE_BANDS.map((a) => ({ value: a, label: `⁦${a}⁩ ${t("age_unit")}` })));
    fillCountries("country");
    chips("lang", "lang", O.HOME_LANGUAGES.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("goal", "goal", O.GOALS.map((x) => ({ value: x.id, label: I.label(x) })), "checkbox");
    chips("surahs", "surah", O.SURAHS.map((s) => ({ value: s.ar, label: I.lang === "en" ? s.en : s.ar })), "checkbox");
    chips("teacher", "teacher", O.TEACHER.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("estimate", "estimate", L.ESTIMATES.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("mem-from", "mem_from", O.MEM_SOURCES.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("per-week", "per_week", O.LESSONS_PER_WEEK.map((x) => ({ value: x.id, label: I.label(x) })));
    document.querySelector(`input[name="per_week"][value="${O.DEFAULT_LESSONS_PER_WEEK}"]`).checked = true;
    $("tajweed").innerHTML = tajweedHtml("tj", (q) => I.label(q));
    $("likes").innerHTML = O.LIKES_QS.map((q) => `
      <div><p class="small">${esc(I.label(q))}</p>
      <div class="chips">${O.LIKES_ANSWERS.map((a) => `<label><input type="radio" name="lk_${q.id}" value="${a.id}"> ${esc(I.label(a))}</label>`).join("")}</div></div>`).join("");
    chips("motivation", "motivation", O.MOTIVATION.map((x) => ({ value: x.id, label: I.label(x) })));
    // Where the memorization came from: only when surahs are listed. Tajweed basics: only for a child who reads from the Mushaf.
    const memToggle = () => ($("mem-from-field").hidden = !document.querySelector('input[name="surah"]:checked') && !$("more").checked);
    $("surahs").addEventListener("change", memToggle);
    $("more").addEventListener("change", memToggle);
    $("estimate").addEventListener("change", () => ($("tajweed-field").hidden = picked("estimate") !== "mushaf"));
  }
  function tajweedHtml(prefix, label) {
    return O.TAJWEED_QS.map((q) => `
      <div><p class="small">${esc(label(q))}</p>
      <div class="chips">${O.TAJWEED_ANSWERS.map((a) => `<label><input type="radio" name="${prefix}_${q.id}" value="${a.id}"> ${esc(I.label(a))}</label>`).join("")}</div></div>`).join("");
  }
  const tajweedOf = (prefix) => Object.fromEntries(O.TAJWEED_QS.map((q) => [q.id, picked(`${prefix}_${q.id}`) || "unsure"]));

  $("about-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = {
      who: "child",
      nickname: $("nickname").value.trim(),
      age_band: picked("age"),
      country: $("country").value,
      home_language: picked("lang"),
      goals: checked("goal"),
      teacher: picked("teacher"),
      estimate: picked("estimate"),
      memorized: checked("surah"),
      memorized_more: $("more").checked,
      lessons_per_week: Number(picked("per_week")) || undefined,
      lang: I.lang,
    };
    if (!$("mem-from-field").hidden) p.memorized_from = picked("mem_from");
    if (p.estimate === "mushaf") p.tajweed = tajweedOf("tj");
    const likes = Object.fromEntries(O.LIKES_QS.map((q) => [q.id, picked(`lk_${q.id}`)]).filter(([, v]) => v));
    if (Object.keys(likes).length) p.likes = likes;
    if (picked("motivation")) p.motivation = picked("motivation");
    const missing = [];
    if (!p.age_band) missing.push(t("m_age"));
    if (!p.country) missing.push(t("m_country"));
    if (!p.home_language) missing.push(t("m_lang"));
    if (!p.goals.length) missing.push(t("m_goal"));
    if (!p.teacher) missing.push(t("m_teacher"));
    if (!p.estimate) missing.push(t("m_estimate"));
    if (!p.lessons_per_week) missing.push(t("m_per_week"));
    if (!$("mem-from-field").hidden && !p.memorized_from) missing.push(t("m_mem_from"));
    if (missing.length) {
      $("about-error").textContent = missingText(missing);
      $("about-error").hidden = false;
      return;
    }
    $("about-error").hidden = true;
    profile = p;
    // A reader takes the assessment; a child who stumbles badly on its first short ayah, or who does not read yet,
    // takes the foundational games.
    if (!A.isReader(profile)) return play();
    assess().then((st) => {
      if (st.stop) return play({ check: st.check });
      stages = st;
      save();
    });
  });

  // ---------- the adult track ----------
  function buildAdult() {
    chips("ad-age", "ad_age", O.ADULT_AGE_BANDS.map((a) => ({ value: a, label: `⁦${a}⁩` })));
    fillCountries("ad-country");
    chips("ad-juz", "ad_juz", O.ADULT_JUZ.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("ad-goal", "ad_goal", O.ADULT_GOALS.map((x) => ({ value: x.id, label: I.label(x) })), "checkbox");
    chips("ad-teacher", "ad_teacher", O.TEACHER.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("ad-self", "ad_self", O.ADULT_SELF.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("ad-per-week", "ad_per_week", O.LESSONS_PER_WEEK.map((x) => ({ value: x.id, label: I.label(x) })));
    document.querySelector(`input[name="ad_per_week"][value="${O.DEFAULT_LESSONS_PER_WEEK}"]`).checked = true;
    $("ad-tajweed").innerHTML = tajweedHtml("atj", (q) => I.label(O.TAJWEED_QS_ADULT[q.id]));
  }

  $("adult-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = {
      who: "adult",
      age_band: picked("ad_age"),
      country: $("ad-country").value,
      juz: picked("ad_juz"),
      goals: checked("ad_goal"),
      teacher: picked("ad_teacher"),
      self: picked("ad_self"),
      lessons_per_week: Number(picked("ad_per_week")) || undefined,
      lang: I.lang,
      tajweed: tajweedOf("atj"),
    };
    const missing = [];
    if (!p.age_band) missing.push(t("m_age"));
    if (!p.country) missing.push(t("m_country"));
    if (!p.juz) missing.push(t("m_juz"));
    if (!p.goals.length) missing.push(t("m_goal"));
    if (!p.self) missing.push(t("m_self"));
    if (!p.teacher) missing.push(t("m_teacher"));
    if (!p.lessons_per_week) missing.push(t("m_per_week"));
    if (missing.length) {
      $("adult-error").textContent = missingText(missing);
      $("adult-error").hidden = false;
      return;
    }
    $("adult-error").hidden = true;
    profile = p;
    assess().then((st) => {
      stages = st;
      // How the passages were read decides the adult's ayah rating (and with it the level A1–A3).
      const r = st.recite && st.recite.total ? st.recite : st.check;
      profile.ayah = r.score === r.total ? "easy" : r.score >= r.total / 2 ? "hard" : "no";
      profile.ayah_ref = (st.recite && st.recite.items[0] ? st.recite.items[0] : st.check.items[0]).ref;
      save();
    });
  });

  // ---------- teachers: coming soon ----------
  $("teacher-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("t-email").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $("t-error").textContent = t("t_email_err"); $("t-error").hidden = false; return; }
    if (!$("t-consent").checked) { $("t-error").textContent = t("t_consent_err"); $("t-error").hidden = false; return; }
    $("t-error").hidden = true;
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent: true, lang: I.lang }) });
      if (!res.ok) throw new Error();
      $("teacher-form").hidden = true;
      $("t-done").hidden = false;
    } catch {
      $("t-error").textContent = t("t_save_err");
      $("t-error").hidden = false;
    }
  });

  // ---------- games ----------
  const name = () => (profile.nickname ? profile.nickname : t("hero"));
  function frame(label, title, total, done) {
    show("game");
    $("g-label").textContent = label;
    $("g-title").textContent = title;
    $("dots").innerHTML = Array.from({ length: total }, (_, i) => `<span class="${i < done ? "done" : ""}"></span>`).join("");
    window.scrollTo({ top: 0 });
  }

  // One multiple-choice round; resolves with the picked option, or null when the grown-up skips.
  // `stage` is recorded with the time to answer and whether the hint was opened.
  function choiceRound(stage, promptHtml, options, canSkip) {
    return new Promise((resolve) => {
      $("g-body").innerHTML = `${promptHtml}
        <div class="choices${["find", "madd", "qalqalah"].includes(stage) ? " quran" : ""}" dir="rtl">${options.map((o, i) => `<button class="choice" data-i="${i}" lang="ar">${esc(o)}</button>`).join("")}</div>
        ${canSkip ? `<button class="btn secondary" id="skip">${esc(t("skip"))}</button>` : ""}`;
      rec.shown(stage);
      const cue = $("g-body").querySelector("details");
      if (cue) cue.addEventListener("toggle", () => { if (cue.open) rec.hint(); });
      $("g-body").querySelectorAll(".choice").forEach((b) =>
        b.addEventListener("click", () => {
          b.classList.add("picked");
          $("g-body").querySelectorAll("button").forEach((x) => (x.disabled = true));
          setTimeout(() => resolve(options[Number(b.dataset.i)]), 300);
        })
      );
      if (canSkip) $("skip").addEventListener("click", () => { rec.skipped(); resolve(null); });
    });
  }

  // The grown-up confirms each reading.
  function readRounds(stage, words, label, title, prompt, cls) {
    return new Promise((resolve) => {
      let i = 0, score = 0;
      const next = () => {
        frame(label, title, words.length, i);
        if (i >= words.length) return resolve({ score, total: words.length });
        const item = typeof words[i] === "string" ? { text: words[i] } : words[i];
        $("g-body").innerHTML = `
          <p>${esc(prompt)}</p>
          <div class="word ${cls}" lang="ar" dir="rtl">${esc(item.text)}</div>
          ${item.caption ? `<p class="small muted center">${esc(item.caption)}</p>` : ""}
          <p class="cue">${esc(t("read_q"))}</p>
          <div class="row"><button class="btn" id="yes">${esc(t("read_yes"))}</button><button class="btn secondary" id="no">${esc(t("read_no"))}</button></div>`;
        rec.shown(stage);
        $("yes").onclick = () => { rec.answered(true); score++; i++; next(); };
        $("no").onclick = () => { rec.answered(false); i++; next(); };
      };
      next();
    });
  }

  async function stageSound() {
    const items = content.sound.items;
    const queue = items.slice(0, items.length - content.sound.reserve_count);
    const reserve = items.slice(items.length - content.sound.reserve_count);
    const total = queue.length;
    let score = 0, answered = 0, skips = 0;
    while (queue.length) {
      frame(t("s1_label"), t("s1_title"), total, answered);
      const it = queue.shift();
      const letterName = I.lang === "en" ? `${esc(it.name_latin)} (<span lang="ar">${esc(it.letter)}</span>)` : `${esc(it.name_ar || it.letter)} (${esc(it.letter)})`;
      const pick = await choiceRound("sound",
        `<p>${esc(t("s1_prompt", { name: name() }))}</p>
         <details class="cue"><summary>${esc(t("s1_cue_sum"))}</summary>${t("s1_cue", { letter: `<b>${letterName}</b>` })}</details>`,
        shuffle(it.choices),
        skips < 2 && reserve.length > 0
      );
      if (pick === null) { skips++; queue.push(reserve.shift()); continue; }
      answered++;
      rec.answered(pick === it.letter);
      if (pick === it.letter) score++;
    }
    return { score, total, passed: score >= L.PASS.sound };
  }

  async function stageShape() {
    const items = content.shape.items;
    let score = 0;
    for (let i = 0; i < items.length; i++) {
      frame(t("s2_label"), t("s2_title"), items.length, i);
      const it = items[i];
      const pick = await choiceRound("shape",
        `<div class="big-letter quran" lang="ar">${esc(it.letter)}</div><p class="center">${esc(t("s2_prompt"))}</p>`,
        shuffle(it.choices),
        false
      );
      rec.answered(pick === it.answer);
      if (pick === it.answer) score++;
    }
    return { score, total: items.length, passed: score >= L.PASS.shape };
  }

  async function stageWords(key, n, cls, getText) {
    const words = content[key].items.map(getText);
    const r = await readRounds(key, words, t(`s${n}_label`), t(`s${n}_title`), t(`s${n}_prompt`), cls);
    return { ...r, passed: r.score >= L.PASS[key] };
  }

  // Find the word: the ayah's words as buttons, the word to find above them.
  async function stageFind() {
    const items = content.find.items;
    let score = 0;
    for (let i = 0; i < items.length; i++) {
      frame(t("s7_label"), t("s7_title"), items.length, i);
      const it = items[i];
      const pick = await choiceRound("find",
        `<p>${esc(t("s7_prompt"))}</p><div class="word quran" lang="ar" dir="rtl">${esc(it.answer)}</div><p class="small muted center">${esc(t("from_surah", { surah: it.surah_name, ref: it.ref }))}</p>`,
        it.words,
        false
      );
      rec.answered(pick === it.answer);
      if (pick === it.answer) score++;
    }
    return { score, total: items.length, passed: score >= L.PASS.find };
  }

  // Which word has madd: three words from Al-Fatiha, one with a natural madd.
  async function stageMadd() {
    const items = content.madd.items;
    let score = 0;
    for (let i = 0; i < items.length; i++) {
      frame(t("s8_label"), t("s8_title"), items.length, i);
      const it = items[i];
      const pick = await choiceRound("madd", `<p>${esc(t("s8_prompt"))}</p>`, shuffle(it.choices), false);
      rec.answered(pick === it.answer);
      if (pick === it.answer) score++;
    }
    return { score, total: items.length, passed: score >= L.PASS.madd };
  }

  // ---------- the assessment of a reader (a child who reads words or the Mushaf, or an adult) ----------
  // No letter games and no single words. A short reading check; then three passages that get harder after a clean
  // reading and easier after many mistakes; whether rules were applied in each passage; eight Tajweed questions whose
  // difficulty adapts the same way; memorization. A child's parent rates the reading; an adult rates their own.
  // Every item is kept (skill, ayah, word, result) for the per-skill report (public/js/skills.js).
  const SK = window.QuranaSkills;
  const tw = (k, v) => (profile && profile.who === "adult" && I.T.ar[`${k}_adult`] !== undefined ? t(`${k}_adult`, v) : t(k, v));
  const RATED = ["right", "partial", "wrong"];
  const caption = (x) => `<p class="small muted center">${esc(t("from_surah", { surah: x.surah_name, ref: x.ref }))}</p>`;
  // The ayah with the given word positions marked (pause marks are not words).
  function marked(tokens, positions, labels = {}) {
    let w = 0;
    return tokens.map((tok) => {
      if (!/[ء-يٱ]/.test(tok)) return esc(tok);
      w++;
      if (!positions.includes(w)) return esc(tok);
      return `<mark>${esc(tok)}${labels[w] ? `<sup>${labels[w]}</sup>` : ""}</mark>`;
    }).join(" ");
  }
  function rateRound(stage, html, keys) {
    return new Promise((resolve) => {
      $("g-body").innerHTML = `${html}<div class="row">${keys.map((k, i) => `<button class="btn${i ? " secondary" : ""}" data-i="${i}">${esc(tw(k))}</button>`).join("")}</div>`;
      rec.shown(stage);
      $("g-body").querySelectorAll("button[data-i]").forEach((b) => b.addEventListener("click", () => { rec.answered(b.dataset.i === "0"); resolve(Number(b.dataset.i)); }));
    });
  }
  const passageHtml = (x, promptKey, hint) => `<p>${esc(tw(promptKey))}</p><div class="word quran ayah" lang="ar" dir="rtl">${esc(x.text)}</div>${caption(x)}${hint ? `<p class="small muted center">${esc(t("a1_hint"))}</p>` : ""}`;
  const pointsOf = (items) => items.reduce((n, x) => n + (x.result === "right" ? 2 : x.result === "partial" ? 1 : 0), 0);

  // Application: the places in the passage the listener can hear, numbered; each is applied / not applied / not sure.
  function applyRound(x) {
    return new Promise((resolve) => {
      const spots = x.apply;
      const labels = {};
      spots.forEach((s, i) => s.words.forEach((w) => (labels[w] = labels[w] || String(i + 1))));
      const answers = new Array(spots.length).fill(null);
      $("g-body").innerHTML = `<p>${esc(tw("ap_prompt"))}</p>
        <div class="word quran ayah rule-ayah" lang="ar" dir="rtl">${marked(x.tokens, spots.flatMap((s) => s.words), labels)}</div>${caption(x)}
        <div class="apply-list">${spots.map((s, i) => `
          <div class="apply-row" data-i="${i}"><p><b>${i + 1}.</b> <span class="quran" lang="ar">${esc(s.word)}</span> — ${esc(SK.label(s.skill, I.lang))}</p>
          <div class="chips">${["right", "wrong", "unsure"].map((r) => `<label><input type="radio" name="ap_${i}" value="${r}"> ${esc(tw(r === "right" ? "ap_yes" : r === "wrong" ? "ap_no" : "ap_unsure"))}</label>`).join("")}</div></div>`).join("")}</div>
        <button class="btn" id="ap-next" disabled>${esc(t("ap_next"))}</button>`;
      rec.shown("apply");
      $("g-body").querySelectorAll(".apply-row input").forEach((inp) => inp.addEventListener("change", () => {
        answers[Number(inp.name.slice(3))] = inp.value;
        $("ap-next").disabled = answers.some((a) => a === null);
      }));
      $("ap-next").addEventListener("click", () => resolve(spots.map((s, i) => ({ skill: s.skill, ref: x.ref, word: s.word, d: x.d, result: answers[i] }))));
    });
  }

  async function assess() {
    rec = S.recorder();
    const pool = A.assessmentPool(content, profile);
    const usedSurahs = new Set();
    const adult = profile.who === "adult";

    // 1. The reading check: one short ayah.
    const first = A.nextPassage(pool, 1, usedSurahs);
    usedSurahs.add(first.surah);
    frame(tw("a0_label"), tw("a0_title"), 1, 0);
    const r0 = RATED[await rateRound("check", passageHtml(first, "a0_prompt"), ["rate_none", "rate_few", "rate_many"])];
    const checkItems = [{ skill: `recite_${first.d}`, ref: first.ref, d: first.d, result: r0 }];
    const st = { check: { score: pointsOf(checkItems), total: 2, passed: r0 !== "wrong", items: checkItems } };
    // A child who stumbles badly on a short ayah goes to the foundational games instead.
    if (!adult && r0 === "wrong") return { ...st, stop: true };

    // 2. Recitation, harder or easier with each passage, and the rules heard in it.
    let level = r0 === "wrong" ? 1 : pool.start;
    const recite = [], apply = [];
    for (let i = 0; i < A.RECITE_COUNT; i++) {
      const x = A.nextPassage(pool, level, usedSurahs);
      if (!x) break;
      usedSurahs.add(x.surah);
      frame(tw("a1_label"), tw("a1_title"), A.RECITE_COUNT, i);
      const res = RATED[await rateRound("recite", passageHtml(x, "a1_prompt", i < A.RECITE_COUNT - 1), ["rate_none", "rate_few", "rate_many"])];
      recite.push({ skill: `recite_${x.d}`, ref: x.ref, d: x.d, result: res });
      if (x.apply.length && res !== "wrong") {
        frame(tw("ap_label"), tw("ap_title"), A.RECITE_COUNT, i);
        apply.push(...(await applyRound(x)));
      }
      level = A.step(level, res);
    }
    st.recite = { score: pointsOf(recite), total: recite.length * 2, passed: L.passed("recite", pointsOf(recite), recite.length * 2), items: recite };
    const heard = apply.filter((x) => x.result !== "unsure");
    if (apply.length) st.apply = { score: heard.filter((x) => x.result === "right").length, total: heard.length, passed: false, items: apply };

    // 3. Tajweed rules: name the rule at a marked place (or pick the word with qalqalah).
    level = pool.start;
    const used = { items: new Set(), refs: new Set(), skills: new Set() };
    const rules = [];
    for (let i = 0; i < A.SLOTS.length; i++) {
      const q = A.nextRule(pool, i, level, used);
      if (!q) break;
      used.items.add(q); used.refs.add(q.ref); used.skills.add(q.skill);
      frame(tw("a2_label"), tw("a2_title"), A.SLOTS.length, i);
      const isWordQ = q.kind === "qalqalah";
      const labels = isWordQ ? q.choices : q.choices.map((c) => SK.label(c, I.lang));
      const pick = await choiceRound(isWordQ ? "qalqalah" : "rules", `<p>${esc(t(`a2_q_${q.kind}`))}</p><div class="word quran ayah rule-ayah" lang="ar" dir="rtl">${marked(q.tokens, q.words)}</div>${caption(q)}`, labels, false);
      const right = isWordQ ? pick === q.answer : pick === SK.label(q.answer, I.lang);
      rec.answered(right);
      const res = right ? "right" : "wrong";
      rules.push({ skill: q.skill, ref: q.ref, word: q.word, d: q.d, result: res });
      level = A.step(level, res);
    }
    if (rules.length) {
      const score = rules.filter((x) => x.result === "right").length;
      st.rules = { score, total: rules.length, passed: L.passed("rules", score, rules.length), items: rules };
    }

    // 4. Memorization: beyond the short surahs when the reader memorizes more, and one short surah.
    const hifz = [];
    for (const [i, it] of A.pickHifz(pool, usedSurahs).entries()) {
      frame(tw("a3_label"), tw("a3_title"), 2, i);
      const known = await new Promise((resolve) => {
        $("g-body").innerHTML = `${it.beyond ? `<p class="small muted">${esc(tw("a3_beyond"))}</p>` : ""}<p>${esc(tw("a3_prompt", { surah: it.surah_name }))}</p>
          <div class="word quran" lang="ar" dir="rtl">${esc(it.opening)} …</div>
          <div class="row"><button class="btn" id="reveal">${esc(t("a3_reveal"))}</button>${it.beyond ? `<button class="btn secondary" id="not-known">${esc(tw("hifz_not"))}</button>` : ""}</div>`;
        $("reveal").addEventListener("click", () => resolve(true));
        if (it.beyond) $("not-known").addEventListener("click", () => resolve(false));
      });
      if (!known) { hifz.push({ skill: "hifz", ref: it.ref, result: "not_memorized" }); continue; }
      const k = await rateRound("hifz", `<div class="word quran ayah" lang="ar" dir="rtl">${esc(it.text)}</div>${caption(it)}`, ["hifz_ok", "hifz_some", "hifz_no"]);
      hifz.push({ skill: "hifz", ref: it.ref, result: RATED[k] });
    }
    if (hifz.length) {
      const asked = hifz.filter((x) => x.result !== "not_memorized");
      const score = asked.filter((x) => x.result === "right").length;
      st.hifz = { score, total: asked.length, passed: L.passed("hifz", score, asked.length), items: hifz };
    }
    return st;
  }

  const PLAY = {
    sound: stageSound,
    shape: stageShape,
    fatha: () => stageWords("fatha", 3, "", (w) => w.word),
    harakat: () => stageWords("harakat", 4, "", (w) => w.word),
    fatiha: () => stageWords("fatiha", 5, "quran", (w) => ({ text: w.text, caption: t("from_surah", { surah: w.surah_name, ref: w.ref }) })),
    ayah: () => stageWords("ayah", 6, "quran ayah", (w) => ({ text: w.text, caption: t("from_surah", { surah: w.surah_name, ref: w.ref }) })),
    find: stageFind,
    madd: stageMadd,
  };

  async function play(before = {}) {
    rec = rec || S.recorder();
    // The test adapts to the parent's answers: where it starts and which ayat it uses (public/js/adaptive.js).
    content = A.pickContent(content, profile);
    profile.start_stage = A.startFor(profile);
    // After a hard reading check, no higher than the three short vowels.
    if (before.check) profile.start_stage = L.STAGES[Math.min(L.STAGES.indexOf(profile.start_stage), L.STAGES.indexOf("harakat"))];
    const result = await L.runStages(profile.start_stage, (key) => PLAY[key]());
    stages = { ...before, ...result.stages };
    // A child who reads (passed reading words from the Quran, or started above it) also gets the harder games.
    if (stages.fatiha && stages.fatiha.passed) {
      for (const key of L.READER_STAGES) stages[key] = await PLAY[key]();
    }
    save();
  }

  // ---------- save → result page ----------
  async function save() {
    show("saving");
    $("retry").hidden = true;
    $("saving-text").textContent = t("saving_wait");
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, stages, ...(rec && { signals: rec.summary() }) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { id } = await res.json();
      try { localStorage.setItem("qurana.lastResult", id); } catch { /* storage blocked */ }
      location.href = `/r/${id}?lang=${I.lang}`;
    } catch {
      $("saving-text").textContent = t(profile && profile.who === "adult" ? "save_err_adult" : "save_err");
      $("retry").hidden = false;
    }
  }
  $("retry").addEventListener("click", save);
})();
