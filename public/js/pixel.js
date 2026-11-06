// Meta Pixel for ad measurement, privacy-gated. The pixel ID is public.
// - Global Privacy Control (navigator.globalPrivacyControl) → never loaded.
// - EU/EEA, UK, Switzerland, or an unknown region → loaded only after «موافق / Accept» on a small notice; the choice is
//   kept in localStorage and can be changed from the small link in the footer.
// - Everyone else (Gulf, US, …) → loaded normally, no notice.
// The region: the country header the server saw (if the host sends one, via /api/config), else the browser's time zone.
// Nothing about the visitor is sent with the events except what the pixel itself collects; no answers, no names.
(function () {
  const PIXEL_ID = "1369426931790241";
  const KEY = "qurana.adConsent"; // "granted" | "denied"
  // EU/EEA + UK + Switzerland.
  const CONSENT_COUNTRIES = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH".split(" "));
  // Time zones of those countries outside «Europe/…» (Atlantic islands, French overseas regions, Spanish Ceuta).
  const CONSENT_ZONES = /^(Europe\/|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)|Africa\/Ceuta|America\/(Guadeloupe|Martinique|Cayenne|Marigot|St_Barthelemy)|Indian\/(Reunion|Mayotte))/;

  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
  const gpc = () => { try { return navigator.globalPrivacyControl === true; } catch { return false; } };
  const lang = () => (document.documentElement.lang === "en" ? "en" : "ar");

  let loaded = false;
  let currentScreen = "";
  let lastView = "";
  let needsConsent = true; // until the region is known
  const waiting = []; // things to run once the pixel is allowed (the Lead on the result page)

  function load() {
    if (loaded || gpc()) return;
    loaded = true;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");
    lastView = location.pathname + "|" + currentScreen;
    while (waiting.length) { try { waiting.shift()(); } catch { /* never in the way */ } }
  }
  const allowed = () => loaded && typeof window.fbq === "function";

  // ---------- the notice (only where consent is needed) ----------
  const TEXT = {
    ar: { title: "ملفات تعريف الارتباط لقياس الإعلانات", body: "بإذنكم نستخدم بكسل ميتا لقياس الزيارات القادمة من إعلاناتنا. يمكنكم تغيير اختياركم في أي وقت.", yes: "موافق", no: "رفض", change: "إعدادات ملفات تعريف الارتباط" },
    en: { title: "Cookies for ad measurement", body: "With your permission, we use the Meta Pixel to measure visits from our ads. You can change your choice anytime.", yes: "Accept", no: "Decline", change: "Cookie settings" },
  };
  function notice() {
    if (document.getElementById("ad-consent")) return;
    const t = TEXT[lang()];
    const box = document.createElement("div");
    box.id = "ad-consent";
    box.className = "ad-consent";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-labelledby", "ad-consent-title");
    box.innerHTML = `<p class="ad-consent-title" id="ad-consent-title"></p><p class="ad-consent-body"></p><div class="ad-consent-buttons"><button type="button" class="btn secondary" data-c="granted"></button><button type="button" class="btn secondary" data-c="denied"></button></div>`;
    box.querySelector(".ad-consent-title").textContent = t.title;
    box.querySelector(".ad-consent-body").textContent = t.body;
    box.querySelector('[data-c="granted"]').textContent = t.yes;
    box.querySelector('[data-c="denied"]').textContent = t.no;
    box.addEventListener("click", (e) => {
      const c = e.target && e.target.getAttribute && e.target.getAttribute("data-c");
      if (!c) return;
      choose(c);
    });
    document.body.appendChild(box);
  }
  function choose(c) {
    write(KEY, c);
    const box = document.getElementById("ad-consent");
    if (box) box.remove();
    if (c === "granted") load();
    // A visitor who declines after accepting: the pixel stops with the next page load.
    else if (loaded) location.reload();
  }
  // The small link to change the choice, in the footer (only where consent is needed).
  function changeLink() {
    const footer = document.querySelector("footer.site");
    if (!footer || document.getElementById("ad-consent-change")) return;
    const a = document.createElement("button");
    a.type = "button";
    a.id = "ad-consent-change";
    a.className = "linklike small";
    a.textContent = TEXT[lang()].change;
    a.addEventListener("click", notice);
    const p = document.createElement("p");
    p.appendChild(a);
    footer.appendChild(p);
  }

  // ---------- the region, then start ----------
  function regionNeedsConsent(country) {
    if (country) return CONSENT_COUNTRIES.has(country);
    let zone = "";
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* no time zone */ }
    if (!zone || !zone.includes("/")) return true; // unknown → ask
    return CONSENT_ZONES.test(zone);
  }
  function start(country) {
    if (gpc()) return; // never with Global Privacy Control
    needsConsent = regionNeedsConsent(country);
    if (!needsConsent) return load();
    const choice = read(KEY);
    if (choice === "granted") load();
    else if (choice !== "denied") notice();
    changeLink();
  }
  function begin() {
    fetch("/api/config").then((r) => r.json()).then((c) => start(String(c.geo_country || "").toUpperCase())).catch(() => start(""));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", begin);
  else begin();

  // ---------- events ----------
  // A screen change in the page (the diagnostic is one page): one PageView per new screen.
  function pageView(name) {
    currentScreen = name || "";
    const key = location.pathname + "|" + currentScreen;
    if (key === lastView || !allowed()) return;
    lastView = key;
    try { window.fbq("track", "PageView"); } catch { /* never in the way */ }
  }
  // The Lead, once per attempt (the result id as eventID); later if the visitor accepts on this page.
  function lead(id) {
    if (!id || gpc()) return;
    const done = `qurana.leadSent.${id}`;
    const fire = () => {
      if (read(done) || !allowed()) return;
      write(done, "1");
      try { window.fbq("track", "Lead", {}, { eventID: id }); } catch { /* never in the way */ }
    };
    if (allowed()) fire(); else waiting.push(fire);
  }
  // Contact: the WhatsApp or booking button pressed on the result page. Skipped where tracking is not allowed.
  function contact(kind) {
    if (!allowed()) return;
    try { window.fbq("track", "Contact", { content_name: kind === "booking" ? "booking" : "whatsapp" }); } catch { /* never in the way */ }
  }
  window.QuranaPixel = { pageView, lead, contact, allowed: () => allowed(), _regionNeedsConsent: regionNeedsConsent };
})();
