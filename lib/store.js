// Diagnostic results. Two backends, chosen at start:
// - Supabase Postgres (table `diagnoses`, see docs/supabase.sql) when SUPABASE_URL and SUPABASE_SERVICE_KEY are set — for Render;
// - JSON files under DATA_STORE_DIR/results (or data/results) otherwise — for local development only.
// Only what the result page needs is stored: no phone, email or surname.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ID_RE = /^[a-z0-9]{10}$/;
const LOCAL_DIR = path.join(__dirname, "..", "data", "results");
let RESULTS_DIR = process.env.DATA_STORE_DIR ? path.join(path.resolve(process.env.DATA_STORE_DIR), "results") : LOCAL_DIR;

function newId() {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return [...crypto.randomBytes(10)].map((b) => abc[b % abc.length]).join("");
}

// The market a result belongs to, from the country the parent chose (for prices and follow-up).
const GULF = ["SA", "AE", "QA", "BH", "OM"];
const marketOf = (country) => (country === "KW" ? "kuwait" : GULF.includes(country) ? "gulf" : "international");

// ---------- files (local development) ----------
const files = {
  name: "files",
  // Makes sure the results folder exists and can be written; if not, falls back to the app's own folder and says so.
  init() {
    for (const dir of [RESULTS_DIR, LOCAL_DIR]) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.accessSync(dir, fs.constants.W_OK);
        if (dir !== RESULTS_DIR) console.error(`results: ${RESULTS_DIR} cannot be written; using ${dir} (lost on every deploy — set SUPABASE_URL and SUPABASE_SERVICE_KEY)`);
        RESULTS_DIR = dir;
        return;
      } catch (err) {
        console.error(`results: cannot use ${dir}: ${err.code || err.message}`);
      }
    }
    throw new Error("no folder for results can be written");
  },
  async save(record) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESULTS_DIR, `${record.id}.json`), JSON.stringify(record, null, 2) + "\n", "utf8");
  },
  async get(id) {
    try { return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, `${id}.json`), "utf8")); } catch { return null; }
  },
  async update(id, fields) {
    const record = await files.get(id);
    if (!record) return null;
    const next = { ...record, ...fields };
    await files.save(next);
    return next;
  },
  async list(limit) {
    let names = [];
    try { names = fs.readdirSync(RESULTS_DIR).filter((n) => n.endsWith(".json")); } catch { return []; }
    const all = names.map((n) => { try { return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, n), "utf8")); } catch { return null; } }).filter(Boolean);
    return all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
  },
  async addWaitlist(entry) {
    const file = path.join(path.dirname(RESULTS_DIR), "waitlist.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
  },
};

// ---------- Supabase (Render) ----------
// A row keeps the answers as JSON; the record the app uses is rebuilt from it.
const toRow = (r) => ({
  id: r.id, created_at: r.created_at, market: marketOf(r.profile.country),
  answers: { profile: r.profile, stages: r.stages, suggestion: r.suggestion, ...(r.signals && { signals: r.signals }) },
  level: r.level, plan: r.plans || null, status: r.status || "new", booked_at: r.booked_at || null,
});
const fromRow = (row) => ({
  id: row.id, created_at: row.created_at, ...row.answers, level: row.level,
  plans: row.plan || undefined, status: row.status, booked_at: row.booked_at, market: row.market,
});

function supabaseBackend(client) {
  const table = () => client.from("diagnoses");
  return {
    name: "supabase",
    init() {},
    async save(record) {
      const { error } = await table().insert(toRow(record));
      if (error) throw new Error(`supabase insert failed: ${error.message}`);
    },
    async get(id) {
      const { data, error } = await table().select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`supabase select failed: ${error.message}`);
      return data ? fromRow(data) : null;
    },
    async update(id, fields) {
      const patch = {};
      if ("plans" in fields) patch.plan = fields.plans;
      if ("status" in fields) patch.status = fields.status;
      if ("booked_at" in fields) patch.booked_at = fields.booked_at;
      const { data, error } = await table().update(patch).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`supabase update failed: ${error.message}`);
      return data ? fromRow(data) : null;
    },
    async list(limit) {
      const { data, error } = await table().select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw new Error(`supabase list failed: ${error.message}`);
      return (data || []).map(fromRow);
    },
    async addWaitlist(entry) {
      const { error } = await client.from("waitlist").insert(entry);
      if (error) throw new Error(`supabase waitlist insert failed: ${error.message}`);
    },
  };
}

let backend = files;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  const { createClient } = require("@supabase/supabase-js");
  backend = supabaseBackend(createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } }));
}

module.exports = {
  init: () => backend.init(),
  backendName: () => backend.name,
  // Tests can put a stand-in Supabase client here.
  useSupabaseClient: (client) => { backend = supabaseBackend(client); },
  async save(result) {
    const record = { id: newId(), created_at: new Date().toISOString(), ...result };
    await backend.save(record);
    return record;
  },
  async get(id) {
    if (!ID_RE.test(String(id))) return null;
    return backend.get(id);
  },
  async update(id, fields) {
    if (!ID_RE.test(String(id))) return null;
    return backend.update(id, fields);
  },
  // The most recent results first (for /admin).
  list: (limit = 30) => backend.list(Math.min(Math.max(1, limit), 100)),
  // A teacher's email for the "coming soon" list.
  addWaitlist: (entry) => backend.addWaitlist({ created_at: new Date().toISOString(), ...entry }),
  marketOf,
  ID_RE,
  get RESULTS_DIR() { return RESULTS_DIR; },
};
