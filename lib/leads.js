// Every finished diagnostic goes to the Quraana website as a lead (server to server, never from the browser):
// POST https://quraana-institute.com/api/public/diagnostic-lead with the header x-diagnostic-secret.
// The secret is read only from DIAGNOSTIC_WEBHOOK_SECRET; it is never logged and never reaches the page.
// Network errors and 5xx are retried 3 times with the SAME id (the site ignores duplicates). A lead that still fails,
// or that could not be sent because the secret is missing, is kept in the outbox (Supabase `lead_outbox`, or a
// local file in development) and can be sent again from /admin. The parent never sees any of this.
//
// The diagnostic asks for no phone, email or parent's name, so those fields are left out (the site treats them
// as optional). childName is the nickname the parent typed, when there is one.
const store = require("./store");
const levels = require("../public/js/levels");
const O = require("../public/js/options");
const SK = require("../public/js/skills");

const URL_DEFAULT = "https://quraana-institute.com/api/public/diagnostic-lead";
const endpoint = () => process.env.DIAGNOSTIC_WEBHOOK_URL || URL_DEFAULT;
const secret = () => process.env.DIAGNOSTIC_WEBHOOK_SECRET || "";
const configured = () => Boolean(secret());
const MAX_BODY = 20000;
const cut = (s, n) => (s ? String(s).slice(0, n) : undefined);

// The lead from a saved result: only the fields the site takes; empty ones are left out.
function leadOf(record, link, extra = {}) {
  const p = record.profile || {};
  const adult = p.who === "adult";
  const code = adult ? p.adult_level : typeof record.level === "object" && record.level ? record.level.code : record.level;
  const lvl = (adult ? levels.ADULT_LEVELS : levels.LEVELS)[code];
  const lang = p.lang === "en" ? "en" : "ar";
  const en = lang === "en";
  const levelName = lvl ? (en ? lvl.name_en : lvl.name) : String(code || "");
  const country = O.COUNTRIES.find((c) => c.code === p.country);
  // The summary: the level with its reason and «ما رصده الاختبار», by the same fixed rules as the result page.
  const why = SK.levelReason({ ...record, level: code, profile: { ...p, nickname: "" } }, levelName, lang);
  const found = SK.findings(record.stages, lang, adult) || [];
  const summary = [why, ...found, `${en ? "Result" : "النتيجة"}: ${link}`].filter(Boolean).join("\n");
  const s = record.suggestion || {};
  const details = {
    who: adult ? "adult" : "child",
    level_code: code,
    result_url: link,
    age_band: p.age_band,
    country_code: p.country,
    market: store.marketOf(p.country),
    goals: p.goals,
    ...(adult ? { juz: p.juz, self: p.self } : { estimate: p.estimate, home_language: p.home_language, memorized: p.memorized, memorized_more: p.memorized_more }),
    teacher: p.teacher,
    lessons_per_week: p.lessons_per_week,
    suggested: { program: s.program, plan: s.plan, chosen: s.chosen, then: s.then, track: s.track },
    ...(extra.source && { source: extra.source }),
    ...(extra.campaign && { campaign: extra.campaign }),
    created_at: record.created_at,
  };
  const body = {
    id: record.id,
    ...(!adult && p.nickname && { childName: cut(p.nickname, 80) }),
    ...(country && { country: cut(en ? country.name_en : country.name, 80) }),
    language: lang,
    ...(levelName && { level: cut(code ? `${levelName} (${code})` : levelName, 120) }),
    summary: cut(summary, 2000),
    details,
    // A run with the nickname exactly «TEST» (our own checks) is marked as a test on the website.
    test: Boolean(extra.test) || (!adult && p.nickname === "TEST"),
  };
  // Under 20,000 characters: the details go first if it is ever too long.
  if (JSON.stringify(body).length > MAX_BODY) body.details = { who: details.who, level_code: code, result_url: link };
  return body;
}

const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
let delays = [1000, 3000, 6000]; // between the 4 tries; tests make them short

// One lead to the site. Never throws. { ok, status, error, tries }.
async function send(body) {
  if (!configured()) return { ok: false, error: "DIAGNOSTIC_WEBHOOK_SECRET is not set", tries: 0 };
  let last = { ok: false, error: "not sent", tries: 0 };
  for (let i = 0; i <= delays.length; i++) {
    if (i) await wait(delays[i - 1]);
    try {
      const res = await fetch(endpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-diagnostic-secret": secret() },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      let reply = null;
      try { reply = await res.json(); } catch { /* not JSON */ }
      if (res.ok && reply && reply.ok === true) return { ok: true, status: res.status, tries: i + 1 };
      last = { ok: false, status: res.status, error: (reply && reply.error) || `HTTP ${res.status}`, tries: i + 1 };
      if (res.status < 500) return last; // 400 invalid data, 401 wrong secret: trying again does not help
    } catch (err) {
      last = { ok: false, error: err.name === "TimeoutError" ? "timeout" : err.message, tries: i + 1 };
    }
  }
  return last;
}

// For a saved result: send it, and keep it in the outbox when it does not get through. Never throws.
async function forResult(record, link, extra = {}) {
  try {
    const body = leadOf(record, link, extra);
    const out = await send(body);
    if (out.ok) { console.log(`leads: result ${record.id} saved on the website`); return out; }
    console.error(`leads: result ${record.id} not saved on the website (${out.status || "-"} ${out.error}, ${out.tries} tries); kept in the outbox`);
    try { await store.addLeadOutbox({ id: record.id, payload: body, last_error: cut(`${out.status || ""} ${out.error}`.trim(), 300) }); }
    catch (err) { console.error(`leads: outbox save failed for ${record.id}: ${err.message}`); }
    return out;
  } catch (err) {
    console.error(`leads: result ${record.id}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// From /admin: send the leads in the outbox again; the ones that get through are marked sent.
async function resendOutbox() {
  const pending = await store.leadOutbox();
  let sent = 0;
  const failed = [];
  for (const row of pending) {
    const out = await send(row.payload);
    if (out.ok) { sent++; await store.markLeadSent(row.id); }
    else { failed.push({ id: row.id, error: `${out.status || ""} ${out.error}`.trim() }); await store.markLeadFailed(row.id, cut(failed[failed.length - 1].error, 300)); }
    if (out.status === 401 || !configured()) break; // wrong or missing secret: the rest would fail the same way
  }
  return { pending: pending.length, sent, failed };
}

// From /admin: one test lead ("test": true, childName "TEST"); nothing is saved here.
async function sendTest() {
  return send({ id: `test-${Date.now().toString(36)}`, childName: "TEST", language: "ar", level: "TEST", summary: "Test lead from the Qurana diagnostic (/admin).", details: { who: "test" }, test: true });
}

module.exports = { leadOf, send, forResult, resendOutbox, sendTest, configured, setDelays: (d) => { delays = d; } };
