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
  profile: { nickname: "Zaid", age_band: "6–7", home_language: "ar", goals: ["hifz"], memorized: ["الفاتحة"], memorized_more: false, memorized_from: "listening", lessons_per_week: 3, teacher: "female" },
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
  check("P2. the link is public only when approved with a reviewer's name and a date",
    !curriculum.isPublic({ ...c, status: "draft" }) && !curriculum.isPublic({ ...c, status: "approved", approved_by: "", approved_at: "2026-11-03" })
    && curriculum.isPublic({ ...c, status: "approved", approved_by: "Sara Zaalouk", approved_at: "2026-11-03" }));

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
  p = curriculum.path(c, "R3", ["hifz", "tajweed"], "arabic");
  check("P27. two goals: the foundations, then both programs, up to the furthest goal",
    ids(p.stages) === "L1-S3,L1-S4,L1-S5,L1-S6,L1-S7,L1-S8,L1-S9,L2-S1,L3-S1,L3-S2,L3-S3,L4-S1,L4-S2,L4-S3", ids(p.stages));
  p = curriculum.path(c, "R6", ["read", "tajweed"], "arabic");
  check("P28. a goal already passed does not stop the others", ids(p.stages) === "L4-S1,L4-S2,L4-S3" && !p.reached, ids(p.stages));
  const mixed = { ...c, stages: c.stages.map((s) => (s.id === "L1-S5" ? { ...s, track: "english" } : s)) };
  check("P7. a stage for the other track is left out", !ids(curriculum.path(mixed, "R3", "hifz", "arabic").stages).includes("L1-S5"));
  const t = curriculum.totals(curriculum.path(c, "R3", "hifz", "arabic").stages, 3);
  check("P8. lessons are added from the curriculum and weeks = lessons ÷ lessons a week, rounded up", t.sessions === 100 && t.weeks === 34 && t.per_week === 3, JSON.stringify(t));


  // ---- from the actual level: memorized surahs, Tajweed alongside ----
  const four = ["الفاتحة", "الإخلاص", "الفلق", "الناس"];
  p = curriculum.path(c, "R6", ["hifz"], "arabic", { memorized: four, reads: true, tajweed: { madd: "sometimes", ghunnah: "no", qalqalah: "yes" } });
  check("P31. a child who memorizes the four surahs does not get their stage", !ids(p.stages).includes("L3-S1") && p.stages[0].id === "L3-S2", ids(p.stages));
  check("P32. the next stage (Al-Masad to Ad-Duha) has none of those surahs again: no review, all its lessons",
    !p.stages[0].review && p.stages[0].sessions === 20, `${p.stages[0].review} / ${p.stages[0].sessions}`);
  const all = c.stages.filter((s) => s.surahs).flatMap((s) => s.surahs);
  check("P54. no surah is in two memorization stages", all.length === new Set(all).size);
  const part = curriculum.path(c, "R6", ["hifz"], "arabic", { memorized: ["الفاتحة", "المسد", "النصر"], reads: true }).stages;
  check("P55. partly memorized stages keep the rest, with fewer lessons in proportion, and review what is memorized",
    part[0].id === "L3-S1" && part[0].review.join(",") === "الفاتحة" && part[0].sessions === Math.ceil((6 * 3) / 4)
    && part[1].review.join(",") === "المسد,النصر" && part[1].sessions === Math.ceil((20 * 17) / 19), part.slice(0, 2).map((s) => `${s.id} ${s.review} ${s.sessions}`).join(" | "));
  check("P33. a reader gets Tajweed alongside each memorization stage, starting with the \"no\" answer, then \"sometimes\"",
    p.stages.map((s) => s.with_focus).join(",") === "ghunnah,madd", p.stages.map((s) => s.with_focus).join(","));
  p = curriculum.path(c, "R6", ["hifz", "tajweed"], "arabic", { reads: true, tajweed: { madd: "no", ghunnah: "no", qalqalah: "no" } });
  check("P34. memorization + Tajweed for a reader: the Tajweed stages are not added after, they go alongside", !p.stages.some((s) => s.program === "tajweed") && p.stages.every((s) => s.with_focus), ids(p.stages));
  p = curriculum.path(c, "R3", ["hifz", "tajweed"], "arabic", { reads: false, tajweed: { madd: "no" } });
  check("P35. a beginner gets no Tajweed alongside (the Tajweed stages stay after the foundations)", !p.stages.some((s) => s.with_focus) && p.stages.some((s) => s.program === "tajweed"));
  p = curriculum.path(c, "R6", ["hifz"], "arabic", { reads: true, tajweed: { madd: "yes", ghunnah: "yes", qalqalah: "yes" } });
  check("P36. three \"yes\" answers: no Tajweed point needed", !p.stages.some((s) => s.with_focus));
  check("P37. every surah of the memorization stages memorized: reached", curriculum.path(c, "R6", ["hifz"], "arabic", { memorized: c.stages.filter((s) => s.surahs).flatMap((s) => s.surahs), reads: true }).reached === true);

  // ---- the time windows ----
  const wroute = curriculum.path(c, "R3", "hifz", "arabic").stages;
  const win = curriculum.windows(wroute, 3);
  check("P38. the first month holds the stages begun in the first 12 lessons (4 weeks × 3)", win.month1.join(",") === "L1-S3,L1-S4,L1-S5", win.month1.join(","));
  check("P39. after about three months: the stage that holds lesson 39 (13 weeks × 3); further on: the last stage", win.month3 === "L2-S1" && win.longer === "L3-S3", `${win.month3} / ${win.longer}`);
  check("P40. the totals at both rates", JSON.stringify(curriculum.totals(wroute, 2).weeks_at) === JSON.stringify({ 2: 50, 3: 34 }));

  // ---- the validator ----
  const route = curriculum.path(c, "R6", "tajweed", "arabic").stages;
  const tot = curriculum.totals(route, 3);
  const r6 = { ...record, level: "R6", profile: { ...record.profile, goals: ["tajweed"] } };
  const allowed = plan.allowedNumbers(route, tot, r6);
  const good = {
    month1: "يقرأ طفلكم من المصحف. في الشهر الأول نبدأ بالمد في سورة الفاتحة.",
    month3: "بعد ثلاثة أشهر تقريبًا نتوقع أن يطبّق الغنة في قراءته.",
    longer: "على المدى الأبعد يطبّق طفلكم ما تعلّمه عند الوقف في قراءته.",
    tip: "دقائق قليلة هادئة في أغلب الأيام.",
  };
  const problems = (reply, lang = "ar") => plan.validateReply(reply, lang, allowed);
  check("P9. a good reply passes (numbers from the path are allowed)", problems(good).length === 0, problems(good).join("; "));
  check("P10. an empty window is refused", problems({ ...good, month3: "" }).length > 0);
  check("P12. a number that is not in the path is refused", problems({ ...good, month1: "خطة من 12 حصة." }).some((x) => x.includes("12")));
  check("P13. Arabic-Indic digits are checked too", problems({ ...good, tip: "تدرّب ٤٥ دقيقة." }).some((x) => x.includes("45")));
  check("P14. a promise of a duration is refused", problems({ ...good, month1: "سيتقن التجويد بسرعة." }).length > 0);
  check("P15. quoted Quran text is refused", problems({ ...good, month1: "اقرأ معه: بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" }).length > 0);
  check("P16. Arabic script in the English plan is refused", problems({ ...good, tip: "Practise الحروف daily." }, "en").length > 0);
  check("P17. a long window is refused", problems({ ...good, longer: "ا".repeat(400) }).length > 0);
  check("P53. the totals are not repeated in the windows (the page states them once)", problems({ ...good, longer: `المسار كله ${tot.sessions} حصة، نحو ${tot.weeks_at[2]} أسابيع.` }).length > 0);
  // ---- concise, non-repetitive text (voice.md «قواعد الإيجاز») ----
  const has = (reply, part, opts) => plan.validateReply(reply, "ar", allowed, opts).some((x) => x.includes(part));
  check("P56. a window of three sentences is refused", has({ ...good, month1: "يقرأ طفلكم. نبدأ بالمد. ثم نكمل." }, "sentences"));
  check("P57. a window of more than about 35 words is refused", has({ ...good, month3: Array(40).fill("كلمة").join(" ") }, "words"));
  check("P58. a window that repeats the stage names in the chip above it is refused",
    has({ ...good, month1: "نبدأ بالغنة والنون الساكنة والتنوين مع طفلكم." }, "stage names", { chips: { month1: ["الغنة والنون الساكنة والتنوين"] } }));
  check("P59. «تقدير لا وعد» and «تراجعها المعلمة» are refused in the windows and the tip",
    has({ ...good, longer: "والمدة تقدير لا وعد." }, "تقدير لا وعد") && has({ ...good, tip: "تراجعها المعلمة معكم." }, "تراجعها المعلمة"));
  check("P60. …but «موعد» and reviewing surahs («تراجع معه ما حفظه») are fine",
    !has({ ...good, tip: "اختاروا موعدًا ثابتًا كل يوم." }, "تقدير") && !has({ ...good, month1: "المعلمة تراجع معه ما حفظه أولًا." }, "تراجعها"));
  check("P61. speaking to the child («تقرأ / تحفظ») is refused; the adult track speaks to the learner",
    has({ ...good, month1: "في الشهر الأول تحفظ سورة جديدة." }, "speaks to the child") && !has({ ...good, month1: "في الشهر الأول تحفظ سورة جديدة." }, "speaks to the child", { adult: true }));
  check("P62. six words in a row from voice.md's samples are refused (tone only, not copying)",
    has({ ...good, month1: "لاحظنا أنه يجيب بسرعة عندما يسمع الحرف." }, "copies"));
  const terms = { terms: ["المد", "الغنة", "الفاتحة"] };
  check("P63. the same Tajweed point in two windows is refused",
    has({ ...good, month1: "نبدأ بالمد مع طفلكم.", month3: "يستمر المد في قراءته." }, "more than one window", terms)
    || has({ ...good, month1: "نبدأ مع طفلكم على المد.", month3: "ويبقى المد معه." }, "more than one window", terms));
  check("P64. the same five words in two windows are refused", has({ ...good, month1: "يقرأ طفلكم الكلمات القصيرة بثقة كل يوم.", month3: "ثم يقرأ طفلكم الكلمات القصيرة بثقة أكبر." }, "repeat the same words"));
  check("P65. the good reply passes every rule", problems(good).length === 0, problems(good).join(" | "));
  const chips = plan.chipsFor(plan.pathFor({ ...r6, profile: { ...r6.profile, goals: ["hifz"], memorized: [], tajweed: { madd: "no" } } }, "ar", approved));
  check("P66. the chip above a window: short stage names and the Tajweed point (no «المراحل:» sentence)",
    chips.month1.join(" · ") === "حفظ الفاتحة والمعوذات والإخلاص · المد · حفظ قصار السور" && chips.longer[0] === "حفظ باقي جزء عمّ", chips.month1.join(" · "));

  check("P41. a phrase from voice.md's banned list is refused", problems({ ...good, month3: "نتقدم خطوة بخطوة مع المراجعة المستمرة." }).some((x) => x.includes("خطوة بخطوة")));
  check("P42. repeating «ذكرتم» across the windows is refused", problems({ ...good, month1: "ذكرتم أنه يقرأ.", month3: "ذكرتم أنه يحفظ." }).length > 0);
  check("P43. labels (types of intelligence, learning styles) are refused", problems({ ...good, month1: "طفلكم من النمط السمعي." }).length > 0);
  const v = plan.voice();
  check("P44. voice.md is read: the guide goes to the model and its banned list to the validator", v.text.includes("طفلكم يقرأ من المصحف بثقة") && v.banned.includes("تحقيقًا لهدف"));

  // ---- the path (instant, rules only) ----
  const st = c.stages.find((s) => s.id === "L4-S1");
  let path = plan.pathFor(r6, "ar", approved);
  check("P18. the path comes from the curriculum with its totals and windows, without the model", path.status === "ready" && path.stages[0].goals === st.goals && path.totals.weeks === tot.weeks && path.windows.longer === "L4-S3" && !("draft" in path));
  path = plan.pathFor(r6, "en", approved);
  check("P24. the English path uses the English stage text", path.stages[0].name === st.name_en);
  check("P25. goal already reached", plan.pathFor({ ...r6, profile: { ...r6.profile, goals: ["read"] } }, "ar", approved).status === "reached");
  check("P26. no path from a curriculum with structural problems", plan.pathFor(record, "ar", { ...c, diagnosis_map: {} }).status === "unavailable");
  const reader = { ...r6, profile: { ...r6.profile, goals: ["hifz"], memorized: [...four, "المسد", "النصر"], tajweed: { madd: "no", ghunnah: "sometimes", qalqalah: "yes" } } };
  path = plan.pathFor(reader, "ar", approved);
  check("P45. the reader's page shows the review and the Tajweed point by name", path.stages[0].review.length === 2 && path.stages[0].focus === "المد", JSON.stringify(path.stages[0]).slice(0, 200));

  // ---- the adult track ----
  const validate = require("../lib/validate").validateSubmission;
  const ad = validate({ profile: { who: "adult", age_band: "26–35", country: "KW", juz: "none", goals: ["hifz"], teacher: "any", self: "fluent", ayah: "easy", lessons_per_week: 3, tajweed: { madd: "no" } } }).value;
  path = plan.pathFor(ad, "ar", approved);
  check("P46. an adult who reads fluently gets the adult path: memorization from the start of the memorization stages, with Tajweed alongside",
    ad.profile.adult_level === "A3" && ad.level === "R6" && path.status === "ready" && path.stages[0].id === "L3-S1" && path.stages[0].focus === "المد", `${ad.profile.adult_level} ${path.status} ${path.stages && path.stages[0].id}`);
  const beginner = validate({ profile: { who: "adult", age_band: "36–50", country: "GB", juz: "none", goals: ["tilawa"], teacher: "female", self: "stumble", ayah: "no", lessons_per_week: 2 } }).value;
  path = plan.pathFor(beginner, "en", approved);
  check("P47. an adult who stumbles strengthens reading from the vowels (not the letters), and correcting recitation leads on to Tajweed", beginner.profile.adult_level === "A1" && path.stages[0].id === "L1-S4" && path.stages[path.stages.length - 1].id === "L4-S3");
  const ijaza = validate({ profile: { who: "adult", age_band: "51+", country: "SA", juz: "more", goals: ["ijaza"], teacher: "male", self: "fluent", ayah: "easy", lessons_per_week: 3 } }).value;
  check("P48. an adult who wants only the Ijazah: the teacher decides (no path)", plan.pathFor(ijaza, "ar", approved).status === "teacher");
  const amma = (goals) => validate({ profile: { who: "adult", age_band: "26–35", country: "KW", juz: "amma", goals, teacher: "any", self: "fluent", ayah: "easy", lessons_per_week: 3, tajweed: { madd: "no" } } }).value;
  check("P67. an adult who knows Juz' Amma by heart: the memorization stages count as done", plan.pathFor(amma(["hifz"]), "ar", approved).status === "reached");
  path = plan.pathFor(amma(["hifz", "tajweed"]), "ar", approved);
  check("P68. …and with Tajweed too, the Tajweed stages remain (there is no memorization stage to go alongside)", path.status === "ready" && path.stages.every((x) => x.program === "tajweed"), path.stages && path.stages.map((x) => x.id).join(","));
  check("P69. the adult form has no language-of-explanation question any more", !("explain_lang" in ad.profile) && ad.profile.juz === "none");

  // ---- tied to the test: each window says which finding it answers ----
  const tied = {
    month1: "أظهر الاختبار أن قراءة الكلمات بالفتح تحتاج إلى عمل، فنبدأ بالمد في سورة الفاتحة.",
    month3: "وبما أن الاختبار بيّن ما يحتاجه، نتوقع بعد ثلاثة أشهر تقريبًا أن يطبّق الغنة في قراءته.",
    longer: "على المدى الأبعد يطبّق طفلكم ما تعلّمه عند الوقف، كما ظهر في الاختبار.",
    tip: good.tip,
  };
  const ev = { evidence: { needs: ["قراءة كلمات بالفتح"] } };
  check("P70. with findings on the page, a window that does not mention the test is refused; one tied to it passes",
    problems({ ...good }).length === 0 && plan.validateReply(good, "ar", allowed, ev).some((x) => x.includes("الاختبار")) && plan.validateReply(tied, "ar", allowed, ev).length === 0,
    plan.validateReply(tied, "ar", allowed, ev).join("; "));
  check("P71. month1 must name something the test found needs work",
    plan.validateReply({ ...tied, month1: "أظهر الاختبار تقدّمًا، فنبدأ بالمد في سورة الفاتحة." }, "ar", allowed, ev).some((x) => x.includes("needs work")));

  // ---- the words (model) ----
  let out = await plan.writeNotes(r6, "ar", { client: fakeClient(tied), curriculumData: approved });
  check("P19. accepted words: three windows and a tip", out.status === "ready" && out.windows.month1 === tied.month1 && out.tip === tied.tip, (out.problems || []).join("; "));
  const sent = JSON.stringify(requests[0]);
  check("P20. the request uses the documented model, sends the path, windows and totals and the voice guide, and no nickname",
    requests[0].model === plan.MODEL && !sent.includes("weeks_at") && sent.includes("windows") && sent.includes("lessons_per_week") && requests[0].system.includes("عبارات ممنوعة") && !sent.includes("Zaid"));
  check("P72. the model is given the level with its reason and what the test found", sent.includes("level_and_reason") && sent.includes("what_the_test_found") && sent.includes("الاختبار"));
  const bad = { ...tied, month1: "خطة من 12 حصة." };
  out = await plan.writeNotes(r6, "ar", { client: fakeClient(bad, tied), curriculumData: approved });
  check("P21. a rejected reply is written once more with the problems listed, and the second one is used",
    requests.length === 2 && requests[1].messages[0].content.includes("rejected") && out.status === "ready");
  out = await plan.writeNotes(r6, "ar", { client: fakeClient(bad, bad), curriculumData: approved });
  check("P22. two rejected replies: the words fail (the page keeps the path without them)", requests.length === 2 && out.status === "failed" && out.problems.length > 0);
  out = await plan.writeNotes(r6, "ar", { client: fakeClient({ stop: "refusal", reply: {} }), curriculumData: approved });
  check("P23. a model refusal: the words fail, no second try", requests.length === 1 && out.status === "failed");
  let tries = 0;
  const flaky = { beta: { messages: { create: async () => { tries++; if (tries === 1) throw new Error("offline"); return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(tied) }] }; } } } };
  out = await plan.writeNotes(r6, "ar", { client: flaky, curriculumData: approved });
  check("P29. an API error is tried once more", tries === 2 && out.status === "ready");
  const offline = { beta: { messages: { create: async () => { throw new Error("offline"); } } } };
  out = await plan.writeNotes(r6, "ar", { client: offline, curriculumData: approved });
  check("P30. two API errors: the words fail", out.status === "failed");

  // ---- "ما لاحظناه" (fixed rules, no labels) ----
  const S = require("../public/js/signals");
  const sig = { kinds: { sound: { n: 6, correct: 6, median_ms: 2000 }, shape: { n: 4, correct: 2, median_ms: 6000 } }, hints: 3, skips: 0, after_error: { n: 2, correct: 2 }, slower_later: true, total_ms: 200000 };
  const o = S.observe(sig, { listening: "yes", moving: "yes" }, "praise", "ar");
  check("P49. hearing faster than seeing: the parent reads it gently, the teacher gets «start with listening»", o.parent[0].includes("يسمع الحرف") && o.teacher.includes("ابدئي بالسمع ثم القراءة."), JSON.stringify(o));
  check("P50. at most three sentences for the parent; practical points for the teacher", o.parent.length <= 3 && o.teacher.some((x) => x.includes("للمدح")) && o.teacher.some((x) => x.includes("انتباهه")));
  const words = JSON.stringify([o, S.observe(sig, {}, "challenge", "en")]);
  check("P51. no labels anywhere (types of intelligence, learning styles)", !S.BANNED_TERMS.some((re) => re.test(words)));
  check("P52. signals from the browser are checked", S.clean(sig) !== null && S.clean({ ...sig, hints: -1 }) === null && S.clean({ ...sig, kinds: { sound: { n: 2, correct: 5, median_ms: 1 } } }) === null);

  console.log(failed ? `\n${failed} plan case(s) failed` : "\nall plan cases behaved as expected");
  process.exit(failed ? 1 : 0);
})();
