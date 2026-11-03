// The real routes over HTTP, with results and the curriculum in a temporary folder. Run: npm test
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qurana-diag-"));
const curriculumFile = path.join(tmp, "curriculum.json");
const sample = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "curriculum.json"), "utf8"));
fs.writeFileSync(curriculumFile, JSON.stringify(sample));
process.env.DATA_STORE_DIR = tmp;
process.env.CURRICULUM_PATH = curriculumFile;
process.env.PUBLIC_BASE_URL = "https://test.quraana-institute.com";
process.env.ADMIN_PIN = "test-pin-for-api-tests";
const app = require("../server");

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` -> ${detail}` : ""}`);
};

const profile = { nickname: "سارة", age_band: "6–7", country: "KW", home_language: "ar", goals: ["hifz"], teacher: "female", estimate: "words", memorized: ["الفاتحة", "الإخلاص"], memorized_more: false, memorized_from: "listening", lessons_per_week: 3 };
// Writes the curriculum file the server reads (it notices the change by the file's time).
const setCurriculum = (c) => { fs.writeFileSync(curriculumFile, JSON.stringify(c)); const t = new Date(Date.now() + Math.random() * 1e6); fs.utimesSync(curriculumFile, t, t); };

(async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const get = (url, withCookie = true) => fetch(base + url, { headers: withCookie && cookie ? { cookie } : {} });
  const post = (body) => fetch(base + "/api/results", { method: "POST", headers: { "Content-Type": "application/json", ...(cookie && { cookie }) }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const login = (pin) => fetch(base + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
  try {
    // ---- before approval: closed to parents ----
    let r = await get("/");
    const closed = await r.text();
    check("G1. before approval the diagnostic is closed (503) and the page says nothing about the curriculum", r.status === 503 && !/منهج|curriculum|draft|مسودة/i.test(closed));
    r = await get("/api/content");
    check("G2. the API is closed too", r.status === 503);
    r = await get("/admin");
    check("G3. /admin is always open", r.status === 200);
    r = await get("/api/admin/status");
    check("G4. the status needs the PIN", r.status === 401);
    r = await login("wrong");
    check("G5. a wrong PIN is refused", r.status === 401);
    r = await login(process.env.ADMIN_PIN);
    cookie = (r.headers.get("set-cookie") || "").split(";")[0];
    check("G6. the right PIN opens a session in an HttpOnly cookie", r.status === 200 && /HttpOnly/i.test(r.headers.get("set-cookie") || "") && cookie.startsWith("qurana_admin="));
    r = await get("/api/admin/status");
    let st = await r.json();
    check("G7. the admin sees the curriculum is not public yet, and why", r.status === 200 && st.public === false && st.status === "draft");

    // ---- the diagnostic itself (as admin, in the internal preview) ----
    r = await get("/api/content");
    check("A1. game content is served", r.status === 200 && (await r.json()).fatha.items.length === 3);

    // The browser says "passed" for a 1-of-3 fatha score: the server decides from the score instead.
    const res = await post({ profile, stages: { sound: { passed: true, inferred: true }, shape: { passed: true, inferred: true }, fatha: { score: 1, total: 3, passed: true } } });
    check("A2. a result is saved and gets a fixed link", res.status === 201 && /^https:\/\/test\.quraana-institute\.com\/r\/[a-z0-9]{10}$/.test(res.body.url), JSON.stringify(res.body));

    r = await get(`/api/results/${res.body.id}`);
    const got = await r.json();
    check("A3. the level is worked out on the server from the score (1 of 3 fatha → R3)", got.level.code === "R3" && got.stages.fatha.passed === false, got.level.code);
    check("A4. the result has the booking, prices and result links", got.links.booking.endsWith(`/register?diagnosis=${res.body.id}`) && got.links.prices.endsWith("/#plans"));
    check("A5. nothing beyond the answers is stored (no phone or email fields)", !JSON.stringify(got).match(/phone|email|whatsapp_number/i));

    let bad = await post({ profile: { ...profile, goals: ["something-else"] }, stages: { sound: { score: 5, total: 6, passed: true } } });
    check("A6. an answer outside the options is refused", bad.status === 400);
    bad = await post({ profile: { ...profile, memorized: ["سورة غير موجودة"] }, stages: { sound: { score: 5, total: 6, passed: true } } });
    check("A7. a surah name outside the list is refused", bad.status === 400);
    bad = await post({ profile: { ...profile, goals: [] }, stages: { sound: { score: 5, total: 6, passed: true } } });
    check("A18. no goal at all is refused", bad.status === 400);
    const two = await post({ profile: { ...profile, goals: ["tajweed", "hifz"] }, stages: { sound: { score: 5, total: 6, passed: true } } });
    const twoGot = await get(`/api/results/${two.body.id}`).then((x) => x.json());
    check("A19. several goals are kept, in the order of the list", JSON.stringify(twoGot.profile.goals) === JSON.stringify(["hifz", "tajweed"]));

    r = await get("/api/results/doesnotexi");
    check("A8. an unknown result id answers 404", r.status === 404);
    r = await get(`/r/${res.body.id}`);
    check("A9. the result page is served at /r/<id>", r.status === 200 && (await r.text()).includes("نتيجة تشخيص قرآنا"));
    check("A10. the level comes with its English name too", typeof got.level.name_en === "string" && got.level.name_en.length > 0);

    // The path comes at once, by rules, with no model call.
    let calls = 0;
    let modelFails = false;
    const pathRes = await get(`/api/results/${res.body.id}/path?lang=en`).then((x) => x.json());
    check("A20. the path is served at once from the curriculum, with its totals, and no model call", pathRes.status === "ready" && pathRes.stages.length > 0 && pathRes.totals.per_week === 3 && calls === 0);

    // The notes, with a stand-in for the model that counts its calls.
    app.locals.planClient = { beta: { messages: { create: async (req) => {
      calls++;
      if (modelFails) throw new Error("model down");
      const ids = req.output_config.format.schema.properties.notes.items.properties.stage_id.enum;
      const reply = {
        intro: "A suggested plan that the teacher reviews with you in the free trial lesson.",
        tip: "A few calm minutes most days.",
        notes: ids.map((id) => ({ stage_id: id, note: "This stage comes next for your child." })),
      };
      return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(reply) }] };
    } } } };
    const planUrl = `/api/results/${res.body.id}/notes?lang=en`;
    const [p1, p2] = await Promise.all([1, 2].map(() => get(planUrl).then((x) => x.json())));
    check("A11. the notes are written once even when the page asks twice at the same time", calls === 1 && p1.status === "ready" && p2.status === "ready", `calls=${calls}`);
    const p3 = await get(planUrl).then((x) => x.json());
    check("A12. the notes are kept with the result and not written again", calls === 1 && JSON.stringify(p3) === JSON.stringify(p1));
    check("A13. path and notes say nothing about the curriculum's status", !/draft|approved/i.test(JSON.stringify(p1) + JSON.stringify(pathRes)));
    check("A15. the totals: lessons from the curriculum, weeks from the chosen lessons a week", pathRes.totals.weeks === Math.ceil(pathRes.totals.sessions / 3));
    // A failure is not kept: "Try again" asks the model again.
    modelFails = true;
    const fresh = await post({ profile, stages: { sound: { score: 5, total: 6, passed: true } } });
    const before = calls;
    let n = await get(`/api/results/${fresh.body.id}/notes?lang=ar`).then((x) => x.json());
    check("A21. when the model fails twice the notes answer failed", n.status === "failed" && calls === before + 2, `calls=${calls - before}`);
    modelFails = false;
    n = await get(`/api/results/${fresh.body.id}/notes?lang=ar`).then((x) => x.json());
    check("A22. trying again asks the model again (a failure is not kept)", n.status === "ready" && calls === before + 3);
    bad = await post({ profile: { ...profile, lessons_per_week: 7 }, stages: { sound: { score: 5, total: 6, passed: true } } });
    check("A16. lessons a week outside the options is refused", bad.status === 400);
    bad = await post({ profile: { ...profile, memorized_from: undefined }, stages: { sound: { score: 5, total: 6, passed: true } } });
    check("A17. listed surahs without how they were memorized is refused", bad.status === 400);
    r = await get("/api/results/doesnotexi/notes");
    check("A14. notes for an unknown result answer 404", r.status === 404);

    // ---- approval opens the link ----
    setCurriculum({ ...sample, status: "approved", approved_by: "" , approved_at: "2026-11-03" });
    r = await get("/", false);
    check("G8. «معتمد» without a reviewer's name keeps the link closed", r.status === 503);
    setCurriculum({ ...sample, status: "approved", approved_by: "Sara Zaalouk", approved_at: "2026-11-03" });
    r = await get("/", false);
    check("G9. approved with a name and a date: the link is public without a PIN", r.status === 200);
    r = await get(`/api/results/${res.body.id}`, false);
    check("G10. results open publicly after approval", r.status === 200);
    await get(planUrl, false).then((x) => x.json());
    check("G11. notes kept from the earlier curriculum version are written again", calls === before + 4, `calls=${calls - before}`);
    st = await get("/api/admin/status").then((x) => x.json());
    check("G12. the admin sees the link is public", st.public === true && st.approved_by === "Sara Zaalouk");

    for (let i = 0; i < 5; i++) await login("wrong-again");
    r = await login(process.env.ADMIN_PIN);
    check("G13. after 5 wrong PINs even the right one waits (429)", r.status === 429);
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} api case(s) failed` : "\nall api cases behaved as expected");
  process.exit(failed ? 1 : 0);
})();
