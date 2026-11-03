# Qurana diagnostic — design

The page a parent opens from an ad or the bio: test.quraana-institute.com.
In 3–5 minutes the parent and child find the child's starting level, and get a result page with a fixed link and three next steps: book the free trial, send the result on WhatsApp, see the prices.

## Rules (from Sara and the Kottab project)
- **No invented content.** Every Arabic word the child reads comes exactly from `data/noor_albayan.json` (Noor Al-Bayan) or `data/quran_fatiha.json` (verified Uthmani text). Surahs are named, never quoted.
- **No model in step 1.** Levels come from fixed rules (`public/js/levels.js`). The learning plan (step 2) will be written by Claude **only from the curriculum the teachers approve**, checked by a validator, with no promises of results.
- **Minimal data.** No phone, email or surname in the diagnostic (those are asked only when booking). A nickname is optional. Results are kept to show the result page and to give the teacher context before the trial.
- **Parent present.** The parent reads the instructions, says the letter sounds and confirms the readings.

## Flow
1. **Welcome + consent**: who is taking it — a child / an adult / a teacher.
2. **Child — about the child** (parent, 1 screen): nickname (optional), age band, country (detected), language at home, goals (one or more), surahs memorized (names) and how (listening / from the Mushaf / both — asked only when surahs are listed), lessons a week (3 chosen in advance with «ننصح بثلاث حصص أسبوعيًا لثبات التقدم»; 2 can be chosen), teacher preference, parent's estimate of the child's reading, Tajweed basics (madd, ghunnah, qalqalah — only when the parent says the child reads from the Mushaf), and «ما يستجيب له طفلكم» (optional): enjoys nasheeds and listening? writing and drawing? moving about? more excited by a challenge or by praise?
3. **Child — games** (child with parent): adaptive, starting from the parent's estimate and going down only if needed. Each item records the time to answer, whether the hint was opened, skips and the answer after a mistake (`public/js/signals.js`); only a short summary is sent (per game kind: count, correct, median time; hints; skips; after-mistake; slower in the second half).
   1. Letter sounds — 6 letters of the Bismillah, pass 4.
   2. Letter shapes in a word — 4, pass 3.
   3. Reading with fatha — 3 Noor Al-Bayan words, pass 2.
   4. Reading with kasra and damma — 4 Noor Al-Bayan words, pass 3.
   5. Words from Al-Fatiha — 4 words from the verified file, pass 2.
   6. A whole ayah — 1:1 read in full, confirmed by the parent.
