// Who may open the app. Until the curriculum is approved (status «معتمد» with a reviewer's name and a date,
// in the «الاعتماد» tab), the whole app is an internal preview: it opens only for someone who entered ADMIN_PIN at /admin.
// After approval the link is public. Nothing parents see mentions the curriculum's status.
const fs = require("fs");
const crypto = require("crypto");
const curriculum = require("./curriculum");

const COOKIE = "qurana_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;
const WRONG_MAX = 5, WRONG_WINDOW_MS = 15 * 60 * 1000;

// Always open: the admin page and its API, the stylesheet, and the health check.
const OPEN = [/^\/health$/, /^\/admin(\.html)?$/, /^\/api\/admin\//, /^\/css\//];

// The curriculum is read again only when the file changes.
let cached = { mtime: -1 };
function current() {
  let mtime;
  try { mtime = fs.statSync(curriculum.CURRICULUM_PATH).mtimeMs; } catch { return { c: null, isPublic: false, error: "curriculum file not found" }; }
  if (mtime !== cached.mtime) {
    try {
      const c = curriculum.load();
      cached = { mtime, c, isPublic: curriculum.isPublic(c), fingerprint: curriculum.fingerprint(c) };
    } catch (err) {
      cached = { mtime, c: null, isPublic: false, error: `curriculum file cannot be read: ${err.message}` };
    }
  }
  return cached;
}

const sessions = new Map(); // token → expiry time
const wrong = new Map(); // ip → times of wrong PINs

function cookieOf(req) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : null;
}

function isAdmin(req) {
  const token = cookieOf(req);
  const until = token && sessions.get(token);
  if (!until) return false;
  if (until < Date.now()) { sessions.delete(token); return false; }
  return true;
}

function samePin(given, pin) {
  const a = crypto.createHash("sha256").update(String(given)).digest();
  const b = crypto.createHash("sha256").update(pin).digest();
  return crypto.timingSafeEqual(a, b);
}

const CLOSED_PAGE = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>قرآنا · Qurana</title><link rel="stylesheet" href="/css/app.css"></head>
<body><main><section class="card"><h1 lang="ar">قرآنا</h1><p>هذه الصفحة غير متاحة حاليًا.</p><p lang="en" dir="ltr">This page is not available yet.</p></section></main></body></html>`;

// Express middleware: lets a request through when the link is public, the path is always open, or the visitor is an admin.
function gate(req, res, next) {
  if (OPEN.some((re) => re.test(req.path))) return next();
  if (current().isPublic || isAdmin(req)) return next();
  res.set("Cache-Control", "no-store");
  if (req.path.startsWith("/api/")) return res.status(503).json({ error: "not available yet" });
  res.status(503).type("html").send(CLOSED_PAGE);
}

function routes(app) {
  app.post("/api/admin/login", (req, res) => {
    const pin = process.env.ADMIN_PIN;
    if (!pin) return res.status(503).json({ error: "ADMIN_PIN is not set on the server" });
    const now = Date.now();
    const list = (wrong.get(req.ip) || []).filter((t) => now - t < WRONG_WINDOW_MS);
    if (list.length >= WRONG_MAX) return res.status(429).json({ error: "too many wrong attempts, try again later" });
    if (!req.body || !samePin(req.body.pin || "", pin)) {
      list.push(now);
      wrong.set(req.ip, list);
      return res.status(401).json({ error: "wrong PIN" });
    }
    wrong.delete(req.ip);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, now + SESSION_MS);
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: req.secure, maxAge: SESSION_MS, path: "/" });
    res.json({ ok: true });
  });

  app.post("/api/admin/logout", (req, res) => {
    const token = cookieOf(req);
    if (token) sessions.delete(token);
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  // The curriculum's status, for the admin page: is the link public or not.
  app.get("/api/admin/status", (req, res) => {
    if (!process.env.ADMIN_PIN) return res.status(503).json({ error: "ADMIN_PIN is not set on the server" });
    if (!isAdmin(req)) return res.status(401).json({ error: "enter the PIN first" });
    const cur = current();
    const c = cur.c || {};
    res.set("Cache-Control", "no-store");
    res.json({
      public: cur.isPublic,
      status: c.status || null,
      owner: c.owner || "",
      approved_by: c.approved_by || "",
      approved_at: c.approved_at || "",
      source_file: c.source_file || "",
      imported_at: c.imported_at || "",
      stages: Array.isArray(c.stages) ? c.stages.length : 0,
      problems: cur.c ? curriculum.problems(c) : [cur.error],
      storage: require("./store").backendName(),
    });
  });
}

module.exports = { gate, routes, isAdmin, current, COOKIE };
