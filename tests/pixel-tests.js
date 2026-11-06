// Meta Pixel (public/js/pixel.js) in a stand-in browser: who gets it, the notice, PageView per screen, one Lead. Run: npm test
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` -> ${detail}` : ""}`);
};
const code = fs.readFileSync(path.join(__dirname, "..", "public", "js", "pixel.js"), "utf8");

// A small browser: the time zone, GPC, the country the server saw, localStorage, and a record of fbq calls.
function browser({ zone = "Asia/Kuwait", gpc = false, country = "", stored = {}, lang = "ar" } = {}) {
  const calls = [], scripts = [], body = [];
  const storage = { ...stored };
  const el = (tag) => {
    const e = { tag, children: [], attrs: {}, className: "", textContent: "", innerHTML: "", listeners: {},
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      appendChild(c) { this.children.push(c); return c; }, addEventListener(t, f) { this.listeners[t] = f; },
      remove() { const i = body.indexOf(this); if (i >= 0) body.splice(i, 1); },
      querySelector(sel) { const m = /data-c="(\w+)"/.exec(sel); const k = { tag: "x", textContent: "", attrs: {}, getAttribute(n) { return this.attrs[n]; } }; if (m) k.attrs["data-c"] = m[1]; return k; } };
    return e;
  };
  const footer = el("footer");
  const document = {
    readyState: "complete", documentElement: { lang },
    createElement: (t) => { const e = el(t); if (t === "script") scripts.push(e); return e; },
    getElementsByTagName: () => [{ parentNode: { insertBefore: () => {} } }],
    getElementById: (id) => body.find((e) => e.id === id) || footer.children.flatMap((p) => p.children).find((e) => e.id === id) || null,
    querySelector: (s) => (s === "footer.site" ? footer : null),
    body: { appendChild: (e) => { body.push(e); return e; } },
    addEventListener: () => {},
  };
  const window = {
    document, location: { pathname: "/", reload: () => calls.push(["reload"]) },
    navigator: { globalPrivacyControl: gpc },
    localStorage: { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); } },
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: zone }) }) },
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ geo_country: country }) }),
  };
  window.window = window;
  const ctx = vm.createContext(window);
  vm.runInContext(code, ctx);
  // The pixel's script never loads here: fbq stays the queueing stub, which records the calls.
  const fbqCalls = () => (window.fbq ? window.fbq.queue.map((a) => [...a]) : []);
  return { window, storage, body, footer, scripts, fbqCalls, settle: () => new Promise((ok) => setImmediate(ok)) };
}

(async () => {
  // Gulf: loaded with no notice.
  let b = browser({ zone: "Asia/Kuwait" });
  await b.settle();
  let q = b.fbqCalls();
  check("X1. a visitor in the Gulf gets the pixel with no notice: init with the pixel ID, then one PageView",
    q[0] && q[0][0] === "init" && q[0][1] === "1369426931790241" && q[1] && q[1][1] === "PageView" && !b.body.length && b.scripts[0].src.includes("connect.facebook.net"), JSON.stringify(q));

  // Screen changes: one PageView per new screen, none for the same screen again.
  b.window.QuranaPixel.pageView("about");
  b.window.QuranaPixel.pageView("game");
  b.window.QuranaPixel.pageView("game");
  b.window.QuranaPixel.pageView("game");
  q = b.fbqCalls();
  check("X2. a new screen sends one PageView; the same screen again does not", q.filter((c) => c[1] === "PageView").length === 3, String(q.length));

  // The Lead: once per attempt, with the result id as eventID.
  b.window.QuranaPixel.lead("abcdefgh23");
  b.window.QuranaPixel.lead("abcdefgh23");
  q = b.fbqCalls();
  const leads = q.filter((c) => c[1] === "Lead");
  check("X3. the Lead fires once per diagnostic, with the result id as eventID", leads.length === 1 && leads[0][3].eventID === "abcdefgh23");
  const again = browser({ zone: "Asia/Kuwait", stored: { ...b.storage } });
  await again.settle();
  again.window.QuranaPixel.lead("abcdefgh23");
  check("X4. opening the result again later does not fire it again", !again.fbqCalls().some((c) => c[1] === "Lead"));

  // Contact: on each WhatsApp or booking press.
  b.window.QuranaPixel.contact("whatsapp");
  b.window.QuranaPixel.contact("booking");
  const contacts = b.fbqCalls().filter((c) => c[1] === "Contact");
  check("X14. the WhatsApp and booking buttons send Contact (whatsapp / booking)", contacts.length === 2 && contacts[0][2].content_name === "whatsapp" && contacts[1][2].content_name === "booking");

  // GPC: nothing at all.
  b = browser({ zone: "Asia/Kuwait", gpc: true });
  await b.settle();
  b.window.QuranaPixel.pageView("about");
  b.window.QuranaPixel.lead("gpcgpcgpc2");
  b.window.QuranaPixel.contact("whatsapp");
  check("X5. with Global Privacy Control the pixel never loads and the Lead is skipped", !b.window.fbq && !b.scripts.length && !b.body.length);

  // Europe: the notice first, nothing loaded until «Accept».
  b = browser({ zone: "Europe/Berlin", lang: "en" });
  await b.settle();
  const box = b.body.find((e) => e.id === "ad-consent");
  check("X6. a visitor in the EU sees the notice and the pixel is not loaded yet", box && !b.window.fbq && b.footer.children.length === 1);
  b.window.QuranaPixel.lead("euleadaaa2");
  check("X7. no Lead before consent", !b.window.fbq);
  box.listeners.click({ target: { getAttribute: () => "granted" } });
  q = b.fbqCalls();
  check("X8. after «Accept» the pixel loads, sends PageView, and the waiting Lead fires once", b.storage["qurana.adConsent"] === "granted" && q.some((c) => c[1] === "PageView") && q.filter((c) => c[1] === "Lead").length === 1 && !b.body.includes(box));

  // Declined: remembered, nothing loaded, no notice next time; the footer link can show it again.
  b = browser({ zone: "Europe/London", stored: { "qurana.adConsent": "denied" } });
  await b.settle();
  check("X9. a declined choice is remembered: no pixel and no notice, but the footer link to change it", !b.window.fbq && !b.body.length && b.footer.children.length === 1);

  // The region: the server's country wins; unknown asks.
  b = browser({ zone: "Asia/Kuwait", country: "FR" });
  await b.settle();
  check("X10. the country the host sends wins over the time zone (France → notice)", !!b.body.find((e) => e.id === "ad-consent") && !b.window.fbq);
  b = browser({ zone: "Europe/Paris", country: "AE" });
  await b.settle();
  check("X11. … and the other way round (UAE header, Paris clock → no notice)", !b.body.length && !!b.window.fbq);
  b = browser({ zone: "UTC" });
  await b.settle();
  check("X12. an unknown region asks first", !!b.body.find((e) => e.id === "ad-consent") && !b.window.fbq);
  const R = b.window.QuranaPixel._regionNeedsConsent;
  check("X13. GB, CH, NO need consent; SA, US, EG do not", ["GB", "CH", "NO", "IE"].every((c) => R(c)) && !["SA", "US", "EG", "KW"].some((c) => R(c)));

  console.log(failed ? `\n${failed} failed` : "\nall pixel tests passed");
  process.exit(failed ? 1 : 0);
})();
