// Leads to the Quraana website (lib/leads.js), against a stand-in site on this computer. Run: npm test
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qurana-leads-"));
process.env.DATA_STORE_DIR = tmp;
delete process.env.SUPABASE_URL;
const SECRET = "test-secret-not-real-0123456789";

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` -> ${detail}` : ""}`);
};

// The stand-in site: answers by a plan per request (200, 500, 401, 400 or "drop" the connection).
const got = [];
let plan = [];
const site = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    got.push({ secret: req.headers["x-diagnostic-secret"], type: req.headers["content-type"], body: JSON.parse(body), size: body.length });
    const next = plan.length ? plan.shift() : 200;
    if (next === "drop") return req.socket.destroy();
    res.writeHead(next, { "Content-Type": "application/json" });
    res.end(JSON.stringify(next === 200 ? { ok: true } : { ok: false, error: next === 401 ? "unauthorized" : "x" }));
  });
});

(async () => {
  await new Promise((ok) => site.listen(0, ok));
  process.env.DIAGNOSTIC_WEBHOOK_URL = `http://127.0.0.1:${site.address().port}/api/public/diagnostic-lead`;
  const store = require("../lib/store");
  store.init();
  const leads = require("../lib/leads");
  leads.setDelays([5, 5, 5]);
  const logs = [];
  const orig = { log: console.log, error: console.error };
  const quiet = () => { console.error = (...a) => logs.push(a.join(" ")); };
  const loud = () => { console.error = orig.error; };

  const child = {
    id: "abcdefgh23", created_at: "2026-11-05T10:00:00.000Z", level: "R5",
    profile: { who: "child", nickname: "ليلى", age_band: "8–9", country: "KW", home_language: "ar", goals: ["hifz"], teacher: "female", estimate: "words", memorized: ["الإخلاص"], lessons_per_week: 3, lang: "ar" },
    stages: { sound: { passed: true, inferred: true } }, suggestion: { program: "reading", plan: "growth" },
  };
  const link = "https://qurana-diagnostic.onrender.com/r/abcdefgh23";

  // The lead's shape.
  const body = leads.leadOf(child, link, { source: "meta", campaign: "lead_magnet_5_11" });
  check("E1. the lead has the id, the child's nickname, country, language, level, a summary and details; no phone, email or parent's name",
    body.id === child.id && body.childName === "ليلى" && body.country === "الكويت" && body.language === "ar" && /\(R5\)$/.test(body.level) &&
      body.summary.includes(link) && body.details.source === "meta" && body.test === false && !("whatsapp" in body) && !("email" in body) && !("parentName" in body), JSON.stringify(body).slice(0, 300));
  const adult = leads.leadOf({ ...child, id: "adultaaaa2", profile: { who: "adult", adult_level: "A2", country: "AE", lang: "en", goals: ["tajweed"] } }, link);
  check("E2. an adult's lead has no childName, and English text when the page was English", !("childName" in adult) && adult.language === "en" && adult.country === "UAE" && /A2/.test(adult.level));
  const huge = leads.leadOf({ ...child, profile: { ...child.profile, memorized: Array(3000).fill("سورة طويلة جدًا") } }, link);
  check("E3. the body stays under 20,000 characters", JSON.stringify(huge).length < 20000 && huge.details.result_url === link);

  // Without the secret: nothing is sent, and the lead waits in the outbox.
  delete process.env.DIAGNOSTIC_WEBHOOK_SECRET;
  quiet();
  let out = await leads.forResult(child, link);
  loud();
  check("E4. without DIAGNOSTIC_WEBHOOK_SECRET nothing is sent and the lead is kept in the outbox", !out.ok && got.length === 0 && (await store.leadOutbox()).length === 1);

  process.env.DIAGNOSTIC_WEBHOOK_SECRET = SECRET;
  // 200 straight away.
  got.length = 0;
  out = await leads.forResult({ ...child, id: "okokokok22" }, link);
  check("E5. a lead is sent once, from the server, with the secret header and JSON", out.ok && got.length === 1 && got[0].secret === SECRET && got[0].type === "application/json" && got[0].body.id === "okokokok22");

  // 500, then the connection dropped, then 200: three tries with the same id.
  got.length = 0; plan = [500, "drop", 200];
  out = await leads.forResult({ ...child, id: "retryyyy22" }, link);
  check("E6. on 500 and network errors it tries again with the same id, and stops at the first {ok:true}", out.ok && out.tries === 3 && got.length === 3 && got.every((g) => g.body.id === "retryyyy22"), JSON.stringify(out));

  // 500 four times: 1 try + 3 retries, then the outbox.
  got.length = 0; plan = [500, 500, 500, 500];
  quiet();
  out = await leads.forResult({ ...child, id: "fail500022" }, link);
  loud();
  check("E7. after 3 retries it gives up and keeps the lead in the outbox", !out.ok && got.length === 4 && (await store.leadOutbox()).some((r) => r.id === "fail500022"));

  // 401 and 400: no retry, kept.
  got.length = 0; plan = [401];
  quiet();
  out = await leads.forResult({ ...child, id: "wrongsec22" }, link);
  plan = [400];
  const out400 = await leads.forResult({ ...child, id: "baddata022" }, link);
  loud();
  check("E8. 401 and 400 are not retried (it would not help) and the leads are kept", out.status === 401 && out400.status === 400 && got.length === 2 && (await store.leadOutbox()).length === 4);
  check("E9. the secret never appears in the logs", logs.length > 0 && !logs.some((l) => l.includes(SECRET)), logs.slice(0, 2).join(" | "));

  // Sending the outbox again: all go through and are marked sent.
  got.length = 0; plan = [];
  const re = await leads.resendOutbox();
  check("E10. the outbox is sent again from /admin, and what went through is no longer waiting", re.pending === 4 && re.sent === 4 && (await store.leadOutbox()).length === 0, JSON.stringify(re));
  check("E11. a lead sent again keeps its first id", got.map((g) => g.body.id).sort().join() === ["abcdefgh23", "baddata022", "fail500022", "wrongsec22"].join());

  // The test lead.
  got.length = 0;
  const t = await leads.sendTest();
  check("E12. the test lead is test:true with childName TEST, and nothing goes to the outbox", t.ok && got[0].body.test === true && got[0].body.childName === "TEST" && (await store.leadOutbox()).length === 0);

  // A wrong secret on resend stops after the first lead.
  plan = [401, 401, 401];
  quiet();
  await leads.forResult({ ...child, id: "stopaaaa22" }, link);
  await leads.forResult({ ...child, id: "stopbbbb22" }, link);
  got.length = 0; plan = [401];
  const re2 = await leads.resendOutbox();
  loud();
  check("E13. with a wrong secret, sending the outbox again stops after the first 401", got.length === 1 && re2.sent === 0 && (await store.leadOutbox()).length === 2);

  site.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failed ? `\n${failed} failed` : "\nall leads tests passed");
  process.exit(failed ? 1 : 0);
})();
