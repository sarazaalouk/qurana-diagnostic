// The real routes over HTTP, with results written to a temporary folder. Run: npm test
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qurana-diag-"));
process.env.DATA_STORE_DIR = tmp;
process.env.PUBLIC_BASE_URL = "https://test.quraana-institute.com";
process.env.ALLOW_DRAFT_CURRICULUM = "1";
const app = require("../server");

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` -> ${detail}` : ""}`);
};

const profile = { nickname: "سارة", age_band: "6–7", country: "KW", home_language: "ar", goal: "hifz", teacher: "female", estimate: "words", memorized: ["الفاتحة", "الإخلاص"], memorized_more: false, memorized_from: "listening", lessons_per_week: 3 };

(async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) => fetch(base + "/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  try {
    let r = await fetch(base + "/api/content");
    check("A1. game content is served", r.status === 200 && (await r.json()).fatha.items.length === 3);

    // The browser says "passed" for a 1-of-3 fatha score: the server decides from the score instead.
    const res = await post({ profile, stages: { sound: { passed: true, inferred: true }, shape: { passed: true, inferred: true }, fatha: { score: 1, total: 3, passed: true } } });
    check("A2. a result is saved and gets a fixed link", res.status === 201 && /^https:\/\/test\.quraana-institute\.com\/r\/[a-z0-9]{10}$/.test(res.body.url), JSON.stringify(res.body));

    r = await fetch(`${base}/api/results/${res.body.id}`);
    const got = await r.json();
    check("A3. the level is worked out on the server from the score (1 of 3 fatha → R3)", got.level.code === "R3" && got.stages.fatha.passed === false, got.level.code);
    check("A4. the result has the booking, prices and result links", got.links.booking.endsWith(`/register?diagnosis=${res.body.id}`) && got.links.prices.endsWith("/#plans"));
    check("A5. nothing beyond the answers is stored (no phone or email fields)", !JSON.stringify(got).match(/phone|email|whatsapp_number/i));

    let bad = await post({ profile: { ...profile, goal: "something-else" }, stages: { sound: { score: 5, total: 6, passed: true } } });
    check("A6. an answer outside the options is refused", bad.status === 400);
    bad = await post({ profile: { ...profile, memorized: ["سورة غير موجودة"] }, stages: { sound: { score: 5, total: 6, passed: true } } });
    check("A7. a surah name outside the list is refused", bad.status === 400);

    r = await fetch(`${base}/api/results/doesnotexi`);
    check("A8. an unknown result id answers 404", r.status === 404);
    r = await fetch(`${base}/r/${res.body.id}`);
    check("A9. the result page is served at /r/<id>", r.status === 200 && (await r.text()).includes("نتيجة تشخيص قرآنا"));
    check("A10. the level comes with its English name too", typeof got.level.name_en === "string" && got.level.name_en.length > 0);

    // The plan, with a stand-in for the model that counts its calls.
    let calls = 0;
    app.locals.planClient = { beta: { messages: { create: async (req) => {
      calls++;
      const ids = req.output_config.format.schema.properties.notes.items.properties.stage_id.enum;
      const reply = {
        intro: "A suggested plan that the teacher reviews with you in the free trial lesson.",
        tip: "A few calm minutes most days.",
        notes: ids.map((id) => ({ stage_id: id, note: "This stage comes next for your child." })),
      };
      return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(reply) }] };
    } } } };
    const planUrl = `${base}/api/results/${res.body.id}/plan?lang=en`;
    const [p1, p2] = await Promise.all([1, 2].map(() => fetch(planUrl).then((x) => x.json())));
    check("A11. the plan is built once even when the page asks twice at the same time", calls === 1 && p1.plan.source === "claude" && p2.plan.source === "claude", `calls=${calls}`);
    const p3 = await fetch(planUrl).then((x) => x.json());
    check("A12. the plan is kept with the result and not built again", calls === 1 && JSON.stringify(p3) === JSON.stringify(p1));
    check("A13. the draft curriculum is marked as draft", p1.draft === true);
    check("A15. the plan carries lessons and weeks from the curriculum and the chosen lessons a week", p1.plan.totals.per_week === 3 && p1.plan.totals.weeks === Math.ceil(p1.plan.totals.sessions / 3));
    bad = await post({ profile: { ...profile, lessons_per_week: 7 }, stages: { sound: { score: 5, total: 6, passed: true } } });
    check("A16. lessons a week outside the options is refused", bad.status === 400);
    bad = await post({ profile: { ...profile, memorized_from: undefined }, stages: { sound: { score: 5, total: 6, passed: true } } });
    check("A17. listed surahs without how they were memorized is refused", bad.status === 400);
    r = await fetch(`${base}/api/results/doesnotexi/plan`);
    check("A14. a plan for an unknown result answers 404", r.status === 404);
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} api case(s) failed` : "\nall api cases behaved as expected");
  process.exit(failed ? 1 : 0);
})();
