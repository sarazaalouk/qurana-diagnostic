// Qurana diagnostic — server
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const express = require("express");
const content = require("./lib/content");
const store = require("./lib/store");
const { validateSubmission } = require("./lib/validate");
const levels = require("./public/js/levels");
const { pathFor, writeNotes, voice } = require("./lib/plan");
const signals = require("./public/js/signals");
const voiceVersion = () => require("crypto").createHash("sha256").update(voice().text).digest("hex").slice(0, 12);
const access = require("./lib/access");

const PORT = process.env.PORT || 3100;
// Where the result links point, and the main site for booking and prices.
// The public address of result links (e.g. https://test.quraana-institute.com, or the Render address for now).
// Without it, the address the request came to; a localhost address only works on this computer, and the page says so.
const baseUrl = (req) => (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
const isLocal = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[^/]+\.localhost)(:\d+)?(\/|$)/i.test(url);
const resultLink = (req, id) => `${baseUrl(req)}/r/${id}`;
const SITE_URL = (process.env.SITE_URL || "https://quraana-institute.com").replace(/\/$/, "");
const WHATSAPP = process.env.WHATSAPP_NUMBER || "201142847626";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
// Before approval of the curriculum, everything except /admin is closed unless the visitor entered ADMIN_PIN (lib/access.js).
app.use(access.gate);
access.routes(app);
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Simple limits per IP and hour (in memory): allowed(req) counts one use and says whether it is within the limit.
function limit(max) {
  const map = new Map();
  return (req) => {
    const now = Date.now();
    const list = (map.get(req.ip) || []).filter((t) => now - t < 60 * 60 * 1000);
    if (list.length >= max) return false;
    list.push(now);
    map.set(req.ip, list);
    return true;
  };
}
const saveAllowed = limit(20);
const saveLimit = (req, res, next) => (saveAllowed(req) ? next() : res.status(429).json({ error: "too many results from this address, try again later" }));
// Notes are written once per result and language, then kept; this only limits new writing (and "Try again").
const notesAllowed = limit(30);
const building = new Map(); // "<id>:<lang>" → promise, so two page loads do not write the same notes twice

app.get("/health", (req, res) => res.json({ status: "ok" }));

// Words and letters for the games (fixed content from the two source files).
app.get("/api/content", (req, res) => {
  const c = content.gameContent();
  const unknown = content.unknownArabicWords(c);
  if (unknown.length) return res.status(500).json({ error: "content failed the source check", words: unknown });
  res.json(c);
});

app.get("/api/config", (req, res) => {
  const base = baseUrl(req);
  res.json({ site_url: SITE_URL, public_base_url: base, base_from_env: !!process.env.PUBLIC_BASE_URL, local: isLocal(base), whatsapp: WHATSAPP });
});

// Express 5 passes a rejected promise to the error handler; this keeps the routes short.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Save a finished diagnostic; the level and suggestion are worked out here.
app.post("/api/results", saveLimit, wrap(async (req, res) => {
  const { error, value } = validateSubmission(req.body);
  if (error) return res.status(400).json({ error });
  const record = await store.save(value);
  res.status(201).json({ id: record.id, url: resultLink(req, record.id) });
}));

// A saved result, for the result page and (later) for the site's booking form.
app.get("/api/results/:id", wrap(async (req, res) => {
  const r = await store.get(req.params.id);
  if (!r) return res.status(404).json({ error: "result not found" });
  const adult = r.profile.who === "adult";
  const level = adult ? levels.ADULT_LEVELS[r.profile.adult_level] : levels.LEVELS[r.level];
  const lang = req.query.lang === "en" ? "en" : "ar";
  res.json({
    id: r.id,
    created_at: r.created_at,
    who: adult ? "adult" : "child",
    profile: r.profile,
    stages: r.stages,
    level: { code: adult ? r.profile.adult_level : r.level, name: level.name, focus: level.focus, name_en: level.name_en, focus_en: level.focus_en },
    suggestion: r.suggestion,
    // "ما لاحظناه": three gentle sentences from the games and the parent's answers (children only; fixed rules).
    ...(!adult && { observed: signals.observe(r.signals, r.profile.likes, r.profile.motivation, lang).parent }),
    links: {
      result: resultLink(req, r.id),
      // The booking form gets the id and the full result link, so the site can open the result from any device.
      booking: `${SITE_URL}/register?diagnosis=${r.id}&result=${encodeURIComponent(resultLink(req, r.id))}`,
      prices: `${SITE_URL}/#plans`,
    },
  });
}));

