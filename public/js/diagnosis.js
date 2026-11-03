// Qurana diagnostic page: consent → about the child → adaptive games → save → result page.
(function () {
  const L = window.QuranaLevels;
  const O = window.QuranaOptions;
  const I = window.QuranaI18n;
  const t = I.t;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const show = (id) => ["welcome", "about", "game", "saving"].forEach((s) => ($(s).hidden = s !== id));

  I.apply();
  let content = null;
  let profile = null;
  let stages = null;

  // ---------- welcome ----------
  $("start").addEventListener("click", async () => {
    if (!$("consent").checked) { $("consent-error").textContent = t("consent_err"); $("consent-error").hidden = false; return; }
    $("consent-error").hidden = true;
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
    buildAbout();
    show("about");
    window.scrollTo({ top: 0 });
  });

  // ---------- about the child ----------
  function chips(id, name, items, type = "radio") {
    $(id).innerHTML = items
      .map((it) => `<label${it.ar ? ' lang="ar"' : ""}><input type="${type}" name="${name}" value="${esc(it.value)}"> ${esc(it.label)}</label>`)
      .join("");
  }
  function buildAbout() {
    chips("age", "age", O.AGE_BANDS.map((a) => ({ value: a, label: `${a} ${t("age_unit")}` })));
    $("country").innerHTML = `<option value="">${esc(t("choose_country"))}</option>` + O.COUNTRIES.map((c) => `<option value="${c.code}">${esc(I.label(c, "name"))}</option>`).join("");
    try { $("country").value = O.countryFromZone(Intl.DateTimeFormat().resolvedOptions().timeZone) || ""; } catch { /* no time zone */ }
    chips("lang", "lang", O.HOME_LANGUAGES.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("goal", "goal", O.GOALS.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("surahs", "surah", O.SURAHS.map((s) => ({ value: s.ar, label: I.lang === "en" ? s.en : s.ar })), "checkbox");
    chips("teacher", "teacher", O.TEACHER.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("estimate", "estimate", L.ESTIMATES.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("mem-from", "mem_from", O.MEM_SOURCES.map((x) => ({ value: x.id, label: I.label(x) })));
    chips("per-week", "per_week", O.LESSONS_PER_WEEK.map((x) => ({ value: x.id, label: I.label(x) })));
    $("tajweed").innerHTML = O.TAJWEED_QS.map((q) => `
      <div><p class="small">${esc(I.label(q))}</p>
      <div class="chips">${O.TAJWEED_ANSWERS.map((a) => `<label><input type="radio" name="tj_${q.id}" value="${a.id}"> ${esc(I.label(a))}</label>`).join("")}</div></div>`).join("");
    // Where the memorization came from: only when surahs are listed. Tajweed basics: only for a child who reads from the Mushaf.
    const memToggle = () => ($("mem-from-field").hidden = !document.querySelector('input[name="surah"]:checked') && !$("more").checked);
    $("surahs").addEventListener("change", memToggle);
    $("more").addEventListener("change", memToggle);
    $("estimate").addEventListener("change", () => ($("tajweed-field").hidden = picked("estimate") !== "mushaf"));
  }
  const picked = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;

  $("about-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = {
      nickname: $("nickname").value.trim(),
      age_band: picked("age"),
      country: $("country").value,
      home_language: picked("lang"),
      goal: picked("goal"),
      teacher: picked("teacher"),
      estimate: picked("estimate"),
      memorized: [...document.querySelectorAll('input[name="surah"]:checked')].map((x) => x.value),
      memorized_more: $("more").checked,
      lessons_per_week: Number(picked("per_week")) || undefined,
      lang: I.lang,
    };
    if (!$("mem-from-field").hidden) p.memorized_from = picked("mem_from");
    if (p.estimate === "mushaf") p.tajweed = Object.fromEntries(O.TAJWEED_QS.map((q) => [q.id, picked(`tj_${q.id}`) || "unsure"]));
    const missing = [];
    if (!p.age_band) missing.push(t("m_age"));
    if (!p.country) missing.push(t("m_country"));
    if (!p.home_language) missing.push(t("m_lang"));
    if (!p.goal) missing.push(t("m_goal"));
    if (!p.teacher) missing.push(t("m_teacher"));
    if (!p.estimate) missing.push(t("m_estimate"));
    if (!p.lessons_per_week) missing.push(t("m_per_week"));
    if (!$("mem-from-field").hidden && !p.memorized_from) missing.push(t("m_mem_from"));
    if (missing.length) {
      $("about-error").textContent = t("missing") + missing.join(I.lang === "en" ? ", " : "، ") + (I.lang === "en" ? "." : ".");
      $("about-error").hidden = false;
      return;
    }
    $("about-error").hidden = true;
    profile = p;
    play();
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
  function choiceRound(promptHtml, options, canSkip) {
    return new Promise((resolve) => {
      $("g-body").innerHTML = `${promptHtml}
        <div class="choices" dir="rtl">${options.map((o, i) => `<button class="choice" data-i="${i}" lang="ar">${esc(o)}</button>`).join("")}</div>
        ${canSkip ? `<button class="btn secondary" id="skip">${esc(t("skip"))}</button>` : ""}`;
      $("g-body").querySelectorAll(".choice").forEach((b) =>
        b.addEventListener("click", () => {
          b.classList.add("picked");
          $("g-body").querySelectorAll("button").forEach((x) => (x.disabled = true));
          setTimeout(() => resolve(options[Number(b.dataset.i)]), 300);
        })
      );
      if (canSkip) $("skip").addEventListener("click", () => resolve(null));
    });
  }

  // The grown-up confirms each reading.
  function readRounds(words, label, title, prompt, cls) {
    return new Promise((resolve) => {
      let i = 0, score = 0;
      const next = () => {
        frame(label, title, words.length, i);
        if (i >= words.length) return resolve({ score, total: words.length });
        $("g-body").innerHTML = `
          <p>${esc(prompt)}</p>
          <div class="word ${cls}" lang="ar" dir="rtl">${esc(words[i])}</div>
          <p class="cue">${esc(t("read_q"))}</p>
          <div class="row"><button class="btn" id="yes">${esc(t("read_yes"))}</button><button class="btn secondary" id="no">${esc(t("read_no"))}</button></div>`;
        $("yes").onclick = () => { score++; i++; next(); };
        $("no").onclick = () => { i++; next(); };
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
      const picked = await choiceRound(
        `<p>${esc(t("s1_prompt", { name: name() }))}</p>
         <details class="cue"><summary>${esc(t("s1_cue_sum"))}</summary>${t("s1_cue", { letter: `<b>${letterName}</b>` })}</details>`,
        shuffle(it.choices),
        skips < 2 && reserve.length > 0
      );
      if (picked === null) { skips++; queue.push(reserve.shift()); continue; }
      answered++;
      if (picked === it.letter) score++;
    }
    return { score, total, passed: score >= L.PASS.sound };
  }

  async function stageShape() {
    const items = content.shape.items;
    let score = 0;
    for (let i = 0; i < items.length; i++) {
      frame(t("s2_label"), t("s2_title"), items.length, i);
      const it = items[i];
      const picked = await choiceRound(
        `<div class="big-letter quran" lang="ar">${esc(it.letter)}</div><p class="center">${esc(t("s2_prompt"))}</p>`,
        shuffle(it.choices),
        false
      );
      if (picked === it.answer) score++;
    }
    return { score, total: items.length, passed: score >= L.PASS.shape };
  }

  async function stageWords(key, n, cls, getText) {
    const words = content[key].items.map(getText);
    const r = await readRounds(words, t(`s${n}_label`), t(`s${n}_title`), t(`s${n}_prompt`), cls);
    return { ...r, passed: r.score >= L.PASS[key] };
  }

  const PLAY = {
    sound: stageSound,
    shape: stageShape,
    fatha: () => stageWords("fatha", 3, "", (w) => w.word),
    harakat: () => stageWords("harakat", 4, "", (w) => w.word),
    fatiha: () => stageWords("fatiha", 5, "quran", (w) => w.text),
    ayah: () => stageWords("ayah", 6, "quran ayah", (w) => w.text),
  };

  async function play() {
    const result = await L.runStages(L.startStage(profile.estimate), (key) => PLAY[key]());
    stages = result.stages;
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
        body: JSON.stringify({ profile, stages }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { id } = await res.json();
      try { localStorage.setItem("qurana.lastResult", id); } catch { /* storage blocked */ }
      location.href = `/r/${id}?lang=${I.lang}`;
    } catch {
      $("saving-text").textContent = t("save_err");
      $("retry").hidden = false;
    }
  }
  $("retry").addEventListener("click", save);
})();
