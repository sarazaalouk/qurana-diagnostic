// Builds the Qurana curriculum template for the teachers (no model; teachers fill it in).
// The importer (tools/import-curriculum.js) reads the same sheets and columns: change both together.
// Run: npm run curriculum-template -- <out.xlsx>
const ExcelJS = require("exceljs");
const levels = require("../public/js/levels");
const options = require("../public/js/options");

const OLIVE = "FF4A520A", SAND = "FFD0C3A5", CREAM = "FFF4F0E6", YELLOW = "FFFFF2B3", WHITE = "FFFFFFFF";
const font = (o = {}) => ({ name: "Arial", size: 11, ...o });
const border = { top: { style: "thin", color: { argb: SAND } }, bottom: { style: "thin", color: { argb: SAND } }, left: { style: "thin", color: { argb: SAND } }, right: { style: "thin", color: { argb: SAND } } };
const solid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

// Sheet names and fixed rows, shared with the importer.
// Programs: the known ones get a short id; any program the teachers add to the lists tab is kept by its name.
const SHEETS = {
  readme: "اقرئي أولًا", levels: "المستويات", stages: "المراحل", map: "ربط التشخيص", goals: "ربط الأهداف",
  rules: "قواعد الخطة", approval: "الاعتماد", lists: "القوائم",
};
const FIRST_ROW = 4; // rows 1–3 are the title, the note and the column headers
const LEVEL_ROWS = 13, STAGE_ROWS = 120, RULE_ROWS = 12;

const PROGRAMS = {
  "تأسيس القراءة (نور البيان)": "reading", "حفظ القرآن الكريم": "hifz", "التجويد": "tajweed",
  "التلاوة": "recitation", "اللغة العربية": "arabic", "الدراسات الإسلامية": "islamic",
};
const TRACKS = { "المسار العربي": "arabic", "المسار الإنجليزي": "english", "الاتنين": "both" };
const RULE_TYPES = { "لازم": "must", "ممنوع": "never", "يُفضّل": "prefer" };
const STATUSES = { "مسودة": "draft", "معتمد": "approved" };
const AGES = ["4–6", "6–8", "8–10", "10–12", "12+"];

