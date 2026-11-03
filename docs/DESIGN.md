# Qurana diagnostic — design

The page a parent opens from an ad or the bio: test.quraana-institute.com.
In 3–5 minutes the parent and child find the child's starting level, and get a result page with a fixed link and three next steps: book the free trial, send the result on WhatsApp, see the prices.

## Rules (from Sara and the Kottab project)
- **No invented content.** Every Arabic word the child reads comes exactly from `data/noor_albayan.json` (Noor Al-Bayan) or `data/quran_fatiha.json` (verified Uthmani text). Surahs are named, never quoted.
- **No model in step 1.** Levels come from fixed rules (`public/js/levels.js`). The learning plan (step 2) will be written by Claude **only from the curriculum the teachers approve**, checked by a validator, with no promises of results.
- **Minimal data.** No phone, email or surname in the diagnostic (those are asked only when booking). A nickname is optional. Results are kept to show the result page and to give the teacher context before the trial.
- **Parent present.** The parent reads the instructions, says the letter sounds and confirms the readings.

## Flow
1. **Welcome + consent** (parent): what it is, how long, that a grown-up sits with the child.
2. **About the child** (parent, 1 screen): nickname (optional), age band, country (detected), language at home, goal, surahs memorized (names) and how (listening / from the Mushaf / both — asked only when surahs are listed), lessons a week (2 or 3; it decides the plan), teacher preference, parent's estimate of the child's reading, and — only when the parent says the child reads from the Mushaf — three Tajweed basics (madd, ghunnah, qalqalah: yes / sometimes / no / not sure), for the teacher, not a game.
3. **Games** (child with parent): adaptive, starting from the parent's estimate and going down only if needed.
   1. Letter sounds — 6 letters of the Bismillah, pass 4.
   2. Letter shapes in a word — 4, pass 3.
   3. Reading with fatha — 3 Noor Al-Bayan words, pass 2.
   4. Reading with kasra and damma — 4 Noor Al-Bayan words, pass 3.
   5. Words from Al-Fatiha — 4 words from the verified file, pass 2.
   6. A whole ayah — 1:1 read in full, confirmed by the parent.
4. **Result** at `/r/<id>`: level, what the child did, memorized surahs, the suggested track/program/plan, and the three buttons.

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
- Result link: `<PUBLIC_BASE_URL>/r/<id>`.
- WhatsApp: `https://wa.me/201142847626` with a message holding the level and the result link.
- Prices: `<SITE_URL>/#plans`. Booking: `<SITE_URL>/register?diagnosis=<id>` (the site reads it in step 3).

## Languages
- Arabic (RTL) and English (LTR): `?lang=ar|en`, then the last choice (`localStorage` `qurana.lang`), then Arabic. Text in `public/js/i18n.js`; `npm test` checks both languages have the same keys.
- The Arabic letters and words the child reads stay Arabic in both languages.

## Learning plan (`GET /api/results/:id/plan?lang=`)
- Built from `data/curriculum.json` only (imported from the teachers' Excel template). Used only when `status` is `approved`; a draft is used only with `ALLOW_DRAFT_CURRICULUM=1` (local demo) and the page marks it "Test example".
- **The path is worked out by rules, not by the model** (`curriculum.path`): start = the stage `diagnosis_map` gives for the child's level (the first stage not yet mastered); end = the stage `goal_map` gives for the parent's goal (`""` = the last foundation stage); in between, the foundation stages (the program of the R1 start stage) and the stages of the goal's program, in curriculum order, for the child's track. A child already past the goal gets "reached" and no model call.
- Totals: lessons = the sum of the stages' lessons from the curriculum; weeks = lessons ÷ the lessons a week the parent chose, rounded up. Shown as an estimate the teacher reviews, not a promise.
- Claude (`claude-opus-5-5`) only writes the words: an intro, one note per path stage, a home tip. Stage names, goals, content, exit signs and every number are inserted by the server from the curriculum.
- Sent to Claude: age band, home language, goal, level, stage scores, surahs the parent listed and how they were memorized, the parent's Tajweed answers, lessons a week, track, teacher preference, the path and its totals. Never the nickname.
- Validator (`lib/plan.js`): notes exactly one per path stage in order; no number that is not in the path, the totals, the age band or the scores (Arabic-Indic digits included); lengths; no promises of results or durations; nothing that looks like Quran text; no Arabic script in the English plan. A rejected reply is written once more with the problems listed; if it fails again, or the model refuses, or the API fails, the path is shown from the curriculum without notes.
- A Claude plan is kept with the result per language and not built again; a fallback is tried again on the next visit.

## Curriculum template and import
- Template for the teachers: `npm run curriculum-template -- <out.xlsx> [--prefill data/curriculum.json]` (`tools/curriculum-template.js`); `--prefill` puts the current curriculum in as starting values (the sample: Sara's Noor Al-Bayan order and the first teacher's lesson estimates, marked in the teacher-notes column). Tabs: read first, levels, stages (with optional English columns, an optional entry condition and an automatic stage code `L1-S1`), diagnosis map (R1–R6 → start stage), goal map (each goal → last stage), plan rules, approval (owner, reviewer, date, status), lists.
- Import: `npm run import-curriculum -- <file.xlsx>` writes `data/curriculum.json`; `--check` only reports. Nothing is written if any row has a problem; each problem names the tab and the row. Example rows (name starting with «مثال») are skipped.
- Programs come from the lists tab, so the teachers can add Qurana's courses there; the known ones are stored by short id (reading, hifz, tajweed…), others by name.
- Refused: missing fields, unknown level/program/track, repeated stage, lessons not 1–200, text that looks like ayat, Arabic in an English column, a start or goal stage that does not exist, "approved" without a reviewer and a date. Missing English columns are only a warning (English parents see the Arabic text).
- The template and the importer share sheet names and lists (`tools/curriculum-template.js` exports them); change both together. `npm test` fills the template with the sample curriculum and imports it back.

## Steps
1. Diagnostic flow, result page, handoff.
2. Learning plan with Claude from the approved curriculum + validator; English version (this step).
3. Site integration (booking form prefilled, admin sees the result, suggested plan highlighted).
4. Deploy on Render (`test.quraana-institute.com`, lasting disk or database for results).
