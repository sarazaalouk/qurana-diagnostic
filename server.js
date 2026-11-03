// Qurana diagnostic — server
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const express = require("express");
const content = require("./lib/content");
const store = require("./lib/store");
const { validateSubmission } = require("./lib/validate");
const levels = require("./public/js/levels");
const { buildPlan } = require("./lib/plan");

const PORT = process.env.PORT || 3100;
// Where the result links point, and the main site for booking and prices.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const SITE_URL = (process.env.SITE_URL || "https://quraana-institute.com").replace(/\/$/, "");
const WHATSAPP = process.env.WHATSAPP_NUMBER || "201142847626";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Simple limit on saved results per IP (in memory).
const hits = new Map();
function limiter(map, max, message) {
  return (req, res, next) => {
    const now = Date.now();
    const list = (map.get(req.ip) || []).filter((t) => now - t < 60 * 60 * 1000);
    if (list.length >= max) return res.status(429).json({ error: message });
    list.push(now);
    map.set(req.ip, list);
    next();
  };
}
const saveLimit = limiter(hits, 20, "too many results from this address, try again later");
// Plans are built once per result and language, then kept; this only limits new builds.
const planLimit = limiter(new Map(), 30, "too many plans from this address, try again later");
const building = new Map(); // "<id>:<lang>" → promise, so two page loads do not build the same plan twice

app.get("/health", (req, res) => res.json({ status: "ok" }));

// Words and letters for the games (fixed content from the two source files).
app.get("/api/content", (req, res) => {
  const c = content.gameContent();
  const unknown = content.unknownArabicWords(c);
  if (unknown.length) return res.status(500).json({ error: "content failed the source check", words: unknown });
  res.json(c);
});

app.get("/api/config", (req, res) => {
  res.json({ site_url: SITE_URL, public_base_url: PUBLIC_BASE_URL, whatsapp: WHATSAPP });
});

// Save a finished diagnostic; the level and suggestion are worked out here.
app.post("/api/results", saveLimit, (req, res) => {
  const { error, value } = validateSubmission(req.body);
  if (error) return res.status(400).json({ error });
  const record = store.save(value);
  res.status(201).json({ id: record.id, url: `${PUBLIC_BASE_URL}/r/${record.id}` });
});

// A saved result, for the result page and (later) for the site's booking form.
app.get("/api/results/:id", (req, res) => {
  const r = store.get(req.params.id);
  if (!r) return res.status(404).json({ error: "result not found" });
  const level = levels.LEVELS[r.level];
  res.json({
    id: r.id,
    created_at: r.created_at,
    profile: r.profile,
    stages: r.stages,
    level: { code: r.level, name: level.name, focus: level.focus, name_en: level.name_en, focus_en: level.focus_en },
    suggestion: r.suggestion,
    links: {
      result: `${PUBLIC_BASE_URL}/r/${r.id}`,
      booking: `${SITE_URL}/register?diagnosis=${r.id}`,
      prices: `${SITE_URL}/#plans`,
    },
  });
});

// The learning plan for a saved result (Claude chooses stages from the approved curriculum; see lib/plan.js).
app.get("/api/results/:id/plan", async (req, res, next) => {
  const r = store.get(req.params.id);
  if (!r) return res.status(404).json({ error: "result not found" });
  const lang = req.query.lang === "en" ? "en" : "ar";
  const kept = r.plans && r.plans[lang];
  if (kept) return res.json(kept);
  planLimit(req, res, async () => {
    const key = `${r.id}:${lang}`;
    try {
      if (!building.has(key)) {
        building.set(key, buildPlan(r, lang, { client: app.locals.planClient }).finally(() => building.delete(key)));
      }
      const out = await building.get(key);
      if (out.problems && out.problems.length) console.warn(`plan ${key}: used the curriculum plan (${out.problems.join("; ")})`);
      const shown = { status: out.status, draft: out.draft, plan: out.plan };
      // Keep only plans that will not change: a curriculum fallback after a model error is tried again next time.
      if (out.status === "ready" && out.plan.source === "claude") {
        const latest = store.get(r.id);
        store.update(r.id, { plans: { ...(latest.plans || {}), [lang]: shown } });
      }
      res.json(shown);
    } catch (err) {
      next(err);
    }
  });
});

// Result page at /r/<id>
app.get("/r/:id", (req, res) => res.sendFile(path.join(__dirname, "public", "result.html")));

if (require.main === module) {
  app.listen(PORT, () => console.log(`Qurana diagnostic on http://localhost:${PORT}`));
}
module.exports = app;
