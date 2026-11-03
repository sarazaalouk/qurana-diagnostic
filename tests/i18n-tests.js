// Interface text: both languages have the same keys, and every key the pages and scripts use exists. Run: npm test
const fs = require("fs");
const path = require("path");
const { T } = require("../public/js/i18n");

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` -> ${detail}` : ""}`);
};

const ar = Object.keys(T.ar), en = Object.keys(T.en);
check("I1. every Arabic key has an English text", ar.every((k) => en.includes(k)), ar.filter((k) => !en.includes(k)).join(", "));
check("I2. every English key has an Arabic text", en.every((k) => ar.includes(k)), en.filter((k) => !ar.includes(k)).join(", "));

const pub = path.join(__dirname, "..", "public");
const files = ["index.html", "result.html", "js/diagnosis.js"].map((f) => fs.readFileSync(path.join(pub, f), "utf8")).join("\n");
const used = new Set([
  ...[...files.matchAll(/data-i18n(?:-ph)?="([a-z_0-9]+)"/g)].map((m) => m[1]),
  ...[...files.matchAll(/\bt\("([a-z_0-9]*[a-z0-9])"/g)].map((m) => m[1]),
  // Built from a prefix: t("st_" + stage), t(`s${n}_label`) …
  ...require("../public/js/levels").STAGES.map((k) => `st_${k}`),
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`s${n}_label`, `s${n}_title`]),
]);
const missing = [...used].filter((k) => !T.ar[k] || !T.en[k]);
check(`I3. all ${used.size} keys used by the pages exist in both languages`, missing.length === 0, missing.join(", "));

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const diff = ar.filter((k) => T.en[k] && placeholders(T.ar[k]) !== placeholders(T.en[k]));
check("I4. both languages use the same {placeholders}", diff.length === 0, diff.join(", "));
// The language switch on the English page says "العربية" on purpose.
const arabicInEn = en.filter((k) => k !== "switch" && /[؀-ۿ]/.test(T.en[k].replace("قرآنا", "")));
check("I5. the English interface has no Arabic script outside the brand name and the switch to Arabic",arabicInEn.length === 0, arabicInEn.join(", "));

// The notes are written with AI: they are never called the teacher's, and the result page says how they were written.
const allText = JSON.stringify(T) + files;
check("I6. the AI-written notes are never called «ملاحظات المعلمة» / \"the teacher's notes\"", !/ملاحظات المعلمة|teacher's notes/.test(allText));
check("I7. the result page carries the line on how the notes were written", fs.readFileSync(path.join(pub, "result.html"), "utf8").includes('data-i18n="r_ai_note"') && /الذكاء الاصطناعي/.test(T.ar.r_ai_note) && /AI/.test(T.en.r_ai_note));

console.log(failed ? `\n${failed} i18n case(s) failed` : "\nall i18n cases behaved as expected");
process.exit(failed ? 1 : 0);
