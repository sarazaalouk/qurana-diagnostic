// Levels: starting point, going down only if needed, and the level from the stages. Run: npm test
const L = require("../public/js/levels");
const O = require("../public/js/options");

let failed = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
};
const run = (estimate, results) => L.runStages(L.startStage(estimate), async (k) => ({ passed: results[k] }));

(async () => {
  let r = await run("mushaf", { fatiha: true, ayah: true });
  check("L1. a reader from the Mushaf starts at stage 5; passing both gives R6 and skips the letters", [r.shown, L.levelFrom(r.stages), r.stages.sound], [["fatiha", "ayah"], "R6", { passed: true, inferred: true }]);

  r = await run("mushaf", { fatiha: false, harakat: true });
  check("L2. failing stage 5 goes down to stage 4; passing it gives R5", [r.shown, L.levelFrom(r.stages)], [["fatiha", "harakat"], "R5"]);

  r = await run("words", { fatha: false, shape: false, sound: true });
  check("L3. going down stops at the first passed stage", [r.shown, L.levelFrom(r.stages)], [["fatha", "shape", "sound"], "R2"]);

  r = await run("none", { sound: false });
  check("L4. not knowing the letters gives R1", [r.shown, L.levelFrom(r.stages)], [["sound"], "R1"]);

  r = await run("letters", { shape: true, fatha: true, harakat: false });
  check("L5. passing the start keeps going up until a stage is not passed", [r.shown, L.levelFrom(r.stages)], [["shape", "fatha", "harakat"], "R4"]);

  r = await run("mushaf", { fatiha: true, ayah: false });
  check("L6. reading words from Al-Fatiha but not the whole ayah stays at R5", L.levelFrom(r.stages), "R5");

  check("L7. suggestion: English track for an English-speaking home, reading foundations while learning to read, Seed for 2 lessons a week",
    O.suggestion({ home_language: "en", goals: ["hifz"], age_band: "4–5", lessons_per_week: 2 }, "R3"),
    { track: "english", program: "reading", plan: "seed", then: "hifz", with_tajweed: false });
  check("L8. suggestion: a reader follows the goal, Arabic track, Growth plan for 3 lessons a week",
    O.suggestion({ home_language: "ar", goals: ["tajweed"], age_band: "8–9", lessons_per_week: 3 }, "R6"),
    { track: "arabic", program: "tajweed", plan: "growth", then: null, with_tajweed: false });
  check("L9. several goals: a reader who memorizes gets memorization with Tajweed alongside, not Tajweed after",
    O.suggestion({ home_language: "ar", goals: ["read", "hifz", "tajweed"], lessons_per_week: 3 }, "R6"),
    { track: "arabic", program: "hifz", plan: "growth", then: null, with_tajweed: true });
  check("L11. a child still learning to read: reading foundations, then memorization (no Tajweed alongside yet)",
    O.suggestion({ home_language: "ar", goals: ["hifz", "tajweed"], lessons_per_week: 3 }, "R3"),
    { track: "arabic", program: "reading", plan: "growth", then: "hifz", with_tajweed: false });
  check("L12. a reader whose parent answered yes to all three Tajweed questions needs no Tajweed alongside",
    O.suggestion({ home_language: "ar", goals: ["hifz"], lessons_per_week: 3, tajweed: { madd: "yes", ghunnah: "yes", qalqalah: "yes" } }, "R6").with_tajweed, false);
  check("L13. the focus order: no first, then sometimes, then not sure; yes needs none",
    O.focusOrder({ madd: "sometimes", ghunnah: "no", qalqalah: "yes" }), ["ghunnah", "madd"]);
  check("L14. adult level from the self-assessment and the ayah",
    [O.adultLevel("none", "easy"), O.adultLevel("slow", "hard"), O.adultLevel("fluent", "easy"), O.adultLevel("fluent", "no")], ["A1", "A2", "A3", "A1"]);
  check("L10. an older result with a single goal still works",
    O.suggestion({ home_language: "ar", goal: "tajweed", lessons_per_week: 3 }, "R6").program, "tajweed");

  console.log(failed ? `\n${failed} level case(s) failed` : "\nall level cases behaved as expected");
  process.exit(failed ? 1 : 0);
})();
