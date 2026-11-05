// The diagnostic's step counter (no personal data): where visitors stop, and where they came from.
// Each event holds only: the step, a random id for this browser tab (so one visitor counts once per step),
// child / adult, the page language, and utm_source / utm_campaign from the link they opened.
// No name, no answers, no IP. Failures are ignored: counting must never get in the visitor's way.
(function () {
  const clean = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);
  const store = (() => { try { return window.sessionStorage; } catch { return null; } })();
  const get = (k) => { try { return store && store.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { store && store.setItem(k, v); } catch { /* storage blocked */ } };

  let session = get("qurana.session");
  if (!session) {
    const a = new Uint8Array(12);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 256));
    session = [...a].map((b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
    set("qurana.session", session);
  }
  // The source is kept from the first page of the visit (the link they came from), for every later step.
  const q = new URLSearchParams(location.search);
  // Without utm_source: the site they came from (e.g. quraana-institute.com, l.instagram.com), or «direct».
  if (!get("qurana.source")) {
    let from = "";
    try { from = document.referrer && new URL(document.referrer).origin !== location.origin ? new URL(document.referrer).hostname : ""; } catch { /* bad referrer */ }
    set("qurana.source", clean(q.get("utm_source")) || clean(from) || "direct");
    set("qurana.campaign", clean(q.get("utm_campaign")));
  }
  const source = () => get("qurana.source") || "";

  function track(event, who) {
    const body = JSON.stringify({ event, session, who: who === "adult" ? "adult" : who === "child" ? "child" : "", source: source(), campaign: get("qurana.campaign") || "", lang: document.documentElement.lang === "en" ? "en" : "ar" });
    try {
      // sendBeacon survives leaving the page (the WhatsApp and booking buttons open another page).
      if (navigator.sendBeacon && navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }))) return;
      fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch { /* never in the way */ }
  }
  window.QuranaTrack = { track, source, campaign: () => get("qurana.campaign") || "", session };
})();