// The path for a saved result, by rules from the curriculum: instant, no model (lib/plan.js pathFor).
app.get("/api/results/:id/path", wrap(async (req, res) => {
  const r = await store.get(req.params.id);
  if (!r) return res.status(404).json({ error: "result not found" });
  const lang = req.query.lang === "en" ? "en" : "ar";
  const cur = access.current();
  if (!cur.c) return res.json({ status: "unavailable" });
  res.json(pathFor(r, lang, cur.c));
}));

// The notes for that path, by Claude (lib/plan.js writeNotes). Kept with the result per language and curriculum version;
// a failure is not kept, so "Try again" asks again.
app.get("/api/results/:id/notes", wrap(async (req, res) => {
  const r = await store.get(req.params.id);
  if (!r) return res.status(404).json({ error: "result not found" });
  const lang = req.query.lang === "en" ? "en" : "ar";
  // Kept notes are used only for the same curriculum and the same voice guide (prompts/voice.md) they were written with.
  const version = `${access.current().fingerprint}:${voiceVersion()}`;
  const kept = r.plans && r.plans[lang];
  if (kept && kept.curriculum === version && kept.notes && kept.notes.windows) return res.json(kept.notes);
  if (!notesAllowed(req)) return res.status(429).json({ status: "failed", error: "too many requests from this address, try again later" });
  const key = `${r.id}:${lang}`;
  if (!building.has(key)) {
    building.set(key, writeNotes(r, lang, { client: app.locals.planClient }).finally(() => building.delete(key)));
  }
  const out = await building.get(key);
  if (out.problems.length) console.warn(`notes ${key}: ${out.status} (${out.problems.join("; ")})`);
  const shown = out.status === "ready" ? { status: "ready", windows: out.windows, tip: out.tip } : { status: out.status };
  if (out.status === "ready") {
    const latest = await store.get(r.id);
    await store.update(r.id, { plans: { ...(latest.plans || {}), [lang]: { curriculum: version, notes: shown } } });
  }
  res.json(shown);
}));

// Teachers: "coming soon" — an email to hear when the teachers' diagnostic opens. Email only, nothing else.
const waitlistAllowed = limit(10);
app.post("/api/waitlist", wrap(async (req, res) => {
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return res.status(400).json({ error: "email is not valid" });
  if (!req.body.consent) return res.status(400).json({ error: "consent is needed" });
  if (!waitlistAllowed(req)) return res.status(429).json({ error: "too many requests from this address, try again later" });
  await store.addWaitlist({ email, role: "teacher", lang: req.body.lang === "en" ? "en" : "ar" });
  res.status(201).json({ ok: true });
}));

// For the teacher in /admin: recent results, and "كيف نبدأ معه" for one of them (practical points, fixed rules).
app.get("/api/admin/results", wrap(async (req, res) => {
  if (!access.isAdmin(req)) return res.status(401).json({ error: "enter the PIN first" });
  const list = await store.list(30);
  res.set("Cache-Control", "no-store");
  res.json(list.map((r) => ({
    id: r.id, created_at: r.created_at, who: r.profile.who || "child", market: r.market || store.marketOf(r.profile.country),
    level: r.profile.who === "adult" ? r.profile.adult_level : r.level, nickname: r.profile.nickname || "",
  })));
}));
app.get("/api/admin/results/:id", wrap(async (req, res) => {
  if (!access.isAdmin(req)) return res.status(401).json({ error: "enter the PIN first" });
  const r = await store.get(req.params.id);
  if (!r) return res.status(404).json({ error: "result not found" });
  const o = signals.observe(r.signals, r.profile.likes, r.profile.motivation, "ar");
  res.set("Cache-Control", "no-store");
  res.json({
    id: r.id, who: r.profile.who || "child", level: r.profile.who === "adult" ? r.profile.adult_level : r.level,
    link: resultLink(req, r.id), local: isLocal(baseUrl(req)), profile: r.profile, signals: r.signals || null, start_with: o.teacher, observed: o.parent,
  });
}));

// Result page at /r/<id>
app.get("/r/:id", (req, res) => res.sendFile(path.join(__dirname, "public", "result.html")));

// Errors: logged with the route, answered without details.
app.use((err, req, res, next) => {
  console.error(`${req.method} ${req.path}: ${err.stack || err.message}`);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "something went wrong on the server" });
});

if (require.main === module) {
  store.init();
  app.listen(PORT, () => console.log(`Qurana diagnostic on http://localhost:${PORT} (results: ${store.backendName()})`));
}
module.exports = app;
