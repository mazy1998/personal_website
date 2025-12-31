// KaTeX auto-render bootstrap for this static site.
// Runs after KaTeX scripts load (they are included with `defer` in index.html).
(function () {
  window.addEventListener("DOMContentLoaded", function () {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  });
})();


