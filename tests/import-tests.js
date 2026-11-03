// The curriculum importer: the template filled with the sample curriculum comes back the same; mistakes are named by sheet and row. Run: npm test
const fs = require("fs");
const os = require("os");
const path = require("path");
const ExcelJS = require("exceljs");
const T = require("../tools/curriculum-template");
const { readWorkbook } = require("../tools/import-curriculum");

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` -> ${detail}` : ""}`);
};

const sample = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "curriculum.json"), "utf8"));
// The template filled from the sample curriculum (as `--prefill` does), the example rows left in place.
// Stages are written out of order on purpose: the importer orders them by level, then stage number.
function filled({ approve = true } = {}) {
  const wb = T.prefill(T.build(), { ...sample, stages: [...sample.stages].reverse() });
  const ap = wb.getWorksheet(T.SHEETS.approval);
  if (approve) { ap.getCell("B5").value = "Sara Zaalouk"; ap.getCell("B6").value = new Date("2026-11-03"); ap.getCell("B7").value = "معتمد"; }
  return wb;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qurana-import-"));
const roundTrip = async (wb, name) => {
  const file = path.join(tmp, name);
  await wb.xlsx.writeFile(file);
  return readWorkbook(file);
};

(async () => {
  try {
    let out = await roundTrip(filled(), "good.xlsx");
    const c = out.curriculum;
    check("X1. a correctly filled template imports with no problems", out.problems.length === 0, out.problems.join(" | "));
    const strip = (s) => Object.fromEntries(Object.entries(s).sort(([a], [b]) => a.localeCompare(b)));
    check("X2. the stages come back exactly as written, in curriculum order (examples skipped)",
      c && JSON.stringify(c.stages.map(strip)) === JSON.stringify(sample.stages.map(strip)), c && c.stages.map((s) => s.id).join(","));
    check("X3. the diagnosis map, the goal map and the rules come back", c && JSON.stringify(c.diagnosis_map) === JSON.stringify(sample.diagnosis_map) && JSON.stringify(c.goal_map) === JSON.stringify(sample.goal_map) && c.rules.length === sample.rules.length);
    check("X4. approved with a name and a date gives status approved", c && c.status === "approved" && c.approved_by === "Sara Zaalouk" && c.approved_at === "2026-11-03");

    out = await roundTrip(filled({ approve: false }), "draft.xlsx");
    check("X5. without approval the curriculum stays a draft", out.curriculum && out.curriculum.status === "draft");

    let wb = filled();
    wb.getWorksheet(T.SHEETS.approval).getCell("B5").value = null;
    out = await roundTrip(wb, "no-reviewer.xlsx");
    check("X6. approved without a reviewer is refused", !out.curriculum && out.problems.some((p) => p.includes("الاعتماد")));

    wb = filled();
    wb.getWorksheet(T.SHEETS.map).getRow(T.FIRST_ROW + 2).getCell(4).value = "L9-S1";
    out = await roundTrip(wb, "bad-map.xlsx");
    check("X7. a start stage that does not exist is named with its row", !out.curriculum && out.problems.some((p) => p.includes("ربط التشخيص") && p.includes("سطر 6") && p.includes("L9-S1")), out.problems.join(" | "));

    wb = filled();
    const stRow = wb.getWorksheet(T.SHEETS.stages).getRow(T.FIRST_ROW + 1);
    stRow.getCell(7).value = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
    stRow.getCell(4).value = "برنامج غير موجود";
    stRow.getCell(8).value = "كثير";
    out = await roundTrip(wb, "bad-stage.xlsx");
    const at5 = out.problems.filter((p) => p.includes("«المراحل» سطر 5"));
    check("X8. ayah text, an unknown program and a non-number of lessons are each refused", at5.length === 3, at5.join(" | "));

    wb = filled();
    wb.getWorksheet(T.SHEETS.stages).getRow(T.FIRST_ROW + 2).getCell(11).value = "حروف";
    out = await roundTrip(wb, "arabic-in-english.xlsx");
    check("X9. Arabic in an English column is refused", !out.curriculum && out.problems.some((p) => p.includes("للإنجليزي")));

    wb = filled();
    wb.getWorksheet(T.SHEETS.stages).getRow(T.FIRST_ROW + 1).getCell(11).value = null;
    out = await roundTrip(wb, "missing-english.xlsx");
    check("X10. a missing English column is only a warning", out.curriculum && out.warnings.length === 1);

    wb = filled();
    const dup = wb.getWorksheet(T.SHEETS.stages).getRow(T.FIRST_ROW + 2);
    dup.getCell(1).value = sample.stages[0].level; dup.getCell(2).value = sample.stages[0].n;
    out = await roundTrip(wb, "dup.xlsx");
    check("X11. two stages with the same level and number are refused", !out.curriculum && out.problems.some((p) => p.includes("متكررة")));

    wb = filled();
    wb.getWorksheet(T.SHEETS.lists).getCell("A20").value = "برنامج الإجازة الصيفية";
    wb.getWorksheet(T.SHEETS.stages).getRow(T.FIRST_ROW + 1).getCell(4).value = "برنامج الإجازة الصيفية";
    out = await roundTrip(wb, "new-program.xlsx");
    check("X12. a program the teachers added to the lists tab is accepted by its name", out.curriculum && out.curriculum.stages.some((s) => s.program === "برنامج الإجازة الصيفية"), out.problems.join(" | "));

    wb = filled();
    wb.getWorksheet(T.SHEETS.goals).getRow(T.FIRST_ROW + 1).getCell(3).value = "L8-S8";
    out = await roundTrip(wb, "bad-goal.xlsx");
    check("X13. a goal ending at a stage that does not exist is refused", !out.curriculum && out.problems.some((p) => p.includes("ربط الأهداف") && p.includes("L8-S8")));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} import case(s) failed` : "\nall import cases behaved as expected");
  process.exit(failed ? 1 : 0);
})();
