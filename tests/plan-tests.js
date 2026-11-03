// The learning plan: the path by rules, the reply validator, the second attempt and the fallback. No real model call. Run: npm test
const curriculum = require("../lib/curriculum");
const plan = require("../lib/plan");

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` -> ${detail}` : ""}`);
};

const c = curriculum.load();
const approved = { ...c, status: "approved" };
const record = {
  level: "R3",
  profile: { nickname: "Zaid", age_band: "6–7", home_language: "ar", goal: "hifz", memorized: ["الفاتحة"], memorized_more: false, memorized_from: "listening", lessons_per_week: 3, teacher: "female" },
  stages: { sound: { passed: true, inferred: true }, shape: { passed: true, inferred: true }, fatha: { score: 1, total: 3, passed: false } },
  suggestion: { track: "arabic", program: "reading", plan: "growth", then: "hifz" },
};
const ids = (stages) => stages.map((s) => s.id).join(",");
let requests = [];
// A stand-in for the model that answers with the given replies in turn.
const fakeClient = (...replies) => {
  requests = [];
  return { beta: { messages: { create: async (req) => {
    requests.push(req);
    const r = replies[Math.min(requests.length - 1, replies.length - 1)];
    return { stop_reason: r.stop || "end_turn", content: [{ type: "text", text: JSON.stringify(r.reply || r) }] };
  } } } };
};

(async () => {
  check("P1. the sample curriculum has no structural problems", curriculum.problems(c).length === 0, curriculum.problems(c).join("; "));
  check("P2. a draft curriculum is not used unless explicitly allowed", !curriculum.usable(c, false) && curriculum.usable(c, true));

  // ---- the path, by rules ----
  let p = curriculum.path(c, "R3", "hifz", "arabic");
  check("P3. hifz from R3: from the fatha stage through the foundations and Mushaf reading to the end of Juz' Amma, no Tajweed stages",
    ids(p.stages) === "L1-S3,L1-S4,L1-S5,L1-S6,L1-S7,L1-S8,L1-S9,L2-S1,L3-S1,L3-S2,L3-S3", ids(p.stages));
  p = curriculum.path(c, "R6", "tajweed", "arabic");
  check("P4. Tajweed from R6: only the Tajweed stages (the memorization stages are another program)", ids(p.stages) === "L4-S1,L4-S2,L4-S3", ids(p.stages));
  p = curriculum.path(c, "R1", "read", "arabic");
  check("P5. reading from R1 ends with the last foundation stage", ids(p.stages) === "L1-S1,L1-S2,L1-S3,L1-S4,L1-S5,L1-S6,L1-S7,L1-S8,L1-S9,L2-S1", ids(p.stages));
  p = curriculum.path(c, "R6", "read", "arabic");
  check("P6. a child already past the goal: no path, marked reached", p.reached === true && p.stages.length === 0);
  const mixed = { ...c, stages: c.stages.map((s) => (s.id === "L1-S5" ? { ...s, track: "english" } : s)) };
  check("P7. a stage for the other track is left out", !ids(curriculum.path(mixed, "R3", "hifz", "arabic").stages).includes("L1-S5"));
  const t = curriculum.totals(curriculum.path(c, "R3", "hifz", "arabic").stages, 3);
  check("P8. lessons are added from the curriculum and weeks = lessons ÷ lessons a week, rounded up", t.sessions === 100 && t.weeks === 34 && t.per_week === 3, JSON.stringify(t));

  // ---- the validator ----
  const route = curriculum.path(c, "R6", "tajweed", "arabic").stages;
  const tot = curriculum.totals(route, 3);
  const r6 = { ...record, level: "R6", profile: { ...record.profile, goal: "tajweed" } };
  const allowed = plan.allowedNumbers(route, tot, r6);
  const good = {
    intro: `خطة مقترحة من ${route.length} مراحل تراجعها المعلمة معكم في الحصة التجريبية.`,
    tip: "دقائق قليلة هادئة في أغلب الأيام.",
    notes: route.map((s) => ({ stage_id: s.id, note: `مرحلة ${s.name} في حوالي ${s.sessions} حصص.` })),
  };
  const problems = (reply, lang = "ar") => plan.validateReply(reply, route, lang, allowed);
  check("P9. a good reply passes (numbers from the path are allowed)", problems(good).length === 0, problems(good).join("; "));
  check("P10. a missing stage is refused", problems({ ...good, notes: good.notes.slice(1) }).length > 0);
  check("P11. stages out of order are refused", problems({ ...good, notes: [...good.notes].reverse() }).length > 0);
  check("P12. a number that is not in the path is refused", problems({ ...good, intro: "خطة من 12 حصة." }).some((x) => x.includes("12")));
  check("P13. Arabic-Indic digits are checked too", problems({ ...good, tip: "تدرّب ٤٥ دقيقة." }).some((x) => x.includes("45")));
  check("P14. a promise of a duration is refused", problems({ ...good, intro: "سيتقن التجويد بسرعة." }).length > 0);
  check("P15. quoted Quran text is refused", problems({ ...good, intro: "اقرأ معه: بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" }).length > 0);
  check("P16. Arabic script in the English plan is refused", problems({ ...good, tip: "Practise الحروف daily." }, "en").length > 0);
  check("P17. a long note is refused", problems({ ...good, notes: [{ ...good.notes[0], note: "ا".repeat(300) }, ...good.notes.slice(1)] }).length > 0);

  // ---- building the plan ----
  let out = await plan.buildPlan(r6, "ar", { client: fakeClient(good), curriculumData: approved });
  const st = c.stages.find((s) => s.id === "L4-S1");
  check("P18. accepted reply: stages and numbers from the curriculum, notes from Claude",
    out.plan.source === "claude" && out.plan.stages[0].goals === st.goals && out.plan.stages[0].note === good.notes[0].note && out.plan.totals.weeks === tot.weeks && out.draft === false);
  const sent = JSON.stringify(requests[0]);
  check("P19. the request uses the documented model, sends the path and totals, and no nickname",
    requests[0].model === plan.MODEL && sent.includes("weeks_estimate") && sent.includes("L4-S1") && !sent.includes("Zaid"));

  const bad = { ...good, intro: "خطة من 12 حصة." };
  out = await plan.buildPlan(r6, "ar", { client: fakeClient(bad, good), curriculumData: approved });
  check("P20. a rejected reply is written once more with the problems listed, and the second one is used",
    requests.length === 2 && requests[1].messages[0].content.includes("rejected") && out.plan.source === "claude");
  out = await plan.buildPlan(r6, "ar", { client: fakeClient(bad, bad), curriculumData: approved });
  check("P21. two rejected replies: the path is shown from the curriculum without notes", requests.length === 2 && out.plan.source === "curriculum" && out.plan.stages.every((s) => s.note === "") && out.plan.totals.weeks === tot.weeks);
  out = await plan.buildPlan(r6, "ar", { client: fakeClient({ stop: "refusal", reply: {} }), curriculumData: approved });
  check("P22. a model refusal: the path from the curriculum, no second try", requests.length === 1 && out.plan.source === "curriculum");
  const offline = { beta: { messages: { create: async () => { throw new Error("offline"); } } } };
  out = await plan.buildPlan(r6, "ar", { client: offline, curriculumData: approved });
  check("P23. an API error: the path from the curriculum", out.plan.source === "curriculum");
  out = await plan.buildPlan(r6, "en", { client: fakeClient(good), curriculumData: approved });
  check("P24. the English plan uses the English stage text", out.plan.stages[0].name === st.name_en);
  out = await plan.buildPlan({ ...r6, profile: { ...r6.profile, goal: "read" } }, "ar", { client: fakeClient(good), curriculumData: approved });
  check("P25. goal already reached: no model call", out.status === "reached" && requests.length === 0);
  if (process.env.ALLOW_DRAFT_CURRICULUM !== "1") {
    out = await plan.buildPlan(record, "ar", { client: fakeClient(good), curriculumData: c });
    check("P26. no plan from a draft curriculum when it is not allowed", out.status === "unavailable");
  }

  console.log(failed ? `\n${failed} plan case(s) failed` : "\nall plan cases behaved as expected");
  process.exit(failed ? 1 : 0);
})();
