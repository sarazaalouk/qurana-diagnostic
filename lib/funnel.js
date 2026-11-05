// The diagnostic's step counter: anonymous events from the page (public/js/track.js), and the counts for /admin.
// An event is only: the step, a random id for the browser tab, child / adult, the page language, and where the
// visitor came from (utm_source / utm_campaign, or the site that linked to us). No name, no answers, no IP.
const store = require("./store");

// The steps, in order. "saved" is written by the server when a result is saved (never from the page).
const STEPS = ["visit", "start", "test", "finish", "saved", "result_view", "wa_click", "book_click"];
const EXTRA = ["form_missing", "save_failed"]; // shown beside the steps: where people get stuck
const FROM_PAGE = new Set([...STEPS.filter((s) => s !== "saved"), ...EXTRA]);
const SESSION_RE = /^[a-z0-9]{8,32}$/;
const clean = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);

// The event from the page, checked; null when it is not one we keep.
function fromBody(b, fromServer = false) {
  if (!b || typeof b !== "object") return null;
  const event = String(b.event || "");
  if (!(fromServer ? event === "saved" : FROM_PAGE.has(event))) return null;
  if (!SESSION_RE.test(String(b.session || ""))) return null;
  return {
    event,
    session: b.session,
    who: b.who === "adult" ? "adult" : b.who === "child" ? "child" : b.who === "teacher" ? "teacher" : "",
    source: clean(b.source) || "direct",
    campaign: clean(b.campaign),
    lang: b.lang === "en" ? "en" : "ar",
  };
}

// Never throws: counting must not get in the way of the visitor or of saving a result.
// A failure is logged at most once every 10 minutes (e.g. the funnel_events table not made yet).
let lastLog = 0;
async function record(e) {
  if (!e) return false;
  try { await store.addEvent(e); return true; } catch (err) {
    if (Date.now() - lastLog > 10 * 60 * 1000) { lastLog = Date.now(); console.error(`funnel: ${err.message}`); }
    return false;
  }
}

// The counts: visitors (one per tab) at each step, today and over the last `days` days, and per source.
// "Today" is the day in Riyadh (the brand's time zone).
const dayOf = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
function summarize(events, days, now = new Date()) {
  const today = dayOf(now);
  const count = (list) => Object.fromEntries([...STEPS, ...EXTRA].map((s) => [s, new Set(list.filter((e) => e.event === s).map((e) => e.session)).size]));
  const sources = {};
  for (const e of events) (sources[e.source || "direct"] = sources[e.source || "direct"] || []).push(e);
  const bySource = Object.entries(sources)
    .map(([source, list]) => ({ source, ...count(list) }))
    .sort((a, b) => b.visit - a.visit || b.saved - a.saved)
    .slice(0, 10);
  return { days, steps: STEPS, extra: EXTRA, today: count(events.filter((e) => dayOf(e.created_at) === today)), period: count(events), by_source: bySource };
}

async function counts(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return summarize(await store.events(since), days);
}

module.exports = { STEPS, EXTRA, fromBody, record, summarize, counts };
