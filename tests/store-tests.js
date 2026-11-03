// Result storage: the Supabase backend (with a stand-in client) and the files fallback. Run: npm test
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` -> ${detail}` : ""}`);
};

// A stand-in for the Supabase client: just the calls lib/store.js makes, over an in-memory table.
function fakeSupabase() {
  const rows = new Map();
  const calls = [];
  const query = (table) => {
    let op = null, payload = null, id = null;
    const q = {
      insert(row) { op = "insert"; payload = row; return q; },
      update(patch) { op = "update"; payload = patch; return q; },
      select() { if (!op) op = "select"; return q; },
      eq(col, v) { id = v; return q; },
      async maybeSingle() { return run(); },
      then(ok, bad) { return Promise.resolve(run()).then(ok, bad); },
    };
    function run() {
      calls.push({ table, op });
      if (op === "insert") {
        if (rows.has(payload.id)) return { data: null, error: { message: "duplicate key" } };
        rows.set(payload.id, JSON.parse(JSON.stringify(payload)));
        return { data: null, error: null };
      }
      if (op === "update") {
        if (!rows.has(id)) return { data: null, error: null };
        rows.set(id, { ...rows.get(id), ...payload });
      }
      return { data: rows.has(id) ? JSON.parse(JSON.stringify(rows.get(id))) : null, error: null };
    }
    return q;
  };
  return { rows, calls, from: (t) => query(t) };
}

(async () => {
  const store = require("../lib/store");
  const db = fakeSupabase();
  store.useSupabaseClient(db);
  const result = {
    profile: { nickname: "", age_band: "6–7", country: "KW", home_language: "ar", goals: ["hifz"], lessons_per_week: 3 },
    stages: { sound: { score: 5, total: 6, passed: true } },
    level: "R2",
    suggestion: { track: "arabic", program: "reading", plan: "growth", then: "hifz" },
  };
  const saved = await store.save(result);
  const row = db.rows.get(saved.id);
  check("S1. a result is written to the diagnoses table with its market, answers and level", db.calls[0].table === "diagnoses" && row.market === "kuwait" && row.level === "R2" && row.answers.profile.goals[0] === "hifz" && row.status === "new" && row.booked_at === null);
  check("S2. no phone, email or name column is written", !Object.keys(row).some((k) => /phone|email|name/i.test(k)));
  const back = await store.get(saved.id);
  check("S3. reading it back gives the same result", back.profile.country === "KW" && back.suggestion.then === "hifz" && back.level === "R2" && back.created_at === saved.created_at);
  await store.update(saved.id, { plans: { ar: { curriculum: "v1", notes: { status: "ready" } } } });
  check("S4. the notes are kept in the plan column", db.rows.get(saved.id).plan.ar.curriculum === "v1" && (await store.get(saved.id)).plans.ar.notes.status === "ready");
  check("S5. an unknown or malformed id gives nothing (and is not sent to the database)", (await store.get("doesnotexi")) === null && (await store.get("../etc")) === null);
  check("S6. markets: Kuwait, the Gulf, everyone else", store.marketOf("KW") === "kuwait" && store.marketOf("SA") === "gulf" && store.marketOf("GB") === "international");

  // Files fallback: a DATA_STORE_DIR that cannot be used (here a file, not a folder) falls back to the app's own folder.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qurana-store-"));
  const notAFolder = path.join(tmp, "file");
  fs.writeFileSync(notAFolder, "x");
  const out = execFileSync(process.execPath, ["-e", `require("./lib/store").init(); console.log("dir=" + require("./lib/store").RESULTS_DIR)`], {
    cwd: path.join(__dirname, ".."), env: { ...process.env, DATA_STORE_DIR: notAFolder, SUPABASE_URL: "", SUPABASE_SERVICE_KEY: "" }, stdio: ["ignore", "pipe", "pipe"],
  }).toString();
  check("S7. a results folder that cannot be written falls back to the app's folder instead of failing every save", out.includes(`dir=${path.join(__dirname, "..", "data", "results")}`), out.trim());
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(failed ? `\n${failed} store case(s) failed` : "\nall store cases behaved as expected");
  process.exit(failed ? 1 : 0);
})();
