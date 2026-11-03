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

console.log(failed ? `\n${failed} content case(s) failed` : "\nall content cases behaved as expected");
process.exit(failed ? 1 : 0);