function build() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Qurana";
  wb.created = new Date();

  function sheet(name) {
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 3 }] });
    ws.properties.defaultRowHeight = 22;
    return ws;
  }

  function header(ws, title, note, cols) {
    ws.mergeCells(1, 1, 1, cols.length);
    const t = ws.getCell(1, 1);
    t.value = title;
    t.font = font({ size: 15, bold: true, color: { argb: OLIVE } });
    t.alignment = { horizontal: "right", vertical: "middle" };
    ws.getRow(1).height = 30;
    ws.mergeCells(2, 1, 2, cols.length);
    const n = ws.getCell(2, 1);
    n.value = note;
    n.font = font({ size: 10, italic: true, color: { argb: "FF6B5A45" } });
    n.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
    ws.getRow(2).height = 34;
    cols.forEach((c, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value = c.h;
      cell.font = font({ bold: true, color: { argb: WHITE } });
      cell.fill = solid(c.auto ? "FF8CA12B" : OLIVE);
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = border;
      ws.getColumn(i + 1).width = c.w;
    });
    ws.getRow(3).height = 36;
  }

  function rows(ws, count, cols, example, inputCols) {
    for (let r = FIRST_ROW; r < FIRST_ROW + count; r++) {
      const isExample = r === FIRST_ROW;
      ws.getRow(r).height = isExample ? 48 : 30;
      cols.forEach((c, i) => {
        const cell = ws.getCell(r, i + 1);
        if (isExample && example[i] !== undefined) cell.value = example[i];
        cell.font = font({ color: { argb: isExample ? "FF8A7A60" : "FF0000FF" }, italic: isExample });
        cell.alignment = { horizontal: "right", vertical: "top", wrapText: true };
        cell.border = border;
        if (!isExample && inputCols.includes(i)) cell.fill = solid(YELLOW);
        if (isExample) cell.fill = solid(CREAM);
      });
    }
  }

  // ---------- 1. Read first ----------
  const readme = sheet(SHEETS.readme);
  readme.views = [{ rightToLeft: true }];
  readme.getColumn(1).width = 110;
  const lines = [
    ["قالب منهج قرآنا — للمعلمات", { size: 16, bold: true, color: { argb: OLIVE } }],
    ["الملف ده هو المنهج المعتمد اللي هتطلع منه خطة كل طفل بعد التشخيص. الذكاء الاصطناعي بيختار ويرتّب من اللي هنا بس، ومش بيضيف مراحل ولا أهداف من عنده.", {}],
    ["", {}],
    ["إزاي تملوه", { bold: true, color: { argb: OLIVE } }],
    ["1) تبويب «المستويات»: كل مستوى في سطر (مثلًا: تأسيس الحروف، القراءة، الحفظ…). الكود قصير ومش بيتكرر (L1، L2، …).", {}],
    ["2) تبويب «المراحل»: كل مرحلة جوه مستوى في سطر، بنفس كود المستوى. المراحل بالترتيب اللي الطفل بيمشي بيه. كود المرحلة بيطلع لوحده (مثلًا L1-S1).", {}],
    ["3) تبويب «ربط التشخيص»: لكل نتيجة من نتايج التشخيص الست، اختاروا كود المرحلة اللي الطفل يبدأ منها (أول مرحلة ما أتقنهاش).", {}],
    ["3ب) تبويب «ربط الأهداف»: لكل هدف من أهداف الأهل، اختاروا آخر مرحلة في رحلته. المسار = من مرحلة البداية لحد المرحلة دي، بمراحل التأسيس ومراحل برنامج الهدف بس. سيبوها فاضية لو الهدف ده مراحل التأسيس بس.", {}],
    ["3ج) عدد الحصص في كل مرحلة من خبرتكم: الصفحة بتجمعه وتقسمه على عدد الحصص الأسبوعية اللي الأهل اختاروه، فيطلع تقدير بالأسابيع.", {}],
    ["4) تبويب «قواعد الخطة»: اكتبوا اللي لازم يتقال لولي الأمر واللي ممنوع يتقال.", {}],
    ["5) تبويب «الاعتماد»: اسم اللي راجعت، والتاريخ، وحالة المنهج. الخطط ما بتظهرش للأهل إلا لما الحالة تبقى «معتمد».", {}],
    ["6) الخانات الصفرا هي اللي بتتملي. أول سطر رمادي في كل تبويب «مثال» يوضّح الشكل المطلوب — امسحوه أو اكتبوا فوقه (السطر اللي اسمه بيبدأ بكلمة «مثال» ما بيتقراش).", {}],
    ["7) الأعمدة الإنجليزي (اختيارية) بتظهر للأهل اللي بيستخدموا الصفحة بالإنجليزي. لو فاضية، الأهل دول هيشوفوا النص العربي.", {}],
    ["", {}],
    ["قواعد مهمة", { bold: true, color: { argb: OLIVE } }],
    ["• ما نكتبش وعود بنتايج بمدة محددة (زي «يحفظ جزء عمّ في 3 شهور»). نكتب «عدد حصص تقريبي» كتقدير بيراجعه المعلم.", {}],
    ["• ما نكتبش نص آيات في الملف. نكتب اسم السورة ورقم الآيات بس (مثلًا: الفاتحة 1–7).", {}],
    ["• عدد الحصص التقريبي بحصص 30 دقيقة.", {}],
    ["• «علامة الانتقال» = إيه اللي لازم الطفل يعمله عشان ينتقل للمرحلة اللي بعدها (حاجة يقدر المعلم يقيسها).", {}],
  ];
  lines.forEach(([text, f], i) => {
    const c = readme.getCell(i + 1, 1);
    c.value = text;
    c.font = font(f);
    c.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
    readme.getRow(i + 1).height = text.length > 100 ? 36 : 24;
  });

  // ---------- 2. Levels ----------
  const lv = sheet(SHEETS.levels);
  const lvCols = [
    { h: "كود المستوى", w: 12 },
    { h: "اسم المستوى", w: 24 },
    { h: "وصف قصير لولي الأمر", w: 42 },
    { h: "علامات المستوى في التشخيص (إيه اللي الطفل بيقدر يعمله)", w: 46 },
    { h: "العمر المناسب", w: 14 },
    { h: "عدد المراحل (تلقائي)", w: 14, auto: true },
    { h: "اسم المستوى بالإنجليزي (اختياري)", w: 26 },
  ];
  header(lv, "المستويات", "كل مستوى في سطر، بالترتيب من الأسهل للأصعب. أول سطر مثال. عمود «عدد المراحل» بيتحسب لوحده من تبويب المراحل.", lvCols);
  rows(lv, LEVEL_ROWS, lvCols, [
    "L1",
    "مثال: تأسيس الحروف",
    "الطفل بيتعرّف على الحروف العربية وأصواتها وأشكالها عشان يبدأ يقرأ.",
    "بيعرف أقل من نص الحروف بالصوت، ومش بيقرأ كلمات.",
    "4–6",
    undefined,
    "Example: Letter foundations",
  ], [0, 1, 2, 3, 4, 6]);
  const lastLevelRow = FIRST_ROW + LEVEL_ROWS - 1;
  for (let r = FIRST_ROW; r <= lastLevelRow; r++) {
    const cell = lv.getCell(r, 6);
    cell.value = { formula: `IF(A${r}="","",COUNTIF('${SHEETS.stages}'!$A$${FIRST_ROW}:$A$300,A${r}))` };
    cell.font = font();
    cell.alignment = { horizontal: "center", vertical: "top" };
    cell.fill = r === FIRST_ROW ? solid(CREAM) : undefined;
    lv.getCell(r, 5).dataValidation = { type: "list", allowBlank: true, formulae: [`'${SHEETS.lists}'!$C$2:$C$20`] };
  }

  // ---------- 3. Stages ----------
  const st = sheet(SHEETS.stages);
  const stCols = [
    { h: "كود المستوى", w: 12 },
    { h: "رقم المرحلة", w: 10 },
    { h: "اسم المرحلة", w: 24 },
    { h: "البرنامج", w: 22 },
    { h: "المسار", w: 16 },
    { h: "أهداف المرحلة (الطفل هيقدر…)", w: 40 },
    { h: "المحتوى (سور بأرقام الآيات، أو دروس الكتاب)", w: 36 },
    { h: "عدد حصص تقريبي (30 د)", w: 14 },
    { h: "علامة الانتقال للمرحلة اللي بعدها", w: 34 },
    { h: "ملاحظات للمعلم (ما بتظهرش للأهل)", w: 30 },
    { h: "اسم المرحلة بالإنجليزي", w: 24 },
    { h: "الأهداف بالإنجليزي", w: 34 },
    { h: "المحتوى بالإنجليزي", w: 30 },
    { h: "علامة الانتقال بالإنجليزي", w: 30 },
    { h: "كود المرحلة (تلقائي)", w: 13, auto: true },
    { h: "شرط الدخول (اختياري)", w: 30 },
    { h: "شرط الدخول بالإنجليزي (اختياري)", w: 30 },
  ];
  header(st, "المراحل", "كل مرحلة في سطر، بكود المستوى بتاعها ورقمها بالترتيب. أول سطر مثال. البرنامج والمسار من القائمة المنسدلة. الأعمدة الإنجليزي اختيارية.", stCols);
  rows(st, STAGE_ROWS, stCols, [
    "L1",
    1,
    "مثال: حروف البسملة",
    "تأسيس القراءة (نور البيان)",
    "الاتنين",
    "يميّز أصوات وأشكال حروف ب س م ل ر ح، ويقرأ كلمات قصيرة بالفتح منها.",
    "نور البيان: الدروس الأولى · البسملة (الفاتحة 1)",
    6,
    "يقرأ 3 كلمات بالفتح من حروف البسملة من غير مساعدة.",
    "نستخدم ألعاب الحروف في أول كل حصة.",
    "Example: The letters of the Bismillah",
    "Recognizes the sounds and shapes of the Bismillah letters and reads short words with fatha.",
    "Noor Al-Bayan: first lessons · the Bismillah (Al-Fatiha 1)",
    "Reads 3 fatha words made of the Bismillah letters without help.",
    undefined,
    "بداية الرحلة: ما فيش شرط",
    "Start of the journey: no condition",
  ], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16]);
  const lastStageRow = FIRST_ROW + STAGE_ROWS - 1;
  for (let r = FIRST_ROW; r <= lastStageRow; r++) {
    st.getCell(r, 4).dataValidation = { type: "list", allowBlank: true, formulae: [`'${SHEETS.lists}'!$A$2:$A$30`] };
    st.getCell(r, 5).dataValidation = { type: "list", allowBlank: true, formulae: [`'${SHEETS.lists}'!$B$2:$B$10`] };
    st.getCell(r, 1).dataValidation = { type: "list", allowBlank: true, formulae: [`'${SHEETS.levels}'!$A$${FIRST_ROW}:$A$${lastLevelRow}`] };
    st.getCell(r, 8).dataValidation = { type: "whole", operator: "between", allowBlank: true, formulae: [1, 200], showErrorMessage: true, error: "اكتبي رقم حصص من 1 لـ 200" };
    const code = st.getCell(r, 15);
    code.value = { formula: `IF(OR(A${r}="",B${r}=""),"",A${r}&"-S"&B${r})` };
    code.font = font({ bold: true });
    code.alignment = { horizontal: "center", vertical: "top" };
    code.fill = r === FIRST_ROW ? solid(CREAM) : undefined;
  }

  // ---------- 4. Diagnosis → start stage ----------
  const mp = sheet(SHEETS.map);
  const mpCols = [
    { h: "نتيجة التشخيص", w: 12 },
    { h: "اسمها في صفحة النتيجة", w: 24 },
    { h: "اللي الطفل محتاج يركّز عليه", w: 44 },
    { h: "يبدأ من مرحلة (كود المرحلة)", w: 20 },
    { h: "ملاحظة", w: 30 },
  ];
  header(mp, "ربط التشخيص بالمنهج", "لكل نتيجة من نتايج التشخيص: الطفل يبدأ من أنهي مرحلة؟ اختاروا كود المرحلة من القائمة (مثلًا L1-S1). الخطة بتبدأ من المرحلة دي وتكمّل بالترتيب.", mpCols);
  Object.entries(levels.LEVELS).forEach(([code, l], i) => {
    const r = FIRST_ROW + i;
    mp.getRow(r).height = 34;
    [code, l.name, l.focus, null, null].forEach((v, j) => {
      const cell = mp.getCell(r, j + 1);
      cell.value = v;
      cell.font = font({ bold: j === 0, color: { argb: j === 3 || j === 4 ? "FF0000FF" : "FF3E2A18" } });
      cell.alignment = { horizontal: j === 0 ? "center" : "right", vertical: "top", wrapText: true };
      cell.border = border;
      if (j === 3 || j === 4) cell.fill = solid(YELLOW);
    });
    mp.getCell(r, 4).dataValidation = {
      type: "list", allowBlank: true, showErrorMessage: true, error: "اختاري كود مرحلة من تبويب المراحل",
      formulae: [`'${SHEETS.stages}'!$O$${FIRST_ROW + 1}:$O$${lastStageRow}`],
    };
  });

  // ---------- 4b. Goal → last stage ----------
  const gm = sheet(SHEETS.goals);
  const gmCols = [
    { h: "كود الهدف", w: 12 },
    { h: "الهدف كما يظهر للأهل", w: 34 },
    { h: "آخر مرحلة في الرحلة (كود المرحلة)", w: 22 },
    { h: "ملاحظة", w: 30 },
  ];
  header(gm, "ربط أهداف الأهل بالمنهج", "لكل هدف: الرحلة بتنتهي عند أنهي مرحلة؟ (مثلًا الحفظ ينتهي عند آخر مرحلة حفظ). سيبوها فاضية لو الهدف ده مراحل التأسيس بس.", gmCols);
  options.GOALS.forEach((g, i) => {
    const r = FIRST_ROW + i;
    gm.getRow(r).height = 30;
    [g.id, g.label, null, null].forEach((v, j) => {
      const cell = gm.getCell(r, j + 1);
      cell.value = v;
      cell.font = font({ bold: j === 0, color: { argb: j >= 2 ? "FF0000FF" : "FF3E2A18" } });
      cell.alignment = { horizontal: j === 0 ? "center" : "right", vertical: "top", wrapText: true };
      cell.border = border;
      if (j >= 2) cell.fill = solid(YELLOW);
    });
    gm.getCell(r, 3).dataValidation = {
      type: "list", allowBlank: true, showErrorMessage: true, error: "اختاري كود مرحلة من تبويب المراحل",
      formulae: [`'${SHEETS.stages}'!$O${FIRST_ROW + 1}:$O${lastStageRow}`],
    };
  });

  // ---------- 5. Plan rules ----------
  const ru = sheet(SHEETS.rules);
  const ruCols = [
    { h: "النوع", w: 16 },
    { h: "القاعدة", w: 70 },
    { h: "مثال", w: 46 },
  ];
  header(ru, "قواعد كتابة الخطة لولي الأمر", "القواعد اللي الخطة اللي بتطلع بعد التشخيص لازم تمشي عليها. أول سطور مقترحة — عدّلوها أو امسحوها أو زوّدوا عليها.", ruCols);
  const rules = [
    ["لازم", "الخطة تقول إنها مقترحة ويراجعها المعلم في الحصة التجريبية.", "«دي خطة مقترحة حسب نتيجة التشخيص، والمعلمة هتراجعها معاكم في الحصة المجانية.»"],
    ["لازم", "كل مرحلة في الخطة تكون من تبويب المراحل بنفس الاسم والأهداف.", ""],
    ["ممنوع", "وعود بنتيجة في مدة محددة.", "❌ «هيحفظ جزء عمّ في 3 شهور»"],
    ["ممنوع", "نص آيات مكتوب في الخطة. نكتب اسم السورة وأرقام الآيات بس.", "✔ «سورة الفاتحة (1–7)»"],
    ["ممنوع", "مقارنة الطفل بأطفال تانيين أو وصفه بصفة سلبية.", "❌ «مستواه ضعيف»  ✔ «هيبدأ من مرحلة تأسيس الحروف»"],
  ];
  for (let i = 0; i < RULE_ROWS; i++) {
    const r = FIRST_ROW + i;
    const rw = rules[i] || ["", "", ""];
    ru.getRow(r).height = 34;
    rw.forEach((v, j) => {
      const cell = ru.getCell(r, j + 1);
      cell.value = v || null;
      cell.font = font({ color: { argb: "FF0000FF" } });
      cell.alignment = { horizontal: "right", vertical: "top", wrapText: true };
      cell.border = border;
      cell.fill = solid(YELLOW);
    });
    ru.getCell(r, 1).dataValidation = { type: "list", allowBlank: true, formulae: [`"${Object.keys(RULE_TYPES).join(",")}"`] };
  }

  // ---------- 6. Approval ----------
  const ap = wb.addWorksheet(SHEETS.approval, { views: [{ rightToLeft: true }] });
  ap.getColumn(1).width = 30;
  ap.getColumn(2).width = 40;
  ap.getCell("A1").value = "اعتماد المنهج";
  ap.getCell("A1").font = font({ size: 15, bold: true, color: { argb: OLIVE } });
  ap.getCell("A2").value = "الخطط ما بتظهرش للأهل إلا لما الحالة «معتمد» ويكون فيه اسم اللي راجعت وتاريخ الاعتماد.";
  ap.getCell("A2").font = font({ size: 10, italic: true, color: { argb: "FF6B5A45" } });
  [["المسؤولة عن الملف", ""], ["راجعته واعتمدته", ""], ["تاريخ الاعتماد", ""], ["حالة المنهج", "مسودة"]].forEach(([label, v], i) => {
    const r = 4 + i;
    ap.getRow(r).height = 28;
    const a = ap.getCell(r, 1), b = ap.getCell(r, 2);
    a.value = label;
    a.font = font({ bold: true });
    b.value = v || null;
    b.font = font({ color: { argb: "FF0000FF" } });
    b.fill = solid(YELLOW);
    [a, b].forEach((c) => { c.border = border; c.alignment = { horizontal: "right", vertical: "middle" }; });
  });
  ap.getCell("B7").dataValidation = { type: "list", allowBlank: false, formulae: [`"${Object.keys(STATUSES).join(",")}"`] };

  // ---------- 7. Lists (for dropdowns) ----------
  const lists = wb.addWorksheet(SHEETS.lists, { views: [{ rightToLeft: true }] });
  lists.getCell("A1").value = "البرامج"; lists.getCell("B1").value = "المسار"; lists.getCell("C1").value = "الأعمار";
  Object.keys(PROGRAMS).forEach((p, i) => (lists.getCell(i + 2, 1).value = p));
  Object.keys(TRACKS).forEach((p, i) => (lists.getCell(i + 2, 2).value = p));
  AGES.forEach((p, i) => (lists.getCell(i + 2, 3).value = p));
  ["A", "B", "C"].forEach((c) => { lists.getColumn(c).width = 30; lists.getCell(`${c}1`).font = font({ bold: true, color: { argb: OLIVE } }); });
  for (let r = 2; r <= 8; r++) ["A", "B", "C"].forEach((c) => (lists.getCell(`${c}${r}`).font = font()));
  lists.getCell("E1").value = "تقدروا تضيفوا برامج (كورسات قرآنا) وأعمار جديدة تحت كل قائمة، وهتظهر في القوائم المنسدلة.";
  lists.getCell("E1").font = font({ italic: true, size: 10 });

  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

