/**
 * Auto-scales KaTeX display equations to fit within their container.
 * It measures the ratio between the content width (scrollWidth) and container width (clientWidth)
 * and scales down the font-size percentage accordingly.
 */
(function () {
  function scaleMath() {
    // Get all display math elements
    const maths = document.querySelectorAll('.katex-display');

    maths.forEach(el => {
      // 1. Reset font-size to allow natural expansion so we can measure true width again on resize
      el.style.fontSize = '';

      // 2. Measure widths
      // Use getBoundingClientRect for more precise fractional width
      const parentRect = el.parentElement.getBoundingClientRect();
      // Fallback to offsetWidth if rect is zero (e.g. hidden)
      const parentWidth = parentRect.width || el.parentElement.offsetWidth;

      // If parent has no width (e.g. display:none or inline issues), don't scale
      if (!parentWidth) return;

      const mathWidth = el.scrollWidth;

      // 3. Scale if needed
      if (mathWidth > parentWidth) {
        const scale = parentWidth / mathWidth;
        // Apply scale as a percentage of the current/inherited font size
        // We limit the minimum scale to avoid illegible text (e.g. 30%)
        const finalScale = Math.max(0.3, scale);
        el.style.fontSize = (finalScale * 100) + '%';
      }
    });
  }

  // Run on load
  window.addEventListener('DOMContentLoaded', scaleMath);
  // Run on load complete (sometimes fonts load late)
  window.addEventListener('load', scaleMath);
  // Run on resize (throttled slightly by browser usually, but good to be responsive)
  window.addEventListener('resize', scaleMath);
})();
