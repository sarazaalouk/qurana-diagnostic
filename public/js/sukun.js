// Quran display only: the sukun is shown in the Madinah Mushaf form.
// U+0652 (ARABIC SUKUN) becomes U+06E1 (SMALL HIGH DOTLESS HEAD OF KHAH) inside .quran elements.
// data/quran_fatiha.json is not changed; only what is drawn on screen.
// Works in the browser (converts every .quran element, including ones added later)
// and in Node (mushafSukun, for tests/sukun-tests.js).
(function (root) {
  function mushafSukun(text) {
    return String(text).replace(/ْ/g, "ۡ");
  }

  function convert(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue.includes("ْ")) n.nodeValue = mushafSukun(n.nodeValue);
    }
  }

  function convertAll(scope) {
    if (scope.nodeType !== 1) return;
    if (scope.matches(".quran")) convert(scope);
    scope.querySelectorAll(".quran").forEach(convert);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { mushafSukun };
    return;
  }
  root.mushafSukun = mushafSukun;
  const start = () => {
    convertAll(document.body);
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") {
          const el = r.target.parentElement;
          if (el && el.closest(".quran")) convert(el.closest(".quran"));
        } else {
          r.addedNodes.forEach((n) => (n.nodeType === 1 ? convertAll(n) : n.parentElement && n.parentElement.closest(".quran") && convert(n.parentElement.closest(".quran"))));
        }
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(typeof window !== "undefined" ? window : globalThis);
