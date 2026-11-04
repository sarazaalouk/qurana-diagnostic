// Game content comes only from the two source files. Run: npm test
const fs = require("fs");
const path = require("path");
const content = require("../lib/content");

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` -> ${detail}` : ""}`);
};

const c = content.gameContent();
check("C1. every Arabic word is found exactly in Noor Al-Bayan or the verified Quran file", content.unknownArabicWords(c).length === 0, content.unknownArabicWords(c).join(" "));
const quran = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "quran_fatiha.json"), "utf8"));
check("C2. the whole-ayah stage is ayah 1:1 exactly as in the file", c.ayah.items[0].text === quran.ayahs.find((a) => a.ayah === 1).text_ar);
check("C3. each letter round includes its right answer", c.sound.items.every((i) => i.choices.includes(i.letter)) && c.shape.items.every((i) => i.choices.includes(i.answer)));
check("C4. stage sizes: 6 sounds + 2 reserves, 4 shapes, 3 fatha, 4 harakat, 4 Fatiha words",
  [c.sound.items.length, c.shape.items.length, c.fatha.items.length, c.harakat.items.length, c.fatiha.items.length].join(",") === "8,4,3,4,4");
const fake = JSON.parse(JSON.stringify(c));
fake.fatha.items[0].word = "كَتَبَتْهُمَا";
check("C5. a word that is not in the sources is caught", content.unknownArabicWords(fake).includes("كَتَبَتْهُمَا"));

// ---- the reader games: words by position in the verified Al-Fatiha file ----
const fatihaWords = new Set(quran.ayahs.flatMap((a) => a.text_ar.split(/\s+/)));
check("C6. «find the word»: each word to find is in its ayah exactly once", c.find.items.every((x) => x.words.filter((w) => w === x.answer).length === 1));
check("C7. «where is the madd»: three choices from Al-Fatiha each, one answer", c.madd.items.every((x) => x.choices.length === 3 && x.choices.includes(x.answer) && x.choices.every((w) => fatihaWords.has(w))));

// ---- the adult's ayah: shown only once Sara has checked it ----
const os = require("os");
const { execFileSync } = require("child_process");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qurana-samples-"));
const adultAyah = (samples) => {
  const file = path.join(tmp, `s${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify({ samples }));
  const out = execFileSync(process.execPath, ["-e", `const c = require("./lib/content"); const g = c.gameContent(); console.log(JSON.stringify({ a: g.adult_ayah, unknown: c.unknownArabicWords(g) }))`],
    { cwd: path.join(__dirname, ".."), env: { ...process.env, QURAN_SAMPLES_PATH: file } }).toString();
  return JSON.parse(out);
};
const real = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "quran_samples.json"), "utf8"));
const shown = new Set(c.bank.map((x) => x.id));
check("C8. the samples file lists graded ayat from several surahs; only the checked ones are shown",
  real.samples.length >= 10 && new Set(real.samples.map((x) => x.surah)).size >= 10 && real.samples.every((x) => shown.has(x.id) === !!(x.text_ar && x.verified_by && x.verified_on)));
let r = adultAyah([{ surah: 67, surah_name: "الملك", ayah: 3, text_ar: "نص للتجربة فقط", verified_by: "", verified_on: "" }]);
check("C9. an ayah with text but no reviewer and date is not shown: Al-Fatiha 1:7 instead", r.a.ref === "1:7" && r.a.fallback === true && r.unknown.length === 0, JSON.stringify(r.a).slice(0, 80));
r = adultAyah([{ surah: 67, surah_name: "الملك", ayah: 3, text_ar: "نص للتجربة فقط", verified_by: "Sara", verified_on: "2026-11-04" }]);
check("C10. once checked (reviewer and date), the ayah is shown and its words pass the source check", r.a.ref === "67:3" && r.a.text === "نص للتجربة فقط" && r.unknown.length === 0);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(failed ? `\n${failed} content case(s) failed` : "\nall content cases behaved as expected");
process.exit(failed ? 1 : 0);
