/**
 * Auto-hides the navigation container when scrolling down, shows it when scrolling up.
 * Primarily intended for mobile to maximize reading space.
 */
(function () {
    let lastScrollY = window.scrollY;
    const navContainer = document.querySelector('.nav-container');

    if (!navContainer) return;

    function handleScroll() {
        const currentScrollY = window.scrollY;

        // Threshold to avoid jitter at the very top or small movements
        if (Math.abs(currentScrollY - lastScrollY) < 10) return;

        // Logic:
        // 1. Scrolling DOWN AND not at the very top (> 50px) -> Hide
        // 2. Scrolling UP -> Show
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
            navContainer.classList.add('nav-hidden');
        } else {
            navContainer.classList.remove('nav-hidden');
        }

        lastScrollY = currentScrollY;
    }

    // Throttle scroll event for performance
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    });
})();
