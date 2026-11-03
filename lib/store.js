// Diagnostic results: one JSON file per result, under DATA_STORE_DIR/results (a lasting disk on Render)
// or data/results locally. Only what the result page needs: no phone, email or surname.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STORE_DIR = process.env.DATA_STORE_DIR ? path.resolve(process.env.DATA_STORE_DIR) : path.join(__dirname, "..", "data");
const RESULTS_DIR = path.join(STORE_DIR, "results");
const ID_RE = /^[a-z0-9]{10}$/;

function newId() {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return [...crypto.randomBytes(10)].map((b) => abc[b % abc.length]).join("");
}

function save(result) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const id = newId();
  const record = { id, created_at: new Date().toISOString(), ...result };
  fs.writeFileSync(path.join(RESULTS_DIR, `${id}.json`), JSON.stringify(record, null, 2) + "\n", "utf8");
  return record;
}

function get(id) {
  if (!ID_RE.test(String(id))) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

// Adds fields to a saved result (used to keep the learning plan once it is built).
function update(id, fields) {
  const record = get(id);
  if (!record) return null;
  const next = { ...record, ...fields };
  fs.writeFileSync(path.join(RESULTS_DIR, `${id}.json`), JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

module.exports = { save, get, update, RESULTS_DIR, ID_RE };
