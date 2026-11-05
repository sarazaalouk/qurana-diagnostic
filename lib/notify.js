// An email to the institute (info@) for every new result, so nobody depends on the parent pressing «Send» in WhatsApp.
// Sent through the info@ mailbox itself (SMTP), set in Render: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and
// NOTIFY_TO (default: SMTP_USER). Without them nothing is sent and the result is saved as before.
// The email holds only what /admin already shows: who, level, age band, country, nickname and the result link.
const levels = require("../public/js/levels");

const config = () => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return { host: SMTP_HOST, port, secure: port === 465, user: SMTP_USER, pass: SMTP_PASS, to: process.env.NOTIFY_TO || SMTP_USER };
};
const enabled = () => Boolean(config());
const target = () => (config() || {}).to || "";

// The message: plain text, Arabic, short. No answers, no plan.
function message(record, link) {
  const p = record.profile || {};
  const adult = p.who === "adult";
  const code = adult ? p.adult_level : typeof record.level === "object" && record.level ? record.level.code : record.level;
  const lvl = (adult ? levels.ADULT_LEVELS : levels.LEVELS)[code];
  const levelName = lvl ? `${lvl.name} (${code})` : String(code || "—");
  const who = adult ? "بالغ" : p.nickname ? `طفل: ${p.nickname}` : "طفل";
  const subject = `نتيجة تشخيص جديدة — ${adult ? "بالغ" : p.nickname || "طفل"} — ${lvl ? lvl.name : code || ""}`.trim();
  const lines = [
    "وصلت نتيجة تشخيص جديدة على موقع قرآنا.",
    "",
    `من: ${who}`,
    `المستوى: ${levelName}`,
    ...(p.age_band ? [`العمر: ${p.age_band}`] : []),
    ...(p.country ? [`الدولة: ${p.country}`] : []),
    `الوقت: ${new Date(record.created_at || Date.now()).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}`,
    "",
    `رابط النتيجة: ${link}`,
    "",
    "ولي الأمر قد لا يرسل النتيجة على واتساب؛ النتائج كلها في صفحة /admin أيضًا.",
  ];
  return { subject, text: lines.join("\n") };
}

let transport = null; // made once; tests can pass their own
function getTransport(c) {
  if (!transport) transport = require("nodemailer").createTransport({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass } });
  return transport;
}
const useTransport = (t) => { transport = t; };

// Sends the email; never throws (a failed email must not fail the parent's result).
async function newResult(record, link) {
  const c = config();
  if (!c) return { sent: false, reason: "not configured" };
  try {
    const { subject, text } = message(record, link);
    await getTransport(c).sendMail({ from: `"تشخيص قرآنا" <${c.user}>`, to: c.to, subject, text });
    return { sent: true };
  } catch (err) {
    console.error(`notify: email for result ${record.id} failed: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

module.exports = { newResult, message, enabled, target, useTransport };