2b. **Adult** (one screen): age band, country, own reading (don't read yet / slowly / fluently), ayah 1:1 read aloud (easily / with difficulty / couldn't), Tajweed basics (unless they don't read), goals (correct recitation / memorization / Tajweed / Ijazah), language of explanation, lessons a week, teacher. Level A1 (→ the R1 start), A2 (→ R5), A3 (→ R6); the same curriculum and rules build the path. Ijazah alone: "the teacher decides after a short test".
2c. **Teacher**: «قريبًا» — an email (with consent) for when the teachers' diagnostic opens (`waitlist` table). The teachers' diagnostic is a separate project.
4. **Result** at `/r/<id>`: level, the plan (time windows first), «ما لاحظناه» (children), what was done, the suggestion, and the three buttons.

## «ما يستجيب له طفلكم» (fixed rules, no model, no labels)
- From the signals and the parent's four answers: «ما لاحظناه» for the parent — up to three gentle sentences (hearing vs seeing, after a mistake, what keeps the child going, short parts); «كيف نبدأ معه» for the teacher in `/admin` — practical points (start with listening then reading, needs repetition, short attention span, responds to praise / a challenge, enjoys listening / drawing).
- Never "types of intelligence" or "learning styles": the research does not support them as a way to sort children. Tests check the words.

## Provisional levels (until the curriculum maps them)
| Code | Name | From the games |
|---|---|---|
| R1 | تأسيس الحروف | stage 1 not passed |
| R2 | أشكال الحروف | 1 passed, 2 not |
| R3 | القراءة بالفتح | 2 passed, 3 not |
| R4 | الحركات الثلاث | 3 passed, 4 not |
| R5 | القراءة من المصحف | 4 passed, 5 or 6 not |
| R6 | التلاوة والتجويد | 6 passed |

## Handoff (nothing is lost)
- Result link: `<PUBLIC_BASE_URL>/r/<id>`, used on the result page and its copy button, in the WhatsApp message, in the booking link and in `/admin`. Set `PUBLIC_BASE_URL` in Render (the Render address for now, then `https://test.quraana-institute.com`). Without it the address of the request is used; a localhost one shows «رابط محلي للتطوير، لا يعمل خارج هذا الجهاز».
- WhatsApp: `https://wa.me/201142847626` with a message holding the level and the result link.
- Prices: `<SITE_URL>/#plans`. Booking: `<SITE_URL>/register?diagnosis=<id>&result=<full result link>` (the site reads them in step 3).

## Languages
- Arabic (RTL) and English (LTR): `?lang=ar|en`, then the last choice (`localStorage` `qurana.lang`), then Arabic. Text in `public/js/i18n.js`; `npm test` checks both languages have the same keys.
- The Arabic letters and words the child reads stay Arabic in both languages.

## Learning plan (`GET /api/results/:id/path` at once, `GET /api/results/:id/notes` after the model)
- Built from `data/curriculum.json` only (imported from the teachers' Excel template). The plan itself never mentions the curriculum's status: access is decided by the gate below.
- **The path is worked out by rules, not by the model** (`curriculum.path`), from where the learner actually is:
  - start = the stage `diagnosis_map` gives for the level (the first stage not yet mastered); end = the furthest of the stages `goal_map` gives for the goals (`""` = the last foundation stage); in between, the foundation stages and the stages of the chosen goals' programs, in curriculum order, for the track;
  - memorization stages list their surahs (`surahs`): surahs the parent said are memorized count as done — a stage whose surahs are all memorized is left out; a partly memorized stage keeps the rest, with fewer lessons in proportion, and lists the memorized ones for review;
  - **Tajweed alongside, not after:** a learner who reads from the Mushaf (R5/R6, A2/A3) and memorizes gets no Tajweed stages after the memorization; each memorization stage gets one Tajweed point (`with_focus`) among the points it allows (`focus`), in the order of the answers: «لا» first, then «أحيانًا», then «لست متأكدًا» («نعم» needs none). The program reads «حفظ القرآن الكريم مع تجويد مصاحب». A beginner gets no Tajweed point.
  - already past every goal → "reached", no model call.
- Plan suggested: always Growth (3 a week). Seed is never suggested by the rules (not for age either); with 2 a week chosen, the weeks are worked out at 2, the page shows «اخترتم: البذرة» under the suggested Growth, and one sentence: «بثلاث حصص في الأسبوع تقلّ المدة إلى نحو N أسبوعًا».
- Totals: lessons = the sum of the stages' lessons; weeks = lessons ÷ lessons a week, rounded up, also shown for the other rate (2 or 3). Stated **once**, under the windows: «نحو N أسبوعًا … ويقلّ الوقت مع مراجعة قصيرة يومية في البيت والتزام الحصص، ويزيد مع الغياب».
- **Time windows** (`curriculum.windows`): «في الشهر الأول» = the stages begun in the first 4 weeks; «بعد ثلاثة أشهر تقريبًا» = the stage holding week 13; «على المدى الأبعد» = the last stage (the goal). Each shows its stages by rule at once; the model's two or three sentences fill it in. The stage list is folded into «تفاصيل المراحل».
- Claude (`claude-opus-5-5`) only writes the words: the three windows and a home tip, in the voice of `prompts/voice.md` (sent whole with every request). It is told not to state the totals. Stage names, goals, content, exit signs and every number are inserted by the server.
- Sent to Claude: who (child/adult), age band, goals, level, stage scores, memorized surahs and how, Tajweed answers, «ما لاحظناه», lessons a week, teacher preference, the path (with review and Tajweed points) and the windows. Never the nickname.
- Validator (`lib/plan.js`): lengths; no number outside the path, the lessons a week, the age band or the scores (so no totals in the windows; Arabic-Indic digits included); no promises; nothing that looks like Quran text; no Arabic script in English; none of `voice.md`'s «عبارات ممنوعة»; no labels; «ذكرتم / أخبرتمونا» at most once. A rejected reply is written once more with the problems listed; if it fails again, or the model refuses, or the API fails twice, the page stays complete without the words.
- Kept words carry the curriculum version and the voice-guide version they were written with; after a new import, the approval or an edit of `voice.md` they are written again. A failure is never kept.
- **Waiting on the result page:** four steps — «قراءة إجاباتكم» and «تحديد نقطة البداية» on a fixed short timer, «بناء المسار من المنهج» when the path has really arrived (about a second), «كتابة ملاحظات المعلمة» only when the words have really arrived. Until then each window and the home tip show «نكتب ملاحظات المعلمة…». If the model fails, «ستضيف المعلمة ملاحظاتها في الحصة التجريبية» and «حاول مرة أخرى» (asks for the words only).

## Storage (`lib/store.js`)
- On Render: Supabase Postgres, table `diagnoses` (`docs/supabase.sql`): id, created_at, market (kuwait / gulf / international, from the country), answers (profile, stages, suggestion), level, plan (the notes), status (new / booked / cancelled), booked_at. Needs `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (the service key stays on the server; RLS is on with no policies).
- Without those two variables: JSON files under `DATA_STORE_DIR/results` or `data/results` — for local development only. At start the folder is created; if it cannot be written the app falls back to its own folder and logs it, instead of failing every save. `/admin` shows which storage is in use.
- Deploy steps: `docs/deploy.md`.

## Access: internal preview until approval (`lib/access.js`)
- Until the curriculum is approved — status «معتمد» **and** a reviewer's name **and** a date in the «الاعتماد» tab — the whole app (pages and API) answers 503 with a neutral "not available yet" page that says nothing about the curriculum. Only `/admin`, `/api/admin/*`, `/css/*` and `/health` stay open.
- `/admin`: enter `ADMIN_PIN` (env, set in Render, never in the code) → a 12-hour HttpOnly session cookie; then the app opens for that browser as an internal preview. 5 wrong PINs from one address in 15 minutes → wait. Without `ADMIN_PIN` the preview cannot open at all.
- `/admin` shows the curriculum's current status and whether the link is public, and what is missing if it is not.
- After approval (and an import), the link is public; the result page is the same before and after — only whether it opens changes.

## Curriculum template and import
- Template for the teachers: `npm run curriculum-template -- <out.xlsx> [--prefill data/curriculum.json]` (`tools/curriculum-template.js`); `--prefill` puts the current curriculum in as starting values (the sample: Sara's Noor Al-Bayan order and the first teacher's lesson estimates, marked in the teacher-notes column). Tabs: read first, levels, stages (with optional English columns, an optional entry condition and an automatic stage code `L1-S1`), diagnosis map (R1–R6 → start stage), goal map (each goal → last stage), surahs and possible Tajweed points per memorization stage, plan rules, approval (owner, reviewer, date, status), lists.
- Import: `npm run import-curriculum -- <file.xlsx>` writes `data/curriculum.json`; `--check` only reports. Nothing is written if any row has a problem; each problem names the tab and the row. Example rows (name starting with «مثال») are skipped.
- Programs come from the lists tab, so the teachers can add Qurana's courses there; the known ones are stored by short id (reading, hifz, tajweed…), others by name.
- Refused: missing fields, unknown level/program/track, repeated stage, lessons not 1–200, text that looks like ayat, Arabic in an English column, a start or goal stage that does not exist, "approved" without a reviewer and a date. Missing English columns are only a warning (English parents see the Arabic text).
- The template and the importer share sheet names and lists (`tools/curriculum-template.js` exports them); change both together. `npm test` fills the template with the sample curriculum and imports it back.

## Steps
1. Diagnostic flow, result page, handoff.
2. Learning plan with Claude from the approved curriculum + validator; English version (this step).
3. Site integration (booking form prefilled, admin sees the result, suggested plan highlighted).
4. Deploy on Render (`test.quraana-institute.com`, lasting disk or database for results).