// Fills the template from a curriculum (data/curriculum.json) as starting values for the teachers to correct.
// The example rows stay; the approval stays as it is in the curriculum (a draft stays «مسودة»).
function prefill(wb, c) {
  const nameOf = (table, id) => Object.keys(table).find((k) => table[k] === id) || id;
  const lv = wb.getWorksheet(SHEETS.levels);
  c.levels.forEach((l, i) => {
    const row = lv.getRow(FIRST_ROW + 1 + i);
    [l.code, l.name, l.description, l.diagnosis_signs, l.age].forEach((v, j) => (row.getCell(j + 1).value = v || null));
    row.getCell(7).value = l.name_en || null;
  });
  const st = wb.getWorksheet(SHEETS.stages);
  c.stages.forEach((s, i) => {
    const row = st.getRow(FIRST_ROW + 1 + i);
    [s.level, s.n, s.name, nameOf(PROGRAMS, s.program), nameOf(TRACKS, s.track || "both"), s.goals, s.content, s.sessions, s.exit_sign,
      s.teacher_note, s.name_en, s.goals_en, s.content_en, s.exit_sign_en].forEach((v, j) => (row.getCell(j + 1).value = v === undefined ? null : v));
    row.getCell(16).value = s.entry || null;
    row.getCell(17).value = s.entry_en || null;
  });
  const mp = wb.getWorksheet(SHEETS.map);
  for (let r = FIRST_ROW; r < FIRST_ROW + 6; r++) mp.getRow(r).getCell(4).value = c.diagnosis_map[mp.getRow(r).getCell(1).value] || null;
  const gm = wb.getWorksheet(SHEETS.goals);
  for (let r = FIRST_ROW; r < FIRST_ROW + options.GOALS.length; r++) gm.getRow(r).getCell(3).value = (c.goal_map || {})[gm.getRow(r).getCell(1).value] || null;
  const ru = wb.getWorksheet(SHEETS.rules);
  for (let r = FIRST_ROW; r < FIRST_ROW + RULE_ROWS; r++) [1, 2, 3].forEach((col) => (ru.getRow(r).getCell(col).value = null));
  (c.rules || []).forEach((x, i) => {
    const row = ru.getRow(FIRST_ROW + i);
    row.getCell(1).value = nameOf(RULE_TYPES, x.type);
    row.getCell(2).value = x.rule;
    row.getCell(3).value = x.example || null;
  });
  const ap = wb.getWorksheet(SHEETS.approval);
  ap.getCell("B4").value = c.owner || null;
  ap.getCell("B5").value = c.approved_by || null;
  ap.getCell("B6").value = c.approved_at || null;
  ap.getCell("B7").value = nameOf(STATUSES, c.status);
  return wb;
}

module.exports = { build, prefill, SHEETS, FIRST_ROW, LEVEL_ROWS, STAGE_ROWS, RULE_ROWS, PROGRAMS, TRACKS, RULE_TYPES, STATUSES };

if (require.main === module) {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--prefill");
  const from = args.includes("--prefill") ? args[args.indexOf("--prefill") + 1] : null;
  if (!out) { console.error("usage: npm run curriculum-template -- <out.xlsx> [--prefill data/curriculum.json]"); process.exit(1); }
  const wb = build();
  if (from) prefill(wb, JSON.parse(require("fs").readFileSync(from, "utf8")));
  wb.xlsx.writeFile(out).then(() => console.log("written", out, from ? `(prefilled from ${from})` : ""));
}
